import { useEffect, useRef } from 'react';

/**
 * A perspective grid that flies towards you — like flying over
 * a digital landscape / TRON-style ground plane
 */
export default function PerspectiveGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let offset = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const horizon = h * 0.55; // Where the grid starts (slightly below center)
      const vanishX = w / 2;
      const lineCount = 30;
      const spacing = 40;

      // Horizontal lines (moving towards you)
      offset = (offset + 0.5) % spacing;
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.08)';
      ctx.lineWidth = 1;

      for (let i = 0; i < lineCount; i++) {
        const rawY = horizon + i * spacing + offset;
        if (rawY > h) continue;

        // Lines get more opaque and spaced as they get closer
        const progress = (rawY - horizon) / (h - horizon);
        ctx.globalAlpha = progress * 0.15;

        ctx.beginPath();
        ctx.moveTo(0, rawY);
        ctx.lineTo(w, rawY);
        ctx.stroke();
      }

      // Vertical lines (converging to vanishing point)
      const verticalLines = 20;
      ctx.globalAlpha = 0.08;
      for (let i = -verticalLines; i <= verticalLines; i++) {
        const bottomX = vanishX + i * (w / verticalLines) * 1.5;
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(bottomX, h);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
}
