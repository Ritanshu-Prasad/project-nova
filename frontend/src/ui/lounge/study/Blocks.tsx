import { motion } from 'framer-motion';
import { Check, Copy, FileText, Info, Lightbulb, ListChecks, Sparkles, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Block } from '../../../core/courseSchema';

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 ${className}`}>{children}</div>;
}

function H({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 font-display text-lg font-semibold text-white">{children}</h3>;
}

function CodeBlock({ b }: { b: Extract<Block, { type: 'code' }> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070a12]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2 text-xs text-white/50">
        <span className="font-mono uppercase tracking-wider">{b.language}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(b.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="scroll-y overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-sky-100/90">
        <code>{b.code}</code>
      </pre>
      {b.caption && <div className="border-t border-white/[0.06] px-4 py-2 text-xs text-white/55">{b.caption}</div>}
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
            <p key={i} className="mb-3 text-[16px] leading-[1.75] text-white/85 last:mb-0">
              {p}
            </p>
          ))}
        </div>
      );
    case 'analogy':
      return (
        <Card className="border-[rgb(var(--user-rgb)/0.3)]">
          <div className="chip-label mb-1.5">
            <Sparkles size={12} /> Think of it like…
          </div>
          <p className="text-[15px] leading-relaxed text-white/85">{b.body}</p>
        </Card>
      );
    case 'keyTerms':
      return (
        <div>
          <H>Key terms</H>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {b.terms.map((t) => (
              <Card key={t.term} className="!p-4">
                <div className="font-semibold" style={{ color: 'var(--user)' }}>
                  {t.term}
                </div>
                <div className="mt-1 text-sm leading-relaxed text-white/75">{t.def}</div>
              </Card>
            ))}
          </div>
        </div>
      );
    case 'steps':
      return (
        <div>
          <H>{b.title ?? 'Step by step'}</H>
          <ol className="space-y-2.5">
            {b.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-[var(--user-ink)]" style={{ background: 'var(--user)' }}>
                  {i + 1}
                </span>
                <span className="pt-1 text-[15px] leading-relaxed text-white/85">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case 'code':
      return <CodeBlock b={b} />;
    case 'formula':
      return (
        <Card className="text-center">
          <div className="overflow-x-auto py-2 font-serif text-2xl tracking-wide text-white sm:text-3xl">{b.expr}</div>
          {b.caption && <div className="mt-2 text-sm text-white/55">{b.caption}</div>}
        </Card>
      );
    case 'compare':
      return (
        <div>
          {b.title && <H>{b.title}</H>}
          <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.05] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium text-white/50" />
                  <th className="px-4 py-3 font-semibold">{b.columns[0]}</th>
                  <th className="px-4 py-3 font-semibold">{b.columns[1]}</th>
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r) => (
                  <tr key={r[0]} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3 font-medium text-white/60">{r[0]}</td>
                    <td className="px-4 py-3 text-white/85">{r[1]}</td>
                    <td className="px-4 py-3 text-white/85">{r[2]}</td>
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
          <div className="chip-label mb-1.5">{b.title ?? 'Worked example'}</div>
          <p className="font-mono text-[14px] leading-relaxed text-white/85">{b.body}</p>
        </Card>
      );
    case 'callout': {
      const t = TONES[b.tone];
      return (
        <div className={`flex gap-3 rounded-2xl border p-4 ${t.cls}`}>
          <t.icon size={18} className="mt-0.5 shrink-0" style={{ color: t.color }} />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: t.color }}>
              {t.label}
            </div>
            <p className="mt-0.5 text-[15px] leading-relaxed text-white/85">{b.body}</p>
          </div>
        </div>
      );
    }
    case 'source':
      return (
        <figure className="rounded-2xl border-l-4 bg-white/[0.03] py-3 pl-5 pr-4" style={{ borderColor: 'var(--user)' }}>
          <blockquote className="text-[15px] italic leading-relaxed text-white/80">“{b.excerpt}”</blockquote>
          <figcaption className="mt-2 flex items-center gap-1.5 text-xs text-white/50">
            <FileText size={12} /> {b.doc}
            {b.page ? ` · page ${b.page}` : ''}
          </figcaption>
        </figure>
      );
    case 'summary':
      return (
        <Card className="border-emerald-400/20 bg-emerald-400/[0.05]">
          <div className="mb-2 flex items-center gap-2 font-display font-semibold text-emerald-200">
            <ListChecks size={17} /> In a nutshell
          </div>
          <ul className="space-y-1.5">
            {b.points.map((p) => (
              <li key={p} className="flex gap-2 text-[15px] text-white/85">
                <Check size={15} className="mt-1 shrink-0 text-emerald-300" /> {p}
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
