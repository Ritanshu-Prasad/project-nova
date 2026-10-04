import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Runs `cb(dt, time)` every animation frame while `active` (dt and time in seconds).
 * Use it in DOM overlays that read `rt` and write styles/text straight to refs — no React re-renders.
 */
export function useRaf(cb: (dt: number, time: number) => void, active = true): void {
  const ref = useRef(cb);
  useLayoutEffect(() => {
    ref.current = cb;
  });
  useEffect(() => {
    if (!active) return;
    let id = 0;
    let last = performance.now();
    const loop = (ms: number) => {
      const dt = Math.min(0.1, Math.max(0, (ms - last) / 1000));
      last = ms;
      ref.current(dt, ms / 1000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}
