import { create } from 'zustand';

/**
 * Rig-internal state: adaptive render quality and the WebGL context epoch.
 * Changes a handful of times per visit at most, so components may subscribe to it.
 */

/** 3 = best. The PerformanceMonitor steps down when the frame rate sags and back up when it recovers. */
export type QualityLevel = 0 | 1 | 2 | 3;

export interface QualitySpec {
  /** Canvas pixel-ratio clamp. */
  dpr: number | [min: number, max: number];
  /** MSAA samples of the composer's input buffer. */
  msaa: number;
  /** Chromatic aberration in the lens pass. */
  aberration: boolean;
  /** Film grain. */
  grain: boolean;
}

export const QUALITY: Record<QualityLevel, QualitySpec> = {
  3: { dpr: [1, 1.5], msaa: 4, aberration: true, grain: true },
  2: { dpr: 1, msaa: 4, aberration: true, grain: true },
  1: { dpr: 1, msaa: 2, aberration: false, grain: false },
  0: { dpr: 0.85, msaa: 0, aberration: false, grain: false },
};

export const MAX_QUALITY: QualityLevel = 3;

/** `?quality=0..3` pins a level (QA / demos on weak hardware). */
function initialQuality(): { level: QualityLevel; pinned: boolean } {
  try {
    const q = new URLSearchParams(location.search).get('quality');
    if (q !== null && /^[0-3]$/.test(q)) return { level: Number(q) as QualityLevel, pinned: true };
  } catch {
    /* no location (tests) */
  }
  return { level: MAX_QUALITY, pinned: false };
}

interface RigState {
  quality: QualityLevel;
  /** Quality no longer adapts (pinned by URL, or settled after repeated up/down flips). */
  qualityLocked: boolean;
  /** Bumped when a lost WebGL context is restored, so render-once resources redraw. */
  contextEpoch: number;
  setQuality: (level: QualityLevel) => void;
  lockQuality: () => void;
  bumpContextEpoch: () => void;
}

const init = initialQuality();

export const useRig = create<RigState>()((set) => ({
  quality: init.level,
  qualityLocked: init.pinned,
  contextEpoch: 0,
  setQuality: (quality) => set({ quality }),
  lockQuality: () => set({ qualityLocked: true }),
  bumpContextEpoch: () => set((s) => ({ contextEpoch: s.contextEpoch + 1 })),
}));
