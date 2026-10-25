import { AnimatePresence, motion } from 'framer-motion';
import { Clapperboard, Gauge, Info, Keyboard, RotateCcw, Rocket, Sparkles, Volume2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { audio } from '../../core/audio';
import { relaunch, replayFullIntro } from '../../core/hub';
import { useDeck } from '../../core/journey';
import { LEVEL_LABEL, LEVELS, useGraphics, type Choice, type Level } from '../../core/graphics';
import { Z } from '../../core/layers';
import { useActiveCourse, travelsAvailable } from '../../core/course';
import { PLANET_COUNT, planetName, usePlanets } from '../../core/planets';
import { ACTIONS, keyLabel, RESERVED, useSettings, type Action, type Motion } from '../../core/settings';
import { useNova } from '../../core/store';

/** Sound, flight, graphics, motion and keyboard shortcuts — opened from the top bar gear or the Profile panel. */
export default function SettingsModal() {
  const open = useSettings((s) => s.open);
  return <AnimatePresence>{open && <Panel key="settings" />}</AnimatePresence>;
}

const LEVEL_NOTE: Record<Level, string> = {
  high: 'Full detail: the richest planets, lighting and effects.',
  medium: 'Balanced: lighter shaders and fewer particles.',
  low: 'Lightest 3D, for older phones and laptops.',
  none: 'No ship scene at all; lessons and quizzes run as normal.',
};

const GRAPHICS_OPTIONS: { value: Choice; label: string }[] = [{ value: 'auto', label: 'Auto' }, ...LEVELS.map((l) => ({ value: l as Choice, label: LEVEL_LABEL[l] }))];
const MOTION_OPTIONS: { value: Motion; label: string }[] = [
  { value: 'system', label: 'Device' },
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Reduced' },
];

function Panel() {
  const s = useSettings();
  const soundOn = useNova((n) => n.soundOn);
  const phase = useNova((n) => n.phase);
  const deck = useDeck((d) => d.deck);
  const planet = usePlanets((p) => p.index);
  const [capturing, setCapturing] = useState<Action | null>(null);
  const [hint, setHint] = useState('');
  const auto = useGraphics((g) => g.auto);
  const close = () => s.setOpen(false);
  const course = useActiveCourse();
  const planets = course?.course.modules.length ?? 0;
  const jumps = travelsAvailable(course?.entry);
  const canLaunch = deck === 'lounge' && phase === 'landed' && jumps > 0;
  const volume = Math.round(s.volume * 100);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (capturing) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === 'Escape') return setCapturing(null);
        if (RESERVED.has(e.code)) return setHint(`${keyLabel(e.code)} is already used by NOVA — pick another key.`);
        useSettings.getState().bind(capturing, e.code);
        setHint('');
        setCapturing(null);
        return;
      }
      // Shortcuts don't fire behind the panel (Tab still moves focus inside it).
      if (e.key !== 'Tab') e.stopPropagation();
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <motion.div className="fixed inset-0 flex items-end justify-center bg-black/60 backdrop-blur-[3px] sm:items-center sm:p-4" style={{ zIndex: Z.notices - 2 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="sys-window flex max-h-[92dvh] w-full max-w-[600px] flex-col overflow-hidden rounded-b-none rounded-t-3xl sm:max-h-[90dvh] sm:rounded-3xl"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <div>
            <div className="chip-label">Ship settings</div>
            <h2 id="settings-title" className="glow-sys mt-2 font-display text-2xl font-bold text-white">
              Settings
            </h2>
            <p className="mt-1 text-xs text-blue-100/65">Sound, flight, graphics, motion and keys.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close settings" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-white/[0.05] text-blue-100/70 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300">
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-1 [scrollbar-color:rgb(96_165_250/0.35)_transparent] [scrollbar-width:thin] sm:px-7">
          <Section icon={<Volume2 size={15} />} title="Sound" note="Volume and which sounds play.">
            <Row label="Sound" hint="Mute everything (shortcut below)">
              <Toggle on={soundOn} onChange={() => (void audio.init(), useNova.getState().toggleSound())} label="Sound on" />
            </Row>
            <Row label="Master volume" hint="Applies to every sound">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => s.set({ volume: Number(e.target.value) / 100 })}
                  onPointerUp={() => audio.play('click')}
                  aria-label="Master volume"
                  disabled={!soundOn}
                  style={{ background: `linear-gradient(to right, rgb(34 211 238) ${volume}%, rgb(255 255 255 / 0.14) ${volume}%)` }}
                  className="h-1.5 w-36 cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-40 sm:w-44 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgb(34_211_238/0.35)]"
                />
                <span className="w-10 rounded-md bg-black/25 py-0.5 text-center font-mono text-[11px] text-white/80 ring-1 ring-white/10">{volume}%</span>
              </div>
            </Row>
            <Row label="Ship & space sounds" hint="Engine hum, doors, launch, warp">
              <Toggle on={s.shipSounds} onChange={() => s.set({ shipSounds: !s.shipSounds })} label="Ship and space sounds" />
            </Row>
            <Row label="Interface sounds" hint="Chimes, clicks and alerts">
              <Toggle on={s.uiSounds} onChange={() => (s.set({ uiSounds: !s.uiSounds }), audio.play('chime'))} label="Interface sounds" />
            </Row>
          </Section>

          <Section icon={<Rocket size={15} />} title="Flight" note={planets ? `Planet ${(course?.entry.travelled ?? 0) + 1} of ${planets} in this course.` : 'Create a course to start the tour.'}>
            <div className="grid gap-2.5 p-3 sm:grid-cols-2">
              <ActionTile
                primary
                icon={<Rocket size={18} />}
                title="Launch to the next planet"
                text={canLaunch ? `${planetName(planet)} → ${planetName((planet + 1) % PLANET_COUNT)}. Walk to the seat, flip the 3 switches and jump.` : jumps === 0 ? 'Opens when you finish this planet’s module: each completed module earns one jump.' : 'Available in the lounge, once the ship has landed.'}
                disabled={!canLaunch}
                onClick={() => (close(), relaunch())}
              />
              <ActionTile icon={<Clapperboard size={18} />} title="Replay the full intro" text="The wake-up in the hangar and the run down the launch pad." onClick={() => (close(), replayFullIntro())} />
            </div>
          </Section>

          <Section icon={<Gauge size={15} />} title="Graphics" note="Lower levels run smoother on weak devices.">
            <Row label="Graphics quality" stack>
              <Segmented id="graphics" label="Graphics quality" value={s.graphics} options={GRAPHICS_OPTIONS} onChange={(v) => s.set({ graphics: v })} />
              <p className="mt-2.5 flex items-start gap-2 text-[11px] leading-snug text-blue-100/65">
                <Info size={13} className="mt-px shrink-0 text-cyan-300/80" />
                <span>{s.graphics === 'auto' ? `Auto picked ${LEVEL_LABEL[auto]} for this device. ${LEVEL_NOTE[auto]}` : LEVEL_NOTE[s.graphics]}</span>
              </p>
            </Row>
          </Section>

          <Section icon={<Sparkles size={15} />} title="Motion" note="Camera sway, warp and big transitions.">
            <Row label="Photosensitivity mode" hint={s.motion === 'reduced' ? 'On: no flashes, camera sway or warp. This is what "Skip the intro" turned on at the start.' : 'Off: the full intro, warp and flashes.'}>
              <Toggle on={s.motion === 'reduced'} onChange={() => s.set({ motion: s.motion === 'reduced' ? 'full' : 'reduced' })} label="Photosensitivity mode" />
            </Row>
            <Row label="Animations" hint="Reduced = no camera sway, warp or big transitions" stack>
              <Segmented id="motion" label="Animations" value={s.motion} options={MOTION_OPTIONS} onChange={(v) => s.set({ motion: v })} />
            </Row>
          </Section>

          <Section
            icon={<Keyboard size={15} />}
            title="Keyboard shortcuts"
            note="Click a key, then press the new one."
            action={
              <button type="button" onClick={() => (s.resetKeys(), setHint(''))} className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-blue-100/65 transition hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300">
                <RotateCcw size={11} /> Reset
              </button>
            }
          >
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {ACTIONS.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-inset ring-white/[0.05]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white/90">{a.label}</span>
                    <span className="block truncate text-[11px] text-blue-100/60">{a.where}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => (setCapturing(capturing === a.id ? null : a.id), setHint(''))}
                    aria-label={`Change the key for ${a.label} (now ${keyLabel(s.keys[a.id])})`}
                    className={`min-w-11 shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-center font-mono text-xs shadow-[0_2px_0_rgb(0_0_0/0.45)] transition focus-visible:outline-2 focus-visible:outline-cyan-300 ${capturing === a.id ? 'animate-pulse bg-cyan-400/25 text-white ring-1 ring-cyan-300' : 'bg-white/[0.07] text-white/85 ring-1 ring-white/15 hover:bg-white/[0.12] hover:ring-white/30'}`}
                  >
                    {capturing === a.id ? 'Press a key…' : keyLabel(s.keys[a.id])}
                  </button>
                </div>
              ))}
            </div>
            <p className="min-h-4 px-4 pb-3 text-[11px] text-blue-100/60" role="status">
              {hint || (capturing ? 'Press the new key (Esc to cancel). A key already in use swaps places.' : 'Esc closes panels · type L-A-U-N-C-H in the lounge for a surprise.')}
            </p>
          </Section>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({ icon, title, note, action, children }: { icon: ReactNode; title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl text-cyan-200 ring-1 ring-cyan-300/25" style={{ background: 'rgb(var(--user-rgb) / 0.12)' }}>
            {icon}
          </span>
          <div>
            <h3 className="hud-label">{title}</h3>
            {note && <p className="mt-1 text-[11px] text-blue-100/60">{note}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.045] to-white/[0.02] ring-1 ring-inset ring-white/[0.08]">{children}</div>
    </section>
  );
}

