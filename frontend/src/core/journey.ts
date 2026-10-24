import { create } from 'zustand';
import { audio } from './audio';
import { clamp, damp, easeInOutCubic, kf, smoothstep } from './math';
import { rt } from './runtime';

/**
 * Leaving the cockpit for the crew lounge: stand up, turn around, unseal the bulkhead door, walk through.
 * Ticked every frame by the director loop; it only writes rt.stand / turn / door / walk / holo.
 *
 *   cockpit ─goToLounge()→ transit (≈6.6 s) → lounge
 *   lounge ─goToCockpit()→ transit (the same timeline played backwards) → cockpit
 */
export type Deck = 'cockpit' | 'transit' | 'lounge';

interface DeckState {
  deck: Deck;
}

/** A signed-in pilot comes back to the lounge itself: the deck is right from the first render, with no walk to play. */
const startsInLounge = (): boolean => {
  try {
    return localStorage.getItem('nova.isLoggedIn') === '1';
  } catch {
    return false;
  }
};

export const useDeck = create<DeckState>()(() => ({ deck: startsInLounge() ? 'lounge' : 'cockpit' }));

/** Timeline in seconds from the start of the transit. */
export const JOURNEY = {
  turn: 1.4,
  unlock: 1.3,
  open: [1.9, 3.3] as const,
  walk: [3.0, 6.4] as const,
  total: 6.6,
} as const;

const clock = () => performance.now() / 1000;

/** Where the pilot is `s` seconds into the walk from the seat to the lounge (0 = in the seat, JOURNEY.total = in the lounge). */
export interface WalkPose {
  turn: number;
  stand: number;
  door: number;
  walk: number;
}

export function walkAt(s: number): WalkPose {
  return {
    turn: easeInOutCubic(clamp(s / JOURNEY.turn)),
    stand: smoothstep(0, 1.2, s),
    door: kf(s, [
      [JOURNEY.unlock, 0],
      [JOURNEY.unlock + 0.25, 0.12],
      [JOURNEY.open[0], 0.15],
      [JOURNEY.open[1], 1],
    ]),
    walk: easeInOutCubic(clamp((s - JOURNEY.walk[0]) / (JOURNEY.walk[1] - JOURNEY.walk[0]))),
  };
}

let start: number | null = null;
/** 1 = seat → lounge, -1 = lounge → seat (the same timeline backwards). */
let direction: 1 | -1 = 1;
let onArrive: (() => void) | null = null;
/** A walk that is waiting for the pilot to settle at the hub spot (see goToCockpit's delay). */
let pendingBegin: ReturnType<typeof setTimeout> | null = null;
let dimDelayStart: number | null = null;
let dimDelayTotal = 0;
const fired = new Set<string>();

function cancelPending(): void {
  if (pendingBegin !== null) clearTimeout(pendingBegin);
  pendingBegin = null;
  dimDelayStart = null;
}

/** True while the pilot is walking (either way) or about to start walking. */
export function isBusy(): boolean {
  return pendingBegin !== null || useDeck.getState().deck === 'transit';
}

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
  cancelPending();
  start = clock();
  direction = 1;
  onArrive = then ?? null;
  fired.clear();
  useDeck.setState({ deck: 'transit' });
}

/**
 * Walk from the lounge back to the pilot seat — the walk to the lounge played in reverse: out through the corridor,
 * the bulkhead door closing, turning and sitting down. Already in the seat → calls `then` right away. `delayMs` gives a
 * station walk time to settle at the hub spot, where the reverse walk starts.
 */
export function goToCockpit(then?: () => void, delayMs = 0): void {
  if (useDeck.getState().deck !== 'lounge') {
    then?.();
    return;
  }
  const begin = () => {
    pendingBegin = null;
    dimDelayStart = null;
    if (useDeck.getState().deck !== 'lounge') return;
    Object.assign(rt, walkAt(JOURNEY.total));
    start = clock();
    direction = -1;
    onArrive = then ?? null;
    fired.clear();
    useDeck.setState({ deck: 'transit' });
  };
  cancelPending();
  if (delayMs > 0) {
    dimDelayStart = clock();
    dimDelayTotal = delayMs / 1000;
    pendingBegin = setTimeout(begin, delayMs);
  } else {
    begin();
  }
}

/** Skip the walk (e.g. reduced motion or a returning player): appear in the lounge. */
export function enterLoungeNow(): void {
  cancelPending();
  start = null;
  rt.deckLightDim = 1.0;
  Object.assign(rt, { stand: 1, turn: 1, door: 1, walk: 1 });
  useDeck.setState({ deck: 'lounge' });
}

/** Back in the pilot's seat (replaying the launch). */
export function resetJourney(): void {
  cancelPending();
  start = null;
  onArrive = null;
  rt.deckLightDim = 0.25;
  Object.assign(rt, { stand: 0, turn: 0, door: 0, walk: 0, holo: 0 });
  useDeck.setState({ deck: 'cockpit' });
}

/** Fires the hologram's energy burst (course compiling, pet poke...). */
export function holoBurst(amount = 1): void {
  rt.holo = Math.max(rt.holo, amount);
}

export function tickJourney(dt: number): void {
  rt.holo = damp(rt.holo, 0, 0.9, dt);
  if (pendingBegin !== null && dimDelayStart !== null) {
    const elapsed = clock() - dimDelayStart;
    const p = clamp(elapsed / Math.max(dimDelayTotal, 0.001), 0, 1);
    rt.deckLightDim = 1.0 - 0.25 * p;
  }
  if (start === null) return;
  const t = clock() - start;
  const fast = rt.reducedMotion ? 2.2 : 1;
  // Walking back plays the same timeline from its end to its start.
  const s = direction === 1 ? t * fast : JOURNEY.total - t * fast;

  const progress = clamp(s / JOURNEY.total, 0, 1);
  rt.deckLightDim = 0.25 + 0.75 * progress;

  Object.assign(rt, walkAt(clamp(s, 0, JOURNEY.total)));

  if (direction === 1) {
    if (s >= 0.1) once('stand', () => audio.play('switch'));
    if (s >= JOURNEY.unlock) once('unlock', () => audio.play('powerUp'));
    if (s >= JOURNEY.open[0]) once('open', () => audio.play('doorOpen'));
    if (s >= JOURNEY.total) finish('lounge', 'arrive');
  } else {
    if (s <= JOURNEY.open[1]) once('close', () => audio.play('doorOpen'));
    if (s <= JOURNEY.unlock) once('lock', () => audio.play('switch'));
    if (s <= 0.6) once('sit', () => audio.play('powerUp'));
    if (s <= 0) finish('cockpit', null);
  }
}

function finish(deck: Deck, cue: 'arrive' | null): void {
  start = null;
  rt.deckLightDim = deck === 'lounge' ? 1.0 : 0.25;
  useDeck.setState({ deck });
  if (cue) audio.play(cue);
  const fn = onArrive;
  onArrive = null;
  fn?.();
}
