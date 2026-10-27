import { motion } from 'framer-motion';
import { Bell, Flag, Sparkles, TriangleAlert, Trophy, X } from 'lucide-react';
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
  /** Seconds before the window appears. */
  delay?: number;
  /** Pinned to the bottom edge, outside the padding (e.g. a time-left bar). */
  edge?: ReactNode;
  /** Landmark role; defaults to status (alert for warnings). */
  role?: 'status' | 'alert' | 'region';
}

const EASE_OUT = [0.2, 0.8, 0.25, 1] as const;
const KEEP_UPPER = /^(MMR|RR|RAG|PVE|AI|LV|HUD|OK)$/i;

/** "QUEST COMPLETE" → "Quest complete" (acronyms kept). Mixed-case titles pass through. */
function friendlyTitle(title: string): string {
  if (title !== title.toUpperCase()) return title;
  return title
    .toLowerCase()
    .split(' ')
    .map((w, i) => (KEEP_UPPER.test(w) ? w.toUpperCase() : i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const ICONS: Record<NoticeKind, { icon: typeof Sparkles; tint: string }> = {
  system: { icon: Sparkles, tint: 'var(--user)' },
  quest: { icon: Flag, tint: '#34d399' },
  levelup: { icon: Trophy, tint: '#fbbf24' },
  warning: { icon: TriangleAlert, tint: '#f59e0b' },
  toast: { icon: Bell, tint: 'var(--user)' },
};

/** A friendly notice card: rounded glass, a coloured icon chip and a soft pop-in. */
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
  const { icon: Icon, tint } = ICONS[kind];

  return (
    <motion.section
      data-kind={kind}
      role={role ?? (kind === 'warning' ? 'alert' : 'status')}
      aria-labelledby={titleId}
      className={`sys-window overflow-hidden ${className}`}
      initial={rm ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.38, ease: EASE_OUT, delay } }}
      exit={rm ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.22 } }}
    >
      <header className={`relative flex items-center gap-3 px-4 pt-3.5 ${centered ? 'justify-center' : ''}`}>
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${tint} 18%, transparent)`, color: tint }}
        >
          <Icon size={16} strokeWidth={2.2} />
        </span>
        <h2 id={titleId} className={`min-w-0 font-display text-[15px] font-semibold tracking-wide text-white ${centered ? '' : 'flex-1 truncate'}`}>
          {friendlyTitle(title)}
        </h2>
        {onClose && !centered && (
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close: ${friendlyTitle(title)}`}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={15} strokeWidth={2} />
          </button>
        )}
      </header>

      <div className={`relative ${centered ? 'px-6 pb-5 pt-3 text-center' : 'px-4 pb-4 pt-2.5'}`}>
        {lines.length > 0 && (
          <div className={`space-y-1 font-sans leading-relaxed text-white/80 ${centered ? 'text-[15px]' : 'text-[13.5px]'}`}>
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

/** One line of copy; a short "Label:" prefix is set dim and the value emphasised. */
export function SystemLine({ text }: { text: string }) {
  const parts = splitLine(text);
  if (!parts) return <p>{text}</p>;
  return (
    <p>
      <span className="text-white/55">{parts[0]}</span> <span className="font-semibold text-white">{parts[1]}</span>
    </p>
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
      layout
      className={`sys-window flex max-w-full items-center gap-3 !rounded-full py-1.5 pl-1.5 pr-1.5 ${className}`}
      initial={rm ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: EASE_OUT } }}
      exit={rm ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.22 } }}
    >
      <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full" style={{ background: 'rgb(var(--user-rgb) / 0.18)', color: 'var(--user)' }}>
        <Bell size={14} strokeWidth={2.2} />
      </span>
      <span className="shrink-0 font-display text-[13px] font-semibold text-white">{friendlyTitle(title)}</span>
      {lines[0] && <span className="min-w-0 truncate text-[13px] text-white/70">{lines[0]}</span>}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close: ${friendlyTitle(title)}`}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={14} />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </motion.div>
  );
}
