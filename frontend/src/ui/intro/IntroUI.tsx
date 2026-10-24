import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { audio } from '../../core/audio';
import { PREFLIGHT, WARP } from '../../core/content';
import { setHolding } from '../../core/director';
import { Z } from '../../core/layers';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';
import { useRaf } from '../../core/useRaf';
import TutorialPointer from './TutorialPointer';

/** DOM side of the cinematic: tutorial pointer, hold-to-launch, warp flash. */
export default function IntroUI() {
  const phase = useNova((s) => s.phase);
  const cleared = useNova((s) => s.cleared);
  return (
    <>
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.intro }}>
        <AnimatePresence>{phase === 'preflight' && cleared && <LaunchControl key="launch" />}</AnimatePresence>
        <TutorialPointer />
        <SoundHint />
      </div>
      <WarpOverlay />
    </>
  );
}

const RING = 2 * Math.PI * 52;
/** Strongest the white flash gets (0-1). */
const FLASH_MAX = 0.8;

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
          data-tutorial="launch"
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
  const introSeen = useNova((s) => s.introSeen);
  const flash = useRef<HTMLDivElement>(null);
  useRaf(() => {
    if (flash.current) flash.current.style.opacity = String(Math.min(FLASH_MAX, rt.flash * FLASH_MAX)); // never a full white-out
  });
  // Suppress "ENTERING NEW WORLD" during inter-planet traversal; only show on maiden launch from hangar bay
  const showTitle = phase === 'warp' && !rt.isInterPlanetJump && !introSeen;
  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.warpFlash }}>
      <div ref={flash} className="absolute inset-0 bg-gradient-to-r from-cyan-100 via-white to-sky-100 opacity-0 transition-none" /* plain alpha: Safari composites blend modes over a WebGL canvas unreliably */ />
      <AnimatePresence>
        {showTitle && (
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
