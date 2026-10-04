import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TypewriterProps {
  text: string;
  /** Characters per second. */
  cps?: number;
  /** Seconds before typing starts. */
  delay?: number;
  onDone?: () => void;
  className?: string;
  /** Show a blinking block caret while typing. */
  caret?: boolean;
  /** Render the whole text immediately (e.g. reduced motion). */
  instant?: boolean;
}

/** Types `text` out character by character. Screen readers get the full text at once. */
export function Typewriter({ text, cps = 40, delay = 0, onDone, className, caret = true, instant = false }: TypewriterProps) {
  const [typed, setTyped] = useState({ text, count: 0 });
  // A new text restarts the animation (state adjusted during render, not in an effect).
  if (typed.text !== text) setTyped({ text, count: 0 });
  const count = instant ? text.length : typed.text === text ? typed.count : 0;

  const done = useRef(onDone);
  useLayoutEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (instant) {
      done.current?.();
      return;
    }
    let raf = 0;
    const start = performance.now() + delay * 1000;
    const step = (ms: number) => {
      const n = Math.min(text.length, Math.max(0, Math.floor(((ms - start) / 1000) * cps)));
      setTyped((prev) => (prev.text === text && prev.count === n ? prev : { text, count: n }));
      if (n < text.length) raf = requestAnimationFrame(step);
      else done.current?.();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, cps, delay, instant]);

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, count)}
        {caret && count < text.length && <span className="tw-caret">▍</span>}
      </span>
    </span>
  );
}
