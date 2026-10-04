import { useEffect, useRef, useState } from 'react';
import { Z } from '../../core/layers';
import { damp } from '../../core/math';
import { rt } from '../../core/runtime';
import { useRaf } from '../../core/useRaf';

/** DOM targets that make the reticle "hot". 3D targets signal it via document.body.style.cursor. */
const INTERACTIVE = 'button, a, [role=button], [data-cursor]';
const FINE_POINTER = '(pointer: fine)';

const isFinePointer = () => {
  try {
    return window.matchMedia(FINE_POINTER).matches;
  } catch {
    return false;
  }
};

const isHot = (t: EventTarget | null) => {
  const hit = t instanceof Element ? t.closest(INTERACTIVE) : null;
  return hit !== null && !(hit instanceof HTMLButtonElement && hit.disabled);
};

/**
 * A subtle reticle ring trailing the (still visible) native cursor on fine pointers. It grows,
 * brightens and turns its ticks over interactive targets, and pinches on press.
 */
export default function Cursor() {
  const [fine, setFine] = useState(isFinePointer);
  useEffect(() => {
    const mq = window.matchMedia(FINE_POINTER);
    const onChange = () => setFine(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return fine ? <Reticle /> : null;
}

function Reticle() {
  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const ticksRef = useRef<HTMLDivElement>(null);
  const st = useRef({
    tx: 0,
    ty: 0,
    x: 0,
    y: 0,
    seen: false,
    inside: false,
    touch: false,
    hotDom: false,
    target: null as EventTarget | null,
    down: false,
    heat: 0,
    press: 0,
    show: 0,
  });

  useEffect(() => {
    const s = st.current;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        s.touch = true;
        return;
      }
      s.touch = false;
      s.inside = true;
      s.tx = e.clientX;
      s.ty = e.clientY;
      if (!s.seen) {
        s.seen = true;
        s.x = s.tx;
        s.y = s.ty;
      }
      if (e.target !== s.target) {
        s.target = e.target;
        s.hotDom = isHot(e.target);
      }
    };
    const onOver = (e: PointerEvent) => {
      s.target = e.target;
      s.hotDom = isHot(e.target);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') s.down = true;
    };
    const onUp = () => {
      s.down = false;
    };
    const onLeave = () => {
      s.inside = false;
      s.down = false;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }, []);

  useRaf((dt) => {
    const root = rootRef.current;
    const ring = ringRef.current;
    const ticks = ticksRef.current;
    if (!root || !ring || !ticks) return;
    const s = st.current;
    const hot = s.hotDom || document.body.style.cursor === 'pointer';
    s.heat = damp(s.heat, hot ? 1 : 0, 16, dt);
    s.press = damp(s.press, s.down ? 1 : 0, 28, dt);
    s.show = damp(s.show, s.seen && s.inside && !s.touch ? 1 : 0, 10, dt);
    if (rt.reducedMotion) {
      s.x = s.tx;
      s.y = s.ty;
    } else {
      s.x = damp(s.x, s.tx, 20, dt);
      s.y = damp(s.y, s.ty, 20, dt);
    }
    root.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0)`;
    root.style.opacity = s.show.toFixed(3);
    ring.style.transform = `scale(${(1 + 0.42 * s.heat - 0.2 * s.press).toFixed(3)})`;
    ring.style.opacity = (0.45 + 0.55 * s.heat).toFixed(3);
    ticks.style.transform = `rotate(${(45 * s.heat).toFixed(1)}deg) scale(${(1 + 0.22 * s.heat - 0.12 * s.press).toFixed(3)})`;
    ticks.style.opacity = (0.35 + 0.65 * s.heat).toFixed(3);
  });

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 will-change-transform"
      style={{ zIndex: Z.cursor, opacity: 0 }}
    >
      <div
        ref={ringRef}
        className="absolute -left-[15px] -top-[15px] h-[30px] w-[30px] rounded-full border border-cyan-200/85 shadow-[0_0_12px_rgba(34,211,238,0.4),inset_0_0_6px_rgba(34,211,238,0.3)]"
      />
      <div ref={ticksRef} className="absolute -left-[23px] -top-[23px] h-[46px] w-[46px]">
        <span className="absolute left-1/2 top-0 h-[6px] w-px -translate-x-1/2 bg-cyan-100" />
        <span className="absolute bottom-0 left-1/2 h-[6px] w-px -translate-x-1/2 bg-cyan-100" />
        <span className="absolute left-0 top-1/2 h-px w-[6px] -translate-y-1/2 bg-cyan-100" />
        <span className="absolute right-0 top-1/2 h-px w-[6px] -translate-y-1/2 bg-cyan-100" />
      </div>
    </div>
  );
}
