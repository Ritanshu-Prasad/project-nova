import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Check, ChevronDown, Flame, Lock, Map, NotebookPen, PanelLeft, Sparkles, Target, Trophy } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { audio } from '../../../core/audio';
import { levelOf, useActiveCourse, useCourse, type ActiveCourse } from '../../../core/course';
import type { Block, PlacedTopic } from '../../../core/courseSchema';
import { useHub } from '../../../core/hub';
import { Z } from '../../../core/layers';
import { KIND_TEMPLATES, type RailWidget } from './kinds';
import LessonView from './LessonView';
import QuizView from './QuizView';

/** Full-window study mode for lessons and quizzes: outline · content · template-driven side rail. */
export default function StudyMode({ mode }: { mode: 'lesson' | 'quiz' }) {
  const active = useActiveCourse();
  const [outlineOpen, setOutlineOpen] = useState(true);
  if (!active) return null;
  const topic = active.current;
  const tpl = KIND_TEMPLATES[topic.kind];

  return (
    <motion.div
      className="pointer-events-auto fixed inset-0 flex flex-col bg-[#070a13]/[0.96] backdrop-blur-xl"
      style={{ zIndex: Z.topbar + 2 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.35, delay: 0.25 } }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      role="dialog"
      aria-label={mode === 'lesson' ? 'Lesson' : 'Quiz'}
    >
      <TopBar active={active} mode={mode} onToggleOutline={() => setOutlineOpen((v) => !v)} />
      <div className="flex min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {outlineOpen && (
            <motion.aside
              key="outline"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 290, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="hidden shrink-0 overflow-hidden border-r border-white/[0.06] lg:block"
            >
              <Outline active={active} mode={mode} />
            </motion.aside>
          )}
        </AnimatePresence>
        <main className="scroll-y min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[860px] px-5 py-8 sm:px-10">
            <MobileTopicPicker active={active} mode={mode} />
            {mode === 'lesson' ? <LessonView key={topic.id} topic={topic} /> : <QuizView key={topic.id} topic={topic} />}
          </div>
        </main>
        <aside className="scroll-y hidden w-[320px] shrink-0 border-l border-white/[0.06] p-5 xl:block">
          <Rail key={topic.id} topic={topic} widgets={mode === 'quiz' ? ['tip', 'notes'] : tpl.rail} />
        </aside>
      </div>
    </motion.div>
  );
}

