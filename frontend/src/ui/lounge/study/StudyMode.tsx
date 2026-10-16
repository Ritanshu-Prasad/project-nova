import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Bookmark,
  Braces,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Flame,
  FlaskConical,
  Footprints,
  Globe,
  KeyRound,
  Lightbulb,
  ListChecks,
  ListOrdered,
  Lock,
  TrendingUp,
  NotebookPen,
  PanelLeft,
  PanelRight,
  Scale,
  Sigma,
  Sparkles,
  Target,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { frontier, isDone, levelOf, useActiveCourse, useCourse, useSkill, type ActiveCourse, type OutlineItem } from '../../../core/course';
import type { Block, PlacedTopic } from '../../../core/courseSchema';
import { useHub } from '../../../core/hub';
import { Z } from '../../../core/layers';
import { prettyMath } from '../../../core/mathText';
import { LESSON_QUIZ, quizSizeLabel } from '../../../core/quizBuilder';
import { rankOf } from '../../../core/rank';
import RankEmblem from '../RankEmblem';
import { KIND_TEMPLATES } from './kinds';
import LessonView from './LessonView';
import ModuleQuiz from './ModuleQuiz';
import TopicGate from './TopicGate';
import TutorChat from './TutorChat';

const LS_RAIL_W = 'nova.rail.width';
const LS_RAIL_OPEN = 'nova.rail.open';
const LS_RAIL_SECTIONS = 'nova.rail.sections';

const readLS = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const writeLS = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

