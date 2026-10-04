import { motion } from 'framer-motion';
import { ChevronsUp, X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useNova, type NoticeKind } from '../../core/store';
import { splitLine } from './introText';
import './intro.css';

export interface SystemWindowProps {
  kind: NoticeKind;
  title: string;
  lines?: readonly string[];
  children?: ReactNode;
  onClose?: () => void;
  className?: string;
  /** Title row and text alignment (the wake notice is centred, stacked notices are left-aligned). */
  align?: 'left' | 'center';
  /** Seconds before the window unfolds. */
  delay?: number;
  /** Pinned to the bottom edge, outside the padding (e.g. a time-left bar). */
  edge?: ReactNode;
  /** Landmark role; defaults to status (alert for warnings). */
  role?: 'status' | 'alert' | 'region';
}

// Unfold: a point → a bright horizontal line → the full window (negative insets keep the glow unclipped).
const CLIP_SHUT = 'inset(50% 50% 50% 50%)';
const CLIP_LINE = 'inset(47% 0% 47% 0%)';
const CLIP_OPEN = 'inset(-40% -12% -40% -12%)';
const EASE_OUT = [0.2, 0.75, 0.25, 1] as const;

/** The Solo-Leveling-style "System" window: navy glass, bright frame, badge + title, unfold animation. */
export default function SystemWindow({
  kind,
  title,
  lines = [],
  children,
  onClose,
  className = '',
  align = 'left',
  delay = 0,
  edge,
  role,
}: SystemWindowProps) {
  const rm = useNova((s) => s.reducedMotion);
  const titleId = useId();
  if (kind === 'toast') return <ToastPill title={title} lines={lines} onClose={onClose} className={className} rm={rm} />;
  const centered = align === 'center';

  return (
    <motion.section
      data-kind={kind}
      role={role ?? (kind === 'warning' ? 'alert' : 'status')}
      aria-labelledby={titleId}
      className={`sys-window intro-sw intro-sheen overflow-hidden rounded-[3px] ${className}`}
      initial={rm ? { opacity: 0 } : { clipPath: CLIP_SHUT }}
      animate={
        rm
          ? { opacity: 1, transition: { duration: 0.25, delay } }
          : { clipPath: [CLIP_SHUT, CLIP_LINE, CLIP_OPEN], transition: { duration: 0.6, times: [0, 0.36, 1], ease: EASE_OUT, delay } }
      }
      exit={
        rm
          ? { opacity: 0, transition: { duration: 0.2 } }
          : { clipPath: [CLIP_OPEN, CLIP_LINE, CLIP_SHUT], transition: { duration: 0.4, times: [0, 0.6, 1], ease: 'easeIn' } }
      }
    >
      {!rm && (
        <motion.span
          aria-hidden
          className="intro-sw-beam pointer-events-none absolute inset-x-0 top-1/2 z-10 h-0.5 -translate-y-1/2"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0], transition: { duration: 0.9, times: [0, 0.24, 1], delay } }}
          exit={{ opacity: [0, 1, 1], transition: { duration: 0.4, times: [0, 0.55, 1] } }}
        />
      )}
      <span aria-hidden className="scanlines pointer-events-none absolute inset-0 opacity-70" />
      <span aria-hidden className="hud-corners intro-sw-corners pointer-events-none absolute inset-0" />

      {centered ? (
        <header className="relative flex justify-center px-5 pt-5">
          <div className="intro-sw-frame-box inline-flex items-center gap-3 rounded-[3px] py-1.5 pl-2 pr-4">
            <Badge kind={kind} />
            <h2 id={titleId} className="intro-sw-title font-display text-[15px] font-semibold uppercase tracking-[0.34em]">
              {title}
            </h2>
          </div>
        </header>
      ) : (
        <header className="relative flex items-center gap-3 py-3 pl-3.5 pr-2.5">
          <Badge kind={kind} />
          <h2 id={titleId} className="intro-sw-title min-w-0 flex-1 truncate font-display text-[12.5px] font-semibold uppercase tracking-[0.24em]">
            {title}
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={`Close: ${title}`}
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-xs text-blue-100/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={15} strokeWidth={2} />
            </button>
          )}
        </header>
      )}

      {!centered && <div aria-hidden className="intro-sw-divider mx-3.5 h-px" />}

      <div className={`relative ${centered ? 'px-6 pb-6 pt-4 text-center' : 'px-4 pb-4 pt-3'}`}>
        {lines.length > 0 && (
          <div className={`space-y-1 font-sans leading-relaxed text-blue-50/90 ${centered ? 'text-[15px]' : 'text-[13.5px]'}`}>
            {lines.map((l, i) => (
              <SystemLine key={i} text={l} />
            ))}
          </div>
        )}
        {children}
      </div>
      {edge && <div className="absolute inset-x-0 bottom-0">{edge}</div>}
    </motion.section>
  );
}

/** One line of System copy; a short "Label:" prefix is set dim and the value emphasised. */
export function SystemLine({ text }: { text: string }) {
  const parts = splitLine(text);
  if (!parts) return <p>{text}</p>;
  return (
    <p>
      <span className="text-blue-100/70">{parts[0]}</span> <span className="intro-sw-em font-semibold">{parts[1]}</span>
    </p>
  );
}

function Badge({ kind }: { kind: NoticeKind }) {
  return (
    <span
      aria-hidden
      className="intro-badge grid size-5.5 shrink-0 place-items-center rounded-full font-display text-[12px] font-bold leading-none"
    >
      {kind === 'levelup' ? <ChevronsUp size={13} strokeWidth={2.6} /> : kind === 'toast' ? 'i' : '!'}
    </span>
  );
}

function ToastPill({
  title,
  lines,
  onClose,
  className,
  rm,
}: {
  title: string;
  lines: readonly string[];
  onClose?: () => void;
  className: string;
  rm: boolean;
}) {
  return (
    <motion.div
      data-kind="toast"
      role="status"
      className={`sys-window intro-sw flex max-w-full items-center gap-3 rounded-full py-1.5 pl-1.5 pr-1.5 ${className}`}
      initial={rm ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: EASE_OUT } }}
      exit={rm ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.22 } }}
    >
      <Badge kind="toast" />
      <span className="intro-sw-title shrink-0 font-display text-[11px] font-semibold uppercase tracking-[0.22em]">{title}</span>
      {lines[0] && <span className="min-w-0 truncate text-[13px] text-blue-50/80">{lines[0]}</span>}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close: ${title}`}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-blue-100/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={13} />
        </button>
      ) : (
        <span className="w-1.5" />
      )}
    </motion.div>
  );
}
