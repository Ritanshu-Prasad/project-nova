import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  z: number;
  pz: number;
}

export default function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const STAR_COUNT = 1200;
    const stars: Star[] = [];
    let speed = 2;
    const targetSpeed = 15;
    const accelerationDuration = 4000; // 4 seconds to reach full speed
    const startTime = Date.now();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize stars scattered across the z-depth
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: (Math.random() - 0.5) * canvas.width * 3,
        y: (Math.random() - 0.5) * canvas.height * 3,
        z: Math.random() * canvas.width,
        pz: 0,
      });
    }

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Accelerate over time (simulates the ship powering up)
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / accelerationDuration, 1);
      speed = 2 + (targetSpeed - 2) * t * t; // ease-in quadratic

      // Fade trail effect — creates motion blur
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < STAR_COUNT; i++) {
        const star = stars[i];
        star.pz = star.z;
        star.z -= speed;

        // Reset star if it passed the camera
        if (star.z <= 0) {
          star.x = (Math.random() - 0.5) * w * 3;
          star.y = (Math.random() - 0.5) * h * 3;
          star.z = w;
          star.pz = w;
        }

        // Project 3D → 2D
        const sx = (star.x / star.z) * w + cx;
        const sy = (star.y / star.z) * h + cy;
        const px = (star.x / star.pz) * w + cx;
        const py = (star.y / star.pz) * h + cy;

        // Star size based on proximity
        const size = Math.max(0, (1 - star.z / w) * 3);

        // Star brightness and color — closer stars are brighter and bluer
        const brightness = Math.max(0, (1 - star.z / w));
        const r = Math.floor(150 + 105 * brightness);
        const g = Math.floor(200 + 55 * brightness);
        const b = 255;

        // Draw the streak line
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
        ctx.lineWidth = size;
        ctx.stroke();

        // Draw a glow dot at the head
        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
        ctx.fill();
      }

      // Subtle central glow (engine thrust / warp core feel)
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
      gradient.addColorStop(0, 'rgba(0, 180, 255, 0.03)');
      gradient.addColorStop(0.5, 'rgba(0, 100, 200, 0.01)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

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
