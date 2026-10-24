import { motion } from 'framer-motion';
import { GATE } from '../../core/content';
import { Z } from '../../core/layers';
import { useNova } from '../../core/store';
import * as director from '../../core/director';
import PhotosensitiveWarning from './PhotosensitiveWarning';

/** Black "vital signs" screen: first the photosensitivity warning, then the wake-up starts immediately. */
export default function Gate() {
  const phase = useNova((s) => s.phase);
  const accepted = useNova((s) => s.warningAccepted);
  const introSeen = useNova((s) => s.introSeen);

  // Returning visitors skip the black screen gate entirely — zero black screen on revisit.
  if (phase !== 'gate' || introSeen) return null;

  return (
    <div
      onClick={() => accepted && director.wake()}
      className={`fixed inset-0 grid place-items-center bg-black ${accepted ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
      style={{ zIndex: Z.gate }}
    >
      {accepted ? (
        <div className="flex flex-col items-center gap-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="hud-label text-center !text-red-400/80"
          >
            {GATE.lines[2]}
          </motion.div>
          <span className="font-mono text-[11px] tracking-wider text-white/40 uppercase">
            Click anywhere or press Enter to wake
          </span>
        </div>
      ) : (
        <PhotosensitiveWarning />
      )}
    </div>
  );
}
