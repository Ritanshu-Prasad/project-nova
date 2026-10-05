import { useMemo } from 'react';
import { create } from 'zustand';
import { flatTopics, type Course, type Module, type PlacedTopic, type Question } from './courseSchema';

/**
 * The pilot's course library and progress (persisted).
 *
 * A course is walked as an outline: each module's topics in order, then that module's quiz.
 * Completing a topic moves the rocket to the next planet; passing a module quiz unlocks the next module.
 * MMR follows an Elo-style update per answer (pop quizzes pay a bonus); XP drives the level.
 */

export interface TopicProgress {
  /** Lesson completed (the rocket has passed this planet). */
  cleared: boolean;
  notes: string;
}

export interface ModuleProgress {
  passed: boolean;
  /** Best score as a fraction 0..1. */
  best: number;
  attempts: number;
}

export interface LibraryEntry {
  course: Course;
  progress: Record<string, TopicProgress>;
  modules: Record<string, ModuleProgress>;
  /** Outline item being studied: a topic id or `quiz:<moduleId>`. */
  current: string;
  updatedAt: number;
}

export interface Stats {
  mmr: number;
  mmrHistory: number[];
  xp: number;
  streak: number;
  bestStreak: number;
  correct: number;
  answered: number;
  /** Quizzes finished today (daily goal). */
  day: string;
  dayQuizzes: number;
}

export type OutlineItem =
  | { kind: 'topic'; id: string; topic: PlacedTopic; moduleIndex: number }
  | { kind: 'quiz'; id: string; module: Module; moduleIndex: number; questions: Question[] };

export const PASS_MARK = 0.6;
export const DAILY_GOAL = 3;
const MODULE_QUIZ_MAX = 8;
const KEY = 'nova.library.v2';
/** New pilots start at the bottom of the ladder (Probe III) — see core/rank.ts. */
const START_MMR = 1000;
const today = () => new Date().toISOString().slice(0, 10);

/** The module's end-of-module quiz (authored, or assembled from its topics' question banks). */
export function moduleQuestions(m: Module): Question[] {
  const qs = m.quiz && m.quiz.length ? m.quiz : m.topics.flatMap((t) => t.quiz);
  return qs.slice(0, MODULE_QUIZ_MAX);
}

export function outlineOf(course: Course): OutlineItem[] {
  const topics = flatTopics(course);
  const out: OutlineItem[] = [];
  course.modules.forEach((m, mi) => {
    for (const t of topics.filter((x) => x.moduleIndex === mi)) out.push({ kind: 'topic', id: t.id, topic: t, moduleIndex: mi });
    const questions = moduleQuestions(m);
    if (questions.length) out.push({ kind: 'quiz', id: `quiz:${m.id}`, module: m, moduleIndex: mi, questions });
  });
  return out;
}

export const isDone = (e: LibraryEntry, item: OutlineItem) =>
  item.kind === 'topic' ? !!e.progress[item.id]?.cleared : !!e.modules?.[item.module.id]?.passed;

/** Index of the first outline item not yet done — everything up to it is unlocked. */
export function frontier(e: LibraryEntry, outline = outlineOf(e.course)): number {
  const i = outline.findIndex((it) => !isDone(e, it));
  return i < 0 ? outline.length : i;
}

/** Index of the first topic not yet completed (the rocket's planet; equals the topic count when done). */
export function firstUncleared(e: LibraryEntry): number {
  const topics = flatTopics(e.course);
  const i = topics.findIndex((t) => !e.progress[t.id]?.cleared);
  return i < 0 ? topics.length : i;
}

export function isUnlocked(e: LibraryEntry, itemId: string, outline = outlineOf(e.course)): boolean {
  const i = outline.findIndex((it) => it.id === itemId);
  return i >= 0 && i <= frontier(e, outline);
}

/** Questions for a surprise pop quiz: drawn from topics the pilot has completed. */
export function popPool(e: LibraryEntry): Question[] {
  return flatTopics(e.course)
    .filter((t) => e.progress[t.id]?.cleared)
    .flatMap((t) => t.quiz);
}

interface CourseState {
  activeId: string | null;
  library: Record<string, LibraryEntry>;
  stats: Stats;

  addCourse: (course: Course) => void;
  setActive: (id: string) => void;
  removeCourse: (id: string) => void;
  /** Opens an outline item if it is unlocked. */
  open: (itemId: string) => boolean;
  setNotes: (topicId: string, notes: string) => void;
  /** Completes a topic; returns the next outline item id (topic or module quiz). */
  completeTopic: (topicId: string) => string | null;
  /** Scores one answer; returns the MMR change. */
  answer: (correct: boolean, opts?: { difficulty?: number; hint?: boolean; multiplier?: number; position?: number }) => number;
  finishModuleQuiz: (moduleId: string, correct: number, total: number) => { passed: boolean; nextId: string | null };
  finishPopQuiz: (correct: number, total: number) => void;
}

type Saved = Pick<CourseState, 'activeId' | 'library' | 'stats'>;

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    for (const e of Object.values(saved.library)) e.modules ??= {};
    return saved;
  } catch {
    return null;
  }
}

const initial: Saved = load() ?? {
  activeId: null,
  library: {},
  stats: { mmr: START_MMR, mmrHistory: [START_MMR], xp: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, day: today(), dayQuizzes: 0 },
};

/** Elo rating of a question: harder and later questions are worth more. */
const questionRating = (position = 0, difficulty = 1) => 1100 + position * 40 + difficulty * 70;

