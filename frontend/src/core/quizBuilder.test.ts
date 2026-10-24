import { describe, expect, it } from 'vitest';
import { QUIZ_MAX, QUIZ_MIN, TIMED_LAST, answerText, buildQuiz, fillAccepts, joinPoints, questionsFor, quizSizeLabel, standsAlone, timeLimitFor, type RatedQuestion } from './quizBuilder';
import { flatTopics, type Block, type Course, type Question, type Topic } from './courseSchema';

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

const topic = (id: string, title: string, blocks: Block[]): Topic => ({
  id,
  title,
  planet: title,
  kind: 'concept',
  summary: '',
  lesson: { minutes: 5, objectives: [], simple: '', blocks },
  quiz: [],
});
const courseOf = (...topics: Topic[]): Course => ({ id: 'c', title: 'C', subtitle: '', objective: '', source: 'template', modules: [{ id: 'm', title: 'M', topics }] });
const keyTerms = (...terms: [string, string][]): Block => ({ type: 'keyTerms', terms: terms.map(([term, def]) => ({ term, def })) });
const generated = (course: Course, id: string) => questionsFor(flatTopics(course).find((t) => t.id === id)!, course);

describe('joinPoints', () => {
  it('joins points and strips each one’s trailing punctuation', () => {
    expect(joinPoints(['Responds in seconds.', 'The problem is slow!', 'Ends;'], '; ')).toBe('Responds in seconds; The problem is slow; Ends');
  });

  it('never leaves ".," or ".." in the output', () => {
    const out = joinPoints(['A.', 'B..', 'C,'], ', ');
    expect(out).not.toMatch(/[.,]{2}/);
    expect(out).toBe('A, B, C');
  });
});

describe('answers and feedback text', () => {
  it('shows a multiple-select answer as separate items, not a run-on comma join', () => {
    const q: Question = { type: 'multi', q: 'Pick', options: ['Seconds.', 'The problem is slow.', 'Other'], answers: [0, 1], why: '' };
    expect(answerText(q)).toBe('Seconds; The problem is slow');
  });

  it('joins order items with arrows without doubled punctuation', () => {
    const q: Question = { type: 'order', q: 'Order', items: ['Plan.', 'Write.'], why: '' };
    expect(answerText(q)).toBe('Plan → Write');
  });
});

describe('fill-in answers', () => {
  const cell: Extract<Question, { type: 'fill' }> = { type: 'fill', q: 'A ____ holds water.', answer: 'cell', accept: ['cell'], why: '' };

  it('accepts the singular and plural form of the answer', () => {
    expect(fillAccepts(cell, 'cell')).toBe(true);
    expect(fillAccepts(cell, 'cells')).toBe(true);
    expect(fillAccepts({ ...cell, answer: 'box' }, 'boxes')).toBe(true);
    expect(fillAccepts({ ...cell, answer: 'boxes' }, 'box')).toBe(true);
  });

  it('ignores case and punctuation but rejects other words', () => {
    expect(fillAccepts(cell, ' Cell. ')).toBe(true);
    expect(fillAccepts(cell, 'cel')).toBe(false);
    expect(fillAccepts(cell, 'nerve')).toBe(false);
  });

  it('accepts listed variants', () => {
    expect(fillAccepts({ type: 'fill', q: '', answer: 'Machine learning', accept: ['ML'], why: '' }, 'ml')).toBe(true);
  });
});

