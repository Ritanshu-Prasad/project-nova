import { rt } from '../core/runtime';
import { useNova, type Phase, type SystemKey, type World } from '../core/store';

/**
 * DEV ONLY — applies preview query params to the runtime / store (see PreviewCanvas for the list).
 * Runs once when this module is first imported, before any preview renders.
 */
function applyPreviewParams(): URLSearchParams {
  const q = new URLSearchParams(location.search);
  const target = rt as unknown as Record<string, unknown>;
  q.forEach((value, key) => {
    if (!key.startsWith('rt.')) return;
    const k = key.slice(3);
    if (typeof target[k] === 'number') target[k] = Number(value);
    else if (typeof target[k] === 'boolean') target[k] = value === '1' || value === 'true';
  });
  const s = useNova.getState();
  const phase = q.get('phase');
  if (phase) s.setPhase(phase as Phase);
  const world = q.get('world');
  if (world) s.setWorld(world as World);
  const systems = q.get('systems');
  if (systems) for (const k of systems.split(',')) s.setSystem(k as SystemKey, true);
  if (q.get('cleared') === '1') s.setCleared(true);
  const pillar = q.get('pillar');
  if (pillar !== null) s.setActivePillar(Number(pillar));
  const hover = q.get('hover');
  if (hover !== null) s.setHoverPillar(Number(hover));
  if (q.get('rm') === '1') {
    s.setReducedMotion(true);
    rt.reducedMotion = true;
  }
  return q;
}

export const previewParams = applyPreviewParams();

/** Marks the preview ready for screenshots (`window.__previewReady`). */
export function markPreviewReady(): void {
  (window as unknown as { __previewReady?: boolean }).__previewReady = true;
}