export const useCourse = create<CourseState>()((set, get) => {
  const patchActive = (fn: (e: LibraryEntry) => LibraryEntry) => {
    const id = get().activeId;
    const e = id ? get().library[id] : undefined;
    if (id && e) set({ library: { ...get().library, [id]: { ...fn(e), updatedAt: Date.now() } } });
  };
  const bumpDay = (xp: number) => {
    const s = get().stats;
    const day = today();
    set({ stats: { ...s, xp: s.xp + xp, day, dayQuizzes: (s.day === day ? s.dayQuizzes : 0) + 1 } });
  };

  return {
    ...initial,

    addCourse: (course) => {
      const topics = flatTopics(course);
      const progress = Object.fromEntries(topics.map((t) => [t.id, { cleared: false, notes: '' }]));
      set({ activeId: course.id, library: { ...get().library, [course.id]: { course, progress, modules: {}, current: topics[0]?.id ?? '', updatedAt: Date.now() } } });
    },

    setActive: (id) => {
      if (get().library[id]) set({ activeId: id });
    },

    removeCourse: (id) => {
      const { [id]: _removed, ...rest } = get().library;
      void _removed;
      const nextActive = get().activeId === id ? (Object.values(rest).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.course.id ?? null) : get().activeId;
      set({ library: rest, activeId: nextActive });
    },

    open: (itemId) => {
      const id = get().activeId;
      const e = id ? get().library[id] : undefined;
      if (!e || !isUnlocked(e, itemId)) return false;
      patchActive((x) => ({ ...x, current: itemId }));
      return true;
    },

    setNotes: (topicId, notes) => patchActive((e) => ({ ...e, progress: { ...e.progress, [topicId]: { ...(e.progress[topicId] ?? { cleared: false }), notes } } })),

    completeTopic: (topicId) => {
      const id = get().activeId;
      const e = id ? get().library[id] : undefined;
      if (!e) return null;
      const first = !e.progress[topicId]?.cleared;
      patchActive((x) => ({ ...x, progress: { ...x.progress, [topicId]: { ...(x.progress[topicId] ?? { notes: '' }), cleared: true } } }));
      if (first) set({ stats: { ...get().stats, xp: get().stats.xp + 30 } });
      const outline = outlineOf(e.course);
      const i = outline.findIndex((it) => it.id === topicId);
      return outline[i + 1]?.id ?? null;
    },

    answer: (correct, opts = {}) => {
      const s = get().stats;
      const expected = 1 / (1 + Math.pow(10, (questionRating(opts.position, opts.difficulty) - s.mmr) / 400));
      let delta = 32 * ((correct ? 1 : 0) - expected) * (correct && opts.hint ? 0.5 : 1);
      delta = correct ? Math.max(opts.hint ? 3 : 6, delta) : Math.min(-4, delta);
      if (correct) delta *= opts.multiplier ?? 1;
      const d = Math.round(delta);
      const streak = correct ? s.streak + 1 : 0;
      set({
        stats: {
          ...s,
          mmr: s.mmr + d,
          mmrHistory: [...s.mmrHistory, s.mmr + d].slice(-60),
          xp: s.xp + (correct ? (opts.hint ? 20 : 30) : 5),
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
          correct: s.correct + (correct ? 1 : 0),
          answered: s.answered + 1,
        },
      });
      return d;
    },

    finishModuleQuiz: (moduleId, correct, total) => {
      const id = get().activeId;
      const e = id ? get().library[id] : undefined;
      if (!e) return { passed: false, nextId: null };
      const score = total ? correct / total : 1;
      const prev = e.modules[moduleId] ?? { passed: false, best: 0, attempts: 0 };
      const passed = score >= PASS_MARK;
      patchActive((x) => ({ ...x, modules: { ...x.modules, [moduleId]: { passed: prev.passed || passed, best: Math.max(prev.best, score), attempts: prev.attempts + 1 } } }));
      bumpDay(passed && !prev.passed ? 80 : 0);
      const outline = outlineOf(e.course);
      const i = outline.findIndex((it) => it.id === `quiz:${moduleId}`);
      return { passed, nextId: outline[i + 1]?.id ?? null };
    },

    finishPopQuiz: (correct) => bumpDay(correct * 15),
  };
});

// Persist (never throws — storage may be unavailable or full).
useCourse.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ activeId: s.activeId, library: s.library, stats: s.stats }));
  } catch {
    /* ignore */
  }
});

export interface ActiveCourse {
  entry: LibraryEntry;
  course: Course;
  topics: PlacedTopic[];
  outline: OutlineItem[];
  /** Outline item being studied. */
  item: OutlineItem;
  /** First item not yet done (what "Continue" opens). */
  next: OutlineItem | null;
  /** Topics completed in order (rocket position). */
  cleared: number;
}

/** Derives the active course view (components use useActiveCourse). */
export function activeOf(entry: LibraryEntry): ActiveCourse | null {
  const topics = flatTopics(entry.course);
  if (!topics.length) return null;
  const outline = outlineOf(entry.course);
  const f = frontier(entry, outline);
  const item = outline.find((it) => it.id === entry.current) ?? outline[Math.min(f, outline.length - 1)];
  return { entry, course: entry.course, topics, outline, item, next: outline[f] ?? null, cleared: firstUncleared(entry) };
}

/** The active course, memoised (selects the stable library entry, never a fresh object). */
export function useActiveCourse(): ActiveCourse | null {
  const entry = useCourse((s) => (s.activeId ? s.library[s.activeId] : undefined));
  return useMemo(() => (entry ? activeOf(entry) : null), [entry]);
}

export const levelOf = (xp: number) => 1 + Math.floor(xp / 150);
export const levelProgress = (xp: number) => (xp % 150) / 150;

/** Stable shuffled order for a question's options (templates store the correct option first). */
export function shuffledIndices(q: { q: string; options: string[] }): number[] {
  let seed = 0;
  for (let i = 0; i < q.q.length; i++) seed = (seed * 31 + q.q.charCodeAt(i)) >>> 0;
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}
