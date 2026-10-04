/** Stacking order of the fixed layers over the WebGL canvas. Use as `style={{ zIndex: Z.hud }}`. */
export const Z = {
  canvas: 0,
  landing: 30,
  hud: 40,
  pillar: 45,
  intro: 50,
  topbar: 60,
  /** Eyelids cover everything below while the pilot wakes up. */
  eyelids: 70,
  warpFlash: 75,
  gate: 80,
  notices: 90,
  skip: 95,
  cursor: 100,
} as const;
