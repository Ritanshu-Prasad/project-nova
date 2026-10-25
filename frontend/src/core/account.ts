import { create } from 'zustand';
import { upgradeDemoCourses, useCourse, type LibraryEntry, type Stats } from './course';
import type { Course } from './courseSchema';
import { courseFromObjective } from './courseTemplates';
import { useProfile } from './hub';
import { useHubQuiz, type HubQuiz } from './hubQuiz';
import { clearLocalPilot } from './localPilot';
import { useNova } from './store';
import { tidyCourse } from './tidyCourse';
import { useTutor, type ChatMsg } from './tutor';

/**
 * Pilot accounts: Google sign-in, and a progress save that follows the pilot between devices.
 *
 * The backend (backend/accounts.py) keeps the session in an HttpOnly cookie and one save per account. The app keeps
 * working from localStorage as before; changes are pushed to the account a few seconds later, and a newer save made
 * on another device is pulled in at start-up (or when the server refuses a push made from an outdated copy).
 *
 * Needs VITE_GOOGLE_CLIENT_ID: an OAuth web client whose authorised JavaScript origins include the site.
 */

export interface AccountUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'offline';

interface AccountState {
  /** The signed-in account (remembered across reloads; the cookie is the real session). */
  user: AccountUser | null;
  sync: SyncStatus;
  syncedAt: number | null;
}

/** Everything that is saved to the account. Demo courses are stored by reference and rebuilt on load. */
export interface PilotSave {
  v: 1;
  course: { activeId: string | null; library: Record<string, LibraryEntry>; stats: Stats };
  hub: { quizzes: HubQuiz[]; nextAt: Record<string, number> };
  profile: { callsign: string; avatar?: string; themeColor: string; activeObjective: string | null };
  tutor: Record<string, ChatMsg[]>;
}

/** Which account this browser's pilot belongs to, the server save it matches, and any change not pushed yet. */
interface LocalSync {
  sub: string;
  base: number | null;
  changedAt: number | null;
}

interface AuthReply {
  user: AccountUser;
  savedAt: number | null;
  isNew?: boolean;
}

export interface SignInResult {
  isNew: boolean;
  /** The account already has a pilot profile (a returning pilot goes straight to the lounge). */
  hasProfile: boolean;
}

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || '';
/**
 * Real Google sign-in is switched off for now: "Continue with Google" goes straight to the profile step and progress
 * stays in this browser. Set VITE_GOOGLE_AUTH=on (with the client ID and backend settings) to turn accounts back on.
 */
export const GOOGLE_AUTH_ENABLED = import.meta.env.VITE_GOOGLE_AUTH === 'on';

const LS_SESSION = 'nova.session';
const LS_SYNC = 'nova.sync';
const PUSH_DELAY = 2500;
const RETRY_DELAY = 30_000;
/** fetch keepalive bodies are capped at 64 KB. */
const KEEPALIVE_MAX = 60_000;
const DEFAULT_COLOR = '#06b6d4';

const readJSON = <T,>(key: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
};
const writeJSON = (key: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
};
const readSync = () => readJSON<LocalSync>(LS_SYNC);
const writeSync = (s: LocalSync) => writeJSON(LS_SYNC, s);

// With sign-in switched off, a remembered account is ignored (no session checks, no syncing).
export const useAccount = create<AccountState>()(() => ({ user: GOOGLE_AUTH_ENABLED ? readJSON<AccountUser>(LS_SESSION) : null, sync: 'idle', syncedAt: null }));

const setUser = (user: AccountUser | null) => {
  writeJSON(LS_SESSION, user);
  useAccount.setState({ user });
};

// ── API ────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Same-origin calls (Vercel routes /api to the backend; Vite proxies it in development) so the cookie is sent. */
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, credentials: 'same-origin', headers: { 'X-Nova': '1', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
  } catch {
    throw new ApiError(0, 'You appear to be offline');
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (data as { detail?: string } | null)?.detail ?? `Request failed (${res.status})`);
  return data as T;
}

// ── Google ─────────────────────────────────────────────────────────────────

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}
interface GoogleOAuth2 {
  initTokenClient: (cfg: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type: string }) => void;
  }) => { requestAccessToken: () => void };
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

let gis: Promise<void> | null = null;

/** Loads Google's sign-in library. Call it when the sign-in window opens so the click can open Google's popup at once. */
export function prepareGoogle(): Promise<void> {
  gis ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gis = null;
      s.remove();
      reject(new ApiError(0, 'Could not reach Google — check your connection'));
    };
    document.head.appendChild(s);
  });
  return gis;
}

function googleAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) return reject(new ApiError(0, 'Google sign-in is still loading — try again'));
    oauth2
      .initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new ApiError(0, r.error_description || 'Google sign-in failed'))),
        error_callback: (e) => reject(new ApiError(0, e.type === 'popup_closed' ? 'Sign-in was cancelled' : 'Google could not open the sign-in window')),
      })
      .requestAccessToken();
  });
}

