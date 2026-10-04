import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode, type BloomEffect, type ChromaticAberrationEffect, type VignetteEffect } from 'postprocessing';
import { useRef } from 'react';
import { Vector2 } from 'three';
import { rt } from '../core/runtime';

/** Cinematic post: bloom, chromatic aberration, vignette, grain, ACES — all steered by `rt`. */
export default function PostFX({ lite = false }: { lite?: boolean }) {
  const bloom = useRef<BloomEffect>(null);
  const ca = useRef<ChromaticAberrationEffect>(null);
  const vig = useRef<VignetteEffect>(null);
  const [offset] = useRefValue(() => new Vector2(0.0006, 0.0006));

  useFrame(() => {
    if (bloom.current) bloom.current.intensity = 0.85 + 2.5 * rt.flash + 0.6 * rt.warp + 0.6 * rt.pulse;
    const o = 0.0006 + 0.004 * rt.dizzy + 0.003 * rt.warp + 0.0015 * rt.shake;
    offset.set(o, o);
    if (ca.current) ca.current.offset = offset;
    if (vig.current) vig.current.darkness = 0.5 + 0.25 * (1 - rt.power) + 0.2 * rt.dizzy;
  });

  return (
    <EffectComposer multisampling={lite ? 0 : 4}>
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.7} luminanceSmoothing={0.2} intensity={0.85} />
      <ChromaticAberration ref={ca} offset={offset} radialModulation modulationOffset={0.2} />
      <Vignette ref={vig} offset={0.3} darkness={0.6} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={lite ? 0 : 0.035} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

function useRefValue<T>(make: () => T): [T] {
  const r = useRef<T | null>(null);
  if (r.current === null) r.current = make();
  return [r.current];
}
