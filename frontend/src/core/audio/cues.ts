import type { Cue } from '../audio';
import { BAY } from '../scene';
import type { Bus } from './bus';
import { rand, randRange } from './random';
import { driveCurve, glide, pluck, ramp, swell, Voice } from './voice';

/**
 * One-shot cues. Every builder takes any BaseAudioContext (through the bus), a start time and the
 * optional cue argument, so the live engine and the offline analysis render exactly the same sound.
 */
export type CueBuilder = (bus: Bus, t: number, arg?: number) => void;

/** Output trims per cue (balanced with the AudioLab offline analysis). */
const LEVEL = {
  heartbeat: 0.42,
  breath: 0.22,
  chime: 0.16,
  quest: 0.13,
  switch: 0.2,
  powerUp: 0.3,
  lightsOn: 0.42,
  hudBoot: 0.14,
  coreIgnite: 0.36,
  doorOpen: 0.32,
  clearance: 0.11,
  denied: 0.09,
  countdown: 0.13,
  launch: 0.62,
  warpIn: 0.42,
  warpOut: 0.38,
  arrive: 0.3,
  novaBlast: 0.55,
  hover: 0.012,
  click: 0.03,
  notify: 0.04,
  pulse: 0.14,
} as const;

/** Note frequencies (Hz). The emergency is off-key; everything after power-up lives around D major. */
const N = {
  D1: 36.71, D2: 73.42, A2: 110, D3: 146.83, Fs3: 185, A3: 220, Cs4: 277.18, E4: 329.63,
  E5: 659.26, Fs5: 739.99, A5: 880, B5: 987.77, D6: 1174.66, E6: 1318.51, Fs6: 1479.98,
  A6: 1760, B6: 1975.53, D7: 2349.32, E7: 2637.02, Fs7: 2959.96, Gs7: 3322.44, A7: 3520, B7: 3951.07,
} as const;

/** Mirrors director TIMING.tubeExit: the catapult covers the rail (|BAY.exitZ|) in this many seconds. */
const TUBE_EXIT = 1.45;
const RAIL_ACCEL = (2 * Math.abs(BAY.exitZ)) / (TUBE_EXIT * TUBE_EXIT);

type Partials = ReadonlyArray<readonly [ratio: number, amp: number, tau: number]>;

// ── Shared sound sources ────────────────────────────────────────────────

/** Struck partials (sine bank) — bells, glass, metal rings. */
function partials(v: Voice, out: AudioNode, t: number, f: number, amp: number, set: Partials, attack = 0.0015): void {
  for (const [ratio, a, tau] of set) {
    const o = v.osc('sine', f * ratio, t, t + attack + tau * 7.5);
    const g = v.gain(0);
    pluck(g.gain, t, amp * a, attack, tau);
    o.connect(g).connect(out);
  }
}

const GLASS: Partials = [[1, 1, 0.5], [2.76, 0.3, 0.2], [5.4, 0.13, 0.09], [8.93, 0.05, 0.05]];
const SOFT_BELL: Partials = [[1, 1, 0.42], [2, 0.26, 0.2], [3, 0.09, 0.1], [4.07, 0.045, 0.06]];
const METAL: Partials = [[1, 0.16, 0.42], [2.32, 0.1, 0.26], [4.25, 0.06, 0.16], [6.63, 0.035, 0.1]];

/** Clean beep: a sine with a hint of its octave. */
function tone(v: Voice, out: AudioNode, t: number, f: number, len: number, amp = 1): void {
  const end = t + len + 0.6;
  const o = v.osc('sine', f, t, end);
  const g = v.gain(0);
  swell(g.gain, t, amp, 0.004, len, 0.06);
  o.connect(g).connect(out);
  const o2 = v.osc('sine', f * 2, t, end);
  const g2 = v.gain(0);
  swell(g2.gain, t, amp * 0.12, 0.004, len * 0.5, 0.04);
  o2.connect(g2).connect(out);
}

/** A short noise burst through a filter chain. */
function burst(v: Voice, out: AudioNode, buf: AudioBuffer, t: number, amp: number, attack: number, tau: number, ...filters: AudioNode[]): void {
  const n = v.noise(buf, t, t + attack + tau * 7.5);
  const g = v.gain(0);
  pluck(g.gain, t, amp, attack, tau);
  v.chain(n, ...filters, g, out);
}

