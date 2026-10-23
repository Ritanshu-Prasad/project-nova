import { motion } from 'framer-motion';
import { GATE } from '../../core/content';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';
import PhotosensitiveWarning from './PhotosensitiveWarning';

/** Black "vital signs" screen: first the photosensitivity warning, then (while the scene compiles) the wake-up starts on its own. */
export default function Gate() {
  const phase = useNova((s) => s.phase);
  const accepted = useNova((s) => s.warningAccepted);
  if (phase !== 'gate') return null;
  return (
    <div className="pointer-events-none fixed inset-0 grid place-items-center bg-black" style={{ zIndex: Z.gate }}>
      {accepted ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.6, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="hud-label text-center !text-red-400/80"
        >
          {GATE.lines[2]}
        </motion.div>
      ) : (
        <PhotosensitiveWarning />
      )}
    </div>
  );
}