/** Opens Google's account picker, then signs in to NOVA and loads (or creates) the account's save. */
export async function signInWithGoogle(): Promise<SignInResult> {
  if (!GOOGLE_CLIENT_ID) throw new ApiError(0, 'Google sign-in is not set up yet (VITE_GOOGLE_CLIENT_ID)');
  // Already loaded → the popup opens inside the click, so browsers don't block it.
  if (!window.google?.accounts?.oauth2) await prepareGoogle();
  const accessToken = await googleAccessToken();
  return afterSignIn(await api<AuthReply>('/api/auth/google', { method: 'POST', body: JSON.stringify({ accessToken }) }));
}

/** Local testing without Google (the backend needs NOVA_DEV_LOGIN=1). */
export async function signInDev(email: string, name: string): Promise<SignInResult> {
  return afterSignIn(await api<AuthReply>('/api/auth/dev', { method: 'POST', body: JSON.stringify({ email, name }) }));
}

async function afterSignIn(r: AuthReply): Promise<SignInResult> {
  setUser(r.user);
  await reconcile(r.user, r.savedAt);
  return { isNew: !!r.isNew, hasProfile: !!useProfile.getState().callsign };
}

/** Ends the session, removes the pilot from this browser and restarts the app. */
export async function signOut(): Promise<void> {
  const local = readSync();
  if (local?.changedAt) {
    await push();
    if (readSync()?.changedAt && !window.confirm('Your latest progress has not reached your account yet (you seem to be offline). Sign out anyway?')) return;
  }
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  clearLocalPilot();
  // Back to a first visit: the photosensitivity question and the full intro come round again.
  try {
    localStorage.removeItem('nova.visited');
    localStorage.removeItem('nova.safetyAccepted');
  } catch {
    /* storage unavailable */
  }
  location.reload();
}

/** Start-up for a remembered account: confirm the session, then bring this browser and the account in line. */
export async function restoreSession(): Promise<void> {
  const user = useAccount.getState().user;
  if (!user) return;
  try {
    const r = await api<AuthReply>('/api/auth/me');
    setUser(r.user);
    await reconcile(r.user, r.savedAt);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) sessionEnded();
    else useAccount.setState({ sync: 'offline' }); // keep playing; changes are pushed once the server is back
  }
}

/** The session expired or was revoked: keep this browser's pilot (it is still theirs) and ask them to sign in. */
function sessionEnded() {
  setUser(null);
  useAccount.setState({ sync: 'idle' });
  useNova.getState().setLoggedIn(false);
  useNova.getState().setLoginOpen(true);
}

// ── Save, load, sync ───────────────────────────────────────────────────────

const freshStats = (): Stats => ({ xp: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, day: new Date().toISOString().slice(0, 10), dayQuizzes: 0 });

const EMPTY_SAVE: PilotSave = {
  v: 1,
  course: { activeId: null, library: {}, stats: freshStats() },
  hub: { quizzes: [], nextAt: {} },
  profile: { callsign: '', avatar: '', themeColor: DEFAULT_COLOR, activeObjective: null },
  tutor: {},
};

type SlimCourse = Course & { slim?: true };

/** A demo course is saved as its template reference (objective) — the lessons are rebuilt on load. */
function slim(e: LibraryEntry): LibraryEntry {
  if (e.course.source !== 'template') return e;
  const { id, title, subtitle, objective, source } = e.course;
  return { ...e, course: { id, title, subtitle, objective, source, modules: [], slim: true } as SlimCourse };
}

function rebuild(c: SlimCourse): Course {
  if (!c.slim) return c;
  return tidyCourse({ ...courseFromObjective(c.objective), id: c.id });
}

export function collectSave(): PilotSave {
  const c = useCourse.getState();
  const h = useHubQuiz.getState();
  const n = useNova.getState();
  return {
    v: 1,
    course: { activeId: c.activeId, library: Object.fromEntries(Object.entries(c.library).map(([id, e]) => [id, slim(e)])), stats: c.stats },
    hub: { quizzes: h.quizzes, nextAt: h.nextAt },
    profile: { callsign: useProfile.getState().callsign, avatar: useProfile.getState().avatar, themeColor: n.themeColor, activeObjective: n.activeObjective },
    tutor: useTutor.getState().threads,
  };
}

let applying = false;

function applySave(save: PilotSave) {
  applying = true;
  try {
    const library = Object.fromEntries(Object.entries(save.course?.library ?? {}).map(([id, e]) => [id, { ...e, course: rebuild(e.course as SlimCourse) }]));
    useCourse.setState({ activeId: save.course?.activeId ?? null, library, stats: save.course?.stats ?? freshStats() });
    // After the courses: replaces any hub quiz the course change might have scheduled.
    useHubQuiz.setState({ quizzes: save.hub?.quizzes ?? [], nextAt: save.hub?.nextAt ?? {}, run: null });
    useProfile.getState().setCallsign(save.profile?.callsign ?? '');
    useProfile.getState().setAvatar(save.profile?.avatar ?? '');
    useNova.getState().setThemeColor(save.profile?.themeColor || DEFAULT_COLOR);
    const objective = save.profile?.activeObjective ?? null;
    if (objective) useNova.getState().setActiveObjective(objective);
    else {
      writeJSON('nova.activeObjective', null);
      useNova.setState({ activeObjective: null });
    }
    useTutor.setState({ threads: save.tutor ?? {} });
  } finally {
    applying = false;
  }
  void upgradeDemoCourses();
}

