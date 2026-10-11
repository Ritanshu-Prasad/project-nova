import { useProfile } from '../../core/hub';

/** The pilot's picture (uploaded or doodled), or their initials on their colour. */
export default function PilotAvatar({ size = 64, className = '', src, name }: { size?: number; className?: string; src?: string; name?: string }) {
  const stored = useProfile((s) => s.avatar);
  const callsign = useProfile((s) => s.callsign);
  const avatar = src ?? stored;
  const label = (name ?? callsign) || 'Pilot';
  const style = { width: size, height: size, boxShadow: '0 0 30px rgb(var(--user-rgb) / 0.45)' };
  if (avatar) return <img src={avatar} alt={`${label}’s avatar`} className={`shrink-0 rounded-3xl object-cover ${className}`} style={style} draggable={false} />;
  return (
    <div className={`grid shrink-0 place-items-center rounded-3xl font-display font-bold text-[var(--user-ink)] ${className}`} style={{ ...style, background: 'var(--user)', fontSize: size * 0.38 }}>
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}
