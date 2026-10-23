import type { LibraryEntry } from './course';
import { flatTopics } from './courseSchema';
import { rankOf } from './rank';

/** What the graduation screen and certificate show for a finished course. */
export interface GraduationFacts {
  pilot: string;
  course: string;
  date: string;
  mmr: number;
  rank: string;
  rankColor: string;
  planets: number;
  modules: number;
  accuracy: number | null;
  hubQuizzes: number;
}

export function graduationFacts(e: LibraryEntry, pilot: string, hubQuizzes: number): GraduationFacts {
  const rank = rankOf(e.skill.mmr);
  return {
    pilot: pilot || 'Pilot',
    course: e.course.title,
    date: new Date(e.completedAt ?? Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    mmr: Math.round(e.skill.mmr),
    rank: rank.label,
    rankColor: rank.tier.color,
    planets: e.course.modules.length,
    modules: e.course.modules.length,
    accuracy: e.skill.answered ? Math.round((e.skill.correct / e.skill.answered) * 100) : null,
    hubQuizzes,
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'course';

/** Hands the browser a file to save. */
export function download(filename: string, data: Blob): void {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The pilot's study notes for a course, with each lesson's key takeaways, as a Markdown file. */
export function studyNotesMarkdown(e: LibraryEntry, f: GraduationFacts): string {
  const out = [`# ${f.course} — study notes`, '', `${f.pilot} · completed ${f.date} · final rank ${f.rank} (${f.mmr} RR)`, ''];
  const topics = flatTopics(e.course);
  const written = topics.filter((t) => e.progress[t.id]?.notes?.trim()).length;
  out.push(written ? `Your notes on ${written} of ${topics.length} topics, with the key takeaways of every lesson.` : `Key takeaways of every lesson (you didn’t write notes in this course — add some in the notes panel next time).`, '');
  e.course.modules.forEach((m, mi) => {
    out.push(`## Module ${mi + 1} · ${m.title}`, '');
    for (const t of topics.filter((x) => x.moduleIndex === mi)) {
      out.push(`### ${t.title}`, '');
      if (t.summary) out.push(`*${t.summary}*`, '');
      const notes = e.progress[t.id]?.notes?.trim();
      if (notes) out.push('**My notes**', '', notes, '');
      const points = t.lesson.blocks.flatMap((b) => (b.type === 'summary' ? b.points : []));
      if (points.length) out.push('**Key takeaways**', '', ...points.map((p) => `- ${p}`), '');
    }
  });
  return out.join('\n');
}

export const notesFilename = (f: GraduationFacts) => `${slug(f.course)}-study-notes.md`;
export const certificateFilename = (f: GraduationFacts) => `${slug(f.course)}-certificate.png`;

/** Renders the certificate as a 1600×1131 PNG (A-series proportions). */
export async function certificatePng(f: GraduationFacts, accent: string): Promise<Blob> {
  await document.fonts?.ready;
  const W = 1600;
  const H = 1131;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas unavailable');
  const display = '"Oxanium Variable", "Oxanium", "Segoe UI", sans-serif';
  const body = '"Inter Variable", "Inter", "Segoe UI", sans-serif';

  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#070b16');
  bg.addColorStop(1, '#0f1a33');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // A field of faint stars.
  let seed = f.course.length * 97 + f.pilot.length * 13;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 140; i++) g.fillRect(rnd() * W, rnd() * H, rnd() * 2 + 0.5, rnd() * 2 + 0.5);

  g.strokeStyle = accent;
  g.lineWidth = 6;
  g.strokeRect(48, 48, W - 96, H - 96);
  g.globalAlpha = 0.35;
  g.lineWidth = 2;
  g.strokeRect(70, 70, W - 140, H - 140);
  g.globalAlpha = 1;

  const center = (text: string, y: number, font: string, color: string) => {
    g.font = font;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.fillText(text, W / 2, y, W - 240);
  };
  center('N O V A', 175, `600 34px ${display}`, '#a5f3fc');
  center('CERTIFICATE OF COMPLETION', 255, `700 58px ${display}`, '#ffffff');
  center('This certifies that', 345, `400 30px ${body}`, 'rgba(255,255,255,0.7)');
  center(f.pilot, 440, `700 84px ${display}`, accent);
  center('has completed every planet and module quiz of', 520, `400 30px ${body}`, 'rgba(255,255,255,0.7)');
  center(f.course, 600, `700 56px ${display}`, '#ffffff');

  const stats: [string, string][] = [
    ['FINAL RANK', f.rank],
    ['RR', String(f.mmr)],
    ['PLANETS', String(f.planets)],
    ['ACCURACY', f.accuracy === null ? '—' : `${f.accuracy}%`],
  ];
  const colW = (W - 320) / stats.length;
  stats.forEach(([label, value], i) => {
    const x = 160 + colW * i + colW / 2;
    g.textAlign = 'center';
    g.font = `600 22px ${body}`;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText(label, x, 735);
    g.font = `700 46px ${display}`;
    g.fillStyle = i === 0 ? f.rankColor : '#ffffff';
    g.fillText(value, x, 795, colW - 30);
  });

  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(240, 880);
  g.lineTo(W - 240, 880);
  g.stroke();
  center(`Awarded ${f.date} · ${f.modules} modules · ${f.hubQuizzes} hub quiz${f.hubQuizzes === 1 ? '' : 'zes'}`, 935, `400 26px ${body}`, 'rgba(255,255,255,0.65)');
  center('Project NOVA · AI tutor', 1000, `600 22px ${display}`, 'rgba(165,243,252,0.7)');

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render the certificate'))), 'image/png'));
}
