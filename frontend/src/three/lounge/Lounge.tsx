import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MathUtils,
  MeshStandardMaterial,
  ShaderMaterial,
  type Group,
  type Mesh,
  type PointLight,
} from 'three';
import { currentQuality, fbmDefines } from '../../core/graphics';
import { useHub } from '../../core/hub';
import { useDeck } from '../../core/journey';
import { accentHex } from '../../core/theme';
import { damp } from '../../core/math';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';
import { NOISE_GLSL } from '../shaders/noise';
import Door from './Door';
import { FLOOR_Y, HOLO_CENTER, LOUNGE, TABLE, plateTexture, signTexture, softDot } from './layout';
import Pet from './Pet';
import { seededRandom } from '../../core/seeded';

const [CX, , CZ] = LOUNGE.center;
const A = LOUNGE.apothem;
const H = LOUNGE.height;
const W = 2 * A * Math.tan(Math.PI / 8);
const RC = A / Math.cos(Math.PI / 8);
const DEG = Math.PI / 180;
const WINDOW_WALLS = [7, 0, 1];
const DOOR_WALL = 4;

/** Point on the room's wall ring at angle θ (0 = far wall, +Z). */
const ring = (theta: number, r: number, y = FLOOR_Y): [number, number, number] => [CX + Math.sin(theta) * r, y, CZ + Math.cos(theta) * r];

/** The crew common area behind the cockpit — "Cosmic Lounge · Deck 7". */
export default function Lounge() {
  const deck = useDeck((s) => s.deck);
  return (
    <group visible={deck !== 'cockpit'} userData={{ world: 'lounge' }}>
      <Door />
      <Room />
      <HoloTable />
      <Hologram />
      <Dust />
      <Shards />
      <Drifters />
      <Pet />
      <LoungeLights />
    </group>
  );
}

