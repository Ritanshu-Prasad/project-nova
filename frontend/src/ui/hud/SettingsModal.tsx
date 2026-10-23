import { AnimatePresence, motion } from 'framer-motion';
import { Gauge, Keyboard, RotateCcw, Rocket, Sparkles, Volume2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { audio } from '../../core/audio';
import { relaunch, replayFullIntro } from '../../core/hub';
import { LEVEL_LABEL, LEVELS, useGraphics, type Choice } from '../../core/graphics';
import { Z } from '../../core/layers';
import { ACTIONS, keyLabel, RESERVED, useSettings, type Action, type Motion } from '../../core/settings';
import { useNova } from '../../core/store';

/** Sound, motion and keyboard shortcuts — opened from the top bar gear or the Profile panel. */
export default function SettingsModal() {
  const open = useSettings((s) => s.open);
  return <AnimatePresence>{open && <Panel key="settings" />}</AnimatePresence>;
}

function Panel() {
  const s = useSettings();
  const soundOn = useNova((n) => n.soundOn);
  const [capturing, setCapturing] = useState<Action | null>(null);
  const [hint, setHint] = useState('');
  const auto = useGraphics((g) => g.auto);
  const graphicsHint = s.graphics === 'auto' ? `Auto picked ${LEVEL_LABEL[auto]} for this device` : 'Lower levels run smoother on weak devices; No 3D skips the 3D scene';
  const close = () => s.setOpen(false);

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
    <motion.div className="fixed inset-0 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-[3px]" style={{ zIndex: Z.notices - 2 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="sys-window relative w-full max-w-[520px] p-6 sm:p-7"
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={close} aria-label="Close settings" className="absolute right-3 top-3 cursor-pointer p-1 text-blue-200/60 hover:text-white">
          <X size={16} />
        </button>
        <div className="chip-label">Ship settings</div>
        <h2 id="settings-title" className="glow-sys mt-2 font-display text-2xl font-bold text-white">
          Settings
        </h2>

        <Section icon={<Volume2 size={14} />} title="Sound">
          <Row label="Sound" hint="Mute everything (shortcut below)">
            <Toggle on={soundOn} onChange={() => (void audio.init(), useNova.getState().toggleSound())} label="Sound on" />
          </Row>
          <Row label="Master volume" hint={`${Math.round(s.volume * 100)}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(s.volume * 100)}
              onChange={(e) => s.set({ volume: Number(e.target.value) / 100 })}
              onPointerUp={() => audio.play('click')}
              aria-label="Master volume"
              disabled={!soundOn}
              className="w-40 accent-cyan-400 disabled:opacity-40"
            />
          </Row>
          <Row label="Ship & space sounds" hint="Engine hum, doors, launch, warp">
            <Toggle on={s.shipSounds} onChange={() => s.set({ shipSounds: !s.shipSounds })} label="Ship and space sounds" />
          </Row>
          <Row label="Interface sounds" hint="Chimes, clicks and alerts">
            <Toggle on={s.uiSounds} onChange={() => (s.set({ uiSounds: !s.uiSounds }), audio.play('chime'))} label="Interface sounds" />
          </Row>
        </Section>

        <Section icon={<Rocket size={14} />} title="Flight">
          <Row label="Launch to the next planet" hint="Walk back to the seat, flip the 3 switches and jump from here">
            <button type="button" onClick={() => (close(), relaunch())} className="cursor-pointer rounded-lg bg-cyan-400/20 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-cyan-300/40 transition hover:bg-cyan-400/30">
              Launch
            </button>
          </Row>
          <Row label="Replay the full intro" hint="The wake-up in the hangar and the launch down the launch pad">
            <button type="button" onClick={() => (close(), replayFullIntro())} className="cursor-pointer rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/10 transition hover:text-white hover:ring-white/30">
              Replay
            </button>
          </Row>
        </Section>

        <Section icon={<Gauge size={14} />} title="Graphics">
          <Row label="Graphics quality" hint={graphicsHint}>
            <div className="flex flex-wrap overflow-hidden rounded-lg ring-1 ring-blue-400/25" role="radiogroup" aria-label="Graphics quality">
              {(['auto', ...LEVELS] as Choice[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={s.graphics === c}
                  onClick={() => s.set({ graphics: c })}
                  className={`cursor-pointer px-2.5 py-1.5 text-xs font-semibold transition ${s.graphics === c ? 'bg-cyan-400/25 text-white' : 'text-blue-100/60 hover:text-white'}`}
                >
                  {c === 'auto' ? 'Auto' : LEVEL_LABEL[c]}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section icon={<Sparkles size={14} />} title="Motion">
          <Row label="Animations" hint="Reduced = no camera sway, warp or big transitions">
            <div className="flex overflow-hidden rounded-lg ring-1 ring-blue-400/25" role="radiogroup" aria-label="Animations">
              {(['system', 'full', 'reduced'] as Motion[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={s.motion === m}
                  onClick={() => s.set({ motion: m })}
                  className={`cursor-pointer px-3 py-1.5 text-xs font-semibold capitalize transition ${s.motion === m ? 'bg-cyan-400/25 text-white' : 'text-blue-100/60 hover:text-white'}`}
                >
                  {m === 'system' ? 'Device' : m}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section
          icon={<Keyboard size={14} />}
          title="Keyboard shortcuts"
          action={
            <button type="button" onClick={() => (s.resetKeys(), setHint(''))} className="flex cursor-pointer items-center gap-1 text-[11px] text-blue-200/60 hover:text-white">
              <RotateCcw size={11} /> Reset
            </button>
          }
        >
          {ACTIONS.map((a) => (
            <Row key={a.id} label={a.label} hint={a.where}>
              <button
                type="button"
                onClick={() => (setCapturing(capturing === a.id ? null : a.id), setHint(''))}
                aria-label={`Change the key for ${a.label} (now ${keyLabel(s.keys[a.id])})`}
                className={`min-w-16 cursor-pointer rounded-md px-3 py-1.5 font-mono text-xs transition ${capturing === a.id ? 'animate-pulse bg-cyan-400/25 text-white ring-1 ring-cyan-300' : 'bg-white/[0.06] text-white/80 ring-1 ring-white/10 hover:ring-white/30'}`}
              >
                {capturing === a.id ? 'Press a key…' : keyLabel(s.keys[a.id])}
              </button>
            </Row>
          ))}
          <p className="mt-2 min-h-4 text-[11px] text-blue-100/50" role="status">
            {hint || (capturing ? 'Press the new key (Esc to cancel). A key already in use swaps places.' : 'Esc closes panels · type L-A-U-N-C-H in the lounge for a surprise.')}
          </p>
        </Section>
      </motion.div>
    </motion.div>
  );
}

function Section({ icon, title, action, children }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="hud-label flex items-center gap-2">
          {icon} {title}
        </h3>
        {action}
      </div>
      <div className="divide-y divide-blue-400/10 rounded-xl bg-blue-900/10 px-4 ring-1 ring-inset ring-blue-400/15">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-sm text-white/90">{label}</span>
        {hint && <span className="block text-[11px] text-blue-100/50">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition ${on ? 'bg-cyan-400/80' : 'bg-white/15'}`}>
      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}
