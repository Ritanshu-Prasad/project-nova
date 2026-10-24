/**
 * Per-frame values shared by the director, the WebGL scene, the DOM overlays and the audio engine.
 *
 * Mutated in place every frame by `director.ts` — never copy these into React state.
 * Read them inside `useFrame` (3D) or `useRaf` (DOM) and write the result straight to objects / refs.
 * All 0..1 values are normalised intensities unless noted otherwise.
 */

const isSavedVisitor = (): boolean => {
  try {
    return (
      localStorage.getItem('nova.visited') === '1' ||
      localStorage.getItem('nova.safetyAccepted') === '1' ||
      localStorage.getItem('nova.introSeen') === '1' ||
      localStorage.getItem('nova.isLoggedIn') === '1'
    );
  } catch {
    return false;
  }
};

const initial = () => {
  const saved = isSavedVisitor();
  return {
    /** Clock: seconds since page load, last frame delta, and seconds since the current phase began. */
    time: 0,
    dt: 0,
    phaseTime: 0,

    // ── Waking up ────────────────────────────────────────────────────────
    /** Eyelids: 0 = shut, 1 = fully open. */
    eyelid: saved ? 1 : 0,
    /** Wake-up blur in CSS px applied over the scene. */
    blur: saved ? 0 : 18,
    /** Head slumped forward: 1 = chin on chest, 0 = upright. */
    slump: saved ? 0 : 1,
    /** Woozy factor (chromatic aberration, roll wobble). */
    dizzy: saved ? 0 : 1,

    // ── Ship systems / hangar ────────────────────────────────────────────
    /** Red emergency lighting. */
    emergency: saved ? 0 : 1,
    /** Main cockpit power (flickers on). */
    power: saved ? 1 : 0,
    /** Hangar flood-light banks switching on in sequence (bank i is lit when bayLights >= (i+1)/BAY.lightBanks). */
    bayLights: saved ? 1 : 0,
    /** Canopy HUD visibility (neural link). */
    hud: saved ? 1 : 0,
    /** RR reactor core spin-up. */
    core: saved ? 1 : 0,
    /** Hangar blast doors: 0 = closed, 1 = fully open. */
    doors: saved ? 1 : 0,
    /** Launch clearance (accelerator rings / runway chase lights armed). */
    clearance: saved ? 1 : 0,

    // ── Launch ───────────────────────────────────────────────────────────
    /** Hold-to-launch charge. */
    charge: 0,
    /** Whether the launch input is currently held (keyboard, pointer or 3D throttle). */
    holding: false,
    /** Countdown digit shown while charging: 3, 2, 1, or 0 for none. */
    countdown: 0,
    /** Engine intensity (audio, vibration, glow). */
    engine: saved ? 0.12 : 0,
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
    /** Launching from where the ship hangs in space (no launch rail): the ship's forward offset is scaled down (SPACE_LAUNCH). */
    spaceLaunch: false,
    /** Active during inter-planet traversal to suppress maiden launch UI cues and handle smooth space jumps. */
    isInterPlanetJump: false,

    // ── Course finale (the supernova outside the cockpit window) ──────────
    /** The supernova is running (it keeps fading out for a moment after the finale is closed). */
    novaOn: false,
    /** Seconds since the supernova began charging. */
    novaT: 0,
    /** Second (on that clock) at which the blast goes off. */
    novaBlastAt: 2,
    /** Brightness of the blast wave as it sweeps over the ship, 0-1: drives bloom, sunlight on the planet and the screen wash. */
    novaGlow: 0,
    /** Extra camera shake while the wave passes. */
    novaShake: 0,
    /** Extra field of view (degrees) while the blast hits. */
    novaKick: 0,
    /** Red alert in the cockpit while the star goes critical, 0-1 (the trim lights pulse red). */
    novaAlarm: 0,
    /** The hush just before the blast: the edges of the view darken, 0-1. */
    novaDim: 0,
    /** The course finale's flight is under way (the pilot launches towards the dying sun). */
    finaleFlight: false,
    /** The ship is at the dying sun: the planet, its moons and its surroundings are hidden. */
    finaleWorld: false,

    // ── Arrival / landing ────────────────────────────────────────────────
    /** Glide into the arrival point: 0 = ARRIVAL.backoff units behind it, 1 = parked. */
    approach: saved ? 1 : 0,
    /** Arrival reveal (planet glow, hero UI). */
    arrive: saved ? 1 : 0,
    /** Transient accent pulse, set to 1 to fire; decays automatically. */
    pulse: 0,
    /** Speed shown on the HUD in km/s (values above 100 000 are shown as a fraction of c). */
    speedKms: saved ? 1240 : 0,

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
    /** Progressive interior lighting dimming factor (1.0 = full bright in lounge, 0.25 = dimmed corridor/standby in cockpit). */
    deckLightDim: 1,

    /** Mirrors the store flag so per-frame code can branch without a store read. */
    reducedMotion: false,
  };
};

export type Runtime = ReturnType<typeof initial>;

export const rt: Runtime = initial();

// A signed-in pilot starts in the lounge (see core/journey.ts): the walk is already done.
try {
  if (localStorage.getItem('nova.isLoggedIn') === '1') Object.assign(rt, { stand: 1, turn: 1, door: 1, walk: 1 });
} catch {
  /* no storage: the pilot starts in the seat */
}

/** Restores every value to its pre-wake state (keeps the clock and accessibility flag). */
export function resetRuntime(): void {
  const { time, reducedMotion, lookX, lookY } = rt;
  Object.assign(rt, initial(), { time, reducedMotion, lookX, lookY });
}
