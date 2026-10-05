import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Block, Course, Level, Module, Question, Topic } from './courseSchema';
import { makeId } from './courseSchema';

/**
 * Builds a structured course from the user's PDFs (class notes, a book) entirely in the browser:
 * chapters from the PDF outline (or headings when there is none) become topics, and heuristics write
 * overview / key-term / summary blocks plus practice questions. The AI backend can replace this later
 * with richer generation — the output format is the same.
 */

export type DocStructure = 'chapters' | 'topics';
export type ProgressFn = (stage: string, detail?: string) => void;

const MAX_FILES = 5;
const MAX_SECTIONS = 10;
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

async function outlineSections(doc: PDFDocumentProxy): Promise<Section[]> {
  const outline = await doc.getOutline().catch(() => null);
  if (!outline || !outline.length) return [];
  let items = outline;
  if (items.length === 1 && items[0].items && items[0].items.length > 1) items = items[0].items;
  const starts: { title: string; page: number }[] = [];
  for (const it of items.slice(0, 30)) {
    try {
      const dest = typeof it.dest === 'string' ? await doc.getDestination(it.dest) : it.dest;
      if (!dest || !dest[0]) continue;
      const idx = typeof dest[0] === 'number' ? dest[0] : await doc.getPageIndex(dest[0]);
      if (it.title.trim()) starts.push({ title: it.title.trim(), page: idx + 1 });
    } catch {
      /* unresolvable entry */
    }
  }
  starts.sort((a, b) => a.page - b.page);
  const unique = starts.filter((s, i) => i === 0 || s.page > starts[i - 1].page);
  return unique.map((s, i) => ({ title: s.title, start: s.page, end: Math.max(s.page, (unique[i + 1]?.page ?? doc.numPages + 1) - 1) }));
}

function chunkSections(pages: number): Section[] {
  const count = Math.max(1, Math.min(8, Math.round(pages / 6)));
  const size = Math.ceil(pages / count);
  return Array.from({ length: count }, (_, i) => ({ title: '', start: i * size + 1, end: Math.min(pages, (i + 1) * size) })).filter((s) => s.start <= pages);
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
  const gathered: { docName: string; picked: { s: Section; text: string }[] }[] = [];

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
    let sections = opts.structure === 'chapters' ? await outlineSections(doc) : [];
    if (!sections.length) sections = chunkSections(doc.numPages);

    // Read a few pages of every section (enough to write the lesson and questions).
    const texts: string[] = [];
    for (const sec of sections.slice(0, MAX_SECTIONS * 2)) {
      let text = '';
      for (let p = sec.start; p <= Math.min(sec.end, sec.start + PAGES_PER_SECTION - 1); p++) {
        const r = await readPage(doc, p);
        if (!sec.title && p === sec.start && r.heading) sec.title = r.heading;
        text += `${r.text}\n\n`;
      }
      texts.push(text);
    }
    await task.destroy();

    // Optional focus: keep the sections that talk about it most.
    let picked = sections.map((s, i) => ({ s, text: texts[i] ?? '' }));
    const focusWords = words(opts.focus ?? '').filter((w) => !STOP.has(w));
    if (focusWords.length) {
      const scored = picked.map((x) => ({ s: x.s, score: focusWords.reduce((a, w) => a + (x.text.toLowerCase().split(w).length - 1), 0) }));
      const hits = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.max(3, Math.ceil(picked.length / 2)));
      if (hits.length) {
        const keep = new Set(hits.map((h) => h.s));
        picked = picked.filter((x) => keep.has(x.s));
      }
    }
    picked = picked.slice(0, MAX_SECTIONS);

    for (const x of picked) termPool.push(...definitionsOf(sentencesOf(stripHeadings(x.text))).map((d) => d.term));
    gathered.push({ docName, picked });
  }

  for (const { docName, picked } of gathered) {
    progress('topics', `Building ${picked.length} topics from ${docName}`);
    const built = picked.map((x) => {
      if (x.text.trim().length > 200) foundText = true;
      return buildTopic(docName, x.s, x.text, PLANETS[planetIndex++ % PLANETS.length], termPool).topic;
    });
    // Large documents are split into parts so modules stay digestible.
    for (let i = 0; i < built.length; i += 5) {
      const part = built.length > 6 ? ` · Part ${i / 5 + 1}` : '';
      modules.push({ id: makeId('mod'), title: `${docName}${part}`, topics: built.slice(i, i + 5) });
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
