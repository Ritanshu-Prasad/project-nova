import { useId } from 'react';

/** The NOVA 4-point star (same geometry as public/favicon.svg), as an inline SVG. */
export default function NovaMark({ className = '' }: { className?: string }) {
  const id = `nova-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ecfeff" />
          <stop offset="0.45" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#0e7490" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="none" stroke="rgb(103 232 249 / 0.28)" strokeWidth="1.5" />
      <path d="M32 4 L37 27 L60 32 L37 37 L32 60 L27 37 L4 32 L27 27 Z" fill={`url(#${id})`} />
      <circle className="hud-breathe origin-center [transform-box:fill-box]" cx="32" cy="32" r="4" fill="#ffffff" />
    </svg>
  );
}
