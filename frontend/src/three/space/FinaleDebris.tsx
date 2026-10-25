import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, DoubleSide, IcosahedronGeometry, InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, PlaneGeometry, ShaderMaterial, Vector3, type Group, type Mesh } from 'three';
import { currentQuality } from '../../core/graphics';
import { smoothstep } from '../../core/math';
import { rt } from '../../core/runtime';
import { seededRandom } from '../../core/seeded';
import { useNova } from '../../core/store';
import { DYING, DYING_COLORS } from './finaleWorld';
import { spriteAtlas } from './textures';
import { NEAR_FACTOR, starShown, worldTravel } from './transition';

/**
 * The near field of the finale: glowing nebula clouds drifting in front of the window and a field of tumbling rocks. They
 * arrive with the ship, and when the star goes off the blast wave throws all of it outwards and past the ship. Every bit of
 * the motion is computed on the GPU from two numbers (the clock and the seconds since the blast), so it costs one draw call
 * per kind and stays smooth.
 */

const COMMON = /* glsl */ `
float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
// How far the wave has thrown things: 0 before the blast, then an accelerating push.
float thrown(float blast, float seed) {
  float k = smoothstep(0.0, 2.4, blast);
  return k * k * (0.55 + hash(seed));
}
`;

const CLOUD_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aData; // size, seed
attribute vec3 aColor;
uniform float uT;
uniform float uBlast;
varying vec2 vUv;
varying vec3 vColor;
varying float vFade;
varying float vSeed;
${COMMON}
void main() {
  float size = aData.x;
  float seed = aData.y;
  vec3 p = aPos;
  p.x += sin(uT * 0.07 + seed * 6.0) * 14.0;
  p.y += cos(uT * 0.05 + seed * 9.0) * 8.0;
  float k = thrown(uBlast, seed);
  vec3 dir = normalize(vec3(p.xy, 0.0) + vec3(0.001, 0.001, 0.0));
  p += (dir * 700.0 + vec3(0.0, 0.0, 380.0)) * k;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * size * (1.0 + 0.7 * k);
  vUv = uv;
  vColor = aColor;
  vSeed = seed;
  vFade = 1.0 - smoothstep(1.1, 3.4, uBlast);
  gl_Position = projectionMatrix * mv;
}`;

const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uOpacity;
uniform float uT;
varying vec2 vUv;
varying vec3 vColor;
varying float vFade;
varying float vSeed;
void main() {
  vec2 c = vUv - 0.5;
  float a = vSeed * 6.2831 + uT * 0.02 * (vSeed - 0.5);
  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * c + 0.5;
  float inside = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  vec4 tex = texture2D(uMap, vec2(q.x * 0.25, q.y)); // the cloud tile is the first quarter of the sprite sheet
  float al = tex.a * inside * uOpacity * vFade * 0.78;
  if (al < 0.004) discard;
  gl_FragColor = vec4(vColor * (0.65 + 0.5 * tex.r), al);
  if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0);
}`;

const ROCK_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aData; // size, seed, spin rate, drift
attribute vec3 aAxis;
uniform float uT;
uniform float uBlast;
varying vec3 vView;
varying float vFade;
${COMMON}
vec3 rotate(vec3 v, vec3 axis, float ang) {
  float c = cos(ang), s = sin(ang);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}
