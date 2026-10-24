import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Phase } from '../../core/store';
import { ARRIVAL_DISTANCE, DEPARTURE_TRAVEL, starShown, worldTravel } from './transition';

const PHASES: Phase[] = ['gate', 'wake', 'preflight', 'launch', 'warp', 'arrive', 'landed'];

describe('worldTravel', () => {
  it('is zero whenever the ship is not jumping', () => {
    for (const p of PHASES.filter((x) => x !== 'launch' && x !== 'arrive')) {
      for (const t of [0, 0.5, 2, 10]) expect(worldTravel(p, t, false)).toBe(0);
    }
  });

  it('streams towards and past the ship during the launch, never backwards', () => {
    let last = -1;
    for (let t = 0; t <= 1.75; t += 0.05) {
      const z = worldTravel('launch', t, false);
      expect(z).toBeGreaterThanOrEqual(last);
      last = z;
    }
    expect(worldTravel('launch', 0, false)).toBe(0);
    expect(worldTravel('launch', 1.75, false)).toBeGreaterThanOrEqual(6000);
    expect(worldTravel('launch', 1.75, false)).toBeCloseTo(DEPARTURE_TRAVEL, 5);
  });

  it('brings the new world from far ahead into its parking spot on arrival', () => {
    expect(worldTravel('arrive', 0, false)).toBeCloseTo(-ARRIVAL_DISTANCE, 5);
    let last = -Infinity;
    for (let t = 0; t <= 3.4; t += 0.1) {
      const z = worldTravel('arrive', t, false);
      expect(z).toBeGreaterThan(last - 1e-9);
      last = z;
    }
    expect(worldTravel('arrive', 3.4, false)).toBeCloseTo(0, 5);
    expect(worldTravel('arrive', 3.8, false)).toBeCloseTo(0, 5);
  });

  it('does not move the world with reduced motion', () => {
    expect(worldTravel('launch', 1.5, true)).toBe(0);
    expect(worldTravel('arrive', 0.5, true)).toBe(0);
  });
});

describe('starShown', () => {
  it('shows the dying sun only once the ship has arrived at it', () => {
    expect(PHASES.filter(starShown)).toEqual(['arrive', 'landed']);
  });
});

describe('a signed-in pilot who comes back', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  const store = (loggedIn: boolean) => ({ getItem: (k: string) => (k === 'nova.isLoggedIn' && loggedIn ? '1' : null), setItem: () => undefined, removeItem: () => undefined });

  it('starts in the lounge with the walk already done', async () => {
    vi.resetModules();
    vi.stubGlobal('localStorage', store(true));
    const { useDeck } = await import('../../core/journey');
    const { rt } = await import('../../core/runtime');
    expect(useDeck.getState().deck).toBe('lounge');
    expect([rt.stand, rt.turn, rt.door, rt.walk]).toEqual([1, 1, 1, 1]);
  });

  it('a new pilot still starts in the cockpit seat', async () => {
    vi.resetModules();
    vi.stubGlobal('localStorage', store(false));
    const { useDeck } = await import('../../core/journey');
    const { rt } = await import('../../core/runtime');
    expect(useDeck.getState().deck).toBe('cockpit');
    expect(rt.walk).toBe(0);
  });
});
