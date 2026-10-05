import { create } from 'zustand';
import { COURSES, type CourseTemplate, type Question } from './courseData';

/**
 * The player's active course and progress (persisted). Subtopics are planets on the journey map;
 * finishing a planet's quiz moves the rocket on. MMR follows an Elo-style update per answer.
 */

/** null = unanswered, otherwise whether the first attempt was correct. */
type Answers = (boolean | null)[][];

interface CourseState {
  objective: string | null;
  courseId: string;
  /** Planet the player is studying (can be a cleared one, when reviewing). */
  current: number;
  /** Planets cleared — the rocket sits on planet `cleared` (or at the finish). */
  cleared: number;
  answers: Answers;
  mmr: number;
  mmrHistory: number[];
  xp: number;
  streak: number;
  bestStreak: number;
  correct: number;
  answered: number;

  start: (objective: string) => void;
  goTo: (index: number) => void;
  answer: (sub: number, q: number, correct: boolean) => number;
  clearPlanet: (sub: number) => boolean;
  retry: (sub: number) => void;
}

const KEY = 'nova.course.v1';
const START_MMR = 1200;

export const findCourse = (id: string): CourseTemplate => COURSES.find((c) => c.id === id) ?? COURSES[COURSES.length - 1];
export const courseFor = (objective: string) => COURSES.find((c) => c.match.test(objective)) ?? COURSES[COURSES.length - 1];

const freshAnswers = (c: CourseTemplate): Answers => c.subtopics.map((s) => s.quiz.map(() => null));

type Saved = Omit<CourseState, 'start' | 'goTo' | 'answer' | 'clearPlanet' | 'retry'>;

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

const initial: Saved = load() ?? {
  objective: null,
  courseId: 'ai',
  current: 0,
  cleared: 0,
  answers: freshAnswers(findCourse('ai')),
  mmr: START_MMR,
  mmrHistory: [START_MMR],
  xp: 0,
  streak: 0,
  bestStreak: 0,
  correct: 0,
  answered: 0,
};

/** Elo expectation against a question whose difficulty rises along the course. */
const questionRating = (sub: number, q: number) => 1150 + sub * 110 + q * 55;

export const useCourse = create<CourseState>()((set, get) => ({
  ...initial,

  start: (objective) => {
    const s = get();
    if (s.objective && s.objective.trim().toLowerCase() === objective.trim().toLowerCase()) return; // resume
    const c = courseFor(objective);
    set({ objective, courseId: c.id, current: 0, cleared: 0, answers: freshAnswers(c) });
  },

  goTo: (index) => {
    const n = findCourse(get().courseId).subtopics.length;
    set({ current: Math.max(0, Math.min(index, Math.min(get().cleared, n - 1))) });
  },

  answer: (sub, q, correct) => {
    const s = get();
    const expected = 1 / (1 + Math.pow(10, (questionRating(sub, q) - s.mmr) / 400));
    let delta = Math.round(32 * ((correct ? 1 : 0) - expected));
    if (correct) delta = Math.max(6, delta);
    else delta = Math.min(-4, delta);
    const answers = s.answers.map((row) => [...row]);
    if (answers[sub] && answers[sub][q] === null) answers[sub][q] = correct;
    const streak = correct ? s.streak + 1 : 0;
    set({
      answers,
      mmr: s.mmr + delta,
      mmrHistory: [...s.mmrHistory, s.mmr + delta].slice(-40),
      xp: s.xp + (correct ? 40 : 10),
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
      correct: s.correct + (correct ? 1 : 0),
      answered: s.answered + 1,
    });
    return delta;
  },

  /** Clears a planet if at least one answer was right; returns whether the rocket moved on. */
  clearPlanet: (sub) => {
    const s = get();
    const row = s.answers[sub] ?? [];
    if (!row.some(Boolean)) return false;
    const n = findCourse(s.courseId).subtopics.length;
    const advanced = sub === s.cleared;
    set({
      cleared: advanced ? Math.min(n, s.cleared + 1) : s.cleared,
      current: advanced ? Math.min(n - 1, sub + 1) : s.current,
      xp: s.xp + (advanced ? 60 : 0),
    });
    return advanced;
  },

  retry: (sub) => {
    const answers = get().answers.map((row, i) => (i === sub ? row.map(() => null) : [...row]));
    set({ answers });
  },
}));

// Persist progress (never throws — storage may be unavailable).
useCourse.subscribe((s) => {
  try {
    const { start: _a, goTo: _b, answer: _c, clearPlanet: _d, retry: _e, ...data } = s;
    void _a; void _b; void _c; void _d; void _e;
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
});

export const levelOf = (xp: number) => 1 + Math.floor(xp / 150);
export const levelProgress = (xp: number) => (xp % 150) / 150;

/** Options in a stable shuffled order per question (the correct answer is options[0] in the data). */
export function shuffledOptions(q: Question): { text: string; correct: boolean }[] {
  let seed = 0;
  for (let i = 0; i < q.q.length; i++) seed = (seed * 31 + q.q.charCodeAt(i)) >>> 0;
  const items = q.options.map((text, i) => ({ text, correct: i === 0 }));
  for (let i = items.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
