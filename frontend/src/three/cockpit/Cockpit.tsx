import { RoundedBox } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  MathUtils,
  MeshStandardMaterial,
  Vector3,
  type Group,
  type Mesh,
  type PointLight,
} from 'three';
import { audio } from '../../core/audio';
import { PREFLIGHT } from '../../core/content';
import { pulse, setHolding, toggleSystem } from '../../core/director';
import { damp } from '../../core/math';
import { rt } from '../../core/runtime';
import { SYSTEM_ORDER, useNova, type SystemKey } from '../../core/store';
import { accentHex } from '../../core/theme';
import { ARCH_LEFT } from './layout';
import { createScreen, drawScreen, loadScreenFonts, type Screen } from './screens';

/**
 * The pilot's cockpit in ship-local space (eye at origin, forward -Z).
 * The instrument face is a slanted cylinder band around the pilot: radius FACE_TOP at y TOP_Y down to FACE_BOT at BOT_Y.
 */
const TOP_Y = -0.24;
const BOT_Y = -0.66;
const FACE_TOP = 0.88;
const FACE_BOT = 0.62;
const TILT = Math.atan((FACE_TOP - FACE_BOT) / (TOP_Y - BOT_Y));
const ARC = MathUtils.degToRad(200);

/** Point on the instrument face at yaw (deg, negative = left) and height y, nudged toward the pilot. */
function onFace(yawDeg: number, y: number, inset = 0.006): { pos: [number, number, number]; rot: [number, number, number] } {
  const r = FACE_TOP - ((TOP_Y - y) / (TOP_Y - BOT_Y)) * (FACE_TOP - FACE_BOT) - inset;
  const a = MathUtils.degToRad(yawDeg);
  return { pos: [Math.sin(a) * r, y, -Math.cos(a) * r], rot: [-TILT, -a, 0] };
}

const MFD_YAW = [-20, 0, 20];
const MFD_Y = -0.37;
const SWITCH_YAW = [-33, -38.5, -44];
const SWITCH_Y = -0.35;

const hull = new MeshStandardMaterial({ color: '#141a24', metalness: 0.75, roughness: 0.42 });
const panel = new MeshStandardMaterial({ color: '#0a0e15', metalness: 0.4, roughness: 0.75, side: DoubleSide });
const rubber = new MeshStandardMaterial({ color: '#07090c', roughness: 0.95 });
const trim = new MeshStandardMaterial({ color: '#000000', emissive: new Color('#ff2a2a'), emissiveIntensity: 2 });

const RED = new Color('#ff2a2a');
const CYAN = new Color('#22d3ee');
/** Trim colour once powered: cyan, or the pilot's own colour once they have a profile. */
let trimHex = '#22d3ee';

export default function Cockpit() {
  useEffect(() => {
    loadScreenFonts();
  }, []);

  useFrame(() => {
    // Emergency red → powered cyan on every light strip.
    const nova = useNova.getState();
    const want = nova.isLoggedIn ? accentHex(nova.themeColor) : '#22d3ee';
    if (want !== trimHex) {
      trimHex = want;
      CYAN.set(want);
    }
    trim.emissive.copy(RED).lerp(CYAN, Math.min(1, rt.power));
    trim.emissiveIntensity = 0.6 + 2.4 * Math.max(rt.power, rt.emergency * (0.55 + 0.45 * Math.sin(rt.time * 2.4)));
  });

  return (
    <group>
      <Shell />
      <Canopy />
      {MFD_YAW.map((yaw, i) => (
        <Mfd key={i} index={i} yaw={yaw} />
      ))}
      {SYSTEM_ORDER.map((k, i) => (
        <Switch key={k} sys={k} yaw={SWITCH_YAW[i]} />
      ))}
      <Throttle />
      <Reactor />
      <Charm />
      <Lights />
    </group>
  );
}

