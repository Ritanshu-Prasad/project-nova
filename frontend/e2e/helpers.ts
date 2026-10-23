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
/** The sample course with a third module, so the learner is shown the plan before it starts. */
export const planCourse = (() => {
  const third = JSON.parse(JSON.stringify(lazyCourse.modules[0]));
  third.id = 'mod-3';
  third.title = 'A third module';
  third.topics.forEach((t: { id: string }, n: number) => (t.id = `top-3-${n + 1}`));
  return { ...lazyCourse, modules: [...lazyCourse.modules, third], meta: { ...lazyCourse.meta, plannedModules: 3, plannedTopics: 6 } };
})();

export async function mockBackend(page: Page, options: { topicFailures?: number; topicDelayMs?: number; course?: unknown; revision?: { reply: string; modules: unknown[] } | null } = {}) {
  let topicFailures = options.topicFailures ?? 0;
  const calls = { topic: 0, moduleQuiz: 0, revise: [] as any[] };

  await page.route('**/api/**', (route) => route.fulfill({ status: 404, body: '{}' }));
  await page.route('**/api/courses/generate/stream*', (route) => {
    const events = [
      { type: 'progress', stage: 'outline', detail: 'Planning your modules' },
      { type: 'course', course: options.course ?? lazyCourse },
    ];
    return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: events.map((e) => JSON.stringify(e)).join('\n') + '\n' });
  });
  await page.route('**/api/courses/outline/revise', (route) => {
    calls.revise.push(route.request().postDataJSON());
    return options.revision ? json(route, options.revision) : json(route, { detail: 'busy' }, 503);
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
  await page.route('**/api/courses/placement/note*', (route) => json(route, { note: 'I am already experienced and want detailed, advanced coverage.' }));
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

/** Generates a course and accepts the plan as it is. */
export async function createCourse(page: Page, goal = 'Docker networking') {
  await generatePlan(page, goal);
  await page.getByRole('button', { name: /start course/i }).click();
}

/** Generates a course and stops at the plan screen. */
export async function generatePlan(page: Page, goal = 'Docker networking') {
  await page.locator('textarea').first().fill(goal);
  await page.getByRole('button', { name: /generate course/i }).click();
  await expect(page.getByRole('button', { name: /start course/i })).toBeVisible({ timeout: 30_000 });
}

/** Opens the study screen on the course's current lesson. */
export async function openLesson(page: Page) {
  await page.evaluate(() => (window as any).__nova.hub.getState().go('lesson'));
}
