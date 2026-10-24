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
  it('has twenty named worlds', () => {
    expect(planets.PLANET_COUNT).toBe(20);
    expect(new Set(planets.PLANET_NAMES).size).toBe(20);
  });

  it('turns a saved value into a valid planet, or the first one', () => {
    expect(planets.parsePlanetIndex('3')).toBe(3);
    expect(planets.parsePlanetIndex('19')).toBe(19);
    for (const bad of [null, '', 'x', '-1', '20', '2.5', 'NaN']) expect(planets.parsePlanetIndex(bad)).toBe(0);
  });

  it('visits the worlds in a fixed order, wraps after the last, and remembers where it is', () => {
    expect(planets.usePlanets.getState().index).toBe(0);
    const seen = Array.from({ length: 21 }, () => planets.nextPlanet());
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 0, 1]);
    expect(store['nova.planet']).toBe('1');
    expect(planets.planetName()).toBe('Kryos');
  });

  it('allows direct jumps to specific planets via setPlanet', () => {
    expect(planets.setPlanet(6)).toBe(6);
    expect(planets.usePlanets.getState().index).toBe(6);
    expect(planets.planetName()).toBe('Nebula Prime');
    expect(store['nova.planet']).toBe('6');

    // Negative and wrapping
    expect(planets.setPlanet(-1)).toBe(19);
    expect(planets.planetName()).toBe('Vortexia');
  });
});

describe('the twenty planet looks', () => {
  it('matches the tour order and names', () => {
    expect(specs.PLANETS.map((p) => p.name)).toEqual([...planets.PLANET_NAMES]);
  });

  it('configures distinct surrounding space biomes, colors, and opacities for every world', () => {
    for (const p of specs.PLANETS) {
      expect(p.look.spaceBiome).toBeDefined();
      expect(['mist', 'ember', 'ice', 'toxic', 'ocean', 'dust']).toContain(p.look.spaceBiome);
      expect(p.look.spaceDustColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.look.spaceDustOpacity).toBeGreaterThanOrEqual(0.4);
      expect(p.look.spaceDustOpacity).toBeLessThanOrEqual(1.0);
    }
  });

  it('gives every world its own palette, size and sun', () => {
    const key = (f: (p: S.PlanetSpec) => string | number) => new Set(specs.PLANETS.map(f)).size;
    expect(key((p) => p.look.ground0 + p.look.ocean0)).toBe(20);
    expect(key((p) => p.look.atmo)).toBe(20);
    expect(key((p) => p.radius)).toBe(20);
    expect(key((p) => p.sunColor)).toBeGreaterThanOrEqual(15);
  });

  it('is varied: some with rings, some without; ice, lava, mist and gas each present', () => {
    const rings = specs.PLANETS.filter((p) => p.ring).length;
    expect(rings).toBeGreaterThanOrEqual(8);
    expect(rings).toBeLessThanOrEqual(14);
    expect(specs.PLANETS.filter((p) => p.look.ice > 0.5).length).toBeGreaterThanOrEqual(2);
    expect(specs.PLANETS.filter((p) => p.look.lava > 0.5).length).toBeGreaterThanOrEqual(2);
    expect(specs.PLANETS.filter((p) => p.look.gas).length).toBeGreaterThanOrEqual(3);
    expect(specs.PLANETS.filter((p) => (p.look.mist ?? 0) > 0.4).length).toBeGreaterThanOrEqual(4);
  });

  it('keeps each planet in the lower part of the view, clear of the landing text, and rings sane', () => {
    const xs = specs.PLANETS.map((p) => p.at[0]);
    // Verifies planets are not clustered in just 2 positions:
    expect(xs.filter((x) => x < -0.3).length).toBeGreaterThanOrEqual(5);
    expect(xs.filter((x) => x >= -0.3 && x <= 0.3).length).toBeGreaterThanOrEqual(4);
    expect(xs.filter((x) => x > 0.3).length).toBeGreaterThanOrEqual(5);

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

  it('procedurally generates randomized worlds with diverse biomes and valid specs', () => {
    const randomWorld = specs.generateRandomWorld(42);
    expect(randomWorld).toBeDefined();
    expect(planets.PLANET_NAMES).toContain(randomWorld.name);
    expect(randomWorld.radius).toBeGreaterThan(400);
    expect(randomWorld.distance - randomWorld.radius).toBeGreaterThan(300);
    expect(randomWorld.at[1]).toBeLessThanOrEqual(-0.5);
    expect(randomWorld.look).toBeDefined();

    // Verify misty biomes specify valid mist and mistColor
    const mistWorlds = specs.PLANETS.filter((p) => (p.look.mist ?? 0) > 0);
    expect(mistWorlds.length).toBeGreaterThanOrEqual(4);
    for (const w of mistWorlds) {
      expect(w.look.mistColor).toBeDefined();
      expect(w.look.mistColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