function TopBar({ active, mode, onToggleOutline }: { active: ActiveCourse; mode: 'lesson' | 'quiz'; onToggleOutline: () => void }) {
  const stats = useCourse((s) => s.stats);
  const go = (s: 'lesson' | 'quiz' | 'hub' | 'journey') => {
    audio.play('click');
    useHub.getState().go(s);
  };
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6">
      <button type="button" onClick={() => go('hub')} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/75 transition hover:bg-white/[0.12] hover:text-white">
        <ArrowLeft size={13} /> Lounge <kbd className="ml-1 hidden font-mono text-[10px] text-white/40 sm:inline">Esc</kbd>
      </button>
      <button type="button" onClick={onToggleOutline} aria-label="Toggle course outline" className="hidden cursor-pointer rounded-lg p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white lg:block">
        <PanelLeft size={17} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{active.course.title}</div>
        <div className="truncate text-xs text-white/45">{active.current.moduleTitle}</div>
      </div>
      <nav className="flex rounded-full bg-white/[0.05] p-1" aria-label="Study mode">
        {(['lesson', 'quiz'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => go(m)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${mode === m ? 'text-[var(--user-ink)]' : 'text-white/60 hover:text-white'}`}
            style={mode === m ? { background: 'var(--user)' } : undefined}
          >
            {m === 'lesson' ? <BookOpen size={13} /> : <Target size={13} />} {m === 'lesson' ? 'Lesson' : 'Quiz'}
          </button>
        ))}
      </nav>
      <div className="hidden items-center gap-2 text-xs md:flex">
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-white/80">{stats.mmr.toLocaleString('en-IN')} MMR</span>
        <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-amber-200">
          <Flame size={12} /> {stats.streak}
        </span>
        <span className="rounded-full px-2.5 py-1 font-semibold text-[var(--user-ink)]" style={{ background: 'var(--user)' }}>
          LV {levelOf(stats.xp)}
        </span>
      </div>
    </header>
  );
}

function statusOf(active: ActiveCourse, t: PlacedTopic): 'cleared' | 'open' | 'locked' {
  if (active.entry.progress[t.id]?.cleared) return 'cleared';
  return t.index <= active.cleared ? 'open' : 'locked';
}

function Outline({ active, mode }: { active: ActiveCourse; mode: 'lesson' | 'quiz' }) {
  const pct = Math.round((active.cleared / active.topics.length) * 100);
  return (
    <div className="scroll-y h-full w-[290px] p-5">
      <div className="chip-label">Course outline</div>
      <div className="mt-2 flex items-center gap-2 text-xs text-white/55">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--user)' }} />
        </span>
        {pct}%
      </div>
      <div className="mt-5 space-y-5">
        {active.course.modules.map((m, mi) => (
          <div key={m.id}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              Module {mi + 1} · {m.title}
            </div>
            <ul className="space-y-1">
              {active.topics
                .filter((t) => t.moduleIndex === mi)
                .map((t) => {
                  const st = statusOf(active, t);
                  const here = t.id === active.current.id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        disabled={st === 'locked'}
                        onClick={() => {
                          useCourse.getState().openTopic(t.id);
                          useHub.getState().go(mode);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${here ? 'bg-white/[0.08] text-white' : 'text-white/70 enabled:hover:bg-white/[0.05]'} disabled:cursor-not-allowed disabled:opacity-40 enabled:cursor-pointer`}
                      >
                        <span className="grid size-5 shrink-0 place-items-center rounded-full text-[var(--user-ink)]" style={{ background: st === 'cleared' ? 'var(--user)' : 'rgb(255 255 255 / 0.08)' }}>
                          {st === 'cleared' ? <Check size={11} strokeWidth={3} /> : st === 'locked' ? <Lock size={10} className="text-white/60" /> : <span className="size-1.5 rounded-full bg-white/70" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        <span className="text-[10px] text-white/35">{t.lesson.minutes}m</span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => useHub.getState().go('journey')} className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs text-white/65 transition hover:border-[var(--user)] hover:text-white">
        <Map size={13} /> Open journey map
      </button>
    </div>
  );
}

/** Small screens: the outline becomes a dropdown above the content. */
function MobileTopicPicker({ active, mode }: { active: ActiveCourse; mode: 'lesson' | 'quiz' }) {
  return (
    <label className="relative mb-6 block lg:hidden">
      <span className="sr-only">Topic</span>
      <select
        value={active.current.id}
        onChange={(e) => {
          useCourse.getState().openTopic(e.target.value);
          useHub.getState().go(mode);
        }}
        className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 pr-10 text-sm text-white"
      >
        {active.topics.map((t) => (
          <option key={t.id} value={t.id} disabled={statusOf(active, t) === 'locked'} className="bg-[#0d1220]">
            {t.index + 1}. {t.title}
            {statusOf(active, t) === 'cleared' ? ' ✓' : ''}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50" />
    </label>
  );
}

function Widget({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="chip-label mb-2.5">
        {icon} {title}
      </div>
      {children}
    </section>
  );
}

function blocksOf<T extends Block['type']>(t: PlacedTopic, type: T) {
  return t.lesson.blocks.filter((b): b is Extract<Block, { type: T }> => b.type === type);
}

function Rail({ topic, widgets }: { topic: PlacedTopic; widgets: RailWidget[] }) {
  const [done, setDone] = useState<number[]>([]);
  const tpl = KIND_TEMPLATES[topic.kind];
  return (
    <div className="space-y-4">
      {widgets.map((w) => {
        switch (w) {
          case 'objectives':
            return topic.lesson.objectives.length ? (
              <Widget key={w} icon={<Trophy size={12} />} title="You will be able to">
                <ul className="space-y-1.5">
                  {topic.lesson.objectives.map((o, i) => (
                    <li key={o}>
                      <button type="button" onClick={() => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))} className="flex w-full cursor-pointer items-start gap-2 text-left text-sm text-white/80">
                        <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-white/25" style={done.includes(i) ? { background: 'var(--user)', borderColor: 'var(--user)' } : undefined}>
                          {done.includes(i) && <Check size={10} className="text-[var(--user-ink)]" strokeWidth={3} />}
                        </span>
                        <span className={done.includes(i) ? 'text-white/45 line-through' : ''}>{o}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Widget>
            ) : null;
          case 'terms': {
            const terms = blocksOf(topic, 'keyTerms').flatMap((b) => b.terms);
            return terms.length ? (
              <Widget key={w} icon={<BookOpen size={12} />} title="Glossary">
                <dl className="space-y-2 text-sm">
                  {terms.map((t) => (
                    <div key={t.term}>
                      <dt className="font-semibold text-white">{t.term}</dt>
                      <dd className="text-white/60">{t.def}</dd>
                    </div>
                  ))}
                </dl>
              </Widget>
            ) : null;
          }
          case 'formulas': {
            const f = blocksOf(topic, 'formula');
            return f.length ? (
              <Widget key={w} icon={<Sparkles size={12} />} title="Formula sheet">
                <ul className="space-y-2">
                  {f.map((x) => (
                    <li key={x.expr} className="rounded-xl bg-black/30 px-3 py-2 font-serif text-base text-white">
                      {x.expr}
                    </li>
                  ))}
                </ul>
              </Widget>
            ) : null;
          }
          case 'snippets': {
            const c = blocksOf(topic, 'code');
            return c.length ? (
              <Widget key={w} icon={<BookOpen size={12} />} title="Snippets">
                <ul className="space-y-2">
                  {c.map((x, i) => (
                    <li key={i} className="truncate rounded-xl bg-black/30 px-3 py-2 font-mono text-xs text-sky-100/80">
                      {x.code.split('\n')[0]}
                    </li>
                  ))}
                </ul>
              </Widget>
            ) : null;
          }
          case 'sources': {
            const s = blocksOf(topic, 'source');
            return s.length ? (
              <Widget key={w} icon={<BookOpen size={12} />} title="Sources">
                <ul className="space-y-1.5 text-sm text-white/70">
                  {s.map((x, i) => (
                    <li key={i}>
                      {x.doc}
                      {x.page ? <span className="text-white/45"> · p. {x.page}</span> : null}
                    </li>
                  ))}
                </ul>
              </Widget>
            ) : null;
          }
          case 'notes':
            return <Notes key={w} topicId={topic.id} />;
          case 'tip':
            return (
              <Widget key={w} icon={<Sparkles size={12} />} title="Pixel’s tip">
                <p className="text-sm leading-relaxed text-white/70">{tpl.tip}</p>
              </Widget>
            );
        }
      })}
    </div>
  );
}

function Notes({ topicId }: { topicId: string }) {
  const saved = useCourse((s) => (s.activeId ? (s.library[s.activeId]?.progress[topicId]?.notes ?? '') : ''));
  const [text, setText] = useState(saved);
  useEffect(() => {
    const id = setTimeout(() => {
      if (text !== saved) useCourse.getState().setNotes(topicId, text);
    }, 400);
    return () => clearTimeout(id);
  }, [text, saved, topicId]);
  return (
    <Widget icon={<NotebookPen size={12} />} title="Your notes">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Jot down what clicked, questions to ask, or a quick sketch in words…"
        className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-[var(--user)]"
      />
      <div className="mt-1 text-[11px] text-white/35">Saved automatically</div>
    </Widget>
  );
}
