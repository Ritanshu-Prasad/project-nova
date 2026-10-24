import { PLANET_NAMES } from '../../core/planets';
import { seededRandom } from '../../core/seeded';
import { screenDir, type MoonSpec, type Vec3 } from './layout';
import { Color } from 'three';
import { enrichMoons, hsl } from './moons';
import { DEFAULT_DESIGN, WORLD_DESIGN, type EnvSpec, type SkySpec, type WorldDesign } from './worlds';

/**
 * The twenty worlds of the tour (same order as PLANET_NAMES). Each is one set of numbers for the shared planet shader,
 * plus a ring, moons and a sun. Planets sit in the lower half of the parked view so the landing text above stays clear,
 * distributed across varied elevations and wide horizontal azimuths.
 */

export interface PlanetLook {
  /** Sea colours (shallow ↔ deep bands) and land colours (low ↔ high). For a gas giant: band colours, a dark band, a vortex colour. */
  ocean0: string;
  ocean1: string;
  ground0: string;
  ground1: string;
  cloud: string;
  /** Atmosphere rim and halo. */
  atmo: string;
  /** Size of the continents, and where the coastline sits (higher = less land). */
  landScale: number;
  sea: number;
  /** Latitude bands in the seas (or the storm bands of a gas giant). */
  bandFreq: number;
  cloudAmt: number;
  cloudScale: number;
  /** City lights on the night side (amount, colour). */
  lights: number;
  lightColor: string;
  /** Glowing lava veins and seas (amount, colour). */
  lava: number;
  lavaColor: string;
  /** Frozen crust with dark cracks. */
  ice: number;
  /** Gas giant: bands and a great vortex instead of land and sea. */
  gas: boolean;
  /** Dense swirling planetary mist/fog layer. */
  mist?: number;
  /** Mist tint and atmospheric scattering colour. */
  mistColor?: string;
  /** Surrounding orbital space biome: cosmic dust, mist clouds, embers, ice shards, toxic haze, or ocean spray. */
  spaceBiome?: 'mist' | 'ember' | 'ice' | 'toxic' | 'ocean' | 'dust';
  /** Primary tint of the surrounding space dust and clouds. */
  spaceDustColor?: string;
  /** Opacity of the orbital space dust particulate field. */
  spaceDustOpacity?: number;
  /** Structural procedural biome algorithm (0: Archipelago, 1: Caldera Magma, 2: Glacial Facets, 3: Gas Tempest, 4: Cratered Bedrock, 5: Cyclone Mist, 6: Canyon Mesa, 7: Cyber Spire, 8: Acid Basin, 9: Mantle Fracture). */
  structure?: number;
}

export interface RingSpec {
  /** Radii as multiples of the planet radius. */
  inner: number;
  outer: number;
  colorA: string;
  colorB: string;
  opacity: number;
}

export interface PlanetSpec {
  name: (typeof PLANET_NAMES)[number];
  /** Where the planet sits: a point of the reference frame (see screenDir), distance and radius in world units. */
  at: readonly [number, number];
  distance: number;
  radius: number;
  /** Ring tilt (roll around the line of sight, opening towards the camera) in degrees. */
  roll: number;
  open: number;
  /** Surface spin, rad/s. */
  spin: number;
  look: PlanetLook;
  ring: RingSpec | null;
  moons: readonly MoonSpec[];
  /** The sun: a point of the reference frame, and its colour. */
  sunAt: readonly [number, number];
  sunColor: string;
  /** Solar classification name (e.g. 'Blue-White Hypergiant', 'Warm Solar Class G', etc.). */
  stellarClass?: string;
  /** What floats around this world (see worlds.ts) and the colours of its sky. */
  env: EnvSpec;
  sky: SkySpec;
}

/** A world as hand-written here; `finishWorld` adds its environment, sky, sun colour and visible moons. */
type BaseSpec = Omit<PlanetSpec, 'env' | 'sky'>;

const starClass = (hue: number) =>
  hue < 20 || hue >= 340 ? 'Crimson Red Dwarf' : hue < 45 ? 'Amber Supergiant' : hue < 70 ? 'Golden Class G' : hue < 110 ? 'Lime Flare Star' : hue < 165 ? 'Emerald Coronal Pulsar' : hue < 200 ? 'Electric Teal Dwarf' : hue < 240 ? 'Blue-White Hypergiant' : hue < 290 ? 'Ultraviolet Binary' : 'Magenta Magnetar';

