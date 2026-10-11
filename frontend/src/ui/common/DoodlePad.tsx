import { motion } from 'framer-motion';
import { Brush, Eraser, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { squareAvatar } from '../../core/avatarImage';
import { Z } from '../../core/layers';
import { HudButton } from './HudButton';

/** Drawing surface in pixels (scaled down to the avatar size on save). */
const SIDE = 512;
const BACKDROP = '#0b1220';
const SWATCHES = ['#ffffff', '#22d3ee', '#a78bfa', '#f472b6', '#fb7185', '#fbbf24', '#34d399', '#60a5fa', '#111827'];
const MAX_UNDO = 25;

/** Sketch an avatar: brush, eraser, colours, brush size, undo and clear. Calls onSave with the finished picture. */
export default function DoodlePad({ onSave, onClose }: { onSave: (dataUrl: string) => void; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const undo = useRef<ImageData[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [color, setColor] = useState('#22d3ee');
  const [size, setSize] = useState(14);
  const [canUndo, setCanUndo] = useState(false);
  const [blank, setBlank] = useState(true);

  const ctx = () => canvasRef.current?.getContext('2d') ?? null;

  useEffect(() => {
    const g = ctx();
    if (!g) return;
    g.fillStyle = BACKDROP;
    g.fillRect(0, 0, SIDE, SIDE);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        stepBack();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIDE, y: ((e.clientY - r.top) / r.height) * SIDE };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const g = ctx();
    if (!g) return;
    g.strokeStyle = tool === 'eraser' ? BACKDROP : color;
    g.fillStyle = g.strokeStyle;
    g.lineWidth = tool === 'eraser' ? size * 2 : size;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
    g.stroke();
  };

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    const g = ctx();
    if (!g) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    undo.current = [...undo.current.slice(-(MAX_UNDO - 1)), g.getImageData(0, 0, SIDE, SIDE)];
    setCanUndo(true);
    const p = point(e);
    last.current = p;
    stroke(p, { x: p.x + 0.01, y: p.y }); // a dot for a single tap
    setBlank(false);
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const p = point(e);
    stroke(last.current, p);
    last.current = p;
  };
  const up = () => {
    last.current = null;
  };

  function stepBack() {
    const g = ctx();
    const prev = undo.current.pop();
    if (!g || !prev) return;
    g.putImageData(prev, 0, 0);
    setCanUndo(undo.current.length > 0);
  }

  const clear = () => {
    const g = ctx();
    if (!g) return;
    undo.current = [...undo.current.slice(-(MAX_UNDO - 1)), g.getImageData(0, 0, SIDE, SIDE)];
    setCanUndo(true);
    g.fillStyle = BACKDROP;
    g.fillRect(0, 0, SIDE, SIDE);
    setBlank(true);
  };

  const save = () => {
    const c = canvasRef.current;
    if (c) onSave(squareAvatar(c, SIDE, SIDE, 'image/png'));
  };

  const toolBtn = (key: 'brush' | 'eraser', label: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => setTool(key)}
      aria-pressed={tool === key}
      className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${tool === key ? 'bg-cyan-400/20 text-white ring-1 ring-cyan-300/60' : 'text-blue-100/70 ring-1 ring-blue-400/20 hover:text-white'}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <motion.div className="fixed inset-0 grid place-items-center bg-black/70 p-4 backdrop-blur-[3px]" style={{ zIndex: Z.notices - 2 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-modal="true" aria-label="Doodle your avatar" className="sys-window relative w-full max-w-[460px] p-5 sm:p-6" initial={{ scale: 0.96 }} animate={{ scale: 1 }}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 cursor-pointer p-1 text-blue-200/60 hover:text-white">
          <X size={16} />
        </button>
        <div className="chip-label">Avatar · Doodle</div>
        <h2 className="glow-sys mt-2 font-display text-xl font-bold text-white">Sketch your pilot</h2>

        <canvas
          ref={canvasRef}
          width={SIDE}
          height={SIDE}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="Drawing canvas"
          className="mt-4 aspect-square w-full cursor-crosshair rounded-xl ring-1 ring-blue-400/30"
          style={{ touchAction: 'none' }}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {toolBtn('brush', 'Brush', <Brush size={13} />)}
          {toolBtn('eraser', 'Eraser', <Eraser size={13} />)}
          <label className="ml-auto flex items-center gap-2 text-xs text-blue-100/70">
            Size
            <input type="range" min={3} max={40} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Brush size" className="w-24 accent-cyan-400" />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Colour">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c && tool === 'brush'}
              aria-label={`Colour ${c}`}
              onClick={() => (setColor(c), setTool('brush'))}
              className={`size-7 cursor-pointer rounded-full ring-2 transition ${color === c && tool === 'brush' ? 'ring-white' : 'ring-transparent hover:ring-white/40'}`}
              style={{ background: c }}
            />
          ))}
          <label className="relative size-7 cursor-pointer overflow-hidden rounded-full ring-2 ring-white/20" title="Any colour" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
            <input type="color" value={color} onChange={(e) => (setColor(e.target.value), setTool('brush'))} aria-label="Pick any colour" className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button type="button" onClick={stepBack} disabled={!canUndo} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-blue-100/70 ring-1 ring-blue-400/20 transition hover:text-white disabled:cursor-default disabled:opacity-40">
            <RotateCcw size={13} /> Undo
          </button>
          <button type="button" onClick={clear} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-blue-100/70 ring-1 ring-blue-400/20 transition hover:text-white">
            <Trash2 size={13} /> Clear
          </button>
          <HudButton variant="primary" size="sm" className="ml-auto" onClick={save} disabled={blank}>
            Use this doodle
          </HudButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
