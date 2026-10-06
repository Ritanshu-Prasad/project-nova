import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Block, Course, Level, Module, Question, Topic } from './courseSchema';
import { makeId } from './courseSchema';

/**
 * Builds a structured course from the user's PDFs (class notes, a book) entirely in the browser.
 * The structure follows the material's scope: each chapter of the PDF outline becomes a module and its
 * sections become topics, so a long book gets many modules and a dense chapter gets many topics. Without an
 * outline, pages are split into topics (more pages → more topics) grouped into modules. Heuristics then write
 * overview / key-term / summary blocks plus practice questions. The AI backend can replace this later
 * with richer generation — the output format is the same.
 */

export type DocStructure = 'chapters' | 'topics';
export type ProgressFn = (stage: string, detail?: string) => void;

const MAX_FILES = 5;
/** Topics across all documents (keeps generation fast); chapters keep all their pages by merging. */
const MAX_TOPICS = 36;
const PAGES_PER_SECTION = 4;
const PLANETS = ['Kepler', 'Vega', 'Lyra', 'Orion', 'Atlas', 'Halo', 'Zephyr', 'Echo', 'Juno', 'Rhea', 'Talos', 'Iris', 'Cora', 'Pax', 'Sol', 'Nyx', 'Aster', 'Mira', 'Tycho', 'Elara'];
const STOP = new Set(
  'the a an and or of to in on for with is are was were be been being by as at from that this these those it its into than then which who whom whose what when where how can could should would may might will shall not no yes also such each other more most many much very about over under between through during before after above below up down out off again further once here there all any both few some only own same so too just their them they there have has had do does did using used use one two three first second however therefore thus because while within without upon page figure table chapter section example'.split(' '),
);

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

const clean = (t: string) =>
  t
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

async function readPage(doc: PDFDocumentProxy, n: number): Promise<{ text: string; heading: string }> {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  let text = '';
  let best = { size: 0, str: '' };
  for (const it of content.items) {
    if (!('str' in it)) continue;
    const size = Math.abs(it.transform[3]) || Math.hypot(it.transform[2], it.transform[3]);
    text += it.str + (it.hasEOL ? '\n' : ' ');
    const s = it.str.trim();
    if (s.length >= 4 && s.length <= 80 && /[A-Za-z]/.test(s) && size > best.size + 0.5) best = { size, str: s };
  }
  page.cleanup();
  return { text: clean(text), heading: best.str };
}

interface Section {
  title: string;
  start: number;
  end: number;
}

interface Chapter {
  title: string;
  sections: Section[];
}

/** Splits a page range into topics: about one per 8 pages, at most `max`. */
function splitRange(title: string, start: number, end: number, max = 6): Section[] {
  const pages = end - start + 1;
  const count = Math.max(1, Math.min(max, Math.round(pages / 8)));
  const size = Math.ceil(pages / count);
  return Array.from({ length: count }, (_, i) => ({ title: count === 1 ? title : '', start: start + i * size, end: Math.min(end, start + (i + 1) * size - 1) })).filter((x) => x.start <= end);
}

type OutlineNode = { title: string; dest: unknown; items?: OutlineNode[] };

async function pageOf(doc: PDFDocumentProxy, it: OutlineNode): Promise<number | null> {
  try {
    const dest = (typeof it.dest === 'string' ? await doc.getDestination(it.dest) : it.dest) as unknown[] | null;
    if (!dest || !dest[0]) return null;
    const idx = typeof dest[0] === 'number' ? dest[0] : await doc.getPageIndex(dest[0] as Parameters<PDFDocumentProxy['getPageIndex']>[0]);
    return idx + 1;
  } catch {
    return null;
  }
}

