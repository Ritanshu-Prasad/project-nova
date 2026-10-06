import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Check, Clock, Radio, RotateCcw, Timer, X, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../../core/audio';
import { activeMmr, popPool, useActiveCourse, useCourse } from '../../core/course';
import { useHub } from '../../core/hub';
import { clock, POP, takePopQuiz, useBonusClock, usePop, type PopRun } from '../../core/popquiz';
import { quizSizeLabel } from '../../core/quizBuilder';
import QuizOutcome, { type Outcome } from './QuizOutcome';
import Btn from './study/Btn';
import QuizRunner, { AnswerView, type QuizResult } from './study/QuizRunner';

const leave = () => {
  audio.play('click');
  const to = usePop.getState().returnTo;
  usePop.setState({ returnTo: 'hub' });
  useHub.getState().go(to);
};

/** Pulsing transmission rings around the quiz glyph. */
function Beacon({ size = 64 }: { size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="absolute inset-0 rounded-full border-2 border-amber-300" initial={{ scale: 0.5, opacity: 0.9 }} animate={{ scale: 1.7, opacity: 0 }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.66, ease: 'easeOut' }} />
      ))}
      <span className="relative grid size-full place-items-center rounded-full bg-amber-300 text-[#1a1203] shadow-[0_0_30px_rgb(252_211_77/0.7)]">
        <Zap size={size * 0.45} />
      </span>
    </span>
  );
}

type Stage = 'brief' | 'countdown' | 'run' | 'outcome' | 'done';

