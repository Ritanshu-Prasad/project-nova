import { CanvasTexture, SRGBColorSpace } from 'three';
import { PILLARS } from '../../core/content';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';

/** Cockpit MFD screens drawn on 2D canvases (redrawn ~10×/s). */

export const SCREEN_W = 512;
export const SCREEN_H = 320;

const MONO = '"JetBrains Mono Variable", ui-monospace, monospace';
const DISPLAY = '"Oxanium Variable", ui-sans-serif, sans-serif';
const CYAN = '#67e8f9';
const DIM = 'rgba(103,232,249,0.45)';

export interface Screen {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;
}

export function createScreen(): Screen {
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx, texture };
}

/** Kick the web fonts into loading so the canvases can use them. */
export function loadScreenFonts(): void {
  try {
    void document.fonts.load(`600 20px ${DISPLAY}`);
    void document.fonts.load(`500 16px ${MONO}`);
  } catch {
    /* fonts API unavailable — fallback fonts are fine */
  }
}

function frame(c: CanvasRenderingContext2D, title: string, color = CYAN, highlight = false) {
  c.fillStyle = '#031019';
  c.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const g = c.createRadialGradient(SCREEN_W / 2, SCREEN_H / 2, 40, SCREEN_W / 2, SCREEN_H / 2, 320);
  g.addColorStop(0, 'rgba(34,211,238,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, SCREEN_W, SCREEN_H);
  c.strokeStyle = highlight ? '#ffffff' : 'rgba(103,232,249,0.35)';
  c.lineWidth = highlight ? 6 : 2;
  c.strokeRect(8, 8, SCREEN_W - 16, SCREEN_H - 16);
  c.fillStyle = color;
  c.font = `600 22px ${DISPLAY}`;
  c.fillText(title, 26, 46);
  c.fillStyle = DIM;
  c.fillRect(26, 58, SCREEN_W - 52, 2);
}

function scanlines(c: CanvasRenderingContext2D) {
  c.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < SCREEN_H; y += 3) c.fillRect(0, y, SCREEN_W, 1);
}

function bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, v: number, color = CYAN) {
  c.fillStyle = 'rgba(103,232,249,0.15)';
  c.fillRect(x, y, w, 12);
  c.fillStyle = color;
  c.fillRect(x, y, w * Math.max(0, Math.min(1, v)), 12);
}

