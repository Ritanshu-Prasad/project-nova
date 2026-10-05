import { create } from 'zustand';
import { shuffledIndices } from './course';
import type { Block, PlacedTopic, Question } from './courseSchema';

/**
 * NOVA's lesson assistant. With the backend available (VITE_COURSE_API, or /api in production) it streams
 * answers from the hosted model:
 *
 *   POST {API}/api/tutor/chat   application/json
 *     { messages: [{ role: "user" | "assistant", content }], context: { course, module, topic, lesson, rank } }
 *   → 200 text/plain, streamed answer text
 *
 * Otherwise (or if the call fails) an offline tutor answers from the lesson itself — explain, examples,
 * formulas, recaps and quick "quiz me" rounds it can mark.
 */
export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  /** Answered by the offline tutor. */
  offline?: boolean;
}

export interface TutorContext {
  course: string;
  module: string;
  topic: PlacedTopic;
  rank: string;
}

const API = (import.meta.env.VITE_COURSE_API as string | undefined)?.replace(/\/$/, '') || '';
export const hasTutorApi = !!API || import.meta.env.PROD;
const LS = 'nova.tutor.v1';
const MAX_MSGS = 40;

interface TutorState {
  threads: Record<string, ChatMsg[]>;
  /** Thread currently waiting on an answer. */
  busy: string | null;
  send: (key: string, text: string, ctx: TutorContext) => Promise<void>;
  clear: (key: string) => void;
}

const load = (): Record<string, ChatMsg[]> => {
  try {
    return JSON.parse(localStorage.getItem(LS) ?? '{}') as Record<string, ChatMsg[]>;
  } catch {
    return {};
  }
};

/** A pending "quiz me" question per thread, so the offline tutor can mark the reply. */
const pendingQuiz = new Map<string, Question>();

export const useTutor = create<TutorState>()((set, get) => {
  const push = (key: string, msg: ChatMsg) => set({ threads: { ...get().threads, [key]: [...(get().threads[key] ?? []), msg].slice(-MAX_MSGS) } });
  const patchLast = (key: string, fn: (m: ChatMsg) => ChatMsg) => {
    const t = get().threads[key] ?? [];
    if (!t.length) return;
    set({ threads: { ...get().threads, [key]: [...t.slice(0, -1), fn(t[t.length - 1])] } });
  };

  return {
    threads: load(),
    busy: null,

    send: async (key, text, ctx) => {
      const q = text.trim();
      if (!q || get().busy) return;
      push(key, { role: 'user', content: q });
      push(key, { role: 'assistant', content: '' });
      set({ busy: key });
      const history = (get().threads[key] ?? []).slice(0, -1).slice(-12);
      try {
        if (!hasTutorApi) throw new Error('offline');
        const res = await fetch(`${API}/api/tutor/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history.map(({ role, content }) => ({ role, content })),
            context: { course: ctx.course, module: ctx.module, topic: ctx.topic.title, lesson: lessonText(ctx.topic), rank: ctx.rank },
          }),
        });
        if (!res.ok || !res.body) throw new Error(`tutor ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          if (chunk) patchLast(key, (m) => ({ ...m, content: m.content + chunk }));
        }
        const last = get().threads[key]?.at(-1);
        if (!last?.content.trim()) throw new Error('empty');
      } catch {
        // Offline tutor: answer from the lesson, revealed at a natural typing pace.
        const answer = offlineAnswer(key, q, ctx.topic);
        patchLast(key, (m) => ({ ...m, content: '', offline: true }));
        for (let i = 0; i < answer.length; i += 6) {
          await new Promise((r) => setTimeout(r, 12));
          patchLast(key, (m) => ({ ...m, content: answer.slice(0, i + 6) }));
        }
      } finally {
        set({ busy: null });
      }
    },

    clear: (key) => {
      pendingQuiz.delete(key);
      const { [key]: _gone, ...rest } = get().threads;
      void _gone;
      set({ threads: rest });
    },
  };
});