/** Heavy relay / contactor: the contact "ka", the armature "chunk", then a metallic ring. */
function relay(v: Voice, out: AudioNode, t: number, amp: number, pitch: number): void {
  const { white, pink } = v.bus.noise;
  burst(v, out, white, t, amp * 0.8, 0.0006, 0.006, v.filter('bandpass', 1500 * pitch, 1.2));
  const tc = t + 0.05;
  const thud = v.osc('sine', 95 * pitch, tc, tc + 0.8);
  glide(thud.frequency, tc, 95 * pitch, 42 * pitch, 0.14);
  const g = v.gain(0);
  pluck(g.gain, tc, amp, 0.003, 0.09);
  thud.connect(g).connect(out);
  burst(v, out, pink, tc, amp * 1.6, 0.002, 0.045, v.filter('bandpass', 520 * pitch, 1.1));
  partials(v, out, tc, 290 * pitch, amp, METAL, 0.002);
}

/** A low pitched thump with a harmonic (audible on small speakers) and a soft click. */
function thump(v: Voice, out: AudioNode, t: number, f0: number, f1: number, amp: number, tau: number): void {
  const end = t + 0.006 + tau * 8;
  const body = v.osc('sine', f0, t, end);
  glide(body.frequency, t, f0, f1, 0.12);
  const bg = v.gain(0);
  pluck(bg.gain, t, amp, 0.006, tau);
  body.connect(bg).connect(out);
  const harm = v.osc('triangle', f0 * 2, t, end);
  glide(harm.frequency, t, f0 * 2, f1 * 2, 0.1);
  const hg = v.gain(0);
  pluck(hg.gain, t, amp * 0.3, 0.004, tau * 0.7);
  v.chain(harm, hg, v.filter('lowpass', 320), out);
  burst(v, out, v.bus.noise.white, t, amp * 0.6, 0.0008, 0.005, v.filter('bandpass', 1100, 1.4));
}

/** Output gain for a cue, with an optional reverb send. */
function output(v: Voice, dest: AudioNode, level: number, send = 0): GainNode {
  const out = v.gain(level);
  out.connect(dest);
  if (send > 0) out.connect(v.gain(send)).connect(v.bus.verb);
  return out;
}

// ── Wake ────────────────────────────────────────────────────────────────

/** Lub-dub: two low thumps, the second higher and softer. */
const heartbeat: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.head, LEVEL.heartbeat);
  thump(v, out, t, 62, 38, 1, 0.1);
  thump(v, out, t + 0.27, 72, 46, 0.7, 0.075);
  v.done();
};

/** A slow inhale: noise through a rising formant, slightly wide. */
const breath: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.head, LEVEL.breath);
  const dur = 1.4;
  for (const side of [-1, 1]) {
    const n = v.noise(bus.noise.pink, t, t + dur + 0.05);
    const hp = v.filter('highpass', 280);
    const formant = v.filter('bandpass', 600, 0.9);
    glide(formant.frequency, t, side < 0 ? 560 : 640, side < 0 ? 1400 : 1600, dur);
    const airy = v.filter('bandpass', 2600, 1.6);
    const g = v.gain(0);
    ramp(g.gain, t, [[0, 0], [0.35, 0.35], [0.9, 1], [dur, 0]]);
    n.connect(hp);
    hp.connect(formant).connect(g);
    hp.connect(airy).connect(v.gain(0.35)).connect(g);
    v.chain(g, v.pan(side * 0.25), out);
  }
  v.done();
};

// ── System UI ───────────────────────────────────────────────────────────

/** The System notification: a glassy E6 strike, a slow stereo shimmer and a rising sparkle. */
const chime: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.head, LEVEL.chime, 0.5);
  partials(v, out, t, N.E6, 1, GLASS);
  for (const side of [-1, 1]) {
    const o = v.osc('sine', N.E6, t, t + 4.4, side * 2.5);
    const g = v.gain(0);
    pluck(g.gain, t + 0.004, 0.32, 0.012, 0.6);
    v.chain(o, g, v.pan(side * 0.6), out);
  }
  const body = v.osc('sine', N.E5, t, t + 4);
  const bg = v.gain(0);
  pluck(bg.gain, t, 0.28, 0.004, 0.5);
  body.connect(bg).connect(out);
  const sparkle = [N.B6, N.E7, N.Gs7, N.B7];
  sparkle.forEach((f, i) => {
    const ts = t + 0.03 + i * 0.035;
    const o = v.osc('sine', f, ts, ts + 1);
    const g = v.gain(0);
    pluck(g.gain, ts, 0.09, 0.002, 0.12);
    v.chain(o, g, v.pan(i % 2 ? 0.45 : -0.45), out);
  });
  burst(v, out, bus.noise.white, t, 0.22, 0.001, 0.025, v.filter('highpass', 7000));
  v.done();
};

/** Quest window: a warm rising fourth over a soft open fifth. */
const quest: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.head, LEVEL.quest, 0.45);
  partials(v, out, t, N.B5, 0.8, SOFT_BELL, 0.003);
  partials(v, out, t + 0.12, N.E6, 1, SOFT_BELL, 0.003);
  for (const [f, p] of [[N.E5, -0.35], [N.B5, 0.35]] as const) {
    const o = v.osc('sine', f, t, t + 3);
    const g = v.gain(0);
    swell(g.gain, t + 0.05, 0.12, 0.25, 0.2, 0.45);
    v.chain(o, g, v.pan(p), out);
  }
  v.done();
};

