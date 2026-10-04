/**
 * Shared scene constants. Units are roughly metres.
 *
 * Ship-local space (cockpit, warp effects): the pilot's eye is at the origin, forward is -Z, up is +Y.
 * Both worlds put the ship on the Z axis looking down -Z, so the warp-time world swap is seamless.
 */

/** The launch hangar + accelerator rail (world === 'bay'). The ship starts at the world origin. */
export const BAY = {
  /** Deck height relative to the pilot's eye. */
  floorY: -3.2,
  /** Hangar interior half-width and ceiling height above the eye. */
  hangarHalfWidth: 14,
  ceilingY: 9,
  /** Back wall of the hangar (behind the pilot). */
  hangarBackZ: 14,
  /** Blast doors in front of the ship. */
  doorZ: -26,
  /** Accelerator rings run from railStartZ to exitZ every ringSpacing units. */
  railStartZ: -36,
  ringSpacing: 12,
  ringRadius: 7.5,
  /** End of the rail — the launch timeline reaches it at TIMING.tubeExit. */
  exitZ: -250,
  /** Flood-light banks that switch on one after another when main power returns. */
  lightBanks: 6,
} as const;

/** The new world (world === 'newworld'). The ship glides from z = +backoff and parks at the origin. */
export const ARRIVAL = {
  backoff: 190,
} as const;

/** Camera defaults. The base FOV widens on narrow / portrait screens so the cockpit still frames the view. */
export const CAMERA = {
  near: 0.03,
  far: 4000,
  fovWide: 68,
  fovPortrait: 88,
} as const;
