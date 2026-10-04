import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { rt } from '../../core/runtime';
import { useNova, type Phase } from '../../core/store';
import { useRaf } from '../../core/useRaf';

/** Phones (< 640 px) get the stacked / bottom-sheet layout. */
export const MOBILE_QUERY = '(max-width: 639.98px)';

/** Live `matchMedia` result. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * True once `rt.phaseTime` has passed `at` seconds while the store is in `phase`.
 * Polls per frame only until it flips (a single re-render), and resets whenever the phase changes.
 */
export function usePhaseTimeReached(phase: Phase, at: number): boolean {
  const current = useNova((s) => s.phase);
  const [state, setState] = useState({ phase: current, reached: false });
  if (state.phase !== current) setState({ phase: current, reached: false });
  const reached = state.phase === current && state.reached;
  const active = current === phase;
  useRaf(() => {
    if (rt.phaseTime >= at) setState({ phase: current, reached: true });
  }, active && !reached);
  return active && reached;
}

/** Dismisses notice `id` after `ttl` seconds of un-paused display. */
export function useAutoDismiss(id: number, ttl: number, paused: boolean): void {
  const remaining = useRef(ttl * 1000);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const timer = window.setTimeout(() => useNova.getState().dismiss(id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (performance.now() - start));
    };
  }, [id, paused]);
}
