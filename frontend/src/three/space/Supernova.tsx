import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, ShaderMaterial, Vector3, type Group, type Mesh, type MeshBasicMaterial, type Points } from 'three';
import { useFinale } from '../../core/finale';
import { currentQuality } from '../../core/graphics';
import { clamp, damp } from '../../core/math';
import { seededRandom } from '../../core/seeded';
import { usePlanets } from '../../core/planets';
import { rt } from '../../core/runtime';
import { SUN_DISTANCE, screenDir } from './layout';
import { PLANETS } from './planets';
import { DYING, DYING_COLORS, implosion } from './finaleWorld';
import { glowTexture, shockRingTexture } from './textures';

/**
 * The course finale as seen from the cockpit: the dying sun charges, goes supernova, and the blast wave sweeps over the
 * ship, lighting the sky and washing the window white once (never a strobe). What is left is a glowing remnant that fades
 * when the finale is closed. Driven by `rt.novaOn / novaT / novaBlastAt`; writes `rt.novaGlow`, `rt.novaShake` (the
 * strongest shake in the app: it peaks at twice the launch) and `rt.novaKick`. With reduced motion everything is
 * slower and softer, with no shake, no kick and no flash.
 */

/** The blast wave's shells; the last one is the echo, a second, slower front that rocks the ship again. */
const SHELLS = [
  { delay: 0, speed: 1500, color: '#bfe9ff', weight: 1 },
  { delay: 0.35, speed: 1250, color: '#d9a8ff', weight: 0.6 },
  { delay: 0.7, speed: 1000, color: '#ffd28a', weight: 0.6 },
  { delay: 2.3, speed: 850, color: '#ff8a5c', weight: 0.55 },
] as const;
const MAX_SPARKS = 1200;
/** Remnant gas clouds (full-screen sprites by the end): the fourth only on the higher graphics levels. */
const CLOUDS = (['#ff4a2a', '#a04cff', '#ffa030', '#38bdf8'] as const).slice(0, currentQuality().particles >= 0.75 ? 4 : 3);
const HUES = ['#67e8f9', '#c084fc', '#f472b6', '#fde68a', '#86efac'];

const SHELL_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const SHELL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec3 vN;
varying vec3 vV;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  float a = (0.05 + rim) * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}`;

const SPARK_VERT = /* glsl */ `
attribute vec3 aVel;
attribute vec3 aColor;
attribute float aLife;
uniform vec3 uOrigin;
uniform float uT;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float age = uT / aLife;
  vec3 p = uOrigin + aVel * uT;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uScale * (1.0 - 0.6 * age) / max(1.0, -mv.z) * 9000.0, 1.5, 30.0);
  vColor = aColor;
  vAlpha = (1.0 - smoothstep(0.55, 1.0, age)) * step(0.0, uT);
}`;
const SPARK_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - d * d) * vAlpha;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vColor * a * 1.6, a);
}`;

