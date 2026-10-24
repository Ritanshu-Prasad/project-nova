import { describe, expect, it } from 'vitest';
import { lessonFailureMessage } from './lessonError';

describe('lessonFailureMessage', () => {
  it('says the model could not write it this time for a 502 or 503', () => {
    expect(lessonFailureMessage({ status: 502 })).toBe("NOVA couldn't write this lesson this time. Try again.");
    expect(lessonFailureMessage({ status: 503 })).toBe("NOVA couldn't write this lesson this time. Try again.");
  });

  it('keeps the connection wording for a network error or any other status', () => {
    const connection = 'NOVA could not write this lesson. Check your connection and try again.';
    expect(lessonFailureMessage(new TypeError('Failed to fetch'))).toBe(connection);
    expect(lessonFailureMessage({ status: 500 })).toBe(connection);
    expect(lessonFailureMessage(null)).toBe(connection);
  });
});
