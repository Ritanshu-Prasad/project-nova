import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { activeOf, hubPool, passedModules, useCourse, type LibraryEntry, type RatedQuestion } from './course';
import { useHub, type Station } from './hub';
import { useDeck } from './journey';
import { buildQuiz } from './quizBuilder';
import { useNova } from './store';

/**
 * The hub quiz — the big dashboard quiz (lesson quizzes at the end of each module are separate and small).
 *
 * - Locked until the pilot completes a module. From then on, quizzes form at random moments from everything
 *   in the completed modules, and wait until the pilot takes them (an alert, then a pill and the dock card).
 * - 5–10 mixed questions; a full 10-question quiz ends with three timed questions.
 * - Heavy MMR both ways: within 24 h of forming, correct answers pay 2× (timed ones 2.5×); after that 1.75×
 *   (timed 2×). Wrong answers cost the same multiple — except timed questions, which never cost MMR.
 * - A finished quiz stays in the archive and can be retaken as practice, for no MMR.
 */
export const HUB_QUIZ = {
  windowMs: 24 * 3600_000,
  fresh: { regular: 2, timed: 2.5 },
  late: { regular: 1.75, timed: 2 },
  /** After a module is first completed, the next quiz forms within this random delay. */
  afterModule: [30_000, 90_000],
  /** Random gap before another quiz forms once the last one has been taken. */
  gap: [20 * 60_000, 60 * 60_000],
} as const;

export interface HubQuiz {
  id: string;
  courseId: string;
  formedAt: number;
  /** What it covers, e.g. "Modules 1–2". */
  title: string;
  questions: RatedQuestion[];
  limits: (number | null)[];
  /** The arrival alert has been seen (the pilot chose "Later" or let it slide away). */
  seen: boolean;
  result?: { correct: number; total: number; delta: number; at: number };
}

export interface QuizRun {
  quizId: string;
  /** A retake of a finished quiz — no MMR. */
  practice: boolean;
  regular: number;
  timed: number;
  /** MMR multipliers per question. */
  rates: { gain: number; loss: number }[];
}

interface State {
  quizzes: HubQuiz[];
  /** When the next quiz may form, per course (epoch ms). */
  nextAt: Record<string, number>;
  run: QuizRun | null;
  /** Where to send the pilot after the quiz. */
  returnTo: Station;
  form: (e: LibraryEntry) => HubQuiz | null;
  schedule: (courseId: string, range: readonly [number, number]) => void;
  defer: (id: string) => void;
  begin: (id: string) => QuizRun | null;
  finish: (id: string, result: { correct: number; total: number; delta: number }) => void;
  end: () => void;
}

const LS = 'nova.hubquiz.v1';
const rand = ([a, b]: readonly [number, number]) => a + Math.random() * (b - a);

/** Multipliers for a quiz right now: fresh within 24 h of forming, late afterwards. */
export const ratesOf = (q: HubQuiz, now = Date.now()) => (now - q.formedAt <= HUB_QUIZ.windowMs ? HUB_QUIZ.fresh : HUB_QUIZ.late);
/** Seconds left in the 24-hour window (0 once it has passed). */
export const freshLeft = (q: HubQuiz | null | undefined, now = Date.now()) => (q ? Math.max(0, Math.ceil((q.formedAt + HUB_QUIZ.windowMs - now) / 1000)) : 0);
/** 23h 41m · 12m 05s · 0:42 */
export function duration(sec: number): string {
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
  return `0:${String(sec).padStart(2, '0')}`;
}

function load(): Pick<State, 'quizzes' | 'nextAt'> {
  try {
    const raw = JSON.parse(localStorage.getItem(LS) ?? 'null') as Pick<State, 'quizzes' | 'nextAt'> | null;
    if (raw && Array.isArray(raw.quizzes)) return { quizzes: raw.quizzes, nextAt: raw.nextAt ?? {} };
  } catch {
    /* ignore */
  }
  return { quizzes: [], nextAt: {} };
}

const coverage = (e: LibraryEntry) => {
  const idx = passedModules(e).map((m) => e.course.modules.indexOf(m) + 1);
  if (!idx.length) return 'Review';
  return idx.length === 1 ? `Module ${idx[0]}` : `Modules ${idx[0]}–${idx[idx.length - 1]}`;
};

