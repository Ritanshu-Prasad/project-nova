/**
 * Core type definitions for the Project Nova security layer.
 * Completely decoupled from React and the DOM.
 */

export interface SanitizationResult {
  isSafe: boolean;
  sanitizedText: string;
  threatLevel: 'none' | 'low' | 'medium' | 'high';
  detectedPatterns: string[];
}

export interface SecurityAuditEntry {
  id: string;
  timestamp: number;
  threatLevel: 'none' | 'low' | 'medium' | 'high';
  originalLength: number;
  patternsDetected: string[];
  blocked: boolean;
}

export interface DelimitedPayload {
  wrappedPrompt: string;
  boundaryTag: string;
  canaryToken: string;
}

export interface ClampedEvaluation {
  mmrDelta: number;
  xpDelta: number;
  clamped: boolean;
  originalMmr?: number;
  originalXp?: number;
}

export interface TokenBudgetConfig {
  maxInputTokens: number;
  maxHistoryTokens: number;
  maxOutputTokens: number;
  maxHistoryTurns: number;
}

export interface TokenOptimizationMetrics {
  rawEstimatedTokens: number;
  optimizedEstimatedTokens: number;
  tokensSaved: number;
  turnsPreserved: number;
  historyEvicted: number;
}

export interface SecurityMetrics {
  totalAuditedRequests: number;
  threatsDetected: number;
  canaryTamperAttempts: number;
  evaluationsClamped: number;
  totalTokensSaved: number;
}

