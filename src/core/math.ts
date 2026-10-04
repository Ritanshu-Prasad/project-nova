/** Small, dependency-free math helpers shared by the director, the 3D scene and the DOM overlays. */

export const clamp = (v: number, min = 0, max = 1) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
export const remap = (v: number, a0: number, a1: number, b0: number, b1: number) =>
  lerp(b0, b1, invLerp(a0, a1, v));

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export const easeInCubic = (t: number) => t * t * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Frame-rate independent exponential smoothing toward `target`. `lambda` ≈ responsiveness (1/s). */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export type Keyframes = ReadonlyArray<readonly [time: number, value: number]>;

/** Samples piecewise keyframes with smoothstep easing between keys; clamps outside the range. */
export function kf(t: number, keys: Keyframes): number {
  if (keys.length === 0) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const u = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return lerp(v0, v1, u * u * (3 - 2 * u));
    }
  }
  return keys[keys.length - 1][1];
}

/** Cheap smooth pseudo-noise in roughly [-1, 1] (sum of incommensurate sines). */
export const wobble = (t: number, seed = 0) =>
  Math.sin(t * 1.7 + seed) * 0.5 +
  Math.sin(t * 3.1 + seed * 1.3) * 0.3 +
  Math.sin(t * 7.3 + seed * 2.1) * 0.2;
