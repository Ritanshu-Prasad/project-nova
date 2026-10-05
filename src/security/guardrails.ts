import type { ClampedEvaluation } from './types';

/**
 * Security Guardrails: Gamification Boundary Enforcement & Token Limits
 */

export const MAX_INPUT_CHARS = 1600; // ~400 tokens cap per message
export const MIN_ALLOWED_MMR_DELTA = -20;
export const MAX_ALLOWED_MMR_DELTA = 35;
export const MIN_ALLOWED_XP_DELTA = 0;
export const MAX_ALLOWED_XP_DELTA = 100;

/**
 * Clamps and sanitizes user input length to prevent denial-of-wallet / context-stuffing attacks.
 */
export function enforceInputLengthLimit(input: string): { trimmed: string; truncated: boolean } {
  if (input.length > MAX_INPUT_CHARS) {
    return {
      trimmed: input.substring(0, MAX_INPUT_CHARS),
      truncated: true,
    };
  }
  return {
    trimmed: input,
    truncated: false,
  };
}

/**
 * Cryptographically / Mathematically validates and clamps parsed evaluation stamps
 * to prevent MMR score inflation or gamification manipulation.
 */
export function clampEvaluationScores(rawMmr?: number, rawXp?: number): ClampedEvaluation {
  let mmrDelta = rawMmr ?? 15;
  let xpDelta = rawXp ?? 30;
  let wasClamped = false;

  if (rawMmr !== undefined) {
    if (rawMmr > MAX_ALLOWED_MMR_DELTA) {
      mmrDelta = MAX_ALLOWED_MMR_DELTA;
      wasClamped = true;
    } else if (rawMmr < MIN_ALLOWED_MMR_DELTA) {
      mmrDelta = MIN_ALLOWED_MMR_DELTA;
      wasClamped = true;
    }
  }

  if (rawXp !== undefined) {
    if (rawXp > MAX_ALLOWED_XP_DELTA) {
      xpDelta = MAX_ALLOWED_XP_DELTA;
      wasClamped = true;
    } else if (rawXp < MIN_ALLOWED_XP_DELTA) {
      xpDelta = MIN_ALLOWED_XP_DELTA;
      wasClamped = true;
    }
  }

  return {
    mmrDelta,
    xpDelta,
    clamped: wasClamped,
    originalMmr: rawMmr,
    originalXp: rawXp,
  };
}
