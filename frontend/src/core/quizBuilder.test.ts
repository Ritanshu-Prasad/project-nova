import { describe, expect, it } from 'vitest';
import { QUIZ_MAX, QUIZ_MIN, TIMED_LAST, buildQuiz, quizSizeLabel, timeLimitFor, type RatedQuestion } from './quizBuilder';
import type { Question } from './courseSchema';

const mcq = (n: number, difficulty = 1): Question => ({ type: 'mcq', q: `Question ${n}?`, why: '', difficulty, options: ['a', 'b'], answer: 0 });
const truefalse = (n: number, difficulty = 1): Question => ({ type: 'truefalse', q: `Statement ${n}.`, why: '', difficulty, answer: true });
const order = (n: number, difficulty = 1): Question => ({ type: 'order', q: `Put ${n} in order`, why: '', difficulty, items: ['a', 'b', 'c'] });
const rated = (q: Question): RatedQuestion => ({ q, progress: 0 });
const seeded = () => {
  let x = 7;
  return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
};
const pool = (count: number) => Array.from({ length: count }, (_, n) => rated([mcq, truefalse, order][n % 3](n)));

describe('buildQuiz', () => {
  it('never repeats a question and respects the size limits', () => {
    for (let run = 0; run < 20; run++) {
      const { questions } = buildQuiz(pool(30), {}, seeded());
      const texts = questions.map((x) => x.q.q);
      expect(new Set(texts).size).toBe(texts.length);
      expect(questions.length).toBeGreaterThanOrEqual(QUIZ_MIN);
      expect(questions.length).toBeLessThanOrEqual(QUIZ_MAX);
    }
  });

  it('draws a lesson quiz of three to five questions when asked', () => {
    const { questions } = buildQuiz(pool(30), { min: 3, max: 5 }, seeded());
    expect(questions.length).toBeGreaterThanOrEqual(3);
    expect(questions.length).toBeLessThanOrEqual(5);
  });

  it('mixes formats instead of asking one type in a row', () => {
    const { questions } = buildQuiz(pool(30), { min: 6, max: 6 }, seeded());
    expect(new Set(questions.map((x) => x.q.type)).size).toBe(3);
  });

  it('puts easier questions first', () => {
    const hard = [rated(mcq(1, 3)), rated(mcq(2, 1)), rated(mcq(3, 2))];
    expect(buildQuiz(hard, { min: 3, max: 3 }, seeded()).questions.map((x) => x.q.difficulty)).toEqual([1, 2, 3]);
  });

  it('treats questions with the same text as one', () => {
    const twins = [rated(mcq(1)), rated(mcq(1)), rated(mcq(2))];
    expect(buildQuiz(twins, { min: 3, max: 3 }, seeded()).questions).toHaveLength(2);
  });

  it('takes preferred questions first', () => {
    const wanted = (x: RatedQuestion) => x.q.q.endsWith('0?') || x.q.q.endsWith('1?');
    const questions = buildQuiz(pool(0).concat(Array.from({ length: 12 }, (_, n) => rated(mcq(n)))), { min: 2, max: 2, prefer: wanted }, seeded()).questions;
    expect(questions.every((x) => wanted(x))).toBe(true);
  });

  it('times only the last questions of a full quiz', () => {
    const full = buildQuiz(pool(30), { min: QUIZ_MAX, max: QUIZ_MAX }, seeded());
    expect(full.limits.filter((limit) => limit !== null)).toHaveLength(TIMED_LAST);
    expect(full.limits.slice(0, QUIZ_MAX - TIMED_LAST).every((limit) => limit === null)).toBe(true);
    expect(buildQuiz(pool(30), { min: 6, max: 6 }, seeded()).limits.every((limit) => limit === null)).toBe(true);
  });

  it('asks for fewer questions when the pool is small', () => {
    expect(buildQuiz(pool(2), {}, seeded()).questions).toHaveLength(2);
    expect(buildQuiz([], {}, seeded()).questions).toEqual([]);
  });
});

describe('time limits and labels', () => {
  it('gives longer limits to harder questions and slower formats', () => {
    expect(timeLimitFor(mcq(1, 3))).toBeGreaterThan(timeLimitFor(mcq(1, 1)));
    expect(timeLimitFor(order(1))).toBeGreaterThan(timeLimitFor(truefalse(1)));
  });

  it('labels the size of a bank', () => {
    expect(quizSizeLabel(30)).toBe('5–10');
    expect(quizSizeLabel(7)).toBe('5–7');
    expect(quizSizeLabel(3)).toBe('3');
  });
});
