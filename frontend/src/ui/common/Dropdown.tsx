import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { audio } from '../../core/audio';
import { useNova } from '../../core/store';

export interface DropdownOption {
  value: string;
  label: string;
  /** A second line under the label (progress, rank...). */
  hint?: string;
  disabled?: boolean;
  /** Shown on the right, e.g. a tick for finished items. */
  trailing?: ReactNode;
}

export interface DropdownAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

interface Props {
  /** What the screen reader calls the control. */
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** An action under the list, for example "New course". */
  action?: DropdownAction;
  /** 'pill': a small rounded button (menu opens to the left edge); 'field': a full-width input-like button. */
  variant?: 'pill' | 'field';
  className?: string;
}

/**
 * A themed replacement for the browser's <select>: a button that opens a list of options with a second line each,
 * a tick on the chosen one and an optional action at the bottom. Keyboard: arrows, Home/End, Enter/Space, Escape.
 */
export default function Dropdown({ label, value, options, onChange, action, variant = 'pill', className = '' }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const reduced = useNova((s) => s.reducedMotion);
  const chosen = options.find((o) => o.value === value);
  const rows = action ? options.length + 1 : options.length;

  const openMenu = () => {
    setCursor(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
    audio.play('click');
  };
  const pick = (index: number) => {
    if (index === options.length) {
      setOpen(false);
      action?.onSelect();
      return;
    }
    const option = options[index];
    if (!option || option.disabled) return;
    setOpen(false);
    if (option.value !== value) onChange(option.value);
  };
  const step = (from: number, by: 1 | -1) => {
    for (let i = 1; i <= rows; i++) {
      const next = (from + by * i + rows * 2) % rows;
      if (next === options.length || !options[next].disabled) return next;
    }
    return from;
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-row="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, cursor]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setCursor((c) => step(c, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setCursor((c) => step(c, -1));
        break;
      case 'Home':
        e.preventDefault();
        setCursor(step(-1, 1));
        break;
      case 'End':
        e.preventDefault();
        setCursor(step(0, -1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        pick(cursor);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const pill = variant === 'pill';
  return (
    <div ref={root} className={`relative ${pill ? '' : 'block'} ${className}`} onKeyDown={onKey}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${cursor}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={
          pill
            ? 'flex max-w-[190px] cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] py-1 pl-3 pr-2 text-xs text-white/80 transition hover:border-[var(--user)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user)]'
            : 'flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-left text-sm text-white transition hover:border-[var(--user)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user)]'
        }
        style={open ? { borderColor: 'var(--user)' } : undefined}
      >
        <span className="truncate">{chosen?.label ?? label}</span>
        <ChevronDown size={pill ? 13 : 16} className={`shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            initial={reduced ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.14 }}
            className={`absolute z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1020]/95 p-1.5 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.8)] ring-1 ring-[rgb(var(--user-rgb)/0.25)] backdrop-blur-xl [scrollbar-color:rgb(255_255_255/0.2)_transparent] [scrollbar-width:thin] ${pill ? 'left-0 w-[min(300px,calc(100vw-3rem))] sm:left-auto sm:right-0' : 'left-0 right-0'}`}
          >
            {options.map((o, i) => {
              const on = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${id}-${i}`}
                  data-row={i}
                  role="option"
                  aria-selected={on}
                  aria-disabled={o.disabled || undefined}
                  onPointerEnter={() => !o.disabled && setCursor(i)}
                  onClick={() => pick(i)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 ${o.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${cursor === i && !o.disabled ? 'bg-white/[0.08]' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${on ? 'font-semibold text-white' : 'text-white/85'}`}>{o.label}</span>
                    {o.hint && <span className="mt-0.5 block truncate text-[11px] text-white/50">{o.hint}</span>}
                  </span>
                  {o.trailing}
                  {on && <Check size={15} className="shrink-0" style={{ color: 'var(--user)' }} />}
                </li>
              );
            })}
            {action && (
              <li
                id={`${id}-${options.length}`}
                data-row={options.length}
                role="option"
                aria-selected={false}
                onPointerEnter={() => setCursor(options.length)}
                onClick={() => pick(options.length)}
                className={`mt-1 flex cursor-pointer items-center gap-2.5 rounded-xl border-t border-white/[0.07] px-3 py-2.5 text-sm font-medium ${cursor === options.length ? 'bg-white/[0.08]' : ''}`}
                style={{ color: 'var(--user)' }}
              >
                <action.icon size={15} /> {action.label}
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
