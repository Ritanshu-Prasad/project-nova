import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BookOpen, Check, Flame, Lightbulb, Map, Palette, RotateCcw, Sparkles, Target, Trophy, UserRound, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { audio } from '../../core/audio';
import { findCourse, levelOf, levelProgress, shuffledOptions, useCourse } from '../../core/course';
import { cheerPet, useHub, useProfile } from '../../core/hub';
import { holoBurst } from '../../core/journey';
import { useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';
import RocketProgress from './RocketProgress';

function Head({ icon, kicker, title }: { icon: ReactNode; kicker: string; title: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl" style={{ background: 'rgb(var(--user-rgb) / 0.16)', color: 'var(--user)' }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="chip-label">{kicker}</div>
        <h2 className="mt-0.5 font-display text-2xl font-bold leading-tight text-white">{title}</h2>
      </div>
    </div>
  );
}

export function LessonSection() {
  const courseId = useCourse((s) => s.courseId);
  const current = useCourse((s) => s.current);
  const sub = findCourse(courseId).subtopics[current];
  const [simple, setSimple] = useState(false);
  return (
    <div className="space-y-5">
      <Head icon={<BookOpen size={19} />} kicker={`Planet ${current + 1} · ${sub.planet}`} title={sub.title} />
      <AnimatePresence mode="wait">
        <motion.p
          key={`${current}-${simple}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="text-[15px] leading-relaxed text-white/85"
        >
          {simple ? sub.simple : sub.lesson}
        </motion.p>
      </AnimatePresence>
      <div>
        <div className="chip-label mb-2">Key points</div>
        <ul className="space-y-2">
          {sub.keys.map((k) => (
            <li key={k} className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-white/85">
              <Check size={14} style={{ color: 'var(--user)' }} /> {k}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2.5 pt-1">
        <HudButton icon={<Lightbulb size={15} />} onClick={() => (setSimple((v) => !v), holoBurst(0.4))}>
          {simple ? 'Show original' : 'Explain simpler'}
        </HudButton>
        <HudButton variant="primary" icon={<Target size={15} />} onClick={() => useHub.getState().go('quiz')}>
          Take the quiz
        </HudButton>
      </div>
    </div>
  );
}

export function QuizSection() {
  const courseId = useCourse((s) => s.courseId);
  const current = useCourse((s) => s.current);
  const cleared = useCourse((s) => s.cleared);
  const streak = useCourse((s) => s.streak);
  const course = findCourse(courseId);
  const n = course.subtopics.length;
  // Lock the planet for this quiz session (clearing it moves current on).
  const [subIdx] = useState(current);
  const sub = course.subtopics[subIdx];
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [delta, setDelta] = useState(0);
  const [result, setResult] = useState<null | { passed: boolean; advanced: boolean }>(null);

  if (cleared >= n && !result) {
    return (
      <div className="space-y-5 text-center">
        <Trophy size={44} className="mx-auto text-amber-300" />
        <h2 className="font-display text-2xl font-bold text-white">Course complete!</h2>
        <p className="text-white/70">Every planet cleared. Start a new course to keep levelling up.</p>
        <HudButton variant="primary" onClick={() => useNova.getState().setCurriculumOpen(true)}>
          Start a new course
        </HudButton>
      </div>
    );
  }

  const q = sub.quiz[qi];
  const options = shuffledOptions(q);

  const pick = (i: number) => {
    if (picked !== null) return;
    const correct = options[i].correct;
    setPicked(i);
    setDelta(useCourse.getState().answer(subIdx, qi, correct));
    if (correct) {
      cheerPet();
      holoBurst(0.6);
      audio.play('quest');
    } else audio.play('denied');
  };

  const next = () => {
    if (qi < sub.quiz.length - 1) {
      setQi(qi + 1);
      setPicked(null);
      return;
    }
    const passed = (useCourse.getState().answers[subIdx] ?? []).some(Boolean);
    const advanced = passed && useCourse.getState().clearPlanet(subIdx);
    if (advanced) {
      cheerPet();
      holoBurst(1);
      useNova.getState().notify({ kind: 'levelup', title: 'Planet cleared', lines: [`${sub.planet} done — the rocket flies on.`], ttl: 3.5 });
    }
    setResult({ passed, advanced });
  };

  if (result) {
    return (
      <div className="space-y-5">
        <Head icon={result.passed ? <Trophy size={19} /> : <RotateCcw size={19} />} kicker={sub.planet} title={result.passed ? 'Planet cleared!' : 'Not quite yet'} />
        <p className="text-white/75">
          {result.passed ? (result.advanced ? 'Nice flying — your rocket moved to the next planet.' : 'Review complete. Your progress is saved.') : 'Review the lesson and give it another go — every attempt still earns XP.'}
        </p>
        <div className="rounded-2xl bg-black/25 px-3 pb-3 pt-6">
          <RocketProgress />
        </div>
        <div className="flex flex-wrap gap-2.5">
          {result.passed ? (
            <HudButton variant="primary" icon={<ArrowRight size={15} />} onClick={() => useHub.getState().go('lesson')}>
              {useCourse.getState().cleared >= n ? 'See your trophy' : 'Next lesson'}
            </HudButton>
          ) : (
            <>
              <HudButton icon={<BookOpen size={15} />} onClick={() => useHub.getState().go('lesson')}>
                Review lesson
              </HudButton>
              <HudButton
                variant="primary"
                icon={<RotateCcw size={15} />}
                onClick={() => {
                  useCourse.getState().retry(subIdx);
                  setQi(0);
                  setPicked(null);
                  setResult(null);
                }}
              >
                Retry quiz
              </HudButton>
            </>
          )}
          <HudButton icon={<Map size={15} />} onClick={() => useHub.getState().go('journey')}>
            Journey map
          </HudButton>
        </div>
      </div>
    );
  }

  const answered = picked !== null;
  const correct = answered && options[picked].correct;
  return (
    <div className="space-y-5">
      <Head icon={<Target size={19} />} kicker={`${sub.planet} · question ${qi + 1} of ${sub.quiz.length}`} title={sub.title} />
      <div className="flex gap-1.5">
        {sub.quiz.map((_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < qi || (i === qi && answered) ? 'var(--user)' : 'rgb(255 255 255 / 0.1)' }} />
        ))}
      </div>
      <p className="text-[17px] font-medium leading-snug text-white">{q.q}</p>
      <div className="grid gap-2.5">
        {options.map((o, i) => {
          const state = !answered ? 'idle' : o.correct ? 'right' : i === picked ? 'wrong' : 'dim';
          return (
            <motion.button
              key={o.text}
              type="button"
              disabled={answered}
              onClick={() => pick(i)}
              animate={state === 'wrong' ? { x: [0, -6, 6, -3, 3, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] transition ${
                state === 'idle'
                  ? 'cursor-pointer border-white/10 bg-white/[0.04] text-white/90 hover:border-[var(--user)] hover:bg-white/[0.08]'
                  : state === 'right'
                    ? 'border-emerald-400/70 bg-emerald-400/15 text-white'
                    : state === 'wrong'
                      ? 'border-rose-400/70 bg-rose-400/15 text-white'
                      : 'border-white/5 bg-white/[0.02] text-white/40'
              }`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/10 font-mono text-xs">
                {state === 'right' ? <Check size={14} /> : state === 'wrong' ? <X size={14} /> : String.fromCharCode(65 + i)}
              </span>
              {o.text}
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence>
        {answered && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${correct ? 'bg-emerald-400/10 text-emerald-50' : 'bg-rose-400/10 text-rose-50'}`}>
              <div className="mb-1 flex items-center gap-2 font-semibold">
                {correct ? 'Correct!' : 'Not this time'}
                <span className={`rounded-full px-2 py-0.5 text-xs ${delta >= 0 ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'}`}>
                  {delta >= 0 ? '+' : ''}
                  {delta} MMR
                </span>
                {correct && streak > 1 && (
                  <span className="flex items-center gap-1 text-xs text-amber-300">
                    <Flame size={13} /> {streak} in a row
                  </span>
                )}
              </div>
              {q.why}
            </div>
            <HudButton variant="primary" icon={<ArrowRight size={15} />} onClick={next}>
              {qi < sub.quiz.length - 1 ? 'Next question' : 'Finish planet'}
            </HudButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function JourneySection() {
  const courseId = useCourse((s) => s.courseId);
  const cleared = useCourse((s) => s.cleared);
  const objective = useCourse((s) => s.objective);
  const course = findCourse(courseId);
  const n = course.subtopics.length;
  const nextPlanet = course.subtopics[Math.min(cleared, n - 1)];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Head icon={<Map size={19} />} kicker="Journey map" title={course.title} />
        <div className="text-right text-sm text-white/65">
          <div className="font-display text-2xl font-bold text-white">
            {cleared}/{n}
          </div>
          planets cleared
        </div>
      </div>
      {objective && <p className="text-sm text-white/55">Your goal: “{objective}”</p>}
      <div className="rounded-2xl bg-black/25 px-2 pb-6 pt-10">
        <RocketProgress
          onSelect={(i) => {
            useCourse.getState().goTo(i);
            useHub.getState().go('lesson');
          }}
        />
      </div>
      <p className="text-sm text-white/65">
        {cleared >= n ? 'All planets cleared — what a journey!' : `Next stop: ${nextPlanet.planet} — ${nextPlanet.title}. Hover a planet to see its subtopic, click an unlocked one to study it.`}
      </p>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-12 text-xs text-white/40">Answer a quiz to start your MMR graph.</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${40 - ((v - min) / Math.max(1, max - min)) * 34 - 3}`).join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-12 w-full">
      <polyline points={pts} fill="none" stroke="var(--user)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function ProfileSection() {
  const callsign = useProfile((s) => s.callsign) || 'Pilot';
  const themeColor = useNova((s) => s.themeColor);
  const c = useCourse();
  const n = findCourse(c.courseId).subtopics.length;
  const level = levelOf(c.xp);
  const accuracy = c.answered ? Math.round((c.correct / c.answered) * 100) : 0;
  const stats = [
    { label: 'MMR', value: c.mmr.toLocaleString('en-IN') },
    { label: 'Accuracy', value: `${accuracy}%` },
    { label: 'Best streak', value: String(c.bestStreak) },
    { label: 'Planets', value: `${c.cleared}/${n}` },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center rounded-3xl font-display text-2xl font-bold text-[var(--user-ink)]" style={{ background: 'var(--user)', boxShadow: '0 0 30px rgb(var(--user-rgb) / 0.45)' }}>
          {callsign.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="chip-label">
            <UserRound size={12} /> Pilot profile
          </div>
          <h2 className="truncate font-display text-2xl font-bold text-white">{callsign}</h2>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-white/60">
            Level {level}
            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full" style={{ width: `${levelProgress(c.xp) * 100}%`, background: 'var(--user)' }} />
            </span>
            {c.xp} XP
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/[0.04] px-4 py-3">
            <div className="text-xs text-white/50">{s.label}</div>
            <div className="font-display text-xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
        <div className="mb-1 text-xs text-white/50">MMR over time</div>
        <Sparkline values={c.mmrHistory} />
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
        <span className="flex items-center gap-2.5 text-sm text-white/85">
          <Palette size={16} style={{ color: 'var(--user)' }} /> Your colour
          <span className="text-xs text-white/45">(used all over the ship)</span>
        </span>
        <input
          type="color"
          value={themeColor}
          onChange={(e) => useNova.getState().setThemeColor(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded-lg border-0 bg-transparent"
          aria-label="Pick your colour"
        />
      </label>
      <p className="flex items-start gap-2 text-sm text-white/60">
        <Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--user)' }} />
        Pixel tip: fast, correct answers on later planets earn the most MMR.
      </p>
    </div>
  );
}
