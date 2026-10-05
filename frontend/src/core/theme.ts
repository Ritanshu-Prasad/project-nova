/**
 * The pilot's colour (picked in the profile) as a global accent: CSS variables for the DOM
 * (--user, --user-rgb, --user-ink) and `accentHex` for 3D materials.
 * Very dark picks are lifted so the accent stays visible on the dark UI.
 */
function parse(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const c = m ? m[1] : '22d3ee';
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

const lum = ([r, g, b]: [number, number, number]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function lift(rgb: [number, number, number]): [number, number, number] {
  const L = lum(rgb);
  if (L >= 0.42) return rgb;
  const t = (0.42 - L) / (1 - L);
  return rgb.map((v) => Math.round(v + (255 - v) * t)) as [number, number, number];
}

const toHex = (rgb: [number, number, number]) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** The display-safe accent for a picked colour. */
export const accentHex = (hex: string) => toHex(lift(parse(hex)));

export function applyTheme(hex: string): void {
  const rgb = lift(parse(hex));
  const root = document.documentElement.style;
  root.setProperty('--user', toHex(rgb));
  root.setProperty('--user-rgb', rgb.join(' '));
  root.setProperty('--user-ink', lum(rgb) > 0.55 ? '#071018' : '#ffffff');
}
