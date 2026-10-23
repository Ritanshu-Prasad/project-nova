import { beforeAll, describe, expect, it } from 'vitest';
import type * as G from './graphics';

let g: typeof G;

// The modules read localStorage / location when they load; give them an empty browser-like environment.
beforeAll(async () => {
  const data: Record<string, string> = {};
  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = String(v)), removeItem: (k: string) => void delete data[k] },
    });
  }
  if (typeof globalThis.location === 'undefined') Object.defineProperty(globalThis, 'location', { value: { search: '' } });
  g = await import('./graphics');
});

const profile = (over: Partial<G.Profile> = {}): G.Profile => ({ webgl: true, renderer: 'NVIDIA GeForce RTX 3060', memoryGB: 8, cores: 12, coarsePointer: false, screenWidth: 1920, ...over });

describe('levelFromProfile', () => {
  it('gives a gaming PC the full scene', () => expect(g.levelFromProfile(profile())).toBe('high'));
  it('has no 3D without WebGL', () => expect(g.levelFromProfile(profile({ webgl: false, renderer: '' }))).toBe('none'));
  it('has no 3D on software rendering', () => {
    for (const renderer of ['Google SwiftShader', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'Microsoft Basic Render Driver', 'Mesa Offscreen']) expect(g.levelFromProfile(profile({ renderer }))).toBe('none');
  });
  it('caps integrated graphics at medium', () => expect(g.levelFromProfile(profile({ renderer: 'Intel(R) UHD Graphics 620' }))).toBe('medium'));
  it('puts old mobile GPUs on low', () => expect(g.levelFromProfile(profile({ renderer: 'Mali-T720', coarsePointer: true, screenWidth: 400 }))).toBe('low'));
  it('uses memory and cores', () => {
    expect(g.levelFromProfile(profile({ memoryGB: 2 }))).toBe('low');
    expect(g.levelFromProfile(profile({ memoryGB: 4 }))).toBe('medium');
    expect(g.levelFromProfile(profile({ cores: 2 }))).toBe('low');
    expect(g.levelFromProfile(profile({ cores: 4 }))).toBe('medium');
  });
  it('caps a phone-sized touch device at medium even with a good GPU', () => {
    expect(g.levelFromProfile(profile({ renderer: 'Apple GPU', coarsePointer: true, screenWidth: 390, memoryGB: undefined, cores: 6 }))).toBe('medium');
  });
  it('ignores specs the browser does not report', () => expect(g.levelFromProfile(profile({ memoryGB: undefined, cores: undefined }))).toBe('high'));
});

describe('levelFromFrameMs', () => {
  it('maps a timed test frame to a level', () => {
    expect(g.levelFromFrameMs(2)).toBe('high');
    expect(g.levelFromFrameMs(10)).toBe('medium');
    expect(g.levelFromFrameMs(30)).toBe('low');
    expect(g.levelFromFrameMs(120)).toBe('none');
  });
});

describe('choice and steps', () => {
  it('lets the pilot override the automatic level, and a ?gfx= override beat both', () => {
    expect(g.resolveLevel('auto', 'medium')).toBe('medium');
    expect(g.resolveLevel('high', 'low')).toBe('high');
    expect(g.resolveLevel('low', 'high', 'none')).toBe('none');
  });
  it('steps down one level and stops at the bottom', () => {
    expect([g.stepDown('high'), g.stepDown('medium'), g.stepDown('low'), g.stepDown('none')]).toEqual(['medium', 'low', 'none', 'none']);
  });
  it('has detail settings for every 3D level, getting lighter each step', () => {
    const { high, medium, low } = g.QUALITY;
    expect(high.fbm).toBeGreaterThan(medium.fbm);
    expect(medium.fbm).toBeGreaterThan(low.fbm);
    expect(high.particles).toBeGreaterThan(low.particles);
    expect(high.dpr[0]).toBeGreaterThan(low.dpr[0]);
  });
});

describe('cached detection', () => {
  const now = Date.UTC(2026, 9, 24);
  const entry = (over: object = {}) => JSON.stringify({ v: 2, level: 'low', until: now + 86_400_000, ...over });
  it('reuses a recent result', () => expect(g.parseCache(entry(), now)).toBe('low'));
  it('measures again when it is old, from another version, or damaged', () => {
    expect(g.parseCache(entry({ until: now - 1 }), now)).toBeNull();
    expect(g.parseCache(entry({ v: 1 }), now)).toBeNull();
    expect(g.parseCache(entry({ level: 'ultra' }), now)).toBeNull();
    expect(g.parseCache('not json', now)).toBeNull();
    expect(g.parseCache(null, now)).toBeNull();
  });
});
