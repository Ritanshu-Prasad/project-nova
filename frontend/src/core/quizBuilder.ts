import { flatTopics, type Block, type Course, type PlacedTopic, type Question } from './courseSchema';
import { isFillerLabel, stripStepLabel } from './labels';
import { prettyMath } from './mathText';

/**
 * Quiz assembly. A quiz is a random draw spread across formats (multiple choice, multiple select, true/false,
 * fill-in, ordering, matching, writing code), easier first:
 *   - lesson quizzes (end of each module): 3–5 questions, untimed;
 *   - hub quizzes (the big dashboard quiz): 5–10 questions; in a full 10-question quiz the last three are
 *     against the clock, with time scaled to each question's format and difficulty.
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

/** Hub quiz size. */
export const QUIZ_MIN = 5;
export const QUIZ_MAX = 10;
/** Lesson (end-of-module) quiz size. */
export const LESSON_QUIZ = { min: 3, max: 5 } as const;
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

/** "3–5" style label for a bank of `n` questions. */
export const quizSizeLabel = (n: number, min = QUIZ_MIN, max = QUIZ_MAX) => (n >= min ? `${min}–${Math.min(max, n)}` : String(n));

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draws a quiz: random length, formats taken in turn so every quiz mixes them, hardest questions last. */
export function buildQuiz(
  pool: RatedQuestion[],
  opts: { min?: number; max?: number; timedFinale?: boolean; prefer?: (x: RatedQuestion) => boolean } = {},
  rand: () => number = Math.random,
): BuiltQuiz {
  const { min = QUIZ_MIN, max = QUIZ_MAX, timedFinale = true, prefer } = opts;
  const seen = new Set<string>();
  const uniq = pool.filter((x) => !seen.has(x.q.q) && !!seen.add(x.q.q));
  const want = Math.min(uniq.length, min + Math.floor(rand() * (max - min + 1)));
  const picked: RatedQuestion[] = [];
  // Preferred questions first (e.g. ones not yet answered correctly), then the rest — formats in turn within each.
  const groups = prefer ? [uniq.filter(prefer), uniq.filter((x) => !prefer(x))] : [uniq];
  for (const group of groups) {
    const byType = new Map<Question['type'], RatedQuestion[]>();
    for (const x of shuffle(group, rand)) byType.set(x.q.type, [...(byType.get(x.q.type) ?? []), x]);
    const types = shuffle([...byType.keys()], rand);
    while (picked.length < want && types.some((t) => byType.get(t)?.length)) {
      for (const t of types) {
        const next = byType.get(t)?.pop();
        if (next) picked.push(next);
        if (picked.length === want) break;
      }
    }
  }
  // Easier first (stable, so ties keep their random order) — the hardest land in the timed finale.
  picked.sort((a, b) => (a.q.difficulty ?? 1) - (b.q.difficulty ?? 1));
  const timedFrom = timedFinale && picked.length === QUIZ_MAX ? QUIZ_MAX - TIMED_LAST : Infinity;
  return { questions: picked, limits: picked.map((x, i) => (i >= timedFrom ? timeLimitFor(x.q) : null)) };
}

// ── Question generation from lesson content ─────────────────────────────────────────────────────────────

const banks = new WeakMap<Course, Map<string, Question[]>>();
/** Authored questions a topic needs before generated ones are left out. */
const AUTHORED_ENOUGH = 6;

/** A topic's full question bank: authored questions plus ones generated from its lesson. */
export function questionsFor(topic: PlacedTopic, course: Course): Question[] {
  let m = banks.get(course);
  if (!m) {
    m = generateBanks(course);
    banks.set(course, m);
  }
  return m.get(topic.id) ?? topic.quiz;
}

/**
 * Practice Arena questions for the tutor chat: built fresh from the lesson's key terms, definitions and takeaways
 * and worded differently from the graded ones. Anything equal to a graded question (lesson quiz, hub practice pool
 * or the generated fallback bank) is left out, so practising in chat never spoils a quiz.
 */
