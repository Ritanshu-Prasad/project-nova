import { beforeAll, describe, expect, it } from 'vitest';
import type * as P from './planets';
import type * as S from '../three/space/planets';

let planets: typeof P;
let specs: typeof S;
const store: Record<string, string> = {};

beforeAll(async () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = String(v)), removeItem: (k: string) => void delete store[k] },
  });
  planets = await import('./planets');
  specs = await import('../three/space/planets');
});

describe('the planet tour', () => {
  it('has six named worlds', () => {
    expect(planets.PLANET_COUNT).toBe(6);
    expect(new Set(planets.PLANET_NAMES).size).toBe(6);
  });

  it('turns a saved value into a valid planet, or the first one', () => {
    expect(planets.parsePlanetIndex('3')).toBe(3);
    for (const bad of [null, '', 'x', '-1', '6', '2.5', 'NaN']) expect(planets.parsePlanetIndex(bad)).toBe(0);
  });

  it('visits the worlds in a fixed order, wraps after the last, and remembers where it is', () => {
    expect(planets.usePlanets.getState().index).toBe(0);
    const seen = Array.from({ length: 7 }, () => planets.nextPlanet());
    expect(seen).toEqual([1, 2, 3, 4, 5, 0, 1]);
    expect(store['nova.planet']).toBe('1');
    expect(planets.planetName()).toBe('Kryos');
  });
});

describe('the six planet looks', () => {
  it('matches the tour order and names', () => {
    expect(specs.PLANETS.map((p) => p.name)).toEqual([...planets.PLANET_NAMES]);
  });

  it('gives every world its own palette, size and sun', () => {
    const key = (f: (p: S.PlanetSpec) => string | number) => new Set(specs.PLANETS.map(f)).size;
    expect(key((p) => p.look.ground0 + p.look.ocean0)).toBe(6);
    expect(key((p) => p.look.atmo)).toBe(6);
    expect(key((p) => p.radius)).toBe(6);
    expect(key((p) => p.sunColor)).toBeGreaterThanOrEqual(5);
  });

  it('is varied: some with rings, some without; ice, lava and gas each once', () => {
    const rings = specs.PLANETS.filter((p) => p.ring).length;
    expect(rings).toBeGreaterThanOrEqual(3);
    expect(rings).toBeLessThanOrEqual(5);
    expect(specs.PLANETS.filter((p) => p.look.ice > 0.5)).toHaveLength(1);
    expect(specs.PLANETS.filter((p) => p.look.lava > 0.5)).toHaveLength(1);
    expect(specs.PLANETS.filter((p) => p.look.gas)).toHaveLength(1);
  });

  it('keeps each planet in the lower part of the view, clear of the landing text, and rings sane', () => {
    for (const p of specs.PLANETS) {
      expect(p.at[1], p.name).toBeLessThanOrEqual(-0.5);
      expect(Math.abs(p.at[0]), p.name).toBeLessThanOrEqual(0.8);
      expect(p.sunAt[1], p.name).toBeGreaterThan(0.3); // the sun is up in the sky
      if (p.ring) {
        expect(p.ring.inner, p.name).toBeGreaterThan(1);
        expect(p.ring.outer, p.name).toBeGreaterThan(p.ring.inner);
      }
      // The ship parks at the origin: the planet must not swallow it.
      expect(p.distance - p.radius, p.name).toBeGreaterThan(300);
    }
  });
});
