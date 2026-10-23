import { describe, expect, it } from 'vitest';
import { levelOf, levelProgress, xpForLevel } from './course';

describe('exponential level mechanics', () => {
  it('starts at Level 1 for 0 or negative XP', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(-50)).toBe(1);
    expect(levelProgress(0)).toBe(0);
    expect(levelProgress(-50)).toBe(0);
    expect(xpForLevel(1)).toBe(0);
  });

  it('advances to Level 2 at 100 XP', () => {
    expect(levelOf(99)).toBe(1);
    expect(levelOf(100)).toBe(2);
    expect(levelProgress(100)).toBe(0);
    expect(levelProgress(50)).toBeCloseTo(0.5, 2);
  });

  it('scales exponentially so each subsequent level takes progressively more XP', () => {
    const l1Xp = xpForLevel(1); // 0
    const l2Xp = xpForLevel(2); // 100
    const l3Xp = xpForLevel(3); // 208
    const l4Xp = xpForLevel(4); // 325
    const l5Xp = xpForLevel(5); // 451
    const l10Xp = xpForLevel(10); // 1249
    const l20Xp = xpForLevel(20); // 4146
    const l30Xp = xpForLevel(30); // 10399

    const delta1to2 = l2Xp - l1Xp; // 100
    const delta2to3 = l3Xp - l2Xp; // 108
    const delta3to4 = l4Xp - l3Xp; // 117
    const delta4to5 = l5Xp - l4Xp; // 126
    const delta9to10 = l10Xp - xpForLevel(9); // ~185
    const delta19to20 = l20Xp - xpForLevel(19); // 400
    const delta29to30 = l30Xp - xpForLevel(29); // 864

    // Early levels are gentle ("not very much, but a bit")
    expect(delta2to3).toBeGreaterThan(delta1to2);
    expect(delta3to4).toBeGreaterThan(delta2to3);
    expect(delta4to5).toBeGreaterThan(delta3to4);

    // Later levels increase significantly
    expect(delta9to10).toBeGreaterThanOrEqual(180);
    expect(delta19to20).toBeGreaterThanOrEqual(400);
    expect(delta29to30).toBeGreaterThanOrEqual(800);
  });

  it('maintains the invariant: xpForLevel(level) <= xp < xpForLevel(level + 1)', () => {
    const testPoints = [0, 50, 99, 100, 150, 207, 208, 324, 325, 450, 451, 1248, 1249, 4145, 4146, 10398, 10399, 50000];
    for (const xp of testPoints) {
      const lvl = levelOf(xp);
      const minXp = xpForLevel(lvl);
      const nextXp = xpForLevel(lvl + 1);
      expect(xp).toBeGreaterThanOrEqual(minXp);
      expect(xp).toBeLessThan(nextXp);

      const prog = levelProgress(xp);
      expect(prog).toBeGreaterThanOrEqual(0);
      expect(prog).toBeLessThan(1);
    }
  });
});
