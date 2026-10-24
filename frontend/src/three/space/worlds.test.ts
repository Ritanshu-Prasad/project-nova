import { beforeAll, describe, expect, it } from 'vitest';
import type * as Planets from './planets';
import type * as Moons from './moons';
import type * as Worlds from './worlds';

let planets: typeof Planets;
let moons: typeof Moons;


// The modules read localStorage when they load; give them an empty browser-like environment.
beforeAll(async () => {
  const data: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = String(v)), removeItem: (k: string) => void delete data[k] },
  });
  planets = await import('./planets');
  moons = await import('./moons');

});

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

describe('every world has its own identity', () => {
  it('gives each of the twenty worlds its own surface structure', () => {
    const structures = planets.PLANETS.map((p) => p.look.structure);
    expect(new Set(structures).size).toBe(20);
    expect(Math.min(...(structures as number[]))).toBe(0);
    expect(Math.max(...(structures as number[]))).toBe(19);
  });

  it('has an environment with its own label for (almost) every world', () => {
    const labels = planets.PLANETS.map((p) => p.env.label);
    expect(new Set(labels).size).toBe(20);
    // (structure, environment) is never repeated.
    const pairs = planets.PLANETS.map((p) => `${p.look.structure}/${p.env.label}`);
    expect(new Set(pairs).size).toBe(20);
  });

  it('draws on all the kinds of floating things: hot rocks, frozen mist, nebulas, crystals, aurora, storms and more', () => {
    const has = (f: (e: Worlds.EnvSpec) => boolean) => planets.PLANETS.filter((p) => f(p.env)).length;
    expect(has((e) => e.solids?.kind === 'rocks' && e.solids.glow > 0.5)).toBeGreaterThanOrEqual(1); // hot rocks
    expect(has((e) => e.solids?.kind === 'shards')).toBeGreaterThanOrEqual(3);
    expect(has((e) => e.solids?.kind === 'slabs')).toBeGreaterThanOrEqual(1);
    expect(has((e) => !!e.ribbon)).toBeGreaterThanOrEqual(3); // auroras
    expect(has((e) => !!e.veil?.flash)).toBeGreaterThanOrEqual(1); // storm
    expect(has((e) => e.motes?.some((m) => m.shape === 'bubble') ?? false)).toBeGreaterThanOrEqual(3);
    expect(has((e) => e.motes?.some((m) => m.motion === 'fall') ?? false)).toBeGreaterThanOrEqual(2); // frozen mist and diamond dust
    expect(has((e) => (e.veil?.colors.length ?? 0) >= 3)).toBeGreaterThanOrEqual(4); // multi-colour clouds
    const motions = new Set(planets.PLANETS.flatMap((p) => p.env.motes?.map((m) => m.motion) ?? []));
    expect(motions.size).toBeGreaterThanOrEqual(6);
  });

  it('keeps every environment inside the GPU budget', () => {
    for (const p of planets.PLANETS) {
      const e = p.env;
      expect(e.veil?.count ?? 0, p.name).toBeLessThanOrEqual(60);
      expect(e.motes?.length ?? 0, p.name).toBeLessThanOrEqual(2);
      for (const m of e.motes ?? []) expect(m.count, p.name).toBeLessThanOrEqual(320);
      expect(e.solids?.count ?? 0, p.name).toBeLessThanOrEqual(160);
      expect(e.ribbon?.count ?? 0, p.name).toBeLessThanOrEqual(2);
      // Lightning is soft and rate-limited, never a strobe (see Surroundings): only the storm world has any.
      if (e.veil?.flash) expect(p.name).toBe('Tempest');
    }
  });

  it('gives each world a sky of its own', () => {
    const skies = planets.PLANETS.map((p) => p.sky.a + p.sky.b);
    expect(new Set(skies).size).toBe(20);
    const hueBuckets = new Set(planets.PLANETS.map((p) => Math.floor(moons.hueOf(p.sky.band) / 30)));
    expect(hueBuckets.size).toBeGreaterThanOrEqual(8);
  });
});

