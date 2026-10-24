/**
 * Geometry of the course journey map: `n` planets and, after them, the supernova (waypoint `n`). The route stretches to
 * fill the window when there are few planets and keeps a minimum spacing, scrolling sideways, when there are many.
 */

/** Room to the left of the first planet and to the right of the supernova (its label and glow). */
const LEFT = 90;
const RIGHT = 100;
/** Closest and widest the planets sit from each other. */
export const MIN_STEP = 155;
export const MAX_STEP = 340;
/** Width assumed before the container has been measured. */
const FALLBACK_WIDTH = 780;

export interface RouteLayout {
  /** Distance between neighbouring waypoints. */
  stepWidth: number;
  /** x of the first planet. */
  startX: number;
  /** x of the supernova. */
  endX: number;
  /** Height of the wave, grows with the spacing so a wide route still undulates. */
  amplitude: number;
  /** Width of the whole map: at least the window, more when the route needs to scroll. */
  totalWidth: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function routeLayout(width: number, n: number): RouteLayout {
  const w = width > 0 ? width : FALLBACK_WIDTH;
  const stops = Math.max(1, n);
  const stepWidth = clamp((w - LEFT - RIGHT) / stops, MIN_STEP, MAX_STEP);
  const routeWidth = LEFT + stops * stepWidth + RIGHT;
  // A route that would be capped at the widest spacing is centred rather than left against the edge.
  const startX = LEFT + Math.max(0, (w - routeWidth) / 2);
  return {
    stepWidth,
    startX,
    endX: startX + stops * stepWidth,
    amplitude: clamp(stepWidth * 0.23, 36, 54),
    totalWidth: Math.max(w, routeWidth),
  };
}
