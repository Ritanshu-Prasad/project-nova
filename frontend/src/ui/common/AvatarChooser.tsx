import { AnimatePresence } from 'framer-motion';
import { Check, PenTool, Upload, User } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { avatarFromFile } from '../../core/avatarImage';
import { useNova } from '../../core/store';
import DoodlePad from './DoodlePad';

type Kind = 'default' | 'upload' | 'doodle';

/**
 * Default / Upload / Doodle avatar tiles. Upload opens the file picker (the photo is cropped square and shrunk);
 * Doodle opens a drawing pad. `value` is the chosen picture as a data URL ('' = initials).
 */
export default function AvatarChooser({ value, onChange, compact = false }: { value: string; onChange: (dataUrl: string) => void; compact?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>(value ? 'upload' : 'default');
  const [doodling, setDoodling] = useState(false);
  const [busy, setBusy] = useState(false);
  const active: Kind = value ? kind : 'default';

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await avatarFromFile(file));
      setKind('upload');
    } catch (e) {
      useNova.getState().notify({ kind: 'warning', title: 'Avatar not changed', lines: [e instanceof Error ? e.message : 'That image could not be used.'] });
    } finally {
      setBusy(false);
    }
  };

  function openPicker() {
    fileRef.current?.click();
  }

  return (
    <div className="flex items-center gap-4">
      <Tile kind="default" label="DEFAULT" active={active} value={value} compact={compact} onClick={() => onChange('')} icon={<User size={22} className={active === 'default' ? 'text-emerald-400' : 'text-blue-400/60'} />} />
      <Tile kind="upload" label={busy ? '…' : 'UPLOAD'} active={active} value={value} compact={compact} onClick={openPicker} icon={<Upload size={20} className={active === 'upload' ? 'text-emerald-400' : 'text-blue-400/60'} />} />
      <Tile kind="doodle" label="DOODLE" active={active} value={value} compact={compact} onClick={() => setDoodling(true)} icon={<PenTool size={20} className={active === 'doodle' ? 'text-emerald-400' : 'text-blue-400/60'} />} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // picking the same file again still fires
          void pick(file);
        }}
      />
      <AnimatePresence>
        {doodling && (
          <DoodlePad
            key="doodle"
            onClose={() => setDoodling(false)}
            onSave={(url) => {
              onChange(url);
              setKind('doodle');
              setDoodling(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const TILE_LABEL: Record<Kind, string> = { default: 'Use my initials', upload: 'Upload a picture', doodle: 'Draw a doodle' };

function Tile({ kind, label, icon, active, value, compact, onClick }: { kind: Kind; label: string; icon: ReactNode; active: Kind; value: string; compact: boolean; onClick: () => void }) {
  const on = active === kind;
  const preview = on && kind !== 'default' && value;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={TILE_LABEL[kind]}
      className={`relative flex ${compact ? 'size-14' : 'size-16'} cursor-pointer flex-col items-center justify-center overflow-hidden rounded-sm ring-1 ring-inset transition-all ${
        on ? 'bg-emerald-900/20 shadow-[0_0_15px_rgba(52,211,153,0.3)] ring-emerald-400' : 'bg-blue-900/10 ring-blue-500/30 hover:ring-blue-400/60'
      }`}
    >
      {preview ? (
        <img src={value} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          {icon}
          <span className="mt-1 font-mono text-[9px] text-blue-200/60">{label}</span>
        </>
      )}
      {on && <Check size={14} className="absolute right-0 top-0 rounded-bl bg-black/50 text-emerald-400" />}
    </button>
  );
}
