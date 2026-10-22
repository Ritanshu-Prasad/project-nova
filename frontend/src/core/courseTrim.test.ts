import { describe, expect, it } from 'vitest';
import type { GenerateResult } from './courseApi';
import { needsReview, plannedNote, topicCount, withModules } from './courseTrim';
import type { Course, Topic } from './courseSchema';

const topic = (id: string): Topic => ({ id, title: id, planet: id, kind: 'concept', summary: '', loaded: false, lesson: { minutes: 5, objectives: [], simple: '', blocks: [] }, quiz: [], practice: [] });
const module = (id: string, topics = 2) => ({ id, title: `Module ${id}`, topics: Array.from({ length: topics }, (_, n) => topic(`${id}-${n}`)) });
const course = (modules: number, extra: Partial<Course> = {}): Course => ({ id: 'c', title: 'Money', subtitle: '', objective: 'Money', source: 'ai', modules: Array.from({ length: modules }, (_, n) => module(`m${n + 1}`)), ...extra });
const result = (c: Course, via: GenerateResult['via'] = 'ai'): GenerateResult => ({ course: c, via });

describe('withModules', () => {
  it('keeps the chosen modules in their original order', () => {
    expect(withModules(course(4), new Set(['m3', 'm1'])).modules.map((m) => m.id)).toEqual(['m1', 'm3']);
  });

  it('never returns an empty course', () => {
    expect(withModules(course(3), new Set()).modules.map((m) => m.id)).toEqual(['m1']);
  });

  it('leaves everything else about the course alone', () => {
    const original = course(3, { expectations: 'one weekend' });
    expect(withModules(original, new Set(['m2']))).toMatchObject({ id: 'c', title: 'Money', expectations: 'one weekend' });
  });
});

describe('needsReview', () => {
  it('asks the learner about an AI course of three or more modules', () => {
    expect(needsReview(result(course(3)))).toBe(true);
    expect(needsReview(result(course(2)))).toBe(false);
  });

  it('does not interrupt a course built on the device or from documents', () => {
    expect(needsReview(result(course(5), 'local'))).toBe(false);
    expect(needsReview(result(course(5, { source: 'documents' })))).toBe(false);
  });
});

describe('plannedNote', () => {
  const meta = (plannedModules: number, plannedTopics: number) => ({ model: 'm', promptVersion: 'p', createdAt: 1, plannedModules, plannedTopics });

  it('says nothing when the backend did not say what it planned', () => {
    expect(plannedNote(course(3))).toBe('');
  });

  it('reports the plan when nothing was cut', () => {
    expect(plannedNote(course(3, { meta: meta(3, 6) }))).toBe('NOVA planned 3 modules and 6 topics from what you told it.');
  });

  it('says what was cut when the plan was bigger than what is shown', () => {
    expect(plannedNote(course(2, { meta: meta(8, 40) }))).toContain('kept the first 2 modules and 4 topics');
  });

  it('counts topics', () => {
    expect(topicCount(course(3))).toBe(6);
  });
});
