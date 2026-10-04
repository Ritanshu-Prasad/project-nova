import type { CSSProperties, RefObject } from 'react';

export interface HoloTitleProps {
  text: string;
  /** Plays the reveal (scan-line wipe + chromatic split) when it turns true. */
  shown: boolean;
  /** Reveal delay in seconds. */
  delay: number;
  /** Receives the per-frame parallax transform of the whole title. */
  wrapRef: RefObject<HTMLDivElement | null>;
  /** Receives the extra parallax of the outline "ghost" layer (reads as depth). */
  ghostRef: RefObject<HTMLDivElement | null>;
}

/**
 * The hero wordmark as a hologram: gradient fill with fine scanlines and a periodic shimmer, a blurred
 * glow underlay, an outline ghost floating at a different depth, and cyan/magenta channels that split
 * apart on reveal and keep a hairline fringe. All layers share one font box so they stay registered.
 */
export default function HoloTitle({ text, shown, delay, wrapRef, ghostRef }: HoloTitleProps) {
  const style = { '--ld-delay': `${delay.toFixed(3)}s` } as CSSProperties;
  return (
    <div ref={wrapRef} className={`ld-title-wrap${shown ? ' is-on' : ''}`} style={style}>
      <span aria-hidden="true" className="ld-title ld-layer ld-title-glow">
        {text}
      </span>
      <div ref={ghostRef} aria-hidden="true" className="ld-layer">
        <span className="ld-title ld-title-ghost">{text}</span>
      </div>
      <h1 className="ld-title ld-title-fill">{text}</h1>
      <span aria-hidden="true" className="ld-title ld-layer ld-title-ca is-c">
        {text}
      </span>
      <span aria-hidden="true" className="ld-title ld-layer ld-title-ca is-m">
        {text}
      </span>
      <span aria-hidden="true" className="ld-title-beam" />
    </div>
  );
}
