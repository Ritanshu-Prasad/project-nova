import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { MeshStandardMaterial, type Group, type Mesh } from 'three';
import { audio } from '../../core/audio';
import { petSignal } from '../../core/hub';
import { holoBurst } from '../../core/journey';
import { damp } from '../../core/math';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';
import { ARRIVE_Z, PET_HOME } from './layout';

const PET_NAME = 'Pixel';
/** Yaw that points the pug's nose (+Z) at the pilot's arrival spot. */
const FACE_CAMERA = Math.atan2(0 - PET_HOME[0], ARRIVE_Z - PET_HOME[2]);
const LINES = ['wags happily', 'does a zero-g barrel roll', 'boops the hologram', 'wants you to keep studying'];

/** "Pixel", the crew's astronaut pug: floats, paddles, blinks, follows your cursor and loves attention. */
export default function Pet() {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const tail = useRef<Mesh>(null);
  const legs = useRef<(Group | null)[]>([]);
  const ears = useRef<(Mesh | null)[]>([]);
  const eyes = useRef<(Group | null)[]>([]);
  const antenna = useRef<MeshStandardMaterial>(null);
  const st = useRef({ spin: 0, hover: false, blinkAt: 2, pokes: 0, cheers: petSignal.cheers });

  const m = useMemo(
    () => ({
      suit: new MeshStandardMaterial({ color: '#e8692c', roughness: 0.65, metalness: 0.05 }),
      white: new MeshStandardMaterial({ color: '#e9edf2', roughness: 0.5, metalness: 0.1 }),
      fur: new MeshStandardMaterial({ color: '#d4a373', roughness: 0.85 }),
      mask: new MeshStandardMaterial({ color: '#2b1d16', roughness: 0.8 }),
      gloss: new MeshStandardMaterial({ color: '#070707', roughness: 0.08, metalness: 0.2 }),
      shine: new MeshStandardMaterial({ color: '#fff', emissive: '#ffffff', emissiveIntensity: 1.5 }),
      tongue: new MeshStandardMaterial({ color: '#f472b6', roughness: 0.4 }),
      glass: new MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.4, depthWrite: false }),
    }),
    [],
  );
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const t = rt.time;
    const s = st.current;
    // Celebrate correct answers / cleared planets.
    if (petSignal.cheers !== s.cheers) {
      s.cheers = petSignal.cheers;
      s.spin = 1;
    }
    if (root.current) {
      root.current.position.set(
        PET_HOME[0] + Math.sin(t * 0.31) * 0.28,
        PET_HOME[1] + Math.sin(t * 1.15) * 0.09,
        PET_HOME[2] + Math.sin(t * 0.23) * 0.22,
      );
      s.spin = damp(s.spin, 0, 2.2, dt);
      root.current.rotation.set(Math.sin(t * 0.6) * 0.07, FACE_CAMERA + Math.sin(t * 0.27) * 0.25, Math.sin(t * 0.8) * 0.09);
    }
    if (body.current) body.current.rotation.z = s.spin * Math.PI * 2;
    if (head.current) {
      // Follow the cursor (and perk up when hovered).
      head.current.rotation.y = damp(head.current.rotation.y, -rt.lookX * 0.55, 5, dt);
      head.current.rotation.x = damp(head.current.rotation.x, rt.lookY * 0.35 - (s.hover ? 0.15 : 0), 5, dt);
      head.current.rotation.z = Math.sin(t * 0.9) * 0.08;
    }
    legs.current.forEach((g, i) => {
      if (g) g.rotation.x = Math.sin(t * 4.2 + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.8 : 0)) * 0.55;
    });
    if (tail.current) tail.current.rotation.y = Math.sin(t * (s.hover ? 16 : 7)) * 0.5;
    ears.current.forEach((e, i) => {
      if (e) e.rotation.z = (i ? -1 : 1) * (0.55 + (s.hover ? -0.35 : 0) + Math.sin(t * 2.1 + i) * 0.1);
    });
    if (t > s.blinkAt) s.blinkAt = t + 2.2 + Math.random() * 3.5;
    const blink = s.blinkAt - t < 0.12 ? 0.1 : 1;
    eyes.current.forEach((e) => e && (e.scale.y = blink));
    if (antenna.current) antenna.current.emissiveIntensity = 1 + 3 * (Math.sin(t * 5) > 0.6 ? 1 : 0);
  });

  const poke = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const s = st.current;
    s.spin = 1;
    s.pokes += 1;
    holoBurst(0.6);
    audio.play('quest');
    useNova.getState().notify({ kind: 'toast', title: PET_NAME, lines: [`${PET_NAME} ${LINES[s.pokes % LINES.length]}.`] });
  };

  return (
    <group ref={root} scale={1.5}>
      {/* Generous invisible hit area */}
      <mesh
        onClick={poke}
        onPointerOver={(e) => {
          e.stopPropagation();
          st.current.hover = true;
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          st.current.hover = false;
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.36, 12, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <group ref={body}>
        {/* Suit */}
        <mesh material={m.suit} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.12, 0.2, 8, 16]} />
        </mesh>
        <mesh material={m.white} position={[0, 0.14, -0.04]}>
          <boxGeometry args={[0.17, 0.09, 0.2]} />
        </mesh>
        <mesh position={[0.05, 0.2, -0.1]}>
          <cylinderGeometry args={[0.004, 0.004, 0.09, 6]} />
          <meshStandardMaterial color="#9aa3ad" />
        </mesh>
        <mesh position={[0.05, 0.25, -0.1]}>
          <sphereGeometry args={[0.014, 10, 10]} />
          <meshStandardMaterial ref={antenna} color="#000" emissive="#ff2a2a" toneMapped={false} />
        </mesh>
        <mesh material={m.white} position={[0, 0.03, 0.15]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.105, 0.022, 10, 32]} />
        </mesh>
        {/* Legs with boots, paddling */}
        {[
          [0.075, 0.1],
          [-0.075, 0.1],
          [0.075, -0.1],
          [-0.075, -0.1],
        ].map(([x, z], i) => (
          <group key={i} ref={(g) => { legs.current[i] = g; }} position={[x, -0.07, z]}>
            <mesh material={m.suit} position={[0, -0.04, 0]}>
              <capsuleGeometry args={[0.04, 0.06, 6, 10]} />
            </mesh>
            <mesh material={m.white} position={[0, -0.1, 0.01]}>
              <sphereGeometry args={[0.045, 12, 12]} />
            </mesh>
          </group>
        ))}
        <mesh ref={tail} material={m.fur} position={[0, 0.06, -0.19]} rotation={[0.4, 0, 0]}>
          <torusGeometry args={[0.035, 0.016, 8, 16, Math.PI * 1.5]} />
        </mesh>
        {/* Head inside the helmet */}
        <group ref={head} position={[0, 0.07, 0.25]}>
          <mesh material={m.fur} scale={[1.05, 0.95, 0.95]}>
            <sphereGeometry args={[0.13, 24, 20]} />
          </mesh>
          <mesh material={m.mask} position={[0, -0.035, 0.095]} scale={[1.2, 0.85, 0.75]}>
            <sphereGeometry args={[0.075, 20, 16]} />
          </mesh>
          <mesh material={m.gloss} position={[0, -0.008, 0.16]}>
            <sphereGeometry args={[0.022, 12, 12]} />
          </mesh>
          <mesh material={m.tongue} position={[0.015, -0.078, 0.13]} scale={[1, 0.6, 1.2]}>
            <sphereGeometry args={[0.02, 10, 10]} />
          </mesh>
          {[-1, 1].map((sx, i) => (
            <group key={sx} ref={(g) => { eyes.current[i] = g; }} position={[sx * 0.056, 0.03, 0.1]}>
              <mesh material={m.gloss}>
                <sphereGeometry args={[0.033, 16, 16]} />
              </mesh>
              <mesh material={m.shine} position={[sx * 0.008 + 0.006, 0.012, 0.027]}>
                <sphereGeometry args={[0.008, 8, 8]} />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((sx, i) => (
            <mesh key={sx} ref={(e) => { ears.current[i] = e; }} material={m.mask} position={[sx * 0.11, 0.085, 0]} scale={[0.6, 1, 0.35]}>
              <sphereGeometry args={[0.05, 12, 12]} />
            </mesh>
          ))}
          <mesh material={m.glass}>
            <sphereGeometry args={[0.215, 32, 24]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

