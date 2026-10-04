import type { ComponentPropsWithRef, ReactNode } from 'react';
import { audio } from '../../core/audio';

type Variant = 'primary' | 'ghost' | 'system';
type Size = 'sm' | 'md' | 'lg';

export type HudButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /** Skip the hover/click UI sounds. */
  silent?: boolean;
};

const BASE =
  'relative inline-flex items-center justify-center gap-2.5 rounded-[2px] font-display font-semibold uppercase ' +
  'tracking-[0.18em] select-none whitespace-nowrap cursor-pointer transition-[color,background-color,box-shadow,transform] duration-200 ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-cyan-300 text-slate-950 hover:bg-white hover:shadow-[0_0_44px_rgba(103,232,249,0.6)]',
  ghost:
    'hud-corners bg-cyan-400/[0.06] text-cyan-50 ring-1 ring-inset ring-cyan-300/25 backdrop-blur-md ' +
    'hover:bg-cyan-400/15 hover:ring-cyan-200/60 hover:text-white hover:shadow-[0_0_30px_rgba(34,211,238,0.25)]',
  system:
    'hud-corners bg-blue-500/10 text-blue-50 ring-1 ring-inset ring-blue-400/50 backdrop-blur-md [--hc:rgb(147_197_253/0.9)] ' +
    'hover:bg-blue-500/25 hover:shadow-[0_0_28px_rgba(96,165,250,0.45)]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-[11px]',
  md: 'h-11 px-6 text-xs',
  lg: 'h-14 px-8 text-sm',
};

/** The one button style for the HUD: chunky, uppercase, with corner ticks and UI sounds. */
export function HudButton({
  variant = 'ghost',
  size = 'md',
  icon,
  silent = false,
  className = '',
  children,
  onPointerEnter,
  onClick,
  type = 'button',
  ...rest
}: HudButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      onPointerEnter={(e) => {
        if (!silent && e.pointerType === 'mouse') audio.play('hover');
        onPointerEnter?.(e);
      }}
      onClick={(e) => {
        if (!silent) audio.play('click');
        onClick?.(e);
      }}
      {...rest}
    >
      {icon}
      {children !== undefined && <span>{children}</span>}
    </button>
  );
}
