import { useId, useMemo } from 'react';
import { seededRandom } from '../../core/seeded';
import { PLANETS, type PlanetSpec } from '../../three/space/planets';

/**
 * A cartoon picture of one of the tour's worlds for the journey map: flat colours from the same palette as the 3D planet, a
 * thick dark outline, a crescent of cel shading, a glint, and its ring and first moon. Module `i` is world `i`.
 */
const worldSpec = (index: number): PlanetSpec => PLANETS[((index % PLANETS.length) + PLANETS.length) % PLANETS.length];

const INK = '#0a0f24';
const R = 34;

interface Props {
  index: number;
  size: number;
  /** A planet that is not open yet is shown dimmed and washed out. */
  locked?: boolean;
}


/** The 3D palette is made for a lit, shaded sphere and reads dark when painted flat: lift each colour to a cartoon-bright one of the same hue. */
function lift(hex: string, minL = 0.5, minS = 0.5): string {
  const m = /^#?([0-9a-f]{6})/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let sat = 0;
  if (d > 1e-6) {
    sat = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `hsl(${Math.round(h)} ${Math.round(Math.max(sat, minS) * 100)}% ${Math.round(Math.max(l, minL) * 100)}%)`;
}

/** A soft, rounded blob: an ellipse path wobbled by a few seeded bumps. */
function blob(cx: number, cy: number, rx: number, ry: number, rnd: () => number): string {
  const n = 7;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 0.78 + rnd() * 0.4;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k] as const;
  });
  const mid = (a: readonly [number, number], b: readonly [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const next = pts[(i + 1) % n];
    const m = mid(p, next);
    if (i === 0) {
      const last = mid(pts[n - 1], p);
      d += `M${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
    }
    d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return d + 'Z';
}

export default function Planet2D({ index, size, locked = false }: Props) {
  const uid = useId().replace(/:/g, '');
  const spec = worldSpec(index);
  const raw = spec.look;
  const look = useMemo(() => ({ ...raw, ocean0: lift(raw.ocean0, 0.46), ocean1: lift(raw.ocean1, 0.38), ground0: lift(raw.ground0, 0.55), ground1: lift(raw.ground1, 0.66), cloud: lift(raw.cloud, 0.8, 0.1) }), [raw]);
  const ring = spec.ring;
  const moon = spec.moons[0];

  const art = useMemo(() => {
    const rnd = seededRandom(index * 97 + 13);
    if (look.gas) {
      const cols = [look.ocean0, look.ocean1, look.ground0, look.ocean1, look.ground1];
      const bands = Array.from({ length: 7 }, (_, i) => ({ y: 14 + i * 12 + (rnd() - 0.5) * 3, h: 5 + rnd() * 5, c: cols[i % cols.length] }));
      const tilt = -10 + rnd() * 20;
      return { kind: 'gas' as const, bands, tilt, vortex: { x: 38 + rnd() * 26, y: 52 + rnd() * 18, c: look.lava > 0.3 ? look.lavaColor : look.ground1 } };
    }
    const lands = [0, 1, 2].map((i) => ({ d: blob(28 + rnd() * 44, 26 + rnd() * 48, 11 + rnd() * 9, 8 + rnd() * 7, rnd), c: i % 2 ? look.ground1 : look.ground0 }));
    const spots = Array.from({ length: 5 }, () => ({ x: 22 + rnd() * 56, y: 22 + rnd() * 56, r: 1.8 + rnd() * 2.4 }));
    return { kind: 'land' as const, lands, spots };
  }, [index, look]);

  const cap = look.ice > 0.2;
  const glow = look.lava > 0.3 ? look.lavaColor : null;
  const ringTilt = Math.max(-28, Math.min(28, spec.roll));

  const ringBand = ring ? (
    <>
      <ellipse cx={50} cy={52} rx={54} ry={14} transform={`rotate(${ringTilt} 50 52)`} fill="none" stroke={INK} strokeWidth={9} />
      <ellipse cx={50} cy={52} rx={54} ry={14} transform={`rotate(${ringTilt} 50 52)`} fill="none" stroke={ring.colorA} strokeWidth={5} />
      <ellipse cx={50} cy={52} rx={47} ry={11.5} transform={`rotate(${ringTilt} 50 52)`} fill="none" stroke={ring.colorB} strokeWidth={1.6} opacity={0.9} />
    </>
  ) : null;

  // The planet itself is 68 of the 116 units across, so the drawing is scaled up until the planet is `size` wide; the ring and
  // the moon reach out past that on purpose.
  const scale = size / (R * 2);
  return (
    <span className="relative block" style={{ width: size, height: size }} aria-hidden>
    <svg
      viewBox="-8 -2 116 108"
      width={116 * scale}
      height={108 * scale}
      style={{ position: 'absolute', left: '50%', top: '50%', maxWidth: 'none', overflow: 'visible', transform: 'translate(-50%, -50%)', filter: locked ? 'grayscale(0.55) brightness(0.8)' : undefined }}
    >
      <defs>
        <clipPath id={`c${uid}`}>
          <circle cx={50} cy={52} r={R} />
        </clipPath>
        <mask id={`m${uid}`}>
          <rect x={0} y={0} width={100} height={104} fill="#fff" />
          <circle cx={42} cy={44} r={R} fill="#000" />
        </mask>
        <clipPath id={`f${uid}`}>
          <rect x={-10} y={52} width={120} height={60} />
        </clipPath>
      </defs>

      {/* the ring behind the planet */}
      <g>{ringBand}</g>

      {/* the body */}
      <g clipPath={`url(#c${uid})`}>
        <rect x={10} y={10} width={80} height={84} fill={look.ocean0} />
        {art.kind === 'gas' ? (
          <g transform={`rotate(${art.tilt} 50 52)`}>
            {art.bands.map((b, i) => (
              <rect key={i} x={0} y={b.y} width={100} height={b.h} fill={b.c} />
            ))}
            <ellipse cx={art.vortex.x} cy={art.vortex.y} rx={9} ry={5.5} fill={art.vortex.c} stroke={INK} strokeWidth={1.6} />
            <ellipse cx={art.vortex.x} cy={art.vortex.y} rx={3.6} ry={2} fill={look.ocean1} />
          </g>
        ) : (
          <>
            {art.lands.map((l, i) => (
              <path key={i} d={l.d} fill={l.c} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
            ))}
            {art.spots.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={look.cloud} opacity={0.55} />
            ))}
          </>
        )}
        {cap && (
          <>
            <ellipse cx={50} cy={19} rx={20} ry={7} fill="#f4fbff" />
            <ellipse cx={50} cy={86} rx={18} ry={6} fill="#f4fbff" />
          </>
        )}
        {glow && <path d="M30 60 L40 54 L47 63 L58 55 L68 64" fill="none" stroke={glow} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />}
        {/* cel shading: one flat crescent on the side away from the sun */}
        <circle cx={50} cy={52} r={R} fill={INK} opacity={0.3} mask={`url(#m${uid})`} />
        {/* a flat band of atmosphere colour along the lit edge */}
        <circle cx={50} cy={52} r={R - 1.5} fill="none" stroke={look.atmo} strokeWidth={3} opacity={0.45} strokeDasharray="42 220" strokeDashoffset={-150} />
      </g>
      <circle cx={50} cy={52} r={R} fill="none" stroke={INK} strokeWidth={4.5} />
      {/* the glint */}
      <ellipse cx={37} cy={37} rx={6.5} ry={3.4} transform="rotate(-38 37 37)" fill="#fff" opacity={0.85} />
      <circle cx={30} cy={46} r={1.8} fill="#fff" opacity={0.85} />

      {/* the near half of the ring crosses in front */}
      <g clipPath={`url(#f${uid})`}>{ringBand}</g>

      {/* the first moon */}
      {moon && (
        <g>
          <circle cx={88} cy={20} r={8} fill={moon.tint} stroke={INK} strokeWidth={3} />
          <ellipse cx={85.5} cy={17.5} rx={2.6} ry={1.6} transform="rotate(-35 85.5 17.5)" fill="#fff" opacity={0.8} />
        </g>
      )}
    </svg>
    </span>
  );
}
