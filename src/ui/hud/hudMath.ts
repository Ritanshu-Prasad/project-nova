import { clamp, smoothstep } from '../../core/math';
import { CAMERA } from '../../core/scene';

/** Pure helpers for the HUD (formatting, boot envelopes, projection). No DOM access here. */

export const LIGHT_SPEED_KMS = 299_792;
/** Above this the velocity readout switches from km/s to a fraction of c. */
const C_THRESHOLD_KMS = 100_000;
const NBSP = ' ';

/** Groups thousands with a no-break space: 12400 → "12 400". */
export function groupThousands(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += NBSP;
    out += s[i];
  }
  return n < 0 ? `-${out}` : out;
}

/** Velocity number for the HUD: "12 400" (km/s) or "0.98" (fraction of c above 100 000 km/s). */
export const velocityValue = (kms: number) =>
  kms >= C_THRESHOLD_KMS ? (kms / LIGHT_SPEED_KMS).toFixed(2) : groupThousands(Math.max(0, kms));

/** Unit matching `velocityValue`. */
export const velocityUnit = (kms: number) => (kms >= C_THRESHOLD_KMS ? 'c' : 'km/s');

/** Log-scaled 0..1 meter for velocities from 0 to c. */
export const velocityMeter = (kms: number) => clamp(Math.log10(1 + Math.max(0, kms)) / Math.log10(1 + LIGHT_SPEED_KMS));

/** Wraps degrees into [0, 360). */
export const wrapDeg = (d: number) => ((d % 360) + 360) % 360;

/** Zero-padded 3-digit heading, e.g. 7 → "007". */
export const pad3 = (d: number) => String(Math.round(wrapDeg(d)) % 360).padStart(3, '0');

const fract = (x: number) => x - Math.floor(x);
/** Deterministic pseudo-random in [0, 1). */
export const hash1 = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

/**
 * Boot envelope for one HUD segment: 0 before `t` reaches 0, a stuttering on/off flicker for `dur`
 * seconds, then 1. Reduced motion gets a plain fade.
 */
export function flickerIn(t: number, dur: number, seed: number, reduced: boolean): number {
  if (t <= 0) return 0;
  if (t >= dur) return 1;
  const ramp = t / dur;
  if (reduced) return ramp;
  const h = hash1(Math.floor(t * 32) + seed * 17.3);
  return h > 0.42 ? Math.min(1, 0.45 + ramp * 0.75) : ramp * 0.18;
}

/** Boot timeline (seconds after the HUD first appears): when each segment starts flickering in. */
export const BOOT = {
  scan: 0.85,
  brackets: 0.0,
  bracketsDraw: 0.7,
  center: 0.25,
  tape: 0.35,
  left: 0.5,
  right: 0.62,
  status: 0.8,
  flicker: 0.36,
  /** Boot log: typing starts, then fades out. */
  logStart: 0.15,
  logFadeStart: 2.9,
  logFadeEnd: 3.5,
  /** Everything settled. */
  done: 3.6,
} as const;

/**
 * Vertical field of view (degrees) of the pilot camera for a viewport: wide on landscape, widening
 * towards CAMERA.fovPortrait on tall screens (kept in step with the rig's camera).
 */
export function viewFov(w: number, h: number): number {
  const aspect = w / Math.max(1, h);
  return CAMERA.fovPortrait + (CAMERA.fovWide - CAMERA.fovPortrait) * smoothstep(0.62, 1.15, aspect);
}

/** Focal length in CSS px for a vertical FOV — multiply tan(angle) by it to project onto the screen. */
export const focalPx = (h: number, fovDeg: number) => h / 2 / Math.tan((Math.max(1, fovDeg) * Math.PI) / 360);