export function practiceQuestions(t: PlacedTopic, course: Course): Question[] {
  const topics = flatTopics(course);
  const graded = new Set([...questionsFor(t, course), ...(t.practice ?? [])].map((q) => q.q));
  // The lesson's own key terms read best; definitions lifted from the text only fill in for thin topics.
  const termsOf = (x: PlacedTopic) => {
    const key = blocksOf(x, 'keyTerms').flatMap((b) => b.terms);
    return [...key, ...(key.length >= 3 ? [] : textDefinitions(x).map(({ term, def }) => ({ term, def })))].filter(
      (v, i, a) => v.term.trim() && v.def.trim() && a.findIndex((w) => w.term.toLowerCase() === v.term.toLowerCase()) === i,
    );
  };
  const mine = termsOf(t);
  const others = topics.filter((x) => x.id !== t.id).flatMap(termsOf).filter((o) => !mine.some((m) => m.term.toLowerCase() === o.term.toLowerCase()));
  const rand = Math.random;
  const unique = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) === i);
  const out: Question[] = [];
  for (const k of mine) {
    const pool = [...mine.filter((x) => x !== k), ...shuffle(others, rand)];
    const terms = unique(pool.map((x) => x.term)).slice(0, 3);
    if (terms.length >= 2) out.push({ type: 'mcq', q: `Practice: which term is being described? “${clip(k.def, 160)}”`, options: [k.term, ...terms], answer: 0, why: `${k.term} — ${k.def}`, difficulty: 1 });
    const defs = unique(pool.map((x) => clip(x.def, 120))).filter((d) => d !== clip(k.def, 120)).slice(0, 3);
    if (defs.length >= 2) out.push({ type: 'mcq', q: `Practice: what does “${k.term}” mean in “${t.title}”?`, options: [clip(k.def, 120), ...defs], answer: 0, why: `${k.term} — ${k.def}`, difficulty: 1 });
  }
  // Fill the gap in a takeaway: a key term that appears in one of the lesson's summary points.
  for (const p of blocksOf(t, 'summary').flatMap((b) => b.points)) {
    const k = mine.find((m) => m.term.length > 2 && new RegExp(`\\b${escapeRe(m.term)}\\b`, 'i').test(p));
    if (!k) continue;
    const q = `Practice — fill the gap: “${p.replace(new RegExp(`\\b${escapeRe(k.term)}\\b`, 'i'), '____')}”`;
    out.push({ type: 'fill', q, answer: k.term, accept: [k.term.toLowerCase()], why: `The takeaway reads: “${p}”`, difficulty: 2 });
  }
  return out.filter((q) => !graded.has(q.q));
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

const SUBJECT_STOP = new Set(
  'it this that these those there they he she we you one each every such here which what who because if when while although since so but and or not as for in on at by with from after before during'.split(' '),
);
const GENERIC_TERMS = new Set('the basics introduction intro overview deep dive pattern patterns part fundamentals essentials practice concepts concept'.split(' '));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lessonText = (t: PlacedTopic) => t.lesson.blocks.flatMap((b) => (b.type === 'text' || b.type === 'example' ? [b.body] : [])).join(' ');

/** The parts of a topic title that name things: "MSE vs Cross Entropy" → MSE, Cross Entropy. Used as answers and distractors. */
function titleTerms(t: PlacedTopic): string[] {
  return t.title
    .split(/\s+vs\.?\s+|:|\s&\s|\sand\s|,|\(|\)/i)
    .map((s) => s.trim().replace(/^(the|a|an)\s+/i, ''))
    .filter((s) => s.length >= 3 && s.split(' ').length <= 3 && !GENERIC_TERMS.has(s.toLowerCase()));
}

