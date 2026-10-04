import { useEffect, useRef } from 'react';
import { Z } from '../../core/layers';
import { clamp, damp, easeInOutCubic, easeOutCubic, wobble } from '../../core/math';
import { rt } from '../../core/runtime';
import { phaseIndex, useNova } from '../../core/store';
import { useRaf } from '../../core/useRaf';
import BootLog from './BootLog';
import CornerBrackets from './CornerBrackets';
import HeadingTape from './HeadingTape';
import PitchLadder from './PitchLadder';
import { LeftReadouts, MobileReadout, RightReadouts } from './SideReadouts';
import StatusLine from './StatusLine';
import { hudBus, resetHudBus } from './hudBus';
import { BOOT, flickerIn, hash1 } from './hudMath';
import './hud.css';

const PREFLIGHT = phaseIndex('preflight');

/** Boot start (s) of each segment, in render order. */
const SEG_START = [BOOT.brackets, BOOT.center, BOOT.tape, BOOT.left, BOOT.right, BOOT.status] as const;
const SEG = { brackets: 0, center: 1, tape: 2, left: 3, right: 4, status: 5 } as const;

/**
 * Canopy head-up display (pointer-events none, aria-hidden — purely visual).
 * Mounted from pre-flight on; its opacity follows rt.hud (the neural link) and it boots with a
 * flicker + scan sweep the first time it appears. Every value updates per frame through refs.
 */
export default function Hud() {
  const phase = useNova((s) => s.phase);
  return phaseIndex(phase) >= PREFLIGHT ? <HudLayer /> : null;
}

function HudLayer() {
  const reduced = useNova((s) => s.reducedMotion);
  const frameRef = useRef<HTMLDivElement>(null);
  const scanRef = useRef<HTMLDivElement>(null);
  const segRefs = useRef<(HTMLDivElement | null)[]>([]);
  const segAlpha = useRef<number[]>(SEG_START.map(() => -1));
  /** Damped declutter factors: side columns, right column, centre symbology. */
  const mix = useRef({ side: 1, right: 1, center: 1 });
  const lastFrame = useRef({ opacity: -1, visible: false });

  useEffect(() => {
    resetHudBus();
    const onResize = () => {
      hudBus.w = window.innerWidth;
      hudBus.h = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      hudBus.visible = false;
    };
  }, []);

  useRaf((dt, time) => {
    const frame = frameRef.current;
    const scan = scanRef.current;
    if (!frame || !scan) return;
    const s = useNova.getState();
    const rm = rt.reducedMotion;
    const alpha = clamp(rt.hud);
    const visible = alpha > 0.003;
    hudBus.visible = visible;
    const lf = lastFrame.current;

    if (!visible) {
      if (lf.visible) {
        frame.style.visibility = 'hidden';
        scan.style.visibility = 'hidden';
        lf.visible = false;
      }
      return;
    }
    if (!lf.visible) {
      frame.style.visibility = 'visible';
      lf.visible = true;
    }

    hudBus.bootT = hudBus.bootT < 0 ? 0 : hudBus.bootT + dt;
    const bt = hudBus.bootT;

    // Declutter once landed: centre symbology out (the hero sits there), side columns dimmed,
    // right column hidden while a pillar panel covers it.
    const landed = s.phase === 'landed';
    const m = mix.current;
    m.side = damp(m.side, landed ? 0.45 : 1, 4, dt);
    m.right = damp(m.right, s.activePillar !== null ? 0 : landed ? 0.45 : 1, 7, dt);
    m.center = damp(m.center, landed ? 0 : 1, 3, dt);
    const factor = [1, m.center, 1, m.side, m.right, 1];

    for (let i = 0; i < SEG_START.length; i++) {
      const el = segRefs.current[i];
      if (!el) continue;
      const a = flickerIn(bt - SEG_START[i], BOOT.flicker, i + 1, rm) * factor[i];
      if (Math.abs(a - segAlpha.current[i]) > 0.002) {
        segAlpha.current[i] = a;
        el.style.opacity = a.toFixed(3);
        el.style.visibility = a < 0.002 ? 'hidden' : 'visible';
      }
    }

    // Corner brackets draw on.
    const brackets = segRefs.current[SEG.brackets];
    if (brackets && bt < BOOT.done) {
      const draw = rm ? 1 : easeOutCubic(clamp((bt - BOOT.brackets) / BOOT.bracketsDraw));
      brackets.style.setProperty('--hud-draw-off', (1 - draw).toFixed(3));
    }

    // Master opacity (neural link fade-in).
    if (Math.abs(alpha - lf.opacity) > 0.002) {
      lf.opacity = alpha;
      frame.style.opacity = alpha.toFixed(3);
    }

    // Physicality: a few px of shake jitter, a hint of parallax with the head, a glitch kick on boot.
    let x = rt.yaw * 20;
    let y = rt.pitch * 20;
    if (!rm) {
      x += wobble(time * 31, 1.7) * rt.shake * 5;
      y += wobble(time * 37, 3.1) * rt.shake * 4;
      if (bt < 0.55) {
        const step = Math.floor(bt * 30);
        if (hash1(step) > 0.72) x += (hash1(step + 7.1) - 0.5) * 16;
      }
    }
    frame.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`;

    // Boot scan sweep (top → bottom).
    if (!rm && bt < BOOT.scan + 0.25) {
      const p = easeInOutCubic(clamp(bt / BOOT.scan));
      scan.style.visibility = 'visible';
      scan.style.opacity = (1 - clamp((bt - BOOT.scan) / 0.25)).toFixed(3);
      scan.style.transform = `translate3d(0,${(p * (hudBus.h + 140) - 140).toFixed(1)}px,0)`;
    } else if (scan.style.visibility !== 'hidden') {
      scan.style.visibility = 'hidden';
    }
  });

  const seg = (i: number) => (el: HTMLDivElement | null) => {
    segRefs.current[i] = el;
  };

  return (
    <div
      aria-hidden="true"
      data-rm={reduced || undefined}
      className="pointer-events-none fixed inset-0 overflow-hidden select-none"
      style={{ zIndex: Z.hud }}
    >
      <div ref={frameRef} className="absolute inset-0 will-change-transform" style={{ visibility: 'hidden', opacity: 0 }}>
        <div ref={seg(SEG.brackets)} className="absolute inset-0" style={{ opacity: 0 }}>
          <CornerBrackets />
        </div>
        <div ref={seg(SEG.center)} className="absolute inset-0" style={{ opacity: 0 }}>
          <PitchLadder />
          <BootLog />
        </div>
        <div ref={seg(SEG.tape)} className="absolute inset-0" style={{ opacity: 0 }}>
          <HeadingTape />
          <MobileReadout />
        </div>
        <div ref={seg(SEG.left)} className="absolute inset-0" style={{ opacity: 0 }}>
          <LeftReadouts />
        </div>
        <div ref={seg(SEG.right)} className="absolute inset-0" style={{ opacity: 0 }}>
          <RightReadouts />
        </div>
        <div ref={seg(SEG.status)} className="absolute inset-0" style={{ opacity: 0 }}>
          <StatusLine />
        </div>
      </div>
      <div
        ref={scanRef}
        className="hud-scan absolute inset-x-0 top-0 h-35 will-change-transform"
        style={{ visibility: 'hidden' }}
      />
    </div>
  );
}
