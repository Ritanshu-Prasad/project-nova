/**
 * Small UI labels local to the landing overlays (HUD captions, aria labels). Product copy lives in
 * core/content.ts (HERO, PILLARS); nothing here makes a product claim.
 */
export const LABELS = {
  poweredBy: 'Powered by',
  modules: 'Product modules',
  /** Shown under the pillar chips when no module is hovered. */
  chipsHint: 'Hover a module — or a cockpit screen — to inspect',
  chipsHintTouch: 'Tap a module or a cockpit screen',
  panelKicker: 'System · Module info',
  screenFeed: 'Screen feed',
  prev: 'Prev',
  next: 'Next',
  close: 'Close module info',
  showModule: 'Show module',
} as const;

/** DOM id of the pillar detail dialog (chips point at it with aria-controls). */
export const PILLAR_PANEL_ID = 'nova-pillar-panel';
