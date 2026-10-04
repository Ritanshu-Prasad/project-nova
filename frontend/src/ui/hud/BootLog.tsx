import { useRef } from 'react';
import { smoothstep } from '../../core/math';
import { rt } from '../../core/runtime';
import { useRaf } from '../../core/useRaf';
import { hudBus } from './hudBus';
import { BOOT_LOG } from './hudCopy';
import { BOOT } from './hudMath';

const LABEL_W = 18;
const LINES = BOOT_LOG.map(([label, status]) => ({ label: `${label} `.padEnd(LABEL_W, '·') + ' ', status }));
/** Characters per second, and the delay between lines. */
const CPS = 75;
const LINE_GAP = 0.3;

/** Short boot log typed under the reticle when the HUD first comes online, then faded out. */
export default function BootLog() {
  const rootRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const statusRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const shown = useRef<number[]>(LINES.map(() => -1));

  useRaf(() => {
    const root = rootRef.current;
    if (!root) return;
    const t = hudBus.bootT;
    if (!hudBus.visible || t < 0 || t > BOOT.logFadeEnd) {
      if (root.style.display !== 'none') root.style.display = 'none';
      return;
    }
    if (root.style.display === 'none') root.style.display = '';
    root.style.opacity = (1 - smoothstep(BOOT.logFadeStart, BOOT.logFadeEnd, t)).toFixed(3);
    LINES.forEach((line, i) => {
      const total = line.label.length + line.status.length;
      const n = rt.reducedMotion
        ? total
        : Math.max(0, Math.min(total, Math.floor((t - BOOT.logStart - i * LINE_GAP) * CPS)));
      if (n === shown.current[i]) return;
      shown.current[i] = n;
      const l = labelRefs.current[i];
      const s = statusRefs.current[i];
      if (l) l.textContent = line.label.slice(0, n);
      if (s) s.textContent = line.status.slice(0, Math.max(0, n - line.label.length));
    });
  });

  return (
    <div
      ref={rootRef}
      className="absolute left-1/2 top-[calc(50%+54px)] -translate-x-1/2 font-mono text-[10px] leading-[1.65] tracking-[0.14em] whitespace-pre text-cyan-200/70 max-sm:text-[8.5px] max-sm:top-[calc(50%+40px)]"
      style={{ display: 'none' }}
    >
      {LINES.map((line, i) => (
        <div key={line.label}>
          <span
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
          />
          <span
            ref={(el) => {
              statusRefs.current[i] = el;
            }}
            className="hud-glow-soft font-semibold text-emerald-300"
          />
        </div>
      ))}
    </div>
  );
}
