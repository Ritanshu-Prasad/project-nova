/**
 * The lesson feed's entire type scale — three styles, nothing else:
 * one size for every heading, one for all content, and formulas/code at the content size in the mono face.
 */
export const TYPE = {
  heading: 'font-display text-xl font-semibold leading-snug text-white',
  body: 'font-sans text-base leading-relaxed text-white/85',
  formula: 'font-mono text-base leading-relaxed text-white',
} as const;