/** Gives a hand-written world its own surface structure, environment, sky, a distinct saturated sun and moons you can see. */
function finishWorld(base: BaseSpec, index: number, design: WorldDesign = WORLD_DESIGN[base.name] ?? DEFAULT_DESIGN): PlanetSpec {
  const [s, l] = design.sunLight ?? [0.92, 0.6];
  // Structures that glow (seams, vents, aurora, reef) need a visible glow colour even on a world that had none.
  const dim = (hex: string) => { const c = new Color(hex); return c.r + c.g + c.b < 0.2; };
  const look = { ...base.look, structure: design.structure };
  if (dim(look.lightColor)) look.lightColor = design.sky.band;
  if (dim(look.lavaColor)) look.lavaColor = design.env.solids?.glowColor ?? '#ff5a14';
  const world: PlanetSpec = {
    ...base,
    look,
    env: design.env,
    sky: design.sky,
    sunColor: hsl(design.sunHue, s, l),
    stellarClass: starClass(design.sunHue),
  };
  return { ...world, moons: enrichMoons(world, index) };
}

const moon = (at: readonly [number, number], distance: number, radius: number, tint: string, seed: number): MoonSpec => {
  const d = screenDir(at[0], at[1]);
  return { position: [d[0] * distance, d[1] * distance, d[2] * distance] as Vec3, radius, tint, seed };
};

