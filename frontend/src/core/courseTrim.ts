import type { GenerateResult } from './courseApi';
import type { Course } from './courseSchema';

/** An AI course with at least this many modules is shown to the learner before it starts, so they can drop modules. */
export const REVIEW_FROM_MODULES = 3;

export const topicCount = (course: Course) => course.modules.reduce((n, m) => n + m.topics.length, 0);

/** Whether the learner should see the plan first: only an AI-written goal course of some size. */
export const needsReview = (result: GenerateResult): boolean => result.via === 'ai' && result.course.source === 'ai' && result.course.modules.length >= REVIEW_FROM_MODULES;

/** The course with only the chosen modules, in their order; at least the first module stays so a course is never empty. */
export function withModules(course: Course, keep: ReadonlySet<string>): Course {
  const chosen = course.modules.filter((m) => keep.has(m.id));
  return { ...course, modules: chosen.length ? chosen : course.modules.slice(0, 1) };
}

/** What was planned and whether anything was cut, in a sentence; empty when the backend did not say. */
export function plannedNote(course: Course): string {
  const planned = course.meta?.plannedModules;
  if (!planned) return '';
  const cut = planned > course.modules.length || (course.meta?.plannedTopics ?? 0) > topicCount(course);
  const plan = `NOVA planned ${planned} module${planned === 1 ? '' : 's'} and ${course.meta?.plannedTopics ?? '?'} topics from what you told it.`;
  return cut ? `${plan} It kept the first ${course.modules.length} module${course.modules.length === 1 ? '' : 's'} and ${topicCount(course)} topics to keep the course manageable.` : plan;
}
