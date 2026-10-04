import { useEffect, useRef, useState } from 'react';
import { PILLARS } from '../../core/content';
import { useGlobalInput } from '../../core/input';
import { damp, smoothstep } from '../../core/math';
import { rt } from '../../core/runtime';
import { useNova, type Notice } from '../../core/store';
import { markPreviewReady, previewParams } from '../../dev/previewParams';
import LandingHero from './LandingHero';
import PillarPanel from './PillarPanel';

/**
 * DEV ONLY — /?preview=landing
 *   (default) landed · phase=arrive&rt.arrive=0.5 (static stage) · play=1 (runs the arrive timeline)
 *   pillar=<i> hover=<i> rm=1 · rt.yaw=<rad>&rt.pitch=<rad> (static head pose; otherwise the mouse looks)
 *   guides=1 (layout-contract zones of the other overlays) · bg=0 (plain void)
 * Everything around the landing overlays is a preview-only stand-in (scene, cockpit screens, toasts).
 */

const q = previewParams;
const PLAY = q.get('play') === '1';
const STATIC_LOOK = q.has('rt.yaw') || q.has('rt.pitch');

// Default to the landed state unless a phase was requested.
if (!q.has('phase')) {
  useNova.getState().setPhase(PLAY ? 'arrive' : 'landed');
  rt.arrive = PLAY ? 0 : 1;
}
useNova.getState().setWorld('newworld');
if (PLAY) useNova.getState().setPhase('arrive');

export default function LandingPreview() {
  useGlobalInput();
  usePreviewTimeline();
  return (
    <div className="nova-root bg-void">
      {q.get('bg') !== '0' && <SceneStandIn />}
      <ConsoleStandIn />
      <LandingHero />
      <PillarPanel />
      {q.get('guides') === '1' && <Guides />}
      <ToastStandIn />
    </div>
  );
}

/** Stand-in director + head rig: arrive timeline (play=1) and pointer → head yaw/pitch (three.js convention). */
function usePreviewTimeline() {
  useEffect(() => {
    let raf = 0;
    let start = -1;
    let last = performance.now();
    let cancelled = false;
    const loop = (ms: number) => {
      const dt = Math.min(0.1, (ms - last) / 1000);
      last = ms;
      rt.dt = dt;
      rt.time = ms / 1000;
      if (PLAY && start >= 0) {
        const t = (ms - start) / 1000;
        if (useNova.getState().phase === 'arrive') {
          rt.arrive = smoothstep(0.3, 2.8, t);
          if (t >= 3.8) useNova.getState().setPhase('landed');
        }
      }
      if (!STATIC_LOOK) {
        rt.yaw = damp(rt.yaw, -rt.lookX * 0.45, 4, dt);
        rt.pitch = damp(rt.pitch, -rt.lookY * 0.28, 4, dt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          start = performance.now();
          markPreviewReady();
        }),
      );
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);
}

/** Painted once: nebula, stars, a warm sun and a giant ringed planet lower-right. */
function SceneStandIn() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d');
      if (g) paintScene(g, w, h);
    };
    paint();
    window.addEventListener('resize', paint);
    return () => window.removeEventListener('resize', paint);
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="fixed inset-0 h-full w-full" />;
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function paintScene(g: CanvasRenderingContext2D, w: number, h: number) {
  const r = rand(7);
  g.fillStyle = '#02040a';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  const blob = (x: number, y: number, rad: number, c: string) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, c);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  };
  blob(w * 0.18, h * 0.2, Math.max(w, h) * 0.55, 'rgba(168,85,247,0.30)');
  blob(w * 0.72, h * 0.12, Math.max(w, h) * 0.45, 'rgba(59,130,246,0.22)');
  blob(w * 0.45, h * 0.55, Math.max(w, h) * 0.35, 'rgba(34,211,238,0.08)');
  blob(w * 0.05, h * 0.75, Math.max(w, h) * 0.4, 'rgba(236,72,153,0.10)');
  for (let i = 0; i < 1100; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = 0.25 + r() * 0.75;
    const s = r() < 0.94 ? 0.6 + r() * 0.7 : 1.4 + r() * 1.2;
    g.fillStyle = `rgba(${200 + r() * 55},${215 + r() * 40},255,${a})`;
    g.fillRect(x, y, s, s);
  }
  // Sun (upper left)
  blob(w * 0.13, h * 0.17, Math.max(w, h) * 0.22, 'rgba(255,214,150,0.45)');
  blob(w * 0.13, h * 0.17, 26, 'rgba(255,255,255,1)');
  g.globalCompositeOperation = 'source-over';

  // Planet lower-right with rings
  const R = Math.max(w, h) * 0.5;
  const cx = w * 0.86;
  const cy = h * 0.98 + R * 0.55;
  const ring = (front: boolean) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.32);
    for (let k = 0; k < 26; k++) {
      const rr = R * (1.25 + k * 0.022);
      g.beginPath();
      g.ellipse(0, 0, rr, rr * 0.2, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      g.strokeStyle = `rgba(${170 + k * 2},${200 + k},255,${0.05 + 0.18 * Math.abs(Math.sin(k * 1.7))})`;
      g.lineWidth = R * 0.014;
      g.stroke();
    }
    g.restore();
  };
  ring(false);
  const body = g.createRadialGradient(cx - R * 0.45, cy - R * 0.55, R * 0.05, cx, cy, R);
  body.addColorStop(0, '#7fb2e6');
  body.addColorStop(0.25, '#2e5a92');
  body.addColorStop(0.55, '#10264a');
  body.addColorStop(0.85, '#060f22');
  body.addColorStop(1, '#040a16');
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fillStyle = body;
  g.fill();
  g.save();
  g.clip();
  for (let k = 0; k < 14; k++) {
    g.fillStyle = `rgba(150,200,255,${0.03 + r() * 0.05})`;
    g.fillRect(cx - R, cy - R + k * R * 0.15 + r() * 20, R * 2, R * 0.05 + r() * R * 0.04);
  }
  g.restore();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(103,232,249,0.55)';
  g.lineWidth = 3;
  g.shadowColor = 'rgba(56,189,248,0.9)';
  g.shadowBlur = 40;
  g.stroke();
  g.shadowBlur = 0;
  ring(true);
}

