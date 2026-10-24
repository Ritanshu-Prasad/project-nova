import { useRef } from 'react';
import { Z } from '../../core/layers';
import { rt } from '../../core/runtime';
import { useNova } from '../../core/store';
import { useRaf } from '../../core/useRaf';

/** Two soft black lids that part as rt.eyelid → 1, plus the wake-up blur. Driven per frame. */
export default function Eyelids() {
  const phase = useNova((s) => s.phase);
  const introSeen = useNova((s) => s.introSeen);
  // Returning visitors: eyelid overlay is never shown at gate, preventing the black-screen flash.
  const active = (phase === 'gate' && !introSeen) || phase === 'wake';
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const blur = useRef<HTMLDivElement>(null);
  const tint = useRef<HTMLDivElement>(null);

  useRaf(() => {
    const open = rt.eyelid;
    // Each lid covers half the screen when shut and slides past the edge when open.
    const off = open * 62;
    if (top.current) top.current.style.transform = `translateY(${-off}vh)`;
    if (bottom.current) bottom.current.style.transform = `translateY(${off}vh)`;
    if (blur.current) {
      const px = rt.blur.toFixed(1);
      blur.current.style.backdropFilter = `blur(${px}px)`;
      (blur.current.style as CSSStyleDeclaration & { webkitBackdropFilter: string }).webkitBackdropFilter = `blur(${px}px)`;
    }
    if (tint.current) tint.current.style.opacity = String(rt.emergency * (1 - open) * 0.8 + rt.dizzy * 0.25);
  }, active);

  if (!active) return null;
  const lid = 'absolute left-[-10vw] h-[65vh] w-[120vw] bg-black will-change-transform';
  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.eyelids }}>
      <div ref={blur} className="absolute inset-0" />
      <div ref={tint} className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(90,0,0,0.75) 100%)' }} />
      <div ref={top} className={`${lid} top-[-15vh] rounded-b-[50%]`} style={{ boxShadow: '0 30px 60px 40px #000' }} />
      <div ref={bottom} className={`${lid} bottom-[-15vh] rounded-t-[50%]`} style={{ boxShadow: '0 -30px 60px 40px #000' }} />
    </div>
  );
}
