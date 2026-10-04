import { motion, type Variants } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { HERO } from '../../core/content';
import { pulse, replayIntro } from '../../core/director';
import { Z } from '../../core/layers';
import { damp } from '../../core/math';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';
import { useRaf } from '../../core/useRaf';
import { HudButton } from '../common/HudButton';
import { Typewriter } from '../common/Typewriter';
import GoogleG from './GoogleG';
import HoloTitle from './HoloTitle';
import { LABELS } from './labels';
import { createParallaxProbe } from './parallax';
import PillarChips from './PillarChips';
import { EASE_OUT, revealDelay, STAGE, stageFor, type StageState } from './reveal';
import { useMediaQuery } from './useMediaQuery';
import './landing.css';

/**
 * The landing hero, projected on the canopy after arrival (phases "arrive" and "landed").
 * Rows reveal in stages as `rt.arrive` rises; the title and column drift with the pilot's head.
 */
export default function LandingHero() {
  const phase = useNova((s) => s.phase);
  if (phase !== 'arrive' && phase !== 'landed') return null;
  return <Hero />;
}

/** "Wake up. Level up." → ["Wake up.", "Level up."] so the second beat can glow System blue. */
const TAGLINE = HERO.tagline.split(/(?<=\.)\s+/);

const RISE: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { delay, duration: 0.75, ease: EASE_OUT },
    transitionEnd: { filter: 'none' },
  }),
};

const FADE: Variants = {
  hidden: { opacity: 0 },
  show: (delay: number) => ({ opacity: 1, transition: { delay, duration: 0.45 } }),
};

const TRACK_IN: Variants = {
  hidden: { opacity: 0, letterSpacing: '0.95em', paddingLeft: '0.95em', filter: 'blur(8px)' },
  show: (delay: number) => ({
    opacity: 1,
    letterSpacing: '0.42em',
    paddingLeft: '0.42em',
    filter: 'blur(0px)',
    transition: { delay, duration: 1.05, ease: EASE_OUT },
    transitionEnd: { filter: 'none' },
  }),
};

const SCRIM: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 1.4, ease: 'easeOut' } },
};

interface RowProps {
  at: number;
  stage: StageState;
  rm: boolean;
  variants?: Variants;
  /** Extra seconds on top of the cascade delay. */
  extra?: number;
  className?: string;
  children: ReactNode;
}

/** One hero row: rendered from the start (stable layout), inert and invisible until its stage. */
function Row({ at, stage, rm, variants = RISE, extra = 0, className, children }: RowProps) {
  const shown = stage.value >= at;
  return (
    <motion.div
      className={className}
      inert={!shown}
      initial="hidden"
      animate={shown ? 'show' : 'hidden'}
      custom={revealDelay(at, stage) + extra}
      variants={rm ? FADE : variants}
    >
      {children}
    </motion.div>
  );
}

function signIn() {
  pulse();
  useNova.getState().setLoginOpen(true);
}