const hover: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.head, LEVEL.hover);
  const o = v.osc('sine', 2900, t, t + 0.08);
  const g = v.gain(0);
  pluck(g.gain, t, 1, 0.0015, 0.008);
  o.connect(g).connect(out);
  burst(v, out, bus.noise.white, t, 0.5, 0.0005, 0.003, v.filter('highpass', 6000));
  v.done();
};

const click: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.head, LEVEL.click, 0.1);
  const o = v.osc('sine', 1150, t, t + 0.25);
  glide(o.frequency, t, 1150, 1650, 0.018);
  const g = v.gain(0);
  pluck(g.gain, t, 1, 0.002, 0.03);
  o.connect(g).connect(out);
  burst(v, out, bus.noise.white, t, 0.5, 0.0005, 0.004, v.filter('highpass', 4000));
  v.done();
};

/** Toast: a subtle double blip. */
const notify: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.head, LEVEL.notify, 0.18);
  for (const [f, dt] of [[N.A6, 0], [N.D7, 0.085]] as const) partials(v, out, t + dt, f, 1, SOFT_BELL.slice(0, 2).map(([r, a]) => [r, a, 0.05] as const), 0.003);
  v.done();
};

/** Accent pulse: a soft sub thump under a quiet bell. */
const pulse: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.pulse, 0.35);
  thump(v, out, t, 64, 42, 1, 0.16);
  partials(v, out, t + 0.01, N.E6, 0.22, GLASS);
  v.done();
};

// ── Preflight ───────────────────────────────────────────────────────────

/** Guarded toggle: two metallic clacks (guard, then switch) and the body seating. */
const switchCue: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.switch, 0.15);
  const { white } = bus.noise;
  burst(v, out, white, t, 1, 0.0007, 0.0075, v.filter('highpass', 1800), v.filter('peaking', 4300, 3, 10));
  burst(v, out, white, t + 0.026, 0.65, 0.0007, 0.0075, v.filter('highpass', 1800), v.filter('peaking', 3200, 3, 10));
  const o = v.osc('sine', 180, t, t + 0.3);
  glide(o.frequency, t + 0.02, 180, 80, 0.06);
  const g = v.gain(0);
  pluck(g.gain, t + 0.022, 0.55, 0.002, 0.035);
  o.connect(g).connect(out);
  v.done();
};

/** Main power: a contactor clunk, then an electrical whine climbing three octaves, stuttering with the lights. */
const powerUp: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.powerUp, 0.3);
  relay(v, out, t + 0.01, 1, 1);

  const end = t + 2.9;
  const lp = v.filter('lowpass', 160, 10);
  glide(lp.frequency, t, 160, 3600, 1.5);
  lp.frequency.exponentialRampToValueAtTime(1200, t + 2.7);
  for (const det of [-9, 9]) {
    const o = v.osc('sawtooth', 55, t, end, det);
    glide(o.frequency, t, 55, 440, 1.6);
    o.connect(lp);
  }
  // Follows the director's POWER_FLICKER keyframes so the sound stutters with the cockpit lights.
  const flicker = v.gain(0);
  ramp(flicker.gain, t, [[0, 0], [0.06, 0.75], [0.14, 0.08], [0.3, 0.9], [0.38, 0.25], [0.62, 1], [1.6, 0.8], [2.7, 0]]);
  v.chain(lp, v.gain(0.5), flicker, out);

  const buzz = v.osc('square', 100, t, t + 1.2);
  const bg = v.gain(0);
  ramp(bg.gain, t, [[0, 0], [0.05, 0.4], [0.14, 0.04], [0.29, 0.5], [0.38, 0.12], [0.6, 0.3], [1.1, 0]]);
  v.chain(buzz, v.filter('bandpass', 1900, 2.5), bg, out);

  const crackle = v.noise(bus.noise.crackle, t, t + 1);
  const cg = v.gain(0);
  ramp(cg.gain, t, [[0, 0], [0.04, 0.5], [0.6, 0.35], [0.9, 0]]);
  v.chain(crackle, v.filter('highpass', 2000), cg, out);
  v.done();
};

