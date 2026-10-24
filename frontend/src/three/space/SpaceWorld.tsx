import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  Object3D,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  PlaneGeometry,
  Vector3,
  type Group,
  type DirectionalLight,
  type HemisphereLight,
  type InstancedMesh,
  type Mesh,
} from 'three';
import { currentQuality, fbmDefines } from '../../core/graphics';
import { smoothstep } from '../../core/math';
import { usePlanets } from '../../core/planets';
import { rt } from '../../core/runtime';
import { useDeck } from '../../core/journey';
import { useNova } from '../../core/store';
import { NOISE_GLSL } from '../shaders/noise';
import { DYING, DYING_COLORS } from './finaleWorld';
import { glowTexture, sunDiscTexture } from './textures';
import { moonGeometries } from './moons';
import { moonMaterial } from './moonMaterial';
import Surroundings from './Surroundings';
import { NEAR_FACTOR, worldTravel } from './transition';
import { ASTEROIDS, HERO_DIR, SUN_DISTANCE, screenDir, type Vec3 } from './layout';
import { PLANETS, type PlanetSpec } from './planets';

/** Frequencies of the three shared noise samples for structures 10-18 (see the planet shader). */
const STRUCT_FREQ: Record<number, [number, number, number]> = {
  10: [6, 11, 3],
  11: [6.5, 2, 2],
  12: [3.4, 22, 14],
  13: [2, 2.5, 18],
  14: [12, 26, 4],
  15: [2.5, 5, 3],
  16: [2, 4, 3],
  18: [4, 8, 6.5],
};

