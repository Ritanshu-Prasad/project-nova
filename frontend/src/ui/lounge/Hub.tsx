import { AnimatePresence, motion } from 'framer-motion';
import { ENABLE_PDF_UPLOAD } from '../../core/courseApi';
import { Award, BookOpen, Clock, FileUp, Flame, Lock, Play, Plus, Sparkles, Target, TrendingUp, UserRound, Zap, type LucideIcon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { audio } from '../../core/audio';
import { cycleVisited } from '../../core/tour';
import { PLANETS } from '../../three/space/planets';
import { activeOf, DAILY_GOAL, firstUncleared, levelOf, levelProgress, xpForLevel, passedModules, useActiveCourse, useCourse, useSkill, type ActiveCourse, type OutlineItem } from '../../core/course';
import { CODE_BUFFER, matchCode } from '../../core/finale';
import { flatTopics } from '../../core/courseSchema';
import { openForge, playFinale, relaunch, useHub, useProfile, type ForgeTab, type Station } from '../../core/hub';
import { duration, HUB_QUIZ, openHubQuiz, useCourseQuizzes, useFreshClock, useHubQuiz, useHubQuizScheduler } from '../../core/hubQuiz';
import { LESSON_QUIZ, quizSizeLabel } from '../../core/quizBuilder';
import { rankOf } from '../../core/rank';
import { useDeck } from '../../core/journey';
import { Z } from '../../core/layers';
import { actionFor, keyLabel, useSettings, type Action } from '../../core/settings';
import { useNova } from '../../core/store';
import BackPill from '../common/BackPill';
import Dropdown from '../common/Dropdown';
import { HudButton } from '../common/HudButton';
import PilotAvatar from '../common/PilotAvatar';
import Graduation from './Graduation';
import { HubQuizStation, QuizArrival, QuizPill } from './HubQuiz';
import RankEmblem from './RankEmblem';
import { ProfileSection, SkillJourneySection } from './sections';
import StudyMode from './study/StudyMode';

const todayKey = () => new Date().toISOString().slice(0, 10);

type DockKey = Station | 'new';

/** Which shortcut (Settings → keyboard) opens each dock card. */
const DOCK_ACTION: Record<DockKey, Action> = { hub: 'lesson', lesson: 'lesson', quiz: 'quiz', journey: 'journey', profile: 'profile', new: 'newCourse' };
const ACTION_DOCK: Partial<Record<Action, DockKey>> = { lesson: 'lesson', quiz: 'quiz', journey: 'journey', profile: 'profile', newCourse: 'new' };

/** Go to a station; Lesson resumes at the first unfinished item. */
const choose = (key: DockKey) => {
  audio.play('click');
  if (key === 'new') return openForge();
  const s = useCourse.getState();
  const e = s.activeId ? s.library[s.activeId] : null;
  if ((key === 'lesson' || key === 'quiz') && !e) return openForge();
  if (key === 'quiz' && e) {
    const qs = useHubQuiz.getState().quizzes.filter((q) => q.courseId === e.course.id);
    if (!qs.length) {
      audio.play('denied');
      useNova.getState().notify({ kind: 'toast', title: passedModules(e).length ? 'Next hub quiz is on its way' : 'Complete a module to unlock the hub quiz', ttl: 2.5 });
      return;
    }
    return openHubQuiz();
  }
  if (key === 'lesson' && e) {
    const next = activeOf(e)?.next;
    if (next) s.open(next.id);
  }
  useHub.getState().go(key);
};

/** The lounge as a friendly widget menu; Lesson opens full-window study, Quiz the big hub quiz. */
export default function Hub() {
  const inLounge = useDeck((s) => s.deck === 'lounge');
  const forgeOpen = useNova((s) => s.curriculumOpen);
  const station = useHub((s) => s.station);
  const { pending } = useCourseQuizzes();
  const running = useHubQuiz((s) => !!s.run);
  const active = useActiveCourse();
  const graduation = useCourse((s) => s.graduation);
  const starChartOpen = useNova((s) => s.starChartOpen);
  const visible = inLounge && !forgeOpen;

  useEffect(() => {
    if (!visible) return;
    let typed = '';
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (/^[a-z]$/i.test(e.key)) {
        typed = (typed + e.key.toLowerCase()).slice(-Math.max(CODE_BUFFER, 10));
        if (typed.endsWith('atlas')) {
          typed = '';
          audio.play('pulse');
          useNova.getState().toggleStarChart();
          return;
        }
        const code = matchCode(typed);
        if (code) {
          typed = '';
          audio.play('pulse');
          if (code === 'launch') return relaunch();
          if (code === 'finale') return playFinale();
          if (code === 'planet') {
            const newIdx = cycleVisited();
            if (newIdx === null) {
              useNova.getState().notify({ kind: 'toast', title: 'Only one planet so far', lines: ['Finish a module to open the next planet.'], ttl: 3 });
              return;
            }
            const spec = PLANETS[newIdx];
            useNova.getState().notify({
              kind: 'toast',
              title: `🪐 Orbiting World [${newIdx + 1}/20]: ${spec.name}`,
              lines: [`Biome: ${spec.look.spaceBiome?.toUpperCase() ?? 'SPACE'}`],
              ttl: 3.5,
            });
            return;
          }
          if (code === 'orbit' || code === 'atlas') {
            useNova.getState().toggleStarChart();
            return;
          }
        }
      }
      if (e.key === 'Escape') {
        if (starChartOpen) {
          useNova.getState().setStarChartOpen(false);
          return;
        }
        const st = useHub.getState().station;
        if (st !== 'hub') useHub.getState().go('hub');
      }
      const st = useHub.getState().station;
      if (st === 'hub' && !starChartOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const action = actionFor(e.code);
        const dock = action && ACTION_DOCK[action];
        if (dock) choose(dock);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, starChartOpen]);

  // Hub quizzes form at random moments once a module is complete.
  useHubQuizScheduler();

  return (
    <>
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.landing }}>
        {/* initial={false}: a pilot who comes back to the lounge finds the cards already in place, not sliding in. */}
        <AnimatePresence initial={false}>
          {visible && station === 'hub' && (active ? <Overview key="overview" active={active} /> : <EmptyState key="empty" />)}
          {visible && (station === 'journey' || station === 'profile') && <SectionPanel key={station} station={station} />}
          {visible && active && station === 'quiz' && <HubQuizStation key="hubquiz" />}
        </AnimatePresence>
      </div>
      <AnimatePresence>{visible && active && station === 'lesson' && <StudyMode key="study" />}</AnimatePresence>
      {/* Hub quiz alerts sit above everything aboard, including the study screen. */}
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.notices - 1 }}>
        <AnimatePresence>
          {visible && active && pending && !running && station !== 'quiz' && (pending.seen ? <QuizPill key="pill" q={pending} /> : <QuizArrival key={pending.id} q={pending} />)}
        </AnimatePresence>
      </div>
      <AnimatePresence>{inLounge && graduation && <Graduation key={graduation} />}</AnimatePresence>
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

