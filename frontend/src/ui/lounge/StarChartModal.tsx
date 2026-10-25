import { AnimatePresence, motion } from 'framer-motion';
import { Compass, Globe, Lock, Sparkles, X, Orbit, Wind, Flame, Snowflake, Droplets, ShieldAlert, Rocket, Wrench } from 'lucide-react';
import { audio } from '../../core/audio';
import { useActiveCourse } from '../../core/course';
import { setPlanet, usePlanets } from '../../core/planets';
import { devFlyTo } from '../../core/director';
import { useDevAtlas, visitedWorlds } from '../../core/tour';
import { PLANETS } from '../../three/space/planets';
import { useNova } from '../../core/store';
import { Z } from '../../core/layers';

interface Props {
  open?: boolean;
  onClose?: () => void;
}

const STRUCTURE_NAMES = [
  'Archipelago & Coral Trenches',
  'Caldera Basalt & Magma Rifts',
  'Glacial Ice Facets & Chasms',
  'Multi-Band Gas Tempest',
  'Crater Bedrock & Ejecta Rays',
  'Logarithmic Cyclone Spiral',
  'Canyon Mesa & Stepped Terraces',
  'Cybernetic Spire & Data Grid',
  'Toxic Acid Basin & Sulfur Vents',
  'Continental Mantle Fracture',
  'Crystal Geodes & Glowing Seams',
  'Cracked Magma Shell',
  'Moss Canopy & Bright Rivers',
  'Copper Plates & Vents',
  'Glowing Reef Deeps',
  'Magnetic Ribbon Bands',
  'Wind-Rippled Dunes',
  'Aurora Ice Caps',
  'Island Archipelago Sea',
  'Hex Storm Bands',
];

const BIOME_INFO: Record<string, { label: string; icon: typeof Globe; color: string; lookFor: string }> = {
  ocean: {
    label: 'Neural Ocean & Bioluminescence',
    icon: Droplets,
    color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/30',
    lookFor: 'Soft cyan cosmic dust haze catching sunlight; bioluminescent colonies on night limb.',
  },
  ice: {
    label: 'Glacial Ice & Diamond Dust',
    icon: Snowflake,
    color: 'text-sky-300 border-sky-400/40 bg-sky-950/30',
    lookFor: 'Glittering crystalline diamond ice dust sparkles drifting around the ship in orbit.',
  },
  ember: {
    label: 'Volcanic Magma & Ash',
    icon: Flame,
    color: 'text-amber-400 border-amber-500/40 bg-amber-950/30',
    lookFor: 'Glowing red-orange ember sparks & dark basalt ash clouds drifting across deep vacuum.',
  },
  dust: {
    label: 'Planetary Dust Storm & Rings',
    icon: Wind,
    color: 'text-yellow-400 border-yellow-500/40 bg-yellow-950/30',
    lookFor: 'Dense copper/gold planetary particulate streamers blowing outward from orbital rings.',
  },
  mist: {
    label: 'Dense Cosmic Cloud & Nebula',
    icon: Sparkles,
    color: 'text-purple-400 border-purple-500/40 bg-purple-950/30',
    lookFor: 'Volumetric cosmic fog veil and glowing pastel aurora mist enveloping the orbital plane.',
  },
  toxic: {
    label: 'Ionized Acid Atmosphere',
    icon: ShieldAlert,
    color: 'text-lime-400 border-lime-500/40 bg-lime-950/30',
    lookFor: 'Translucent emerald/yellow ionized gas clouds drifting in turbulent upper orbit.',
  },
};

