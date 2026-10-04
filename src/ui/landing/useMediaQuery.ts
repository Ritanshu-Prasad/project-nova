import { useCallback, useSyncExternalStore } from 'react';

/** Live `matchMedia` result (false during SSR / if matchMedia is unavailable). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below the Tailwind `sm` breakpoint: stacked hero, bottom-sheet pillar panel. */
export const MOBILE_QUERY = '(max-width: 639px)';
