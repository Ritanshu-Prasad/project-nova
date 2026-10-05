import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Clock, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { useCourse, type ActiveCourse } from '../../../core/course';
import type { PlacedTopic } from '../../../core/courseSchema';
import { holoBurst } from '../../../core/journey';
import Blocks from './Blocks';
import Btn from './Btn';
import { TYPE } from './typography';
import { KIND_TEMPLATES } from './kinds';

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

  return (
    <article className="font-sans">
      <header className="rounded-2xl border border-white/[0.07] p-6 sm:p-7" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${tpl.tint} 18%, #0b1020), #0b1020 70%)` }}>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold" style={{ background: `color-mix(in srgb, ${tpl.tint} 22%, transparent)`, color: tpl.tint }}>
            <Icon size={13} /> {tpl.label}
          </span>
          <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-white/70">
            {topic.moduleIndex + 1}.{active.topics.filter((t) => t.moduleIndex === topic.moduleIndex).findIndex((t) => t.id === topic.id) + 1} · {topic.planet}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/[0.07] px-2.5 py-1 text-white/70">
            <Clock size={12} /> {topic.lesson.minutes} min
          </span>
          {done && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 font-semibold text-emerald-200">
              <Check size={12} /> Completed
            </span>
          )}
        </div>
        <h1 className={`mt-4 ${TYPE.heading}`}>{topic.title}</h1>
        {topic.summary && <p className={`mt-2 max-w-2xl ${TYPE.body}`}>{topic.summary}</p>}
        {topic.lesson.simple && (
          <Btn className="mt-5" icon={<Lightbulb size={14} />} onClick={() => (setSimple((v) => !v), holoBurst(0.4))}>
            {simple ? 'Hide simple version' : 'Explain it simply'}
          </Btn>
        )}
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

      <footer className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 sm:flex-row sm:items-center">
        <div>
          <div className={TYPE.heading}>{done ? 'You’ve completed this topic' : 'Finished reading?'}</div>
          <div className={`${TYPE.body} text-white/60!`}>{nextLabel ? `Up next: ${nextLabel}` : 'This is the last topic of the course.'}</div>
        </div>
        <Btn variant="primary" icon={<ArrowRight size={15} />} onClick={complete}>
          {done ? (nextLabel ? 'Continue' : 'Done') : nextLabel ? 'Mark complete & continue' : 'Mark complete'}
        </Btn>
      </footer>
    </article>
  );
}
