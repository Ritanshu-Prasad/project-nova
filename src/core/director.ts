import { audio } from './audio';
import { ARRIVAL_NOTICE, PREFLIGHT } from './content';
import { clamp, damp, easeOutCubic, kf, lerp, smoothstep, type Keyframes } from './math';
import { resetRuntime, rt } from './runtime';
import { resetJourney, tickJourney } from './journey';
import { BAY } from './scene';
import { SYSTEM_ORDER, useNova, type Phase, type SystemKey } from './store';

/**
 * The director owns the cinematic timeline. It is the only writer of most `rt` values and of
 * `store.phase`; everything else (3D, HUD, overlays, audio) just reads.
 *
 *   gate ─wake()→ wake ─auto→ preflight ─(3 systems + hold)→ launch ─auto→ warp ─auto→ arrive ─auto→ landed
 */

/** Timeline constants in seconds. Reduced motion uses the shorter `_rm` variants where present. */
export const TIMING = {
  wake: 6.4,
  wake_rm: 2.6,
  /** "You have awakened" System window appears. */
  wakeNotice: 4.2,
  wakeNotice_rm: 1.2,
  /** After the last system comes online: clearance is granted, then the doors take `doorsOpen` to open. */
  clearanceDelay: 0.9,
  doorsOpen: 2.6,
  /** Holding to full charge / draining when released. */
  chargeTime: 2.4,
  drainTime: 0.7,
  /** Catapult run: the ship reaches BAY.exitZ at tubeExit, the phase ends at launch. */
  tubeExit: 1.45,
  launch: 1.75,
  warp: 3.4,
  warp_rm: 1.6,
  /** Moment inside the warp when the hangar world is swapped for the new world (tunnel fully opaque). */
  warpSwap: 1.5,
  warpSwap_rm: 0.8,
  arrive: 3.8,
  /** Duration of the deceleration glide into the parking point. */
  approach: 3.2,
} as const;

const WAKE_EYELID: Keyframes = [[0, 0], [0.9, 0], [1.5, 0.32], [1.75, 0.04], [2.3, 0.06], [2.9, 0.62], [3.05, 0.12], [3.25, 0.18], [4.1, 1]];
const WAKE_BLUR: Keyframes = [[0, 18], [2.3, 16], [2.9, 9], [3.6, 5], [4.6, 1.5], [5.4, 0]];
const WAKE_SLUMP: Keyframes = [[0, 1], [2.6, 1], [5.4, 0]];
const WAKE_DIZZY: Keyframes = [[0, 1], [3, 0.8], [6.4, 0]];
const WAKE_RM = {
  eyelid: [[0, 0], [0.3, 0], [1.4, 1]] as Keyframes,
  blur: [[0, 6], [1.4, 0]] as Keyframes,
  slump: [[0, 0.25], [1.6, 0]] as Keyframes,
};
/** Main power stutters on before it holds. */
const POWER_FLICKER: Keyframes = [[0, 0], [0.06, 0.75], [0.14, 0.08], [0.3, 0.9], [0.38, 0.25], [0.62, 1]];

/** Launch acceleration so the ship covers the rail (|BAY.exitZ|) in TIMING.tubeExit seconds. */
const LAUNCH_ACCEL = (2 * Math.abs(BAY.exitZ)) / (TIMING.tubeExit * TIMING.tubeExit);
/** Display conversion from world units/s to "km/s" on the HUD. */
const KMS_PER_UNIT = 42;
const LIGHT_SPEED_KMS = 299_792;

const store = () => useNova.getState();
const clock = () => performance.now() / 1000;

let phaseStart = clock();
const fired = new Set<string>();
const sysAt: Record<SystemKey, number | null> = { power: null, neural: null, core: null };
let clearedAt: number | null = null;
let lastBeat = -10;
let prevCountdown = 0;
let litBanks = 0;

function once(key: string, fn: () => void) {
  if (fired.has(key)) return;
  fired.add(key);
  fn();
}

const rm = () => rt.reducedMotion;

/** Switches phase and fires its entry cues. */
export function enterPhase(phase: Phase): void {
  phaseStart = clock();
  rt.phaseTime = 0;
  fired.clear();
  store().setPhase(phase);
  switch (phase) {
    case 'wake':
      audio.play('breath');
      break;
    case 'preflight':
      audio.play('quest');
      break;
    case 'launch':
      rt.holding = false;
      audio.play('launch');
      break;
    case 'warp':
      audio.play('warpIn');
      break;
    case 'arrive':
      store().setWorld('newworld');
      audio.play('arrive');
      break;
    case 'landed':
      store().setIntroSeen(true);
      break;
    default:
      break;
  }
}

