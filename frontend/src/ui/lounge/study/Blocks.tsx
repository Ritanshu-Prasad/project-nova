import { motion } from 'framer-motion';
import { Check, Copy, FileText, Info, KeyRound, Lightbulb, ListChecks, ListOrdered, Sparkles, Table2, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Block } from '../../../core/courseSchema';
import { prettyMath } from '../../../core/mathText';
import { TYPE } from './typography';

/** Inline emphasis in lesson text: **bold**, *italic* and `code`. */
function rich(text: string): ReactNode[] {
  return text.split(/((?<![\w*])\*\*[^*]+\*\*(?![\w*])|(?<![\w*])\*[^*\s][^*]*\*(?![\w*])|`[^`]+`)/g).map((part, i) => {
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <em key={i} className="text-white">{part.slice(1, -1)}</em>;
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) return <code key={i} className="rounded bg-black/30 px-1 font-mono text-[0.95em] text-white">{part.slice(1, -1)}</code>;
    return part;
  });
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 ${className}`}>{children}</div>;
}

/** Every heading in the feed: same face, size and weight; only the icon colour varies. */
function H({ children, icon: Icon, color = 'var(--user)' }: { children: ReactNode; icon?: LucideIcon; color?: string }) {
  return (
    <h3 className={`mb-3 flex items-center gap-2 ${TYPE.heading}`}>
      {Icon && <Icon size={18} className="shrink-0" style={{ color }} />}
      {children}
    </h3>
  );
}

function CodeBlock({ b }: { b: Extract<Block, { type: 'code' }> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070a12]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 font-mono text-sm text-white/50">
        <span>{b.language}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(b.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 font-sans transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={`scroll-y overflow-x-auto p-4 ${TYPE.formula} text-sky-100/90!`}>
        <code>{b.code}</code>
      </pre>
      {b.caption && <p className={`border-t border-white/[0.06] px-4 py-3 ${TYPE.body}`}>{b.caption}</p>}
    </div>
  );
}

const TONES = {
  tip: { icon: Lightbulb, label: 'Tip', cls: 'border-[rgb(var(--user-rgb)/0.35)] bg-[rgb(var(--user-rgb)/0.08)]', color: 'var(--user)' },
  warning: { icon: TriangleAlert, label: 'Watch out', cls: 'border-amber-400/30 bg-amber-400/[0.07]', color: '#fbbf24' },
  fact: { icon: Info, label: 'Did you know?', cls: 'border-sky-400/30 bg-sky-400/[0.07]', color: '#7dd3fc' },
} as const;

function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case 'text':
      return (
        <div>
          {b.title && <H>{b.title}</H>}
          {b.body.split(/\n\n+/).map((p, i) => (
            <p key={i} className={`mb-3 last:mb-0 ${TYPE.body}`}>
              {rich(p)}
            </p>
          ))}
        </div>
      );
    case 'analogy':
      return (
        <Card className="border-[rgb(var(--user-rgb)/0.3)]">
          <H icon={Sparkles}>Think of it like…</H>
          <p className={TYPE.body}>{rich(b.body)}</p>
        </Card>
      );
    case 'keyTerms':
      return (
        <div>
          <H icon={KeyRound}>Key terms</H>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {b.terms.map((t) => (
              <Card key={t.term} className="p-4!">
                <p className={`${TYPE.body} font-semibold text-white!`}>{t.term}</p>
                <p className={`mt-1 ${TYPE.body}`}>{rich(t.def)}</p>
              </Card>
            ))}
          </div>
        </div>
      );
    case 'steps':
      return (
        <div>
          <H icon={ListOrdered}>{b.title ?? 'Step by step'}</H>
          <ol className="space-y-2.5">
            {b.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-sm font-bold text-[var(--user-ink)]" style={{ background: 'var(--user)' }}>
                  {i + 1}
                </span>
                <span className={TYPE.body}>{rich(s)}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case 'code':
      return <CodeBlock b={b} />;
    case 'formula':
      return (
        <Card>
          <div className={`overflow-x-auto rounded-xl bg-black/30 px-4 py-3 ${TYPE.formula}`}>{prettyMath(b.expr)}</div>
          {b.caption && <p className={`mt-3 ${TYPE.body}`}>{b.caption}</p>}
        </Card>
      );
    case 'compare':
      return (
        <div>
          {b.title && <H icon={Table2}>{b.title}</H>}
          <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
            <table className={`w-full text-left ${TYPE.body}`}>
              <thead className="bg-white/[0.05] text-white">
                <tr>
                  <th className="px-4 py-3" />
                  <th className="px-4 py-3 font-semibold">{b.columns[0]}</th>
                  <th className="px-4 py-3 font-semibold">{b.columns[1]}</th>
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r) => (
                  <tr key={r[0]} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3 font-semibold text-white">{r[0]}</td>
                    <td className="px-4 py-3">{r[1]}</td>
                    <td className="px-4 py-3">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case 'example':
      return (
        <Card>
          <H icon={Lightbulb} color="#34d399">
            {b.title ?? 'Worked example'}
          </H>
          <p className={TYPE.body}>{rich(b.body)}</p>
        </Card>
      );
    case 'callout': {
      const t = TONES[b.tone];
      return (
        <div className={`rounded-2xl border p-5 ${t.cls}`}>
          <H icon={t.icon} color={t.color}>
            {t.label}
          </H>
          <p className={TYPE.body}>{rich(b.body)}</p>
        </div>
      );
    }
    case 'source':
      return (
        <figure className="rounded-2xl border-l-4 bg-white/[0.03] py-4 pl-5 pr-4" style={{ borderColor: 'var(--user)' }}>
          <blockquote className={TYPE.body}>“{b.excerpt}”</blockquote>
          <figcaption className={`mt-2 flex items-center gap-1.5 ${TYPE.body} text-white/55!`}>
            <FileText size={14} /> {b.doc}
            {b.page ? ` · page ${b.page}` : ''}
          </figcaption>
        </figure>
      );
    case 'summary':
      return (
        <Card className="border-emerald-400/20 bg-emerald-400/[0.05]">
          <H icon={ListChecks} color="#6ee7b7">
            In a nutshell
          </H>
          <ul className="space-y-1.5">
            {b.points.map((p) => (
              <li key={p} className={`flex gap-2 ${TYPE.body}`}>
                <Check size={16} className="mt-1 shrink-0 text-emerald-300" /> {rich(p)}
              </li>
            ))}
          </ul>
        </Card>
      );
  }
}

/** Renders a lesson's typed blocks in order, with a gentle staggered entrance. */
export default function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((b, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.06, 0.4), duration: 0.35 }}>
          <BlockView b={b} />
        </motion.div>
      ))}
    </div>
  );
}
