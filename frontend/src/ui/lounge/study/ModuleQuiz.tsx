import { ArrowRight, Check, Play, RotateCcw, Target, Trophy, X } from 'lucide-react';
import { useState } from 'react';
import { PASS_MARK, useCourse, type ActiveCourse, type OutlineItem } from '../../../core/course';
import { cheerPet } from '../../../core/hub';
import { holoBurst } from '../../../core/journey';
import { useNova } from '../../../core/store';
import Btn from './Btn';
import { TYPE } from './typography';
import QuizRunner, { answerText, type QuizResult } from './QuizRunner';

type QuizItem = Extract<OutlineItem, { kind: 'quiz' }>;

/** The end-of-module checkpoint: intro → questions → result (pass to unlock the next module). */
export default function ModuleQuiz({ item, active }: { item: QuizItem; active: ActiveCourse }) {
  const [stage, setStage] = useState<'intro' | 'run' | 'done'>('intro');
  const [result, setResult] = useState<(QuizResult & { passed: boolean; nextId: string | null }) | null>(null);
  const progress = active.entry.modules[item.module.id];
  const nextModule = active.course.modules[item.moduleIndex + 1];
  const n = item.questions.length;

  const finish = (r: QuizResult) => {
    const out = useCourse.getState().finishModuleQuiz(item.module.id, r.correct, r.total);
    if (out.passed) {
      cheerPet();
      holoBurst(1);
      useNova.getState().notify({ kind: 'levelup', title: 'Module complete', lines: [nextModule ? `${nextModule.title} is unlocked.` : 'You finished the whole course!'], ttl: 3.5 });
    }
    setResult({ ...r, ...out });
    setStage('done');
  };

  return (
    <article className="font-sans">
      <header>
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--user)' }}>
          <Target size={14} /> Module {item.moduleIndex + 1} quiz
        </div>
        <h1 className={`mt-1 ${TYPE.heading}`}>{item.module.title}</h1>
      </header>

      {stage === 'intro' && (
        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
          <p className={TYPE.body}>
            {n} questions on everything in this module. Score {Math.round(PASS_MARK * 100)}% or more to pass{nextModule ? ` and unlock “${nextModule.title}”` : ' and finish the course'}.
          </p>
          <ul className={`mt-4 grid gap-2 sm:grid-cols-3 ${TYPE.body}`}>
            <li className="rounded-xl bg-white/[0.04] px-3 py-2">{n} questions</li>
            <li className="rounded-xl bg-white/[0.04] px-3 py-2">Pass mark {Math.round(PASS_MARK * 100)}%</li>
            <li className="rounded-xl bg-white/[0.04] px-3 py-2">{progress ? `Best so far ${Math.round(progress.best * 100)}%` : 'First attempt'}</li>
          </ul>
          <Btn variant="primary" className="mt-5" icon={<Play size={15} />} onClick={() => setStage('run')}>
            {progress?.passed ? 'Retake quiz' : 'Start quiz'}
          </Btn>
        </div>
      )}

      {stage === 'run' && (
        <div className="mt-6">
          <QuizRunner questions={item.questions} position={item.moduleIndex * 3} onComplete={finish} />
        </div>
      )}

      {stage === 'done' && result && (
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
                <Btn variant="primary" icon={<RotateCcw size={15} />} onClick={() => setStage('run')}>
                  Try again
                </Btn>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
            <h3 className={`mb-3 ${TYPE.heading}`}>Review</h3>
            <ul className="space-y-3">
              {item.questions.map((q, i) => (
                <li key={i} className={`flex gap-3 ${TYPE.body}`}>
                  <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${result.results[i] ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'}`}>{result.results[i] ? <Check size={13} /> : <X size={13} />}</span>
                  <div>
                    <div className="text-white/85">{q.q}</div>
                    <div className="text-white/50">Answer: {answerText(q)}</div>
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
