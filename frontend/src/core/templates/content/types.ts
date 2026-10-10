import type { Lesson, Question } from '../../courseSchema';

/**
 * Authored content for one demo topic. Anything present replaces the template's version:
 * an in-depth `lesson` (+ one-line `summary`), the 8 lesson-quiz questions, and 12 practice questions
 * that only the hub quiz draws on.
 */
export interface TopicContent {
  summary?: string;
  lesson?: Lesson;
  quiz?: Question[];
  practice?: Question[];
}
