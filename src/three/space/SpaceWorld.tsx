import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  DoubleSide,
  Object3D,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Group,
  type InstancedMesh,
} from 'three';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';
import { NOISE_GLSL } from '../shaders/noise';
import { ASTEROIDS, HERO_DIR, MOONS, PLANET, RINGS, SUN_COLOR, SUN_DIR, SUN_POSITION } from './layout';

const sunDir = new Vector3(...SUN_DIR);

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

const PLANET_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uTime;
uniform float uArrive;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
${NOISE_GLSL}
void main() {
  vec3 p = vObj;
  float land = fbm3(p * 3.0);
  float bands = sin(p.y * 22.0 + fbm3(p * 2.0) * 3.0) * 0.5 + 0.5;
  vec3 ocean = mix(vec3(0.02, 0.10, 0.18), vec3(0.04, 0.22, 0.30), bands);
  vec3 ground = mix(vec3(0.20, 0.13, 0.28), vec3(0.55, 0.42, 0.30), smoothstep(0.1, 0.5, land));
  vec3 albedo = mix(ocean, ground, smoothstep(0.02, 0.08, land));
  float clouds = smoothstep(0.15, 0.6, fbm3(p * 5.0 + vec3(uTime * 0.01, 0.0, 0.0)));
  albedo = mix(albedo, vec3(0.85, 0.88, 0.95), clouds * 0.55);

  vec3 n = normalize(vNormalW);
  float ndl = dot(n, uSun);
  float day = smoothstep(-0.08, 0.35, ndl);
  vec3 col = albedo * max(ndl, 0.0) * 1.35;

  // Night side: a glowing neural network of city lights.
  float net = 1.0 - abs(snoise(p * 9.0));
  net = pow(net, 14.0) * smoothstep(0.0, 0.1, land);
  float nodes = pow(max(0.0, snoise(p * 40.0)), 8.0) * 3.0 * step(0.02, land);
  col += vec3(0.25, 0.9, 1.0) * (net * 1.6 + nodes) * (1.0 - day) * (1.0 - clouds * 0.7);

  // Atmosphere rim, brighter on the lit limb.
  vec3 v = normalize(cameraPosition - vPosW);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += vec3(0.35, 0.65, 1.0) * rim * (0.25 + 1.4 * smoothstep(-0.3, 0.6, ndl)) * (0.6 + 0.4 * uArrive);
  gl_FragColor = vec4(col, 1.0);
}`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uArrive;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vPosW);
  float f = pow(max(0.0, 1.0 + dot(n, v) * 1.05), 0.0) ;
  float rim = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 5.0);
  float lit = smoothstep(-0.4, 0.5, dot(n, uSun));
  gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * rim * lit * (0.8 + 0.6 * uArrive) * f, 1.0);
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
varying float vR;
varying vec3 vPosW;
${NOISE_GLSL}
void main() {
  float t = (vR - uInner) / (uOuter - uInner);
  float b = 0.55 + 0.45 * sin(t * 90.0) * sin(t * 23.0 + 1.0);
  b *= 0.6 + 0.4 * snoise(vec3(t * 40.0, 0.0, 0.0));
  float gap = smoothstep(0.42, 0.44, t) * (1.0 - smoothstep(0.47, 0.49, t));
  float edge = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.9, t);
  float a = clamp(b * edge * (1.0 - gap * 0.9), 0.0, 1.0) * 0.75;
  vec3 col = mix(vec3(0.75, 0.62, 0.55), vec3(0.55, 0.7, 0.9), t) * 0.9;
  gl_FragColor = vec4(col * a, a);
}`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.08, 'rgba(255,240,220,0.9)');
  grd.addColorStop(0.3, 'rgba(255,200,150,0.25)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

const dummy = new Object3D();

/** The new world — planet, rings, sun, moons and an asteroid scatter — composed around the parked ship. */
export default function SpaceWorld() {
  const world = useNova((s) => s.world);
  const planet = useRef<Group>(null);
  const rocks = useRef<InstancedMesh>(null);

  const mats = useMemo(() => {
    const uniforms = { uSun: { value: sunDir }, uTime: { value: 0 }, uArrive: { value: 0 } };
    return {
      planet: new ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, uniforms }),
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
        uniforms: { uInner: { value: RINGS.inner }, uOuter: { value: RINGS.outer } },
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        premultipliedAlpha: true,
      }),
      glow: glowTexture(),
    };
  }, []);

  const axisQuat = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...PLANET.axis)), []);

  useLayoutEffect(() => {
    const m = rocks.current;
    if (!m) return;
    const hero = new Vector3(...HERO_DIR);
    const v = new Vector3();
    let i = 0;
    let guard = 0;
    while (i < ASTEROIDS.count && guard++ < 10000) {
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
    mats.planet.uniforms.uTime.value = rt.time;
    mats.planet.uniforms.uArrive.value = rt.arrive;
    if (planet.current) planet.current.rotateOnAxis(new Vector3(0, 0, 1), PLANET.spin * dt);
    if (rocks.current) rocks.current.rotation.y += dt * 0.004;
  });

  return (
    <group visible={world === 'newworld'} userData={{ world: 'newworld' }}>
      <directionalLight color={SUN_COLOR} intensity={2.6} position={[SUN_DIR[0] * 10, SUN_DIR[1] * 10, SUN_DIR[2] * 10]} />
      <hemisphereLight args={['#6d5aa8', '#0b2530', 0.35]} />

      <group position={PLANET.position as [number, number, number]} quaternion={axisQuat}>
        <group ref={planet}>
          <mesh material={mats.planet}>
            <sphereGeometry args={[PLANET.radius, 128, 64]} />
          </mesh>
        </group>
        <mesh material={mats.halo}>
          <sphereGeometry args={[PLANET.haloRadius, 64, 32]} />
        </mesh>
        <mesh material={mats.ring}>
          <ringGeometry args={[RINGS.inner, RINGS.outer, 256, 1]} />
        </mesh>
      </group>

      {MOONS.map((m, i) => (
        <mesh key={i} position={m.position as [number, number, number]}>
          <sphereGeometry args={[m.radius, 48, 24]} />
          <meshStandardMaterial color={m.tint} roughness={0.95} />
        </mesh>
      ))}

      <Billboard position={SUN_POSITION as [number, number, number]}>
        <mesh>
          <planeGeometry args={[900, 900]} />
          <meshBasicMaterial map={mats.glow} color={new Color(SUN_COLOR).multiplyScalar(2.2)} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh scale={[6, 0.05, 1]}>
          <planeGeometry args={[900, 900]} />
          <meshBasicMaterial map={mats.glow} color={new Color('#9fd8ff').multiplyScalar(1.4)} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </Billboard>

      <instancedMesh ref={rocks} args={[undefined, undefined, ASTEROIDS.count]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#5b5560" roughness={0.95} flatShading />
      </instancedMesh>
    </group>
  );
}
