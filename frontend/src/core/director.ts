import { audio } from './audio';
import { PREFLIGHT } from './content';
import { clamp, damp, easeOutCubic, kf, lerp, smoothstep, type Keyframes } from './math';
import { resetRuntime, rt } from './runtime';
import { goToCockpit, goToLounge, isBusy, resetJourney, tickJourney, useDeck } from './journey';
import { useCourse, travelsAvailable } from './course';
import { planetName } from './planets';
import './tour';
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
  wake: 2.2,
  wake_rm: 1.3,
  /** "You have awakened" System window appears. */
  wakeNotice: 1.3,
  wakeNotice_rm: 0.8,
  /** After the last system comes online: clearance is granted, then the doors take `doorsOpen` to open. */
  clearanceDelay: 0.9,
  doorsOpen: 2.6,
  /** Holding to full charge / draining when released. */
  chargeTime: 2.4,
  drainTime: 0.7,
  /** Catapult run: the ship reaches BAY.exitZ at tubeExit, the phase ends at launch. */
  tubeExit: 1.45,
  launch: 1.75,
  warp: 3.6,
  warp_rm: 1.6,
  /** Moment inside the warp when the hangar world is swapped for the new world (tunnel fully opaque). */
  warpSwap: 1.5,
  warpSwap_rm: 0.8,
  arrive: 3.8,
  /** Duration of the deceleration glide into the parking point. */
  approach: 3.4,
} as const;

/** Share of the catapult's field-of-view kick used when launching from space. */
const SPACE_LAUNCH_KICK = 0.4;