describe('checkpoint question generation', () => {
  it('builds match pairs from key terms only, never from example blocks', () => {
    const course = courseOf(
      topic('a', 'Alpha topic', [
        keyTerms(['Latency', 'the delay before a response arrives'], ['Throughput', 'work finished per unit of time'], ['Jitter', 'variation in delay between packets']),
        { type: 'text', body: 'Quota is a cap on how many requests a client may send. Cache is a stored copy of recent results.' },
        { type: 'example', body: 'Zebra is a striped animal that lives on the plains and eats grass.' },
      ]),
    );
    const match = generated(course, 'a').find((q): q is Extract<Question, { type: 'match' }> => q.type === 'match');
    expect(match?.pairs.map(([term]) => term)).toEqual(['Latency', 'Throughput', 'Jitter']);
  });

  it('tops up a topic with fewer than three key terms from its text, but never from examples', () => {
    const course = courseOf(
      topic('a', 'Thin topic', [
        keyTerms(['Latency', 'the delay before a response arrives'], ['Jitter', 'variation in delay between packets']),
        { type: 'text', body: 'Quota is a cap on how many requests a client may send.' },
        { type: 'example', body: 'Zebra is a striped animal that lives on the plains and eats grass.' },
      ]),
    );
    const match = generated(course, 'a').find((q): q is Extract<Question, { type: 'match' }> => q.type === 'match');
    expect(match?.pairs.map(([term]) => term)).toEqual(['Latency', 'Jitter', 'Quota']);
  });

  it('makes no match question when a topic has fewer than three terms even if examples define more', () => {
    const course = courseOf(
      topic('a', 'Example heavy', [
        keyTerms(['Latency', 'the delay before a response arrives']),
        { type: 'example', body: 'Zebra is a striped animal that lives on the plains and eats grass. Lion is a big cat that hunts in groups.' },
      ]),
    );
    expect(generated(course, 'a').some((q) => q.type === 'match')).toBe(false);
  });

  it('asks no provenance questions: nothing says “takeaways from” or “key terms in”, and no multi-select is built', () => {
    const withTakeaways = (id: string, title: string) => topic(id, title, [keyTerms([`Term ${id}`, `a definition for ${id}`]), { type: 'summary', points: [`Point one of ${id}.`, `Point two of ${id}.`] }]);
    const course = courseOf(withTakeaways('a', 'Alpha'), withTakeaways('b', 'Beta'), withTakeaways('c', 'Gamma'));
    for (const id of ['a', 'b', 'c']) {
      const bank = generated(course, id);
      expect(bank.some((q) => q.q.includes('takeaways from') || q.q.includes('key terms in'))).toBe(false);
      expect(bank.some((q) => q.type === 'multi')).toBe(false);
    }
  });

  it('keeps the first blank as fill-in when its multiple choice cannot be built', () => {
    const course = courseOf(
      topic('a', 'Plain', [{ type: 'text', body: 'Gizmo is a tool that cuts paper cleanly. Widget is a device that holds parts together.' }]),
    );
    const bank = generated(course, 'a');
    const fills = bank.filter((q): q is Extract<Question, { type: 'fill' }> => q.type === 'fill').map((q) => q.answer);
    expect(fills).toEqual(expect.arrayContaining(['Gizmo', 'Widget']));
    expect(bank.some((q) => q.q.startsWith('Which term completes the sentence'))).toBe(false);
  });

  it('never gives a why line with doubled punctuation', () => {
    const course = courseOf(
      topic('a', 'Steps', [{ type: 'steps', title: 'Do it', steps: ['Plan the work.', 'Write the code.', 'Ship it!'] }]),
    );
    for (const q of generated(course, 'a')) expect(q.why).not.toMatch(/[.,;!]{2}/);
  });
});

describe('fill-in sentence filter', () => {
  it('rejects sentences that lean on the text around them', () => {
    expect(standsAlone('This gives the viewer a concrete visual to watch while the narrator speaks.')).toBe(false);
    expect(standsAlone('“They” rely on the earlier setup.')).toBe(false);
    expect(standsAlone('However, the loss can still rise.')).toBe(false);
    expect(standsAlone('The example below shows the loop in action.')).toBe(false);
    expect(standsAlone('Use the following steps to train it.')).toBe(false);
  });

  it('keeps self-contained sentences', () => {
    expect(standsAlone('A bridge distributes load through its arch and abutments.')).toBe(true);
    expect(standsAlone('Thistles are tough plants.')).toBe(true);
  });
});
