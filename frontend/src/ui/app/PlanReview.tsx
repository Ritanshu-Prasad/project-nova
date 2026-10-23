import { motion } from 'framer-motion';
import { ArrowRight, SendHorizontal, Sparkles, Trash2, TriangleAlert, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../../core/audio';
import { reviseOutline, type PlanChatMessage } from '../../core/courseApi';
import type { Course, Module } from '../../core/courseSchema';
import { canRemoveTopic, planCounts, plannedNote, removeModule, removeTopic, withModules } from '../../core/courseTrim';
import { HudButton } from '../common/HudButton';

const STARTERS = ['Make it shorter', 'Add practical examples', 'Skip the basics'];

interface Props {
  course: Course;
  expectations: string;
  onStart: (course: Course) => void;
}

/** The plan of a new course: modules with their topics, removable, and a chat that reshapes them before the course starts. */
export default function PlanReview({ course, expectations, onStart }: Props) {
  const [modules, setModules] = useState<Module[]>(course.modules);
  const [past, setPast] = useState<Module[][]>([]);
  const [chat, setChat] = useState<PlanChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const log = useRef<HTMLDivElement>(null);
  const counts = planCounts(modules);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [chat.length, busy]);

  const change = (next: Module[]) => {
    if (next === modules) return;
    setPast((p) => [...p, modules]);
    setModules(next);
    audio.play('click');
  };

  const undo = () => {
    setModules(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  };

  const send = async (message: string) => {
    const asked = message.trim();
    if (!asked || busy) return;
    setText('');
    setError('');
    setBusy(true);
    setChat((c) => [...c, { role: 'user', text: asked }]);
    try {
      const revision = await reviseOutline({ objective: course.objective, expectations, title: course.title, modules, message: asked, history: chat });
      setPast((p) => [...p, modules]);
      setModules(revision.modules);
      setChat((c) => [...c, { role: 'assistant', text: revision.reply || 'I updated the plan.' }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The plan could not be changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-2">
      <div className="chip-label">Your plan</div>
      <h2 id="new-course-title" className="mt-0.5 font-display text-2xl font-bold text-white">
        {course.title}
      </h2>
      <p className="mt-1.5 text-sm text-white/65">{plannedNote(course) || 'Remove what you do not need, or ask NOVA to change it.'}</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <section aria-label="Course plan" className="min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/45">
              {counts.modules} module{counts.modules === 1 ? '' : 's'} · {counts.topics} topic{counts.topics === 1 ? '' : 's'}
            </div>
            <button type="button" onClick={undo} disabled={past.length === 0} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent">
              <Undo2 size={14} /> Undo
            </button>
          </div>
          <ol className="scroll-y mt-3 max-h-[52vh] space-y-3 pr-1">
            {modules.map((m, mi) => (
              <li key={m.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg text-sm font-bold text-[var(--user-ink)]" style={{ background: 'var(--user)' }}>
                    {mi + 1}
                  </span>
                  <h3 className="min-w-0 flex-1 pt-0.5 font-display text-base font-semibold text-white">{m.title}</h3>
                  <RemoveButton label={`Remove module ${m.title}`} disabled={modules.length === 1} onClick={() => change(removeModule(modules, m.id))} />
                </div>
                <ul className="mt-3 space-y-1.5 pl-10">
                  {m.topics.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 rounded-xl bg-black/25 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white">{t.title}</div>
                        {t.summary && <div className="text-xs leading-snug text-white/60">{t.summary}</div>}
                      </div>
                      <RemoveButton label={`Remove topic ${t.title}`} disabled={!canRemoveTopic(m)} onClick={() => change(removeTopic(modules, m.id, t.id))} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Change the plan" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e1a]">
          <div className="flex items-center gap-3 py-3 pl-4 pr-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--user-ink)]" style={{ background: 'var(--user)', boxShadow: '0 0 18px rgb(var(--user-rgb) / 0.5)' }}>
              <Sparkles size={15} />
            </span>
            <div>
              <div className="font-display text-base font-semibold text-white">Change the plan</div>
              <div className="text-xs text-white/60">Tell NOVA what to add, drop or reorder</div>
            </div>
          </div>
          <div ref={log} className="scroll-y h-[min(32vh,300px)] space-y-3 px-4 pb-3" aria-live="polite">
            {chat.length === 0 ? (
              <div className="pt-1">
                <p className="text-sm leading-relaxed text-white/75">Not quite right? Ask for a change, or try one of these:</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {STARTERS.map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)} className="cursor-pointer rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/80 transition hover:border-[var(--user)] hover:text-white">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chat.map((m, i) => <Bubble key={i} m={m} />)
            )}
            {busy && <Typing />}
            {error && (
              <p role="alert" className="flex items-start gap-2 text-sm text-amber-300">
                <TriangleAlert size={15} className="mt-0.5 shrink-0" /> {error} The plan is unchanged.
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
            className="flex items-end gap-2 border-t border-white/[0.06] p-3"
          >
            <label className="sr-only" htmlFor="plan-chat">
              Ask NOVA to change the plan
            </label>
            <textarea
              id="plan-chat"
              rows={1}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(text);
                }
              }}
              placeholder={busy ? 'NOVA is thinking…' : 'e.g. add a topic about taxes…'}
              className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm leading-snug text-white outline-none placeholder:text-white/60 focus:border-[var(--user)]"
            />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-[var(--user-ink)] transition hover:brightness-110 disabled:cursor-default disabled:opacity-35" style={{ background: 'var(--user)' }}>
              <SendHorizontal size={17} />
            </button>
          </form>
        </section>
      </div>

      <div className="mt-6 flex justify-end border-t border-white/[0.07] pt-5">
        <HudButton variant="primary" size="lg" icon={<ArrowRight size={16} />} disabled={busy} onClick={() => onStart(withModules(course, modules))}>
          Start course ({counts.modules} module{counts.modules === 1 ? '' : 's'} · {counts.topics} topic{counts.topics === 1 ? '' : 's'})
        </HudButton>
      </div>
    </motion.div>
  );
}

function RemoveButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={disabled ? 'A plan keeps at least one of these' : label} disabled={disabled} onClick={onClick} className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-rose-300 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/50">
      <Trash2 size={15} />
    </button>
  );
}

function Bubble({ m }: { m: PlanChatMessage }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[rgb(var(--user-rgb)/0.22)] px-3.5 py-2 text-sm leading-relaxed text-white">{m.text}</div>
      </div>
    );
  }
  return <div className="max-w-[95%] rounded-2xl rounded-bl-md bg-white/[0.05] px-3.5 py-2.5 text-sm leading-relaxed text-white/85">{m.text}</div>;
}

function Typing() {
  return (
    <div className="w-fit rounded-2xl rounded-bl-md bg-white/[0.05] px-3.5 py-2.5">
      <span className="flex gap-1 py-1" aria-label="NOVA is typing">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="size-1.5 rounded-full bg-white/60" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }} />
        ))}
      </span>
    </div>
  );
}
