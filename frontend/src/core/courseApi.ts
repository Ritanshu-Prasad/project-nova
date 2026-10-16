import type { Course, Level, Topic } from './courseSchema';
import { normalizeCourse, normTopic } from './courseSchema';
import { courseFromObjective } from './courseTemplates';
import { courseFromPdfs, type DocStructure, type ProgressFn } from './pdfCourse';

/**
 * Course generation. When `VITE_COURSE_API` is set (e.g. http://localhost:8000), requests go to the AI backend:
 *
 *   POST {API}/api/courses/generate   multipart/form-data
 *     mode       "goal" | "documents"
 *     objective  string          (goal mode)
 *     level      beginner | intermediate | advanced
 *     focus      string          (documents mode, optional)
 *     structure  chapters | topics
 *     files      PDF files       (documents mode, repeated field)
 *   → 200 application/json: a Course (see courseSchema.ts). Module and topic counts are not fixed — size them
 *     to the subject: broad subjects get more modules, dense modules more topics (the journey follows suit).
 *
 * Without the backend (or if it fails) NOVA falls back to built-in templates and in-browser PDF extraction.
 */
export type GenerateRequest =
  | { mode: 'goal'; objective: string; level: Level }
  | { mode: 'documents'; files: File[]; focus: string; structure: DocStructure; level: Level };

export interface GenerateResult {
  course: Course;
  via: 'ai' | 'local';
}

const API = (import.meta.env.VITE_COURSE_API as string | undefined)?.replace(/\/$/, '') || '';
/** True when an AI backend is configured or running in Vercel production. */
export const hasCourseApi = !!API || import.meta.env.PROD;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function viaBackend(req: GenerateRequest, progress: ProgressFn): Promise<Course> {
  const form = new FormData();
  form.set('mode', req.mode);
  form.set('level', req.level);
  if (req.mode === 'goal') form.set('objective', req.objective);
  else {
    form.set('focus', req.focus);
    form.set('structure', req.structure);
    for (const f of req.files) form.append('files', f, f.name);
  }
  progress('upload', req.mode === 'documents' ? `Uploading ${req.files.length} document(s)` : 'Sending your goal');
  const res = await fetch(`${API}/api/courses/generate`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Course API responded ${res.status}`);
  progress('topics', 'Structuring modules and topics');
  return normalizeCourse(await res.json());
}

/** What the backend needs to write one topic of a lazily generated AI course. */
export interface TopicRequest {
  level: Level;
  objective: string;
  course: string;
  module: string;
  topic: string;
  summary: string;
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

export async function generateCourse(req: GenerateRequest, progress: ProgressFn): Promise<GenerateResult> {
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
  const base = courseFromObjective(req.objective, req.level);
  const course = authored ? authored.withAuthoredContent(base) : base;
  progress('outline', 'Planning modules');
  await pause(500);
  progress('topics', `Building ${course.modules.reduce((n, m) => n + m.topics.length, 0)} topics`);
  await pause(500);
  progress('quiz', 'Writing practice questions');
  await pause(450);
  return { course, via: 'local' };
}
