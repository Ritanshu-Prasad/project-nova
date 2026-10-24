import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Clock, History, Lock, Radio, RotateCcw, Timer, X, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../../core/audio';
import { activeMmr, passedModules, useActiveCourse, useCourse } from '../../core/course';
import { useHub } from '../../core/hub';
import { duration, HUB_QUIZ, openHubQuiz, useCourseQuizzes, useFreshClock, useHubQuiz, type HubQuiz, type QuizRun } from '../../core/hubQuiz';
import { FORMAT_LABEL } from '../../core/quizBuilder';
import QuizOutcome, { type Outcome } from './QuizOutcome';
import BackPill from '../common/BackPill';
import Btn from './study/Btn';
import QuizRunner, { AnswerView, type QuizResult } from './study/QuizRunner';

const leave = () => {
  audio.play('click');
  const to = useHubQuiz.getState().returnTo;
  useHubQuiz.setState({ returnTo: 'hub' });
  useHub.getState().go(to);
};

const when = (t: number) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

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

type Stage = 'home' | 'countdown' | 'run' | 'outcome' | 'done';

/**
 * The hub quiz station: the waiting quiz (with its 24-hour bonus), the archive of finished quizzes to retake as
 * practice, and the run itself — 3-2-1 launch, questions, galactic outcome, debrief.
 */
export function HubQuizStation() {
  const active = useActiveCourse();
  const returnTo = useHubQuiz((s) => s.returnTo);
  const { pending, past } = useCourseQuizzes();
  const [stage, setStage] = useState<Stage>('home');
  const [quiz, setQuiz] = useState<HubQuiz | null>(null);
  const [run, setRun] = useState<QuizRun | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const before = useRef(0);
  // Answers so far — a quiz left halfway still counts what was answered.
  const sofar = useRef({ correct: 0, answered: 0, delta: 0 });
  const unlocked = active ? passedModules(active.entry).length > 0 : false;

  useEffect(
    () => () => {
      const s = useHubQuiz.getState();
      if (s.run && !s.run.practice && sofar.current.answered) s.finish(s.run.quizId, { correct: sofar.current.correct, total: s.quizzes.find((q) => q.id === s.run!.quizId)?.questions.length ?? 0, delta: sofar.current.delta });
      s.end();
    },
    [],
  );

  const engage = (q: HubQuiz) => {
    const r = useHubQuiz.getState().begin(q.id);
    if (!r) return;
    before.current = activeMmr();
    sofar.current = { correct: 0, answered: 0, delta: 0 };
    setQuiz(q);
    setRun(r);
    setStage('countdown');
  };

  const finish = (r: QuizResult) => {
    if (!quiz || !run) return;
    setResult(r);
    useHubQuiz.getState().end();
    if (run.practice) return setStage('done');
    useHubQuiz.getState().finish(quiz.id, { correct: r.correct, total: r.total, delta: r.delta });
    useCourse.getState().finishHubQuiz(r.correct, r.total);
    setOutcome({ delta: r.delta, correct: r.correct, total: r.total, before: before.current, after: activeMmr(), bonus: `×${run.regular}${quiz.limits.some(Boolean) ? ` · timed ×${run.timed}` : ''}` });
    setStage('outcome');
  };

  const home = () => {
    setStage('home');
    setQuiz(null);
    setRun(null);
    setResult(null);
  };

  return (
    <div className="absolute inset-0 grid place-items-center p-4">
      <motion.section
        role="dialog"
        aria-label="Hub quiz"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="card pointer-events-auto relative flex max-h-[88vh] w-[min(720px,calc(100vw-32px))] flex-col overflow-hidden font-sans"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0b1020]/60 px-6 py-3 sm:px-7">
          <BackPill label={returnTo === 'lesson' ? 'Back to lesson' : 'Lounge'} onClick={leave} />
          {run && (
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${run.practice ? 'bg-white/[0.06] text-white/60' : 'bg-amber-300/15 text-amber-200'}`}>
              <Zap size={13} /> {run.practice ? 'Practice · no RR' : `×${run.regular} RR`}
            </span>
          )}
        </div>
        <div className="scroll-y min-h-0 flex-1 overflow-x-hidden p-6 pt-1 sm:p-7 sm:pt-1">

        {stage === 'home' && (
          <div className="pt-5">
            {!unlocked ? (
              <Locked text="Complete your first module — pass its lesson quiz — and hub quizzes start arriving." />
            ) : pending ? (
              <Brief q={pending} onEngage={() => engage(pending)} />
            ) : (
              <Locked text="No new hub quiz right now. The next one forms at a random moment — you’ll get an alert." />
            )}
            {past.length > 0 && <Archive past={past} onRetake={engage} />}
          </div>
        )}

        {stage === 'countdown' && <Countdown onDone={() => setStage('run')} />}

        {stage === 'run' && quiz && run && (
          <div className="mt-5">
            <QuizRunner
              questions={quiz.questions.map((x) => x.q)}
              progress={quiz.questions.map((x) => x.progress)}
              limits={quiz.limits}
              rates={run.rates}
              practice={run.practice}
              hints={false}
              onAnswer={(_, ok, d) => {
                sofar.current = { correct: sofar.current.correct + (ok ? 1 : 0), answered: sofar.current.answered + 1, delta: sofar.current.delta + d };
              }}
              onComplete={finish}
            />
          </div>
        )}

        {stage === 'done' && result && quiz && run && (
          <div className="pt-5">
            <h2 className="font-display text-2xl font-bold text-white">{run.practice ? 'Practice complete' : result.delta > 0 ? 'Victory' : result.delta < 0 ? 'Defeat' : 'Holding orbit'}</h2>
            <p className="mt-1 text-base text-white/65">
              {result.correct} of {result.total} correct ·{' '}
              {run.practice ? (
                'no RR on retakes'
              ) : (
                <span className={result.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {result.delta >= 0 ? '+' : ''}
                  {result.delta} RR
                </span>
              )}
            </p>
            <ul className="mt-5 space-y-3">
              {quiz.questions.map(({ q }, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${result.results[i] ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'}`}>{result.results[i] ? <Check size={13} /> : <X size={13} />}</span>
                  <div className="min-w-0 flex-1">
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
              <Btn icon={<History size={15} />} onClick={home}>
                Quiz archive
              </Btn>
            </div>
          </div>
        )}
        </div>
      </motion.section>

      <AnimatePresence>{stage === 'outcome' && outcome && <QuizOutcome key="outcome" outcome={outcome} onDone={() => setStage('done')} />}</AnimatePresence>
    </div>
  );
}

