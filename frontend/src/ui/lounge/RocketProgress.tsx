import { motion } from 'framer-motion';
import { Check, Lock, Rocket, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { passedModules, useActiveCourse } from '../../core/course';
import { useFinale } from '../../core/finale';
import { routeLayout } from './routeLayout';

const PLANET_TINTS = ['#fb923c', '#a855f7', '#22d3ee', '#34d399', '#f472b6', '#60a5fa', '#fb7185', '#a3e635'];

interface Props {
  /** Small strip for cards, or the full journey map. */
  compact?: boolean;
  /** Called with a topic id when an unlocked planet is chosen. */
  onSelect?: (topicId: string) => void;
}

interface Point {
  x: number;
  y: number;
}

export default function RocketProgress({ compact = false, onSelect }: Props) {
  const active = useActiveCourse();
  const id = useId();
  const scrollRef = useRef<HTMLDivElement>(null);

  const modules = active?.course.modules ?? [];
  const n = modules.length;
  const entry = active?.entry;
  const next = active?.next;
  const passedCount = entry ? passedModules(entry).length : 0;
  const isCourseComplete = passedCount >= n && n > 0;

  // Destination: next uncompleted module, or graduation flag if all modules are complete
  const destinationIndex = isCourseComplete ? n : next ? next.moduleIndex : Math.min(passedCount, n - 1);

  // Scoped session storage key per course
  const storageKey = `nova.route.lastPlanet.${active?.course.id ?? 'default'}`;

  // Track replay key to allow replaying flight animation smoothly
  const [replayKey, setReplayKey] = useState<number>(0);

  // Determine starting position for flight:
  // - If saved position exists and is prior to destination, fly from saved position (e.g. 0 -> 2)
  // - Otherwise, fly from previous position (e.g. module 2 done -> from 1 to 2)
  // - If at module 0, fly in from entry corridor
  const [fromIndex, setFromIndex] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < destinationIndex) {
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
    return Math.max(0, destinationIndex - 1);
  });

  const [isFlying, setIsFlying] = useState<boolean>(true);

  // Replay flight animation
  const replayFlight = useCallback(() => {
    setFromIndex(Math.max(0, destinationIndex - 1));
    setIsFlying(true);
    setReplayKey((k) => k + 1);
  }, [destinationIndex]);

  // The window's width: the route stretches to fill it (see routeLayout.ts).
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || compact || typeof ResizeObserver === 'undefined') return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact, active]);

  // Geometry: undulating wave coordinates (ss1 style)
  // Even planets are lower, odd planets are higher; the supernova is the last waypoint (index n).
  const { stepWidth, startX, amplitude: waveAmplitude, totalWidth } = useMemo(() => routeLayout(width, n), [width, n]);
  const baseY = 120;
  const canvasHeight = 250;

  const planetCoords: Point[] = useMemo(() => {
    return Array.from({ length: n }, (_, i) => ({
      x: startX + i * stepWidth,
      y: baseY + (i % 2 === 0 ? waveAmplitude : -waveAmplitude),
    }));
  }, [n, startX, stepWidth, baseY, waveAmplitude]);

  // Supernova coordinates (waypoint index = n): spaced like every other stop
  const flagCoord: Point = useMemo(
    () => ({
      x: startX + n * stepWidth,
      y: baseY + (n % 2 === 0 ? waveAmplitude : -waveAmplitude),
    }),
    [n, startX, stepWidth, baseY, waveAmplitude],
  );

  // All waypoints: planet 0..n-1, plus the supernova at index n
  const allWaypoints: Point[] = useMemo(() => {
    return [...planetCoords, flagCoord];
  }, [planetCoords, flagCoord]);

  // Center scroll on destination planet
  useEffect(() => {
    if (scrollRef.current && !compact) {
      const destPoint = allWaypoints[destinationIndex] ?? planetCoords[0];
      if (destPoint) {
        const containerWidth = scrollRef.current.clientWidth;
        scrollRef.current.scrollTo({
          left: Math.max(0, destPoint.x - containerWidth / 2),
          behavior: 'smooth',
        });
      }
    }
  }, [destinationIndex, compact, allWaypoints, planetCoords, replayKey]);

  // SVG Cubic Bezier segment between two points with horizontal tangents
  const segmentD = (p1: Point, p2: Point) => {
    const midX = (p1.x + p2.x) / 2;
    return `C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
  };

  // Full unreached/future curve across all waypoints
  const fullWavePath = useMemo(() => {
    if (allWaypoints.length < 2) return '';
    let d = `M ${allWaypoints[0].x} ${allWaypoints[0].y}`;
    for (let i = 0; i < allWaypoints.length - 1; i++) {
      d += ` ${segmentD(allWaypoints[i], allWaypoints[i + 1])}`;
    }
    return d;
  }, [allWaypoints]);

  // Active glowing cyan neon path up to destinationIndex
  const activeNeonPath = useMemo(() => {
    const reach = Math.min(allWaypoints.length - 1, destinationIndex);
    if (reach <= 0 || allWaypoints.length < 2) return '';
    let d = `M ${allWaypoints[0].x} ${allWaypoints[0].y}`;
    for (let i = 0; i < reach; i++) {
      d += ` ${segmentD(allWaypoints[i], allWaypoints[i + 1])}`;
    }
    return d;
  }, [allWaypoints, destinationIndex]);

  // Ambient stars background for deep space aesthetic (matching ss1)
  const stars = useMemo(() => {
    const totalW = totalWidth;
    const seedStars: { cx: number; cy: number; r: number; opacity: number }[] = [];
    const count = Math.round(totalW / 28);
    for (let i = 0; i < count; i++) {
      const cx = (i * 29.3 + 17) % totalW;
      const cy = (i * 47.7 + 23) % canvasHeight;
      const r = (i % 3 === 0 ? 1.4 : i % 2 === 0 ? 1.0 : 0.7);
      const opacity = 0.2 + (i % 5) * 0.12;
      seedStars.push({ cx, cy, r, opacity });
    }
    return seedStars;
  }, [totalWidth, canvasHeight]);

  // Interpolated flight keyframes along the Bezier wave from fromIndex to destinationIndex
  const flightKeyframes = useMemo(() => {
    if (allWaypoints.length === 0) {
      return { xs: [0], ys: [0], angles: [35], duration: 1.5 };
    }

    const startIdx = Math.min(allWaypoints.length - 1, Math.max(0, fromIndex));
    const targetIdx = Math.min(allWaypoints.length - 1, Math.max(0, destinationIndex));

    // Entry flight if starting at planet 0 and no prior completed modules
    if (startIdx === targetIdx && targetIdx === 0) {
      const p = allWaypoints[0];
      const pStart = { x: p.x - 90, y: baseY - 15 };
      const midX = (pStart.x + p.x) / 2;
      const SAMPLES = 16;
      const xs: number[] = [];
      const ys: number[] = [];
      const angles: number[] = [];

      for (let k = 0; k <= SAMPLES; k++) {
        const t = k / SAMPLES;
        const u = 1 - t;
        const bx = u * u * u * pStart.x + 3 * u * u * t * midX + 3 * u * t * t * midX + t * t * t * p.x;
        const by = u * u * u * pStart.y + 3 * u * u * t * pStart.y + 3 * u * t * t * p.y + t * t * t * p.y;
        const dx = 3 * u * u * (midX - pStart.x) + 3 * t * t * (p.x - midX);
        const dy = 6 * u * t * (p.y - pStart.y);
        const tangent = (Math.atan2(dy, dx) * 180) / Math.PI;

        xs.push(bx);
        ys.push(by - 32);
        angles.push(Math.round(tangent + 45));
      }
      angles[angles.length - 1] = 35;
      return { xs, ys, angles, duration: 1.6 };
    }

    if (startIdx === targetIdx) {
      const p = allWaypoints[targetIdx];
      return {
        xs: [p.x - 45, p.x],
        ys: [p.y - 40, p.y - 32],
        angles: [25, 35],
        duration: 1.2,
      };
    }

    const xs: number[] = [];
    const ys: number[] = [];
    const angles: number[] = [];

    const stepDir = targetIdx > startIdx ? 1 : -1;
    const segments = Math.abs(targetIdx - startIdx);
    const SAMPLES_PER_SEGMENT = 16;

    for (let s = 0; s < segments; s++) {
      const idx = startIdx + s * stepDir;
      const nextIdx = idx + stepDir;
      const p1 = allWaypoints[idx];
      const p2 = allWaypoints[nextIdx];
      const midX = (p1.x + p2.x) / 2;

      for (let k = 0; k <= SAMPLES_PER_SEGMENT; k++) {
        if (s > 0 && k === 0) continue; // avoid duplicate point
        const t = k / SAMPLES_PER_SEGMENT;
        const u = 1 - t;

        // Cubic Bezier curve formula
        const bx = u * u * u * p1.x + 3 * u * u * t * midX + 3 * u * t * t * midX + t * t * t * p2.x;
        const by = u * u * u * p1.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p2.y;

        // Tangent derivatives
        const dx = 3 * u * u * (midX - p1.x) + 3 * t * t * (p2.x - midX);
        const dy = 6 * u * t * (p2.y - p1.y);
        const tangent = (Math.atan2(dy, dx) * 180) / Math.PI;

        xs.push(bx);
        ys.push(by - 32); // hover above curve
        // Lucide rocket icon points at -45 deg natively; rotating by tangent + 45 aligns rocket tip along path
        angles.push(Math.round(tangent + 45));
      }
    }

    // Settled resting angle at destination (pointing forward-upward)
    angles[angles.length - 1] = 35;

    const duration = Math.max(1.5, Math.min(3.2, segments * 1.05));
    return { xs, ys, angles, duration };
  }, [allWaypoints, fromIndex, destinationIndex, baseY]);

  if (!active) return null;

  // COMPACT MODE
  if (compact) {
    const compactSize = 22;
    return (
      <div className="scroll-y overflow-x-auto overflow-y-visible">
        <ol className="flex min-w-full items-center py-2" aria-label="Course journey">
          {modules.map((m, i) => {
            const done = !!entry?.modules[m.id]?.passed;
            const here = i === destinationIndex;
            const tint = PLANET_TINTS[i % PLANET_TINTS.length];
            return (
              <li key={m.id} className="relative flex flex-1 items-center">
                <div className="h-0.5 w-full" style={{ background: i < passedCount ? 'var(--user)' : 'rgba(255,255,255,0.14)' }} />
                <div
                  className="relative shrink-0 rounded-full"
                  style={{
                    width: compactSize,
                    height: compactSize,
                    background: `radial-gradient(circle at 30% 28%, #fff 0%, ${tint} 40%, #0b0f1a 100%)`,
                    boxShadow: here ? '0 0 10px #fff' : done ? '0 0 8px var(--user)' : undefined,
                  }}
                />
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  // FULL SS1 WAVE TRAJECTORY & GLOWING SPHERE ROUTE
  const totalSvgWidth = totalWidth;

  return (
    <div
      ref={scrollRef}
      className="relative overflow-x-auto overflow-y-hidden rounded-2xl py-2 select-none"
      style={{
        background: 'radial-gradient(ellipse at 50% 50%, rgba(15, 23, 42, 0.75) 0%, rgba(3, 7, 18, 0.95) 100%)',
        minHeight: canvasHeight + 10,
      }}
    >
      <div className="relative" style={{ width: Math.max(780, totalSvgWidth), height: canvasHeight }}>
        {/* Replay flight button — inside the scrolling route, so it travels with it as you scroll left or right */}
        <button
          type="button"
          onClick={replayFlight}
          title="Replay spaceship journey"
          className="absolute left-3 top-3 z-30 flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-slate-900/70 px-2.5 py-1 text-[11px] font-mono text-cyan-300 transition-all hover:border-cyan-400/40 hover:bg-cyan-950/40 hover:text-cyan-200"
        >
          <RotateCcw size={11} className={isFlying ? 'animate-spin' : ''} />
          <span>Replay flight</span>
        </button>
        {/* SVG Route Trajectory Curves & Stars */}
        <svg
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          style={{ width: Math.max(780, totalSvgWidth), height: canvasHeight }}
        >
          <defs>
            <filter id={`cyan-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`cyan-intense-${id}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.13  0 0 0 0 0.82  0 0 0 0 0.93  0 0 0 1 0" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Deep space background stars */}
          {stars.map((s, idx) => (
            <circle
              key={idx}
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              fill="#e2e8f0"
              opacity={s.opacity}
            />
          ))}

          {/* 1. Subtle dotted wave path for future/unreached sections */}
          <path
            d={fullWavePath}
            fill="none"
            stroke="rgba(56, 189, 248, 0.25)"
            strokeWidth="2.2"
            strokeDasharray="4 6"
            strokeLinecap="round"
          />

          {/* 2. Active Cleared / Glowing Cyan Trail (ss1 neon style) */}
          {activeNeonPath && (
            <>
              {/* Soft atmospheric cyan halo */}
              <path
                d={activeNeonPath}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="9"
                strokeOpacity="0.25"
                filter={`url(#cyan-glow-${id})`}
                strokeLinecap="round"
              />
              {/* Vivid neon cyan stroke */}
              <path
                d={activeNeonPath}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="3.6"
                filter={`url(#cyan-intense-${id})`}
                strokeLinecap="round"
              />
              {/* White-hot energy core */}
              <path
                d={activeNeonPath}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeOpacity="0.95"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>

        {/* Dynamic Flying Spaceship */}
        {flightKeyframes.xs.length > 0 && (
          <motion.div
            key={`ship-${replayKey}`}
            initial={{
              x: flightKeyframes.xs[0],
              y: flightKeyframes.ys[0],
              rotate: flightKeyframes.angles[0],
            }}
            animate={{
              x: flightKeyframes.xs,
              y: flightKeyframes.ys,
              rotate: flightKeyframes.angles,
            }}
            transition={{
              duration: flightKeyframes.duration,
              ease: [0.4, 0, 0.2, 1],
            }}
            onAnimationComplete={() => {
              setIsFlying(false);
              try {
                sessionStorage.setItem(storageKey, String(destinationIndex));
              } catch {
                /* ignore */
              }
            }}
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
            style={{ willChange: 'transform' }}
            aria-hidden
          >
            <div className="relative">
              {/* Engine thruster plasma during flight */}
              {isFlying && (
                <>
                  <span className="absolute -bottom-1 -left-2 size-3.5 rounded-full bg-cyan-400 blur-[4px] opacity-85" />
                  <span className="absolute -bottom-0.5 -left-1 size-2 rounded-full bg-white blur-[1px]" />
                </>
              )}
              {/* Hover bob animation after flight arrives */}
              <motion.div
                animate={!isFlying ? { y: [0, -5, 0] } : {}}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
              >
                <Rocket
                  size={26}
                  className="text-white drop-shadow-[0_0_12px_#22d3ee]"
                  fill="var(--user, #22d3ee)"
                />
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Spherical Planets (ss1 aesthetic) */}
        {modules.map((m, i) => {
          const pt = planetCoords[i];
          if (!pt) return null;

          const done = !!entry?.modules[m.id]?.passed;
          const locked = i > 0 && !entry?.modules[modules[i - 1].id]?.passed;
          const here = i === destinationIndex;
          const tint = PLANET_TINTS[i % PLANET_TINTS.length];
          const clearedTopics = m.topics.filter((t) => !!entry?.progress[t.id]?.cleared).length;
          const totalTopics = m.topics.length;
          const status = done ? 'Cleared' : here && locked ? 'Pass previous quiz first' : here ? 'Current destination' : locked ? 'Locked' : 'Open';
          const firstUnclearedTopic = m.topics.find((t) => !entry?.progress[t.id]?.cleared) ?? m.topics[0];
          const moduleMinutes = m.topics.reduce((acc, t) => acc + (t.lesson?.minutes || 5), 0);

          const stepNumber = String(i + 1).padStart(2, '0');
          const planetDiameter = here ? 54 : 46;

          return (
            <div
              key={m.id}
              className="group absolute z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: pt.x, top: pt.y }}
            >
              {/* Step Number (cyan monospace above planet, matching ss1) */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 text-[11px] font-mono tracking-widest font-semibold transition-colors duration-200 ${
                  here ? 'text-cyan-300 drop-shadow-[0_0_8px_#22d3ee]' : done ? 'text-white/80' : 'text-white/40'
                }`}
                style={{ bottom: planetDiameter / 2 + 8 }}
              >
                {stepNumber}
              </div>

              {/* Atmospheric Glow Ring & Pulse for Current Active Planet */}
              {here && (
                <>
                  <div
                    className="pointer-events-none absolute -inset-3 rounded-full bg-cyan-400/15 blur-md"
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute -inset-2.5 rounded-full border border-cyan-400/50 animate-ping opacity-35"
                    aria-hidden
                  />
                </>
              )}

              {/* Planet 3D Sphere Button */}
              <button
                type="button"
                disabled={locked || !onSelect || !firstUnclearedTopic}
                onClick={() => firstUnclearedTopic && onSelect?.(firstUnclearedTopic.id)}
                aria-label={`${m.title} — ${status}`}
                className={`relative grid place-items-center rounded-full transition-transform duration-200 enabled:cursor-pointer enabled:hover:scale-110 ${
                  locked ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                style={{
                  width: planetDiameter,
                  height: planetDiameter,
                  background: here
                    ? `radial-gradient(circle at 30% 28%, #ffffff 0%, ${tint} 30%, color-mix(in srgb, ${tint} 55%, #050811) 75%, #050811 100%)`
                    : done
                    ? `radial-gradient(circle at 30% 28%, #ffffffdd 0%, ${tint} 32%, color-mix(in srgb, ${tint} 45%, #060a14) 78%, #060a14 100%)`
                    : `radial-gradient(circle at 30% 28%, rgba(255,255,255,0.35) 0%, #475569 32%, #182232 75%, #050811 100%)`,
                  boxShadow: here
                    ? `0 0 28px ${tint}99, 0 0 50px rgba(34, 211, 238, 0.45), inset -4px -4px 10px rgba(0,0,0,0.9), inset 3px 3px 6px rgba(255,255,255,0.7)`
                    : done
                    ? `0 0 16px ${tint}60, inset -3px -3px 8px rgba(0,0,0,0.85), inset 3px 3px 5px rgba(255,255,255,0.5)`
                    : `inset -3px -3px 8px rgba(0,0,0,0.95), inset 2px 2px 4px rgba(255,255,255,0.25)`,
                }}
              >
                {/* Check Badge for completed planets */}
                {done && (
                  <span
                    className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full text-black shadow-[0_0_8px_#22d3ee]"
                    style={{ background: '#22d3ee' }}
                  >
                    <Check size={11} strokeWidth={3.5} />
                  </span>
                )}

                {/* Lock icon for locked planets */}
                {locked && <Lock size={15} className="text-white/60 drop-shadow" />}
              </button>

              {/* Title & subtitle underneath planet (ss1 style) */}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-32 text-center pointer-events-none"
                style={{ top: planetDiameter / 2 + 8 }}
              >
                <div
                  className={`truncate text-xs font-semibold ${
                    here ? 'text-white drop-shadow' : done ? 'text-white/85' : 'text-white/50'
                  }`}
                >
                  {m.title}
                </div>
              </div>

              {/* Hover tooltip */}
              <div className="pointer-events-none absolute bottom-[calc(100%+16px)] left-1/2 z-40 w-max max-w-[240px] -translate-x-1/2 rounded-xl border border-white/10 bg-[#0d1220]/95 px-3 py-2 text-left opacity-0 shadow-2xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                <div className="text-[13px] font-semibold text-white">
                  {m.title}
                </div>
                <div className="mt-0.5 text-[11px] text-white/60">
                  {clearedTopics}/{totalTopics} topics cleared · {status} · {moduleMinutes} min
                </div>
              </div>
            </div>
          );
        })}

        {/* Final destination: the supernova (the course finale). A dim ember until the course is complete; then it blazes,
            and clicking it replays the finale. */}
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ left: flagCoord.x, top: flagCoord.y }}
        >
          <button
            type="button"
            disabled={!isCourseComplete}
            onClick={() => active && useFinale.getState().show(active.course.id, active.course.title)}
            aria-label={isCourseComplete ? 'Supernova — replay the finale' : 'Supernova — finish the course to reach it'}
            title={isCourseComplete ? 'Replay the finale' : 'Finish every planet to reach the supernova'}
            className={`relative grid size-14 place-items-center rounded-full transition-transform duration-200 ${isCourseComplete ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
          >
            {/* Corona and rays */}
            <span
              aria-hidden
              className={`pointer-events-none absolute -inset-8 rounded-full ${isCourseComplete ? 'animate-pulse' : ''}`}
              style={{
                opacity: isCourseComplete ? 0.95 : 0.4,
                background: isCourseComplete
                  ? 'radial-gradient(closest-side, rgba(255,214,160,0.55), rgba(255,110,40,0.22) 55%, rgba(255,80,20,0) 100%)'
                  : 'radial-gradient(closest-side, rgba(255,150,90,0.22), rgba(255,110,40,0.08) 55%, rgba(255,80,20,0) 100%)',
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-full"
              style={{
                opacity: isCourseComplete ? 0.8 : 0.25,
                background: 'repeating-conic-gradient(from 0deg, rgba(255,226,190,0.55) 0deg 2deg, transparent 2deg 30deg)',
                WebkitMaskImage: 'radial-gradient(closest-side, transparent 38%, #000 52%, transparent 100%)',
                maskImage: 'radial-gradient(closest-side, transparent 38%, #000 52%, transparent 100%)',
              }}
            />
            {/* The star itself */}
            <span
              aria-hidden
              className={`relative rounded-full ${isCourseComplete ? 'size-10' : 'size-9'}`}
              style={{
                background: isCourseComplete
                  ? 'radial-gradient(circle at 42% 38%, #ffffff 0%, #ffe6b8 28%, #ff9a4a 62%, #b83a12 100%)'
                  : 'radial-gradient(circle at 42% 38%, #d8b49a 0%, #8a4a2c 45%, #3a1a10 100%)',
                boxShadow: isCourseComplete ? '0 0 26px rgba(255,150,70,0.95), 0 0 56px rgba(255,90,30,0.55)' : '0 0 10px rgba(255,120,60,0.25)',
              }}
            />
          </button>
          <span className={`mt-3 text-[10px] font-mono ${isCourseComplete ? 'font-semibold text-orange-200' : 'text-white/40'}`}>Supernova</span>
        </div>
      </div>
    </div>
  );
}
