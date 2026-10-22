import { motion } from 'framer-motion';
import { Award, Clapperboard, Cloud, CloudOff, Settings, FileText, Image as ImageIcon, Library, LogOut, Palette, Plus, Rocket, Sparkles, Target, Trash2, TrendingUp, UserRound, Users } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { signOut, useAccount, type SyncStatus } from '../../core/account';
import { firstUncleared, levelOf, levelProgress, passedModules, useActiveCourse, useCourse, useSkill, type ActiveCourse } from '../../core/course';
import { flatTopics } from '../../core/courseSchema';
import { courseKey, fetchBoard, type FleetBoard } from '../../core/fleet';
import { openForge, relaunch, useHub, useProfile } from '../../core/hub';
import { rankOf, TIERS } from '../../core/rank';
import { useSettings } from '../../core/settings';
import { useNova } from '../../core/store';
import AvatarChooser from '../common/AvatarChooser';
import PilotAvatar from '../common/PilotAvatar';
import RankEmblem from './RankEmblem';
import RocketProgress from './RocketProgress';

function Label({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="chip-label mb-2">
      {icon} {children}
    </div>
  );
}

/**
 * Skill journey for the active course: where this course's MMR puts the pilot on the ship ladder (every course
 * starts at Probe III), how it has moved, mastery per module, and the course route.
 */
export function SkillJourneySection() {
  const active = useActiveCourse();
  const skill = useSkill();
  const rank = rankOf(skill.mmr);
  const accuracy = skill.answered ? Math.round((skill.correct / skill.answered) * 100) : 0;
  const passed = active ? active.course.modules.filter((m) => active.entry.modules[m.id]?.passed).length : 0;

  return (
    <div className="space-y-6">
      {/* Current rank */}
      <div className="flex flex-wrap items-center gap-5">
        <RankEmblem rank={rank} size={88} />
        <div className="min-w-0 flex-1">
          <div className="chip-label">
            <TrendingUp size={12} /> Skill journey · {active?.course.title}
          </div>
          <h2 className="font-display text-3xl font-bold leading-tight" style={{ color: rank.tier.color }}>
            {rank.label}
          </h2>
          <div className="text-sm text-white/60">
            {rank.tier.metal} tier · {skill.mmr.toLocaleString('en-IN')} MMR in this course — {rank.tier.blurb}
          </div>
          {rank.nextLabel ? (
            <div className="mt-3 max-w-md">
              <div className="flex justify-between text-xs text-white/55">
                <span>
                  {rank.toNext} MMR to <span className="font-semibold text-white">{rank.nextLabel}</span>
                </span>
                <span>{Math.round(rank.progress * 100)}%</span>
              </div>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-white/10">
                <motion.span className="block h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${rank.progress * 100}%` }} transition={{ duration: 0.8, delay: 0.4 }} style={{ background: rank.tier.color }} />
              </span>
            </div>
          ) : (
            <div className="mt-2 text-sm font-semibold text-white">You’ve reached the top of the ladder.</div>
          )}
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
          {[
            { k: 'Accuracy', v: `${accuracy}%` },
            { k: 'Answered', v: String(skill.answered) },
            { k: 'Modules passed', v: `${passed}/${active?.course.modules.length ?? 0}` },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-white/[0.04] px-3 py-2 sm:w-28">
              <div className="text-[11px] text-white/50">{x.k}</div>
              <div className="font-display text-lg font-bold text-white">{x.v}</div>
            </div>
          ))}
        </div>
      </div>

      <RankLadder mmr={skill.mmr} />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl bg-white/[0.04] p-4">
          <Label icon={<TrendingUp size={12} />}>MMR over time</Label>
          <MmrChart values={skill.history} />
        </div>
        {active && <ModuleSkills active={active} />}
      </div>

      {active && <CourseRoute active={active} />}
      <FleetLeaderboard active={active} />
      <p className="flex items-start gap-2 text-sm text-white/55">
        <Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--user)' }} />
        Every course has its own ladder, scaled to its size. Lesson quizzes move MMR a little; hub quizzes move it a lot — ×2 within 24 h of arriving (timed questions ×2.5, and they never cost MMR), ×1.75 after that.
      </p>
    </div>
  );
}

