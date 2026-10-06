import { LayoutGroup, motion } from 'framer-motion';
import { Check, Flag, Lock, Rocket } from 'lucide-react';
import { useId } from 'react';
import { isUnlocked, useActiveCourse } from '../../core/course';

const PLANET_TINTS = ['#f59e0b', '#a855f7', '#22d3ee', '#34d399', '#f472b6', '#60a5fa', '#fb7185', '#a3e635'];

interface Props {
  /** Small strip for cards, or the full journey map. */
  compact?: boolean;
  /** Called with a topic id when an unlocked planet is chosen. */
  onSelect?: (topicId: string) => void;
}

/**
 * The journey: one planet per topic, grouped by module, with the rocket parked at the next planet to clear.
 * Deliberately static — the only motion is the rocket flying on (a shared layout transition) after a clear.
 */
export default function RocketProgress({ compact = false, onSelect }: Props) {
  const active = useActiveCourse();
  const id = useId();
  if (!active) return null;
  const { topics, cleared, entry, outline } = active;
  const n = topics.length;
  const size = compact ? 22 : 44;

  const rocket = (
    <motion.div layoutId={`rocket-${id}`} transition={{ duration: 1.3, ease: [0.45, 0, 0.2, 1] }} className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ bottom: `calc(50% + ${size / 2 + 4}px)` }} aria-hidden>
      <Rocket size={compact ? 16 : 24} className="rotate-45 text-white drop-shadow-[0_0_8px_rgb(var(--user-rgb))]" fill="var(--user)" />
    </motion.div>
  );

  return (
    <LayoutGroup id={id}>
      <div className={`scroll-y overflow-x-auto overflow-y-visible ${compact ? '' : 'pb-1'}`}>
        <ol className="flex min-w-full items-stretch" style={{ minWidth: compact ? undefined : n * 104 + 60 }} aria-label="Course journey">
          {topics.map((t, i) => {
            const done = !!entry.progress[t.id]?.cleared;
            const locked = !isUnlocked(entry, t.id, outline);
            const here = i === cleared;
            const tint = PLANET_TINTS[i % PLANET_TINTS.length];
            const firstOfModule = i === 0 || topics[i - 1].moduleIndex !== t.moduleIndex;
            const status = done ? 'Cleared' : here && locked ? 'Pass the module quiz first' : here ? 'Next destination' : locked ? 'Locked' : 'Open';
            return (
              <li key={t.id} className={`group relative flex flex-1 flex-col items-center ${compact ? 'h-12' : 'h-36 justify-center'} ${!compact && firstOfModule && i > 0 ? 'border-l border-dashed border-white/15' : ''}`}>
                {!compact && firstOfModule && (
                  <div className="absolute left-2 top-0 max-w-[220px] truncate text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    M{t.moduleIndex + 1} · {t.moduleTitle}
                  </div>
                )}
                {/* Route segment towards the next planet */}
                <div className="absolute left-1/2 top-1/2 h-0.5 w-full -translate-y-1/2" style={{ background: i < cleared ? 'var(--user)' : 'transparent', borderTop: i < cleared ? 'none' : '2px dashed rgb(255 255 255 / 0.14)' }} />
                <div className="relative mt-auto mb-auto" style={{ width: size, height: size }}>
                  {here && rocket}
                  <button
                    type="button"
                    disabled={locked || !onSelect}
                    onClick={() => onSelect?.(t.id)}
                    aria-label={`${t.planet}: ${t.title} — ${status}`}
                    className={`relative grid size-full place-items-center rounded-full transition-transform duration-200 enabled:cursor-pointer enabled:hover:scale-110 ${locked ? 'opacity-45 grayscale' : ''}`}
                    style={{
                      background: `radial-gradient(circle at 32% 30%, #ffffffcc 0%, ${tint} 28%, color-mix(in srgb, ${tint} 45%, #0b0f1a) 100%)`,
                      boxShadow: done ? '0 0 0 2px var(--user), 0 0 18px rgb(var(--user-rgb) / 0.5)' : here ? '0 0 0 2px #fff, 0 0 16px rgb(255 255 255 / 0.3)' : '0 0 0 1px rgb(255 255 255 / 0.15)',
                    }}
                  >
                    {done && (
                      <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full text-[var(--user-ink)]" style={{ background: 'var(--user)' }}>
                        <Check size={10} strokeWidth={3.5} />
                      </span>
                    )}
                    {locked && !compact && <Lock size={14} className="text-white/80" />}
                  </button>
                </div>
                {!compact && <div className="absolute bottom-1 max-w-[96px] truncate text-center text-[11px] font-medium text-white/60">{t.planet}</div>}
                {/* Hover / focus tooltip */}
                <div className="pointer-events-none absolute bottom-[calc(50%+34px)] left-1/2 z-10 w-max max-w-[230px] -translate-x-1/2 rounded-xl border border-white/10 bg-[#0d1220]/95 px-3 py-2 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                  <div className="text-[13px] font-semibold text-white">{t.title}</div>
                  <div className="mt-0.5 text-[11px] text-white/55">
                    {t.planet} · {status} · {t.lesson.minutes} min
                  </div>
                </div>
              </li>
            );
          })}
          <li className={`relative flex w-14 shrink-0 items-center justify-center ${compact ? 'h-12' : 'h-36'}`}>
            <div className="relative">
              {cleared >= n && rocket}
              <Flag size={compact ? 16 : 22} className={cleared >= n ? 'text-[var(--user)]' : 'text-white/45'} />
            </div>
          </li>
        </ol>
      </div>
    </LayoutGroup>
  );
}
