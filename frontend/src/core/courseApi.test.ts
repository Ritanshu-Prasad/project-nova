import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('VITE_COURSE_API', 'https://api.example');
const { fetchTopic, generateCourse, reportQuestion, reportAnswers } = await import('./courseApi');

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

describe('fetchTopic', () => {
  const request = { objective: 'Docker', expectations: '', course: 'Docker', module: 'Basics', topic: 'Bridges', summary: '', covers: '', excludes: '', outline: ['Bridges'], outlineSummaries: [''], previous: '' };

  it('reports the status of a refused topic, so the screen can tell a model failure from a connection failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 502 })));
    await expect(fetchTopic(request)).rejects.toMatchObject({ status: 502, message: 'Course API responded 502' });
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


describe('generateCourse', () => {
  const goal = { mode: 'goal' as const, objective: 'Public speaking', expectations: '' };

  it('says why the AI service was not used when the backend refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Too many requests, try again later' }), { status: 429 })));
    const result = await generateCourse(goal, () => undefined);
    expect(result.via).toBe('local');
    expect(result.reason).toBe('Too many requests, try again later (429)');
  });

  it('says so when the backend cannot be reached at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect((await generateCourse(goal, () => undefined)).reason).toBe('Failed to fetch');
  });

  it('remembers what the learner expected on the course', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')));
    const result = await generateCourse({ ...goal, expectations: ' one weekend ' }, () => undefined);
    expect(result.course.expectations).toBe('one weekend');
  });
});
