import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BackSide, Color, ShaderMaterial, type InstancedMesh, type Mesh } from 'three';
import { currentQuality } from '../../core/graphics';
import { smoothstep } from '../../core/math';
import { rt } from '../../core/runtime';
import { seededRandom } from '../../core/seeded';

/** Streaks at full detail; fewer on lighter graphics levels. */
const MAX_STREAKS = 700;
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
uniform float uTint;
varying vec2 vUv;

void main() {
  float a = vUv.x * 6.2831853;
  float z = vUv.y * 18.0 - uTime * 14.0;
  
  // Fast high-speed energy streaks along tunnel cylinder
  float streak1 = sin(a * 12.0 + z * 2.0) * sin(a * 6.0 - z * 3.5);
  float streak2 = cos(a * 24.0 + z * 5.0) * sin(a * 8.0 + uTime * 8.0);
  float streak = pow(clamp(0.5 + 0.5 * (streak1 * 0.7 + streak2 * 0.3), 0.0, 1.0), 4.5) * 4.2;
  
  // Hyperspace energy compression rings
  float rings = pow(0.5 + 0.5 * sin(vUv.y * 130.0 - uTime * 44.0), 20.0) * 0.85;
  float microRings = pow(0.5 + 0.5 * sin(vUv.y * 280.0 - uTime * 70.0), 12.0) * 0.35;
  
  // The flight to the dying sun burns ember-red instead of cyan and violet.
  vec3 colCyan = mix(vec3(0.18, 0.88, 1.0), vec3(1.0, 0.45, 0.12), uTint);
  vec3 colViolet = mix(vec3(0.72, 0.24, 1.0), vec3(0.9, 0.12, 0.2), uTint);
  vec3 colCore = mix(vec3(0.95, 0.98, 1.0), vec3(1.0, 0.92, 0.8), uTint);
  
  vec3 col = mix(colCyan, colViolet, vUv.y);
  col += colCore * (pow(rings, 2.0) * 1.2);
  col *= (streak + rings + microRings);
  
  float fade = smoothstep(0.0, 0.22, vUv.y) * (1.0 - smoothstep(0.70, 1.0, vUv.y));
  gl_FragColor = vec4(col * uAmount * fade, 1.0);
  if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0);
}`;

/** Ship-local warp: star streaks and energetic light tunnel. */
export default function Warp() {
  const COUNT = useMemo(() => Math.max(60, Math.round(MAX_STREAKS * currentQuality().warp)), []);
  const streaks = useRef<InstancedMesh>(null);
  const tunnel = useRef<Mesh>(null);

  const seeds = useMemo(
    () => {
      const random = seededRandom(202);
      return Array.from({ length: COUNT }, () => {
        const a = random() * Math.PI * 2;
        const r = 2 + Math.pow(random(), 0.6) * 58;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r, z: FAR + random() * (NEAR - FAR), s: 0.5 + random() };
      });
    },
    [COUNT],
  );

  const tunnelMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: TUNNEL_VERT,
        fragmentShader: TUNNEL_FRAG,
        uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uTint: { value: 0 } },
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
    seeds.forEach((s, i) => {
      m.setColorAt(i, c.set(i % 7 === 0 ? '#c084fc' : i % 3 === 0 ? '#67e8f9' : '#e0f7ff'));
      const base = i * 16;
      const arr = m.instanceMatrix.array as Float32Array;
      arr[base + 0] = 1; arr[base + 1] = 0; arr[base + 2] = 0; arr[base + 3] = 0;
      arr[base + 4] = 0; arr[base + 5] = 1; arr[base + 6] = 0; arr[base + 7] = 0;
      arr[base + 8] = 0; arr[base + 9] = 0; arr[base + 10] = s.s; arr[base + 11] = 0;
      arr[base + 12] = s.x; arr[base + 13] = s.y; arr[base + 14] = s.z; arr[base + 15] = 1;
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.instanceMatrix.needsUpdate = true;
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
        const arr = m.instanceMatrix.array as Float32Array;
        for (let i = 0; i < COUNT; i++) {
          const s = seeds[i];
          s.z += speed * s.s * dt;
          if (s.z > NEAR) s.z = FAR + Math.random() * 40;
          const base = i * 16;
          arr[base + 10] = len * s.s;
          arr[base + 14] = s.z;
        }
        m.instanceMatrix.needsUpdate = true;
        (m.material as { opacity: number }).opacity = Math.min(1, w * 1.6 + rt.shipSpeed / 400);
      }
    }
    tunnelMat.uniforms.uTime.value = rt.time;
    tunnelMat.uniforms.uTint.value = rt.finaleFlight ? 1 : 0;
    tunnelMat.uniforms.uAmount.value = smoothstep(0.35, 0.95, w) * 1.8;
    if (tunnel.current) tunnel.current.visible = w > 0.32;
  });

  return (
    <group>
      <instancedMesh ref={streaks} args={[undefined, undefined, COUNT]} frustumCulled={false} userData={{ world: 'warp' }}>
        <boxGeometry args={[0.06, 0.06, 1]} />
        <meshBasicMaterial transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <mesh ref={tunnel} material={tunnelMat} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -250]} frustumCulled={false} userData={{ world: 'warp' }}>
        <cylinderGeometry args={[16, 16, 520, 48, 1, true]} />
      </mesh>
    </group>
  );
}
