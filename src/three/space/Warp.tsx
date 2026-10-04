import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, Color, Object3D, ShaderMaterial, type InstancedMesh, type Mesh } from 'three';
import { smoothstep } from '../../core/math';
import { rt } from '../../core/runtime';
import { NOISE_GLSL } from '../shaders/noise';

const COUNT = 700;
const NEAR = 20;
const FAR = -420;

const TUNNEL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const TUNNEL_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAmount;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  float a = vUv.x * 6.2831;
  float z = vUv.y * 12.0 + uTime * 9.0;
  float n = snoise(vec3(cos(a) * 1.5, sin(a) * 1.5, z));
  float streak = pow(max(0.0, n), 3.0) * 2.6 + 0.2 * snoise(vec3(cos(a) * 6.0, sin(a) * 6.0, z * 3.0));
  float rings = pow(0.5 + 0.5 * sin(vUv.y * 140.0 - uTime * 50.0), 24.0) * 0.6;
  vec3 col = mix(vec3(0.15, 0.8, 1.0), vec3(0.6, 0.25, 1.0), vUv.y) * (streak + rings);
  float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
  gl_FragColor = vec4(col * uAmount * fade, 1.0);
}`;

const dummy = new Object3D();

/** Ship-local warp: star streaks, a light tunnel and drifting space dust. */
export default function Warp() {
  const streaks = useRef<InstancedMesh>(null);
  const tunnel = useRef<Mesh>(null);
  const glow = useRef<Mesh>(null);

  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, () => {
        const a = Math.random() * Math.PI * 2;
        const r = 2 + Math.pow(Math.random(), 0.6) * 58;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r, z: FAR + Math.random() * (NEAR - FAR), s: 0.5 + Math.random() };
      }),
    [],
  );

  const tunnelMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: TUNNEL_VERT,
        fragmentShader: TUNNEL_FRAG,
        uniforms: { uTime: { value: 0 }, uAmount: { value: 0 } },
        side: BackSide,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  useLayoutEffect(() => {
    const m = streaks.current;
    if (!m) return;
    const c = new Color();
    seeds.forEach((_, i) => m.setColorAt(i, c.set(i % 7 === 0 ? '#c084fc' : i % 3 === 0 ? '#67e8f9' : '#e0f7ff')));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [seeds]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const w = rt.warp;
    const speed = 20 + w * 900 + rt.shipSpeed * 0.8;
    const len = 0.3 + w * 40 + rt.shipSpeed * 0.02;
    const m = streaks.current;
    if (m) {
      m.visible = w > 0.01 || rt.shipSpeed > 1;
      if (m.visible) {
        for (let i = 0; i < COUNT; i++) {
          const s = seeds[i];
          s.z += speed * s.s * dt;
          if (s.z > NEAR) s.z = FAR + Math.random() * 40;
          dummy.position.set(s.x, s.y, s.z);
          dummy.scale.set(1, 1, len * s.s);
          dummy.updateMatrix();
          m.setMatrixAt(i, dummy.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
        (m.material as { opacity: number }).opacity = Math.min(1, w * 1.6 + rt.shipSpeed / 400);
      }
    }
    tunnelMat.uniforms.uTime.value = rt.time;
    tunnelMat.uniforms.uAmount.value = smoothstep(0.45, 0.95, w) * 1.6;
    if (tunnel.current) tunnel.current.visible = w > 0.4;
    if (glow.current) {
      glow.current.visible = w > 0.05;
      glow.current.scale.setScalar(4 + 30 * w);
    }
  });

  return (
    <group>
      <instancedMesh ref={streaks} args={[undefined, undefined, COUNT]} frustumCulled={false}>
        <boxGeometry args={[0.06, 0.06, 1]} />
        <meshBasicMaterial transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <mesh ref={tunnel} material={tunnelMat} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -240]} frustumCulled={false}>
        <cylinderGeometry args={[14, 14, 500, 48, 1, true]} />
      </mesh>
      <mesh ref={glow} position={[0, 0, -300]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={new Color('#cdf6ff').multiplyScalar(3)} transparent opacity={0.9} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}
