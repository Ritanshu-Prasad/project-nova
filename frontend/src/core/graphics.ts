import { create } from 'zustand';
import { useSettings } from './settings';

/**
 * Graphics levels: how much of the 3D scene a device is asked to draw.
 *
 *   high    everything
 *   medium  no multisampling, grain or chromatic aberration; lower resolution and fewer particles
 *   low     tone-mapping only, simpler shaders, far fewer particles, one key light, no blur on panels
 *   none    no WebGL at all — a CSS star-field behind the same menus, lessons and quizzes
 *
 * The level is picked automatically (device heuristics + a short timing test, cached) unless the pilot chooses one in
 * Settings. It is decided before the 3D canvas mounts, so nothing has to be rebuilt later; a later change in Settings
 * remounts the canvas.
 */

export type Level = 'high' | 'medium' | 'low' | 'none';
export type Choice = 'auto' | Level;

export const LEVELS: readonly Level[] = ['high', 'medium', 'low', 'none'];
export const LEVEL_LABEL: Record<Level, string> = { high: 'High', medium: 'Medium', low: 'Low', none: 'No 3D' };

export interface Quality {
  /** Pixel ratio: normal, and what the frame-rate monitor drops to when frames run long. */
  dpr: readonly [number, number];
  post: 'full' | 'mid' | 'min';
  /** Octaves of the fractal noise in the sky, planet and lounge shaders. */
  fbm: number;
  /** Share of warp streaks, stars, dust and asteroids that is drawn. */
  warp: number;
  particles: number;
  /** All point lights, or just the key one. */
  lights: 'all' | 'key';
  /** Resolution of the reflection environment. */
  env: number;
}

export const QUALITY: Record<Exclude<Level, 'none'>, Quality> = {
  high: { dpr: [1.5, 1], post: 'full', fbm: 5, warp: 1, particles: 1, lights: 'all', env: 128 },
  medium: { dpr: [1, 0.75], post: 'mid', fbm: 4, warp: 0.65, particles: 0.7, lights: 'all', env: 64 },
  low: { dpr: [0.75, 0.6], post: 'min', fbm: 3, warp: 0.3, particles: 0.4, lights: 'key', env: 32 },
};

/** The next lighter level, or the same one at the bottom. */
export const stepDown = (l: Level): Level => LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(l) + 1)];
const lighter = (a: Level, b: Level): Level => (LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b);

// ── Device profile → level (pure) ─────────────────────────────────────────

export interface Profile {
  webgl: boolean;
  renderer: string;
  /** GB, as the browser reports it (rounded, capped at 8; absent in some browsers). */
  memoryGB?: number;
  cores?: number;
  coarsePointer: boolean;
  screenWidth: number;
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|mesa offscreen/i;
const WEAK_MOBILE = /mali-4|mali-t[0-7]|adreno \(?tm\)? ?[2-4]\d\d|powervr|videocore|apple software/i;
const INTEGRATED = /intel.*(hd graphics|uhd|iris|gma)|amd radeon\(tm\) graphics|vega \d+ graphics|mali-g[0-5]\d|adreno \(?tm\)? ?[5]\d\d/i;

/** What the device's specs alone suggest. */
export function levelFromProfile(p: Profile): Level {
  if (!p.webgl || SOFTWARE.test(p.renderer)) return 'none';
  let level: Level = 'high';
  if (WEAK_MOBILE.test(p.renderer)) level = lighter(level, 'low');
  else if (INTEGRATED.test(p.renderer)) level = lighter(level, 'medium');
  if (p.memoryGB !== undefined) level = lighter(level, p.memoryGB <= 2 ? 'low' : p.memoryGB <= 4 ? 'medium' : 'high');
  if (p.cores !== undefined) level = lighter(level, p.cores <= 2 ? 'low' : p.cores <= 4 ? 'medium' : 'high');
  if (p.coarsePointer && p.screenWidth <= 820) level = lighter(level, 'medium');
  return level;
}

/** What a timed test frame (ms to draw a fixed heavy shader at 640×360) says. */
export function levelFromFrameMs(ms: number): Level {
  return ms > 45 ? 'none' : ms > 16 ? 'low' : ms > 7 ? 'medium' : 'high';
}

export const resolveLevel = (choice: Choice, auto: Level, forced?: Level | null): Level => forced ?? (choice === 'auto' ? auto : choice);

// ── Cached detection result ───────────────────────────────────────────────

const CACHE_KEY = 'nova.gfx.auto';
/** Bump to make every device measure again (after changing how levels are decided). */
const CACHE_VERSION = 2;
/** A result that matches what the specs suggest is trusted for a month; a timing that came out lower may be a busy moment, so it is re-measured soon. */
const TRUSTED_DAYS = 30;
const DOUBTED_DAYS = 2;

export function parseCache(raw: string | null, now = Date.now()): Level | null {
  try {
    const c = JSON.parse(raw ?? 'null') as { v?: number; level?: string; until?: number } | null;
    if (!c || c.v !== CACHE_VERSION || typeof c.until !== 'number' || now > c.until) return null;
    return LEVELS.includes(c.level as Level) ? (c.level as Level) : null;
  } catch {
    return null;
  }
}

const readCache = () => {
  try {
    return parseCache(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
};
const writeCache = (level: Level, trusted: boolean) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_VERSION, level, until: Date.now() + (trusted ? TRUSTED_DAYS : DOUBTED_DAYS) * 86_400_000 }));
  } catch {
    /* ignore */
  }
};

// ── Measuring this device (browser only) ──────────────────────────────────