function pillar(c: CanvasRenderingContext2D, i: number, t: number, hot: boolean) {
  const p = PILLARS[i];
  frame(c, p.screenTitle, hot ? '#ffffff' : CYAN, hot);
  c.font = `700 64px ${DISPLAY}`;
  c.fillStyle = hot ? '#ffffff' : 'rgba(165,243,252,0.9)';
  c.fillText(p.code, 26, 140);
  c.font = `500 17px ${MONO}`;
  p.screenLines.forEach((l, k) => {
    c.fillStyle = k === 0 ? CYAN : DIM;
    c.fillText(l, 26, 186 + k * 28);
  });
  // A small motif per pillar.
  const cx = 400;
  const cy = 150;
  c.strokeStyle = CYAN;
  c.lineWidth = 3;
  if (i === 0) {
    c.beginPath();
    c.arc(cx, cy, 52, t * 2, t * 2 + 4.6);
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, 30, -t * 3, -t * 3 + 3.5);
    c.stroke();
  } else if (i === 1) {
    c.fillStyle = 'rgba(52,211,153,0.18)';
    c.fillRect(cx - 70, cy - 40, 140, 28);
    c.beginPath();
    for (let k = 0; k <= 20; k++) {
      const x = cx - 70 + k * 7;
      const y = cy + 50 - k * 4.2 + Math.sin(k * 1.7 + t * 3) * 6;
      if (k === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  } else {
    for (let k = 0; k < 4; k++) {
      const y = cy - 60 + ((k * 34 + t * 30) % 136);
      c.strokeRect(cx - 60, y, 120, 24);
    }
  }
  c.font = `600 15px ${MONO}`;
  c.fillStyle = hot ? '#ffffff' : CYAN;
  c.globalAlpha *= 0.6 + 0.4 * Math.sin(t * 4);
  c.fillText('▶ SELECT', 26, 290);
}

/** Draws screen `i` (0 left, 1 centre, 2 right) for the current state. */
export function drawScreen(s: Screen, i: number, t: number): void {
  const c = s.ctx;
  const st = useNova.getState();
  c.save();
  c.globalAlpha = 1;
  if (rt.power < 0.04) {
    c.fillStyle = '#010203';
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    if (i === 1 && Math.sin(t * 5) > 0) {
      c.fillStyle = '#ff2a2a';
      c.font = `600 18px ${MONO}`;
      c.fillText('AUX POWER 12%  ·  MAIN BUS OFFLINE', 40, SCREEN_H / 2);
    }
    c.restore();
    s.texture.needsUpdate = true;
    return;
  }
  c.globalAlpha = Math.min(1, rt.power);
  const phase = st.phase;

  if (phase === 'arrive' || phase === 'landed') {
    pillar(c, i, t, st.hoverPillar === i || st.activePillar === i);
  } else if (phase === 'launch' || phase === 'warp') {
    if (i === 0) {
      frame(c, 'THRUST');
      ['MAIN', 'AUX', 'G-LOAD'].forEach((l, k) => {
        c.fillStyle = DIM;
        c.font = `500 16px ${MONO}`;
        c.fillText(l, 26, 110 + k * 50);
        bar(c, 140, 98 + k * 50, 320, rt.engine * (1 - k * 0.15) + Math.sin(t * 30 + k) * 0.03);
      });
    } else if (i === 1) {
      frame(c, 'VELOCITY');
      c.font = `700 56px ${DISPLAY}`;
      c.fillStyle = '#ffffff';
      const v = rt.speedKms;
      c.fillText(v > 100_000 ? `${(v / 299_792).toFixed(2)} c` : `${Math.round(v).toLocaleString('en-IN')}`, 26, 150);
      c.font = `500 16px ${MONO}`;
      c.fillStyle = DIM;
      c.fillText(v > 100_000 ? 'WARP FIELD STABLE' : 'km/s · CATAPULT', 26, 190);
    } else {
      frame(c, 'WARP FIELD');
      c.strokeStyle = CYAN;
      c.lineWidth = 3;
      c.beginPath();
      for (let x = 26; x < SCREEN_W - 26; x += 4) {
        const y = 190 + Math.sin(x * 0.05 + t * 20) * 60 * (0.15 + rt.warp) * Math.sin(x * 0.012);
        if (x === 26) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  } else if (i === 0) {
    frame(c, 'SYSTEMS');
    (['power', 'neural', 'core'] as const).forEach((k, n) => {
      const on = st.systems[k];
      c.font = `500 18px ${MONO}`;
      c.fillStyle = on ? '#34d399' : 'rgba(245,158,11,0.9)';
      c.fillText(`${['MAIN PWR', 'NEURAL LINK', 'RR CORE'][n]}`, 26, 110 + n * 56);
      c.fillText(on ? 'ONLINE' : 'OFFLINE', 360, 110 + n * 56);
      bar(c, 26, 122 + n * 56, 460, on ? 1 : 0.05, on ? '#34d399' : '#f59e0b');
    });
  } else if (i === 1) {
    frame(c, 'FLIGHT');
    c.font = `600 22px ${MONO}`;
    if (st.cleared) {
      c.fillStyle = '#34d399';
      c.fillText('LAUNCH CLEARANCE GRANTED', 26, 110);
      bar(c, 26, 130, 460, rt.charge);
      c.font = `700 90px ${DISPLAY}`;
      c.fillStyle = '#ffffff';
      if (rt.countdown) c.fillText(String(rt.countdown), 230, 270);
      else {
        c.font = `500 18px ${MONO}`;
        c.fillStyle = DIM;
        c.fillText('HOLD [SPACE] TO LAUNCH', 26, 200);
      }
    } else {
      c.fillStyle = CYAN;
      c.fillText('HANGAR 07 · DOCKED', 26, 110);
      c.fillStyle = Math.sin(t * 4) > 0 ? '#f59e0b' : DIM;
      c.fillText('AWAITING CLEARANCE', 26, 150);
    }
  } else {
    frame(c, 'NAV');
    const cx = 256;
    const cy = 190;
    c.strokeStyle = DIM;
    c.lineWidth = 2;
    for (const r of [40, 80, 115]) {
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.stroke();
    }
    const a = t * 2;
    c.strokeStyle = CYAN;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * 115, cy + Math.sin(a) * 115);
    c.stroke();
    c.fillStyle = '#f59e0b';
    c.fillRect(cx + 60, cy - 70, 8, 8);
    c.font = `500 15px ${MONO}`;
    c.fillStyle = DIM;
    c.fillText('DEST: UNCHARTED', 26, 300);
  }
  scanlines(c);
  c.restore();
  s.texture.needsUpdate = true;
}
