import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { fetchPlacement, fetchPlacementLevel } from '../../core/courseApi';
import type { Level, Question } from '../../core/courseSchema';

type Mcq = Extract<Question, { type: 'mcq' }>;
type Phase = 'idle' | 'loading' | 'asking' | 'scoring' | 'error';

/** An optional five-question check for a learner who does not know which level to pick. */
export default function PlacementCheck({ objective, onLevel }: { objective: string; onLevel: (level: Level) => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [questions, setQuestions] = useState<Mcq[]>([]);
  const [results, setResults] = useState<{ difficulty: number; correct: boolean }[]>([]);
  const [suggested, setSuggested] = useState<Level | null>(null);

  const start = async () => {
    setPhase('loading');
    setSuggested(null);
    try {
      const quiz = (await fetchPlacement(objective)) as Mcq[];
      if (!quiz.length) throw new Error('empty');
      setQuestions(quiz);
      setResults([]);
      setPhase('asking');
    } catch {
      setPhase('error');
    }
  };

  const answer = async (picked: number) => {
    const question = questions[results.length];
    const next = [...results, { difficulty: question.difficulty ?? 1, correct: picked === question.answer }];
    setResults(next);
    if (next.length < questions.length) return;
    setPhase('scoring');
    try {
      const level = await fetchPlacementLevel(next);
      setSuggested(level);
      onLevel(level);
      setPhase('idle');
    } catch {
      setPhase('error');
    }
  };

  if (phase === 'asking') {
    const question = questions[results.length];
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">
          Question {results.length + 1} of {questions.length}
        </div>
        <p className="mb-3 text-sm text-white/90">{question.q}</p>
        <div className="grid gap-2">
          {question.options.map((option, index) => (
            <button key={index} type="button" onClick={() => void answer(index)} className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-white/75 transition hover:border-[var(--user)] hover:text-white">
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button type="button" onClick={() => void start()} disabled={phase === 'loading' || phase === 'scoring'} className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-white/70 transition hover:text-white disabled:cursor-wait disabled:opacity-60">
        {phase === 'loading' || phase === 'scoring' ? <Loader2 size={14} className="animate-spin" /> : null}
        Not sure of your level? Take a 5-question check
      </button>
      {suggested && (
        <span className="flex items-center gap-1 text-emerald-200">
          <Check size={14} /> Suggested level: {suggested}
        </span>
      )}
      {phase === 'error' && <span className="text-amber-200">The check is not available right now. Pick a level yourself.</span>}
    </div>
  );
}
