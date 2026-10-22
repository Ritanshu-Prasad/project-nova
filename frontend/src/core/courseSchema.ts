/**
 * The structured course model — the contract between NOVA's course generator (templates today, the AI
 * backend later) and the UI.
 *
 *   Course → Module[] → Topic[] (each topic is a planet on the journey map) → Lesson (typed blocks) + Quiz
 *
 * A backend generator should return a `Course` as JSON; `normalizeCourse` validates it, fills defaults and
 * drops anything malformed so a partial AI response still renders.
 */

/** Picks the lesson layout template (icon, accent, side-rail widgets). */
export type TopicKind = 'concept' | 'programming' | 'math' | 'science' | 'humanities' | 'language' | 'document';

export type Block =
  | { type: 'text'; title?: string; body: string }
  | { type: 'analogy'; body: string }
  | { type: 'keyTerms'; terms: { term: string; def: string }[] }
  | { type: 'steps'; title?: string; steps: string[] }
  | { type: 'code'; language: string; code: string; caption?: string }
  | { type: 'formula'; expr: string; caption?: string }
  | { type: 'compare'; title?: string; columns: [string, string]; rows: [string, string, string][] }
  | { type: 'example'; title?: string; body: string }
  | { type: 'callout'; tone: 'tip' | 'warning' | 'fact'; body: string }
  | { type: 'source'; doc: string; page?: number; excerpt: string }
  | { type: 'summary'; points: string[] };

export type Question =
  | { type: 'mcq'; q: string; options: string[]; answer: number; why: string; difficulty?: number }
  | { type: 'multi'; q: string; options: string[]; answers: number[]; why: string; difficulty?: number }
  | { type: 'truefalse'; q: string; answer: boolean; why: string; difficulty?: number }
  | { type: 'fill'; q: string; answer: string; accept?: string[]; why: string; difficulty?: number }
  /** Write code; graded by checks (regex sources) against the answer — the solution is shown afterwards. */
  | { type: 'code'; q: string; language: string; starter?: string; solution: string; checks: { label: string; pattern: string }[]; why: string; difficulty?: number }
  /** Put the items in order (`items` holds the correct order). */
  | { type: 'order'; q: string; items: string[]; why: string; difficulty?: number }
  /** Match each left item to its right item (`pairs` holds the correct matches). */
  | { type: 'match'; q: string; pairs: [string, string][]; why: string; difficulty?: number };

/** A topic-specific side-panel section (e.g. "Common mistakes", "Where it's used"); the AI picks as many as the topic needs. */
export interface Panel {
  title: string;
  items?: string[];
  body?: string;
}

export interface Lesson {
  minutes: number;
  objectives: string[];
  /** One-paragraph plain-language version ("Explain simpler"). */
  simple: string;
  blocks: Block[];
  /** Extra side-panel sections for this topic. */
  panels?: Panel[];
}

export interface Topic {
  id: string;
  title: string;
  /** Planet name on the journey map. */
  planet: string;
  kind: TopicKind;
  summary: string;
  lesson: Lesson;
  /** Lesson-quiz questions (drawn for the end-of-module quiz and the hub quiz). */
  quiz: Question[];
  /** Extra practice questions — only the hub quiz draws on these, so it has a large pool of unique questions. */
  practice?: Question[];
  /** False for an AI topic whose lesson and questions are written the first time it is opened. Absent means loaded. */
  loaded?: false;
}

export interface Module {
  id: string;
  title: string;
  topics: Topic[];
  /** End-of-module quiz. When absent, it is assembled from the topics' question banks. */
  quiz?: Question[];
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  objective: string;
  /** What the learner said they expect (depth, time, focus); sent along when topics are written. */
  expectations?: string;
  source: 'template' | 'starter' | 'documents' | 'ai';
  modules: Module[];
  documents?: { name: string; pages: number }[];
  /** How an AI course was written (model and prompt version), for tracing a bad one. */
  meta?: { model: string; promptVersion: string; createdAt: number; documentsKey?: string; plannedModules?: number; plannedTopics?: number };
}

/** A topic with its position in the course. */
export interface PlacedTopic extends Topic {
  index: number;
  moduleIndex: number;
  moduleTitle: string;
}

