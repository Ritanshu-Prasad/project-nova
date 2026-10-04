import { useRef } from 'react';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';
import { useRaf } from '../../core/useRaf';
import { hudBus } from './hudBus';
import { SCRAMBLE_GLYPHS, statusFor, type StatusTone } from './hudCopy';

const TONE: Record<StatusTone, { text: string; led: string; blink: boolean }> = {
  amber: { text: 'text-amber-200', led: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.95)]', blink: true },
  ok: { text: 'text-emerald-200', led: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.95)]', blink: true },
  nova: { text: 'text-cyan-100', led: 'bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.95)]', blink: false },
  nebula: { text: 'text-violet-200', led: 'bg-violet-400 shadow-[0_0_8px_rgba(168,85,247,0.95)]', blink: false },
  sys: { text: 'text-blue-200', led: 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.95)]', blink: false },
};

/** Seconds between successive characters resolving, and how long a character scrambles before it lands. */
const CHAR_STEP = 0.016;
const SCRAMBLE = 0.22;

/** Bottom-centre phase status, decoding in character by character whenever it changes. */
export default function StatusLine() {
  const phase = useNova((s) => s.phase);
  const cleared = useNova((s) => s.cleared);
  const status = statusFor(phase, cleared);
  const tone = TONE[status.tone];
  const textRef = useRef<HTMLSpanElement>(null);
  const anim = useRef({ target: '', t: 0, done: true });

  useRaf((dt) => {
    const el = textRef.current;
    if (!el || !hudBus.visible) return;
    const a = anim.current;
    if (a.target !== status.text) {
      a.target = status.text;
      a.t = 0;
      a.done = false;
    }
    if (a.done) return;
    a.t += dt;
    if (rt.reducedMotion) {
      el.textContent = a.target;
      a.done = true;
      return;
    }
    let out = '';
    let settled = true;
    for (let i = 0; i < a.target.length; i++) {
      const ch = a.target[i];
      const land = 0.05 + i * CHAR_STEP;
      if (ch === ' ' || a.t >= land) out += ch;
      else {
        settled = false;
        out += a.t >= land - SCRAMBLE ? SCRAMBLE_GLYPHS[(Math.random() * SCRAMBLE_GLYPHS.length) | 0] : ' ';
      }
    }
    el.textContent = out;
    if (settled) a.done = true;
  });

  return (
    <div
      className={`absolute bottom-[22px] left-1/2 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 ${tone.text} ${
        phase === 'preflight' ? 'max-sm:hidden' : ''
      }`}
    >
      <span className="h-px w-10 bg-linear-to-l from-current to-transparent opacity-70 max-sm:w-5" />
      <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${tone.led} ${tone.blink ? 'hud-blink' : ''}`} />
      <span
        ref={textRef}
        className="hud-glow-soft font-mono text-[10.5px] leading-none font-medium tracking-[0.3em] whitespace-pre max-sm:text-[9.5px] max-sm:tracking-[0.18em]"
      />
      <span className="h-px w-10 bg-linear-to-r from-current to-transparent opacity-70 max-sm:w-5" />
    </div>
  );
}
