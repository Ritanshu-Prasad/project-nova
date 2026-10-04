/**
 * Seeded PRNG (mulberry32) for the sound design: random noise offsets and per-hit variations.
 * Seeding makes the offline analysis renders reproducible.
 */
let state = 0x2f6b9d1e;

/** Uniform random number in [0, 1). */
export function rand(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform random number in [a, b). */
export const randRange = (a: number, b: number) => a + (b - a) * rand();

/** Restarts the sequence (used before offline analysis renders). */
export function seedRandom(seed: number): void {
  state = seed | 0;
}

/** An independent generator, so buffer generation never disturbs the cue sequence. */
export function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
