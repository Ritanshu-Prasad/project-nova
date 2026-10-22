import { hasCourseApi } from './courseApi';

export type JourneyStep = 'course_started' | 'topic_finished' | 'module_quiz_finished' | 'course_finished';

const API = (import.meta.env.VITE_COURSE_API as string | undefined)?.replace(/\/$/, '') || '';

/** Counts a step of the learner's journey so the operator can see where learners stop. Only the step's name is sent; failing is fine. */
export function track(step: JourneyStep): void {
  if (!hasCourseApi) return;
  fetch(`${API}/api/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: step }), keepalive: true }).catch(() => undefined);
}
