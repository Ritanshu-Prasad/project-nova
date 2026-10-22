import { describe, expect, it } from 'vitest';
import { seededRandom } from './seeded';

describe('seededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('gives different sequences for different seeds', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  it('stays within [0, 1) and is not constant', () => {
    const random = seededRandom(99);
    const values = Array.from({ length: 1000 }, random);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(990);
  });
});
