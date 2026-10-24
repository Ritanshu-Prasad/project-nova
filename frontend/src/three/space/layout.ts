import { CAMERA } from '../../core/scene';

/**
 * Composition of the new world (world === 'newworld'), in world units (≈ metres).
 *
 * The ship parks at the origin looking down -Z (it glides in from z = +ARRIVAL.backoff). Directions are
 * authored as points of a reference 16:10 desktop frame at CAMERA.fovWide, so the layout reads as
 * "where things sit on screen" for the parked, centred view.
 *
 * Post-processing (lens flare / god rays) should use SUN_DIR, or SUN_POSITION for the parked camera.
 * The sun is drawn at SUN_DISTANCE from the camera wherever it is, so it never shows parallax.
 */

export type Vec3 = readonly [number, number, number];

const REF_ASPECT = 16 / 10;

const normalize = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const scale = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Unit direction through a point of the reference frame (NDC, x right, y up) from the parked eye. */
export function screenDir(ndcX: number, ndcY: number): Vec3 {
  const ty = Math.tan((CAMERA.fovWide * Math.PI) / 360);
  return normalize([ndcX * ty * REF_ASPECT, ndcY * ty, -1]);
}

// ── Sun ─────────────────────────────────────────────────────────────────

/** Unit vector from the ship toward the sun (world space). Upper-left of the parked view. */
export const SUN_DIR: Vec3 = screenDir(-0.6, 0.6);
/** Distance at which the sun disc and glow are drawn (inside CAMERA.far). */
export const SUN_DISTANCE = 3200;
/** World-space position of the sun disc for the parked camera at the origin. */
export const SUN_POSITION: Vec3 = scale(SUN_DIR, SUN_DISTANCE);
/** Warm white sunlight (also the colour of the directional light). */
export const SUN_COLOR = '#fff0db';

// ── The new world: planet + rings ───────────────────────────────────────

const PLANET_DIR = screenDir(0.7, -0.8);
const PLANET_DISTANCE = 1500;
const PLANET_RADIUS = 610;

/**
 * Rotation axis = ring-plane normal. Built from the planet's on-screen "up", rolled around the line of
 * sight (tilts the ring ellipse) and opened toward / away from the camera (positive shows the north face).
 */
function ringAxis(rollDeg: number, openDeg: number): Vec3 {
  const v = PLANET_DIR;
  const upRaw: Vec3 = [0, 1, 0];
  const up = normalize(add(upRaw, scale(v, -dot(upRaw, v))));
  const right = normalize(cross(v, up));
  const roll = (rollDeg * Math.PI) / 180;
  const tilted = normalize(add(scale(up, Math.cos(roll)), scale(right, Math.sin(roll))));
  const open = (openDeg * Math.PI) / 180;
  return normalize(add(scale(tilted, Math.cos(open)), scale(v, -Math.sin(open))));
}

export const PLANET = {
  position: scale(PLANET_DIR, PLANET_DISTANCE) as Vec3,
  radius: PLANET_RADIUS,
  /** Spin axis (also the ring normal). */
  axis: ringAxis(-24, 13),
  /** Surface and cloud spin in rad/s. */
  spin: 0.0035,
  cloudSpin: 0.0062,
  /** Atmosphere scale height (world units) and halo shell radius. */
  atmosphereHeight: PLANET_RADIUS * 0.022,
  haloRadius: PLANET_RADIUS * 1.12,
} as const;

/** Ring system in the planet's equatorial plane (radii in world units from the planet centre). */
export const RINGS = {
  inner: PLANET_RADIUS * 1.28,
  outer: PLANET_RADIUS * 2.05,
} as const;

// ── Moons ───────────────────────────────────────────────────────────────

/** The four moon silhouettes (see moons.ts): a clean sphere, a lumpy rock, a stretched potato, a pocked world. */
export type MoonShape = 'round' | 'lumpy' | 'elongated' | 'cratered';

export interface MoonSpec {
  position: Vec3;
  radius: number;
  /** Surface tint (linear-ish sRGB hex) and noise seed. */
  tint: string;
  seed: number;
  shape?: MoonShape;
  /** Axis ratios (x, y, z) applied to `radius`, so moons are not all the same proportions. */
  squash?: Vec3;
  /** Slow spin, rad/s. */
  spin?: number;
  /** A moon that glows from within (molten) — 0..1. */
  glow?: number;
}

export const MOONS: readonly MoonSpec[] = [
  { position: scale(screenDir(-0.86, -0.22), 2300), radius: 58, tint: '#b8aebf', seed: 3.1 },
  { position: scale(screenDir(0.9, 0.62), 2900), radius: 26, tint: '#9fb6c4', seed: 7.7 },
];

// ── Sky landmarks ───────────────────────────────────────────────────────

/** Where the landing hero text sits (upper-centre): the sky is kept calm and dark around it. */
export const HERO_DIR: Vec3 = screenDir(0, 0.36);
/** Normal of the galactic band's great circle (new world). */
export const GALAXY_NORMAL: Vec3 = normalize(cross(screenDir(-0.95, -0.9), screenDir(-0.2, 1.4)));

// ── Asteroid field ("the Knowledge Belt") ───────────────────────────────

export const ASTEROIDS = {
  count: 280,
  /** Keep this cone around HERO_DIR (cos of half-angle) clear of near rocks. */
  heroClearCos: Math.cos((26 * Math.PI) / 180),
  /** Keep a corridor of this radius around the glide path (the Z axis) clear. */
  corridor: 34,
} as const;

/** Distant ring station silhouette. */
export const STATION = {
  position: scale(screenDir(-0.78, 0.18), 760) as Vec3,
  scale: 9,
} as const;
