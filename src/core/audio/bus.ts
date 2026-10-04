import { getNoiseBank, type NoiseBank } from './buffers';

/** Master level into the compressor (the mute ramp goes to 0 and back to this). */
export const MASTER_LEVEL = 0.8;
const REVERB_RETURN = 0.8;

/**
 * The mix every voice and layer plays into, built the same way for the live AudioContext and for
 * OfflineAudioContext analysis renders:
 *
 *   world ─► muffle (wake-up lowpass) ─┐
 *   head ──────────────────────────────┼─► master ─► compressor ─► [soft clip] ─► destination
 *   verb ─► convolver ─► return ─► world
 */
export interface Bus {
  ctx: BaseAudioContext;
  /** World sounds: ship, hangar, space. Muffled while the pilot is still waking up. */
  world: AudioNode;
  /** "Inside the head": heartbeat, breath and the System's UI sounds. Never muffled. */
  head: AudioNode;
  /** Reverb send; the return joins the world bus. */
  verb: AudioNode;
  /** Wake-up muffle on the world bus (steered by the layers from `rt.blur`). */
  muffle: BiquadFilterNode;
  master: GainNode;
  compressor: DynamicsCompressorNode;
  noise: NoiseBank;
  dispose(): void;
}

export interface BusOptions {
  /** Soft safety clipper after the compressor (live output; the analysis measures without it). */
  safetyClip?: boolean;
  /** Initial master level (0 when starting muted). */
  level?: number;
}

export function createBus(ctx: BaseAudioContext, destination: AudioNode, opts: BusOptions = {}): Bus {
  const noise = getNoiseBank(ctx);
  const world = ctx.createGain();
  const head = ctx.createGain();
  const verb = ctx.createGain();

  const muffle = ctx.createBiquadFilter();
  muffle.type = 'lowpass';
  muffle.frequency.value = openCutoff(ctx);
  muffle.Q.value = -3.01; // lowpass Q is in dB: Butterworth, flat while open

  const convolver = ctx.createConvolver();
  convolver.buffer = noise.ir;
  const verbReturn = ctx.createGain();
  verbReturn.gain.value = REVERB_RETURN;

  const master = ctx.createGain();
  master.gain.value = opts.level ?? MASTER_LEVEL;

  // Gentle limiting: only the loud set pieces (launch, warp) reach the threshold.
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -10;
  compressor.knee.value = 8;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.22;

  verb.connect(convolver).connect(verbReturn).connect(world);
  world.connect(muffle).connect(master);
  head.connect(master);
  master.connect(compressor);
  const nodes: AudioNode[] = [world, head, verb, muffle, convolver, verbReturn, master, compressor];

  if (opts.safetyClip) {
    const clip = ctx.createWaveShaper();
    clip.curve = softClipCurve();
    compressor.connect(clip).connect(destination);
    nodes.push(clip);
  } else {
    compressor.connect(destination);
  }

  return {
    ctx,
    world,
    head,
    verb,
    muffle,
    master,
    compressor,
    noise,
    dispose: () => {
      for (const n of nodes) n.disconnect();
    },
  };
}

/** Cutoff at which the muffle lowpass is effectively transparent. */
export const openCutoff = (ctx: BaseAudioContext) => Math.min(20000, ctx.sampleRate * 0.45);

/** Transparent below -3 dBFS, then a tanh shoulder that never exceeds ≈ -1.2 dBFS. */
function softClipCurve(): Float32Array<ArrayBuffer> {
  const n = 2049; // odd, so 0 maps exactly onto the centre sample
  const curve = new Float32Array(n);
  const knee = 0.7;
  const room = 0.19;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}
