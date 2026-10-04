import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Target, Zap, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';
import * as director from '../../core/director';

const PRESETS = [
  { id: 'react', label: 'Advanced React Patterns', icon: <BookOpen size={14} /> },
  { id: 'math', label: 'Linear Algebra Basics', icon: <Target size={14} /> },
  { id: 'biology', label: 'Cellular Biology', icon: <Zap size={14} /> },
];

export default function CurriculumSetup() {
  const open = useNova((s) => s.curriculumOpen);
  const themeColor = useNova((s) => s.themeColor);
  const activeObjective = useNova((s) => s.activeObjective);
  const [objective, setObjective] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const startTransition = (finalObjective: string) => {
    setIsGenerating(true);
    useNova.getState().setActiveObjective(finalObjective);

    // 1. Drop the blast doors immediately
    useNova.getState().setIsTransitioning(true);

    // 2. While doors are closed (at 500ms), swap out the background and UI
    setTimeout(() => {
      useNova.getState().setCurriculumOpen(false);
      useNova.getState().setFeedOpen(true);
      // Ensures the 3D ship cockpit is fully active behind the doors
      director.debugJump('landed');
      
      useNova.getState().notify({ 
        kind: 'system', 
        title: 'Network Sync', 
        lines: ['RAG pipeline active.', 'Entering PvE Learning Arena...'] 
      });
    }, 500);

    // 3. Clear generating state and close doors
    setTimeout(() => {
      setIsGenerating(false);
      useNova.getState().setIsTransitioning(false);
    }, 3500);
  };

  const handleGenerate = () => {
    if (!objective.trim()) return;
    startTransition(objective.trim());
  };

  const handleContinue = () => {
    if (activeObjective) {
      startTransition(activeObjective);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="curriculum-setup"
          // We remove the solid slate-950 to let the 3D engine shine through
          className="fixed inset-0 flex flex-col items-center justify-center p-4 sm:p-6"
          style={{ zIndex: Z.pillar + 4 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          transition={{ duration: 1 }}
        >
          {/* Subtle dark gradient overlay to ensure text is readable over bright 3D spots */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 to-black/80 backdrop-blur-[6px] pointer-events-none" />
          
          <motion.div
            className="relative w-full max-w-2xl bg-black/40 border border-cyan-500/30 rounded-xl p-6 sm:p-10 shadow-[0_0_50px_rgba(6,182,212,0.15)] ring-1 ring-white/10 backdrop-blur-xl overflow-hidden"
            initial={{ y: 30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 25, stiffness: 200 }}
          >
            {/* High-tech scanning line decoration */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent opacity-50" />
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent opacity-50" />

            <div className="mb-8 text-center relative z-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-cyan-950/50 text-cyan-400 mb-4 ring-1 ring-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <Target size={26} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-wide drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                Define Learning Objective
              </h2>
              <p className="mt-3 text-cyan-100/70 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
                What do you want to master today? Describe your goal, and the system will dynamically generate a personalized curriculum.
              </p>
            </div>

            <div className="space-y-6 relative z-10">
              {/* Main Input */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-lg opacity-20 group-hover:opacity-30 transition duration-500 blur" />
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="e.g., I want to understand how Transformers work in AI, starting from basic neural networks..."
                  className="relative w-full h-32 bg-black/60 border border-cyan-500/30 rounded-lg p-5 text-white placeholder:text-blue-200/40 focus:outline-none focus:border-cyan-400/80 focus:ring-1 focus:ring-cyan-400/50 transition-all resize-none text-sm leading-relaxed font-mono"
                />
              </div>

              {/* Quick Presets */}
              <div>
                <p className="text-xs font-semibold text-cyan-500/70 uppercase tracking-wider mb-3">Quick Objectives</p>
                <div className="flex flex-wrap gap-3">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setObjective(preset.label)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-950/40 border border-cyan-500/20 text-xs text-cyan-200 hover:bg-cyan-900/60 hover:text-white hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
                    >
                      <span className="text-emerald-400">{preset.icon}</span>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-cyan-500/30 flex flex-col sm:flex-row gap-4">
                <HudButton 
                  variant="primary" 
                  size="lg" 
                  className="flex-1 group"
                  onClick={handleGenerate}
                  style={{ borderColor: themeColor }}
                >
                  {isGenerating ? (
                    <span className="animate-pulse flex items-center justify-center gap-2">
                      <Zap size={16} style={{ color: themeColor }} />
                      Initializing Pipeline...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Generate Curriculum
                      <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </HudButton>

                {activeObjective && (
                  <HudButton 
                    variant="secondary" 
                    size="lg" 
                    className="flex-1 group"
                    onClick={handleContinue}
                  >
                    <span className="flex items-center justify-center gap-2">
                      Resume Active Lesson
                    </span>
                  </HudButton>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