function gpuContext(): { gl: WebGLRenderingContext; renderer: string } | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return { gl, renderer };
  } catch {
    return null;
  }
}

export function readProfile(): Profile {
  const ctx = gpuContext();
  const nav = navigator as Navigator & { deviceMemory?: number };
  let coarse = false;
  try {
    coarse = window.matchMedia('(pointer: coarse)').matches;
  } catch {
    /* ignore */
  }
  ctx?.gl.getExtension('WEBGL_lose_context')?.loseContext();
  return { webgl: !!ctx, renderer: ctx?.renderer ?? '', memoryGB: nav.deviceMemory, cores: nav.hardwareConcurrency, coarsePointer: coarse, screenWidth: window.screen?.width ?? window.innerWidth };
}

const PROBE_FRAG = `precision highp float;
uniform float t;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){ vec2 p = gl_FragCoord.xy / 90.0 + t; float s = 0.0, a = 0.5;
  for (int i = 0; i < 24; i++) { s += a * n(p); p = p * 1.9 + 3.1; a *= 0.8; }
  gl_FragColor = vec4(vec3(s * 0.4), 1.0); }`;

/** Milliseconds per frame for a fixed, deliberately heavy full-screen shader — a few frames, well under a second. */
export function measureFrameMs(): number | null {
  const ctx = gpuContext();
  if (!ctx) return null;
  const { gl } = ctx;
  try {
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, PROBE_FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const t = gl.getUniformLocation(prog, 't');
    gl.viewport(0, 0, 640, 360);
    const px = new Uint8Array(4);
    const frame = (i: number) => {
      gl.uniform1f(t, i * 0.1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // waits for the GPU to finish this frame
    };
    frame(0); // warm-up (shader compile, upload)
    const times: number[] = [];
    const started = performance.now();
    for (let i = 1; i <= 6 && performance.now() - started < 900; i++) {
      const a = performance.now();
      frame(i);
      times.push(performance.now() - a);
    }
    if (!times.length) return null;
    times.sort((x, y) => x - y);
    return times[Math.floor(times.length / 2)];
  } catch {
    return null;
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

// ── Store ─────────────────────────────────────────────────────────────────

interface GraphicsState {
  /** What detection decided for this device. */
  auto: Level;
  /** The level in use: a `?gfx=` override, the pilot's choice, or `auto`. */
  level: Level;
  /** Detection is finished, so the 3D scene may mount. */
  ready: boolean;
  /** A lighter level to offer because frames keep running long (null = nothing to offer). */
  suggest: Level | null;
  setAuto: (level: Level) => void;
  setSuggest: (level: Level | null) => void;
}

/** `?gfx=low` (for support and testing): wins over everything, never saved. */
const forcedLevel = (): Level | null => {
  try {
    const v = new URLSearchParams(location.search).get('gfx');
    return LEVELS.includes(v as Level) ? (v as Level) : null;
  } catch {
    return null;
  }
};
const forced = forcedLevel();

const cached = readCache();
const initialAuto = cached ?? 'high';
const startChoice = useSettings.getState().graphics;

export const useGraphics = create<GraphicsState>()((set) => ({
  auto: initialAuto,
  level: resolveLevel(startChoice, initialAuto, forced),
  ready: !!cached || startChoice !== 'auto' || !!forced,
  suggest: null,
  setAuto: (auto) => set({ auto, level: resolveLevel(useSettings.getState().graphics, auto, forced), ready: true }),
  setSuggest: (suggest) => set({ suggest }),
}));

// A change in Settings applies at once (the canvas remounts on the new level).
useSettings.subscribe((s, p) => {
  if (s.graphics === p.graphics) return;
  const { auto } = useGraphics.getState();
  useGraphics.setState({ level: resolveLevel(s.graphics, auto, forced), suggest: null });
});

/** Detects this device (once, cached) when nothing is cached yet and the pilot has not chosen a level. */
export function detectGraphics(): void {
  if (useGraphics.getState().ready) return;
  const fromSpecs = levelFromProfile(readProfile());
  if (fromSpecs === 'none') {
    writeCache('none', true);
    useGraphics.getState().setAuto('none');
    return;
  }
  // Time a test frame off the main flow, so the first paint is not held up.
  const run = () => {
    const ms = measureFrameMs();
    const level = ms === null ? fromSpecs : lighter(fromSpecs, levelFromFrameMs(ms));
    writeCache(level, level === fromSpecs);
    useGraphics.getState().setAuto(level);
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 600 });
  else setTimeout(run, 50);
  setTimeout(() => !useGraphics.getState().ready && useGraphics.getState().setAuto(fromSpecs), 3000); // never wait forever
}

/** Offers the next lighter level once frames have kept running long. Shown at most once per visit. */
let offered = false;
export function suggestLighter(): void {
  const { level } = useGraphics.getState();
  if (offered || level === 'none') return;
  offered = true;
  useGraphics.getState().setSuggest(stepDown(level));
}

/** Switches to a level for good (the Graphics choice in Settings). */
export const chooseLevel = (level: Level) => useSettings.getState().set({ graphics: level });

/** The detail settings for the level in use. Read when a scene part mounts (the canvas remounts when the level changes). */
export function currentQuality(): Quality {
  const level = useGraphics.getState().level;
  return QUALITY[level === 'none' ? 'low' : level];
}

/** Shader defines carrying the noise octaves: `{ FBM_OCTAVES: n }`. */
export const fbmDefines = () => ({ FBM_OCTAVES: currentQuality().fbm });