function Locked({ text }: { text: string }) {
  return (
    <div className="py-6 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/[0.06] text-white/50">
        <Lock size={24} />
      </span>
      <h2 className="mt-3 font-display text-2xl font-bold text-white">Hub quiz locked</h2>
      <p className="mx-auto mt-2 max-w-md text-base text-white/65">{text}</p>
    </div>
  );
}

function Brief({ q, onEngage }: { q: HubQuiz; onEngage: () => void }) {
  const secs = useFreshClock(q);
  const fresh = secs > 0;
  const formats = [...new Set(q.questions.map((x) => FORMAT_LABEL[x.q.type]))];
  const timed = q.limits.filter(Boolean).length;
  return (
    <div>
      <div className="flex items-center gap-5">
        <Beacon />
        <div>
          <motion.div className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/80" animate={{ opacity: [1, 0.4, 1, 0.8, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
            {fresh ? 'Incoming transmission' : 'Waiting in the hub'}
          </motion.div>
          <h2 className="mt-1 font-display text-3xl font-bold text-white">Hub quiz · {q.title}</h2>
          <div className="text-sm text-white/50">Formed {when(q.formedAt)}</div>
        </div>
      </div>
      <p className="mt-4 text-base text-white/70">A big quiz on everything you’ve completed. Heavy RR both ways — right answers pay a multiple, wrong ones cost one.</p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {[
          { label: 'Within 24 h of forming', r: HUB_QUIZ.fresh, on: fresh },
          { label: 'After 24 h', r: HUB_QUIZ.late, on: !fresh },
        ].map((x) => (
          <div key={x.label} className={`rounded-2xl border px-4 py-3 ${x.on ? 'border-amber-300/60 bg-amber-300/10' : 'border-white/10 bg-white/[0.03] opacity-60'}`}>
            <div className="flex items-center justify-between text-sm">
              <span className={x.on ? 'font-semibold text-amber-100' : 'text-white/60'}>{x.label}</span>
              {x.on && fresh && (
                <span className="flex items-center gap-1 font-display tabular-nums text-amber-100">
                  <Clock size={13} /> {duration(secs)} left
                </span>
              )}
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-white">
              ×{x.r.regular} <span className="text-base font-semibold text-white/60">· timed ×{x.r.timed}</span>
            </div>
          </div>
        ))}
      </div>

      <ul className="mt-4 grid gap-2 text-sm text-white/70 sm:grid-cols-3">
        <li className="rounded-xl bg-white/[0.05] px-3 py-2.5">{q.questions.length} questions</li>
        <li className="rounded-xl bg-white/[0.05] px-3 py-2.5">Wrong answers cost ×{fresh ? HUB_QUIZ.fresh.regular : HUB_QUIZ.late.regular}</li>
        <li className="flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-2.5">
          <Timer size={14} /> {timed ? `Last ${timed} timed · no penalty` : 'Untimed'}
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {formats.map((f) => (
          <span key={f} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-sm text-white/70">
            {f}
          </span>
        ))}
      </div>
      <Btn variant="primary" className="mt-6" icon={<Zap size={15} />} onClick={onEngage}>
        Engage
      </Btn>
    </div>
  );
}

