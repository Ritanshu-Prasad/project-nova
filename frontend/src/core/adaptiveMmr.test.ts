import { describe, expect, it, beforeEach } from 'vitest';

const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = String(value); },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
  key: (i: number) => Object.keys(storage)[i] ?? null,
  get length() { return Object.keys(storage).length; },
};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = localStorageMock;
}

import { kFactor, useCourse } from './course';
import { getCourseTiers, rankOf } from './rank';
import { HUB_QUIZ } from './hubQuiz';
import type { Course } from './courseSchema';

function makeMockCourse(moduleCount: number, topicsPerModule = 2): Course {
  return {
    id: `course-${moduleCount}`,
    title: `Mock Course ${moduleCount}`,
    subtitle: '',
    objective: 'Test adaptive MMR',
    source: 'ai' as const,
    modules: Array.from({ length: moduleCount }, (_, m) => ({
      id: `mod-${m + 1}`,
      title: `Module ${m + 1}`,
      topics: Array.from({ length: topicsPerModule }, (_, t) => ({
        id: `mod-${m + 1}-top-${t + 1}`,
        title: `Topic ${t + 1}`,
        planet: `Planet ${m + 1}`,
        kind: 'concept' as const,
        summary: 'test',
        lesson: { concept: 'test', why: 'test', minutes: 5, objectives: ['test'], simple: 'test', blocks: [{ type: 'text' as const, body: 'test' }] },
        quiz: [
          { type: 'mcq' as const, q: `Q ${m}-${t}-1`, options: ['A', 'B'], answer: 0, why: 'reason' },
          { type: 'mcq' as const, q: `Q ${m}-${t}-2`, options: ['A', 'B'], answer: 0, why: 'reason' },
        ],
      })),
      quiz: [
        { type: 'mcq' as const, q: `ModQ ${m}-1`, options: ['A', 'B'], answer: 0, why: 'reason' },
        { type: 'mcq' as const, q: `ModQ ${m}-2`, options: ['A', 'B'], answer: 0, why: 'reason' },
        { type: 'mcq' as const, q: `ModQ ${m}-3`, options: ['A', 'B'], answer: 0, why: 'reason' },
        { type: 'mcq' as const, q: `ModQ ${m}-4`, options: ['A', 'B'], answer: 0, why: 'reason' },
      ],
    })),
  };
}