/** The lounge's timed pop quiz: briefing → 3-2-1 launch → questions → galactic outcome → debrief. */
export function PopQuiz() {
  const active = useActiveCourse();
  const offer = usePop((s) => s.offer);
  const returnTo = usePop((s) => s.returnTo);
  const secs = useBonusClock(offer);
  const [stage, setStage] = useState<Stage>('brief');
  const [run, setRun] = useState<PopRun | null>(null);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const before = useRef(0);
  const pool = active ? popPool(active.entry) : [];
  const bonus = !!offer && secs > 0;

  // Leaving mid-round still counts the answers given and queues the next surprise.
  useEffect(
    () => () => {
      if (usePop.getState().run) usePop.getState().end();
    },
    [],
  );

  const engage = () => {
    const r = usePop.getState().begin();
    if (!r) return;
    before.current = activeMmr();
    setRun(r);
    setRound((n) => n + 1);
    setStage('countdown');
  };

  const finish = (r: QuizResult) => {
    useCourse.getState().finishPopQuiz(r.correct, r.total);
    setResult(r);
    setOutcome({ delta: r.delta, correct: r.correct, total: r.total, before: before.current, after: activeMmr(), multiplier: run?.multiplier });
    usePop.getState().end();
    setStage('outcome');
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
        className="card scroll-y pointer-events-auto relative max-h-[88vh] w-[min(700px,calc(100vw-32px))] overflow-x-hidden p-6 font-sans sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={leave} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-sm font-medium text-white/75 transition hover:bg-white/[0.12] hover:text-white">
            <ArrowLeft size={14} /> {returnTo === 'lesson' ? 'Back to lesson' : 'Lounge'}
          </button>
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${(run ? run.multiplier > 1 : bonus) ? 'bg-amber-300/15 text-amber-200' : 'bg-white/[0.06] text-white/60'}`}>
            <Zap size={13} /> ×{run ? run.multiplier : bonus ? POP.bonus : 1} MMR
          </span>
        </div>

        {!pool.length ? (
          <div className="py-8 text-center">
            <BookOpen size={36} className="mx-auto text-white/50" />
            <h2 className="mt-3 font-display text-2xl font-bold text-white">No questions yet</h2>
            <p className="mx-auto mt-2 max-w-md text-base text-white/65">Pop quizzes draw on the planets you’ve reached. Open your first lesson and they’ll start arriving — at random moments.</p>
            <Btn variant="primary" className="mt-5" icon={<BookOpen size={15} />} onClick={() => useHub.getState().go('lesson')}>
              Go to lesson
            </Btn>
          </div>
        ) : stage === 'brief' ? (
          <div className="pt-5">
            <div className="flex items-center gap-5">
              <Beacon />
              <div>
                <motion.div className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/80" animate={{ opacity: [1, 0.4, 1, 0.8, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
                  {offer ? 'Incoming transmission' : 'Practice round'}
                </motion.div>
                <h2 className="mt-1 font-display text-3xl font-bold text-white">Pop quiz</h2>
              </div>
            </div>
            <p className="mt-4 text-base text-white/70">A random mix from the planets you’ve reached — multiple choice, multiple select, code, ordering, matching. No hints.</p>
            {offer ? (
              <div className={`mt-5 overflow-hidden rounded-2xl border px-4 py-3 ${bonus ? 'border-amber-300/50 bg-amber-300/10' : 'border-white/10 bg-white/[0.04]'}`}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className={`font-semibold ${bonus ? 'text-amber-200' : 'text-white/70'}`}>{bonus ? `×${POP.bonus} MMR bonus — start before the timer ends` : 'Bonus window closed — normal MMR'}</span>
                  {bonus && (
                    <span className="flex items-center gap-1 font-display tabular-nums text-amber-100">
                      <Clock size={13} /> {clock(secs)}
                    </span>
                  )}
                </div>
                {bonus && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-amber-300 transition-[width] duration-1000 ease-linear" style={{ width: `${(secs * 1000 * 100) / POP.windowMs}%` }} />
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/65">Practice at normal MMR. Surprise pop quizzes arrive at random — take one in time for ×{POP.bonus}.</div>
            )}
            <ul className="mt-4 grid gap-2 text-sm text-white/70 sm:grid-cols-3">
              <li className="rounded-xl bg-white/[0.05] px-3 py-2.5">{quizSizeLabel(pool.length)} questions · mixed formats</li>
              <li className="flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-2.5">
                <Timer size={14} /> 10-question rounds end with 3 timed
              </li>
              <li className="rounded-xl bg-white/[0.05] px-3 py-2.5">Results after the last answer</li>
            </ul>
            <Btn variant="primary" className="mt-6" icon={<Zap size={15} />} onClick={engage}>
              Engage
            </Btn>
          </div>
        ) : stage === 'countdown' ? (
          <Countdown onDone={() => setStage('run')} />
        ) : stage === 'run' && run ? (
          <div className="mt-5">
            <QuizRunner key={round} questions={run.questions.map((x) => x.q)} progress={run.questions.map((x) => x.progress)} limits={run.limits} multiplier={run.multiplier} hints={false} onComplete={finish} />
          </div>
        ) : (
          stage === 'done' &&
          result &&
          run && (
            <div className="pt-5">
              <h2 className="font-display text-2xl font-bold text-white">{result.delta > 0 ? 'Victory' : result.delta < 0 ? 'Defeat' : 'Holding orbit'}</h2>
              <p className="mt-1 text-base text-white/65">
                {result.correct} of {result.total} correct ·{' '}
                <span className={result.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {result.delta >= 0 ? '+' : ''}
                  {result.delta} MMR
                </span>
                {run.multiplier > 1 ? ` · ×${run.multiplier} bonus` : ''}
              </p>
              <ul className="mt-5 space-y-3">
                {run.questions.map(({ q }, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${result.results[i] ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'}`}>{result.results[i] ? <Check size={13} /> : <X size={13} />}</span>
                    <div>
                      <div className="text-white/85">{q.q}</div>
                      <AnswerView q={q} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Btn variant="primary" icon={<ArrowLeft size={15} />} onClick={leave}>
                  {returnTo === 'lesson' ? 'Back to lesson' : 'Back to lounge'}
                </Btn>
                <Btn icon={<RotateCcw size={15} />} onClick={() => setStage('brief')}>
                  Practice round
                </Btn>
              </div>
            </div>
          )
        )}
      </motion.section>

      <AnimatePresence>{stage === 'outcome' && outcome && <QuizOutcome key="outcome" outcome={outcome} onDone={() => setStage('done')} />}</AnimatePresence>
    </div>
  );
}

