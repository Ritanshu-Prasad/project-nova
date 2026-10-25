import { useRef, type ReactNode, type RefObject } from 'react';
import { levelOf, useCourse, useSkill } from '../../core/course';
import { easeOutCubic } from '../../core/math';
import { planetName, usePlanets } from '../../core/planets';
import { rankOf } from '../../core/rank';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';
import { useRaf } from '../../core/useRaf';
import { hudBus } from './hudBus';
import { READOUT } from './hudCopy';
import { hash1, velocityMeter, velocityUnit, velocityValue } from './hudMath';

/** Writes text into a ref'd element only when it changed (keeps per-frame DOM writes minimal). */
function setText(el: HTMLElement | null, cache: { current: string }, text: string) {
  if (!el || cache.current === text) return;
  cache.current = text;
  el.textContent = text;
}

function setMeter(el: HTMLElement | null, v: number) {
  if (el) el.style.transform = `scaleX(${Math.max(0, Math.min(1, v)).toFixed(3)})`;
}

type Side = 'left' | 'right';

function Label({ children, side }: { children: ReactNode; side: Side }) {
  return (
    <div className={`flex items-center gap-1.5 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
      <span className="h-[5px] w-[5px] rotate-45 border border-cyan-300/70" />
      <span className="hud-label text-[9.5px] tracking-[0.26em]">{children}</span>
    </div>
  );
}

function Meter({ fillRef, side, tone = 'cyan' }: { fillRef: RefObject<HTMLDivElement | null>; side: Side; tone?: 'cyan' | 'ok' | 'sys' }) {
  const fill = tone === 'ok' ? 'bg-emerald-300' : tone === 'sys' ? 'bg-blue-400' : 'bg-cyan-300';
  return (
    <div className={`relative mt-1.5 h-[4px] w-[128px] ${side === 'right' ? 'hud-seg-rtl ml-auto' : 'hud-seg'}`}>
      <div className="absolute inset-0 bg-cyan-200/15" />
      <div
        ref={fillRef}
        className={`absolute inset-0 ${fill} ${side === 'right' ? 'origin-right' : 'origin-left'}`}
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}

/** Vertical rail along the outer edge of a readout column. */
function Rail({ side }: { side: Side }) {
  return (
    <>
      <div
        className={`absolute top-[-10px] bottom-[-10px] w-px bg-linear-to-b from-transparent via-cyan-300/40 to-transparent ${
          side === 'left' ? 'left-0' : 'right-0'
        }`}
      />
      <div className={`absolute top-[-10px] h-px w-2 bg-cyan-300/50 ${side === 'left' ? 'left-0' : 'right-0'}`} />
      <div className={`absolute bottom-[-10px] h-px w-2 bg-cyan-300/50 ${side === 'left' ? 'left-0' : 'right-0'}`} />
    </>
  );
}

const COLUMN =
  'absolute top-[max(40%,396px)] w-[160px] max-sm:hidden [@media(max-height:620px)]:hidden';
const VALUE = 'font-mono text-[19px] leading-none font-semibold text-cyan-50 tabular-nums hud-glow';
const VALUE_SM = 'font-mono text-[16px] leading-none font-semibold text-cyan-50 tabular-nums hud-glow';
const UNIT = 'font-mono text-[10px] leading-none tracking-[0.12em] text-cyan-200/70';

/** Left column: velocity, thrust, hull. */
export function LeftReadouts() {
  const velRef = useRef<HTMLSpanElement>(null);
  const unitRef = useRef<HTMLSpanElement>(null);
  const velBar = useRef<HTMLDivElement>(null);
  const thrRef = useRef<HTMLSpanElement>(null);
  const thrBar = useRef<HTMLDivElement>(null);
  const hullBar = useRef<HTMLDivElement>(null);
  const cVel = useRef('');
  const cUnit = useRef('');
  const cThr = useRef('');

  useRaf(() => {
    if (!hudBus.visible) return;
    const v = rt.speedKms;
    setText(velRef.current, cVel, velocityValue(v));
    setText(unitRef.current, cUnit, velocityUnit(v));
    setMeter(velBar.current, velocityMeter(v));
    const thrust = Math.max(0, Math.min(1, rt.engine));
    setText(thrRef.current, cThr, String(Math.round(thrust * 100)));
    setMeter(thrBar.current, thrust);
    setMeter(hullBar.current, 1);
  });

  return (
    <div className={`${COLUMN} left-6`}>
      <div className="relative flex flex-col gap-[18px] pl-3.5">
        <Rail side="left" />
        <div>
          <Label side="left">{READOUT.velocity}</Label>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span ref={velRef} className={VALUE}>
              0
            </span>
            <span ref={unitRef} className={UNIT}>
              km/s
            </span>
          </div>
          <Meter fillRef={velBar} side="left" />
        </div>
        <div>
          <Label side="left">{READOUT.thrust}</Label>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span ref={thrRef} className={VALUE}>
              0
            </span>
            <span className={UNIT}>%</span>
          </div>
          <Meter fillRef={thrBar} side="left" />
        </div>
        <div>
          <Label side="left">{READOUT.hull}</Label>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className={VALUE}>100</span>
            <span className={UNIT}>%</span>
          </div>
          <Meter fillRef={hullBar} side="left" tone="ok" />
        </div>
      </div>
    </div>
  );
}

/** Right column: neural sync, pilot rank, RR, sector. */
export function RightReadouts() {
  const world = useNova((s) => s.world);
  const hasCourse = useCourse((s) => !!s.activeId);
  const xp = useCourse((s) => s.stats.xp);
  const skill = useSkill();
  const planet = usePlanets((s) => planetName(s.index));
  // Before a course exists the readout stays on its intro copy; after that it follows the pilot.
  const rank = hasCourse && skill.answered > 0 ? rankOf(skill.mmr) : null;
  const pilotValue = hasCourse ? `LV ${levelOf(xp)} · ${rank ? rank.label.toUpperCase() : 'UNRANKED'}` : READOUT.pilotValue;
  const sector = hasCourse && world === 'newworld' ? planet.toUpperCase() : world === 'newworld' ? READOUT.sectorNew : READOUT.sectorBay;
  const syncRef = useRef<HTMLSpanElement>(null);
  const syncBar = useRef<HTMLDivElement>(null);
  const cSync = useRef('');
  /** Sync ramp 0..1 — climbs to 100 % over ~2.4 s once the neural link is up. */
  const sync = useRef(0);

  useRaf((dt, time) => {
    if (!hudBus.visible) return;
    if (rt.hud <= 0.001) sync.current = 0;
    else sync.current = Math.min(1, sync.current + dt / 2.4);
    const s = easeOutCubic(sync.current);
    // A little calibration chatter while it climbs.
    const chatter = sync.current < 1 && !rt.reducedMotion ? Math.floor((hash1(Math.floor(time * 18)) - 0.5) * 6) : 0;
    const pct = Math.max(0, Math.min(100, Math.round(s * 100) + (s < 0.97 ? chatter : 0)));
    setText(syncRef.current, cSync, String(pct));
    setMeter(syncBar.current, s);
  });

  return (
    <div className={`${COLUMN} right-6 text-right`}>
      <div className="relative flex flex-col items-end gap-[16px] pr-3.5">
        <Rail side="right" />
        <div className="w-full">
          <Label side="right">{READOUT.sync}</Label>
          <div className="mt-1.5 flex items-baseline justify-end gap-1.5">
            <span ref={syncRef} className={VALUE}>
              0
            </span>
            <span className={UNIT}>%</span>
          </div>
          <Meter fillRef={syncBar} side="right" tone="sys" />
        </div>
        <div>
          <Label side="right">{READOUT.pilot}</Label>
          <div className="hud-glow-sys mt-1.5 font-display text-[14px] leading-none font-semibold tracking-[0.14em] text-blue-100">
            {pilotValue}
          </div>
        </div>
        <div>
          <Label side="right">{READOUT.mmr}</Label>
          <div className="mt-1 flex items-center justify-end gap-2">
            {!rank && (
              <span className="flex items-center gap-1.5 font-mono text-[9.5px] leading-none tracking-[0.14em] text-amber-300/90 uppercase">
                <span className="hud-blink h-[5px] w-[5px] rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.9)]" />
                {READOUT.mmrNote}
              </span>
            )}
            <span className={VALUE_SM}>{rank ? Math.round(skill.mmr) : READOUT.mmrValue}</span>
          </div>
        </div>
        <div>
          <Label side="right">{READOUT.sector}</Label>
          <div className="hud-glow mt-1.5 font-display text-[14px] leading-none font-semibold tracking-[0.2em] text-cyan-50">
            {sector}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Phones (< 640 px) get one compact flight-data row under the heading tape instead of the columns. */
export function MobileReadout() {
  const velRef = useRef<HTMLSpanElement>(null);
  const unitRef = useRef<HTMLSpanElement>(null);
  const thrRef = useRef<HTMLSpanElement>(null);
  const cVel = useRef('');
  const cUnit = useRef('');
  const cThr = useRef('');

  useRaf(() => {
    if (!hudBus.visible || hudBus.w >= 640) return;
    const v = rt.speedKms;
    setText(velRef.current, cVel, velocityValue(v));
    setText(unitRef.current, cUnit, velocityUnit(v));
    setText(thrRef.current, cThr, String(Math.round(Math.max(0, Math.min(1, rt.engine)) * 100)));
  });

  return (
    <div className="absolute left-1/2 top-[108px] flex -translate-x-1/2 items-baseline gap-4 font-mono text-[9.5px] leading-none tracking-[0.2em] whitespace-nowrap text-cyan-200/75 sm:hidden">
      <span>
        VEL{' '}
        <span ref={velRef} className="text-[12px] font-semibold tracking-[0.06em] text-cyan-50 tabular-nums hud-glow">
          0
        </span>{' '}
        <span ref={unitRef}>km/s</span>
      </span>
      <span>
        THR{' '}
        <span ref={thrRef} className="text-[12px] font-semibold tracking-[0.06em] text-cyan-50 tabular-nums hud-glow">
          0
        </span>{' '}
        %
      </span>
    </div>
  );
}
