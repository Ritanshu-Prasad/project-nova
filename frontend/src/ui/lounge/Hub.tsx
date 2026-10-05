import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, ChevronDown, Clock, FileUp, Flame, Lock, Map, Play, Plus, Sparkles, Target, UserRound, type LucideIcon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { audio } from '../../core/audio';
import { DAILY_GOAL, levelOf, levelProgress, useActiveCourse, useCourse, type ActiveCourse } from '../../core/course';
import { openForge, useHub, useProfile, type ForgeTab, type Station } from '../../core/hub';
import { useDeck } from '../../core/journey';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';
import { JourneySection, ProfileSection } from './sections';
import StudyMode from './study/StudyMode';

type DockKey = Station | 'new';

/** Go to a station; Lesson/Quiz always start at the rocket's planet. */
const choose = (key: DockKey) => {
  audio.play('click');
  if (key === 'new') return openForge();
  if (key === 'lesson' || key === 'quiz') {
    const s = useCourse.getState();
    const e = s.activeId ? s.library[s.activeId] : null;
    if (!e) return openForge();
  }
  useHub.getState().go(key);
};

/** The lounge as a friendly widget menu; Lesson/Quiz open a full-window study mode. */
export default function Hub() {
  const inLounge = useDeck((s) => s.deck === 'lounge');
  const forgeOpen = useNova((s) => s.curriculumOpen);
  const station = useHub((s) => s.station);
  const active = useActiveCourse();
  const visible = inLounge && !forgeOpen;

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const st = useHub.getState().station;
      if (e.key === 'Escape' && st !== 'hub') useHub.getState().go('hub');
      if (st === 'hub') {
        const keys: DockKey[] = ['lesson', 'quiz', 'journey', 'profile', 'new'];
        const i = Number(e.key) - 1;
        if (i >= 0 && i < keys.length) choose(keys[i]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  return (
    <>
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.landing }}>
        <AnimatePresence>
          {visible && station === 'hub' && (active ? <Overview key="overview" active={active} /> : <EmptyState key="empty" />)}
          {visible && (station === 'journey' || station === 'profile') && <SectionPanel key={station} station={station} />}
        </AnimatePresence>
      </div>
      <AnimatePresence>{visible && active && (station === 'lesson' || station === 'quiz') && <StudyMode key="study" mode={station} />}</AnimatePresence>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late-night flight' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Ring({ value, size = 64, children }: { value: number; size?: number; children?: ReactNode }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--user)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      {children}
    </div>
  );
}

const SOURCE_LABEL = { template: 'NOVA course', starter: 'Starter plan', documents: 'From your PDFs', ai: 'AI-generated' } as const;

