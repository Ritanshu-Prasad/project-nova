import { create } from 'zustand';

/**
 * Discrete experience state (changes a handful of times per visit).
 * Continuous per-frame values live in `runtime.ts` instead.
 */

export type Phase = 'gate' | 'wake' | 'preflight' | 'launch' | 'warp' | 'arrive' | 'landed';
export const PHASES: readonly Phase[] = ['gate', 'wake', 'preflight', 'launch', 'warp', 'arrive', 'landed'];
/** Phases during which the "skip intro" control is offered. */
export const INTRO_PHASES: readonly Phase[] = ['wake', 'preflight', 'launch', 'warp'];
export const phaseIndex = (p: Phase) => PHASES.indexOf(p);

/** Which 3D world is visible: the launch hangar, or the new world we warp to. */
export type World = 'bay' | 'newworld';

export type SystemKey = 'power' | 'neural' | 'core';
/** Systems must be brought online in this order. */
export const SYSTEM_ORDER: readonly SystemKey[] = ['power', 'neural', 'core'];

export type NoticeKind = 'system' | 'quest' | 'levelup' | 'warning' | 'toast';
export interface Notice {
  id: number;
  kind: NoticeKind;
  title: string;
  lines: string[];
  /** Seconds before auto-dismiss. */
  ttl: number;
}
export interface NoticeInput {
  kind: NoticeKind;
  title: string;
  lines?: string[];
  ttl?: number;
}

interface NovaState {
  phase: Phase;
  world: World;
  systems: Record<SystemKey, boolean>;
  /** All systems online and launch clearance granted (hold-to-launch enabled). */
  cleared: boolean;
  soundOn: boolean;
  reducedMotion: boolean;
  /** Persisted: the visitor has completed (or skipped) the intro before. */
  introSeen: boolean;
  /** The visitor has answered the photosensitivity warning shown before the intro. Never saved: it is asked every time. */
  warningAccepted: boolean;
  /** The WebGL scene has compiled and rendered its first frames. */
  sceneReady: boolean;
  /** WebGL unavailable or crashed; the DOM experience runs over a CSS fallback. */
  webglFailed: boolean;
  /** Landing: product pillar whose detail panel is open (index into PILLARS). */
  activePillar: number | null;
  /** Landing: pillar under the pointer (cockpit screen or DOM chip) — both highlight in sync. */
  hoverPillar: number | null;
  notices: Notice[];
  /** The "Initialize identity" login window. */
  loginOpen: boolean;
  /** The "User Setup" window for username and avatar. */
  userSetupOpen: boolean;
  /** The "Curriculum Setup" view where the user defines what they want to study. */
  curriculumOpen: boolean;
  /** The main "PvE" learning board / feed view. */
  feedOpen: boolean;
  /** True when the blast doors are animating a transition between screens. */
  isTransitioning: boolean;
  /** Persisted: whether the user has completed setup and is logged in. */
  isLoggedIn: boolean;
  /** Persisted: The user's chosen UI theme color. */
  themeColor: string;
  /** Persisted: The user's currently active learning objective (for continuing). */
  activeObjective: string | null;

  setPhase: (phase: Phase) => void;
  setWorld: (world: World) => void;
  setSystem: (key: SystemKey, on: boolean) => void;
  setCleared: (cleared: boolean) => void;
  setSoundOn: (on: boolean) => void;
  toggleSound: () => void;
  setReducedMotion: (on: boolean) => void;
  setIntroSeen: (seen: boolean) => void;
  setWarningAccepted: (accepted: boolean) => void;
  setSceneReady: (ready: boolean) => void;
  setWebglFailed: (failed: boolean) => void;
  setActivePillar: (index: number | null) => void;
  setHoverPillar: (index: number | null) => void;
  setLoginOpen: (open: boolean) => void;
  setLoggedIn: (loggedIn: boolean) => void;
  setThemeColor: (color: string) => void;
  setActiveObjective: (objective: string) => void;
  setUserSetupOpen: (open: boolean) => void;
  setCurriculumOpen: (open: boolean) => void;
  setFeedOpen: (open: boolean) => void;
  setIsTransitioning: (transitioning: boolean) => void;
  notify: (notice: NoticeInput) => number;
  dismiss: (id: number) => void;
  /** Puts the ship back in the hangar with every system offline (used by "replay launch"). */
  resetShip: () => void;
}

