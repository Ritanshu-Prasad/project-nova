import { useMemo } from 'react';
import { create } from 'zustand';
import { forgetDocuments } from './courseApi';
import { flushAnswers, noteAnswer } from './feedback';
import { useFinale } from './finale';
import { flatTopics, type Course, type Module, type PlacedTopic, type Question, type Topic } from './courseSchema';
import { LESSON_QUIZ, questionsFor, type RatedQuestion } from './quizBuilder';
import { tidyCourse, tidyTopicContent } from './tidyCourse';
import { track } from './usageEvents';

export type { RatedQuestion } from './quizBuilder';

/**
 * The pilot's course library and progress (persisted).
 *
 * A course is walked as an outline: each module's topics in order, then that module's quiz.
 * Completing a topic moves the rocket to the next planet; passing a module quiz unlocks the next module.
 *
 * Skill (MMR) is per course: every new course starts at the bottom of the ladder (Probe III). Updates are
 * Elo-style and scaled to the course's scope — question ratings climb across the course and the step size
 * shrinks for bigger courses — and paced (see paceFactors) so that finishing any course, small or large, ends in Master.
 * XP, level, answer streak and the daily goal belong to the pilot.
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

export interface CourseSkill {
  mmr: number;
  history: number[];
  correct: number;
  answered: number;
  questionHistory?: Record<string, boolean>;
}

export interface LibraryEntry {
  course: Course;
  progress: Record<string, TopicProgress>;
  modules: Record<string, ModuleProgress>;
  skill: CourseSkill;
  /** Outline item being studied: a topic id or `quiz:<moduleId>`. */
  current: string;
  updatedAt: number;
  /** When the pilot finished every planet and module quiz (the graduation). */
  completedAt?: number;
  /** How many jumps to the next planet this course has used: the ship is at planet `travelled + 1` (see travelsAvailable). */
  travelled?: number;
}

