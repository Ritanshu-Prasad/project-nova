import { NOISE_GLSL } from '../shaders/noise';

/**
 * Sky shaders. Everything here is drawn "at infinity": vertices are rotated by the view matrix only,
 * so the sky never shows parallax no matter where the ship (camera) is.
 */

/** Shared output tail: tone mapping + colour space (no-ops when rendering into the HDR composer). */
export const OUTPUT_GLSL = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

/**
 * Baked once into a cube map. Channels (sqrt-encoded where marked):
 *   r  cloud density (sqrt)   g  palette mix   b  dust / absorption   a  bright filaments (sqrt)
 */
export const NEBULA_BAKE_FRAG = /* glsl */ `
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 d = normalize(vDir);
  vec3 p = d * 1.25;
  vec3 q = vec3(fbm3(p), fbm3(p + vec3(5.2, 1.3, 2.8)), fbm3(p + vec3(1.7, 9.2, 4.1)));
  float n = fbm3(p * 1.7 + q * 1.9);
  float cloud = smoothstep(-0.12, 0.55, n);
  cloud *= cloud;
  float mixv = clamp(0.5 + 0.9 * fbm3(p * 0.7 + q * 0.8 + vec3(3.1, 7.7, 1.2)), 0.0, 1.0);
  float dust = smoothstep(0.02, 0.42, fbm3(p * 3.4 + q * 2.6 + vec3(9.1, 3.3, 5.5)));
  float ridge = 1.0 - abs(snoise(p * 4.2 + q * 3.2));
  float ridge2 = 1.0 - abs(snoise(p * 9.0 + q * 4.0 + 2.0));
  float wisps = (pow(ridge, 9.0) + 0.5 * pow(ridge2, 12.0)) * smoothstep(-0.25, 0.35, n);
  gl_FragColor = vec4(sqrt(cloud), mixv, dust, sqrt(clamp(wisps, 0.0, 1.0)));
}
`;

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
}
`;

export const NEBULA_FRAG = /* glsl */ `
uniform samplerCube uFields;
uniform float uWorld;
uniform float uWarp;
uniform float uSunAmt;
uniform vec3 uSunDir;
uniform vec3 uHeroDir;
uniform vec3 uGalaxyN;
varying vec3 vDir;