// ── Public actions ──────────────────────────────────────────────────────

/** Gate → wake. Call from the click/keypress handler so the AudioContext may start. */
export function wake(): void {
  if (store().phase !== 'gate') return;
  void audio.init();
  enterPhase('wake');
}

export type ToggleResult = { ok: true } | { ok: false; reason: 'phase' | 'order' | 'already' };

/** Brings a ship system online (one-way). Systems must follow SYSTEM_ORDER. */
export function toggleSystem(key: SystemKey): ToggleResult {
  const s = store();
  if (s.phase !== 'preflight') return { ok: false, reason: 'phase' };
  if (s.systems[key]) return { ok: false, reason: 'already' };
  const next = SYSTEM_ORDER.find((k) => !s.systems[k]);
  if (next !== key) {
    audio.play('denied');
    s.notify({ kind: 'warning', title: 'ACCESS DENIED', lines: [PREFLIGHT.denied], ttl: 2.5 });
    return { ok: false, reason: 'order' };
  }
  const t = clock();
  sysAt[key] = t;
  s.setSystem(key, true);
  audio.play('switch');
  audio.play(key === 'power' ? 'powerUp' : key === 'neural' ? 'hudBoot' : 'coreIgnite');
  if (SYSTEM_ORDER.every((k) => k === key || s.systems[k])) clearedAt = t + TIMING.clearanceDelay;
  return { ok: true };
}

/** Hold-to-launch input from keyboard, the DOM launch button or the 3D throttle. */
export function setHolding(holding: boolean): void {
  rt.holding = holding && store().phase === 'preflight' && store().cleared;
}

/** Fires the accent pulse (reactor glow, bloom bump). */
export function pulse(): void {
  rt.pulse = 1;
}

/** Jumps straight to the arrival glide with every system online. */
export function skipIntro(): void {
  const s = store();
  if (s.phase === 'arrive' || s.phase === 'landed') return;
  void audio.init();
  bringEverythingOnline();
  enterPhase('arrive');
}

/** Back to the hangar, eyes shut, systems offline — then wake up again. */
export function replayIntro(): void {
  resetJourney();
  resetTimelineState();
  resetRuntime();
  store().resetShip();
  enterPhase('wake');
}

function bringEverythingOnline() {
  const s = store();
  const t = clock() - 10;
  for (const k of SYSTEM_ORDER) {
    sysAt[k] = t;
    s.setSystem(k, true);
  }
  clearedAt = t;
  s.setCleared(true);
  Object.assign(rt, {
    eyelid: 1, blur: 0, slump: 0, dizzy: 0, emergency: 0, power: 1, bayLights: 1, hud: 1, core: 1,
    doors: 1, clearance: 1, charge: 0, holding: false, countdown: 0, warp: 0, flash: 0, approach: 0,
  });
}

function resetTimelineState() {
  for (const k of SYSTEM_ORDER) sysAt[k] = null;
  clearedAt = null;
  lastBeat = -10;
  prevCountdown = 0;
  litBanks = 0;
}

/** Dev/QA only: jump to any phase with the state it would have had. */
export function debugJump(phase: Phase): void {
  resetTimelineState();
  resetRuntime();
  store().resetShip();
  if (phase === 'gate' || phase === 'wake') {
    enterPhase(phase);
    return;
  }
  if (phase === 'preflight') {
    rt.eyelid = 1; rt.blur = 0; rt.slump = 0; rt.dizzy = 0;
    enterPhase('preflight');
    return;
  }
  bringEverythingOnline();
  if (phase === 'arrive' || phase === 'landed') {
    store().setWorld('newworld');
    rt.approach = phase === 'landed' ? 1 : 0;
    rt.arrive = phase === 'landed' ? 1 : 0;
  }
  enterPhase(phase);
}

// ── Per-frame timeline ──────────────────────────────────────────────────

