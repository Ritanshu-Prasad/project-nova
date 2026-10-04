/** Shared one-shot effects (Web Animations API — compositor-friendly, no React state) and art for the intro UI. */

const FROST_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='640'>
<filter id='a' x='0' y='0' width='100%' height='100%'>
<feTurbulence type='fractalNoise' baseFrequency='0.006 0.022' numOctaves='5' seed='11' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 0.74 0 0 0 0 0.9 0 0 0 0 1 0 0 0 2.6 -1.32'/>
</filter>
<filter id='b' x='0' y='0' width='100%' height='100%'>
<feTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='2' seed='4' stitchTiles='stitch'/>
<feColorMatrix values='0 0 0 0 0.86 0 0 0 0 0.96 0 0 0 0 1 0 0 0 4 -2.75'/>
</filter>
<rect width='100%' height='100%' filter='url(#a)'/>
<rect width='100%' height='100%' filter='url(#b)'/>
</svg>`;

/** Cryo-frost texture (fractal noise rendered once by the browser as an image). */
export const FROST_BG = `url("data:image/svg+xml,${encodeURIComponent(FROST_SVG)}")`;

/** Heartbeat "lub-dub" scale pulse. */
export const LUB_DUB: Keyframe[] = [
  { transform: 'scale(1)' },
  { transform: 'scale(1.065)', offset: 0.12 },
  { transform: 'scale(0.995)', offset: 0.26 },
  { transform: 'scale(1.035)', offset: 0.38 },
  { transform: 'scale(1)', offset: 0.62 },
];

/** Expanding ring fired on each heartbeat. */
export const RIPPLE: Keyframe[] = [
  { transform: 'scale(1)', opacity: 0.6 },
  { transform: 'scale(1.75)', opacity: 0 },
];

/** Denied: a quick horizontal shake. */
const SHAKE: Keyframe[] = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-7px)', offset: 0.14 },
  { transform: 'translateX(6px)', offset: 0.32 },
  { transform: 'translateX(-4px)', offset: 0.5 },
  { transform: 'translateX(3px)', offset: 0.68 },
  { transform: 'translateX(0)' },
];

/** Shakes an element (denied input). Reduced motion gets a short opacity blink instead. */
export function shake(el: Element | null, reducedMotion: boolean): void {
  if (!el) return;
  if (reducedMotion) {
    el.animate([{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }], { duration: 320 });
    return;
  }
  el.animate(SHAKE, { duration: 420, easing: 'ease-out' });
}

/** Brief colour flash on an overlay element (opacity 0 → peak → 0). */
export function flash(el: Element | null, peak = 1, duration = 520): void {
  el?.animate([{ opacity: 0 }, { opacity: peak, offset: 0.18 }, { opacity: 0 }], { duration, easing: 'ease-out' });
}