// The eyes open straight onto the hangar bay: one smooth lid lift, no blur, no slump and no dizzy roll.
// The eyes open in two goes (a first crack, a heavy blink, then wide), so the lids are never cut short by the next phase.
const WAKE_EYELID: Keyframes = [[0, 0.2], [0.45, 0.42], [0.75, 0.36], [1.5, 0.9], [2.1, 1]];
const WAKE_BLUR: Keyframes = [[0, 0]];
const WAKE_SLUMP: Keyframes = [[0, 0]];
const WAKE_DIZZY: Keyframes = [[0, 0]];
const WAKE_RM = {
  eyelid: [[0, 0.4], [1.2, 1]] as Keyframes,
  blur: [[0, 0]] as Keyframes,
  slump: [[0, 0]] as Keyframes,
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
/** The walk to the lounge that follows a landing; cancelled if anything else happens first. */
let landedTimer: ReturnType<typeof setTimeout> | null = null;
const cancelLandedWalk = () => {
  if (landedTimer !== null) clearTimeout(landedTimer);
  landedTimer = null;
};

function once(key: string, fn: () => void) {
  if (fired.has(key)) return;
  fired.add(key);
  fn();
}

const rm = () => rt.reducedMotion;

/** Switches phase and fires its entry cues. */
export function enterPhase(phase: Phase): void {
  cancelLandedWalk();
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
      rt.arrive = 0; // the new world fades in from the first frame (a jump from space still has the old value)
      audio.play('arrive');
      break;
    case 'landed':
      rt.isInterPlanetJump = false;
      store().setIntroSeen(true);
      if (replayingFromLounge) {
        // A replay from the lounge: once landed, walk straight back to the lounge.
        replayingFromLounge = false;
        store().notify({ kind: 'toast', title: `Now orbiting ${planetName()}`, ttl: 4 });
        landedTimer = setTimeout(() => {
          landedTimer = null;
          goToLounge();
        }, 600);
      }
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

/** Ends every launch effect: the streak field and cockpit shake follow these values. */
function settleMotion(): void {
  Object.assign(rt, { shipSpeed: 0, warp: 0, flash: 0, shake: 0, fovKick: 0, spaceLaunch: false });
}

/** Jumps straight to the arrival glide with every system online. */
export function skipIntro(): void {
  const s = store();
  if (s.phase === 'arrive' || s.phase === 'landed') return;
  void audio.init();
  bringEverythingOnline();
  finishSpaceJump(); // a skipped jump from space still ends at the next planet
  settleMotion();
  enterPhase('arrive');
}

let replayingFromLounge = false;

/** Easter egg / profile option: relive the wake-up and launch, then return to the lounge (no sign-in steps). */
export function replayLaunch(): void {
  replayingFromLounge = true;
  replayIntro();
}

/** Ends the in-space launch's special motion and moves to the next world of the tour (once). */
function finishSpaceJump(): void {
  if (!rt.spaceLaunch) return;
  if (rt.finaleFlight) rt.finaleWorld = true; // the course finale ends in front of the dying sun, not at the next planet
  else useCourse.getState().recordTravel(); // one earned jump: the next planet of the course
  rt.spaceLaunch = false;
  rt.shipZ = 0;
}

/**
 * LAUNCH cheat / Profile / Settings: the pilot walks from the lounge back to the seat (the walk to the lounge in
 * reverse). The ship stays where it is, in space at the current planet; it powers down and the pilot flips the three
 * switches again and holds to launch — a jump from here, not from the launch pad — ending at the next planet.
 */
export function relaunchFromSpace(delayMs = 0): boolean {
  if (!canRelaunch()) return false;
  goToCockpit(beginSpacePreflight, delayMs);
  return true;
}

/** A finished module earns one jump to the next planet (core/course.ts); without one the ship stays where it is. */
export function hasJump(): boolean {
  const s = useCourse.getState();
  return travelsAvailable(s.activeId ? s.library[s.activeId] : undefined) > 0;
}

/** Only from the lounge, parked at a planet, with no walk or timer in flight (a second press must not start a second flight). */
export function canRelaunch(): boolean {
  return store().phase === 'landed' && useDeck.getState().deck === 'lounge' && landedTimer === null && !isBusy() && !rt.finaleFlight && hasJump();
}

/** The course finale: the ship powers down in its seat and the pilot launches — to the dying sun instead of the next planet. */
export function startFinaleFlight(): void {
  beginSpacePreflight(true);
}

/** Leaves the finale: back to the normal world at the current planet (also when it is abandoned halfway). */
export function endFinale(): void {
  rt.finaleFlight = false;
  rt.finaleWorld = false;
  if (store().phase !== 'landed') {
    bringEverythingOnline();
    settleMotion();
    rt.spaceLaunch = false;
    rt.approach = 1;
    rt.arrive = 1;
    store().setWorld('newworld');
    enterPhase('landed');
  }
}

function beginSpacePreflight(finale = false): void {
  resetTimelineState();
  Object.assign(rt, {
    eyelid: 1, blur: 0, slump: 0, dizzy: 0, emergency: 0, power: 1.0, bayLights: 0, hud: 0, core: 0,
    doors: 0, clearance: 0, charge: 0, holding: false, countdown: 0, warp: 0, flash: 0, engine: 0,
    shake: 0, fovKick: 0, shipZ: 0, shipSpeed: 0, speedKms: 0, approach: 1, arrive: 1, spaceLaunch: true, isInterPlanetJump: true,
    finaleFlight: finale, finaleWorld: false,
  });
  replayingFromLounge = !finale; // after the finale the pilot stays at the controls for the blast
  enterPhase('preflight');
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
    // Returning visitor: ensure eyes are fully open and all wake effects are cleared
    // so there is no black screen or lingering blur.
    rt.eyelid = 1;
    rt.blur = 0;
    rt.slump = 0;
    rt.dizzy = 0;
    rt.emergency = 0;
    rt.deckLightDim = 1;
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
  if (rt.novaOn) rt.novaT += dt; // the finale's supernova clock (see three/space/Supernova.tsx)

  switch (s.phase) {
    case 'gate': {
      rt.eyelid = 0; rt.blur = 0; rt.slump = 0; rt.dizzy = 0; rt.emergency = 1;
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
        if (rt.isInterPlanetJump) {
          rt.power = damp(rt.power, 0.45, 2, dt);
          rt.emergency = 0;
          if (t >= 0.4) {
            once('spaceStandby', () => {
              for (const k of SYSTEM_ORDER) s.setSystem(k, false);
              s.setCleared(false);
              audio.play('quest');
            });
          }
        } else {
          rt.power = damp(rt.power, 0, 4, dt);
          rt.emergency = damp(rt.emergency, 1, 3, dt);
        }
        rt.bayLights = 0;
      }
      rt.hud = sysAt.neural !== null ? smoothstep(0, 0.9, now - sysAt.neural) : 0;
      rt.core = sysAt.core !== null ? smoothstep(0, 1.6, now - sysAt.core) : 0;

      if (clearedAt !== null && now >= clearedAt) {
        once('cleared', () => {
          s.setCleared(true);
          audio.play('doorOpen');
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
      // From space the planet and its moons stream past instead (three/space/transition.ts), so the view widens less: the
      // full catapult kick made the planet look as if it fell back from the window before it rushed by.
      rt.fovKick = rm() ? 0 : kf(t, [[0, -4], [0.3, 16], [1.75, 24]]) * (rt.spaceLaunch ? SPACE_LAUNCH_KICK : 1);
      // Two-stage departure: slow drift at t in [0, 0.7s], then exponential hyperdrive surge
      rt.warp = kf(t, [[0, 0], [0.7, 0.04], [1.2, 0.12], [1.75, 0.35]]);
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
      if (s.world === 'bay' || rt.spaceLaunch) rt.shipZ -= rt.shipSpeed * dt; // only the launch itself moves the ship; after the swap it glides in
      // Two-stage warp trajectory: surge to 1.0, steady cruise, then hyper-speed burst exit
      rt.warp = R
        ? kf(t, [[0, 0.35], [0.4, 1], [1.2, 1], [1.6, 0]])
        : kf(t, [[0, 0.35], [0.55, 1.0], [2.65, 1.0], [3.05, 0.35], [3.6, 0.0]]);
      if (t >= (R ? TIMING.warpSwap_rm : TIMING.warpSwap))
        once('swap', () => {
          s.setWorld('newworld');
          finishSpaceJump(); // from space: the tunnel is opaque, so the new planet replaces the old one unseen
        });
      rt.approach = 0;
      if (t >= (R ? TIMING.warpSwap_rm : TIMING.warpSwap)) rt.shipSpeed = damp(rt.shipSpeed, 0, 2.5, dt); // the rail speed dies away once the swap is done
      rt.fovKick = R ? 0 : kf(t, [[0, 24 * (rt.spaceLaunch ? SPACE_LAUNCH_KICK : 1)], [0.6, 34], [2.6, 30], [3.1, 8], [3.6, 0]]);
      rt.shake = R ? 0 : kf(t, [[0, 0.55], [0.6, 0.35], [2.6, 0.3], [3.0, 0.65], [3.6, 0.1]]);
      const entryFlash = kf(t, [[0, 1.0], [0.15, 0.9], [0.5, 0]]);
      const exitFlash = kf(t, [[2.55, 0], [2.95, 1.0], [3.5, 0.6]]);
      // One flash in and one out: the pulse that used to blink at the swap made the warp read as flickering.
      rt.flash = R ? 0 : Math.max(entryFlash, exitFlash);
      rt.engine = kf(t / dur, [[0, 1], [0.75, 0.9], [1, 0.45]]);
      rt.speedKms = lerp(rt.speedKms, LIGHT_SPEED_KMS * 0.98, 1 - Math.exp(-3 * dt));
      if (t >= dur - 0.45) once('exit', () => audio.play('warpOut'));
      if (t >= dur) enterPhase('arrive');
      break;
    }

    case 'arrive': {
      rt.warp = 0;
      rt.shipSpeed = damp(rt.shipSpeed, 0, 3, dt); // streaks fade out as the ship drops out of warp
      rt.flash = damp(rt.flash, 0, 4.5, dt);
      rt.approach = easeOutCubic(clamp(t / TIMING.approach));
      rt.arrive = smoothstep(0.2, 3.0, t);
      rt.fovKick = damp(rt.fovKick, 0, 3, dt);
      rt.shake = damp(rt.shake, rm() ? 0 : 0.015, 2.5, dt);
      rt.engine = damp(rt.engine, 0.14, 1.5, dt);
      rt.speedKms = lerp(18_000, 1_240, easeOutCubic(clamp(t / TIMING.approach)));
      if (t >= TIMING.arrive) enterPhase('landed');
      break;
    }

    case 'landed': {
      rt.shipSpeed = 0;
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