/** A soft star with thin spikes, for the flare around the dying star. */
function burstTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.translate(256, 256);
  for (let i = 0; i < 8; i++) {
    g.save();
    g.rotate((i / 8) * Math.PI);
    const grd = g.createLinearGradient(-256, 0, 256, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, `rgba(255,255,255,${i % 2 ? 0.35 : 0.8})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(-256, -1.5, 512, 3);
    g.restore();
  }
  return new CanvasTexture(c);
}

const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const WHITE = new Color('#ffffff');
const FINALE_TINT = new Color(DYING_COLORS.core);

export default function Supernova() {
  const index = usePlanets((s) => s.index);
  const spec = PLANETS[index];
  const open = useFinale((s) => s.open);
  const sun = useMemo(() => {
    const d = screenDir(spec.sunAt[0], spec.sunAt[1]);
    return [d[0] * SUN_DISTANCE, d[1] * SUN_DISTANCE, d[2] * SUN_DISTANCE] as const;
  }, [spec]);

  const root = useRef<Group>(null);
  const star = useRef<Group>(null);
  const shock = useRef<Mesh>(null);
  const shockMat = useRef<MeshBasicMaterial>(null);
  const hit = useRef(false);
  const core = useRef<MeshBasicMaterial>(null);
  const coreMesh = useRef<Mesh>(null);
  const burst = useRef<Mesh>(null);
  const burstMat = useRef<MeshBasicMaterial>(null);
  const streak = useRef<Mesh>(null);
  const streakMat = useRef<MeshBasicMaterial>(null);
  const clouds = useRef<(Mesh | null)[]>([]);
  const cloudMats = useRef<(MeshBasicMaterial | null)[]>([]);
  const shells = useRef<(Mesh | null)[]>([]);
  const sparks = useRef<Points>(null);
  const fade = useRef(1);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const res = useMemo(() => {
    const count = Math.round(MAX_SPARKS * currentQuality().particles);
    const geo = new BufferGeometry();
    const vel = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const tint = new Color();
    const random = seededRandom(31);
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2;
      const b = Math.acos(2 * random() - 1);
      const speed = 300 + Math.pow(random(), 1.6) * 1900;
      vel.set([Math.sin(b) * Math.cos(a) * speed, Math.sin(b) * Math.sin(a) * speed, Math.cos(b) * speed], i * 3);
      tint.set(HUES[i % HUES.length]);
      col.set([tint.r, tint.g, tint.b], i * 3);
      life[i] = 3 + random() * 5;
    }
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aVel', new BufferAttribute(vel, 3));
    geo.setAttribute('aColor', new BufferAttribute(col, 3));
    geo.setAttribute('aLife', new BufferAttribute(life, 1));
    const sparkMat = new ShaderMaterial({ vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG, uniforms: { uOrigin: { value: new Vector3() }, uT: { value: -1 }, uScale: { value: 1 } }, blending: AdditiveBlending, transparent: true, depthWrite: false });
    const shellMats = SHELLS.map((s) => new ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG, uniforms: { uColor: { value: new Color(s.color) }, uAlpha: { value: 0 } }, side: DoubleSide, blending: AdditiveBlending, transparent: true, depthWrite: false }));
    return { geo, sparkMat, shellMats, glow: glowTexture(), star: burstTexture(), ring: shockRingTexture(), tint: new Color(spec.sunColor) };
  }, [spec.sunColor]);
  useEffect(() => () => {
    res.geo.dispose();
    res.sparkMat.dispose();
    res.shellMats.forEach((m) => m.dispose());
    res.glow.dispose();
    res.star.dispose();
    res.ring.dispose();
  }, [res]);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    if (!rt.novaOn) {
      g.visible = false;
      fade.current = 1;
      hit.current = false;
      rt.novaKick = 0;
      rt.novaAlarm = 0;
      rt.novaDim = 0;
      return;
    }
    // Once the finale is closed the remnant fades away, then everything is switched off.
    fade.current = damp(fade.current, openRef.current ? 1 : 0, 1.6, dt);
    if (!openRef.current && fade.current < 0.01) {
      rt.novaOn = false;
      rt.novaT = 0;
      rt.novaGlow = 0;
      rt.novaShake = 0;
      rt.novaKick = 0;
      rt.novaAlarm = 0;
      rt.novaDim = 0;
      rt.finaleWorld = false; // the remnant has faded: the normal world comes back
      rt.finaleFlight = false;
      g.visible = false;
      return;
    }
    g.visible = true;
    const calm = rt.reducedMotion;
    const k = calm ? 0.6 : 1;
    const T = rt.novaT;
    const blast = rt.novaBlastAt;
    const t = T - blast; // seconds since the blast went off
    const charge = clamp(T / blast);
    // Where the star is: the dying sun ahead in the finale, the world's own sun otherwise.
    const at = rt.finaleWorld ? DYING.position : sun;
    star.current?.position.set(at[0], at[1], at[2]);
    const dist = Math.hypot(at[0], at[1], at[2]);

    // The core collapses for the last moments before the blast: the glow is sucked in, white-hot (see finaleWorld.ts).
    const implode = implosion(t);

    // The star's own glow: it stays modest while the dying sun charges (the sun draws its own corona), pulls in during the
    // collapse, makes one bright flare at the blast that is gone in about a second, and leaves a softer remnant glow behind.
    const swell = t < 0 ? (520 + 720 * charge * charge) * (1 - 0.6 * implode) : 1600 + 2100 * easeOut(clamp(t / 0.8)) - 2300 * clamp((t - 0.8) / 4);
    const bright = t < 0 ? 0.7 + 1.1 * charge + 1.6 * implode : 5.5 * Math.exp(-t * 4) + 0.75;
    core.current?.color.copy(rt.finaleWorld ? FINALE_TINT : res.tint).lerp(WHITE, clamp(charge * 1.4)).multiplyScalar(bright * k + (1 - k) * 2);
    coreMesh.current?.scale.setScalar(swell / 900);
    if (burst.current && burstMat.current) {
      burst.current.scale.setScalar((swell * 3.6) / 900);
      burst.current.rotation.z = T * 0.05 + (t > 0 ? 0.25 * easeOut(clamp(t / 3)) : 0);
      burstMat.current.opacity = (t < 0 ? 0.12 * charge + 0.4 * implode : 0.75 * (1 - clamp(t / 4))) * k;
    }
    // A lens streak across the whole window: a thin line during the collapse, flung wide by the blast, then fading.
    if (streak.current && streakMat.current) {
      const wide = t < 0 ? 0.8 * implode : 0.8 + 13 * easeOut(clamp(t / 0.3));
      streak.current.scale.set(wide, 0.03 + (t > 0 ? 0.05 * Math.exp(-t * 2) : 0), 1);
      streakMat.current.opacity = (t < 0 ? 0.45 * implode : Math.exp(-t * 0.9)) * k * fade.current;
      streak.current.visible = streakMat.current.opacity > 0.01;
    }

    // The blast wave: three thin shells expanding from the star, reaching the ship after about two seconds.
    let glow = 0;
    SHELLS.forEach((s, i) => {
      const mesh = shells.current[i];
      if (!mesh) return;
      const age = t - s.delay;
      if (age <= 0) {
        mesh.visible = false;
        return;
      }
      const radius = age * s.speed * (calm ? 0.45 : 1);
      mesh.visible = true;
      mesh.scale.setScalar(Math.max(1, radius));
      const alpha = Math.pow(1 - clamp(age / 7), 1.6) * (calm ? 0.4 : 0.9);
      res.shellMats[i].uniforms.uAlpha.value = alpha;
      // The wave is "over the ship" when its radius equals the sun's distance.
      const pass = Math.exp(-Math.pow((radius - dist) / (420 + 150 * i), 2));
      glow = Math.max(glow, pass * s.weight);
    });
    const target = (calm ? 0.35 : 1) * glow;
    rt.novaGlow = damp(rt.novaGlow, target, 8, dt) * fade.current;
    // Vibration: a rumble that builds while the star charges and falls silent during the collapse (the hush makes the hit
    // land harder), then the strongest shake of the whole app as the blast hits, and again, softer, as the echo passes.
    const rumble = t < 0 ? 0.75 * charge * charge * (1 - 0.85 * implode) : 0;
    const impact = t > 0 ? 2.9 * Math.min(1, t / 0.05) * Math.exp(-t * 1.4) : 0;
    rt.novaShake = calm ? 0 : Math.min(3.2, rumble + impact + 0.8 * glow) * fade.current;
    // The view narrows as the star charges and collapses, then the blast throws it wide.
    rt.novaKick = calm ? 0 : (t < 0 ? -2.5 * charge - 3 * implode : 18 * Math.exp(-t * 2.2)) * fade.current;
    // Red alert in the cockpit once the star goes critical, easing off after the wave has passed; and the hush: the edges of
    // the view darken during the collapse and the blast tears it away at once.
    rt.novaAlarm = (t < 0 ? clamp((charge - 0.35) / 0.4) : 1 - clamp(t / 3.5)) * fade.current;
    rt.novaDim = calm ? 0 : t < 0 ? 0.6 * implode : 0;
    if (t >= 0 && !hit.current) {
      hit.current = true;
      if (!calm) navigator.vibrate?.([70, 40, 140, 60, 280]); // phones buzz with it
    }
    // One extra, central shock ring leaving the star.
    if (shock.current && shockMat.current) {
      const p = t > 0 ? clamp(t / 3) : 0;
      shock.current.visible = t > 0 && p < 1;
      shock.current.scale.setScalar(0.5 + 4.5 * easeOut(p));
      shockMat.current.opacity = Math.pow(1 - p, 1.4) * 0.85 * k * fade.current;
    }

    // Gas clouds of the remnant: big soft sprites growing and drifting through colours.
    clouds.current.forEach((mesh, i) => {
      const mat = cloudMats.current[i];
      if (!mesh || !mat) return;
      const grow = t < 0 ? 0 : easeOut(clamp(t / (5 + i * 1.8)));
      mesh.scale.setScalar(0.3 + (2.6 + i * 0.9) * grow);
      mesh.rotation.z = T * (i % 2 ? 0.03 : -0.025); // the remnant slowly turns as it spreads
      mat.opacity = (t < 0 ? 0 : 0.24 * Math.min(1, t / 1.2) * (0.75 + 0.25 * Math.sin(T * 0.5 + i * 2))) * fade.current * k;
    });

    // Sparks and debris flying outwards from the star past the ship.
    const u = res.sparkMat.uniforms;
    u.uOrigin.value.set(at[0], at[1], at[2]);
    u.uT.value = t < 0 ? -1 : t * (calm ? 0.5 : 1);
    u.uScale.value = fade.current * k;
    if (sparks.current) sparks.current.visible = t >= 0 && fade.current > 0.02;
  });

  return (
    <group ref={root} visible={false} userData={{ world: 'finale' }}>
      <group ref={star} position={[sun[0], sun[1], sun[2]]}>
      <Billboard>
        <mesh ref={coreMesh}>
          <planeGeometry args={[900, 900]} />
          <meshBasicMaterial ref={core} map={res.glow} color="#ffffff" transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={burst}>
          <planeGeometry args={[900, 900]} />
          <meshBasicMaterial ref={burstMat} map={res.star} color="#cfeaff" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={streak} visible={false}>
          <planeGeometry args={[900, 900]} />
          <meshBasicMaterial ref={streakMat} map={res.glow} color="#d6ecff" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        {CLOUDS.map((color, i) => (
          <mesh key={color} ref={(m) => void (clouds.current[i] = m)} position={[i * 60 - 90, i * 40 - 60, -10 - i]} scale={0.3}>
            <planeGeometry args={[1400, 1400]} />
            <meshBasicMaterial ref={(m) => void (cloudMats.current[i] = m)} map={res.glow} color={color} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
        <mesh ref={shock} visible={false}>
          <planeGeometry args={[900, 900]} />
          <meshBasicMaterial ref={shockMat} map={res.ring} color="#ffd9a8" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </Billboard>
      {SHELLS.map((s, i) => (
        <mesh key={s.color} ref={(m) => void (shells.current[i] = m)} material={res.shellMats[i]} visible={false} frustumCulled={false}>
          <sphereGeometry args={[1, 64, 32]} />
        </mesh>
      ))}
      </group>
      <points ref={sparks} geometry={res.geo} material={res.sparkMat} frustumCulled={false} visible={false} />
    </group>
  );
}
