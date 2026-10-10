import type { Course, Topic } from '../../courseSchema';
import type { TopicContent } from './types';
import { ai1Content } from './ai_1';
import { ai2Content } from './ai_2';
import { ai3Content } from './ai_3';
import { react1Content } from './react_1';
import { react2Content } from './react_2';
import { react3Content } from './react_3';
import { bio1Content } from './bio_1';
import { bio2Content } from './bio_2';
import { bio3Content } from './bio_3';
import { la1Content } from './la_1';
import { la2Content } from './la_2';
import { eng1Content } from './eng_1';
import { eng2Content } from './eng_2';

/** Authored in-depth content for the demo courses — lesson, 8 lesson-quiz questions and 12 practice questions per topic, keyed by topic id. */
export const CONTENT: Record<string, TopicContent> = {
  ...ai1Content,
  ...ai2Content,
  ...ai3Content,
  ...react1Content,
  ...react2Content,
  ...react3Content,
  ...bio1Content,
  ...bio2Content,
  ...bio3Content,
  ...la1Content,
  ...la2Content,
  ...eng1Content,
  ...eng2Content,
};

/** A template topic with its authored content applied; the topic's side panels are kept. */
export function withContent(t: Topic): Topic {
  const c = CONTENT[t.id];
  if (!c) return t;
  return {
    ...t,
    summary: c.summary ?? t.summary,
    lesson: c.lesson ? { ...c.lesson, panels: t.lesson.panels } : t.lesson,
    quiz: c.quiz?.length ? c.quiz : t.quiz,
    practice: c.practice ?? t.practice,
  };
}

/** A demo course with every topic's authored content applied (other courses are returned unchanged). */
export function withAuthoredContent(course: Course): Course {
  if (course.source !== 'template') return course;
  return { ...course, modules: course.modules.map((m) => ({ ...m, topics: m.topics.map(withContent) })) };
}
