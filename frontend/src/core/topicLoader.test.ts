import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCourse } from './course';
import type { Course, Question, Topic } from './courseSchema';

vi.mock('./courseApi', () => ({ fetchTopic: vi.fn(), fetchModuleQuiz: vi.fn(), generateCourse: vi.fn(), hasCourseApi: false, reportAnswers: vi.fn() }));
const api = await import('./courseApi');
const { ensureTopic } = await import('./topicLoader');

const written = (title: string) => ({
  lesson: { minutes: 5, objectives: ['Explain it'], simple: 'Short.', blocks: [{ type: 'text' as const, body: `About ${title}.` }, { type: 'summary' as const, points: [`${title} point`] }] },
  quiz: [] as Question[],
  practice: [] as Question[],
});

const stub = (id: string, title: string): Topic => ({ id, title, planet: title, kind: 'concept', summary: `${title} summary`, loaded: false, lesson: { minutes: 5, objectives: [], simple: '', blocks: [] }, quiz: [], practice: [] });

const course = (id = 'c1'): Course => ({
  id, title: 'Docker', subtitle: '', objective: 'Docker', expectations: 'one weekend', source: 'ai',
  modules: [{ id: 'm1', title: 'Basics', topics: [stub('t1', 'Bridges'), stub('t2', 'Overlay')] }],
});

const topicOf = (id: string) => useCourse.getState().library.c1.course.modules[0].topics.find((t) => t.id === id)!;

beforeEach(() => {
  vi.clearAllMocks();
  useCourse.setState({ activeId: null, library: {} });
  useCourse.getState().addCourse(course());
  vi.mocked(api.fetchTopic).mockImplementation(async (req) => written(req.topic));
  vi.mocked(api.fetchModuleQuiz).mockResolvedValue([]);
});

describe('ensureTopic', () => {
  it('writes an outline-only topic with the goal, expectations and place in the course', async () => {
    await ensureTopic('c1', 't2');
    expect(api.fetchTopic).toHaveBeenCalledWith(expect.objectContaining({ objective: 'Docker', expectations: 'one weekend', module: 'Basics', topic: 'Overlay', outline: ['Bridges', 'Overlay'] }));
    expect(topicOf('t2').lesson.blocks.length).toBeGreaterThan(0);
  });

  it('tells the writer what the topic before covered', async () => {
    await ensureTopic('c1', 't1');
    await ensureTopic('c1', 't2');
    expect(vi.mocked(api.fetchTopic).mock.calls[1][0].previous).toBe('Bridges point');
  });

  it('does nothing for a topic that is already written or unknown', async () => {
    await ensureTopic('c1', 't1');
    await ensureTopic('c1', 't1');
    await ensureTopic('c1', 'nope');
    await ensureTopic('nope', 't1');
    expect(api.fetchTopic).toHaveBeenCalledTimes(1);
  });

  it('writes a topic only once when it is asked for twice at the same time', async () => {
    await Promise.all([ensureTopic('c1', 't1'), ensureTopic('c1', 't1')]);
    expect(api.fetchTopic).toHaveBeenCalledTimes(1);
  });

  it('can try again after a failure', async () => {
    vi.mocked(api.fetchTopic).mockRejectedValueOnce(new Error('busy'));
    await expect(ensureTopic('c1', 't1')).rejects.toThrow('busy');
    await ensureTopic('c1', 't1');
    expect(topicOf('t1').lesson.blocks.length).toBeGreaterThan(0);
  });

  it('asks for the module quiz once, after the last topic of the module is written', async () => {
    useCourse.getState().addCourse(course('c-quiz'));
    await ensureTopic('c-quiz', 't1');
    expect(api.fetchModuleQuiz).not.toHaveBeenCalled();
    await ensureTopic('c-quiz', 't2');
    expect(api.fetchModuleQuiz).toHaveBeenCalledTimes(1);
    expect(api.fetchModuleQuiz).toHaveBeenCalledWith(expect.objectContaining({ objective: 'Docker', module: 'Basics', topics: [expect.objectContaining({ title: 'Bridges' }), expect.objectContaining({ title: 'Overlay' })] }));
  });

  it('does not send a level to the backend', async () => {
    await ensureTopic('c1', 't1');
    expect(vi.mocked(api.fetchTopic).mock.calls[0][0]).not.toHaveProperty('level');
  });
});

describe('the kind of a topic', () => {
  it('is taken from what the backend says it wrote', async () => {
    vi.mocked(api.fetchTopic).mockImplementationOnce(async (req) => ({ ...written(req.topic), kind: 'programming' as const }));
    useCourse.getState().addCourse(course('c-kind'));
    await ensureTopic('c-kind', 't1');
    expect(useCourse.getState().library['c-kind'].course.modules[0].topics[0].kind).toBe('programming');
  });
});
