import { lazy, Suspense, useEffect } from 'react';
import * as director from './core/director';
import { useGlobalInput } from './core/input';
import { rt } from './core/runtime';
import { PHASES, useNova, type Phase } from './core/store';
import Fallback from './three/Fallback';
import { ErrorBoundary } from './ui/common/ErrorBoundary';
import Cursor from './ui/hud/Cursor';
import Hud from './ui/hud/Hud';
import TopBar from './ui/hud/TopBar';
import Eyelids from './ui/intro/Eyelids';
import Gate from './ui/intro/Gate';
import IntroUI from './ui/intro/IntroUI';
import Notifications from './ui/intro/Notifications';
import SkipIntro from './ui/intro/SkipIntro';
import LandingHero from './ui/landing/LandingHero';
import LoginPopup from './ui/landing/LoginPopup';
import PillarPanel from './ui/landing/PillarPanel';
import CommsPanel from './ui/comms/CommsPanel';

/** The WebGL scene loads in its own chunk so the gate paints instantly. */
const Experience = lazy(() => import('./three/Experience'));

/**
 * Layer stack (see core/layers.ts): WebGL canvas → landing hero → HUD → pillar panel → intro UI
 * → top bar → eyelids → gate → notifications → skip control → cursor.
 * Every overlay decides its own visibility from the store phase.
 */
export default function App() {
  useGlobalInput();
  useEffect(() => director.startDirector(), []);
  useDevHooks();
  useAutoWake();
  const webglFailed = useNova((s) => s.webglFailed);

  return (
    <div className="nova-root">
      {webglFailed ? (
        <Fallback />
      ) : (
        <ErrorBoundary fallback={<Fallback />} onError={() => useNova.getState().setWebglFailed(true)}>
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </ErrorBoundary>
      )}
      <LandingHero />
      <Hud />
      <PillarPanel />
      <LoginPopup />
      <CommsPanel />
      <IntroUI />
      <TopBar />
      <Eyelids />
      <Gate />
      <Notifications />
      <SkipIntro />
      <Cursor />
    </div>
  );
}

/** No start button: the pilot wakes as soon as the scene is ready (or after a short safety timeout). */
function useAutoWake() {
  const ready = useNova((s) => s.sceneReady || s.webglFailed);
  useEffect(() => {
    if (new URLSearchParams(location.search).has('jump')) return;
    const go = () => useNova.getState().phase === 'gate' && director.wake();
    if (ready) {
      const id = setTimeout(go, 400);
      return () => clearTimeout(id);
    }
    const id = setTimeout(go, 6000);
    return () => clearTimeout(id);
  }, [ready]);
}

/** DEV: `window.__nova` for QA scripts, and `?jump=<phase>` to start mid-timeline. */
function useDevHooks() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __nova: unknown }).__nova = { rt, store: useNova, director };
    const jump = new URLSearchParams(location.search).get('jump') as Phase | null;
    if (jump && PHASES.includes(jump)) director.debugJump(jump);
  }, []);
}