float hashPix(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec4 fields(vec3 d) {
  vec4 f = textureCube(uFields, d);
  f.r *= f.r;
  f.a *= f.a;
  return f;
}

// Cold, sparse home sky: blue-black with faint teal dust (a rotated region of the same field).
vec3 oldSky(vec3 d) {
  vec4 f = fields(vec3(-d.z, d.x, -d.y));
  float haze = f.r * (1.0 - 0.75 * f.b);
  vec3 col = vec3(0.0011, 0.0019, 0.0050);
  col += vec3(0.0030, 0.0150, 0.0175) * haze;
  col += vec3(0.0020, 0.0070, 0.0110) * f.a * (1.0 - f.b);
  return col;
}

// The new world: violet / magenta / teal emission, dust lanes, a soft galactic band.
vec3 newSky(vec3 d) {
  vec4 f = fields(d);
  float hero = smoothstep(0.78, 0.97, dot(d, uHeroDir));
  float sunSide = dot(d, uSunDir);
  float near = pow(max(sunSide, 0.0), 2.5);

  vec3 teal = vec3(0.015, 0.20, 0.24);
  vec3 violet = vec3(0.20, 0.055, 0.46);
  vec3 magenta = vec3(0.42, 0.05, 0.30);
  vec3 col = mix(teal, violet, smoothstep(0.28, 0.52, f.g));
  col = mix(col, magenta, smoothstep(0.6, 0.82, f.g));

  float amount = (0.5 + 0.7 * near) * (1.0 - 0.8 * hero);
  vec3 neb = col * (f.r * 0.2 + f.a * 0.28) * amount;

  float g = dot(d, uGalaxyN);
  float band = exp(-g * g / 0.02);
  float core = exp(-g * g / 0.004);
  neb += vec3(0.055, 0.05, 0.085) * band * (0.45 + 0.9 * f.r) * (1.0 - 0.7 * hero);
  neb += vec3(0.07, 0.055, 0.06) * core * (0.4 + 0.6 * f.a);

  neb *= 1.0 - f.b * (0.5 + 0.45 * band);
  // Sunlight scattering in the nebula around the sun.
  neb += vec3(1.0, 0.72, 0.5) * pow(max(sunSide, 0.0), 14.0) * 0.045 * uSunAmt;
  neb += vec3(0.5, 0.35, 0.9) * pow(max(sunSide, 0.0), 4.0) * 0.012 * uSunAmt;

  return vec3(0.0016, 0.0014, 0.0042) + neb;
}

vec3 sky(vec3 d) {
  if (uWorld < 0.002) return oldSky(d);
  if (uWorld > 0.998) return newSky(d);
  return mix(oldSky(d), newSky(d), uWorld);
}

void main() {
  vec3 d = normalize(vDir);
  vec3 col;
  if (uWarp > 0.01) {
    // Radial smear away from the flight direction (-Z), dimmed.
    vec3 radial = d - vec3(0.0, 0.0, d.z);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float k = float(i) / 3.0;
      acc += sky(normalize(d - radial * k * 0.16 * uWarp));
    }
    col = acc * 0.25 * (1.0 - 0.55 * uWarp);
  } else {
    col = sky(d);
  }
  float n = hashPix(gl_FragCoord.xy) - 0.5;
  col = max(col + n * (0.0005 + col * 0.04), 0.0);
  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT_GLSL}
}
`;

export const STARS_VERT = /* glsl */ `
attribute vec3 aColor;
attribute vec4 aParams; // size (px), world (0 home / 1 new), twinkle phase, twinkle speed
uniform float uWorld;
uniform float uTime;
uniform float uPixelRatio;
uniform float uDim;
varying vec3 vColor;
void main() {
  gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  float vis = mix(1.0 - uWorld, uWorld, aParams.y);
  float tw = 1.0 + 0.22 * sin(uTime * aParams.w + aParams.z) * sin(uTime * aParams.w * 0.37 + aParams.z * 1.7);
  vColor = aColor * vis * tw * uDim;
  gl_PointSize = vis < 0.003 ? 0.0 : aParams.x * uPixelRatio;
}
`;

export const STARS_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 4.5) - 0.011;
  gl_FragColor = vec4(vColor * max(a, 0.0), 1.0);
  ${OUTPUT_GLSL}
}
`;

/** Bright stars: a soft core, a faint halo and a thin 4-point diffraction cross (pixel-accurate widths). */
export const FLARES_VERT = /* glsl */ `
attribute vec3 aColor;
attribute vec4 aParams; // size (px), world, twinkle phase, twinkle speed
uniform float uWorld;
uniform float uTime;
uniform float uPixelRatio;
uniform float uDim;
varying vec3 vColor;
varying float vSize;
void main() {
  gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  float vis = mix(1.0 - uWorld, uWorld, aParams.y);
  float tw = 1.0 + 0.12 * sin(uTime * aParams.w + aParams.z);
  vColor = aColor * vis * tw * uDim;
  vSize = aParams.x * uPixelRatio * (0.92 + 0.08 * tw);
  gl_PointSize = vis < 0.003 ? 0.0 : vSize;
}
`;

export const FLARES_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vSize;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float half = vSize * 0.5;
  vec2 px = abs(p) * half;            // distance from the centre in pixels
  float r = length(px);
  float core = exp(-r * r / 2.2);
  float halo = exp(-r * r / (half * half * 0.06)) * 0.12;
  float spikeH = exp(-px.y * px.y / 0.45) * pow(max(1.0 - abs(p.x), 0.0), 2.2);
  float spikeV = exp(-px.x * px.x / 0.45) * pow(max(1.0 - abs(p.y), 0.0), 2.2);
  float f = core + halo + 0.5 * (spikeH + spikeV);
  gl_FragColor = vec4(vColor * f, 1.0);
  ${OUTPUT_GLSL}
}
`;
