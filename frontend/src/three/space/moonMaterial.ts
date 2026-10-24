import { Color, ShaderMaterial, Vector3 } from 'three';

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vC;
varying vec3 vV;
void main() {
  vC = color;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal); // right even for a squashed moon
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform vec3 uTint;
uniform vec3 uSunDir;
uniform vec3 uGlowColor;
uniform float uGlow;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vC;
varying vec3 vV;
void main() {
  vec3 n = normalize(vN);
  float day = smoothstep(-0.12, 0.65, dot(n, normalize(uSunDir)));
  // A molten moon has a dark crust; every other moon is its own colour.
  vec3 base = mix(uTint, vec3(0.1, 0.06, 0.05), uGlow * 0.8) * vC;
  vec3 col = base * (0.08 + 1.25 * day);
  col += uTint * 0.06;                                         // the night side keeps a hint of its colour
  float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.6);
  col += mix(uTint, vec3(1.0), 0.35) * rim * (0.18 + 0.5 * day);
  float pit = clamp((1.0 - vC.r) * 2.6, 0.0, 1.0);             // craters and cracks glow on molten moons
  col = mix(col, uGlowColor * 1.8, uGlow * pit);
  col += uGlowColor * uGlow * 0.25;
  if (any(isnan(col))) col = vec3(0.0);
  gl_FragColor = vec4(col, uOpacity);
}`;

/** The look of a moon: lit by the sun with a soft terminator, a rim of its own colour, and optional molten glow. */
export function moonMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    vertexColors: true,
    uniforms: { uTint: { value: new Color('#ffffff') }, uSunDir: { value: new Vector3(0, 1, 0) }, uGlowColor: { value: new Color('#ff6a1a') }, uGlow: { value: 0 }, uOpacity: { value: 1 } },
    transparent: true, // fades in as the world arrives (SpaceWorld sets uOpacity)
  });
}
