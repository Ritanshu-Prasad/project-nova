import { lazy, Suspense, useEffect } from 'react';
import * as director from './core/director';
import { useGlobalInput } from './core/input';
import * as journey from './core/journey';
import { useDeck } from './core/journey';
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
import UserSetupPopup from './ui/landing/UserSetupPopup';
import CurriculumSetup from './ui/app/CurriculumSetup';
import SettingsModal from './ui/hud/SettingsModal';
import Hub from './ui/lounge/Hub';
import { applyTheme } from './core/theme';
import { useHubQuiz } from './core/hubQuiz';
import { useCourse } from './core/course';
import { useHub, useProfile } from './core/hub';
import * as account from './core/account';
import * as graphics from './core/graphics';
import { useGraphics } from './core/graphics';
import LighterGraphicsPrompt from './ui/hud/LighterGraphicsPrompt';

/** The WebGL scene loads in its own chunk so the gate paints instantly. */
const Experience = lazy(() => import('./three/Experience'));

/**
 * Layer stack (see core/layers.ts): WebGL canvas → landing hero → HUD → pillar panel → intro UI
 * → top bar → eyelids → gate → notifications → skip control → cursor.
 * Every overlay decides its own visibility from the store phase.
 */
export default function App() {
  const isLoggedIn = useNova((s) => s.isLoggedIn);
  const deck = useDeck((s) => s.deck);
  useGlobalInput();

  useEffect(() => {
    const stop = director.startDirector();
    // Returning pilot: skip the cinematic — straight to the lounge (the course forge if they have no course yet).
    if (useNova.getState().isLoggedIn) {
      director.debugJump('landed');
      journey.enterLoungeNow();
      if (!Object.keys(useCourse.getState().library).length) useNova.getState().setCurriculumOpen(true);
    }
    // Confirms the remembered account and syncs its progress in the background.
    void account.restoreSession();
    return stop;
  }, []);
  
  useDevHooks();
  useAutoWake();
  useTheme();
  const webglFailed = useNova((s) => s.webglFailed);
  const level = useGraphics((s) => s.level);
  const gfxReady = useGraphics((s) => s.ready);
  useGraphicsLevel(level);

  return (
    <div className="nova-root">
      {/* "No 3D" never downloads the 3D engine. The scene mounts once the device check is done, and again on a new level. */}
      {webglFailed || level === 'none' || !gfxReady ? (
        <Fallback />
      ) : (
        <ErrorBoundary key={level} fallback={<Fallback />} onError={() => useNova.getState().setWebglFailed(true)}>
          <Suspense fallback={null}>
            <Experience key={level} />
          </Suspense>
        </ErrorBoundary>
      )}
      {deck === 'cockpit' && <Hud />}

      {/* Landing UI elements should NOT render once the user is logged in and in the app */}
      {!isLoggedIn && (
        <>
          <LandingHero />
          <PillarPanel />
          <LoginPopup />
        </>
      )}

      <Hub />
      <UserSetupPopup />
      <CurriculumSetup />
      <IntroUI />
      <TopBar />
      <SettingsModal />
      <LighterGraphicsPrompt />
      <Eyelids />
      <Gate />
      <Notifications />
      <SkipIntro />
      <Cursor />
    </div>
  );
}

/** Checks the device once at start-up; tags the page with the level so CSS can switch off the costly effects. */
function useGraphicsLevel(level: graphics.Level) {
  useEffect(() => graphics.detectGraphics(), []);
  useEffect(() => {
    document.documentElement.dataset.gfx = level;
  }, [level]);
}

/** The pilot's colour drives the accent everywhere (CSS variables, see core/theme.ts). */
function useTheme() {
  useEffect(() => {
    applyTheme(useNova.getState().themeColor);
    return useNova.subscribe((s, prev) => {
      if (s.themeColor !== prev.themeColor) applyTheme(s.themeColor);
    });
  }, []);
}

/** No start button: once the warning is answered, the pilot wakes as soon as the scene is ready (or after a short safety timeout). */
function useAutoWake() {
  const sceneDone = useNova((s) => s.sceneReady || s.webglFailed);
  const no3d = useGraphics((s) => s.level === 'none' && s.ready); // nothing to wait for
  const ready = sceneDone || no3d;
  const accepted = useNova((s) => s.warningAccepted);
  useEffect(() => {
    // Nothing starts (and nothing flashes) until the visitor has answered the photosensitivity warning.
    if (!accepted || new URLSearchParams(location.search).has('jump')) return;
    const go = () => useNova.getState().phase === 'gate' && director.wake();
    if (ready) {
      const id = setTimeout(go, 400);
      return () => clearTimeout(id);
    }
    const id = setTimeout(go, 6000);
    return () => clearTimeout(id);
  }, [ready, accepted]);
}

/** DEV: `window.__nova` for QA scripts, and `?jump=<phase>` to start mid-timeline. */
function useDevHooks() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __nova: unknown }).__nova = { rt, store: useNova, director, journey, course: useCourse, hub: useHub, profile: useProfile, hubQuiz: useHubQuiz, account, graphics };
    const jump = new URLSearchParams(location.search).get('jump') as Phase | null;
    if (jump && PHASES.includes(jump)) director.debugJump(jump);
  }, []);
}
