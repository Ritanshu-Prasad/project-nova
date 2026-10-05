import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Flame, Lightbulb, Timer, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../../../core/audio';
import { shuffledIndices, useCourse } from '../../../core/course';
import type { Question } from '../../../core/courseSchema';
import { cheerPet } from '../../../core/hub';
import { holoBurst } from '../../../core/journey';
import Btn from './Btn';

export interface QuizResult {
  correct: number;
  total: number;
  delta: number;
  results: boolean[];
}

interface Resp {
  correct: boolean;
  delta: number;
  timedOut?: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9α-ωλ]+/gi, ' ').trim();

export function answerText(q: Question): string {
  switch (q.type) {
    case 'mcq':
      return q.options[q.answer];
    case 'multi':
      return q.answers.map((i) => q.options[i]).join(', ');
    case 'truefalse':
      return q.answer ? 'True' : 'False';
    case 'fill':
      return q.answer;
  }
}

const TYPE_LABEL: Record<Question['type'], string> = { mcq: 'Choose one', multi: 'Choose all that apply', truefalse: 'True or false', fill: 'Fill in the blank' };

function optionCls(state: 'idle' | 'right' | 'wrong' | 'dim' | 'selected') {
  switch (state) {
    case 'idle':
      return 'cursor-pointer border-white/10 bg-white/[0.04] text-white/90 hover:border-[var(--user)] hover:bg-white/[0.08]';
    case 'selected':
      return 'cursor-pointer border-[var(--user)] bg-[rgb(var(--user-rgb)/0.12)] text-white';
    case 'right':
      return 'border-emerald-400/70 bg-emerald-400/15 text-white';
    case 'wrong':
      return 'border-rose-400/70 bg-rose-400/15 text-white';
    case 'dim':
      return 'border-white/5 bg-white/[0.02] text-white/40';
  }
}

interface Props {
  questions: Question[];
  /** Seconds per question (pop quizzes); a timeout counts as a miss. */
  timed?: number;
  /** MMR multiplier on correct answers (pop quizzes pay a bonus). */
  multiplier?: number;
  /** Position of the quiz in the course (later = higher rated questions). */
  position?: number;
  hints?: boolean;
  onComplete: (r: QuizResult) => void;
}

