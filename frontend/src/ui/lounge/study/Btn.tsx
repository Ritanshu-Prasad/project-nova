import type { ComponentPropsWithRef, ReactNode } from 'react';
import { audio } from '../../../core/audio';

type Props = ComponentPropsWithRef<'button'> & { variant?: 'primary' | 'ghost'; icon?: ReactNode };

/** Study-screen button: content font, normal case, the pilot's colour for primary actions. */
export default function Btn({ variant = 'ghost', icon, className = '', children, onClick, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      onClick={(e) => {
        audio.play('click');
        onClick?.(e);
      }}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-sans text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-40 ${
        variant === 'primary' ? 'text-[var(--user-ink)] hover:brightness-110' : 'bg-white/[0.06] text-white/85 ring-1 ring-inset ring-white/10 hover:bg-white/[0.1] hover:text-white'
      } ${className}`}
      style={variant === 'primary' ? { background: 'var(--user)' } : undefined}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
