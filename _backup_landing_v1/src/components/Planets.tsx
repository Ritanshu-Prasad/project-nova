import { useEffect, useRef } from 'react';

interface Planet {
  x: number;
  y: number;
  radius: number;
  color: string;
  glowColor: string;
  ringAngle: number;
  hasRing: boolean;
  driftX: number;
  driftY: number;
  phase: number;
}

/**
 * Renders distant planets with glow, optional rings, and gentle drift.
 */
export default function Planets() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const planetDefs: Planet[] = [
      {
        x: 0.15, y: 0.25, radius: 45,
        color: '#1a3a5c', glowColor: 'rgba(60,140,255,0.15)',
        ringAngle: 0.35, hasRing: true,
        driftX: 0.08, driftY: 0.05, phase: 0,
      },
      {
        x: 0.82, y: 0.18, radius: 30,
        color: '#4a2040', glowColor: 'rgba(180,60,200,0.12)',
        ringAngle: 0, hasRing: false,
        driftX: -0.06, driftY: 0.04, phase: 1.5,
      },
      {
        x: 0.7, y: 0.7, radius: 60,
        color: '#0c2a3a', glowColor: 'rgba(0,200,220,0.12)',
        ringAngle: -0.25, hasRing: true,
        driftX: 0.04, driftY: -0.06, phase: 3,
      },
      {
        x: 0.3, y: 0.75, radius: 20,
        color: '#3a2a10', glowColor: 'rgba(255,160,40,0.1)',
        ringAngle: 0, hasRing: false,
        driftX: -0.05, driftY: -0.03, phase: 4.5,
      },
    ];

    const draw = (time: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (const p of planetDefs) {
        const t = time * 0.001;
        const cx = p.x * w + Math.sin(t * p.driftX + p.phase) * 30;
        const cy = p.y * h + Math.cos(t * p.driftY + p.phase) * 20;

        // Outer glow
        const glow = ctx.createRadialGradient(cx, cy, p.radius * 0.5, cx, cy, p.radius * 4);
        glow.addColorStop(0, p.glowColor);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(cx - p.radius * 4, cy - p.radius * 4, p.radius * 8, p.radius * 8);

        // Planet body with gradient
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, p.radius, 0, Math.PI * 2);
        const bodyGrad = ctx.createRadialGradient(
          cx - p.radius * 0.3, cy - p.radius * 0.3, p.radius * 0.1,
          cx, cy, p.radius
        );
        bodyGrad.addColorStop(0, lighten(p.color, 40));
        bodyGrad.addColorStop(0.7, p.color);
        bodyGrad.addColorStop(1, darken(p.color, 30));
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        // Subtle atmosphere rim
        ctx.beginPath();
        ctx.arc(cx, cy, p.radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = p.glowColor.replace(/[\d.]+\)$/, '0.3)');
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Ring
        if (p.hasRing) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(p.ringAngle);
          ctx.scale(1, 0.3); // flatten to make it look like a ring

          ctx.beginPath();
          ctx.arc(0, 0, p.radius * 1.8, 0, Math.PI * 2);
          ctx.strokeStyle = p.glowColor.replace(/[\d.]+\)$/, '0.35)');
          ctx.lineWidth = 3;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, p.radius * 2.1, 0, Math.PI * 2);
          ctx.strokeStyle = p.glowColor.replace(/[\d.]+\)$/, '0.15)');
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.restore();
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

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

// Simple color helpers
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
  const b = Math.min(255, (num & 0x0000ff) + amount);
  return `rgb(${r},${g},${b})`;
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amount);
  const b = Math.max(0, (num & 0x0000ff) - amount);
  return `rgb(${r},${g},${b})`;
}
