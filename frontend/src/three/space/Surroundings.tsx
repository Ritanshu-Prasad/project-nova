import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Mesh,
} from 'three';
import { currentQuality } from '../../core/graphics';
import { CAMERA } from '../../core/scene';
import { rt } from '../../core/runtime';
import { seededRandom } from '../../core/seeded';
import type { Vec3 } from './layout';
import type { PlanetSpec } from './planets';
import { spriteAtlas, SPRITE } from './textures';
import { noise3, TEXT_ZONE } from './moons';
import type { Motion, MoteLayer, SolidLayer, VeilLayer, Zone } from './worlds';

/**
 * What floats around a world — the part that makes each biome look different. Every layer is one instanced mesh whose
 * motion is computed on the GPU (nothing is updated per particle on the CPU), and the meshes are built once and only
 * rewritten when the world changes.
 */

const MAX_VEIL = 60;
const MAX_MOTES = 320;
const MAX_SOLIDS = 160;
const MOTION: Record<Motion, number> = { drift: 0, rise: 1, fall: 2, swirl: 3, wind: 4, wander: 5, stream: 6, plume: 7 };

const SPRITE_VERT = /* glsl */ `
attribute vec4 aRand;
uniform float uTime;
uniform float uMotion;
uniform float uSpeed;
uniform float uRange;
uniform float uRadius;
uniform float uStretch;
uniform float uWarp;
varying vec2 vUv;
varying vec3 vColor;
varying float vLife;
varying float vRand;
void main() {
  vUv = uv;
  vec3 lp = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float size = length(instanceMatrix[0].xyz) * length(modelMatrix[0].xyz);
  float t = uTime * uSpeed;
  float life = 1.0;
  vec3 off = vec3(0.0);
  if (uMotion < 0.5) {            // drift: a slow wobble in place
    lp += vec3(sin(t * 0.9 + aRand.x * 6.283), cos(t * 0.7 + aRand.y * 6.283), sin(t * 0.8 + aRand.z * 6.283)) * uRadius * 0.03;
  } else if (uMotion < 2.5) {     // rise / fall along the world's vertical, looping with a fade at both ends
    float ph = fract(t * (0.15 + aRand.y * 0.25) + aRand.x);
    off.y = (uMotion < 1.5 ? 1.0 : -1.0) * (ph - 0.5) * uRange;
    life = sin(ph * 3.14159);
    lp.xy += vec2(sin(aRand.z * 6.283 + t), cos(aRand.w * 6.283 + t)) * uRadius * 0.02;
  } else if (uMotion < 3.5) {     // swirl around the planet's axis, faster near the planet
    float r = length(lp.xy);
    float a = t * (0.6 + aRand.y) / (0.4 + r / uRadius);
    float c = cos(a);
    float s = sin(a);
    lp.xy = mat2(c, -s, s, c) * lp.xy;
  } else if (uMotion < 4.5) {     // wind across the view
    float ph = fract(t * (0.2 + aRand.y * 0.3) + aRand.x);
    off.x = (ph - 0.5) * uRange;
    life = sin(ph * 3.14159);
  } else if (uMotion < 5.5) {     // wander like fireflies
    lp += vec3(sin(t * 1.3 + aRand.x * 40.0), cos(t * 1.1 + aRand.y * 40.0), sin(t * 0.9 + aRand.z * 40.0)) * uRadius * 0.05;
  } else if (uMotion < 6.5) {     // stream towards the ship
    float ph = fract(t * (0.25 + aRand.y * 0.4) + aRand.x);
    off.z = (ph - 0.5) * uRange;
    life = sin(ph * 3.14159);
  } else {                        // plume: leave the surface and climb straight out
    float ph = fract(t * (0.18 + aRand.y * 0.3) + aRand.x);
    lp = normalize(lp) * uRadius * (1.0 + ph * 0.55);
    life = sin(ph * 3.14159);
  }
  vec3 center = (modelMatrix * vec4(lp, 1.0)).xyz + off;
  center.z -= uWarp * 800.0;
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec2 corner = position.xy * vec2(1.0 + uStretch, 1.0);
  vec3 pos = center + (camRight * corner.x + camUp * corner.y) * size;
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
#ifdef USE_INSTANCING_COLOR
  vColor = instanceColor;
#else
  vColor = vec3(1.0);
#endif
  vLife = life;
  vRand = aRand.w;
}`;