const BASE_WORLDS: readonly BaseSpec[] = [
  {
    // 1. Aurelia — neural network ocean world: violet land, teal seas, glowing neural net on night side.
    name: 'Aurelia',
    at: [0.7, -0.78],
    distance: 1500,
    radius: 610,
    roll: -24,
    open: 13,
    spin: 0.0035,
    look: {
      ocean0: '#050e17', ocean1: '#0a2e3a', ground0: '#352047', ground1: '#8c6b4d', cloud: '#d9e0f2', atmo: '#5aa6ff',
      landScale: 3, sea: 0.02, bandFreq: 22, cloudAmt: 0.55, cloudScale: 5, lights: 1, lightColor: '#40e6ff', lava: 0, lavaColor: '#000000', ice: 0, gas: false,
      spaceBiome: 'ocean', spaceDustColor: '#38bdf8', spaceDustOpacity: 0.55, structure: 0,
    },
    ring: { inner: 1.28, outer: 2.05, colorA: '#bf9e8c', colorB: '#8cb3e6', opacity: 0.75 },
    moons: [moon([-0.86, -0.22], 2300, 58, '#38bdf8', 3.1), moon([0.9, 0.62], 2900, 26, '#c084fc', 7.7)],
    sunAt: [-0.6, 0.6],
    sunColor: '#fff0db',
    stellarClass: 'Warm Solar Class G',
  },
  {
    // 2. Kryos — glacial frost world: pale crust cut by dark cracks, thin cold atmosphere.
    name: 'Kryos',
    at: [-0.78, -0.62],
    distance: 1300,
    radius: 540,
    roll: 0,
    open: 0,
    spin: 0.0024,
    look: {
      ocean0: '#cfe6f5', ocean1: '#8fbfe0', ground0: '#dfeefa', ground1: '#ffffff', cloud: '#eaf6ff', atmo: '#7fd8ff',
      landScale: 2.4, sea: 0.0, bandFreq: 14, cloudAmt: 0.22, cloudScale: 4, lights: 0, lightColor: '#000000', lava: 0, lavaColor: '#000000', ice: 0.85, gas: false,
      spaceBiome: 'ice', spaceDustColor: '#bae6fd', spaceDustOpacity: 0.7, structure: 2,
    },
    ring: null,
    moons: [moon([0.78, 0.2], 1900, 150, '#bae6fd', 11.3), moon([-0.2, 0.7], 3000, 22, '#7dd3fc', 2.2)],
    sunAt: [0.62, 0.55],
    sunColor: '#e4f1ff',
    stellarClass: 'Blue-White Hypergiant',
  },
  {
    // 3. Ember — volcanic world: black basalt, rivers and lakes of glowing magma.
    name: 'Ember',
    at: [0.55, -0.58],
    distance: 1250,
    radius: 520,
    roll: 0,
    open: 0,
    spin: 0.0018,
    look: {
      ocean0: '#1a0d08', ocean1: '#2e140a', ground0: '#150d0d', ground1: '#3a2018', cloud: '#7a4a35', atmo: '#ff7a2e',
      landScale: 3.4, sea: 0.1, bandFreq: 30, cloudAmt: 0.28, cloudScale: 6, lights: 0, lightColor: '#000000', lava: 1, lavaColor: '#ff5a14', ice: 0, gas: false,
      spaceBiome: 'ember', spaceDustColor: '#ff5a14', spaceDustOpacity: 0.85, structure: 1,
    },
    ring: null,
    moons: [moon([-0.82, -0.1], 2200, 40, '#fbbf24', 5.5)],
    sunAt: [-0.7, 0.42],
    sunColor: '#ffc9a0',
    stellarClass: 'Amber Supergiant',
  },
  {
    // 4. Verdant — bioluminescent jungle world: emerald canopy, turquoise seas, small moons.
    name: 'Verdant',
    at: [-0.65, -0.68],
    distance: 1500,
    radius: 580,
    roll: 16,
    open: 9,
    spin: 0.003,
    look: {
      ocean0: '#04323a', ocean1: '#0c6d70', ground0: '#0e3a1c', ground1: '#6aa33a', cloud: '#f3f8ee', atmo: '#7aff9e',
      landScale: 2.6, sea: -0.02, bandFreq: 18, cloudAmt: 0.7, cloudScale: 4.2, lights: 0.5, lightColor: '#ffe27a', lava: 0, lavaColor: '#000000', ice: 0, gas: false,
      spaceBiome: 'dust', spaceDustColor: '#4ade80', spaceDustOpacity: 0.6, structure: 0,
    },
    ring: { inner: 1.45, outer: 1.75, colorA: '#cfe0b8', colorB: '#a9d3c0', opacity: 0.4 },
    moons: [moon([0.82, -0.3], 2100, 34, '#34d399', 8.8), moon([0.55, 0.62], 2700, 24, '#a7f3d0', 1.6), moon([-0.88, 0.5], 3100, 18, '#fbbf24', 6.3)],
    sunAt: [0.5, 0.65],
    sunColor: '#fff6d8',
    stellarClass: 'Emerald Coronal Pulsar',
  },
  {
    // 5. Dune — golden desert world: stepped canyons, ochre bands, dust storms, vast golden ring.
    name: 'Dune',
    at: [0.78, -0.52],
    distance: 1700,
    radius: 640,
    roll: 32,
    open: 17,
    spin: 0.0028,
    look: {
      ocean0: '#8a4a22', ocean1: '#c98a4a', ground0: '#7a3a1c', ground1: '#e0b070', cloud: '#e8c9a0', atmo: '#ffb45a',
      landScale: 2.2, sea: -0.5, bandFreq: 26, cloudAmt: 0.38, cloudScale: 3.4, lights: 0, lightColor: '#000000', lava: 0, lavaColor: '#000000', ice: 0, gas: false,
      spaceBiome: 'dust', spaceDustColor: '#f59e0b', spaceDustOpacity: 0.75, structure: 6,
    },
    ring: { inner: 1.35, outer: 2.2, colorA: '#e6c27a', colorB: '#c9955a', opacity: 0.8 },
    moons: [moon([-0.8, -0.3], 2400, 46, '#f59e0b', 4.4), moon([-0.3, 0.72], 3000, 20, '#fcd34d', 9.9)],
    sunAt: [-0.55, 0.55],
    sunColor: '#ffe0b0',
    stellarClass: 'Amber Supergiant',
  },
  {
    // 6. Tempest — violet gas giant: turbulent storm bands, colossal vortex, vast double rings.
    name: 'Tempest',
    at: [0.35, -0.72],
    distance: 1900,
    radius: 820,
    roll: -12,
    open: 11,
    spin: 0.0042,
    look: {
      ocean0: '#2a1550', ocean1: '#ff6fb5', ground0: '#5a2f8c', ground1: '#e9b4e8', cloud: '#ffffff', atmo: '#c28aff',
      landScale: 3, sea: 0, bandFreq: 20, cloudAmt: 0.08, cloudScale: 6, lights: 0, lightColor: '#000000', lava: 0, lavaColor: '#000000', ice: 0, gas: true,
      spaceBiome: 'mist', spaceDustColor: '#c084fc', spaceDustOpacity: 0.7, structure: 3,
    },
    ring: { inner: 1.3, outer: 1.8, colorA: '#e9c4f0', colorB: '#9a82d8', opacity: 0.7 },
    moons: [moon([-0.78, -0.05], 2700, 52, '#e879f9', 12.1), moon([0.86, 0.5], 3200, 30, '#c084fc', 3.9), moon([-0.3, 0.8], 3500, 16, '#38bdf8', 7.1)],
    sunAt: [-0.72, 0.7],
    sunColor: '#fff2f8',
    stellarClass: 'Ultraviolet Binary Star',
  },
  {
    // 7. Nebula Prime — dense planetary mist world bathed in violet auroras and cyclone spirals.
    name: 'Nebula Prime',
    at: [-0.38, -0.65],
    distance: 1550,
    radius: 620,
    roll: 18,
    open: 8,
    spin: 0.0029,
    look: {
      ocean0: '#120b2e', ocean1: '#2a1b54', ground0: '#1d1240', ground1: '#4a2d80', cloud: '#b794f4', atmo: '#c084fc',
      landScale: 3.2, sea: 0.1, bandFreq: 24, cloudAmt: 0.65, cloudScale: 5.2, lights: 0.8, lightColor: '#c084fc',
      lava: 0, lavaColor: '#000000', ice: 0, gas: false, mist: 0.85, mistColor: '#9353d3',
      spaceBiome: 'mist', spaceDustColor: '#a855f7', spaceDustOpacity: 0.9, structure: 5,
    },
    ring: null,
    moons: [moon([0.75, 0.35], 2400, 32, '#d8b4fe', 3.3)],
    sunAt: [0.45, 0.58],
    sunColor: '#eeddff',
    stellarClass: 'Ultraviolet Binary Star',
  },
  {
    // 8. Zephyr — cloud-shrouded ethereal mist giant with luminous emerald haze and double rings.
    name: 'Zephyr',
    at: [0.15, -0.6],
    distance: 1850,
    radius: 780,
    roll: -20,
    open: 14,
    spin: 0.0038,
    look: {
      ocean0: '#064e3b', ocean1: '#047857', ground0: '#0f766e', ground1: '#14b8a6', cloud: '#f0fdf4', atmo: '#34d399',
      landScale: 2.8, sea: 0, bandFreq: 16, cloudAmt: 0.45, cloudScale: 6.0, lights: 0, lightColor: '#000000',
      lava: 0, lavaColor: '#000000', ice: 0, gas: true, mist: 0.9, mistColor: '#6ee7b7',
      spaceBiome: 'mist', spaceDustColor: '#6ee7b7', spaceDustOpacity: 0.8, structure: 3,
    },
    ring: { inner: 1.32, outer: 2.15, colorA: '#a7f3d0', colorB: '#6ee7b7', opacity: 0.65 },
    moons: [moon([-0.72, 0.4], 2800, 42, '#6ee7b7', 6.2), moon([0.8, -0.2], 2600, 20, '#38bdf8', 1.8)],
    sunAt: [-0.65, 0.62],
    sunColor: '#dcfce7',
    stellarClass: 'Emerald Coronal Pulsar',
  },
  {
    // 9. Vespera — twilight oceanic abyss with deep sapphire waters and bioluminescent coastal colonies.
    name: 'Vespera',
    at: [-0.52, -0.74],
    distance: 1450,
    radius: 590,
    roll: 12,
    open: 6,
    spin: 0.0022,
    look: {
      ocean0: '#020617', ocean1: '#0f172a', ground0: '#1e293b', ground1: '#334155', cloud: '#94a3b8', atmo: '#2563eb',
      landScale: 3.8, sea: 0.25, bandFreq: 18, cloudAmt: 0.42, cloudScale: 4.5, lights: 1.0, lightColor: '#38bdf8',
      lava: 0, lavaColor: '#000000', ice: 0, gas: false, mist: 0, mistColor: '#38bdf8',
      spaceBiome: 'ocean', spaceDustColor: '#38bdf8', spaceDustOpacity: 0.6, structure: 0,
    },
    ring: null,
    moons: [moon([0.85, 0.15], 2200, 36, '#38bdf8', 4.1)],
    sunAt: [0.68, 0.48],
    sunColor: '#bae6fd',
    stellarClass: 'Electric Teal Dwarf',
  },
  {
    // 10. Obsidian — dark volcanic glass crust with glowing crimson rift fractures.
    name: 'Obsidian',
    at: [0.62, -0.64],
    distance: 1350,
    radius: 530,
    roll: 0,
    open: 0,
    spin: 0.0016,
    look: {
      ocean0: '#090508', ocean1: '#140c12', ground0: '#0a0a0c', ground1: '#1f1520', cloud: '#4a2835', atmo: '#e11d48',
      landScale: 3.5, sea: 0.15, bandFreq: 28, cloudAmt: 0.2, cloudScale: 5.5, lights: 0, lightColor: '#000000',
      lava: 0.95, lavaColor: '#e11d48', ice: 0, gas: false, mist: 0, mistColor: '#f43f5e',
      spaceBiome: 'ember', spaceDustColor: '#f43f5e', spaceDustOpacity: 0.85, structure: 1,
    },
    ring: null,
    moons: [moon([-0.85, 0.3], 2300, 48, '#f43f5e', 9.1)],
    sunAt: [-0.58, 0.52],
    sunColor: '#fecdd3',
    stellarClass: 'Deep Crimson Red Dwarf',
  },
  {
    // 11. Aquaria — endless turquoise oceans and swirling tropical super-hurricanes.
    name: 'Aquaria',
    at: [-0.22, -0.56],
    distance: 1600,
    radius: 630,
    roll: -15,
    open: 10,
    spin: 0.0033,
    look: {
      ocean0: '#083344', ocean1: '#0e7490', ground0: '#155e75', ground1: '#22d3ee', cloud: '#ecfeff', atmo: '#06b6d4',
      landScale: 4.5, sea: 0.42, bandFreq: 22, cloudAmt: 0.8, cloudScale: 4.8, lights: 0.4, lightColor: '#67e8f9',
      lava: 0, lavaColor: '#000000', ice: 0, gas: false, mist: 0.3, mistColor: '#a5f3fc',
      spaceBiome: 'ocean', spaceDustColor: '#22d3ee', spaceDustOpacity: 0.65, structure: 5,
    },
    ring: { inner: 1.4, outer: 1.9, colorA: '#67e8f9', colorB: '#06b6d4', opacity: 0.55 },
    moons: [moon([0.72, 0.5], 2500, 28, '#22d3ee', 5.7)],
    sunAt: [0.55, 0.68],
    sunColor: '#cffafe',
    stellarClass: 'Electric Teal Dwarf',
  },
  {
    // 12. Glacies — shattered crystalline ice shelves enveloped in sparkling diamond dust haze.
    name: 'Glacies',
    at: [0.42, -0.5],
    distance: 1400,
    radius: 560,
    roll: 22,
    open: 12,
    spin: 0.0021,
    look: {
      ocean0: '#e0f2fe', ocean1: '#bae6fd', ground0: '#f0f9ff', ground1: '#ffffff', cloud: '#ffffff', atmo: '#38bdf8',
      landScale: 2.5, sea: -0.1, bandFreq: 12, cloudAmt: 0.35, cloudScale: 3.8, lights: 0, lightColor: '#000000',
      lava: 0, lavaColor: '#000000', ice: 0.92, gas: false, mist: 0.55, mistColor: '#7dd3fc',
      spaceBiome: 'ice', spaceDustColor: '#e0f2fe', spaceDustOpacity: 0.8, structure: 2,
    },
    ring: { inner: 1.25, outer: 1.65, colorA: '#bae6fd', colorB: '#7dd3fc', opacity: 0.7 },
    moons: [moon([-0.78, 0.25], 2100, 50, '#f8fafc', 8.2), moon([0.88, 0.6], 2900, 22, '#67e8f9', 2.9)],
    sunAt: [-0.45, 0.64],
    sunColor: '#e0f2fe',
    stellarClass: 'Blue-White Hypergiant',
  },
  {
    // 13. Solaria — superheated copper canyon desert bathed in twin solar flares.
    name: 'Solaria',
    at: [-0.72, -0.54],
    distance: 1300,
    radius: 510,
    roll: 0,
    open: 0,
    spin: 0.0025,
    look: {
      ocean0: '#7c2d12', ocean1: '#9a3412', ground0: '#c2410c', ground1: '#ea580c', cloud: '#ffedd5', atmo: '#f97316',
      landScale: 2.1, sea: -0.4, bandFreq: 32, cloudAmt: 0.25, cloudScale: 3.2, lights: 0, lightColor: '#000000',
      lava: 0, lavaColor: '#000000', ice: 0, gas: false, mist: 0, mistColor: '#f97316',
      spaceBiome: 'dust', spaceDustColor: '#fb923c', spaceDustOpacity: 0.7, structure: 6,
    },
    ring: null,
    moons: [moon([0.65, 0.42], 2300, 38, '#fb923c', 7.4)],
    sunAt: [0.35, 0.72],
    sunColor: '#fed7aa',
    stellarClass: 'Amber Supergiant',
  },
  {
    // 14. Caelum — floating gas archipelago suspended in ethereal lilac haze.
    name: 'Caelum',
    at: [0.05, -0.68],
    distance: 1950,
    radius: 810,
    roll: 15,
    open: 9,
    spin: 0.004,
    look: {
      ocean0: '#3b0764', ocean1: '#581c87', ground0: '#6b21a8', ground1: '#a855f7', cloud: '#faf5ff', atmo: '#a78bfa',
      landScale: 3.0, sea: 0, bandFreq: 24, cloudAmt: 0.3, cloudScale: 5.0, lights: 0, lightColor: '#000000',
      lava: 0, lavaColor: '#000000', ice: 0, gas: true, mist: 0.7, mistColor: '#c084fc',
      spaceBiome: 'mist', spaceDustColor: '#d8b4fe', spaceDustOpacity: 0.75, structure: 3,
    },
    ring: { inner: 1.35, outer: 2.05, colorA: '#d8b4fe', colorB: '#c084fc', opacity: 0.6 },
    moons: [moon([-0.82, -0.15], 2700, 34, '#c084fc', 3.7), moon([0.76, 0.55], 3100, 26, '#f472b6', 9.4)],
    sunAt: [-0.62, 0.58],
    sunColor: '#f3e8ff',
    stellarClass: 'Ultraviolet Binary Star',
  },
  {
    // 15. Arcadia — cybernetic data grid spire world with ancient orbital ring shards.
    name: 'Arcadia',
    at: [-0.58, -0.58],
    distance: 1480,
    radius: 570,
    roll: -18,
    open: 11,
    spin: 0.0031,
    look: {
      ocean0: '#064e3b', ocean1: '#047857', ground0: '#14532d', ground1: '#16a34a', cloud: '#f7fee7', atmo: '#4ade80',
      landScale: 2.8, sea: 0.04, bandFreq: 20, cloudAmt: 0.62, cloudScale: 4.4, lights: 0.9, lightColor: '#22c55e',
      lava: 0, lavaColor: '#000000', ice: 0, gas: false, mist: 0.25, mistColor: '#86efac',
      spaceBiome: 'dust', spaceDustColor: '#22c55e', spaceDustOpacity: 0.6, structure: 7,
    },
    ring: { inner: 1.42, outer: 1.82, colorA: '#a3e635', colorB: '#4ade80', opacity: 0.45 },
    moons: [moon([0.82, -0.25], 2200, 30, '#4ade80', 6.6)],
    sunAt: [0.6, 0.62],
    sunColor: '#ecfccb',
    stellarClass: 'Emerald Coronal Pulsar',
  },
  {
    // 16. Toxis — emerald acid atmosphere & sulfur geyser plains.
    name: 'Toxis',
    at: [0.48, -0.76],
    distance: 1380,
    radius: 550,
    roll: 0,
    open: 0,
    spin: 0.002,
    look: {
      ocean0: '#14532d', ocean1: '#365314', ground0: '#3f6212', ground1: '#65a30d', cloud: '#ecfccb', atmo: '#84cc16',
      landScale: 3.1, sea: 0.08, bandFreq: 25, cloudAmt: 0.5, cloudScale: 5.4, lights: 0.3, lightColor: '#a3e635',
      lava: 0.5, lavaColor: '#eab308', ice: 0, gas: false, mist: 0.6, mistColor: '#84cc16',
      spaceBiome: 'toxic', spaceDustColor: '#a3e635', spaceDustOpacity: 0.8, structure: 8,
    },
    ring: null,
    moons: [moon([-0.75, 0.38], 2250, 44, '#a3e635', 4.8)],
    sunAt: [-0.5, 0.6],
    sunColor: '#fef08a',
    stellarClass: 'Deep Crimson Red Dwarf',
  },
  {
    // 17. Chronos — ancient cratered bedrock titan with dense asteroid ring belt and ejecta rays.
    name: 'Chronos',
    at: [-0.42, -0.52],
    distance: 1750,
    radius: 720,
    roll: 28,
    open: 16,
    spin: 0.0027,
    look: {
      ocean0: '#1c1917', ocean1: '#292524', ground0: '#44403c', ground1: '#78716c', cloud: '#e7e5e4', atmo: '#a8a29e',
      landScale: 2.3, sea: -0.3, bandFreq: 15, cloudAmt: 0.18, cloudScale: 3.5, lights: 0, lightColor: '#000000',
      lava: 0, lavaColor: '#000000', ice: 0, gas: false, mist: 0, mistColor: '#a8a29e',
      spaceBiome: 'dust', spaceDustColor: '#a8a29e', spaceDustOpacity: 0.7, structure: 4,
    },
    ring: { inner: 1.38, outer: 2.3, colorA: '#a8a29e', colorB: '#78716c', opacity: 0.85 },
    moons: [moon([0.7, 0.45], 2600, 52, '#f8fafc', 8.5), moon([-0.85, 0.2], 3100, 24, '#cbd5e1', 1.9)],
    sunAt: [0.48, 0.54],
    sunColor: '#f5f5f4',
    stellarClass: 'Radiant Pearl Star Class A',
  },
  {
    // 18. Aetheria — luminous gold/white cyber spires with radiant atmospheric corona.
    name: 'Aetheria',
    at: [0.25, -0.62],
    distance: 1650,
    radius: 670,
    roll: -10,
    open: 8,
    spin: 0.0034,
    look: {
      ocean0: '#713f12', ocean1: '#854d0e', ground0: '#a16207', ground1: '#ca8a04', cloud: '#fefce8', atmo: '#fde047',
      landScale: 3.3, sea: 0.05, bandFreq: 18, cloudAmt: 0.75, cloudScale: 4.6, lights: 0.6, lightColor: '#fef08a',
      lava: 0, lavaColor: '#000000', ice: 0, gas: false, mist: 0.95, mistColor: '#fef08a',
      spaceBiome: 'mist', spaceDustColor: '#fef08a', spaceDustOpacity: 0.95, structure: 7,
    },
    ring: { inner: 1.45, outer: 1.85, colorA: '#fef08a', colorB: '#fde047', opacity: 0.5 },
    moons: [moon([-0.7, 0.5], 2500, 32, '#fbbf24', 5.1)],
    sunAt: [-0.4, 0.7],
    sunColor: '#fef9c3',
    stellarClass: 'Warm Solar Class G',
  },
  {
    // 19. Ignis — primordial mantle rift world with boiling tectonic fracture oceans.
    name: 'Ignis',
    at: [-0.15, -0.7],
    distance: 1320,
    radius: 490,
    roll: 0,
    open: 0,
    spin: 0.0019,
    look: {
      ocean0: '#450a0a', ocean1: '#7f1d1d', ground0: '#1c1917', ground1: '#292524', cloud: '#991b1b', atmo: '#ef4444',
      landScale: 3.6, sea: 0.12, bandFreq: 30, cloudAmt: 0.35, cloudScale: 5.8, lights: 0, lightColor: '#000000',
      lava: 1.0, lavaColor: '#dc2626', ice: 0, gas: false, mist: 0, mistColor: '#ef4444',
      spaceBiome: 'ember', spaceDustColor: '#ef4444', spaceDustOpacity: 0.85, structure: 9,
    },
    ring: null,
    moons: [moon([0.8, -0.3], 2150, 42, '#ef4444', 7.8)],
    sunAt: [0.58, 0.44],
    sunColor: '#ffedd5',
    stellarClass: 'Deep Crimson Red Dwarf',
  },
  {
    // 20. Vortexia — shattered crust mantle rift world with colossal twin vortices and vast dust rings.
    name: 'Vortexia',
    at: [0.68, -0.6],
    distance: 1900,
    radius: 840,
    roll: -16,
    open: 13,
    spin: 0.0044,
    look: {
      ocean0: '#4c0519', ocean1: '#881337', ground0: '#9f1239', ground1: '#e11d48', cloud: '#fff1f2', atmo: '#f43f5e',
      landScale: 2.9, sea: 0, bandFreq: 26, cloudAmt: 0.15, cloudScale: 6.2, lights: 0, lightColor: '#000000',
      lava: 0, lavaColor: '#000000', ice: 0, gas: true, mist: 0.4, mistColor: '#f43f5e',
      spaceBiome: 'mist', spaceDustColor: '#fb7185', spaceDustOpacity: 0.8, structure: 9,
    },
    ring: { inner: 1.32, outer: 2.2, colorA: '#fb7185', colorB: '#e11d48', opacity: 0.75 },
    moons: [moon([-0.8, -0.1], 2900, 48, '#fb7185', 2.7), moon([0.85, 0.4], 3300, 36, '#f43f5e', 9.5), moon([-0.35, 0.75], 3600, 20, '#c084fc', 4.3)],
    sunAt: [-0.68, 0.66],
    sunColor: '#ffe4e6',
    stellarClass: 'Deep Crimson Red Dwarf',
  },
];

