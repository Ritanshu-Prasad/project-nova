import { animate, motion } from 'framer-motion';
import { ArrowRight, ChevronsDown, ChevronsUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../../core/audio';
import { cheerPet } from '../../core/hub';
import { holoBurst } from '../../core/journey';
import { Z } from '../../core/layers';
import { rankOf } from '../../core/rank';
import { useNova } from '../../core/store';
import RankEmblem from './RankEmblem';

export interface Outcome {
  /** Net MMR change of the quiz. */
  delta: number;
  correct: number;
  total: number;
  /** Active course MMR before and after. */
  before: number;
  after: number;
  /** Bonus multiplier that applied (pop quizzes). */
  multiplier?: number;
}

type Mode = 'victory' | 'defeat' | 'even';

const COPY: Record<Mode, { title: string; line: string; tint: string }> = {
  victory: { title: 'VICTORY', line: 'Thrusters at full burn — you climbed the ladder.', tint: '#fcd34d' },
  defeat: { title: 'DEFEAT', line: 'Caught in a gravity well. Every miss shows you what to review — regroup and fly again.', tint: '#fb7185' },
  even: { title: 'HOLDING ORBIT', line: 'No change this round — steady flying.', tint: '#7dd3fc' },
};

/**
 * The after-quiz moment: a galactic victory (warp burst) or defeat (black-hole pull), the MMR counting up or
 * down, and the rank bar moving — with a promotion or demotion called out. Shown only once the quiz is over.
 */
export default function QuizOutcome({ outcome, onDone }: { outcome: Outcome; onDone: () => void }) {
  const mode: Mode = outcome.delta > 0 ? 'victory' : outcome.delta < 0 ? 'defeat' : 'even';
  const rm = useNova((s) => s.reducedMotion);
  const a = rankOf(outcome.before);
  const b = rankOf(outcome.after);
  const promoted = b.step > a.step;
  const demoted = b.step < a.step;
  const copy = COPY[mode];
  const [shown, setShown] = useState(rm ? outcome.delta : 0);
  const [ready, setReady] = useState(rm);

  useEffect(() => {
    audio.play(mode === 'victory' ? 'arrive' : mode === 'defeat' ? 'warpOut' : 'notify');
    if (mode === 'victory') {
      cheerPet();
      holoBurst(1);
    }
    if (rm) return;
    const count = animate(0, outcome.delta, { duration: 1.3, delay: 0.7, ease: 'easeOut', onUpdate: (v) => setShown(Math.round(v)) });
    const t = window.setTimeout(() => setReady(true), 1500);
    return () => {
      count.stop();
      clearTimeout(t);
    };
  }, [mode, outcome.delta, rm]);

  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [ready, onDone]);

  // Bar: from the old position to the new one (a full sweep when the division changes).
  const fromPct = promoted ? 0 : demoted ? 100 : a.progress * 100;
  const toPct = b.progress * 100;

  return (
    <motion.div
      role="dialog"
      aria-label={`${copy.title}: ${outcome.delta >= 0 ? '+' : ''}${outcome.delta} MMR`}
      className="pointer-events-auto fixed inset-0 grid place-items-center overflow-hidden font-sans"
      style={{ zIndex: Z.notices + 2 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      <div className="absolute inset-0 bg-[#03050b]/92 backdrop-blur-md" />
      {!rm && <GalaxyFx mode={mode} />}
      {mode === 'defeat' && !rm && <BlackHole />}
      {mode === 'victory' && !rm && (
        <motion.div
          className="absolute left-1/2 top-1/2 size-[140vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgb(255 255 255 / 0.9) 0%, rgb(var(--user-rgb) / 0.5) 12%, rgb(252 211 77 / 0.15) 30%, transparent 55%)' }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
      )}

      <motion.div
        className="relative mx-4 flex w-[min(520px,calc(100vw-32px))] flex-col items-center text-center"
        initial={rm ? false : mode === 'defeat' ? { scale: 1.1, opacity: 0, rotate: -3 } : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.7, delay: 0.25, ease: [0.2, 1.3, 0.4, 1] }}
      >
        <motion.div initial={rm ? false : { y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
          <RankEmblem rank={b} size={96} />
        </motion.div>
        <h2
          className="mt-5 font-display text-5xl font-bold tracking-[0.18em] sm:text-6xl"
          style={{ color: copy.tint, textShadow: `0 0 28px ${copy.tint}aa, 0 0 2px #fff` }}
        >
          {copy.title}
        </h2>
        <div className={`mt-3 font-display text-4xl font-bold tabular-nums ${mode === 'defeat' ? 'text-rose-300' : mode === 'victory' ? 'text-emerald-300' : 'text-sky-200'}`}>
          {shown > 0 ? '+' : shown < 0 ? '−' : '±'}
          {Math.abs(shown)} MMR
        </div>
        <p className="mt-2 text-base text-white/70">
          {outcome.correct} of {outcome.total} correct
          {outcome.multiplier && outcome.multiplier > 1 ? ` · ×${outcome.multiplier} bonus` : ''}
        </p>

        {/* Rank bar */}
        <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-white">{b.label}</span>
            <span className="tabular-nums text-white/60">{outcome.after.toLocaleString('en-IN')} MMR</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: b.tier.color }}
              initial={{ width: `${rm ? toPct : fromPct}%` }}
              animate={{ width: `${toPct}%` }}
              transition={{ duration: 1.2, delay: 0.9, ease: 'easeInOut' }}
            />
          </div>
          <div className="mt-1.5 text-xs text-white/50">{b.nextLabel ? `${b.toNext} MMR to ${b.nextLabel}` : 'Top of the ladder'}</div>
        </div>

        {(promoted || demoted) && (
          <motion.div
            initial={rm ? false : { scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.9, type: 'spring', stiffness: 260, damping: 16 }}
            className={`mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${promoted ? 'bg-amber-300 text-[#1a1203]' : 'bg-rose-500/20 text-rose-200'}`}
          >
            {promoted ? <ChevronsUp size={16} /> : <ChevronsDown size={16} />}
            {promoted ? (b.index > a.index ? `Rank up — you now fly a ${b.tier.name}!` : `Promoted to ${b.label}`) : `Dropped to ${b.label}`}
          </motion.div>
        )}

        <p className="mt-4 max-w-sm text-sm text-white/55">{copy.line}</p>

        <motion.button
          type="button"
          onClick={onDone}
          initial={{ opacity: 0, y: 10 }}
          animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          className="mt-6 flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-[var(--user-ink)] transition hover:brightness-110"
          style={{ background: 'var(--user)', pointerEvents: ready ? 'auto' : 'none' }}
        >
          See results <ArrowRight size={15} />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

/** A swirling accretion disk with a dark core — the gravity well of a lost round. */
function BlackHole() {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      initial={{ scale: 0.2, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, x: [0, -6, 6, -3, 3, 0] }}
      transition={{ duration: 1.2, x: { delay: 0.3, duration: 0.5 } }}
    >
      <motion.div
        className="size-[min(78vmin,620px)] rounded-full opacity-70 blur-[2px]"
        style={{ background: 'conic-gradient(from 0deg, transparent, #fb7185 12%, #a855f7 25%, transparent 38%, #f97316 52%, transparent 64%, #a855f7 78%, #fb7185 90%, transparent)', maskImage: 'radial-gradient(circle, transparent 30%, #000 34%, #000 52%, transparent 70%)', WebkitMaskImage: 'radial-gradient(circle, transparent 30%, #000 34%, #000 52%, transparent 70%)' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute left-1/2 top-1/2 size-[min(26vmin,210px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black shadow-[0_0_60px_20px_rgb(0_0_0/0.9),0_0_120px_30px_rgb(168_85_247/0.35)]" />
    </motion.div>
  );
}

interface P {
  a: number;
  r: number;
  v: number;
  life: number;
  c: string;
  w: number;
}

/** Canvas particles: warp streaks bursting outward (victory), a spiral into the dark (defeat), or slow drift. */
function GalaxyFx({ mode }: { mode: Mode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const user = getComputedStyle(document.documentElement).getPropertyValue('--user').trim() || '#7c5cff';
    const palette = mode === 'victory' ? ['#ffffff', '#fde68a', user, '#fcd34d'] : mode === 'defeat' ? ['#fb7185', '#c084fc', '#f97316', '#ffffff'] : ['#bae6fd', '#ffffff', user];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener('resize', size);
    const maxR = () => Math.hypot(w, h) / 2;
    const spawn = (): P => {
      const c = palette[Math.floor(Math.random() * palette.length)];
      if (mode === 'victory') return { a: Math.random() * Math.PI * 2, r: Math.random() * 30, v: 2 + Math.random() * 6, life: 1, c, w: 1 + Math.random() * 2 };
      if (mode === 'defeat') return { a: Math.random() * Math.PI * 2, r: maxR() * (0.6 + Math.random() * 0.5), v: 0.6 + Math.random() * 1.2, life: 1, c, w: 1 + Math.random() * 1.6 };
      return { a: Math.random() * Math.PI * 2, r: Math.random() * maxR(), v: 0.15 + Math.random() * 0.3, life: 1, c, w: 1 + Math.random() };
    };
    const ps: P[] = Array.from({ length: mode === 'victory' ? 260 : 200 }, spawn);
    let t0 = performance.now();
    let last = t0;
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(50, now - last) / 16.7;
      last = now;
      const age = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      // Burst for the first seconds, then a calmer ambient flow.
      const pace = mode === 'victory' ? (age < 1.6 ? 2.6 : 0.7) : 1;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const x0 = cx + Math.cos(p.a) * p.r;
        const y0 = cy + Math.sin(p.a) * p.r;
        if (mode === 'victory') {
          p.v *= 1 + 0.035 * dt;
          p.r += p.v * dt * pace;
        } else if (mode === 'defeat') {
          // Faster swirl and pull as the particle nears the core.
          const k = 1 - Math.min(0.95, p.r / maxR());
          p.a += (0.004 + 0.06 * k * k) * dt;
          p.r -= p.v * (0.6 + 4 * k) * dt;
        } else {
          p.a += 0.0015 * dt;
        }
        const x1 = cx + Math.cos(p.a) * p.r;
        const y1 = cy + Math.sin(p.a) * p.r;
        const near = mode === 'defeat' ? Math.min(1, p.r / 140) : 1;
        ctx.globalAlpha = Math.max(0, Math.min(1, near * (mode === 'victory' ? Math.min(1, p.r / 60) : 0.9)));
        ctx.strokeStyle = p.c;
        ctx.lineWidth = p.w;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(mode === 'even' ? x0 + 0.5 : x1, mode === 'even' ? y0 + 0.5 : y1);
        ctx.stroke();
        if ((mode === 'victory' && p.r > maxR()) || (mode === 'defeat' && p.r < 60)) ps[i] = spawn();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
    };
  }, [mode]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 size-full" aria-hidden />;
}
