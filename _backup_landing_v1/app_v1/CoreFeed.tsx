import { AnimatePresence, motion } from 'framer-motion';
import { Activity, BookOpen, ChevronRight, Cpu, ShieldAlert, Zap } from 'lucide-react';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';

export default function CoreFeed() {
  const open = useNova((s) => s.feedOpen);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="core-feed"
          className="fixed inset-0 flex flex-col p-4 sm:p-8 overflow-hidden"
          style={{ zIndex: Z.pillar + 2 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          transition={{ duration: 1.5 }}
        >
          {/* New Lounge Background Image with subtle panning effect */}
          <motion.img 
            src="/spaceship_lounge.jpg" 
            alt="Spaceship Lounge"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            initial={{ scale: 1.05 }}
            animate={{ scale: 1, x: [0, -10, 0], y: [0, -5, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
          
          {/* Subtle gradient to ensure the hologram board pops */}
          <div className="absolute inset-0 bg-gradient-to-t from-blue-950/80 via-blue-900/30 to-black/60 pointer-events-none" />

          {/* Main Holographic Board - Now positioned with 3D perspective */}
          <div className="relative flex-1 flex gap-6 w-full max-w-7xl mx-auto h-full max-h-[85vh] mt-auto backdrop-blur-sm" style={{ perspective: '1000px' }}>
            
            {/* Left Column: Curriculum / Lessons */}
            <motion.div 
              className="flex-1 flex flex-col bg-black/60 border border-cyan-400/50 rounded-xl overflow-hidden shadow-[0_0_80px_rgba(6,182,212,0.2)] ring-1 ring-white/10"
              initial={{ rotateX: 5, rotateY: -2, y: 50, opacity: 0 }}
              animate={{ rotateX: 0, rotateY: 0, y: 0, opacity: 1 }}
              transition={{ delay: 0.8, type: 'spring', damping: 20 }}
            >
              <div className="p-5 border-b border-cyan-500/20 bg-cyan-950/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="text-cyan-400" size={20} />
                  <h3 className="font-display font-bold tracking-widest text-cyan-50">ACTIVE_CURRICULUM</h3>
                </div>
                <div className="text-[10px] font-mono text-cyan-500/70">MODULE_01</div>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                  {/* Mock Lesson Content (This will be fed by the RAG system) */}
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-4">Understanding Neural Networks</h2>
                    <p className="text-blue-100/80 leading-relaxed text-sm mb-4">
                      A neural network is a series of algorithms that endeavors to recognize underlying relationships in a set of data through a process that mimics the way the human brain operates. In this sense, neural networks refer to systems of neurons, either organic or artificial in nature.
                    </p>
                    <div className="bg-blue-950/40 border border-blue-500/20 p-4 rounded-md font-mono text-xs text-blue-200">
                      // RAG System Output<br/>
                      [+] Initializing perceptron layers...<br/>
                      [+] Adjusting weights and biases...<br/>
                      [+] Output ready for consumption.
                    </div>
                  </div>

                  <HudButton variant="secondary" className="w-full mt-4">
                    Generate Simpler Explanation
                  </HudButton>
                </div>
              </div>
            </motion.div>

            {/* Right Column: MMR, Stats, Challenges */}
            <motion.div 
              className="w-80 flex flex-col gap-6"
              initial={{ rotateX: 5, rotateY: 2, y: 50, opacity: 0 }}
              animate={{ rotateX: 0, rotateY: 0, y: 0, opacity: 1 }}
              transition={{ delay: 0.9, type: 'spring', damping: 20 }}
            >
              {/* Stat Card */}
              <div className="bg-black/60 border border-emerald-400/50 rounded-xl p-5 shadow-[0_0_30px_rgba(52,211,153,0.15)] ring-1 ring-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="text-emerald-400" size={18} />
                  <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider">USER_STATS</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-emerald-500/70 mb-1">MMR_RANK</div>
                    <div className="font-display text-2xl text-white">1,405</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-500/70 mb-1">LEVEL</div>
                    <div className="font-display text-2xl text-white">04</div>
                  </div>
                </div>
              </div>

              {/* Challenge Card */}
              <div className="flex-1 bg-black/60 border border-rose-400/50 rounded-xl p-5 flex flex-col shadow-[0_0_40px_rgba(244,63,94,0.15)] ring-1 ring-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <ShieldAlert size={100} className="text-rose-500" />
                </div>
                <div className="flex items-center gap-2 mb-6 relative z-10">
                  <Zap className="text-rose-400" size={18} />
                  <span className="font-mono text-xs font-bold text-rose-400 tracking-wider">PvE_CHALLENGE</span>
                </div>
                
                <p className="text-sm text-rose-100/90 leading-relaxed mb-auto relative z-10">
                  A rogue subroutine is demanding you explain the difference between a forward pass and backpropagation before it releases the next sector data.
                </p>
                
                <HudButton variant="primary" className="w-full relative z-10 mt-6 !border-rose-500/50 hover:!bg-rose-950/50">
                  Engage Subroutine <ChevronRight size={16} />
                </HudButton>
              </div>
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