/** Terms a lesson marks as important: 'quoted' phrases, (ACRONYMS) and the parts of its title. */
function termsMarkedIn(t: PlacedTopic): string[] {
  const text = lessonText(t);
  const quoted = [...text.matchAll(/['‘"“]([A-Za-z][A-Za-z -]{2,28}[A-Za-z])['’"”]/g)].map((m) => m[1]).filter((x) => x.split(' ').length <= 3);
  const acronyms = [...text.matchAll(/\(([A-Z][A-Za-z0-9-]{1,9})\)/g)].map((m) => m[1]);
  const seen = new Set<string>();
  return [...quoted, ...acronyms, ...titleTerms(t)].filter((x) => !GENERIC_TERMS.has(x.toLowerCase()) && !seen.has(x.toLowerCase()) && !!seen.add(x.toLowerCase()));
}

/** A sentence from the lesson with `term` blanked out (null if none fits, the term would still show, or the sentence is taken). */
function cloze(t: PlacedTopic, term: string, taken: Set<string>): { q: string; answer: string; sentence: string } | null {
  const re = new RegExp(`['‘"“]?\\b(${escapeRe(term)}(?:e?s)?)\\b['’"”]?`, 'i');
  for (const s of lessonText(t).split(/(?<=[.!?])\s+(?=[A-Z'"‘“])/)) {
    if (s.length < 30 || s.length > 200 || taken.has(s)) continue;
    const m = re.exec(s);
    if (!m) continue;
    const q = s.replace(re, '____');
    if (!new RegExp(escapeRe(term), 'i').test(q)) return { q, answer: m[1], sentence: s };
  }
  return null;
}

/** "A tensor is a generalisation to n dimensions." → { term: 'Tensor', def: 'a generalisation to n dimensions' } — from a topic's own text. */
function textDefinitions(t: PlacedTopic): { term: string; def: string; sentence: string }[] {
  const text = lessonText(t);
  const out: { term: string; def: string; sentence: string }[] = [];
  for (const raw of text.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
    const sentence = raw.trim();
    const m = /^(?:(?:A|An|The)\s+)?([A-Za-z][A-Za-z-]*(?:\s[A-Za-z][A-Za-z-]*){0,2})\s+(?:is|are|refers to|means)\s+(.+?)[.!?]?$/.exec(sentence);
    if (!m || SUBJECT_STOP.has(m[1].split(' ')[0].toLowerCase())) continue;
    const term = m[1].trim();
    let def = m[2].trim().replace(/^(simply|essentially|basically|just)\s+/i, '');
    if (def.length > 150) {
      const cut = def.slice(0, 150).lastIndexOf(',');
      if (cut < 40) continue;
      def = def.slice(0, cut);
    }
    if (def.length < 8 || def.toLowerCase().includes(term.toLowerCase()) || out.some((o) => o.term.toLowerCase() === term.toLowerCase())) continue;
    out.push({ term: term.charAt(0).toUpperCase() + term.slice(1), def, sentence });
    if (out.length >= 5) break;
  }
  return out;
}

function generateBanks(course: Course): Map<string, Question[]> {
  const topics = flatTopics(course);
  const textDefs = new Map(topics.map((t) => [t.id, textDefinitions(t)]));
  const markedTerms = new Map(topics.map((t) => [t.id, termsMarkedIn(t)]));
  const terms = topics.flatMap((t) => {
    const key = blocksOf(t, 'keyTerms').flatMap((b) => b.terms.filter((x) => !isFillerLabel(x.term)).map((x) => ({ ...x, topic: t.id })));
    const fromText = (textDefs.get(t.id) ?? []).filter((d) => !isFillerLabel(d.term) && !key.some((k) => k.term.toLowerCase() === d.term.toLowerCase())).map((d) => ({ term: d.term, def: d.def, topic: t.id }));
    return [...key, ...fromText];
  });
  // Authored questions pasted into many topics are generic; they are kept only where a topic has little else.
  const qCount = new Map<string, number>();
  for (const t of topics) for (const q of new Set(t.quiz.map((x) => x.q))) qCount.set(q, (qCount.get(q) ?? 0) + 1);
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
    // Question texts must be unique per topic: quizzes de-duplicate by text and repeat scoring keys on it.
    if (mine.length >= 3) gen.push({ type: 'match', q: `Match each term from “${t.title}” to its meaning.`, pairs: mine.slice(0, 4).map((x) => [x.term, clip(x.def, 110)] as [string, string]), why: 'Each term pairs with the definition from the lesson’s key terms.', difficulty: 2 });
    // Multiple select: which of these are this topic's key terms?
    if (mine.length >= 2 && others.length >= 2) {
      const right = mine.slice(0, 3).map((x) => x.term);
      gen.push({ type: 'multi', q: `Which of these are key terms in “${t.title}”?`, options: [...right, ...others.slice(0, 2).map((x) => x.term)], answers: right.map((_, i) => i), why: `This topic’s key terms: ${right.join(', ')}.`, difficulty: 2 });
    }
    // Ordering: the lesson's steps.
    for (const s of blocksOf(t, 'steps').filter((b) => b.steps.length >= 3).slice(0, 1)) {
      const items = s.steps.slice(0, 6).map(stripStepLabel);
      gen.push({ type: 'order', q: `Put these steps in order: ${s.title && !isFillerLabel(s.title) ? s.title : t.title}.`, items, why: `The order: ${items.join(' → ')}.`, difficulty: 2 });
    }
    // Multiple select: takeaways of this topic vs. other topics'.
    const myPoints = points.filter((x) => x.topic === t.id).map((x) => x.p);
    const otherPoints = shuffle(points.filter((x) => x.topic !== t.id && !myPoints.includes(x.p)), rand).map((x) => x.p);
    if (myPoints.length >= 2 && otherPoints.length >= 2) {
      const right = myPoints.slice(0, 3);
      gen.push({ type: 'multi', q: `Which of these are takeaways from “${t.title}”?`, options: [...right, ...otherPoints.slice(0, 2)], answers: right.map((_, i) => i), why: `From this topic: ${right.join('; ')}.`, difficulty: 2 });
    }
    // Fill in the blank: definition sentences and terms the lesson marks itself ('quoted', (ACRONYM), title parts),
    // each blanked out of a different sentence so one question never gives away another's answer.
    const taken = new Set<string>();
    const blanks: { term: string; c: { q: string; answer: string; sentence: string } }[] = [];
    const candidates = [...(textDefs.get(t.id) ?? []).filter((x) => !x.term.includes(' ')).map((x) => x.term), ...(markedTerms.get(t.id) ?? [])];
    for (const term of candidates) {
      if (blanks.length >= 2 || blanks.some((b) => b.term.toLowerCase() === term.toLowerCase())) continue;
      const c = cloze(t, term, taken);
      if (!c) continue;
      taken.add(c.sentence);
      blanks.push({ term, c });
    }
    // With two blanks, the first becomes multiple choice and the second fill-in; a lone blank stays fill-in.
    const pick = blanks.length >= 2 ? blanks[0] : undefined;
    for (const { c } of blanks.slice(pick ? 1 : 0)) gen.push({ type: 'fill', q: c.q, answer: c.answer, accept: [c.answer.toLowerCase()], why: `From the lesson: “${c.sentence}”`, difficulty: 2 });
    if (pick) {
      // Distractors: other topics' title terms and key terms — real terms from the same course.
      const distract = shuffle(
        [...new Set([...topics.filter((x) => x.id !== t.id).flatMap(titleTerms), ...others.map((x) => x.term)])].filter((x) => x.toLowerCase() !== pick.term.toLowerCase() && x.toLowerCase() !== pick.c.answer.toLowerCase()),
        rand,
      );
      if (distract.length >= 2)
        gen.push({ type: 'mcq', q: `Which term completes the sentence? “${clip(pick.c.q, 170)}”`, options: [pick.c.answer, ...distract.slice(0, 3)], answer: 0, why: `From the lesson: “${pick.c.q.replace('____', pick.c.answer)}”`, difficulty: 1 });
    }
    // Multiple choice: which formula is described?
    for (const f of formulas.filter((x) => x.topic === t.id && x.caption).slice(0, 1)) {
      const alt = shuffle(formulas.filter((x) => x.expr !== f.expr), rand).map((x) => prettyMath(x.expr));
      if (alt.length >= 2) gen.push({ type: 'mcq', q: `Which formula is this? ${clip(f.caption ?? '')}`, options: [prettyMath(f.expr), ...alt.slice(0, 3)], answer: 0, why: `${prettyMath(f.expr)} — ${f.caption}`, difficulty: 2 });
    }

    const specific = t.quiz.filter((q) => (qCount.get(q.q) ?? 0) < 4);
    // A topic with a full authored bank uses only those questions; generation is the fallback for thin topics.
    if (specific.length >= AUTHORED_ENOUGH) {
      out.set(t.id, specific);
      continue;
    }
    const seen = new Set(specific.map((q) => q.q));
    const bank = [...specific, ...gen.filter((q) => !seen.has(q.q) && !!seen.add(q.q))];
    out.set(t.id, bank.length >= 3 ? bank : [...bank, ...t.quiz.filter((q) => !seen.has(q.q))]);
  }
  return out;
}
