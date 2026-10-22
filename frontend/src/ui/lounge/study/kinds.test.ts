import { describe, expect, it } from 'vitest';
import { BADGE_KINDS, KIND_TEMPLATES } from './kinds';

describe('which topic kinds get a badge', () => {
  it('shows one only for code to write and documents to read', () => {
    expect([...BADGE_KINDS].sort()).toEqual(['document', 'programming']);
  });

  it('keeps a template for every kind, so a header and a study tip always exist', () => {
    for (const kind of ['concept', 'programming', 'math', 'science', 'humanities', 'language', 'document'] as const) {
      expect(KIND_TEMPLATES[kind].tip.length).toBeGreaterThan(10);
    }
  });
});