const LS_SOUND = 'nova.sound';
const LS_INTRO = 'nova.introSeen';

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* storage unavailable (private mode, blocked) — the flag just won't persist */
  }
}

function readItem(key: string, fallback: string | null = null): string | null {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const NO_SYSTEMS: Record<SystemKey, boolean> = { power: false, neural: false, core: false };

let noticeId = 0;

export const useNova = create<NovaState>()((set, get) => ({
  phase: 'gate',
  world: 'bay',
  systems: { ...NO_SYSTEMS },
  cleared: false,
  soundOn: readFlag(LS_SOUND, true),
  reducedMotion: prefersReducedMotion(),
  sceneReady: false,
  webglFailed: false,
  activePillar: null,
  hoverPillar: null,
  notices: [],
  loginOpen: false,
  userSetupOpen: false,
  curriculumOpen: false,
  feedOpen: false,
  isTransitioning: false,
  
  // A signed-in pilot with a profile skips the intro and starts in the lounge (see App.tsx).
  isLoggedIn: readFlag('nova.isLoggedIn', false),
  // DEV MODE OVERRIDE: the intro is never marked as seen.
  introSeen: false, // readFlag(LS_INTRO, false),
  // Asked on every visit before the intro plays; the dev ?jump= shortcut skips it.
  warningAccepted: typeof location !== 'undefined' && new URLSearchParams(location.search).has('jump'),
  
  themeColor: readItem('nova.themeColor', '#06b6d4') || '#06b6d4',
  activeObjective: readItem('nova.activeObjective', null),

  setPhase: (phase) => set({ phase }),
  setWorld: (world) => set({ world }),
  setSystem: (key, on) => set({ systems: { ...get().systems, [key]: on } }),
  setCleared: (cleared) => set({ cleared }),
  setSoundOn: (soundOn) => {
    writeFlag(LS_SOUND, soundOn);
    set({ soundOn });
  },
  toggleSound: () => get().setSoundOn(!get().soundOn),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setWarningAccepted: (warningAccepted) => set({ warningAccepted }),
  setIntroSeen: (introSeen) => {
    writeFlag(LS_INTRO, introSeen);
    set({ introSeen });
  },
  setLoggedIn: (isLoggedIn) => {
    writeFlag('nova.isLoggedIn', isLoggedIn);
    set({ isLoggedIn });
  },
  setThemeColor: (themeColor) => {
    localStorage.setItem('nova.themeColor', themeColor);
    set({ themeColor });
  },
  setActiveObjective: (activeObjective) => {
    localStorage.setItem('nova.activeObjective', activeObjective);
    set({ activeObjective });
  },
  setSceneReady: (sceneReady) => set({ sceneReady }),
  setWebglFailed: (webglFailed) => set({ webglFailed }),
  setActivePillar: (activePillar) => set({ activePillar }),
  setHoverPillar: (hoverPillar) => set({ hoverPillar }),
  setLoginOpen: (loginOpen) => set({ loginOpen }),
  setUserSetupOpen: (userSetupOpen) => set({ userSetupOpen }),
  setCurriculumOpen: (curriculumOpen) => set({ curriculumOpen }),
  setFeedOpen: (feedOpen) => set({ feedOpen }),
  setIsTransitioning: (isTransitioning) => set({ isTransitioning }),
  notify: ({ kind, title, lines = [], ttl }) => {
    const id = ++noticeId;
    const fallbackTtl = kind === 'toast' ? 3.5 : 5.5;
    set({ notices: [...get().notices, { id, kind, title, lines, ttl: ttl ?? fallbackTtl }] });
    return id;
  },
  dismiss: (id) => set({ notices: get().notices.filter((n) => n.id !== id) }),
  resetShip: () =>
    set({
      world: 'bay',
      systems: { ...NO_SYSTEMS },
      cleared: false,
      activePillar: null,
      hoverPillar: null,
      notices: [],
      loginOpen: false,
    }),
}));
