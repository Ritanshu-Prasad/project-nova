import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { ArrowDown, ArrowRight, ArrowUp, Check, Code2, Flame, GripVertical, Lightbulb, Timer, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../../../core/audio';
import { shuffledIndices, useCourse } from '../../../core/course';
import type { Question } from '../../../core/courseSchema';
import { FORMAT_LABEL } from '../../../core/quizBuilder';
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
    case 'code':
      return q.solution;
    case 'order':
      return q.items.join(' → ');
    case 'match':
      return q.pairs.map(([a, b]) => `${a} = ${b}`).join(' · ');
  }
}

/** The answer for review lists — code keeps its formatting. */
export function AnswerView({ q }: { q: Question }) {
  if (q.type === 'code') return <pre className="mt-1 overflow-x-auto whitespace-pre rounded-lg bg-black/30 p-2.5 font-mono text-sm text-sky-100/80 [font-variant-ligatures:none]">{q.solution}</pre>;
  return <div className="text-white/50">Answer: {answerText(q)}</div>;
}

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
  /** Seconds per question (null = untimed); a timeout counts as a miss. */
  limits?: (number | null)[];
  /** MMR multiplier on correct answers (pop quizzes pay a bonus). */
  multiplier?: number;
  /** Where each question sits in the course, 0..1 (later = rated higher) — one value or one per question. */
  progress?: number | number[];
  hints?: boolean;
  onComplete: (r: QuizResult) => void;
}

/**
 * Runs a list of questions of any format: answer, instant right/wrong feedback, next — then reports the result.
 * MMR is scored as you go but only revealed after the quiz, so the pilot can focus on the questions.
 */
