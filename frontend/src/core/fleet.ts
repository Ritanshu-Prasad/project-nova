import { useCourse } from './course';
import { useProfile } from './hub';
import { useNova } from './store';

/**
 * Fleet leaderboard client (backend/fleet.py). The pilot is identified by a random id kept in this browser
 * (only its hash is stored on the server). Scores are posted a little after progress changes.
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

/** This pilot's private id (32 hex characters), created on first use. */
export function pilotId(): string {
  try {
    const have = localStorage.getItem(LS_PILOT);
    if (have && /^[a-f0-9]{32}$/.test(have)) return have;
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(LS_PILOT, id);
    return id;
  } catch {
    return '';
  }
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
  return JSON.stringify({ pilotId: id, callsign, color: useNova.getState().themeColor, xp: useCourse.getState().stats.xp, courses: demoCourses() });
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
