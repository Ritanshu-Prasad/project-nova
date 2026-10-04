import type { CSSProperties } from 'react';

/** Stroke drawn on from 0 → full length as `--hud-draw-off` goes 1 → 0 (set by <Hud> during boot). */
const DRAW: CSSProperties = { strokeDasharray: 1, strokeDashoffset: 'var(--hud-draw-off, 0)' };

function Bracket({ className, flip }: { className: string; flip?: string }) {
  return (
    <svg
      className={`absolute h-[34px] w-[34px] max-sm:h-[26px] max-sm:w-[26px] ${className}`}
      viewBox="0 0 34 34"
      style={flip ? { transform: flip } : undefined}
      aria-hidden="true"
    >
      <path
        d="M1 33 V9 L9 1 H33"
        pathLength={1}
        fill="none"
        stroke="rgb(165 243 252 / 0.75)"
        strokeWidth={1.3}
        style={DRAW}
      />
      <path d="M5 21 V11.5 L11.5 5 H21" pathLength={1} fill="none" stroke="rgb(103 232 249 / 0.35)" strokeWidth={1} style={DRAW} />
      <rect x={30} y={0} width={3} height={3} fill="rgb(236 254 255 / 0.85)" />
      <rect x={0} y={30} width={3} height={3} fill="rgb(236 254 255 / 0.85)" />
    </svg>
  );
}

/**
 * Visor frame: four chamfered corner brackets. Inset so they clear the top bar, the quest panel,
 * the notification stack and the skip control.
 */
export default function CornerBrackets() {
  return (
    <div className="absolute inset-x-3 top-[72px] bottom-3 drop-shadow-[0_0_5px_rgba(34,211,238,0.55)] max-sm:inset-x-2 max-sm:top-[60px] max-sm:bottom-2">
      <Bracket className="left-0 top-0" />
      <Bracket className="right-0 top-0" flip="scaleX(-1)" />
      <Bracket className="bottom-0 left-0" flip="scaleY(-1)" />
      <Bracket className="right-0 bottom-0" flip="scale(-1,-1)" />
    </div>
  );
}
