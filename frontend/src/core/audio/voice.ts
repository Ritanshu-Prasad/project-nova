import type { Bus } from './bus';
import { rand } from './random';

/** Live one-shot bookkeeping (polyphony cap, AudioLab meter). */
export const voiceStats = { active: 0, total: 0 };

const isLive = (ctx: BaseAudioContext) => typeof AudioContext !== 'undefined' && ctx instanceof AudioContext;

/**
 * Builder for one short-lived node graph (a cue). Every node created through it is tracked and
 * disconnected when the source that stops last fires "ended", so cues never leak.
 */
export class Voice {
  readonly ctx: BaseAudioContext;
  readonly bus: Bus;
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private last: AudioScheduledSourceNode | null = null;
  private lastStop = -Infinity;
  private released = false;

  constructor(bus: Bus) {
    this.bus = bus;
    this.ctx = bus.ctx;
  }

  gain(value = 1): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    return this.track(g);
  }

  /** Biquad. For lowpass/highpass `q` is in dB (default: Butterworth); for the others it is linear. */
  filter(type: BiquadFilterType, frequency: number, q?: number, gainDb = 0): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q ?? (type === 'lowpass' || type === 'highpass' ? -3.01 : 1);
    f.gain.value = gainDb;
    return this.track(f);
  }

  pan(value: number): StereoPannerNode {
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, value));
    return this.track(p);
  }

  delay(time: number, max = 1): DelayNode {
    const d = this.ctx.createDelay(max);
    d.delayTime.value = time;
    return this.track(d);
  }

  shaper(curve: Float32Array<ArrayBuffer>): WaveShaperNode {
    const s = this.ctx.createWaveShaper();
    s.curve = curve;
    return this.track(s);
  }

  osc(type: OscillatorType, frequency: number, t0: number, t1: number, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = frequency;
    o.detune.value = detune;
    return this.schedule(o, t0, t1);
  }

  /** Looping noise from a random offset (so repeated hits never sound identical). */
  noise(buffer: AudioBuffer, t0: number, t1: number, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.playbackRate.value = rate;
    this.track(s);
    this.sources.push(s);
    s.start(t0, rand() * buffer.duration);
    s.stop(t1);
    this.noteStop(s, t1);
    return s;
  }

  /** Low-frequency modulation: oscillator → depth → `param` (added to its value). */
  lfo(param: AudioParam, rate: number, depth: number, t0: number, t1: number, type: OscillatorType = 'sine'): OscillatorNode {
    const o = this.osc(type, rate, t0, t1);
    o.connect(this.gain(depth)).connect(param);
    return o;
  }

  /** Connects nodes in series; returns the last one. */
  chain(...nodes: AudioNode[]): AudioNode {
    for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]);
    return nodes[nodes.length - 1];
  }

  /** Commits the voice: its graph is released once the last source has ended. */
  done(): void {
    const last = this.last;
    if (!last) {
      this.release();
      return;
    }
    const live = isLive(this.ctx);
    if (live) {
      voiceStats.active++;
      voiceStats.total++;
    }
    last.onended = () => {
      if (live) voiceStats.active--;
      this.release();
    };
  }

  /** Stops and releases everything now (a builder threw half-way). */
  abort(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* never started */
      }
    }
    this.release();
  }

  private track<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  private schedule<T extends AudioScheduledSourceNode>(src: T, t0: number, t1: number): T {
    this.track(src);
    this.sources.push(src);
    src.start(t0);
    src.stop(t1);
    this.noteStop(src, t1);
    return src;
  }

  private noteStop(src: AudioScheduledSourceNode, t1: number): void {
    if (t1 >= this.lastStop) {
      this.lastStop = t1;
      this.last = src;
    }
  }

  private release(): void {
    if (this.released) return;
    this.released = true;
    for (const n of this.nodes) n.disconnect();
    this.nodes.length = 0;
    this.sources.length = 0;
    this.last = null;
  }
}

// ── Envelope helpers (all times in context seconds) ─────────────────────

/** 0 → `peak` in `attack`, then an exponential decay with time constant `tau`. Returns when it is ≈ -60 dB. */
export function pluck(p: AudioParam, t: number, peak: number, attack: number, tau: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setTargetAtTime(0, t + attack, tau);
  return t + attack + tau * 7;
}

/** Linear attack, hold, then exponential release. Returns when it is ≈ -60 dB. */
export function swell(p: AudioParam, t: number, peak: number, attack: number, hold: number, tau: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  if (hold > 0) p.setValueAtTime(peak, t + attack + hold);
  p.setTargetAtTime(0, t + attack + hold, tau);
  return t + attack + hold + tau * 7;
}

/** Piecewise-linear envelope through [offset, value] points relative to `t`. Returns the end time. */
export function ramp(p: AudioParam, t: number, points: ReadonlyArray<readonly [number, number]>): number {
  p.setValueAtTime(points[0][1], t + points[0][0]);
  for (let i = 1; i < points.length; i++) p.linearRampToValueAtTime(points[i][1], t + points[i][0]);
  return t + points[points.length - 1][0];
}

/** Exponential glide between two positive values. */
export function glide(p: AudioParam, t: number, from: number, to: number, duration: number): void {
  p.setValueAtTime(from, t);
  p.exponentialRampToValueAtTime(to, t + duration);
}

const curves = new Map<number, Float32Array<ArrayBuffer>>();

/** Normalised tanh saturation curve (cached per drive; WaveShaper copies it, so sharing is safe). */
export function driveCurve(drive: number): Float32Array<ArrayBuffer> {
  let c = curves.get(drive);
  if (!c) {
    c = new Float32Array(1025);
    const norm = Math.tanh(drive);
    for (let i = 0; i < c.length; i++) c[i] = Math.tanh(drive * ((i / (c.length - 1)) * 2 - 1)) / norm;
    curves.set(drive, c);
  }
  return c;
}
