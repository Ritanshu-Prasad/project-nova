import { CanvasTexture } from 'three';

/** A soft white-hot dot that fades out, used for suns and glows (tint it with the material colour). */
export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.08, 'rgba(255,240,220,0.9)');
  grd.addColorStop(0.3, 'rgba(255,200,150,0.25)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}
