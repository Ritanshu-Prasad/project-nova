import { useState } from 'react';
import { Typewriter } from '../common/Typewriter';
import { splitLine } from './introText';

export interface TypedLinesProps {
  lines: readonly string[];
  /** Characters per second. */
  cps?: number;
  /** Seconds before the first line starts. */
  delay?: number;
  /** Pause between lines, seconds. */
  gap?: number;
  instant?: boolean;
  className?: string;
  lineClassName?: string;
  /** Class for the emphasised value after a "Label:" prefix. */
  emClassName?: string;
  /** Class for the dim "Label:" prefix. */
  labelClassName?: string;
  onDone?: () => void;
}

/**
 * Types lines one after another. Every line reserves its final size from the first frame
 * (an invisible copy shares its grid cell), so nothing reflows or shifts while typing.
 */
export default function TypedLines({
  lines,
  cps = 52,
  delay = 0,
  gap = 0.12,
  instant = false,
  className,
  lineClassName,
  emClassName = 'font-semibold',
  labelClassName,
  onDone,
}: TypedLinesProps) {
  const [reached, setReached] = useState(0);
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <TypedLine
          key={i}
          text={line}
          active={instant || i <= reached}
          cps={cps}
          delay={i === 0 ? delay : gap}
          instant={instant}
          className={lineClassName}
          emClassName={emClassName}
          labelClassName={labelClassName}
          onDone={() => {
            setReached((r) => Math.max(r, i + 1));
            if (i === lines.length - 1) onDone?.();
          }}
        />
      ))}
    </div>
  );
}

interface TypedLineProps {
  text: string;
  active: boolean;
  cps: number;
  delay: number;
  instant: boolean;
  className?: string;
  emClassName: string;
  labelClassName?: string;
  onDone: () => void;
}

function TypedLine({ text, active, cps, delay, instant, className, emClassName, labelClassName, onDone }: TypedLineProps) {
  const parts = splitLine(text);
  const [labelDone, setLabelDone] = useState(false);

  let typed = null;
  if (active && !parts) {
    typed = <Typewriter text={text} cps={cps} delay={delay} instant={instant} onDone={onDone} />;
  } else if (active && parts) {
    typed = (
      <>
        <Typewriter text={parts[0]} cps={cps} delay={delay} instant={instant} className={labelClassName} onDone={() => setLabelDone(true)} />
        {labelDone && (
          <>
            {' '}
            <Typewriter text={parts[1]} cps={cps * 0.8} delay={0.05} instant={instant} className={emClassName} onDone={onDone} />
          </>
        )}
      </>
    );
  }

  return (
    <p className={className}>
      <span className="inline-grid max-w-full">
        <span aria-hidden className="invisible col-start-1 row-start-1">
          {parts ? (
            <>
              <span className={labelClassName}>{parts[0]}</span> <span className={emClassName}>{parts[1]}</span>
            </>
          ) : (
            text
          )}
        </span>
        <span className="col-start-1 row-start-1 text-left">{typed}</span>
      </span>
    </p>
  );
}
