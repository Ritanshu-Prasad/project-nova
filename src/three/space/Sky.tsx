import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, ShaderMaterial, type Group } from 'three';
import { damp } from '../../core/math';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';
import { NOISE_GLSL } from '../shaders/noise';

const NEBULA_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const NEBULA_FRAG = /* glsl */ `
uniform float uWorld;
uniform float uWarp;
varying vec3 vDir;
${NOISE_GLSL}
void main() {
  vec3 d = normalize(vDir);
  float n = fbm3(d * 2.2 + vec3(3.0, 1.0, 0.0));
  float m = fbm3(d * 4.5 + n);
  // Old world: cold, sparse.
  vec3 oldCol = vec3(0.01, 0.02, 0.04) + vec3(0.0, 0.05, 0.07) * smoothstep(0.1, 0.8, m) * 0.6;
  // New world: violet/magenta/teal clouds and a galactic band.
  float bd = dot(d, normalize(vec3(0.35, 0.8, 0.45))) * 3.2;
  float band = exp(-bd * bd);
  vec3 newCol = vec3(0.012, 0.01, 0.03);
  newCol += vec3(0.32, 0.08, 0.42) * smoothstep(0.0, 0.9, n) * 0.55;
  newCol += vec3(0.05, 0.28, 0.33) * smoothstep(0.2, 0.9, m) * 0.45;
  newCol += vec3(0.4, 0.32, 0.5) * band * (0.25 + 0.35 * m);
  // Keep the hero area (upper centre, looking -Z) calm and dark.
  newCol *= 1.0 - 0.55 * smoothstep(0.8, 0.98, dot(d, normalize(vec3(0.0, 0.32, -1.0))));
  vec3 col = mix(oldCol, newCol, uWorld) * (1.0 - 0.5 * uWarp);
  gl_FragColor = vec4(col, 1.0);
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
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * a, 1.0);
}`;

/** Camera-centred backdrop for both worlds: nebula sphere + twinkling stars. */
export default function Sky() {
  const group = useRef<Group>(null);
  const world = useRef(0);

  const nebula = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: NEBULA_VERT,
        fragmentShader: NEBULA_FRAG,
        uniforms: { uWorld: { value: 0 }, uWarp: { value: 0 } },
        side: BackSide,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );

  const stars = useMemo(() => {
    const n = 5000;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u) * 1500;
      pos.set([Math.cos(th) * r, u * 1500, Math.sin(th) * r], i * 3);
      const big = Math.random() < 0.02;
      size[i] = big ? 3 + Math.random() * 2.5 : 1 + Math.random() * 1.6;
      const temp = Math.random();
      const b = big ? 1.6 : 0.5 + Math.random() * 0.6;
      col.set(temp < 0.3 ? [b, b * 0.85, b * 0.7] : temp < 0.7 ? [b, b, b] : [b * 0.7, b * 0.85, b], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    g.setAttribute('aColor', new BufferAttribute(col, 3));
    const m = new ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: { uTime: { value: 0 } },
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return { g, m };
  }, []);

  useFrame(({ camera }, dt) => {
    if (group.current) camera.getWorldPosition(group.current.position);
    world.current = damp(world.current, useNova.getState().world === 'newworld' ? 1 : 0, 2.5, dt);
    nebula.uniforms.uWorld.value = world.current;
    nebula.uniforms.uWarp.value = rt.warp;
    stars.m.uniforms.uTime.value = rt.time;
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
