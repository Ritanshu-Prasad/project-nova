import { Suspense, useLayoutEffect, type ReactNode } from 'react';
import { ErrorBoundary } from '../../ui/common/ErrorBoundary';
import { suspense } from './suspense';

/** Mounted while a guarded subtree is suspended — lets the boot sequence wait for every module. */
function Pending() {
  useLayoutEffect(() => {
    suspense.pending += 1;
    return () => {
      suspense.pending -= 1;
    };
  }, []);
  return null;
}

/**
 * Isolates one scene module: its loading state doesn't blank the rest of the scene,
 * and a crash removes only that module (logged) instead of the whole WebGL experience.
 */
export default function Guard({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={<Pending />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
