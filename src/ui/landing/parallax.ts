import { clamp } from '../../core/math';

/**
 * Head-look parallax for DOM projected on the canopy: the hero drifts a few px *against* the
 * look direction, like an image fixed to the glass while the pilot's head turns.
 *
 * `rt.yaw` / `rt.pitch` are the rig's head angles. Their sign convention is not part of the
 * contract, so it is inferred once the pilot clearly looks somewhere (`rt.lookX` is +right,
 * `rt.lookY` is +down by contract). Until then the three.js convention is assumed
 * (+yaw = look left, +pitch = look up).
 */

/** Screen px per radian of head rotation, and the maximum offset in px. */
const PX_PER_RAD_X = 30;
const PX_PER_RAD_Y = 26;
const MAX_X = 16;
const MAX_Y = 11;

export interface ParallaxProbe {
  /** Updates the convention estimate and writes the offset (px, CSS axes) into `out`. */
  sample(yaw: number, pitch: number, lookX: number, lookY: number, out: { x: number; y: number }): void;
}

export function createParallaxProbe(): ParallaxProbe {
  // Evidence that +yaw means "look right" (positive) or "look left" (negative); same for pitch/"look down".
  let yawRight = -3;
  let pitchDown = -3;
  return {
    sample(yaw, pitch, lookX, lookY, out) {
      if (Math.abs(lookX) > 0.3 && Math.abs(yaw) > 0.04) yawRight = clamp(yawRight + Math.sign(yaw) * Math.sign(lookX), -30, 30);
      if (Math.abs(lookY) > 0.3 && Math.abs(pitch) > 0.03) pitchDown = clamp(pitchDown + Math.sign(pitch) * Math.sign(lookY), -30, 30);
      // Angle toward screen-right / screen-down, then shift the image the other way.
      const right = yawRight > 0 ? yaw : -yaw;
      const down = pitchDown > 0 ? pitch : -pitch;
      out.x = clamp(-right * PX_PER_RAD_X, -MAX_X, MAX_X);
      out.y = clamp(-down * PX_PER_RAD_Y, -MAX_Y, MAX_Y);
    },
  };
}