function Hero() {
  const rm = useNova((s) => s.reducedMotion);
  const panelOpen = useNova((s) => s.activePillar !== null);
  const touch = useMediaQuery('(hover: none)');
  const [stage, setStage] = useState<StageState>(() => ({
    value: stageFor(rt.arrive, useNova.getState().phase === 'landed'),
    from: 0,
  }));
  const stageRef = useRef(stage.value);
  const columnRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [probe] = useState(createParallaxProbe);
  const look = useRef({ x: 0, y: 0, sx: 0, sy: 0, wx: NaN, wy: NaN });

  useRaf((dt) => {
    // Stage: React renders once per newly revealed row.
    const next = stageFor(rt.arrive, useNova.getState().phase === 'landed');
    if (next > stageRef.current) {
      const from = stageRef.current;
      stageRef.current = next;
      setStage({ value: next, from });
    }

    // Parallax: depth layers — column 0.3×, title 1×, outline ghost 1.9× (offsets are relative to the parent).
    const o = look.current;
    if (rt.reducedMotion) {
      o.x = 0;
      o.y = 0;
    } else {
      probe.sample(rt.yaw, rt.pitch, rt.lookX, rt.lookY, o);
    }
    o.sx = damp(o.sx, o.x, 9, dt);
    o.sy = damp(o.sy, o.y, 9, dt);
    if (Math.abs(o.sx - o.wx) < 0.02 && Math.abs(o.sy - o.wy) < 0.02) return;
    o.wx = o.sx;
    o.wy = o.sy;
    const t = (el: HTMLElement | null, k: number) => {
      if (el) el.style.transform = `translate3d(${(o.sx * k).toFixed(2)}px, ${(o.sy * k).toFixed(2)}px, 0)`;
    };
    t(columnRef.current, 0.3);
    t(titleRef.current, 0.7);
    t(ghostRef.current, 0.9);
  });

  const titleShown = stage.value >= STAGE.title;
  const titleDelay = revealDelay(STAGE.title, stage);

  return (
    <div className={`pointer-events-none fixed inset-0${rm ? ' ld-rm' : ''}`} style={{ zIndex: Z.landing }}>
      <motion.div
        aria-hidden="true"
        className="ld-scrim"
        initial="hidden"
        animate={stage.value >= STAGE.kicker ? 'show' : 'hidden'}
        variants={SCRIM}
      />

      <div className="ld-band">
        <div className={`ld-shift w-full${panelOpen ? ' is-panel' : ''}`}>
          <div ref={columnRef} className="mx-auto flex w-full max-w-[880px] flex-col items-center text-center">
            <Row at={STAGE.kicker} stage={stage} rm={rm} variants={FADE}>
              <Kicker typing={stage.value >= STAGE.kicker} rm={rm} />
            </Row>

            <div className="mt-[clamp(8px,1.6vh,16px)]">
              <HoloTitle text={HERO.title} shown={titleShown} delay={titleDelay} wrapRef={titleRef} ghostRef={ghostRef} />
            </div>
            <div
              aria-hidden="true"
              className={`ld-divider mt-[clamp(6px,1.2vh,12px)]${titleShown ? ' is-on' : ''}`}
              style={{ '--ld-delay': `${titleDelay}s` } as CSSProperties}
            >
              <span className="ld-divider-line" />
              <span className="ld-divider-gem" />
              <span className="ld-divider-line is-r" />
            </div>

            <Row at={STAGE.tagline} stage={stage} rm={rm} variants={TRACK_IN} className="mt-[clamp(10px,1.8vh,18px)]">
              <p className="font-display text-[13px] font-medium uppercase tracking-[0.42em] text-ink sm:text-[clamp(15px,1.4vw,20px)]">
                <span className="glow-cyan">{TAGLINE[0]}</span>
                {TAGLINE.slice(1).map((part) => (
                  <span key={part}>
                    {' '}
                    <span className="text-sys-glow glow-sys">{part}</span>
                  </span>
                ))}
              </p>
            </Row>

            <Row at={STAGE.sub} stage={stage} rm={rm} className="mt-[clamp(10px,1.8vh,16px)]">
              <p className="max-w-[56ch] text-pretty text-[14.5px] leading-[1.6] text-ink-dim sm:text-[clamp(15px,1.15vw,16.5px)]">
                {HERO.sub}
              </p>
            </Row>

            <Row
              at={STAGE.ctas}
              stage={stage}
              rm={rm}
              className="mt-[clamp(16px,3vh,28px)] flex w-full max-w-[380px] flex-col items-stretch gap-2.5 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="relative flex">
                <span aria-hidden="true" className="ld-cta-ring" />
                <HudButton
                  variant="primary"
                  size="lg"
                  icon={<GoogleBadge />}
                  onClick={signIn}
                  className="ld-cta pointer-events-auto w-full pl-2.5 max-sm:h-12 max-sm:text-[13px]"
                >
                  {HERO.ctaPrimary}
                </HudButton>
              </span>
              <HudButton
                variant="ghost"
                size="lg"
                icon={<RotateCcw aria-hidden="true" className="size-4" />}
                onClick={() => replayIntro()}
                className="pointer-events-auto max-sm:h-12 max-sm:text-[13px]"
              >
                {HERO.ctaSecondary}
              </HudButton>
            </Row>

            <Row at={STAGE.chips} stage={stage} rm={rm} className="mt-[clamp(14px,2.6vh,24px)] w-full">
              <PillarChips rm={rm} touch={touch} />
            </Row>

            <Row at={STAGE.chips} stage={stage} rm={rm} variants={FADE} extra={0.35} className="mt-[clamp(6px,1.2vh,12px)]">
              <Footer />
            </Row>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kicker({ typing, rm }: { typing: boolean; rm: boolean }) {
  return (
    <p className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-nova-soft sm:gap-3 sm:text-[11px] sm:tracking-[0.34em]">
      <span aria-hidden="true" className="ld-kicker-line" />
      <span aria-hidden="true" className="ld-kicker-dot" />
      <span className="relative -mr-[0.2em] whitespace-nowrap sm:-mr-[0.34em]">
        <span aria-hidden="true" className="invisible">
          {HERO.kicker}
        </span>
        <span className="absolute inset-0 text-left">
          {typing && <Typewriter text={HERO.kicker} cps={56} instant={rm} />}
        </span>
      </span>
      <span aria-hidden="true" className="ld-kicker-dot" />
      <span aria-hidden="true" className="ld-kicker-line is-r" />
    </p>
  );
}

function GoogleBadge() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-[2px] bg-white shadow-[inset_0_0_0_1px_rgba(2,6,23,0.1)] sm:size-9">
      <GoogleG className="size-4 sm:size-[18px]" />
    </span>
  );
}

function Footer() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex flex-wrap items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-dim/55 sm:text-[9.5px]">
        <span className="mr-0.5">{LABELS.poweredBy}</span>
        {HERO.poweredBy.map((p) => (
          <span key={p} className="rounded-[2px] px-1.5 py-[3px] text-ink-dim/85 ring-1 ring-inset ring-white/12">
            {p}
          </span>
        ))}
      </div>
      <p className="px-4 text-[10px] leading-snug tracking-[0.02em] text-ink-dim/45 sm:text-[10.5px]">{HERO.micro}</p>
    </div>
  );
}
