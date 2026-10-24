import { describe, expect, it } from 'vitest';
import { MAX_STEP, MIN_STEP, routeLayout } from './routeLayout';

describe('routeLayout', () => {
  it('stretches the route so the supernova sits near the right edge when there are few planets', () => {
    const r = routeLayout(1255, 4);
    expect(r.stepWidth).toBeGreaterThan(MIN_STEP);
    expect(r.totalWidth).toBe(1255);
    expect(r.endX).toBeCloseTo(1255 - 100, 5);
  });

  it('keeps the minimum spacing and scrolls when there are many planets', () => {
    const r = routeLayout(1255, 12);
    expect(r.stepWidth).toBe(MIN_STEP);
    expect(r.totalWidth).toBeGreaterThan(1255);
    expect(r.endX).toBeCloseTo(r.startX + 12 * MIN_STEP, 5);
  });

  it('caps the spacing and centres a very short route', () => {
    const r = routeLayout(1900, 2);
    expect(r.stepWidth).toBe(MAX_STEP);
    expect(r.startX).toBeGreaterThan(90);
    // As much room on the right of the supernova as on the left of the first planet (apart from their different margins).
    expect(r.totalWidth).toBe(1900);
  });

  it('grows with the window and never shrinks below the minimum', () => {
    const narrow = routeLayout(700, 5).stepWidth;
    const wide = routeLayout(1600, 5).stepWidth;
    expect(wide).toBeGreaterThan(narrow);
    expect(narrow).toBeGreaterThanOrEqual(MIN_STEP);
  });

  it('copes with an unmeasured container and no planets', () => {
    expect(routeLayout(0, 0).stepWidth).toBeGreaterThanOrEqual(MIN_STEP);
    expect(Number.isFinite(routeLayout(0, 0).endX)).toBe(true);
  });
});