/** Hangar flood-light bank `arg` (0 = nearest): relay ka-chunk + ring, further and wetter each bank. */
const lightsOn: CueBuilder = (bus, t, arg = 0) => {
  const i = Math.max(0, Math.min(7, Math.round(arg)));
  const v = new Voice(bus);
  const pitch = 1 + (((i * 5) % 7) - 3) * 0.022;
  const tt = t + 0.016 * i; // the sound travels further for every bank
  const out = v.gain(LEVEL.lightsOn / (1 + 0.42 * i));
  const pan = v.pan((i % 2 ? 1 : -1) * (0.6 - 0.06 * i));
  v.chain(out, v.filter('lowpass', 9500 / (1 + 0.5 * i)), pan, bus.world);
  pan.connect(v.gain(0.4 + 0.12 * i)).connect(bus.verb);
  relay(v, out, tt, 1, pitch);
  // Ballast buzz as the lamp strikes.
  const hum = v.osc('sawtooth', 100 * pitch, tt + 0.05, tt + 1.45);
  const hg = v.gain(0);
  ramp(hg.gain, tt + 0.05, [[0, 0], [0.02, 0.12], [0.3, 0.05], [1.3, 0]]);
  v.chain(hum, v.filter('lowpass', 700), hg, out);
  v.done();
};

/** Neural link: six ascending digital chirps, a rising sweep and a soft "online" dyad. */
const hudBoot: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.hudBoot, 0.3);
  const lp = v.filter('lowpass', 5200);
  lp.connect(out);
  [N.D6, N.E6, N.Fs6, N.A6, N.B6, N.D7].forEach((f, i) => {
    const ti = t + i * 0.055;
    const o = v.osc('square', f * 0.94, ti, ti + 0.2);
    glide(o.frequency, ti, f * 0.94, f, 0.018);
    const g = v.gain(0);
    pluck(g.gain, ti, 0.35, 0.002, 0.02);
    v.chain(o, g, v.pan(i % 2 ? 0.35 : -0.35), lp);
  });
  const ts = t + 0.28;
  const sweep = v.osc('sine', 400, ts, ts + 0.75);
  glide(sweep.frequency, ts, 400, 3200, 0.45);
  const sg = v.gain(0);
  ramp(sg.gain, ts, [[0, 0], [0.08, 0.16], [0.4, 0.12], [0.6, 0]]);
  sweep.connect(sg).connect(out);
  const n = v.noise(bus.noise.pink, ts, ts + 0.75);
  const bp = v.filter('bandpass', 600, 4);
  glide(bp.frequency, ts, 600, 5000, 0.5);
  const ng = v.gain(0);
  ramp(ng.gain, ts, [[0, 0], [0.1, 0.5], [0.5, 0.3], [0.65, 0]]);
  v.chain(n, bp, ng, out);
  const tc = t + 0.62;
  for (const [f, p] of [[N.A5, -0.3], [N.D6, 0.3]] as const) {
    const o = v.osc('sine', f, tc, tc + 3);
    const g = v.gain(0);
    swell(g.gain, tc, 0.12, 0.04, 0.05, 0.35);
    v.chain(o, g, v.pan(p), out);
  }
  v.done();
};

/** RR core: a deep rising "vwoom" (40 → 90 Hz), arcing crackle and a shimmering tail. */
const coreIgnite: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.coreIgnite, 0.35);
  const end = t + 3.6;
  const shape = [[0, 0], [0.25, 0.35], [0.9, 1], [1.6, 0.85], [3.4, 0]] as const;

  const sub = v.osc('sine', 40, t, end);
  glide(sub.frequency, t, 40, 90, 1.5);
  const subG = v.gain(0);
  ramp(subG.gain, t, shape);
  sub.connect(subG).connect(out);

  const lp = v.filter('lowpass', 120, 6);
  glide(lp.frequency, t, 120, 1100, 1.4);
  lp.frequency.exponentialRampToValueAtTime(300, t + 3.4);
  for (const det of [-12, 12]) {
    const o = v.osc('sawtooth', 40, t, end, det);
    glide(o.frequency, t, 40, 90, 1.5);
    o.connect(lp);
  }
  const sawG = v.gain(0);
  ramp(sawG.gain, t, shape.map(([dt, a]) => [dt, a * 0.45] as const));
  lp.connect(sawG).connect(out);

  const rush = v.noise(bus.noise.pink, t, end);
  const bp = v.filter('bandpass', 200, 2);
  glide(bp.frequency, t, 200, 1600, 1.5);
  const rg = v.gain(0);
  ramp(rg.gain, t, [[0, 0], [0.9, 0.5], [1.5, 0.35], [2.6, 0]]);
  v.chain(rush, bp, rg, out);

  const tc = t + 0.15;
  const crackle = v.noise(bus.noise.crackle, tc, tc + 1.8);
  const cg = v.gain(0);
  ramp(cg.gain, tc, [[0, 0], [0.1, 0.45], [1.2, 0.35], [1.7, 0]]);
  v.chain(crackle, v.filter('highpass', 1500), cg, out);

  [N.A5, N.D6, N.E6, N.A6].forEach((f, i) => {
    for (const side of [-1, 1]) {
      const o = v.osc('sine', f, t + 0.9, t + 6.2, side * 4);
      const g = v.gain(0);
      swell(g.gain, t + 1 + i * 0.08, 0.06, 0.5, 0.2, 0.65);
      v.chain(o, g, v.pan(side * 0.5), out);
    }
  });
  v.done();
};

