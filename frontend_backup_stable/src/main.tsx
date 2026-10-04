import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/oxanium';
import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
