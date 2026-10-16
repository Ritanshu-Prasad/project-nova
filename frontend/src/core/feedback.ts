import { hasCourseApi, reportAnswers } from './courseApi';
import type { Level } from './courseSchema';

const FLUSH_AT = 10;
const queue: { hash: string; level: Level; correct: boolean }[] = [];

/** A short fingerprint of a question's text, so the server can count answers without ever seeing the question. */
export async function questionHash(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text.trim().toLowerCase()));
  return [...new Uint8Array(bytes)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Remembers one graded answer; they are sent in batches. Failing to send is fine: this is only statistics. */
export function noteAnswer(text: string, level: Level, correct: boolean): void {
  if (!hasCourseApi || !globalThis.crypto?.subtle) return;
  questionHash(text)
    .then((hash) => {
      queue.push({ hash, level, correct });
      if (queue.length >= FLUSH_AT) flushAnswers();
    })
    .catch(() => undefined);
}

export function flushAnswers(): void {
  if (!queue.length) return;
  reportAnswers(queue.splice(0, queue.length)).catch(() => undefined);
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', flushAnswers);