useTutor.subscribe((s) => {
  try {
    const keys = Object.keys(s.threads).slice(-30);
    localStorage.setItem(LS, JSON.stringify(Object.fromEntries(keys.map((k) => [k, s.threads[k]]))));
  } catch {
    /* ignore */
  }
});

/** The lesson as plain text — context for the model and the corpus for the offline tutor. */
export function lessonText(t: PlacedTopic): string {
  const parts: string[] = [`Topic: ${t.title}. ${t.summary}`, `Objectives: ${t.lesson.objectives.join('; ')}`, `In plain words: ${t.lesson.simple}`];
  for (const b of t.lesson.blocks) parts.push(blockText(b));
  for (const p of t.lesson.panels ?? []) parts.push(`${p.title}: ${p.body ?? ''} ${(p.items ?? []).join('; ')}`);
  return parts.filter(Boolean).join('\n').slice(0, 8000);
}

function blockText(b: Block): string {
  switch (b.type) {
    case 'text':
      return `${b.title ? b.title + ': ' : ''}${b.body}`;
    case 'analogy':
      return `Analogy: ${b.body}`;
    case 'keyTerms':
      return b.terms.map((t) => `${t.term}: ${t.def}`).join('\n');
    case 'steps':
      return `${b.title ?? 'Steps'}: ${b.steps.join('; ')}`;
    case 'code':
      return `Code (${b.language}): ${b.code}${b.caption ? ` — ${b.caption}` : ''}`;
    case 'formula':
      return `Formula: ${b.expr}${b.caption ? ` — ${b.caption}` : ''}`;
    case 'compare':
      return `${b.title ?? 'Comparison'} (${b.columns.join(' vs ')}): ${b.rows.map((r) => `${r[0]}: ${r[1]} / ${r[2]}`).join('; ')}`;
    case 'example':
      return `Example: ${b.body}`;
    case 'callout':
      return b.body;
    case 'source':
      return `From ${b.doc}${b.page ? ` p.${b.page}` : ''}: ${b.excerpt}`;
    case 'summary':
      return `Summary: ${b.points.join('; ')}`;
  }
}

