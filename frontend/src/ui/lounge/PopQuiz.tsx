import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Play, RotateCcw, Timer, Trophy, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { audio } from '../../core/audio';
import { popPool, useActiveCourse, useCourse } from '../../core/course';
import type { Question } from '../../core/courseSchema';
import { cheerPet, useHub } from '../../core/hub';
import { holoBurst } from '../../core/journey';
import Btn from './study/Btn';
import QuizRunner, { type QuizResult } from './study/QuizRunner';

/** The lounge's timed pop quiz: a few questions from completed topics, on the clock, for boosted MMR. */
export const POP = { count: 3, seconds: 20, multiplier: 1.5 } as const;

function pick<T>(xs: T[], n: number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

const back = () => {
  audio.play('click');
  useHub.getState().go('hub');
};

export function PopQuiz() {
  const active = useActiveCourse();
  const pool = active ? popPool(active.entry) : [];
  const [questions, setQuestions] = useState<Question[]>(() => pick(pool, POP.count));
  const [stage, setStage] = useState<'ready' | 'run' | 'done'>('ready');
  const [result, setResult] = useState<QuizResult | null>(null);
  const [round, setRound] = useState(0);

  const finish = (r: QuizResult) => {
    useCourse.getState().finishPopQuiz(r.correct, r.total);
    if (r.correct === r.total) {
      cheerPet();
      holoBurst(1);
    }
    setResult(r);
    setStage('done');
  };
  const again = () => {
    setQuestions(pick(pool, POP.count));
    setResult(null);
    setRound((n) => n + 1);
    setStage('run');
  };

  return (
    <div className="absolute inset-0 grid place-items-center p-4">
      <motion.section
        role="dialog"
        aria-label="Pop quiz"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="card scroll-y pointer-events-auto max-h-[88vh] w-[min(680px,calc(100vw-32px))] p-6 font-sans sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={back} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] font-medium text-white/75 transition hover:bg-white/[0.12] hover:text-white">
            <ArrowLeft size={14} /> Lounge
          </button>
          <span className="flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 text-[13px] font-semibold text-amber-200">
            <Zap size={13} /> ×{POP.multiplier} MMR
          </span>
        </div>

        {!pool.length ? (
          <div className="py-8 text-center">
            <BookOpen size={36} className="mx-auto text-white/50" />
            <h2 className="mt-3 font-display text-2xl font-bold text-white">No pop quiz yet</h2>
            <p className="mx-auto mt-2 max-w-md text-base text-white/65">Pop quizzes draw on topics you’ve completed. Finish your first lesson and they’ll start appearing — sometimes by surprise.</p>
            <Btn variant="primary" className="mt-5" icon={<BookOpen size={15} />} onClick={() => useHub.getState().go('lesson')}>
              Go to lesson
            </Btn>
          </div>
        ) : stage === 'ready' ? (
          <div className="py-4">
            <h2 className="font-display text-3xl font-bold text-white">Pop quiz</h2>
            <p className="mt-2 text-base text-white/70">Quick-fire questions from topics you’ve already completed. Beat the clock to earn boosted MMR.</p>
            <ul className="mt-5 grid gap-2 text-sm text-white/70 sm:grid-cols-3">
              <li className="rounded-xl bg-white/[0.05] px-3 py-2.5">{questions.length} questions</li>
              <li className="flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-2.5">
                <Timer size={14} /> {POP.seconds} s each
              </li>
              <li className="rounded-xl bg-white/[0.05] px-3 py-2.5">×{POP.multiplier} MMR on correct</li>
            </ul>
            <Btn variant="primary" className="mt-6" icon={<Play size={15} />} onClick={() => setStage('run')}>
              Start — the clock starts now
            </Btn>
          </div>
        ) : stage === 'run' ? (
          <div className="mt-5">
            <QuizRunner key={round} questions={questions} timed={POP.seconds} multiplier={POP.multiplier} hints={false} position={2} onComplete={finish} />
          </div>
        ) : (
          result && (
            <div className="py-6 text-center">
              {result.correct === result.total ? <Trophy size={40} className="mx-auto text-amber-300" /> : <Zap size={36} className="mx-auto text-amber-200" />}
              <h2 className="mt-3 font-display text-2xl font-bold text-white">{result.correct === result.total ? 'Flawless!' : result.correct ? 'Nice reflexes' : 'Tough round'}</h2>
              <p className="mt-1 text-base text-white/65">
                {result.correct} of {result.total} correct ·{' '}
                <span className={result.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {result.delta >= 0 ? '+' : ''}
                  {result.delta} MMR
                </span>
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                <Btn variant="primary" icon={<RotateCcw size={15} />} onClick={again}>
                  Another round
                </Btn>
                <Btn icon={<ArrowLeft size={15} />} onClick={back}>
                  Back to lounge
                </Btn>
              </div>
            </div>
          )
        )}
      </motion.section>
    </div>
  );
}

const OFFER_SECONDS = 15;

/** A surprise offer that slides in while the pilot idles in the lounge. */
export function SurpriseOffer() {
  useEffect(() => {
    audio.play('notify');
    const id = window.setTimeout(() => useHub.getState().setSurprise(false), OFFER_SECONDS * 1000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <motion.div
      role="alertdialog"
      aria-label="Surprise pop quiz"
      initial={{ opacity: 0, y: -24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16 }}
      className="card pointer-events-auto absolute left-1/2 top-20 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden p-4 font-sans"
    >
      <div className="flex items-start gap-3">
        <motion.span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-300 text-[#1a1203]" animate={{ rotate: [0, -12, 12, -6, 0] }} transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 1.6 }}>
          <Zap size={20} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-bold text-white">Surprise pop quiz!</div>
          <div className="text-sm text-white/65">
            {POP.count} questions · {POP.seconds} s each · ×{POP.multiplier} MMR
          </div>
          <div className="mt-3 flex gap-2">
            <Btn variant="primary" icon={<Zap size={14} />} onClick={() => useHub.getState().go('quiz')}>
              Take it
            </Btn>
            <Btn onClick={() => useHub.getState().setSurprise(false)}>Later</Btn>
          </div>
        </div>
        <button type="button" aria-label="Dismiss" onClick={() => useHub.getState().setSurprise(false)} className="cursor-pointer rounded-lg p-1 text-white/45 transition hover:bg-white/10 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <motion.div className="absolute bottom-0 left-0 h-1 bg-amber-300" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: OFFER_SECONDS, ease: 'linear' }} />
    </motion.div>
  );
}
