/** Block-level Markdown parser shared by lessons and the tutor chat: pure data out, rendering lives in markdown.tsx. */

export type ListItem = { text: string; label?: string; children: MdList[] };
export type MdList = { kind: 'ul' | 'ol' | 'options'; items: ListItem[] };
export type MdBlock = { type: 'p'; lines: string[] } | { type: 'code'; code: string } | ({ type: 'list' } & MdList);

// ── line classification ───────────────────────────────────────────────────

const MARKER = /^(\s*)([-*•]|\d+[.)]|[A-H][.)])\s+(.*)$/;
const FENCE = /^\s*```/;

type Line = { indent: number; kind: MdList['kind']; label: string; text: string };

function listLine(raw: string): Line | null {
  const m = MARKER.exec(raw);
  if (!m) return null;
  const marker = m[2];
  const kind = /^\d/.test(marker) ? 'ol' : /^[A-H]/.test(marker) ? 'options' : 'ul';
  return { indent: m[1].replace(/\t/g, '  ').length, kind, label: marker, text: m[3].trim() };
}

// ── list tree (nesting by indent) ─────────────────────────────────────────

function buildList(lines: Line[], from: number, indent: number): { list: MdList; next: number } {
  const list: MdList = { kind: lines[from].kind, items: [] };
  let i = from;
  while (i < lines.length) {
    const l = lines[i];
    if (l.indent < indent) break;
    if (l.indent > indent && list.items.length) {
      const sub = buildList(lines, i, l.indent);
      list.items[list.items.length - 1].children.push(sub.list);
      i = sub.next;
      continue;
    }
    if (l.kind !== list.kind) break;
    list.items.push({ text: l.text, label: l.kind === 'options' ? l.label : undefined, children: [] });
    i++;
  }
  return { list, next: i };
}

// ── document ──────────────────────────────────────────────────────────────

/** Paragraphs (single newlines kept as line breaks), nested ordered/unordered lists, `A)` option lists and code fences. */
export function parseMarkdown(text: string): MdBlock[] {
  const out: MdBlock[] = [];
  const src = text.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < src.length) {
    const raw = src[i];
    if (FENCE.test(raw)) {
      const code: string[] = [];
      i++;
      while (i < src.length && !FENCE.test(src[i])) code.push(src[i++]);
      i++;
      out.push({ type: 'code', code: code.join('\n') });
    } else if (listLine(raw)) {
      const run: Line[] = [];
      for (let l = listLine(src[i]); i < src.length && l; l = listLine(src[i] ?? '')) {
        run.push(l);
        i++;
      }
      let at = 0;
      while (at < run.length) {
        const { list, next } = buildList(run, at, run[at].indent);
        out.push({ type: 'list', ...list });
        at = Math.max(next, at + 1);
      }
    } else if (!raw.trim()) {
      i++;
    } else {
      const lines: string[] = [];
      while (i < src.length && src[i].trim() && !FENCE.test(src[i]) && !listLine(src[i])) lines.push(src[i++].trim().replace(/^#+\s*/, ''));
      out.push({ type: 'p', lines });
    }
  }
  return out;
}
