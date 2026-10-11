import { create } from 'zustand';
import { useNova } from './store';

/**
 * Device settings (they stay with this browser, not the pilot): sound levels, motion and keyboard shortcuts.
 * Opened from the gear in the top bar or the Profile panel.
 */

export type Action = 'lesson' | 'quiz' | 'journey' | 'profile' | 'newCourse' | 'mute';
export type Motion = 'system' | 'reduced' | 'full';

export const ACTIONS: { id: Action; label: string; where: string }[] = [
  { id: 'lesson', label: 'Open lesson', where: 'Lounge' },
  { id: 'quiz', label: 'Open hub quiz', where: 'Lounge' },
  { id: 'journey', label: 'Skill journey & fleet', where: 'Lounge' },
  { id: 'profile', label: 'Pilot profile', where: 'Lounge' },
  { id: 'newCourse', label: 'New course', where: 'Lounge' },
  { id: 'mute', label: 'Mute / unmute', where: 'Anywhere' },
];

/** KeyboardEvent.code values. */
export const DEFAULT_KEYS: Record<Action, string> = { lesson: 'Digit1', quiz: 'Digit2', journey: 'Digit3', profile: 'Digit4', newCourse: 'Digit5', mute: 'KeyM' };
/** Keys the app already uses for something else. */
export const RESERVED = new Set(['Escape', 'Space', 'Enter', 'Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

/** "Digit1" → "1", "KeyM" → "M", "ArrowUp" → "↑". */
export function keyLabel(code: string): string {
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
  const arrows: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  return arrows[code] ?? code.replace(/(Left|Right)$/, '');
}

interface SettingsState {
  open: boolean;
  /** Master volume 0–1 (mute stays the separate on/off switch). */
  volume: number;
  /** Ship, engine, space and set-piece sounds. */
  shipSounds: boolean;
  /** System chimes, clicks and notifications. */
  uiSounds: boolean;
  motion: Motion;
  keys: Record<Action, string>;
  setOpen: (open: boolean) => void;
  set: (patch: Partial<Pick<SettingsState, 'volume' | 'shipSounds' | 'uiSounds' | 'motion'>>) => void;
  /** Binds a key to an action; an action that had that key takes the old one (a swap). */
  bind: (action: Action, code: string) => void;
  resetKeys: () => void;
}

const LS = 'nova.settings';
type Saved = Pick<SettingsState, 'volume' | 'shipSounds' | 'uiSounds' | 'motion' | 'keys'>;
const DEFAULTS: Saved = { volume: 1, shipSounds: true, uiSounds: true, motion: 'system', keys: DEFAULT_KEYS };

function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(LS) ?? 'null') as Partial<Saved> | null;
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...raw, volume: Math.min(1, Math.max(0, Number(raw.volume ?? 1))), keys: { ...DEFAULT_KEYS, ...raw.keys } };
  } catch {
    return DEFAULTS;
  }
}

export const useSettings = create<SettingsState>()((set, get) => ({
  ...load(),
  open: false,
  setOpen: (open) => set({ open }),
  set: (patch) => set(patch),
  bind: (action, code) => {
    const keys = { ...get().keys };
    const other = (Object.keys(keys) as Action[]).find((a) => a !== action && keys[a] === code);
    if (other) keys[other] = keys[action];
    keys[action] = code;
    set({ keys });
  },
  resetKeys: () => set({ keys: DEFAULT_KEYS }),
}));

useSettings.subscribe((s) => {
  try {
    localStorage.setItem(LS, JSON.stringify({ volume: s.volume, shipSounds: s.shipSounds, uiSounds: s.uiSounds, motion: s.motion, keys: s.keys } satisfies Saved));
  } catch {
    /* ignore */
  }
});

/** The action bound to a key press, if any. */
export const actionFor = (code: string): Action | undefined => (Object.keys(useSettings.getState().keys) as Action[]).find((a) => useSettings.getState().keys[a] === code);

const systemPrefersReduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Reduced motion as the pilot chose it, or as the operating system asks. */
export function resolveMotion(systemReduced = systemPrefersReduced()): boolean {
  const m = useSettings.getState().motion;
  return m === 'system' ? systemReduced : m === 'reduced';
}

// Apply the motion choice now and whenever it changes.
useNova.getState().setReducedMotion(resolveMotion());
useSettings.subscribe((s, p) => s.motion !== p.motion && useNova.getState().setReducedMotion(resolveMotion()));