function Archive({ past, onRetake }: { past: HubQuiz[]; onRetake: (q: HubQuiz) => void }) {
  return (
    <div className="mt-8 border-t border-white/[0.07] pt-5">
      <div className="chip-label mb-3">
        <History size={12} /> Finished quizzes · retake for practice (no RR)
      </div>
      <ul className="space-y-2">
        {past.map((q) => (
          <li key={q.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">Hub quiz · {q.title}</div>
              <div className="text-xs text-white/50">
                {when(q.result!.at)} · {q.result!.correct}/{q.result!.total} ·{' '}
                <span className={q.result!.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  {q.result!.delta >= 0 ? '+' : ''}
                  {q.result!.delta} RR
                </span>
              </div>
            </div>
            <Btn icon={<RotateCcw size={14} />} onClick={() => onRetake(q)}>
              Retake
            </Btn>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 3 · 2 · 1 · GO — a short launch before the questions. */
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

/** The arrival alert when a hub quiz forms — wherever the pilot is. "Later" keeps it waiting. */
export function QuizArrival({ q }: { q: HubQuiz }) {
  const secs = useFreshClock(q);
  useEffect(() => {
    audio.play('notify');
    audio.play('pulse');
    const t = window.setTimeout(() => useHubQuiz.getState().defer(q.id), ARRIVAL_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [q.id]);
  return (
    <motion.div
      role="alertdialog"
      aria-label="A hub quiz has arrived"
      initial={{ opacity: 0, y: -40, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="pointer-events-auto absolute left-1/2 top-20 w-[min(470px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-amber-300/50 bg-[#0d1220]/95 p-5 font-sans shadow-[0_20px_60px_-15px_rgb(0_0_0/0.9),0_0_40px_-10px_rgb(252_211_77/0.6)] backdrop-blur-md"
    >
      <motion.div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b from-amber-200/10 to-transparent" initial={{ y: '-100%' }} animate={{ y: '100%' }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }} />
      <div className="relative flex items-start gap-4">
        <Beacon size={52} />
        <div className="min-w-0 flex-1">
          <motion.div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/80" animate={{ opacity: [1, 0.3, 1, 0.7, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <Radio size={12} /> Incoming transmission
          </motion.div>
          <div className="mt-1 font-display text-xl font-bold text-white">Hub quiz ready · {q.title}</div>
          <p className="mt-1 text-sm text-white/70">
            {q.questions.length} questions on what you’ve completed. Take it within <span className="font-semibold tabular-nums text-amber-200">{duration(secs)}</span> for{' '}
            <span className="font-semibold text-amber-200">
              ×{HUB_QUIZ.fresh.regular} RR (timed ×{HUB_QUIZ.fresh.timed})
            </span>{' '}
            — or save it for later.
          </p>
          <div className="mt-3 flex gap-2">
            <Btn variant="primary" icon={<Zap size={14} />} onClick={openHubQuiz}>
              Take it now
            </Btn>
            <Btn icon={<Clock size={14} />} onClick={() => useHubQuiz.getState().defer(q.id)}>
              Later
            </Btn>
          </div>
        </div>
      </div>
      <motion.div className="absolute bottom-0 left-0 h-1 bg-amber-300" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: ARRIVAL_SECONDS, ease: 'linear' }} />
    </motion.div>
  );
}

/** A waiting hub quiz: a small pill with its current multiplier, always one click away. */
export function QuizPill({ q }: { q: HubQuiz }) {
  const secs = useFreshClock(q);
  const fresh = secs > 0;
  return (
    <motion.button
      type="button"
      onClick={openHubQuiz}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`pointer-events-auto absolute left-1/2 top-[76px] flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-lg backdrop-blur-md transition hover:brightness-110 lg:top-4 ${fresh ? 'border-amber-300/60 bg-amber-300/15 text-amber-100' : 'border-white/15 bg-[#0d1220]/90 text-white/80'}`}
    >
      <span className="relative grid size-5 place-items-center">
        {fresh && <span className="absolute inset-0 animate-ping rounded-full bg-amber-300/50" />}
        <Zap size={14} className="relative" />
      </span>
      Hub quiz ready
      <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs tabular-nums">{fresh ? `×${HUB_QUIZ.fresh.regular} · ${duration(secs)}` : `×${HUB_QUIZ.late.regular}`}</span>
    </motion.button>
  );
}
