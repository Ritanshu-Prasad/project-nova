/**
 * The identity of each of the twenty worlds beyond its palette: which surface structure its planet has, what floats around
 * it (hot rocks, frozen mist, a coloured nebula...), the colours of its sky and the colour of its sun.
 *
 * Environments are recipes of at most four cheap, shared layers (see Environment.tsx): soft veils, small motes, solid
 * debris and an aurora ribbon. A recipe only picks colours, counts and motion, so every world looks different while the
 * GPU always draws the same few instanced meshes.
 */

export type Motion = 'drift' | 'rise' | 'fall' | 'swirl' | 'wind' | 'wander' | 'stream' | 'plume';
export type SpriteShape = 'cloud' | 'glint' | 'bubble' | 'dot';

/** Where a layer lives: around the planet (sizes and distances are multiples of its radius) or around the ship (world units). */
export type Zone = 'planet' | 'ship';

export interface VeilLayer {
  zone: Zone;
  count: number;
  colors: string[];
  /** Sprite size range. */
  size: [number, number];
  opacity: number;
  motion: Motion;
  speed: number;
  /** Soft, rate-limited lightning glow inside the clouds (never a strobe). */
  flash?: boolean;
}

export interface MoteLayer {
  zone: Zone;
  count: number;
  colors: string[];
  size: [number, number];
  opacity: number;
  motion: Motion;
  speed: number;
  shape: SpriteShape;
  /** Stretches the sprite along its direction of travel (streaks of sand, data lines). */
  stretch?: number;
}

export interface SolidLayer {
  kind: 'rocks' | 'shards' | 'slabs';
  count: number;
  colors: string[];
  size: [number, number];
  /** How much of each piece glows from within, and in which colour. */
  glow: number;
  glowColor: string;
  /** Spread into a belt around the planet's equator instead of a loose cloud. */
  belt?: boolean;
  spin: number;
}

export interface RibbonLayer {
  colors: [string, string];
  count: number;
  /** Height of the curtain as a fraction of the screen. */
  height: number;
  wave: number;
  opacity: number;
}

export interface EnvSpec {
  /** Short label, shown on the Star Chart. */
  label: string;
  veil?: VeilLayer;
  motes?: MoteLayer[];
  solids?: SolidLayer;
  ribbon?: RibbonLayer;
}

export interface SkySpec {
  /** Two nebula colours and the galactic band colour; `amount` is how strong the clouds are. */
  a: string;
  b: string;
  band: string;
  amount: number;
}

export interface WorldDesign {
  /** Planet surface structure (0-19, see the planet shader); every world has its own. */
  structure: number;
  env: EnvSpec;
  sky: SkySpec;
  /** Hue (degrees) of the sun; saturation and lightness come from `sunLight`. */
  sunHue: number;
  sunLight?: [number, number];
}

