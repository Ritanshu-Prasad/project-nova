import type { Course, Module, Question, Topic } from './courseSchema';
import { normQuestion, normalizeCourse, normTopic } from './courseSchema';
import { courseFromObjective, isPresetObjective } from './courseTemplates';
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
/** Global toggle: PDF upload option disabled for now; course creation is goal/preset focused */
export const ENABLE_PDF_UPLOAD = false;

export type GenerateRequest =
  | { mode: 'goal'; objective: string; expectations: string; isPreset?: boolean }
  | { mode: 'documents'; files: File[]; focus: string; structure: DocStructure; expectations: string };

export interface GenerateResult {
  course: Course;
  via: 'ai' | 'local';
  /** Why the AI service was not used, when it was configured but failed. */
  reason?: string;
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
  if (!res.ok) throw new Error(await failure(res));
  return normalizeCourse(await readCourse(res, progress));
}

/** What the backend said was wrong, such as "Too many requests", or just its status. */
async function failure(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  const detail = typeof body?.detail === 'string' ? body.detail : '';
  return detail ? `${detail} (${res.status})` : `Course API responded ${res.status}`;
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

/** A backend answer that is not OK; `status` tells the screen whether the model or the connection failed. */
export class CourseApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Course API responded ${status}`);
    this.name = 'CourseApiError';
    this.status = status;
  }
}

/** What the backend needs to write one topic of a lazily generated AI course. */
export interface TopicRequest {
  objective: string;
  expectations: string;
  course: string;
  module: string;
  topic: string;
  summary: string;
  /** What this topic teaches and what it leaves to other topics, from the outline. */
  covers: string;
  excludes: string;
  /** The titles of every topic in the course, in order, and what the topic before this one covered. */
  outline: string[];
  /** The summary of each topic in `outline`, in the same order. */
  outlineSummaries: string[];
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
export async function fetchTopic(req: TopicRequest): Promise<Pick<Topic, 'lesson' | 'quiz' | 'practice'> & { kind?: Topic['kind'] }> {
  const res = await fetch(`${API}/api/courses/topic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new CourseApiError(res.status);
  const { lesson, quiz, practice, kind } = normTopic({ ...(await res.json()), title: req.topic });
  if (!lesson.blocks.length) throw new Error('The topic came back empty.');
  return { lesson, quiz, practice, kind };
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

/** One message of the conversation about the plan. */
export interface PlanChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface PlanRevisionRequest {
  objective: string;
  expectations: string;
  title: string;
  modules: Module[];
  message: string;
  history: PlanChatMessage[];
}

/** Changes the course plan as the learner asks: POST {API}/api/courses/outline/revise. Returns a sentence about what changed and the whole new list of modules. */
export async function reviseOutline(req: PlanRevisionRequest): Promise<{ reply: string; modules: Module[] }> {
  const res = await fetch(`${API}/api/courses/outline/revise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...req,
      modules: req.modules.map((m) => ({ title: m.title, topics: m.topics.map((t) => ({ title: t.title, planet: t.planet, summary: t.summary, covers: t.covers, excludes: t.excludes })) })),
      history: req.history.slice(-6),
    }),
  });
  if (!res.ok) throw new Error(await failure(res));
  const { reply, modules } = await res.json();
  return { reply: typeof reply === 'string' ? reply : '', modules: normalizeCourse({ id: 'plan', title: req.title, modules }).modules };
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

export type ReportReason = 'wrong_answer' | 'unclear' | 'wrong_type' | 'off_topic' | 'other';

/** Tells the backend a question is wrong: POST {API}/api/feedback/report. It carries the question's text and the reason only. */
export async function reportQuestion(question: string, reason: ReportReason): Promise<void> {
  const res = await fetch(`${API}/api/feedback/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, reason }),
  });
  if (!res.ok) throw new Error(`Course API responded ${res.status}`);
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
  let reason: string | undefined;
  // A preset course skips the model and loads the curated course directly.
  const isPreset = req.mode === 'goal' && (req.isPreset || isPresetObjective(req.objective));
  if (!isPreset && hasCourseApi) {
    try {
      return { course: await viaBackend(req, progress), via: 'ai' };
    } catch (e) {
      console.warn('[course] backend unavailable, using local generation', e);
      reason = e instanceof Error ? e.message : String(e);
    }
  }
  if (req.mode === 'documents') return { course: await courseFromPdfs(req.files, req, progress), via: 'local', reason };
  // Templates are instant; pace the steps so the forge reads well.
  progress('read', isPreset ? 'Loading pre-set curriculum…' : 'Understanding your goal');
  await pause(400);
  // Demo lessons and question pools are large, so they load in their own chunk (plain templates if it fails).
  const authored = await import('./templates/content').catch(() => null);
  const base = courseFromObjective(req.objective);
  const course = authored ? authored.withAuthoredContent(base) : base;
  progress('outline', 'Planning modules');
  await pause(400);
  progress('topics', `Building ${course.modules.reduce((n, m) => n + m.topics.length, 0)} topics`);
  await pause(400);
  progress('quiz', 'Writing practice questions');
  await pause(350);
  return { course, via: 'local', reason };
}