void main() {
  float size = aData.x;
  float seed = aData.y;
  float k = thrown(uBlast, seed);
  float ang = uT * aData.z + seed * 40.0 + k * 9.0; // tumbles faster once it has been hit
  vec3 local = rotate(position * size, normalize(aAxis), ang);
  vec3 p = aPos + vec3(sin(uT * 0.11 + seed * 20.0), cos(uT * 0.09 + seed * 11.0), 0.0) * aData.w;
  vec3 dir = normalize(vec3(p.xy, 0.0) + vec3(0.001, 0.001, 0.0));
  p += (dir * 950.0 + vec3(0.0, 0.0, 520.0)) * k;
  vec4 mv = modelViewMatrix * vec4(p + local, 1.0);
  vView = mv.xyz;
  vFade = 1.0 - smoothstep(1.9, 3.6, uBlast);
  gl_Position = projectionMatrix * mv;
}`;

const ROCK_FRAG = /* glsl */ `
uniform vec3 uStar;
uniform vec3 uEmber;
uniform float uOpacity;
varying vec3 vView;
varying float vFade;
void main() {
  vec3 n = normalize(cross(dFdx(vView), dFdy(vView))); // flat facets
  vec3 L = normalize((viewMatrix * vec4(uStar, 1.0)).xyz - vView);
  vec3 V = normalize(-vView);
  float diff = max(dot(n, L), 0.0);
  float rim = pow(1.0 - abs(dot(n, V)), 2.0);
  vec3 col = vec3(0.05, 0.035, 0.045) + uEmber * (0.5 * diff + 0.45 * rim);
  float al = uOpacity * vFade;
  if (al < 0.01) discard;
  gl_FragColor = vec4(col, al);
  if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0);
}`;

// The blast front: debris leaves the star and hurtles at the ship, missing it by a few metres, so the biggest pieces sweep past
// the window close enough to fill it. Each piece has its own delay and flight time.
const STORM_COMMON = /* glsl */ `
uniform vec3 uStar;
uniform float uT;
uniform float uBlast;
${COMMON}
vec3 stormStart(float seed) {
  return uStar + vec3((hash(seed * 5.1) - 0.5) * 520.0, (hash(seed * 7.3) - 0.5) * 320.0, (hash(seed * 9.9) - 0.5) * 220.0);
}
float stormU(float seed, float delay, float base, float spread) {
  return (uBlast - delay) / (base + hash(seed * 3.7) * spread);
}
`;

const STORM_ROCK_VERT = /* glsl */ `
attribute vec3 aPos;  // where it crosses the ship's plane (x, y)
attribute vec4 aData; // size, seed, spin rate, delay
attribute vec3 aAxis;
varying vec3 vView;
varying float vFade;
${STORM_COMMON}
vec3 rotate(vec3 v, vec3 axis, float ang) {
  float c = cos(ang), s = sin(ang);
  return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}