/** The twenty worlds of the tour, in order. */
export const PLANETS: readonly PlanetSpec[] = BASE_WORLDS.map((w, i) => finishWorld(w, i));

/** Procedural world generator that synthesizes a randomized world spec with diverse biomes. */
export function generateRandomWorld(seed = Math.floor(Math.random() * 10000)): PlanetSpec {
  const rng = seededRandom(seed);
  const biomes = ['mist', 'oceanic', 'ice', 'volcanic', 'flora', 'desert', 'gas'] as const;
  const biome = biomes[Math.floor(rng() * biomes.length)];
  const structure = Math.floor(rng() * 20);

  const atX = -0.75 + rng() * 1.5;
  const atY = -0.78 + rng() * 0.26;
  const distance = 1250 + Math.floor(rng() * 700);
  const radius = 500 + Math.floor(rng() * 320);

  const hasRing = rng() > 0.45;
  const numMoons = Math.floor(rng() * 3);
  const moons: MoonSpec[] = [];
  const brightTints = ['#38bdf8', '#fbbf24', '#c084fc', '#f8fafc', '#f472b6', '#34d399', '#fb7185', '#60a5fa', '#f59e0b', '#e879f9'];
  for (let i = 0; i < numMoons; i++) {
    const tint = brightTints[Math.floor(rng() * brightTints.length)];
    moons.push(moon([-0.85 + rng() * 1.7, -0.4 + rng() * 1.1], distance + 600 + i * 400, 18 + rng() * 35, tint, seed + i * 17));
  }

  const look: PlanetLook = {
    ocean0: '#061325',
    ocean1: '#0e3a53',
    ground0: '#2d1b36',
    ground1: '#6e4c3e',
    cloud: '#e2e8f0',
    atmo: '#38bdf8',
    landScale: 2.2 + rng() * 1.8,
    sea: -0.1 + rng() * 0.3,
    bandFreq: 14 + Math.floor(rng() * 16),
    cloudAmt: 0.2 + rng() * 0.6,
    cloudScale: 3.5 + rng() * 2.5,
    lights: rng() > 0.4 ? rng() : 0,
    lightColor: '#38bdf8',
    lava: 0,
    lavaColor: '#000000',
    ice: 0,
    gas: false,
    mist: 0,
    mistColor: '#38bdf8',
    structure,
  };

  if (biome === 'mist') {
    look.mist = 0.7 + rng() * 0.25;
    look.mistColor = '#c084fc';
    look.atmo = '#a855f7';
    look.cloudAmt = 0.65;
    look.spaceBiome = 'mist';
    look.spaceDustColor = '#c084fc';
    look.spaceDustOpacity = 0.85;
  } else if (biome === 'ice') {
    look.ice = 0.85 + rng() * 0.12;
    look.ocean0 = '#dbeafe';
    look.ocean1 = '#93c5fd';
    look.ground0 = '#eff6ff';
    look.ground1 = '#ffffff';
    look.atmo = '#60a5fa';
    look.spaceBiome = 'ice';
    look.spaceDustColor = '#bae6fd';
    look.spaceDustOpacity = 0.8;
  } else if (biome === 'volcanic') {
    look.lava = 0.9;
    look.lavaColor = '#ef4444';
    look.ocean0 = '#1c1917';
    look.ocean1 = '#292524';
    look.atmo = '#f97316';
    look.spaceBiome = 'ember';
    look.spaceDustColor = '#ef4444';
    look.spaceDustOpacity = 0.85;
  } else if (biome === 'gas') {
    look.gas = true;
    look.ocean0 = '#312e81';
    look.ocean1 = '#6366f1';
    look.ground0 = '#4338ca';
    look.ground1 = '#818cf8';
    look.atmo = '#818cf8';
    look.spaceBiome = 'mist';
    look.spaceDustColor = '#818cf8';
    look.spaceDustOpacity = 0.75;
  } else if (biome === 'flora') {
    look.ground0 = '#14532d';
    look.ground1 = '#22c55e';
    look.atmo = '#4ade80';
    look.cloudAmt = 0.6;
    look.spaceBiome = 'dust';
    look.spaceDustColor = '#4ade80';
    look.spaceDustOpacity = 0.6;
  } else if (biome === 'desert') {
    look.ground0 = '#78350f';
    look.ground1 = '#d97706';
    look.atmo = '#f59e0b';
    look.sea = -0.4;
    look.spaceBiome = 'dust';
    look.spaceDustColor = '#f59e0b';
    look.spaceDustOpacity = 0.7;
  } else {
    look.spaceBiome = 'ocean';
    look.spaceDustColor = '#38bdf8';
    look.spaceDustOpacity = 0.6;
  }

  const starClasses = [
    { name: 'Blue-White Hypergiant', color: '#93c5fd' },
    { name: 'Warm Solar Class G', color: '#fde047' },
    { name: 'Deep Crimson Red Dwarf', color: '#ef4444' },
    { name: 'Ultraviolet Binary', color: '#c084fc' },
    { name: 'Emerald Coronal Pulsar', color: '#34d399' },
    { name: 'Amber Supergiant', color: '#f97316' },
    { name: 'Electric Teal Dwarf', color: '#2dd4bf' },
  ];
  const star = starClasses[Math.floor(rng() * starClasses.length)];
  // A random world borrows the environment and sky of one of the hand-made ones, with a sun of its own.
  const donor = Object.values(WORLD_DESIGN)[Math.floor(rng() * Object.keys(WORLD_DESIGN).length)];
  const design: WorldDesign = { ...donor, structure, sunHue: Math.floor(rng() * 360) };

  const base: BaseSpec = {
    name: PLANET_NAMES[Math.floor(rng() * PLANET_NAMES.length)],
    at: [atX, atY],
    distance,
    radius,
    roll: (rng() - 0.5) * 60,
    open: rng() * 25,
    spin: 0.002 + rng() * 0.003,
    look,
    ring: hasRing ? { inner: 1.3, outer: 1.9, colorA: '#e2e8f0', colorB: '#94a3b8', opacity: 0.6 } : null,
    moons,
    sunAt: [-0.6 + rng() * 1.2, 0.45 + rng() * 0.3],
    sunColor: star.color,
    stellarClass: star.name,
  };
  return finishWorld(base, 100 + (seed % 900), design);
}
