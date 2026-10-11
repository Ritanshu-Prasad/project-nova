/**
 * The pilot data this browser keeps in localStorage, and the one-time switch to Google accounts.
 *
 * NOVA used to keep an anonymous pilot per browser. With accounts, the first visit on this version clears that old
 * pilot (profile, courses, progress) so everyone starts fresh with a Google account. This module is imported first
 * in main.tsx, before any store reads localStorage.
 */

/** Everything that belongs to the signed-in pilot (synced to their account). Device preferences are not listed. */
export const PILOT_KEYS = [
  'nova.library.v2',
  'nova.hubquiz.v1',
  'nova.tutor.v1',
  'nova.callsign',
  'nova.avatar',
  'nova.pilotId',
  'nova.themeColor',
  'nova.activeObjective',
  'nova.isLoggedIn',
  'nova.introSeen',
  'nova.session',
  'nova.sync',
] as const;

const EPOCH_KEY = 'nova.accountsEpoch';
/** Bump to clear every browser's local pilot again. */
const EPOCH = '1';

/** Removes the pilot from this browser (on sign-out, or when another account signs in). */
export function clearLocalPilot(): void {
  try {
    for (const k of PILOT_KEYS) localStorage.removeItem(k);
  } catch {
    /* storage unavailable */
  }
}

try {
  if (localStorage.getItem(EPOCH_KEY) !== EPOCH) {
    for (const k of Object.keys(localStorage)) if (k.startsWith('nova.') && k !== 'nova.sound') localStorage.removeItem(k);
    localStorage.setItem(EPOCH_KEY, EPOCH);
  }
} catch {
  /* storage unavailable (private mode, blocked) */
}
