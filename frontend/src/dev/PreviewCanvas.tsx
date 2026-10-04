import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useRef, type ReactNode } from 'react';
import { rt } from '../core/runtime';
import { markPreviewReady, previewParams } from './previewParams';

/**
 * DEV ONLY — isolated module previews (`/?preview=<name>`), used for screenshots while building.
 *
 * Query params (all optional):
 *   rt.<key>=<number|0/1>      write any runtime value, e.g. rt.power=1&rt.core=0.6
 *   phase= world= systems=power,neural  cleared=1  pillar=<i>  hover=<i>  rm=1 (reduced motion)
 *   cam=x,y,z  look=x,y,z  fov=68  orbit=1 (OrbitControls)  post=0 (no bloom)  bloom=<intensity>
 * Sets `window.__previewReady = true` after ~30 rendered frames.
 */

type Vec3 = [number, number, number];
const vec = (s: string | null, fallback: Vec3): Vec3 => {
  if (!s) return fallback;
  const p = s.split(',').map(Number);
  return p.length === 3 && p.every(Number.isFinite) ? [p[0], p[1], p[2]] : fallback;
};

function Ticker({ look, orbit }: { look: Vec3; orbit: boolean }) {
  const camera = useThree((st) => st.camera);
  const frames = useRef(0);
  useEffect(() => {
    if (!orbit) camera.lookAt(look[0], look[1], look[2]);
  }, [camera, look, orbit]);
  useFrame((_, dt) => {
    rt.dt = dt;
    rt.time += dt;
    rt.phaseTime += dt;
    frames.current += 1;
    if (frames.current === 30) markPreviewReady();
  });
  return null;
}

export interface PreviewCanvasProps {
  children?: ReactNode;
  cam?: Vec3;
  look?: Vec3;
  fov?: number;
  /** Lightformer environment for PBR reflections. */
  env?: boolean;
  post?: boolean;
  bloom?: number;
}

export default function PreviewCanvas({ children, cam, look, fov = 68, env = true, post = true, bloom = 1 }: PreviewCanvasProps) {
  const q = previewParams;
  const camPos = vec(q.get('cam'), cam ?? [0, 0, 0]);
  const lookAt = vec(q.get('look'), look ?? [camPos[0], camPos[1], camPos[2] - 1]);
  const fovQ = Number(q.get('fov') ?? fov);
  const orbit = q.get('orbit') === '1';
  const usePost = q.get('post') !== '0' && post;
  const bloomQ = Number(q.get('bloom') ?? bloom);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#02040a' }}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ position: camPos, fov: fovQ, near: 0.03, far: 4000 }}
      >
        <color attach="background" args={['#02040a']} />
        {env && (
          <Environment resolution={128} frames={1}>
            <Lightformer form="rect" intensity={1.2} color="#7dd3fc" position={[0, 4, -6]} scale={[10, 1.5, 1]} />
            <Lightformer form="rect" intensity={0.5} color="#a78bfa" position={[-6, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
            <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[4, 3, 4]} scale={2} />
          </Environment>
        )}
        {children}
        <Ticker look={lookAt} orbit={orbit} />
        {orbit && <OrbitControls target={lookAt} makeDefault />}
        {usePost && (
          <EffectComposer multisampling={4}>
            <Bloom mipmapBlur intensity={bloomQ} luminanceThreshold={0.6} luminanceSmoothing={0.2} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
