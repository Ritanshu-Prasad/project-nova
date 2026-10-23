import { describe, expect, it } from 'vitest';
import type { GenerateResult } from './courseApi';
import { canRemoveTopic, needsReview, planCounts, plannedNote, removeModule, removeTopic, topicCount, withModules } from './courseTrim';
import type { Course, Module, Topic } from './courseSchema';

const topic = (id: string): Topic => ({ id, title: id, planet: id, kind: 'concept', summary: '', loaded: false, lesson: { minutes: 5, objectives: [], simple: '', blocks: [] }, quiz: [], practice: [] });
const module = (id: string, topics = 2): Module => ({ id, title: `Module ${id}`, topics: Array.from({ length: topics }, (_, n) => topic(`${id}-${n + 1}`)) });
const course = (modules: number, extra: Partial<Course> = {}): Course => ({ id: 'c', title: 'Money', subtitle: '', objective: 'Money', source: 'ai', modules: Array.from({ length: modules }, (_, n) => module(`m${n + 1}`)), ...extra });
const result = (c: Course, via: GenerateResult['via'] = 'ai'): GenerateResult => ({ course: c, via });

describe('removeModule', () => {
  it('removes the module and keeps the others in order', () => {
    expect(removeModule(course(3).modules, 'm2').map((m) => m.id)).toEqual(['m1', 'm3']);
  });

  it('never removes the last module', () => {
    expect(removeModule(course(1).modules, 'm1').map((m) => m.id)).toEqual(['m1']);
  });

  it('ignores an unknown module', () => {
    expect(removeModule(course(2).modules, 'zzz')).toHaveLength(2);
  });
});

describe('removeTopic', () => {
  it('removes one topic from one module only', () => {
    const modules = removeTopic(course(2).modules, 'm1', 'm1-1');
    expect(modules[0].topics.map((t) => t.id)).toEqual(['m1-2']);
    expect(modules[1].topics).toHaveLength(2);
  });

  it('keeps the last topic of a module, since the module itself is what to remove', () => {
    const one = [module('m1', 1), module('m2')];
    expect(removeTopic(one, 'm1', 'm1-1')).toEqual(one);
    expect(canRemoveTopic(one[0])).toBe(false);
    expect(canRemoveTopic(one[1])).toBe(true);
  });

  it('does not change the list it was given', () => {
    const modules = course(2).modules;
    removeTopic(modules, 'm1', 'm1-1');
    expect(modules[0].topics).toHaveLength(2);
  });
});

describe('plan helpers', () => {
  it('counts modules and topics', () => {
    expect(planCounts(course(3).modules)).toEqual({ modules: 3, topics: 6 });
    expect(topicCount(course(2))).toBe(4);
  });

  it('puts a new list of modules into a course and leaves the rest alone', () => {
    const original = course(3, { expectations: 'one weekend' });
    expect(withModules(original, original.modules.slice(1))).toMatchObject({ id: 'c', title: 'Money', expectations: 'one weekend', modules: [{ id: 'm2' }, { id: 'm3' }] });
  });
});

describe('needsReview', () => {
  it('shows the plan for every AI goal course', () => {
    expect(needsReview(result(course(1)))).toBe(true);
    expect(needsReview(result(course(5)))).toBe(true);
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
});