function Shell() {
  const strip = useMemo(() => {
    const pts: Vector3[] = [];
    for (let k = 0; k <= 40; k++) {
      const a = -ARC / 2 + (ARC * k) / 40;
      pts.push(new Vector3(Math.sin(a) * (FACE_TOP + 0.005), TOP_Y + 0.004, -Math.cos(a) * (FACE_TOP + 0.005)));
    }
    return new CatmullRomCurve3(pts);
  }, []);
  return (
    <group>
      {/* Instrument face */}
      <mesh material={panel} position={[0, (TOP_Y + BOT_Y) / 2, 0]}>
        <cylinderGeometry args={[FACE_TOP, FACE_BOT, TOP_Y - BOT_Y, 64, 1, true, Math.PI - ARC / 2, ARC]} />
      </mesh>
      {/* Glare-shield lip */}
      <mesh material={hull} position={[0, TOP_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[FACE_TOP, 1.35, 64, 1, Math.PI / 2 - ARC / 2, ARC]} />
      </mesh>
      <mesh material={trim}>
        <tubeGeometry args={[strip, 80, 0.0035, 6, false]} />
      </mesh>
      {/* Knee well under the face */}
      <mesh material={rubber} position={[0, BOT_Y - 0.25, 0]}>
        <cylinderGeometry args={[FACE_BOT, 0.5, 0.5, 48, 1, true, Math.PI - ARC / 2, ARC]} />
      </mesh>
      {/* Side consoles */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.72, -0.52, -0.05]} rotation={[0, 0, s * 0.35]}>
          <RoundedBox args={[0.3, 0.06, 0.7]} radius={0.015} material={hull} />
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[((i % 3) - 1) * 0.07, 0.033, -0.25 + Math.floor(i / 3) * 0.12]} material={i % 5 === 0 ? trim : rubber}>
              <boxGeometry args={[0.035, 0.012, 0.035]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* The ship's nose beyond the glare shield */}
      <mesh material={hull} position={[0, -1.05, -2.7]} scale={[0.62, 0.34, 1.7]}>
        <sphereGeometry args={[1, 40, 20]} />
      </mesh>
      <mesh material={trim} position={[0, -0.72, -3.6]}>
        <sphereGeometry args={[0.018, 8, 8]} />
      </mesh>
    </group>
  );
}

function Canopy() {
  const { arch, hoop, sills } = useMemo(() => {
    const left = ARCH_LEFT.map(([x, y, z]) => new Vector3(x, y, z));
    const right = [...ARCH_LEFT].reverse().slice(1).map(([x, y, z]) => new Vector3(-x, y, z));
    const archCurve = new CatmullRomCurve3([...left, ...right]);
    const hoopCurve = new CatmullRomCurve3([
      new Vector3(-0.8, -0.3, 0.3),
      new Vector3(-0.76, 0.28, 0.3),
      new Vector3(-0.42, 0.6, 0.3),
      new Vector3(0, 0.68, 0.3),
      new Vector3(0.42, 0.6, 0.3),
      new Vector3(0.76, 0.28, 0.3),
      new Vector3(0.8, -0.3, 0.3),
    ]);
    const sillCurves = [-1, 1].map(
      (s) => new CatmullRomCurve3([new Vector3(s * 0.7, -0.27, -0.735), new Vector3(s * 0.8, -0.28, -0.2), new Vector3(s * 0.8, -0.3, 0.4)]),
    );
    const spine = new CatmullRomCurve3([new Vector3(0, 0.588, -0.56), new Vector3(0, 0.66, -0.1), new Vector3(0, 0.68, 0.3)]);
    return { arch: archCurve, hoop: hoopCurve, sills: [...sillCurves, spine] };
  }, []);
  return (
    <group>
      <mesh material={hull}>
        <tubeGeometry args={[arch, 120, 0.045, 10, false]} />
      </mesh>
      <mesh material={trim} position={[0, 0, 0.03]} scale={[0.985, 0.985, 0.985]}>
        <tubeGeometry args={[arch, 120, 0.006, 6, false]} />
      </mesh>
      <mesh material={hull}>
        <tubeGeometry args={[hoop, 80, 0.05, 10, false]} />
      </mesh>
      {sills.map((c, i) => (
        <mesh key={i} material={hull}>
          <tubeGeometry args={[c, 40, 0.035, 8, false]} />
        </mesh>
      ))}
    </group>
  );
}

