import { PLANET_NAMES } from '../../core/planets';
import { screenDir, type MoonSpec, type Vec3 } from './layout';

/**
 * The six worlds of the tour (same order as PLANET_NAMES). Each is one set of numbers for the shared planet shader,
 * plus a ring, moons and a sun. Planets sit in the lower half of the parked view so the landing text above stays clear.
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
}

const moon = (at: readonly [number, number], distance: number, radius: number, tint: string, seed: number): MoonSpec => {
  const d = screenDir(at[0], at[1]);
  return { position: [d[0] * distance, d[1] * distance, d[2] * distance] as Vec3, radius, tint, seed };
};

export const PLANETS: readonly PlanetSpec[] = [
  {
    // Aurelia — the original world: violet land, teal seas, a glowing neural network on the night side.
    name: 'Aurelia',
    at: [0.7, -0.8],
    distance: 1500,
    radius: 610,
    roll: -24,
    open: 13,
    spin: 0.0035,
    look: {
      ocean0: '#050e17', ocean1: '#0a2e3a', ground0: '#352047', ground1: '#8c6b4d', cloud: '#d9e0f2', atmo: '#5aa6ff',
      landScale: 3, sea: 0.02, bandFreq: 22, cloudAmt: 0.55, cloudScale: 5, lights: 1, lightColor: '#40e6ff', lava: 0, lavaColor: '#000000', ice: 0, gas: false,
    },
    ring: { inner: 1.28, outer: 2.05, colorA: '#bf9e8c', colorB: '#8cb3e6', opacity: 0.75 },
    moons: [moon([-0.86, -0.22], 2300, 58, '#b8aebf', 3.1), moon([0.9, 0.62], 2900, 26, '#9fb6c4', 7.7)],
    sunAt: [-0.6, 0.6],
    sunColor: '#fff0db',
  },
  {
    // Kryos — an ice world: pale crust cut by dark cracks, a thin cold atmosphere, one huge moon.
    name: 'Kryos',
    at: [-0.8, -0.6],
    distance: 1300,
    radius: 540,
    roll: 0,
    open: 0,
    spin: 0.0024,
    look: {
      ocean0: '#cfe6f5', ocean1: '#8fbfe0', ground0: '#dfeefa', ground1: '#ffffff', cloud: '#eaf6ff', atmo: '#7fd8ff',
      landScale: 2.4, sea: 0.0, bandFreq: 14, cloudAmt: 0.22, cloudScale: 4, lights: 0, lightColor: '#000000', lava: 0, lavaColor: '#000000', ice: 0.85, gas: false,
    },
    ring: null,
    moons: [moon([0.78, 0.2], 1900, 150, '#cfd8e4', 11.3), moon([-0.2, 0.7], 3000, 22, '#a9b9c9', 2.2)],
    sunAt: [0.62, 0.55],
    sunColor: '#e4f1ff',
  },
  {
    // Ember — a volcanic world: black basalt, rivers and seas of lava, an orange haze.
    name: 'Ember',
    at: [0.66, -0.56],
    distance: 1250,
    radius: 520,
    roll: 0,
    open: 0,
    spin: 0.0018,
    look: {
      ocean0: '#1a0d08', ocean1: '#2e140a', ground0: '#150d0d', ground1: '#3a2018', cloud: '#7a4a35', atmo: '#ff7a2e',
      landScale: 3.4, sea: 0.1, bandFreq: 30, cloudAmt: 0.28, cloudScale: 6, lights: 0, lightColor: '#000000', lava: 1, lavaColor: '#ff5a14', ice: 0, gas: false,
    },
    ring: null,
    moons: [moon([-0.82, -0.1], 2200, 40, '#6a4f48', 5.5)],
    sunAt: [-0.7, 0.42],
    sunColor: '#ffc9a0',
  },
  {
    // Verdant — a jungle world: deep greens, turquoise seas, thick clouds, three small moons and a faint ring.
    name: 'Verdant',
    at: [-0.72, -0.62],
    distance: 1500,
    radius: 580,
    roll: 16,
    open: 9,
    spin: 0.003,
    look: {
      ocean0: '#04323a', ocean1: '#0c6d70', ground0: '#0e3a1c', ground1: '#6aa33a', cloud: '#f3f8ee', atmo: '#7aff9e',
      landScale: 2.6, sea: -0.02, bandFreq: 18, cloudAmt: 0.7, cloudScale: 4.2, lights: 0.5, lightColor: '#ffe27a', lava: 0, lavaColor: '#000000', ice: 0, gas: false,
    },
    ring: { inner: 1.45, outer: 1.75, colorA: '#cfe0b8', colorB: '#a9d3c0', opacity: 0.4 },
    moons: [moon([0.82, -0.3], 2100, 34, '#c4d1b4', 8.8), moon([0.55, 0.62], 2700, 24, '#a9bfae', 1.6), moon([-0.88, 0.5], 3100, 18, '#b9b4a2', 6.3)],
    sunAt: [0.5, 0.65],
    sunColor: '#fff6d8',
  },
  {
    // Dune — a desert world: rust and ochre bands, dust storms, no seas, a wide golden ring.
    name: 'Dune',
    at: [0.74, -0.55],
    distance: 1700,
    radius: 640,
    roll: 32,
    open: 17,
    spin: 0.0028,
    look: {
      ocean0: '#8a4a22', ocean1: '#c98a4a', ground0: '#7a3a1c', ground1: '#e0b070', cloud: '#e8c9a0', atmo: '#ffb45a',
      landScale: 2.2, sea: -0.5, bandFreq: 26, cloudAmt: 0.38, cloudScale: 3.4, lights: 0, lightColor: '#000000', lava: 0, lavaColor: '#000000', ice: 0, gas: false,
    },
    ring: { inner: 1.35, outer: 2.2, colorA: '#e6c27a', colorB: '#c9955a', opacity: 0.8 },
    moons: [moon([-0.8, -0.3], 2400, 46, '#b09a80', 4.4), moon([-0.3, 0.72], 3000, 20, '#c0b4a0', 9.9)],
    sunAt: [-0.55, 0.55],
    sunColor: '#ffe0b0',
  },
  {
    // Tempest — a gas giant: storm bands, a great vortex, a violet-pink palette and a vast ring system.
    name: 'Tempest',
    at: [0.58, -0.7],
    distance: 1900,
    radius: 820,
    roll: -12,
    open: 11,
    spin: 0.0042,
    look: {
      ocean0: '#2a1550', ocean1: '#ff6fb5', ground0: '#5a2f8c', ground1: '#e9b4e8', cloud: '#ffffff', atmo: '#c28aff',
      landScale: 3, sea: 0, bandFreq: 20, cloudAmt: 0.08, cloudScale: 6, lights: 0, lightColor: '#000000', lava: 0, lavaColor: '#000000', ice: 0, gas: true,
    },
    ring: { inner: 1.3, outer: 1.8, colorA: '#e9c4f0', colorB: '#9a82d8', opacity: 0.7 },
    moons: [moon([-0.78, -0.05], 2700, 52, '#cdb6d6', 12.1), moon([0.86, 0.5], 3200, 30, '#b9a9d8', 3.9), moon([-0.3, 0.8], 3500, 16, '#d6c4d9', 7.1)],
    sunAt: [-0.72, 0.7],
    sunColor: '#fff2f8',
  },
];
