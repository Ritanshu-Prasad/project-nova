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
import { currentQuality, fbmDefines } from '../../core/graphics';
import { usePlanets } from '../../core/planets';
import { rt } from '../../core/runtime';
import { useDeck } from '../../core/journey';
import { useNova } from '../../core/store';
import { NOISE_GLSL } from '../shaders/noise';
import { ASTEROIDS, HERO_DIR, SUN_DISTANCE, screenDir, type Vec3 } from './layout';
import { PLANETS, type PlanetSpec } from './planets';

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

/** One shader for every world: the palette, continents, ice, lava, lights and gas bands all come from uniforms (planets.ts). */
const PLANET_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uTime;
uniform float uArrive;
uniform vec3 uOcean0;
uniform vec3 uOcean1;
uniform vec3 uGround0;
uniform vec3 uGround1;
uniform vec3 uCloud;
uniform vec3 uAtmo;
uniform vec3 uLightColor;
uniform vec3 uLavaColor;
uniform float uLandScale;
uniform float uSea;
uniform float uBandFreq;
uniform float uCloudAmt;
uniform float uCloudScale;
uniform float uLights;
uniform float uLava;
uniform float uIce;
uniform float uGas;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
${NOISE_GLSL}
void main() {
  vec3 p = vObj;
  float land = fbm3(p * uLandScale);
  float bands = sin(p.y * uBandFreq + fbm3(p * 2.0) * 3.0) * 0.5 + 0.5;
  vec3 ocean = mix(uOcean0, uOcean1, bands);
  vec3 ground = mix(uGround0, uGround1, smoothstep(0.1, 0.5, land));
  float isLand = smoothstep(uSea, uSea + 0.06, land);
  vec3 albedo = mix(ocean, ground, isLand);

  // Frozen crust: a pale coat over land and sea, cut by dark cracks.
  float crack = pow(1.0 - abs(snoise(p * 7.0 + 1.7)), 12.0);
  albedo = mix(albedo, vec3(0.88, 0.94, 1.0), uIce * (0.35 + 0.65 * smoothstep(-0.1, 0.4, land)));
  albedo *= 1.0 - uIce * crack * 0.55;

  // Lava: glowing veins across the land and lakes where the sea would be.
  float vein = pow(1.0 - abs(snoise(p * 4.5 + fbm3(p * 2.5))), 9.0);
  vec3 lavaGlow = uLavaColor * uLava * (vein * 1.8 + (1.0 - isLand) * 0.8 * (0.6 + 0.4 * bands));

  // Gas giant: storm bands stirred by turbulence, and a great vortex.
  if (uGas > 0.5) {
    float turb = fbm3(vec3(p.x * 2.5, p.y * 7.0, p.z * 2.5) + vec3(uTime * 0.004, 0.0, 0.0));
    float b = sin(p.y * uBandFreq + turb * 5.0) * 0.5 + 0.5;
    albedo = mix(uGround0, uGround1, b);
    albedo = mix(albedo, uOcean0, smoothstep(0.35, 0.9, fbm3(vec3(p.x * 3.0, p.y * 16.0, p.z * 3.0))) * 0.55);
    float vd = distance(p, normalize(vec3(0.62, -0.28, 0.73)));
    albedo = mix(albedo, uOcean1, smoothstep(0.30, 0.06, vd) * 0.85);
    albedo = mix(albedo, uGround1 * 1.1, smoothstep(0.16, 0.02, vd) * 0.5);
    isLand = 1.0;
  }

  float clouds = smoothstep(0.15, 0.6, fbm3(p * uCloudScale + vec3(uTime * 0.01, 0.0, 0.0))) * uCloudAmt;
  albedo = mix(albedo, uCloud, clouds);

  vec3 n = normalize(vNormalW);
  float ndl = dot(n, uSun);
  float day = smoothstep(-0.08, 0.35, ndl);
  vec3 col = albedo * max(ndl, 0.0) * 1.35;
  col += lavaGlow * (0.6 + 0.4 * (1.0 - day)) * (1.0 - clouds);

  // Night side: a glowing network of city lights.
  float net = 1.0 - abs(snoise(p * 9.0));
  net = pow(net, 14.0) * smoothstep(0.0, 0.1, land);
  float nodes = pow(max(0.0, snoise(p * 40.0)), 8.0) * 3.0 * step(0.02, land);
  col += uLightColor * (net * 1.6 + nodes) * (1.0 - day) * (1.0 - clouds * 0.7) * uLights;

  // Atmosphere rim, brighter on the lit limb.
  vec3 v = normalize(cameraPosition - vPosW);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += uAtmo * rim * (0.25 + 1.4 * smoothstep(-0.3, 0.6, ndl)) * (0.6 + 0.4 * uArrive);
  gl_FragColor = vec4(col, 1.0);
}`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uAtmo;
uniform float uArrive;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vPosW);
  float rim = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 5.0);
  float lit = smoothstep(-0.4, 0.5, dot(n, uSun));
  gl_FragColor = vec4(uAtmo * rim * lit * (0.8 + 0.6 * uArrive), 1.0);
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
varying float vR;
varying vec3 vPosW;
${NOISE_GLSL}
void main() {
  float t = (vR - uInner) / (uOuter - uInner);
  float b = 0.55 + 0.45 * sin(t * 90.0) * sin(t * 23.0 + 1.0);
  b *= 0.6 + 0.4 * snoise(vec3(t * 40.0, 0.0, 0.0));
  float gap = smoothstep(0.42, 0.44, t) * (1.0 - smoothstep(0.47, 0.49, t));
  float edge = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.9, t);
  float a = clamp(b * edge * (1.0 - gap * 0.9), 0.0, 1.0) * uRingAlpha;
  vec3 col = mix(uRingA, uRingB, t) * 0.9;
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
  return {
    position: scale(dir, spec.distance),
    quaternion: new Quaternion().setFromUnitVectors(spinAxis, new Vector3(...ringAxis(dir, spec.roll, spec.open))),
    sunDir,
    sunPosition: scale(sunDir, SUN_DISTANCE),
  };
}

/** The world the ship is at (one of six, see planets.ts) — planet, rings, sun, moons and an asteroid scatter — composed around the parked ship. */
export default function SpaceWorld() {
  const world = useNova((s) => s.world);
  const index = usePlanets((s) => s.index);
  const spec = PLANETS[index];
  // Sunlight would flood the interior once the pilot is inside the ship.
  const indoors = useDeck((s) => s.deck === 'lounge');
  const planet = useRef<Group>(null);
  const rocks = useRef<InstancedMesh>(null);

  const mats = useMemo(() => {
    const color = () => ({ value: new Color() });
    const uniforms = {
      uSun: { value: new Vector3() },
      uTime: { value: 0 },
      uArrive: { value: 0 },
      uOcean0: color(), uOcean1: color(), uGround0: color(), uGround1: color(), uCloud: color(), uAtmo: color(), uLightColor: color(), uLavaColor: color(),
      uLandScale: { value: 3 }, uSea: { value: 0 }, uBandFreq: { value: 20 }, uCloudAmt: { value: 0.5 }, uCloudScale: { value: 5 },
      uLights: { value: 0 }, uLava: { value: 0 }, uIce: { value: 0 }, uGas: { value: 0 },
    };
    const ringUniforms = { uInner: { value: 1 }, uOuter: { value: 2 }, uRingA: color(), uRingB: color(), uRingAlpha: { value: 0.7 } };
    return {
      uniforms,
      ringUniforms,
      planet: new ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, uniforms, defines: fbmDefines() }),
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
    };
  }, []);

  const where = useMemo(() => layoutOf(spec), [spec]);

  // Switching world only rewrites the uniforms — the shaders are compiled once. (It happens while the warp tunnel is opaque.)
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
    uniforms.uLandScale.value = l.landScale;
    uniforms.uSea.value = l.sea;
    uniforms.uBandFreq.value = l.bandFreq;
    uniforms.uCloudAmt.value = l.cloudAmt;
    uniforms.uCloudScale.value = l.cloudScale;
    uniforms.uLights.value = l.lights;
    uniforms.uLava.value = l.lava;
    uniforms.uIce.value = l.ice;
    uniforms.uGas.value = l.gas ? 1 : 0;
    if (spec.ring) {
      ringUniforms.uInner.value = spec.radius * spec.ring.inner;
      ringUniforms.uOuter.value = spec.radius * spec.ring.outer;
      ringUniforms.uRingA.value.set(spec.ring.colorA);
      ringUniforms.uRingB.value.set(spec.ring.colorB);
      ringUniforms.uRingAlpha.value = spec.ring.opacity;
    }
  }, [mats, spec, where]);

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
    mats.uniforms.uTime.value = rt.time;
    mats.uniforms.uArrive.value = rt.arrive;
    if (planet.current) planet.current.rotateOnAxis(spinAxis, spec.spin * dt);
    if (rocks.current) rocks.current.rotation.y += dt * 0.004;
  });

  const sunLight = new Color(spec.sunColor);
  return (
    <group visible={world === 'newworld'} userData={{ world: 'newworld' }}>
      <directionalLight color={spec.sunColor} intensity={indoors ? 0 : 2.6} position={[where.sunDir[0] * 10, where.sunDir[1] * 10, where.sunDir[2] * 10]} />
      <hemisphereLight args={['#6d5aa8', '#0b2530', indoors ? 0 : 0.35]} />

      <group position={where.position as [number, number, number]} quaternion={where.quaternion}>
        <group ref={planet}>
          <mesh material={mats.planet} scale={spec.radius}>
            <sphereGeometry args={[1, 128, 64]} />
          </mesh>
        </group>
        <mesh material={mats.halo} scale={spec.radius * 1.12}>
          <sphereGeometry args={[1, 64, 32]} />
        </mesh>
        {spec.ring && (
          <mesh material={mats.ring}>
            <ringGeometry args={[spec.radius * spec.ring.inner, spec.radius * spec.ring.outer, 256, 1]} />
          </mesh>
        )}
      </group>

      {spec.moons.map((m, i) => (
        <mesh key={`${spec.name}-${i}`} position={m.position as [number, number, number]}>
          <sphereGeometry args={[m.radius, 48, 24]} />
          <meshStandardMaterial color={m.tint} roughness={0.95} />
        </mesh>
      ))}

      <Billboard position={where.sunPosition as [number, number, number]}>
        <mesh>
          <planeGeometry args={[900, 900]} />
          <meshBasicMaterial map={mats.glow} color={sunLight.clone().multiplyScalar(2.2)} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh scale={[6, 0.05, 1]}>
          <planeGeometry args={[900, 900]} />
          <meshBasicMaterial map={mats.glow} color={new Color('#9fd8ff').multiplyScalar(1.4)} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </Billboard>

      <instancedMesh ref={rocks} args={[undefined, undefined, Math.round(ASTEROIDS.count * currentQuality().particles)]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#5b5560" roughness={0.95} flatShading />
      </instancedMesh>
    </group>
  );
}
