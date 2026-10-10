import { AnimatePresence, motion } from 'framer-motion';
import { User, X, Check, Upload, PenTool } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAccount } from '../../core/account';
import { audio } from '../../core/audio';
import { Z } from '../../core/layers';
import { useProfile } from '../../core/hub';
import { useNova } from '../../core/store';
import { applyTheme } from '../../core/theme';
import { HudButton } from '../common/HudButton';

export default function UserSetupPopup() {
  const phase = useNova((s) => s.phase);
  const open = useNova((s) => s.userSetupOpen);
  const accountName = useAccount((s) => s.user?.name ?? '');
  // The Google first name is suggested until the pilot types their own callsign.
  const [typed, setUsername] = useState<string | null>(null);
  const username = typed ?? (accountName.trim().split(/\s+/)[0] ?? '').slice(0, 20);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('default');
  const [themeColor, setThemeColor] = useState('#06b6d4'); // Default cyan

  useEffect(() => {
    if (!open) return;
    audio.play('chime');
  }, [open]);

  const close = () => {
    applyTheme(useNova.getState().themeColor); // undo the live preview
    useNova.getState().setUserSetupOpen(false);
  };
  
  const completeSetup = () => {
    if (username.trim().length < 3) {
      useNova.getState().notify({ kind: 'warning', title: 'Invalid Alias', lines: ['Username must be at least 3 characters.'] });
      return;
    }
    
    useNova.getState().notify({ kind: 'toast', title: 'Identity Confirmed', lines: [`Welcome, ${username}.`] });
    
    // Close this window and mark as logged in
    close();
    useNova.getState().setThemeColor(themeColor);
    useProfile.getState().setCallsign(username.trim());
    useNova.getState().setLoggedIn(true);
    
    setTimeout(() => {
      useNova.getState().setCurriculumOpen(true);
    }, 500); // Short delay to let the window fade out
    
    console.log("Setup complete:", { username, avatar: selectedAvatar, theme: themeColor });
  };

  return (
    <AnimatePresence>
      {open && phase === 'landed' && (
        <motion.div
          key="usersetup"
          className="fixed inset-0 grid place-items-center bg-black/60 p-4 backdrop-blur-[3px]"
          style={{ zIndex: Z.pillar + 3 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <motion.div
            role="dialog"
            className="sys-window relative w-full max-w-[480px] p-7 sm:p-8"
            initial={{ scaleY: 0.02, scaleX: 0.4, opacity: 0 }}
            animate={{ scaleY: 1, scaleX: 1, opacity: 1 }}
            exit={{ scaleY: 0.02, opacity: 0 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 260, damping: 26 }}
          >
            <button type="button" onClick={close} className="absolute right-3 top-3 cursor-pointer p-1 text-blue-200/60 hover:text-white">
              <X size={16} />
            </button>
            
            <div className="chip-label">Step 2 of 2 · Your profile</div>
            <h2 className="glow-sys mt-3 font-display text-2xl font-bold tracking-wide text-white sm:text-3xl">
              Create your pilot profile
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-blue-100/75">
              Pick an avatar, a colour that feels like you — it shows up all over the ship — and a callsign.
            </p>

            <div className="mt-8 flex gap-8">
              {/* Avatar Selection Area */}
              <div className="flex-1">
                <div className="hud-label mb-3">Avatar Image (Required)</div>
                <div className="flex gap-4 items-center">
                  
                  {/* Default Silhouette */}
                  <button 
                    onClick={() => setSelectedAvatar('default')}
                    className={`relative flex flex-col items-center justify-center w-16 h-16 rounded-sm ring-1 ring-inset transition-all ${
                      selectedAvatar === 'default' ? 'ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] bg-emerald-900/20' : 'ring-blue-500/30 hover:ring-blue-400/60 bg-blue-900/10'
                    }`}
                  >
                    <User size={24} className={selectedAvatar === 'default' ? 'text-emerald-400' : 'text-blue-400/60'} />
                    <span className="text-[9px] font-mono mt-1 text-blue-200/60">DEFAULT</span>
                    {selectedAvatar === 'default' && <Check size={14} className="absolute -top-2 -right-2 text-emerald-400" />}
                  </button>

                  {/* Option: Upload */}
                  <button 
                    onClick={() => setSelectedAvatar('upload')}
                    className={`relative flex flex-col items-center justify-center w-16 h-16 rounded-sm ring-1 ring-inset transition-all ${
                      selectedAvatar === 'upload' ? 'ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] bg-emerald-900/20' : 'ring-blue-500/30 hover:ring-blue-400/60 bg-blue-900/10'
                    }`}
                  >
                    <Upload size={20} className={selectedAvatar === 'upload' ? 'text-emerald-400' : 'text-blue-400/60'} />
                    <span className="text-[9px] font-mono mt-1 text-blue-200/60">UPLOAD</span>
                    {selectedAvatar === 'upload' && <Check size={14} className="absolute -top-2 -right-2 text-emerald-400" />}
                  </button>

                  {/* Option: Doodle / Generate */}
                  <button 
                    onClick={() => setSelectedAvatar('doodle')}
                    className={`relative flex flex-col items-center justify-center w-16 h-16 rounded-sm ring-1 ring-inset transition-all ${
                      selectedAvatar === 'doodle' ? 'ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] bg-emerald-900/20' : 'ring-blue-500/30 hover:ring-blue-400/60 bg-blue-900/10'
                    }`}
                  >
                    <PenTool size={20} className={selectedAvatar === 'doodle' ? 'text-emerald-400' : 'text-blue-400/60'} />
                    <span className="text-[9px] font-mono mt-1 text-blue-200/60">DOODLE</span>
                    {selectedAvatar === 'doodle' && <Check size={14} className="absolute -top-2 -right-2 text-emerald-400" />}
                  </button>
                </div>
              </div>

              {/* Theme Color Picker */}
              <div className="pl-6 border-l border-blue-500/20">
                <div className="hud-label mb-3">Your colour</div>
                <div className="relative flex flex-col items-center justify-center">
                  <div className="relative w-16 h-16">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={(e) => {
                        setThemeColor(e.target.value);
                        applyTheme(e.target.value); // live preview
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <div 
                      className="absolute inset-0 rounded-full ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)] transition-all"
                      style={{ backgroundColor: themeColor }}
                    />
                  </div>
                  <span className="text-[9px] font-mono mt-2 text-blue-200/60">SELECT</span>
                </div>
              </div>
            </div>

            {/* Username Input */}
            <div className="mt-8">
              <label htmlFor="username" className="hud-label mb-2 block">Enter Callsign</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-400/50">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  id="username"
                  autoComplete="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-blue-900/10 border border-blue-500/30 text-white pl-10 pr-4 py-2.5 outline-none focus:border-cyan-400/80 focus:bg-blue-900/20 font-mono text-sm transition-all"
                  placeholder="NOOB_LVL_1"
                />
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-cyan-400/50 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-cyan-400/50 pointer-events-none" />
              </div>
            </div>

            <HudButton variant="primary" size="lg" className="mt-10 w-full" onClick={completeSetup}>
              Initialize User Profile
            </HudButton>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
