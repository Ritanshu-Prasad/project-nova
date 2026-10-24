import { describe, expect, it } from 'vitest';
import { revealLabel, toggleReveal } from './reveal';

describe('answer reveal toggle', () => {
  it('flips between hidden and shown', () => {
    expect(toggleReveal(false)).toBe(true);
    expect(toggleReveal(true)).toBe(false);
  });

  it('labels the button for what the next click does', () => {
    expect(revealLabel(false)).toBe('Show answer');
    expect(revealLabel(true)).toBe('Hide answer');
  });
});
