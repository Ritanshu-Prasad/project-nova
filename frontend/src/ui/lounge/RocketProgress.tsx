import { motion } from 'framer-motion';
import { Check, Flag, Lock, Rocket } from 'lucide-react';
import { findCourse, useCourse } from '../../core/course';

const PLANET_TINTS = ['#f59e0b', '#a855f7', '#22d3ee', '#34d399', '#f472b6', '#60a5fa'];

interface Props {
  /** Compact strip for the hub header, or the full map. */
  compact?: boolean;
  /** Called when an unlocked planet is chosen. */
  onSelect?: (index: number) => void;
}

/**
 * The journey bar: one planet per subtopic, a rocket parked at the next planet to clear.
 * Deliberately static — the only motion is the rocket flying on when a planet is cleared.
 */
export default function RocketProgress({ compact = false, onSelect }: Props) {
  const courseId = useCourse((s) => s.courseId);
  const cleared = useCourse((s) => s.cleared);
  const current = useCourse((s) => s.current);
  const subs = findCourse(courseId).subtopics;
  const n = subs.length;
  const x = (i: number) => 5 + (i * 82) / Math.max(1, n - 1);
  const rocketX = cleared >= n ? 95 : x(cleared);
  const size = compact ? 26 : 44;

  return (
    <div className={`relative w-full ${compact ? 'h-12' : 'h-32'}`} role="list" aria-label="Course journey">
      {/* Route: dashed for the whole trip, solid (your colour) for the distance covered */}
      <div className="absolute left-[5%] right-[5%] top-1/2 h-0 -translate-y-1/2 border-t-2 border-dashed border-white/15" />
      <motion.div
        className="absolute left-[5%] top-1/2 h-0.5 -translate-y-1/2 rounded-full"
        style={{ background: 'var(--user)', boxShadow: '0 0 12px rgb(var(--user-rgb) / 0.6)' }}
        initial={false}
        animate={{ width: `${rocketX - 5}%` }}
        transition={{ duration: 1.4, ease: [0.45, 0, 0.2, 1] }}
      />

      {subs.map((s, i) => {
        const done = i < cleared;
        const here = i === Math.min(cleared, n - 1) && cleared < n;
        const locked = i > cleared;
        const reviewing = i === current && !here;
        const tint = PLANET_TINTS[i % PLANET_TINTS.length];
        const status = done ? 'Cleared' : here ? 'Next destination' : 'Locked';
        return (
          <div key={s.planet} role="listitem" className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${x(i)}%` }}>
            <button
              type="button"
              disabled={locked || !onSelect}
              onClick={() => onSelect?.(i)}
              aria-label={`${s.planet}: ${s.title} — ${status}`}
              className={`relative grid place-items-center rounded-full transition-transform duration-200 enabled:cursor-pointer enabled:hover:scale-110 ${locked ? 'opacity-45 grayscale' : ''}`}
              style={{
                width: size,
                height: size,
                background: `radial-gradient(circle at 32% 30%, #ffffffcc 0%, ${tint} 28%, color-mix(in srgb, ${tint} 45%, #0b0f1a) 100%)`,
                boxShadow: done
                  ? '0 0 0 2px var(--user), 0 0 18px rgb(var(--user-rgb) / 0.55)'
                  : here || reviewing
                    ? '0 0 0 2px #ffffff, 0 0 16px rgb(255 255 255 / 0.35)'
                    : '0 0 0 1px rgb(255 255 255 / 0.15)',
              }}
            >
              {done && (
                <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full text-[var(--user-ink)]" style={{ background: 'var(--user)' }}>
                  <Check size={10} strokeWidth={3.5} />
                </span>
              )}
              {locked && !compact && <Lock size={14} className="text-white/80" />}
            </button>
            {!compact && (
              <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-center text-[11px] font-medium text-white/60">
                {s.planet}
              </div>
            )}
            {/* Hover / focus tooltip with the subtopic */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-3 w-max max-w-[220px] -translate-x-1/2 rounded-xl border border-white/10 bg-[#0d1220]/95 px-3 py-2 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              <div className="text-[13px] font-semibold text-white">{s.title}</div>
              <div className="mt-0.5 text-[11px] text-white/55">
                {s.planet} · {status}
              </div>
            </div>
          </div>
        );
      })}

      {/* Finish */}
      <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/60" style={{ left: '95%' }}>
        <Flag size={compact ? 16 : 22} className={cleared >= n ? 'text-[var(--user)]' : ''} />
      </div>

      {/* The rocket only moves when a planet is cleared */}
      <motion.div
        className="pointer-events-none absolute top-1/2"
        initial={false}
        animate={{ left: `${rocketX}%` }}
        transition={{ duration: 1.4, ease: [0.45, 0, 0.2, 1] }}
        style={{ marginTop: compact ? -30 : -52, marginLeft: compact ? -9 : -13 }}
        aria-hidden
      >
        <Rocket size={compact ? 18 : 26} className="rotate-45 text-white drop-shadow-[0_0_8px_rgb(var(--user-rgb))]" fill="var(--user)" />
      </motion.div>
    </div>
  );
}
