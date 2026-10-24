import { useCourse } from './course';
import { fetchModuleQuiz, fetchTopic } from './courseApi';
import type { Topic } from './courseSchema';

/** How long the learner must stay on a topic before the next one is written in the background. */
const PREFETCH_DELAY_MS = 20_000;

const inFlight = new Map<string, Promise<void>>();
const quizRefreshed = new Set<string>();
const prefetched = new Set<string>();

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
    covers: topic.covers ?? '',
    excludes: topic.excludes ?? '',
    outline: topics.map((t) => t.title),
    outlineSummaries: topics.map((t) => t.summary),
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

/**
 * Once the learner has stayed on `topicId` for a while, writes the topic after it in the background.
 * Returns a function that cancels the wait, for when the learner leaves the topic first.
 */
export function prefetchNextTopic(courseId: string, topicId: string, delayMs = PREFETCH_DELAY_MS): () => void {
  const timer = setTimeout(() => prefetchAfter(courseId, topicId), delayMs);
  return () => clearTimeout(timer);
}

function prefetchAfter(courseId: string, topicId: string): void {
  const course = useCourse.getState().library[courseId]?.course;
  if (!course || course.source !== 'ai' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;

  const topics = course.modules.flatMap((m) => m.topics);
  const index = topics.findIndex((t) => t.id === topicId);
  const next = topics[index + 1];
  if (index < 0 || !next || next.loaded !== false) return;

  const key = `${courseId}/${next.id}`;
  if (prefetched.has(key)) return;
  prefetched.add(key);
  // A failure is silent: opening the topic writes it again.
  ensureTopic(courseId, next.id).catch(() => undefined);
}