export default function StarChartModal({ open: propOpen, onClose: propClose }: Props = {}) {
  const storeOpen = useNova((s) => s.starChartOpen);
  const isOpen = propOpen ?? storeOpen;
  const currentPlanet = usePlanets((s) => s.index);
  // A course has one planet per module; only the ones the ship has reached can be visited again, the rest open as modules are finished.
  const course = useActiveCourse();
  const dev = useDevAtlas((s) => s.on);
  const total = dev ? PLANETS.length : Math.min(PLANETS.length, course?.course.modules.length ?? PLANETS.length);
  const reached = dev || !course ? PLANETS.length : visitedWorlds();

  const close = () => {
    if (propClose) propClose();
    useNova.getState().setStarChartOpen(false);
  };

  const flyTo = (index: number) => {
    if (devFlyTo(index)) close();
    else useNova.getState().notify({ kind: 'toast', title: 'Not now', lines: ['Fly from the lounge, once the ship has landed.'], ttl: 3 });
  };

  const jumpTo = (index: number) => {
    audio.play('pulse');
    const newIdx = setPlanet(index);
    const spec = PLANETS[newIdx];
    useNova.getState().notify({
      kind: 'toast',
      title: `🪐 Orbiting World [${newIdx + 1}/20]: ${spec.name}`,
      lines: [`Orbital Biome: ${BIOME_INFO[spec.look.spaceBiome ?? 'dust'].label}`],
      ttl: 4,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="pointer-events-auto fixed inset-0 grid place-items-center bg-black/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
          style={{ zIndex: Z.landing + 10 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-cyan-500/30 bg-slate-950/95 shadow-2xl shadow-cyan-950/50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cyan-500/20 px-6 py-4 bg-slate-900/60">
              <div className="flex items-center gap-3">
                <Compass className="text-cyan-400 animate-pulse" size={24} />
                <div>
                  <h2 className="font-display text-lg font-bold tracking-wider text-white">
                    {dev ? 'DEV ATLAS · ALL WORLDS' : 'STAR CHART · ORBITAL NAVIGATION'}
                  </h2>
                  <p className="text-xs text-white/50">
                    {dev ? (
                      <>
                        <Wrench size={11} className="mr-1 inline text-amber-300" />
                        Developer view: every world is open. <b className="font-semibold text-white/70">Set location</b> moves the ship at once; <b className="font-semibold text-white/70">Fly here</b> plays the real launch and warp to that world. Nothing is earned or spent. Type <span className="font-mono text-cyan-300">devatlas</span> again to close.
                      </>
                    ) : (
                      <>
                    Every module of your course is a world; finishing one opens the next. Type <span className="text-cyan-300 font-mono">planet</span> to cycle the worlds you have reached, or <span className="text-cyan-300 font-mono">orbit</span> / <span className="text-cyan-300 font-mono">atlas</span> to toggle this chart.
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close star chart"
              >
                <X size={20} />
              </button>
            </div>

            {/* Planet Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-3 p-5 overflow-y-auto">
              {PLANETS.slice(0, total).map((p, idx) => {
                const isCurrent = currentPlanet === idx;
                const locked = idx >= reached;
                const biomeKey = p.look.spaceBiome ?? (p.look.mist ? 'mist' : p.look.lava ? 'ember' : p.look.ice ? 'ice' : 'dust');
                const info = BIOME_INFO[biomeKey] ?? BIOME_INFO.dust;
                const IconComponent = info.icon;

                return (
                  <div
                    key={p.name}
                    className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all ${
                      isCurrent
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/50'
                        : 'border-white/10 bg-slate-900/40 hover:border-white/20 hover:bg-slate-900/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-cyan-400/80 font-bold">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-display font-semibold text-white tracking-wide text-base">
                            {p.name}
                          </span>
                        </div>
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/50 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 uppercase tracking-wider">
                            <Orbit size={11} className="animate-spin" /> In Orbit
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-white/40">
                            Dist: {p.distance}u
                          </span>
                        )}
                      </div>

                      {/* Biome & Stellar Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] border font-medium ${info.color}`}>
                          <IconComponent size={12} />
                          {p.env.label}
                        </span>
                        {p.look.structure !== undefined && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] border border-cyan-500/30 bg-cyan-950/40 text-cyan-200 font-mono">
                            {STRUCTURE_NAMES[p.look.structure] ?? 'Procedural Surface'}
                          </span>
                        )}
                        {p.stellarClass && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border border-amber-500/25 bg-amber-950/30 text-amber-300 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: p.sunColor, boxShadow: `0 0 4px ${p.sunColor}` }} />
                            {p.stellarClass}
                          </span>
                        )}
                        {p.ring && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] border border-white/10 bg-white/5 text-white/60">
                            Rings
                          </span>
                        )}
                        {p.moons.length > 0 && (
                          <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-[10px] border border-white/10 bg-white/5 text-white/80">
                            <span>{p.moons.length} Moons:</span>
                            <span className="inline-flex items-center gap-1">
                              {p.moons.map((m, mIdx) => (
                                <span
                                  key={mIdx}
                                  className="w-2 h-2 rounded-full inline-block"
                                  style={{ backgroundColor: m.tint, boxShadow: `0 0 5px ${m.tint}` }}
                                  title={`Moon ${mIdx + 1} (${m.tint})`}
                                />
                              ))}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Look out for in space */}
                      <p className="text-xs text-white/70 leading-relaxed mb-3">
                        <span className="text-white/40 font-semibold mr-1">Orbital Env:</span>
                        {info.lookFor}
                      </p>
                    </div>

                    {dev ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" disabled={isCurrent} onClick={() => jumpTo(idx)} className="flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wider text-white transition-all hover:border-cyan-400 hover:bg-cyan-500/20 disabled:cursor-default disabled:border-cyan-400/40 disabled:bg-cyan-500/10 disabled:text-cyan-300">
                          {isCurrent ? 'STATION PARKED' : 'SET LOCATION'}
                        </button>
                        <button type="button" disabled={isCurrent} onClick={() => flyTo(idx)} className="flex items-center justify-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold tracking-wider text-amber-200 transition-all hover:bg-amber-500/20 disabled:cursor-default disabled:opacity-40">
                          <Rocket size={12} /> FLY HERE
                        </button>
                      </div>
                    ) : (
                    <button
                      type="button"
                      disabled={isCurrent || locked}
                      onClick={() => jumpTo(idx)}
                      className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold tracking-wider transition-all flex items-center justify-center gap-2 ${
                        locked
                          ? 'border border-white/10 bg-white/[0.03] text-white/40 cursor-not-allowed'
                          : isCurrent
                          ? 'border border-cyan-400/40 bg-cyan-500/10 text-cyan-300 cursor-default'
                          : 'border border-white/15 bg-white/5 text-white hover:border-cyan-400 hover:bg-cyan-500/20 active:scale-[0.98]'
                      }`}
                    >
                      {locked ? (
                        <>
                          <Lock size={12} /> LOCKED · FINISH PLANET {idx}
                        </>
                      ) : isCurrent ? (
                        'STATION PARKED'
                      ) : (
                        'JUMP TO ORBIT'
                      )}
                    </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-cyan-500/20 px-6 py-3 bg-slate-900/60 text-xs text-white/40">
              <span>{reached} of {total} worlds reached</span>
              <button
                type="button"
                onClick={close}
                className="text-cyan-400 hover:text-cyan-300 underline font-mono"
              >
                Close [Esc]
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
