import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./courseApi', () => ({ hasCourseApi: true, fetchTopic: vi.fn(), fetchModuleQuiz: vi.fn(), generateCourse: vi.fn(), reportAnswers: vi.fn() }));
const { track } = await import('./usageEvents');
const { useCourse } = await import('./course');

afterEach(() => vi.unstubAllGlobals());

const calls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), body: JSON.parse(init.body) }));

describe('track', () => {
  it('sends only the name of the step', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    track('topic_finished');
    const [call] = calls(fetchMock);
    expect(call.url.endsWith('/api/events')).toBe(true);
    expect(call.body).toEqual({ event: 'topic_finished' });
  });

  it('never throws when the backend is down', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(() => track('course_started')).not.toThrow();
  });
});

describe('the journey in the store', () => {
  const course = {
    id: 'c1', title: 'Docker', subtitle: '', objective: 'Docker', source: 'ai' as const,
    modules: [{ id: 'm1', title: 'Basics', topics: [{ id: 't1', title: 'Bridges', planet: 'Vega', kind: 'concept' as const, summary: 's', lesson: { minutes: 5, objectives: [], simple: '', blocks: [{ type: 'text' as const, body: 'x' }] }, quiz: [], practice: [] }] }],
  };

  it('counts a course when it starts and a topic the first time it is finished', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    useCourse.setState({ activeId: null, library: {} });
    useCourse.getState().addCourse(course);
    useCourse.getState().completeTopic('t1');
    useCourse.getState().completeTopic('t1');
    const steps = calls(fetchMock).map((call) => call.body.event);
    expect(steps.filter((step) => step === 'course_started')).toHaveLength(1);
    expect(steps.filter((step) => step === 'topic_finished')).toHaveLength(1);
  });
});
