import { useRef } from 'react';
import { rt } from '../../core/runtime';
import { useRaf } from '../../core/useRaf';
import { hudBus } from './hudBus';
import { pad3, wrapDeg } from './hudMath';

/** Pixels per degree along the tape, and the strip's degree span (wide enough to wrap either way). */
const PPD = 4;
const D0 = -60;
const D1 = 420;
const STRIP_W = (D1 - D0) * PPD;
const TICKS = Array.from({ length: (D1 - D0) / 5 + 1 }, (_, i) => D0 + i * 5);
const CARDINAL: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
const BASE_Y = 24.5;

/** Compass heading tape (top-centre): ticks scroll with rt.heading under a fixed caret and readout. */
export default function HeadingTape() {
  const stripRef = useRef<SVGSVGElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const last = useRef('');

  useRaf(() => {
    if (!hudBus.visible) return;
    const h = wrapDeg(rt.heading);
    const strip = stripRef.current;
    if (strip) strip.style.transform = `translate3d(${(-(h - D0) * PPD).toFixed(2)}px,0,0)`;
    const text = pad3(h);
    if (text !== last.current && valueRef.current) {
      last.current = text;
      valueRef.current.textContent = text;
    }
  });

  return (
    <div className="absolute left-1/2 top-[70px] h-[36px] w-[360px] -translate-x-1/2 max-sm:top-[64px] max-sm:w-[232px]">
      {/* Scrolling strip */}
      <div className="hud-tape-mask absolute inset-x-0 top-0 h-[28px] overflow-hidden">
        <svg
          ref={stripRef}
          className="absolute left-1/2 top-0 font-mono will-change-transform"
          width={STRIP_W}
          height={28}
          viewBox={`0 0 ${STRIP_W} 28`}
          style={{ transform: `translate3d(${D0 * PPD}px,0,0)` }}
        >
          <line x1={0} x2={STRIP_W} y1={BASE_Y} y2={BASE_Y} stroke="rgb(103 232 249 / 0.35)" strokeWidth={1} />
          {TICKS.map((d) => {
            const x = (d - D0) * PPD + 0.5;
            const deg = wrapDeg(d);
            const major = deg % 10 === 0;
            const card = CARDINAL[deg];
            const strong = card !== undefined || deg % 30 === 0;
            return (
              <g key={d}>
                <line
                  x1={x}
                  x2={x}
                  y1={major ? 14 : 19}
                  y2={BASE_Y}
                  stroke={major ? 'rgb(165 243 252 / 0.8)' : 'rgb(103 232 249 / 0.45)'}
                  strokeWidth={1}
                />
                {major && (
                  <text
                    x={x}
                    y={9.5}
                    textAnchor="middle"
                    fontSize={card ? 10.5 : 9}
                    fontWeight={card ? 700 : 500}
                    letterSpacing={card ? 0 : 0.6}
                    fill={card ? '#ecfeff' : strong ? 'rgb(165 243 252 / 0.85)' : 'rgb(103 232 249 / 0.5)'}
                  >
                    {card ?? pad3(deg)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Readout box over the centre of the label row */}
      <div className="absolute left-1/2 top-[-3px] flex h-[16px] -translate-x-1/2 items-center border border-cyan-200/60 bg-[#020617]/85 px-[5px] shadow-[0_0_14px_rgba(34,211,238,0.35)]">
        <span ref={valueRef} className="font-mono text-[11px] leading-none font-semibold tracking-[0.12em] text-cyan-50 tabular-nums">
          000
        </span>
      </div>

      {/* Caret under the baseline */}
      <svg className="absolute left-1/2 top-[26px] -translate-x-1/2" width={12} height={8} viewBox="0 0 12 8" aria-hidden="true">
        <path d="M6 0.5 L11.5 7.5 H0.5 Z" fill="rgb(236 254 255 / 0.95)" />
      </svg>
      <div className="absolute left-1/2 top-[34px] h-px w-10 -translate-x-1/2 bg-linear-to-r from-transparent via-cyan-300/50 to-transparent" />
    </div>
  );
}
