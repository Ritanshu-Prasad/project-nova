import { AnimatePresence, motion } from 'framer-motion';
import { LogIn, RotateCcw, Terminal, Volume2, VolumeX } from 'lucide-react';
import { audio } from '../../core/audio';
import { BRAND, HERO } from '../../core/content';
import { replayIntro } from '../../core/director';
import { Z } from '../../core/layers';
import { phaseIndex, useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';
import { TOPBAR } from './hudCopy';
import NovaMark from './NovaMark';
import './hud.css';

const PREFLIGHT = phaseIndex('preflight');

function signIn() {
  useNova.getState().setLoginOpen(true);
}

function toggleSound() {
  const s = useNova.getState();
  // Turning sound on is a user gesture: make sure the AudioContext is running.
  if (!s.soundOn) void audio.init();
  s.toggleSound();
}

/**
 * Persistent top bar (from pre-flight on): NOVA mark + wordmark on the left; sound toggle and, once
 * landed, "Replay launch" and a compact sign-in on the right. Only the controls take pointer events.
 */
export default function TopBar() {
  const phase = useNova((s) => s.phase);
  const soundOn = useNova((s) => s.soundOn);
  const reduced = useNova((s) => s.reducedMotion);
  const visible = phaseIndex(phase) >= PREFLIGHT;
  const landed = phase === 'landed';

  return (
    <header
      inert={!visible}
      data-rm={reduced || undefined}
      className={`pointer-events-none fixed inset-x-0 top-0 flex h-16 items-center justify-between px-6 transition-[opacity,translate] ease-out max-sm:h-14 max-sm:px-4 ${
        visible ? 'translate-y-0 opacity-100 delay-300 duration-1000' : '-translate-y-3 opacity-0 duration-300'
      }`}
      style={{ zIndex: Z.topbar }}
    >
      <div className="hud-topbar-shade absolute inset-x-0 top-0 -z-10 h-24" />

      {/* Brand */}
      <div className="flex items-center gap-3 select-none max-sm:gap-2.5">
        <NovaMark className="h-[26px] w-[26px] drop-shadow-[0_0_10px_rgba(103,232,249,0.65)] max-sm:h-[22px] max-sm:w-[22px]" />
        <span className="hud-glow-soft font-display text-[17px] leading-none font-semibold tracking-[0.36em] text-cyan-50 max-sm:text-[15px]">
          {BRAND.name}
        </span>
        <span className="rounded-[2px] border border-cyan-300/30 bg-cyan-300/[0.06] px-1.5 py-[3px] font-mono text-[8.5px] leading-none tracking-[0.24em] text-cyan-200/75 uppercase max-[359px]:hidden">
          {TOPBAR.codeName}
        </span>
      </div>

      {/* Controls */}
      <nav aria-label={TOPBAR.controls} className="flex items-center gap-2">
        <AnimatePresence>
          {landed && (
            <motion.div
              key="landed-actions"
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: reduced ? 0 : 14 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.6, delay: reduced ? 0 : 0.5, ease: 'easeOut' } }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
            >
              <HudButton
                variant="ghost"
                size="sm"
                onClick={() => replayIntro()}
                icon={<RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />}
                aria-label={HERO.ctaSecondary}
                className="pointer-events-auto max-sm:w-9 max-sm:gap-0 max-sm:px-0"
              >
                <span className="max-sm:sr-only">{HERO.ctaSecondary}</span>
              </HudButton>
              <HudButton
                variant="primary"
                size="sm"
                onClick={() => useNova.getState().setCommsOpen(true)}
                icon={<Terminal className="h-3.5 w-3.5 text-sky-950" strokeWidth={2} aria-hidden="true" />}
                className="pointer-events-auto max-sm:gap-0 max-sm:px-3 text-sky-950 font-bold"
              >
                TALK TO NOVA
              </HudButton>
              <HudButton
                variant="system"
                size="sm"
                onClick={signIn}
                icon={<LogIn className="h-3.5 w-3.5 max-sm:hidden" strokeWidth={2} aria-hidden="true" />}
                className="pointer-events-auto max-sm:gap-0 max-sm:px-3"
              >
                {TOPBAR.signIn}
              </HudButton>
            </motion.div>
          )}
        </AnimatePresence>
        <HudButton
          variant="ghost"
          size="sm"
          onClick={toggleSound}
          aria-label={TOPBAR.sound}
          aria-pressed={soundOn}
          title={soundOn ? TOPBAR.soundOn : TOPBAR.soundOff}
          icon={
            soundOn ? (
              <Volume2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4 text-cyan-200/60" strokeWidth={1.75} aria-hidden="true" />
            )
          }
          className="pointer-events-auto gap-2! px-3! max-sm:w-9 max-sm:px-0!"
        >
          <span className="hud-eq flex h-3 items-end gap-[2px] max-sm:hidden" data-off={soundOn ? undefined : ''} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </HudButton>
      </nav>
    </header>
  );
}
