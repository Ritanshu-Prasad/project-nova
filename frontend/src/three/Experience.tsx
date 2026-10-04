import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import type { Object3D } from 'three';
import { Z } from '../core/layers';
import { useNova } from '../core/store';
import LaunchBay from './bay/LaunchBay';
import Cockpit from './cockpit/Cockpit';
import Lounge from './lounge/Lounge';
import PostFX from './PostFX';
import ShipRig from './ShipRig';
import Sky from './space/Sky';
import SpaceWorld from './space/SpaceWorld';
import Warp from './space/Warp';

/** Pre-compiles both worlds (hidden ones too) so the warp-time swap never stalls, then reports ready. */
function Boot() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const hidden: Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData.world && !o.visible) {
        o.visible = true;
        hidden.push(o);
      }
    });
    if (import.meta.env.DEV) (window as unknown as { __three: unknown }).__three = { gl, scene, camera };
    gl.compile(scene, camera);
    for (const o of hidden) o.visible = false;
    let frames = 0;
    let id = 0;
    const tick = () => {
      if (++frames >= 3) useNova.getState().setSceneReady(true);
      else id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    const lost = (e: Event) => e.preventDefault();
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      cancelAnimationFrame(id);
      gl.domElement.removeEventListener('webglcontextlost', lost);
    };
  }, [gl, scene, camera]);
  return null;
}

/** The WebGL scene: sky, both worlds, the ship (cockpit + warp) and post-processing. */
export default function Experience() {
  const [dpr, setDpr] = useState(1.5);
  return (
    <div className="fixed inset-0" style={{ zIndex: Z.canvas, touchAction: 'none' }}>
      <Canvas dpr={dpr} gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: import.meta.env.DEV }}>
        <PerformanceMonitor
          // Only resolution adapts: re-creating the effect composer mid-session can blank the canvas.
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(1.5)}
        />
        <color attach="background" args={['#02040a']} />
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={1.1} color="#9bdcf5" position={[0, 4, -6]} scale={[10, 1.5, 1]} />
          <Lightformer form="rect" intensity={0.45} color="#a78bfa" position={[-6, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
          <Lightformer form="ring" intensity={0.7} color="#ffffff" position={[4, 3, 4]} scale={2} />
        </Environment>
        <Sky />
        <LaunchBay />
        <SpaceWorld />
        <ShipRig>
          <Cockpit />
          <Lounge />
          <Warp />
        </ShipRig>
        <PostFX />
        <Boot />
      </Canvas>
    </div>
  );
}