/** Clearance two-tone, then the blast doors: hydraulic hiss, servo rumble (~2.6 s) and the stop clunk. */
const doorOpen: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const tones = output(v, bus.world, LEVEL.clearance, 0.35);
  tone(v, tones, t, N.A5, 0.16);
  tone(v, tones, t + 0.19, N.E6, 0.45);

  // The doors are ~26 m ahead: a little darker and wetter than the cockpit.
  const out = v.gain(LEVEL.doorOpen);
  const air = v.filter('lowpass', 6000);
  v.chain(out, air, bus.world);
  air.connect(v.gain(0.45)).connect(bus.verb);

  const th = t + 0.2;
  for (const side of [-1, 1]) {
    const n = v.noise(bus.noise.white, th, th + 2.2);
    const bp = v.filter('bandpass', 5200, 0.8);
    glide(bp.frequency, th, side < 0 ? 5200 : 4600, 2600, 1.6);
    const g = v.gain(0);
    ramp(g.gain, th, [[0, 0], [0.03, 0.55], [0.25, 0.4], [1, 0.12], [1.9, 0]]);
    v.chain(n, v.filter('highpass', 1500), bp, g, v.pan(side * 0.6), out);
  }

  const tr = t + 0.25;
  const dur = 2.6;
  const rumble = v.gain(1);
  rumble.connect(out);
  v.lfo(rumble.gain, 7.3, 0.2, tr, tr + dur + 0.2); // mechanical judder
  for (const side of [-1, 1]) {
    const n = v.noise(bus.noise.brown, tr, tr + dur + 0.1);
    const g = v.gain(0);
    ramp(g.gain, tr, [[0, 0], [0.35, 1], [dur - 0.4, 0.85], [dur, 0]]);
    v.chain(n, v.filter('lowpass', 170, 3), g, v.pan(side * 0.7), rumble);
  }
  const sub = v.osc('sawtooth', 34, tr, tr + dur + 0.1);
  glide(sub.frequency, tr, 34, 41, dur);
  const subG = v.gain(0);
  ramp(subG.gain, tr, [[0, 0], [0.4, 0.35], [dur - 0.3, 0.3], [dur, 0]]);
  v.chain(sub, v.filter('lowpass', 110), subG, rumble);
  const whine = v.osc('sawtooth', 118, tr, tr + dur + 0.1);
  glide(whine.frequency, tr, 118, 172, dur * 0.8);
  const wg = v.gain(0);
  ramp(wg.gain, tr, [[0, 0], [0.5, 0.09], [dur - 0.4, 0.1], [dur, 0]]);
  v.chain(whine, v.filter('bandpass', 760, 3), wg, out);

  const ts = tr + dur;
  thump(v, out, ts, 58, 32, 0.9, 0.2);
  partials(v, out, ts, 180, 0.8, METAL, 0.002);
  v.done();
};

/** Wrong order: a low, rough double buzz. */
const denied: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.denied, 0.12);
  const lp = v.filter('lowpass', 1100, 2);
  lp.connect(out);
  for (let k = 0; k < 2; k++) {
    const tk = t + k * 0.17;
    for (const [type, f] of [['sawtooth', 98], ['sawtooth', 103.8], ['square', 49]] as const) {
      const o = v.osc(type, f, tk, tk + 0.3);
      const g = v.gain(0);
      swell(g.gain, tk, 0.33, 0.006, 0.1, 0.015);
      o.connect(g).connect(lp);
    }
  }
  v.done();
};

/** 3 · 2 · 1: crisp beeps; "1" is an octave higher and held. */
const countdown: CueBuilder = (bus, t, arg = 3) => {
  const final = arg === 1;
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.countdown, 0.25);
  const len = final ? 0.38 : 0.1;
  tone(v, out, t, final ? N.A6 : N.A5, len, final ? 1 : 0.85);
  if (final) tone(v, out, t, N.A5, len, 0.35);
  burst(v, out, bus.noise.white, t, 0.12, 0.0005, 0.003, v.filter('highpass', 4000));
  v.done();
};

// ── Launch → warp → arrival ─────────────────────────────────────────────

