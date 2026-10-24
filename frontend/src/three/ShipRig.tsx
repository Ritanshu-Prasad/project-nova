import { PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import type { Group, PerspectiveCamera as Cam } from 'three';
import { clamp, damp, lerp, wobble } from '../core/math';
import { rt } from '../core/runtime';
import { ARRIVAL, CAMERA, SPACE_LAUNCH } from '../core/scene';
import { useHub } from '../core/hub';
import { useDeck } from '../core/journey';
import { useNova, type Phase } from '../core/store';
import { ARRIVE_Z, STAND_EYE, STATIONS } from './lounge/layout';

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
  const s = useRef({ yaw: 0, pitch: 0, lean: 0, zoom: 0 });
  const pose = useRef({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  /** Set after the first frame: if that frame is already in the lounge the pilot is put straight at the station, not glided there. */
  const placed = useRef(false);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const st = useNova.getState();
    const t = state.clock.elapsedTime;
    const rm = rt.reducedMotion;
    const v = s.current;
    if (!ship.current || !head.current || !cam.current) return;

    // Idle bob only while seated; out of the seat the holo panels must stay rock-steady.
    const seated = useDeck.getState().deck === 'cockpit';
    const landed = st.phase === 'landed' && seated;
    ship.current.position.set(
      0,
      landed ? Math.sin(t * 1.6) * 0.03 : 0,
      st.world === 'bay' ? rt.shipZ : rt.spaceLaunch ? rt.shipZ * SPACE_LAUNCH.scale : ARRIVAL.backoff * (1 - rt.approach),
    );
    ship.current.rotation.z = landed ? Math.sin(t * 0.9) * 0.005 : 0;

    // Out of the seat: no look while walking, only a gentle sway in the lounge (keeps the holo panels clickable).
    const deck = useDeck.getState().deck;
    // At a lounge station the view is frozen (no parallax) so the panel and the 3D focus stay put.
    const station = useHub.getState().station;
    const [yawMax, up, down] =
      deck === 'transit' ? [0, 0, 0] : deck === 'lounge' ? (station === 'hub' ? [0.1, 0.05, 0.06] : [0, 0, 0]) : LOOK[st.phase];
    const k = rm ? 0.5 : 1;
    v.yaw = damp(v.yaw, -rt.lookX * yawMax * k, 4, dt);
    v.pitch = damp(v.pitch, -rt.lookY * (rt.lookY < 0 ? up : down) * k, 4, dt);
    const leanTarget = st.phase === 'launch' ? 0.06 : st.phase === 'preflight' ? -0.03 * rt.charge : 0;
    v.lean = damp(v.lean, leanTarget, st.phase === 'launch' ? 9 : 3, dt);

    const sh = rm ? 0 : rt.shake + rt.novaShake;
    const hf = t * 19;
    const sx = wobble(hf, 1.3) * 0.012 * sh;
    const sy = wobble(hf * 1.13, 4.1) * 0.012 * sh + (seated ? Math.sin(t * 1.3) * 0.004 : 0);
    const dizzy = rt.dizzy;
    const pitch = v.pitch - rt.slump * 0.5 + wobble(hf * 0.9, 7) * 0.02 * sh + (st.phase === 'launch' ? 0.03 : 0);
    const yaw = v.yaw + wobble(t * 0.3, 2) * 0.06 * dizzy + wobble(hf * 1.07, 9) * 0.02 * sh;
    const roll = rt.slump * 0.12 + wobble(t * 0.35, 5) * 0.07 * dizzy + wobble(hf * 0.8, 3) * 0.015 * sh;
    // Stand up, step back, turn around and walk through the bulkhead door into the lounge.
    const walking = rt.walk > 0 && rt.walk < 1 ? Math.abs(Math.sin(rt.walk * Math.PI * 7)) * 0.03 : 0;
    const p = pose.current;
    if (deck === 'lounge' && rt.walk >= 1) {
      // Walk over to the chosen station.
      const target = STATIONS[station];
      if (!placed.current) Object.assign(p, target); // the very first frame is in the lounge: already standing there
      const k = 1 - Math.exp(-2.2 * dt);
      p.x += (target.x - p.x) * k;
      p.y += (target.y - p.y) * k;
      p.z += (target.z - p.z) * k;
      p.yaw += Math.atan2(Math.sin(target.yaw - p.yaw), Math.cos(target.yaw - p.yaw)) * k;
      p.pitch += (target.pitch - p.pitch) * k;
    } else {
      p.x = 0;
      p.y = STAND_EYE * rt.stand + walking;
      p.z = 0.15 * rt.stand * (1 - rt.walk) + ARRIVE_Z * rt.walk;
      p.yaw = Math.PI * rt.turn;
      p.pitch = -0.06 * rt.walk;
    }
    placed.current = true;
    v.zoom = damp(v.zoom, deck === 'lounge' && station !== 'hub' ? -6 : 0, 2.5, dt);
    head.current.position.set(sx + p.x, sy + p.y, v.lean + p.z);
    head.current.rotation.set(pitch + p.pitch, yaw + p.yaw, roll, 'YXZ');

    const fov = baseFov(state.size.width / Math.max(1, state.size.height)) + (rm ? 0 : rt.fovKick + rt.novaKick) + v.zoom;
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