const PLANET_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vObj = normalize(position);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPosW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** One shader for every world: palette, continents, ice, lava, lights, gas bands, 10 structural biomes and mist. */
const PLANET_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uTime;
uniform float uWarp;
uniform float uArrive;
uniform vec3 uOcean0;
uniform vec3 uOcean1;
uniform vec3 uGround0;
uniform vec3 uGround1;
uniform vec3 uCloud;
uniform vec3 uAtmo;
uniform vec3 uLightColor;
uniform vec3 uLavaColor;
uniform vec3 uMistColor;
uniform float uLandScale;
uniform float uSea;
uniform float uBandFreq;
uniform float uCloudAmt;
uniform float uCloudScale;
uniform float uLights;
uniform float uLava;
uniform float uIce;
uniform float uGas;
uniform float uMist;
uniform float uBiomeStructure;
uniform vec3 uStructF;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
${NOISE_GLSL}
bool S(float id) { return abs(uBiomeStructure - id) < 0.5; }
void main() {
  vec3 p = vObj;
  float land = fbm3(p * uLandScale);
  vec3 lavaGlow = vec3(0.0);

  // Biome Structure 6: Canyon Mesa & Stepped Terraces (quantized plateau shelves + dried river canyon grooves)
  if (uBiomeStructure > 5.5 && uBiomeStructure < 6.5) {
    land = floor(land * 7.5) / 7.5;
    float canyon = pow(abs(snoise(p * 7.5)), 3.2);
    land -= canyon * 0.22;
  }

  float bands = sin(p.y * uBandFreq + fbm3(p * 2.0) * 3.0) * 0.5 + 0.5;
  vec3 ocean = mix(uOcean0, uOcean1, bands);
  vec3 ground = mix(uGround0, uGround1, smoothstep(0.1, 0.5, land));
  float isLand = smoothstep(uSea, uSea + 0.06, land);

  // Biome Structure 0: Neural Ocean & Coral Archipelagos (fractal atolls & bioluminescent trenches)
  if (uBiomeStructure < 0.5) {
    float coralShelf = smoothstep(uSea - 0.05, uSea, land) * (1.0 - isLand);
    ocean = mix(ocean, vec3(0.15, 0.95, 0.9), coralShelf * 0.75);
    float trenches = pow(1.0 - abs(snoise(p * 8.5)), 11.0);
    ocean += vec3(0.08, 0.75, 1.0) * trenches * 1.8;
  }

  // Biome Structure 1: Caldera Basalt & Voronoi Magma Rifts
  if (uBiomeStructure > 0.5 && uBiomeStructure < 1.5) {
    float calderas = smoothstep(0.24, 0.28, length(fract(p * 3.4) - 0.5));
    ground = mix(uGround0 * 0.7, uGround1, calderas);
    float fault = pow(1.0 - abs(snoise(p * 5.2 + fbm3(p * 2.2))), 8.0);
    lavaGlow += uLavaColor * (fault * 2.6 + (1.0 - calderas) * 1.6);
  }

  // Biome Structure 2: Glacial Ice Facets & Shards
  if (uBiomeStructure > 1.5 && uBiomeStructure < 2.5) {
    float facet = pow(abs(snoise(p * 8.5)), 2.8);
    ground = mix(vec3(0.68, 0.88, 1.0), vec3(0.98, 1.0, 1.0), facet);
    float crevasse = pow(1.0 - abs(snoise(p * 9.5)), 12.0);
    ground *= (1.0 - crevasse * 0.65);
  }

  // Biome Structure 4: Cratered Lunar Bedrock with Radial Ejecta Rays
  if (uBiomeStructure > 3.5 && uBiomeStructure < 4.5) {
    float c1 = smoothstep(0.18, 0.22, length(fract(p * 4.5) - 0.5));
    float c2 = smoothstep(0.08, 0.12, length(fract(p * 9.0 + 0.3) - 0.5));
    float rays = pow(0.5 + 0.5 * sin(atan(p.z, p.x) * 20.0), 3.0);
    ground = mix(uGround0 * 0.7, uGround1, c1 * c2 + rays * 0.22);
    isLand = 1.0;
  }

  // Biome Structure 5: Logarithmic Cyclone & Mist Spiral
  if (uBiomeStructure > 4.5 && uBiomeStructure < 5.5) {
    float angle = atan(p.z, p.x);
    float r = length(p.xz);
    float spiral = sin(angle * 4.0 - log(r + 0.04) * 8.0 + uTime * 0.025);
    float spiralClouds = smoothstep(0.15, 0.75, spiral) * 0.75;
    ground = mix(ground, uCloud, spiralClouds);
  }

  // Biome Structure 8: Toxic Acid Basin & Sulfur Vents
  if (uBiomeStructure > 7.5 && uBiomeStructure < 8.5) {
    float pool = smoothstep(0.2, 0.45, abs(snoise(p * 5.8)));
    ocean = mix(vec3(0.68, 0.95, 0.18), uOcean0, pool);
    float geyser = pow(max(0.0, snoise(p * 16.0)), 6.0);
    lavaGlow += vec3(0.95, 0.85, 0.1) * geyser * 2.2;
  }

  // Structures 10-18 share three noise samples (their frequencies come from uStructF), so the shader compiler only sees
  // them once however many structures there are; only one structure is ever active.
  float nA = 0.0;
  float nB = 0.0;
  float nC = 0.0;
  if (uBiomeStructure > 9.5 && uBiomeStructure < 18.5) {
    nA = snoise(p * uStructF.x);
    nB = snoise(p * uStructF.y + 4.0);
    nC = fbm3(p * uStructF.z);
  }
  // 10 · Crystal geodes: faceted plates cut by glowing seams
  if (S(10.0)) {
    ground = mix(uGround0, uGround1, pow(abs(nA), 1.4));
    lavaGlow += uLightColor * pow(1.0 - abs(nB), 14.0) * 2.6;
    isLand = 1.0;
  }
  // 11 · Cracked magma shell: black plates over a boiling sea
  if (S(11.0)) {
    ground = mix(uGround0 * 0.6, uGround1, smoothstep(0.1, 0.6, land));
    lavaGlow += uLavaColor * pow(1.0 - abs(nA), 10.0) * 3.2;
    lavaGlow += uLavaColor * (1.0 - isLand) * 1.5 * (0.65 + 0.35 * sin(uTime * 0.6 + bands * 6.0));
  }
  // 12 · Moss canopy: dense growth, dark veins and bright rivers
  if (S(12.0)) {
    ground = mix(uGround0, uGround1, smoothstep(0.2, 0.8, nC * 0.5 + 0.5));
    ground *= 0.75 + 0.25 * pow(abs(nB), 0.8);
    float river = pow(1.0 - abs(nA), 20.0);
    ocean = mix(ocean, uOcean1 * 1.6, river);
    isLand = isLand * (1.0 - river * 0.9);
  }
  // 13 · Plated copper and rust with glowing vents
  if (S(13.0)) {
    ground = mix(uGround0, uGround1, floor(land * 6.0) / 6.0);
    float seam = abs(sin(p.x * 16.0 + nA * 2.5)) * abs(sin(p.y * 16.0 + nB * 2.5));
    ground *= 0.65 + 0.35 * smoothstep(0.0, 0.5, seam);
    lavaGlow += uLavaColor * pow(max(0.0, nC * 1.5), 5.0) * 2.2;
    isLand = 1.0;
  }
  // 14 · Glowing reef: deep sea scattered with living light
  if (S(14.0)) {
    float spots = pow(max(0.0, nA), 3.0);
    ocean += uLightColor * (spots * 1.2 + pow(max(0.0, nB), 5.0) * 1.8);
    ground += uLightColor * spots * 0.6;
  }
  // 15 · Magnetic ribbons: flowing contour bands
  if (S(15.0)) {
    float flow = sin(p.y * 18.0 + nA * 6.0 + p.x * 3.0);
    ground = mix(uGround0, uGround1, 0.5 + 0.5 * flow);
    ocean = mix(uOcean0, uOcean1, 0.5 + 0.5 * flow);
    lavaGlow += uLightColor * smoothstep(0.93, 1.0, abs(flow)) * 1.3;
  }
  // 16 · Wind-rippled dunes
  if (S(16.0)) {
    float rip = sin((p.y + nA * 0.28) * 70.0 + p.x * 9.0);
    ground = mix(uGround0, uGround1, clamp((0.5 + 0.5 * rip) * 0.7 + smoothstep(0.1, 0.5, land) * 0.4, 0.0, 1.0));
    isLand = 1.0;
  }
  // 18 · Archipelago: bright sea with scattered islands
  if (S(18.0)) {
    float isle = nC * 0.5 + 0.5;
    isLand = smoothstep(0.38, 0.43, isle);
    ocean = mix(uOcean0, uOcean1 * 1.5, 0.5 + 0.5 * sin(p.y * 30.0 + isle * 6.0));
    ground = mix(uGround0, uGround1, smoothstep(0.4, 0.7, isle));
  }

  vec3 albedo = mix(ocean, ground, isLand);

  // Frozen crust: a pale coat over land and sea, cut by dark cracks.
  float crack = pow(1.0 - abs(snoise(p * 7.0 + 1.7)), 12.0);
  albedo = mix(albedo, vec3(0.88, 0.94, 1.0), uIce * (0.35 + 0.65 * smoothstep(-0.1, 0.4, land)));
  albedo *= 1.0 - uIce * crack * 0.55;

  // Lava: glowing veins across the land and lakes where the sea would be.
  float vein = pow(1.0 - abs(snoise(p * 4.5 + fbm3(p * 2.5))), 9.0);
  lavaGlow += uLavaColor * uLava * (vein * 1.8 + (1.0 - isLand) * 0.8 * (0.6 + 0.4 * bands));

  // Biome Structure 9: Continental Mantle Fracture (colossal rift revealing glowing interior)
  if (uBiomeStructure > 8.5) {
    float rift = (1.0 - smoothstep(0.0, 0.065, abs(p.y - sin(p.x * 3.0) * 0.28)));
    lavaGlow += uLavaColor * rift * 4.5;
    albedo = mix(albedo, uGround0 * 0.4, rift);
  }

  // Gas giant (Biome Structure 3 or uGas): storm bands stirred by turbulence, and a great vortex.
  if (uGas > 0.5 || (uBiomeStructure > 2.5 && uBiomeStructure < 3.5)) {
    float turb = fbm3(vec3(p.x * 2.5, p.y * 7.0, p.z * 2.5) + vec3(uTime * 0.004, 0.0, 0.0));
    float b = sin(p.y * uBandFreq + turb * 5.0) * 0.5 + 0.5;
    albedo = mix(uGround0, uGround1, b);
    albedo = mix(albedo, uOcean0, smoothstep(0.35, 0.9, fbm3(vec3(p.x * 3.0, p.y * 16.0, p.z * 3.0))) * 0.55);
    float eye1 = distance(p, normalize(vec3(0.62, -0.28, 0.73)));
    float eye2 = distance(p, normalize(vec3(-0.55, 0.35, -0.73)));
    albedo = mix(albedo, uOcean1, (1.0 - smoothstep(0.06, 0.30, min(eye1, eye2))) * 0.85);
    albedo = mix(albedo, uGround1 * 1.1, (1.0 - smoothstep(0.02, 0.16, min(eye1, eye2))) * 0.5);
    isLand = 1.0;
  }

  // 17 · Aurora ice caps
  if (S(17.0)) {
    float lat = abs(p.y);
    albedo = mix(albedo, vec3(0.9, 0.96, 1.0), smoothstep(0.5, 0.82, lat));
    float band = exp(-pow((lat - 0.74) / 0.06, 2.0)) * (0.6 + 0.4 * sin(atan(p.z, p.x) * 6.0 + uTime * 0.3));
    lavaGlow += uLightColor * band * 1.8;
  }
  // 19 · Hex storm bands with a polar hexagon
  if (S(19.0)) {
    float hexa = pow(abs(sin(atan(p.z, p.x) * 3.0)), 0.35);
    float polar = smoothstep(0.78, 0.82, abs(p.y));
    albedo = mix(albedo, uCloud * 0.95, polar * (0.45 + 0.4 * hexa));
  }

  // Planetary mist biome: swirling dense planetary mist, fogbanks and atmospheric haze
  if (uMist > 0.01) {
    float mistNoise = fbm3(p * 3.8 + vec3(uTime * 0.015, uTime * 0.01, 0.0));
    float mistDensity = smoothstep(0.18, 0.72, mistNoise) * uMist;
    vec3 mistScattering = mix(uMistColor, vec3(0.95, 0.98, 1.0), 0.2);
    albedo = mix(albedo, mistScattering, mistDensity * 0.8);
  }

  float clouds = smoothstep(0.15, 0.6, fbm3(p * uCloudScale + vec3(uTime * 0.01, 0.0, 0.0))) * uCloudAmt;
  albedo = mix(albedo, uCloud, clouds);

  vec3 n = normalize(vNormalW);
  float ndl = dot(n, uSun);
  float day = smoothstep(-0.08, 0.35, ndl);
  vec3 col = albedo * max(ndl, 0.0) * 1.35;
  col += lavaGlow * (0.6 + 0.4 * (1.0 - day)) * (1.0 - clouds);

  // Night side: city lights or Biome Structure 7 cybernetic grid
  float net = 1.0 - abs(snoise(p * 9.0));
  net = pow(net, 14.0) * smoothstep(0.0, 0.1, land);
  float nodes = pow(max(0.0, snoise(p * 40.0)), 8.0) * 3.0 * step(0.02, land);

  if (uBiomeStructure > 6.5 && uBiomeStructure < 7.5) {
    float gridX = pow(abs(cos(p.x * 42.0)), 16.0); // abs: a negative base makes pow() undefined, and one NaN blacks out the whole frame through bloom
    float gridY = pow(abs(cos(p.y * 42.0)), 16.0); // abs: a negative base makes pow() undefined, and one NaN blacks out the whole frame through bloom
    float gridZ = pow(abs(cos(p.z * 42.0)), 16.0); // abs: a negative base makes pow() undefined, and one NaN blacks out the whole frame through bloom
    float circuits = max(gridX * gridY, max(gridY * gridZ, gridZ * gridX));
    col += uLightColor * circuits * 3.2 * (0.6 + 0.4 * (1.0 - day));
  } else {
    col += uLightColor * (net * 1.6 + nodes) * (1.0 - day) * (1.0 - clouds * 0.7) * uLights;
  }

  // Atmosphere rim, brighter on the lit limb.
  vec3 v = normalize(cameraPosition - vPosW);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 atmoCol = mix(uAtmo, uMistColor, uMist * 0.45);
  col += atmoCol * rim * (0.25 + 1.4 * smoothstep(-0.3, 0.6, ndl)) * (0.6 + 0.4 * uArrive);
  if (uMist > 0.01) {
    col += uMistColor * rim * uMist * 1.2 * (0.5 + 0.5 * day);
  }
  float warpFade = 1.0 - smoothstep(0.06, 0.28, uWarp);
  float arriveFade = smoothstep(0.02, 0.5, uArrive);
  float alpha = warpFade * arriveFade;
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0); // never let one bad pixel spread through bloom
  gl_FragColor = vec4(col, alpha);
  if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0);
}`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uAtmo;
uniform vec3 uMistColor;
uniform float uWarp;
uniform float uArrive;
uniform float uMist;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vPosW);
  float rim = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 5.0);
  float lit = smoothstep(-0.4, 0.5, dot(n, uSun));
  vec3 atmoCol = mix(uAtmo, uMistColor, uMist * 0.5);
  float warpFade = 1.0 - smoothstep(0.06, 0.28, uWarp);
  float arriveFade = smoothstep(0.02, 0.5, uArrive);
  gl_FragColor = vec4(atmoCol * rim * lit * (0.8 + 0.6 * uArrive) * (1.0 + uMist * 0.6) * warpFade * arriveFade, 1.0);
  if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0);
}`;

