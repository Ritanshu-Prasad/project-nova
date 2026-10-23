import { LayoutGroup, motion } from 'framer-motion';
import { Check, Flag, Lock, Rocket } from 'lucide-react';
import { useId } from 'react';
import { passedModules, useActiveCourse } from '../../core/course';

const PLANET_TINTS = ['#f59e0b', '#a855f7', '#22d3ee', '#34d399', '#f472b6', '#60a5fa', '#fb7185', '#a3e635'];

interface Props {
  /** Small strip for cards, or the full journey map. */
  compact?: boolean;
  /** Called with a topic id when an unlocked planet is chosen. */
  onSelect?: (topicId: string) => void;
}

/**
 * The journey: one planet per module, with the rocket parked at the next planet to clear.
 * Deliberately static — the only motion is the rocket flying on (a shared layout transition) after a clear.
 */
export default function RocketProgress({ compact = false, onSelect }: Props) {
  const active = useActiveCourse();
  const id = useId();
  if (!active) return null;
  const { course, entry, next } = active;
  const modules = course.modules;
  const n = modules.length;
  const passedCount = passedModules(entry).length;
  const currentModuleIndex = next ? next.moduleIndex : passedCount;
  const size = compact ? 22 : 44;

  const rocket = (
    <motion.div layoutId={`rocket-${id}`} transition={{ duration: 1.3, ease: [0.45, 0, 0.2, 1] }} className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ bottom: `calc(50% + ${size / 2 + 4}px)` }} aria-hidden>
      <Rocket size={compact ? 16 : 24} className="rotate-45 text-white drop-shadow-[0_0_8px_rgb(var(--user-rgb))]" fill="var(--user)" />
    </motion.div>
  );

  return (
    <LayoutGroup id={id}>
      <div className={`scroll-y overflow-x-auto overflow-y-visible ${compact ? '' : 'pb-1'}`}>
        <ol className="flex min-w-full items-stretch" style={{ minWidth: compact ? undefined : n * 120 + 60 }} aria-label="Course journey">
          {modules.map((m, i) => {
            const done = !!entry.modules[m.id]?.passed;
            const locked = i > 0 && !entry.modules[modules[i - 1].id]?.passed;
            const here = i === currentModuleIndex;
            const tint = PLANET_TINTS[i % PLANET_TINTS.length];
            const clearedTopics = m.topics.filter((t) => !!entry.progress[t.id]?.cleared).length;
            const totalTopics = m.topics.length;
            const status = done ? 'Cleared' : here && locked ? 'Pass the previous module quiz first' : here ? 'Current destination' : locked ? 'Locked' : 'Open';
            const firstUnclearedTopic = m.topics.find((t) => !entry.progress[t.id]?.cleared) ?? m.topics[0];
            const moduleMinutes = m.topics.reduce((acc, t) => acc + (t.lesson?.minutes || 5), 0);

            return (
              <li key={m.id} className={`group relative flex flex-1 flex-col items-center ${compact ? 'h-12' : 'h-36 justify-center'}`}>
                {/* Route segment towards the next planet */}
                <div className="absolute left-1/2 top-1/2 h-0.5 w-full -translate-y-1/2" style={{ background: i < passedCount ? 'var(--user)' : 'transparent', borderTop: i < passedCount ? 'none' : '2px dashed rgb(255 255 255 / 0.14)' }} />
                <div className="relative mt-auto mb-auto" style={{ width: size, height: size }}>
                  {here && rocket}
                  <button
                    type="button"
                    disabled={locked || !onSelect || !firstUnclearedTopic}
                    onClick={() => firstUnclearedTopic && onSelect?.(firstUnclearedTopic.id)}
                    aria-label={`Planet ${i + 1}: ${m.title} — ${status}`}
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
                {!compact && (
                  <div className="absolute bottom-1 max-w-[110px] truncate text-center text-[11px] font-medium text-white/60">
                    Planet {i + 1}
                  </div>
                )}
                {/* Hover / focus tooltip */}
                <div className="pointer-events-none absolute bottom-[calc(50%+34px)] left-1/2 z-10 w-max max-w-[240px] -translate-x-1/2 rounded-xl border border-white/10 bg-[#0d1220]/95 px-3 py-2 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                  <div className="text-[13px] font-semibold text-white">Planet {i + 1} · {m.title}</div>
                  <div className="mt-0.5 text-[11px] text-white/55">
                    {clearedTopics}/{totalTopics} topics cleared · {status} · {moduleMinutes} min
                  </div>
                </div>
              </li>
            );
          })}
          <li className={`relative flex w-14 shrink-0 items-center justify-center ${compact ? 'h-12' : 'h-36'}`}>
            <div className="relative">
              {passedCount >= n && rocket}
              <Flag size={compact ? 16 : 22} className={passedCount >= n ? 'text-[var(--user)]' : 'text-white/45'} />
            </div>
          </li>
        </ol>
      </div>
    </LayoutGroup>
  );
}
