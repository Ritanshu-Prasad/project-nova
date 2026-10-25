import { create } from 'zustand';

/**
 * The Nova blast: the finale that plays when a pilot finishes a whole course (and from the secret code in the lounge).
 * `title` is what the screen names; it falls back to a neutral phrase when there is no course to name.
 */
/**
 * pending: just asked for · walking: the pilot is walking to the seat · flight: switches, launch and the jump to the dying sun ·
 * blast: the supernova outside the cockpit · overlay: the full-screen version (no 3D).
 */
export type FinaleStage = 'pending' | 'walking' | 'flight' | 'blast' | 'overlay';

interface FinaleState {
  open: boolean;
  courseId: string | null;
  title: string;
  stage: FinaleStage;
  show: (courseId: string | null, title: string) => void;
  setStage: (stage: FinaleStage) => void;
  hide: () => void;
}

export const useFinale = create<FinaleState>()((set) => ({
  open: false,
  courseId: null,
  title: '',
  stage: 'pending',
  show: (courseId, title) => set({ open: true, courseId, title, stage: 'pending' }),
  setStage: (stage) => set({ stage }),
  hide: () => set({ open: false }),
}));

/** Secret words typed in the lounge or cockpit. Only letters (no digits, no M), so they never collide with the default shortcuts. */
export const SECRET_CODES = { launch: 'launch', finale: 'supernova', planet: 'planet', orbit: 'orbit', devatlas: 'devatlas', atlas: 'atlas' } as const;
export const CODE_BUFFER = Math.max(...Object.values(SECRET_CODES).map((c) => c.length));

/** Which secret word, if any, the typed letters end with. */
export function matchCode(typed: string): keyof typeof SECRET_CODES | null {
  for (const [name, word] of Object.entries(SECRET_CODES)) if (typed.endsWith(word)) return name as keyof typeof SECRET_CODES;
  return null;
}
