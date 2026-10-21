import { ENABLE_PDF_UPLOAD } from './courseApi';
import { create } from 'zustand';
import { replayLaunch } from './director';
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
const LS_AVATAR = 'nova.avatar';

const readLS = (key: string) => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};
const writeLS = (key: string, value: string) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

interface ProfileState {
  callsign: string;
  /** The pilot's picture as a small image data URL (uploaded or doodled); '' = initials. */
  avatar: string;
  setCallsign: (name: string) => void;
  setAvatar: (dataUrl: string) => void;
}

export const useProfile = create<ProfileState>()((set) => ({
  callsign: readLS(LS_CALLSIGN),
  avatar: readLS(LS_AVATAR),
  setCallsign: (callsign) => {
    writeLS(LS_CALLSIGN, callsign);
    set({ callsign });
  },
  setAvatar: (avatar) => {
    writeLS(LS_AVATAR, avatar);
    set({ avatar });
  },
}));

/** Pixel reads this every frame; bump it to make the pug do a happy flip. */
export const petSignal = { cheers: 0 };
export const cheerPet = () => {
  petSignal.cheers += 1;
};

/** Opens the New course window on a tab (from anywhere in the lounge). */
export function openForge(tab: ForgeTab = 'goal'): void {
  useHub.getState().setForgeTab(ENABLE_PDF_UPLOAD ? tab : 'goal');
  useHub.getState().go('hub');
  useNova.getState().setCurriculumOpen(true);
}

/** Re-watch the opening cinematic (Profile button or the LAUNCH easter egg), then land back in the lounge. */
export function relaunch(): void {
  useHub.getState().go('hub');
  replayLaunch();
}
