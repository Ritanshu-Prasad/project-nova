import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Terminal, Zap } from 'lucide-react';
import StarfieldCanvas from './components/StarfieldCanvas';
import HudOverlay from './components/HudOverlay';
import PerspectiveGrid from './components/PerspectiveGrid';
import Planets from './components/Planets';

export default function App() {
  const [phase, setPhase] = useState<'boot' | 'launch' | 'main'>('boot');

  useEffect(() => {
    // Phase 1 → 2: Boot sequence finishes after 4s
    const bootTimer = setTimeout(() => setPhase('launch'), 4000);
    // Phase 2 → 3: Launch settles into main screen after 6.5s
    const launchTimer = setTimeout(() => setPhase('main'), 6500);
    return () => {
      clearTimeout(bootTimer);
      clearTimeout(launchTimer);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-black flex items-center justify-center overflow-hidden font-mono text-white selection:bg-cyan-500/30">

      {/* === LAYER 0: Deep space starfield (always running) === */}
      <StarfieldCanvas />

      {/* === LAYER 0.5: Distant planets with glow and rings === */}
      <Planets />

      {/* === LAYER 1: Perspective ground grid (TRON-style) === */}
      <PerspectiveGrid />

      {/* === Boot-only scanline (plays once during boot, then gone) === */}
      {phase === 'boot' && (
        <motion.div
          className="fixed top-0 left-0 w-full h-[2px] pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,255,0.6), transparent)', zIndex: 2 }}
          initial={{ y: 0 }}
          animate={{ y: window.innerHeight }}
          transition={{ duration: 3.5, ease: 'linear' }}
        />
      )}

      {/* === LAYER 2: Animated nebula / glow blobs === */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <motion.div
          animate={{ x: [0, 50, -30, 0], y: [0, -40, 20, 0], scale: [1, 1.2, 0.9, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -60, 40, 0], y: [0, 30, -50, 0], scale: [1, 0.8, 1.3, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{ x: [0, 30, -20, 0], y: [0, -20, 40, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px]"
        />
      </div>

      {/* === LAYER 3: Cockpit HUD overlay (appears after boot) === */}
      {phase !== 'boot' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2 }}>
          <HudOverlay />
        </motion.div>
      )}

      {/* === LAYER 4: Content === */}
      <div className="relative flex flex-col items-center justify-center w-full max-w-4xl p-6" style={{ zIndex: 10 }}>
        <AnimatePresence mode="wait">

          {/* ── PHASE 1: TERMINAL BOOT-UP ── */}
          {phase === 'boot' && (
            <motion.div
              key="boot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.05, filter: 'blur(12px)' }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-start w-full max-w-lg bg-black/70 p-8 rounded-lg border border-cyan-500/30 shadow-[0_0_40px_rgba(0,255,255,0.15)] backdrop-blur-md"
            >
              <div className="flex items-center gap-3 mb-6 text-cyan-400">
                <Terminal size={20} className="animate-pulse" />
                <span className="text-sm font-bold tracking-widest uppercase">System Initializing</span>
              </div>

              {[
                { text: '&gt; Establishing neural uplink...', delay: 0.3 },
                { text: '&gt; Scanning knowledge vectors... [768 dimensions]', delay: 1.0 },
                { text: '&gt; Subject classification: NOOB_LVL_1', delay: 1.8 },
                { text: '&gt; Calibrating adaptive MMR engine...', delay: 2.5 },
                { text: '&gt; LAUNCH SEQUENCE ENGAGED', delay: 3.2, highlight: true },
              ].map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: line.delay, duration: 0.3 }}
                  className={`text-xs md:text-sm mb-2 font-medium flex items-center gap-2 ${
                    line.highlight
                      ? 'text-cyan-300 mt-4 font-bold text-base'
                      : 'text-emerald-400'
                  }`}
                  dangerouslySetInnerHTML={{ __html: line.text }}
                />
              ))}

              {/* Loading bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 3.0 }}
                className="w-full mt-4"
              >
                <div className="w-full h-1 bg-cyan-900/40 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ delay: 3.0, duration: 1, ease: 'easeInOut' }}
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full shadow-[0_0_10px_rgba(0,255,255,0.5)]"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ── PHASE 2: LAUNCH / WARP TRANSITION ── */}
          {phase === 'launch' && (
            <motion.div
              key="launch"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1.1, 1.5] }}
              transition={{ duration: 2.5, times: [0, 0.3, 0.7, 1] }}
              className="flex flex-col items-center"
            >
              <Zap size={80} className="text-cyan-400 mb-6 drop-shadow-[0_0_30px_rgba(0,255,255,0.8)]" />
              <div className="text-3xl md:text-5xl font-black tracking-widest text-cyan-300 drop-shadow-[0_0_30px_rgba(0,255,255,0.5)]">
                ENTERING NEW WORLD
              </div>
            </motion.div>
          )}

          {/* ── PHASE 3: MAIN LANDING PAGE ── */}
          {phase === 'main' && (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="flex flex-col items-center text-center w-full"
            >
              {/* Level badge */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mb-6 px-5 py-2 rounded-full bg-black/60 border border-cyan-500/40 flex items-center gap-3 text-xs md:text-sm font-semibold text-cyan-300 shadow-[0_0_20px_rgba(0,255,255,0.15)] backdrop-blur-md"
              >
                <Fingerprint size={16} className="animate-pulse text-cyan-400" />
                <span className="tracking-widest">STATUS: UNRANKED — LEVEL 1</span>
              </motion.div>

              {/* Massive Title */}
              <motion.h1
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.8, type: 'spring' }}
                className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-100 to-cyan-600"
                style={{ textShadow: '0 0 80px rgba(0,255,255,0.3)' }}
              >
                PROJECT NOVA
              </motion.h1>

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="max-w-xl text-cyan-100/60 mb-10 text-sm md:text-lg font-medium leading-relaxed"
              >
                You've just woken up in a world where knowledge is power.
                <br />
                <span className="text-cyan-300/80">The AI is waiting. Will you level up?</span>
              </motion.p>

              {/* Google Login Button */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(0,255,255,0.4)' }}
                whileTap={{ scale: 0.95 }}
                className="group relative flex items-center justify-center gap-4 bg-white text-black px-8 py-5 rounded-sm font-bold uppercase tracking-widest overflow-hidden min-w-[320px] cursor-pointer"
              >
                {/* Hover gradient sweep */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Google G icon */}
                <svg className="w-6 h-6 relative z-10 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>

                <span className="relative z-10 group-hover:text-white transition-colors duration-300">
                  Initialize Identity
                </span>

                {/* Cyberpunk HUD corners */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-black group-hover:border-white m-1 transition-colors z-10" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-black group-hover:border-white m-1 transition-colors z-10" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-black group-hover:border-white m-1 transition-colors z-10" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-black group-hover:border-white m-1 transition-colors z-10" />
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
