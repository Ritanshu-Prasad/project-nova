import { makeRng } from './random';

/** Pre-generated buffers shared by every voice and layer (built once per sample rate). */
export interface NoiseBank {
  /** Mono looping noise, all three normalised to the same RMS. */
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
  /** Sparse electrical crackle (mono, loops). */
  crackle: AudioBuffer;
  /** Stereo reverb impulse: a dark ~3 s hall (the hangar, and cinematic space afterwards). */
  ir: AudioBuffer;
}

const NOISE_SECONDS = 4;
/** RMS of the noise buffers (≈ -10.5 dBFS) so colours are interchangeable in the mix. */
const NOISE_RMS = 0.3;
const REVERB_SECONDS = 3.4;
const REVERB_RT60 = 3;

const cache = new Map<number, NoiseBank>();

/** Returns the buffers for the context's sample rate, generating them on first use (~20 ms). */
export function getNoiseBank(ctx: BaseAudioContext): NoiseBank {
  const sr = ctx.sampleRate;
  let bank = cache.get(sr);
  if (!bank) {
    bank = {
      white: noise(ctx, 'white', 11),
      pink: noise(ctx, 'pink', 23),
      brown: noise(ctx, 'brown', 37),
      crackle: crackle(ctx, 53),
      ir: impulse(ctx, 71),
    };
    cache.set(sr, bank);
  }
  return bank;
}

type Colour = 'white' | 'pink' | 'brown';

function noise(ctx: BaseAudioContext, colour: Colour, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * NOISE_SECONDS);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const r = makeRng(seed);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  const warmup = colour === 'white' ? 0 : sr;
  for (let i = -warmup; i < n; i++) {
    const w = r() * 2 - 1;
    let v: number;
    if (colour === 'white') {
      v = w;
    } else if (colour === 'pink') {
      // Paul Kellet's refined pink filter (-3 dB/octave).
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    } else {
      // Leaky integrator (-6 dB/octave above ~150 Hz).
      last = (last + 0.02 * w) / 1.02;
      v = last;
    }
    if (i >= 0) d[i] = v;
  }
  removeDc(d);
  seamless(d);
  scaleToRms(d, NOISE_RMS);
  return buf;
}

/** Sparse micro-bursts: arcing electrics. */
function crackle(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 2);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const r = makeRng(seed);
  const p = 60 / sr; // bursts per second / sample rate
  for (let i = 0; i < n; i++) {
    if (r() >= p) continue;
    const amp = 0.15 + 0.85 * r() * r();
    const len = Math.floor(sr * (0.0004 + 0.004 * r()));
    for (let j = 0; j < len && i + j < n; j++) d[i + j] += amp * (r() * 2 - 1) * Math.exp((-5 * j) / len);
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < n; i++) d[i] *= 0.9 / peak;
  return buf;
}

/**
 * Stereo reverb impulse: pre-delay, a few early reflections, then an exponentially decaying noise
 * tail that also darkens over time (high frequencies die first, like a real hall).
 */
function impulse(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * REVERB_SECONDS);
  const buf = ctx.createBuffer(2, n, sr);
  const r = makeRng(seed);
  const decay = 6.91 / REVERB_RT60;
  const fadeFrom = Math.floor(n * 0.9);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const pre = Math.floor(sr * (0.014 + ch * 0.005));
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const env = Math.exp(-decay * t) * (1 - Math.exp(-t / 0.012));
      const bright = 0.1 + 0.8 * Math.exp(-t * 1.8);
      lp += bright * (r() * 2 - 1 - lp);
      d[i] = lp * env;
    }
    for (let k = 0; k < 9; k++) {
      const t = 0.005 + 0.07 * r();
      const i = pre + Math.floor(t * sr);
      d[i] += (r() < 0.5 ? -1 : 1) * (0.55 - t * 4);
    }
    for (let i = fadeFrom; i < n; i++) d[i] *= (n - i) / (n - fadeFrom);
  }
  return buf;
}

function removeDc(d: Float32Array): void {
  let sum = 0;
  for (let i = 0; i < d.length; i++) sum += d[i];
  const mean = sum / d.length;
  for (let i = 0; i < d.length; i++) d[i] -= mean;
}

/** Removes the linear drift between the first and last sample so the loop point does not click. */
function seamless(d: Float32Array): void {
  const n = d.length;
  const step = d[n - 1] - d[0];
  for (let i = 0; i < n; i++) d[i] -= (step * i) / (n - 1);
}

function scaleToRms(d: Float32Array, target: number): void {
  let sum = 0;
  for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
  const rms = Math.sqrt(sum / d.length);
  if (rms > 0) for (let i = 0; i < d.length; i++) d[i] *= target / rms;
}
