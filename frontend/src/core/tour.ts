import { useCourse } from './course';
import { PLANET_COUNT, setPlanet, usePlanets } from './planets';

/**
 * Which world the ship is at follows the active course: planet n is where the pilot is after n jumps, and a jump is earned by
 * finishing a module (see travelsAvailable in course.ts). Switching course moves the ship to that course's planet; a course
 * with more modules than there are worlds simply starts the tour again.
 */
export const worldOfCourse = (travelled = 0) => ((travelled % PLANET_COUNT) + PLANET_COUNT) % PLANET_COUNT;

let last = '';
function follow(): void {
  const s = useCourse.getState();
  const e = s.activeId ? s.library[s.activeId] : undefined;
  if (!e) return;
  const key = `${e.course.id}:${e.travelled ?? 0}`;
  if (key === last) return; // only when the course or its jumps change, so a world picked in the Star Chart is left alone
  last = key;
  const want = worldOfCourse(e.travelled);
  if (usePlanets.getState().index !== want) setPlanet(want);
}

useCourse.subscribe(follow);
follow();

/** The worlds this course has reached so far (planet 1 … where the ship is now); the Star Chart and the planet code stay inside them. */
export function visitedWorlds(): number {
  const s = useCourse.getState();
  const e = s.activeId ? s.library[s.activeId] : undefined;
  return e ? Math.min((e.travelled ?? 0) + 1, PLANET_COUNT) : PLANET_COUNT;
}

/** The planet code: flips to the next world the pilot has already been to. Null when there is only one so far. */
export function cycleVisited(): number | null {
  const n = visitedWorlds();
  if (n < 2) return null;
  return setPlanet((usePlanets.getState().index + 1) % n);
}