/** 3 · 2 · 1 · Engage — a short launch before the clock starts. */
function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (n > 0) audio.play('countdown', n);
    const t = window.setTimeout(() => (n > 0 ? setN(n - 1) : done.current()), n > 0 ? 700 : 550);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <div className="relative grid h-64 place-items-center" aria-live="assertive">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={n}
          initial={{ scale: 2.2, opacity: 0, filter: 'blur(8px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 1.4, 0.4, 1] }}
          className="font-display text-8xl font-bold text-amber-200"
          style={{ textShadow: '0 0 40px rgb(252 211 77 / 0.7)' }}
        >
          {n > 0 ? n : 'GO'}
        </motion.div>
      </AnimatePresence>
      <motion.span key={`ring-${n}`} className="absolute size-40 rounded-full border-2 border-amber-300" initial={{ scale: 0.4, opacity: 0.9 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.7 }} />
    </div>
  );
}

const ARRIVAL_SECONDS = 20;

/** The arrival alert: slides in wherever the pilot is (lounge or mid-lesson). "Later" keeps it waiting. */
export function PopArrival() {
  const offer = usePop((s) => s.offer);
  const secs = useBonusClock(offer);
  useEffect(() => {
    audio.play('notify');
    audio.play('pulse');
    const t = window.setTimeout(() => usePop.getState().defer(), ARRIVAL_SECONDS * 1000);
    return () => clearTimeout(t);
  }, []);
  return (
    <motion.div
      role="alertdialog"
      aria-label="Surprise pop quiz"
      initial={{ opacity: 0, y: -40, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="pointer-events-auto absolute left-1/2 top-20 w-[min(460px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-amber-300/50 bg-[#0d1220]/95 p-5 font-sans shadow-[0_20px_60px_-15px_rgb(0_0_0/0.9),0_0_40px_-10px_rgb(252_211_77/0.6)] backdrop-blur-md"
    >
      <motion.div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b from-amber-200/10 to-transparent" initial={{ y: '-100%' }} animate={{ y: '100%' }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }} />
      <div className="relative flex items-start gap-4">
        <Beacon size={52} />
        <div className="min-w-0 flex-1">
          <motion.div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/80" animate={{ opacity: [1, 0.3, 1, 0.7, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <Radio size={12} /> Incoming transmission
          </motion.div>
          <div className="mt-1 font-display text-xl font-bold text-white">Surprise pop quiz!</div>
          <p className="mt-1 text-sm text-white/70">
            5–10 mixed questions — choice, code, ordering and more. Start within <span className="font-semibold tabular-nums text-amber-200">{clock(secs)}</span> for <span className="font-semibold text-amber-200">×{POP.bonus} MMR</span> — or save it for later.
          </p>
          <div className="mt-3 flex gap-2">
            <Btn variant="primary" icon={<Zap size={14} />} onClick={takePopQuiz}>
              Take it now
            </Btn>
            <Btn icon={<Clock size={14} />} onClick={() => usePop.getState().defer()}>
              Later
            </Btn>
          </div>
        </div>
      </div>
      <motion.div className="absolute bottom-0 left-0 h-1 bg-amber-300" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: ARRIVAL_SECONDS, ease: 'linear' }} />
    </motion.div>
  );
}

/** A waiting pop quiz: a small pill with the bonus countdown, always one click away. */
export function PopPill() {
  const offer = usePop((s) => s.offer);
  const secs = useBonusClock(offer);
  const bonus = secs > 0;
  return (
    <motion.button
      type="button"
      onClick={takePopQuiz}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`pointer-events-auto absolute left-1/2 top-[76px] flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-lg backdrop-blur-md transition hover:brightness-110 lg:top-4 ${bonus ? 'border-amber-300/60 bg-amber-300/15 text-amber-100' : 'border-white/15 bg-[#0d1220]/90 text-white/80'}`}
    >
      <span className="relative grid size-5 place-items-center">
        {bonus && <span className="absolute inset-0 animate-ping rounded-full bg-amber-300/50" />}
        <Zap size={14} className="relative" />
      </span>
      Pop quiz waiting
      <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs tabular-nums">{bonus ? `×${POP.bonus} · ${clock(secs)}` : 'bonus ended'}</span>
    </motion.button>
  );
}
