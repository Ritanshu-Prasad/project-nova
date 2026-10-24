import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import { seededRandom } from '../../core/seeded';

/**
 * A neutral white glow that fades out smoothly. Tint it with the material colour: the texture itself carries no hue,
 * so a red, blue or green star keeps its colour instead of washing out to white.
 */
export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.1, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.28)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.07)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

/** The body of a star: a bright disc that is slightly darker towards its edge (limb darkening) and has a soft rim. */
export function sunDiscTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.55, 'rgba(235,235,235,1)');
  grd.addColorStop(0.86, 'rgba(190,190,190,1)');
  grd.addColorStop(0.94, 'rgba(170,170,170,0.7)');
  grd.addColorStop(1, 'rgba(170,170,170,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

/** A thick, soft ring (white, tint it with the material colour) for the shock wave that leaves a supernova. */
export function shockRingTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 60, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.62, 'rgba(255,255,255,0.12)');
  grd.addColorStop(0.86, 'rgba(255,255,255,1)');
  grd.addColorStop(0.93, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

/** Tiles of the sprite sheet, left to right. The environment shader picks one with `uShape`. */
export const SPRITE = { cloud: 0, glint: 1, bubble: 2, dot: 3 } as const;

/**
 * One 512x128 sheet with four neutral-white sprites — a soft gas cloud, a four-point glint, a bubble and a dot — so a single
 * material can draw every kind of floating particle and each layer only changes colour, size and motion.
 */
export function spriteAtlas() {
  const T = 128;
  const c = document.createElement('canvas');
  c.width = T * 4;
  c.height = T;
  const g = c.getContext('2d')!;
  const random = seededRandom(77);

  // 0 · cloud: overlapping soft blobs under a round mask, so every cloud looks lumpy yet fades out at the edge.
  g.save();
  g.translate(0, 0);
  for (let i = 0; i < 34; i++) {
    const a = random() * Math.PI * 2;
    const r = Math.pow(random(), 0.7) * 38;
    const x = 64 + Math.cos(a) * r;
    const y = 64 + Math.sin(a) * r;
    const rad = 14 + random() * 24;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(255,255,255,${0.1 + random() * 0.16})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.55, 'rgba(0,0,0,0.9)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, T, T);
  g.restore();
  g.globalCompositeOperation = 'source-over';

  // 1 · glint: a bright core with a thin cross.
  const cx = T + 64;
  const core = g.createRadialGradient(cx, 64, 0, cx, 64, 22);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core;
  g.fillRect(T, 0, T, T);
  for (const horizontal of [true, false]) {
    const beam = horizontal ? g.createLinearGradient(T, 0, T * 2, 0) : g.createLinearGradient(0, 0, 0, T);
    beam.addColorStop(0, 'rgba(255,255,255,0)');
    beam.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    beam.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = beam;
    if (horizontal) g.fillRect(T, 62, T, 4);
    else g.fillRect(cx - 2, 0, 4, T);
  }

  // 2 · bubble: a thin ring with a highlight.
  const bx = T * 2 + 64;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(bx, 64, 44, 0, Math.PI * 2);
  g.stroke();
  const fill = g.createRadialGradient(bx, 64, 20, bx, 64, 44);
  fill.addColorStop(0, 'rgba(255,255,255,0)');
  fill.addColorStop(1, 'rgba(255,255,255,0.22)');
  g.fillStyle = fill;
  g.beginPath();
  g.arc(bx, 64, 44, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.ellipse(bx - 16, 46, 9, 5, -0.7, 0, Math.PI * 2);
  g.fill();

  // 3 · dot: a soft round point.
  const dx = T * 3 + 64;
  const dot = g.createRadialGradient(dx, 64, 0, dx, 64, 60);
  dot.addColorStop(0, 'rgba(255,255,255,1)');
  dot.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  dot.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = dot;
  g.fillRect(T * 3, 0, T, T);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}
