/**
 * Per-frame values shared by the director, the WebGL scene, the DOM overlays and the audio engine.
 *
 * Mutated in place every frame by `director.ts` — never copy these into React state.
 * Read them inside `useFrame` (3D) or `useRaf` (DOM) and write the result straight to objects / refs.
 * All 0..1 values are normalised intensities unless noted otherwise.
 */
const initial = () => ({
  /** Clock: seconds since page load, last frame delta, and seconds since the current phase began. */
  time: 0,
  dt: 0,
  phaseTime: 0,

  // ── Waking up ────────────────────────────────────────────────────────
  /** Eyelids: 0 = shut, 1 = fully open. */
  eyelid: 0,
  /** Wake-up blur in CSS px applied over the scene. */
  blur: 18,
  /** Head slumped forward: 1 = chin on chest, 0 = upright. */
  slump: 1,
  /** Woozy factor (chromatic aberration, roll wobble). */
  dizzy: 1,

  // ── Ship systems / hangar ────────────────────────────────────────────
  /** Red emergency lighting. */
  emergency: 1,
  /** Main cockpit power (flickers on). */
  power: 0,
  /** Hangar flood-light banks switching on in sequence (bank i is lit when bayLights >= (i+1)/BAY.lightBanks). */
  bayLights: 0,
  /** Canopy HUD visibility (neural link). */
  hud: 0,
  /** MMR reactor core spin-up. */
  core: 0,
  /** Hangar blast doors: 0 = closed, 1 = fully open. */
  doors: 0,
  /** Launch clearance (accelerator rings / runway chase lights armed). */
  clearance: 0,

  // ── Launch ───────────────────────────────────────────────────────────
  /** Hold-to-launch charge. */
  charge: 0,
  /** Whether the launch input is currently held (keyboard, pointer or 3D throttle). */
  holding: false,
  /** Countdown digit shown while charging: 3, 2, 1, or 0 for none. */
  countdown: 0,
  /** Engine intensity (audio, vibration, glow). */
  engine: 0,
  /** Camera shake amplitude. */
  shake: 0,
  /** Degrees added to the base field of view. */
  fovKick: 0,
  /** White flash overlay. */
  flash: 0,
  /** Warp intensity (streaks, tunnel, sky smear). */
  warp: 0,
  /** Ship z in the hangar world (world units, negative = forward/down the launch rail). */
  shipZ: 0,
  /** Ship speed in world units per second (for streak length, strobing lights). */
  shipSpeed: 0,

  // ── Arrival / landing ────────────────────────────────────────────────
  /** Glide into the arrival point: 0 = ARRIVAL.backoff units behind it, 1 = parked. */
  approach: 0,
  /** Arrival reveal (planet glow, hero UI). */
  arrive: 0,
  /** Transient accent pulse, set to 1 to fire; decays automatically. */
  pulse: 0,
  /** Speed shown on the HUD in km/s (values above 100 000 are shown as a fraction of c). */
  speedKms: 0,

  // ── Head look ────────────────────────────────────────────────────────
  /** Pointer / touch look target, normalised -1..1 (x right, y down). */
  lookX: 0,
  lookY: 0,
  /** Current head yaw / pitch in radians (written by ShipRig, read by the HUD). */
  yaw: 0,
  pitch: 0,
  /** Compass heading in degrees for the HUD tape. */
  heading: 0,

  // ── Walking to the lounge (see core/journey.ts) ───────────────────────
  /** Pilot standing up out of the seat. */
  stand: 0,
  /** Turning around to face the rear bulkhead door. */
  turn: 0,
  /** Bulkhead door: 0 = sealed, ~0.15 = unlocked, 1 = fully open. */
  door: 0,
  /** Walk from the cockpit through the corridor into the lounge. */
  walk: 0,
  /** Hologram energy burst (course generation); decays automatically. */
  holo: 0,

  /** Mirrors the store flag so per-frame code can branch without a store read. */
  reducedMotion: false,
});

export type Runtime = ReturnType<typeof initial>;

export const rt: Runtime = initial();

/** Restores every value to its pre-wake state (keeps the clock and accessibility flag). */
export function resetRuntime(): void {
  const { time, reducedMotion, lookX, lookY } = rt;
  Object.assign(rt, initial(), { time, reducedMotion, lookX, lookY });
}
