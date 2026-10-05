import { CanvasTexture, RepeatWrapping, SRGBColorSpace, Shape } from 'three';

/**
 * Ship-local layout behind the pilot's seat (seated eye at the origin, the cockpit faces -Z):
 * rear bulkhead door at DOOR.z → corridor → the octagonal "Cosmic Lounge" centred at LOUNGE.center.
 */
export const FLOOR_Y = -1.45;
/** Eye height above the seated eye once the pilot stands up. */
export const STAND_EYE = 0.2;
/** Where the walk ends (eye z), just inside the lounge. */
export const ARRIVE_Z = 5.6;

export const DOOR = {
  z: 1.45,
  /** Clear opening (octagon) and the wall it sits in. */
  width: 1.3,
  height: 2.2,
  wallDepth: 0.5,
  /** Outer size of the chunky frame. */
  frameW: 2.0,
  frameH: 2.85,
  chamfer: 0.32,
} as const;

export const CORRIDOR = { start: DOOR.z + DOOR.wallDepth, end: 4.62, width: 1.8, height: 2.6 } as const;

export const LOUNGE = {
  center: [0, FLOOR_Y, 10.6] as const,
  /** Apothem (centre → middle of a wall) of the octagonal room. */
  apothem: 6,
  height: 3.4,
} as const;

export const TABLE = { radius: 1.45, top: FLOOR_Y + 0.58 } as const;
/** Centre of the hologram globe above the table. */
export const HOLO_CENTER: [number, number, number] = [0, 0.42, LOUNGE.center[2]];
export const PET_HOME: [number, number, number] = [-2.2, 0.45, 11.2];

/** Octagon outline (flat top/bottom/sides) of width w, height h with corner chamfer c, centred at (0, cy). */
export function octagon(w: number, h: number, c: number, cy = 0): [number, number][] {
  const x = w / 2;
  const y = h / 2;
  return [
    [-x + c, cy - y], [x - c, cy - y], [x, cy - y + c], [x, cy + y - c],
    [x - c, cy + y], [-x + c, cy + y], [-x, cy + y - c], [-x, cy - y + c],
  ];
}

export function shapeFrom(points: [number, number][]): Shape {
  const s = new Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** Procedural metal plate texture (seams, rivets, tone variation) in a warm or cool tint. */
export function plateTexture(base: string, seam: string, repeat: [number, number]): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      g.fillStyle = `rgba(255,255,255,${0.012 + ((i * 7 + j * 3) % 5) * 0.008})`;
      g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      for (const [rx, ry] of [[10, 10], [118, 10], [10, 118], [118, 118]]) {
        g.beginPath();
        g.arc(i * 128 + rx, j * 128 + ry, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  g.strokeStyle = seam;
  g.lineWidth = 3;
  for (let k = 0; k <= 4; k++) {
    g.beginPath();
    g.moveTo(k * 128, 0);
    g.lineTo(k * 128, 512);
    g.moveTo(0, k * 128);
    g.lineTo(512, k * 128);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Text sign texture (emissive map). */
export function signTexture(title: string, sub: string, color = '#ffb35c'): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.strokeRect(14, 14, 996, 228);
  g.fillStyle = color;
  g.textAlign = 'center';
  g.font = '700 104px "Oxanium Variable", sans-serif';
  g.fillText(title, 512, 140);
  g.font = '600 40px "JetBrains Mono Variable", monospace';
  g.fillText(sub, 512, 206);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Soft round sprite (steam, dust, glows). */
export function softDot(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}
