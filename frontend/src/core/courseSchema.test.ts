import { describe, expect, it } from 'vitest';
import { normQuestion, normTopic, normalizeCourse } from './courseSchema';

const mcq = { type: 'mcq', q: 'Which one?', options: ['a', 'b', 'c', 'd'], answer: 1, why: 'Because.' };
const block = { type: 'text', body: 'Some text.' };
const topic = (extra: Record<string, unknown> = {}) => ({ id: 't1', title: 'Bridges', lesson: { blocks: [block] }, ...extra });

describe('quickcheck block', () => {
  const lesson = (blocks: unknown[]) => normTopic({ id: 't1', title: 'Bridges', lesson: { blocks } }).lesson.blocks;

  it('keeps a quickcheck with a question and an answer', () => {
    expect(lesson([{ type: 'quickcheck', question: 'Why?', answer: 'Because.' }])).toEqual([{ type: 'quickcheck', question: 'Why?', answer: 'Because.' }]);
  });

  it('drops one missing either part', () => {
    expect(lesson([block, { type: 'quickcheck', question: 'Why?' }, { type: 'quickcheck', answer: 'Because.' }])).toEqual([{ type: 'text', body: 'Some text.' }]);
  });
});

describe('normQuestion', () => {
  it('keeps a valid single-choice question', () => {
    expect(normQuestion(mcq)).toMatchObject({ type: 'mcq', q: 'Which one?', answer: 1, difficulty: 1 });
  });

  it('drops a question without text, with too few options or with an answer outside them', () => {
    expect(normQuestion({ ...mcq, q: '' })).toBeNull();
    expect(normQuestion({ ...mcq, options: ['only'] })).toBeNull();
    expect(normQuestion({ ...mcq, answer: 4 })).toBeNull();
  });

  it('keeps only the answers of a multiple-select question that are real options', () => {
    expect(normQuestion({ type: 'multi', q: 'Pick', options: ['a', 'b', 'c'], answers: [0, 2, 9] })).toMatchObject({ answers: [0, 2] });
    expect(normQuestion({ type: 'multi', q: 'Pick', options: ['a', 'b'], answers: [7] })).toBeNull();
  });

  it('needs a real boolean for true/false', () => {
    expect(normQuestion({ type: 'truefalse', q: 'Is it?', answer: false })).toMatchObject({ answer: false });
    expect(normQuestion({ type: 'truefalse', q: 'Is it?', answer: 'false' })).toBeNull();
  });

  it('needs at least three items to order and two pairs to match', () => {
    expect(normQuestion({ type: 'order', q: 'Order', items: ['a', 'b'] })).toBeNull();
    expect(normQuestion({ type: 'order', q: 'Order', items: ['a', 'b', 'c', ''] })).toMatchObject({ items: ['a', 'b', 'c'] });
    expect(normQuestion({ type: 'match', q: 'Match', pairs: [['a', '1']] })).toBeNull();
    expect(normQuestion({ type: 'match', q: 'Match', pairs: [['a', '1'], ['b', '2']] })).toMatchObject({ pairs: [['a', '1'], ['b', '2']] });
  });

  it('drops a code check whose pattern is not a valid expression', () => {
    const code = { type: 'code', q: 'Write it', solution: 'x = 1', checks: [{ label: 'ok', pattern: 'x\\s*=' }, { label: 'bad', pattern: '(' }] };
    expect(normQuestion(code)).toMatchObject({ checks: [{ label: 'ok', pattern: 'x\\s*=' }] });
    expect(normQuestion({ ...code, checks: [{ label: 'bad', pattern: '(' }] })).toBeNull();
  });

  it('rejects an unknown type', () => {
    expect(normQuestion({ ...mcq, type: 'essay' })).toBeNull();
  });
});

describe('normTopic', () => {
  it('keeps the def key of key terms and drops blocks it does not understand', () => {
    const result = normTopic(topic({ lesson: { blocks: [{ type: 'keyTerms', terms: [{ term: 'Veth', def: 'A pair' }, { term: '', def: 'x' }] }, { type: 'hologram' }] } }));
    expect(result.lesson.blocks).toEqual([{ type: 'keyTerms', terms: [{ term: 'Veth', def: 'A pair' }] }]);
  });

  it('keeps what a topic covers and excludes, and leaves them out when empty', () => {
    expect(normTopic(topic({ covers: 'Bridge basics', excludes: 'Overlay networks' }))).toMatchObject({ covers: 'Bridge basics', excludes: 'Overlay networks' });
    expect(normTopic(topic({ covers: 42 })).covers).toBeUndefined();
    expect(normTopic(topic()).excludes).toBeUndefined();
  });

  it('keeps an outline-only topic marked as not loaded', () => {
    expect(normTopic(topic({ loaded: false, lesson: { blocks: [] } })).loaded).toBe(false);
  });

  it('filters bad questions out of the quiz and practice lists', () => {
    const result = normTopic(topic({ quiz: [mcq, { type: 'mcq', q: '' }], practice: [{ type: 'bogus' }] }));
    expect(result.quiz).toHaveLength(1);
    expect(result.practice).toEqual([]);
  });

  it('falls back to a concept topic for an unknown kind', () => {
    expect(normTopic(topic({ kind: 'astrology' })).kind).toBe('concept');
  });
});

describe('normalizeCourse', () => {
  const course = (modules: unknown[]) => ({ id: 'c1', title: 'Docker', objective: 'Docker', source: 'ai', modules });

  it('keeps written and outline-only topics and removes modules left empty', () => {
    const result = normalizeCourse(course([
      { id: 'm1', title: 'One', topics: [topic(), topic({ id: 't2', loaded: false, lesson: { blocks: [] } })] },
      { id: 'm2', title: 'Two', topics: [topic({ lesson: { blocks: [] } })] },
    ]));
    expect(result.modules.map((m) => m.id)).toEqual(['m1']);
    expect(result.modules[0].topics.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('refuses a course with nothing usable', () => {
    expect(() => normalizeCourse(course([]))).toThrow(/no usable topics/);
    expect(() => normalizeCourse(null)).toThrow();
  });

  it('has no level and keeps what the learner expected', () => {
    const result = normalizeCourse({ ...course([{ id: 'm1', topics: [topic()] }]), level: 'advanced', expectations: 'one weekend' });
    expect('level' in result).toBe(false);
    expect(result.expectations).toBe('one weekend');
  });

  it('treats an unknown source as an AI course and keeps the documents key', () => {
    const result = normalizeCourse({ ...course([{ id: 'm1', topics: [topic()] }]), source: 'mystery', meta: { model: 'm', promptVersion: 'p', createdAt: 1, documentsKey: 'k' } });
    expect(result.source).toBe('ai');
    expect(result.meta?.documentsKey).toBe('k');
  });
});
