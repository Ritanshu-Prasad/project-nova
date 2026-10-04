import {
  CanvasTexture,
  Color,
  EquirectangularReflectionMapping,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  SRGBColorSpace,
  type Texture,
  type WebGLRenderer,
} from 'three';

/**
 * Shared cockpit materials. All lit materials share an env map (generated here, so the metals read the same
 * in the hangar and in space) whose contribution is tinted per frame: red in emergency, cool when powered.
 * A small shader chunk adds grime / roughness breakup and panel seams (from metre-based UVs).
 */

export interface SharedUniforms {
  uTime: { value: number };
  uEnvTint: { value: Color };
}

export interface DetailOptions {
  /** Seam spacing along u / v in metres (0 = none). */
  seamU?: number;
  seamV?: number;
  /** Seam offset along u (m). */
  seamOffsetU?: number;
  /** Grime / roughness breakup strength (0..1). */
  grime?: number;
  /** Noise frequency (per metre). */
  grimeScale?: number;
  /** Groove bump strength. */
  bump?: number;
}

const DETAIL_PARS = /* glsl */ `
uniform vec3 uEnvTint;
uniform float uSeamU;
uniform float uSeamV;
uniform float uSeamOffU;
uniform float uGrime;
uniform float uGrimeScale;
uniform float uBump;
varying vec3 vCkPos;
varying vec2 vCkUv;

float ckHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ckNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ckHash(i), ckHash(i + vec3(1, 0, 0)), f.x),
                 mix(ckHash(i + vec3(0, 1, 0)), ckHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(ckHash(i + vec3(0, 0, 1)), ckHash(i + vec3(1, 0, 1)), f.x),
                 mix(ckHash(i + vec3(0, 1, 1)), ckHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float ckLine(float coord, float spacing, float offset) {
  if (spacing <= 0.0) return 0.0;
  float d = abs(fract((coord - offset) / spacing + 0.5) - 0.5) * spacing;
  float w = max(fwidth(coord), 1e-5);
  return 1.0 - smoothstep(0.0007, 0.0007 + w * 1.25, d);
}
vec3 ckPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surf_pos));
  vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

/** Adds the detail chunk + env tint to a standard material (shares `uEnvTint` across the kit). */
function withDetail(mat: MeshStandardMaterial, shared: SharedUniforms, o: DetailOptions = {}): MeshStandardMaterial {
  const uniforms = {
    uEnvTint: shared.uEnvTint,
    uSeamU: { value: o.seamU ?? 0 },
    uSeamV: { value: o.seamV ?? 0 },
    uSeamOffU: { value: o.seamOffsetU ?? 0 },
    uGrime: { value: o.grime ?? 0.5 },
    uGrimeScale: { value: o.grimeScale ?? 20 },
    uBump: { value: o.bump ?? 1 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCkPos;\nvarying vec2 vCkUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCkPos = position;\nvCkUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${DETAIL_PARS}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float ckN = ckNoise(vCkPos * uGrimeScale) * 0.62 + ckNoise(vCkPos * uGrimeScale * 3.7) * 0.38;
        float ckSeam = max(ckLine(vCkUv.x, uSeamU, uSeamOffU), ckLine(vCkUv.y, uSeamV, 0.0));
        diffuseColor.rgb *= mix(1.0, 0.8 + 0.4 * ckN, uGrime) * (1.0 - 0.72 * ckSeam);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (ckN - 0.5) * 0.3 * uGrime + ckSeam * 0.25, 0.05, 1.0);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        if (uBump > 0.0) {
          vec2 ckDh = vec2(dFdx(ckSeam), dFdy(ckSeam)) * -0.6 * uBump;
          normal = ckPerturb(-vViewPosition, normal, ckDh, faceDirection);
        }`,
      )
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
        iblIrradiance *= uEnvTint;
        radiance *= uEnvTint;`,
      );
  };
  // Distinct program per option set is not needed: uniforms carry the options.
  mat.customProgramCacheKey = () => 'cockpit-detail';
  return mat;
}

/** Env tint only (for materials that need no detail chunk). */
function withTint(mat: MeshStandardMaterial, shared: SharedUniforms): MeshStandardMaterial {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uEnvTint = shared.uEnvTint;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uEnvTint;')
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
        iblIrradiance *= uEnvTint;
        radiance *= uEnvTint;`,
      );
  };
  mat.customProgramCacheKey = () => 'cockpit-tint';
  return mat;
}

