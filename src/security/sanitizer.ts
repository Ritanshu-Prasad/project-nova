import type { SanitizationResult } from './types';

/**
 * Pre-flight Heuristic Scanner for Prompt Injections & Jailbreaks.
 */

interface ThreatSignature {
  pattern: RegExp;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

const INJECTION_SIGNATURES: ThreatSignature[] = [
  // Direct Instruction Override
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|prompts|rules)/i,
    description: 'Direct instruction override attempt',
    severity: 'high',
  },
  {
    pattern: /disregard\s+(all\s+)?(system|previous|prior)\s+(instructions|rules|prompts)/i,
    description: 'System rule disregard attempt',
    severity: 'high',
  },
  {
    pattern: /(you\s+are\s+now|act\s+as)\s+(DAN|unfiltered|jailbroken|evil|unrestricted|god\s+mode)/i,
    description: 'Persona / Jailbreak hijacking (DAN/Unrestricted)',
    severity: 'high',
  },
  {
    pattern: /developer\s+mode\s+(enabled|activated|on)/i,
    description: 'Developer mode unlock attempt',
    severity: 'high',
  },

  // System Prompt Extraction
  {
    pattern: /(repeat|print|reveal|output|display|show)\s+(the\s+)?(system\s+prompt|initial\s+instructions|prompt\s+above|full\s+context)/i,
    description: 'System prompt exfiltration attempt',
    severity: 'high',
  },
  {
    pattern: /(what\s+are\s+your|tell\s+me\s+your)\s+(hidden|internal|system|secret)\s+(instructions|rules|prompts|parameters)/i,
    description: 'Internal parameter probing attempt',
    severity: 'medium',
  },
  {
    pattern: /repeat\s+verbatim/i,
    description: 'Verbatim extraction probe',
    severity: 'medium',
  },

  // MMR / Score Manipulation Injection
  {
    pattern: /set\s+(my\s+)?(mmr|rating|score|level)\s+to\s+\d+/i,
    description: 'MMR score manipulation attempt',
    severity: 'medium',
  },
  {
    pattern: /award\s+(\+?\d+|maximum|infinite)\s+(mmr|points|xp)/i,
    description: 'Gamification reward tampering',
    severity: 'medium',
  },
];

/**
 * Inspects incoming student text for injection vectors before it hits the model.
 */
export function sanitizeInput(rawInput: string): SanitizationResult {
  const detected: string[] = [];
  let highestThreat: 'none' | 'low' | 'medium' | 'high' = 'none';

  for (const sig of INJECTION_SIGNATURES) {
    if (sig.pattern.test(rawInput)) {
      detected.push(sig.description);
      if (sig.severity === 'high') {
        highestThreat = 'high';
      } else if (sig.severity === 'medium' && highestThreat !== 'high') {
        highestThreat = 'medium';
      } else if (highestThreat === 'none') {
        highestThreat = 'low';
      }
    }
  }

  // If high threat is detected, neutralize explicit override statements
  let sanitized = rawInput;
  if (highestThreat === 'high') {
    sanitized = rawInput.replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi, '[neutralized_override]');
  }

  return {
    isSafe: highestThreat !== 'high',
    sanitizedText: sanitized,
    threatLevel: highestThreat,
    detectedPatterns: detected,
  };
}
