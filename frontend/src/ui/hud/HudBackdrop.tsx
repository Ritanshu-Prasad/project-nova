import type { CSSProperties } from 'react';
import { useNova } from '../../core/store';

/**
 * DEV ONLY (used by Hud.preview) — a static CSS stand-in for the WebGL scene: hangar or new world,
 * a canopy frame and the cockpit console with three screens. The screens imitate 3D hover targets
 * by setting document.body.style.cursor, like the cockpit module does.
 */

const STARS: CSSProperties = {
  backgroundImage: [
    'radial-gradient(1px 1px at 12% 18%, #fff 50%, transparent 51%)',
    'radial-gradient(1px 1px at 27% 62%, #cbd5e1 50%, transparent 51%)',
    'radial-gradient(1.5px 1.5px at 41% 12%, #e0f2fe 50%, transparent 51%)',
    'radial-gradient(1px 1px at 58% 33%, #fff 50%, transparent 51%)',
    'radial-gradient(1px 1px at 66% 8%, #bae6fd 50%, transparent 51%)',
    'radial-gradient(1.5px 1.5px at 79% 41%, #fff 50%, transparent 51%)',
    'radial-gradient(1px 1px at 88% 16%, #e2e8f0 50%, transparent 51%)',
    'radial-gradient(1px 1px at 93% 58%, #fff 50%, transparent 51%)',
    'radial-gradient(1px 1px at 6% 44%, #fff 50%, transparent 51%)',
    'radial-gradient(1px 1px at 34% 36%, #c7d2fe 50%, transparent 51%)',
    'radial-gradient(1px 1px at 51% 54%, #fff 50%, transparent 51%)',
    'radial-gradient(1px 1px at 72% 66%, #e0e7ff 50%, transparent 51%)',
  ].join(','),
};

function NewWorld() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'radial-gradient(ellipse 80% 60% at 30% 30%, #2a1650 0%, #120b2e 40%, #04050d 80%)' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 50% 40% at 75% 25%, rgba(56,189,248,0.25), transparent 70%)' }} />
      <div className="absolute inset-0" style={STARS} />
      {/* Sun */}
      <div className="absolute right-[12%] top-[10%] h-40 w-40 rounded-full" style={{ background: 'radial-gradient(circle, #fff 0 8%, rgba(253,230,138,0.85) 14%, rgba(251,191,36,0.25) 35%, transparent 70%)' }} />
      {/* Planet + ring */}
      <div
        className="absolute left-1/2 top-[44%] aspect-square w-[46vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle at 70% 28%, #7dd3fc 0%, #2563eb 22%, #1e1b4b 58%, #05050f 78%)', boxShadow: '0 0 80px rgba(56,189,248,0.35)' }}
      />
      <div
        className="absolute left-1/2 top-[44%] h-[9vmax] w-[78vmax] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] rounded-[50%]"
        style={{ border: '2px solid rgba(186,230,253,0.45)', boxShadow: '0 0 30px rgba(125,211,252,0.35), inset 0 0 20px rgba(125,211,252,0.25)' }}
      />
    </div>
  );
}