function Overview({ active }: { active: ActiveCourse }) {
  const callsign = useProfile((s) => s.callsign) || 'Pilot';
  const library = useCourse((s) => s.library);
  const stats = useCourse((s) => s.stats);
  const { topics, cleared, course } = active;
  const n = topics.length;
  const done = cleared >= n;
  const next = topics[Math.min(cleared, n - 1)];
  const upNext = topics.slice(cleared + 1, cleared + 3);
  const todayCount = stats.day === new Date().toISOString().slice(0, 10) ? stats.dayQuizzes : 0;

  const resume = (mode: 'lesson' | 'quiz') => {
    useCourse.getState().openTopic(next.id);
    choose(mode);
  };

  const dock: { key: DockKey; icon: LucideIcon; title: string; sub: string }[] = [
    { key: 'lesson', icon: BookOpen, title: 'Lesson', sub: done ? 'Review any topic' : next.title },
    { key: 'quiz', icon: Target, title: 'Quiz', sub: done ? 'All planets cleared' : `${next.quiz.length} questions · earn MMR` },
    { key: 'journey', icon: Map, title: 'Journey map', sub: `${cleared} of ${n} planets cleared` },
    { key: 'profile', icon: UserRound, title: 'Profile', sub: `LV ${levelOf(stats.xp)} · ${stats.mmr.toLocaleString('en-IN')} MMR` },
    { key: 'new', icon: Plus, title: 'New course', sub: 'Goal or PDFs' },
  ];

  return (
    <>
      {/* Continue learning */}
      <motion.section initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4 }} className="card pointer-events-auto absolute left-4 right-4 top-[72px] p-5 sm:left-6 sm:right-auto sm:top-24 sm:w-[370px]">
        <div className="flex items-center justify-between gap-2">
          <div className="chip-label">Continue learning</div>
          <label className="relative">
            <span className="sr-only">Switch course</span>
            <select
              value={course.id}
              onChange={(e) => (e.target.value === '__new' ? openForge() : useCourse.getState().setActive(e.target.value))}
              className="max-w-[170px] cursor-pointer appearance-none truncate rounded-full border border-white/10 bg-white/[0.05] py-1 pl-3 pr-7 text-xs text-white/75"
            >
              {Object.values(library)
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((e) => (
                  <option key={e.course.id} value={e.course.id} className="bg-[#0d1220]">
                    {e.course.title}
                  </option>
                ))}
              <option value="__new" className="bg-[#0d1220]">
                + New course…
              </option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/50" />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Ring value={cleared / n} size={68}>
            <span className="font-display text-sm font-bold text-white">{Math.round((cleared / n) * 100)}%</span>
          </Ring>
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-bold text-white">{course.title}</h2>
            <div className="truncate text-xs text-white/55">{course.subtitle || SOURCE_LABEL[course.source]}</div>
            <span className="mt-1.5 inline-block rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">{SOURCE_LABEL[course.source]}</span>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white/[0.04] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{done ? 'Course complete' : `Next · planet ${next.index + 1} of ${n}`}</div>
          <div className="mt-1 font-display text-[17px] font-semibold text-white">{done ? 'Every planet cleared — great flying!' : next.title}</div>
          {!done && (
            <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
              <span>{next.moduleTitle}</span>
              <span className="flex items-center gap-1">
                <Clock size={11} /> {next.lesson.minutes} min
              </span>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <HudButton size="sm" variant="primary" className="flex-1" icon={<Play size={13} />} onClick={() => (done ? choose('journey') : resume('lesson'))}>
              {done ? 'Journey map' : 'Resume lesson'}
            </HudButton>
            {!done && (
              <HudButton size="sm" icon={<Target size={13} />} onClick={() => resume('quiz')}>
                Quiz
              </HudButton>
            )}
          </div>
        </div>

        {upNext.length > 0 && (
          <ul className="mt-3 hidden space-y-1.5 sm:block">
            {upNext.map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 px-1 text-sm text-white/50">
                <Lock size={12} /> <span className="truncate">{t.title}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/* Today */}
      <motion.section initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.4, delay: 0.05 }} className="card pointer-events-auto absolute right-6 top-24 hidden w-[300px] p-5 lg:block">
        <div className="chip-label">Today</div>
        <h2 className="mt-1 font-display text-xl font-bold text-white">
          {greeting()}, <span style={{ color: 'var(--user)' }}>{callsign}</span>
        </h2>
        <div className="mt-4 flex items-center gap-4">
          <Ring value={todayCount / DAILY_GOAL}>
            <span className="text-center font-display text-sm font-bold leading-none text-white">
              {Math.min(todayCount, DAILY_GOAL)}/{DAILY_GOAL}
            </span>
          </Ring>
          <div className="text-sm text-white/70">
            <div className="font-semibold text-white">Daily goal</div>
            {todayCount >= DAILY_GOAL ? 'Done for today — nice!' : `${DAILY_GOAL - todayCount} more quiz${DAILY_GOAL - todayCount === 1 ? '' : 'zes'} today`}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/[0.04] px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-white/50">
              <Flame size={11} className="text-amber-300" /> Streak
            </div>
            <div className="font-display text-lg font-bold text-white">{stats.streak}</div>
          </div>
          <div className="rounded-xl bg-white/[0.04] px-3 py-2">
            <div className="text-[11px] text-white/50">MMR</div>
            <div className="font-display text-lg font-bold text-white">{stats.mmr.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-white/55">
          Level {levelOf(stats.xp)}
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full" style={{ width: `${levelProgress(stats.xp) * 100}%`, background: 'var(--user)' }} />
          </span>
        </div>
        <p className="mt-4 flex gap-2 text-xs leading-relaxed text-white/50">
          <Sparkles size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--user)' }} /> Pixel says: short daily sessions beat one long cram.
        </p>
      </motion.section>

      {/* Dock */}
      <motion.nav aria-label="Lounge stations" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.4, delay: 0.08 }} className="pointer-events-auto absolute bottom-5 left-1/2 grid w-[min(1000px,calc(100vw-32px))] -translate-x-1/2 grid-cols-2 gap-2.5 sm:grid-cols-5">
        {dock.map((w, i) => (
          <motion.button
            key={w.key}
            type="button"
            onClick={() => choose(w.key)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && audio.play('hover')}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.97 }}
            className={`card group flex cursor-pointer items-center gap-3 px-4 py-3.5 text-left transition-[border-color,box-shadow] hover:border-[var(--user)] hover:shadow-[0_0_40px_-10px_rgb(var(--user-rgb)/0.8)] ${w.key === 'new' ? 'col-span-2 sm:col-span-1' : ''}`}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl transition-colors group-hover:text-[var(--user-ink)] group-hover:[background:var(--user)]" style={{ background: 'rgb(var(--user-rgb) / 0.16)', color: 'var(--user)' }}>
              <w.icon size={19} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 whitespace-nowrap font-display text-[15px] font-semibold text-white">
                {w.title}
                <kbd className="hidden rounded bg-white/10 px-1.5 font-mono text-[10px] text-white/50 sm:inline">{i + 1}</kbd>
              </span>
              <span className="block truncate text-xs text-white/55">{w.sub}</span>
            </span>
          </motion.button>
        ))}
      </motion.nav>
    </>
  );
}

