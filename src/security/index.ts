/**
 * Project Nova Security Infrastructure
 * Central decoupled facade combining:
 * - Structural Delimiters & Tag Breakout Neutralization
 * - Pre-flight Heuristic Injection & Jailbreak Sanitization
 * - Anti-Theft Dynamic Honeytoken (Canary) Protection
 * - Gamification & Token Limit Guardrails
 * - Token Window Sliding & Whitespace Compression
 * - Audit Telemetry & Incident Logging
 */

import { getActiveCanaryToken, inspectOutputForLeaks } from './antiTheft';
import { wrapInStructuralDelimiters, wrapSystemDirectives } from './delimiters';
import { clampEvaluationScores, enforceInputLengthLimit } from './guardrails';
import { sanitizeInput } from './sanitizer';
import {
  recordCanaryViolation,
  recordClampingIncident,
  recordSecurityAudit,
  recordTokensSaved,
} from './telemetry';
import {
  compressPromptText,
  DEFAULT_TOKEN_BUDGET,
  optimizeHistoryWindow,
} from './tokenOptimizer';
import type { MinimalChatMessage } from './tokenOptimizer';
import type {
  ClampedEvaluation,
  SanitizationResult,
  TokenBudgetConfig,
  TokenOptimizationMetrics,
} from './types';



export * from './antiTheft';
export * from './delimiters';
export * from './guardrails';
export * from './sanitizer';
export * from './telemetry';
export * from './tokenOptimizer';
export type * from './types';

/**
 * Prepares and hardens student prompt input before transmission to an LLM provider.
 * Runs length enforcement, prompt compression, heuristic threat scanning,
 * canary generation, and structural boundary encapsulation.
 */
export function prepareSecurePrompt(
  rawInput: string,
  baseSystemDirectives: string
): {
  systemPrompt: string;
  userPrompt: string;
  sanitization: SanitizationResult;
  truncated: boolean;
  compressed: boolean;
} {
  // 1. Length enforcement (Denial-of-wallet / context stuffing defense)
  const { trimmed, truncated } = enforceInputLengthLimit(rawInput);

  // 2. Whitespace compression
  const compressedInput = compressPromptText(trimmed);

  // 3. Pre-flight heuristic injection scanner
  const sanitization = sanitizeInput(compressedInput);

  // 4. Record audit telemetry
  recordSecurityAudit({
    threatLevel: sanitization.threatLevel,
    originalLength: rawInput.length,
    patternsDetected: sanitization.detectedPatterns,
    blocked: !sanitization.isSafe,
  });

  // 5. Generate Canary Token & Wrap System Prompt
  const canary = getActiveCanaryToken();
  const hardenedSystemPrompt = wrapSystemDirectives(baseSystemDirectives, canary);

  // 6. Wrap user input inside immutable boundary tags
  const encapsulatedUserPrompt = wrapInStructuralDelimiters(sanitization.sanitizedText);

  return {
    systemPrompt: hardenedSystemPrompt,
    userPrompt: encapsulatedUserPrompt,
    sanitization,
    truncated,
    compressed: compressedInput.length < trimmed.length,
  };
}

/**
 * Validates, post-processes, and checks the AI response for leakages or extraction exploits.
 */
export function verifyAndCleanAIResponse(rawOutput: string): { text: string; isSecure: boolean } {
  const { isClean, safeOutput } = inspectOutputForLeaks(rawOutput);
  if (!isClean) {
    recordCanaryViolation();
  }

  return {
    text: safeOutput,
    isSecure: isClean,
  };
}

/**
 * Clamps game MMR and XP adjustments within non-exploitable mathematical bounds.
 */
export function enforceEvaluationBounds(rawMmr?: number, rawXp?: number): ClampedEvaluation {
  const clamped = clampEvaluationScores(rawMmr, rawXp);
  if (clamped.clamped) {
    recordClampingIncident();
  }
  return clamped;
}

/**
 * Optimizes conversation history by pruning within token budgets and compressing text.
 */
export function optimizeConversationHistory<T extends MinimalChatMessage>(
  history: T[],
  budget: TokenBudgetConfig = DEFAULT_TOKEN_BUDGET
): {
  optimizedHistory: T[];
  metrics: TokenOptimizationMetrics;
  missionContextSummary?: string;
} {
  const result = optimizeHistoryWindow(history, budget);
  if (result.metrics.tokensSaved > 0) {
    recordTokensSaved(result.metrics.tokensSaved);
  }
  return result;
}