/** Full-window study: module outline · lesson or module quiz · resizable side panel. */
export default function StudyMode() {
  const active = useActiveCourse();
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [railOpen, setRailOpen] = useState(() => readLS(LS_RAIL_OPEN, true));
  const [railW, setRailW] = useState(() => readLS(LS_RAIL_W, 360));
  const [sheet, setSheet] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const itemId = active?.item.id;

  // New outline item → start at the top of the page.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [itemId]);

  if (!active) return null;
  const { item } = active;
  const topic = item.kind === 'topic' ? item.topic : null;

  return (
    <motion.div
      className="pointer-events-auto fixed inset-0 flex flex-col bg-[#070a13]/[0.97] font-sans backdrop-blur-xl"
      style={{ zIndex: Z.topbar + 2 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.35, delay: 0.25 } }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      role="dialog"
      aria-label="Study"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-6">
        <button type="button" onClick={() => useHub.getState().go('hub')} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-white/75 transition hover:bg-white/[0.12] hover:text-white">
          <ArrowLeft size={14} /> Lounge <kbd className="ml-1 hidden text-[11px] text-white/40 sm:inline">Esc</kbd>
        </button>
        <IconBtn label="Toggle course outline" onClick={() => setOutlineOpen((v) => !v)} className="hidden lg:grid">
          <PanelLeft size={17} />
        </IconBtn>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-semibold text-white">{active.course.title}</div>
          <div className="truncate text-sm text-white/45">
            Module {item.moduleIndex + 1} · {active.course.modules[item.moduleIndex].title}
          </div>
        </div>
        <Stats />
        <IconBtn
          label="Toggle side panel"
          onClick={() => {
            setRailOpen((v) => !v);
            writeLS(LS_RAIL_OPEN, !railOpen);
          }}
          className="hidden xl:grid"
        >
          <PanelRight size={17} />
        </IconBtn>
      </header>

      <div className="flex min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {outlineOpen && (
            <motion.aside key="outline" initial={{ width: 0, opacity: 0 }} animate={{ width: 300, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="hidden shrink-0 overflow-hidden border-r border-white/[0.06] lg:block">
              <Outline active={active} />
            </motion.aside>
          )}
        </AnimatePresence>

        <main ref={mainRef} className="scroll-y min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[820px] px-5 py-8 sm:px-10">
            <MobilePicker active={active} />
            {item.kind === 'topic' ? (
              <TopicGate key={item.id} courseId={active.course.id} topic={item.topic}>
                <LessonView topic={item.topic} active={active} />
              </TopicGate>
            ) : <ModuleQuiz key={item.id} item={item} active={active} />}
          </div>
        </main>

        {railOpen && (
          <aside className="relative hidden shrink-0 border-l border-white/[0.06] xl:flex xl:flex-col" style={{ width: railW }}>
            <Resizer onResize={(w) => setRailW(w)} onDone={(w) => writeLS(LS_RAIL_W, w)} />
            <div className="scroll-y min-h-0 flex-1 p-5">
              <Rail key={item.id} topic={topic?.loaded === false ? null : topic} />
            </div>
            <TutorChat active={active} />
          </aside>
        )}
      </div>

      {/* Smaller screens (or panel hidden): the tutor opens as a sheet. */}
      <AnimatePresence>
        {sheet ? (
          <TutorChat key="sheet" active={active} variant="sheet" onClose={() => setSheet(false)} />
        ) : (
          <motion.button
            key="fab"
            type="button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={() => setSheet(true)}
            className={`fixed bottom-5 right-5 z-10 flex cursor-pointer items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-[var(--user-ink)] shadow-[0_10px_30px_-8px_rgb(var(--user-rgb)/0.8)] transition hover:brightness-110 ${railOpen ? 'xl:hidden' : ''}`}
            style={{ background: 'var(--user)' }}
          >
            <Sparkles size={16} /> Ask NOVA
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function IconBtn({ label, onClick, className = '', children }: { label: string; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white ${className}`}>
      {children}
    </button>
  );
}

function Stats() {
  const stats = useCourse((s) => s.stats);
  const skill = useSkill();
  const rank = rankOf(skill.mmr);
  return (
    <div className="hidden items-center gap-2 text-sm md:flex">
      <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-1.5 pr-2.5 text-white/80">
        <RankEmblem rank={rank} size={20} /> {rank.label} · {skill.mmr.toLocaleString('en-IN')}
      </span>
      <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-amber-200">
        <Flame size={12} /> {stats.streak}
      </span>
      <span className="rounded-full px-2.5 py-1 font-semibold text-[var(--user-ink)]" style={{ background: 'var(--user)' }}>
        LV {levelOf(stats.xp)}
      </span>
    </div>
  );
}

/** Drag the panel's left edge to resize it. */
function Resizer({ onResize, onDone }: { onResize: (w: number) => void; onDone: (w: number) => void }) {
  const last = useRef(0);
  const width = (x: number) => Math.max(260, Math.min(620, window.innerWidth - x));
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize side panel"
      title="Drag to resize"
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        last.current = width(e.clientX);
        onResize(last.current);
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (last.current) onDone(last.current);
      }}
      className="group absolute left-0 top-0 z-10 h-full w-2 -translate-x-1 cursor-col-resize"
    >
      <span className="mx-auto block h-full w-0.5 bg-transparent transition group-hover:bg-[var(--user)]" />
    </div>
  );
}

const itemNumber = (active: ActiveCourse, t: PlacedTopic) => `${t.moduleIndex + 1}.${active.topics.filter((x) => x.moduleIndex === t.moduleIndex).findIndex((x) => x.id === t.id) + 1}`;

/** GeeksforGeeks-style outline: collapsible modules, numbered sub-topics, a module quiz at the end of each. */
function Outline({ active }: { active: ActiveCourse }) {
  const f = frontier(active.entry, active.outline);
  const [open, setOpen] = useState<Record<number, boolean>>(() => ({ [active.item.moduleIndex]: true }));
  useEffect(() => setOpen((o) => ({ ...o, [active.item.moduleIndex]: true })), [active.item.moduleIndex]);
  const pct = Math.round((active.cleared / active.topics.length) * 100);

  return (
    <nav className="scroll-y h-full w-[300px] py-4" aria-label="Course outline">
      <div className="px-5">
        <div className="font-display text-sm font-semibold text-white">Course outline</div>
        <div className="mt-2 flex items-center gap-2 text-sm text-white/55">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--user)' }} />
          </span>
          {pct}%
        </div>
      </div>
      <ul className="mt-4">
        {active.course.modules.map((m, mi) => {
          const items = active.outline.filter((it) => it.moduleIndex === mi);
          const doneCount = items.filter((it) => isDone(active.entry, it)).length;
          const isOpen = !!open[mi];
          return (
            <li key={m.id} className="border-t border-white/[0.05]">
              <button type="button" onClick={() => setOpen((o) => ({ ...o, [mi]: !o[mi] }))} aria-expanded={isOpen} className="flex w-full cursor-pointer items-center gap-2 px-5 py-3 text-left transition hover:bg-white/[0.03]">
                {isOpen ? <ChevronDown size={15} className="shrink-0 text-white/50" /> : <ChevronRight size={15} className="shrink-0 text-white/50" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-white/40">Module {mi + 1}</span>
                  <span className="block truncate font-display text-base font-semibold text-white">{m.title}</span>
                </span>
                <span className="text-xs text-white/45">
                  {doneCount}/{items.length}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.ul initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden pb-2">
                    {items.map((it) => (
                      <OutlineRow key={it.id} active={active} it={it} locked={active.outline.indexOf(it) > f} />
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={() => useHub.getState().go('journey')} className="mx-5 mt-4 flex w-[calc(100%-40px)] cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-sm text-white/65 transition hover:border-[var(--user)] hover:text-white">
        <TrendingUp size={13} /> Skill journey
      </button>
    </nav>
  );
}

function OutlineRow({ active, it, locked }: { active: ActiveCourse; it: OutlineItem; locked: boolean }) {
  const done = isDone(active.entry, it);
  const here = it.id === active.item.id;
  const best = it.kind === 'quiz' ? active.entry.modules[it.module.id]?.best : undefined;
  return (
    <li>
      <button
        type="button"
        disabled={locked}
        onClick={() => useCourse.getState().open(it.id)}
        className={`flex w-full items-center gap-2.5 border-l-[3px] py-2 pl-[42px] pr-5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 enabled:cursor-pointer ${here ? 'border-[var(--user)] bg-white/[0.06] text-white' : 'border-transparent text-white/70 enabled:hover:bg-white/[0.03] enabled:hover:text-white'}`}
      >
        <span className="grid size-[18px] shrink-0 place-items-center rounded-full text-[var(--user-ink)]" style={{ background: done ? 'var(--user)' : 'rgb(255 255 255 / 0.08)' }}>
          {done ? <Check size={11} strokeWidth={3} /> : locked ? <Lock size={9} className="text-white/60" /> : it.kind === 'quiz' ? <Target size={10} className="text-white/70" /> : <span className="size-1.5 rounded-full bg-white/70" />}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {it.kind === 'topic' ? (
            <>
              <span className="text-white/40">{itemNumber(active, it.topic)}</span> {it.topic.title}
            </>
          ) : (
            <span className="font-semibold">Module quiz</span>
          )}
        </span>
        <span className="text-xs text-white/35">{it.kind === 'topic' ? `${it.topic.lesson.minutes}m` : best !== undefined ? `${Math.round(best * 100)}%` : `${quizSizeLabel(it.pool.length, LESSON_QUIZ.min, LESSON_QUIZ.max)} Q`}</span>
      </button>
    </li>
  );
}

/** Small screens: the outline becomes a dropdown above the content. */
function MobilePicker({ active }: { active: ActiveCourse }) {
  const f = frontier(active.entry, active.outline);
  return (
    <label className="relative mb-6 block lg:hidden">
      <span className="sr-only">Go to</span>
      <select value={active.item.id} onChange={(e) => useCourse.getState().open(e.target.value)} className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 pr-10 text-sm text-white">
        {active.outline.map((it, i) => (
          <option key={it.id} value={it.id} disabled={i > f} className="bg-[#0d1220]">
            {it.kind === 'topic' ? `${itemNumber(active, it.topic)} ${it.topic.title}` : `Module ${it.moduleIndex + 1} quiz`}
            {isDone(active.entry, it) ? ' ✓' : ''}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50" />
    </label>
  );
}

interface SectionDef {
  title: string;
  icon: LucideIcon;
  count?: number;
  body: ReactNode;
}

const panelIcon = (title: string): LucideIcon =>
  /mistake|pitfall|avoid/i.test(title)
    ? TriangleAlert
    : /used|use it|when to|real/i.test(title)
      ? Globe
      : /memory|trick|remember/i.test(title)
        ? Brain
        : /before|prereq/i.test(title)
          ? Footprints
          : /exam|focus/i.test(title)
            ? Target
            : /try|practice|exercise/i.test(title)
              ? FlaskConical
              : /rule/i.test(title)
                ? Scale
                : Bookmark;

function blocksOf<T extends Block['type']>(t: PlacedTopic, type: T) {
  return t.lesson.blocks.filter((b): b is Extract<Block, { type: T }> => b.type === type);
}

const List = ({ items, mono = false }: { items: string[]; mono?: boolean }) => (
  <ul className="space-y-2">
    {items.map((x, i) => (
      <li key={i} className={mono ? 'rounded-xl bg-black/30 px-3 py-2 font-mono text-white' : 'flex gap-2'}>
        {!mono && <span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: 'var(--user)' }} />}
        {x}
      </li>
    ))}
  </ul>
);

/** The side panel's sections come from the topic itself — as many as it has content for. */
function sectionsFor(topic: PlacedTopic, checklist: ReactNode): SectionDef[] {
  const out: SectionDef[] = [];
  const o = topic.lesson.objectives;
  if (o.length) out.push({ title: 'Checklist', icon: ListChecks, count: o.length, body: checklist });
  const terms = blocksOf(topic, 'keyTerms').flatMap((b) => b.terms);
  if (terms.length)
    out.push({
      title: 'Key terms',
      icon: KeyRound,
      count: terms.length,
      body: (
        <dl className="space-y-2.5">
          {terms.map((t) => (
            <div key={t.term}>
              <dt className="font-semibold text-white">{t.term}</dt>
              <dd className="text-white/65">{t.def}</dd>
            </div>
          ))}
        </dl>
      ),
    });
  const f = blocksOf(topic, 'formula');
  if (f.length) out.push({ title: 'Formula list', icon: Sigma, count: f.length, body: <List mono items={f.map((x) => prettyMath(x.expr))} /> });
  const code = blocksOf(topic, 'code');
  if (code.length) out.push({ title: 'Code snippets', icon: Braces, count: code.length, body: <List mono items={code.map((x) => x.code.split('\n')[0])} /> });
  const steps = blocksOf(topic, 'steps');
  if (steps.length) out.push({ title: 'Steps at a glance', icon: ListOrdered, count: steps[0].steps.length, body: <List items={steps.flatMap((x) => x.steps)} /> });
  for (const p of topic.lesson.panels ?? [])
    out.push({ title: p.title, icon: panelIcon(p.title), count: p.items?.length || undefined, body: p.items?.length ? <List items={p.items} /> : <p>{p.body}</p> });
  const sum = blocksOf(topic, 'summary');
  if (sum.length) out.push({ title: 'Key takeaways', icon: Check, count: sum[0].points.length, body: <List items={sum.flatMap((x) => x.points)} /> });
  const src = blocksOf(topic, 'source');
  if (src.length) out.push({ title: 'Sources', icon: FileText, count: src.length, body: <List items={src.map((x) => `${x.doc}${x.page ? ` · page ${x.page}` : ''}`)} /> });
  out.push({ title: 'My notes', icon: NotebookPen, body: <Notes topicId={topic.id} /> });
  out.push({ title: 'Study tip', icon: Lightbulb, body: KIND_TEMPLATES[topic.kind].tip });
  return out;
}

function Section({ def, defaultOpen }: { def: SectionDef; defaultOpen: boolean }) {
  const [open, setOpen] = useState(() => readLS<Record<string, boolean>>(LS_RAIL_SECTIONS, {})[def.title] ?? defaultOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    writeLS(LS_RAIL_SECTIONS, { ...readLS<Record<string, boolean>>(LS_RAIL_SECTIONS, {}), [def.title]: next });
  };
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03]">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left">
        <def.icon size={16} className="shrink-0" style={{ color: 'var(--user)' }} />
        <span className="min-w-0 flex-1 truncate font-display text-base font-semibold text-white">{def.title}</span>
        {def.count ? <span className="rounded-full bg-white/[0.07] px-2 text-xs text-white/55">{def.count}</span> : null}
        {open ? <ChevronDown size={15} className="text-white/45" /> : <ChevronRight size={15} className="text-white/45" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 text-sm leading-relaxed text-white/75">{def.body}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Rail({ topic }: { topic: PlacedTopic | null }) {
  const [done, setDone] = useState<number[]>([]);
  if (!topic) {
    return (
      <Section
        def={{ title: 'Quiz tips', icon: Lightbulb, body: 'Answer from memory first — it’s fine to get some wrong. Every question teaches you something, and you can retake the quiz.' }}
        defaultOpen
      />
    );
  }
  const checklist = (
    <ul className="space-y-2">
      {topic.lesson.objectives.map((o, i) => (
        <li key={o}>
          <button type="button" onClick={() => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))} className="flex w-full cursor-pointer items-start gap-2.5 text-left">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-white/25" style={done.includes(i) ? { background: 'var(--user)', borderColor: 'var(--user)' } : undefined}>
              {done.includes(i) && <Check size={10} className="text-[var(--user-ink)]" strokeWidth={3} />}
            </span>
            <span className={done.includes(i) ? 'text-white/40 line-through' : ''}>{o}</span>
          </button>
        </li>
      ))}
    </ul>
  );
  const defs = sectionsFor(topic, checklist);
  return (
    <div className="space-y-3">
      <div className="px-1 text-xs text-white/40">{defs.length} sections for this topic</div>
      {defs.map((d, i) => (
        <Section key={d.title} def={d} defaultOpen={i < 2} />
      ))}
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
    <>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Write what clicked, questions to ask, or a quick summary in your own words…"
        className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-[var(--user)]"
      />
      <div className="mt-1 text-xs text-white/35">Saved automatically</div>
    </>
  );
}
