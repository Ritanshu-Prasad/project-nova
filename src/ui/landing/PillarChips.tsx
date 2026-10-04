import { ArrowUpRight } from 'lucide-react';
import { audio } from '../../core/audio';
import { PILLARS } from '../../core/content';
import { useNova } from '../../core/store';
import { Typewriter } from '../common/Typewriter';
import { LABELS, PILLAR_PANEL_ID } from './labels';

export interface PillarChipsProps {
  rm: boolean;
  /** Coarse pointer (no hover): adjusts the hint line. */
  touch: boolean;
}

/**
 * The three product pillars as chips. Hover / focus mirrors into `store.hoverPillar` (the matching
 * cockpit screen lights up), click opens the detail panel. The line underneath types out the
 * focused pillar's one-liner — whether it was focused here or on a cockpit screen.
 */
export default function PillarChips({ rm, touch }: PillarChipsProps) {
  const hover = useNova((s) => s.hoverPillar);
  const active = useNova((s) => s.activePillar);
  const focus = hover ?? active;
  const focused = focus !== null && focus >= 0 && focus < PILLARS.length ? PILLARS[focus] : null;

  return (
    <div className="flex w-full flex-col items-center">
      <div
        role="group"
        aria-label={LABELS.modules}
        className="ld-chips -mx-4 flex w-[calc(100%+32px)] gap-2 px-4 py-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:justify-center sm:gap-2.5 sm:px-0"
      >
        {PILLARS.map((p, i) => (
          <Chip key={p.key} index={i} hovered={hover === i} active={active === i} />
        ))}
        <span aria-hidden="true" className="w-2 shrink-0 sm:hidden" />
      </div>

      <div aria-hidden="true" className="mt-2 flex h-5 max-w-full items-center justify-center overflow-hidden px-2">
        {focused ? (
          <span className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-cyan-100 sm:text-[11.5px]">
            <span className="shrink-0 text-nova/70">{focused.code} ›</span>
            <span className="relative min-w-0 whitespace-nowrap">
              <span className="invisible">{focused.short}</span>
              <span className="absolute inset-0 text-left">
                <Typewriter key={focused.key} text={focused.short} cps={80} instant={rm} />
              </span>
            </span>
          </span>
        ) : (
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-ink-dim/45">
            {touch ? LABELS.chipsHintTouch : LABELS.chipsHint}
          </span>
        )}
      </div>
    </div>
  );
}

interface ChipProps {
  index: number;
  hovered: boolean;
  active: boolean;
}

const CHIP_BASE =
  'hud-corners group pointer-events-auto relative flex h-10 shrink-0 cursor-pointer snap-start items-center gap-2.5 rounded-[2px] pl-3 pr-3.5 ' +
  'font-display text-[11.5px] font-semibold uppercase tracking-[0.16em] ring-1 ring-inset backdrop-blur-sm ' +
  'transition-[color,background-color,box-shadow] duration-200 [--hl:6px]';
const CHIP_IDLE =
  'bg-[rgb(6_22_36/0.5)] text-cyan-50/80 ring-cyan-300/20 [--hc:rgb(103_232_249/0.4)] hover:text-white';
const CHIP_LIT =
  'bg-cyan-400/15 text-white ring-cyan-200/70 shadow-[0_0_26px_rgba(34,211,238,0.32)] [--hc:rgb(186_246_255/0.95)]';

function Chip({ index, hovered, active }: ChipProps) {
  const p = PILLARS[index];
  const lit = hovered || active;
  const descId = `ld-chip-desc-${index}`;
  const clearHover = () => {
    const s = useNova.getState();
    if (s.hoverPillar === index) s.setHoverPillar(null);
  };
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={active}
      aria-controls={active ? PILLAR_PANEL_ID : undefined}
      aria-describedby={descId}
      className={`${CHIP_BASE} ${lit ? CHIP_LIT : CHIP_IDLE}`}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') audio.play('hover');
        useNova.getState().setHoverPillar(index);
      }}
      onPointerLeave={clearHover}
      onFocus={() => useNova.getState().setHoverPillar(index)}
      onBlur={clearHover}
      onClick={() => {
        audio.play('click');
        const s = useNova.getState();
        s.setActivePillar(s.activePillar === index ? null : index);
      }}
    >
      <span aria-hidden="true" className={`ld-led${lit ? ' is-on' : ''}${active ? ' is-active' : ''}`} />
      <span className="font-mono text-[10px] font-medium tracking-[0.1em] text-nova-soft/85">{p.code}</span>
      <span aria-hidden="true" className="-mx-1 text-nova/40">
        ·
      </span>
      <span>{p.title}</span>
      <ArrowUpRight
        aria-hidden="true"
        className={`-mr-1 size-3.5 transition-[opacity,transform] duration-200 ${lit ? 'translate-x-0.5 -translate-y-0.5 opacity-100' : 'opacity-45'}`}
      />
      <span id={descId} className="sr-only">
        {p.short}
      </span>
    </button>
  );
}
