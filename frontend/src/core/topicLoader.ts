import { fetchTopic } from './courseApi';
import { useCourse } from './course';

const inFlight = new Map<string, Promise<void>>();

function findTopic(courseId: string, topicId: string) {
  const course = useCourse.getState().library[courseId]?.course;
  const module = course?.modules.find((m) => m.topics.some((t) => t.id === topicId));
  return { course, module, topic: module?.topics.find((t) => t.id === topicId) };
}

/** Writes an outline-only topic the first time it is needed; does nothing for a topic that already has content. */
export function ensureTopic(courseId: string, topicId: string): Promise<void> {
  const { course, module, topic } = findTopic(courseId, topicId);
  if (!course || !module || !topic || topic.loaded !== false) return Promise.resolve();

  const key = `${courseId}/${topicId}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = fetchTopic({
    level: course.level,
    objective: course.objective,
    course: course.title,
    module: module.title,
    topic: topic.title,
    summary: topic.summary,
  })
    .then((content) => useCourse.getState().setTopicContent(courseId, topicId, content))
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

/** Starts writing the topic that follows `topicId`, so it is ready when the learner gets there. */
export function prefetchNextTopic(courseId: string, topicId: string): void {
  const topics = useCourse.getState().library[courseId]?.course.modules.flatMap((m) => m.topics) ?? [];
  const next = topics[topics.findIndex((t) => t.id === topicId) + 1];
  if (next) ensureTopic(courseId, next.id).catch(() => undefined);
}
