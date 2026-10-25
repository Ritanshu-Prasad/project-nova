import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useThree, type RootState } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { WebGLRenderTarget, type Object3D } from 'three';
import { currentQuality, suggestLighter } from '../core/graphics';
import { Z } from '../core/layers';
import { rt } from '../core/runtime';
import { useNova } from '../core/store';
import LaunchBay from './bay/LaunchBay';
import Cockpit from './cockpit/Cockpit';
import Lounge from './lounge/Lounge';
import PostFX from './PostFX';
import ShipRig from './ShipRig';
import Sky from './space/Sky';
import SpaceWorld from './space/SpaceWorld';
import DyingSun from './space/DyingSun';
import FinaleDebris from './space/FinaleDebris';
import Supernova from './space/Supernova';
import Warp from './space/Warp';

/** True when nothing is in flight: landed, and no finale running. */
const calm = () => useNova.getState().phase === 'landed' && !rt.finaleFlight && !rt.novaOn;

type Three = RootState;

/**
 * Compiles the scene's shaders as they will be when `show` is on screen and `hide` is not, without drawing a frame: the
 * visibility is flipped only for the synchronous material pass of each call. Shaders are built for the lights they see, so
 * this is how a later moment (the warp, the arrival) is prepared in advance. Both the post-processing variant (a render target
 * is bound) and the plain screen variant are built.
 */
function compileFor({ gl, scene, camera }: Pick<Three, 'gl' | 'scene' | 'camera'>, show: Object3D[], hide: Object3D[] = []): void {
  const target = new WebGLRenderTarget(1, 1);
  const prevTarget = gl.getRenderTarget();
  const was = [...show, ...hide].map((o) => o.visible);
  try {
    for (const o of show) o.visible = true;
    for (const o of hide) o.visible = false;
    for (const bound of [target, null]) {
      gl.setRenderTarget(bound);
      void gl.compileAsync(scene, camera).catch(() => undefined);
    }
  } finally {
    [...show, ...hide].forEach((o, i) => (o.visible = was[i]));
    gl.setRenderTarget(prevTarget);
    target.dispose();
  }
}

const tagged = (scene: Object3D, ...worlds: string[]) => {
  const out: Object3D[] = [];
  scene.traverse((o) => void (worlds.includes(o.userData.world) && out.push(o)));
  return out;
};

/**
 * While the pilot flips the switches, prepares the shaders of what the flight will show: the warp streaks and tunnel in
 * the light of the current scene, then the arrival (the new world in, the hangar out, the finale's star). Without this the
 * first frame of each of them stalls while its shaders are built.
 */
function Rehearsal() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const unsub = useNova.subscribe((s, prev) => {
      if (s.phase !== 'preflight' || prev.phase === 'preflight') return;
      clearTimeout(id);
      id = setTimeout(() => {
        if (useNova.getState().phase !== 'preflight') return;
        const three = { gl, scene, camera };
        const warp = tagged(scene, 'warp');
        compileFor(three, warp);
        compileFor(three, [...warp, ...tagged(scene, 'newworld', 'finale', 'ribbon')], tagged(scene, 'bay'));
      }, 400);
    });
    return () => {
      unsub();
      clearTimeout(id);
    };
  }, [gl, scene, camera]);
  return null;
}

