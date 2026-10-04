import { motion } from 'framer-motion';
import { GATE } from '../../core/content';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';

/** Brief black "vital signs" screen while the scene compiles; the wake-up then starts on its own. */
export default function Gate() {
  const phase = useNova((s) => s.phase);
  if (phase !== 'gate') return null;
  return (
    <div className="pointer-events-none fixed inset-0 grid place-items-center bg-black" style={{ zIndex: Z.gate }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.6, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
        className="hud-label text-center !text-red-400/80"
      >
        {GATE.lines[2]}
      </motion.div>
    </div>
  );
}