export const useHubQuiz = create<State>()((set, get) => ({
  ...load(),
  run: null,
  returnTo: 'hub',

  form: (e) => {
    const pool = hubPool(e);
    if (!pool.length) return null;
    // Favour questions the pilot has not already answered correctly (repeats of those earn no MMR).
    const built = buildQuiz(pool, { prefer: (x) => !e.skill.questionHistory?.[x.q.q] });
    const quiz: HubQuiz = { id: `hq-${Date.now().toString(36)}`, courseId: e.course.id, formedAt: Date.now(), title: coverage(e), questions: built.questions, limits: built.limits, seen: false };
    // Keep the archive bounded: the newest 12 per course.
    const mine = get().quizzes.filter((q) => q.courseId === e.course.id);
    const drop = new Set(mine.slice(0, Math.max(0, mine.length - 11)).map((q) => q.id));
    set({ quizzes: [...get().quizzes.filter((q) => !drop.has(q.id)), quiz] });
    return quiz;
  },

  schedule: (courseId, range) => set({ nextAt: { ...get().nextAt, [courseId]: Date.now() + rand(range) } }),

  defer: (id) => set({ quizzes: get().quizzes.map((q) => (q.id === id ? { ...q, seen: true } : q)) }),

  begin: (id) => {
    const q = get().quizzes.find((x) => x.id === id);
    if (!q) return null;
    const practice = !!q.result;
    const r = ratesOf(q);
    const run: QuizRun = {
      quizId: id,
      practice,
      regular: r.regular,
      timed: r.timed,
      rates: q.limits.map((l) => (practice ? { gain: 0, loss: 0 } : l ? { gain: r.timed, loss: 0 } : { gain: r.regular, loss: r.regular })),
    };
    set({ run, quizzes: get().quizzes.map((x) => (x.id === id ? { ...x, seen: true } : x)) });
    return run;
  },

  finish: (id, result) => {
    const q = get().quizzes.find((x) => x.id === id);
    if (!q || q.result) return;
    set({
      quizzes: get().quizzes.map((x) => (x.id === id ? { ...x, result: { ...result, at: Date.now() } } : x)),
      nextAt: { ...get().nextAt, [q.courseId]: Date.now() + rand(HUB_QUIZ.gap) },
    });
  },

  end: () => set({ run: null }),
}));

useHubQuiz.subscribe((s, prev) => {
  if (s.quizzes === prev.quizzes && s.nextAt === prev.nextAt) return;
  try {
    localStorage.setItem(LS, JSON.stringify({ quizzes: s.quizzes, nextAt: s.nextAt }));
  } catch {
    /* ignore */
  }
});

// Completing a module (for the first time) brings the next hub quiz soon.
useCourse.subscribe((s, prev) => {
  const id = s.activeId;
  const e = id ? s.library[id] : undefined;
  const before = id ? prev.library[id] : undefined;
  if (!e || !before || e === before) return;
  if (passedModules(e).length > passedModules(before).length && !useHubQuiz.getState().quizzes.some((q) => q.courseId === e.course.id && !q.result)) {
    useHubQuiz.getState().schedule(e.course.id, HUB_QUIZ.afterModule);
  }
});

/** The active course's waiting (untaken) quiz and its finished ones, newest first. */
export function useCourseQuizzes() {
  const activeId = useCourse((s) => s.activeId);
  const quizzes = useHubQuiz((s) => s.quizzes);
  const mine = quizzes.filter((q) => q.courseId === activeId);
  return { pending: mine.find((q) => !q.result) ?? null, past: mine.filter((q) => q.result).reverse() };
}

/** Seconds left in a quiz's 24-hour window, ticking every second. */
export function useFreshClock(q: HubQuiz | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!q || q.result) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [q]);
  return freshLeft(q, now);
}

/** Opens the hub quiz station, remembering where to return. */
export function openHubQuiz() {
  const from = useHub.getState().station;
  useHubQuiz.setState({ returnTo: from === 'lesson' ? 'lesson' : 'hub' });
  useHub.getState().go('quiz');
}

/** Forms quizzes at random moments once a module is complete — never mid-quiz, only while aboard. */
export function useHubQuizScheduler() {
  useEffect(() => {
    const id = window.setInterval(() => {
      const c = useCourse.getState();
      const e = c.activeId ? c.library[c.activeId] : undefined;
      const s = useHubQuiz.getState();
      if (!e || s.run || !passedModules(e).length) return;
      if (s.quizzes.some((q) => q.courseId === e.course.id && !q.result)) return;
      const at = s.nextAt[e.course.id];
      if (at === undefined) return s.schedule(e.course.id, HUB_QUIZ.afterModule);
      if (Date.now() < at) return;
      if (useDeck.getState().deck !== 'lounge' || useNova.getState().curriculumOpen) return;
      const st = useHub.getState().station;
      if (st === 'quiz' || (st === 'lesson' && activeOf(e)?.item.kind === 'quiz')) return;
      s.form(e);
    }, 2000);
    return () => clearInterval(id);
  }, []);
}
