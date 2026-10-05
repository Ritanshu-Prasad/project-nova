import { create } from 'zustand';
import { useNova } from './store';

/**
 * The lounge hub: which station the pilot has walked up to ('hub' = the overview with the widget menu),
 * the pilot's callsign, and a tiny signal Pixel listens to for celebrations.
 */
export type Station = 'hub' | 'lesson' | 'quiz' | 'journey' | 'profile';

export type ForgeTab = 'goal' | 'docs';

interface HubState {
  station: Station;
  /** Which tab the New course window opens on. */
  forgeTab: ForgeTab;
  go: (station: Station) => void;
  setForgeTab: (tab: ForgeTab) => void;
}

export const useHub = create<HubState>()((set) => ({
  station: 'hub',
  forgeTab: 'goal',
  go: (station) => set({ station }),
  setForgeTab: (forgeTab) => set({ forgeTab }),
}));

const LS_CALLSIGN = 'nova.callsign';

const readCallsign = () => {
  try {
    return localStorage.getItem(LS_CALLSIGN) ?? '';
  } catch {
    return '';
  }
};

interface ProfileState {
  callsign: string;
  setCallsign: (name: string) => void;
}

export const useProfile = create<ProfileState>()((set) => ({
  callsign: readCallsign(),
  setCallsign: (callsign) => {
    try {
      localStorage.setItem(LS_CALLSIGN, callsign);
    } catch {
      /* ignore */
    }
    set({ callsign });
  },
}));

/** Pixel reads this every frame; bump it to make the pug do a happy flip. */
export const petSignal = { cheers: 0 };
export const cheerPet = () => {
  petSignal.cheers += 1;
};

/** Opens the New course window on a tab (from anywhere in the lounge). */
export function openForge(tab: ForgeTab = 'goal'): void {
  useHub.getState().setForgeTab(tab);
  useHub.getState().go('hub');
  useNova.getState().setCurriculumOpen(true);
}
