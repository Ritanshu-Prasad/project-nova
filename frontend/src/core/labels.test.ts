import { describe, expect, it } from 'vitest';
import type { Course, Question } from './courseSchema';
import { isFillerLabel, stripStepLabel } from './labels';
import { tidyCourse } from './tidyCourse';

describe('stripStepLabel', () => {
  it('removes step and list numbering', () => {
    expect(stripStepLabel('Step 1: Find the verb')).toBe('Find the verb');
    expect(stripStepLabel('step 2 - Choose the verb form')).toBe('Choose the verb form');
    expect(stripStepLabel('3. Ask who is doing the verb')).toBe('Ask who is doing the verb');
    expect(stripStepLabel('(4) Decide singular or plural')).toBe('Decide singular or plural');
    expect(stripStepLabel('2) Mix the batter')).toBe('Mix the batter');
  });

  it('leaves ordinary text alone', () => {
    for (const s of ['Find the verb', '3 cups of flour', '1.5 litres of water', 'Arrive by 2:30 pm', 'Step back and look']) expect(stripStepLabel(s)).toBe(s);
  });
});

describe('isFillerLabel', () => {
  it('spots section labels that are not terms', () => {
    for (const s of ['Try it', 'try it yourself', 'Steps', 'Step 2', 'Your turn', 'Practice']) expect(isFillerLabel(s)).toBe(true);
    for (const s of ['Vector', 'Try it again later', 'Stepwise regression']) expect(isFillerLabel(s)).toBe(false);
  });
});

describe('tidyCourse question clean-up', () => {
  const order: Question = { type: 'order', q: 'Put these steps in order.', items: ['Step 1: Find the verb', 'Step 2: Ask who does it', '3. Choose the form'], why: 'Because.' };
  const match = (pairs: [string, string][]): Question => ({ type: 'match', q: 'Match each term.', pairs, why: 'Because.' });
  const course = (quiz: Question[]): Course => ({
    id: 'c',
    title: 'T',
    subtitle: '',
    objective: 'o',
    source: 'ai',
    modules: [{ id: 'm', title: 'M', topics: [{ id: 't', title: 'T', planet: 'Vega', kind: 'concept', summary: 's', lesson: { minutes: 2, objectives: [], simple: '', blocks: [{ type: 'text', body: 'Hello.' }] }, quiz }] }],
  });
  const quizOf = (c: Course) => tidyCourse(c).modules[0].topics[0].quiz;

  it('removes numbering from ordering options', () => {
    const [q] = quizOf(course([order]));
    expect(q.type === 'order' && q.items).toEqual(['Find the verb', 'Ask who does it', 'Choose the form']);
  });

  it('drops filler pairs from matching but keeps the question when enough pairs remain', () => {
    const [q] = quizOf(course([match([['Noun', 'a person, place or thing'], ['Verb', 'an action word'], ['Adjective', 'describes a noun'], ['Try it', 'practise now']])]));
    expect(q.type === 'match' && q.pairs.map((p) => p[0])).toEqual(['Noun', 'Verb', 'Adjective']);
  });

  it('drops a matching question that has too few real pairs left', () => {
    expect(quizOf(course([match([['Noun', 'a thing'], ['Try it', 'x'], ['Step 2', 'y']])]))).toEqual([]);
  });

  it('is idempotent', () => {
    const once = tidyCourse(course([order]));
    expect(tidyCourse(once)).toEqual(once);
  });
});
