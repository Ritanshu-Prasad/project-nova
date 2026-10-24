import { AnimatePresence, motion, useInView } from 'framer-motion';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock, Lightbulb } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { frontier, useCourse, type ActiveCourse } from '../../../core/course';
import type { PlacedTopic } from '../../../core/courseSchema';
import { holoBurst } from '../../../core/journey';
import Blocks from './Blocks';
import Btn from './Btn';
import { TYPE } from './typography';
import { BADGE_KINDS, KIND_TEMPLATES } from './kinds';

/** A lesson: kind-tinted header, optional plain-language version, typed blocks, then "complete & continue". */
export default function LessonView({ topic, active }: { topic: PlacedTopic; active: ActiveCourse }) {
  const [simple, setSimple] = useState(false);
  const tpl = KIND_TEMPLATES[topic.kind];
  const Icon = tpl.icon;
  const done = !!active.entry.progress[topic.id]?.cleared;
  const i = active.outline.findIndex((it) => it.id === topic.id);
  const nextItem = active.outline[i + 1];
  const nextLabel = !nextItem ? null : nextItem.kind === 'quiz' ? `Module ${nextItem.moduleIndex + 1} quiz` : nextItem.topic.title;

  const complete = () => {
    const next = useCourse.getState().completeTopic(topic.id);
    holoBurst(0.6);
    if (next) useCourse.getState().open(next);
  };

  const siblings = active.topics.filter((t) => t.moduleIndex === topic.moduleIndex);
  const topicNo = siblings.findIndex((t) => t.id === topic.id) + 1;
  const prevItem = active.outline[i - 1];
  const canNext = !!nextItem && i + 1 <= frontier(active.entry, active.outline);

  const headerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const headerVisible = useInView(headerRef, { margin: '-72px 0px 0px 0px' });
  const footerVisible = useInView(footerRef, { margin: '0px 0px -40px 0px' });

  return (
    <article className="font-sans">
      <LessonBar title={topic.title} where={`Planet ${topic.moduleIndex + 1} · ${topicNo}/${siblings.length}`} show={!headerVisible} onPrev={prevItem ? () => useCourse.getState().open(prevItem.id) : undefined} onNext={canNext ? () => useCourse.getState().open(nextItem.id) : undefined} />

      <header ref={headerRef} className="overflow-hidden rounded-2xl border border-white/[0.07]" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${tpl.tint} 16%, #0b1020), #0b1020 72%)` }}>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px]">
            {BADGE_KINDS.includes(topic.kind) && (
              <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold" style={{ background: `color-mix(in srgb, ${tpl.tint} 22%, transparent)`, color: tpl.tint }}>
                <Icon size={13} /> {tpl.label}
              </span>
            )}
            <span className="font-medium text-white/65">
              Planet {topic.moduleIndex + 1} · Topic {topicNo} of {siblings.length}
            </span>
            <span className="flex items-center gap-1 text-white/55">
              <Clock size={12} /> {topic.lesson.minutes} min
            </span>
            {done && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 font-semibold text-emerald-200">
                <Check size={12} /> Completed
              </span>
            )}
            {topic.lesson.simple && (
              <button
                type="button"
                aria-pressed={simple}
                onClick={() => (setSimple((v) => !v), holoBurst(0.4))}
                className={`ml-auto flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user)] ${simple ? 'border-[var(--user)] bg-[rgb(var(--user-rgb)/0.18)] text-white' : 'border-white/12 bg-white/[0.05] text-white/80 hover:border-white/30 hover:text-white'}`}
              >
                <Lightbulb size={13} style={{ color: 'var(--user)' }} /> {simple ? 'Hide simple version' : 'Explain it simply'}
              </button>
            )}
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-white sm:text-[28px]">{topic.title}</h1>
          {topic.summary && <Summary text={topic.summary} />}
        </div>
        <div className="flex gap-1 px-5 pb-4 sm:px-6" aria-label={`Topic ${topicNo} of ${siblings.length} in this planet`}>
          {siblings.map((t, k) => (
            <span key={t.id} className={`h-1 flex-1 rounded-full ${t.id === topic.id ? 'bg-[var(--user)] shadow-[0_0_8px_var(--user)]' : active.entry.progress[t.id]?.cleared ? 'bg-[rgb(var(--user-rgb)/0.55)]' : 'bg-white/10'}`} title={`Topic ${k + 1}: ${t.title}`} />
          ))}
        </div>
      </header>

      <AnimatePresence>
        {simple && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-6 rounded-2xl border border-[rgb(var(--user-rgb)/0.35)] bg-[rgb(var(--user-rgb)/0.08)] p-5">
              <h3 className={`mb-2 flex items-center gap-2 ${TYPE.heading}`}>
                <Lightbulb size={18} style={{ color: 'var(--user)' }} /> In plain words
              </h3>
              <p className={TYPE.body}>{topic.lesson.simple}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8">
        <Blocks blocks={topic.lesson.blocks} />
      </div>

      <footer ref={footerRef} className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 sm:flex-row sm:items-center">
        <div>
          <div className={TYPE.heading}>{done ? 'You’ve completed this topic' : 'Finished reading?'}</div>
          <div className={`${TYPE.body} text-white/60!`}>{nextLabel ? `Up next: ${nextLabel}` : 'This is the last topic of the course.'}</div>
        </div>
        <Btn variant="primary" icon={<ArrowRight size={15} />} onClick={complete}>
          {done ? (nextLabel ? 'Continue' : 'Done') : nextLabel ? 'Mark complete & continue' : 'Mark complete'}
        </Btn>
      </footer>

      {/* While the end of the lesson is out of sight, the next step stays one tap away. */}
      <div className="pointer-events-none sticky bottom-4 z-20 h-0">
        <AnimatePresence>
          {!footerVisible && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.2 }} className="absolute bottom-0 left-0 right-0 flex justify-start pr-16 sm:justify-center sm:pr-0">
              <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/12 bg-[#0b1020]/90 py-1.5 pl-5 pr-1.5 shadow-[0_14px_40px_-12px_rgb(0_0_0/0.9)] backdrop-blur-xl">
                <span className="hidden max-w-[220px] truncate text-sm text-white/65 sm:block">{nextLabel ? `Up next: ${nextLabel}` : 'Last topic'}</span>
                <Btn variant="primary" className="rounded-full! py-2!" icon={<ArrowRight size={15} />} onClick={complete}>
                  {done ? (nextLabel ? 'Continue' : 'Done') : nextLabel ? 'Complete & continue' : 'Mark complete'}
                </Btn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}

/** Two lines of the summary, with "More" for the rest. */
function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 150;
  return (
    <div className="mt-2 max-w-2xl">
      <p className={`${TYPE.body} text-white/80! ${open || !long ? '' : 'line-clamp-2'}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 cursor-pointer text-sm font-semibold text-[var(--user)] hover:underline">
          {open ? 'Less' : 'More'}
        </button>
      )}
    </div>
  );
}

/** Slides in once the lesson header has scrolled away: where you are, a reading-progress line and Previous / Next. */
function LessonBar({ title, where, show, onPrev, onNext }: { title: string; where: string; show: boolean; onPrev?: () => void; onNext?: () => void }) {
  const line = useRef<HTMLSpanElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = anchor.current?.closest('main');
    if (!scroller) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = scroller.scrollHeight - scroller.clientHeight;
      if (line.current) line.current.style.transform = `scaleX(${max > 0 ? Math.min(1, scroller.scrollTop / max) : 0})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [title]);
  const arrow = 'grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-white/70 transition enabled:hover:bg-white/10 enabled:hover:text-white disabled:cursor-default disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-[var(--user)]';
  return (
    <div ref={anchor} className="pointer-events-none sticky top-0 z-20 h-0">
      <div className={`absolute inset-x-0 top-0 -mx-5 transition duration-200 sm:-mx-10 ${show ? 'pointer-events-auto translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}>
        <div className="flex items-center gap-2 border-b border-white/[0.08] bg-[#070a13] px-5 py-2 sm:px-10">
          <button type="button" aria-label="Previous topic" disabled={!onPrev} onClick={onPrev} className={arrow}>
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-white">{title}</div>
            <div className="text-[11px] text-white/50">{where}</div>
          </div>
          <button type="button" aria-label="Next topic" disabled={!onNext} onClick={onNext} className={arrow}>
            <ChevronRight size={18} />
          </button>
        </div>
        <span ref={line} className="block h-0.5 origin-left bg-[var(--user)]" style={{ transform: 'scaleX(0)' }} />
      </div>
    </div>
  );
}
