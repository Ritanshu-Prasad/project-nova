import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  type Group,
  type InstancedMesh,
  type Mesh,
  type PointLight,
} from 'three';
import { clamp, smoothstep } from '../../core/math';
import { rt } from '../../core/runtime';
import { BAY } from '../../core/scene';
import { useNova } from '../../core/store';
import { BANK_Z, BEAM_LEN, CHASE_SPACING, CHASE_X, DOOR_Z, FIXTURE_X, HALF_W, RIB_Z, RING_Z } from './layout';

const FLOOR = BAY.floorY;
const CEIL = BAY.ceilingY;
const DOOR_H = CEIL - FLOOR;

const metal = new MeshStandardMaterial({ color: '#1a212c', metalness: 0.65, roughness: 0.55 });
const dark = new MeshStandardMaterial({ color: '#0b0f15', metalness: 0.5, roughness: 0.7 });

function hazardTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#111';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#d99a06';
  for (let i = -128; i < 256; i += 48) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 24, 0);
    g.lineTo(i + 24 + 128, 128);
    g.lineTo(i + 128, 128);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

function signTexture(lines: [string, string]) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#e8f6ff';
  g.font = '700 120px "Oxanium Variable", sans-serif';
  g.textAlign = 'center';
  g.fillText(lines[0], 256, 140);
  g.font = '600 30px "JetBrains Mono Variable", monospace';
  g.fillStyle = '#f59e0b';
  g.fillText(lines[1], 256, 210);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const dummy = new Object3D();
const tmp = new Color();

