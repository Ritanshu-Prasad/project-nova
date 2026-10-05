import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { Activity, BookOpen, ChevronRight, RotateCcw, Sparkles, Target, Zap } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { audio } from '../../core/audio';
import { holoBurst } from '../../core/journey';
import { useNova } from '../../core/store';
import { HudButton } from '../../ui/common/HudButton';
import { Typewriter } from '../../ui/common/Typewriter';
import { ARRIVE_Z, STAND_EYE } from './layout';

/** Mock lesson stream until the RAG backend feeds real content. */
const CONCEPTS = [
  {
    title: 'Understanding Neural Networks',
    body: 'A neural network is a series of algorithms that recognises relationships in data through a process loosely modelled on the brain: layers of weighted connections transform inputs step by step until a useful output emerges.',
    simple: 'Think of a neural network as a team passing notes. Each member adds a little opinion, and by the end of the line the team has a good guess about the answer.',
    log: ['[+] Initialising perceptron layers…', '[+] Adjusting weights and biases…', '[+] Output ready for consumption.'],
  },
  {
    title: 'Forward Pass vs Backpropagation',
    body: 'The forward pass pushes inputs through the layers to produce a prediction. Backpropagation then measures the error and flows it backwards, telling every weight how much it contributed so gradient descent can correct it.',
    simple: 'Forward pass: you take a shot at the basket. Backpropagation: your coach tells each part of your body how to adjust for the next shot.',
    log: ['[+] Loss computed: 0.412', '[+] Gradients propagated through 4 layers', '[+] Weights updated (lr = 0.01)'],
  },
  {
    title: 'Attention, Briefly',
    body: 'Attention lets a model weigh every token against every other token. Queries meet keys to produce scores, softmax turns them into weights, and those weights mix the values into a context-aware representation.',
    simple: 'Attention is the model deciding which words in a sentence to “look at” most when understanding each word.',
    log: ['[+] Q·Kᵀ / √dₖ computed', '[+] Softmax over 512 positions', '[+] Context vectors assembled'],
  },
];

const DF = 2; // 200 CSS px per metre

/** Faces a panel at world (x, z) toward the pilot's standing spot. */
const faceCam = (x: number, z: number) => Math.atan2(0 - x, ARRIVE_Z - z);

