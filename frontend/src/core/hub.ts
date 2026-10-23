import { useCourse } from './course';
import { ENABLE_PDF_UPLOAD } from './courseApi';
import { useFinale } from './finale';
import { create } from 'zustand';
import { canRelaunch, relaunchFromSpace, replayLaunch } from './director';
import { useGraphics } from './graphics';
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

/** Whether there is a 3D scene to fly in (not in "No 3D" mode, and not after the scene crashed). */
const has3d = () => useGraphics.getState().level !== 'none' && !useNova.getState().webglFailed;

/**
 * LAUNCH cheat / Profile / Settings: walk back to the pilot seat (the walk to the lounge in reverse), flip the three
 * switches again and jump from where the ship is, to the next planet. Without 3D there is nothing to fly, so it says so.
 */
export function relaunch(): void {
  if (!has3d()) {
    useNova.getState().notify({ kind: 'toast', title: 'No 3D mode', lines: ['There is no ship view to fly in. Choose a 3D level in Settings → Graphics.'], ttl: 4 });
    return;
  }
  if (!canRelaunch()) {
    useNova.getState().notify({ kind: 'toast', title: 'Ship is still settling', lines: ['Launch again once you are back in the lounge.'], ttl: 3 });
    return;
  }
  const wasAtHub = useHub.getState().station === 'hub';
  useHub.getState().go('hub');
  relaunchFromSpace(wasAtHub ? 0 : 1300); // from another station the pilot first settles at the hub spot, where the reverse walk starts
}

/** Settings: watch the whole opening again — wake-up in the hangar and the launch down the launch pad — then land back in the lounge. */
export function replayFullIntro(): void {
  if (!has3d()) return relaunch();
  useHub.getState().go('hub');
  replayLaunch();
}

/** Plays the Nova blast finale for a course (default: the active one); with no course it still plays, naming "your course". */
export function playFinale(courseId?: string | null): void {
  const { activeId, library } = useCourse.getState();
  const entry = library[courseId ?? activeId ?? ''];
  useFinale.getState().show(entry ? entry.course.id : null, entry ? entry.course.title : 'your course');
}