/** Dark cockpit console across the bottom 24% with three stand-in MFDs wired to the store like the real ones. */
function ConsoleStandIn() {
  const hover = useNova((s) => s.hoverPillar);
  const active = useNova((s) => s.activePillar);
  return (
    <div aria-hidden="true" className="fixed inset-x-0 bottom-0 h-[24%]">
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(10,18,32,0.0) 0%, #0a1220 14%, #060b15 100%)',
          clipPath: 'polygon(0 30%, 18% 8%, 82% 8%, 100% 30%, 100% 100%, 0 100%)',
        }}
      />
      <div className="absolute inset-x-[18%] top-[8%] h-px bg-cyan-300/25" />
      <div className="absolute inset-x-0 bottom-[10%] top-[24%] flex items-start justify-center gap-[2vw] px-[6vw]">
        {PILLARS.map((p, i) => {
          const lit = hover === i || active === i;
          return (
            <div
              key={p.key}
              className={`pointer-events-auto flex h-full max-w-[300px] flex-1 cursor-pointer flex-col justify-center gap-1 rounded-[3px] border px-[1.4vw] font-mono transition-all duration-200 ${
                lit
                  ? 'border-cyan-200/80 bg-cyan-400/20 shadow-[0_0_40px_rgba(34,211,238,0.45)]'
                  : 'border-cyan-300/20 bg-[#04121c]'
              }`}
              onPointerEnter={() => useNova.getState().setHoverPillar(i)}
              onPointerLeave={() => useNova.getState().hoverPillar === i && useNova.getState().setHoverPillar(null)}
              onClick={() => useNova.getState().setActivePillar(i)}
            >
              <span className="truncate text-[clamp(8px,0.9vw,12px)] font-semibold tracking-[0.18em] text-cyan-200">
                {p.code} {p.screenTitle}
              </span>
              {p.screenLines.map((l) => (
                <span key={l} className="hidden truncate text-[clamp(7px,0.7vw,10px)] text-cyan-300/60 sm:block">
                  {l}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Outlines of the other overlays' zones (layout contract) to check for collisions. */
function Guides() {
  const z = 'fixed border border-dashed border-amber-400/70 bg-amber-400/5 pointer-events-none';
  const label = 'absolute left-1 top-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-300';
  return (
    <div aria-hidden="true" style={{ zIndex: 200 }} className="pointer-events-none fixed inset-0">
      <div className={`${z} inset-x-0 top-0 h-16`}>
        <span className={label}>top bar 0–64</span>
      </div>
      <div className={`${z} left-1/2 top-[72px] h-7 w-[360px] max-w-[calc(100vw-32px)] -translate-x-1/2`}>
        <span className={label}>heading tape</span>
      </div>
      <div className={`${z} right-6 top-20 h-44 w-[380px] max-sm:left-4 max-sm:right-4 max-sm:w-auto`}>
        <span className={label}>notifications</span>
      </div>
      <div className={`${z} left-6 top-[40%] h-[30%] w-40 max-sm:hidden`}>
        <span className={label}>hud left</span>
      </div>
      <div className={`${z} right-6 top-[40%] h-[30%] w-40 max-sm:hidden`}>
        <span className={label}>hud right</span>
      </div>
      <div className={`${z} bottom-6 right-6 h-10 w-44`}>
        <span className={label}>skip / sound</span>
      </div>
      <div className={`${z} bottom-5 left-1/2 h-4 w-72 -translate-x-1/2`}>
        <span className={label}>status line</span>
      </div>
      <div className="fixed inset-x-0 top-[14%] border-t border-cyan-400/60" />
      <div className="fixed inset-x-0 top-[70%] border-t border-cyan-400/60" />
      <div className="fixed inset-x-0 top-[76%] border-t border-rose-500/70" />
    </div>
  );
}

/** Bottom-centre pills for toast notices (the real ones belong to the intro module). */
function ToastStandIn() {
  const notices = useNova((s) => s.notices);
  const toasts = notices.filter((n) => n.kind === 'toast');
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[26%] flex flex-col items-center gap-2" style={{ zIndex: 90 }}>
      {toasts.map((n) => (
        <Toast key={n.id} notice={n} />
      ))}
    </div>
  );
}

function Toast({ notice }: { notice: Notice }) {
  const [gone] = useState(() => performance.now() + notice.ttl * 1000);
  useEffect(() => {
    const id = window.setTimeout(() => useNova.getState().dismiss(notice.id), Math.max(0, gone - performance.now()));
    return () => window.clearTimeout(id);
  }, [gone, notice.id]);
  return (
    <div className="rounded-full bg-slate-900/90 px-4 py-2 font-mono text-[11px] text-cyan-100 ring-1 ring-cyan-300/30">
      <b className="mr-2 tracking-[0.2em] text-cyan-300">{notice.title}</b>
      {notice.lines.join(' ')}
    </div>
  );
}
