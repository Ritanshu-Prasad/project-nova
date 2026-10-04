/**
 * Staged reveal of the landing hero, driven by `rt.arrive` during the "arrive" phase.
 * Stage n (1-based) is visible once `rt.arrive >= REVEAL_AT[n - 1]`; in "landed" everything shows.
 */

/** rt.arrive thresholds: kicker, title, tagline, sub, CTAs, pillar chips (+ footer). */
export const REVEAL_AT = [0.2, 0.35, 0.5, 0.6, 0.75, 0.85] as const;

export const STAGE = {
  kicker: 1,
  title: 2,
  tagline: 3,
  sub: 4,
  ctas: 5,
  chips: 6,
} as const;

export const STAGE_MAX = REVEAL_AT.length;

/** Number of hero rows that should be visible. */
export function stageFor(arrive: number, landed: boolean): number {
  if (landed) return STAGE_MAX;
  let n = 0;
  while (n < STAGE_MAX && arrive >= REVEAL_AT[n]) n++;
  return n;
}

/** Visible stage plus the stage it jumped from (rows revealed in one jump cascade instead of popping together). */
export interface StageState {
  value: number;
  from: number;
}

/** Seconds between rows when several are revealed in the same frame (e.g. after "skip intro"). */
const CASCADE = 0.085;

/** Reveal delay for the row at `at`, given the latest stage jump. */
export function revealDelay(at: number, s: StageState): number {
  return s.value >= at && at > s.from ? (at - s.from - 1) * CASCADE : 0;
}

/** Cubic-bezier used by every hero reveal (fast out, long settle). */
export const EASE_OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