export default function QuizRunner({ questions, limits, multiplier = 1, progress = 0, hints = true, onComplete }: Props) {
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
  const limit = limits?.[qi] ?? null;
  const firstTimed = limits?.findIndex((l) => l !== null) ?? -1;

  const submit = (correct: boolean, timedOut = false) => {
    if (submitted.current) return;
    submitted.current = true;
    const at = Array.isArray(progress) ? (progress[qi] ?? 0) : progress;
    const delta = useCourse.getState().answer(correct, { difficulty: q.difficulty, hint: hidden.length > 0, multiplier, progress: at });
    setResp((prev) => prev.map((x, i) => (i === qi ? { correct, delta, timedOut } : x)));
    audio.play(correct ? 'quest' : 'denied');
  };

  // Countdown for timed questions.
  useEffect(() => {
    if (!limit || answered) return;
    const id = window.setTimeout(() => submit(false, true), limit * 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, limit, answered]);

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

  return (
    <div className="font-sans">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-label={`Question ${qi + 1} of ${questions.length}`}>
          {questions.map((_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-full ${limits?.[i] ? 'ring-1 ring-amber-300/60 ring-offset-1 ring-offset-transparent' : ''}`}
              style={{ background: resp[i] ? (resp[i]!.correct ? '#34d399' : '#fb7185') : i === qi ? 'var(--user)' : 'rgb(255 255 255 / 0.1)' }}
            />
          ))}
        </div>
        {streak > 1 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-200">
            <Flame size={12} /> {streak}
          </span>
        )}
      </div>

      {qi === firstTimed && !answered && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-2.5 text-sm font-semibold text-amber-100">
          <Timer size={15} /> Final stretch — the last {questions.length - firstTimed} questions are against the clock.
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <motion.section key={qi} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }} className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
          <div className="flex items-center justify-between gap-3 text-sm text-white/50">
            <span>
              Question {qi + 1} of {questions.length} · {FORMAT_LABEL[q.type]}
            </span>
            {hints && !limit && (q.type === 'mcq' || q.type === 'multi') && !answered && (
              <button type="button" onClick={takeHint} disabled={hidden.length > 0} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-white/70 transition enabled:hover:bg-white/[0.12] disabled:opacity-40">
                <Lightbulb size={12} /> {hidden.length ? 'Hint used' : 'Hint (costs some MMR)'}
              </button>
            )}
            {limit && (
              <span className="flex items-center gap-1.5 font-semibold text-amber-200">
                <Timer size={13} /> {limit}s
              </span>
            )}
          </div>
          {limit && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div key={`t-${qi}`} className="h-full rounded-full bg-amber-300" initial={{ width: '100%' }} animate={answered ? undefined : { width: '0%' }} transition={{ duration: limit, ease: 'linear' }} />
            </div>
          )}
          <p className="mt-3 font-display text-xl font-semibold leading-snug text-white">{q.q}</p>

          <div className="mt-5">
            {q.type === 'mcq' && <Choice q={q} hidden={hidden} answered={answered} picked={picked} onPick={(i) => (setPicked([i]), submit(i === q.answer))} />}
            {q.type === 'multi' && (
              <>
                <p className="-mt-2 mb-3 text-sm text-white/50">Select every correct option.</p>
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
            {q.type === 'code' && <CodeAnswer q={q} answered={answered} onSubmit={submit} />}
            {q.type === 'order' && <OrderAnswer q={q} answered={answered} onSubmit={submit} />}
            {q.type === 'match' && <MatchAnswer q={q} answered={answered} onSubmit={submit} />}
          </div>

          <AnimatePresence>
            {answered && r && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
                <div className={`rounded-xl px-4 py-3 text-base leading-relaxed ${r.correct ? 'bg-emerald-400/10 text-emerald-50' : 'bg-rose-400/10 text-rose-50'}`}>
                  <div className="mb-1 font-semibold">
                    {r.correct ? 'Correct!' : r.timedOut ? 'Time’s up' : 'Not quite'}
                    {!r.correct && q.type !== 'code' && q.type !== 'order' && q.type !== 'match' ? ` — the answer is “${answerText(q)}”` : ''}
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

type Submit = (correct: boolean, timedOut?: boolean) => void;

/** Write code: checked against the question's checks, then the model solution is shown. */
function CodeAnswer({ q, answered, onSubmit }: { q: Extract<Question, { type: 'code' }>; answered: boolean; onSubmit: Submit }) {
  const [code, setCode] = useState(q.starter ?? '');
  const [passed, setPassed] = useState<boolean[] | null>(null);
  const check = () => {
    const results = q.checks.map((c) => {
      try {
        return new RegExp(c.pattern, 'm').test(code);
      } catch {
        return false;
      }
    });
    setPassed(results);
    onSubmit(results.every(Boolean));
  };
  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#070a12] focus-within:border-[var(--user)]">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-1.5 font-mono text-xs text-white/50">
          <Code2 size={13} /> {q.language}
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Tab') return;
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: s, selectionEnd: t } = el;
            setCode(code.slice(0, s) + '  ' + code.slice(t));
            requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
          }}
          disabled={answered}
          spellCheck={false}
          autoFocus
          rows={Math.max(6, (q.starter ?? '').split('\n').length + 3)}
          placeholder="Write your code here…"
          aria-label="Your code"
          className="block w-full resize-y bg-transparent p-3 font-mono text-sm leading-relaxed text-sky-100 outline-none [font-variant-ligatures:none] placeholder:text-white/25"
        />
      </div>
      {!answered && (
        <Btn variant="primary" className="mt-3" disabled={!code.trim() || code === q.starter} onClick={check}>
          Run checks
        </Btn>
      )}
      {answered && (
        <div className="mt-4 space-y-3">
          <ul className="space-y-1.5 text-sm">
            {q.checks.map((c, i) => (
              <li key={c.label} className={`flex items-center gap-2 ${passed?.[i] ? 'text-emerald-200' : 'text-rose-200'}`}>
                {passed?.[i] ? <Check size={14} /> : <X size={14} />} {c.label}
              </li>
            ))}
          </ul>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/40">Model solution</div>
            <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-sm text-sky-100/90 [font-variant-ligatures:none]">{q.solution}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

/** Drag (or use the arrows) to put items in order. */
function OrderAnswer({ q, answered, onSubmit }: { q: Extract<Question, { type: 'order' }>; answered: boolean; onSubmit: Submit }) {
  const [items, setItems] = useState(() => {
    const idx = shuffledIndices({ q: q.q, options: q.items });
    const order = idx.every((v, i) => v === i) ? [...idx.slice(1), idx[0]] : idx;
    return order.map((i) => q.items[i]);
  });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  return (
    <div>
      {!answered && <p className="-mt-2 mb-3 text-sm text-white/50">Drag the steps into order, or use the arrows.</p>}
      <Reorder.Group axis="y" values={items} onReorder={answered ? () => {} : setItems} className="space-y-2">
        {items.map((it, i) => {
          const ok = it === q.items[i];
          return (
            <Reorder.Item
              key={it}
              value={it}
              dragListener={!answered}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-base ${answered ? (ok ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-rose-400/60 bg-rose-400/10') : 'cursor-grab border-white/10 bg-white/[0.04] active:cursor-grabbing'}`}
            >
              {!answered && <GripVertical size={16} className="shrink-0 text-white/35" />}
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white/80">{i + 1}</span>
              <span className="flex-1 text-white/90">{it}</span>
              {!answered && (
                <span className="flex gap-1">
                  <button type="button" aria-label={`Move “${it}” up`} onClick={() => move(i, -1)} disabled={i === 0} className="cursor-pointer rounded-md p-1 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-25">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" aria-label={`Move “${it}” down`} onClick={() => move(i, 1)} disabled={i === items.length - 1} className="cursor-pointer rounded-md p-1 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-25">
                    <ArrowDown size={14} />
                  </button>
                </span>
              )}
              {answered && (ok ? <Check size={15} className="text-emerald-300" /> : <X size={15} className="text-rose-300" />)}
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
      {!answered && (
        <Btn variant="primary" className="mt-4" onClick={() => onSubmit(items.every((x, i) => x === q.items[i]))}>
          Check order
        </Btn>
      )}
      {answered && !items.every((x, i) => x === q.items[i]) && (
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-white/65">
          {q.items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

const PAIR_COLORS = ['#38bdf8', '#f472b6', '#facc15', '#34d399', '#a78bfa', '#fb923c'];

/** Tap an item on the left, then its partner on the right. */
function MatchAnswer({ q, answered, onSubmit }: { q: Extract<Question, { type: 'match' }>; answered: boolean; onSubmit: Submit }) {
  const rights = useMemo(() => shuffledIndices({ q: q.q, options: q.pairs.map((p) => p[1]) }).map((i) => q.pairs[i][1]), [q]);
  const [sel, setSel] = useState<number | null>(0);
  const [map, setMap] = useState<Record<number, number>>({});
  const complete = Object.keys(map).length === q.pairs.length;
  const pairOfRight = (j: number) => Object.entries(map).find(([, v]) => v === j)?.[0];
  const isRight = (i: number) => map[i] !== undefined && rights[map[i]] === q.pairs[i][1];

  const pickRight = (j: number) => {
    if (answered || sel === null) return;
    const next = Object.fromEntries(Object.entries(map).filter(([, v]) => v !== j)) as Record<number, number>;
    next[sel] = j;
    setMap(next);
    const free = q.pairs.findIndex((_, i) => next[i] === undefined);
    setSel(free >= 0 ? free : null);
  };

  return (
    <div>
      {!answered && <p className="-mt-2 mb-3 text-sm text-white/50">Tap an item on the left, then its partner on the right.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <ul className="space-y-2">
          {q.pairs.map(([left], i) => {
            const c = map[i] !== undefined ? PAIR_COLORS[i % PAIR_COLORS.length] : undefined;
            return (
              <li key={left}>
                <button
                  type="button"
                  disabled={answered}
                  onClick={() => setSel(i)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left text-base font-semibold transition ${answered ? (isRight(i) ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-rose-400/60 bg-rose-400/10') : sel === i ? 'border-[var(--user)] bg-[rgb(var(--user-rgb)/0.12)]' : 'cursor-pointer border-white/10 bg-white/[0.04] hover:border-white/25'}`}
                >
                  <span className="size-3 shrink-0 rounded-full border border-white/30" style={c ? { background: c, borderColor: c } : undefined} />
                  <span className="flex-1 text-white">{left}</span>
                  {answered && !isRight(i) && <span className="text-xs font-normal text-white/55">→ {q.pairs[i][1]}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="space-y-2">
          {rights.map((right, j) => {
            const owner = pairOfRight(j);
            const c = owner !== undefined ? PAIR_COLORS[Number(owner) % PAIR_COLORS.length] : undefined;
            return (
              <li key={right}>
                <button
                  type="button"
                  disabled={answered}
                  onClick={() => pickRight(j)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left text-sm text-white/85 transition hover:border-white/25 disabled:cursor-default"
                  style={c ? { borderColor: c, background: `${c}1a` } : undefined}
                >
                  <span className="size-3 shrink-0 rounded-full border border-white/30" style={c ? { background: c, borderColor: c } : undefined} />
                  {right}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {!answered && (
        <Btn variant="primary" className="mt-4" disabled={!complete} onClick={() => onSubmit(q.pairs.every((_, i) => isRight(i)))}>
          {complete ? 'Check matches' : `Match all ${q.pairs.length} pairs`}
        </Btn>
      )}
    </div>
  );
}
