import { useMemo } from 'react';
import { create } from 'zustand';
import { flatTopics, type Course, type PlacedTopic, type Question } from './courseSchema';

/**
 * The pilot's course library and progress (persisted). Each course is a sequence of topics ("planets");
 * a topic unlocks when the one before it is cleared, and clearing a topic's quiz moves the rocket on.
 * MMR follows an Elo-style update per answer; XP drives the level.
 */

export interface TopicProgress {
  read: boolean;
  /** First-attempt result per question (null = not answered yet). */
  answers: (boolean | null)[];
  cleared: boolean;
  notes: string;
}

export interface LibraryEntry {
  course: Course;
  progress: Record<string, TopicProgress>;
  /** Topic the pilot is studying. */
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

interface CourseState {
  activeId: string | null;
  library: Record<string, LibraryEntry>;
  stats: Stats;

  addCourse: (course: Course) => void;
  setActive: (id: string) => void;
  removeCourse: (id: string) => void;
  openTopic: (topicId: string) => void;
  markRead: (topicId: string) => void;
  setNotes: (topicId: string, notes: string) => void;
  answer: (topicId: string, q: number, correct: boolean, opts?: { difficulty?: number; hint?: boolean }) => number;
  finishQuiz: (topicId: string) => { passed: boolean; advanced: boolean; nextId: string | null };
  resetQuiz: (topicId: string) => void;
}

export const DAILY_GOAL = 3;
const KEY = 'nova.library.v2';
const START_MMR = 1200;
const today = () => new Date().toISOString().slice(0, 10);

const blankProgress = (q: Question[]): TopicProgress => ({ read: false, answers: q.map(() => null), cleared: false, notes: '' });

type Saved = Pick<CourseState, 'activeId' | 'library' | 'stats'>;

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

const initial: Saved = load() ?? {
  activeId: null,
  library: {},
  stats: { mmr: START_MMR, mmrHistory: [START_MMR], xp: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, day: today(), dayQuizzes: 0 },
};

/** Elo expectation against a question; difficulty and position in the course raise its rating. */
const questionRating = (index: number, difficulty = 1) => 1100 + index * 45 + difficulty * 70;

export const useCourse = create<CourseState>()((set, get) => {
  const patchEntry = (id: string, fn: (e: LibraryEntry) => LibraryEntry) => {
    const e = get().library[id];
    if (e) set({ library: { ...get().library, [id]: { ...fn(e), updatedAt: Date.now() } } });
  };
  const patchTopic = (topicId: string, fn: (p: TopicProgress) => TopicProgress) => {
    const id = get().activeId;
    if (!id) return;
    patchEntry(id, (e) => {
      const t = flatTopics(e.course).find((x) => x.id === topicId);
      const prev = e.progress[topicId] ?? blankProgress(t?.quiz ?? []);
      return { ...e, progress: { ...e.progress, [topicId]: fn(prev) } };
    });
  };

  return {
    ...initial,

    addCourse: (course) => {
      const topics = flatTopics(course);
      const progress = Object.fromEntries(topics.map((t) => [t.id, blankProgress(t.quiz)]));
      set({ activeId: course.id, library: { ...get().library, [course.id]: { course, progress, current: topics[0]?.id ?? '', updatedAt: Date.now() } } });
    },

    setActive: (id) => get().library[id] && set({ activeId: id }),

    removeCourse: (id) => {
      const { [id]: _removed, ...rest } = get().library;
      void _removed;
      const nextActive = get().activeId === id ? (Object.values(rest).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.course.id ?? null) : get().activeId;
      set({ library: rest, activeId: nextActive });
    },

    openTopic: (topicId) => {
      const id = get().activeId;
      if (!id) return;
      const e = get().library[id];
      const topics = flatTopics(e.course);
      const i = topics.findIndex((t) => t.id === topicId);
      if (i < 0 || i > firstUncleared(e)) return; // locked
      patchEntry(id, (x) => ({ ...x, current: topicId }));
    },

    markRead: (topicId) => patchTopic(topicId, (p) => (p.read ? p : { ...p, read: true })),

    setNotes: (topicId, notes) => patchTopic(topicId, (p) => ({ ...p, notes })),

    answer: (topicId, q, correct, opts = {}) => {
      const s = get().stats;
      const id = get().activeId;
      const index = id ? flatTopics(get().library[id].course).findIndex((t) => t.id === topicId) : 0;
      const expected = 1 / (1 + Math.pow(10, (questionRating(index, opts.difficulty) - s.mmr) / 400));
      let delta = Math.round(32 * ((correct ? 1 : 0) - expected) * (correct && opts.hint ? 0.5 : 1));
      delta = correct ? Math.max(opts.hint ? 3 : 6, delta) : Math.min(-4, delta);
      patchTopic(topicId, (p) => {
        const answers = [...p.answers];
        if (answers[q] === null || answers[q] === undefined) answers[q] = correct;
        return { ...p, answers };
      });
      const streak = correct ? s.streak + 1 : 0;
      set({
        stats: {
          ...s,
          mmr: s.mmr + delta,
          mmrHistory: [...s.mmrHistory, s.mmr + delta].slice(-60),
          xp: s.xp + (correct ? (opts.hint ? 25 : 40) : 10),
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
          correct: s.correct + (correct ? 1 : 0),
          answered: s.answered + 1,
        },
      });
      return delta;
    },

    finishQuiz: (topicId) => {
      const id = get().activeId;
      if (!id) return { passed: false, advanced: false, nextId: null };
      const e = get().library[id];
      const topics = flatTopics(e.course);
      const i = topics.findIndex((t) => t.id === topicId);
      const p = e.progress[topicId];
      const passed = !topics[i]?.quiz.length || (p?.answers ?? []).some(Boolean);
      const advanced = passed && !p?.cleared;
      const s = get().stats;
      const day = today();
      set({ stats: { ...s, xp: s.xp + (advanced ? 60 : 0), day, dayQuizzes: (s.day === day ? s.dayQuizzes : 0) + 1 } });
      // The current topic stays put (the results screen is still showing); "Next lesson" moves on.
      if (passed) patchTopic(topicId, (x) => ({ ...x, cleared: true, read: true }));
      return { passed, advanced, nextId: topics[i + 1]?.id ?? null };
    },

    resetQuiz: (topicId) => patchTopic(topicId, (p) => ({ ...p, answers: p.answers.map(() => null) })),
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

/** Index of the first topic not yet cleared (= the rocket's planet; equals the topic count when done). */
export function firstUncleared(e: LibraryEntry): number {
  const topics = flatTopics(e.course);
  const i = topics.findIndex((t) => !e.progress[t.id]?.cleared);
  return i < 0 ? topics.length : i;
}

export interface ActiveCourse {
  entry: LibraryEntry;
  course: Course;
  topics: PlacedTopic[];
  current: PlacedTopic;
  cleared: number;
}

/** Derives the active course view (call inside components via useActiveCourse). */
export function activeOf(s: Pick<CourseState, 'activeId' | 'library'>): ActiveCourse | null {
  const entry = s.activeId ? s.library[s.activeId] : undefined;
  if (!entry) return null;
  const topics = flatTopics(entry.course);
  if (!topics.length) return null;
  const current = topics.find((t) => t.id === entry.current) ?? topics[0];
  return { entry, course: entry.course, topics, current, cleared: firstUncleared(entry) };
}

/** The active course, derived and memoised (selects the stable library entry, never a fresh object). */
export function useActiveCourse(): ActiveCourse | null {
  const entry = useCourse((s) => (s.activeId ? s.library[s.activeId] : undefined));
  return useMemo(() => (entry ? activeOf({ activeId: entry.course.id, library: { [entry.course.id]: entry } }) : null), [entry]);
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