describe('suns keep their colour', () => {
  it('has twenty clearly different, saturated suns', () => {
    const hues = planets.PLANETS.map((p) => moons.hueOf(p.sunColor));
    for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) expect(hueGap(hues[i], hues[j]), `${planets.PLANETS[i].name} / ${planets.PLANETS[j].name}`).toBeGreaterThanOrEqual(9);
    for (const p of planets.PLANETS) expect(moons.saturationOf(p.sunColor), p.name).toBeGreaterThanOrEqual(0.6);
  });

  it('names the kind of star after its colour', () => {
    const classes = new Set(planets.PLANETS.map((p) => p.stellarClass));
    expect(classes.size).toBeGreaterThanOrEqual(8);
  });
});

describe('moons you can see', () => {
  it('keeps every world\'s moons big enough to read from the cockpit and not so big they crowd the window', () => {
    for (const p of planets.PLANETS) {
      expect(p.moons.length, p.name).toBeGreaterThanOrEqual(1);
      for (const m of p.moons) {
        const size = moons.moonScreenSize(m);
        expect(size, `${p.name} moon`).toBeGreaterThanOrEqual(0.07);
        expect(size, `${p.name} moon`).toBeLessThanOrEqual(0.24);
      }
    }
  });

  it('colours them vividly (frozen worlds get one pale, frosted moon)', () => {
    for (const p of planets.PLANETS) {
      const vivid = p.moons.filter((m) => moons.saturationOf(m.tint) >= 0.55);
      expect(vivid.length, p.name).toBeGreaterThanOrEqual(p.look.spaceBiome === 'ice' ? p.moons.length - 1 : p.moons.length);
    }
  });

  it('keeps them off the landing text, clear of the planet and away from the side read-outs', () => {
    for (const p of planets.PLANETS) {
      for (const m of p.moons) {
        const [x, y] = moons.moonNdc(m);
        const inText = x > moons.TEXT_ZONE.x[0] && x < moons.TEXT_ZONE.x[1] && y > moons.TEXT_ZONE.y[0] && y < moons.TEXT_ZONE.y[1];
        expect(inText, `${p.name} moon at ${x.toFixed(2)},${y.toFixed(2)}`).toBe(false);
        expect(y, p.name).toBeGreaterThanOrEqual(0.12);
      }
    }
  });

  it('varies shape, size and proportions across the tour and within a world', () => {
    const all = planets.PLANETS.flatMap((p) => p.moons);
    expect(new Set(all.map((m) => m.shape)).size).toBe(4);
    const sizes = all.map((m) => moons.moonScreenSize(m));
    expect(Math.max(...sizes) / Math.min(...sizes)).toBeGreaterThanOrEqual(1.7);
    expect(all.some((m) => (m.squash?.[1] ?? 1) < 0.7)).toBe(true); // stretched potatoes
    const multi = planets.PLANETS.filter((p) => p.moons.length >= 2);
    expect(multi.length).toBeGreaterThanOrEqual(5);
    for (const p of multi) expect(new Set(p.moons.map((m) => m.shape)).size, p.name).toBeGreaterThanOrEqual(2);
  });

  it('is stable: the same moons every time', () => {
    const again = moons.enrichMoons(planets.PLANETS[3], 3);
    expect(again.map((m) => [m.tint, m.shape, Math.round(m.radius)])).toEqual(planets.PLANETS[3].moons.map((m) => [m.tint, m.shape, Math.round(m.radius)]));
  });

  it('gives a lava world a molten moon', () => {
    const ember = planets.PLANETS.find((p) => p.name === 'Ember')!;
    expect(ember.moons.some((m) => (m.glow ?? 0) > 0.5)).toBe(true);
  });
});

describe('random worlds', () => {
  it('get a finished environment, sky, sun and visible moons too', () => {
    for (const seed of [1, 42, 777, 9001]) {
      const w = planets.generateRandomWorld(seed);
      expect(w.env.label).toBeTruthy();
      expect(w.sky.a).toMatch(/^#[0-9a-f]{6}$/i);
      expect(w.look.structure).toBeGreaterThanOrEqual(0);
      expect(w.look.structure).toBeLessThan(20);
      for (const m of w.moons) expect(moons.moonScreenSize(m)).toBeGreaterThan(0.06);
    }
  });
});
