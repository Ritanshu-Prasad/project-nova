import { beforeEach, describe, expect, it } from 'vitest';

const data: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = String(v)), removeItem: (k: string) => void delete data[k] },
  });
}

import { useCourse } from './course';
import type { Course } from './courseSchema';
import { CODE_BUFFER, matchCode, SECRET_CODES, useFinale } from './finale';
import { playFinale } from './hub';

const course = (): Course => ({
  id: 'c1',
  title: 'Mini Course',
  subtitle: '',
  objective: 'test',
  source: 'ai',
  modules: [
    {
      id: 'm1',
      title: 'Module 1',
      topics: [
        {
          id: 'm1-t1',
          title: 'Topic',
          planet: 'P',
          kind: 'concept',
          summary: 's',
          lesson: { minutes: 1, objectives: ['o'], simple: 's', blocks: [{ type: 'text', body: 'b' }] },
          quiz: [{ type: 'mcq', q: 'Q', options: ['A', 'B'], answer: 0, why: 'r' }],
        },
      ],
      quiz: [
        { type: 'mcq', q: 'MQ1', options: ['A', 'B'], answer: 0, why: 'r' },
        { type: 'mcq', q: 'MQ2', options: ['A', 'B'], answer: 0, why: 'r' },
      ],
    },
  ],
});

beforeEach(() => {
  useFinale.getState().hide();
  useCourse.setState({ activeId: null, library: {}, graduation: null });
});

describe('secret codes typed in the lounge', () => {
  it('recognises each word at the end of what was typed', () => {
    expect(matchCode('xxlaunch')).toBe('launch');
    expect(matchCode('qsupernova')).toBe('finale');
    expect(matchCode('myplanet')).toBe('planet');
    expect(matchCode('deeporbit')).toBe('orbit');
    expect(matchCode('staratlas')).toBe('atlas');
    expect(matchCode('supernov')).toBeNull();
    expect(matchCode('')).toBeNull();
  });

  it('uses only letters other than M, and the buffer fits the longest word', () => {
    for (const word of Object.values(SECRET_CODES)) expect(word).toMatch(/^[a-ln-z]+$/);
    expect(CODE_BUFFER).toBe(Math.max(...Object.values(SECRET_CODES).map((w) => w.length)));
  });
});

describe('the Nova blast finale', () => {
  it('plays for the active course by name, and for no course with a neutral name', () => {
    useCourse.getState().addCourse(course());
    playFinale();
    expect(useFinale.getState()).toMatchObject({ open: true, courseId: 'c1', title: 'Mini Course' });
    useFinale.getState().hide();
    expect(useFinale.getState().open).toBe(false);
    useCourse.setState({ activeId: null, library: {} });
    playFinale();
    expect(useFinale.getState()).toMatchObject({ open: true, courseId: null, title: 'your course' });
  });

  it('opens when the last lesson and module quiz of a course are done, once, without popping the certificate', () => {
    const c = useCourse.getState();
    c.addCourse(course());
    c.completeTopic('m1-t1');
    expect(useFinale.getState().open).toBe(false);
    c.finishModuleQuiz('m1', 2, 2);
    expect(useFinale.getState()).toMatchObject({ open: true, courseId: 'c1', title: 'Mini Course' });
    expect(useCourse.getState().graduation).toBeNull();
    expect(useCourse.getState().library.c1.completedAt).toBeTypeOf('number');
    useFinale.getState().hide();
    c.finishModuleQuiz('m1', 2, 2); // retaking never replays it by itself
    expect(useFinale.getState().open).toBe(false);
  });

  it('keeps the certificate screen for the certificate buttons', () => {
    useCourse.getState().showGraduation('c1');
    expect(useCourse.getState().graduation).toBe('c1');
  });
});

describe('the dying sun the finale ends in front of', () => {
  it('hangs ahead and a little above the horizon, filling about half of the window', async () => {
    const { DYING } = await import('../three/space/finaleWorld');
    const { CAMERA } = await import('./scene');
    const [x, y, z] = DYING.position;
    expect(z).toBeLessThan(0); // in front of the ship
    expect(y).toBeGreaterThan(0); // a little above the horizon
    expect(Math.abs(x)).toBeLessThan(DYING.distance * 0.2); // near the middle
    const halfHeight = Math.tan((CAMERA.fovWide * Math.PI) / 360);
    const share = (Math.atan(DYING.radius / DYING.distance) / Math.atan(halfHeight)) * 1; // radius as a share of half the window height
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.75);
    expect(DYING.distance - DYING.radius).toBeGreaterThan(300); // the ship is nowhere near touching it
  });

  it('passes through the stages of the flight in the store', () => {
    useFinale.getState().show('c1', 'Mini Course');
    expect(useFinale.getState().stage).toBe('pending');
    for (const stage of ['walking', 'flight', 'blast'] as const) {
      useFinale.getState().setStage(stage);
      expect(useFinale.getState().stage).toBe(stage);
    }
    useFinale.getState().hide();
    expect(useFinale.getState().open).toBe(false);
  });
});