function EmptyState() {
  const callsign = useProfile((s) => s.callsign) || 'Pilot';
  const tiles: { tab: ForgeTab; icon: LucideIcon; title: string; sub: string }[] = [
    { tab: 'goal', icon: Sparkles, title: 'Describe a goal', sub: '“Teach me linear algebra”, “React patterns”…' },
    { tab: 'docs', icon: FileUp, title: 'Upload notes or a book', sub: 'One or more PDFs — class notes, textbooks' },
  ];
  return (
    <motion.section initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} className="card pointer-events-auto absolute left-1/2 top-1/2 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 p-7 text-center sm:p-9">
      <div className="chip-label justify-center">Cosmic Lounge · Deck 7</div>
      <h1 className="mt-2 font-display text-3xl font-bold text-white">
        Hi {callsign}, what do you want to learn today?
      </h1>
      <p className="mt-2 text-white/60">Pick how to start — NOVA turns it into a course of bite-sized planets.</p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <button key={t.tab} type="button" onClick={() => (audio.play('click'), openForge(t.tab))} className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left transition hover:-translate-y-1 hover:border-[var(--user)] hover:bg-white/[0.07]">
            <span className="grid size-11 place-items-center rounded-2xl transition-colors group-hover:text-[var(--user-ink)] group-hover:[background:var(--user)]" style={{ background: 'rgb(var(--user-rgb) / 0.16)', color: 'var(--user)' }}>
              <t.icon size={20} />
            </span>
            <div className="mt-3 font-display text-lg font-semibold text-white">{t.title}</div>
            <div className="mt-0.5 text-sm text-white/55">{t.sub}</div>
          </button>
        ))}
      </div>
    </motion.section>
  );
}

const TITLES = { journey: 'Observation window', profile: 'Pixel’s corner' } as const;

function SectionPanel({ station }: { station: 'journey' | 'profile' }) {
  const wide = station === 'journey';
  return (
    <motion.section
      role="region"
      aria-label={TITLES[station]}
      initial={wide ? { opacity: 0, y: 40 } : { opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={wide ? { opacity: 0, y: 30 } : { opacity: 0, x: 30 }}
      transition={{ duration: 0.45, delay: 0.35, ease: [0.2, 0.8, 0.25, 1] }}
      className={`card scroll-y pointer-events-auto absolute ${wide ? 'bottom-5 left-1/2 max-h-[64vh] w-[min(980px,calc(100vw-32px))] -translate-x-1/2' : 'bottom-3 right-3 max-h-[80vh] w-[calc(100vw-24px)] sm:bottom-6 sm:right-6 sm:top-20 sm:max-h-none sm:w-[460px]'} p-5 sm:p-6`}
    >
      <button type="button" onClick={() => (audio.play('click'), useHub.getState().go('hub'))} className="mb-4 flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.12] hover:text-white">
        <ArrowLeft size={13} /> Back to lounge <kbd className="ml-1 hidden font-mono text-[10px] text-white/40 sm:inline">Esc</kbd>
      </button>
      {station === 'journey' ? <JourneySection /> : <ProfileSection />}
    </motion.section>
  );
}
