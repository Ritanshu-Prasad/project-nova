import { useAccount } from './account';
import { useCourse } from './course';
import { useProfile } from './hub';
import { useNova } from './store';

/**
 * Fleet leaderboard client (backend/fleet.py). The pilot is identified by a private id
 * deterministically bound to their account / callsign (only its hash is stored on the server).
 * Scores are posted a little after progress changes.
 */

export interface FleetRow {
  rank: number;
  callsign: string;
  color: string;
  level: number;
  score: number;
  me: boolean;
}

export interface FleetBoard {
  board: string;
  pilots: number;
  top: FleetRow[];
  you: { rank: number; score: number } | null;
}

const LS_PILOT = 'nova.pilotId';
const SEND_DELAY = 8000;

/** Produces a 32-character hex hash from any string seed. */
export function deterministicHex32(seed: string): string {
  let h1 = 0xdeadbeef,
    h2 = 0x41c64e6d,
    h3 = 0x9e3779b9,
    h4 = 0x85ebca6b;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  const toHex8 = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `${toHex8(h1)}${toHex8(h2)}${toHex8(h3)}${toHex8(h4)}`;
}

/**
 * This pilot's private id (32 hex characters).
 * Deterministically bound to the pilot's authenticated account (or callsign) so logins across
 * different browsers/sessions share the exact same id and avoid duplicate leaderboard entries.
 */
export function pilotId(): string {
  try {
    const sub = useAccount.getState().user?.sub;
    const callsign = useProfile.getState().callsign.trim().toLowerCase();
    const seed = sub ? `sub:${sub}` : callsign.length >= 2 ? `callsign:${callsign}` : null;
    if (seed) {
      const id = deterministicHex32(seed);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(LS_PILOT, id);
        } catch {
          /* ignore */
        }
      }
      return id;
    }
    const have = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_PILOT) : null;
    if (have && /^[a-f0-9]{32}$/.test(have)) return have;
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LS_PILOT, id);
      } catch {
        /* ignore */
      }
    }
    return id;
  } catch {
    return '';
  }
}

/**
 * Calculates the total cumulative XP across all enrolled courses in the pilot's library:
 * cleared topics (+30 XP), passed modules (+80 XP), quiz answers (+30 correct, +5 wrong),
 * and course completion bonus (+100 XP).
 * Guaranteed to never fall below stats.xp.
 */
export function totalLibraryXp(): number {
  const s = useCourse.getState();
  let calculated = 0;
  for (const entry of Object.values(s.library ?? {})) {
    const clearedTopics = Object.values(entry.progress ?? {}).filter((p) => p.cleared).length;
    const passedMods = Object.values(entry.modules ?? {}).filter((m) => m.passed).length;
    const correct = entry.skill?.correct ?? 0;
    const answered = entry.skill?.answered ?? 0;
    const wrong = Math.max(0, answered - correct);
    const completed = entry.completedAt ? 100 : 0;
    calculated += clearedTopics * 30 + passedMods * 80 + correct * 30 + wrong * 5 + completed;
  }
  return Math.max(s.stats?.xp ?? 0, calculated);
}

/** Boards are per demo course (their content is the same for everyone); custom and PDF courses aren't compared. */
export const courseKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export function demoCourses() {
  return Object.values(useCourse.getState().library)
    .filter((e) => e.course.source === 'template')
    .map((e) => ({ key: courseKey(e.course.title), title: e.course.title, mmr: Math.round(e.skill.mmr) }));
}

function scoreBody(): string | null {
  const id = pilotId();
  const callsign = useProfile.getState().callsign.trim();
  if (!id || callsign.length < 2 || !useNova.getState().isLoggedIn) return null;
  const xp = totalLibraryXp();
  return JSON.stringify({ pilotId: id, callsign, color: useNova.getState().themeColor, xp, courses: demoCourses() });
}

let lastSent = '';
let timer: ReturnType<typeof setTimeout> | null = null;

/** Posts this pilot's standing now (skipped when nothing changed). */
export async function submitScore(): Promise<void> {
  const body = scoreBody();
  if (!body || body === lastSent) return;
  const res = await fetch('/api/fleet/score', { method: 'POST', headers: { 'X-Nova': '1', 'Content-Type': 'application/json' }, body });
  if (res.ok) lastSent = body;
}

const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void submitScore().catch(() => {});
  }, SEND_DELAY);
};

/** The board ('global' by XP, or a course key by RR), with this pilot's own place. Throws when the fleet is offline. */
export async function fetchBoard(board: string): Promise<FleetBoard> {
  await submitScore().catch(() => {});
  const res = await fetch(`/api/fleet/leaderboard?board=${encodeURIComponent(board)}&pilot=${pilotId()}`);
  if (!res.ok) throw new Error(res.status === 503 ? 'storage' : 'offline');
  return (await res.json()) as FleetBoard;
}

useCourse.subscribe((s, p) => (s.stats.xp !== p.stats.xp || s.library !== p.library) && schedule());
useProfile.subscribe((s, p) => s.callsign !== p.callsign && schedule());
useAccount.subscribe((s, p) => s.user?.sub !== p.user?.sub && schedule());
