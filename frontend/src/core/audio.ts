/**
 * Synthesised sound design (WebAudio, no audio files).
 *
 * CONTRACT — other modules rely on exactly this surface:
 *   audio.init()            create/resume the AudioContext; call from a user gesture; idempotent
 *   audio.ready             true once the context is running
 *   audio.play(cue, arg?)   fire a one-shot cue
 *   audio.update(dt)        per-frame update of continuous layers from `rt` (called by the director loop)
 * Muting follows `useNova.soundOn`; the engine subscribes to the store itself.
 */

export type Cue =
  | 'heartbeat' // wake: "lub-dub"
  | 'breath' // wake: inhale swell
  | 'chime' // System notification "ding"
  | 'quest' // quest window opens / completes
  | 'switch' // mechanical toggle clack
  | 'powerUp' // main power whine + clunk
  | 'lightsOn' // hangar flood-light relay "ka-chunk" (arg = bank index)
  | 'hudBoot' // neural link: digital chirps
  | 'coreIgnite' // RR core: deep rising "vwoom"
  | 'doorOpen' // blast doors: hydraulic hiss + servo rumble + clearance tone
  | 'denied' // wrong order / unavailable
  | 'countdown' // arg = 3 | 2 | 1
  | 'launch' // catapult boom + whoosh
  | 'warpIn' // jump to warp
  | 'warpOut' // drop out of warp
  | 'arrive' // new-world pad swell
  | 'novaBlast' // course finale: charge, blast and shimmer
  | 'hover' // UI hover tick (very quiet)
  | 'click' // UI click blip
  | 'notify' // toast blip
  | 'pulse'; // core pulse / accent

export interface AudioEngine {
  init(): Promise<void>;
  readonly ready: boolean;
  play(cue: Cue, arg?: number): void;
  update(dt: number): void;
}

/** The live engine (see the bottom of this file). */
export const audio: AudioEngine = {
  get ready() { return engineImpl.ready; },
  init: () => engineImpl.init(),
  play: (cue, arg) => engineImpl.play(cue, arg),
  update: (dt) => engineImpl.update(dt),
};

// ── Live engine ──────────────────────────────────────────────────────────

import { createBus, MASTER_LEVEL, openCutoff, type Bus } from './audio/bus';
import { CUE_MIN_GAP, CUES } from './audio/cues';
import { rt } from './runtime';
import { useSettings } from './settings';
import { useNova } from './store';

let ctx: AudioContext | null = null;
let bus: Bus | null = null;
let layers: { engine: GainNode; engineLp: BiquadFilterNode; warp: GainNode; warpBp: BiquadFilterNode; hum: GainNode } | null = null;
const lastPlayed = new Map<Cue, number>();

function loop(c: BaseAudioContext, buffer: AudioBuffer, to: AudioNode) {
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(to);
  src.start();
}

function buildLayers(b: Bus) {
  const c = b.ctx;
  const engineLp = c.createBiquadFilter();
  engineLp.type = 'lowpass';
  engineLp.frequency.value = 120;
  const engine = c.createGain();
  engine.gain.value = 0;
  loop(c, b.noise.brown, engineLp);
  engineLp.connect(engine).connect(b.world);

  const warpBp = c.createBiquadFilter();
  warpBp.type = 'bandpass';
  warpBp.frequency.value = 600;
  warpBp.Q.value = 0.7;
  const warp = c.createGain();
  warp.gain.value = 0;
  loop(c, b.noise.pink, warpBp);
  warpBp.connect(warp).connect(b.world);

  const hum = c.createGain();
  hum.gain.value = 0;
  const osc = c.createOscillator();
  osc.frequency.value = 50;
  osc.connect(hum).connect(b.world);
  osc.start();
  return { engine, engineLp, warp, warpBp, hum };
}

const engineImpl: AudioEngine = {
  get ready() {
    return ctx?.state === 'running';
  },
  async init() {
    try {
      if (!ctx) {
        ctx = new AudioContext();
        bus = createBus(ctx, ctx.destination, { safetyClip: true, level: 0 });
        layers = buildLayers(bus);
        // Mute, master volume and the ship / interface switches (Settings).
        const applyLevels = () => {
          if (!bus || !ctx) return;
          const st = useSettings.getState();
          const t = ctx.currentTime;
          bus.master.gain.setTargetAtTime(useNova.getState().soundOn ? MASTER_LEVEL * st.volume : 0, t, 0.08);
          bus.world.gain.setTargetAtTime(st.shipSounds ? 1 : 0, t, 0.08);
          bus.head.gain.setTargetAtTime(st.uiSounds ? 1 : 0, t, 0.08);
        };
        applyLevels();
        useNova.subscribe((s, prev) => s.soundOn !== prev.soundOn && applyLevels());
        useSettings.subscribe(applyLevels);
        document.addEventListener('visibilitychange', () => {
          if (!ctx) return;
          if (document.hidden) void ctx.suspend();
          else void ctx.resume();
        });
      }
      if (ctx.state !== 'running') await ctx.resume();
    } catch {
      /* audio unavailable — stay silent */
    }
  },
  play(cue, arg) {
    if (!ctx || !bus || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const last = lastPlayed.get(cue) ?? -Infinity;
    if (now - last < CUE_MIN_GAP[cue]) return;
    lastPlayed.set(cue, now);
    try {
      CUES[cue](bus, now + 0.01, arg);
    } catch (e) {
      console.warn('[audio]', cue, e);
    }
  },
  update() {
    if (!ctx || !bus || !layers || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const e = rt.engine;
    layers.engine.gain.setTargetAtTime(0.3 * Math.pow(e, 1.2), t, 0.08);
    layers.engineLp.frequency.setTargetAtTime(120 + 1600 * e * e, t, 0.08);
    layers.warp.gain.setTargetAtTime(0.35 * rt.warp, t, 0.1);
    layers.warpBp.frequency.setTargetAtTime(500 + 1800 * rt.warp + 300 * Math.sin(t * 3), t, 0.1);
    layers.hum.gain.setTargetAtTime(0.012 + 0.025 * rt.power, t, 0.2);
    const open = openCutoff(ctx);
    bus.muffle.frequency.setTargetAtTime(Math.max(400, open * (1 - Math.min(1, rt.blur / 18) * 0.97)), t, 0.1);
  },
};
