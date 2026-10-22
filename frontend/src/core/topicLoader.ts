import { useCourse } from './course';
import { fetchModuleQuiz, fetchTopic } from './courseApi';
import type { Topic } from './courseSchema';

const inFlight = new Map<string, Promise<void>>();
const quizRefreshed = new Set<string>();

const summaryPoints = (topic: Topic) => topic.lesson.blocks.flatMap((b) => (b.type === 'summary' ? b.points : []));

function findTopic(courseId: string, topicId: string) {
  const course = useCourse.getState().library[courseId]?.course;
  const module = course?.modules.find((m) => m.topics.some((t) => t.id === topicId));
  return { course, module, topic: module?.topics.find((t) => t.id === topicId) };
}

/** What the topic before this one covered, so the new lesson builds on it instead of repeating it. */
function previousCovered(topics: Topic[], index: number): string {
  const before = topics[index - 1];
  if (!before) return '';
  const points = summaryPoints(before);
  return (points.length ? points.join('; ') : before.summary).slice(0, 480);
}

/** Writes an outline-only topic the first time it is needed; does nothing for a topic that already has content. */
export function ensureTopic(courseId: string, topicId: string): Promise<void> {
  const { course, module, topic } = findTopic(courseId, topicId);
  if (!course || !module || !topic || topic.loaded !== false) return Promise.resolve();

  const key = `${courseId}/${topicId}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const topics = course.modules.flatMap((m) => m.topics);
  const request = fetchTopic({
    objective: course.objective,
    expectations: course.expectations ?? '',
    course: course.title,
    module: module.title,
    topic: topic.title,
    summary: topic.summary,
    outline: topics.map((t) => t.title),
    previous: previousCovered(topics, topics.indexOf(topic)),
  })
    .then((content) => {
      useCourse.getState().setTopicContent(courseId, topicId, content);
      refreshModuleQuiz(courseId, module.id);
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

/** Once every lesson of an AI module is written, its quiz is rewritten from what those lessons really taught. */
function refreshModuleQuiz(courseId: string, moduleId: string): void {
  const course = useCourse.getState().library[courseId]?.course;
  const module = course?.modules.find((m) => m.id === moduleId);
  const key = `${courseId}/${moduleId}`;
  if (!course || !module || course.source !== 'ai' || quizRefreshed.has(key)) return;
  if (module.topics.some((t) => t.loaded === false)) return;

  quizRefreshed.add(key);
  fetchModuleQuiz({
    objective: course.objective,
    module: module.title,
    topics: module.topics.map((t) => ({
      title: t.title,
      objectives: t.lesson.objectives,
      terms: t.lesson.blocks.flatMap((b) => (b.type === 'keyTerms' ? b.terms.map((x) => x.term) : [])),
      points: summaryPoints(t),
    })),
  })
    .then((quiz) => quiz.length && useCourse.getState().setModuleQuiz(courseId, moduleId, quiz))
    .catch(() => quizRefreshed.delete(key));
}

/** Starts writing the topic that follows `topicId`, so it is ready when the learner gets there. */
export function prefetchNextTopic(courseId: string, topicId: string): void {
  const topics = useCourse.getState().library[courseId]?.course.modules.flatMap((m) => m.topics) ?? [];
  const next = topics[topics.findIndex((t) => t.id === topicId) + 1];
  if (next) ensureTopic(courseId, next.id).catch(() => undefined);
}
