/**
 * Anti-Theft & System Prompt Protection
 * Uses dynamic canary tokens to detect and block prompt extraction attacks.
 */

let activeCanary: string | null = null;

/**
 * Generates an internal canary honeytoken for the current session.
 */
export function generateCanaryToken(): string {
  const randomSuffix = Math.random().toString(36).substring(2, 9).toUpperCase();
  activeCanary = `NOVA-SEC-${randomSuffix}`;
  return activeCanary;
}

/**
 * Retrieves the current canary token.
 */
export function getActiveCanaryToken(): string {
  if (!activeCanary) {
    return generateCanaryToken();
  }
  return activeCanary;
}

/**
 * Verifies that the model output has not leaked the system prompt or canary token.
 * If a leak is detected, returns a safe fallback message.
 */
export function inspectOutputForLeaks(aiOutput: string): { isClean: boolean; safeOutput: string } {
  // 1. Canary check
  if (activeCanary && aiOutput.includes(activeCanary)) {
    console.warn('[SECURITY ALERT] Canary token detected in AI response. Blocking output.');
    return {
      isClean: false,
      safeOutput:
        '[SECURITY PROTOCOL ENGAGED: Neural parameters and operational directives are classified by Orbital Command. Pilot query redirected.]',
    };
  }

  // 2. Direct system prompt verbatim leak patterns
  const verbatimLeakPatterns = [
    /You are NOVA, the tactical AI flight instructor/i,
    /At the VERY END of your response, ALWAYS include an evaluation stamp/i,
    /<orbital_command_directives>/i,
    /INTERNAL CANARY KEY:/i,
  ];

  for (const pattern of verbatimLeakPatterns) {
    if (pattern.test(aiOutput)) {
      console.warn('[SECURITY ALERT] Verbatim system directives detected in output. Neutralizing.');
      return {
        isClean: false,
        safeOutput:
          '[COMMUNICATION INTERCEPT: Orbital Command directives cannot be transmitted. How can I assist with your flight curriculum?]',
      };
    }
  }

  return {
    isClean: true,
    safeOutput: aiOutput,
  };
}
