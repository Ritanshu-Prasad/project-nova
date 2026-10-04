import { SkipForward, Volume2, VolumeX } from 'lucide-react';
import { skipIntro } from '../../core/director';
import { Z } from '../../core/layers';
import { INTRO_PHASES, useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';

/** Always-reachable "Skip intro" + sound toggle during the cinematic. */
export default function SkipIntro() {
  const phase = useNova((s) => s.phase);
  const soundOn = useNova((s) => s.soundOn);
  if (!INTRO_PHASES.includes(phase)) return null;
  return (
    <div className="pointer-events-auto fixed bottom-6 right-6 flex gap-2" style={{ zIndex: Z.skip }}>
      <HudButton size="sm" aria-label={soundOn ? 'Mute sound' : 'Unmute sound'} onClick={() => useNova.getState().toggleSound()} icon={soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />} />
      <HudButton size="sm" onClick={skipIntro} icon={<SkipForward size={14} />}>
        Skip intro <span className="ml-1 opacity-50">Esc</span>
      </HudButton>
    </div>
  );
}