export interface Stats {
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
  /** End-of-module quiz; each attempt draws a fresh 5–10 questions from `pool`. */
  | { kind: 'quiz'; id: string; module: Module; moduleIndex: number; pool: RatedQuestion[] };

export const PASS_MARK = 0.6;
export const DAILY_GOAL = 3;
/** Every course starts here: Probe III (Iron) — see core/rank.ts. */
export const START_MMR = 1000;
const KEY = 'nova.library.v2';
const today = () => new Date().toISOString().slice(0, 10);
const freshSkill = (): CourseSkill => ({ mmr: START_MMR, history: [START_MMR], correct: 0, answered: 0 });

/** A module quiz's bank: its authored quiz (rated at the module's end) plus every topic's question bank. */
function modulePool(course: Course, moduleIndex: number, topics: PlacedTopic[]): RatedQuestion[] {
  const mine = topics.filter((t) => t.moduleIndex === moduleIndex);
  const end = mine.length ? progressAt(mine[mine.length - 1].index, topics.length) : 0;
  const rated = (t: PlacedTopic) => questionsFor(t, course).map((q) => ({ q, progress: progressAt(t.index, topics.length) }));
  const pool = [...(course.modules[moduleIndex].quiz ?? []).map((q) => ({ q, progress: end })), ...mine.flatMap(rated)];
  // A thin module borrows review questions from the module before it, so its lesson quiz still has enough.
  if (pool.length < LESSON_QUIZ.min && moduleIndex > 0) pool.push(...topics.filter((t) => t.moduleIndex === moduleIndex - 1).flatMap(rated).slice(0, LESSON_QUIZ.min - pool.length + 1));
  return pool;
}

export function outlineOf(course: Course): OutlineItem[] {
  const topics = flatTopics(course);
  const out: OutlineItem[] = [];
  course.modules.forEach((m, mi) => {
    for (const t of topics.filter((x) => x.moduleIndex === mi)) out.push({ kind: 'topic', id: t.id, topic: t, moduleIndex: mi });
    const pool = modulePool(course, mi, topics);
    if (pool.length) out.push({ kind: 'quiz', id: `quiz:${m.id}`, module: m, moduleIndex: mi, pool });
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

/** Every planet cleared and every module quiz passed. */
export function isComplete(e: LibraryEntry): boolean {
  const outline = outlineOf(e.course);
  return outline.length > 0 && frontier(e, outline) === outline.length;
}

export function isUnlocked(e: LibraryEntry, itemId: string, outline = outlineOf(e.course)): boolean {
  const i = outline.findIndex((it) => it.id === itemId);
  return i >= 0 && i <= frontier(e, outline);
}

/** Where a topic sits in the course, 0..1. */
const progressAt = (index: number, count: number) => (count > 1 ? index / (count - 1) : 0);

/** How far through the course the pilot is, 0..1: topics cleared and module quizzes passed. */
export function courseProgress(e: LibraryEntry): number {
  const topics = flatTopics(e.course);
  const modules = e.course.modules.length;
  const total = topics.length + modules;
  if (!total) return 0;
  return (coveredTopics(e).length + passedModules(e).length) / total;
}

/** Modules the pilot has completed (passed their lesson quiz). */
export const passedModules = (e: LibraryEntry) => e.course.modules.filter((m) => e.modules[m.id]?.passed);

/**
 * A course has one planet per module, and the ship can only fly to the next one once the module before it is done: every
 * passed module earns one jump. The last module has no planet after it (it ends in the finale), so at most `modules - 1` jumps.
 */
export function travelsAvailable(e: LibraryEntry | null | undefined): number {
  if (!e) return 0;
  const earned = Math.min(passedModules(e).length, Math.max(0, e.course.modules.length - 1));
  return Math.max(0, earned - (e.travelled ?? 0));
}

/** Topics the pilot has completed so far. */
export const coveredTopics = (e: LibraryEntry) => flatTopics(e.course).filter((t) => e.progress[t.id]?.cleared);

/**
 * The hub quiz bank, as of now: the lesson and practice questions of every topic the pilot has completed, plus the
 * module-level questions of modules they have passed. Nothing from topics they haven't reached yet.
 */
export function hubPool(e: LibraryEntry): RatedQuestion[] {
  const topics = flatTopics(e.course);
  const rated = (t: PlacedTopic) => [...questionsFor(t, e.course), ...(t.practice ?? [])].map((q) => ({ q, progress: progressAt(t.index, topics.length) }));
  const modules = e.course.modules.flatMap((m, mi) => {
    if (!e.modules[m.id]?.passed || !m.quiz?.length) return [];
    const last = topics.filter((t) => t.moduleIndex === mi).pop();
    return m.quiz.map((q) => ({ q, progress: last ? progressAt(last.index, topics.length) : 0 }));
  });
  return [...modules, ...coveredTopics(e).flatMap(rated)];
}

/**
 * Base step size of the Elo update, scaled to the course's scope: bigger courses have more questions, so each moves the
 * rating less. How far the whole course carries the pilot is set by the pace below, not by this number alone.
 */
export function kFactor(course: Course): number {
  const M = Math.max(1, course.modules.length);
  const T = Math.max(M, flatTopics(course).length);
  // Expected standard questions in topics (~2/topic) and module quizzes (~4/module)
  const standardQuestions = T * 2 + M * 4;
  return Math.max(18, Math.min(55, Math.round(2000 / Math.max(1, standardQuestions))));
}

/** Master's entry rating (core/rank.ts): finishing a course carries the pilot at least this far. */
export const MASTER_MMR = 1900;
/** The rating a pilot on pace holds at the end of the course: just inside Master. */
const PACE_END_MMR = 1920;

/** The rating a pilot should hold `p` (0..1) of the way through the course for the course to end in Master. */
export const paceTarget = (p: number) => START_MMR + (PACE_END_MMR - START_MMR) * Math.max(0, Math.min(1, p));

/**
 * How the pace bends one answer. Behind pace (the target is above the rating): gains grow, up to 3.5×, and losses ease so
 * a bad start cannot spiral. Ahead of pace: gains shrink to 0.55×, so nobody runs past the ladder early. A pilot answering
 * well stays near the target; one who is stuck is carried along faster, never past it.
 */
export function paceFactors(mmr: number, progress: number): { gain: number; loss: number } {
  const gap = paceTarget(progress) - mmr;
  return {
    gain: Math.max(0.55, Math.min(3.5, 1 + gap / 120)),
    loss: Math.max(0.5, Math.min(1.15, 1 - gap / 500)),
  };
}

/** Elo rating of a question: climbs from Probe to Master across the course; harder questions rate higher. */
const questionRating = (progress = 0, difficulty = 1) => START_MMR + progress * 850 + (difficulty - 1) * 60;

export interface AnswerOpts {
  difficulty?: number;
  hint?: boolean;
  /** Multiplier on MMR gained when correct (hub quizzes pay 1.75–2.5×). */
  gain?: number;
  /** Multiplier on MMR lost when wrong (0 = no penalty, e.g. timed hub questions). */
  loss?: number;
  /** Where the question's topic sits in the course, 0..1. */
  progress?: number;
  /** Unique ID (usually the question string) to track repeats. */
  qId?: string;
}

interface CourseState {
  activeId: string | null;
  library: Record<string, LibraryEntry>;
  stats: Stats;

  addCourse: (course: Course) => void;
  setActive: (id: string) => void;
  removeCourse: (id: string) => void;
  /** Fills in an outline-only topic once its lesson and questions have been written. */
  setTopicContent: (courseId: string, topicId: string, content: TopicContent) => void;
  /** Replaces a module's end-of-module quiz. */
  setModuleQuiz: (courseId: string, moduleId: string, quiz: Question[]) => void;
  /** Opens an outline item if it is unlocked. */
  open: (itemId: string) => boolean;
  setNotes: (topicId: string, notes: string) => void;
  /** Completes a topic; returns the next outline item id (topic or module quiz). */
  completeTopic: (topicId: string) => string | null;
  /** Scores one answer in the active course; returns the MMR change. */
  answer: (correct: boolean, opts?: AnswerOpts) => number;
  finishModuleQuiz: (moduleId: string, correct: number, total: number) => { passed: boolean; nextId: string | null };
  finishHubQuiz: (correct: number, total: number) => void;
  /** The ship has jumped to the next planet of the active course (spends one earned jump). */
  recordTravel: () => void;
  /** Course whose certificate screen is open (from the certificate buttons; the finale does not open it by itself). */
  graduation: string | null;
  showGraduation: (courseId: string | null) => void;
}

export type TopicContent = Pick<Topic, 'lesson' | 'quiz' | 'practice'> & { kind?: Topic['kind'] };

type Saved = Pick<CourseState, 'activeId' | 'library' | 'stats'>;

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    // Older saves kept one MMR for everything; skill is per course now and starts fresh.
    for (const e of Object.values(saved.library)) {
      e.modules ??= {};
      e.skill ??= freshSkill();
      e.course = tidyCourse(e.course);
    }
    return saved;
  } catch {
    return null;
  }
}

const initial: Saved = load() ?? {
  activeId: null,
  library: {},
  stats: { xp: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, day: today(), dayQuizzes: 0 },
};

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

  /** The first time the active course is complete: stamp it and play the Nova blast finale. */
  const markGraduation = () => {
    const id = get().activeId;
    const e = id ? get().library[id] : undefined;
    if (!e || e.completedAt || !isComplete(e)) return;
    // Finishing a course carries the pilot into Master: whatever the pace left short is made up here (a small top-up for
    // anyone who answered reasonably well).
    patchActive((x) => {
      const lift = Math.max(0, MASTER_MMR - x.skill.mmr);
      return {
        ...x,
        completedAt: Date.now(),
        ...(lift > 0 ? { skill: { ...x.skill, mmr: MASTER_MMR, history: [...x.skill.history, MASTER_MMR].slice(-80) } } : {}),
      };
    });
    useFinale.getState().show(e.course.id, e.course.title);
    track('course_finished');
  };

  return {
    ...initial,
    graduation: null,
    showGraduation: (graduation) => set({ graduation }),

    addCourse: (raw) => {
      const course = tidyCourse(raw);
      const topics = flatTopics(course);
      const progress = Object.fromEntries(topics.map((t) => [t.id, { cleared: false, notes: '' }]));
      track('course_started');
      set({ activeId: course.id, library: { ...get().library, [course.id]: { course, progress, modules: {}, skill: freshSkill(), current: topics[0]?.id ?? '', updatedAt: Date.now() } } });
    },

    setActive: (id) => {
      if (get().library[id]) set({ activeId: id });
    },

    removeCourse: (id) => {
      const { [id]: _removed, ...rest } = get().library;
      const documentsKey = _removed?.course.meta?.documentsKey;
      if (documentsKey) void forgetDocuments(documentsKey);
      const nextActive = get().activeId === id ? (Object.values(rest).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.course.id ?? null) : get().activeId;
      set({ library: rest, activeId: nextActive });
    },

    setTopicContent: (courseId, topicId, content) => {
      const e = get().library[courseId];
      if (!e) return;
      const filled = tidyTopicContent(content);
      const modules = e.course.modules.map((m) => ({ ...m, topics: m.topics.map((t) => (t.id === topicId ? { ...t, ...filled, loaded: undefined } : t)) }));
      set({ library: { ...get().library, [courseId]: { ...e, course: { ...e.course, modules } } } });
    },

    setModuleQuiz: (courseId, moduleId, quiz) => {
      const e = get().library[courseId];
      if (!e) return;
      const modules = e.course.modules.map((m) => (m.id === moduleId ? { ...m, quiz } : m));
      set({ library: { ...get().library, [courseId]: { ...e, course: { ...e.course, modules } } } });
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
      if (e.course.modules.some((m) => m.topics.some((t) => t.id === topicId && t.loaded === false))) return null;
      const first = !e.progress[topicId]?.cleared;
      patchActive((x) => ({ ...x, progress: { ...x.progress, [topicId]: { ...(x.progress[topicId] ?? { notes: '' }), cleared: true } } }));
      if (first) {
        set({ stats: { ...get().stats, xp: get().stats.xp + 30 } });
        track('topic_finished');
      }
      markGraduation();
      const outline = outlineOf(e.course);
      const i = outline.findIndex((it) => it.id === topicId);
      return outline[i + 1]?.id ?? null;
    },

    answer: (correct, opts = {}) => {
      const id = get().activeId;
      const e = id ? get().library[id] : undefined;
      if (!e) return 0;
      if (opts.qId) noteAnswer(opts.qId, correct);
      const sk = e.skill;
      const K = kFactor(e.course);
      const expected = 1 / (1 + Math.pow(10, (questionRating(opts.progress, opts.difficulty) - sk.mmr) / 400));
      let delta = K * ((correct ? 1 : 0) - expected) * (correct && opts.hint ? 0.5 : 1);
      delta = correct ? Math.max(opts.hint ? 2 : 4, delta) * (opts.gain ?? 1) : Math.min(-3, delta) * (opts.loss ?? 1);
      // The pace: a pilot behind the course's trajectory climbs faster, one ahead of it more slowly (see paceFactors).
      const pace = paceFactors(sk.mmr, opts.progress ?? courseProgress(e));
      delta *= correct ? pace.gain : pace.loss;
      if (correct) delta = Math.max(1, delta);

      // Repeat question & Remediation MMR logic
      const qHistory = sk.questionHistory ?? {};
      if (opts.qId && opts.qId in qHistory) {
        if (qHistory[opts.qId] && correct) {
          // Previously correct: already mastered, no duplicate MMR farming
          delta = 0;
        } else if (!qHistory[opts.qId] && correct) {
          // Remediation MMR: converting a previous mistake into a correct answer awards +50% value
          delta = Math.max(2, Math.round(delta * 0.5));
        }
      }

      const d = Math.round(delta) || 0;
      patchActive((x) => ({
        ...x,
        skill: { 
          mmr: sk.mmr + d, 
          history: [...sk.history, sk.mmr + d].slice(-80), 
          correct: sk.correct + (correct ? 1 : 0), 
          answered: sk.answered + 1,
          questionHistory: opts.qId ? { ...qHistory, [opts.qId]: correct } : qHistory
        },
      }));
      const s = get().stats;
      const streak = correct ? s.streak + 1 : 0;
      set({
        stats: {
          ...s,
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
      
      // Mastery bonus: achieving 100% on a module quiz retake awards a +20 MMR bonus
      const isMasteryRetake = score === 1 && prev.attempts >= 1 && prev.best < 1;
      const masteryBonus = isMasteryRetake ? 20 : 0;

      patchActive((x) => ({
        ...x,
        modules: {
          ...x.modules,
          [moduleId]: {
            passed: prev.passed || passed,
            best: Math.max(prev.best, score),
            attempts: prev.attempts + 1,
          },
        },
        ...(masteryBonus > 0
          ? {
              skill: {
                ...x.skill,
                mmr: x.skill.mmr + masteryBonus,
                history: [...x.skill.history, x.skill.mmr + masteryBonus].slice(-80),
              },
            }
          : {}),
      }));
      bumpDay(passed && !prev.passed ? 80 : 0);
      if (passed && !prev.passed) track('module_quiz_finished');
      flushAnswers();
      markGraduation();
      const outline = outlineOf(e.course);
      const i = outline.findIndex((it) => it.id === `quiz:${moduleId}`);
      return { passed, nextId: outline[i + 1]?.id ?? null };
    },

    finishHubQuiz: (correct) => {
      bumpDay(correct * 15);
      flushAnswers();
    },

    recordTravel: () => patchActive((x) => (travelsAvailable(x) > 0 ? { ...x, travelled: (x.travelled ?? 0) + 1 } : x)),
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

/** Demo courses pick up the latest authored lessons and question pools, loaded in their own chunk. */
export async function upgradeDemoCourses(): Promise<void> {
  if (!Object.values(useCourse.getState().library).some((e) => e.course.source === 'template')) return;
  try {
    const { withAuthoredContent } = await import('./templates/content');
    const lib = useCourse.getState().library;
    useCourse.setState({
      library: Object.fromEntries(Object.entries(lib).map(([id, e]) => [id, e.course.source === 'template' ? { ...e, course: tidyCourse(withAuthoredContent(e.course)) } : e])),
    });
  } catch {
    /* chunk unavailable (offline) — the plain template lessons stay */
  }
}

// Saved demo courses are upgraded right after start-up.
void upgradeDemoCourses();

const NO_SKILL: CourseSkill = freshSkill();

/** The active course's skill (stable reference from the store). */
export function useSkill(): CourseSkill {
  return useCourse((s) => (s.activeId ? s.library[s.activeId]?.skill : undefined) ?? NO_SKILL);
}

/** Reads the active course's MMR outside React. */
export const activeMmr = () => {
  const s = useCourse.getState();
  return (s.activeId ? s.library[s.activeId]?.skill.mmr : undefined) ?? START_MMR;
};

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

export const LEVEL_THRESHOLDS: number[] = [0];
let _totalThreshold = 0;
for (let lvl = 1; lvl <= 150; lvl++) {
  _totalThreshold += Math.round(100 * Math.pow(1.08, lvl - 1));
  LEVEL_THRESHOLDS.push(_totalThreshold);
}

/** The cumulative XP required to reach a specific level. Level 1 requires 0 XP. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return LEVEL_THRESHOLDS[level - 1];
}

/**
 * Calculates pilot level using a gentle exponential RPG curve:
 * Early levels (1–5) require only ~100–130 XP each, but higher levels
 * require progressively more XP (e.g. ~430 XP at lvl 20, ~930 XP at lvl 30).
 */
export function levelOf(xp: number): number {
  if (xp <= 0) return 1;
  let low = 0;
  let high = LEVEL_THRESHOLDS.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (LEVEL_THRESHOLDS[mid] <= xp) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/** Progress percentage towards the next level [0.0, 1.0). */
export function levelProgress(xp: number): number {
  const lvl = levelOf(xp);
  const base = xpForLevel(lvl);
  const next = xpForLevel(lvl + 1);
  const span = next - base;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(0.999, (xp - base) / span));
}

/** A random order for a question's options (templates often store the correct option first) — memoise per question. */
export function shuffledIndices(q: { q: string; options: string[] }): number[] {
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}
