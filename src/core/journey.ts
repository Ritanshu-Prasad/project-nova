import { create } from 'zustand';
import { audio } from './audio';
import { clamp, damp, easeInOutCubic, kf, smoothstep } from './math';
import { rt } from './runtime';

/**
 * Leaving the cockpit for the crew lounge: stand up, turn around, unseal the bulkhead door, walk through.
 * Ticked every frame by the director loop; it only writes rt.stand / turn / door / walk / holo.
 *
 *   cockpit ─goToLounge()→ transit (≈6.6 s) → lounge
 */
export type Deck = 'cockpit' | 'transit' | 'lounge';

interface DeckState {
  deck: Deck;
}

export const useDeck = create<DeckState>()(() => ({ deck: 'cockpit' }));

/** Timeline in seconds from the start of the transit. */
export const JOURNEY = {
  turn: 1.4,
  unlock: 1.3,
  open: [1.9, 3.3] as const,
  walk: [3.0, 6.4] as const,
  total: 6.6,
} as const;

const clock = () => performance.now() / 1000;

let start: number | null = null;
let onArrive: (() => void) | null = null;
const fired = new Set<string>();

function once(key: string, fn: () => void) {
  if (fired.has(key)) return;
  fired.add(key);
  fn();
}

/** Walk from the cockpit to the lounge, then call `then` (already there → calls it right away). */
export function goToLounge(then?: () => void): void {
  if (useDeck.getState().deck !== 'cockpit') {
    then?.();
    return;
  }
  start = clock();
  onArrive = then ?? null;
  fired.clear();
  useDeck.setState({ deck: 'transit' });
}

/** Skip the walk (e.g. reduced motion or a returning player): appear in the lounge. */
export function enterLoungeNow(): void {
  start = null;
  Object.assign(rt, { stand: 1, turn: 1, door: 1, walk: 1 });
  useDeck.setState({ deck: 'lounge' });
}

/** Back in the pilot's seat (replaying the launch). */
export function resetJourney(): void {
  start = null;
  onArrive = null;
  Object.assign(rt, { stand: 0, turn: 0, door: 0, walk: 0, holo: 0 });
  useDeck.setState({ deck: 'cockpit' });
}

/** Fires the hologram's energy burst (course compiling, pet poke...). */
export function holoBurst(amount = 1): void {
  rt.holo = Math.max(rt.holo, amount);
}

export function tickJourney(dt: number): void {
  rt.holo = damp(rt.holo, 0, 0.9, dt);
  if (start === null) return;
  const t = clock() - start;
  const fast = rt.reducedMotion ? 2.2 : 1;
  const s = t * fast;

  rt.turn = easeInOutCubic(clamp(s / JOURNEY.turn));
  rt.stand = smoothstep(0, 1.2, s);
  rt.door = kf(s, [
    [JOURNEY.unlock, 0],
    [JOURNEY.unlock + 0.25, 0.12],
    [JOURNEY.open[0], 0.15],
    [JOURNEY.open[1], 1],
  ]);
  rt.walk = easeInOutCubic(clamp((s - JOURNEY.walk[0]) / (JOURNEY.walk[1] - JOURNEY.walk[0])));

  if (s >= 0.1) once('stand', () => audio.play('switch'));
  if (s >= JOURNEY.unlock) once('unlock', () => audio.play('powerUp'));
  if (s >= JOURNEY.open[0]) once('open', () => audio.play('doorOpen'));
  if (s >= JOURNEY.total) {
    start = null;
    useDeck.setState({ deck: 'lounge' });
    audio.play('arrive');
    const fn = onArrive;
    onArrive = null;
    fn?.();
  }
}