const DIV_INDEX = { III: 0, II: 1, I: 2 } as const;

/** The seven ship classes in a row, with a rocket at the pilot's exact position. */
function RankLadder({ mmr }: { mmr: number }) {
  const rank = rankOf(mmr);
  const within = rank.division ? (DIV_INDEX[rank.division] + rank.progress) / 3 : 0;
  const pos = Math.min(1, (rank.index + within) / (TIERS.length - 1));
  return (
    <div className="overflow-x-auto rounded-2xl bg-black/25 px-4 pb-4 pt-5">
      <div className="relative min-w-[620px]">
        <div className="absolute left-[7%] right-[7%] top-6 h-1 rounded-full bg-white/10">
          <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pos * 100}%` }} transition={{ duration: 1, delay: 0.3 }} style={{ background: `linear-gradient(90deg, ${TIERS[0].color}, ${rank.tier.color})` }} />
          <motion.div className="absolute -top-6" initial={{ left: 0 }} animate={{ left: `${pos * 100}%` }} transition={{ duration: 1, delay: 0.3 }}>
            <Rocket size={18} className="-translate-x-1/2 rotate-45 text-white drop-shadow-[0_0_6px_rgb(var(--user-rgb))]" fill="var(--user)" />
          </motion.div>
        </div>
        <ol className="relative grid grid-cols-7">
          {TIERS.map((t, i) => {
            const reached = i <= rank.index;
            const here = i === rank.index;
            return (
              <li key={t.id} className="flex flex-col items-center text-center">
                <span className={`rounded-full p-1 ${here ? 'ring-2 ring-offset-2 ring-offset-[#0b1020]' : ''}`} style={here ? { ['--tw-ring-color' as string]: t.color } : undefined}>
                  <RankEmblem tier={t} size={here ? 40 : 34} dim={!reached} />
                </span>
                <span className={`mt-1.5 font-display text-sm font-semibold ${reached ? 'text-white' : 'text-white/40'}`}>{t.name}</span>
                <span className="text-[11px] text-white/40">{i === 0 ? 'Start' : `${t.min.toLocaleString('en-IN')}+`}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/30">{t.metal}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** MMR history over the ladder's tier bands. */
function MmrChart({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="grid h-40 place-items-center text-center text-sm text-white/45">Answer a few questions and your skill curve appears here.</div>;
  const lo = Math.min(...values) - 40;
  const hi = Math.max(...values) + 40;
  const y = (v: number) => ((hi - v) / (hi - lo)) * 100;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${y(v)}`).join(' ');
  const bands = TIERS.map((t, i) => ({ t, from: Math.max(lo, t.min), to: Math.min(hi, TIERS[i + 1]?.min ?? Infinity) })).filter((b) => b.to > b.from);
  return (
    <div className="relative h-40 overflow-hidden rounded-xl">
      {bands.map((b) => (
        <div key={b.t.id} className="absolute inset-x-0 border-t border-dashed border-white/10" style={{ top: `${y(b.to)}%`, height: `${y(b.from) - y(b.to)}%`, background: `${b.t.color}14` }}>
          <span className="absolute left-2 top-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: `${b.t.color}cc` }}>
            {b.t.name}
          </span>
        </div>
      ))}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <polyline points={pts} fill="none" stroke="var(--user)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_var(--user)]" style={{ left: '100%', top: `${y(values[values.length - 1])}%`, marginLeft: -6 }} />
    </div>
  );
}

