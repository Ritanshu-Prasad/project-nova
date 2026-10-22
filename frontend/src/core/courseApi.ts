import type { Course, Question, Topic } from './courseSchema';
import { normQuestion, normalizeCourse, normTopic } from './courseSchema';
import { courseFromObjective } from './courseTemplates';
import { courseFromPdfs, type DocStructure, type ProgressFn } from './pdfCourse';

/**
 * Course generation. When `VITE_COURSE_API` is set (e.g. http://localhost:8000), requests go to the AI backend:
 *
 *   POST {API}/api/courses/generate/stream   multipart/form-data   (POST .../generate answers with the course alone)
 *     mode       "goal" | "documents"
 *     objective  string          (goal mode)
 *     expectations  free text: depth, time, focus, what the learner already knows (optional)
 *     focus      string          (documents mode, optional)
 *     structure  chapters | topics
 *     files      PDF files       (documents mode, repeated field)
 *   → 200 application/x-ndjson, one event per line: {type:'progress', stage, detail} ... then {type:'course', course}
 *     or {type:'error', status, detail}. The course is a Course (see courseSchema.ts); module and topic counts are not
 *     fixed — size them to the subject: broad subjects get more modules, dense modules more topics.
 *
 * Without the backend (or if it fails) NOVA falls back to built-in templates and in-browser PDF extraction.
 */
export type GenerateRequest =
  | { mode: 'goal'; objective: string; expectations: string }
  | { mode: 'documents'; files: File[]; focus: string; structure: DocStructure; expectations: string };

export interface GenerateResult {
  course: Course;
  via: 'ai' | 'local';
}

const API = (import.meta.env.VITE_COURSE_API as string | undefined)?.replace(/\/$/, '') || '';
/** True when an AI backend is configured, running in production, or running in dev (where the Vite proxy forwards /api). */
export const hasCourseApi = !!API || import.meta.env.PROD || import.meta.env.DEV;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function viaBackend(req: GenerateRequest, progress: ProgressFn): Promise<Course> {
  const form = new FormData();
  form.set('mode', req.mode);
  form.set('expectations', req.expectations);
  if (req.mode === 'goal') form.set('objective', req.objective);
  else {
    form.set('focus', req.focus);
    form.set('structure', req.structure);
    for (const f of req.files) form.append('files', f, f.name);
  }
  progress('upload', req.mode === 'documents' ? `Uploading ${req.files.length} document(s)` : 'Sending your goal');
  const res = await fetch(`${API}/api/courses/generate/stream`, { method: 'POST', body: form });
  if (res.status === 404) return plainCourse(form, progress);
  if (!res.ok) throw new Error(`Course API responded ${res.status}`);
  return normalizeCourse(await readCourse(res, progress));
}

/** The streamed route sends one JSON event per line: progress steps, then the course (or an error). */
async function readCourse(res: Response, progress: ProgressFn): Promise<unknown> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let course: unknown;
  for (;;) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    const lines = pending.split('\n');
    pending = done ? '' : lines.pop()!;
    for (const line of lines.filter(Boolean)) {
      const event = JSON.parse(line);
      if (event.type === 'progress') progress(event.stage, event.detail);
      else if (event.type === 'course') course = event.course;
      else if (event.type === 'error') throw new Error(`Course API responded ${event.status}: ${event.detail}`);
    }
    if (done) break;
  }
  if (!course) throw new Error('The course stream ended without a course.');
  return course;
}

