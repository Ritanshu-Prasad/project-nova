import { lerp } from '../../core/math';
import { BAY } from '../../core/scene';

/**
 * Launch-bay layout derived from the shared BAY constants.
 * World space, metres; the pilot's eye starts at the origin looking down -Z.
 */

export const FLOOR_Y = BAY.floorY;
export const CEIL_Y = BAY.ceilingY;
export const HALF_W = BAY.hangarHalfWidth;
export const BACK_Z = BAY.hangarBackZ;
export const DOOR_Z = BAY.doorZ;

/** Opening in the front wall that the blast doors close. `wallDepth` is the wall thickness (door pocket). */
export const OPENING = { halfWidth: 10.2, top: 6.0, wallDepth: 2.6 } as const;

/** Blast-door leaves, built in their closed position; each slides `travel` metres along ±X into the wall pocket. */
export const DOOR = {
  width: OPENING.halfWidth + 0.6,
  top: OPENING.top + 0.5,
  depth: 1.0,
  /** Z of the leaves' front faces (just behind the wall face). */
  front: DOOR_Z - 0.45,
  travel: OPENING.halfWidth + 0.05,
} as const;

/** Far edge of the hangar deck (threshold under the doors) and of the apron outside. */
export const THRESHOLD_Z = DOOR_Z - OPENING.wallDepth;
export const APRON_Z = THRESHOLD_Z - 3.4;

/** Flood-light banks: bank 0 above the ship, the last one nearest the doors. */
export const BANK_Z: readonly number[] = Array.from({ length: BAY.lightBanks }, (_, i) =>
  lerp(2, -20.5, BAY.lightBanks > 1 ? i / (BAY.lightBanks - 1) : 0),
);
export const FIXTURE_X: readonly number[] = [-10.5, -3.5, 3.5, 10.5];
/** Underside of the hanging flood fixtures. */
export const FIXTURE_Y = 7.6;

/** Structural ribs along both side walls. */
export const RIB_Z: readonly number[] = [12, 7, 2, -3, -8, -13, -18, -23];

/** Catwalk deck height along both side walls. */
export const CATWALK_Y = 3.5;

/** Rotating emergency beacons. The last one hangs from the ceiling and drives the real red spotlight. */
export interface BeaconSpec {
  pos: readonly [number, number, number];
  /** Rotation speed (rad/s, sign = direction) and phase. */
  speed: number;
  phase: number;
  /** Downward tilt of the beams (rad). */
  tilt: number;
  /** Dome orientation: 1 = mounted on top of a bracket, -1 = hanging from the ceiling. */
  up: 1 | -1;
}
export const BEACONS: readonly BeaconSpec[] = [
  { pos: [-11.25, 7.15, -25.35], speed: 2.5, phase: 0.4, tilt: 0.2, up: 1 },
  { pos: [11.25, 7.15, -25.35], speed: -2.5, phase: 2.2, tilt: 0.2, up: 1 },
  { pos: [-13.0, 5.35, -6.0], speed: 2.1, phase: 1.1, tilt: 0.16, up: 1 },
  { pos: [0, 8.05, -7.5], speed: 1.75, phase: 0.0, tilt: 0.84, up: -1 },
];
/** Index of the beacon that drives the real spotlight sweeping across the cockpit. */
export const SPOT_BEACON = 3;
/** Length of the visible beam cones. */
export const BEAM_LEN = 13;

/** Accelerator rail. Rings are centred slightly below the eye (the ship body sits below the pilot). */
export const RING_Y = -0.4;
export const RING_R = BAY.ringRadius;
export const RING_Z: readonly number[] = (() => {
  const zs: number[] = [];
  for (let z = BAY.railStartZ; z >= BAY.exitZ + BAY.ringSpacing * 0.5; z -= BAY.ringSpacing) zs.push(z);
  return zs;
})();
/** The exit gate: a larger ring at the end of the rail. */
export const EXIT_Z = BAY.exitZ;
export const TRACK_HALF_W = 3.0;
/** Chase lights: two lines along the track edges, from the cradle to the exit. */
export const CHASE_X = 2.75;
export const CHASE_SPACING = 2;
export const CHASE_START_Z = -6.5;
