import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { audio } from '../../core/audio';
import { Z } from '../../core/layers';
import { useDeck } from '../../core/journey';
import { useNova, type Notice } from '../../core/store';
import SystemWindow from './SystemWindow';

function Item({ n }: { n: Notice }) {
  useEffect(() => {
    if (n.kind === 'toast') audio.play('notify');
    const id = setTimeout(() => useNova.getState().dismiss(n.id), n.ttl * 1000);
    return () => clearTimeout(id);
  }, [n]);
  return <SystemWindow kind={n.kind} title={n.title} lines={n.lines} onClose={() => useNova.getState().dismiss(n.id)} />;
}

/** Stacked System windows (top-right) and toasts (bottom-centre). */
export default function Notifications() {
  const notices = useNova((s) => s.notices);
  // In the lounge the right side holds the station panel, so notices stack top-left instead.
  const inLounge = useDeck((s) => s.deck === 'lounge');
  const windows = notices.filter((n) => n.kind !== 'toast');
  const toasts = notices.filter((n) => n.kind === 'toast');
  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: Z.notices }}>
      <div className={`absolute left-4 right-4 top-[72px] flex flex-col gap-3 sm:top-20 [&>*]:pointer-events-auto ${inLounge ? 'sm:left-6 sm:right-auto sm:w-[320px]' : 'sm:left-auto sm:right-6 sm:w-[380px]'}`}>
        <AnimatePresence>{windows.map((n) => <Item key={n.id} n={n} />)}</AnimatePresence>
      </div>
      <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 [&>*]:pointer-events-auto">
        <AnimatePresence>{toasts.map((n) => <Item key={n.id} n={n} />)}</AnimatePresence>
      </div>
    </div>
  );
}
