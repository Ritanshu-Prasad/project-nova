import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, ShaderMaterial, type Group } from 'three';
import { damp } from '../../core/math';
import { currentQuality, fbmDefines } from '../../core/graphics';
import { usePlanets } from '../../core/planets';
import { rt } from '../../core/runtime';
import { PLANETS } from './planets';
import { useNova } from '../../core/store';
import { NOISE_GLSL } from '../shaders/noise';
import { seededRandom } from '../../core/seeded';

const NEBULA_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const NEBULA_FRAG = /* glsl */ `
uniform float uWorld;
uniform float uWarp;
uniform vec3 uNebA;
uniform vec3 uNebB;
uniform vec3 uBand;
uniform float uNebAmt;
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 d = normalize(vDir);
  float n = fbm3(d * 2.2 + vec3(3.0, 1.0, 0.0));
  float m = fbm3(d * 4.5 + n);
  // Old world: cold, sparse.
  vec3 oldCol = vec3(0.01, 0.02, 0.04) + vec3(0.0, 0.05, 0.07) * smoothstep(0.1, 0.8, m) * 0.6;
  // New world: two nebula colours and a galactic band, different for every world (see worlds.ts).
  float bd = dot(d, normalize(vec3(0.35, 0.8, 0.45))) * 3.2;
  float band = exp(-bd * bd);
  vec3 newCol = vec3(0.012, 0.01, 0.03);
  newCol += uNebA * smoothstep(0.0, 0.9, n) * uNebAmt * 1.3;
  newCol += uNebB * smoothstep(0.2, 0.9, m) * uNebAmt * 1.15;
  newCol += uBand * band * (0.25 + 0.35 * m) * 0.9;
  // Keep the hero area (upper centre, looking -Z) calm and dark.
  newCol *= 1.0 - 0.55 * smoothstep(0.8, 0.98, dot(d, normalize(vec3(0.0, 0.32, -1.0))));
  vec3 col = mix(oldCol, newCol, uWorld) * (1.0 - 0.85 * smoothstep(0.35, 0.85, uWarp));
  gl_FragColor = vec4(col, 1.0);
  if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0);
}`;

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uTime;
varying vec3 vColor;
void main() {
  vColor = aColor * (0.75 + 0.25 * sin(uTime * (1.0 + aSize) + position.x));
  gl_PointSize = aSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const STAR_FRAG = /* glsl */ `
uniform float uWarp;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = (1.0 - smoothstep(0.0, 0.5, d)) * (1.0 - 0.85 * smoothstep(0.35, 0.85, uWarp));
  gl_FragColor = vec4(vColor * a, 1.0);
  if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0);
}`;

/** Camera-centred backdrop for both worlds: nebula sphere + twinkling stars. */
const target = new Color();
/** The sky around the dying sun: a bruised crimson and violet, with a glow of ember along the galactic band. */
const FINALE_SKY = { a: '#5a0a12', b: '#2a0a46', band: '#ff7a3a', amount: 0.95 };

export default function Sky() {
  const group = useRef<Group>(null);
  const world = useRef(0);

  const nebula = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: NEBULA_VERT,
        fragmentShader: NEBULA_FRAG,
        uniforms: { uWorld: { value: 0 }, uWarp: { value: 0 }, uNebA: { value: new Color('#2a1a5c') }, uNebB: { value: new Color('#0c4a5e') }, uBand: { value: new Color('#8f7fd6') }, uNebAmt: { value: 0.6 } },
        defines: fbmDefines(),
        side: BackSide,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );

  const stars = useMemo(() => {
    const random = seededRandom(101);
    const n = Math.round(5000 * currentQuality().particles);
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = random() * 2 - 1;
      const th = random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u) * 1500;
      pos.set([Math.cos(th) * r, u * 1500, Math.sin(th) * r], i * 3);
      const big = random() < 0.02;
      size[i] = big ? 3 + random() * 2.5 : 1 + random() * 1.6;
      const temp = random();
      const b = big ? 1.6 : 0.5 + random() * 0.6;
      col.set(temp < 0.3 ? [b, b * 0.85, b * 0.7] : temp < 0.7 ? [b, b, b] : [b * 0.7, b * 0.85, b], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    g.setAttribute('aColor', new BufferAttribute(col, 3));
    const m = new ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: { uTime: { value: 0 }, uWarp: { value: 0 } },
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return { g, m };
  }, []);

  useFrame(({ camera }, dt) => {
    if (group.current) camera.getWorldPosition(group.current.position);
    // Inside the warp tunnel the sky eases across to the new world; anywhere else (a replayed launch puts the pilot back
    // in the hangar) it switches at once, so the hangar never opens on a sky that is still changing.
    const st = useNova.getState();
    const wantWorld = st.world === 'newworld' ? 1 : 0;
    world.current = st.phase === 'warp' ? damp(world.current, wantWorld, 2.5, dt) : wantWorld;
    nebula.uniforms.uWorld.value = world.current;
    // The sky takes the colours of the world the ship is at, easing across during a jump; otherwise (the first frames after
    // a refresh, a replayed launch) it is simply that sky, with nothing visibly shifting.
    const sky = rt.finaleWorld ? FINALE_SKY : PLANETS[usePlanets.getState().index].sky;
    const k = st.phase === 'warp' || st.phase === 'arrive' ? 1 - Math.exp(-3 * dt) : 1;
    const u = nebula.uniforms;
    u.uNebA.value.lerp(target.set(sky.a), k);
    u.uNebB.value.lerp(target.set(sky.b), k);
    u.uBand.value.lerp(target.set(sky.band), k);
    u.uNebAmt.value += (sky.amount - u.uNebAmt.value) * k;
    nebula.uniforms.uWarp.value = rt.warp;
    stars.m.uniforms.uTime.value = rt.time;
    stars.m.uniforms.uWarp.value = rt.warp;
  });

  return (
    <group ref={group}>
      <mesh material={nebula} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[2000, 48, 24]} />
      </mesh>
      <points geometry={stars.g} material={stars.m} renderOrder={-9} frustumCulled={false} />
    </group>
  );
}
