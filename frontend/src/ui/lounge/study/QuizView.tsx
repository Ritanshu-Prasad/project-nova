import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BookOpen, Check, CircleCheck, Flame, Lightbulb, Map, RotateCcw, Target, Trophy, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { audio } from '../../../core/audio';
import { shuffledIndices, useCourse } from '../../../core/course';
import type { PlacedTopic, Question } from '../../../core/courseSchema';
import { cheerPet, useHub } from '../../../core/hub';
import { holoBurst } from '../../../core/journey';
import { useNova } from '../../../core/store';
import { HudButton } from '../../common/HudButton';
import RocketProgress from '../RocketProgress';

interface Resp {
  correct: boolean;
  delta: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9α-ωλ]+/gi, ' ').trim();

function answerText(q: Question): string {
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

/** A full quiz for one topic: several question types, hints, live feedback and a results screen. */
export default function QuizView({ topic }: { topic: PlacedTopic }) {
  const qs = topic.quiz;
  const streak = useCourse((s) => s.stats.streak);
  const [qi, setQi] = useState(0);
  const [resp, setResp] = useState<(Resp | null)[]>(() => qs.map(() => null));
  const [picked, setPicked] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [hidden, setHidden] = useState<number[]>([]);
  const [result, setResult] = useState<null | { passed: boolean; advanced: boolean; nextId: string | null }>(null);

  const finish = () => {
    const r = useCourse.getState().finishQuiz(topic.id);
    if (r.advanced) {
      cheerPet();
      holoBurst(1);
      useNova.getState().notify({ kind: 'levelup', title: 'Planet cleared', lines: [`${topic.planet} done — the rocket flies on.`], ttl: 3.5 });
    }
    setResult(r);
  };

  if (result) return <Results topic={topic} resp={resp} result={result} onRetry={() => (useCourse.getState().resetQuiz(topic.id), setResp(qs.map(() => null)), setQi(0), setPicked([]), setText(''), setHidden([]), setResult(null))} />;

  if (!qs.length) {
    return (
      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-8 text-center">
        <BookOpen size={36} className="mx-auto text-white/50" />
        <h2 className="mt-3 font-display text-2xl font-bold text-white">No questions for this topic yet</h2>
        <p className="mt-2 text-white/60">Your AI tutor will write practice questions once it is connected. You can still mark it complete.</p>
        <HudButton variant="primary" className="mt-5" icon={<CircleCheck size={15} />} onClick={finish}>
          Mark as complete
        </HudButton>
      </div>
    );
  }

  const q = qs[qi];
  const r = resp[qi];
  const answered = r !== null;

  const submit = (correct: boolean) => {
    if (answered) return;
    const delta = useCourse.getState().answer(topic.id, qi, correct, { difficulty: q.difficulty, hint: hidden.length > 0 });
    setResp((prev) => prev.map((x, i) => (i === qi ? { correct, delta } : x)));
    if (correct) {
      cheerPet();
      holoBurst(0.6);
      audio.play('quest');
    } else audio.play('denied');
  };

  const next = () => {
    if (qi < qs.length - 1) {
      setQi(qi + 1);
      setPicked([]);
      setText('');
      setHidden([]);
    } else finish();
  };

  const takeHint = () => {
    if ((q.type !== 'mcq' && q.type !== 'multi') || hidden.length) return;
    const right = q.type === 'mcq' ? [q.answer] : q.answers;
    const wrong = q.options.map((_, i) => i).filter((i) => !right.includes(i));
    setHidden(wrong.slice(0, Math.max(1, Math.floor(wrong.length / 2))));
    audio.play('click');
  };

  const sessionDelta = resp.reduce((a, x) => a + (x?.delta ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="chip-label">
            <Target size={12} /> {topic.planet} · quiz
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">{topic.title}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${sessionDelta >= 0 ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'}`}>
            {sessionDelta >= 0 ? '+' : ''}
            {sessionDelta} MMR
          </span>
          {streak > 1 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 font-semibold text-amber-200">
              <Flame size={12} /> {streak} in a row
            </span>
          )}
        </div>
      </div>

      {/* Question navigator */}
      <div className="mt-6 flex gap-1.5" aria-label={`Question ${qi + 1} of ${qs.length}`}>
        {qs.map((_, i) => (
          <span key={i} className="h-2 flex-1 rounded-full" style={{ background: resp[i] ? (resp[i]!.correct ? '#34d399' : '#fb7185') : i === qi ? 'var(--user)' : 'rgb(255 255 255 / 0.1)' }} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.section key={qi} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }} className="mt-6 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 text-xs text-white/50">
            <span>
              Question {qi + 1} of {qs.length} · {TYPE_LABEL[q.type]}
            </span>
            {(q.type === 'mcq' || q.type === 'multi') && !answered && (
              <button type="button" onClick={takeHint} disabled={hidden.length > 0} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-white/70 transition enabled:hover:bg-white/[0.12] disabled:opacity-40">
                <Lightbulb size={12} /> {hidden.length ? 'Hint used' : 'Hint (half MMR)'}
              </button>
            )}
          </div>
          <p className="mt-3 text-xl font-medium leading-snug text-white sm:text-2xl">{q.q}</p>

          <div className="mt-6">
            {q.type === 'mcq' && <Choice q={q} hidden={hidden} answered={answered} picked={picked} onPick={(i) => (setPicked([i]), submit(i === q.answer))} />}
            {q.type === 'multi' && (
              <>
                <Choice q={q} multi hidden={hidden} answered={answered} picked={picked} onPick={(i) => !answered && setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))} />
                {!answered && (
                  <HudButton variant="primary" className="mt-4" disabled={!picked.length} onClick={() => submit(picked.length === q.answers.length && picked.every((p) => q.answers.includes(p)))}>
                    Check answer
                  </HudButton>
                )}
              </>
            )}
            {q.type === 'truefalse' && (
              <div className="grid grid-cols-2 gap-3">
                {[true, false].map((v) => {
                  const state = !answered ? 'idle' : v === q.answer ? 'right' : picked[0] === (v ? 1 : 0) ? 'wrong' : 'dim';
                  return (
                    <button key={String(v)} type="button" disabled={answered} onClick={() => (setPicked([v ? 1 : 0]), submit(v === q.answer))} className={`rounded-2xl border px-4 py-5 text-lg font-semibold transition ${optionCls(state)}`}>
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
                  const ok = [q.answer, ...(q.accept ?? [])].some((a) => norm(a) === norm(text));
                  submit(ok);
                }}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={answered}
                  autoFocus
                  placeholder="Type your answer…"
                  className={`flex-1 rounded-2xl border bg-black/30 px-4 py-3 text-lg text-white outline-none placeholder:text-white/30 focus:border-[var(--user)] ${answered ? (r?.correct ? 'border-emerald-400/70' : 'border-rose-400/70') : 'border-white/10'}`}
                />
                {!answered && (
                  <HudButton type="submit" variant="primary" size="lg" disabled={!text.trim()}>
                    Check
                  </HudButton>
                )}
              </form>
            )}
          </div>

          <AnimatePresence>
            {answered && r && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
                <div className={`rounded-2xl px-5 py-4 leading-relaxed ${r.correct ? 'bg-emerald-400/10 text-emerald-50' : 'bg-rose-400/10 text-rose-50'}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 font-semibold">
                    {r.correct ? 'Correct!' : `Not quite — the answer is “${answerText(q)}”`}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${r.delta >= 0 ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'}`}>
                      {r.delta >= 0 ? '+' : ''}
                      {r.delta} MMR
                    </span>
                  </div>
                  {q.why}
                </div>
                <HudButton variant="primary" icon={<ArrowRight size={15} />} onClick={next}>
                  {qi < qs.length - 1 ? 'Next question' : 'See results'}
                </HudButton>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </AnimatePresence>
    </div>
  );
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
            className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-[16px] transition ${optionCls(state)}`}
          >
            <span className={`grid size-8 shrink-0 place-items-center font-mono text-xs ${multi ? 'rounded-lg' : 'rounded-full'} bg-white/10`}>
              {state === 'right' ? <Check size={15} /> : state === 'wrong' ? <X size={15} /> : multi && isPicked ? <Check size={15} /> : String.fromCharCode(65 + pos)}
            </span>
            {q.options[i]}
          </motion.button>
        );
      })}
    </div>
  );
}

function Results({
  topic,
  resp,
  result,
  onRetry,
}: {
  topic: PlacedTopic;
  resp: (Resp | null)[];
  result: { passed: boolean; advanced: boolean; nextId: string | null };
  onRetry: () => void;
}) {
  const right = resp.filter((r) => r?.correct).length;
  const delta = resp.reduce((a, r) => a + (r?.delta ?? 0), 0);
  const goNext = () => {
    if (result.nextId) useCourse.getState().openTopic(result.nextId);
    useHub.getState().go(result.nextId ? 'lesson' : 'journey');
  };
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6 text-center sm:p-8">
        {result.passed ? <Trophy size={42} className="mx-auto text-amber-300" /> : <RotateCcw size={38} className="mx-auto text-white/60" />}
        <h1 className="mt-3 font-display text-3xl font-bold text-white">{result.passed ? `${topic.planet} cleared!` : 'Not quite yet'}</h1>
        <p className="mt-2 text-white/65">
          {topic.quiz.length ? `${right} of ${topic.quiz.length} correct · ` : ''}
          <span className={delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
            {delta >= 0 ? '+' : ''}
            {delta} MMR
          </span>
          {result.advanced ? ' · +60 XP for a new planet' : ''}
        </p>
        <div className="mx-auto mt-6 max-w-2xl rounded-2xl bg-black/25 px-2 pb-5 pt-9">
          <RocketProgress />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          {result.passed ? (
            <HudButton variant="primary" icon={<ArrowRight size={15} />} onClick={goNext}>
              {result.nextId ? 'Next lesson' : 'Course complete — view journey'}
            </HudButton>
          ) : (
            <>
              <HudButton icon={<BookOpen size={15} />} onClick={() => useHub.getState().go('lesson')}>
                Review lesson
              </HudButton>
              <HudButton variant="primary" icon={<RotateCcw size={15} />} onClick={onRetry}>
                Retry quiz
              </HudButton>
            </>
          )}
          <HudButton icon={<Map size={15} />} onClick={() => useHub.getState().go('journey')}>
            Journey map
          </HudButton>
        </div>
      </div>
      {topic.quiz.length > 0 && (
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6">
          <div className="chip-label mb-3">Review your answers</div>
          <ul className="space-y-3">
            {topic.quiz.map((q, i) => (
              <li key={i} className="flex gap-3">
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${resp[i]?.correct ? 'bg-emerald-400/20 text-emerald-300' : 'bg-rose-400/20 text-rose-300'}`}>{resp[i]?.correct ? <Check size={13} /> : <X size={13} />}</span>
                <div className="text-sm">
                  <div className="text-white/85">{q.q}</div>
                  <div className="text-white/50">Answer: {answerText(q)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
