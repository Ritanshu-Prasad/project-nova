import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, RotateCcw, SendHorizontal, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ActiveCourse } from '../../../core/course';
import { useSkill } from '../../../core/course';
import { useProfile } from '../../../core/hub';
import { rankOf } from '../../../core/rank';
import { hasTutorApi, useTutor, type ChatMsg } from '../../../core/tutor';
import { Markdown } from './markdown';

const LS_OPEN = 'nova.tutor.open';
const SUGGESTIONS = ['Explain it simply', 'Give me an example', 'Quiz me', 'Summarise this topic'];
const EMPTY: ChatMsg[] = [];

/**
 * "Ask NOVA" — the lesson assistant. Docked at the bottom of the side panel (collapsible to a single input row),
 * or shown as a sheet on smaller screens.
 */
export default function TutorChat({ active, variant = 'dock', onClose }: { active: ActiveCourse; variant?: 'dock' | 'sheet'; onClose?: () => void }) {
  const item = active.item;
  const key = item.id;
  const msgs = useTutor((s) => s.threads[key] ?? EMPTY);
  const busy = useTutor((s) => s.busy === key);
  const callsign = useProfile((s) => s.callsign) || 'pilot';
  const mmr = useSkill().mmr;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(LS_OPEN) !== '0';
    } catch {
      return true;
    }
  });
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const expanded = variant === 'sheet' || open;
  const last = msgs[msgs.length - 1];

  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(LS_OPEN, open ? '0' : '1');
    } catch {
      /* ignore */
    }
  };

  // Keep the newest message in view while it streams in.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [msgs.length, last?.content, expanded]);

  // Grow the input with its content, up to ~4 lines.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [text]);

  if (item.kind === 'quiz') {
    return (
      <Shell variant={variant} onClose={onClose}>
        <Header expanded={false} inset={variant === 'sheet'} />
        <p className="px-4 pb-4 text-sm text-white/60">The tutor takes a break during module quizzes — you’ve got this! It’s back on the next topic.</p>
      </Shell>
    );
  }

  const send = (q: string) => {
    if (!q.trim() || busy || item.topic.loaded === false) return;
    if (!open && variant === 'dock') toggle();
    setText('');
    void useTutor.getState().send(key, q, { course: active.course.title, module: active.course.modules[item.moduleIndex].title, topic: item.topic, rank: rankOf(mmr).label, courseRef: active.course });
  };

  return (
    <Shell variant={variant} onClose={onClose}>
      <Header
        expanded={expanded}
        inset={variant === 'sheet'}
        onToggle={variant === 'dock' ? toggle : undefined}
        onClear={msgs.length ? () => useTutor.getState().clear(key) : undefined}
      />

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`flex min-h-0 flex-col overflow-hidden ${variant === 'sheet' ? 'flex-1' : ''}`}
          >
            <div ref={list} className={`scroll-y space-y-3 px-4 pb-3 ${variant === 'sheet' ? 'flex-1' : 'h-[min(34vh,380px)]'}`} aria-live="polite">
              {msgs.length === 0 ? (
                <div className="pt-2">
                  <p className="text-sm leading-relaxed text-white/75">
                    {item.topic.loaded === false ? (
                      <>I can help as soon as the lesson on <span className="font-semibold text-white">{item.topic.title}</span> has loaded.</>
                    ) : (
                      <>Hi {callsign}! Ask me anything about <span className="font-semibold text-white">{item.topic.title}</span> — or try one of these:</>
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => send(s)} className="cursor-pointer rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 transition hover:border-[var(--user)] hover:text-white">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                msgs.map((m, i) => <Bubble key={i} m={m} typing={busy && i === msgs.length - 1 && !m.content} />)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-end gap-2 border-t border-white/[0.06] p-3"
      >
        <label className="sr-only" htmlFor={`tutor-${variant}`}>
          Ask NOVA about this lesson
        </label>
        <textarea
          id={`tutor-${variant}`}
          ref={input}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Esc leaves the box first; a second Esc closes the study screen.
            if (e.key === 'Escape') e.currentTarget.blur();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          placeholder={busy ? 'NOVA is thinking…' : 'Ask about this lesson…'}
          className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm leading-snug text-white outline-none placeholder:text-white/60 focus:border-[var(--user)]"
        />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-[var(--user-ink)] transition hover:brightness-110 disabled:cursor-default disabled:opacity-35" style={{ background: 'var(--user)' }}>
          <SendHorizontal size={17} />
        </button>
      </form>
    </Shell>
  );
}

function Shell({ variant, onClose, children }: { variant: 'dock' | 'sheet'; onClose?: () => void; children: ReactNode }) {
  if (variant === 'dock') return <section className="shrink-0 border-t border-white/[0.08] bg-[#0a0e1a]">{children}</section>;
  return (
    <motion.section
      role="dialog"
      aria-label="Ask NOVA"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      className="fixed bottom-3 right-3 z-10 flex h-[min(72vh,640px)] w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e1a] shadow-2xl sm:w-[420px]"
    >
      {onClose && (
        <button type="button" aria-label="Close tutor" onClick={onClose} className="absolute right-3 top-3 z-10 cursor-pointer rounded-lg p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white">
          <X size={16} />
        </button>
      )}
      {children}
    </motion.section>
  );
}

function Header({ expanded, onToggle, onClear, inset }: { expanded: boolean; onToggle?: () => void; onClear?: () => void; inset?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-3 pl-4 ${inset ? 'pr-12' : 'pr-3'}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--user-ink)]" style={{ background: 'var(--user)', boxShadow: '0 0 18px rgb(var(--user-rgb) / 0.5)' }}>
        <Sparkles size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-base font-semibold text-white">Ask NOVA</div>
        <div className="truncate text-xs text-white/60">{hasTutorApi ? 'AI tutor for this lesson' : 'Offline tutor · answers from this lesson'}</div>
      </div>
      {onClear && (
        <button type="button" aria-label="Clear chat" title="Clear chat" onClick={onClear} className="cursor-pointer rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white">
          <RotateCcw size={15} />
        </button>
      )}
      {onToggle && (
        <button type="button" aria-label={expanded ? 'Collapse tutor' : 'Expand tutor'} aria-expanded={expanded} onClick={onToggle} className="cursor-pointer rounded-lg p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white">
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      )}
    </div>
  );
}

function Bubble({ m, typing }: { m: ChatMsg; typing: boolean }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[rgb(var(--user-rgb)/0.22)] px-3.5 py-2 text-sm leading-relaxed text-white">{m.content}</div>
      </div>
    );
  }
  return (
    <div className="max-w-[95%] rounded-2xl rounded-bl-md bg-white/[0.05] px-3.5 py-2.5 text-sm leading-relaxed text-white/85">
      {typing ? (
        <span className="flex gap-1 py-1" aria-label="NOVA is typing">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="size-1.5 rounded-full bg-white/60" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }} />
          ))}
        </span>
      ) : (
        <Markdown text={m.content} />
      )}
    </div>
  );
}
