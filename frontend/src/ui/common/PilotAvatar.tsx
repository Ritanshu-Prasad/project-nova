import { useState } from 'react';
import { useAccount } from '../../core/account';
import { useProfile } from '../../core/hub';

/** The pilot's picture (uploaded, doodled, or from Google), or their initials on their colour. */
export default function PilotAvatar({ size = 64, className = '', src, name, color }: { size?: number; className?: string; src?: string; name?: string; color?: string }) {
  const stored = useProfile((s) => s.avatar);
  const accountPic = useAccount((s) => s.user?.picture);
  const callsign = useProfile((s) => s.callsign);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const avatar = src !== undefined ? (src || null) : (stored || accountPic);
  const label = (name ?? callsign) || 'Pilot';
  const bg = color || 'var(--user)';
  const round = className.includes('rounded-') ? '' : 'rounded-3xl';
  const style = { width: size, height: size, boxShadow: size <= 28 ? 'none' : '0 0 30px rgb(var(--user-rgb) / 0.45)' };
  if (avatar && failedSrc !== avatar) {
    return (
      <img
        src={avatar}
        alt={`${label}’s avatar`}
        referrerPolicy="no-referrer"
        className={`shrink-0 ${round} object-cover ${className}`}
        style={style}
        draggable={false}
        onError={() => setFailedSrc(avatar)}
      />
    );
  }
  return (
    <div className={`grid shrink-0 place-items-center ${round} font-display font-bold text-[var(--user-ink)] ${className}`} style={{ ...style, background: bg, fontSize: size * 0.38 }}>
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}
