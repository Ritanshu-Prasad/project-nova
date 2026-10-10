import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GOOGLE_CLIENT_ID, prepareGoogle, signInWithGoogle } from '../../core/account';
import { audio } from '../../core/audio';
import { useCourse } from '../../core/course';
import { useProfile } from '../../core/hub';
import { Z } from '../../core/layers';
import { goToLounge, useDeck } from '../../core/journey';
import { useNova } from '../../core/store';
import { HudButton } from '../common/HudButton';
import GoogleG from './GoogleG';

/** Seconds after landing before the System asks the player to sign in. */
const AUTO_OPEN = 1.6;

/** "Initialize identity" — the System's sign-in window. Opens itself shortly after landing. */
export default function LoginPopup() {
  const phase = useNova((s) => s.phase);
  const open = useNova((s) => s.loginOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (phase !== 'landed' || useDeck.getState().deck !== 'cockpit') return;
    const id = setTimeout(() => useNova.getState().setLoginOpen(true), AUTO_OPEN * 1000);
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    // Load Google's library now so the click can open its popup immediately.
    if (GOOGLE_CLIENT_ID) prepareGoogle().catch(() => {});
    audio.play('chime');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useNova.getState().setLoginOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => useNova.getState().setLoginOpen(false);
  const signIn = async () => {
    setError('');
    setBusy(true);
    try {
      const r = await signInWithGoogle();
      close();
      if (r.hasProfile) {
        // Returning pilot: progress is restored — straight to the lounge.
        useNova.getState().setLoggedIn(true);
        useNova.getState().notify({ kind: 'toast', title: 'Welcome back', lines: [`Progress restored, ${useProfile.getState().callsign}.`] });
        goToLounge(() => {
          if (!Object.keys(useCourse.getState().library).length) useNova.getState().setCurriculumOpen(true);
        });
      } else useNova.getState().setUserSetupOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && phase === 'landed' && (
        <motion.div
          key="login"
          className="fixed inset-0 grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]"
          style={{ zIndex: Z.pillar + 2 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            className="sys-window relative w-full max-w-[420px] p-7 sm:p-8"
            initial={{ scaleY: 0.02, scaleX: 0.4, opacity: 0 }}
            animate={{ scaleY: 1, scaleX: 1, opacity: 1 }}
            exit={{ scaleY: 0.02, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 cursor-pointer p-1 text-blue-200/60 hover:text-white">
              <X size={16} />
            </button>
            <div className="chip-label">Step 1 of 2 · Sign in</div>
            <h2 id="login-title" className="glow-sys mt-3 font-display text-2xl font-bold tracking-wide text-white sm:text-3xl">
              Welcome aboard, pilot
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-blue-100/75">
              Sign in to save your rank, streaks and progress. Your first course starts right after.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-blue-100/70">
              {['LV 1', 'Unranked', 'MMR —'].map((s) => (
                <div key={s} className="rounded-[2px] bg-blue-500/10 px-2 py-2 text-center ring-1 ring-inset ring-blue-400/25">{s}</div>
              ))}
            </div>
            <HudButton variant="primary" size="lg" className="mt-6 w-full" icon={<GoogleG className="h-5 w-5" />} onClick={() => void signIn()} disabled={busy} autoFocus>
              {busy ? 'Signing in…' : 'Continue with Google'}
            </HudButton>
            {error && (
              <p role="alert" className="mt-3 text-center text-xs leading-relaxed text-rose-300">
                {error}
              </p>
            )}
            <button type="button" onClick={close} className="mt-3 w-full cursor-pointer py-2 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-blue-200/55 hover:text-white">
              Look around first
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
