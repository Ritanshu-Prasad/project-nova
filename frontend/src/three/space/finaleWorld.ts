import { screenDir, type Vec3 } from './layout';

/**
 * Where the dying sun hangs in the finale: straight ahead and a little above the horizon, close enough to fill about half
 * of the window, so the pilot flies "in front of" it. Distance and radius are world units from the parked ship.
 */
const dir = screenDir(0.03, 0.14);
export const DYING = {
  distance: 1250,
  radius: 340,
  dir,
  position: [dir[0] * 1250, dir[1] * 1250, dir[2] * 1250] as Vec3,
} as const;

/** Colours of the star: a deep red limb, an orange-gold body and the white-hot flare it ends in. */
export const DYING_COLORS = { edge: '#7a0d06', body: '#ff5a14', core: '#ffc25a', flare: '#ff3a10' } as const;

/** For the last this-many seconds before the blast the core collapses: the star shrinks white-hot and everything goes quiet. */
export const IMPLODE = 0.7;

/** 0 → 1 across the collapse before the blast (t = seconds since the blast, negative before it), 0 after. */
export function implosion(t: number): number {
  if (t >= 0) return 0;
  const u = Math.min(1, Math.max(0, (t + IMPLODE) / (IMPLODE - 0.05)));
  return u * u * (3 - 2 * u);
}
