import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, ChevronDown, Clock, FileUp, Flame, Lock, Play, Plus, Sparkles, Target, TrendingUp, UserRound, Zap, type LucideIcon } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { audio } from '../../core/audio';
import { activeOf, DAILY_GOAL, levelOf, levelProgress, popPool, useActiveCourse, useCourse, useSkill, type ActiveCourse, type OutlineItem } from '../../core/course';
import { openForge, relaunch, useHub, useProfile, type ForgeTab, type Station } from '../../core/hub';
import { POP, takePopQuiz, useBonusClock, usePop } from '../../core/popquiz';
import { quizSizeLabel } from '../../core/quizBuilder';
import { rankOf } from '../../core/rank';
import { useDeck } from '../../core/journey';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';
import { PopArrival, PopPill, PopQuiz } from './PopQuiz';
import RankEmblem from './RankEmblem';
import { ProfileSection, SkillJourneySection } from './sections';
import StudyMode from './study/StudyMode';

type DockKey = Station | 'new';

/** Go to a station; Lesson resumes at the first unfinished item. */
const choose = (key: DockKey) => {
  audio.play('click');
  if (key === 'new') return openForge();
  const s = useCourse.getState();
  const e = s.activeId ? s.library[s.activeId] : null;
  if ((key === 'lesson' || key === 'quiz') && !e) return openForge();
  if (key === 'quiz') return takePopQuiz();
  if (key === 'lesson' && e) {
    const next = activeOf(e)?.next;
    if (next) s.open(next.id);
  }
  useHub.getState().go(key);
};