function Panel({
  position,
  delay,
  scale = 1,
  children,
}: {
  position: [number, number, number];
  delay: number;
  scale?: number;
  children: ReactNode;
}) {
  return (
    <Html transform distanceFactor={DF} position={position} scale={scale} rotation={[0, faceCam(position[0], position[2]), 0]} zIndexRange={[20, 10]}>
      <motion.div
        // Unfold with a clip reveal (scale transforms nested in CSS 3D can stall on some screens).
        initial={{ opacity: 0, y: 30, clipPath: 'inset(48% 0% 48% 0%)' }}
        animate={{ opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)' }}
        exit={{ opacity: 0, clipPath: 'inset(48% 0% 48% 0%)' }}
        transition={{ delay, duration: 0.7, ease: [0.2, 0.9, 0.2, 1] }}
        className="holo-feed relative select-text overflow-hidden rounded-md border border-cyan-300/40 bg-[rgba(3,22,30,0.62)] text-cyan-50 shadow-[0_0_60px_rgba(34,211,238,0.25),inset_0_0_40px_rgba(34,211,238,0.08)]"
      >
        <div className="scanlines pointer-events-none absolute inset-0 opacity-60" />
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-cyan-300/15 to-transparent"
          initial={{ top: '-20%' }}
          animate={{ top: '120%' }}
          transition={{ delay: delay + 0.3, duration: 1.4, ease: 'easeInOut' }}
        />
        {children}
      </motion.div>
    </Html>
  );
}

function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const shown = useTransform(mv, (v) => Math.round(v).toLocaleString('en-IN'));
  useEffect(() => {
    const c = animate(mv, value, { duration: 1.2, ease: 'easeOut' });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span>{shown}</motion.span>;
}

/** The learning feed, projected as holographic panels around the holo-table. */
export default function HoloFeed() {
  const open = useNova((s) => s.feedOpen);
  const objective = useNova((s) => s.activeObjective);
  const narrow = useThree((s) => s.size.width / s.size.height < 0.9);
  const [idx, setIdx] = useState(0);
  const [simple, setSimple] = useState(false);
  const [mmr, setMmr] = useState(1405);
  const [engaged, setEngaged] = useState(false);
  const [answer, setAnswer] = useState('');
  const c = CONCEPTS[idx];

  if (!open) return null;

  const y = STAND_EYE + 0.05;
  // Phones: one closer, smaller column (stats · lesson · challenge) that fits the narrow view.
  const k = narrow ? 0.8 : 1;
  const lesson: [number, number, number] = narrow ? [0, 0.06, 7.9] : [0, y, 8.9];
  const stats: [number, number, number] = narrow ? [0, 1.53, 7.9] : [2.15, y + 0.35, 9.25];
  const quest: [number, number, number] = narrow ? [0, -1.49, 7.9] : [-2.15, y + 0.05, 9.25];

  const nextConcept = () => {
    setIdx((i) => (i + 1) % CONCEPTS.length);
    setSimple(false);
    holoBurst(0.5);
  };

  const submit = () => {
    if (answer.trim().length < 8) {
      useNova.getState().notify({ kind: 'warning', title: 'SUBROUTINE', lines: ['Give it a full sentence, pilot.'], ttl: 2.5 });
      return;
    }
    const gain = 12 + Math.min(14, Math.floor(answer.trim().length / 12));
    setMmr((v) => v + gain);
    setEngaged(false);
    setAnswer('');
    holoBurst(1);
    audio.play('quest');
    useNova.getState().notify({ kind: 'levelup', title: 'CHALLENGE CLEARED', lines: [`+${gain} MMR · next sector unlocked`], ttl: 3.5 });
  };

  return (
    <group>
      <Panel position={lesson} delay={0.15} scale={k}>
        <div className="w-[460px]">
          <div className="flex items-center justify-between border-b border-cyan-300/20 bg-cyan-400/5 px-5 py-3">
            <div className="flex items-center gap-2.5">
              <BookOpen size={16} className="text-cyan-300" />
              <span className="font-display text-xs font-bold tracking-[0.25em]">ACTIVE CURRICULUM</span>
            </div>
            <span className="font-mono text-[10px] text-cyan-300/70">MODULE {String(idx + 1).padStart(2, '0')}/{String(CONCEPTS.length).padStart(2, '0')}</span>
          </div>
          <div className="space-y-4 px-5 py-4">
            {objective && (
              <div className="flex items-start gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-300/80">
                <Target size={12} className="mt-0.5 shrink-0" /> <span className="line-clamp-2">{objective}</span>
              </div>
            )}
            <h2 className="font-display text-2xl font-bold leading-tight text-white">{c.title}</h2>
            <p className="min-h-[96px] text-[13px] leading-relaxed text-cyan-50/85">
              <Typewriter key={`${idx}-${simple}`} text={simple ? c.simple : c.body} cps={140} caret={false} />
            </p>
            <div className="rounded border border-cyan-400/15 bg-black/40 p-3 font-mono text-[11px] leading-5 text-cyan-200/80">
              <div className="text-cyan-400/60">// RAG system output</div>
              {c.log.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
            <div className="flex gap-2.5">
              <HudButton size="sm" className="flex-1" icon={<Sparkles size={13} />} onClick={() => (setSimple((v) => !v), holoBurst(0.4))}>
                {simple ? 'Original' : 'Explain simpler'}
              </HudButton>
              <HudButton size="sm" variant="system" className="flex-1" icon={<ChevronRight size={13} />} onClick={nextConcept}>
                Next concept
              </HudButton>
            </div>
          </div>
        </div>
      </Panel>

      <Panel position={stats} delay={0.35} scale={k}>
        <div className="w-[270px] p-4">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.2em] text-emerald-300">
            <Activity size={14} /> PILOT STATS
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-emerald-400/70">MMR RANK</div>
              <div className="font-display text-3xl text-white">
                <CountUp value={mmr} />
              </div>
            </div>
            <div>
              <div className="text-[10px] text-emerald-400/70">LEVEL</div>
              <div className="font-display text-3xl text-white">04</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded bg-emerald-400/10">
            <motion.div className="h-full bg-emerald-400" animate={{ width: `${((mmr % 100) / 100) * 100}%` }} transition={{ duration: 1.2 }} />
          </div>
          <button
            type="button"
            onClick={() => {
              useNova.getState().setFeedOpen(false);
              useNova.getState().setCurriculumOpen(true);
            }}
            className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-cyan-300/25 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/70 hover:border-cyan-200/60 hover:text-white"
          >
            <RotateCcw size={12} /> New objective
          </button>
        </div>
      </Panel>

      <Panel position={quest} delay={0.5} scale={k}>
        <div className="w-[270px] p-4">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.2em] text-rose-300">
            <Zap size={14} /> PvE CHALLENGE
          </div>
          <p className="text-[13px] leading-relaxed text-rose-50/90">
            A rogue subroutine demands you explain the difference between a forward pass and backpropagation before it releases the next sector.
          </p>
          {engaged ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Your answer…"
                className="w-full resize-none rounded border border-rose-400/40 bg-black/50 p-2 font-mono text-[11px] text-white outline-none placeholder:text-rose-200/40 focus:border-rose-300"
              />
              <HudButton size="sm" variant="primary" className="w-full" onClick={submit}>
                Transmit answer
              </HudButton>
            </div>
          ) : (
            <HudButton size="sm" className="mt-4 w-full !text-rose-50 !ring-rose-400/50" icon={<ChevronRight size={13} />} onClick={() => setEngaged(true)}>
              Engage subroutine
            </HudButton>
          )}
        </div>
      </Panel>
    </group>
  );
}
