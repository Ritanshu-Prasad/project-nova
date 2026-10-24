/**
 * The lesson feed's type scale: three heading levels (lesson title > section title > sub-block label),
 * one size for content, and formulas/code at the content size in the mono face.
 */
export const TYPE = {
  title: 'font-display text-2xl font-bold leading-tight text-white',
  section: 'font-display text-xl font-semibold leading-snug text-white',
  label: 'font-sans text-sm font-semibold uppercase tracking-wide',
  body: 'font-sans text-base leading-relaxed text-white/85',
  formula: 'font-mono text-base leading-relaxed text-white',
} as const;
