import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Map, Plus, Target, UserRound, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { audio } from '../../core/audio';
import { findCourse, levelOf, useCourse } from '../../core/course';
import { useHub, useProfile, type Station } from '../../core/hub';
import { useDeck } from '../../core/journey';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';
import RocketProgress from './RocketProgress';
import { JourneySection, LessonSection, ProfileSection, QuizSection } from './sections';

interface Widget {
  key: Station | 'new';
  icon: LucideIcon;
  title: string;
  sub: string;
}

const openForge = () => {
  useHub.getState().go('hub');
  useNova.getState().setCurriculumOpen(true);
};

const choose = (key: Widget['key']) => {
  audio.play('click');
  if (key === 'new') openForge();
  else useHub.getState().go(key);
};

/** The lounge as a widget menu: pick a station, the camera walks over, a clear panel opens. */
export default function Hub() {
  const inLounge = useDeck((s) => s.deck === 'lounge');
  const forgeOpen = useNova((s) => s.curriculumOpen);
  const station = useHub((s) => s.station);
  const visible = inLounge && !forgeOpen;

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === 'Escape' && useHub.getState().station !== 'hub') useHub.getState().go('hub');
      if (useHub.getState().station === 'hub') {
        const i = Number(e.key) - 1;
        const keys: Widget['key'][] = ['lesson', 'quiz', 'journey', 'profile', 'new'];
        if (i >= 0 && i < keys.length) choose(keys[i]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.landing }}>
      <AnimatePresence>
        {visible && station === 'hub' && <Overview key="overview" />}
        {visible && station !== 'hub' && <SectionPanel key={station} station={station} />}
      </AnimatePresence>
    </div>
  );
}

function Overview() {
  const callsign = useProfile((s) => s.callsign) || 'Pilot';
  const objective = useCourse((s) => s.objective);
  const courseId = useCourse((s) => s.courseId);
  const current = useCourse((s) => s.current);
  const cleared = useCourse((s) => s.cleared);
  const xp = useCourse((s) => s.xp);
  const mmr = useCourse((s) => s.mmr);
  const course = findCourse(courseId);
  const n = course.subtopics.length;
  const sub = course.subtopics[current];

  const widgets: Widget[] = [
    { key: 'lesson', icon: BookOpen, title: 'Lesson', sub: sub.title },
    { key: 'quiz', icon: Target, title: 'Quiz', sub: cleared >= n ? 'All clear!' : `${sub.quiz.length} questions · earn MMR` },
    { key: 'journey', icon: Map, title: 'Journey map', sub: `Planet ${Math.min(cleared + 1, n)} of ${n}` },
    { key: 'profile', icon: UserRound, title: 'Profile', sub: `LV ${levelOf(xp)} · ${mmr.toLocaleString('en-IN')} MMR` },
    { key: 'new', icon: Plus, title: 'New course', sub: 'Learn something else' },
  ];

  return (
    <>
      {/* Greeting + course card */}
      <motion.section
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.4 }}
        className="card pointer-events-auto absolute left-1/2 top-20 w-[min(720px,calc(100vw-32px))] -translate-x-1/2 px-5 pb-3 pt-4 sm:px-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="chip-label">Cosmic Lounge · Deck 7</div>
            <h1 className="mt-0.5 truncate font-display text-xl font-bold text-white sm:text-2xl">
              Welcome back, <span style={{ color: 'var(--user)' }}>{callsign}</span>
            </h1>
            <p className="truncate text-sm text-white/60">{objective ? course.title : 'No course yet — pick something to learn.'}</p>
          </div>
          {objective ? (
            <HudButton variant="primary" size="sm" onClick={() => choose(cleared >= n ? 'journey' : 'lesson')}>
              {cleared >= n ? 'View journey' : 'Continue'}
            </HudButton>
          ) : (
            <HudButton variant="primary" size="sm" onClick={openForge}>
              Start a course
            </HudButton>
          )}
        </div>
        {objective && (
          <div className="mt-3">
            <RocketProgress compact onSelect={(i) => (useCourse.getState().goTo(i), choose('lesson'))} />
          </div>
        )}
      </motion.section>

      {/* Widget dock */}
      <motion.nav
        aria-label="Lounge stations"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="pointer-events-auto absolute bottom-5 left-1/2 grid w-[min(980px,calc(100vw-32px))] -translate-x-1/2 grid-cols-2 gap-2.5 sm:grid-cols-5"
      >
        {widgets.map((w, i) => (
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

const TITLES: Record<Exclude<Station, 'hub'>, string> = {
  lesson: 'Holo-table',
  quiz: 'Quiz console',
  journey: 'Observation window',
  profile: 'Pixel’s corner',
};

function SectionPanel({ station }: { station: Exclude<Station, 'hub'> }) {
  const wide = station === 'journey';
  return (
    <motion.section
      role="region"
      aria-label={TITLES[station]}
      initial={wide ? { opacity: 0, y: 40 } : { opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={wide ? { opacity: 0, y: 30 } : { opacity: 0, x: 30 }}
      transition={{ duration: 0.45, delay: 0.35, ease: [0.2, 0.8, 0.25, 1] }}
      className={`card scroll-y pointer-events-auto absolute ${
        wide
          ? 'bottom-5 left-1/2 max-h-[60vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2'
          : 'bottom-3 right-3 top-auto max-h-[78vh] w-[calc(100vw-24px)] sm:bottom-6 sm:right-6 sm:top-20 sm:max-h-none sm:w-[440px]'
      } p-5 sm:p-6`}
    >
      <button
        type="button"
        onClick={() => {
          audio.play('click');
          useHub.getState().go('hub');
        }}
        className="mb-4 flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.12] hover:text-white"
      >
        <ArrowLeft size={13} /> Back to lounge <kbd className="ml-1 hidden font-mono text-[10px] text-white/40 sm:inline">Esc</kbd>
      </button>
      {station === 'lesson' && <LessonSection />}
      {station === 'quiz' && <QuizSection />}
      {station === 'journey' && <JourneySection />}
      {station === 'profile' && <ProfileSection />}
    </motion.section>
  );
}