export function createMaterials() {
  const shared: SharedUniforms = {
    uTime: { value: 0 },
    uEnvTint: { value: new Color(1, 1, 1) },
  };

  /** Dark soft-touch composite: dash, consoles. */
  const panel = withDetail(
    new MeshStandardMaterial({ color: '#1a1f27', metalness: 0.3, roughness: 0.58 }),
    shared,
    { seamU: 0.31, seamOffsetU: 0.05, grime: 0.55, grimeScale: 26, bump: 1 },
  );
  /** Same surface without seams (pods, small housings). */
  const panelPlain = withDetail(
    new MeshStandardMaterial({ color: '#1c222b', metalness: 0.35, roughness: 0.5 }),
    shared,
    { grime: 0.5, grimeScale: 34, bump: 0 },
  );
  /** Gunmetal structure: canopy frame, rails. */
  const hull = withDetail(new MeshStandardMaterial({ color: '#2e3540', metalness: 0.78, roughness: 0.36 }), shared, {
    grime: 0.6,
    grimeScale: 30,
    bump: 0,
  });
  /** Dark glossy bezels. */
  const trim = withTint(new MeshStandardMaterial({ color: '#0f1216', metalness: 0.6, roughness: 0.3 }), shared);
  /** Bright machined metal: levers, bolts, rings. */
  const metal = withTint(new MeshStandardMaterial({ color: '#c3ccd6', metalness: 1, roughness: 0.26 }), shared);
  /** Matte rubber / grip. */
  const rubber = withTint(new MeshStandardMaterial({ color: '#0d0f12', metalness: 0.05, roughness: 0.82 }), shared);
  /** Exterior hull (the nose). */
  const nose = withDetail(new MeshStandardMaterial({ color: '#4a5463', metalness: 0.62, roughness: 0.4 }), shared, {
    seamU: 0.62,
    seamV: 0.45,
    seamOffsetU: 0.2,
    grime: 0.45,
    grimeScale: 9,
    bump: 1.4,
  });

  /** Emissive light strips (colour driven per frame: red emergency → cyan powered). Values > 1 bloom. */
  const strip = new MeshBasicMaterial({ color: new Color(0, 0, 0), toneMapped: false });
  /** Secondary accents (System blue), on with main power. */
  const accent = new MeshBasicMaterial({ color: new Color(0, 0, 0), toneMapped: false });

  const lit = [panel, panelPlain, hull, trim, metal, rubber, nose];

  return {
    shared,
    panel,
    panelPlain,
    hull,
    trim,
    metal,
    rubber,
    nose,
    strip,
    accent,
    /** Assigns the generated env map to every lit material. */
    setEnv(tex: Texture | null, intensity = 1) {
      for (const m of lit) {
        m.envMap = tex;
        m.envMapIntensity = intensity;
        m.needsUpdate = true;
      }
    },
    dispose() {
      for (const m of lit) m.dispose();
      strip.dispose();
      accent.dispose();
    },
  };
}

export type CockpitMaterials = ReturnType<typeof createMaterials>;

/**
 * A soft studio-like environment for the cockpit's reflections: dark base, a cool skylight through the canopy
 * ahead, faint side panels. Returns the PMREM texture and a disposer.
 */
export function createCockpitEnv(gl: WebGLRenderer): { texture: Texture; dispose: () => void } {
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // Vertical gradient (canvas top = up).
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a4a5e');
  g.addColorStop(0.35, '#1a2230');
  g.addColorStop(0.5, '#0c1018');
  g.addColorStop(1, '#040507');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const blob = (x: number, y: number, rx: number, ry: number, color: string, alpha: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  // Forward (-Z) sits at u = 0.25 → x = 128; right (+X) at x = 256; behind at 384; left at 0 / 512.
  blob(128, 70, 120, 34, '#cfe6ff', 0.9);
  blob(128, 20, 200, 24, '#9fb8d8', 0.6);
  blob(30, 96, 40, 50, '#6c7c94', 0.5);
  blob(226, 96, 40, 50, '#6c7c94', 0.5);
  blob(384, 60, 90, 30, '#8090a8', 0.45);
  ctx.globalAlpha = 1;
  // Thin bright strips (overhead light bars) for crisp highlights on bevels.
  ctx.fillStyle = 'rgba(235,245,255,0.85)';
  ctx.fillRect(70, 52, 116, 5);
  ctx.fillRect(320, 40, 130, 4);

  const tex = new CanvasTexture(canvas);
  tex.mapping = EquirectangularReflectionMapping;
  tex.colorSpace = SRGBColorSpace;
  const pmrem = new PMREMGenerator(gl);
  const target = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  tex.dispose();
  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}
