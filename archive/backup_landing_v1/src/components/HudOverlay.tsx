import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function HudOverlay() {
  const [systemStats, setSystemStats] = useState({
    velocity: 0,
    shields: 100,
    neuralSync: 0,
  });

  // Simulate stats ticking up over time
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStats(prev => ({
        velocity: Math.min(prev.velocity + Math.random() * 800, 99999),
        shields: Math.max(prev.shields - Math.random() * 0.3, 87),
        neuralSync: Math.min(prev.neuralSync + Math.random() * 2, 100),
      }));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>

      {/* Corner brackets — cockpit frame */}
      {/* Top-left */}
      <div className="absolute top-4 left-4">
        <div className="w-16 h-16 border-t-2 border-l-2 border-cyan-500/50" />
        <div className="mt-2 text-[10px] font-mono text-cyan-500/60 tracking-widest">SYS.OK</div>
      </div>
      {/* Top-right */}
      <div className="absolute top-4 right-4">
        <div className="w-16 h-16 border-t-2 border-r-2 border-cyan-500/50 ml-auto" />
        <div className="mt-2 text-[10px] font-mono text-cyan-500/60 tracking-widest text-right">NAV.LOCK</div>
      </div>
      {/* Bottom-left */}
      <div className="absolute bottom-4 left-4">
        <div className="mb-2 text-[10px] font-mono text-cyan-500/60 tracking-widest">COMMS.ACTIVE</div>
        <div className="w-16 h-16 border-b-2 border-l-2 border-cyan-500/50" />
      </div>
      {/* Bottom-right */}
      <div className="absolute bottom-4 right-4">
        <div className="mb-2 text-[10px] font-mono text-cyan-500/60 tracking-widest text-right">REC ●</div>
        <div className="w-16 h-16 border-b-2 border-r-2 border-cyan-500/50 ml-auto" />
      </div>

      {/* Left side — velocity readout */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-4"
      >
        <div className="text-[10px] font-mono text-cyan-400/70 tracking-wider">
          <div className="text-cyan-500/40 mb-1">VELOCITY</div>
          <div className="text-lg tabular-nums">{Math.floor(systemStats.velocity).toLocaleString()}</div>
          <div className="text-cyan-500/30">km/s</div>
        </div>
        <div className="w-[1px] h-20 bg-gradient-to-b from-cyan-500/40 to-transparent" />
        <div className="text-[10px] font-mono text-cyan-400/70 tracking-wider">
          <div className="text-cyan-500/40 mb-1">SHIELDS</div>
          <div className="text-lg tabular-nums">{systemStats.shields.toFixed(1)}%</div>
          {/* Mini bar */}
          <div className="w-16 h-1 bg-cyan-900/50 mt-1 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400/60 rounded-full" style={{ width: `${systemStats.shields}%` }} />
          </div>
        </div>
      </motion.div>

      {/* Right side — neural sync readout */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2.5, duration: 1 }}
        className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-end gap-4"
      >
        <div className="text-[10px] font-mono text-cyan-400/70 tracking-wider text-right">
          <div className="text-cyan-500/40 mb-1">NEURAL SYNC</div>
          <div className="text-lg tabular-nums">{systemStats.neuralSync.toFixed(1)}%</div>
          <div className="w-16 h-1 bg-cyan-900/50 mt-1 rounded-full overflow-hidden ml-auto">
            <motion.div
              className="h-full bg-emerald-400/60 rounded-full"
              style={{ width: `${systemStats.neuralSync}%` }}
            />
          </div>
        </div>
        <div className="w-[1px] h-20 bg-gradient-to-b from-cyan-500/40 to-transparent" />
        <div className="text-[10px] font-mono text-cyan-400/70 tracking-wider text-right">
          <div className="text-cyan-500/40 mb-1">SUBJECT</div>
          <div className="text-sm">LVL 1 — NOOB</div>
        </div>
      </motion.div>

      {/* Bottom center — targeting crosshair / focus reticle */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 text-[9px] font-mono text-cyan-500/40 tracking-[0.3em]">
          <div className="w-8 h-[1px] bg-cyan-500/30" />
          DESTINATION LOCKED
          <div className="w-8 h-[1px] bg-cyan-500/30" />
        </div>
      </div>

      {/* Center crosshair reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          animate={{ opacity: [0.1, 0.3, 0.1], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-24 h-24 rounded-full border border-cyan-500/20 flex items-center justify-center"
        >
          <div className="w-12 h-12 rounded-full border border-cyan-500/10" />
          {/* Crosshair lines */}
          <div className="absolute w-[1px] h-6 bg-cyan-500/20 -top-1" />
          <div className="absolute w-[1px] h-6 bg-cyan-500/20 -bottom-1" />
          <div className="absolute h-[1px] w-6 bg-cyan-500/20 -left-1" />
          <div className="absolute h-[1px] w-6 bg-cyan-500/20 -right-1" />
        </motion.div>
      </div>
    </div>
  );
}