void main() {
  float seed = aData.y;
  float u = stormU(seed, aData.w, 1.5, 1.1);
  float e = pow(clamp(u, 0.0, 1.0), 1.9);
  vec3 p = mix(stormStart(seed), vec3(aPos.xy, 40.0), e);
  float ang = uT * aData.z + seed * 40.0 + u * 14.0;
  vec3 local = rotate(position * aData.x, normalize(aAxis), ang);
  vec4 mv = modelViewMatrix * vec4(p + local, 1.0);
  vView = mv.xyz;
  float vis = step(0.0, u) * step(u, 1.0);
  vFade = vis;
  gl_Position = vis > 0.5 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const STREAK_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aData; // width, seed, -, delay
varying vec2 vUv;
varying float vVis;
${STORM_COMMON}
void main() {
  float seed = aData.y;
  float u = stormU(seed, aData.w, 1.2, 0.9);
  vec3 start = stormStart(seed);
  vec3 target = vec3(aPos.xy, 40.0);
  vec3 pa = mix(start, target, pow(clamp(u, 0.0, 1.0), 1.7));
  vec3 pb = mix(start, target, pow(clamp(u - 0.07, 0.0, 1.0), 1.7));
  vec4 ca = projectionMatrix * modelViewMatrix * vec4(pa, 1.0);
  vec4 cb = projectionMatrix * modelViewMatrix * vec4(pb, 1.0);
  vec2 na = ca.xy / ca.w;
  vec2 nb = cb.xy / cb.w;
  vec2 d = na - nb;
  float l = length(d);
  vec2 dir = l > 1e-5 ? d / l : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float t = position.x + 0.5; // 0 at the head, 1 at the tail
  float len = clamp(l * 3.2, 0.015, 0.7);
  vec2 ndc = na - dir * len * t + nrm * position.y * aData.x * (1.0 - 0.7 * t);
  vUv = vec2(t, position.y * 2.0);
  vVis = step(0.0, u) * step(u, 1.0) * step(0.0, ca.w);
  gl_Position = vVis > 0.5 ? vec4(ndc * ca.w, ca.z, ca.w) : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const STREAK_FRAG = /* glsl */ `
uniform vec3 uEmber;
uniform float uOpacity;
varying vec2 vUv;
varying float vVis;
void main() {
  float along = 1.0 - vUv.x;
  float across = 1.0 - abs(vUv.y);
  float al = along * along * smoothstep(0.0, 0.5, across) * uOpacity * vVis;
  if (al < 0.004) discard;
  vec3 col = mix(uEmber * 1.2, vec3(1.0, 0.93, 0.75), along);
  gl_FragColor = vec4(col * 1.7, al);
  if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0);
}`;

const CLOUD_COLORS = ['#ff5a2a', '#c0391f', '#8a3aa8', '#1a0a14', '#ff9a4a', '#7a2a4a', '#4a2a7a', '#12060e']; // the near-black ones are dust lanes: they give the glowing ones something to stand against

export default function FinaleDebris() {
  const group = useRef<Group>(null);
  const clouds = useRef<InstancedMesh>(null);
  const rocks = useRef<InstancedMesh>(null);
  const stormRef = useRef<Mesh>(null);
  const streakRef = useRef<InstancedMesh>(null);

  const res = useMemo(() => {
    const q = currentQuality().particles;
    const nCloud = Math.max(10, Math.round(26 * q));
    const nRock = Math.max(36, Math.round(110 * q));
    const rnd = seededRandom(515);

    const cloudGeo = new PlaneGeometry(1, 1);
    const cPos = new Float32Array(nCloud * 3);
    const cData = new Float32Array(nCloud * 4);
    const cCol = new Float32Array(nCloud * 3);
    const tint = new Color();
    for (let i = 0; i < nCloud; i++) {
      const z = -(80 + Math.pow(rnd(), 1.2) * 360);
      const halfH = -z * 0.67;
      // Favour the edges of the window so the star stays clear, with a few wisps across the middle.
      const side = rnd() < 0.9 ? (rnd() < 0.5 ? -1 : 1) : 0;
      const x = side ? side * halfH * (0.9 + rnd() * 1.3) : (rnd() * 2 - 1) * halfH * 0.7;
      const y = (rnd() * 2 - 1) * halfH * 0.95;
      cPos.set([x, y, z], i * 3);
      cData.set([-z * (0.7 + rnd() * 0.8), rnd(), 0, 0], i * 4);
      tint.set(CLOUD_COLORS[i % CLOUD_COLORS.length]);
      cCol.set([tint.r, tint.g, tint.b], i * 3);
    }
    cloudGeo.setAttribute('aPos', new InstancedBufferAttribute(cPos, 3));
    cloudGeo.setAttribute('aData', new InstancedBufferAttribute(cData, 4));
    cloudGeo.setAttribute('aColor', new InstancedBufferAttribute(cCol, 3));

    // Rocks: a rough icosahedron, each vertex pushed in or out a little so no two facets match.
    const rockGeo = new IcosahedronGeometry(1, 1);
    const pos = rockGeo.attributes.position;
    const bump = new Map<string, number>();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      if (!bump.has(key)) bump.set(key, 0.72 + rnd() * 0.5);
      const k = bump.get(key)!;
      pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
    }
    const rPos = new Float32Array(nRock * 3);
    const rData = new Float32Array(nRock * 4);
    const rAxis = new Float32Array(nRock * 3);
    for (let i = 0; i < nRock; i++) {
      // A few drift right beside the ship, so the blast has something to throw past the window.
      const near = i % 8 === 0;
      const z = near ? -(11 + rnd() * 30) : -(55 + Math.pow(rnd(), 1.3) * 260);
      const halfH = -z * 0.67;
      rPos.set([(rnd() * 2 - 1) * halfH * 1.9, (rnd() * 2 - 1) * halfH, z], i * 3);
      rData.set([near ? 0.3 + rnd() * 1.1 : 0.45 + Math.pow(rnd(), 2.4) * 3.4, rnd(), (rnd() - 0.5) * 0.9, 1 + rnd() * 5], i * 4);
      const a = rnd() * Math.PI * 2;
      const b = Math.acos(2 * rnd() - 1);
      rAxis.set([Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b)], i * 3);
    }
    rockGeo.setAttribute('aPos', new InstancedBufferAttribute(rPos, 3));
    rockGeo.setAttribute('aData', new InstancedBufferAttribute(rData, 4));
    rockGeo.setAttribute('aAxis', new InstancedBufferAttribute(rAxis, 3));

    // The storm: rocks and streaks, each aimed at a point beside the ship, none of them at the ship itself.
    const nStorm = Math.max(24, Math.round(70 * q));
    const nStreak = Math.max(80, Math.round(260 * q));
    const miss = (min: number, max: number) => {
      const a = rnd() * Math.PI * 2;
      const r = min + rnd() * (max - min);
      return [Math.cos(a) * r * 1.4, Math.sin(a) * r];
    };
    const stormGeo = new InstancedBufferGeometry();
    stormGeo.index = rockGeo.index;
    stormGeo.setAttribute('position', rockGeo.attributes.position);
    stormGeo.instanceCount = nStorm;
    const sPos = new Float32Array(nStorm * 3);
    const sData = new Float32Array(nStorm * 4);
    const sAxis = new Float32Array(nStorm * 3);
    for (let i = 0; i < nStorm; i++) {
      const [x, y] = miss(7, 70);
      sPos.set([x, y, 0], i * 3);
      sData.set([1.1 + Math.pow(rnd(), 2) * 5.2, rnd(), (rnd() - 0.5) * 1.6, rnd() * 1.1], i * 4);
      const a = rnd() * Math.PI * 2;
      const b = Math.acos(2 * rnd() - 1);
      sAxis.set([Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b)], i * 3);
    }
    stormGeo.setAttribute('aPos', new InstancedBufferAttribute(sPos, 3));
    stormGeo.setAttribute('aData', new InstancedBufferAttribute(sData, 4));
    stormGeo.setAttribute('aAxis', new InstancedBufferAttribute(sAxis, 3));

    const streakGeo = new PlaneGeometry(1, 1);
    const kPos = new Float32Array(nStreak * 3);
    const kData = new Float32Array(nStreak * 4);
    for (let i = 0; i < nStreak; i++) {
      const [x, y] = miss(4, 150);
      kPos.set([x, y, 0], i * 3);
      kData.set([0.0016 + rnd() * 0.0034, rnd(), 0, rnd() * 1.5], i * 4);
    }
    streakGeo.setAttribute('aPos', new InstancedBufferAttribute(kPos, 3));
    streakGeo.setAttribute('aData', new InstancedBufferAttribute(kData, 4));

    const atlas = spriteAtlas();
    const shared = () => ({ uT: { value: 0 }, uBlast: { value: -1 }, uOpacity: { value: 0 } });
    const cloudMat = new ShaderMaterial({ vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, uniforms: { ...shared(), uMap: { value: atlas } }, transparent: true, depthWrite: false, side: DoubleSide });
    const rockMat = new ShaderMaterial({ vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG, uniforms: { ...shared(), uStar: { value: new Vector3(...DYING.position) }, uEmber: { value: new Color(DYING_COLORS.body) } }, transparent: true });
    const stormUniforms = () => ({ ...shared(), uStar: { value: new Vector3(...DYING.position) }, uEmber: { value: new Color(DYING_COLORS.body) } });
    const stormMat = new ShaderMaterial({ vertexShader: STORM_ROCK_VERT, fragmentShader: ROCK_FRAG, uniforms: stormUniforms(), transparent: true });
    const streakMat = new ShaderMaterial({ vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, uniforms: stormUniforms(), transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
    return { cloudGeo, rockGeo, stormGeo, streakGeo, atlas, cloudMat, rockMat, stormMat, streakMat, nCloud, nRock, nStreak };
  }, []);
  useEffect(
    () => () => {
      res.cloudGeo.dispose();
      res.rockGeo.dispose();
      res.stormGeo.dispose();
      res.streakGeo.dispose();
      res.atlas.dispose();
      res.cloudMat.dispose();
      res.rockMat.dispose();
      res.stormMat.dispose();
      res.streakMat.dispose();
    },
    [res],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const phase = useNova.getState().phase;
    const on = rt.finaleWorld && starShown(phase);
    g.visible = on;
    if (!on) return;
    const calm = rt.reducedMotion;
    const blast = rt.novaOn ? rt.novaT - rt.novaBlastAt : -1;
    const thrownBy = blast < 0 ? -1 : calm ? Math.min(blast, 1.2) : blast; // reduced motion: the wave only dims things, nothing is hurled
    const appear = smoothstep(0.05, 0.9, rt.arrive);
    const travel = worldTravel(phase, rt.phaseTime, calm);
    // The near field comes in with the ship, a little faster than the star (like the rocks of a planet jump).
    g.position.set(0, 0, travel * NEAR_FACTOR);
    for (const m of [res.cloudMat, res.rockMat]) {
      m.uniforms.uT.value = rt.time;
      m.uniforms.uBlast.value = thrownBy;
      m.uniforms.uOpacity.value = appear;
    }
    // The storm only exists once the star has gone off (and not at all with reduced motion).
    const storm = !calm && blast > -0.2;
    if (stormRef.current) stormRef.current.visible = storm;
    if (streakRef.current) streakRef.current.visible = storm;
    for (const m of [res.stormMat, res.streakMat]) {
      m.uniforms.uT.value = rt.time;
      m.uniforms.uBlast.value = blast;
      m.uniforms.uOpacity.value = 1;
    }
  });

  return (
    <group ref={group} visible={false} userData={{ world: 'finale' }}>
      <instancedMesh ref={clouds} args={[res.cloudGeo, res.cloudMat, res.nCloud]} frustumCulled={false} renderOrder={4} />
      <instancedMesh ref={rocks} args={[res.rockGeo, res.rockMat, res.nRock]} frustumCulled={false} renderOrder={5} />
      <mesh ref={stormRef} geometry={res.stormGeo} material={res.stormMat} frustumCulled={false} renderOrder={6} visible={false} />
      <instancedMesh ref={streakRef} args={[res.streakGeo, res.streakMat, res.nStreak]} frustumCulled={false} renderOrder={7} visible={false} />
    </group>
  );
}