/** Catapult: crack, sub drop 80 → 30 Hz, whoosh, one "vwip" per accelerator ring and a 2 s rumble tail. */
const launch: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.launch, 0.25);
  const { white, pink, brown } = bus.noise;

  burst(v, out, white, t, 0.9, 0.0008, 0.03, v.filter('lowpass', 7000));

  const sub = v.osc('sine', 80, t, t + 3.4);
  glide(sub.frequency, t, 80, 30, 0.9);
  const sg = v.gain(0);
  pluck(sg.gain, t, 1, 0.004, 0.5);
  sub.connect(sg).connect(out);
  const dirty = v.gain(0);
  pluck(dirty.gain, t, 0.5, 0.004, 0.3);
  v.chain(sub, v.shaper(driveCurve(4)), v.filter('lowpass', 420), dirty, out);

  burst(v, out, brown, t, 1.2, 0.003, 0.22, v.filter('lowpass', 600));

  for (const side of [-1, 1]) {
    const n = v.noise(pink, t, t + 2.4);
    const bp = v.filter('bandpass', 200, 1.3);
    glide(bp.frequency, t, side < 0 ? 180 : 240, side < 0 ? 3800 : 4600, 1.3);
    const g = v.gain(0);
    ramp(g.gain, t, [[0, 0.1], [0.5, 0.9], [1.3, 0.75], [2.2, 0]]);
    v.chain(n, bp, g, v.pan(side * 0.6), out);
  }

  // The rings: |z| = railStart + k·spacing is reached at sqrt(2|z| / a).
  const ringEnd = t + TUBE_EXIT + 0.4;
  const ringNoise = v.noise(white, t, ringEnd);
  const ringBp = v.filter('bandpass', 2500, 2.2);
  const zap = v.osc('triangle', 1600, t, ringEnd);
  const ringG = v.gain(0);
  const ringPan = v.pan(0);
  v.chain(ringNoise, ringBp, ringG, ringPan, out);
  zap.connect(v.gain(0.3)).connect(ringG);
  let k = 0;
  for (let z = Math.abs(BAY.railStartZ); z < Math.abs(BAY.exitZ); z += BAY.ringSpacing, k++) {
    const tk = t + Math.sqrt((2 * z) / RAIL_ACCEL);
    const amp = 0.3 + (0.6 * (tk - t)) / TUBE_EXIT;
    ringG.gain.setTargetAtTime(amp, tk - 0.012, 0.004);
    ringG.gain.setTargetAtTime(0, tk, 0.012);
    ringBp.frequency.setTargetAtTime(3400, tk - 0.015, 0.003);
    ringBp.frequency.setTargetAtTime(800, tk, 0.02);
    zap.frequency.setTargetAtTime(1900, tk - 0.015, 0.003);
    zap.frequency.setTargetAtTime(520, tk, 0.02);
    ringPan.pan.setValueAtTime(k % 2 ? 0.35 : -0.35, tk - 0.014);
  }

  const tail = v.noise(brown, t, t + 3.4);
  const tg = v.gain(0);
  ramp(tg.gain, t, [[0, 0], [0.12, 1], [0.9, 0.7], [3.2, 0]]);
  v.chain(tail, v.filter('lowpass', 130, 2), tg, out);
  v.done();
};

/** Jump: a wide rising whoosh, a flanged shimmer (feedback comb sweeping up) and a sub swell. */
const warpIn: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.warpIn, 0.35);

  for (const side of [-1, 1]) {
    const n = v.noise(bus.noise.pink, t, t + 2.6);
    const bp = v.filter('bandpass', 150, 1.6);
    glide(bp.frequency, t, side < 0 ? 140 : 170, side < 0 ? 4800 : 5600, 0.62);
    bp.frequency.exponentialRampToValueAtTime(1800, t + 2.4);
    const g = v.gain(0);
    ramp(g.gain, t, [[0, 0], [0.55, 1], [0.9, 0.6], [2.4, 0]]);
    v.chain(n, bp, g, v.pan(side * 0.75), out);
  }

  // Feedback combs: delays stay above one render quantum (the minimum inside a cycle).
  for (const side of [-1, 1]) {
    const scale = side < 0 ? 1 : 1.27;
    const src = v.noise(bus.noise.white, t, t + 2.8);
    const sum = v.gain(1);
    const dl = v.delay(0.011 * scale, 0.05);
    glide(dl.delayTime, t, 0.011 * scale, 0.0029 * scale, 1.1);
    v.chain(src, v.filter('bandpass', 2400, 0.6), sum, dl, v.gain(0.8), sum);
    const g = v.gain(0);
    ramp(g.gain, t, [[0, 0], [0.3, 0.25], [0.7, 0.4], [1.6, 0.15], [2.6, 0]]);
    v.chain(dl, v.filter('highpass', 900), g, v.pan(side * 0.5), out);
  }

  const sub = v.osc('sine', 30, t, t + 2.8);
  glide(sub.frequency, t, 30, 55, 0.6);
  const sg = v.gain(0);
  ramp(sg.gain, t, [[0, 0], [0.5, 0.9], [2.4, 0]]);
  sub.connect(sg).connect(out);
  const harm = v.osc('triangle', 60, t, t + 2.8);
  glide(harm.frequency, t, 60, 110, 0.6);
  const hg = v.gain(0);
  ramp(hg.gain, t, [[0, 0], [0.5, 0.25], [2, 0]]);
  v.chain(harm, v.filter('lowpass', 300), hg, out);
  v.done();
};

