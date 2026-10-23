/** Small text clean-ups for lesson steps and question options. */

/** "Step 3: Mix the batter", "3. Mix the batter", "(3) Mix…" → "Mix the batter" (the app shows its own order cues). */
export function stripStepLabel(s: string): string {
  const out = s.replace(/^\s*(?:step\s*\d+\s*[:.)\-–—]?\s*|\(?\d+\s*[.):]\s+)/i, '').trim();
  return out || s;
}

/** A section label such as "Try it" or "Step 2" — not a term, answer or option worth testing. */
export const isFillerLabel = (s: string): boolean => /^(?:try it(?: yourself| now)?|steps?|step\s*\d+|your turn|practice|exercises?|action steps?)\.?$/i.test(s.trim());
