import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, ShaderMaterial, SphereGeometry, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import { fbmDefines } from '../../core/graphics';
import { clamp, smoothstep } from '../../core/math';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';
import { NOISE_GLSL } from '../shaders/noise';
import { DYING, DYING_COLORS, implosion } from './finaleWorld';
import { glowTexture } from './textures';
import { starShown, worldTravel } from './transition';

/**
 * The dying sun of the course finale: one sphere with a turbulent, spotted surface that churns faster and whiter as it
 * charges, plus two glow sprites. It is drawn only while `rt.finaleWorld` is on, and goes out in a swell at the blast
 * (the blast effects themselves live in Supernova.tsx).
 */

const VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
void main() {
  vObj = normalize(position);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uCharge;
uniform float uOpacity;
uniform vec3 uEdge;
uniform vec3 uBody;
uniform vec3 uCore;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
${NOISE_GLSL}
void main() {
  vec3 p = normalize(vObj);
  float t = uTime * (0.05 + 0.3 * uCharge);
  // fbm3 runs from about -1 to 1: bring it to 0..1 before using it as a mix amount or an exponent base.
  float g1 = clamp(fbm3(p * 3.0 + vec3(0.0, 0.0, t)) * 0.5 + 0.5, 0.0, 1.0);
  float g2 = clamp(fbm3(p * 9.0 - vec3(t * 2.0, 0.0, 0.0)) * 0.5 + 0.5, 0.0, 1.0);
  float spots = smoothstep(0.6, 0.8, fbm3(p * 2.1 + 5.0) * 0.5 + 0.5); // cool dark spots on a dying star
  float limb = pow(max(dot(normalize(vN), normalize(vV)), 0.0), 0.5);
  vec3 col = mix(uEdge, mix(uBody, uCore, g1 * 0.5), 0.4 + 0.6 * limb);
  col *= 0.75 + 0.6 * limb;
  col *= 1.0 - 0.45 * spots * (1.0 - uCharge);
  col += uCore * pow(g2, 2.2) * (0.1 + 0.8 * uCharge);                  // veins of white-hot gas
  col = mix(col, vec3(1.0, 0.9, 0.7) * 1.4, uCharge * 0.35 * pow(g1, 1.6));
  float edge = 1.0 - limb;
  col += uBody * edge * edge * (0.7 + 0.5 * sin(uTime * (2.0 + 9.0 * uCharge) + p.y * 9.0)) * (0.35 + 0.5 * uCharge);
  if (any(isnan(col))) col = vec3(0.0);
  gl_FragColor = vec4(col, uOpacity);
}`;

export default function DyingSun() {
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const corona = useRef<MeshBasicMaterial>(null);
  const halo = useRef<MeshBasicMaterial>(null);
  const coronaMesh = useRef<Mesh>(null);
  const haloMesh = useRef<Mesh>(null);

  const res = useMemo(() => {
    const geo = new SphereGeometry(1, 96, 48);
    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uTime: { value: 0 }, uCharge: { value: 0 }, uOpacity: { value: 1 }, uEdge: { value: new Color(DYING_COLORS.edge) }, uBody: { value: new Color(DYING_COLORS.body) }, uCore: { value: new Color(DYING_COLORS.core) } },
      defines: fbmDefines(),
      transparent: true,
      depthWrite: false,
    });
    return { geo, mat, glow: glowTexture() };
  }, []);
  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
      res.glow.dispose();
    },
    [res],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const phase = useNova.getState().phase;
    // Only the arrival brings the star into the scene: it is never drawn while the ship is still leaving or warping.
    const on = rt.finaleWorld && starShown(phase);
    g.visible = on;
    if (!on) return;
    const calm = rt.reducedMotion;
    // Like a planet, the star starts far ahead and comes to meet the ship as it slows into its standoff.
    g.position.set(DYING.position[0], DYING.position[1], DYING.position[2] + worldTravel(phase, rt.phaseTime, calm));

    const live = rt.novaOn;
    const T = live ? rt.novaT : 0;
    const B = rt.novaBlastAt;
    const charge = live ? clamp(T / B) : 0;
    const after = live ? T - B : -1; // seconds since the blast
    const visible = smoothstep(0.02, 0.5, rt.arrive); // fades in with the arrival, like the planets

    // The collapse: in its last moments the star shrinks, white-hot, and its corona is pulled in with it.
    const implode = live ? implosion(after) : 0;
    const pulse = Math.sin(rt.time * (1.1 + 4 * charge)) * (calm ? 0.008 : 0.02);
    let size = DYING.radius * (1 + pulse + 0.1 * charge * charge) * (1 - 0.42 * implode);
    let fade = 1;
    if (after > 0) {
      size *= 1 + 1.4 * (1 - Math.pow(1 - clamp(after / 0.7), 3)); // it swells as it goes
      fade = 1 - clamp(after / 0.8);
    }
    body.current?.scale.setScalar(size);
    res.mat.uniforms.uTime.value = rt.time;
    res.mat.uniforms.uCharge.value = Math.max(charge, implode);
    res.mat.uniforms.uOpacity.value = visible * fade;
    if (body.current) body.current.visible = fade > 0.01 && visible > 0.01;

    const flicker = calm ? 1 : 0.9 + 0.1 * Math.sin(rt.time * (3 + 12 * charge));
    const lit = visible * fade;
    if (corona.current) corona.current.opacity = 0.55 * lit * flicker * (1 - 0.5 * implode);
    if (halo.current) halo.current.opacity = (0.28 + 0.22 * charge) * lit * (1 - 0.6 * implode);
    coronaMesh.current?.scale.setScalar((size * 3 * (1 - 0.35 * implode)) / 900);
    haloMesh.current?.scale.setScalar((size * 5 * (1 - 0.45 * implode)) / 900);
  });

  return (
    <group ref={group} visible={false} userData={{ world: 'finale' }}>
      <mesh ref={body} geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={1} />
      <Billboard>
        <mesh ref={haloMesh}>
          <planeGeometry args={[900, 900]} />
          <meshBasicMaterial ref={halo} map={res.glow} color={DYING_COLORS.flare} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={coronaMesh}>
          <planeGeometry args={[900, 900]} />
          <meshBasicMaterial ref={corona} map={res.glow} color={DYING_COLORS.body} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}
