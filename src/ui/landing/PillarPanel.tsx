import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { audio } from '../../core/audio';
import { PILLARS } from '../../core/content';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';
import { LABELS, PILLAR_PANEL_ID } from './labels';
import { EASE_OUT } from './reveal';
import { MOBILE_QUERY, useMediaQuery } from './useMediaQuery';
import './landing.css';

const N = PILLARS.length;
const wrap = (i: number) => (i + N) % N;
const TITLE_ID = 'ld-pillar-title';
const SHORT_ID = 'ld-pillar-short';

/** Desktop: slides in from the right while unfolding from a hairline, like a System window opening. */
const PANEL_SIDE: Variants = {
  hidden: { opacity: 0, x: 56, scaleX: 0.92, scaleY: 0.025 },
  shown: {
    opacity: 1,
    x: 0,
    scaleX: 1,
    scaleY: 1,
    transition: {
      opacity: { duration: 0.16 },
      x: { duration: 0.42, ease: EASE_OUT },
      scaleX: { duration: 0.26, ease: EASE_OUT },
      scaleY: { duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] },
    },
  },
  exit: {
    opacity: 0,
    x: 36,
    scaleY: 0.025,
    transition: {
      scaleY: { duration: 0.22, ease: [0.7, 0, 0.84, 0] },
      x: { duration: 0.32, ease: 'easeIn' },
      opacity: { duration: 0.16, delay: 0.14 },
    },
  },
};

/** Mobile bottom sheet: rises and unfolds from its bottom edge. */
const PANEL_SHEET: Variants = {
  hidden: { opacity: 0, y: 72, scaleY: 0.4 },
  shown: {
    opacity: 1,
    y: 0,
    scaleY: 1,
    transition: { opacity: { duration: 0.18 }, y: { duration: 0.45, ease: EASE_OUT }, scaleY: { duration: 0.42, ease: EASE_OUT } },
  },
  exit: { opacity: 0, y: 56, scaleY: 0.6, transition: { duration: 0.24, ease: 'easeIn' } },
};

const PANEL_RM: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/** Pillar-to-pillar content swap; `custom` is the direction (+1 next, -1 previous). */
const CONTENT: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 26, filter: 'blur(4px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.34, ease: EASE_OUT }, transitionEnd: { filter: 'none' } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -26, filter: 'blur(4px)', transition: { duration: 0.15, ease: 'easeIn' } }),
};

const CONTENT_RM: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/**
 * Detail panel for the active product pillar (`store.activePillar`): a non-modal System window on the
 * right (desktop) or a bottom sheet (mobile). Focus moves in on open and returns on close; Esc is
 * handled globally by core/input.ts; ←/→ step through the pillars.
 */
export default function PillarPanel() {
  const phase = useNova((s) => s.phase);
  const active = useNova((s) => s.activePillar);
  const rm = useNova((s) => s.reducedMotion);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const index = active !== null && active >= 0 && active < N ? active : null;
  const open = index !== null && (phase === 'arrive' || phase === 'landed');
  const panelRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Layout effect: runs after the panel's DOM exists but before anything else can move focus.
  useLayoutEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    restoreRef.current = prev instanceof HTMLElement && prev !== document.body ? prev : null;
    // The same node stays mounted through the exit animation, so it is still valid in the cleanup.
    const panel = panelRef.current;
    panel?.focus({ preventScroll: true });
    audio.play('chime');
    return () => {
      const focused = document.activeElement;
      const inPanel = !!panel && !!focused && panel.contains(focused);
      // Only pull focus back if it is still in the closing panel (or nowhere).
      if (inPanel || !focused || focused === document.body) {
        const back = restoreRef.current;
        if (back && back.isConnected) back.focus({ preventScroll: true });
        else if (inPanel && focused instanceof HTMLElement) focused.blur();
      }
      restoreRef.current = null;
    };
  }, [open]);

  const variants = rm ? PANEL_RM : mobile ? PANEL_SHEET : PANEL_SIDE;

  return (
    <div
      className={
        'pointer-events-none fixed inset-0 flex items-end justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+72px)] ' +
        'sm:items-center sm:justify-end sm:px-6 sm:pb-6 sm:pt-[88px]'
      }
      style={{ zIndex: Z.pillar }}
    >
      <AnimatePresence>
        {open && <PanelWindow key="panel" index={index} rm={rm} mobile={mobile} variants={variants} panelRef={panelRef} />}
      </AnimatePresence>
    </div>
  );
}

interface PanelWindowProps {
  index: number;
  rm: boolean;
  mobile: boolean;
  variants: Variants;
  panelRef: RefObject<HTMLElement | null>;
}

function go(i: number) {
  audio.play('click');
  useNova.getState().setActivePillar(wrap(i));
}

