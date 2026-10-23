import { useEffect } from 'react';
import { audio } from './audio';
import { setHolding, skipIntro, toggleSystem, wake } from './director';
import { clamp, damp } from './math';
import { rt } from './runtime';
import { actionFor, resolveMotion } from './settings';
import { INTRO_PHASES, SYSTEM_ORDER, useNova } from './store';

const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

const DIGITS = ['Digit1', 'Digit2', 'Digit3'];

/**
 * Global input, installed once by <App>:
 *  - mouse/pen position → head-look target (rt.lookX / rt.lookY); touch drag looks around and eases back
 *  - Space (hold) → launch charge · 1/2/3 → ship systems · mute key (M by default, see Settings) · Enter → wake · Esc → skip intro / close panel
 *  - prefers-reduced-motion changes → store
 */
export function useGlobalInput(): void {
  useEffect(() => {
    let touchId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let recenter = 0;

    const onPointerDown = (e: PointerEvent) => {
      void audio.init();
      if (e.pointerType !== 'touch' || touchId !== null) return;
      touchId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      cancelAnimationFrame(recenter);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (e.pointerId !== touchId) return;
        rt.lookX = clamp(rt.lookX + ((e.clientX - lastX) / window.innerWidth) * 2.4, -1, 1);
        rt.lookY = clamp(rt.lookY + ((e.clientY - lastY) / window.innerHeight) * 2.4, -1, 1);
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      rt.lookX = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      rt.lookY = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerId !== touchId) return;
      touchId = null;
      // Ease the touch look back to centre.
      let last = performance.now();
      const ease = (ms: number) => {
        const dt = Math.min(0.1, (ms - last) / 1000);
        last = ms;
        rt.lookX = damp(rt.lookX, 0, 1.6, dt);
        rt.lookY = damp(rt.lookY, 0, 1.6, dt);
        if (Math.abs(rt.lookX) + Math.abs(rt.lookY) > 0.002) recenter = requestAnimationFrame(ease);
      };
      recenter = requestAnimationFrame(ease);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      void audio.init();
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const s = useNova.getState();
      if (e.code === 'Space') {
        if (s.phase === 'preflight') {
          e.preventDefault();
          if (!e.repeat) setHolding(true);
        }
        return;
      }
      if (e.repeat) return;
      // Pre-flight's 1/2/3 ship systems come first, whatever the shortcut settings say.
      if (s.phase === 'preflight' && DIGITS.includes(e.code)) {
        toggleSystem(SYSTEM_ORDER[DIGITS.indexOf(e.code)]);
      } else if (actionFor(e.code) === 'mute') {
        s.toggleSound();
      } else if (e.code === 'Enter' && s.phase === 'gate' && s.warningAccepted) {
        wake();
      } else if (e.code === 'Escape') {
        if (s.activePillar !== null) s.setActivePillar(null);
        else if (INTRO_PHASES.includes(s.phase)) skipIntro();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (useNova.getState().phase === 'preflight') e.preventDefault();
      setHolding(false);
    };

    const release = () => setHolding(false);

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionPref = () => useNova.getState().setReducedMotion(resolveMotion(media.matches));

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerEnd, { passive: true });
    window.addEventListener('pointercancel', onPointerEnd, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', release);
    media.addEventListener('change', onMotionPref);
    return () => {
      cancelAnimationFrame(recenter);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', release);
      media.removeEventListener('change', onMotionPref);
    };
  }, []);
}
