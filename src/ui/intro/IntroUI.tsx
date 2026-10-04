import { AnimatePresence, motion } from 'framer-motion';
import { Check, Lock, MousePointerClick } from 'lucide-react';
import { useRef, useState } from 'react';
import { audio } from '../../core/audio';
import { PREFLIGHT, WARP } from '../../core/content';
import { setHolding, toggleSystem } from '../../core/director';
import { Z } from '../../core/layers';
import { rt } from '../../core/runtime';
import { SYSTEM_ORDER, useNova } from '../../core/store';
import { useRaf } from '../../core/useRaf';
import SystemWindow from './SystemWindow';
import WakeNotice from './WakeNotice';

/** DOM side of the cinematic: wake notice, pre-flight quest, hold-to-launch, warp flash. */
export default function IntroUI() {
  const phase = useNova((s) => s.phase);
  const cleared = useNova((s) => s.cleared);
  return (
    <>
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.intro }}>
        <WakeNotice />
        <AnimatePresence>{phase === 'preflight' && <PreflightPanel key="quest" />}</AnimatePresence>
        <AnimatePresence>{phase === 'preflight' && cleared && <LaunchControl key="launch" />}</AnimatePresence>
        <SoundHint />
      </div>
      <WarpOverlay />
    </>
  );
}