export const flatTopics = (c: Course): PlacedTopic[] =>
  c.modules.flatMap((m, mi) => m.topics.map((t) => ({ ...t, moduleIndex: mi, moduleTitle: m.title, index: 0 }))).map((t, i) => ({ ...t, index: i }));

// ── Validation ───────────────────────────────────────────────────────────

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const KINDS: TopicKind[] = ['concept', 'programming', 'math', 'science', 'humanities', 'language', 'document'];
let uid = 0;
export const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(uid++).toString(36)}`;

function normBlock(b: Record<string, unknown>): Block | null {
  switch (b.type) {
    case 'text':
    case 'example':
      return str(b.body) ? ({ type: b.type, title: str(b.title) || undefined, body: str(b.body) } as Block) : null;
    case 'analogy':
      return str(b.body) ? { type: 'analogy', body: str(b.body) } : null;
    case 'keyTerms': {
      const terms = arr<Record<string, unknown>>(b.terms).map((t) => ({ term: str(t.term), def: str(t.def) })).filter((t) => t.term && t.def);
      return terms.length ? { type: 'keyTerms', terms } : null;
    }
    case 'steps': {
      const steps = arr<unknown>(b.steps).map((s) => str(s)).filter(Boolean);
      return steps.length ? { type: 'steps', title: str(b.title) || undefined, steps } : null;
    }
    case 'code':
      return str(b.code) ? { type: 'code', language: str(b.language, 'text'), code: str(b.code), caption: str(b.caption) || undefined } : null;
    case 'formula':
      return str(b.expr) ? { type: 'formula', expr: str(b.expr), caption: str(b.caption) || undefined } : null;
    case 'compare': {
      const cols = arr<unknown>(b.columns).map((c) => str(c));
      const rows = arr<unknown[]>(b.rows).map((r) => [str(r[0]), str(r[1]), str(r[2])] as [string, string, string]).filter((r) => r[0]);
      return cols.length === 2 && rows.length ? { type: 'compare', title: str(b.title) || undefined, columns: [cols[0], cols[1]], rows } : null;
    }
    case 'callout': {
      const tone = b.tone === 'warning' || b.tone === 'fact' ? b.tone : 'tip';
      return str(b.body) ? { type: 'callout', tone, body: str(b.body) } : null;
    }
    case 'source':
      return str(b.excerpt) ? { type: 'source', doc: str(b.doc, 'Document'), page: typeof b.page === 'number' ? b.page : undefined, excerpt: str(b.excerpt) } : null;
    case 'summary': {
      const points = arr<unknown>(b.points).map((p) => str(p)).filter(Boolean);
      return points.length ? { type: 'summary', points } : null;
    }
    default:
      return null;
  }
}

export function normQuestion(q: Record<string, unknown>): Question | null {
  const base = { q: str(q.q), why: str(q.why), difficulty: typeof q.difficulty === 'number' ? q.difficulty : 1 };
  if (!base.q) return null;
  const options = arr<unknown>(q.options).map((o) => str(o)).filter(Boolean);
  switch (q.type) {
    case 'mcq':
      return options.length >= 2 && typeof q.answer === 'number' && q.answer < options.length ? { type: 'mcq', ...base, options, answer: q.answer } : null;
    case 'multi': {
      const answers = arr<unknown>(q.answers).filter((a): a is number => typeof a === 'number' && a < options.length);
      return options.length >= 2 && answers.length ? { type: 'multi', ...base, options, answers } : null;
    }
    case 'truefalse':
      return typeof q.answer === 'boolean' ? { type: 'truefalse', ...base, answer: q.answer } : null;
    case 'fill':
      return str(q.answer) ? { type: 'fill', ...base, answer: str(q.answer), accept: arr<unknown>(q.accept).map((a) => str(a)).filter(Boolean) } : null;
    case 'code': {
      const checks = arr<Record<string, unknown>>(q.checks)
        .map((c) => ({ label: str(c.label), pattern: str(c.pattern) }))
        .filter((c) => {
          try {
            return !!c.pattern && !!new RegExp(c.pattern);
          } catch {
            return false;
          }
        });
      return str(q.solution) && checks.length ? { type: 'code', ...base, language: str(q.language, 'text'), starter: str(q.starter) || undefined, solution: str(q.solution), checks } : null;
    }
    case 'order': {
      const items = arr<unknown>(q.items).map((i) => str(i)).filter(Boolean);
      return items.length >= 3 ? { type: 'order', ...base, items } : null;
    }
    case 'match': {
      const pairs = arr<unknown>(q.pairs)
        .map((x) => (Array.isArray(x) ? ([str(x[0]), str(x[1])] as [string, string]) : null))
        .filter((x): x is [string, string] => !!x && !!x[0] && !!x[1]);
      return pairs.length >= 2 ? { type: 'match', ...base, pairs } : null;
    }
    default:
      return null;
  }
}

/** Validates one untrusted topic. An outline-only topic keeps `loaded: false` and has no blocks yet. */
export function normTopic(t: Record<string, unknown>): Topic {
  const l = (t.lesson ?? {}) as Record<string, unknown>;
  return {
    id: str(t.id) || makeId('topic'),
    title: str(t.title, 'Topic'),
    planet: str(t.planet) || str(t.title, 'Planet').split(' ')[0],
    kind: KINDS.includes(t.kind as TopicKind) ? (t.kind as TopicKind) : 'concept',
    summary: str(t.summary),
    ...(t.loaded === false ? { loaded: false as const } : {}),
    lesson: {
      minutes: typeof l.minutes === 'number' ? l.minutes : 5,
      objectives: arr<unknown>(l.objectives).map((o) => str(o)).filter(Boolean),
      simple: str(l.simple),
      blocks: arr<Record<string, unknown>>(l.blocks).map(normBlock).filter((b): b is Block => b !== null),
      panels: arr<Record<string, unknown>>(l.panels)
        .map((x) => ({ title: str(x.title), items: arr<unknown>(x.items).map((i) => str(i)).filter(Boolean), body: str(x.body) }))
        .filter((x) => x.title && (x.items.length || x.body)),
    },
    quiz: arr<Record<string, unknown>>(t.quiz).map(normQuestion).filter((q): q is Question => q !== null),
    practice: arr<Record<string, unknown>>(t.practice).map(normQuestion).filter((q): q is Question => q !== null),
  };
}

/** Validates an untrusted course (e.g. AI output); throws if nothing usable remains. */
export function normalizeCourse(raw: unknown): Course {
  const c = (raw ?? {}) as Record<string, unknown>;
  const modules: Module[] = arr<Record<string, unknown>>(c.modules)
    .map((m) => ({
      id: str(m.id) || makeId('mod'),
      title: str(m.title, 'Module'),
      quiz: arr<Record<string, unknown>>(m.quiz).map(normQuestion).filter((q): q is Question => q !== null),
      topics: arr<Record<string, unknown>>(m.topics)
        .map(normTopic)
        .filter((t) => t.loaded === false || t.lesson.blocks.length > 0),
    }))
    .filter((m) => m.topics.length > 0);
  if (!modules.length) throw new Error('The course has no usable topics.');
  return {
    id: str(c.id) || makeId('course'),
    title: str(c.title, 'Your course'),
    subtitle: str(c.subtitle),
    objective: str(c.objective),
    expectations: str(c.expectations) || undefined,
    source: c.source === 'documents' || c.source === 'template' || c.source === 'starter' ? c.source : 'ai',
    modules,
    documents: arr<Record<string, unknown>>(c.documents).map((d) => ({ name: str(d.name), pages: typeof d.pages === 'number' ? d.pages : 0 })),
    meta: normMeta(c.meta),
  };
}

function normMeta(raw: unknown): Course['meta'] {
  const m = (raw ?? {}) as Record<string, unknown>;
  return str(m.model) && str(m.promptVersion)
    ? { model: str(m.model), promptVersion: str(m.promptVersion), createdAt: typeof m.createdAt === 'number' ? m.createdAt : 0, documentsKey: str(m.documentsKey) || undefined, plannedModules: typeof m.plannedModules === 'number' && m.plannedModules > 0 ? m.plannedModules : undefined, plannedTopics: typeof m.plannedTopics === 'number' && m.plannedTopics > 0 ? m.plannedTopics : undefined }
    : undefined;
}