const STOP = new Set('a an the is are was were be to of in on for and or but what why how when where which who does do did can could would should i me my you your it its this that these those with about from by as at into than then so if not no yes please explain tell give show more again'.split(' '));
const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length > 2 && !STOP.has(w)) ?? [];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function offlineAnswer(key: string, q: string, t: PlacedTopic): string {
  const ql = q.toLowerCase();
  const of = <T extends Block['type']>(type: T) => t.lesson.blocks.filter((b): b is Extract<Block, { type: T }> => b.type === type);

  // Marking a "quiz me" answer.
  const pending = pendingQuiz.get(key);
  if (pending) {
    pendingQuiz.delete(key);
    const ok = checkAnswer(pending, q);
    if (ok !== null) return `${ok ? '**Correct!** Nice one.' : `**Not quite.** The answer is **${answerOf(pending)}**.`}${pending.why ? `\n\n${pending.why}` : ''}\n\nSay “quiz me” for another.`;
  }

  if (/quiz|test me|question for me|practice/.test(ql)) {
    const pool = t.quiz.filter((x) => x.type !== 'multi');
    if (pool.length) {
      const raw = pick(pool);
      // Templates store the right option first — show them shuffled.
      const order = raw.type === 'mcq' ? shuffledIndices(raw) : [];
      const item: Question = raw.type === 'mcq' ? { ...raw, options: order.map((i) => raw.options[i]), answer: order.indexOf(raw.answer) } : raw;
      pendingQuiz.set(key, item);
      const opts = item.type === 'mcq' ? '\n' + item.options.map((o, i) => `- **${'ABCD'[i]}** ${o}`).join('\n') : item.type === 'truefalse' ? '\n- True\n- False' : '';
      return `Here’s one:\n\n**${item.q}**${opts}\n\nReply with your answer and I’ll check it.`;
    }
  }
  if (/simpl|eli5|easy|plain|confus|don.?t (get|understand)/.test(ql)) {
    return `In plain words: ${t.lesson.simple || t.summary}${of('analogy')[0] ? `\n\nThink of it like this: ${of('analogy')[0].body}` : ''}`;
  }
  if (/example|instance|show me/.test(ql)) {
    const ex = [...of('example').map((b) => b.body), ...of('analogy').map((b) => b.body)];
    if (ex.length) return `Here’s an example from this lesson:\n\n${ex.join('\n\n')}`;
  }
  if (/formula|equation|maths|math/.test(ql) && of('formula').length) {
    return `The formulas in this topic:\n\n${of('formula')
      .map((f) => `- \`${f.expr}\`${f.caption ? ` — ${f.caption}` : ''}`)
      .join('\n')}`;
  }
  if (/summar|recap|tl.?dr|key points|main idea/.test(ql)) {
    const s = of('summary')[0];
    return s ? `In a nutshell:\n\n${s.points.map((p) => `- ${p}`).join('\n')}` : t.summary;
  }
  if (/why|matter|use|real.?(world|life)|useful/.test(ql)) {
    const used = t.lesson.panels?.find((p) => /used|use it|when to/i.test(p.title));
    if (used) return `Where this shows up:\n\n${(used.items ?? [used.body ?? '']).map((i) => `- ${i}`).join('\n')}`;
  }

  // Retrieval: the lesson sentences that share the most words with the question, plus matching key terms.
  const qw = new Set(words(q));
  const terms = of('keyTerms')
    .flatMap((b) => b.terms)
    .filter((x) => qw.has(x.term.toLowerCase()) || words(x.term).some((w) => qw.has(w)));
  const corpus = [t.summary, t.lesson.simple, ...t.lesson.blocks.map(blockText), ...(t.lesson.panels ?? []).map((p) => p.body ?? '')].join('\n');
  const sentences = corpus
    .split(/(?<=[.!?])\s+|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  const scored = sentences
    .map((s) => ({ s, score: words(s).filter((w) => qw.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.s);
  if (terms.length || scored.length) {
    return [...terms.map((x) => `**${x.term}** — ${x.def}`), ...scored].join('\n\n');
  }
  const known = of('keyTerms').flatMap((b) => b.terms.map((x) => x.term));
  return `I couldn’t find that in this lesson. Try asking me to **explain it simply**, for an **example**, a **recap**, or say **quiz me**${known.length ? ` — or ask about ${known.slice(0, 3).join(', ')}` : ''}.`;
}

function answerOf(q: Question): string {
  switch (q.type) {
    case 'mcq':
      return q.options[q.answer];
    case 'truefalse':
      return q.answer ? 'True' : 'False';
    case 'fill':
      return q.answer;
    case 'multi':
      return q.answers.map((i) => q.options[i]).join(', ');
  }
}

function checkAnswer(q: Question, reply: string): boolean | null {
  const r = norm(reply);
  if (!r) return null;
  switch (q.type) {
    case 'mcq': {
      const letter = r.match(/^([abcd])\b/)?.[1];
      if (letter) return 'abcd'.indexOf(letter) === q.answer;
      const hit = q.options.findIndex((o) => r.includes(norm(o)) || norm(o).includes(r));
      return hit < 0 ? null : hit === q.answer;
    }
    case 'truefalse':
      if (/^(true|yes|t|correct|right)\b/.test(r)) return q.answer;
      if (/^(false|no|f|wrong)\b/.test(r)) return !q.answer;
      return null;
    case 'fill':
      return [q.answer, ...(q.accept ?? [])].some((a) => norm(a) === r || r.includes(norm(a)));
    case 'multi':
      return null;
  }
}