/** Chapters (outline top level) and their sections (second level), with page ranges. */
async function outlineChapters(doc: PDFDocumentProxy): Promise<Chapter[]> {
  const outline = (await doc.getOutline().catch(() => null)) as OutlineNode[] | null;
  if (!outline || !outline.length) return [];
  let roots = outline;
  if (roots.length === 1 && roots[0].items && roots[0].items.length > 1) roots = roots[0].items;
  const heads: { title: string; page: number; kids: { title: string; page: number }[] }[] = [];
  for (const r of roots.slice(0, 40)) {
    const page = await pageOf(doc, r);
    if (!page || !r.title.trim()) continue;
    const kids: { title: string; page: number }[] = [];
    for (const k of (r.items ?? []).slice(0, 15)) {
      const kp = await pageOf(doc, k);
      if (kp && k.title.trim() && kp >= page) kids.push({ title: k.title.trim(), page: kp });
    }
    kids.sort((x, y) => x.page - y.page);
    heads.push({ title: r.title.trim(), page, kids: kids.filter((k, i) => i === 0 || k.page > kids[i - 1].page) });
  }
  heads.sort((x, y) => x.page - y.page);
  const uniq = heads.filter((h, i) => i === 0 || h.page > heads[i - 1].page);
  return uniq.map((h, i) => {
    const end = Math.max(h.page, (uniq[i + 1]?.page ?? doc.numPages + 1) - 1);
    const sections =
      h.kids.length >= 2
        ? h.kids.map((k, j) => ({ title: k.title, start: j === 0 ? h.page : k.page, end: Math.max(k.page, Math.min(end, (h.kids[j + 1]?.page ?? end + 1) - 1)) }))
        : splitRange(h.kids[0]?.title ?? h.title, h.page, end);
    return { title: h.title, sections };
  });
}

/** No outline: about one topic per 6 pages, grouped into modules of up to 5 topics. */
function chunkChapters(pages: number, docName: string): Chapter[] {
  const topics = Math.max(1, Math.min(24, Math.round(pages / 6)));
  const size = Math.ceil(pages / topics);
  const secs: Section[] = Array.from({ length: topics }, (_, i) => ({ title: '', start: i * size + 1, end: Math.min(pages, (i + 1) * size) })).filter((x) => x.start <= pages);
  const groups = Math.max(1, Math.ceil(secs.length / 5));
  const per = Math.ceil(secs.length / groups);
  return Array.from({ length: groups }, (_, g) => ({ title: groups > 1 ? `${docName} · Part ${g + 1}` : docName, sections: secs.slice(g * per, (g + 1) * per) })).filter((c) => c.sections.length);
}

/** Keeps the topic count within budget: merges the last sections of the busiest chapters, then trims chapters. */
function capChapters(chapters: Chapter[], budget: number): Chapter[] {
  const out = chapters.map((c) => ({ ...c, sections: [...c.sections] }));
  const total = () => out.reduce((n, c) => n + c.sections.length, 0);
  while (total() > budget) {
    const big = out.reduce((m, c) => (c.sections.length > m.sections.length ? c : m), out[0]);
    if (big.sections.length <= 1) break;
    const last = big.sections.pop()!;
    big.sections[big.sections.length - 1] = { ...big.sections[big.sections.length - 1], end: last.end };
  }
  return out.slice(0, Math.max(1, budget));
}