export const WORLD_DESIGN: Record<string, WorldDesign> = {
  Aurelia: {
    structure: 0,
    env: {
      label: 'Ring glitter',
      motes: [{ zone: 'planet', count: 240, colors: ['#bff6ff', '#e0d4ff', '#ffffff'], size: [0.007, 0.018], opacity: 0.95, motion: 'swirl', speed: 0.03, shape: 'glint' }],
      veil: { zone: 'ship', count: 14, colors: ['#2a6a8a', '#5a3a9a'], size: [180, 360], opacity: 0.18, motion: 'drift', speed: 0.4 },
    },
    sky: { a: '#2a1a5c', b: '#0c4a5e', band: '#8f7fd6', amount: 0.6 },
    sunHue: 36,
  },
  Kryos: {
    structure: 2,
    env: {
      label: 'Frozen mist',
      veil: { zone: 'planet', count: 26, colors: ['#d8f0ff', '#9fd4ff', '#ffffff'], size: [0.55, 1.15], opacity: 0.2, motion: 'drift', speed: 0.5 },
      motes: [{ zone: 'planet', count: 170, colors: ['#ffffff', '#bfe6ff'], size: [0.008, 0.02], opacity: 0.95, motion: 'fall', speed: 0.5, shape: 'glint' }],
      ribbon: { colors: ['#9fe8ff', '#c8b8ff'], count: 2, height: 0.7, wave: 0.8, opacity: 0.4 },
    },
    sky: { a: '#0b2a55', b: '#1e5fa8', band: '#a8d8ff', amount: 0.55 },
    sunHue: 206,
  },
  Ember: {
    structure: 1,
    env: {
      label: 'Hot rocks',
      solids: { kind: 'rocks', count: 80, colors: ['#2a1612', '#3a1c14', '#1c0f0c'], size: [0.025, 0.075], glow: 0.9, glowColor: '#ff5a14', spin: 0.25 },
      motes: [{ zone: 'planet', count: 170, colors: ['#ff7a20', '#ffc060', '#ff4a10'], size: [0.006, 0.015], opacity: 1, motion: 'rise', speed: 0.5, shape: 'dot' }],
      veil: { zone: 'ship', count: 10, colors: ['#7a1a08', '#a03408'], size: [200, 380], opacity: 0.16, motion: 'drift', speed: 0.5 },
    },
    sky: { a: '#4a0e0a', b: '#7a2a05', band: '#ff8a4a', amount: 0.5 },
    sunHue: 0,
  },
  Verdant: {
    structure: 12,
    env: {
      label: 'Spore drift',
      motes: [{ zone: 'planet', count: 220, colors: ['#c8ff6a', '#7affc0', '#fff29a'], size: [0.007, 0.018], opacity: 0.95, motion: 'wander', speed: 0.5, shape: 'dot' }],
      veil: { zone: 'ship', count: 14, colors: ['#1a6a3a', '#4a8a1a'], size: [180, 340], opacity: 0.16, motion: 'drift', speed: 0.4 },
    },
    sky: { a: '#0b3d2a', b: '#2a5a12', band: '#9aff8a', amount: 0.5 },
    sunHue: 78,
  },
  Dune: {
    structure: 16,
    env: {
      label: 'Sand wind',
      motes: [{ zone: 'planet', count: 150, colors: ['#ffd9a0', '#f5a020', '#fff0d0'], size: [0.006, 0.012], opacity: 0.8, motion: 'wind', speed: 0.7, shape: 'dot', stretch: 14 }],
      veil: { zone: 'planet', count: 18, colors: ['#d89a50', '#e8b878'], size: [0.5, 1.0], opacity: 0.2, motion: 'swirl', speed: 0.025 },
    },
    sky: { a: '#4a2210', b: '#7a3a1e', band: '#ffc47a', amount: 0.5 },
    sunHue: 48,
  },
  Tempest: {
    structure: 3,
    env: {
      label: 'Storm clouds',
      veil: { zone: 'planet', count: 34, colors: ['#3a1260', '#6a2a9a', '#ff7ad9'], size: [0.5, 1.2], opacity: 0.3, motion: 'swirl', speed: 0.035, flash: true },
      motes: [{ zone: 'planet', count: 60, colors: ['#ffd0ff', '#ffffff'], size: [0.008, 0.02], opacity: 0.9, motion: 'wander', speed: 0.4, shape: 'glint' }],
    },
    sky: { a: '#2b0f55', b: '#5a1a6e', band: '#e58bff', amount: 0.6 },
    sunHue: 300,
  },
  'Nebula Prime': {
    structure: 5,
    env: {
      label: 'Rainbow nebula',
      veil: { zone: 'ship', count: 44, colors: ['#ff4fd8', '#2ee6d6', '#7a5cff', '#ffb04f'], size: [260, 540], opacity: 0.36, motion: 'drift', speed: 0.3 },
      motes: [{ zone: 'ship', count: 130, colors: ['#ffffff', '#ffd0f0', '#c0fff4'], size: [2, 6], opacity: 0.95, motion: 'wander', speed: 0.2, shape: 'glint' }],
    },
    sky: { a: '#6a1070', b: '#0b6a7a', band: '#ff9aea', amount: 0.95 },
    sunHue: 272,
  },
  Zephyr: {
    structure: 19,
    env: {
      label: 'Aurora curtains',
      ribbon: { colors: ['#5dffb0', '#7affe0'], count: 2, height: 0.9, wave: 1.1, opacity: 0.5 },
      veil: { zone: 'planet', count: 20, colors: ['#6affd0', '#34d399'], size: [0.55, 1.1], opacity: 0.18, motion: 'drift', speed: 0.4 },
      motes: [{ zone: 'planet', count: 110, colors: ['#b0ffe0', '#ffffff'], size: [0.006, 0.014], opacity: 0.9, motion: 'drift', speed: 0.3, shape: 'dot' }],
    },
    sky: { a: '#053d2f', b: '#0a6a5a', band: '#7affd2', amount: 0.6 },
    sunHue: 150,
  },
  Vespera: {
    structure: 14,
    env: {
      label: 'Deep-sea bubbles',
      motes: [{ zone: 'planet', count: 130, colors: ['#7ad0ff', '#a0b8ff', '#ffffff'], size: [0.012, 0.034], opacity: 0.85, motion: 'rise', speed: 0.35, shape: 'bubble' }],
      veil: { zone: 'planet', count: 18, colors: ['#1a4acf', '#3a7aff'], size: [0.5, 1.0], opacity: 0.16, motion: 'drift', speed: 0.4 },
    },
    sky: { a: '#0a1a55', b: '#1a2a8a', band: '#6ab0ff', amount: 0.55 },
    sunHue: 26,
  },
  Obsidian: {
    structure: 9,
    env: {
      label: 'Black glass shards',
      solids: { kind: 'shards', count: 64, colors: ['#1a0a10', '#3a0a1c', '#240814'], size: [0.03, 0.09], glow: 0.7, glowColor: '#ff2a55', spin: 0.15 },
      motes: [{ zone: 'planet', count: 90, colors: ['#ff4a6a', '#ffa0b0'], size: [0.007, 0.016], opacity: 0.95, motion: 'wander', speed: 0.3, shape: 'glint' }],
    },
    sky: { a: '#3a0a1a', b: '#1a0a2a', band: '#ff4a6a', amount: 0.5 },
    sunHue: 346,
  },
  Aquaria: {
    structure: 18,
    env: {
      label: 'Cyclone spray',
      veil: { zone: 'planet', count: 30, colors: ['#e8fffb', '#7affd8', '#b0f0ff'], size: [0.55, 1.2], opacity: 0.24, motion: 'swirl', speed: 0.05 },
      motes: [{ zone: 'planet', count: 110, colors: ['#ffffff', '#aef5ff'], size: [0.01, 0.026], opacity: 0.8, motion: 'swirl', speed: 0.07, shape: 'bubble' }],
    },
    sky: { a: '#064a5a', b: '#0a7a8a', band: '#aef5ff', amount: 0.55 },
    sunHue: 190,
  },
  Glacies: {
    structure: 17,
    env: {
      label: 'Diamond dust',
      motes: [{ zone: 'planet', count: 280, colors: ['#ffffff', '#bfe0ff', '#e8d8ff'], size: [0.008, 0.026], opacity: 1, motion: 'fall', speed: 0.35, shape: 'glint' }],
      ribbon: { colors: ['#c0e0ff', '#e0c8ff'], count: 1, height: 0.6, wave: 0.6, opacity: 0.36 },
    },
    sky: { a: '#14305a', b: '#3a2a7a', band: '#d0e8ff', amount: 0.6 },
    sunHue: 220,
    sunLight: [0.75, 0.74],
  },
  Solaria: {
    structure: 13,
    env: {
      label: 'Solar embers',
      motes: [{ zone: 'planet', count: 210, colors: ['#ffd060', '#ff9a30', '#fff0a0'], size: [0.006, 0.016], opacity: 1, motion: 'rise', speed: 0.45, shape: 'dot' }],
      veil: { zone: 'planet', count: 14, colors: ['#ff8a20', '#ffc040'], size: [0.5, 1.0], opacity: 0.2, motion: 'swirl', speed: 0.03 },
    },
    sky: { a: '#5a2a08', b: '#7a4a10', band: '#ffd070', amount: 0.5 },
    sunHue: 62,
  },
  Caelum: {
    structure: 15,
    env: {
      label: 'Lilac haze',
      veil: { zone: 'planet', count: 38, colors: ['#e8c8ff', '#fbcfe8', '#c0d0ff'], size: [0.6, 1.4], opacity: 0.26, motion: 'drift', speed: 0.3 },
      motes: [{ zone: 'planet', count: 100, colors: ['#ffffff', '#e8c8ff'], size: [0.006, 0.014], opacity: 0.85, motion: 'wander', speed: 0.3, shape: 'dot' }],
    },
    sky: { a: '#3a1a6a', b: '#6a3a8a', band: '#e8c8ff', amount: 0.6 },
    sunHue: 236,
  },
  Arcadia: {
    structure: 7,
    env: {
      label: 'Data streams',
      motes: [{ zone: 'ship', count: 170, colors: ['#7affb0', '#7ad0ff', '#ffffff'], size: [1.5, 4], opacity: 0.95, motion: 'stream', speed: 0.8, shape: 'dot', stretch: 18 }],
      solids: { kind: 'shards', count: 44, colors: ['#0a2a1a', '#0a2a30'], size: [0.02, 0.05], glow: 0.8, glowColor: '#7affb0', spin: 0.2 },
    },
    sky: { a: '#08301a', b: '#0a2a4a', band: '#80ffc0', amount: 0.5 },
    sunHue: 118,
  },
  Toxis: {
    structure: 8,
    env: {
      label: 'Acid haze',
      veil: { zone: 'planet', count: 28, colors: ['#c8ff3a', '#8aff2a', '#e8ff80'], size: [0.5, 1.1], opacity: 0.26, motion: 'drift', speed: 0.4 },
      motes: [{ zone: 'planet', count: 120, colors: ['#e8ff80', '#c8ff3a'], size: [0.01, 0.028], opacity: 0.85, motion: 'rise', speed: 0.4, shape: 'bubble' }],
    },
    sky: { a: '#2a3a08', b: '#3a4a0a', band: '#d8ff6a', amount: 0.5 },
    sunHue: 96,
  },
  Chronos: {
    structure: 4,
    env: {
      label: 'Asteroid belt',
      solids: { kind: 'rocks', count: 150, colors: ['#8a8078', '#6a625a', '#a89888'], size: [0.015, 0.055], glow: 0, glowColor: '#000000', belt: true, spin: 0.2 },
      veil: { zone: 'planet', count: 12, colors: ['#8a8a98', '#6a6a78'], size: [0.5, 1.0], opacity: 0.14, motion: 'swirl', speed: 0.02 },
    },
    sky: { a: '#1a1a2a', b: '#2a2a3a', band: '#b8b8d8', amount: 0.35 },
    sunHue: 254,
  },
  Aetheria: {
    structure: 10,
    env: {
      label: 'Gold crystals',
      solids: { kind: 'shards', count: 72, colors: ['#fff2b0', '#ffffff', '#ffe890'], size: [0.03, 0.085], glow: 0.55, glowColor: '#ffe070', spin: 0.15 },
      motes: [{ zone: 'planet', count: 110, colors: ['#fff0a0', '#ffffff'], size: [0.007, 0.018], opacity: 0.95, motion: 'drift', speed: 0.3, shape: 'glint' }],
    },
    sky: { a: '#3a3008', b: '#5a4a10', band: '#fff0a0', amount: 0.55 },
    sunHue: 170,
  },
  Ignis: {
    structure: 11,
    env: {
      label: 'Lava geysers',
      motes: [{ zone: 'planet', count: 230, colors: ['#ff5a2a', '#ffd060', '#ff8a3a'], size: [0.01, 0.026], opacity: 1, motion: 'plume', speed: 0.5, shape: 'dot' }],
      veil: { zone: 'planet', count: 16, colors: ['#8a1a08', '#c03a10'], size: [0.5, 1.0], opacity: 0.18, motion: 'drift', speed: 0.4 },
    },
    sky: { a: '#4a1008', b: '#2a0a0a', band: '#ff7a4a', amount: 0.5 },
    sunHue: 12,
  },
  Vortexia: {
    structure: 6,
    env: {
      label: 'Crust slabs',
      solids: { kind: 'slabs', count: 84, colors: ['#3a1a24', '#5a2a3a', '#2a1218'], size: [0.03, 0.085], glow: 0.6, glowColor: '#ff4a8a', spin: 0.12 },
      motes: [{ zone: 'planet', count: 100, colors: ['#ff8ab0', '#ffd0e0'], size: [0.007, 0.016], opacity: 0.95, motion: 'swirl', speed: 0.05, shape: 'dot' }],
    },
    sky: { a: '#4a0a3a', b: '#2a0a4a', band: '#ff7ab8', amount: 0.55 },
    sunHue: 324,
  },
};

/** What a world does when it has no hand-made design (random worlds): a calm generic mist. */
export const DEFAULT_DESIGN: WorldDesign = {
  structure: 0,
  env: { label: 'Cosmic dust', veil: { zone: 'planet', count: 16, colors: ['#a0b0ff', '#ffffff'], size: [0.5, 1.0], opacity: 0.16, motion: 'drift', speed: 0.4 } },
  sky: { a: '#2a1a5c', b: '#0c4a5e', band: '#8f7fd6', amount: 0.5 },
  sunHue: 40,
};

export const ENV_KINDS = ['veil', 'motes', 'solids', 'ribbon'] as const;
