import type { ComponentType } from 'react';

/** DEV ONLY — `/?preview=<name>` renders one module in isolation (see PreviewCanvas for params). */
type Loader = () => Promise<{ default: ComponentType }>;

export const PREVIEWS: Record<string, Loader> = {
  cockpit: () => import('../three/cockpit/Cockpit.preview'),
  bay: () => import('../three/bay/LaunchBay.preview'),
  space: () => import('../three/space/Space.preview'),
  rig: () => import('../three/Rig.preview'),
  audio: () => import('./AudioLab.preview'),
  intro: () => import('../ui/intro/Intro.preview'),
  hud: () => import('../ui/hud/Hud.preview'),
  landing: () => import('../ui/landing/Landing.preview'),
};

export async function loadPreview(name: string): Promise<ComponentType | null> {
  const load = PREVIEWS[name];
  return load ? (await load()).default : null;
}
