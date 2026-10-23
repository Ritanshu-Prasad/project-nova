import { motion } from 'framer-motion';
import { Award, BookOpen, Plus, SkipForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../../core/audio';
import { useCourse } from '../../core/course';
import { useFinale } from '../../core/finale';
import { currentQuality, useGraphics } from '../../core/graphics';
import { openForge, useHub, useProfile } from '../../core/hub';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';
import NovaMark from '../hud/NovaMark';

/** Seconds from the start: the charge ends and the blast goes off; the headline, thank-you card and certificate note follow. */
const FULL = { blast: 2, head: 2.7, card: 6.2, cert: 8.8 } as const;
const CALM = { blast: 0.6, head: 0.9, card: 2.4, cert: 4.2 } as const;

const HUES = [190, 270, 330, 45, 150];
const BASE_PARTICLES = 520;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
}

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The Nova blast: a charge, a blast (one soft flash, shock rings, a starburst, god rays), an afterglow with the
 * "course mastered" headline, a thank-you with two ways on, and — last — where to collect the certificate.
 * Reduced motion and "No 3D" get a calm version: glow and rings, no particles, no flash, no shake.
 */
export default function NovaBlast() {
  const title = useFinale((s) => s.title);
  const courseId = useFinale((s) => s.courseId);
  const accent = useNova((s) => s.themeColor);
  const reduced = useNova((s) => s.reducedMotion);
  const level = useGraphics((g) => g.level);
  const pilot = useProfile((s) => s.callsign) || 'Pilot';
  const calm = reduced || level === 'none';
  const T = reduced ? CALM : FULL;
  const [stage, setStage] = useState(0); // 0 charge · 1 headline · 2 thank-you card · 3 certificate note
  const canvas = useRef<HTMLCanvasElement>(null);
  const skipped = useRef(false);
  const primary = useRef<HTMLButtonElement>(null);

  const close = () => useFinale.getState().hide();
  const skip = () => {
    skipped.current = true;
    setStage((s) => Math.max(s, 2));
  };

  // Sound and the stage timers.
  useEffect(() => {
    void audio.init();
    audio.play(reduced ? 'quest' : 'novaBlast');
    const timers = [
      setTimeout(() => setStage((s) => Math.max(s, 1)), T.head * 1000),
      setTimeout(() => (setStage((s) => Math.max(s, 2)), audio.play('chime')), T.card * 1000),
      setTimeout(() => setStage((s) => Math.max(s, 3)), T.cert * 1000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [T, reduced]);

  // Once skipped, the certificate note still waits a beat after the card.
  useEffect(() => {
    if (stage !== 2 || !skipped.current) return;
    const id = setTimeout(() => setStage((s) => Math.max(s, 3)), 1500);
    return () => clearTimeout(id);
  }, [stage]);

  useEffect(() => {
    if (stage >= 2) primary.current?.focus({ preventScroll: true });
  }, [stage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (stage < 2) skip();
      else close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [stage]);

  // The particle show (2D canvas; skipped for calm mode).
  useEffect(() => {
    const el = canvas.current;
    if (!el || calm) return;
    const g = el.getContext('2d');
    if (!g) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
    };
    size();
    window.addEventListener('resize', size);

    const budget = Math.round(BASE_PARTICLES * currentQuality().particles);
    const colors = [accent, ...HUES.map((hue) => `hsl(${hue} 95% 66%)`)];
    const pick = () => colors[Math.floor(Math.random() * colors.length)];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    // Charge: sparks spiral in towards the core, starting at different moments.
    const inbound = Array.from({ length: Math.round(budget * 0.6) }, () => ({ a: rnd(0, 6.283), r: rnd(0.25, 0.75), spin: rnd(1.5, 3.5) * (Math.random() < 0.5 ? -1 : 1), delay: rnd(0, 1.2), color: pick(), size: rnd(1, 2.4) }));
    let sparks: Spark[] = [];
    let burst = false;
    let offset = 0;
    let start = performance.now();
    let last = start;
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let e = Math.max(0, (now - start) / 1000) + offset; // a frame can be stamped just before `start`
      if (skipped.current && e < FULL.blast) {
        offset += FULL.blast - e;
        e = FULL.blast;
      }
      const cx = w / 2;
      const cy = h * 0.42;
      const R = Math.max(w, h);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';

      if (e >= FULL.blast && !burst) {
        burst = true;
        sparks = Array.from({ length: budget }, () => {
          const a = rnd(0, 6.283);
          const sp = 160 + Math.pow(Math.random(), 1.7) * 1500;
          return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: rnd(1.4, 3.4), size: rnd(1, 3), color: pick() };
        });
      }

      // Contracting rings and the swelling core.
      if (e < FULL.blast) {
        const p = e / FULL.blast;
        for (let i = 0; i < 3; i++) {
          const q = (p * 1.4 + i / 3) % 1;
          g.globalAlpha = 0.5 * p * (1 - q);
          g.strokeStyle = i === 0 ? accent : `hsl(${HUES[i]} 95% 66%)`;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(cx, cy, R * 0.55 * (1 - q) + 12, 0, 6.283);
          g.stroke();
        }
        for (const s of inbound) {
          const q = clamp01((e - s.delay) / (FULL.blast - s.delay));
          if (q <= 0 || q >= 1) continue;
          const r = s.r * R * (1 - q * q * q);
          const a = s.a + s.spin * q;
          g.globalAlpha = Math.min(1, q * 2) * 0.9;
          g.fillStyle = s.color;
          g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s.size, s.size);
        }
      }
      const core = e < FULL.blast ? 6 + 120 * Math.pow(e / FULL.blast, 2.2) : 130 * (1 - 0.55 * clamp01((e - FULL.blast) / 1.5)) + 8 * Math.sin(e * 1.6);
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, core * 2.4);
      glow.addColorStop(0, 'rgba(255,255,255,0.95)');
      glow.addColorStop(0.25, 'rgba(255,255,255,0.45)');
      glow.addColorStop(0.55, accent + '66');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = e < FULL.blast ? 0.4 + 0.6 * (e / FULL.blast) : 0.85 - 0.45 * clamp01((e - FULL.blast) / 3);
      g.fillStyle = glow;
      g.beginPath();
      g.arc(cx, cy, core * 2.4, 0, 6.283);
      g.fill();

      if (e >= FULL.blast) {
        const t = e - FULL.blast;
        // Shock rings.
        for (let i = 0; i < 3; i++) {
          const p = clamp01((t - i * 0.14) / 1.9);
          if (p <= 0 || p >= 1) continue;
          const r = easeOut(p) * R * 0.78;
          const hue = [190, 280, 40][i];
          g.strokeStyle = `hsl(${hue} 95% 68%)`;
          g.globalAlpha = Math.pow(1 - p, 1.6) * 0.25;
          g.lineWidth = 46 * (1 - p) + 6;
          g.beginPath();
          g.arc(cx, cy, r, 0, 6.283);
          g.stroke();
          g.globalAlpha = Math.pow(1 - p, 1.4) * 0.9;
          g.lineWidth = 12 * (1 - p) + 1.5;
          g.stroke();
        }
        // God rays, turning slowly while they fade.
        const rays = 1 - clamp01(t / 4.5);
        if (rays > 0) {
          const beam = g.createLinearGradient(0, 0, R, 0);
          beam.addColorStop(0, 'rgba(255,255,255,0.55)');
          beam.addColorStop(0.5, accent + '33');
          beam.addColorStop(1, 'rgba(0,0,0,0)');
          g.save();
          g.translate(cx, cy);
          g.fillStyle = beam;
          g.globalAlpha = 0.5 * rays * Math.min(1, t * 3);
          for (let i = 0; i < 14; i++) {
            g.save();
            g.rotate((i / 14) * 6.283 + t * 0.12);
            g.beginPath();
            g.moveTo(0, 0);
            g.lineTo(R, -R * 0.045);
            g.lineTo(R, R * 0.045);
            g.fill();
            g.restore();
          }
          g.restore();
        }
        // Afterglow embers: a slow, soft rain of sparks.
        if (Math.random() < budget * 0.0004 * 60 * dt) {
          sparks.push({ x: rnd(0, w), y: -10, vx: rnd(-14, 14), vy: rnd(24, 70), age: 0, life: rnd(4, 7), size: rnd(1, 2.4), color: pick() });
        }
      }

      // Starburst particles with short trails.
      const keep: Spark[] = [];
      for (const s of sparks) {
        s.age += dt;
        if (s.age >= s.life) continue;
        const drag = Math.exp(-(s.vy > 0 && s.vy < 100 && s.vx < 40 ? 0 : 1.7) * dt);
        s.vx *= drag;
        s.vy *= drag;
        const px = s.x;
        const py = s.y;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const k = s.age / s.life;
        g.globalAlpha = Math.pow(1 - k, 1.2) * (s.life > 3.9 ? 0.8 * Math.sin(Math.PI * k) : 1);
        g.strokeStyle = s.color;
        g.lineWidth = s.size;
        g.beginPath();
        g.moveTo(px - s.vx * 0.018, py - s.vy * 0.018);
        g.lineTo(s.x, s.y);
        g.stroke();
        keep.push(s);
      }
      sparks = keep;
      g.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
    };
  }, [calm, accent]);

  const revisit = () => {
    close();
    if (!courseId) return;
    useCourse.getState().setActive(courseId);
    useHub.getState().go('journey');
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Course mastered"
      className={`fixed inset-0 grid place-items-center overflow-y-auto ${stage >= 2 ? '' : 'overflow-hidden'}`}
      style={{ zIndex: Z.notices + 1 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <div className="nova-dim absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgb(8_10_24/0.78),rgb(2_3_10/0.94))]" aria-hidden="true" />
      <div className="absolute inset-0 bg-black/55 transition-opacity duration-1000" style={{ opacity: stage >= 2 ? 1 : 0 }} aria-hidden="true" />
      <div className={`absolute inset-0 ${calm ? '' : 'nova-shake'}`} aria-hidden="true">
        {calm ? <CalmBlast accent={accent} blast={T.blast} /> : <canvas ref={canvas} className="absolute inset-0 h-full w-full" />}
      </div>
      {!calm && <div className="nova-flash pointer-events-none absolute inset-0" style={{ animationDelay: `${FULL.blast}s` }} aria-hidden="true" />}

      <div className="relative flex w-full max-w-xl flex-col items-center px-5 py-10 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: stage >= 1 ? 1 : 0, scale: stage >= 1 ? 1 : 0.6 }} transition={{ duration: 0.7, type: 'spring', stiffness: 160, damping: 18 }} className="flex items-center gap-2 font-display text-sm tracking-[0.5em] text-cyan-200">
          <NovaMark className="h-6 w-6" /> NOVA
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 14, letterSpacing: '0.7em' }}
          animate={stage >= 1 ? { opacity: 1, y: 0, letterSpacing: '0.18em' } : {}}
          transition={{ duration: reduced ? 0.4 : 1.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="nova-title mt-3 font-display text-4xl font-bold uppercase leading-tight sm:text-6xl"
          style={{ ['--a' as string]: accent }}
        >
          Course mastered
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={stage >= 1 ? { opacity: 1, y: 0 } : {}} transition={{ delay: reduced ? 0.1 : 0.5, duration: 0.8 }} className="mt-3 max-w-md font-display text-xl font-semibold text-white sm:text-2xl">
          {title}
        </motion.p>

        {stage >= 2 && (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mt-7 w-full">
            <p className="text-base leading-relaxed text-white/85">
              Thank you for flying with NOVA, <span style={{ color: accent }} className="font-semibold">{pilot}</span>. Every planet is cleared and the whole journey is behind you — you should be proud.
            </p>
            <p className="mt-3 text-sm text-white/60">Ready for what’s next? Chart a brand-new journey, or go back and revisit where you’ve been.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <button
                ref={primary}
                type="button"
                onClick={() => (close(), openForge())}
                className="flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-[var(--user-ink)] shadow-[0_0_26px_-4px_var(--user)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={{ background: 'var(--user)' }}
              >
                <Plus size={16} /> Start a new journey
              </button>
              {courseId && (
                <button type="button" onClick={revisit} className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
                  <BookOpen size={16} /> Revisit this course
                </button>
              )}
              <button type="button" onClick={close} className="cursor-pointer rounded-xl px-4 py-3 text-sm text-white/60 transition hover:text-white focus-visible:outline-2 focus-visible:outline-white">
                Close
              </button>
            </div>
          </motion.div>
        )}

        {stage >= 3 && (
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="mt-6 flex max-w-md items-start gap-2 rounded-xl bg-amber-300/[0.08] px-4 py-3 text-left text-xs leading-relaxed text-amber-100/90 ring-1 ring-amber-300/25" role="status">
            <Award size={15} className="mt-0.5 shrink-0 text-amber-300" />
            <span>Your certificate is waiting. Revisit the course any time to collect it — from the award icon on your course in Profile, or from the last planet’s results page.</span>
          </motion.p>
        )}
      </div>

      {stage < 2 && (
        <button type="button" onClick={skip} className="absolute bottom-5 right-5 flex cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white/80 ring-1 ring-white/15 transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
          <SkipForward size={13} /> Skip
        </button>
      )}
    </motion.div>
  );
}

/** Calm version (reduced motion / No 3D): a glow and rings that ease out, nothing sudden. */
function CalmBlast({ accent, blast }: { accent: string; blast: number }) {
  return (
    <div className="absolute inset-0" style={{ ['--a' as string]: accent, ['--d' as string]: `${blast}s` }}>
      <div className="nova-calm-glow absolute left-1/2 top-[42%] h-[70vmin] w-[70vmin] rounded-full" />
      {[0, 0.25, 0.5].map((delay) => (
        <div key={delay} className="nova-calm-ring absolute left-1/2 top-[42%] h-[40vmin] w-[40vmin] rounded-full border-2" style={{ animationDelay: `calc(var(--d) + ${delay}s)` }} />
      ))}
    </div>
  );
}
