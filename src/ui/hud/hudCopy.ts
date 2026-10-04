import type { Phase } from '../../core/store';

/**
 * Decorative HUD text (readout labels, status line, boot log). Product copy lives in core/content.ts.
 */

export type StatusTone = 'amber' | 'ok' | 'nova' | 'nebula' | 'sys';

export interface HudStatus {
  text: string;
  tone: StatusTone;
}

const S = {
  awaiting: { text: 'AWAITING PRE-FLIGHT', tone: 'amber' },
  cleared: { text: 'LAUNCH CLEARANCE GRANTED — HOLD TO LAUNCH', tone: 'ok' },
  launch: { text: 'CATAPULT ENGAGED', tone: 'nova' },
  warp: { text: 'WARP FIELD STABLE', tone: 'nebula' },
  arrive: { text: 'DROPPING OUT OF WARP', tone: 'sys' },
  landed: { text: 'ORBIT ESTABLISHED · SECTOR 00', tone: 'nova' },
} as const satisfies Record<string, HudStatus>;

/** Bottom status line for the current phase. */
export function statusFor(phase: Phase, cleared: boolean): HudStatus {
  switch (phase) {
    case 'launch':
      return S.launch;
    case 'warp':
      return S.warp;
    case 'arrive':
      return S.arrive;
    case 'landed':
      return S.landed;
    default:
      return cleared ? S.cleared : S.awaiting;
  }
}

export const READOUT = {
  velocity: 'Velocity',
  thrust: 'Thrust',
  hull: 'Hull',
  sync: 'Neural sync',
  pilot: 'Pilot',
  pilotValue: 'LV 1 · UNRANKED',
  mmr: 'MMR',
  mmrValue: '—',
  mmrNote: 'calibration pending',
  sector: 'Sector',
  sectorBay: 'HANGAR 07',
  sectorNew: 'SECTOR 00',
} as const;

/** Boot log typed under the reticle when the neural link brings the HUD online. */
export const BOOT_LOG: readonly (readonly [label: string, status: string])[] = [
  ['NEURAL LINK', 'SYNCED'],
  ['OPTIC OVERLAY', 'ONLINE'],
  ['FLIGHT DATA BUS', 'ONLINE'],
  ['PILOT PROFILE', 'LV 1'],
];

export const TOPBAR = {
  codeName: 'Code name',
  signIn: 'Sign in',
  sound: 'Sound',
  soundOn: 'Sound on (M)',
  soundOff: 'Sound off (M)',
  controls: 'Experience controls',
} as const;

/** Glyphs used by the status-line decode effect. */
export const SCRAMBLE_GLYPHS = '▮▯░▒<>/\\|=+-#*01ΔΣ';