function Room() {
  const res = useMemo(
    () => ({
      floor: plateTexture('#3a2e26', 'rgba(0,0,0,0.6)', [6, 6]),
      wall: plateTexture('#3b2c22', 'rgba(0,0,0,0.5)', [2.5, 1.7]),
      sign: signTexture('COSMIC LOUNGE', '— DECK 7 —'),
    }),
    [],
  );
  useEffect(() => () => Object.values(res).forEach((t) => t.dispose()), [res]);
  const mats = useMemo(
    () => ({
      floor: new MeshStandardMaterial({ color: '#b39a86', map: res.floor, metalness: 0.7, roughness: 0.45 }),
      wall: new MeshStandardMaterial({ color: '#a7876d', map: res.wall, metalness: 0.6, roughness: 0.5 }),
      copper: new MeshStandardMaterial({ color: '#6b4430', metalness: 0.85, roughness: 0.32 }),
      ceiling: new MeshStandardMaterial({ color: '#1b1612', metalness: 0.6, roughness: 0.6, side: DoubleSide }),
      leather: new MeshStandardMaterial({ color: '#5a2f1f', metalness: 0.1, roughness: 0.55 }),
      cyan: new MeshStandardMaterial({ color: '#000', emissive: '#22d3ee', emissiveIntensity: 2.6, toneMapped: false }),
      amber: new MeshStandardMaterial({ color: '#000', emissive: '#ffb35c', emissiveIntensity: 2.2, toneMapped: false }),
      violet: new MeshStandardMaterial({ color: '#000', emissive: '#c084fc', emissiveIntensity: 2.2, toneMapped: false }),
    }),
    [res],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  // The pilot's colour lights the floor ring and neon tubes.
  const theme = accentHex(useNova((s) => s.themeColor));
  useEffect(() => {
    mats.cyan.emissive.set(theme);
  }, [mats, theme]);

  return (
    <group>
      <mesh material={mats.floor} position={[CX, FLOOR_Y, CZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[RC, 8, Math.PI / 8]} />
      </mesh>
      <mesh material={mats.ceiling} position={[CX, FLOOR_Y + H, CZ]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[RC, 8, Math.PI / 8]} />
      </mesh>
      {/* Floor light rings */}
      <mesh material={mats.cyan} position={[CX, FLOOR_Y + 0.005, CZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.05, 2.1, 64]} />
      </mesh>
      <mesh material={mats.amber} position={[CX, FLOOR_Y + 0.005, CZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[RC * 0.84, RC * 0.845, 8, 1, Math.PI / 8]} />
      </mesh>

      {Array.from({ length: 8 }, (_, k) => {
        const th = k * 45 * DEG;
        const [x, , z] = ring(th, A);
        const isWindow = WINDOW_WALLS.includes(k);
        return (
          <group key={k} position={[x, FLOOR_Y, z]} rotation={[0, th + Math.PI, 0]}>
            {isWindow ? (
              <>
                <mesh material={mats.wall} position={[0, 0.45, 0]}>
                  <boxGeometry args={[W, 0.9, 0.2]} />
                </mesh>
                <mesh material={mats.wall} position={[0, H - 0.3, 0]}>
                  <boxGeometry args={[W, 0.6, 0.2]} />
                </mesh>
                <mesh material={mats.copper} position={[0, 1.95, 0.06]}>
                  <boxGeometry args={[0.08, 2.2, 0.12]} />
                </mesh>
                <mesh material={mats.copper} position={[0, 0.92, 0.08]}>
                  <boxGeometry args={[W, 0.06, 0.2]} />
                </mesh>
                <mesh material={mats.cyan} position={[0, 0.96, 0.14]}>
                  <boxGeometry args={[W, 0.012, 0.012]} />
                </mesh>
              </>
            ) : k === DOOR_WALL ? (
              <>
                {[-1, 1].map((s) => (
                  <mesh key={s} material={mats.wall} position={[s * (W / 4 + 0.45), H / 2, 0]}>
                    <boxGeometry args={[W / 2 - 0.9, H, 0.2]} />
                  </mesh>
                ))}
                <mesh material={mats.wall} position={[0, (H + 2.6) / 2, 0]}>
                  <boxGeometry args={[1.8, H - 2.6, 0.2]} />
                </mesh>
              </>
            ) : (
              <>
                <mesh material={mats.wall} position={[0, H / 2, 0]}>
                  <boxGeometry args={[W, H, 0.2]} />
                </mesh>
                <mesh material={mats.amber} position={[0, H - 0.55, 0.11]}>
                  <boxGeometry args={[W * 0.86, 0.03, 0.01]} />
                </mesh>
                {/* Wall panel insets */}
                {[-1, 1].map((s) => (
                  <mesh key={s} material={mats.copper} position={[s * W * 0.22, 1.6, 0.1]}>
                    <boxGeometry args={[W * 0.36, 1.6, 0.04]} />
                  </mesh>
                ))}
              </>
            )}
            {/* Booths on the side walls */}
            {(k === 2 || k === 6) && (
              <group position={[0, 0, 0.55]}>
                <mesh material={mats.leather} position={[0, 0.25, 0.1]}>
                  <boxGeometry args={[3, 0.45, 0.65]} />
                </mesh>
                <mesh material={mats.leather} position={[0, 0.85, -0.18]}>
                  <boxGeometry args={[3, 0.85, 0.16]} />
                </mesh>
                <mesh material={mats.copper} position={[0, 0.72, 1.05]}>
                  <cylinderGeometry args={[0.5, 0.5, 0.04, 32]} />
                </mesh>
                <mesh material={mats.copper} position={[0, 0.36, 1.05]}>
                  <cylinderGeometry args={[0.05, 0.12, 0.72, 12]} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}

      {/* Corner columns with neon tubes */}
      {Array.from({ length: 8 }, (_, k) => {
        const th = (22.5 + k * 45) * DEG;
        const [x, , z] = ring(th, RC - 0.12);
        return (
          <group key={k} position={[x, FLOOR_Y, z]} rotation={[0, th + Math.PI, 0]}>
            <mesh material={mats.copper} position={[0, H / 2, 0]}>
              <boxGeometry args={[0.34, H, 0.34]} />
            </mesh>
            <mesh material={k % 3 === 1 ? mats.violet : mats.cyan} position={[0, H / 2, 0.19]}>
              <cylinderGeometry args={[0.022, 0.022, H - 0.4, 8]} />
            </mesh>
          </group>
        );
      })}

      {/* Sign + console desk under the window */}
      <mesh position={ring(45 * DEG, A - 0.12, FLOOR_Y + H - 0.3)} rotation={[0, 45 * DEG + Math.PI, 0]}>
        <planeGeometry args={[2.6, 0.65]} />
        <meshStandardMaterial color="#000" emissive="#ffffff" emissiveMap={res.sign} emissiveIntensity={1.1} />
      </mesh>
      <group position={[CX, FLOOR_Y, CZ + A - 0.75]}>
        <mesh material={mats.copper} position={[0, 0.42, 0]}>
          <boxGeometry args={[3.4, 0.84, 0.7]} />
        </mesh>
        {[-1.05, 0, 1.05].map((x, i) => (
          <mesh key={x} position={[x, 1.05, -0.05]} rotation={[-0.35, Math.PI, 0]}>
            <planeGeometry args={[0.85, 0.42]} />
            <meshStandardMaterial color="#000" emissive={i === 1 ? '#f59e0b' : theme} emissiveIntensity={0.45} />
          </mesh>
        ))}
      </group>

      {/* Ceiling light ring + beams */}
      <mesh material={mats.amber} position={[CX, FLOOR_Y + H - 0.22, CZ]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.35, 0.05, 8, 64]} />
      </mesh>
      {Array.from({ length: 4 }, (_, k) => (
        <mesh key={k} material={mats.copper} position={[CX, FLOOR_Y + H - 0.12, CZ]} rotation={[0, k * 45 * DEG, 0]}>
          <boxGeometry args={[0.16, 0.18, RC * 2]} />
        </mesh>
      ))}
    </group>
  );
}

function HoloTable() {
  const theme = accentHex(useNova((s) => s.themeColor));
  const brass = useMemo(() => new MeshStandardMaterial({ color: '#b8894f', metalness: 0.9, roughness: 0.28 }), []);
  useEffect(() => () => brass.dispose(), [brass]);
  // Railing posts on the octagon vertices, leaving a gap on the camera side.
  const posts = [22.5, 67.5, 112.5, 247.5, 292.5, 337.5].map((d) => d * DEG);
  const rails: [number, number][] = [[3, 4], [4, 5], [5, 0], [0, 1], [1, 2]];
  const R = 1.9;
  return (
    <group>
      <mesh position={[CX, FLOOR_Y + 0.29, CZ]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[1.32, TABLE.radius, 0.58, 8]} />
        <meshStandardMaterial color="#2a211c" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[CX, FLOOR_Y + 0.45, CZ]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[1.39, 1.39, 0.035, 8, 1, true]} />
        <meshStandardMaterial color="#000" emissive={theme} emissiveIntensity={2.4} toneMapped={false} side={DoubleSide} />
      </mesh>
      <group position={[CX, TABLE.top + 0.004, CZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <circleGeometry args={[1.3, 8, Math.PI / 8]} />
          <meshStandardMaterial color="#0b0d10" metalness={0.6} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <ringGeometry args={[1.08, 1.2, 8, 1, Math.PI / 8]} />
          <meshStandardMaterial color="#000" emissive="#ffb35c" emissiveIntensity={2} toneMapped={false} />
        </mesh>
        {[0.78, 0.38].map((r) => (
          <mesh key={r} position={[0, 0, 0.002]}>
            <ringGeometry args={[r, r + 0.035, 48]} />
            <meshStandardMaterial color="#000" emissive={theme} emissiveIntensity={2.6} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {posts.map((a, i) => (
        <mesh key={i} material={brass} position={[CX + Math.sin(a) * R, FLOOR_Y + 0.5, CZ + Math.cos(a) * R]}>
          <cylinderGeometry args={[0.03, 0.03, 1, 10]} />
        </mesh>
      ))}
      {rails.flatMap(([i0, i1]) =>
        [0.98, 0.6].map((h) => {
          const a0 = posts[i0];
          const a1 = posts[i1];
          const x0 = CX + Math.sin(a0) * R;
          const z0 = CZ + Math.cos(a0) * R;
          const x1 = CX + Math.sin(a1) * R;
          const z1 = CZ + Math.cos(a1) * R;
          const len = Math.hypot(x1 - x0, z1 - z0);
          return (
            <mesh key={`${i0}-${h}`} material={brass} position={[(x0 + x1) / 2, FLOOR_Y + h, (z0 + z1) / 2]} rotation={[0, Math.atan2(x1 - x0, z1 - z0), Math.PI / 2]}>
              <cylinderGeometry args={[0.022, 0.022, len, 8]} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

const HOLO_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec3 vView;
void main() {
  vP = position;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const HOLO_FRAG = /* glsl */ `
uniform float uTime;
uniform float uBoost;
uniform vec3 uColor;
varying vec3 vN;
varying vec3 vP;
varying vec3 vView;
${NOISE_GLSL}
void main() {
  vec3 p = normalize(vP);
  float fres = pow(max(1.0 - abs(dot(normalize(vN), normalize(vView))), 0.0), 2.2);
  // Clamp: float error at the poles would make asin() return NaN, and bloom spreads NaN over the whole frame.
  float lat = asin(clamp(p.y, -1.0, 1.0));
  // atan(0, 0) at the poles is NaN on D3D; nudge x off zero.
  float lon = atan(p.z, p.x + 1e-4);
  float grid = max(smoothstep(0.96, 1.0, abs(sin(lat * 9.0))), smoothstep(0.97, 1.0, abs(sin(lon * 9.0)))) * 0.35;
  // Dotted "continents".
  vec2 cell = vec2(lon * 24.0, lat * 24.0);
  float dots = smoothstep(0.32, 0.1, length(fract(cell) - 0.5)) * step(0.05, fbm3(p * 2.2 + 3.0));
  float scan = 0.6 + 0.4 * sin(vP.y * 60.0 - uTime * 4.0);
  float flicker = 0.92 + 0.08 * sin(uTime * 37.0) * sin(uTime * 13.0);
  float a = (fres * 0.9 + grid + dots * 0.8) * scan * flicker * (1.0 + uBoost * 1.5);
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

function Hologram() {
  // Walking up to the holo-table makes the globe swell a little.
  const focus = useHub((s) => s.station === 'lesson');
  const theme = accentHex(useNova((s) => s.themeColor));
  const group = useRef<Group>(null);
  const globe = useRef<Group>(null);
  const rings = useRef<Group>(null);
  const nodes = useRef<Group>(null);
  const beam = useRef<Mesh>(null);
  const t = useRef(0);

  const shell = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: HOLO_VERT,
        fragmentShader: HOLO_FRAG,
        uniforms: { uTime: { value: 0 }, uBoost: { value: 0 }, uColor: { value: new Color('#5eead4').multiplyScalar(1.6) } },
        defines: fbmDefines(),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );
  const dot = useMemo(() => softDot(), []);
  useEffect(() => () => (shell.dispose(), dot.dispose()), [shell, dot]);
  useEffect(() => {
    shell.uniforms.uColor.value.set(theme).multiplyScalar(1.6);
  }, [shell, theme]);

  const beamH = HOLO_CENTER[1] - TABLE.top;

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const boost = rt.holo;
    t.current += dt * (1 + boost * 4);
    shell.uniforms.uTime.value = rt.time;
    shell.uniforms.uBoost.value = boost;
    if (globe.current) globe.current.rotation.y = t.current * 0.35;
    if (rings.current) {
      const [a, b, c] = rings.current.children;
      a.rotation.z = t.current * 0.4;
      b.rotation.z = -t.current * 0.3;
      c.rotation.z = t.current * 0.22;
      const s = 1 + boost * 0.35;
      rings.current.scale.setScalar(s);
    }
    if (nodes.current) nodes.current.rotation.y = t.current * 0.5;
    if (group.current) {
      // When the feed opens, the globe floats up and shrinks to make room for the panels.
      const y = HOLO_CENTER[1];
      group.current.position.y = damp(group.current.position.y, y + Math.sin(rt.time * 1.1) * 0.03, 2.5, dt);
      const sc = damp(group.current.scale.x, focus ? 1.12 : 1, 2.5, dt);
      group.current.scale.setScalar(sc);
    }
    if (beam.current) (beam.current.material as MeshStandardMaterial).opacity = (focus ? 0.13 : 0.09) + boost * 0.12;
  });

  return (
    <group>
      <mesh ref={beam} position={[CX, TABLE.top + beamH / 2, CZ]}>
        <cylinderGeometry args={[0.62, 0.3, beamH, 32, 1, true]} />
        <meshStandardMaterial color="#000" emissive="#67e8f9" emissiveIntensity={1.5} transparent opacity={0.09} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <group ref={group} position={HOLO_CENTER}>
        <group ref={globe}>
          <mesh material={shell}>
            <sphereGeometry args={[0.5, 48, 32]} />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[0.53, 2]} />
            <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.18} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
        <mesh>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={new Color('#ffe2b0').multiplyScalar(4)} toneMapped={false} />
        </mesh>
        <sprite scale={[0.7, 0.7, 0.7]}>
          <spriteMaterial map={dot} color="#ffcf8a" transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
        <group ref={rings}>
          {[
            { r: 0.78, rot: [1.2, 0.2, 0] as const, c: '#ffb35c' },
            { r: 0.92, rot: [1.5, -0.5, 0] as const, c: '#67e8f9' },
            { r: 1.06, rot: [1.0, 0.7, 0] as const, c: '#67e8f9' },
          ].map((g) => (
            <group key={g.r} rotation={[g.rot[0], g.rot[1], g.rot[2]]}>
              <mesh>
                <torusGeometry args={[g.r, 0.006, 6, 96]} />
                <meshBasicMaterial color={new Color(g.c).multiplyScalar(2.2)} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
              </mesh>
              <mesh position={[g.r, 0, 0]}>
                <sphereGeometry args={[0.035, 12, 12]} />
                <meshBasicMaterial color={new Color(g.c).multiplyScalar(3)} toneMapped={false} />
              </mesh>
              <mesh position={[g.r, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.07, 0.004, 6, 32]} />
                <meshBasicMaterial color={new Color(g.c).multiplyScalar(2)} transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
              </mesh>
            </group>
          ))}
        </group>
        <group ref={nodes}>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.68, Math.sin(i * 1.7) * 0.25, Math.sin(a) * 0.68]}>
                <octahedronGeometry args={[0.018, 0]} />
                <meshBasicMaterial color={new Color('#a5f3fc').multiplyScalar(2.5)} toneMapped={false} />
              </mesh>
            );
          })}
        </group>
      </group>
    </group>
  );
}

const DUST_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
varying float vA;
void main() {
  vec3 p = position;
  float t = uTime * 0.12 + aSeed * 40.0;
  p += vec3(sin(t * 1.3), sin(t * 0.7 + 1.0) * 0.6, cos(t * 1.1)) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = 0.35 + 0.65 * abs(sin(t * 2.0));
  gl_PointSize = (1.5 + aSeed * 2.5) * (6.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const DUST_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(vec3(1.0, 0.85, 0.65) * smoothstep(0.5, 0.0, d) * vA * 0.9, 1.0);
}`;

/** Slow floating dust motes catching the light. */
function Dust() {
  const res = useMemo(() => {
    const random = seededRandom(303);
    const n = Math.round(650 * currentQuality().particles);
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * (A - 0.5);
      pos.set([CX + Math.cos(a) * r, FLOOR_Y + 0.2 + random() * (H - 0.4), CZ + Math.sin(a) * r], i * 3);
      seed[i] = random();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    const m = new ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    return { g, m };
  }, []);
  useEffect(() => () => (res.g.dispose(), res.m.dispose()), [res]);
  useFrame(() => {
    res.m.uniforms.uTime.value = rt.time;
  });
  return <points geometry={res.g} material={res.m} frustumCulled={false} />;
}

const SHARDS = [
  { p: [-3.3, 1.2, 9.4], s: 0.16, kind: 'oct', c: '#67e8f9' },
  { p: [3.1, 1.45, 9.8], s: 0.13, kind: 'cube', c: '#ffb35c' },
  { p: [2.6, 0.6, 13.6], s: 0.18, kind: 'oct', c: '#c084fc' },
  { p: [-2.8, 1.7, 13.1], s: 0.12, kind: 'cube', c: '#67e8f9' },
  { p: [1.2, 1.9, 8.3], s: 0.1, kind: 'oct', c: '#ffb35c' },
  { p: [-1.5, 1.85, 12.6], s: 0.11, kind: 'cube', c: '#a5f3fc' },
  { p: [4.1, 0.9, 12.2], s: 0.14, kind: 'oct', c: '#67e8f9' },
] as const;

/** Holographic knowledge shards drifting around the upper room. */
function Shards() {
  const refs = useRef<(Group | null)[]>([]);
  useFrame(() => {
    const t = rt.time;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const s = SHARDS[i];
      g.position.set(s.p[0] + Math.sin(t * 0.21 + i) * 0.25, s.p[1] + Math.sin(t * 0.6 + i * 1.7) * 0.15, s.p[2] + Math.cos(t * 0.17 + i) * 0.25);
      g.rotation.set(t * 0.3 + i, t * 0.45 + i * 2, 0);
    });
  });
  return (
    <group>
      {SHARDS.map((s, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g; }}>
          <mesh>
            {s.kind === 'oct' ? <octahedronGeometry args={[s.s, 0]} /> : <boxGeometry args={[s.s, s.s, s.s]} />}
            <meshStandardMaterial color="#0a1a22" emissive={s.c} emissiveIntensity={0.35} transparent opacity={0.35} metalness={0.2} roughness={0.1} depthWrite={false} />
          </mesh>
          <mesh>
            {s.kind === 'oct' ? <octahedronGeometry args={[s.s * 1.01, 0]} /> : <boxGeometry args={[s.s * 1.01, s.s * 1.01, s.s * 1.01]} />}
            <meshBasicMaterial color={new Color(s.c).multiplyScalar(2.4)} wireframe toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A few asteroids drifting slowly past the window. */
function Drifters() {
  const refs = useRef<(Mesh | null)[]>([]);
  const rocks = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ x0: -40 + i * 15, y: -6 + ((i * 7) % 11) * 1.4, z: CZ + 26 + i * 9, s: 0.8 + ((i * 5) % 4) * 0.9, v: 0.35 + (i % 3) * 0.2 })),
    [],
  );
  useFrame(() => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const r = rocks[i];
      m.position.set(MathUtils.euclideanModulo(r.x0 + rt.time * r.v + 45, 90) - 45, r.y, r.z);
      m.rotation.set(rt.time * 0.05 * (i + 1), rt.time * 0.07, 0);
    });
  });
  return (
    <group>
      {rocks.map((r, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} scale={r.s}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#5b5560" roughness={0.95} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function LoungeLights() {
  const holo = useRef<PointLight>(null);
  useFrame(() => {
    if (holo.current) holo.current.intensity = 2.5 + rt.holo * 6 + Math.sin(rt.time * 3) * 0.2;
  });
  return (
    <>
      <hemisphereLight args={['#ffcf9e', '#20140c', 0.55]} />
      <pointLight color="#ffc58f" position={[CX, FLOOR_Y + H - 0.6, CZ]} intensity={9} distance={16} decay={1.5} />
      {currentQuality().lights === 'all' && <pointLight ref={holo} color="#5eead4" position={HOLO_CENTER} intensity={2.5} distance={7} decay={1.4} />}
      {currentQuality().lights === 'all' && <pointLight color="#86a8ff" position={[CX, FLOOR_Y + 2.2, CZ + A - 1]} intensity={4} distance={10} decay={1.5} />}
    </>
  );
}
