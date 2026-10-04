import { useRef } from 'react';
import { clamp } from '../../core/math';
import { rt } from '../../core/runtime';
import { useRaf } from '../../core/useRaf';
import { hudBus } from './hudBus';
import { focalPx, viewFov } from './hudMath';

/** Pitch rungs in degrees (0 = horizon). */
const RUNGS = [-30, -20, -10, 0, 10, 20, 30] as const;
const DEG = Math.PI / 180;

function Rung({ e, setRef }: { e: number; setRef: (el: HTMLDivElement | null) => void }) {
  if (e === 0) {
    // Horizon: long split line, fading out towards its ends.
    return (
      <div ref={setRef} className="absolute left-0 top-0 h-0 w-0">
        <div className="absolute right-[46px] top-0 h-px w-[190px] bg-linear-to-l from-current to-transparent" />
        <div className="absolute left-[46px] top-0 h-px w-[190px] bg-linear-to-r from-current to-transparent" />
        <div className="absolute right-[46px] top-0 h-[5px] w-px bg-current" />
        <div className="absolute left-[46px] top-0 h-[5px] w-px bg-current" />
      </div>
    );
  }
  const up = e > 0;
  const arm = up ? 'bg-current' : 'hud-dash';
  // End ticks point towards the horizon.
  const tick = up ? 'top-0' : '-top-[6px]';
  const label = String(Math.abs(e));
  return (
    <div ref={setRef} className="absolute left-0 top-0 h-0 w-0">
      <div className={`absolute right-[56px] top-0 h-px w-[60px] ${arm}`} />
      <div className={`absolute left-[56px] top-0 h-px w-[60px] ${arm}`} />
      <div className={`absolute right-[115px] h-[6px] w-px bg-current ${tick}`} />
      <div className={`absolute left-[115px] h-[6px] w-px bg-current ${tick}`} />
      <span className="absolute right-[124px] -top-[6px] font-mono text-[9px] leading-none tracking-[0.08em]">{label}</span>
      <span className="absolute left-[124px] -top-[6px] font-mono text-[9px] leading-none tracking-[0.08em]">{label}</span>
    </div>
  );
}

/**
 * Conformal pitch ladder + flight-path marker: the ladder and the marker stay locked to the ship's
 * nose while the pilot's head looks around (rt.yaw / rt.pitch projected with the camera FOV).
 * The boresight stays fixed at the centre of the view.
 */
export default function PitchLadder() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const rungRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastPpd = useRef(-1);

  useRaf(() => {
    if (!hudBus.visible) return;
    const { w, h } = hudBus;
    const f = focalPx(h, viewFov(w, h) + rt.fovKick);
    const ppd = f * DEG;
    if (Math.abs(ppd - lastPpd.current) > 0.02) {
      lastPpd.current = ppd;
      RUNGS.forEach((e, i) => {
        const el = rungRefs.current[i];
        if (el) el.style.transform = `translate3d(0,${(-e * ppd).toFixed(1)}px,0)`;
      });
    }
    // Looking left (yaw > 0) puts the nose right of centre; looking up (pitch > 0) puts it below.
    const nx = clamp(Math.tan(clamp(rt.yaw, -1.2, 1.2)) * f, -w * 0.5, w * 0.5);
    const ny = clamp(Math.tan(clamp(rt.pitch, -1.2, 1.2)) * f, -h * 0.5, h * 0.5);
    const a = anchorRef.current;
    if (a) a.style.transform = `translate3d(${nx.toFixed(1)}px,${ny.toFixed(1)}px,0)`;
  });

  return (
    <>
      <div className="hud-ladder-mask absolute left-1/2 top-1/2 h-[64vh] w-[min(680px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden">
        <div ref={anchorRef} className="absolute left-1/2 top-1/2 h-0 w-0 will-change-transform">
          <div className="text-cyan-200/45">
            {RUNGS.map((e, i) => (
              <Rung
                key={e}
                e={e}
                setRef={(el) => {
                  rungRefs.current[i] = el;
                }}
              />
            ))}
          </div>
          {/* Flight-path marker: where the ship's nose points. */}
          <svg
            className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_4px_rgba(34,211,238,0.7)]"
            width={44}
            height={28}
            viewBox="-22 -14 44 28"
            aria-hidden="true"
          >
            <g fill="none" stroke="rgb(186 247 255 / 0.85)" strokeWidth={1.4} strokeLinecap="round">
              <circle cx={0} cy={0} r={5} />
              <path d="M-6 0 H-17 M6 0 H17 M0 -6 V-12" />
            </g>
          </svg>
        </div>
      </div>

      {/* Boresight: fixed at the centre of view. */}
      <svg
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        width={40}
        height={40}
        viewBox="-20 -20 40 40"
        aria-hidden="true"
      >
        <g stroke="rgb(165 243 252 / 0.5)" strokeWidth={1}>
          <path d="M-19 0 H-11 M11 0 H19 M0 11 V19" />
        </g>
        <circle cx={0} cy={0} r={1.2} fill="rgb(236 254 255 / 0.7)" />
      </svg>
    </>
  );
}