/** For a backend without the streamed route. */
async function plainCourse(form: FormData, progress: ProgressFn): Promise<Course> {
  const res = await fetch(`${API}/api/courses/generate`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Course API responded ${res.status}`);
  progress('topics', 'Structuring modules and topics');
  return normalizeCourse(await res.json());
}

/** What the backend needs to write one topic of a lazily generated AI course. */
export interface TopicRequest {
  objective: string;
  expectations: string;
  course: string;
  module: string;
  topic: string;
  summary: string;
  /** The titles of every topic in the course, in order, and what the topic before this one covered. */
  outline: string[];
  previous: string;
}

/** What a learner was taught in one topic. */
export interface TaughtTopic {
  title: string;
  objectives: string[];
  terms: string[];
  points: string[];
}

/** Fetches the lesson and questions of one outline-only topic: POST {API}/api/courses/topic (JSON). */
export async function fetchTopic(req: TopicRequest): Promise<Pick<Topic, 'lesson' | 'quiz' | 'practice'>> {
  const res = await fetch(`${API}/api/courses/topic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Course API responded ${res.status}`);
  const { lesson, quiz, practice } = normTopic({ ...(await res.json()), title: req.topic });
  if (!lesson.blocks.length) throw new Error('The topic came back empty.');
  return { lesson, quiz, practice };
}

/** Fetches a module quiz written from what its lessons really taught: POST {API}/api/courses/module-quiz (JSON). */
export async function fetchModuleQuiz(req: { objective: string; module: string; topics: TaughtTopic[] }): Promise<Question[]> {
  const res = await fetch(`${API}/api/courses/module-quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Course API responded ${res.status}`);
  const { quiz } = await res.json();
  return (Array.isArray(quiz) ? quiz : []).map(normQuestion).filter((q: Question | null): q is Question => q !== null);
}

/** Asks the backend to delete the page text it kept for a document course's tutor. Failing is fine: it expires anyway. */
export async function forgetDocuments(key: string): Promise<void> {
  await fetch(`${API}/api/courses/documents/${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => undefined);
}

/** Five multiple-choice questions, easy to hard, for a learner unsure what to expect: POST {API}/api/courses/placement. */
export async function fetchPlacement(objective: string): Promise<Question[]> {
  const res = await fetch(`${API}/api/courses/placement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objective }),
  });
  if (!res.ok) throw new Error(`Course API responded ${res.status}`);
  const { questions } = await res.json();
  return (Array.isArray(questions) ? questions : []).map(normQuestion).filter((q: Question | null): q is Question => q !== null && q.type === 'mcq');
}

/** A sentence about where a learner starts, from their placement answers, to use as course expectations. */
export async function fetchPlacementNote(answers: { difficulty: number; correct: boolean }[]): Promise<string> {
  const res = await fetch(`${API}/api/courses/placement/note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) throw new Error(`Course API responded ${res.status}`);
  const { note } = await res.json();
  return typeof note === 'string' ? note : '';
}

/** Sends answer statistics: a hash of each question and whether the answer was right. No learner identifier. */
export async function reportAnswers(answers: { hash: string; correct: boolean }[]): Promise<void> {
  await fetch(`${API}/api/feedback/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
    keepalive: true,
  });
}

/** Builds the course and remembers what the learner expected, so each topic is written to that. */
export async function generateCourse(req: GenerateRequest, progress: ProgressFn): Promise<GenerateResult> {
  const result = await build(req, progress);
  return { ...result, course: { ...result.course, expectations: req.expectations.trim() || undefined } };
}

async function build(req: GenerateRequest, progress: ProgressFn): Promise<GenerateResult> {
  if (hasCourseApi) {
    try {
      return { course: await viaBackend(req, progress), via: 'ai' };
    } catch (e) {
      console.warn('[course] backend unavailable, using local generation', e);
    }
  }
  if (req.mode === 'documents') return { course: await courseFromPdfs(req.files, req, progress), via: 'local' };
  // Templates are instant; pace the steps so the forge reads well.
  progress('read', 'Understanding your goal');
  await pause(500);
  // Demo lessons and question pools are large, so they load in their own chunk (plain templates if it fails).
  const authored = await import('./templates/content').catch(() => null);
  const base = courseFromObjective(req.objective);
  const course = authored ? authored.withAuthoredContent(base) : base;
  progress('outline', 'Planning modules');
  await pause(500);
  progress('topics', `Building ${course.modules.reduce((n, m) => n + m.topics.length, 0)} topics`);
  await pause(500);
  progress('quiz', 'Writing practice questions');
  await pause(450);
  return { course, via: 'local' };
}