function setHover(on: boolean) {
  document.body.style.cursor = on ? 'pointer' : '';
}

function Mfd({ index, yaw }: { index: number; yaw: number }) {
  const screen = useMemo<Screen>(() => createScreen(), []);
  const mat = useRef<MeshStandardMaterial>(null);
  const acc = useRef(1);
  const { pos, rot } = onFace(yaw, MFD_Y, 0.012);

  useEffect(() => () => screen.texture.dispose(), [screen]);

  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current > 0.1) {
      acc.current = 0;
      drawScreen(screen, index, rt.time);
    }
    if (mat.current) {
      const st = useNova.getState();
      const hot = st.hoverPillar === index || st.activePillar === index;
      mat.current.emissiveIntensity = damp(mat.current.emissiveIntensity, hot ? 1.9 : 1.1, 8, dt);
    }
  });

  const interactive = () => {
    const p = useNova.getState().phase;
    return p === 'landed' || p === 'arrive';
  };

  return (
    <group position={pos} rotation={rot}>
      <RoundedBox args={[0.33, 0.21, 0.02]} radius={0.008} position={[0, 0, -0.012]} material={hull} />
      {[-1, 1].flatMap((s) =>
        [0, 1, 2, 3].map((k) => (
          <mesh key={`${s}${k}`} position={[s * 0.152, -0.06 + k * 0.04, 0]} material={rubber}>
            <boxGeometry args={[0.016, 0.022, 0.01]} />
          </mesh>
        )),
      )}
      <mesh
        onPointerOver={(e) => {
          if (!interactive()) return;
          e.stopPropagation();
          setHover(true);
          useNova.getState().setHoverPillar(index);
        }}
        onPointerOut={() => {
          setHover(false);
          if (useNova.getState().hoverPillar === index) useNova.getState().setHoverPillar(null);
        }}
        onClick={(e) => {
          if (!interactive()) return;
          e.stopPropagation();
          audio.play('click');
          useNova.getState().setActivePillar(index);
        }}
      >
        <planeGeometry args={[0.28, 0.175]} />
        <meshStandardMaterial ref={mat} color="#000000" emissive="#ffffff" emissiveMap={screen.texture} emissiveIntensity={1.1} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Switch({ sys, yaw }: { sys: SystemKey; yaw: number }) {
  const lever = useRef<Group>(null);
  const guard = useRef<Group>(null);
  const led = useRef<MeshStandardMaterial>(null);
  const hovered = useRef(false);
  const { pos, rot } = onFace(yaw, SWITCH_Y, 0.0);

  useFrame((_, dt) => {
    const st = useNova.getState();
    const on = st.systems[sys];
    const next = st.phase === 'preflight' && SYSTEM_ORDER.find((k) => !st.systems[k]) === sys;
    if (lever.current) lever.current.rotation.x = damp(lever.current.rotation.x, on ? -0.7 : 0.7, 14, dt);
    if (guard.current) guard.current.rotation.x = damp(guard.current.rotation.x, on || next || hovered.current ? -1.9 : 0, 10, dt);
    if (led.current) {
      const blink = 0.5 + 0.5 * Math.sin(rt.time * 6);
      led.current.emissive.set(on ? '#34d399' : next ? '#f59e0b' : '#ff2a2a');
      led.current.emissiveIntensity = on ? 3 : next ? 1 + 3 * blink : 0.5;
    }
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    toggleSystem(sys);
  };

  return (
    <group position={pos} rotation={rot}>
      <RoundedBox args={[0.055, 0.085, 0.018]} radius={0.004} material={hull} />
      <mesh position={[0, 0.032, 0.012]}>
        <sphereGeometry args={[0.006, 10, 10]} />
        <meshStandardMaterial ref={led} color="#000" emissive="#ff2a2a" toneMapped={false} />
      </mesh>
      <group ref={lever} position={[0, -0.008, 0.01]}>
        <mesh position={[0, 0, 0.022]} rotation={[Math.PI / 2, 0, 0]} material={hull}>
          <cylinderGeometry args={[0.004, 0.005, 0.045, 10]} />
        </mesh>
        <mesh position={[0, 0, 0.046]}>
          <sphereGeometry args={[0.008, 12, 12]} />
          <meshStandardMaterial color="#d7dde6" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>
      <group ref={guard} position={[0, 0.03, 0.012]}>
        <mesh position={[0, -0.035, 0.026]}>
          <boxGeometry args={[0.04, 0.07, 0.05]} />
          <meshStandardMaterial color="#ff3030" transparent opacity={0.45} roughness={0.2} emissive="#ff1a1a" emissiveIntensity={0.25} />
        </mesh>
      </group>
      {/* Generous invisible hit box */}
      <mesh
        position={[0, 0, 0.03]}
        onClick={click}
        onPointerOver={(e) => {
          if (useNova.getState().phase !== 'preflight' || useNova.getState().systems[sys]) return;
          e.stopPropagation();
          hovered.current = true;
          setHover(true);
        }}
        onPointerOut={() => {
          hovered.current = false;
          setHover(false);
        }}
      >
        <boxGeometry args={[0.07, 0.12, 0.07]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <Label text={PREFLIGHT.items[sys].switchLabel} />
    </group>
  );
}

/** Tiny emissive label plate under a switch. */
function Label({ text }: { text: string }) {
  const tex = useMemo(() => {
    const s = createScreen();
    s.canvas.width = 256;
    s.canvas.height = 48;
    s.ctx.fillStyle = '#05080c';
    s.ctx.fillRect(0, 0, 256, 48);
    s.ctx.fillStyle = '#9fe9f7';
    s.ctx.font = '600 26px "JetBrains Mono Variable", monospace';
    s.ctx.textAlign = 'center';
    s.ctx.fillText(text, 128, 33);
    s.texture.needsUpdate = true;
    return s.texture;
  }, [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, -0.058, 0.002]}>
      <planeGeometry args={[0.066, 0.0124]} />
      <meshStandardMaterial color="#000" emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.7} />
    </mesh>
  );
}

function Throttle() {
  const lever = useRef<Group>(null);
  const grip = useRef<MeshStandardMaterial>(null);
  const { pos, rot } = onFace(36, -0.47, 0.0);

  useFrame((_, dt) => {
    const st = useNova.getState();
    const forward = st.phase === 'launch' || st.phase === 'warp' ? 1 : st.phase === 'arrive' ? 0.6 : rt.charge;
    if (lever.current) lever.current.rotation.x = damp(lever.current.rotation.x, -0.2 - 0.9 * forward, 10, dt);
    if (grip.current) {
      const armed = st.phase === 'preflight' && st.cleared;
      grip.current.emissiveIntensity = armed ? 1.5 + 1.5 * Math.sin(rt.time * 5) + 3 * rt.charge : 0.3 + rt.power * 0.4;
    }
  });

  const down = (e: ThreeEvent<PointerEvent>) => {
    const st = useNova.getState();
    if (st.phase !== 'preflight' || !st.cleared) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setHolding(true);
  };
  const up = () => setHolding(false);

  return (
    <group position={pos} rotation={rot}>
      <RoundedBox args={[0.08, 0.16, 0.03]} radius={0.008} material={hull} />
      <group ref={lever} position={[0, -0.04, 0.02]}>
        <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]} material={hull}>
          <cylinderGeometry args={[0.008, 0.01, 0.14, 12]} />
        </mesh>
        <mesh
          position={[0, 0, 0.145]}
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={up}
          onLostPointerCapture={up}
          onPointerOver={() => useNova.getState().cleared && setHover(true)}
          onPointerOut={() => setHover(false)}
        >
          <capsuleGeometry args={[0.018, 0.04, 6, 12]} />
          <meshStandardMaterial ref={grip} color="#0c1a22" emissive="#22d3ee" emissiveIntensity={0.3} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function Reactor() {
  const core = useRef<Mesh>(null);
  const ringA = useRef<Mesh>(null);
  const ringB = useRef<Mesh>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const spin = useRef(0);
  const { pos, rot } = onFace(0, -0.55, 0.06);

  useFrame((_, dt) => {
    const energy = rt.core + rt.charge + rt.pulse;
    spin.current += dt * (0.3 + 3 * rt.core + 6 * rt.charge);
    if (core.current) core.current.rotation.set(spin.current * 0.7, spin.current, 0);
    if (ringA.current) ringA.current.rotation.set(Math.PI / 2, 0, spin.current * 1.3);
    if (ringB.current) ringB.current.rotation.set(0.6, spin.current * -1.6, 0);
    if (mat.current) {
      mat.current.emissive.set(rt.core > 0.05 ? '#22d3ee' : '#f59e0b');
      mat.current.emissiveIntensity = 0.4 + 3 * energy;
    }
  });

  return (
    <group position={pos} rotation={rot}>
      <group
        onClick={(e) => {
          if (useNova.getState().phase !== 'landed') return;
          e.stopPropagation();
          pulse();
          audio.play('pulse');
        }}
      >
        <mesh ref={core}>
          <icosahedronGeometry args={[0.032, 0]} />
          <meshStandardMaterial ref={mat} color="#001018" emissive="#f59e0b" emissiveIntensity={0.4} flatShading toneMapped={false} />
        </mesh>
        <mesh ref={ringA}>
          <torusGeometry args={[0.05, 0.002, 6, 48]} />
          <meshStandardMaterial color="#000" emissive="#67e8f9" emissiveIntensity={1.5} />
        </mesh>
        <mesh ref={ringB}>
          <torusGeometry args={[0.058, 0.0015, 6, 48]} />
          <meshStandardMaterial color="#000" emissive="#a855f7" emissiveIntensity={1.2} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.068, 0.068, 0.13, 32, 1, true]} />
          <meshStandardMaterial color="#9fe9f7" transparent opacity={0.08} roughness={0.05} metalness={0.2} side={DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/** A little glowing NOVA star dangling from the canopy — a damped pendulum that swings with the ship. */
function Charm() {
  const pivot = useRef<Group>(null);
  const sim = useRef({ ax: 0, vx: 0, az: 0, vz: 0, lastSpeed: 0, lastApproach: 0 });
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = sim.current;
    // Forward acceleration (launch, arrival braking) pushes the charm back / forward.
    const accel = (rt.shipSpeed - s.lastSpeed) / Math.max(dt, 1e-3) + ((rt.approach - s.lastApproach) / Math.max(dt, 1e-3)) * -40;
    s.lastSpeed = rt.shipSpeed;
    s.lastApproach = rt.approach;
    const force = MathUtils.clamp(accel * 0.0006, -0.9, 0.9);
    const jitter = rt.shake * (Math.random() - 0.5) * 6;
    s.vx += (-30 * s.ax - 2.2 * s.vx + force * 30 + jitter) * dt;
    s.ax += s.vx * dt;
    s.vz += (-30 * s.az - 2.2 * s.vz + (rt.yaw - s.az) * 3 + jitter) * dt;
    s.az += s.vz * dt;
    if (pivot.current) pivot.current.rotation.set(s.ax, 0, s.az);
  });
  return (
    <group ref={pivot} position={[-0.3, 0.5, -0.6]}>
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.0008, 0.0008, 0.16, 4]} />
        <meshBasicMaterial color="#334155" />
      </mesh>
      <mesh position={[0, -0.17, 0]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.016, 0]} />
        <meshStandardMaterial color="#000" emissive="#67e8f9" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Lights() {
  const red = useRef<PointLight>(null);
  const cyan = useRef<PointLight>(null);
  useFrame(() => {
    if (red.current) red.current.intensity = rt.emergency * (0.6 + 0.4 * Math.sin(rt.time * 2.4)) * 2.2;
    if (cyan.current) cyan.current.intensity = rt.power * 1.4;
  });
  return (
    <>
      <pointLight ref={red} color="#ff2a2a" position={[0, 0.45, 0.25]} distance={3} decay={1.5} />
      <pointLight ref={cyan} color="#5eead4" position={[0, -0.15, -0.45]} distance={2} decay={1.5} />
      <pointLight color="#8fb3c9" position={[0, 0.3, 0.6]} intensity={0.15} distance={3} />
    </>
  );
}