function PanelWindow({ index, rm, mobile, variants, panelRef }: PanelWindowProps) {
  // Direction of the last pillar change (state adjusted during render, not in an effect).
  const [view, setView] = useState({ index, dir: 0 });
  if (view.index !== index) {
    const dir = index === wrap(view.index + 1) ? 1 : index === wrap(view.index - 1) ? -1 : Math.sign(index - view.index);
    setView({ index, dir });
  }
  const p = PILLARS[index];

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    }
  };

  return (
    <motion.section
      ref={panelRef}
      id={PILLAR_PANEL_ID}
      role="dialog"
      aria-labelledby={TITLE_ID}
      aria-describedby={SHORT_ID}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={
        'ld-panel sys-window pointer-events-auto flex w-full max-w-[460px] flex-col outline-none ' +
        'max-h-[min(66dvh,560px)] sm:max-h-[min(640px,calc(100dvh-112px))] sm:w-[min(420px,calc(100vw-48px))]'
      }
      style={{ transformOrigin: mobile ? '50% 100%' : '50% 50%' }}
      variants={variants}
      initial="hidden"
      animate="shown"
      exit="exit"
    >
      <span aria-hidden="true" className="ld-panel-scan" />
      <span aria-hidden="true" className="ld-panel-frame" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b from-blue-400/14 to-transparent"
      />

      <motion.div
        className="relative flex min-h-0 flex-1 flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: rm ? 0 : mobile ? 0.18 : 0.36, duration: 0.3 } }}
      >
        <header className="flex items-center gap-3 border-b border-blue-300/25 py-2.5 pl-4 pr-2 sm:pl-5">
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-[4px] font-display text-[13px] font-bold text-blue-50 ring-1 ring-blue-300/85 shadow-[0_0_12px_rgba(96,165,250,0.55),inset_0_0_8px_rgba(96,165,250,0.35)]"
          >
            !
          </span>
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.28em] text-blue-200/85">{LABELS.panelKicker}</span>
          <span className="ml-auto shrink-0 font-mono text-[10px] tracking-[0.2em] text-blue-200/70">
            {p.code} / {String(N).padStart(2, '0')}
          </span>
          <button
            type="button"
            aria-label={LABELS.close}
            onClick={() => {
              audio.play('click');
              useNova.getState().setActivePillar(null);
            }}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-[2px] text-blue-100/80 transition-colors hover:bg-blue-400/15 hover:text-white"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="scroll-y relative min-h-0 flex-1 overflow-x-hidden">
          <AnimatePresence mode="wait" initial={false} custom={view.dir}>
            <motion.div
              key={p.key}
              custom={view.dir}
              variants={rm ? CONTENT_RM : CONTENT}
              initial="enter"
              animate="center"
              exit="exit"
              className="px-4 pb-5 pt-5 sm:px-6 sm:pt-6"
            >
              <hgroup>
                <div className="flex items-end gap-4">
                  <span aria-hidden="true" className="ld-code font-display text-[52px] font-bold leading-[0.78] sm:text-[60px]">
                    {p.code}
                  </span>
                  <h2
                    id={TITLE_ID}
                    className="pb-0.5 font-display text-[20px] font-semibold uppercase leading-tight tracking-[0.12em] text-white glow-sys sm:text-[22px]"
                  >
                    <span className="sr-only">{p.code} · </span>
                    {p.title}
                  </h2>
                </div>
                <p id={SHORT_ID} className="mt-3.5 text-[15px] font-medium leading-snug text-blue-100">
                  {p.short}
                </p>
              </hgroup>

              <div aria-hidden="true" className="my-4 h-px bg-linear-to-r from-blue-300/55 via-blue-300/15 to-transparent" />

              <p className="text-[14px] leading-relaxed text-slate-300">{p.body}</p>

              <ul className="mt-4 space-y-2.5">
                {p.bullets.map((b) => (
                  <li key={b} className="flex gap-3 text-[13.5px] leading-snug text-blue-50/90">
                    <span aria-hidden="true" className="ld-glyph" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 rounded-[2px] bg-blue-950/45 px-3 py-2.5 ring-1 ring-inset ring-blue-400/20">
                <p className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.26em] text-blue-300/75">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-ok shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                  {LABELS.screenFeed} · {p.code}
                </p>
                <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-cyan-200/90">
                  {p.screenLines.map((l) => (
                    <li key={l}>
                      <span aria-hidden="true" className="text-cyan-400/60">
                        ›{' '}
                      </span>
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-blue-300/20 px-3 py-2.5 sm:px-4">
          <HudButton
            variant="system"
            size="sm"
            silent
            icon={<ChevronLeft aria-hidden="true" className="size-3.5" />}
            aria-label={`${LABELS.prev}: ${PILLARS[wrap(index - 1)].title}`}
            onClick={() => go(index - 1)}
            className="pl-2.5 pr-3.5"
          >
            {LABELS.prev}
          </HudButton>
          <div className="flex items-center">
            {PILLARS.map((q, i) => (
              <button
                key={q.key}
                type="button"
                aria-label={`${LABELS.showModule} ${q.code} · ${q.title}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
                className="group grid h-8 w-7 cursor-pointer place-items-center"
              >
                <span
                  className={`block h-[3px] transition-all duration-300 ${
                    i === index
                      ? 'w-5 bg-blue-200 shadow-[0_0_8px_rgba(96,165,250,0.9)]'
                      : 'w-3 bg-blue-300/30 group-hover:bg-blue-200/70'
                  }`}
                />
              </button>
            ))}
          </div>
          <HudButton
            variant="system"
            size="sm"
            silent
            icon={<ChevronRight aria-hidden="true" className="size-3.5" />}
            aria-label={`${LABELS.next}: ${PILLARS[wrap(index + 1)].title}`}
            onClick={() => go(index + 1)}
            className="flex-row-reverse pl-3.5 pr-2.5"
          >
            {LABELS.next}
          </HudButton>
        </footer>
      </motion.div>
    </motion.section>
  );
}
