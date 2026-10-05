import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  ExtrudeGeometry,
  MeshStandardMaterial,
  Object3D,
  Path,
  type Group,
  type InstancedMesh,
  type Mesh,
} from 'three';
import { clamp, smoothstep } from '../../core/math';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';
import { CORRIDOR, DOOR, FLOOR_Y, octagon, plateTexture, shapeFrom, signTexture, softDot } from './layout';

const CY = FLOOR_Y + DOOR.height / 2;
const HW = DOOR.width / 2;
const HH = DOOR.height / 2;
/** Interlocking seam between the two leaves (x, y relative to the door centre), bottom → top. */
const SEAM: [number, number][] = [[0, -HH], [0, -0.45], [0.1, -0.35], [0.1, 0.05], [-0.1, 0.15], [-0.1, 0.45], [0, 0.55], [0, HH]];
const RIBS = 6;
const GUIDES = 22;
const STEAM = 18;

const dummy = new Object3D();

function leafShape(side: -1 | 1) {
  const c = DOOR.chamfer;
  const outer: [number, number][] =
    side < 0
      ? [[0, -HH], [-HW + c, -HH], [-HW, -HH + c], [-HW, HH - c], [-HW + c, HH], [0, HH]]
      : [[0, HH], [HW - c, HH], [HW, HH - c], [HW, -HH + c], [HW - c, -HH], [0, -HH]];
  // Walk the seam back to the start so the outline closes.
  const seam = side < 0 ? [...SEAM].reverse().slice(1, -1) : SEAM.slice(1, -1);
  return shapeFrom([...outer, ...seam]);
}

