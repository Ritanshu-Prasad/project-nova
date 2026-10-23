import { AnimatePresence, motion } from 'framer-motion';
import { Gauge } from 'lucide-react';
import { chooseLevel, LEVEL_LABEL, useGraphics } from '../../core/graphics';
import { Z } from '../../core/layers';
import { HudButton } from '../common/HudButton';

/** Appears when frames keep running long even at the lowest resolution: offers the next lighter graphics level. */
export default function LighterGraphicsPrompt() {
  const suggest = useGraphics((s) => s.suggest);
  const dismiss = () => useGraphics.getState().setSuggest(null);
  return (
    <AnimatePresence>
      {suggest && (
        <motion.div
          key="lighter"
          role="alert"
          className="sys-window pointer-events-auto fixed bottom-5 left-5 max-w-[22rem] p-4"
          style={{ zIndex: Z.notices }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
        >
          <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
            <Gauge size={16} className="text-amber-300" aria-hidden="true" /> NOVA is running slowly
          </div>
          <p className="mt-1.5 text-sm text-white/70">
            Your device is struggling with the graphics. {suggest === 'none' ? 'Switch to a version without 3D?' : `Switch to ${LEVEL_LABEL[suggest]} graphics?`} You can change this any time in Settings.
          </p>
          <div className="mt-3 flex gap-2">
            <HudButton
              size="sm"
              variant="primary"
              onClick={() => {
                chooseLevel(suggest);
                dismiss();
              }}
            >
              Switch to {LEVEL_LABEL[suggest]}
            </HudButton>
            <HudButton size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </HudButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