const SPRITE_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uShape;
uniform float uOpacity;
uniform float uWarp;
uniform float uArrive;
uniform float uFlash;
uniform float uTwinkle;
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
varying float vLife;
varying float vRand;
void main() {
  vec4 tex = texture2D(uAtlas, vec2((vUv.x + uShape) * 0.25, vUv.y));
  float a = tex.a * uOpacity * vLife * (1.0 - smoothstep(0.04, 0.22, uWarp)) * smoothstep(0.05, 0.85, uArrive);
  a *= 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * 3.0 + vRand * 40.0));
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * (1.0 + uFlash * 1.8), a);
}`;

const SOLID_VERT = /* glsl */ `
attribute vec4 aSpin;
attribute float aHeat;
uniform float uTime;
uniform float uSpin;
uniform vec3 uSunDir;
varying vec3 vN;
varying vec3 vColor;
varying float vHeat;
varying float vPhase;
varying vec3 vView;
vec3 rotate(vec3 v, vec3 axis, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}
void main() {
  float ang = uTime * aSpin.w * uSpin;
  vec3 axis = normalize(aSpin.xyz);
  vec3 p = rotate(position, axis, ang);
  vec3 n = rotate(normal, axis, ang);
  mat4 m = modelMatrix * instanceMatrix;
  vec4 world = m * vec4(p, 1.0);
  vN = normalize(mat3(m) * n);
  vView = normalize(cameraPosition - world.xyz);
  vHeat = aHeat;
  vPhase = aSpin.w * 7.0;
#ifdef USE_INSTANCING_COLOR
  vColor = instanceColor;
#else
  vColor = vec3(0.4);
#endif
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const SOLID_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uGlowColor;
uniform float uGlow;
uniform float uCrystal;
uniform float uTime;
uniform float uWarp;
uniform float uArrive;
varying vec3 vN;
varying vec3 vColor;
varying float vHeat;
varying float vPhase;
varying vec3 vView;
void main() {
  vec3 n = normalize(vN);
  float ndl = max(dot(n, normalize(uSunDir)), 0.0);
  vec3 col = vColor * (0.2 + ndl * 1.15);
  float pulse = 0.78 + 0.22 * sin(uTime * 1.4 + vPhase);
  float heat = vHeat * uGlow * pulse;
  col = mix(col, uGlowColor * 1.6, clamp(heat, 0.0, 1.0));
  col += uGlowColor * heat * 0.9;
  if (uCrystal > 0.5) {         // crystals: a bright rim and a prismatic edge
    float rim = pow(1.0 - abs(dot(n, normalize(vView))), 2.2);
    col += mix(uGlowColor, vec3(0.7, 0.9, 1.0), 0.5 + 0.5 * sin(rim * 6.0 + vPhase)) * rim * 0.9;
  }
  float a = (1.0 - smoothstep(0.04, 0.22, uWarp)) * smoothstep(0.05, 0.85, uArrive);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

const RIBBON_VERT = /* glsl */ `
uniform float uTime;
uniform float uArc;
uniform float uPhase;
uniform float uBase;
uniform float uHeight;
uniform float uWave;
varying vec2 vUv;
void main() {
  vUv = uv;
  float ang = (uv.x - 0.5) * uArc + uPhase;
  float wave = sin(uv.x * 14.0 + uTime * 0.3 * uWave) * 45.0 * (1.0 - uv.y) + sin(uv.x * 5.0 - uTime * 0.2) * 30.0;
  vec3 p = vec3(sin(ang) * 1150.0, uBase + uv.y * uHeight + wave, -cos(ang) * 1150.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const RIBBON_FRAG = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
uniform float uTime;
uniform float uWarp;
uniform float uArrive;
varying vec2 vUv;
void main() {
  float curtain = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.6) * smoothstep(0.0, 0.12, vUv.y); // clamped: a negative base is NaN, and NaN blacks out the whole frame through the bloom
  float rays = 0.55 + 0.45 * sin(vUv.x * 70.0 + uTime * 0.45 + sin(vUv.x * 13.0) * 2.5);
  float edge = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
  vec3 col = mix(uColorA, uColorB, clamp(vUv.y + 0.3 * sin(vUv.x * 5.0 + uTime * 0.2), 0.0, 1.0));
  float a = curtain * rays * edge * uOpacity * (1.0 - smoothstep(0.04, 0.22, uWarp)) * smoothstep(0.05, 0.85, uArrive);
  if (!(a >= 0.003)) discard; // also drops NaN
  gl_FragColor = vec4(col * 1.4, a);
}`;

const dummy = new Object3D();
const color = new Color();
const world = new Vector3();
const TAN_HALF = Math.tan((CAMERA.fovWide * Math.PI) / 360);

/** Would a particle at this ship-space point sit in front of the landing text? Those stay empty so the words stay readable. */
function inTextZone(w: Vector3): boolean {
  if (w.z >= -50) return false;
  const x = w.x / -w.z / (TAN_HALF * 1.6);
  const y = w.y / -w.z / TAN_HALF;
  return x > TEXT_ZONE.x[0] && x < TEXT_ZONE.x[1] && y > TEXT_ZONE.y[0] && y < TEXT_ZONE.y[1];
}
const mat4 = new Matrix4();
const quat = new Quaternion();
const axisV = new Vector3();

/** Rocks: a rough ball with seeded bumps, and a "heat" value per vertex that follows the cracks. */
function rockGeometry(): BufferGeometry {
  const geo = new IcosahedronGeometry(1, 2);
  const pos = geo.attributes.position;
  const heat = new Float32Array(pos.count);
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const big = noise3(v.x * 1.8 + 3, v.y * 1.8, v.z * 1.8, 5);
    const fine = noise3(v.x * 6, v.y * 6, v.z * 6, 9);
    const r = 0.78 + big * 0.5 + fine * 0.12;
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r);
    const crack = noise3(v.x * 4 + 11, v.y * 4, v.z * 4, 2);
    heat[i] = Math.pow(1 - Math.abs(crack - 0.5) * 2, 4);
  }
  geo.setAttribute('aHeat', new Float32BufferAttribute(heat, 1));
  geo.computeVertexNormals();
  return geo;
}

