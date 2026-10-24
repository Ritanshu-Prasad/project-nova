import { ArrowLeft } from 'lucide-react';
import { audio } from '../../core/audio';

/**
 * The "go back" button of every full panel: clear accent outline, big enough to hit, with the Esc shortcut shown.
 * Put it in a header that sits outside the scrolling part of its panel, so it never scrolls out of reach.
 */
export default function BackPill({ label, onClick, hint = 'Esc' }: { label: string; onClick: () => void; hint?: string | null }) {
  return (
    <button
      type="button"
      onClick={() => {
        audio.play('click');
        onClick();
      }}
      className="group inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[rgb(var(--user-rgb)/0.5)] bg-[rgb(var(--user-rgb)/0.14)] pl-2.5 pr-4 text-sm font-semibold text-white shadow-[0_0_18px_-8px_var(--user)] transition hover:border-[var(--user)] hover:bg-[rgb(var(--user-rgb)/0.26)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user)]"
    >
      <span className="grid size-6 place-items-center rounded-full bg-[rgb(var(--user-rgb)/0.25)] transition group-hover:-translate-x-0.5" style={{ color: 'var(--user)' }}>
        <ArrowLeft size={14} strokeWidth={2.5} />
      </span>
      {label}
      {hint && <kbd className="ml-0.5 hidden rounded-md bg-black/30 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white/60 sm:inline">{hint}</kbd>}
    </button>
  );
}