/** The last save body this session sent or received — an identical push is skipped. */
let lastBody = '';
let timer: ReturnType<typeof setTimeout> | null = null;
let pushing: Promise<void> | null = null;

async function pull(user: AccountUser): Promise<void> {
  const r = await api<{ savedAt: number | null; save: PilotSave | null }>('/api/progress');
  if (!r.save || !r.savedAt) return;
  applySave(r.save);
  lastBody = JSON.stringify(collectSave());
  writeSync({ sub: user.sub, base: r.savedAt, changedAt: null });
  useAccount.setState({ sync: 'saved', syncedAt: Date.now() });
}

/** Decides which copy wins after sign-in or start-up: this browser's pilot or the account's save. */
async function reconcile(user: AccountUser, serverSavedAt: number | null): Promise<void> {
  const local = readSync();
  if (!local || local.sub !== user.sub) {
    if (serverSavedAt) return pull(user);
    // No save yet: a fresh pilot here becomes the account's; another account's pilot stays theirs.
    if (local) applySave(EMPTY_SAVE);
    writeSync({ sub: user.sub, base: null, changedAt: Date.now() });
    return push();
  }
  if (serverSavedAt === local.base) {
    if (local.changedAt) return push();
    lastBody = JSON.stringify(collectSave()); // already in step: re-renders of the same data aren't re-sent
    useAccount.setState({ sync: 'saved' });
    return;
  }
  // The account moved on (another device). Newest wins when both changed.
  if (!local.changedAt || (serverSavedAt ?? 0) > local.changedAt) return pull(user);
  writeSync({ ...local, base: serverSavedAt });
  return push();
}

function onLocalChange() {
  const user = useAccount.getState().user;
  if (applying || !user) return;
  const local = readSync();
  writeSync({ sub: user.sub, base: local?.sub === user.sub ? local.base : null, changedAt: Date.now() });
  schedule(PUSH_DELAY);
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void push();
  }, ms);
}

/** Sends this browser's pilot to the account (one push at a time; changes made meanwhile go in the next one). */
function push(): Promise<void> {
  pushing ??= doPush().finally(() => {
    pushing = null;
  });
  return pushing;
}

async function doPush(): Promise<void> {
  const user = useAccount.getState().user;
  const local = readSync();
  if (!user || !local || local.sub !== user.sub || !local.changedAt) return;
  const save = collectSave();
  const body = JSON.stringify(save);
  const startedAt = Date.now();
  const done = (base: number | null) => {
    const now = readSync();
    // Changes made while the request was in flight stay pending.
    writeSync({ sub: user.sub, base, changedAt: now?.changedAt && now.changedAt > startedAt ? now.changedAt : null });
    useAccount.setState({ sync: 'saved', syncedAt: Date.now() });
  };
  if (body === lastBody) return done(local.base);
  useAccount.setState({ sync: 'saving' });
  try {
    await api('/api/progress', { method: 'PUT', body: JSON.stringify({ savedAt: startedAt, base: local.base, save }) });
    lastBody = body;
    done(startedAt);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 409) await pull(user).catch(() => useAccount.setState({ sync: 'offline' }));
    else if (e.status === 401) sessionEnded();
    else {
      useAccount.setState({ sync: 'offline' });
      schedule(RETRY_DELAY);
    }
  }
}

// Watch everything that belongs in the save.
useCourse.subscribe((s, p) => (s.library !== p.library || s.stats !== p.stats || s.activeId !== p.activeId) && onLocalChange());
useHubQuiz.subscribe((s, p) => (s.quizzes !== p.quizzes || s.nextAt !== p.nextAt) && onLocalChange());
useProfile.subscribe((s, p) => (s.callsign !== p.callsign || s.avatar !== p.avatar) && onLocalChange());
useNova.subscribe((s, p) => (s.themeColor !== p.themeColor || s.activeObjective !== p.activeObjective) && onLocalChange());
useTutor.subscribe((s, p) => s.threads !== p.threads && onLocalChange());

// Leaving: push now (tab hidden), or hand a small final save to the browser to deliver (page closing).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && readSync()?.changedAt) void push();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
  const user = useAccount.getState().user;
  const local = readSync();
  if (!user || !local?.changedAt || local.sub !== user.sub) return;
  const body = JSON.stringify({ savedAt: Date.now(), base: local.base, save: collectSave() });
  if (body.length > KEEPALIVE_MAX) return;
  void fetch('/api/progress', { method: 'PUT', keepalive: true, credentials: 'same-origin', headers: { 'X-Nova': '1', 'Content-Type': 'application/json' }, body }).catch(() => {});
});
}