/** The rear bulkhead door of the cockpit (with real depth) and the corridor to the lounge behind it. */
export default function Door() {
  const theme = useNova((s) => s.themeColor);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const bars = useRef<Group[]>([]);
  const lamp = useRef<MeshStandardMaterial>(null);
  const seam = useRef<Group>(null);
  const steam = useRef<InstancedMesh>(null);
  const guides = useRef<InstancedMesh>(null);
  const ribs = useRef<InstancedMesh>(null);
  const strips = useRef<InstancedMesh>(null);

  const res = useMemo(() => {
    const hole = new Path();
    octagon(DOOR.width + 0.02, DOOR.height + 0.02, DOOR.chamfer, CY).forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y)));
    const wallShape = shapeFrom([[-2.2, FLOOR_Y - 0.05], [2.2, FLOOR_Y - 0.05], [2.2, FLOOR_Y + 3.2], [-2.2, FLOOR_Y + 3.2]]);
    wallShape.holes.push(hole);
    const frameShape = shapeFrom(octagon(DOOR.frameW, DOOR.frameH, DOOR.chamfer + 0.2, CY));
    frameShape.holes.push(hole.clone());
    const glowShape = shapeFrom(octagon(DOOR.width + 0.09, DOOR.height + 0.09, DOOR.chamfer + 0.02, CY));
    const glowHole = new Path();
    octagon(DOOR.width + 0.03, DOOR.height + 0.03, DOOR.chamfer, CY).forEach(([x, y], i) => (i ? glowHole.lineTo(x, y) : glowHole.moveTo(x, y)));
    glowShape.holes.push(glowHole);
    const bevel = { bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 };
    return {
      wall: new ExtrudeGeometry(wallShape, { depth: DOOR.wallDepth, bevelEnabled: false }),
      frame: new ExtrudeGeometry(frameShape, { depth: 0.62, ...bevel }),
      glow: new ExtrudeGeometry(glowShape, { depth: 0.02, bevelEnabled: false }),
      leafL: new ExtrudeGeometry(leafShape(-1), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 }),
      leafR: new ExtrudeGeometry(leafShape(1), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 }),
      plates: plateTexture('#2e2620', 'rgba(0,0,0,0.55)', [3, 2]),
      corridorPlates: plateTexture('#2a221d', 'rgba(0,0,0,0.6)', [1, 3]),
      sign: signTexture('DECK 7', 'COSMIC LOUNGE'),
      dot: softDot(),
    };
  }, []);

  useEffect(
    () => () => {
      for (const v of Object.values(res)) v.dispose();
    },
    [res],
  );

  const mats = useMemo(
    () => ({
      wall: new MeshStandardMaterial({ color: '#8a7a6c', map: res.plates, metalness: 0.65, roughness: 0.55 }),
      frame: new MeshStandardMaterial({ color: '#5a3d2a', metalness: 0.85, roughness: 0.32 }),
      leaf: new MeshStandardMaterial({ color: '#7d8696', metalness: 0.6, roughness: 0.4 }),
      dark: new MeshStandardMaterial({ color: '#141619', metalness: 0.5, roughness: 0.7 }),
      brass: new MeshStandardMaterial({ color: '#b8894f', metalness: 0.9, roughness: 0.28 }),
      glow: new MeshStandardMaterial({ color: '#000', emissive: new Color(theme), emissiveIntensity: 2.4, toneMapped: false }),
      corridor: new MeshStandardMaterial({ color: '#9a8878', map: res.corridorPlates, metalness: 0.6, roughness: 0.6 }),
    }),
    [res, theme],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useLayoutEffect(() => {
    const step = (CORRIDOR.end - CORRIDOR.start) / RIBS;
    if (ribs.current) {
      let i = 0;
      for (let r = 0; r < RIBS; r++) {
        const z = CORRIDOR.start + step * (r + 0.5);
        for (const [x, y, sx, sy] of [
          [-CORRIDOR.width / 2 + 0.07, FLOOR_Y + CORRIDOR.height / 2, 0.14, CORRIDOR.height],
          [CORRIDOR.width / 2 - 0.07, FLOOR_Y + CORRIDOR.height / 2, 0.14, CORRIDOR.height],
          [0, FLOOR_Y + CORRIDOR.height - 0.07, CORRIDOR.width, 0.14],
        ]) {
          dummy.position.set(x, y, z);
          dummy.scale.set(sx, sy, 0.16);
          dummy.updateMatrix();
          ribs.current.setMatrixAt(i++, dummy.matrix);
        }
      }
      ribs.current.instanceMatrix.needsUpdate = true;
    }
    if (strips.current) {
      let i = 0;
      for (let r = 0; r < RIBS; r++) {
        const z = CORRIDOR.start + step * (r + 0.5) - 0.09;
        for (const x of [-CORRIDOR.width / 2 + 0.15, CORRIDOR.width / 2 - 0.15]) {
          dummy.position.set(x, FLOOR_Y + 1.25, z);
          dummy.scale.set(0.025, 1.8, 0.02);
          dummy.updateMatrix();
          strips.current.setMatrixAt(i++, dummy.matrix);
        }
      }
      strips.current.instanceMatrix.needsUpdate = true;
    }
    if (guides.current) {
      for (let i = 0; i < GUIDES; i++) {
        const side = i % 2 ? 1 : -1;
        dummy.position.set(side * (CORRIDOR.width / 2 - 0.2), FLOOR_Y + 0.01, CORRIDOR.start + 0.1 + Math.floor(i / 2) * 0.25);
        dummy.scale.set(0.06, 0.015, 0.12);
        dummy.updateMatrix();
        guides.current.setMatrixAt(i, dummy.matrix);
      }
      guides.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  const tmp = useMemo(() => new Color(), []);
  const themeColor = useMemo(() => new Color(theme), [theme]);

  useFrame(() => {
    const d = rt.door;
    const unlock = smoothstep(0, 0.12, d);
    const open = smoothstep(0.15, 1, d);
    const pop = 0.04 * unlock;
    if (left.current) left.current.position.set(-open * (HW + 0.14), 0, pop);
    if (right.current) right.current.position.set(Math.max(0, open - 0.06) * (HW + 0.14) * 1.06, 0, pop);
    bars.current.forEach((b, i) => {
      if (b) b.position.x = (i % 2 ? 1 : -1) * unlock * (HW + 0.25);
    });
    if (lamp.current) lamp.current.emissive.set(d > 0.08 ? '#34d399' : '#ff2a2a');
    if (seam.current) {
      seam.current.visible = open < 0.05;
      seam.current.children.forEach((c) => {
        const m = (c as Mesh).material as MeshStandardMaterial;
        m.emissive.copy(unlock > 0.5 ? themeColor : tmp.set('#ff2a2a'));
        m.emissiveIntensity = 2 + 3 * unlock;
      });
    }
    if (steam.current) {
      const p = clamp((d - 0.1) / 0.45);
      steam.current.visible = p > 0 && p < 1;
      if (steam.current.visible) {
        for (let i = 0; i < STEAM; i++) {
          const k = i / STEAM;
          const y = -HH + 0.1 + k * (DOOR.height - 0.2);
          const spread = (i % 2 ? 1 : -1) * (0.05 + p * (0.3 + (i % 3) * 0.15));
          dummy.position.set(spread, CY + y + p * 0.4, DOOR.z - 0.05 - p * (0.6 + (i % 4) * 0.2));
          dummy.scale.setScalar(0.12 + p * (0.7 + (i % 5) * 0.12));
          dummy.rotation.set(0, Math.PI, i);
          dummy.updateMatrix();
          steam.current.setMatrixAt(i, dummy.matrix);
        }
        steam.current.instanceMatrix.needsUpdate = true;
        (steam.current.material as MeshStandardMaterial).opacity = Math.sin(p * Math.PI) * 0.28;
      }
    }
    if (guides.current) {
      for (let i = 0; i < GUIDES; i++) {
        const row = Math.floor(i / 2);
        const v = open * Math.pow(Math.max(0, Math.sin(row * 0.7 - rt.time * 5)), 4);
        guides.current.setColorAt(i, tmp.copy(themeColor).multiplyScalar(0.15 + 3 * v));
      }
      if (guides.current.instanceColor) guides.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Bulkhead wall with the octagonal opening */}
      <mesh geometry={res.wall} material={mats.wall} position={[0, 0, DOOR.z]} />
      {/* Chunky frame protruding into the cockpit */}
      <mesh geometry={res.frame} material={mats.frame} position={[0, 0, DOOR.z - 0.1]} />
      <mesh geometry={res.glow} material={mats.glow} position={[0, 0, DOOR.z - 0.135]} />
      {/* Work lights on the cockpit side so the door reads as heavy metal */}
      <pointLight color="#ffe2c4" position={[0.7, CY + 0.9, DOOR.z - 0.9]} intensity={3.5} distance={3.2} decay={1.6} />
      <pointLight color="#9fdcff" position={[-0.8, CY - 0.6, DOOR.z - 0.7]} intensity={1.6} distance={2.6} decay={1.6} />
      {/* Hazard sill */}
      <mesh position={[0, FLOOR_Y + 0.02, DOOR.z + 0.2]}>
        <boxGeometry args={[DOOR.width, 0.04, 0.7]} />
        <meshStandardMaterial color="#d99a06" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Status lamp + sign */}
      <mesh position={[0, CY + HH + 0.24, DOOR.z - 0.14]}>
        <boxGeometry args={[0.32, 0.06, 0.04]} />
        <meshStandardMaterial ref={lamp} color="#000" emissive="#ff2a2a" emissiveIntensity={4} toneMapped={false} />
      </mesh>
      <mesh position={[0, CY + HH + 0.5, DOOR.z - 0.11]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.1, 0.275]} />
        <meshStandardMaterial color="#000" emissive="#ffffff" emissiveMap={res.sign} emissiveIntensity={1.1} />
      </mesh>

      {/* Leaves, recessed inside the wall thickness */}
      {(['L', 'R'] as const).map((k) => (
        <group key={k} ref={k === 'L' ? left : right}>
          <group position={[0, CY, DOOR.z + 0.17]}>
            <mesh geometry={k === 'L' ? res.leafL : res.leafR} material={mats.leaf} />
            {[-0.7, -0.2, 0.3, 0.8].map((y) => (
              <mesh key={y} material={mats.dark} position={[(k === 'L' ? -1 : 1) * 0.36, y, -0.004]}>
                <boxGeometry args={[0.42, 0.025, 0.01]} />
              </mesh>
            ))}
            <mesh material={mats.glow} position={[(k === 'L' ? -1 : 1) * 0.2, 0, -0.006]}>
              <boxGeometry args={[0.015, 1.5, 0.008]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* Seam light (only while sealed) */}
      <group ref={seam} position={[0, CY, DOOR.z + 0.15]}>
        {SEAM.slice(1).map(([x1, y1], i) => {
          const [x0, y0] = SEAM[i];
          const len = Math.hypot(x1 - x0, y1 - y0);
          return (
            <mesh key={i} position={[(x0 + x1) / 2, (y0 + y1) / 2, 0]} rotation={[0, 0, Math.atan2(y1 - y0, x1 - x0)]}>
              <boxGeometry args={[len, 0.012, 0.01]} />
              <meshStandardMaterial color="#000" emissive="#ff2a2a" toneMapped={false} />
            </mesh>
          );
        })}
      </group>
      {/* Lock bars that retract into the frame */}
      {[CY - 0.35, CY + 0.55].flatMap((y, bi) =>
        [-1, 1].map((s) => (
          <group key={`${bi}${s}`} ref={(g) => { if (g) bars.current[bi * 2 + (s > 0 ? 1 : 0)] = g; }}>
            <mesh material={mats.brass} position={[s * (HW / 2 + 0.02), y, DOOR.z + 0.06]}>
              <boxGeometry args={[HW + 0.08, 0.11, 0.07]} />
            </mesh>
          </group>
        )),
      )}
      {/* Steam burst */}
      <instancedMesh ref={steam} args={[undefined, undefined, STEAM]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#cfe0ea" map={res.dot} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>

      {/* Corridor */}
      <group>
        <mesh material={mats.corridor} position={[0, FLOOR_Y, (CORRIDOR.start + CORRIDOR.end) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CORRIDOR.width, CORRIDOR.end - CORRIDOR.start]} />
        </mesh>
        <mesh material={mats.corridor} position={[0, FLOOR_Y + CORRIDOR.height, (CORRIDOR.start + CORRIDOR.end) / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CORRIDOR.width, CORRIDOR.end - CORRIDOR.start]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={mats.corridor} position={[s * (CORRIDOR.width / 2), FLOOR_Y + CORRIDOR.height / 2, (CORRIDOR.start + CORRIDOR.end) / 2]} rotation={[0, -s * (Math.PI / 2), 0]}>
            <planeGeometry args={[CORRIDOR.end - CORRIDOR.start, CORRIDOR.height]} />
          </mesh>
        ))}
        <instancedMesh ref={ribs} args={[undefined, undefined, RIBS * 3]} material={mats.frame}>
          <boxGeometry args={[1, 1, 1]} />
        </instancedMesh>
        <instancedMesh ref={strips} args={[undefined, undefined, RIBS * 2]} material={mats.glow}>
          <boxGeometry args={[1, 1, 1]} />
        </instancedMesh>
        <instancedMesh ref={guides} args={[undefined, undefined, GUIDES]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        <pointLight color="#ffc58f" position={[0, FLOOR_Y + 2.2, (CORRIDOR.start + CORRIDOR.end) / 2]} intensity={4} distance={6} decay={1.6} />
      </group>
    </group>
  );
}