/** A label with its control; `stack` puts a wide control on its own line under the label so it never wraps or clips. */
function Row({ label, hint, stack, children }: { label: string; hint?: string; stack?: boolean; children: ReactNode }) {
  const text = (
    <span className="min-w-0">
      <span className="block text-sm text-white/90">{label}</span>
      {hint && <span className="mt-0.5 block text-[11px] leading-snug text-blue-100/65">{hint}</span>}
    </span>
  );
  if (stack)
    return (
      <div className="px-4 py-3.5">
        {text}
        <div className="mt-3">{children}</div>
      </div>
    );
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      {text}
      {children}
    </div>
  );
}

/** Equal-width radio segments with a sliding highlight. */
function Segmented<T extends string>({ id, label, value, options, onChange }: { id: string; label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const reduced = useNova((n) => n.reducedMotion);
  return (
    <div className="grid rounded-xl bg-black/25 p-1 ring-1 ring-inset ring-white/10" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative cursor-pointer rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-cyan-300 ${on ? 'text-white' : 'text-blue-100/65 hover:text-white'}`}
          >
            {on && <motion.span layoutId={`seg-${id}`} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }} className="absolute inset-0 rounded-lg bg-cyan-400/25 shadow-[0_0_14px_-4px_rgb(34_211_238/0.8)] ring-1 ring-cyan-300/45" />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ActionTile({ icon, title, text, onClick, disabled, primary }: { icon: ReactNode; title: string; text: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex cursor-pointer flex-col items-start gap-2 rounded-xl p-3.5 text-left ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-45 ${primary ? 'bg-cyan-400/[0.12] ring-cyan-300/35 enabled:hover:bg-cyan-400/20 enabled:hover:ring-cyan-300/60' : 'bg-white/[0.04] ring-white/10 enabled:hover:bg-white/[0.08] enabled:hover:ring-white/25'}`}
    >
      <span className={`grid size-9 place-items-center rounded-lg ${primary ? 'bg-cyan-400/25 text-cyan-100' : 'bg-white/[0.07] text-white/80'}`}>{icon}</span>
      <span className="text-sm font-semibold text-white">{title}</span>
      <span className="text-[11px] leading-snug text-blue-100/65">{text}</span>
    </button>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${on ? 'bg-cyan-400/80 shadow-[0_0_12px_-2px_rgb(34_211_238/0.7)]' : 'bg-white/15'}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}
