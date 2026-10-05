import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Check, ChevronRight, Cpu, Loader2, Play, Target, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { audio } from '../../core/audio';
import { goToLounge, holoBurst, useDeck } from '../../core/journey';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';

const PRESETS = [
  { id: 'react', label: 'Advanced React Patterns', icon: <BookOpen size={13} /> },
  { id: 'math', label: 'Linear Algebra Basics', icon: <Target size={13} /> },
  { id: 'biology', label: 'Cellular Biology', icon: <Zap size={13} /> },
];

const STEPS = ['Parsing your objective', 'Retrieving knowledge · RAG, 768-d vectors', 'Calibrating difficulty to your MMR', 'Assembling course modules'];
const STEP_MS = 700;

type Stage = 'edit' | 'forge' | 'ready';

/** The course forge: describe an objective, watch the System build the course, then walk to the lounge. */
export default function CurriculumSetup() {
  const open = useNova((s) => s.curriculumOpen);
  const themeColor = useNova((s) => s.themeColor);
  const activeObjective = useNova((s) => s.activeObjective);
  const inLounge = useDeck((s) => s.deck === 'lounge');
  const [objective, setObjective] = useState('');
  const [stage, setStage] = useState<Stage>('edit');
  const [step, setStep] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const forge = (final: string) => {
    useNova.getState().setActiveObjective(final);
    setStage('forge');
    setStep(0);
    audio.play('hudBoot');
    holoBurst(0.8);
    STEPS.forEach((_, i) =>
      later(() => {
        setStep(i + 1);
        audio.play('click');
      }, STEP_MS * (i + 1)),
    );
    later(() => {
      setStage('ready');
      audio.play('quest');
    }, STEP_MS * STEPS.length + 250);
    later(() => {
      useNova.getState().setCurriculumOpen(false);
      const project = () => {
        useNova.getState().setFeedOpen(true);
        holoBurst(1);
        useNova.getState().notify({ kind: 'system', title: 'NETWORK SYNC', lines: ['RAG pipeline active.', 'Projecting your curriculum on the holo-table.'] });
      };
      goToLounge(project);
      later(() => {
        setStage('edit');
        setStep(0);
      }, 800);
    }, STEP_MS * STEPS.length + 1500);
  };

  const backToFeed = () => {
    useNova.getState().setCurriculumOpen(false);
    useNova.getState().setFeedOpen(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="course-forge"
          className="pointer-events-none fixed inset-0 grid place-items-center p-4"
          style={{ zIndex: Z.pillar + 4 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, delay: 0.25 } }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,8,16,0.15),rgba(0,0,0,0.72))]" />

          <div className="relative w-full max-w-[640px]">
            {/* Projector line the panel unfolds from */}
            <motion.div
              className="absolute left-0 right-0 top-1/2 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)`, boxShadow: `0 0 18px ${themeColor}` }}
              initial={{ scaleX: 0, opacity: 1 }}
              animate={{ scaleX: 1, opacity: [1, 1, 0] }}
              exit={{ scaleX: [1, 0], opacity: 1 }}
              transition={{ duration: 0.6, times: [0, 0.7, 1] }}
            />
            <motion.section
              role="dialog"
              aria-labelledby="forge-title"
              className="holo scanlines pointer-events-auto relative overflow-hidden rounded-md p-6 sm:p-9"
              style={{ borderColor: `${themeColor}66`, boxShadow: `0 0 70px -10px ${themeColor}55, inset 0 0 40px ${themeColor}14` }}
              initial={{ scaleY: 0.01, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              exit={{ scaleY: 0.01, opacity: 0, transition: { duration: 0.3 } }}
              transition={{ delay: 0.35, duration: 0.55, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <motion.div
                className="pointer-events-none absolute inset-x-0 h-24"
                style={{ background: `linear-gradient(180deg, transparent, ${themeColor}22, transparent)` }}
                initial={{ top: '-30%' }}
                animate={{ top: '130%' }}
                transition={{ delay: 0.7, duration: 1.3, ease: 'easeInOut' }}
              />

              <AnimatePresence mode="wait">
                {stage === 'edit' ? (
                  <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ delay: 0.55 }}>
                    <div className="hud-label" style={{ color: themeColor }}>
                      [ System ] · Course forge
                    </div>
                    <h2 id="forge-title" className="glow-cyan mt-3 font-display text-2xl font-bold tracking-wide text-white sm:text-3xl">
                      Define your learning objective
                    </h2>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-cyan-50/70">
                      Describe what you want to master. The System builds a course at your level and projects it in the crew lounge.
                    </p>

                    <div className="group relative mt-6">
                      <div className="absolute -inset-px rounded opacity-40 blur-sm transition group-focus-within:opacity-80" style={{ background: themeColor }} />
                      <textarea
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        placeholder="e.g. I want to understand how Transformers work, starting from basic neural networks…"
                        className="relative h-28 w-full resize-none rounded bg-black/70 p-4 font-mono text-sm leading-relaxed text-white outline-none ring-1 ring-cyan-300/25 placeholder:text-cyan-100/30 focus:ring-cyan-200/60"
                      />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                      {PRESETS.map((p, i) => (
                        <motion.button
                          key={p.id}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.75 + i * 0.08 }}
                          onClick={() => {
                            setObjective(p.label);
                            audio.play('click');
                          }}
                          className="flex cursor-pointer items-center gap-2 rounded-full bg-cyan-400/5 px-3.5 py-1.5 text-xs text-cyan-100 ring-1 ring-cyan-300/25 transition hover:bg-cyan-400/15 hover:text-white hover:ring-cyan-200/60"
                        >
                          <span style={{ color: themeColor }}>{p.icon}</span>
                          {p.label}
                        </motion.button>
                      ))}
                    </div>

                    <div className="mt-7 flex flex-col gap-3 border-t border-cyan-300/15 pt-6 sm:flex-row">
                      <HudButton variant="primary" size="lg" className="flex-1" disabled={!objective.trim()} onClick={() => forge(objective.trim())} icon={<Cpu size={16} />}>
                        Generate course
                      </HudButton>
                      {activeObjective && !inLounge && (
                        <HudButton size="lg" className="flex-1" icon={<Play size={15} />} onClick={() => forge(activeObjective)}>
                          Resume lesson
                        </HudButton>
                      )}
                      {inLounge && (
                        <HudButton size="lg" className="flex-1" icon={<ArrowLeft size={15} />} onClick={backToFeed}>
                          Back to feed
                        </HudButton>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="forge" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-2">
                    <div className="flex items-center gap-5">
                      <div className="relative grid h-20 w-20 shrink-0 place-items-center">
                        <motion.svg viewBox="0 0 80 80" className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}>
                          <circle cx="40" cy="40" r="34" fill="none" stroke={`${themeColor}33`} strokeWidth="3" />
                          <circle cx="40" cy="40" r="34" fill="none" stroke={themeColor} strokeWidth="3" strokeLinecap="round" strokeDasharray="60 154" />
                        </motion.svg>
                        {stage === 'ready' ? <Check size={30} className="text-emerald-300" /> : <Cpu size={26} style={{ color: themeColor }} />}
                      </div>
                      <div>
                        <div className="hud-label" style={{ color: themeColor }}>
                          {stage === 'ready' ? 'Course ready' : 'Forging course'}
                        </div>
                        <div className="mt-1 line-clamp-2 font-display text-xl font-bold text-white">{activeObjective}</div>
                      </div>
                    </div>
                    <ol className="mt-6 space-y-3">
                      {STEPS.map((s, i) => {
                        const done = step > i;
                        const running = step === i && stage === 'forge';
                        return (
                          <li key={s} className={`flex items-center gap-3 text-sm ${done ? 'text-cyan-50' : running ? 'text-white' : 'text-cyan-100/35'}`}>
                            <span className="grid h-5 w-5 place-items-center">
                              {done ? <Check size={15} className="text-emerald-300" /> : running ? <Loader2 size={14} className="animate-spin" style={{ color: themeColor }} /> : <span className="h-1.5 w-1.5 rounded-full bg-cyan-100/30" />}
                            </span>
                            <span className="flex-1">{s}</span>
                            <span className="h-1 w-24 overflow-hidden rounded bg-cyan-400/10">
                              <motion.span
                                className="block h-full"
                                style={{ background: themeColor }}
                                initial={{ width: 0 }}
                                animate={{ width: done ? '100%' : running ? '70%' : 0 }}
                                transition={{ duration: running ? STEP_MS / 1000 : 0.2 }}
                              />
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                    <AnimatePresence>
                      {stage === 'ready' && (
                        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-emerald-300">
                          <ChevronRight size={14} /> {inLounge ? 'Projecting to the holo-table…' : 'Proceeding to the Cosmic Lounge…'}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