const words = (t: string) => t.toLowerCase().match(/[a-z][a-z’'-]{2,}/g) ?? [];

function sentencesOf(text: string): string[] {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 280 && /[a-z]{3}/.test(s) && !/\.{4,}|…{2,}/.test(s));
}

function keywordFreq(text: string): Map<string, number> {
  const f = new Map<string, number>();
  for (const w of words(text)) if (w.length >= 5 && !STOP.has(w)) f.set(w, (f.get(w) ?? 0) + 1);
  return f;
}

function topKeywords(f: Map<string, number>, n: number): string[] {
  const out: string[] = [];
  for (const [w] of [...f.entries()].sort((a, b) => b[1] - a[1])) {
    const stem = w.replace(/(es|s)$/, '');
    if (!out.some((o) => o.replace(/(es|s)$/, '') === stem)) out.push(w);
    if (out.length >= n) break;
  }
  return out;
}

function definitionsOf(sents: string[]): { term: string; def: string }[] {
  const out: { term: string; def: string }[] = [];
  const re = /^(?:An? |The )?([A-Z][A-Za-z0-9’'\- ]{2,40}?)\s+(?:is|are|refers to|means|describes|denotes)\s+(?:an? |the )?(.{12,170}?)[.;:]/;
  for (const s of sents) {
    const m = re.exec(s);
    if (m && m[1].split(' ').length <= 5 && !out.some((o) => o.term.toLowerCase() === m[1].toLowerCase())) out.push({ term: m[1].trim(), def: m[2].trim() });
    if (out.length >= 6) break;
  }
  return out;
}

function summaryOf(sents: string[], freq: Map<string, number>, n: number): string[] {
  const scored = sents.map((s, i) => ({ s, i, score: words(s).reduce((a, w) => a + (freq.get(w) ?? 0), 0) / Math.max(8, words(s).length) }));
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

function blank(sentence: string, word: string): string | null {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(sentence) ? sentence.replace(re, '____') : null;
}

const excerpt = (text: string, max = 520) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, '')}…` : t;
};

interface Built {
  topic: Topic;
  terms: { term: string; def: string }[];
}

/** Removes heading-like lines (short, no sentence punctuation) so they don't leak into the prose. */
const stripHeadings = (text: string) =>
  text
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return t.length >= 70 || /[.!?:;)\]”"]$/.test(t);
    })
    .join('\n');

function buildTopic(docName: string, sec: Section, rawText: string, planet: string, termPool: string[]): Built {
  const text = stripHeadings(rawText);
  const sents = sentencesOf(text);
  const freq = keywordFreq(text);
  const kws = topKeywords(freq, 6);
  const defs = definitionsOf(sents);
  const summary = summaryOf(sents, freq, 3);
  const blocks: Block[] = [];
  const pages = sec.start === sec.end ? `page ${sec.start}` : `pages ${sec.start}–${sec.end}`;

  if (!sents.length) {
    blocks.push({ type: 'callout', tone: 'warning', body: `No selectable text was found on ${pages} — they may be scanned images. AI-powered reading (OCR) will handle these once the backend is connected.` });
  } else {
    blocks.push({ type: 'text', title: 'Overview', body: sents.slice(0, 3).join(' ') });
    if (defs.length) blocks.push({ type: 'keyTerms', terms: defs.slice(0, 5) });
    const paras = text.split(/\n\n+/).filter((p) => p.replace(/\s+/g, ' ').length > 160);
    if (paras[0]) blocks.push({ type: 'source', doc: docName, page: sec.start, excerpt: excerpt(paras[0]) });
    if (paras.length > 2) blocks.push({ type: 'source', doc: docName, page: Math.min(sec.end, sec.start + 1), excerpt: excerpt(paras[Math.floor(paras.length / 2)]) });
    if (kws.length >= 3) blocks.push({ type: 'callout', tone: 'fact', body: `Recurring ideas in this section: ${kws.slice(0, 5).join(', ')}.` });
    if (summary.length) blocks.push({ type: 'summary', points: summary });
  }

  const quiz: Question[] = [];
  const pool = [...new Set([...termPool, ...defs.map((d) => d.term)])];
  for (const d of defs.slice(0, 2)) {
    const extra = kws.map((k) => k.charAt(0).toUpperCase() + k.slice(1));
    const distractors = [...new Set([...pool, ...extra])].filter((t) => t.toLowerCase() !== d.term.toLowerCase() && !d.def.toLowerCase().includes(t.toLowerCase())).slice(0, 3);
    if (distractors.length >= 1) quiz.push({ type: 'mcq', q: `Which term matches this description: “${d.def}”?`, options: [d.term, ...distractors], answer: 0, why: `${d.term} ${d.def}.`, difficulty: 2 });
  }
  for (const kw of kws) {
    if (quiz.filter((q) => q.type === 'fill').length >= 2) break;
    const s = summary.find((x) => blank(x, kw)) ?? sents.find((x) => blank(x, kw));
    const q = s && blank(s, kw);
    if (q) quiz.push({ type: 'fill', q, answer: kw, why: `From ${pages}: “${s}”`, difficulty: 2 });
  }
  if (summary[0]) quiz.push({ type: 'truefalse', q: `According to your document: “${summary[0]}”`, answer: true, why: `This is stated on ${pages} of ${docName}.`, difficulty: 1 });

  const title = sec.title || `${docName} · ${pages}`;
  const wordCount = words(text).length;
  return {
    terms: defs,
    topic: {
      id: makeId('topic'),
      title: title.length > 70 ? `${title.slice(0, 67)}…` : title,
      planet,
      kind: 'document',
      summary: summary[0] ? excerpt(summary[0], 120) : `From ${pages} of ${docName}.`,
      lesson: {
        minutes: Math.max(3, Math.round(wordCount / 220)),
        objectives: [kws.length >= 2 ? `Explain ${kws[0]} and ${kws[1]}` : `Understand ${title}`, `Review ${pages} of ${docName}`],
        simple: summary.length ? [...summary].sort((a, b) => a.length - b.length)[0] : 'This section has no extractable text yet.',
        blocks,
      },
      quiz,
    },
  };
}

/** Reads the PDFs and returns a structured course (one module per document). */
export async function courseFromPdfs(
  files: File[],
  opts: { structure: DocStructure; focus?: string; level: Level },
  progress: ProgressFn,
): Promise<Course> {
  const pdfjs = await loadPdfjs();
  const docs = files.slice(0, MAX_FILES);
  const modules: Module[] = [];
  const documents: { name: string; pages: number }[] = [];
  const termPool: string[] = [];
  let planetIndex = 0;
  let foundText = false;
  const gathered: { docName: string; chapters: { title: string; picked: { s: Section; text: string }[] }[] }[] = [];
  const budget = Math.max(4, Math.floor(MAX_TOPICS / docs.length));

  for (const file of docs) {
    progress('read', `Reading ${file.name}`);
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const doc = await task.promise;
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as { Title?: string };
    const meta_ = info.Title?.trim().replace(/^Microsoft (Word|PowerPoint) - /i, '') ?? '';
    const goodTitle = meta_.length > 2 && !/^(about:blank|untitled|document\d*)$/i.test(meta_) && !/^(https?:|file:)/i.test(meta_) && !/\.(docx?|pptx?|tex)$/i.test(meta_);
    const docName = (goodTitle ? meta_ : file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ')).slice(0, 60).replace(/^./, (c) => c.toUpperCase());
    documents.push({ name: docName, pages: doc.numPages });

    progress('outline', opts.structure === 'chapters' ? `Finding chapters in ${docName}` : `Splitting ${docName} into topics`);
    let chapters = opts.structure === 'chapters' ? await outlineChapters(doc) : [];
    if (!chapters.length) chapters = chunkChapters(doc.numPages, docName);
    chapters = capChapters(chapters, budget);

    // Read a few pages of every section (enough to write the lesson and questions).
    const read: { title: string; picked: { s: Section; text: string }[] }[] = [];
    for (const ch of chapters) {
      const picked: { s: Section; text: string }[] = [];
      for (const sec of ch.sections) {
        let text = '';
        for (let pg = sec.start; pg <= Math.min(sec.end, sec.start + PAGES_PER_SECTION - 1); pg++) {
          const r = await readPage(doc, pg);
          if (!sec.title && pg === sec.start && r.heading) sec.title = r.heading;
          text += `${r.text}\n\n`;
        }
        picked.push({ s: sec, text });
      }
      read.push({ title: ch.title, picked });
    }
    await task.destroy();

    // Optional focus: keep the sections that talk about it most (and the chapters that still have any).
    const focusWords = words(opts.focus ?? '').filter((w) => !STOP.has(w));
    let kept = read;
    if (focusWords.length) {
      const score = (t: string) => focusWords.reduce((a, w) => a + (t.toLowerCase().split(w).length - 1), 0);
      const all = read.flatMap((c) => c.picked.map((x) => ({ x, score: score(x.text) })));
      const hits = all.filter((h) => h.score > 0).sort((p, q) => q.score - p.score).slice(0, Math.max(3, Math.ceil(all.length / 2)));
      if (hits.length) {
        const keep = new Set(hits.map((h) => h.x));
        kept = read.map((c) => ({ ...c, picked: c.picked.filter((x) => keep.has(x)) })).filter((c) => c.picked.length);
      }
    }

    for (const c of kept) for (const x of c.picked) termPool.push(...definitionsOf(sentencesOf(stripHeadings(x.text))).map((d) => d.term));
    gathered.push({ docName, chapters: kept });
  }

  for (const { docName, chapters } of gathered) {
    progress('topics', `Building ${chapters.reduce((n, c) => n + c.picked.length, 0)} topics in ${chapters.length} modules from ${docName}`);
    for (const ch of chapters) {
      const topics = ch.picked.map((x) => {
        if (x.text.trim().length > 200) foundText = true;
        return buildTopic(docName, x.s, x.text, PLANETS[planetIndex++ % PLANETS.length], termPool).topic;
      });
      modules.push({ id: makeId('mod'), title: ch.title || docName, topics });
    }
  }

  progress('quiz', 'Writing practice questions');
  if (!foundText) throw new Error('No selectable text found — these PDFs look like scanned images. OCR arrives with the AI backend.');
  const first = documents[0]?.name ?? 'Your documents';
  return {
    id: makeId('course'),
    title: documents.length > 1 ? `${first} + ${documents.length - 1} more` : first,
    subtitle: opts.focus?.trim() ? `Focused on “${opts.focus.trim()}” · built from your documents` : 'Built from your documents',
    objective: opts.focus?.trim() || `Study ${documents.map((d) => d.name).join(', ')}`,
    level: opts.level,
    source: 'documents',
    modules,
    documents,
  };
}
