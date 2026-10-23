import { useEffect, useRef } from 'react';
import { TriangleAlert } from 'lucide-react';
import { audio } from '../../core/audio';
import { WARNING } from '../../core/content';
import { skipIntro } from '../../core/director';
import { useSettings } from '../../core/settings';
import { useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';

/**
 * Shown before anything else, while the screen is still black: the intro flashes and flickers. Nothing starts until
 * the visitor chooses. Skipping also turns on reduced effects. Asked on every visit (including after signing out).
 */
export default function PhotosensitiveWarning() {
  const safeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => safeRef.current?.focus(), []);

  const answer = (skip: boolean) => {
    void audio.init(); // a click is the gesture browsers need to start sound
    useNova.getState().setWarningAccepted(true);
    if (!skip) return;
    useSettings.getState().set({ motion: 'reduced' });
    skipIntro();
  };

  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center overflow-y-auto bg-black p-5">
      <div role="alertdialog" aria-modal="true" aria-labelledby="pw-title" aria-describedby="pw-body" className="w-full max-w-lg text-center">
        <TriangleAlert className="mx-auto text-amber-300" size={40} aria-hidden="true" />
        <h1 id="pw-title" className="mt-4 font-display text-2xl font-bold tracking-wide text-white sm:text-3xl">
          {WARNING.title}
        </h1>
        <div id="pw-body" className="mt-4 space-y-3 text-base leading-relaxed text-white/75">
          <p>{WARNING.body}</p>
          <p className="font-semibold text-amber-200">{WARNING.advice}</p>
        </div>
        <div className="mt-7 flex flex-col gap-3">
          <HudButton ref={safeRef} variant="primary" size="lg" className="w-full" onClick={() => answer(true)}>
            {WARNING.skip}
          </HudButton>
          <HudButton variant="ghost" size="lg" className="w-full" onClick={() => answer(false)}>
            {WARNING.play}
          </HudButton>
        </div>
        <p className="mt-5 text-xs text-white/45">{WARNING.note}</p>
      </div>
    </div>
  );
}
