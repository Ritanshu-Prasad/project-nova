/**
 * All user-facing copy in one place, so the cockpit screens (canvas textures) and the DOM say the same thing.
 * "NOVA" is a code name — rename it here.
 */

export const BRAND = {
  name: 'NOVA',
  codename: 'Project NOVA',
  tagline: 'Wake up. Level up.',
} as const;

/** Shown before the intro: the cinematic flashes and flickers. */
export const WARNING = {
  title: 'Photosensitivity warning',
  body: 'This experience has flashing lights, flickering and fast-moving effects during the intro. These can trigger seizures in people with photosensitive epilepsy or other light-sensitive conditions.',
  advice: 'If you or anyone in your family has epilepsy or a seizure condition, we recommend you skip the intro.',
  skip: 'Skip the intro (recommended if you have epilepsy)',
  play: 'I understand — play the intro',
  note: 'Skipping also turns on reduced effects. You can change this any time from the gear in the top bar.',
} as const;

export const GATE = {
  lines: ['CRYO-STASIS · POD 07', 'SUBJECT: UNREGISTERED PLAYER', 'VITAL SIGNS DETECTED'],
  wake: 'Wake up',
  returning: 'Welcome back, Player.',
  skip: 'Skip to the new world',
  soundHint: 'Best with sound on',
} as const;

export const WAKE_NOTICE = {
  title: 'NOTIFICATION',
  lines: ['You have awakened.', 'Player status: LEVEL 1 · UNRANKED', 'Restore your ship to begin the journey.'],
} as const;

export type SystemCopy = { label: string; switchLabel: string; key: string; done: string };

export const PREFLIGHT = {
  title: 'QUEST · PRE-FLIGHT CHECKLIST',
  items: {
    power: { label: 'Restore main power', switchLabel: 'MAIN PWR', key: '1', done: 'Main power online' },
    neural: { label: 'Engage the neural link', switchLabel: 'NEURAL LINK', key: '2', done: 'Neural link synced' },
    core: { label: 'Ignite the RR core', switchLabel: 'RR CORE', key: '3', done: 'RR core stable' },
  } satisfies Record<'power' | 'neural' | 'core', SystemCopy>,
  denied: 'Bring systems online in order.',
  complete: 'Quest complete — launch clearance granted.',
  launch: 'Hold to launch',
  launchKey: 'SPACE',
} as const;

export const WARP = {
  title: 'ENTERING NEW WORLD',
} as const;

export const ARRIVAL_NOTICE = {
  title: 'NEW WORLD DISCOVERED',
  lines: ['Location: Sector 00 — the Knowledge Belt', 'New quest: initialize your identity'],
} as const;

export const HERO = {
  kicker: 'NEW WORLD DISCOVERED · SECTOR 00',
  title: 'NOVA',
  tagline: 'Wake up. Level up.',
  sub: 'An AI tutor that reads your level like a game reads a player — then keeps every lesson and question right at the edge of what you can do.',
  ctaPrimary: 'Initialize identity',
  ctaSecondary: 'Replay launch',
  signInPending: {
    title: 'UPLINK PENDING',
    lines: ['Google sign-in is being wired up — check back soon.'],
  },
  poweredBy: ['NVIDIA NIM', 'Nebius AI Studio', 'pgvector RAG'],
  micro: 'Code name NOVA · Built for the Nebius × NVIDIA Global AI Hackathon 2026',
} as const;

export interface Pillar {
  key: 'scan' | 'mmr' | 'feed';
  code: string;
  title: string;
  /** Short uppercase title for the cockpit screen. */
  screenTitle: string;
  short: string;
  body: string;
  bullets: string[];
  /** 3 short status lines drawn on the cockpit screen. */
  screenLines: [string, string, string];
}

export const PILLARS: Pillar[] = [
  {
    key: 'scan',
    code: '01',
    title: 'Placement Scan',
    screenTitle: 'PLACEMENT SCAN',
    short: 'Find your true level in minutes.',
    body: 'A short diagnostic sets your baseline — Beginner, Intermediate or Advanced — before a single lesson starts. No self-rating, no guessing.',
    bullets: ['Adaptive diagnostic quiz', 'Baseline + starting RR', 'Retake any time'],
    screenLines: ['BASELINE: ???', 'DIAGNOSTIC READY', 'EST. 4 MIN'],
  },
  {
    key: 'mmr',
    code: '02',
    title: 'Adaptive RR',
    screenTitle: 'RR ENGINE',
    short: 'Every answer is a match.',
    body: 'NOVA rates you like a competitive player. Answer right and fast and the next challenge hits harder; miss, and the System recalibrates — always one step past your comfort zone.',
    bullets: ['Elo-style rating after every answer', 'Weighs accuracy and time-to-answer', 'Keeps you in the flow zone'],
    screenLines: ['RATING: CALIBRATING', 'TARGET HIT RATE 70%', 'PvE MODE: ARMED'],
  },
  {
    key: 'feed',
    code: '03',
    title: 'Single Feed',
    screenTitle: 'SINGLE FEED',
    short: 'One stream. Zero noise.',
    body: 'Lessons and questions arrive in one clean feed, grounded in your material by retrieval and kept concise by hard token caps. Stuck? Explain it simpler. Bored? Skip it.',
    bullets: ['“Explain in simpler terms”', '“Skip concept”', 'RAG-grounded, token-capped answers'],
    screenLines: ['FEED: 1 STREAM', 'RAG: 768-D VECTORS', 'TOKENS: CAPPED'],
  },
];