describe('Adaptive MMR & 7 Tiers (Approach B)', () => {
  beforeEach(() => {
    localStorage.clear();
    useCourse.setState({
      activeId: null,
      library: {},
      stats: { xp: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, day: '2026-10-23', dayQuizzes: 0 },
    });
  });

  it('maintains 7 classic tiers in getCourseTiers', () => {
    const tiers = getCourseTiers(4);
    expect(tiers).toHaveLength(7);
    expect(tiers.map((t) => t.id)).toEqual([
      'probe',
      'shuttle',
      'corvette',
      'frigate',
      'cruiser',
      'dreadnought',
      'master',
    ]);
    expect(tiers[0].min).toBe(0);
    expect(tiers[6].min).toBe(1900);
  });

  it('calibrates kFactor across course modules and topics', () => {
    const c4 = makeMockCourse(4, 2); // 4 modules, 8 topics -> 32 questions
    const c8 = makeMockCourse(8, 2); // 8 modules, 16 topics -> 64 questions
    const c12 = makeMockCourse(12, 3); // 12 modules, 36 topics -> 120 questions

    const k4 = kFactor(c4);
    const k8 = kFactor(c8);
    const k12 = kFactor(c12);

    expect(k4).toBeGreaterThan(k8);
    expect(k8).toBeGreaterThan(k12);
    expect(k4).toBeLessThanOrEqual(55);
    expect(k12).toBeGreaterThanOrEqual(18);
  });

  it('has rapid session-friendly pop quiz cadence', () => {
    expect(HUB_QUIZ.gap[0]).toBe(60_000); // 1 minute min
    expect(HUB_QUIZ.gap[1]).toBe(180_000); // 3 minutes max
    expect(HUB_QUIZ.afterModule[0]).toBe(15_000);
  });

  it('awards Remediation MMR on retaking a previously failed question', () => {
    const course = makeMockCourse(4, 2);
    useCourse.getState().addCourse(course);

    // Initial wrong answer on question 'q-test-1'
    const d1 = useCourse.getState().answer(false, { qId: 'q-test-1', progress: 0.2 });
    expect(d1).toBeLessThan(0);

    const mmrAfterFail = useCourse.getState().library[course.id].skill.mmr;

    // Retake the question and answer correctly -> should award Remediation MMR (+50% value)
    const d2 = useCourse.getState().answer(true, { qId: 'q-test-1', progress: 0.2 });
    expect(d2).toBeGreaterThan(0);
    const mmrAfterRemediation = useCourse.getState().library[course.id].skill.mmr;
    expect(mmrAfterRemediation).toBeGreaterThan(mmrAfterFail);

    // Repeated correct answer afterwards should give 0 delta (no duplicate farming)
    const d3 = useCourse.getState().answer(true, { qId: 'q-test-1', progress: 0.2 });
    expect(d3).toBe(0);
  });

  it('awards +20 MMR Module Mastery Bonus upon scoring 100% on a module quiz retake', () => {
    const course = makeMockCourse(4, 2);
    useCourse.getState().addCourse(course);

    const initialMmr = useCourse.getState().library[course.id].skill.mmr;

    // First attempt: 3/4 (75%) -> passes, but not 100%
    const r1 = useCourse.getState().finishModuleQuiz('mod-1', 3, 4);
    expect(r1.passed).toBe(true);

    const mmrAfterFirst = useCourse.getState().library[course.id].skill.mmr;
    expect(mmrAfterFirst).toBe(initialMmr); // finishModuleQuiz itself only adds bonus on retake mastery

    // Retake attempt: 4/4 (100%) -> achieves 100% on retake -> +20 MMR bonus!
    const r2 = useCourse.getState().finishModuleQuiz('mod-1', 4, 4);
    expect(r2.passed).toBe(true);

    const mmrAfterMastery = useCourse.getState().library[course.id].skill.mmr;
    expect(mmrAfterMastery).toBe(mmrAfterFirst + 20);

    // Another 100% retake when best is already 100% does not grant duplicate bonus
    useCourse.getState().finishModuleQuiz('mod-1', 4, 4);
    const mmrAfterThird = useCourse.getState().library[course.id].skill.mmr;
    expect(mmrAfterThird).toBe(mmrAfterMastery);
  });

  it('enables diligent pilots with pop quizzes and retakes to reach Master rank (1900+ MMR)', () => {
    const course = makeMockCourse(4, 2);
    useCourse.getState().addCourse(course);

    // Simulate answering lesson and quiz questions with high accuracy
    for (let m = 0; m < 4; m++) {
      // 2 topics * 2 questions = 4 questions per module
      for (let q = 0; q < 4; q++) {
        useCourse.getState().answer(true, { qId: `top-q-${m}-${q}`, progress: (m * 4 + q) / 16 });
      }
      // Module quiz 4 questions
      for (let mq = 0; mq < 4; mq++) {
        useCourse.getState().answer(true, { qId: `mod-q-${m}-${mq}`, progress: (m + 1) / 4 });
      }
      // First attempt 100% (or pass)
      useCourse.getState().finishModuleQuiz(`mod-${m + 1}`, 3, 4);
      // Retake for 100% mastery bonus (+20 MMR each)
      useCourse.getState().finishModuleQuiz(`mod-${m + 1}`, 4, 4);

      // Simulate pop quiz (hub quiz) with 2x multiplier
      for (let pq = 0; pq < 4; pq++) {
        useCourse.getState().answer(true, { qId: `pop-q-${m}-${pq}`, progress: (m + 1) / 4, gain: 2 });
      }
    }

    const finalMmr = useCourse.getState().library[course.id].skill.mmr;
    expect(finalMmr).toBeGreaterThanOrEqual(1900);
    const rank = rankOf(finalMmr);
    expect(rank.tier.id).toBe('master');
  });
});
