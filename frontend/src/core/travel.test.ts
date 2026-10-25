import { beforeEach, describe, expect, it } from 'vitest';

const storage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = String(v); },
    removeItem: (k: string) => { delete storage[k]; },
    clear: () => Object.keys(storage).forEach((k) => delete storage[k]),
    key: (i: number) => Object.keys(storage)[i] ?? null,
    get length() { return Object.keys(storage).length; },
  };
}

import { travelsAvailable, useCourse } from './course';
import type { Course } from './courseSchema';
import { PLANET_COUNT, usePlanets } from './planets';
import { cycleVisited, visitedWorlds, worldOfCourse } from './tour';

function course(modules: number): Course {
  return {
    id: `travel-${modules}`,
    title: 'Travel',
    subtitle: '',
    objective: 'test',
    source: 'ai' as const,
    modules: Array.from({ length: modules }, (_, m) => ({
      id: `m${m + 1}`,
      title: `Module ${m + 1}`,
      topics: [{ id: `m${m + 1}-t1`, title: 'Topic', planet: 'P', kind: 'concept' as const, summary: 's', lesson: { concept: 'c', why: 'w', minutes: 5, objectives: ['o'], simple: 's', blocks: [{ type: 'text' as const, body: 'b' }] }, quiz: [{ type: 'mcq' as const, q: `q${m}`, options: ['A', 'B'], answer: 0, why: 'r' }] }],
      quiz: [{ type: 'mcq' as const, q: `mq${m}`, options: ['A', 'B'], answer: 0, why: 'r' }],
    })),
  };
}

const entry = () => useCourse.getState().library[useCourse.getState().activeId!];

describe('one planet per module, one jump per finished module', () => {
  beforeEach(() => {
    localStorage.clear();
    useCourse.setState({ activeId: null, library: {}, stats: { xp: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, day: '2026-10-25', dayQuizzes: 0 } });
  });

  it('no jump is open at the start', () => {
    useCourse.getState().addCourse(course(4));
    expect(travelsAvailable(entry())).toBe(0);
    useCourse.getState().recordTravel();
    expect(entry().travelled ?? 0).toBe(0);
  });

  it('every passed module opens exactly one jump, and a jump spends it', () => {
    useCourse.getState().addCourse(course(4));
    useCourse.getState().finishModuleQuiz('m1', 3, 3);
    expect(travelsAvailable(entry())).toBe(1);
    useCourse.getState().recordTravel();
    expect(entry().travelled).toBe(1);
    expect(travelsAvailable(entry())).toBe(0);
    useCourse.getState().recordTravel(); // nothing earned: ignored
    expect(entry().travelled).toBe(1);
    useCourse.getState().finishModuleQuiz('m2', 3, 3);
    expect(travelsAvailable(entry())).toBe(1);
  });

  it('a failed quiz opens nothing', () => {
    useCourse.getState().addCourse(course(3));
    useCourse.getState().finishModuleQuiz('m1', 0, 3);
    expect(travelsAvailable(entry())).toBe(0);
  });

  it('the last module has no planet after it: at most modules - 1 jumps', () => {
    useCourse.getState().addCourse(course(3));
    for (const m of ['m1', 'm2', 'm3']) useCourse.getState().finishModuleQuiz(m, 3, 3);
    expect(travelsAvailable(entry())).toBe(2);
  });

  it('the ship is at the planet of the jumps taken, and the Star Chart / planet code stay inside the worlds reached', () => {
    useCourse.getState().addCourse(course(5));
    expect(usePlanets.getState().index).toBe(0);
    expect(visitedWorlds()).toBe(1);
    expect(cycleVisited()).toBeNull();
    useCourse.getState().finishModuleQuiz('m1', 3, 3);
    useCourse.getState().recordTravel();
    expect(usePlanets.getState().index).toBe(1);
    expect(visitedWorlds()).toBe(2);
    expect(cycleVisited()).toBe(0);
    expect(cycleVisited()).toBe(1);
  });

  it('a course longer than the tour starts it again', () => {
    expect(worldOfCourse(PLANET_COUNT)).toBe(0);
    expect(worldOfCourse(PLANET_COUNT + 3)).toBe(3);
  });
});
