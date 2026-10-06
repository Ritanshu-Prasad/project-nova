import { flatTopics, type Block, type Course, type PlacedTopic, type Question } from './courseSchema';

/**
 * Quiz assembly. Every quiz is a fresh random draw of 5–10 questions spread across formats (multiple choice,
 * multiple select, true/false, fill-in, ordering, matching, writing code), easier first. In a full 10-question
 * quiz the last three are against the clock, with time scaled to each question's format and difficulty.
 *
 * Each topic's bank is its authored questions plus questions generated from the lesson itself (key terms,
 * steps, takeaways, formulas), so every topic can feed a varied quiz.
 */

/** A question plus where its topic sits in the course (0 = first planet, 1 = last) — later is rated higher. */
export interface RatedQuestion {
  q: Question;
  progress: number;
}

export interface BuiltQuiz {
  questions: RatedQuestion[];
  /** Seconds per question, or null when untimed. */
  limits: (number | null)[];
}

export const QUIZ_MIN = 5;
export const QUIZ_MAX = 10;
/** In a full-length quiz, this many final questions are timed. */
export const TIMED_LAST = 3;

/** Base seconds per format at difficulty 1; each step of difficulty adds 35%. */
const BASE_SECONDS: Record<Question['type'], number> = { truefalse: 15, mcq: 20, multi: 30, fill: 30, order: 40, match: 45, code: 120 };

export const timeLimitFor = (q: Question) => Math.round((BASE_SECONDS[q.type] * (1 + 0.35 * ((q.difficulty ?? 1) - 1))) / 5) * 5;

export const FORMAT_LABEL: Record<Question['type'], string> = {
  mcq: 'Multiple choice',
  multi: 'Multiple select',
  truefalse: 'True or false',
  fill: 'Fill in the blank',
  order: 'Put in order',
  match: 'Match the pairs',
  code: 'Write code',
};

/** "5–10 Q" style label for a bank of `n` questions. */
export const quizSizeLabel = (n: number) => (n >= QUIZ_MIN ? `${QUIZ_MIN}–${Math.min(QUIZ_MAX, n)}` : String(n));

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draws a quiz: random length, formats taken in turn so every quiz mixes them, hardest questions last. */
export function buildQuiz(pool: RatedQuestion[], rand: () => number = Math.random): BuiltQuiz {
  const seen = new Set<string>();
  const uniq = pool.filter((x) => !seen.has(x.q.q) && !!seen.add(x.q.q));
  const want = Math.min(uniq.length, QUIZ_MIN + Math.floor(rand() * (QUIZ_MAX - QUIZ_MIN + 1)));
  const byType = new Map<Question['type'], RatedQuestion[]>();
  for (const x of shuffle(uniq, rand)) byType.set(x.q.type, [...(byType.get(x.q.type) ?? []), x]);
  const types = shuffle([...byType.keys()], rand);
  const picked: RatedQuestion[] = [];
  while (picked.length < want) {
    for (const t of types) {
      const next = byType.get(t)?.pop();
      if (next) picked.push(next);
      if (picked.length === want) break;
    }
  }
  // Easier first (stable, so ties keep their random order) — the hardest land in the timed finale.
  picked.sort((a, b) => (a.q.difficulty ?? 1) - (b.q.difficulty ?? 1));
  const timedFrom = picked.length === QUIZ_MAX ? QUIZ_MAX - TIMED_LAST : Infinity;
  return { questions: picked, limits: picked.map((x, i) => (i >= timedFrom ? timeLimitFor(x.q) : null)) };
}

// ── Question generation from lesson content ─────────────────────────────────────────────────────────────

const banks = new WeakMap<Course, Map<string, Question[]>>();

/** A topic's full question bank: authored questions plus ones generated from its lesson. */
export function questionsFor(topic: PlacedTopic, course: Course): Question[] {
  let m = banks.get(course);
  if (!m) {
    m = generateBanks(course);
    banks.set(course, m);
  }
  return m.get(topic.id) ?? topic.quiz;
}