/** Pre-compiles all scenes, lounges, and space worlds via multi-angle GPU pre-warm so warp and transit never freeze. */
function Boot() {
  const { gl, scene, camera, setFrameloop } = useThree();
  useEffect(() => {
    let cancelled = false;
    // Shaders only the finale (and the aurora curtains) need are compiled after the first frames, so they never delay the start:
    // those objects are taken out of the scene for the first compile and put back afterwards.
    // A returning pilot starts in orbit: the hangar and the warp tunnel are not on screen, so they wait for that idle compile too.
    const lateWorlds = useNova.getState().phase === 'landed' ? ['finale', 'ribbon', 'bay', 'warp'] : ['finale', 'ribbon'];
    const late: { o: Object3D; parent: Object3D }[] = [];
    scene.traverse((o) => {
      if (lateWorlds.includes(o.userData.world) && o.parent) late.push({ o, parent: o.parent });
    });
    for (const { o, parent } of late) parent.remove(o);
    const attachLate = () => {
      for (const { o, parent } of late) if (o.parent !== parent) parent.add(o);
    };
    // The moment the pilot leaves orbit (a replayed launch, a jump) whatever was held back must be in the scene, idle or not.
    const unsub = useNova.subscribe((s) => {
      if (s.phase !== 'landed' || s.world !== 'newworld') attachLate();
    });
    const hidden: Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData.world && !o.visible) {
        o.visible = true;
        hidden.push(o);
      }
    });
    if (import.meta.env.DEV) (window as unknown as { __three: unknown }).__three = { gl, scene, camera };

    // Compile every shader off the main thread (parallel shader compile where the browser has it) while nothing renders,
    // so the page stays responsive; then one 1x1 pass each way uploads buffers and textures. The old synchronous
    // version froze the page for seconds on a cold start.
    setFrameloop('never');
    const warm = async () => {
      try {
        await Promise.race([gl.compileAsync(scene, camera), new Promise((resolve) => setTimeout(resolve, 8000))]);
      } catch {
        gl.compile(scene, camera);
      }
      if (cancelled) return;
      const target = new WebGLRenderTarget(1, 1);
      const prevTarget = gl.getRenderTarget();
      try {
        gl.setRenderTarget(target);
        gl.render(scene, camera); // cockpit, bay, sky and forward space assets
        camera.rotation.y += Math.PI;
        camera.updateMatrixWorld();
        gl.render(scene, camera); // the lounge behind
        camera.rotation.y -= Math.PI;
        camera.updateMatrixWorld();
      } catch {
        /* a driver quirk here only costs a first-use hitch */
      } finally {
        gl.setRenderTarget(prevTarget);
        target.dispose();
      }
    };

    let frames = 0;
    let id = 0;
    const tick = () => {
      if (++frames >= 3) {
        useNova.getState().setSceneReady(true);
        document.documentElement.dataset.scene = 'ready'; // for tests and support: the first 3D frames are on screen
        // Now, while the pilot looks around, warm up the held-back shaders (finale, auroras, and on an orbit start the
        // hangar and the warp) in the background.
        type Idle = (cb: () => void, opts?: { timeout: number }) => void;
        const idle: Idle = (window as Window & { requestIdleCallback?: Idle }).requestIdleCallback ?? ((cb) => setTimeout(cb, 400));
        const warmLate = () => {
          if (cancelled) return;
          attachLate();
          // They are hidden, and the renderer only compiles what is visible: compileFor shows them for the compile only.
          // The hangar brings its own lights, so it is prepared as the replayed launch shows it: alone, in the seat.
          const three = { gl, scene, camera };
          const unlit = late.filter(({ o }) => o.userData.world !== 'bay').map(({ o }) => o);
          const bay = late.filter(({ o }) => o.userData.world === 'bay').map(({ o }) => o);
          if (unlit.length) compileFor(three, unlit);
          if (bay.length) compileFor(three, bay, tagged(scene, 'newworld', 'lounge'));
        };
        idle(warmLate, { timeout: 1500 }); // never more than 1.5 s away, even on a busy page
      } else id = requestAnimationFrame(tick);
    };
    void warm().finally(() => {
      for (const o of hidden) o.visible = false;
      if (cancelled) return;
      setFrameloop('always');
      id = requestAnimationFrame(tick);
    });
    const lost = (e: Event) => e.preventDefault();
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      cancelled = true;
      unsub();
      attachLate();
      for (const o of hidden) o.visible = false;
      cancelAnimationFrame(id);
      gl.domElement.removeEventListener('webglcontextlost', lost);
    };
  }, [gl, scene, camera, setFrameloop]);
  return null;
}

/** The WebGL scene: sky, both worlds, the ship (cockpit + warp) and post-processing. */
export default function Experience() {
  // The level is fixed while this mounts (App remounts the scene with a new key when it changes).
  const [q] = useState(currentQuality);
  const [dpr, setDpr] = useState<number>(q.dpr[0]);
  // A change of resolution (or of graphics level, which rebuilds the scene) blinks a frame, most visibly on Safari: it waits
  // until the pilot is landed and no finale is playing.
  const later = useRef<(() => void) | null>(null);
  const whenCalm = (fn: () => void) => {
    if (calm()) fn();
    else later.current = fn;
  };
  useEffect(() => {
    const id = setInterval(() => {
      if (later.current && calm()) {
        const fn = later.current;
        later.current = null;
        fn();
      }
    }, 500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fixed inset-0" style={{ zIndex: Z.canvas, touchAction: 'none' }}>
      <Canvas dpr={dpr} gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: import.meta.env.DEV }}>
        <PerformanceMonitor
          // Only resolution adapts: re-creating the effect composer mid-session can blank the canvas. Already at the
          // lowest resolution and still slow → offer the next lighter graphics level (once).
          onDecline={() => whenCalm(() => (dpr <= q.dpr[1] ? suggestLighter() : setDpr(q.dpr[1])))}
          onIncline={() => whenCalm(() => setDpr(q.dpr[0]))}
        />
        <color attach="background" args={['#02040a']} />
        <Environment resolution={q.env} frames={1}>
          <Lightformer form="rect" intensity={1.1} color="#9bdcf5" position={[0, 4, -6]} scale={[10, 1.5, 1]} />
          <Lightformer form="rect" intensity={0.45} color="#a78bfa" position={[-6, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
          <Lightformer form="ring" intensity={0.7} color="#ffffff" position={[4, 3, 4]} scale={2} />
        </Environment>
        <Sky />
        <LaunchBay />
        <SpaceWorld />
        <DyingSun />
        <FinaleDebris />
        <Supernova />
        <ShipRig>
          <Cockpit />
          <Lounge />
          <Warp />
        </ShipRig>
        <PostFX quality={q.post} />
        <Boot />
        <Rehearsal />
      </Canvas>
    </div>
  );
}
