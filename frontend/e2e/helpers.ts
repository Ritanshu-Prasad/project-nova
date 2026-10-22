import { readFileSync } from 'node:fs';
import { expect, type Page, type Route } from '@playwright/test';

const sample = (name: string) => JSON.parse(readFileSync(new URL(`../../backend/tests/fixtures/${name}.json`, import.meta.url), 'utf8'));

export const lazyCourse = sample('lazy_course');
export const topic = sample('topic');
export const moduleQuiz = sample('module_quiz');
export const placement = sample('placement');
/** A sentence of the sample lesson that shows once the lesson is written. */
export const lessonText: string = topic.lesson.blocks.find((block: { type: string }) => block.type === 'text').body.slice(0, 40);

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** The backend, replaced by the samples the backend tests check; anything else is "not found" so the app falls back. */
export async function mockBackend(page: Page, options: { topicFailures?: number; topicDelayMs?: number } = {}) {
  let topicFailures = options.topicFailures ?? 0;
  const calls = { topic: 0, moduleQuiz: 0 };

  await page.route('**/api/**', (route) => route.fulfill({ status: 404, body: '{}' }));
  await page.route('**/api/courses/generate/stream*', (route) => {
    const events = [
      { type: 'progress', stage: 'outline', detail: 'Planning your modules' },
      { type: 'course', course: lazyCourse },
    ];
    return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: events.map((e) => JSON.stringify(e)).join('\n') + '\n' });
  });
  await page.route('**/api/courses/topic*', async (route) => {
    calls.topic++;
    if (options.topicDelayMs) await new Promise((resolve) => setTimeout(resolve, options.topicDelayMs));
    if (topicFailures > 0) {
      topicFailures--;
      return json(route, { detail: 'busy' }, 503);
    }
    return json(route, topic);
  });
  await page.route('**/api/courses/module-quiz*', (route) => {
    calls.moduleQuiz++;
    return json(route, moduleQuiz);
  });
  await page.route('**/api/courses/placement/level*', (route) => json(route, { level: 'advanced' }));
  await page.route('**/api/courses/placement', (route) => json(route, placement));
  return calls;
}

/** Past the cinematic intro, straight to the lounge with the course forge open (the same jump the app's dev hooks offer). The 3D scene is skipped to keep the tests quick. */
export async function openForge(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__nova);
  await page.evaluate(() => {
    const nova = (window as any).__nova;
    nova.store.getState().setWebglFailed(true);
    nova.profile.getState().setCallsign('Tester');
    nova.director.debugJump('landed');
    nova.journey.enterLoungeNow();
    nova.store.getState().setLoggedIn(true);
    nova.store.getState().setCurriculumOpen(true);
  });
  await expect(page.getByText('What do you want to learn?')).toBeVisible();
}

export async function createCourse(page: Page, goal = 'Docker networking') {
  await page.locator('textarea').first().fill(goal);
  await page.getByRole('button', { name: /generate course/i }).click();
}

/** Opens the study screen on the course's current lesson. */
export async function openLesson(page: Page) {
  await page.evaluate(() => (window as any).__nova.hub.getState().go('lesson'));
}