/** Per-module mastery: half from topics completed, half from the best module-quiz score. */
function ModuleSkills({ active }: { active: ActiveCourse }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-4">
      <Label icon={<Target size={12} />}>Skill breakdown</Label>
      <ul className="space-y-3">
        {active.course.modules.map((m, i) => {
          const topics = m.topics.length;
          const done = m.topics.filter((t) => active.entry.progress[t.id]?.cleared).length;
          const quiz = active.entry.modules[m.id];
          const mastery = Math.round(((done / Math.max(1, topics)) * 0.5 + (quiz?.best ?? 0) * 0.5) * 100);
          return (
            <li key={m.id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-semibold text-white">
                  {i + 1}. {m.title}
                </span>
                <span className="shrink-0 text-white/60">{mastery}%</span>
              </div>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full" style={{ width: `${mastery}%`, background: 'var(--user)' }} />
              </span>
              <div className="mt-1 text-xs text-white/45">
                {done}/{topics} topics · {quiz ? `quiz best ${Math.round(quiz.best * 100)}%${quiz.passed ? ' ✓' : ''}` : 'quiz not taken'}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CourseRoute({ active }: { active: ActiveCourse }) {
  const { course, entry, next } = active;
  const clearedPlanets = passedModules(entry).length;
  const totalPlanets = course.modules.length;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label icon={<Rocket size={12} />}>Course route · {course.title}</Label>
        <span className="mb-2 text-sm text-white/55">
          {clearedPlanets}/{totalPlanets} planets cleared
        </span>
      </div>
      {course.documents && course.documents.length > 0 ? (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-white/55">
          <FileText size={14} /> Built from {course.documents.map((d) => `${d.name} (${d.pages} pages)`).join(', ')}
        </p>
      ) : null}
      <div className="rounded-2xl bg-black/25 px-3 py-3">
        <RocketProgress
          onSelect={(id) => {
            if (useCourse.getState().open(id)) useHub.getState().go('lesson');
          }}
        />
      </div>
      <p className="mt-2 text-sm text-white/60">
        {!next
          ? 'All planets cleared — what a journey!'
          : next.kind === 'quiz'
            ? `Checkpoint: pass the Module ${next.moduleIndex + 1} quiz to fly on to the next planet.`
            : `Next stop: Planet ${next.moduleIndex + 1} (${course.modules[next.moduleIndex]?.title || next.topic.planet}) — ${next.topic.title}. Click an unlocked planet to study it.`}
      </p>
    </div>
  );
}

export function ProfileSection() {
  const callsign = useProfile((s) => s.callsign) || 'Pilot';
  const avatar = useProfile((s) => s.avatar);
  const themeColor = useNova((s) => s.themeColor);
  const stats = useCourse((s) => s.stats);
  const library = useCourse((s) => s.library);
  const activeId = useCourse((s) => s.activeId);
  const level = levelOf(stats.xp);
  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;
  const skill = useSkill();
  const rank = rankOf(skill.mmr);
  const tiles = [
    { label: 'Level', value: String(level) },
    { label: 'Accuracy (all courses)', value: `${accuracy}%` },
    { label: 'Best streak', value: String(stats.bestStreak) },
    { label: 'Courses', value: String(Object.keys(library).length) },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <PilotAvatar size={64} />
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
      <button type="button" onClick={() => useHub.getState().go('journey')} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.07]">
        <RankEmblem rank={rank} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold text-white">{rank.label}</span>
          <span className="block text-xs text-white/55">{rank.nextLabel ? `${rank.toNext} MMR to ${rank.nextLabel}` : 'Top of the ladder'} · this course</span>
        </span>
        <TrendingUp size={16} className="text-white/45" />
      </button>

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
              const r = rankOf(e.skill.mmr);
              return (
                <li key={e.course.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${isActive ? 'bg-[rgb(var(--user-rgb)/0.12)] ring-1 ring-[rgb(var(--user-rgb)/0.4)]' : 'bg-white/[0.04]'}`}>
                  <RankEmblem rank={r} size={30} />
                  <button type="button" onClick={() => useCourse.getState().setActive(e.course.id)} className="min-w-0 flex-1 cursor-pointer text-left">
                    <div className="truncate text-sm font-semibold text-white">{e.course.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/50">
                      <span className="h-1 w-20 overflow-hidden rounded-full bg-white/10">
                        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--user)' }} />
                      </span>
                      {pct}% · {r.label} · {e.course.modules.length} planet{e.course.modules.length === 1 ? '' : 's'} · {n} topic{n === 1 ? '' : 's'}
                    </div>
                  </button>
                  {e.completedAt && (
                    <button type="button" aria-label={`Certificate for ${e.course.title}`} title="Certificate" onClick={() => useCourse.getState().showGraduation(e.course.id)} className="cursor-pointer rounded-lg p-1.5 text-amber-300/80 transition hover:bg-white/10 hover:text-amber-200">
                      <Award size={15} />
                    </button>
                  )}
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
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
        <span className="flex items-center gap-2.5 text-sm text-white/85">
          <ImageIcon size={16} style={{ color: 'var(--user)' }} /> Your avatar
        </span>
        <AvatarChooser compact value={avatar} onChange={(url) => useProfile.getState().setAvatar(url)} />
      </div>
      <button type="button" onClick={relaunch} className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-[var(--user)] hover:bg-white/[0.06]">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl transition-colors group-hover:text-[var(--user-ink)] group-hover:[background:var(--user)]" style={{ background: 'rgb(var(--user-rgb) / 0.16)', color: 'var(--user)' }}>
          <Clapperboard size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">Relive your first launch</span>
          <span className="block text-xs text-white/50">Watch the wake-up and launch again — you’ll land right back here.</span>
        </span>
      </button>
      <button type="button" onClick={() => useSettings.getState().setOpen(true)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl bg-white/[0.04] px-4 py-3 text-left text-sm text-white/85 transition hover:bg-white/[0.07]">
        <Settings size={16} style={{ color: 'var(--user)' }} /> Settings
        <span className="text-xs text-white/45">sound, motion, keyboard shortcuts</span>
      </button>
      <AccountCard />
      <p className="flex items-start gap-2 text-xs text-white/40">
        <Sparkles size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--user)' }} />
        Psst — Pixel knows a secret: type L-A-U-N-C-H anywhere in the lounge.
      </p>
    </div>
  );
}

/** Other pilots' standings: everyone by XP, or the current demo course by MMR. */
function FleetLeaderboard({ active }: { active: ActiveCourse | null }) {
  const callsign = useProfile((s) => s.callsign) || 'Pilot';
  const stats = useCourse((s) => s.stats);
  const demo = active?.course.source === 'template' ? { key: courseKey(active.course.title), title: active.course.title } : null;
  const [board, setBoard] = useState(demo?.key ?? 'global');
  const [result, setResult] = useState<{ board: string; data?: FleetBoard; error?: string } | null>(null);
  const loading = result?.board !== board;

  useEffect(() => {
    let live = true;
    fetchBoard(board)
      .then((data) => live && setResult({ board, data }))
      .catch((e: unknown) => live && setResult({ board, error: e instanceof Error ? e.message : 'offline' }));
    return () => {
      live = false;
    };
  }, [board]);

  const tabs = [{ key: 'global', label: 'All pilots · XP' }, ...(demo ? [{ key: demo.key, label: `${demo.title} · MMR` }] : [])];
  const data = loading ? undefined : result?.data;
  return (
    <div className="rounded-2xl bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label icon={<Users size={12} />}>Fleet leaderboard</Label>
        <div className="mb-2 flex overflow-hidden rounded-lg ring-1 ring-white/10" role="tablist" aria-label="Leaderboard">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={board === t.key} onClick={() => setBoard(t.key)} className={`max-w-56 cursor-pointer truncate px-3 py-1.5 text-xs font-semibold transition ${board === t.key ? 'bg-[rgb(var(--user-rgb)/0.2)] text-white' : 'text-white/55 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="py-6 text-center text-sm text-white/45">Contacting the fleet…</p>
      ) : result?.error ? (
        <p className="py-5 text-center text-sm text-white/55">
          {result.error === 'storage' ? 'The fleet leaderboard is offline until its storage is connected (Upstash Redis on Vercel).' : 'The fleet leaderboard is offline right now — your own journey above is always up to date.'}
        </p>
      ) : data && data.top.length ? (
        <>
          <p className="mb-2 text-xs text-white/55">{data.you ? `You’re #${data.you.rank} of ${data.pilots} pilot${data.pilots === 1 ? '' : 's'}` : `${data.pilots} pilot${data.pilots === 1 ? '' : 's'} on this board`}</p>
          <ol className="space-y-1.5">
            {data.top.slice(0, 20).map((r) => (
              <li key={r.rank} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${r.me ? 'bg-[rgb(var(--user-rgb)/0.14)] ring-1 ring-[rgb(var(--user-rgb)/0.45)]' : 'bg-white/[0.03]'}`}>
                <span className={`w-6 text-right font-display font-bold ${r.rank <= 3 ? 'text-amber-300' : 'text-white/50'}`}>{r.rank}</span>
                {r.me ? (
                  <PilotAvatar size={24} className="rounded-full" />
                ) : (
                  <PilotAvatar size={24} className="rounded-full" name={r.callsign} src="" color={r.color} />
                )}
                <span className="min-w-0 flex-1 truncate font-semibold text-white">
                  {r.callsign}
                  {r.me && <span className="ml-1.5 text-xs font-normal text-white/50">(you)</span>}
                </span>
                <span className="text-xs text-white/45">LV {r.level}</span>
                <span className="w-20 text-right font-display font-bold text-white">
                  {r.score.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-white/45">{board === 'global' ? 'XP' : 'MMR'}</span>
                </span>
              </li>
            ))}
            {data.you && !data.top.slice(0, 20).some((r) => r.me) && (
              <>
                <li className="my-1 border-t border-dashed border-white/10" aria-hidden="true" />
                <li className="flex items-center gap-3 rounded-xl bg-[rgb(var(--user-rgb)/0.14)] px-3 py-2 text-sm ring-1 ring-[rgb(var(--user-rgb)/0.45)]">
                  <span className="w-6 text-right font-display font-bold text-white/50">{data.you.rank}</span>
                  <PilotAvatar size={24} className="rounded-full" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-white">
                    {callsign}
                    <span className="ml-1.5 text-xs font-normal text-white/50">(you)</span>
                  </span>
                  <span className="text-xs text-white/45">LV {levelOf(stats.xp)}</span>
                  <span className="w-20 text-right font-display font-bold text-white">
                    {data.you.score.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-white/45">{board === 'global' ? 'XP' : 'MMR'}</span>
                  </span>
                </li>
              </>
            )}
          </ol>
        </>
      ) : (
        <p className="py-5 text-center text-sm text-white/55">No pilots on this board yet — finish a lesson and you’ll be the first.</p>
      )}
    </div>
  );
}

const SYNC_TEXT: Record<SyncStatus, string> = {
  idle: 'Progress is saved to your account',
  saving: 'Saving to your account…',
  saved: 'All progress saved to your account',
  offline: 'Offline — progress will save when you reconnect',
};

/** The Google account the pilot is signed in with, whether progress has reached it, and sign-out. */
function AccountCard() {
  const user = useAccount((s) => s.user);
  const sync = useAccount((s) => s.sync);
  if (!user) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3">
      {user.picture ? (
        <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-9 shrink-0 rounded-full" />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white/70">
          <UserRound size={16} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{user.email || user.name}</span>
        <span className={`flex items-center gap-1.5 text-xs ${sync === 'offline' ? 'text-amber-300/80' : 'text-white/50'}`}>
          {sync === 'offline' ? <CloudOff size={12} /> : <Cloud size={12} />}
          {SYNC_TEXT[sync]}
        </span>
      </span>
      <button type="button" onClick={() => void signOut()} className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-white/60 ring-1 ring-white/10 transition hover:text-white hover:ring-white/30">
        <LogOut size={13} /> Sign out
      </button>
    </div>
  );
}
