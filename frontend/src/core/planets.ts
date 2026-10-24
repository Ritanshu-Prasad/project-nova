import { create } from 'zustand';

/**
 * The twenty worlds the ship can visit, in tour order. The look of each one lives in three/space/planets.ts (same order);
 * this file only holds which one is current, so the director, the HUD and the saved state need no 3D code.
 */
export const PLANET_NAMES = [
  'Aurelia',
  'Kryos',
  'Ember',
  'Verdant',
  'Dune',
  'Tempest',
  'Nebula Prime',
  'Zephyr',
  'Vespera',
  'Obsidian',
  'Aquaria',
  'Glacies',
  'Solaria',
  'Caelum',
  'Arcadia',
  'Toxis',
  'Chronos',
  'Aetheria',
  'Ignis',
  'Vortexia',
] as const;
export const PLANET_COUNT = PLANET_NAMES.length;

const KEY = 'nova.planet';

/** A saved value back to a valid planet index (anything unusable → the first planet). */
export function parsePlanetIndex(raw: string | null): number {
  const n = Number(raw);
  return raw !== null && Number.isInteger(n) && n >= 0 && n < PLANET_COUNT ? n : 0;
}

const readIndex = () => {
  try {
    return parsePlanetIndex(localStorage.getItem(KEY));
  } catch {
    return 0;
  }
};

/** The planet the ship is at now — remembered, so the same world is there when the pilot sits back down. */
export const usePlanets = create<{ index: number }>()(() => ({ index: readIndex() }));

export const planetName = (index = usePlanets.getState().index) => PLANET_NAMES[index];

/** Moves on to the next world of the tour (6 wraps to 1) and remembers it. Returns the new index. */
export function nextPlanet(): number {
  const index = (usePlanets.getState().index + 1) % PLANET_COUNT;
  try {
    localStorage.setItem(KEY, String(index));
  } catch {
    /* storage unavailable — the tour just restarts next visit */
  }
  usePlanets.setState({ index });
  return index;
}

/** Sets the planet to a specific world index and remembers it. Returns the new index. */
export function setPlanet(target: number): number {
  const index = ((target % PLANET_COUNT) + PLANET_COUNT) % PLANET_COUNT;
  try {
    localStorage.setItem(KEY, String(index));
  } catch {
    /* storage unavailable */
  }
  usePlanets.setState({ index });
  return index;
}

