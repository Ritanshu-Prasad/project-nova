import { Color, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three';
import { CAMERA } from '../../core/scene';
import { seededRandom } from '../../core/seeded';
import { screenDir, type MoonShape, type MoonSpec, type Vec3 } from './layout';
import type { PlanetSpec } from './planets';

/**
 * Moons you can actually see from the cockpit: a few different silhouettes, sizes and strongly coloured surfaces,
 * placed in the free parts of the window (never over the landing text, the planet or its rings).
 */

const TAN_HALF = Math.tan((CAMERA.fovWide * Math.PI) / 360);
const REF_ASPECT = 16 / 10;
const SHAPES: MoonShape[] = ['round', 'lumpy', 'elongated', 'cratered'];

/** Where the landing text sits in the reference frame (NDC), kept clear of moons. */
export const TEXT_ZONE = { x: [-0.62, 0.62], y: [-0.08, 0.78] } as const;

// ── Colour ──────────────────────────────────────────────────────────────

export function hsl(h: number, s: number, l: number): string {
  return `#${new Color().setHSL(((h % 360) + 360) % 360 / 360, s, l).getHexString()}`;
}

export function hueOf(hex: string): number {
  const c = new Color(hex);
  const out = { h: 0, s: 0, l: 0 };
  c.getHSL(out);
  return out.h * 360;
}

export function saturationOf(hex: string): number {
  const out = { h: 0, s: 0, l: 0 };
  new Color(hex).getHSL(out);
  return out.s;
}

// ── Placement and look ──────────────────────────────────────────────────

const angularRadius = (radius: number, distance: number) => Math.atan(radius / distance);

/** NDC point → direction, and the angle between two directions. */
const dirOf = (x: number, y: number): Vec3 => screenDir(x, y);
const angleBetween = (a: Vec3, b: Vec3) => Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

/** The size a moon has on screen as a fraction of the half-height of the window. */
export const moonScreenSize = (m: MoonSpec) => {
  const d = Math.hypot(...m.position);
  return (Math.max(...(m.squash ?? [1, 1, 1])) * m.radius) / d / TAN_HALF;
};

/** The NDC position of a moon in the reference frame. */
export function moonNdc(m: MoonSpec): [number, number] {
  const x = m.position[0] / -m.position[2];
  const y = m.position[1] / -m.position[2];
  return [x / (TAN_HALF * REF_ASPECT), y / TAN_HALF];
}

/**
 * Rebuilds a world's moons: same number, but visible — closer, bigger, a different silhouette each, a vivid colour from the
 * opposite side of the planet's palette, molten near lava worlds and frosted near ice worlds.
 */
export function enrichMoons(spec: PlanetSpec, index: number): MoonSpec[] {
  const rng = seededRandom(9100 + index * 31);
  const planetDir = screenDir(spec.at[0], spec.at[1]);
  // Rings are thin and a moon may pass in front of or behind them, so only the planet's own disc is kept clear.
  const planetAngle = angularRadius(spec.radius * 1.15, spec.distance);
  const sunDir = screenDir(spec.sunAt[0], spec.sunAt[1]);
  const biome = spec.look.spaceBiome;
  const baseHue = hueOf(spec.look.atmo);
  const count = Math.max(1, spec.moons.length);
  const side0 = spec.at[0] > 0.1 ? -1 : spec.at[0] < -0.1 ? 1 : rng() < 0.5 ? -1 : 1;
  const out: MoonSpec[] = [];
  const shapes = [...SHAPES].sort(() => rng() - 0.5);

  for (let k = 0; k < count; k++) {
    const shape = shapes[(k + index) % shapes.length];
    const size = 0.085 + rng() * 0.12; // fraction of the window's half-height: about 40-110 px on a 900 px screen
    let placed: MoonSpec | null = null;
    for (let tries = 0; tries < 160 && !placed; tries++) {
      // Prefer the side away from the planet; when that is crowded (a big sun, a ring) try the other, then relax a little.
      const relaxed = tries >= 80;
      const side = tries < 40 ? (k % 2 === 0 ? side0 : -side0) : rng() < 0.5 ? -1 : 1;
      const x = side * (0.55 + rng() * 0.32);
      const y = (relaxed ? 0.14 : 0.2) + rng() * (relaxed ? 0.6 : 0.48); // above the side read-outs, below the top bar
      if (x > TEXT_ZONE.x[0] && x < TEXT_ZONE.x[1] && y > TEXT_ZONE.y[0] && y < TEXT_ZONE.y[1]) continue;
      const distance = 1500 + rng() * 800;
      const squash: Vec3 = shape === 'elongated' ? [1, 0.55 + rng() * 0.15, 0.7 + rng() * 0.15] : shape === 'round' ? [1, 1, 1] : [1, 0.82 + rng() * 0.18, 0.86 + rng() * 0.14];
      const radius = (size * TAN_HALF * distance) / Math.max(...squash);
      const dir = dirOf(x, y);
      const ang = angularRadius(radius, distance);
      if (angleBetween(dir, planetDir) < planetAngle + ang + 0.05) continue;
      if (angleBetween(dir, sunDir) < ang + (relaxed ? 0.07 : 0.16)) continue;
      if (out.some((o) => angleBetween(dir, o.position.map((v) => v / Math.hypot(...o.position)) as unknown as Vec3) < ang + angularRadius(o.radius, Math.hypot(...o.position)) + 0.08)) continue;
      const hue = baseHue + 150 + rng() * 60 + k * 47;
      let tint = hsl(hue, 0.68 + rng() * 0.22, 0.52 + rng() * 0.1);
      let glow = 0;
      if (biome === 'ember' && k === 0) {
        tint = hsl(14 + rng() * 14, 0.9, 0.5);
        glow = 0.75;
      } else if (biome === 'ice' && k === 0) {
        tint = hsl(196 + rng() * 14, 0.7, 0.78);
      }
      placed = {
        position: [dir[0] * distance, dir[1] * distance, dir[2] * distance],
        radius,
        tint,
        seed: 3 + rng() * 40,
        shape,
        squash,
        spin: (0.01 + rng() * 0.05) * (rng() < 0.5 ? -1 : 1),
        glow,
      };
    }
    if (placed) out.push(placed);
  }
  return out;
}

// ── Geometry ────────────────────────────────────────────────────────────

/** Smooth value noise on the unit sphere (hash based, no allocation per call). */
export function noise3(x: number, y: number, z: number, seed: number): number {
  const hash = (i: number, j: number, k: number) => {
    const n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + seed * 19.19) * 43758.5453;
    return n - Math.floor(n);
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(
    lerp(lerp(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), lerp(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    lerp(lerp(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), lerp(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

/** A sphere pushed in and out into one of the silhouettes; vertex colours carry the dark pits and pale ridges. */
function buildMoon(shape: MoonShape, seed: number): SphereGeometry {
  const geo = new SphereGeometry(1, 64, 32);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rng = seededRandom(seed);
  const craters = Array.from({ length: shape === 'cratered' ? 16 : shape === 'round' ? 5 : 8 }, () => {
    const v = new Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
    return { v, r: 0.12 + rng() * (shape === 'cratered' ? 0.34 : 0.2), depth: 0.04 + rng() * 0.07 };
  });
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).normalize();
    let r = 1;
    const big = noise3(p.x * 1.7 + 5, p.y * 1.7, p.z * 1.7, seed);
    const fine = noise3(p.x * 5, p.y * 5, p.z * 5, seed + 3);
    if (shape === 'lumpy') r += (big - 0.5) * 0.4 + (fine - 0.5) * 0.08;
    else if (shape === 'elongated') r += (big - 0.5) * 0.3 + (fine - 0.5) * 0.06;
    else if (shape === 'cratered') r += (big - 0.5) * 0.12;
    else r += (fine - 0.5) * 0.03;
    const grain = noise3(p.x * 14, p.y * 14, p.z * 14, seed + 8);
    let shade = 0.62 + fine * 0.34 + big * 0.18 + (grain - 0.5) * 0.16;
    for (const c of craters) {
      const d = p.angleTo(c.v) / c.r;
      if (d < 1.25) {
        const bowl = Math.max(0, 1 - d * d);
        const rim = Math.exp(-Math.pow((d - 1) / 0.12, 2));
        r -= c.depth * bowl;
        r += c.depth * 0.35 * rim;
        shade *= 1 - 0.38 * bowl;
        shade *= 1 + 0.18 * rim;
      }
    }
    pos.setXYZ(i, p.x * r, p.y * r, p.z * r);
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = Math.min(1.15, shade);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

let cache: Record<MoonShape, SphereGeometry> | null = null;

/** The four shared moon geometries, built once (two thousand vertices each) and reused by every world. */
export function moonGeometries(): Record<MoonShape, SphereGeometry> {
  cache ??= { round: buildMoon('round', 11), lumpy: buildMoon('lumpy', 23), elongated: buildMoon('elongated', 37), cratered: buildMoon('cratered', 51) };
  return cache;
}

export function disposeMoonGeometries(): void {
  if (!cache) return;
  Object.values(cache).forEach((g) => g.dispose());
  cache = null;
}
