import { Vector3 } from 'three';

/**
 * Cockpit layout in ship-local space (pilot's eye at the origin, forward -Z, up +Y, metres).
 * Everything is placed by view direction so the composition holds at the default head pose:
 * vertical FOV 68° at 16:10 → the console fills the bottom ~25 %, the canopy pillars hug the edges.
 */

export const DEG = Math.PI / 180;

/** Point at `dist` metres from the eye in the direction (yaw right, pitch up), degrees. */
export function polar(yawDeg: number, pitchDeg: number, dist: number, out = new Vector3()): Vector3 {
  const y = yawDeg * DEG;
  const p = pitchDeg * DEG;
  return out.set(Math.sin(y) * Math.cos(p) * dist, Math.sin(p) * dist, -Math.cos(y) * Math.cos(p) * dist);
}

/** Point at horizontal distance `d` from the eye's vertical axis, at `yawDeg`, height `y`. */
export function cyl(yawDeg: number, d: number, y: number, out = new Vector3()): Vector3 {
  const a = yawDeg * DEG;
  return out.set(Math.sin(a) * d, y, -Math.cos(a) * d);
}

// ── Dash (glare shield + instrument face), swept around the pilot ─────────────

/** Profile point: [inward distance from the outer edge, height, sharp crease]. */
export type DashPt = readonly [n: number, y: number, sharp?: 0 | 1];

export const DASH = {
  /** Horizontal radius of the outer (canopy-side) edge. */
  radius: 1.0,
  /** Half sweep angle in degrees. */
  halfYaw: 57,
  /** How much the profile is raised at the sides to cancel perspective sag (0 = none, 1 = full). */
  sideLift: 0.8,
  /** Profile from the outer top edge, over the glare-shield brow, down the instrument face, under the console. */
  profile: [
    [0.0, -0.318, 1],
    [0.05, -0.304],
    [0.098, -0.298],
    [0.116, -0.302],
    [0.127, -0.313],
    [0.131, -0.328],
    [0.127, -0.342],
    [0.117, -0.351, 1],
    [0.104, -0.357, 1],
    [0.1, -0.366, 1],
    [0.168, -0.473],
    [0.236, -0.58, 1],
    [0.252, -0.598],
    [0.256, -0.62],
    [0.246, -0.64, 1],
    [0.2, -0.69],
    [0.14, -0.77, 1],
  ] as readonly DashPt[],
  /** Profile indices bounding the sloped instrument face. */
  faceTop: 9,
  faceBottom: 11,
  /** Profile index of the brow's front face (light strip runs just below it). */
  browFront: 5,
} as const;

/** Height multiplier of the dash profile at a yaw (raised at the sides). */
export function dashLift(yawDeg: number): number {
  return 1 - DASH.sideLift * (1 - Math.cos(yawDeg * DEG));
}

// ── Instruments ───────────────────────────────────────────────────────────────

export const MFD = {
  /** Screen size in metres (canvas aspect 1.6). */
  w: 0.28,
  h: 0.175,
  /** Bezel size (buttons sit in the side margins). */
  bezelW: 0.345,
  bezelH: 0.208,
  bezelD: 0.022,
  /** Yaw of each screen (left, centre, right) and the position along the face (0 = top, 1 = bottom). */
  yaw: [-23.5, 0, 23.5] as const,
  faceT: 0.43,
  canvasW: 512,
  canvasH: 320,
} as const;

export const SWITCHES = {
  /** Yaw / horizontal distance / height of the switch pod's top centre. */
  yaw: -42.5,
  dist: 0.78,
  y: -0.272,
  /** Tilt of the pod top toward the pilot (degrees). */
  tilt: 24,
  spacing: 0.066,
} as const;

export const THROTTLE = {
  yaw: 43,
  dist: 0.74,
  /** Pivot height of the lever. */
  y: -0.37,
  length: 0.15,
  /** Lever angle (degrees, + = forward) at idle and at full charge. */
  idle: -16,
  full: 30,
} as const;

export const REACTOR = {
  pos: [0, -0.6, -0.62] as const,
  radius: 0.068,
  height: 0.2,
} as const;

// ── Canopy ────────────────────────────────────────────────────────────────────

/** Front arch (windscreen bow) control points, left half; mirrored for the right. */
export const ARCH_LEFT: readonly (readonly [number, number, number])[] = [
  [-0.7, -0.27, -0.735],
  [-0.748, 0.06, -0.705],
  [-0.69, 0.33, -0.64],
  [-0.43, 0.52, -0.585],
  [0, 0.588, -0.56],
];

export const NOSE = {
  start: -1.22,
  end: -4.3,
} as const;

export const COLORS = {
  cyan: '#22d3ee',
  cyanSoft: '#67e8f9',
  sys: '#3b82f6',
  sysGlow: '#60a5fa',
  violet: '#a855f7',
  amber: '#f59e0b',
  red: '#ef4444',
  redHot: '#ff2a2a',
  green: '#34d399',
} as const;
