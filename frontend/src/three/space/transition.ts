import { clamp, easeOutCubic } from '../../core/math';
import type { Phase } from '../../core/store';

/**
 * How the world moves when the ship jumps: on departure everything rushes towards the ship and streams past it, on arrival
 * the new world starts far ahead and comes to meet the ship. The offset is along the line of sight (+z is towards the ship).
 */

/** How far (world units) the world has streamed past by the end of the launch. */
export const DEPARTURE_TRAVEL = 6500;
/** How far ahead of its parking spot the new world starts. */
export const ARRIVAL_DISTANCE = 2400;
/** Nearby things (rocks, dust) move faster than the planet: parallax. */
export const NEAR_FACTOR = 1.8;

const LAUNCH_SECONDS = 1.75;
const ARRIVE_SECONDS = 3.4;

/** The world's z offset (units) for this moment of the timeline; 0 whenever the ship is not jumping. */
export function worldTravel(phase: Phase, phaseTime: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  // The pull starts at once, faster than the launch widens the view (see SPACE_LAUNCH_KICK in director.ts): with a slow
  // start the planet first seemed to fall back from the window before it rushed past.
  if (phase === 'launch') return DEPARTURE_TRAVEL * Math.pow(clamp(phaseTime / LAUNCH_SECONDS), 1.4);
  if (phase === 'arrive') return -ARRIVAL_DISTANCE * (1 - easeOutCubic(clamp(phaseTime / ARRIVE_SECONDS)));
  return 0;
}

/** The dying sun of the finale is part of the arrival only: never in the scene before the ship has jumped to it. */
export function starShown(phase: Phase): boolean {
  return phase === 'arrive' || phase === 'landed';
}
