import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Clock, Lightbulb, Target } from 'lucide-react';
import { useState } from 'react';
import { useCourse } from '../../../core/course';
import type { PlacedTopic } from '../../../core/courseSchema';
import { useHub } from '../../../core/hub';
import { holoBurst } from '../../../core/journey';
import { HudButton } from '../../common/HudButton';
import Blocks from './Blocks';
import { KIND_TEMPLATES } from './kinds';

/** A full lesson: kind-tinted header, optional plain-language version, typed blocks, then the quiz. */
export default function LessonView({ topic }: { topic: PlacedTopic }) {
  const [simple, setSimple] = useState(false);
  const tpl = KIND_TEMPLATES[topic.kind];
  const Icon = tpl.icon;

  const toQuiz = () => {
    useCourse.getState().markRead(topic.id);
    useHub.getState().go('quiz');
  };

  return (
    <article>
      <header className="relative overflow-hidden rounded-3xl border border-white/[0.07] p-6 sm:p-8" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${tpl.tint} 22%, #0b1020), #0b1020 70%)` }}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold" style={{ background: `color-mix(in srgb, ${tpl.tint} 22%, transparent)`, color: tpl.tint }}>
            <Icon size={13} /> {tpl.label}
          </span>
          <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-white/70">
            Planet {topic.index + 1} · {topic.planet}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/[0.07] px-2.5 py-1 text-white/70">
            <Clock size={12} /> {topic.lesson.minutes} min
          </span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">{topic.title}</h1>
        {topic.summary && <p className="mt-2 max-w-2xl text-[16px] text-white/70">{topic.summary}</p>}
        <div className="mt-5 flex flex-wrap gap-2.5">
          {topic.lesson.simple && (
            <HudButton size="sm" icon={<Lightbulb size={14} />} onClick={() => (setSimple((v) => !v), holoBurst(0.4))}>
              {simple ? 'Hide simple version' : 'Explain it simply'}
            </HudButton>
          )}
          <HudButton size="sm" variant="primary" icon={<Target size={14} />} onClick={toQuiz}>
            Jump to quiz
          </HudButton>
        </div>
      </header>

      <AnimatePresence>
        {simple && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-6 rounded-2xl border border-[rgb(var(--user-rgb)/0.35)] bg-[rgb(var(--user-rgb)/0.08)] p-5">
              <div className="chip-label mb-1.5">
                <Lightbulb size={12} /> In plain words
              </div>
              <p className="text-[17px] leading-relaxed text-white">{topic.lesson.simple}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8">
        <Blocks blocks={topic.lesson.blocks} />
      </div>

      <footer className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6 sm:flex-row sm:items-center">
        <div>
          <div className="font-display text-lg font-semibold text-white">Ready to clear {topic.planet}?</div>
          <div className="text-sm text-white/60">{topic.quiz.length ? `${topic.quiz.length} questions · earn MMR and move your rocket` : 'No questions yet — mark it complete to move on'}</div>
        </div>
        <HudButton variant="primary" icon={<ArrowRight size={15} />} onClick={toQuiz}>
          Take the quiz
        </HudButton>
      </footer>
    </article>
  );
}
