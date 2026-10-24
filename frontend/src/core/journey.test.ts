import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as J from './journey';

let j: typeof J;
let rt: typeof import('./runtime').rt;

beforeAll(async () => {
  const data: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = String(v)), removeItem: (k: string) => void delete data[k] },
  });
  j = await import('./journey');
  const r = await import('./runtime');
  rt = r.rt;
});

describe('the walk between the seat and the lounge', () => {
  it('starts seated and ends standing in the lounge with the door open', () => {
    expect(j.walkAt(0)).toEqual({ turn: 0, stand: 0, door: 0, walk: 0 });
    expect(j.walkAt(j.JOURNEY.total)).toEqual({ turn: 1, stand: 1, door: 1, walk: 1 });
  });

  it('only ever moves forward on the way there (so playing it backwards is a clean reverse)', () => {
    let prev = j.walkAt(0);
    for (let s = 0.05; s <= j.JOURNEY.total; s += 0.05) {
      const now = j.walkAt(s);
      for (const k of ['turn', 'stand', 'door', 'walk'] as const) expect(now[k], `${k} at ${s.toFixed(2)}`).toBeGreaterThanOrEqual(prev[k] - 1e-9);
      prev = now;
    }
  });

  it('plays back the same poses in reverse: the pilot reaches the seat in the order stand-up reverses', () => {
    // On the way back the walk through the corridor ends first, then the door closes, then the pilot turns and sits.
    const at = (s: number) => j.walkAt(s);
    expect(at(6.4).walk).toBe(1);
    expect(at(3.0).walk).toBe(0);
    expect(at(2.0).door).toBeGreaterThan(0.1);
    expect(at(1.3).door).toBe(0);
    expect(at(1.4).turn).toBe(1);
    expect(at(0.6).stand).toBeLessThan(1);
  });

  it('does nothing special when asked to go to the cockpit while already seated', () => {
    let called = 0;
    j.goToCockpit(() => called++);
    expect(called).toBe(1);
  });

  it('manages progressive deckLightDim between 1.0 in lounge and 0.25 in cockpit', () => {
    j.enterLoungeNow();
    expect(rt.deckLightDim).toBe(1.0);
    j.resetJourney();
    expect(rt.deckLightDim).toBe(0.25);
  });
});

describe('a walk that waits for the pilot to settle', () => {
  afterEach(() => {
    vi.useRealTimers();
    j.resetJourney();
  });

  it('is busy while the delayed walk is pending, and a reset cancels it', () => {
    vi.useFakeTimers();
    j.enterLoungeNow();
    let called = 0;
    j.goToCockpit(() => called++, 1300);
    expect(j.isBusy()).toBe(true);
    j.resetJourney();
    expect(j.isBusy()).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(called).toBe(0);
    expect(j.useDeck.getState().deck).toBe('cockpit');
  });

  it('is busy during the walk and idle once seated in the lounge or cockpit', () => {
    j.enterLoungeNow();
    expect(j.isBusy()).toBe(false);
    j.goToCockpit();
    expect(j.useDeck.getState().deck).toBe('transit');
    expect(j.isBusy()).toBe(true);
    j.resetJourney();
    expect(j.isBusy()).toBe(false);
  });
});
