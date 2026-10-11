import { motion } from 'framer-motion';
import { Award, Download, FileText, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { audio } from '../../core/audio';
import { useCourse } from '../../core/course';
import { certificateFilename, certificatePng, download, graduationFacts, notesFilename, studyNotesMarkdown } from '../../core/graduation';
import { openForge, useProfile } from '../../core/hub';
import { useHubQuiz } from '../../core/hubQuiz';
import { Z } from '../../core/layers';
import { rankOf } from '../../core/rank';
import { useNova } from '../../core/store';
import NovaMark from '../hud/NovaMark';
import PilotAvatar from '../common/PilotAvatar';
import RankEmblem from './RankEmblem';

/** Little bits of light falling behind the certificate. */
const CONFETTI = Array.from({ length: 36 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 9) * 0.35, dur: 3.2 + (i % 5) * 0.6, hue: [190, 270, 330, 45, 150][i % 5] }));

/**
 * The graduation screen: opens by itself the first time a course is finished (and from Profile afterwards).
 * Certificate with the final rank, MMR and stats, plus downloads for the certificate and the pilot's study notes.
 */
export default function Graduation() {
  const courseId = useCourse((s) => s.graduation);
  const entry = useCourse((s) => (courseId ? s.library[courseId] : undefined));
  const pilot = useProfile((s) => s.callsign);
  const accent = useNova((s) => s.themeColor);
  const hubQuizzes = useHubQuiz((s) => s.quizzes.filter((q) => q.courseId === courseId && q.result).length);
  const [busy, setBusy] = useState(false);
  const facts = useMemo(() => (entry ? graduationFacts(entry, pilot, hubQuizzes) : null), [entry, pilot, hubQuizzes]);
  const close = () => useCourse.getState().showGraduation(null);

  useEffect(() => {
    if (!courseId) return;
    audio.play('quest');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), close());
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [courseId]);

  if (!entry || !facts) return null;
  const rank = rankOf(entry.skill.mmr);

  const saveCertificate = async () => {
    setBusy(true);
    try {
      download(certificateFilename(facts), await certificatePng(facts, accent));
    } catch {
      useNova.getState().notify({ kind: 'warning', title: 'Certificate not saved', lines: ['Your browser could not draw the image — try again.'] });
    } finally {
      setBusy(false);
    }
  };
  const saveNotes = () => download(notesFilename(facts), new Blob([studyNotesMarkdown(entry, facts)], { type: 'text/markdown;charset=utf-8' }));

  return (
    <motion.div
      className="fixed inset-0 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-[4px]"
      style={{ zIndex: Z.notices - 2 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.9, duration: 0.5 } }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="grad-title"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <span key={i} className="nova-confetti absolute top-[-4%] h-3 w-1.5 rounded-sm" style={{ left: `${c.left}%`, background: `hsl(${c.hue} 90% 65%)`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }} />
        ))}
      </div>

      <motion.div className="relative w-full max-w-2xl" initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1, transition: { delay: 1, type: 'spring', stiffness: 200, damping: 24 } }}>
        <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 cursor-pointer rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
          <X size={18} />
        </button>

        <div className="relative overflow-hidden rounded-3xl border-2 bg-gradient-to-br from-[#070b16] to-[#0f1a33] px-6 py-8 text-center shadow-2xl sm:px-10" style={{ borderColor: accent, boxShadow: `0 0 60px ${accent}40` }}>
          <div className="flex items-center justify-center gap-2 font-display text-sm tracking-[0.4em] text-cyan-200">
            <NovaMark className="h-5 w-5" /> NOVA
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">
            <Award size={14} /> Course complete
          </div>
          <h2 id="grad-title" className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
            Certificate of Completion
          </h2>
          <div className="mt-6 flex flex-col items-center gap-3">
            <PilotAvatar size={72} />
            <p className="text-sm text-white/65">This certifies that</p>
            <p className="font-display text-3xl font-bold sm:text-4xl" style={{ color: accent }}>
              {facts.pilot}
            </p>
            <p className="text-sm text-white/65">has completed every planet and module quiz of</p>
            <p className="font-display text-2xl font-bold text-white">{facts.course}</p>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="flex flex-col items-center rounded-2xl bg-white/[0.05] px-3 py-3">
              <RankEmblem rank={rank} size={34} />
              <div className="mt-1 text-[11px] uppercase tracking-wider text-white/50">Final rank</div>
              <div className="font-display text-base font-bold" style={{ color: facts.rankColor }}>
                {facts.rank}
              </div>
            </div>
            {[
              ['MMR', String(facts.mmr)],
              ['Planets', String(facts.planets)],
              ['Accuracy', facts.accuracy === null ? '—' : `${facts.accuracy}%`],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.05] px-3 py-3">
                <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
                <div className="font-display text-2xl font-bold text-white">{value}</div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-white/50">
            Awarded {facts.date} · {facts.modules} modules · {facts.hubQuizzes} hub quiz{facts.hubQuizzes === 1 ? '' : 'zes'}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2.5">
          <button type="button" onClick={() => void saveCertificate()} disabled={busy} className="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--user-ink)] transition hover:brightness-110 disabled:opacity-50" style={{ background: 'var(--user)' }}>
            <Download size={15} /> {busy ? 'Drawing…' : 'Download certificate'}
          </button>
          <button type="button" onClick={saveNotes} className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15">
            <FileText size={15} /> Download study notes
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              openForge();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            <Plus size={15} /> Start a new course
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
