import { beforeAll, describe, expect, it } from 'vitest';

// The store reads localStorage when it loads; give it an empty one outside a browser.
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const data: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = String(v)), removeItem: (k: string) => void delete data[k] },
    });
  }
});

describe('photosensitivity warning state', () => {
  it('starts unanswered (so it is asked on every visit) and is never saved', async () => {
    const { useNova } = await import('./store');
    expect(useNova.getState().warningAccepted).toBe(false);
    useNova.getState().setWarningAccepted(true);
    expect(useNova.getState().warningAccepted).toBe(true);
    expect(Object.keys(localStorage as unknown as Record<string, string>).filter((k) => /warn/i.test(k))).toEqual([]);
  });

  it('has advice for people with epilepsy and a skip option', async () => {
    const { WARNING } = await import('./content');
    expect(WARNING.advice).toMatch(/epilepsy/i);
    expect(WARNING.advice).toMatch(/skip/i);
    expect(WARNING.skip).toMatch(/skip/i);
  });
});