/** Shards: a long faceted spindle that glows towards its tips. */
function shardGeometry(): BufferGeometry {
  const geo = new OctahedronGeometry(1, 0);
  const pos = geo.attributes.position;
  const heat = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) * 0.55, pos.getY(i) * 2.4, pos.getZ(i) * 0.55);
    heat[i] = Math.min(1, Math.max(0, (Math.abs(pos.getY(i)) / 2.4 - 0.35) / 0.65));
  }
  geo.setAttribute('aHeat', new Float32BufferAttribute(heat, 1));
  geo.computeVertexNormals();
  return geo;
}

function spriteMaterial(atlas: ReturnType<typeof spriteAtlas>) {
  return new ShaderMaterial({
    vertexShader: SPRITE_VERT,
    fragmentShader: SPRITE_FRAG,
    uniforms: {
      uAtlas: { value: atlas },
      uTime: { value: 0 },
      uMotion: { value: 0 },
      uSpeed: { value: 0.4 },
      uRange: { value: 500 },
      uRadius: { value: 600 },
      uStretch: { value: 0 },
      uShape: { value: SPRITE.dot },
      uOpacity: { value: 0.5 },
      uWarp: { value: 0 },
      uArrive: { value: 0 },
      uFlash: { value: 0 },
      uTwinkle: { value: 0 },
    },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

function solidMaterial() {
  return new ShaderMaterial({
    vertexShader: SOLID_VERT,
    fragmentShader: SOLID_FRAG,
    uniforms: { uTime: { value: 0 }, uSpin: { value: 1 }, uSunDir: { value: new Vector3(0, 1, 0) }, uGlowColor: { value: new Color('#ff5a14') }, uGlow: { value: 0 }, uCrystal: { value: 0 }, uWarp: { value: 0 }, uArrive: { value: 0 } },
    transparent: true,
  });
}

/** A unit quad with a per-instance random vector (phase, speed and wobble of each particle). */
function spriteGeometry(max: number): PlaneGeometry {
  const geo = new PlaneGeometry(1, 1);
  geo.setAttribute('aRand', new InstancedBufferAttribute(new Float32Array(max * 4), 4));
  return geo;
}

/** Where a particle sits, by zone and motion. */
function place(rng: () => number, zone: Zone, motion: Motion, R: number, out: Vector3): void {
  if (zone === 'ship') {
    out.set((rng() * 2 - 1) * 1100, -250 + rng() * 800, -150 - rng() * 1350);
    return;
  }
  const a = rng() * Math.PI * 2;
  if (motion === 'swirl') {
    const r = R * (1.15 + Math.pow(rng(), 0.8) * 1.5);
    out.set(Math.cos(a) * r, Math.sin(a) * r, (rng() - 0.5) * R * 0.28);
  } else if (motion === 'plume') {
    const z = rng() * 2 - 1;
    const s = Math.sqrt(1 - z * z);
    out.set(Math.cos(a) * s, Math.sin(a) * s, z).multiplyScalar(R);
  } else {
    const z = rng() * 2 - 1;
    const s = Math.sqrt(1 - z * z);
    out.set(Math.cos(a) * s, Math.sin(a) * s, z).multiplyScalar(R * (1.12 + rng() * 1.5));
  }
}

interface Anchor {
  position: Vector3;
  quaternion: Quaternion;
}

/** Draws a spot for a particle, trying again (a few times) when it would land in front of the landing text. */
function spot(rng: () => number, layer: { zone: Zone; motion: Motion }, R: number, anchor: Anchor, avoidText: boolean, out: Vector3): void {
  for (let tries = 0; tries < 10; tries++) {
    place(rng, layer.zone, layer.motion, R, out);
    if (!avoidText) return;
    world.copy(out);
    if (layer.zone === 'planet') world.applyQuaternion(anchor.quaternion).add(anchor.position);
    if (!inTextZone(world)) return;
  }
}

function fillSprites(mesh: InstancedMesh, layer: VeilLayer | MoteLayer, R: number, seed: number, scale: number, anchor: Anchor, avoidText: boolean): void {
  const rng = seededRandom(seed);
  const max = mesh.instanceMatrix.count;
  const n = Math.min(max, Math.round(layer.count * scale));
  const rand = mesh.geometry.getAttribute('aRand') as InstancedBufferAttribute;
  const unit = layer.zone === 'planet' ? R : 1;
  const p = new Vector3();
  for (let i = 0; i < n; i++) {
    spot(rng, layer, R, anchor, avoidText, p);
    const size = (layer.size[0] + rng() * (layer.size[1] - layer.size[0])) * unit;
    dummy.position.copy(p);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.set(layer.colors[Math.floor(rng() * layer.colors.length)]).multiplyScalar(0.75 + rng() * 0.5);
    mesh.setColorAt(i, color);
    rand.setXYZW(i, rng(), rng(), rng(), rng());
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  rand.needsUpdate = true;
}

function fillSolids(rocks: InstancedMesh, shards: InstancedMesh, layer: SolidLayer, R: number, seed: number, scale: number, anchor: Anchor): void {
  const rng = seededRandom(seed);
  const mesh = layer.kind === 'shards' ? shards : rocks;
  const other = mesh === shards ? rocks : shards;
  other.count = 0;
  const n = Math.min(mesh.instanceMatrix.count, Math.round(layer.count * scale));
  const spin = mesh.geometry.getAttribute('aSpin') as InstancedBufferAttribute;
  const p = new Vector3();
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 10; tries++) {
      const a = rng() * Math.PI * 2;
      if (layer.belt) {
        const r = R * (1.5 + rng() * 0.9);
        p.set(Math.cos(a) * r, Math.sin(a) * r, (rng() - 0.5) * R * 0.14);
      } else {
        const z = rng() * 2 - 1;
        const s = Math.sqrt(1 - z * z);
        p.set(Math.cos(a) * s, Math.sin(a) * s, z).multiplyScalar(R * (1.25 + rng() * 1.35));
      }
      world.copy(p).applyQuaternion(anchor.quaternion).add(anchor.position);
      if (!inTextZone(world)) break;
    }
    const size = (layer.size[0] + Math.pow(rng(), 1.6) * (layer.size[1] - layer.size[0])) * R;
    axisV.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
    quat.setFromAxisAngle(axisV, rng() * Math.PI * 2);
    const flat = layer.kind === 'slabs' ? [1, 0.22 + rng() * 0.12, 0.7 + rng() * 0.3] : layer.kind === 'rocks' ? [1, 0.7 + rng() * 0.3, 0.75 + rng() * 0.25] : [1, 1, 1];
    mat4.compose(p, quat, new Vector3(size * flat[0], size * flat[1], size * flat[2]));
    mesh.setMatrixAt(i, mat4);
    color.set(layer.colors[Math.floor(rng() * layer.colors.length)]).multiplyScalar(0.8 + rng() * 0.4);
    mesh.setColorAt(i, color);
    axisV.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
    spin.setXYZW(i, axisV.x, axisV.y, axisV.z, (0.3 + rng()) * (rng() < 0.5 ? -1 : 1));
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  spin.needsUpdate = true;
}

/** The sprite uniforms that depend on a layer. */
function applySprite(mat: ShaderMaterial, layer: VeilLayer | MoteLayer, R: number, shape: number, stretch: number, twinkle: number): void {
  const u = mat.uniforms;
  const planet = layer.zone === 'planet';
  u.uMotion.value = MOTION[layer.motion];
  u.uSpeed.value = layer.speed;
  u.uRadius.value = planet ? R : 600;
  u.uRange.value = layer.motion === 'wind' ? (planet ? R * 3.2 : 1800) : layer.motion === 'stream' ? 1000 : planet ? R * 1.7 : 560;
  u.uShape.value = shape;
  u.uOpacity.value = layer.opacity;
  u.uStretch.value = stretch;
  u.uTwinkle.value = twinkle;
}

export default function Surroundings({ spec, zone, sunDir, index, anchor }: { spec: PlanetSpec; zone: Zone; sunDir: Vec3; index: number; anchor: Anchor }) {
  const veilRef = useRef<InstancedMesh>(null);
  const moteA = useRef<InstancedMesh>(null);
  const moteB = useRef<InstancedMesh>(null);
  const rocksRef = useRef<InstancedMesh>(null);
  const shardsRef = useRef<InstancedMesh>(null);
  const ribbonRefs = useRef<(Mesh | null)[]>([]);
  const flash = useRef({ value: 0 });

  const pool = useMemo(() => {
    const atlas = spriteAtlas();
    const rockGeo = rockGeometry();
    const shardGeo = shardGeometry();
    rockGeo.setAttribute('aSpin', new InstancedBufferAttribute(new Float32Array(MAX_SOLIDS * 4), 4));
    shardGeo.setAttribute('aSpin', new InstancedBufferAttribute(new Float32Array(MAX_SOLIDS * 4), 4));
    const solidMat = solidMaterial();
    const ribbonGeo = new PlaneGeometry(1, 1, 64, 1);
    const ribbonMats = [0, 1].map(
      () =>
        new ShaderMaterial({
          vertexShader: RIBBON_VERT,
          fragmentShader: RIBBON_FRAG,
          uniforms: { uTime: { value: 0 }, uArc: { value: 1.7 }, uPhase: { value: 0 }, uBase: { value: 160 }, uHeight: { value: 520 }, uWave: { value: 1 }, uColorA: { value: new Color() }, uColorB: { value: new Color() }, uOpacity: { value: 0.4 }, uWarp: { value: 0 }, uArrive: { value: 0 } },
          side: DoubleSide,
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
    );
    return {
      atlas,
      rockGeo,
      shardGeo,
      solidMat,
      ribbonGeo,
      ribbonMats,
      veilGeo: spriteGeometry(MAX_VEIL),
      moteGeos: [spriteGeometry(MAX_MOTES), spriteGeometry(MAX_MOTES)],
      veilMat: spriteMaterial(atlas),
      moteMats: [spriteMaterial(atlas), spriteMaterial(atlas)],
    };
  }, []);

  useLayoutEffect(
    () => () => {
      pool.atlas.dispose();
      pool.rockGeo.dispose();
      pool.shardGeo.dispose();
      pool.solidMat.dispose();
      pool.ribbonGeo.dispose();
      pool.veilGeo.dispose();
      pool.moteGeos.forEach((g) => g.dispose());
      pool.ribbonMats.forEach((m) => m.dispose());
      pool.veilMat.dispose();
      pool.moteMats.forEach((m) => m.dispose());
    },
    [pool],
  );

  // Rewrite the layers when the world changes (a few hundred matrix writes, no allocation of meshes or materials).
  useLayoutEffect(() => {
    const env = spec.env;
    const scale = currentQuality().particles;
    const R = spec.radius;
    const seed = 4000 + index * 53 + (zone === 'ship' ? 7 : 0);
    const veil = veilRef.current;
    if (veil) {
      const layer = env.veil && env.veil.zone === zone ? env.veil : null;
      if (layer) {
        fillSprites(veil, layer, R, seed, Math.max(0.5, scale), anchor, false);
        applySprite(pool.veilMat, layer, R, SPRITE.cloud, 0, 0);
      } else veil.count = 0;
    }
    [moteA.current, moteB.current].forEach((mesh, k) => {
      if (!mesh) return;
      const layers = (env.motes ?? []).filter((m) => m.zone === zone);
      const layer = layers[k];
      if (layer) {
        fillSprites(mesh, layer, R, seed + 11 * (k + 1), scale, anchor, true);
        applySprite(pool.moteMats[k], layer, R, SPRITE[layer.shape], layer.stretch ?? 0, layer.shape === 'glint' ? 0.7 : layer.motion === 'wander' ? 0.5 : 0);
      } else mesh.count = 0;
    });
    const rocks = rocksRef.current;
    const shards = shardsRef.current;
    if (rocks && shards) {
      if (env.solids && zone === 'planet') {
        fillSolids(rocks, shards, env.solids, R, seed + 5, scale, anchor);
        const u = pool.solidMat.uniforms;
        u.uGlowColor.value.set(env.solids.glowColor);
        u.uGlow.value = env.solids.glow;
        u.uSpin.value = env.solids.spin;
        u.uCrystal.value = env.solids.kind === 'shards' ? 1 : 0;
        u.uSunDir.value.set(...sunDir);
      } else {
        rocks.count = 0;
        shards.count = 0;
      }
    }
    const rng = seededRandom(seed + 91);
    ribbonRefs.current.forEach((mesh, k) => {
      if (!mesh) return;
      const ribbon = env.ribbon && zone === 'ship' && scale > 0.5 && k < env.ribbon.count ? env.ribbon : null;
      mesh.visible = !!ribbon;
      if (!ribbon) return;
      const u = pool.ribbonMats[k].uniforms;
      u.uColorA.value.set(ribbon.colors[0]);
      u.uColorB.value.set(ribbon.colors[1]);
      u.uOpacity.value = ribbon.opacity;
      u.uHeight.value = 420 + ribbon.height * 340;
      u.uBase.value = 60 + rng() * 120;
      u.uWave.value = ribbon.wave;
      u.uArc.value = 1.3 + rng() * 0.6;
      u.uPhase.value = (k === 0 ? -1 : 1) * (0.95 + rng() * 0.35); // off to the sides, clear of the landing text
    });
  }, [spec, zone, index, sunDir, pool, anchor]);

  const hasFlash = !!spec.env.veil?.flash;
  useFrame((_, dt) => {
    const t = rt.time;
    const calm = rt.reducedMotion;
    // Storm light: at most two soft pulses a second, and none with reduced motion.
    let f = 0;
    if (hasFlash && !calm && zone === 'planet') {
      const slot = Math.floor(t * 0.4);
      const at = slot / 0.4 + ((Math.sin(slot * 12.9898) * 43758.5453) % 1 + 1) % 1 * 1.6;
      const since = t - at;
      if (since > 0 && Math.sin(slot * 78.233) > -0.2) f = 0.45 * Math.exp(-since * 4.5);
    }
    flash.current.value += (f - flash.current.value) * Math.min(1, dt * 14);
    const warp = rt.warp;
    const arrive = rt.arrive;
    const set = (m: ShaderMaterial) => {
      const u = m.uniforms;
      u.uTime.value = t;
      u.uWarp.value = warp;
      u.uArrive.value = arrive;
    };
    set(pool.veilMat);
    pool.veilMat.uniforms.uFlash.value = flash.current.value;
    pool.moteMats.forEach(set);
    set(pool.solidMat);
    pool.ribbonMats.forEach(set);
  });

  return (
    <group>
      <instancedMesh ref={veilRef} args={[pool.veilGeo, pool.veilMat, MAX_VEIL]} frustumCulled={false} />
      <instancedMesh ref={moteA} args={[pool.moteGeos[0], pool.moteMats[0], MAX_MOTES]} frustumCulled={false} />
      <instancedMesh ref={moteB} args={[pool.moteGeos[1], pool.moteMats[1], MAX_MOTES]} frustumCulled={false} />
      <instancedMesh ref={rocksRef} args={[pool.rockGeo, pool.solidMat, MAX_SOLIDS]} frustumCulled={false} />
      <instancedMesh ref={shardsRef} args={[pool.shardGeo, pool.solidMat, MAX_SOLIDS]} frustumCulled={false} />
      {[0, 1].map((k) => (
        <mesh key={k} ref={(m) => void (ribbonRefs.current[k] = m)} geometry={pool.ribbonGeo} material={pool.ribbonMats[k]} frustumCulled={false} visible={false} userData={{ world: 'ribbon' }} />
      ))}
    </group>
  );
}
