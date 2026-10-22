import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('VITE_COURSE_API', 'https://api.example');
const { reportQuestion, reportAnswers } = await import('./courseApi');

afterEach(() => vi.unstubAllGlobals());

describe('reportQuestion', () => {
  it('sends the question and the reason and nothing that identifies the learner', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"thanks":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await reportQuestion('Which join keeps all rows?', 'wrong_answer');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example/api/feedback/report');
    expect(JSON.parse(init.body)).toEqual({ question: 'Which join keeps all rows?', reason: 'wrong_answer' });
    expect(init.credentials).toBeUndefined();
  });

  it('fails when the backend refuses, so the app can say so', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(reportQuestion('A question?', 'unclear')).rejects.toThrow('429');
  });
});

describe('reportAnswers', () => {
  it('sends hashes and whether each answer was right, without a level', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await reportAnswers([{ hash: 'abcdef0123456789', correct: true }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ answers: [{ hash: 'abcdef0123456789', correct: true }] });
  });
});