/** Drop out: a short reverse swell sucking into a soft "thoom", a puff of air and scattered sparkles. */
const warpOut: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.warpOut, 0.45);
  const hit = t + 0.13;

  const n = v.noise(bus.noise.pink, t, hit + 0.05);
  const bp = v.filter('bandpass', 900, 1.2);
  glide(bp.frequency, t, 900, 3800, 0.13);
  const ng = v.gain(0);
  ramp(ng.gain, t, [[0, 0], [0.12, 0.8], [0.135, 0]]);
  v.chain(n, bp, ng, out);

  const sub = v.osc('sine', 72, hit, hit + 3.2);
  glide(sub.frequency, hit, 72, 34, 0.5);
  const sg = v.gain(0);
  pluck(sg.gain, hit, 1, 0.012, 0.42);
  sub.connect(sg).connect(out);
  const harm = v.osc('triangle', 144, hit, hit + 2);
  glide(harm.frequency, hit, 144, 70, 0.4);
  const hg = v.gain(0);
  pluck(hg.gain, hit, 0.25, 0.01, 0.25);
  v.chain(harm, v.filter('lowpass', 400), hg, out);
  burst(v, out, bus.noise.brown, hit, 0.7, 0.01, 0.2, v.filter('lowpass', 380));

  [N.D7, N.Fs7, N.A7, N.E7, N.B7, N.Fs6].forEach((f, i) => {
    const ts = hit + 0.04 + i * 0.07 + rand() * 0.03;
    const o = v.osc('sine', f, ts, ts + 1.4);
    const g = v.gain(0);
    pluck(g.gain, ts, 0.06, 0.002, 0.18);
    v.chain(o, g, v.pan(randRange(-0.7, 0.7)), out);
  });
  v.done();
};

/** The new world: a wide Dmaj9 pad (detuned saws, opening filter), sub root and late high "stars". */
const arrive: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.arrive, 0.65);
  const end = t + 12;

  const lp = v.filter('lowpass', 280, 1.5);
  glide(lp.frequency, t, 280, 2600, 3.2);
  lp.frequency.exponentialRampToValueAtTime(700, t + 11);
  const pad = v.gain(0);
  ramp(pad.gain, t, [[0, 0], [2.6, 1], [4.6, 0.82], [11.5, 0]]);
  v.chain(lp, pad, out);

  const drift = v.gain(5); // shared slow vibrato, in cents
  v.osc('sine', 0.17, t, end).connect(drift);
  const chord = [N.D2, N.A2, N.D3, N.Fs3, N.A3, N.Cs4, N.E4];
  chord.forEach((f, i) => {
    const g = v.gain(0.16);
    for (const det of [-6, 6]) {
      const o = v.osc('sawtooth', f, t, end, det + (i % 2 ? 2 : -2));
      drift.connect(o.detune);
      o.connect(g);
    }
    v.chain(g, v.pan(((i / (chord.length - 1)) * 2 - 1) * 0.75), lp);
  });

  const sub = v.osc('sine', N.D1, t, end);
  const subG = v.gain(0);
  ramp(subG.gain, t, [[0, 0], [3, 0.3], [11, 0]]);
  sub.connect(subG).connect(out);

  [N.Fs5, N.A5, N.E6].forEach((f, i) => {
    const ts = t + 1.2 + i * 0.5;
    const o = v.osc('sine', f, ts, end);
    const g = v.gain(0);
    swell(g.gain, ts, 0.05, 1.6, 1, 1.3);
    v.chain(o, g, v.pan((i - 1) * 0.6), out);
  });
  v.done();
};

/**
 * Course finale (matches the 2 s charge of the Nova blast): a rising whoosh and sub swell, then the blast — crack, sub
 * drop, rumble — and a bright D-major shimmer that blooms over a long tail.
 */