/** The hangar, its blast doors and the accelerator rail the ship launches down. */
export default function LaunchBay() {
  const world = useNova((s) => s.world);
  const root = useRef<Group>(null);
  const banks = useRef<InstancedMesh>(null);
  const rings = useRef<InstancedMesh>(null);
  const chase = useRef<InstancedMesh>(null);
  const doorL = useRef<Group>(null);
  const doorR = useRef<Group>(null);
  const seam = useRef<Mesh>(null);
  const lamp = useRef<MeshStandardMaterial>(null);
  const beacons = useRef<Group>(null);
  const beaconLight = useRef<PointLight>(null);
  const flood = useRef<PointLight>(null);
  const flood2 = useRef<PointLight>(null);
  const strobe = useRef<PointLight>(null);

  const hazard = useMemo(() => hazardTexture(), []);
  const sign = useMemo(() => signTexture(['BAY 07', 'NOVA FLIGHT ACADEMY · CATAPULT ZONE']), []);
  const chaseCount = Math.floor((DOOR_Z - BAY.exitZ) / CHASE_SPACING) * 2;
  const bankCount = BANK_Z.length * FIXTURE_X.length;

  useLayoutEffect(() => {
    if (banks.current) {
      let i = 0;
      for (const z of BANK_Z)
        for (const x of FIXTURE_X) {
          dummy.position.set(x, CEIL - 1.4, z);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          banks.current.setMatrixAt(i++, dummy.matrix);
        }
      banks.current.instanceMatrix.needsUpdate = true;
    }
    if (rings.current) {
      RING_Z.forEach((z, i) => {
        dummy.position.set(0, 0, z);
        dummy.rotation.set(0, 0, Math.PI / 8);
        dummy.updateMatrix();
        rings.current!.setMatrixAt(i, dummy.matrix);
      });
      rings.current.instanceMatrix.needsUpdate = true;
    }
    if (chase.current) {
      for (let i = 0; i < chaseCount; i++) {
        const side = i % 2 ? 1 : -1;
        dummy.position.set(side * CHASE_X, FLOOR + 0.06, DOOR_Z - 2 - Math.floor(i / 2) * CHASE_SPACING);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        chase.current.setMatrixAt(i, dummy.matrix);
      }
      chase.current.instanceMatrix.needsUpdate = true;
    }
  }, [chaseCount]);

  useFrame(() => {
    if (useNova.getState().world !== 'bay') return;
    const t = rt.time;
    if (banks.current) {
      let i = 0;
      for (let b = 0; b < BANK_Z.length; b++) {
        const on = rt.bayLights >= (b + 1) / BAY.lightBanks;
        const flick = on && rt.bayLights < (b + 1.6) / BAY.lightBanks ? (Math.sin(t * 60 + b) > 0 ? 1 : 0.2) : 1;
        for (let k = 0; k < FIXTURE_X.length; k++) banks.current.setColorAt(i++, tmp.setRGB(1, 1, 1).multiplyScalar(on ? 3.2 * flick : 0.04));
      }
      if (banks.current.instanceColor) banks.current.instanceColor.needsUpdate = true;
    }
    if (flood.current) flood.current.intensity = rt.bayLights * 40;
    if (flood2.current) flood2.current.intensity = smoothstep(0.5, 1, rt.bayLights) * 30;
    if (beacons.current) {
      beacons.current.visible = rt.emergency > 0.02;
      beacons.current.children.forEach((b, i) => (b.rotation.y = t * 2.2 + i * Math.PI));
    }
    if (beaconLight.current) {
      beaconLight.current.intensity = rt.emergency * (3 + 3 * Math.sin(t * 4.4));
    }
    const open = rt.doors;
    if (doorL.current) doorL.current.position.x = -HALF_W / 2 - open * (HALF_W - 1);
    if (doorR.current) doorR.current.position.x = HALF_W / 2 + open * (HALF_W - 1);
    if (seam.current) (seam.current.material as MeshStandardMaterial).emissiveIntensity = rt.clearance * 6 * (1 - open);
    if (lamp.current) lamp.current.emissive.set(rt.clearance > 0.5 ? '#34d399' : '#ff2a2a');
    if (rings.current) {
      RING_Z.forEach((_z, i) => {
        const chaseV = rt.clearance * (0.35 + 0.65 * Math.max(0, Math.sin(i * 0.8 - t * (4 + 10 * rt.charge))));
        const passed = rt.shipZ < RING_Z[i] + 4 ? 1 : 0;
        rings.current!.setColorAt(i, tmp.set('#22d3ee').multiplyScalar(0.15 + 3.5 * Math.max(chaseV, passed * 0.6)));
      });
      if (rings.current.instanceColor) rings.current.instanceColor.needsUpdate = true;
    }
    if (chase.current) {
      for (let i = 0; i < chaseCount; i++) {
        const row = Math.floor(i / 2);
        const v = rt.clearance * Math.pow(Math.max(0, Math.sin(row * 0.5 - t * (6 + 14 * rt.charge))), 6);
        chase.current.setColorAt(i, tmp.set('#67e8f9').multiplyScalar(0.05 + 4 * v));
      }
      if (chase.current.instanceColor) chase.current.instanceColor.needsUpdate = true;
    }
    if (strobe.current) {
      const launching = useNova.getState().phase === 'launch';
      strobe.current.position.set(0, 1.5, rt.shipZ - 2);
      const f = ((rt.shipZ % BAY.ringSpacing) + BAY.ringSpacing) % BAY.ringSpacing;
      strobe.current.intensity = launching ? clamp(1 - Math.abs(f - BAY.ringSpacing / 2) / 2) * 60 : 0;
    }
  });

  return (
    <group ref={root} visible={world === 'bay'} userData={{ world: 'bay' }}>
      <hemisphereLight args={['#5d7a99', '#0a0c10', 0.25]} />
      <pointLight ref={flood} color="#e4f3ff" position={[0, CEIL - 2, -6]} distance={40} decay={1.4} intensity={0} />
      <pointLight ref={flood2} color="#e4f3ff" position={[0, CEIL - 2, -20]} distance={40} decay={1.4} intensity={0} />
      <pointLight ref={strobe} color="#bff4ff" distance={18} decay={1.2} intensity={0} />

      {/* Deck */}
      <mesh material={metal} position={[0, FLOOR, (BAY.hangarBackZ + DOOR_Z) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_W * 2, BAY.hangarBackZ - DOOR_Z]} />
      </mesh>
      <mesh position={[0, FLOOR + 0.01, DOOR_Z + 2.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_W * 2, 1.2]} />
        <meshStandardMaterial map={hazard} map-repeat={[12, 1]} roughness={0.7} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 3.2, FLOOR + 0.012, (BAY.hangarBackZ + DOOR_Z) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, BAY.hangarBackZ - DOOR_Z]} />
          <meshStandardMaterial color="#000" emissive="#f59e0b" emissiveIntensity={0.35} />
        </mesh>
      ))}
      {/* Walls, ceiling, ribs */}
      {[-1, 1].map((s) => (
        <mesh key={s} material={dark} position={[s * HALF_W, (FLOOR + CEIL) / 2, (BAY.hangarBackZ + DOOR_Z) / 2]} rotation={[0, -s * (Math.PI / 2), 0]}>
          <planeGeometry args={[BAY.hangarBackZ - DOOR_Z, DOOR_H]} />
        </mesh>
      ))}
      <mesh material={dark} position={[0, CEIL, (BAY.hangarBackZ + DOOR_Z) / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_W * 2, BAY.hangarBackZ - DOOR_Z]} />
      </mesh>
      <mesh material={dark} position={[0, (FLOOR + CEIL) / 2, BAY.hangarBackZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[HALF_W * 2, DOOR_H]} />
      </mesh>
      {RIB_Z.map((z) => (
        <group key={z} position={[0, 0, z]}>
          {[-1, 1].map((s) => (
            <mesh key={s} material={metal} position={[s * (HALF_W - 0.4), (FLOOR + CEIL) / 2, 0]}>
              <boxGeometry args={[0.8, DOOR_H, 0.6]} />
            </mesh>
          ))}
          <mesh material={metal} position={[0, CEIL - 0.4, 0]}>
            <boxGeometry args={[HALF_W * 2, 0.8, 0.6]} />
          </mesh>
        </group>
      ))}
      {/* Catwalks */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (HALF_W - 2), 3.5, (BAY.hangarBackZ + DOOR_Z) / 2]}>
          <mesh material={metal}>
            <boxGeometry args={[3, 0.15, BAY.hangarBackZ - DOOR_Z]} />
          </mesh>
          <mesh position={[-s * 1.5, 0.55, 0]}>
            <boxGeometry args={[0.05, 0.05, BAY.hangarBackZ - DOOR_Z]} />
            <meshStandardMaterial color="#000" emissive="#f59e0b" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
      {/* Control-room window */}
      <mesh position={[-HALF_W + 0.05, 5.6, -8]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[8, 1.6]} />
        <meshStandardMaterial color="#000" emissive="#22d3ee" emissiveIntensity={0.9} />
      </mesh>
      {/* Flood-light banks */}
      <instancedMesh ref={banks} args={[undefined, undefined, bankCount]}>
        <boxGeometry args={[2.6, 0.12, 0.7]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* Emergency beacons */}
      <group ref={beacons}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * (HALF_W - 1.2), CEIL - 1.2, -4 + s * 6]}>
            <mesh rotation={[0, 0, Math.PI / 2]} position={[BEAM_LEN / 2, 0, 0]}>
              <coneGeometry args={[2.4, BEAM_LEN, 24, 1, true]} />
              <meshBasicMaterial color="#ff2a2a" transparent opacity={0.07} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.35, 12, 12]} />
              <meshBasicMaterial color={new Color('#ff3030').multiplyScalar(4)} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
      <pointLight ref={beaconLight} color="#ff2a2a" position={[0, CEIL - 2, -2]} distance={30} decay={1.3} />
      {/* Blast doors */}
      <group position={[0, (FLOOR + CEIL) / 2, DOOR_Z]}>
        <mesh material={dark} position={[0, DOOR_H / 2 + 2, 0.2]}>
          <boxGeometry args={[HALF_W * 2, 4, 1]} />
        </mesh>
        <mesh position={[0, DOOR_H / 2 - 1.2, 0.75]}>
          <planeGeometry args={[6, 3]} />
          <meshStandardMaterial color="#000" emissive="#ffffff" emissiveMap={sign} emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[0, DOOR_H / 2 + 0.6, 0.75]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial ref={lamp} color="#000" emissive="#ff2a2a" emissiveIntensity={5} toneMapped={false} />
        </mesh>
        {[doorL, doorR].map((ref, i) => (
          <group key={i} ref={ref} position={[(i ? 1 : -1) * (HALF_W / 2), 0, 0]}>
            <mesh material={metal}>
              <boxGeometry args={[HALF_W, DOOR_H, 0.8]} />
            </mesh>
            <mesh position={[(i ? -1 : 1) * (HALF_W / 2 - 0.4), 0, 0.42]}>
              <planeGeometry args={[0.8, DOOR_H]} />
              <meshStandardMaterial map={hazard} map-repeat={[1, 8]} roughness={0.6} />
            </mesh>
            {[-3, 0, 3].map((y) => (
              <mesh key={y} material={dark} position={[0, y, 0.42]}>
                <boxGeometry args={[HALF_W - 2, 0.15, 0.05]} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh ref={seam} position={[0, 0, 0.45]}>
          <planeGeometry args={[0.12, DOOR_H]} />
          <meshStandardMaterial color="#000" emissive="#bff4ff" emissiveIntensity={0} toneMapped={false} />
        </mesh>
      </group>
      {/* Accelerator rail */}
      <mesh material={metal} position={[0, FLOOR - 0.2, (DOOR_Z + BAY.exitZ) / 2]}>
        <boxGeometry args={[7, 0.4, DOOR_Z - BAY.exitZ]} />
      </mesh>
      <instancedMesh ref={chase} args={[undefined, undefined, chaseCount]}>
        <boxGeometry args={[0.25, 0.08, 0.5]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={rings} args={[undefined, undefined, RING_Z.length]}>
        <torusGeometry args={[BAY.ringRadius, 0.35, 6, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