/** Deterministic per-topic randomness, so generated questions are stable between visits. */
function seeded(key: string): () => number {
  let s = 2166136261;
  for (let i = 0; i < key.length; i++) s = Math.imul(s ^ key.charCodeAt(i), 16777619) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const blocksOf = <T extends Block['type']>(t: PlacedTopic, type: T) => t.lesson.blocks.filter((b): b is Extract<Block, { type: T }> => b.type === type);
const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function generateBanks(course: Course): Map<string, Question[]> {
  const topics = flatTopics(course);
  const terms = topics.flatMap((t) => blocksOf(t, 'keyTerms').flatMap((b) => b.terms.map((x) => ({ ...x, topic: t.id }))));
  const points = topics.flatMap((t) => blocksOf(t, 'summary').flatMap((b) => b.points.map((p) => ({ p, topic: t.id }))));
  const formulas = topics.flatMap((t) => blocksOf(t, 'formula').map((f) => ({ ...f, topic: t.id })));
  const out = new Map<string, Question[]>();

  for (const t of topics) {
    const rand = seeded(t.id);
    const gen: Question[] = [];
    const mine = terms.filter((x) => x.topic === t.id);
    const others = shuffle(
      terms.filter((x) => x.topic !== t.id && !mine.some((m) => m.term === x.term)),
      rand,
    );

    // Multiple choice: which term matches this definition?
    for (const k of shuffle(mine, rand).slice(0, 2)) {
      const distract = [...mine.filter((x) => x.term !== k.term), ...others].map((x) => x.term).filter((x, i, a) => a.indexOf(x) === i);
      if (distract.length >= 2) gen.push({ type: 'mcq', q: `Which term matches: “${clip(k.def)}”?`, options: [k.term, ...distract.slice(0, 3)], answer: 0, why: `${k.term} — ${k.def}`, difficulty: 1 });
    }
    // Matching: terms to meanings.
    if (mine.length >= 3) gen.push({ type: 'match', q: 'Match each term to its meaning.', pairs: mine.slice(0, 4).map((x) => [x.term, clip(x.def, 110)] as [string, string]), why: 'Each term pairs with the definition from the lesson’s key terms.', difficulty: 2 });
    // Multiple select: which of these are this topic's key terms?
    if (mine.length >= 2 && others.length >= 2) {
      const right = mine.slice(0, 3).map((x) => x.term);
      gen.push({ type: 'multi', q: `Which of these are key terms in “${t.title}”?`, options: [...right, ...others.slice(0, 2).map((x) => x.term)], answers: right.map((_, i) => i), why: `This topic’s key terms: ${right.join(', ')}.`, difficulty: 2 });
    }
    // Ordering: the lesson's steps.
    for (const s of blocksOf(t, 'steps').filter((b) => b.steps.length >= 3).slice(0, 1)) {
      gen.push({ type: 'order', q: `Put these steps in order${s.title ? `: ${s.title}` : ''}.`, items: s.steps.slice(0, 6), why: `The order: ${s.steps.slice(0, 6).join(' → ')}.`, difficulty: 2 });
    }
    // Multiple select: takeaways of this topic vs. other topics'.
    const myPoints = points.filter((x) => x.topic === t.id).map((x) => x.p);
    const otherPoints = shuffle(points.filter((x) => x.topic !== t.id && !myPoints.includes(x.p)), rand).map((x) => x.p);
    if (myPoints.length >= 2 && otherPoints.length >= 2) {
      const right = myPoints.slice(0, 3);
      gen.push({ type: 'multi', q: `Which of these are takeaways from “${t.title}”?`, options: [...right, ...otherPoints.slice(0, 2)], answers: right.map((_, i) => i), why: `From this topic: ${right.join('; ')}.`, difficulty: 2 });
    }
    // Multiple choice: which formula is described?
    for (const f of formulas.filter((x) => x.topic === t.id && x.caption).slice(0, 1)) {
      const alt = shuffle(formulas.filter((x) => x.expr !== f.expr), rand).map((x) => x.expr);
      if (alt.length >= 2) gen.push({ type: 'mcq', q: `Which formula is this? ${clip(f.caption ?? '')}`, options: [f.expr, ...alt.slice(0, 3)], answer: 0, why: `${f.expr} — ${f.caption}`, difficulty: 2 });
    }

    const seen = new Set(t.quiz.map((q) => q.q));
    out.set(t.id, [...t.quiz, ...gen.filter((q) => !seen.has(q.q) && !!seen.add(q.q))]);
  }
  return out;
}
