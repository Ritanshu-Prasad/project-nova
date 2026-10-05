import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { audio } from '../../core/audio';
import { useNova } from '../../core/store';

export default function BlastDoors() {
  const [doorsOpen, setDoorsOpen] = useState(false);
  const isTransitioning = useNova((s) => s.isTransitioning);
  const themeColor = useNova((s) => s.themeColor);

  useEffect(() => {
    if (isTransitioning) {
      // Start closed when transitioning begins
      setDoorsOpen(false);
      
      // Wait for the UI underneath to swap, then open the doors
      const timer = setTimeout(() => {
        setDoorsOpen(true);
        audio.play('doorOpen'); 
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div 
          className="fixed inset-0 z-[999] flex overflow-hidden pointer-events-none"
          exit={{ opacity: 0 }}
        >
          {/* Left Door - White Sci-Fi with Theme Color glow */}
          <motion.div 
            className="w-1/2 h-full bg-slate-50 flex items-center justify-end pr-4 relative"
            style={{
              borderRight: `4px solid ${themeColor}`,
              boxShadow: `5px 0 30px ${themeColor}40`
            }}
            initial={{ x: 0 }}
            animate={{ x: doorsOpen ? '-100%' : 0 }}
            transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
          >
            {/* Clean minimalist sci-fi texture */}
            <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgwLDAsMCwwLjUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] mix-blend-overlay" />
            
            {/* Mechanical details */}
            <div className="w-16 h-48 border-y border-l rounded-l-md opacity-20 bg-slate-200" style={{ borderColor: themeColor }} />
            
            {!doorsOpen && (
              <motion.div 
                className="absolute right-6 font-mono text-sm tracking-widest font-bold"
                style={{ color: themeColor }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.5, 1] }}
                transition={{ duration: 0.5 }}
              >
                SYNC_
              </motion.div>
            )}
          </motion.div>
          
          {/* Right Door */}
          <motion.div 
            className="w-1/2 h-full bg-slate-50 flex items-center justify-start pl-4 relative"
            style={{
              borderLeft: `4px solid ${themeColor}`,
              boxShadow: `-5px 0 30px ${themeColor}40`
            }}
            initial={{ x: 0 }}
            animate={{ x: doorsOpen ? '100%' : 0 }}
            transition={{ duration: 1.5, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgwLDAsMCwwLjUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] mix-blend-overlay" />
            
            <div className="w-16 h-48 border-y border-r rounded-r-md opacity-20 bg-slate-200" style={{ borderColor: themeColor }} />
            
            {!doorsOpen && (
              <motion.div 
                className="absolute left-6 font-mono text-sm tracking-widest font-bold"
                style={{ color: themeColor }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0.5, 1] }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                _OK
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