/** The lounge as a friendly widget menu; Lesson opens full-window study, Quiz the timed pop quiz. */
export default function Hub() {
  const inLounge = useDeck((s) => s.deck === 'lounge');
  const forgeOpen = useNova((s) => s.curriculumOpen);
  const station = useHub((s) => s.station);
  const offer = usePop((s) => s.offer);
  const running = usePop((s) => !!s.run);
  const active = useActiveCourse();
  const visible = inLounge && !forgeOpen;

  useEffect(() => {
    if (!visible) return;
    let typed = '';
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (/^[a-z]$/i.test(e.key)) {
        typed = (typed + e.key.toLowerCase()).slice(-6);
        if (typed === 'launch') {
          typed = '';
          audio.play('pulse');
          return relaunch();
        }
      }
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

  // Surprise pop quizzes arrive at random moments aboard — in the lounge or mid-lesson, never during a quiz.
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = usePop.getState();
      if (p.offer || p.run || Date.now() < p.nextAt) return;
      if (useDeck.getState().deck !== 'lounge' || useNova.getState().curriculumOpen) return;
      const st = useHub.getState().station;
      const c = useCourse.getState();
      const e = c.activeId ? c.library[c.activeId] : undefined;
      if (!e || st === 'quiz' || (st === 'lesson' && activeOf(e)?.item.kind === 'quiz')) return;
      if (popPool(e).length) p.arrive(e.course.id);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.landing }}>
        <AnimatePresence>
          {visible && station === 'hub' && (active ? <Overview key="overview" active={active} /> : <EmptyState key="empty" />)}
          {visible && (station === 'journey' || station === 'profile') && <SectionPanel key={station} station={station} />}
          {visible && active && station === 'quiz' && <PopQuiz key="pop" />}
        </AnimatePresence>
      </div>
      <AnimatePresence>{visible && active && station === 'lesson' && <StudyMode key="study" />}</AnimatePresence>
      {/* Pop quiz alerts sit above everything aboard, including the study screen. */}
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.notices - 1 }}>
        <AnimatePresence>
          {visible && active && offer && !running && station !== 'quiz' && (offer.seen ? <PopPill key="pill" /> : <PopArrival key="arrival" />)}
        </AnimatePresence>
      </div>
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
  const offer = usePop((s) => s.offer);
  const bonusSecs = useBonusClock(offer);
  const { topics, cleared, course, outline, next } = active;
  const n = topics.length;
  const pct = Math.round((cleared / n) * 100);
  const ni = next ? outline.indexOf(next) : outline.length;
  const upNext = outline.slice(ni + 1, ni + 3);
  const todayCount = stats.day === new Date().toISOString().slice(0, 10) ? stats.dayQuizzes : 0;
  const popReady = popPool(active.entry).length > 0;
  const nextModule = next ? course.modules[next.moduleIndex] : null;
  const rank = rankOf(skill.mmr);

  const dock: DockItem[] = [
    { key: 'new', hotkey: 5, tier: 3, icon: Plus, title: 'New course', sub: 'Goal or PDFs' },
    {
      key: 'quiz',
      hotkey: 2,
      tier: 2,
      icon: Zap,
      title: offer ? 'Pop quiz ready!' : 'Pop quiz',
      sub: !popReady ? 'Opens with your first lesson' : offer ? (bonusSecs ? `Bonus ends in ${Math.floor(bonusSecs / 60)}:${String(bonusSecs % 60).padStart(2, '0')}` : 'Waiting · bonus ended') : 'Practice · surprises arrive anytime',
      badge: offer && bonusSecs ? `×${POP.bonus}` : '×1',
      hot: !!offer && bonusSecs > 0,
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
      sub: `${rank.label} · ${skill.mmr.toLocaleString('en-IN')} MMR`,
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
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{!next ? 'Course complete' : next.kind === 'quiz' ? 'Checkpoint' : `Next · planet ${next.topic.index + 1} of ${n}`}</div>
          <div className="mt-1 font-display text-[17px] font-semibold text-white">{next ? itemLabel(next) : 'Every planet cleared — great flying!'}</div>
          {next && (
            <div className="mt-1 flex items-center gap-3 text-xs text-white/50">
              <span className="truncate">{nextModule?.title}</span>
              {next.kind === 'topic' ? (
                <span className="flex shrink-0 items-center gap-1">
                  <Clock size={11} /> {next.topic.lesson.minutes} min
                </span>
              ) : (
                <span className="shrink-0">{quizSizeLabel(next.pool.length)} questions</span>
              )}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <HudButton size="sm" variant="primary" className="flex-1" icon={next?.kind === 'quiz' ? <Target size={13} /> : <Play size={13} />} onClick={() => choose(next ? 'lesson' : 'journey')}>
              {!next ? 'Skill journey' : next.kind === 'quiz' ? 'Take module quiz' : 'Resume lesson'}
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
            <div className="text-[11px] text-white/50">{rank.label}</div>
            <div className="font-display text-lg font-bold text-white">{skill.mmr.toLocaleString('en-IN')} <span className="text-xs font-normal text-white/50">MMR</span></div>
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
  /** Pulses amber (a pop quiz with a live bonus). */
  hot?: boolean;
  extra?: ReactNode;
}

const TIER = {
  1: 'order-first col-span-2 sm:col-span-4 lg:order-none lg:min-h-[clamp(190px,26vh,290px)] lg:flex-[1.75] lg:p-6',
  2: 'lg:min-h-[clamp(140px,18.5vh,205px)] lg:flex-[1.2] lg:p-5',
  3: 'lg:min-h-[clamp(108px,13.5vh,150px)] lg:flex-[0.95] lg:p-4',
} as const;

function DockCard({ item: w }: { item: DockItem }) {
  const hero = w.tier === 1;
  return (
    <motion.button
      type="button"
      onClick={() => choose(w.key)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && audio.play('hover')}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      className={`card group relative flex min-w-0 cursor-pointer flex-wrap items-center gap-3 px-4 py-3.5 text-left transition-[border-color,box-shadow] hover:border-[var(--user)] hover:shadow-[0_0_40px_-10px_rgb(var(--user-rgb)/0.8)] lg:flex-col lg:flex-nowrap lg:items-start lg:justify-between ${TIER[w.tier]}`}
      style={hero ? { background: 'linear-gradient(160deg, rgb(var(--user-rgb) / 0.22), rgb(13 18 32 / 0.82) 60%)' } : w.hot ? { borderColor: 'rgb(252 211 77 / 0.7)', boxShadow: '0 0 40px -8px rgb(252 211 77 / 0.6)' } : undefined}
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
          <kbd className="rounded bg-white/10 px-1.5 font-mono text-[11px] text-white/50">{w.hotkey}</kbd>
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
      className={`card scroll-y pointer-events-auto absolute ${wide ? 'bottom-5 left-1/2 top-20 w-[min(1080px,calc(100vw-32px))] -translate-x-1/2' : 'bottom-3 right-3 max-h-[80vh] w-[calc(100vw-24px)] sm:bottom-6 sm:right-6 sm:top-20 sm:max-h-none sm:w-[460px]'} p-5 sm:p-6`}
    >
      <button type="button" onClick={() => (audio.play('click'), useHub.getState().go('hub'))} className="mb-4 flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.12] hover:text-white">
        <ArrowLeft size={13} /> Back to lounge <kbd className="ml-1 hidden font-mono text-[10px] text-white/40 sm:inline">Esc</kbd>
      </button>
      {station === 'journey' ? <SkillJourneySection /> : <ProfileSection />}
    </motion.section>
  );
}
