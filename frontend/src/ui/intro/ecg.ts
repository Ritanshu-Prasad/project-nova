import { damp } from '../../core/math';

/**
 * A tiny ECG monitor simulation for the gate: a write head sweeps left → right, overwriting the
 * oldest samples (like a bedside monitor), with an erased gap just ahead of the head.
 * Pure data — the component turns it into an SVG path every frame.
 */

/** Samples across the trace. */
export const ECG_SAMPLES = 320;
/** Seconds for the write head to cross the monitor. */
export const ECG_SWEEP = 4.4;
/** Erased samples ahead of the head. */
const GAP = 16;
/** SVG viewBox of the trace. */
export const ECG_W = 800;
export const ECG_H = 120;
const MID = 74;
const AMP = 56;
/** Beat phase of the R peak (when the heart "beats" for sync purposes). */
const R_AT = 0.225;

const gauss = (x: number, mu: number, sigma: number) => {
  const d = (x - mu) / sigma;
  return Math.exp(-d * d);
};

/** One PQRST complex at beat phase `p` in [0, 1); roughly -0.3..1. */
export function ecgWave(p: number): number {
  return (
    0.11 * gauss(p, 0.12, 0.032) -
    0.14 * gauss(p, 0.203, 0.009) +
    1.0 * gauss(p, 0.225, 0.0115) -
    0.32 * gauss(p, 0.247, 0.011) +
    0.24 * gauss(p, 0.43, 0.052)
  );
}

/** Cheap deterministic jitter in [-0.5, 0.5]. */
const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s) - 0.5;
};

export interface EcgSim {
  ys: Float32Array;
  /** Unwrapped write-head position in samples. */
  head: number;
  /** Unwrapped beat phase (beats since start). */
  beat: number;
  bpm: number;
  /** y (viewBox units) under the write head. */
  headY: number;
}

export function createEcg(bpm: number): EcgSim {
  const sim: EcgSim = { ys: new Float32Array(ECG_SAMPLES).fill(MID), head: 0, beat: 0.62, bpm, headY: MID };
  // Pre-fill one sweep so the first frame already shows a full trace.
  for (let i = 0; i < 240; i++) stepEcg(sim, ECG_SWEEP / 240, bpm);
  return sim;
}

/** Advances the simulation by `dt` seconds. Returns true when an R peak (a heartbeat) happened. */
export function stepEcg(sim: EcgSim, dt: number, targetBpm: number): boolean {
  sim.bpm = damp(sim.bpm, targetBpm, 1.2, dt);
  const h0 = sim.head;
  const b0 = sim.beat;
  sim.head = h0 + (dt * ECG_SAMPLES) / ECG_SWEEP;
  sim.beat = b0 + (dt * sim.bpm) / 60;
  const span = sim.head - h0;
  for (let i = Math.floor(h0) + 1; i <= Math.floor(sim.head); i++) {
    const u = span > 0 ? (i - h0) / span : 1;
    const b = b0 + (sim.beat - b0) * u;
    const v = ecgWave(b - Math.floor(b)) + 0.02 * Math.sin(i * 0.045) + 0.018 * hash(i);
    sim.ys[i % ECG_SAMPLES] = MID - AMP * v;
  }
  sim.headY = sim.ys[Math.floor(sim.head) % ECG_SAMPLES];
  // Keep the unwrapped counters small.
  if (sim.head > ECG_SAMPLES * 1000) sim.head -= ECG_SAMPLES * 1000;
  return Math.floor(sim.beat - R_AT) > Math.floor(b0 - R_AT);
}

/** x of the write head in viewBox units. */
export const ecgHeadX = (sim: EcgSim) => ((sim.head % ECG_SAMPLES) / (ECG_SAMPLES - 1)) * ECG_W;

/** SVG path of the visible trace: oldest sample (just past the gap) → newest (the head). */
export function ecgPath(sim: EcgSim): string {
  const head = Math.floor(sim.head);
  const dx = ECG_W / (ECG_SAMPLES - 1);
  let d = '';
  let pen = false;
  for (let j = head + GAP + 1; j <= head + ECG_SAMPLES; j++) {
    const i = j % ECG_SAMPLES;
    if (i === 0) pen = false;
    d += `${pen ? 'L' : 'M'}${(i * dx).toFixed(1)} ${sim.ys[i].toFixed(1)}`;
    pen = true;
  }
  return d;
}