const RING_VERT = /* glsl */ `
varying float vR;
varying vec3 vPosW;
void main() {
  vR = length(position.xy);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vPosW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const RING_FRAG = /* glsl */ `
uniform float uInner;
uniform float uOuter;
uniform vec3 uRingA;
uniform vec3 uRingB;
uniform float uRingAlpha;
uniform float uWarp;
uniform float uArrive;
varying float vR;
varying vec3 vPosW;
${NOISE_GLSL}
void main() {
  float t = (vR - uInner) / (uOuter - uInner);
  float b = 0.55 + 0.45 * sin(t * 90.0) * sin(t * 23.0 + 1.0);
  b *= 0.6 + 0.4 * snoise(vec3(t * 40.0, 0.0, 0.0));
  float gap = smoothstep(0.42, 0.44, t) * (1.0 - smoothstep(0.47, 0.49, t));
  float edge = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.9, 1.0, t));
  float warpFade = 1.0 - smoothstep(0.06, 0.28, uWarp);
  float arriveFade = smoothstep(0.02, 0.5, uArrive);
  float a = clamp(b * edge * (1.0 - gap * 0.9), 0.0, 1.0) * uRingAlpha * warpFade * arriveFade;
  vec3 col = mix(uRingA, uRingB, t) * 0.9;
  gl_FragColor = vec4(col * a, a);
  if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0);
}`;

const dummy = new Object3D();
const spinAxis = new Vector3(0, 0, 1);

const scale = (v: Vec3, s: number): Vec3 => [v[0] * s, v[1] * s, v[2] * s];

/** Spin axis = ring-plane normal: the planet's on-screen "up", rolled round the line of sight and opened towards the camera. */
function ringAxis(dir: Vec3, rollDeg: number, openDeg: number): Vec3 {
  const d = new Vector3(...dir);
  const up = new Vector3(0, 1, 0).addScaledVector(d, -d.y).normalize();
  const right = new Vector3().crossVectors(d, up).normalize();
  const roll = (rollDeg * Math.PI) / 180;
  const open = (openDeg * Math.PI) / 180;
  const tilted = up.multiplyScalar(Math.cos(roll)).addScaledVector(right, Math.sin(roll));
  const axis = tilted.multiplyScalar(Math.cos(open)).addScaledVector(d, -Math.sin(open)).normalize();
  return [axis.x, axis.y, axis.z];
}

/** Everything about the current world that the scene needs, worked out from its spec. */
function layoutOf(spec: PlanetSpec) {
  const dir = screenDir(spec.at[0], spec.at[1]);
  const sunDir = screenDir(spec.sunAt[0], spec.sunAt[1]);
  const position = scale(dir, spec.distance);
  const quaternion = new Quaternion().setFromUnitVectors(spinAxis, new Vector3(...ringAxis(dir, spec.roll, spec.open)));
  return {
    position,
    quaternion,
    sunDir,
    sunPosition: scale(sunDir, SUN_DISTANCE),
    /** Where the planet's own frame sits in ship space (what floats around the planet is placed relative to it). */
    anchor: { position: new Vector3(...position), quaternion },
  };
}

/** The world the ship is at (one of twenty, see planets.ts) — planet, rings, sun, moons and an asteroid scatter — composed around the parked ship. */
export default function SpaceWorld() {
  const world = useNova((s) => s.world);
  const index = usePlanets((s) => s.index);
  const spec = PLANETS[index];
  const worldGroup = useRef<Group>(null);
  /** What moves with the jump: the planet and moons (far), and the rocks and dust near the ship (near, faster). */
  const flightFar = useRef<Group>(null);
  const flightNear = useRef<Group>(null);
  const planetSystem = useRef<Group>(null);
  const planet = useRef<Group>(null);
  const rocks = useRef<InstancedMesh>(null);
  const sunLightRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const shipEnv = useRef<Group>(null);
  const sunBillboard = useRef<Group>(null);

  // Pooled geometry and materials to eliminate buffer re-allocations on planet jumps
  const ringGeom = useMemo(() => new RingGeometry(400, 2600, 256, 1), []);
  const moonGeoms = useMemo(() => moonGeometries(), []);
  const planetGeom = useMemo(() => new SphereGeometry(1, 128, 64), []);
  const haloGeom = useMemo(() => new SphereGeometry(1, 64, 32), []);
  const sunGeom = useMemo(() => new PlaneGeometry(900, 900), []);
  const moonMats = useMemo(
    () => [0, 1, 2].map(() => moonMaterial()),
    [],
  );

  const moon0 = useRef<Mesh>(null);
  const moon1 = useRef<Mesh>(null);
  const moon2 = useRef<Mesh>(null);

  useEffect(() => {
    return () => {
      ringGeom.dispose();
      planetGeom.dispose();
      haloGeom.dispose();
      sunGeom.dispose();
      moonMats.forEach((m) => m.dispose());
    };
  }, [ringGeom, planetGeom, haloGeom, sunGeom, moonMats]);

  const mats = useMemo(() => {
    const color = () => ({ value: new Color() });
    const uniforms = {
      uSun: { value: new Vector3() },
      uTime: { value: 0 },
      uWarp: { value: 0 },
      uArrive: { value: 0 },
      uOcean0: color(),
      uOcean1: color(),
      uGround0: color(),
      uGround1: color(),
      uCloud: color(),
      uAtmo: color(),
      uLightColor: color(),
      uLavaColor: color(),
      uMistColor: color(),
      uLandScale: { value: 3 },
      uSea: { value: 0 },
      uBandFreq: { value: 20 },
      uCloudAmt: { value: 0.5 },
      uCloudScale: { value: 5 },
      uLights: { value: 0 },
      uLava: { value: 0 },
      uIce: { value: 0 },
      uGas: { value: 0 },
      uMist: { value: 0 },
      uBiomeStructure: { value: 0 },
      uStructF: { value: new Vector3(4, 8, 5) },
    };
    const ringUniforms = { uInner: { value: 1 }, uOuter: { value: 2 }, uRingA: color(), uRingB: color(), uRingAlpha: { value: 0.7 }, uWarp: { value: 0 }, uArrive: { value: 0 } };
    return {
      uniforms,
      ringUniforms,
      planet: new ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, uniforms, defines: fbmDefines(), transparent: true, depthWrite: true }),
      halo: new ShaderMaterial({
        vertexShader: PLANET_VERT,
        fragmentShader: HALO_FRAG,
        uniforms,
        side: BackSide,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
      ring: new ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: ringUniforms,
        defines: fbmDefines(),
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        premultipliedAlpha: true,
      }),
      glow: glowTexture(),
      disc: sunDiscTexture(),
    };
  }, []);

  useEffect(() => {
    return () => {
      mats.planet.dispose();
      mats.halo.dispose();
      mats.ring.dispose();
      mats.glow.dispose();
      mats.disc.dispose();
    };
  }, [mats]);

  const where = useMemo(() => layoutOf(spec), [spec]);

  // Switching world only rewrites the uniforms — shaders and pooled geometries are never re-allocated
  useLayoutEffect(() => {
    const { uniforms, ringUniforms } = mats;
    const l = spec.look;
    uniforms.uSun.value.set(...where.sunDir);
    uniforms.uOcean0.value.set(l.ocean0);
    uniforms.uOcean1.value.set(l.ocean1);
    uniforms.uGround0.value.set(l.ground0);
    uniforms.uGround1.value.set(l.ground1);
    uniforms.uCloud.value.set(l.cloud);
    uniforms.uAtmo.value.set(l.atmo);
    uniforms.uLightColor.value.set(l.lightColor);
    uniforms.uLavaColor.value.set(l.lavaColor);
    uniforms.uMistColor.value.set(l.mistColor ?? l.atmo);
    uniforms.uLandScale.value = l.landScale;
    uniforms.uSea.value = l.sea;
    uniforms.uBandFreq.value = l.bandFreq;
    uniforms.uCloudAmt.value = l.cloudAmt;
    uniforms.uCloudScale.value = l.cloudScale;
    uniforms.uLights.value = l.lights;
    uniforms.uLava.value = l.lava;
    uniforms.uIce.value = l.ice;
    uniforms.uGas.value = l.gas ? 1 : 0;
    uniforms.uMist.value = l.mist ?? 0;
    uniforms.uBiomeStructure.value = l.structure ?? 0;
    uniforms.uStructF.value.set(...(STRUCT_FREQ[l.structure ?? 0] ?? [4, 8, 5]));
    if (spec.ring) {
      ringUniforms.uInner.value = spec.radius * spec.ring.inner;
      ringUniforms.uOuter.value = spec.radius * spec.ring.outer;
      ringUniforms.uRingA.value.set(spec.ring.colorA);
      ringUniforms.uRingB.value.set(spec.ring.colorB);
      ringUniforms.uRingAlpha.value = spec.ring.opacity;
    }

    const moonRefs = [moon0.current, moon1.current, moon2.current];
    for (let i = 0; i < 3; i++) {
      const m = moonRefs[i];
      if (!m) continue;
      if (i < spec.moons.length) {
        const moonSpec = spec.moons[i];
        const sq = moonSpec.squash ?? [1, 1, 1];
        m.visible = true;
        m.userData.on = true;
        m.geometry = moonGeoms[moonSpec.shape ?? 'round'];
        m.position.set(moonSpec.position[0], moonSpec.position[1], moonSpec.position[2]);
        m.scale.set(moonSpec.radius * sq[0], moonSpec.radius * sq[1], moonSpec.radius * sq[2]);
        m.rotation.set((moonSpec.seed * 0.37) % 1, (moonSpec.seed * 1.3) % 6.28, ((moonSpec.seed * 0.71) % 1) - 0.5);
        m.userData.spin = moonSpec.spin ?? 0.02;
        // The surface colour is the moon's own; a matching glow keeps it visible on the night side and through tone mapping.
        // Molten moons: a dark crust that glows from within; every other moon: its own colour, lit by the sun, with just a
        // little self-light so the night side keeps its hue.
        const mu = moonMats[i].uniforms;
        mu.uTint.value.set(moonSpec.tint);
        mu.uGlowColor.value.set(moonSpec.tint);
        mu.uGlow.value = moonSpec.glow ?? 0;
        mu.uSunDir.value.set(...where.sunDir);
      } else {
        m.visible = false;
        m.userData.on = false;
      }
    }
  }, [mats, spec, where, moonMats, moonGeoms, index]);

  useLayoutEffect(() => {
    const m = rocks.current;
    if (!m) return;
    const hero = new Vector3(...HERO_DIR);
    const v = new Vector3();
    let i = 0;
    let guard = 0;
    const total = Math.round(ASTEROIDS.count * currentQuality().particles);
    while (i < total && guard++ < 10000) {
      v.set(Math.random() * 2 - 1, Math.random() * 1.4 - 0.7, -Math.random() * 1.1 + 0.15).normalize();
      if (v.dot(hero) > ASTEROIDS.heroClearCos) continue;
      const d = 70 + Math.pow(Math.random(), 1.6) * 800;
      v.multiplyScalar(d);
      if (Math.hypot(v.x, v.y) < ASTEROIDS.corridor) continue;
      dummy.position.copy(v);
      dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      dummy.scale.setScalar(0.6 + Math.pow(Math.random(), 3) * 6);
      dummy.updateMatrix();
      m.setMatrixAt(i++, dummy.matrix);
    }
    m.count = i;
    m.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    if (useNova.getState().world !== 'newworld') return;
    const isWarping = useNova.getState().phase === 'warp';
    const w = rt.warp;
    // In the warp tunnel nothing of the world is drawn. Its lights stay in the scene, only dimmed to zero: every shader is
    // built for the number of lights it sees, so taking them out would rebuild the cockpit's shaders as the warp begins
    // (a visible stall) and again as it ends.
    const cruising = isWarping || w >= 0.25;
    for (const g of [flightFar.current, flightNear.current, sunBillboard.current]) if (g) g.visible = !cruising;
    if (cruising) {
      if (sunLightRef.current) sunLightRef.current.intensity = 0;
      if (hemiRef.current) hemiRef.current.intensity = 0;
      return; // nothing else to update while it is out of sight
    }
    if (hemiRef.current) hemiRef.current.intensity = 0.35;

    mats.uniforms.uTime.value = rt.time;
    mats.uniforms.uWarp.value = rt.warp;
    mats.uniforms.uArrive.value = rt.arrive;
    mats.ringUniforms.uWarp.value = rt.warp;
    mats.ringUniforms.uArrive.value = rt.arrive;

    // Departure: the planet, its moons and the rocks rush towards the ship and stream past it. Arrival: they start far ahead
    // and come to meet the ship, together (see transition.ts). The sun and the sky are too far away to move.
    const travel = worldTravel(useNova.getState().phase, rt.phaseTime, rt.reducedMotion);
    flightFar.current?.position.set(0, 0, travel);
    flightNear.current?.position.set(0, 0, travel * NEAR_FACTOR);
    const reveal = smoothstep(0.02, 0.5, rt.arrive);
    for (const mm of moonMats) mm.uniforms.uOpacity.value = reveal;

    // At the dying sun (the course finale) the planet, its moons, its surroundings and the sun are all out of the picture.
    const finaleWorld = rt.finaleWorld;
    if (planetSystem.current && finaleWorld) planetSystem.current.visible = false;
    else if (planetSystem.current) planetSystem.current.visible = true;
    if (shipEnv.current) shipEnv.current.visible = !finaleWorld;
    if (sunBillboard.current) sunBillboard.current.visible = !finaleWorld;
    for (const m of [moon0.current, moon1.current, moon2.current]) if (m) m.visible = !finaleWorld && m.userData.on === true;
    if (planet.current) planet.current.rotateOnAxis(spinAxis, spec.spin * dt);
    for (const m of [moon0.current, moon1.current, moon2.current]) if (m?.visible) m.rotation.y += (m.userData.spin as number) * dt;
    if (rocks.current) rocks.current.rotation.y += dt * 0.004;

    // Smooth lighting transition across lounge, corridor, and cockpit:
    const deck = useDeck.getState().deck;
    const dim = rt.deckLightDim;
    const lightFactor = deck === 'lounge' ? 0.35 : deck === 'transit' ? (0.35 + (1 - dim) * 0.65) : 1;
    if (sunLightRef.current) {
      sunLightRef.current.intensity = (2.6 * lightFactor) + 7 * rt.novaGlow;
      // In the finale the light comes from the dying sun ahead, and it is ember-coloured.
      if (finaleWorld) {
        sunLightRef.current.position.set(DYING.dir[0] * 10, DYING.dir[1] * 10, DYING.dir[2] * 10);
        sunLightRef.current.color.set(DYING_COLORS.body);
      } else {
        sunLightRef.current.position.set(where.sunDir[0] * 10, where.sunDir[1] * 10, where.sunDir[2] * 10);
        sunLightRef.current.color.set(spec.sunColor);
      }
    }
  });

  // The star keeps its colour: a saturated corona, a white-hot core and a disc of the star's own hue.
  const sun = useMemo(() => {
    const base = new Color(spec.sunColor);
    return {
      corona: base.clone().multiplyScalar(1.25),
      inner: base.clone().lerp(new Color('#ffffff'), 0.25).multiplyScalar(1.8),
      disc: base.clone().lerp(new Color('#ffffff'), 0.55).multiplyScalar(2.2),
      spike: base.clone().offsetHSL(0.03, 0, 0.12).multiplyScalar(1.3),
    };
  }, [spec.sunColor]);
  return (
    <group ref={worldGroup} visible={world === 'newworld'} userData={{ world: 'newworld' }}>
      <directionalLight ref={sunLightRef} color={spec.sunColor} intensity={2.6} position={[where.sunDir[0] * 10, where.sunDir[1] * 10, where.sunDir[2] * 10]} />
      <hemisphereLight ref={hemiRef} args={['#6d5aa8', '#0b2530', 0.35]} />

      <group ref={flightFar}>
        <group ref={planetSystem} position={where.position as [number, number, number]} quaternion={where.quaternion}>
          <group ref={planet}>
            <mesh material={mats.planet} geometry={planetGeom} scale={spec.radius} />
          </group>
          <mesh material={mats.halo} geometry={haloGeom} scale={spec.radius * 1.12} />
          <mesh material={mats.ring} geometry={ringGeom} visible={Boolean(spec.ring)} />
          <Surroundings spec={spec} zone="planet" sunDir={where.sunDir} index={index} anchor={where.anchor} />
        </group>

        <mesh ref={moon0} geometry={moonGeoms.round} material={moonMats[0]} visible={false} />
        <mesh ref={moon1} geometry={moonGeoms.round} material={moonMats[1]} visible={false} />
        <mesh ref={moon2} geometry={moonGeoms.round} material={moonMats[2]} visible={false} />
      </group>

      <group ref={flightNear}>
        <group ref={shipEnv}>
          <Surroundings spec={spec} zone="ship" sunDir={where.sunDir} index={index} anchor={where.anchor} />
        </group>
        <instancedMesh ref={rocks} args={[undefined, undefined, Math.round(ASTEROIDS.count * currentQuality().particles)]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#5b5560" roughness={0.95} flatShading />
        </instancedMesh>
      </group>

      <group ref={sunBillboard}>
      <Billboard position={where.sunPosition as [number, number, number]}>
        <mesh geometry={sunGeom} scale={[1.8, 1.8, 1]}>
          <meshBasicMaterial map={mats.glow} color={sun.corona} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh geometry={sunGeom} scale={[0.55, 0.55, 1]}>
          <meshBasicMaterial map={mats.glow} color={sun.inner} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh geometry={sunGeom} scale={[0.2, 0.2, 1]}>
          <meshBasicMaterial map={mats.disc} color={sun.disc} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh geometry={sunGeom} scale={[6, 0.05, 1]}>
          <meshBasicMaterial map={mats.glow} color={sun.spike} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh geometry={sunGeom} scale={[0.04, 2.6, 1]}>
          <meshBasicMaterial map={mats.glow} color={sun.spike} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </Billboard>
      </group>
    </group>
  );
}