const novaBlast: CueBuilder = (bus, t) => {
  const v = new Voice(bus);
  const out = output(v, bus.world, LEVEL.novaBlast, 0.6);
  const { white, pink, brown } = bus.noise;
  const boom = t + 2;

  // Charge: filtered noise climbs while a sub swells and a high sine rises with it.
  const n = v.noise(pink, t, boom + 0.1);
  const bp = v.filter('bandpass', 120, 1.8);
  glide(bp.frequency, t, 120, 5200, 2);
  const ng = v.gain(0);
  ramp(ng.gain, t, [[0, 0], [1.6, 0.9], [2, 1], [2.05, 0]]);
  v.chain(n, bp, ng, out);
  const rise = v.osc('sine', 220, t, boom + 0.1);
  glide(rise.frequency, t, 220, 1760, 2);
  const rg = v.gain(0);
  ramp(rg.gain, t, [[0, 0], [1.9, 0.22], [2.05, 0]]);
  rise.connect(rg).connect(out);
  const swellSub = v.osc('sine', 46, t, boom + 0.1);
  const sw = v.gain(0);
  ramp(sw.gain, t, [[0, 0], [2, 0.7], [2.05, 0]]);
  swellSub.connect(sw).connect(out);

  // The blast.
  burst(v, out, white, boom, 1, 0.0008, 0.05, v.filter('lowpass', 9000));
  const sub = v.osc('sine', 90, boom, boom + 4);
  glide(sub.frequency, boom, 90, 26, 1.1);
  const sg = v.gain(0);
  pluck(sg.gain, boom, 1.1, 0.004, 0.7);
  sub.connect(sg).connect(out);
  const dirty = v.gain(0);
  pluck(dirty.gain, boom, 0.5, 0.004, 0.35);
  v.chain(sub, v.shaper(driveCurve(4)), v.filter('lowpass', 420), dirty, out);
  burst(v, out, brown, boom, 1.3, 0.004, 0.4, v.filter('lowpass', 520));
  for (const side of [-1, 1]) {
    const w = v.noise(pink, boom, boom + 2.6);
    const wb = v.filter('bandpass', 400, 1.1);
    glide(wb.frequency, boom, 400, side < 0 ? 5200 : 6400, 1.8);
    const wg = v.gain(0);
    ramp(wg.gain, boom, [[0, 0.8], [0.6, 0.5], [2.4, 0]]);
    v.chain(w, wb, wg, v.pan(side * 0.7), out);
  }

  // Shimmer: a rising D-major arpeggio of struck bells, then a held glassy chord.
  [N.D6, N.Fs6, N.A6, N.D7, N.Fs7, N.A7, N.D7, N.B6].forEach((f, i) => {
    const ts = boom + 0.12 + i * 0.16;
    const pg = v.gain(1);
    pg.connect(v.pan(((i % 4) / 3) * 1.4 - 0.7)).connect(out);
    partials(v, pg, ts, f, 0.34, SOFT_BELL, 0.003);
  });
  const end = boom + 6;
  [N.D3, N.A3, N.Fs5, N.A5, N.E6].forEach((f, i) => {
    const o = v.osc('sine', f, boom, end);
    const g = v.gain(0);
    swell(g.gain, boom + 0.3, 0.14, 0.6, 2, 3);
    v.chain(o, g, v.pan((i - 2) * 0.35), out);
  });
  v.done();
};

/** Every cue's builder. */
export const CUES: Record<Cue, CueBuilder> = {
  heartbeat,
  breath,
  chime,
  quest,
  switch: switchCue,
  powerUp,
  lightsOn,
  hudBoot,
  coreIgnite,
  doorOpen,
  denied,
  countdown,
  launch,
  warpIn,
  warpOut,
  arrive,
  novaBlast,
  hover,
  click,
  notify,
  pulse,
};

/** Approximate length of each cue's own sound (before the reverb tail), in seconds. */
export const CUE_LENGTH: Record<Cue, number> = {
  heartbeat: 1.2,
  breath: 1.5,
  chime: 4.4,
  quest: 3,
  switch: 0.4,
  powerUp: 2.9,
  lightsOn: 1.8,
  hudBoot: 3.4,
  coreIgnite: 6.3,
  doorOpen: 4.2,
  denied: 0.5,
  countdown: 1,
  launch: 3.5,
  warpIn: 2.9,
  warpOut: 3.4,
  arrive: 12,
  novaBlast: 9,
  hover: 0.1,
  click: 0.3,
  notify: 0.5,
  pulse: 1.5,
};

/** Minimum seconds between two plays of the same cue (debounces spammy triggers). */
export const CUE_MIN_GAP: Record<Cue, number> = {
  heartbeat: 0.3,
  breath: 0.8,
  chime: 0.25,
  quest: 0.25,
  switch: 0.05,
  powerUp: 0.5,
  lightsOn: 0.05,
  hudBoot: 0.5,
  coreIgnite: 0.5,
  doorOpen: 1,
  denied: 0.25,
  countdown: 0.1,
  launch: 1,
  warpIn: 1,
  warpOut: 1,
  arrive: 2,
  novaBlast: 4,
  hover: 0.04,
  click: 0.04,
  notify: 0.1,
  pulse: 0.15,
};

/** Cues dropped first when too many voices are already sounding. */
export const LOW_PRIORITY: ReadonlySet<Cue> = new Set<Cue>(['hover', 'click', 'notify', 'pulse']);
