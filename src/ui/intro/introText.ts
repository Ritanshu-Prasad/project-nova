/**
 * Splits "Label: value" copy so the value can be emphasised ("Player status: LEVEL 1 · UNRANKED").
 * Returns null when the line has no short label.
 */
export function splitLine(line: string): [label: string, value: string] | null {
  const i = line.indexOf(': ');
  if (i < 2 || i > 24) return null;
  return [line.slice(0, i + 1), line.slice(i + 2)];
}

/** Number with a thin space as the thousands separator ("1 024"). */
export const groupDigits = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
