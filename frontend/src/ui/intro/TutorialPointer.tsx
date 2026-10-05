import { AnimatePresence, motion } from 'framer-motion';
import { MousePointerClick } from 'lucide-react';
import { useRef } from 'react';
import { anchors } from '../../core/anchors';
import { PREFLIGHT } from '../../core/content';
import { toggleSystem } from '../../core/director';
import { useDeck } from '../../core/journey';
import { SYSTEM_ORDER, useNova, type SystemKey } from '../../core/store';
import { useRaf } from '../../core/useRaf';

const STEPS: Record<SystemKey, { title: string; body: string }> = {
  power: { title: `Flip the ${PREFLIGHT.items.power.switchLabel} switch`, body: 'Click the blinking switch to restore main power.' },
  neural: { title: `Now the ${PREFLIGHT.items.neural.switchLabel}`, body: 'Next switch along — it syncs your HUD.' },
  core: { title: `Ignite the ${PREFLIGHT.items.core.switchLabel}`, body: 'Last switch. This one powers the engines.' },
};

const BOX_W = 280;
const GAP = 16;

/**
 * Game-style tutorial: a pulsing ring on the control to use, a leader line, and an instruction card.
 * Positions follow the 3D switches every frame (see core/anchors); the card itself is also clickable.
 */
export default function TutorialPointer() {
  const phase = useNova((s) => s.phase);
  const systems = useNova((s) => s.systems);
  const cleared = useNova((s) => s.cleared);
  const next = SYSTEM_ORDER.find((k) => !systems[k]);
  const stepIndex = cleared ? 3 : next ? SYSTEM_ORDER.indexOf(next) : 3;
  const inCockpit = useDeck((d) => d.deck === 'cockpit');
  const show = phase === 'preflight' && inCockpit;
  const target = cleared ? 'launch' : next ? `switch:${next}` : null;

  const ring = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<SVGLineElement>(null);
  const dot = useRef<SVGCircleElement>(null);

  useRaf(() => {
    if (!target || !ring.current || !box.current || !line.current || !dot.current) return;
    let x = 0;
    let y = 0;
    let visible = false;
    if (target === 'launch') {
      const el = document.querySelector<HTMLElement>('[data-tutorial="launch"]');
      const r = el?.getBoundingClientRect();
      if (r && r.width) {
        x = r.left + r.width / 2;
        y = r.top + r.height / 2;
        visible = true;
      }
    } else {
      const a = anchors[target];
      if (a) ({ x, y, visible } = a);
    }

    const W = window.innerWidth;
    const H = window.innerHeight;
    const bw = Math.min(BOX_W, W - 32);
    const bh = box.current.offsetHeight || 110;
    const radius = target === 'launch' ? 74 : 34;
    // Card sits diagonally above the target, towards the middle of the screen.
    const toRight = x < W / 2;
    let bx = visible ? (toRight ? x + 90 : x - 90 - bw) : W / 2 - bw / 2;
    let by = visible ? y - radius - 120 - bh / 2 : H * 0.62;
    // Launch: beside the button (the countdown digit owns the space above it); below it on phones.
    if (target === 'launch' && visible) {
      const side = W >= 760;
      bx = side ? x + radius + 70 : x - bw / 2;
      by = side ? y - bh / 2 : y + radius + 56;
    }
    bx = Math.max(GAP, Math.min(W - bw - GAP, bx));
    by = Math.max(GAP + 56, Math.min(H - bh - GAP, by));
    box.current.style.width = `${bw}px`;
    box.current.style.transform = `translate3d(${bx}px, ${by}px, 0)`;

    ring.current.style.opacity = visible ? '1' : '0';
    ring.current.style.width = ring.current.style.height = `${radius * 2}px`;
    ring.current.style.transform = `translate3d(${x - radius}px, ${y - radius}px, 0)`;

    // Leader line: from the ring's edge to the nearest point on the card.
    const cx = Math.max(bx, Math.min(bx + bw, x));
    const cy = Math.max(by, Math.min(by + bh, y));
    const dx = cx - x;
    const dy = cy - y;
    const d = Math.hypot(dx, dy) || 1;
    const sx = x + (dx / d) * radius;
    const sy = y + (dy / d) * radius;
    line.current.setAttribute('x1', String(sx));
    line.current.setAttribute('y1', String(sy));
    line.current.setAttribute('x2', String(cx));
    line.current.setAttribute('y2', String(cy));
    line.current.style.opacity = visible && d > radius + 8 ? '1' : '0';
    dot.current.setAttribute('cx', String(sx));
    dot.current.setAttribute('cy', String(sy));
    dot.current.style.opacity = line.current.style.opacity;
  }, show);

  const step = cleared || !next ? { title: PREFLIGHT.launch, body: `Press and hold the LAUNCH button (or hold ${PREFLIGHT.launchKey}) until the countdown ends.` } : STEPS[next];

  return (
    <AnimatePresence>
      {show && target && (
        <motion.div key="tutorial" className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
          <svg className="absolute inset-0 h-full w-full overflow-visible">
            <line ref={line} stroke="#fcd34d" strokeWidth="2" strokeDasharray="6 5" className="tutorial-dash" style={{ filter: 'drop-shadow(0 0 4px rgb(252 211 77 / 0.8))', opacity: 0 }} />
            <circle ref={dot} r="4" fill="#fcd34d" style={{ opacity: 0 }} />
          </svg>

          <div ref={ring} className="absolute left-0 top-0 opacity-0" aria-hidden>
            <span className="absolute inset-0 rounded-full border-[3px] border-amber-300 shadow-[0_0_24px_rgb(252_211_77/0.8),inset_0_0_18px_rgb(252_211_77/0.45)]" />
            <span className="absolute inset-0 animate-ping rounded-full border-2 border-amber-200/80" />
            <span className="absolute -inset-3 rounded-full border border-amber-300/30" />
          </div>

          <div ref={box} className="absolute left-0 top-0" style={{ width: BOX_W }}>
            <AnimatePresence mode="wait">
              <motion.button
                key={target}
                type="button"
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.25 }}
                onClick={() => next && !cleared && toggleSystem(next)}
                className={`pointer-events-auto block w-full rounded-2xl border border-amber-300/60 bg-[#0d1220]/90 p-4 text-left font-sans shadow-[0_10px_40px_-10px_rgb(0_0_0/0.8),0_0_30px_-8px_rgb(252_211_77/0.5)] backdrop-blur-md ${cleared ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-bold text-[#1a1203]">Step {stepIndex + 1} of 4</span>
                  <span className="flex gap-1" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={`h-1.5 w-4 rounded-full ${i < stepIndex ? 'bg-amber-300' : i === stepIndex ? 'bg-amber-200 animate-pulse' : 'bg-white/15'}`} />
                    ))}
                  </span>
                </div>
                <div className="mt-2.5 font-display text-lg font-semibold leading-snug text-white">{step.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-white/70">{step.body}</p>
                {!cleared && next && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-200/80">
                    <MousePointerClick size={13} /> or press <kbd className="rounded bg-white/10 px-1.5 font-mono text-white">{PREFLIGHT.items[next].key}</kbd>
                  </p>
                )}
              </motion.button>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
