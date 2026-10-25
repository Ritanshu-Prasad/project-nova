import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { activeOf, coveredTopics, hubPool, passedModules, useCourse, type LibraryEntry, type RatedQuestion } from './course';
import { useHub, type Station } from './hub';
import { useDeck } from './journey';
import { buildQuiz } from './quizBuilder';
import { useNova } from './store';

/**
 * The hub quiz — the big dashboard quiz (lesson quizzes at the end of each module are separate and small).
 *
 * - Locked until the pilot completes a module. The first one forms soon after; each next one forms 5–8 h
 *   (at random) after the last one was taken, and waits until the pilot takes it (an alert, a pill, the dock card).
 * - Its questions come only from the topics the pilot had completed when it formed.
 * - 5–10 mixed questions; a full 10-question quiz ends with three timed questions.
 * - Heavy RR both ways: within 24 h of forming, correct answers pay 2× (timed ones 2.5×); after that 1.75×
 *   (timed 2×). Wrong answers cost the same multiple — except timed questions, which never cost RR.
 * - A finished quiz stays in the archive and can be retaken as practice, for no RR.
 */
export const HUB_QUIZ = {
  windowMs: 24 * 3600_000,
  fresh: { regular: 2, timed: 2.5 },
  late: { regular: 1.75, timed: 2 },
  /** The first quiz forms exactly 30 minutes after the first module is completed. */
  afterModule: [30 * 60_000, 30 * 60_000],
  /** Each next quiz forms 5 to 8 hours after the last one was taken. */
  gap: [5 * 3600_000, 8 * 3600_000],
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
  /** A retake of a finished quiz — no RR. */
  practice: boolean;
  regular: number;
  timed: number;
  /** RR multipliers per question. */
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

/** "Modules 1–3": the modules whose completed topics the quiz covers. */
const coverage = (e: LibraryEntry) => {
  const idx = [...new Set(coveredTopics(e).map((t) => t.moduleIndex + 1))];
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
    // Favour questions the pilot has not already answered correctly (repeats of those earn no RR).
    const built = buildQuiz(pool, { prefer: (x) => !e.skill.questionHistory?.[x.q.q] });
    const quiz: HubQuiz = { id: `hq-${Date.now().toString(36)}`, courseId: e.course.id, formedAt: Date.now(), title: coverage(e), questions: built.questions, limits: built.limits, seen: false };
    // Keep the archive bounded: the newest 12 per course.
    const mine = get().quizzes.filter((q) => q.courseId === e.course.id);
    const drop = new Set(mine.slice(0, Math.max(0, mine.length - 11)).map((q) => q.id));
    set({ quizzes: [...get().quizzes.filter((q) => !drop.has(q.id)), quiz] });
    return quiz;
  },

  // Never brings a quiz forward: a gap already running after the last quiz is kept.
  schedule: (courseId, range) => set({ nextAt: { ...get().nextAt, [courseId]: Math.max(Date.now() + rand(range), get().nextAt[courseId] ?? 0) } }),

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

// Completing the first module starts the 30-minute countdown to the first hub quiz; later ones follow the 5–8 h gap.
useCourse.subscribe((s, prev) => {
  const id = s.activeId;
  const e = id ? s.library[id] : undefined;
  const before = id ? prev.library[id] : undefined;
  if (!e || !before || e === before) return;
  const newPass = passedModules(e).length > passedModules(before).length;
  const hq = useHubQuiz.getState();
  if (newPass && hq.nextAt[e.course.id] === undefined && !hq.quizzes.some((q) => q.courseId === e.course.id)) {
    hq.schedule(e.course.id, HUB_QUIZ.afterModule);
  }
});

/** On-demand Pop Quiz / Fleet Drill */
export function triggerPopQuiz(): HubQuiz | null {
  const c = useCourse.getState();
  const e = c.activeId ? c.library[c.activeId] : undefined;
  if (!e || !passedModules(e).length) return null;
  return useHubQuiz.getState().form(e);
}

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

/** When the pilot last finished one of this course's quizzes (0 if never). */
const lastTaken = (courseId: string) => Math.max(0, ...useHubQuiz.getState().quizzes.filter((q) => q.courseId === courseId).map((q) => q.result?.at ?? 0));

/** Forms quizzes once a module is complete, 5–8 h apart — never mid-quiz, only while aboard. */
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
      if (Date.now() < at || Date.now() < lastTaken(e.course.id) + HUB_QUIZ.gap[0]) return;
      if (useDeck.getState().deck !== 'lounge' || useNova.getState().curriculumOpen) return;
      const st = useHub.getState().station;
      if (st === 'quiz' || (st === 'lesson' && activeOf(e)?.item.kind === 'quiz')) return;
      s.form(e);
    }, 2000);
    return () => clearInterval(id);
  }, []);
}