/** Runs a list of questions of any type: answer, instant feedback, next — then reports the result. */
export default function QuizRunner({ questions, timed, multiplier = 1, position = 0, hints = true, onComplete }: Props) {
  const streak = useCourse((s) => s.stats.streak);
  const [qi, setQi] = useState(0);
  const [resp, setResp] = useState<(Resp | null)[]>(() => questions.map(() => null));
  const [picked, setPicked] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [hidden, setHidden] = useState<number[]>([]);
  const q = questions[qi];
  const r = resp[qi];
  const answered = r !== null;
  const submitted = useRef(false);

  const submit = (correct: boolean, timedOut = false) => {
    if (submitted.current) return;
    submitted.current = true;
    const delta = useCourse.getState().answer(correct, { difficulty: q.difficulty, hint: hidden.length > 0, multiplier, position });
    setResp((prev) => prev.map((x, i) => (i === qi ? { correct, delta, timedOut } : x)));
    if (correct) {
      cheerPet();
      holoBurst(0.6);
      audio.play('quest');
    } else audio.play('denied');
  };

  // Countdown for timed quizzes.
  useEffect(() => {
    if (!timed || answered) return;
    const id = window.setTimeout(() => submit(false, true), timed * 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, timed, answered]);

  const next = () => {
    if (qi < questions.length - 1) {
      submitted.current = false;
      setQi(qi + 1);
      setPicked([]);
      setText('');
      setHidden([]);
      return;
    }
    const results = resp.map((x) => !!x?.correct);
    onComplete({ correct: results.filter(Boolean).length, total: questions.length, delta: resp.reduce((a, x) => a + (x?.delta ?? 0), 0), results });
  };

  const takeHint = () => {
    if ((q.type !== 'mcq' && q.type !== 'multi') || hidden.length) return;
    const right = q.type === 'mcq' ? [q.answer] : q.answers;
    const wrong = q.options.map((_, i) => i).filter((i) => !right.includes(i));
    setHidden(wrong.slice(0, Math.max(1, Math.floor(wrong.length / 2))));
  };

  const sessionDelta = resp.reduce((a, x) => a + (x?.delta ?? 0), 0);

  return (
    <div className="font-sans">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-label={`Question ${qi + 1} of ${questions.length}`}>
          {questions.map((_, i) => (
            <span key={i} className="h-2 flex-1 rounded-full" style={{ background: resp[i] ? (resp[i]!.correct ? '#34d399' : '#fb7185') : i === qi ? 'var(--user)' : 'rgb(255 255 255 / 0.1)' }} />
          ))}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sessionDelta >= 0 ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'}`}>
          {sessionDelta >= 0 ? '+' : ''}
          {sessionDelta} MMR
        </span>
        {streak > 1 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
            <Flame size={12} /> {streak}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.section key={qi} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }} className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
          <div className="flex items-center justify-between gap-3 text-sm text-white/50">
            <span>
              Question {qi + 1} of {questions.length} · {TYPE_LABEL[q.type]}
            </span>
            {hints && !timed && (q.type === 'mcq' || q.type === 'multi') && !answered && (
              <button type="button" onClick={takeHint} disabled={hidden.length > 0} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-white/70 transition enabled:hover:bg-white/[0.12] disabled:opacity-40">
                <Lightbulb size={12} /> {hidden.length ? 'Hint used' : 'Hint (half MMR)'}
              </button>
            )}
            {timed && (
              <span className="flex items-center gap-1.5 font-semibold text-amber-200">
                <Timer size={13} /> {timed}s
              </span>
            )}
          </div>
          {timed && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div key={`t-${qi}`} className="h-full rounded-full bg-amber-300" initial={{ width: '100%' }} animate={answered ? undefined : { width: '0%' }} transition={{ duration: timed, ease: 'linear' }} />
            </div>
          )}
          <p className="mt-3 font-display text-xl font-semibold leading-snug text-white">{q.q}</p>

          <div className="mt-5">
            {q.type === 'mcq' && <Choice q={q} hidden={hidden} answered={answered} picked={picked} onPick={(i) => (setPicked([i]), submit(i === q.answer))} />}
            {q.type === 'multi' && (
              <>
                <Choice q={q} multi hidden={hidden} answered={answered} picked={picked} onPick={(i) => !answered && setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))} />
                {!answered && (
                  <Btn variant="primary" className="mt-4" disabled={!picked.length} onClick={() => submit(picked.length === q.answers.length && picked.every((p) => q.answers.includes(p)))}>
                    Check answer
                  </Btn>
                )}
              </>
            )}
            {q.type === 'truefalse' && (
              <div className="grid grid-cols-2 gap-3">
                {[true, false].map((v) => {
                  const state = !answered ? 'idle' : v === q.answer ? 'right' : picked[0] === (v ? 1 : 0) ? 'wrong' : 'dim';
                  return (
                    <button key={String(v)} type="button" disabled={answered} onClick={() => (setPicked([v ? 1 : 0]), submit(v === q.answer))} className={`rounded-xl border px-4 py-4 text-base font-semibold transition ${optionCls(state)}`}>
                      {v ? 'True' : 'False'}
                    </button>
                  );
                })}
              </div>
            )}
            {q.type === 'fill' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!text.trim() || answered) return;
                  submit([q.answer, ...(q.accept ?? [])].some((a) => norm(a) === norm(text)));
                }}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={answered}
                  autoFocus
                  placeholder="Type your answer…"
                  className={`flex-1 rounded-xl border bg-black/30 px-4 py-3 text-base text-white outline-none placeholder:text-white/30 focus:border-[var(--user)] ${answered ? (r?.correct ? 'border-emerald-400/70' : 'border-rose-400/70') : 'border-white/10'}`}
                />
                {!answered && (
                  <Btn type="submit" variant="primary" disabled={!text.trim()}>
                    Check
                  </Btn>
                )}
              </form>
            )}
          </div>

          <AnimatePresence>
            {answered && r && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
                <div className={`rounded-xl px-4 py-3 text-base leading-relaxed ${r.correct ? 'bg-emerald-400/10 text-emerald-50' : 'bg-rose-400/10 text-rose-50'}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 font-semibold">
                    {r.correct ? 'Correct!' : r.timedOut ? `Time’s up — the answer is “${answerText(q)}”` : `Not quite — the answer is “${answerText(q)}”`}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${r.delta >= 0 ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'}`}>
                      {r.delta >= 0 ? '+' : ''}
                      {r.delta} MMR
                    </span>
                  </div>
                  {q.why}
                </div>
                <Btn variant="primary" icon={<ArrowRight size={15} />} onClick={next}>
                  {qi < questions.length - 1 ? 'Next question' : 'See results'}
                </Btn>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}

function Choice({
  q,
  multi = false,
  hidden,
  answered,
  picked,
  onPick,
}: {
  q: Extract<Question, { type: 'mcq' | 'multi' }>;
  multi?: boolean;
  hidden: number[];
  answered: boolean;
  picked: number[];
  onPick: (i: number) => void;
}) {
  const order = useMemo(() => shuffledIndices(q), [q]);
  const right = q.type === 'mcq' ? [q.answer] : q.answers;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {order.map((i, pos) => {
        if (hidden.includes(i)) return null;
        const isPicked = picked.includes(i);
        const state = !answered ? (isPicked ? 'selected' : 'idle') : right.includes(i) ? 'right' : isPicked ? 'wrong' : 'dim';
        return (
          <motion.button
            key={i}
            type="button"
            disabled={answered}
            onClick={() => onPick(i)}
            animate={state === 'wrong' ? { x: [0, -6, 6, -3, 3, 0] } : { x: 0 }}
            transition={{ duration: 0.35 }}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-base transition ${optionCls(state)}`}
          >
            <span className={`grid size-7 shrink-0 place-items-center text-xs font-semibold ${multi ? 'rounded-md' : 'rounded-full'} bg-white/10`}>
              {state === 'right' ? <Check size={14} /> : state === 'wrong' ? <X size={14} /> : multi && isPicked ? <Check size={14} /> : String.fromCharCode(65 + pos)}
            </span>
            {q.options[i]}
          </motion.button>
        );
      })}
    </div>
  );
}
