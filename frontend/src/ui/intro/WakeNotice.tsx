import { AnimatePresence } from 'framer-motion';
import { WAKE_NOTICE } from '../../core/content';
import { TIMING } from '../../core/director';
import { useNova } from '../../core/store';
import { usePhaseTimeReached } from './introHooks';
import SystemWindow from './SystemWindow';
import TypedLines from './TypedLines';

/** Seconds the notice stays up once pre-flight starts, while the quest panel takes over. */
const LINGER = 2.4;

/** "You have awakened." — the first System window, centred at ~34% height near the end of the wake. */
export default function WakeNotice() {
  const phase = useNova((s) => s.phase);
  const rm = useNova((s) => s.reducedMotion);
  const powerOn = useNova((s) => s.systems.power);
  const due = usePhaseTimeReached('wake', rm ? TIMING.wakeNotice_rm : TIMING.wakeNotice);
  const expired = usePhaseTimeReached('preflight', LINGER);
  const show = due || (phase === 'preflight' && !expired && !powerOn);

  return (
    <div className="absolute left-1/2 top-[34%] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2">
      <AnimatePresence>
        {show && (
          <SystemWindow key="wake-notice" kind="system" title={WAKE_NOTICE.title} align="center">
            <TypedLines
              lines={WAKE_NOTICE.lines}
              cps={rm ? 80 : 58}
              delay={rm ? 0 : 0.5}
              gap={0.16}
              instant={rm}
              className="space-y-1.5 text-[15px] leading-relaxed text-blue-50/90 sm:text-base"
              labelClassName="text-blue-100/70"
              emClassName="intro-sw-em font-semibold tracking-wide"
            />
          </SystemWindow>
        )}
      </AnimatePresence>
    </div>
  );
}
