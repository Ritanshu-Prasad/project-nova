import type { GenerateResult } from './courseApi';
import type { Course, Module } from './courseSchema';

export const topicCount = (course: Course) => planCounts(course.modules).topics;

export const planCounts = (modules: Module[]) => ({ modules: modules.length, topics: modules.reduce((n, m) => n + m.topics.length, 0) });

/** An AI-written goal course is shown to the learner as a plan before it starts; one built from documents or on the device is not. */
export const needsReview = (result: GenerateResult): boolean => result.via === 'ai' && result.course.source === 'ai';

/** The modules without one; the last module cannot be removed, so a course is never empty. */
export function removeModule(modules: Module[], moduleId: string): Module[] {
  return modules.length > 1 ? modules.filter((m) => m.id !== moduleId) : modules;
}

/** The modules without one topic; a module keeps at least one topic, so remove the module itself to drop the last one. */
export function removeTopic(modules: Module[], moduleId: string, topicId: string): Module[] {
  return modules.map((m) => (m.id === moduleId && m.topics.length > 1 ? { ...m, topics: m.topics.filter((t) => t.id !== topicId) } : m));
}

/** Whether a topic can be removed on its own. */
export const canRemoveTopic = (module: Module) => module.topics.length > 1;

/** The course with a new list of modules. */
export const withModules = (course: Course, modules: Module[]): Course => ({ ...course, modules });

/** What was planned and whether anything was cut, in a sentence; empty when the backend did not say. */
export function plannedNote(course: Course): string {
  const planned = course.meta?.plannedModules;
  if (!planned) return '';
  const cut = planned > course.modules.length || (course.meta?.plannedTopics ?? 0) > topicCount(course);
  const plan = `NOVA planned ${planned} module${planned === 1 ? '' : 's'} and ${course.meta?.plannedTopics ?? '?'} topics from what you told it.`;
  return cut ? `${plan} It kept the first ${course.modules.length} module${course.modules.length === 1 ? '' : 's'} and ${topicCount(course)} topics to keep the course manageable.` : plan;
}
