/**
 * Per-frame state shared between the HUD's parts. Written by <Hud> every frame, read by its children
 * (which run their own `useRaf` loops). Only one HUD is mounted at a time.
 */
export const hudBus = {
  /** The HUD is drawn this frame (master opacity above zero) — parts skip their work otherwise. */
  visible: false,
  /** Seconds since the HUD booted; -1 until it first appears. */
  bootT: -1,
  /** Viewport size in CSS px (kept current on resize). */
  w: typeof window === 'undefined' ? 1440 : window.innerWidth,
  h: typeof window === 'undefined' ? 900 : window.innerHeight,
};

/** Back to the pre-boot state (on mount, so a replayed intro boots the HUD again). */
export function resetHudBus(): void {
  hudBus.visible = false;
  hudBus.bootT = -1;
  hudBus.w = window.innerWidth;
  hudBus.h = window.innerHeight;
}
