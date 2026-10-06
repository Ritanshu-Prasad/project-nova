import { ArrowRight, Check, Play, RotateCcw, Target, Timer, Trophy, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useRef, useState } from 'react';
import { activeMmr, PASS_MARK, useCourse, type ActiveCourse, type OutlineItem } from '../../../core/course';
import { buildQuiz, FORMAT_LABEL } from '../../../core/quizBuilder';
import { useNova } from '../../../core/store';
import QuizOutcome, { type Outcome } from '../QuizOutcome';
import Btn from './Btn';
import { TYPE } from './typography';
import QuizRunner, { AnswerView, type QuizResult } from './QuizRunner';

type QuizItem = Extract<OutlineItem, { kind: 'quiz' }>;

/**
 * The end-of-module checkpoint: intro → questions → galactic outcome → result (pass to unlock the next module).
 * Every attempt is a fresh random draw of 5–10 mixed-format questions from the whole module.
 */
export default function ModuleQuiz({ item, active }: { item: QuizItem; active: ActiveCourse }) {
  const [stage, setStage] = useState<'intro' | 'run' | 'done'>('intro');
  const [result, setResult] = useState<(QuizResult & { passed: boolean; nextId: string | null }) | null>(null);
  const progress = active.entry.modules[item.module.id];
  const nextModule = active.course.modules[item.moduleIndex + 1];
  const [quiz, setQuiz] = useState(() => buildQuiz(item.pool));
  const n = quiz.questions.length;
  const formats = [...new Set(quiz.questions.map((x) => FORMAT_LABEL[x.q.type]))];
  const timed = quiz.limits.filter((l) => l !== null).length;
  const before = useRef(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const finish = (r: QuizResult) => {
    const out = useCourse.getState().finishModuleQuiz(item.module.id, r.correct, r.total);
    setOutcome({ delta: r.delta, correct: r.correct, total: r.total, before: before.current, after: activeMmr() });
    setResult({ ...r, ...out });
    setStage('done');
  };

  // After the victory/defeat moment, celebrate the unlock.
  const outcomeDone = () => {
    setOutcome(null);
    if (result?.passed) useNova.getState().notify({ kind: 'levelup', title: 'Module complete', lines: [nextModule ? `${nextModule.title} is unlocked.` : 'You finished the whole course!'], ttl: 3.5 });
  };

  const start = () => {
    before.current = activeMmr();
    setStage('run');
  };
  // A retake draws a new set of questions.
  const retake = () => {
    setQuiz(buildQuiz(item.pool));
    setResult(null);
    setStage('intro');
  };

  return (
    <article className="font-sans">
      <AnimatePresence>{outcome && <QuizOutcome key="outcome" outcome={outcome} onDone={outcomeDone} />}</AnimatePresence>
      <header>
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--user)' }}>
          <Target size={14} /> Module {item.moduleIndex + 1} quiz
        </div>
        <h1 className={`mt-1 ${TYPE.heading}`}>{item.module.title}</h1>
      </header>

      {stage === 'intro' && (
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
          <p className={TYPE.body}>
            {n} questions drawn at random from everything in this module. Score {Math.round(PASS_MARK * 100)}% or more to pass{nextModule ? ` and unlock “${nextModule.title}”` : ' and finish the course'}.
          </p>
          <ul className={`mt-4 grid gap-2 sm:grid-cols-3 ${TYPE.body}`}>
            <li className="rounded-xl bg-white/[0.04] px-3 py-2">{n} questions · {formats.length} formats</li>
            <li className="rounded-xl bg-white/[0.04] px-3 py-2">Pass mark {Math.round(PASS_MARK * 100)}%</li>
            <li className="rounded-xl bg-white/[0.04] px-3 py-2">{progress ? `Best so far ${Math.round(progress.best * 100)}%` : 'First attempt'}</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {formats.map((f) => (
              <span key={f} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-sm text-white/70">
                {f}
              </span>
            ))}
          </div>
          {timed > 0 && (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
              <Timer size={14} /> The last {timed} questions are timed — tougher ones get more time.
            </p>
          )}
          <Btn variant="primary" className="mt-5" icon={<Play size={15} />} onClick={start}>
            {progress?.attempts ? 'Start new attempt' : 'Start quiz'}
          </Btn>
        </div>
      )}

      {stage === 'run' && (
        <div className="mt-6">
          <QuizRunner questions={quiz.questions.map((x) => x.q)} progress={quiz.questions.map((x) => x.progress)} limits={quiz.limits} onComplete={finish} />
        </div>
      )}

      {stage === 'done' && result && !outcome && (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center">
            {result.passed ? <Trophy size={40} className="mx-auto text-amber-300" /> : <RotateCcw size={36} className="mx-auto text-white/60" />}
            <h2 className={`mt-3 ${TYPE.heading}`}>{result.passed ? 'Module passed!' : 'Not quite yet'}</h2>
            <p className={`mt-1 ${TYPE.body}`}>
              {result.correct} of {result.total} correct ({Math.round((result.correct / result.total) * 100)}%) ·{' '}
              <span className={result.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {result.delta >= 0 ? '+' : ''}
                {result.delta} MMR
              </span>
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {result.passed && result.nextId ? (
                <Btn variant="primary" icon={<ArrowRight size={15} />} onClick={() => useCourse.getState().open(result.nextId!)}>
                  Continue to {nextModule?.title ?? 'next'}
                </Btn>
              ) : !result.passed ? (
                <Btn variant="primary" icon={<RotateCcw size={15} />} onClick={retake}>
                  Try again
                </Btn>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
            <h3 className={`mb-3 ${TYPE.heading}`}>Review</h3>
            <ul className="space-y-3">
              {quiz.questions.map(({ q }, i) => (
                <li key={i} className={`flex gap-3 ${TYPE.body}`}>
                  <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${result.results[i] ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'}`}>{result.results[i] ? <Check size={13} /> : <X size={13} />}</span>
                  <div>
                    <div className="text-white/85">{q.q}</div>
                    <AnswerView q={q} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}