const itemLabel = (it: OutlineItem) => (it.kind === 'quiz' ? `Module ${it.moduleIndex + 1} quiz` : it.topic.title);

function Overview({ active }: { active: ActiveCourse }) {
  const callsign = useProfile((s) => s.callsign) || 'Pilot';
  const library = useCourse((s) => s.library);
  const stats = useCourse((s) => s.stats);
  const skill = useSkill();
  const { pending, past } = useCourseQuizzes();
  const freshSecs = useFreshClock(pending);
  const unlocked = passedModules(active.entry).length > 0;
  const { topics, cleared, course, outline, next } = active;
  const n = topics.length;
  const pct = Math.round((cleared / n) * 100);
  const ni = next ? outline.indexOf(next) : outline.length;
  const upNext = outline.slice(ni + 1, ni + 3);
  const todayCount = stats.day === todayKey() ? stats.dayQuizzes : 0;
  const nextModule = next ? course.modules[next.moduleIndex] : null;
  const rank = rankOf(skill.mmr);

  const dock: DockItem[] = [
    { key: 'new', hotkey: 5, tier: 3, icon: Plus, title: 'New course', sub: 'Goals' },
    {
      key: 'quiz',
      hotkey: 2,
      tier: 2,
      icon: pending ? Zap : Lock,
      title: pending ? 'Hub quiz ready!' : 'Hub quiz',
      sub: !unlocked
        ? 'Complete a module to unlock'
        : pending
          ? freshSecs
            ? `×${HUB_QUIZ.fresh.regular} for ${duration(freshSecs)}`
            : `Waiting · ×${HUB_QUIZ.late.regular}`
          : past.length
            ? 'Next one arrives soon · retake past'
            : 'Next one arrives soon',
      badge: pending ? `×${freshSecs ? HUB_QUIZ.fresh.regular : HUB_QUIZ.late.regular}` : undefined,
      hot: !!pending,
      locked: !pending && !past.length,
    },
    {
      key: 'lesson',
      hotkey: 1,
      tier: 1,
      icon: BookOpen,
      title: 'Lesson',
      sub: next ? itemLabel(next) : 'Review any topic',
      extra: (
        <span className="block w-full">
          {next && nextModule && (
            <span className="mb-2 hidden truncate text-sm text-white/55 lg:block">
              Module {next.moduleIndex + 1} · {nextModule.title}
            </span>
          )}
          <span className="flex items-center gap-2 text-xs text-white/55">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--user)' }} />
            </span>
            {pct}%
          </span>
        </span>
      ),
    },
    {
      key: 'journey',
      hotkey: 3,
      tier: 2,
      icon: TrendingUp,
      badgeNode: <RankEmblem rank={rank} size={48} />,
      title: 'Skill journey',
      sub: `${rank.label} · ${skill.mmr.toLocaleString('en-IN')} RR`,
      extra: (
        <span className="flex items-center gap-2 text-xs text-white/55">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full" style={{ width: `${rank.progress * 100}%`, background: rank.tier.color }} />
          </span>
          {rank.nextLabel ? `${rank.toNext} to ${rank.nextLabel}` : 'Top rank'}
        </span>
      ),
    },
    { key: 'profile', hotkey: 4, tier: 3, icon: UserRound, title: 'Profile', sub: `LV ${levelOf(stats.xp)} · ${callsign}` },
  ];

  return (
    <>
      {/* Continue learning */}
      <motion.section initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4 }} className="card pointer-events-auto absolute left-4 right-4 top-[72px] p-5 sm:left-6 sm:right-auto sm:top-24 sm:w-[370px]">
        <div className="flex items-center justify-between gap-2">
          <div className="chip-label">Continue learning</div>
          <Dropdown
            label="Switch course"
            value={course.id}
            options={Object.values(library)
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((e) => {
                const total = flatTopics(e.course).length;
                return { value: e.course.id, label: e.course.title, hint: `${Math.round((firstUncleared(e) / Math.max(1, total)) * 100)}% · ${rankOf(e.skill.mmr).label} · ${e.course.modules.length} planet${e.course.modules.length === 1 ? '' : 's'}`, trailing: e.completedAt ? <Award size={14} className="shrink-0 text-amber-300/80" aria-label="Completed" /> : undefined };
              })}
            onChange={(id) => useCourse.getState().setActive(id)}
            action={{ label: 'New course', icon: Plus, onSelect: () => openForge() }}
          />
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
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{!next ? 'Course complete' : next.kind === 'quiz' ? `Checkpoint · planet ${next.moduleIndex + 1} of ${course.modules.length}` : `Next · planet ${next.moduleIndex + 1} of ${course.modules.length}`}</div>
          <div className="mt-1 font-display text-[17px] font-semibold text-white">{next ? itemLabel(next) : 'Every planet cleared — great flying!'}</div>
          {next && (
            <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
              <span className="truncate">{nextModule?.title}</span>
              {next.kind === 'topic' ? (
                <span className="flex shrink-0 items-center gap-1">
                  <Clock size={11} /> {next.topic.lesson.minutes} min
                </span>
              ) : (
                <span className="shrink-0">{quizSizeLabel(next.pool.length, LESSON_QUIZ.min, LESSON_QUIZ.max)} questions</span>
              )}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <HudButton size="sm" variant="primary" className="flex-1" icon={next?.kind === 'quiz' ? <Target size={13} /> : <Play size={13} />} onClick={() => choose(next ? 'lesson' : 'journey')}>
              {!next ? 'Skill journey' : next.kind === 'quiz' ? 'Take lesson quiz' : 'Resume lesson'}
            </HudButton>
          </div>
        </div>

        {upNext.length > 0 && (
          <ul className="mt-3 hidden space-y-1.5 sm:block">
            {upNext.map((it) => (
              <li key={it.id} className="flex items-center gap-2.5 px-1 text-sm text-white/50">
                {it.kind === 'quiz' ? <Target size={12} /> : <Lock size={12} />} <span className="truncate">{itemLabel(it)}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/* Today */}
      <motion.section initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.4, delay: 0.05 }} className="card pointer-events-auto absolute right-6 top-24 hidden w-[300px] p-5 lg:block">
        <div className="chip-label">Today</div>
        <div className="mt-2 flex items-start gap-3">
          <button type="button" onClick={() => choose('profile')} aria-label="Open profile" title="Open profile" className="group cursor-pointer transition hover:scale-105 active:scale-95">
            <PilotAvatar size={38} className="rounded-2xl transition group-hover:ring-2 group-hover:ring-[var(--user)]" />
          </button>
          <h2 className="min-w-0 break-words font-display text-xl font-bold leading-snug text-white">
            {greeting()}, <span style={{ color: 'var(--user)' }}>{callsign}</span>
          </h2>
        </div>
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
            <div className="text-[11px] text-white/50">{rank.label}</div>
            <div className="font-display text-lg font-bold text-white">{skill.mmr.toLocaleString('en-IN')} <span className="text-xs font-normal text-white/50">RR</span></div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-white/55">
          Level {levelOf(stats.xp)}
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full" style={{ width: `${levelProgress(stats.xp) * 100}%`, background: 'var(--user)' }} />
          </span>
          <span className="text-[10px] text-white/40">{stats.xp} / {xpForLevel(levelOf(stats.xp) + 1)} XP</span>
        </div>
        <p className="mt-4 flex gap-2 text-xs leading-relaxed text-white/50">
          <Sparkles size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--user)' }} /> Pixel says: short daily sessions beat one long cram.
        </p>
      </motion.section>

      {/* Dock: Lesson is the hero; Quiz and Journey second tier; Profile and New course at the ends. */}
      <motion.nav
        aria-label="Lounge stations"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="pointer-events-auto absolute bottom-5 left-1/2 grid w-[min(1180px,calc(100vw-32px))] -translate-x-1/2 grid-cols-2 gap-2.5 sm:grid-cols-4 lg:flex lg:items-end lg:gap-3"
      >
        {dock.map((w) => (
          <DockCard key={w.key} item={w} />
        ))}
      </motion.nav>
    </>
  );
}

interface DockItem {
  key: DockKey;
  hotkey: number;
  tier: 1 | 2 | 3;
  icon: LucideIcon;
  title: string;
  sub: string;
  badge?: string;
  /** Replaces the icon tile (e.g. the rank emblem). */
  badgeNode?: ReactNode;
  /** Pulses amber (a hub quiz is waiting). */
  hot?: boolean;
  /** Dimmed with a lock (nothing to open yet). */
  locked?: boolean;
  extra?: ReactNode;
}

const TIER = {
  1: 'order-first col-span-2 sm:col-span-4 lg:order-none lg:min-h-[clamp(190px,26vh,290px)] lg:flex-[1.75] lg:p-6',
  2: 'lg:min-h-[clamp(140px,18.5vh,205px)] lg:flex-[1.2] lg:p-5',
  3: 'lg:min-h-[clamp(108px,13.5vh,150px)] lg:flex-[0.95] lg:p-4',
} as const;

function DockCard({ item: w }: { item: DockItem }) {
  const keys = useSettings((s) => s.keys);
  const hero = w.tier === 1;
  return (
    <motion.button
      type="button"
      onClick={() => choose(w.key)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && audio.play('hover')}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      className={`card group relative flex min-w-0 cursor-pointer flex-wrap items-center gap-3 px-4 py-3.5 text-left transition-[border-color,box-shadow] hover:border-[var(--user)] hover:shadow-[0_0_40px_-10px_rgb(var(--user-rgb)/0.8)] lg:flex-col lg:flex-nowrap lg:items-start lg:justify-between ${TIER[w.tier]}`}
      aria-disabled={w.locked || undefined}
      style={hero ? { background: 'linear-gradient(160deg, rgb(var(--user-rgb) / 0.22), rgb(13 18 32 / 0.82) 60%)' } : w.locked ? { opacity: 0.6, filter: 'saturate(0.4)' } : w.hot ? { borderColor: 'rgb(252 211 77 / 0.7)', boxShadow: '0 0 40px -8px rgb(252 211 77 / 0.6)' } : undefined}
    >
      {w.hot && <span className="pointer-events-none absolute inset-0 animate-pulse rounded-[inherit] bg-amber-300/[0.07]" />}
      <span className="flex items-center justify-between lg:w-full">
        {w.badgeNode ?? (
          <span
            className={`grid shrink-0 place-items-center rounded-2xl transition-colors group-hover:text-[var(--user-ink)] group-hover:[background:var(--user)] ${hero ? 'size-11 lg:size-14' : w.tier === 2 ? 'size-10 lg:size-12' : 'size-10'}`}
            style={{ background: 'rgb(var(--user-rgb) / 0.16)', color: 'var(--user)' }}
          >
            <w.icon size={hero ? 24 : 20} />
          </span>
        )}
        <span className="hidden items-center gap-1.5 lg:flex">
          {w.badge && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${w.hot ? 'bg-amber-300 text-[#1a1203]' : 'bg-white/10 text-white/60'}`}>{w.badge}</span>}
          <kbd className="rounded bg-white/10 px-1.5 font-mono text-[11px] text-white/50">{keyLabel(keys[DOCK_ACTION[w.key]])}</kbd>
        </span>
      </span>
      <span className="min-w-0 flex-1 lg:w-full lg:flex-none">
        <span className={`block truncate font-display font-semibold text-white ${hero ? 'text-lg lg:text-3xl' : w.tier === 2 ? 'text-[15px] lg:text-xl' : 'text-[15px] lg:text-base'}`}>{w.title}</span>
        <span className={`block truncate text-white/60 ${hero ? 'text-sm lg:text-base' : 'text-xs lg:text-sm'}`}>{w.sub}</span>
      </span>
      {w.extra && <span className={`w-full ${hero ? 'block' : 'hidden lg:block'}`}>{w.extra}</span>}
    </motion.button>
  );
}

function EmptyState() {
  const callsign = useProfile((s) => s.callsign) || 'Pilot';
  const tiles: { tab: ForgeTab; icon: LucideIcon; title: string; sub: string }[] = [
    { tab: 'goal', icon: Sparkles, title: 'Describe a goal or select a preset', sub: '“Teach me linear algebra”, “React patterns”…' },
    ...(ENABLE_PDF_UPLOAD ? [{ tab: 'docs' as const, icon: FileUp, title: 'Upload notes or a book', sub: 'One or more PDFs — class notes, textbooks' }] : []),
  ];
  return (
    <motion.section initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} className="card pointer-events-auto absolute left-1/2 top-1/2 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 p-7 text-center sm:p-9">
      <div className="chip-label justify-center">Cosmic Lounge · Deck 7</div>
      <h1 className="mt-2 font-display text-3xl font-bold text-white">
        Hi {callsign}, what do you want to learn today?
      </h1>
      <p className="mt-2 text-white/60">Pick how to start — NOVA turns it into a course of planetary modules.</p>
      <div className={`mt-7 grid gap-3 ${tiles.length === 1 ? 'max-w-md mx-auto' : 'sm:grid-cols-2'}`}>
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

const TITLES = { journey: 'Skill journey', profile: 'Pixel’s corner' } as const;

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
      className={`card pointer-events-auto absolute flex flex-col overflow-hidden ${wide ? 'bottom-5 left-1/2 top-20 w-[min(1080px,calc(100vw-32px))] -translate-x-1/2' : 'bottom-3 right-3 max-h-[80vh] w-[calc(100vw-24px)] sm:bottom-6 sm:right-6 sm:top-20 sm:max-h-none sm:w-[460px]'}`}
    >
      {/* The header is outside the scrolling part, so Back is always in reach. */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0b1020]/60 px-5 py-3 sm:px-6">
        <BackPill label="Back to lounge" onClick={() => useHub.getState().go('hub')} />
        <span className="hud-label truncate">{TITLES[station]}</span>
      </header>
      <div className="scroll-y min-h-0 flex-1 p-5 sm:p-6">{station === 'journey' ? <SkillJourneySection /> : <ProfileSection />}</div>
    </motion.section>
  );
}
