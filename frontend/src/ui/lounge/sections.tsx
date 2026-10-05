import { FileText, Library, Map, Palette, Plus, Sparkles, Trash2, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { firstUncleared, levelOf, levelProgress, useActiveCourse, useCourse } from '../../core/course';
import { flatTopics } from '../../core/courseSchema';
import { openForge, useHub, useProfile } from '../../core/hub';
import { useNova } from '../../core/store';
import RocketProgress from './RocketProgress';

function Head({ icon, kicker, title }: { icon: ReactNode; kicker: string; title: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl" style={{ background: 'rgb(var(--user-rgb) / 0.16)', color: 'var(--user)' }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="chip-label">{kicker}</div>
        <h2 className="mt-0.5 truncate font-display text-2xl font-bold leading-tight text-white">{title}</h2>
      </div>
    </div>
  );
}

export function JourneySection() {
  const active = useActiveCourse();
  if (!active) return null;
  const { course, cleared, topics } = active;
  const n = topics.length;
  const next = topics[Math.min(cleared, n - 1)];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Head icon={<Map size={19} />} kicker={`Journey map · ${course.modules.length} modules`} title={course.title} />
        <div className="text-right text-sm text-white/65">
          <div className="font-display text-2xl font-bold text-white">
            {cleared}/{n}
          </div>
          planets cleared
        </div>
      </div>
      {course.documents && course.documents.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-white/55">
          <FileText size={14} /> Built from {course.documents.map((d) => `${d.name} (${d.pages} pages)`).join(', ')}
        </p>
      ) : (
        course.objective && <p className="text-sm text-white/55">Your goal: “{course.objective}”</p>
      )}
      <div className="rounded-2xl bg-black/25 px-3 py-3">
        <RocketProgress
          onSelect={(id) => {
            useCourse.getState().openTopic(id);
            useHub.getState().go('lesson');
          }}
        />
      </div>
      <p className="text-sm text-white/65">
        {cleared >= n ? 'All planets cleared — what a journey!' : `Next stop: ${next.planet} — ${next.title}. Hover a planet to see its topic; click an unlocked one to study it.`}
      </p>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-12 text-xs text-white/40">Answer a quiz to start your MMR graph.</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${40 - ((v - min) / Math.max(1, max - min)) * 34 - 3}`).join(' ');
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-12 w-full">
      <polyline points={pts} fill="none" stroke="var(--user)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

export function ProfileSection() {
  const callsign = useProfile((s) => s.callsign) || 'Pilot';
  const themeColor = useNova((s) => s.themeColor);
  const stats = useCourse((s) => s.stats);
  const library = useCourse((s) => s.library);
  const activeId = useCourse((s) => s.activeId);
  const level = levelOf(stats.xp);
  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;
  const tiles = [
    { label: 'MMR', value: stats.mmr.toLocaleString('en-IN') },
    { label: 'Accuracy', value: `${accuracy}%` },
    { label: 'Best streak', value: String(stats.bestStreak) },
    { label: 'Courses', value: String(Object.keys(library).length) },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center rounded-3xl font-display text-2xl font-bold text-[var(--user-ink)]" style={{ background: 'var(--user)', boxShadow: '0 0 30px rgb(var(--user-rgb) / 0.45)' }}>
          {callsign.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="chip-label">
            <UserRound size={12} /> Pilot profile
          </div>
          <h2 className="truncate font-display text-2xl font-bold text-white">{callsign}</h2>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-white/60">
            Level {level}
            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full" style={{ width: `${levelProgress(stats.xp) * 100}%`, background: 'var(--user)' }} />
            </span>
            {stats.xp} XP
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/[0.04] px-4 py-3">
            <div className="text-xs text-white/50">{s.label}</div>
            <div className="font-display text-xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white/[0.04] px-4 py-3">
        <div className="mb-1 text-xs text-white/50">MMR over time</div>
        <Sparkline values={stats.mmrHistory} />
      </div>

      <div>
        <div className="chip-label mb-2">
          <Library size={12} /> Your courses
        </div>
        <ul className="space-y-2">
          {Object.values(library)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((e) => {
              const n = flatTopics(e.course).length;
              const pct = Math.round((firstUncleared(e) / Math.max(1, n)) * 100);
              const isActive = e.course.id === activeId;
              return (
                <li key={e.course.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${isActive ? 'bg-[rgb(var(--user-rgb)/0.12)] ring-1 ring-[rgb(var(--user-rgb)/0.4)]' : 'bg-white/[0.04]'}`}>
                  <button type="button" onClick={() => useCourse.getState().setActive(e.course.id)} className="min-w-0 flex-1 cursor-pointer text-left">
                    <div className="truncate text-sm font-semibold text-white">{e.course.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/50">
                      <span className="h-1 w-20 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--user)' }} />
                      </span>
                      {pct}% · {e.course.source === 'documents' ? 'from PDFs' : `${n} planets`}
                    </div>
                  </button>
                  <button type="button" aria-label={`Remove ${e.course.title}`} onClick={() => window.confirm(`Remove “${e.course.title}” and its progress?`) && useCourse.getState().removeCourse(e.course.id)} className="cursor-pointer rounded-lg p-1.5 text-white/35 transition hover:bg-white/10 hover:text-rose-300">
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
        </ul>
        <button type="button" onClick={() => openForge()} className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-2.5 text-sm text-white/60 transition hover:border-[var(--user)] hover:text-white">
          <Plus size={14} /> New course
        </button>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
        <span className="flex items-center gap-2.5 text-sm text-white/85">
          <Palette size={16} style={{ color: 'var(--user)' }} /> Your colour
          <span className="text-xs text-white/45">(used all over the ship)</span>
        </span>
        <input type="color" value={themeColor} onChange={(e) => useNova.getState().setThemeColor(e.target.value)} className="h-8 w-12 cursor-pointer rounded-lg border-0 bg-transparent" aria-label="Pick your colour" />
      </label>
      <p className="flex items-start gap-2 text-sm text-white/60">
        <Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--user)' }} />
        Pixel tip: harder questions on later planets earn the most MMR.
      </p>
    </div>
  );
}