function tick(dt: number): void {
  const now = clock();
  const t = now - phaseStart;
  const s = store();
  rt.time = now;
  rt.dt = dt;
  rt.phaseTime = t;
  rt.reducedMotion = s.reducedMotion;
  rt.pulse = Math.max(0, rt.pulse - dt * 1.2);

  switch (s.phase) {
    case 'gate': {
      rt.eyelid = 0; rt.blur = 18; rt.slump = 1; rt.dizzy = 1; rt.emergency = 1;
      break;
    }

    case 'wake': {
      if (rm()) {
        rt.eyelid = kf(t, WAKE_RM.eyelid);
        rt.blur = kf(t, WAKE_RM.blur);
        rt.slump = kf(t, WAKE_RM.slump);
        rt.dizzy = 0;
      } else {
        rt.eyelid = kf(t, WAKE_EYELID);
        rt.blur = kf(t, WAKE_BLUR);
        rt.slump = kf(t, WAKE_SLUMP);
        rt.dizzy = kf(t, WAKE_DIZZY);
        // Heartbeat slows as the pilot comes round.
        if (t < 4.6 && t - lastBeat > lerp(0.95, 1.35, t / 4.6)) {
          lastBeat = t;
          audio.play('heartbeat');
        }
      }
      rt.emergency = 1;
      if (t >= (rm() ? TIMING.wakeNotice_rm : TIMING.wakeNotice)) once('notice', () => audio.play('chime'));
      if (t >= (rm() ? TIMING.wake_rm : TIMING.wake)) enterPhase('preflight');
      break;
    }

    case 'preflight': {
      rt.eyelid = 1;
      rt.blur = 0;
      rt.slump = damp(rt.slump, 0, 4, dt);
      rt.dizzy = damp(rt.dizzy, 0, 2, dt);

      if (sysAt.power !== null) {
        const tp = now - sysAt.power;
        rt.power = rm() ? smoothstep(0, 0.5, tp) : kf(tp, POWER_FLICKER);
        rt.emergency = 1 - smoothstep(0.3, 1.2, tp);
        rt.bayLights = clamp((tp - 0.35) / 2.4);
        const banks = Math.floor(rt.bayLights * BAY.lightBanks + 1e-6);
        if (banks > litBanks) {
          litBanks = banks;
          audio.play('lightsOn', banks - 1);
        }
      } else {
        rt.power = 0;
        rt.emergency = 1;
        rt.bayLights = 0;
      }
      rt.hud = sysAt.neural !== null ? smoothstep(0, 0.9, now - sysAt.neural) : 0;
      rt.core = sysAt.core !== null ? smoothstep(0, 1.6, now - sysAt.core) : 0;

      if (clearedAt !== null && now >= clearedAt) {
        once('cleared', () => {
          s.setCleared(true);
          audio.play('doorOpen');
          s.notify({ kind: 'quest', title: 'QUEST COMPLETE', lines: [PREFLIGHT.complete], ttl: 4.5 });
        });
        const tc = now - clearedAt;
        rt.clearance = smoothstep(0, 0.6, tc);
        rt.doors = smoothstep(0.2, 0.2 + TIMING.doorsOpen, tc);
        rt.charge = rt.holding
          ? Math.min(1, rt.charge + dt / TIMING.chargeTime)
          : Math.max(0, rt.charge - dt / TIMING.drainTime);
      } else {
        rt.clearance = 0;
        rt.doors = 0;
        rt.charge = 0;
      }

      // 3 · 2 · 1 synced to the charge thirds; a beep each time a new digit appears.
      const cd = rt.charge <= 0 ? 0 : rt.charge < 1 / 3 ? 3 : rt.charge < 2 / 3 ? 2 : 1;
      if (cd !== prevCountdown) {
        if (cd > 0 && (prevCountdown === 0 || cd < prevCountdown)) audio.play('countdown', cd);
        prevCountdown = cd;
      }
      rt.countdown = cd;

      rt.engine = 0.22 * rt.core + 0.78 * rt.charge;
      rt.shake = rm() ? 0 : 0.04 * rt.core + 0.5 * rt.charge * rt.charge;
      rt.fovKick = rm() ? 0 : -4 * rt.charge;
      rt.speedKms = 0;
      if (rt.charge >= 1) enterPhase('launch');
      break;
    }

    case 'launch': {
      const tt = Math.min(t, TIMING.tubeExit);
      rt.shipZ = -0.5 * LAUNCH_ACCEL * tt * tt - Math.max(0, t - TIMING.tubeExit) * LAUNCH_ACCEL * TIMING.tubeExit;
      rt.shipSpeed = LAUNCH_ACCEL * tt;
      rt.flash = rm() ? 0 : kf(t, [[0, 0.9], [0.4, 0]]);
      rt.shake = rm() ? 0 : kf(t, [[0, 1], [0.7, 0.7], [1.75, 0.55]]);
      rt.fovKick = rm() ? 0 : kf(t, [[0, -4], [0.3, 16], [1.75, 24]]);
      rt.warp = kf(t, [[0, 0], [1.2, 0.05], [1.75, 0.35]]);
      rt.engine = 1;
      rt.charge = 1;
      rt.countdown = 0;
      rt.speedKms = rt.shipSpeed * KMS_PER_UNIT;
      if (t >= TIMING.launch) enterPhase('warp');
      break;
    }

    case 'warp': {
      const R = rm();
      const dur = R ? TIMING.warp_rm : TIMING.warp;
      rt.shipZ -= rt.shipSpeed * dt;
      rt.warp = R ? kf(t, [[0, 0.35], [0.4, 1], [1.2, 1], [1.6, 0]]) : kf(t, [[0, 0.35], [0.6, 1], [2.5, 1], [3.2, 0]]);
      if (t >= (R ? TIMING.warpSwap_rm : TIMING.warpSwap)) once('swap', () => s.setWorld('newworld'));
      rt.approach = 0;
      rt.fovKick = R ? 0 : kf(t, [[0, 24], [0.6, 34], [2.5, 30], [3.1, 6], [3.4, 0]]);
      rt.shake = R ? 0 : kf(t, [[0, 0.55], [0.6, 0.35], [2.6, 0.3], [3.0, 0.65], [3.4, 0.15]]);
      rt.flash = R ? 0 : kf(t, [[2.9, 0], [3.05, 0.75], [3.4, 0]]);
      rt.engine = kf(t / dur, [[0, 1], [0.75, 0.9], [1, 0.45]]);
      rt.speedKms = lerp(rt.speedKms, LIGHT_SPEED_KMS * 0.98, 1 - Math.exp(-3 * dt));
      if (t >= dur - 0.4) once('exit', () => audio.play('warpOut'));
      if (t >= dur) enterPhase('arrive');
      break;
    }

    case 'arrive': {
      rt.warp = 0;
      rt.flash = damp(rt.flash, 0, 6, dt);
      rt.approach = easeOutCubic(clamp(t / TIMING.approach));
      rt.arrive = smoothstep(0.3, 2.8, t);
      rt.fovKick = damp(rt.fovKick, 0, 3, dt);
      rt.shake = damp(rt.shake, rm() ? 0 : 0.015, 2.5, dt);
      rt.engine = damp(rt.engine, 0.14, 1.5, dt);
      rt.speedKms = lerp(18_000, 1_240, easeOutCubic(clamp(t / TIMING.approach)));
      if (t >= 1.4) {
        once('notice', () =>
          s.notify({ kind: 'system', title: ARRIVAL_NOTICE.title, lines: [...ARRIVAL_NOTICE.lines], ttl: 6 }),
        );
      }
      if (t >= TIMING.arrive) enterPhase('landed');
      break;
    }

    case 'landed': {
      rt.approach = 1;
      rt.arrive = 1;
      rt.warp = 0;
      rt.flash = damp(rt.flash, 0, 6, dt);
      rt.fovKick = damp(rt.fovKick, 0, 3, dt);
      rt.shake = damp(rt.shake, rm() ? 0 : 0.01, 2, dt);
      rt.engine = damp(rt.engine, 0.12, 1, dt);
      rt.speedKms = damp(rt.speedKms, 1_240, 1, dt);
      break;
    }
  }
}

// ── Loop ────────────────────────────────────────────────────────────────

let raf = 0;
let running = false;

/**
 * Starts the director's own rAF loop (independent of WebGL so the DOM experience works without it).
 * Returns a stop function. Safe under StrictMode's double effects.
 */
export function startDirector(): () => void {
  if (running) return stopDirector;
  running = true;
  let last = performance.now();
  const loop = (ms: number) => {
    const dt = Math.min(0.1, Math.max(0, (ms - last) / 1000));
    last = ms;
    tick(dt);
    tickJourney(dt);
    audio.update(dt);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return stopDirector;
}

function stopDirector() {
  running = false;
  cancelAnimationFrame(raf);
}
