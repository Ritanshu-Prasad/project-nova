import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import type { Group, PerspectiveCamera as Cam } from 'three';
import { clamp, damp, lerp, wobble } from '../core/math';
import { rt } from '../core/runtime';
import { ARRIVAL, CAMERA } from '../core/scene';
import { useNova, type Phase } from '../core/store';

/** Head-look limits per phase: [yaw, pitch up, pitch down] in radians. */
const LOOK: Record<Phase, readonly [number, number, number]> = {
  gate: [0.25, 0.1, 0.1],
  wake: [0.25, 0.12, 0.12],
  preflight: [0.6, 0.35, 0.5],
  launch: [0.15, 0.08, 0.08],
  warp: [0.15, 0.08, 0.08],
  arrive: [0.32, 0.2, 0.2],
  landed: [0.32, 0.2, 0.2],
};

const baseFov = (aspect: number) => lerp(CAMERA.fovPortrait, CAMERA.fovWide, clamp((aspect - 0.6) / (1.5 - 0.6)));

/** The ship (children ride along), the pilot's head inside it, and the camera in the head. */
export default function ShipRig({ children }: { children?: ReactNode }) {
  const ship = useRef<Group>(null);
  const head = useRef<Group>(null);
  const cam = useRef<Cam>(null);
  const s = useRef({ yaw: 0, pitch: 0, lean: 0 });

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const st = useNova.getState();
    const t = state.clock.elapsedTime;
    const rm = rt.reducedMotion;
    const v = s.current;
    if (!ship.current || !head.current || !cam.current) return;

    const landed = st.phase === 'landed';
    ship.current.position.set(
      0,
      landed ? Math.sin(t * 1.6) * 0.03 : 0,
      st.world === 'bay' ? rt.shipZ : ARRIVAL.backoff * (1 - rt.approach),
    );
    ship.current.rotation.z = landed ? Math.sin(t * 0.9) * 0.005 : 0;

    const [yawMax, up, down] = LOOK[st.phase];
    const k = rm ? 0.5 : 1;
    v.yaw = damp(v.yaw, -rt.lookX * yawMax * k, 4, dt);
    v.pitch = damp(v.pitch, -rt.lookY * (rt.lookY < 0 ? up : down) * k, 4, dt);
    const leanTarget = st.phase === 'launch' ? 0.06 : st.phase === 'preflight' ? -0.03 * rt.charge : 0;
    v.lean = damp(v.lean, leanTarget, st.phase === 'launch' ? 9 : 3, dt);

    const sh = rm ? 0 : rt.shake;
    const hf = t * 19;
    const sx = wobble(hf, 1.3) * 0.012 * sh;
    const sy = wobble(hf * 1.13, 4.1) * 0.012 * sh + Math.sin(t * 1.3) * 0.004;
    const dizzy = rt.dizzy;
    const pitch = v.pitch - rt.slump * 0.5 + wobble(hf * 0.9, 7) * 0.02 * sh + (st.phase === 'launch' ? 0.03 : 0);
    const yaw = v.yaw + wobble(t * 0.3, 2) * 0.06 * dizzy + wobble(hf * 1.07, 9) * 0.02 * sh;
    const roll = rt.slump * 0.12 + wobble(t * 0.35, 5) * 0.07 * dizzy + wobble(hf * 0.8, 3) * 0.015 * sh;
    head.current.position.set(sx, sy, v.lean);
    head.current.rotation.set(pitch, yaw, roll, 'YXZ');

    const fov = baseFov(state.size.width / Math.max(1, state.size.height)) + (rm ? 0 : rt.fovKick);
    if (Math.abs(cam.current.fov - fov) > 0.01) {
      cam.current.fov = fov;
      cam.current.updateProjectionMatrix();
    }

    rt.yaw = v.yaw;
    rt.pitch = v.pitch;
    rt.heading = ((((-v.yaw * 180) / Math.PI) % 360) + 360) % 360;
  });

  return (
    <group ref={ship}>
      <group ref={head}>
        <PerspectiveCamera ref={cam} makeDefault near={CAMERA.near} far={CAMERA.far} fov={CAMERA.fovWide} />
      </group>
      {children}
    </group>
  );
}