function Hangar({ lit }: { lit: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: lit ? 'radial-gradient(ellipse 70% 55% at 50% 42%, #2a3442 0%, #121925 45%, #05070c 85%)' : 'radial-gradient(ellipse 70% 55% at 50% 42%, #2a0d0d 0%, #120708 50%, #040203 85%)' }}>
      {/* Open blast doors onto the accelerator rail */}
      <div className="absolute left-1/2 top-[43%] h-[22vh] w-[26vw] -translate-x-1/2 -translate-y-1/2" style={{ background: 'radial-gradient(ellipse at 50% 50%, #0b1a33 0%, #02040a 80%)', boxShadow: lit ? '0 0 60px rgba(34,211,238,0.25)' : 'none' }}>
        <div className="absolute inset-0" style={STARS} />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/60"
            style={{ width: `${90 - i * 20}%`, height: `${110 - i * 25}%`, opacity: lit ? 0.9 - i * 0.18 : 0.15 }}
          />
        ))}
      </div>
      {/* Floor grid */}
      <div className="absolute inset-x-[-40%] bottom-0 h-[55%] origin-bottom" style={{ transform: 'perspective(500px) rotateX(62deg)', backgroundImage: 'repeating-linear-gradient(90deg, rgba(148,163,184,0.12) 0 1px, transparent 1px 80px), repeating-linear-gradient(0deg, rgba(148,163,184,0.12) 0 1px, transparent 1px 80px)' }} />
      {/* Flood lights / emergency */}
      {[16, 38, 62, 84].map((x) => (
        <div key={x} className="absolute top-[6%] h-28 w-28 -translate-x-1/2 rounded-full" style={{ left: `${x}%`, background: lit ? 'radial-gradient(circle, rgba(226,232,240,0.55), transparent 65%)' : 'radial-gradient(circle, rgba(239,68,68,0.55), transparent 65%)' }} />
      ))}
    </div>
  );
}

function Warp() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'radial-gradient(circle at 50% 46%, #e0f2fe 0%, #38bdf8 6%, #312e81 26%, #05040f 70%)' }}>
      <div className="absolute inset-0 opacity-60" style={{ background: 'repeating-conic-gradient(from 0deg at 50% 46%, rgba(165,243,252,0.5) 0deg 0.6deg, transparent 0.6deg 7deg)' }} />
    </div>
  );
}

const screen = (on: boolean) => ({
  onPointerEnter: () => {
    if (on) document.body.style.cursor = 'pointer';
  },
  onPointerLeave: () => {
    document.body.style.cursor = '';
  },
});

function Cockpit() {
  return (
    <>
      {/* Canopy bow + side struts */}
      <div className="absolute inset-x-0 top-0 h-[16%]" style={{ background: 'radial-gradient(ellipse 75% 100% at 50% 0%, #0b1018 60%, transparent 61%)' }} />
      <div className="absolute inset-y-0 left-0 w-[22%]" style={{ background: 'linear-gradient(90deg, #070a10, #0c121b)', clipPath: 'polygon(0 0, 30% 0, 100% 100%, 0 100%)' }} />
      <div className="absolute inset-y-0 right-0 w-[22%]" style={{ background: 'linear-gradient(270deg, #070a10, #0c121b)', clipPath: 'polygon(70% 0, 100% 0, 100% 100%, 0 100%)' }} />
      {/* Console */}
      <div className="absolute inset-x-0 bottom-0 h-[26%]" style={{ background: 'linear-gradient(180deg, #1a2230 0%, #0b1018 8%, #06090e 100%)', clipPath: 'polygon(0 22%, 18% 0, 82% 0, 100% 22%, 100% 100%, 0 100%)' }}>
        <div className="absolute inset-x-[18%] top-0 h-px bg-cyan-300/30" />
        <div className="absolute left-1/2 top-[18%] flex -translate-x-1/2 gap-[2vw]">
          {['PLACEMENT SCAN', 'MMR ENGINE', 'SINGLE FEED'].map((t) => (
            <div
              key={t}
              {...screen(true)}
              className="flex h-[12vh] w-[16vw] max-w-[220px] flex-col justify-between rounded-sm border border-cyan-400/25 p-2 font-mono text-[9px] tracking-[0.2em] text-cyan-300/70"
              style={{ background: 'linear-gradient(180deg, rgba(8,47,73,0.55), rgba(2,6,23,0.8))', boxShadow: '0 0 24px rgba(34,211,238,0.12) inset' }}
            >
              <span>{t}</span>
              <span className="h-1 w-2/3 bg-cyan-400/30" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function HudBackdrop() {
  const world = useNova((s) => s.world);
  const phase = useNova((s) => s.phase);
  const systems = useNova((s) => s.systems);
  return (
    <div className="fixed inset-0" style={{ zIndex: 0 }}>
      {phase === 'warp' ? <Warp /> : world === 'newworld' ? <NewWorld /> : <Hangar lit={systems.power} />}
      <Cockpit />
    </div>
  );
}
