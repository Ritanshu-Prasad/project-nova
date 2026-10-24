// First: clears the pre-accounts local pilot before any store reads localStorage.
import './core/localPilot';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/oxanium';
import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { detectGraphics, useGraphics } from './core/graphics';
import './index.css';

// Start the device check and the 3D scene's download now, not after React has mounted ("No 3D" never downloads it).
detectGraphics();
if (!(useGraphics.getState().ready && useGraphics.getState().level === 'none')) void import('./three/Experience');

async function boot() {
  let Root: ComponentType = App;
  // Dev-only isolated module previews: /?preview=cockpit (stripped from production builds).
  if (import.meta.env.DEV) {
    const name = new URLSearchParams(location.search).get('preview');
    if (name) {
      const { loadPreview } = await import('./dev/previewRegistry');
      Root = (await loadPreview(name)) ?? App;
    }
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

void boot();
