import { Fragment, type ReactNode } from 'react';
import { parseMarkdown, type MdBlock, type MdList } from './mdParse';

// ── inline ────────────────────────────────────────────────────────────────

const INLINE = /((?<![\w*])\*\*[^*]+\*\*(?![\w*])|(?<![\w*])\*[^*\s][^*]*\*(?![\w*])|`[^`]+`)/g;

/** Inline emphasis: `code`, **bold** and *italic*. */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE).map((part, i) => {
        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <em key={i} className="text-white">{part.slice(1, -1)}</em>;
        if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) return <code key={i} className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.95em] text-white">{part.slice(1, -1)}</code>;
        return part;
      })}
    </>
  );
}

// ── blocks ────────────────────────────────────────────────────────────────

function ListView({ list }: { list: MdList }) {
  const cls = list.kind === 'options' ? 'space-y-1' : `space-y-1 pl-5 ${list.kind === 'ol' ? 'list-decimal' : 'list-disc'} marker:text-white/60`;
  const items = list.items.map((it, k) => (
    <li key={k}>
      {it.label && <span className="mr-1.5 font-semibold text-white">{it.label}</span>}
      <Inline text={it.text} />
      {it.children.map((c, j) => (
        <div key={j} className="mt-1">
          <ListView list={c} />
        </div>
      ))}
    </li>
  ));
  return list.kind === 'ol' ? <ol className={cls}>{items}</ol> : <ul className={cls}>{items}</ul>;
}

function BlockView({ b }: { b: MdBlock }) {
  if (b.type === 'code') return <pre className="overflow-x-auto rounded-lg bg-black/40 p-2.5 font-mono text-sm text-sky-100/90">{b.code}</pre>;
  if (b.type === 'list') return <ListView list={b} />;
  return (
    <p>
      {b.lines.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          <Inline text={l} />
        </Fragment>
      ))}
    </p>
  );
}

/** Block-level Markdown: paragraphs, nested lists, `A)` options and code fences. Text styling comes from `className`. */
export function Markdown({ text, className = 'space-y-2' }: { text: string; className?: string }): ReactNode {
  return (
    <div className={className}>
      {parseMarkdown(text).map((b, i) => (
        <BlockView key={i} b={b} />
      ))}
    </div>
  );
}
