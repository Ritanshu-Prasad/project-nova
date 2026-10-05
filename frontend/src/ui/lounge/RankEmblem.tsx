import { Crown, Gem, Orbit, Rocket, Satellite, Send, Shield, type LucideIcon } from 'lucide-react';
import { useId } from 'react';
import type { Rank, Tier } from '../../core/rank';

/** One ship class per tier, from a lone probe up to fleet command. */
const SHIPS: Record<string, LucideIcon> = { probe: Satellite, shuttle: Rocket, corvette: Send, frigate: Shield, cruiser: Orbit, dreadnought: Gem, master: Crown };

/** Hexagonal rank badge in the tier's colour. Pass a rank (current) or a tier (ladder); `dim` greys out locked tiers. */
export default function RankEmblem({ rank, tier, size = 40, dim = false }: { rank?: Rank; tier?: Tier; size?: number; dim?: boolean }) {
  const t = tier ?? rank?.tier;
  const gid = `rank-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (!t) return null;
  const Ship = SHIPS[t.id] ?? Rocket;
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size, filter: dim ? 'grayscale(1) opacity(0.35)' : `drop-shadow(0 0 ${Math.round(size / 7)}px ${t.color}99)` }}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="0.38" stopColor={t.color} />
            <stop offset="1" stopColor={t.color} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <polygon points="20,1.5 36.5,11 36.5,29 20,38.5 3.5,29 3.5,11" fill={`url(#${gid})`} stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1" />
        <polygon points="20,6.5 32,13.5 32,26.5 20,33.5 8,26.5 8,13.5" fill="#0b1020" fillOpacity="0.6" />
      </svg>
      <Ship size={Math.round(size * 0.4)} strokeWidth={2.2} className="relative text-white" />
    </span>
  );
}