function PreflightPanel() {
  const systems = useNova((s) => s.systems);
  const cleared = useNova((s) => s.cleared);
  const next = SYSTEM_ORDER.find((k) => !systems[k]);
  const [shake, setShake] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      className="pointer-events-auto absolute bottom-24 left-4 right-4 sm:bottom-auto sm:left-6 sm:right-auto sm:top-28 sm:w-[340px]"
    >
      <SystemWindow kind="quest" title={PREFLIGHT.title}>
        {cleared ? (
          <p className="mt-1 flex items-center gap-2 text-sm text-emerald-300">
            <Check size={16} /> {PREFLIGHT.complete}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {SYSTEM_ORDER.map((k) => {
              const item = PREFLIGHT.items[k];
              const done = systems[k];
              const isNext = k === next;
              return (
                <li key={k}>
                  <motion.button
                    type="button"
                    animate={shake === k ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
                    transition={{ duration: 0.35 }}
                    onAnimationComplete={() => setShake(null)}
                    onClick={() => {
                      const r = toggleSystem(k);
                      if (!r.ok && r.reason === 'order') setShake(k);
                    }}
                    disabled={done}
                    className={`group flex w-full items-center gap-3 rounded-[2px] px-3 py-2.5 text-left text-sm ring-1 ring-inset transition ${
                      done
                        ? 'text-emerald-200/90 ring-emerald-400/30'
                        : isNext
                          ? 'cursor-pointer bg-blue-500/15 text-white ring-blue-300/70 shadow-[0_0_24px_rgba(96,165,250,0.35)] hover:bg-blue-500/25'
                          : 'cursor-pointer text-blue-100/45 ring-blue-300/15'
                    }`}
                  >
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-[2px] font-mono text-[11px] ring-1 ${done ? 'bg-emerald-400/20 ring-emerald-300/50' : 'ring-blue-300/40'}`}>
                      {done ? <Check size={13} /> : isNext ? item.key : <Lock size={11} />}
                    </span>
                    <span className="flex-1">{done ? item.done : item.label}</span>
                    {isNext && <span className="font-mono text-[10px] tracking-[0.25em] text-amber-300 animate-pulse">ENGAGE</span>}
                  </motion.button>
                </li>
              );
            })}
          </ul>
        )}
        {!cleared && (
          <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-blue-200/50">
            <MousePointerClick size={12} /> Flip the switches in the cockpit or press 1 · 2 · 3
          </p>
        )}
      </SystemWindow>
    </motion.div>
  );
}

const RING = 2 * Math.PI * 52;

function LaunchControl() {
  const ring = useRef<SVGCircleElement>(null);
  const digit = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  const last = useRef(0);

  useRaf(() => {
    if (ring.current) ring.current.style.strokeDashoffset = String(RING * (1 - rt.charge));
    if (edge.current) edge.current.style.opacity = String(rt.charge * 0.9);
    if (digit.current && rt.countdown !== last.current) {
      last.current = rt.countdown;
      digit.current.textContent = rt.countdown ? String(rt.countdown) : '';
      digit.current.animate(
        [{ transform: 'scale(1.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' },
      );
    }
  });

  const start = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    void audio.init();
    setHolding(true);
  };
  const stop = () => setHolding(false);

  return (
    <>
      <div ref={edge} className="absolute inset-0 opacity-0" style={{ boxShadow: 'inset 0 0 160px 30px rgba(34,211,238,0.45)' }} />
      <div ref={digit} className="glow-cyan absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 font-display text-[22vmin] font-bold leading-none text-cyan-100" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="absolute left-1/2 top-[70%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 max-sm:top-auto max-sm:bottom-[300px]"
      >
        <button
          type="button"
          aria-label={PREFLIGHT.launch}
          onPointerDown={start}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={stop}
          onContextMenu={(e) => e.preventDefault()}
          className="pointer-events-auto relative grid h-28 w-28 cursor-pointer place-items-center rounded-full bg-cyan-400/10 ring-1 ring-cyan-300/40 backdrop-blur-md transition hover:bg-cyan-400/20 active:scale-95"
        >
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(103,232,249,0.15)" strokeWidth="5" />
            <circle ref={ring} cx="60" cy="60" r="52" fill="none" stroke="#67e8f9" strokeWidth="5" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING} style={{ filter: 'drop-shadow(0 0 6px #22d3ee)' }} />
          </svg>
          <span className="absolute inset-3 animate-ping rounded-full ring-1 ring-cyan-300/30" />
          <span className="font-display text-xs font-bold tracking-[0.2em] text-cyan-50">LAUNCH</span>
        </button>
        <div className="hud-label !text-cyan-100/80">
          {PREFLIGHT.launch} · <span className="text-white">[{PREFLIGHT.launchKey}]</span>
        </div>
      </motion.div>
    </>
  );
}

function WarpOverlay() {
  const phase = useNova((s) => s.phase);
  const flash = useRef<HTMLDivElement>(null);
  useRaf(() => {
    if (flash.current) flash.current.style.opacity = String(Math.min(1, rt.flash));
  });
  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.warpFlash }}>
      <div ref={flash} className="absolute inset-0 bg-cyan-50 opacity-0 mix-blend-screen" />
      <AnimatePresence>
        {phase === 'warp' && (
          <motion.div
            key="warp"
            initial={{ opacity: 0, letterSpacing: '0.1em' }}
            animate={{ opacity: [0, 1, 1, 0], letterSpacing: ['0.1em', '0.5em', '0.6em', '1em'] }}
            transition={{ duration: 3, times: [0, 0.2, 0.75, 1] }}
            className="glow-cyan absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-2xl font-bold text-cyan-50 sm:text-5xl"
            style={{ textShadow: '3px 0 #f0f, -3px 0 #0ff, 0 0 30px #22d3ee' }}
          >
            {WARP.title}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Browsers keep audio locked until the first interaction — say so, once. */
function SoundHint() {
  const phase = useNova((s) => s.phase);
  const [unlocked, setUnlocked] = useState(false);
  useRaf(() => {
    if (!unlocked && audio.ready) setUnlocked(true);
  }, !unlocked);
  const show = !unlocked && (phase === 'wake' || phase === 'preflight');
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="hud-label absolute bottom-7 left-1/2 -translate-x-1/2 animate-pulse !text-cyan-200/70 max-sm:hidden"
        >
          Click anywhere for sound
        </motion.div>
      )}
    </AnimatePresence>
  );
}
