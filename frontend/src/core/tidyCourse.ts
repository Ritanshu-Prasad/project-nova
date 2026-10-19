import type { Block, Course, Question, Topic } from './courseSchema';

/**
 * Light clean-up for any course before it enters the library (templates, AI output, PDFs, older saves).
 * Idempotent — safe to run on every load.
 *
 * - drops modules with no topics (e.g. a layout slot whose topic was never written);
 * - strips "3. " style numbering from module titles (the UI numbers modules itself);
 * - removes blocks pasted identically into many topics — boilerplate that is not about any one topic;
 * - removes empty or placeholder key-term entries ("Concept — See summary");
 * - turns {{answer}} markers in fill-in questions into a blank, so the question doesn't reveal its answer;
 * - gives every topic a distinct planet name for the journey map.
 */

/** A block repeated identically in at least this many topics is boilerplate. */
const BOILERPLATE_MIN = 4;

const STARS = [
  'Achernar', 'Aldebaran', 'Alnilam', 'Alphard', 'Arcturus', 'Betelgeuse', 'Canopus', 'Castor', 'Electra', 'Fomalhaut', 'Hadar', 'Izar',
  'Kochab', 'Lyra', 'Maia', 'Merak', 'Mimosa', 'Mira', 'Naos', 'Nunki', 'Pollux', 'Procyon', 'Regulus', 'Rasalhague', 'Sadr', 'Saiph',
  'Shaula', 'Spica', 'Tarazed', 'Thuban', 'Vega', 'Wezen', 'Zosma', 'Adhara', 'Alcor', 'Alkaid', 'Ankaa', 'Avior', 'Caph', 'Diphda',
  'Elnath', 'Gacrux', 'Hamal', 'Lesath', 'Markab', 'Menkar', 'Mirfak', 'Nashira', 'Peacock', 'Rigil', 'Sabik', 'Scheat', 'Tureis',
  'Unuk', 'Vindemiatrix', 'Yildun', 'Zaurak', 'Acrux', 'Algol', 'Almach', 'Atria', 'Dubhe', 'Enif', 'Furud', 'Kaus', 'Menkent',
];

export function tidyCourse(course: Course): Course {
  const topics = course.modules.flatMap((m) => m.topics);
  const counts = new Map<string, number>();
  for (const t of topics) for (const key of new Set(t.lesson.blocks.map((b) => JSON.stringify(b)))) counts.set(key, (counts.get(key) ?? 0) + 1);
  const boilerplate = (b: Block) => (counts.get(JSON.stringify(b)) ?? 0) >= BOILERPLATE_MIN;

  const used = new Set<string>();
  let star = 0;
  const planet = (name: string) => {
    let p = name.trim() || 'Nova';
    if (used.has(p)) {
      while (star < STARS.length && used.has(STARS[star])) star++;
      p = star < STARS.length ? STARS[star++] : `${p} ${used.size + 1}`;
    }
    used.add(p);
    return p;
  };

  return {
    ...course,
    modules: course.modules
      .filter((m) => m.topics.length)
      .map((m) => ({
        ...m,
        title: m.title.replace(/^(\s*\d+\s*[.):-]\s+)+/, '') || m.title,
        topics: m.topics.map((t) => {
          const blocks = t.lesson.blocks.filter((b) => !boilerplate(b)).map(cleanBlock).filter((b): b is Block => b !== null);
          return { ...t, planet: planet(t.planet), lesson: { ...t.lesson, blocks: blocks.length ? blocks : t.lesson.blocks }, quiz: t.quiz.map(cleanQuestion), practice: t.practice?.map(cleanQuestion) };
        }),
      })),
  };
}

/** The same clean-up for one topic's content, as it arrives from a lazy fetch. */
export function tidyTopicContent(c: Pick<Topic, 'lesson' | 'quiz' | 'practice'>): Pick<Topic, 'lesson' | 'quiz' | 'practice'> {
  const blocks = c.lesson.blocks.map(cleanBlock).filter((b): b is Block => b !== null);
  return { lesson: { ...c.lesson, blocks }, quiz: c.quiz.map(cleanQuestion), practice: c.practice?.map(cleanQuestion) };
}

function cleanBlock(b: Block): Block | null {
  if (b.type !== 'keyTerms') return b;
  const terms = b.terms.filter((x) => x.term.trim() && x.def.trim() && !/^concept$/i.test(x.term.trim()) && !/^see summary\.?$/i.test(x.def.trim()));
  return terms.length ? { ...b, terms } : null;
}

function cleanQuestion(q: Question): Question {
  return q.type === 'fill' && q.q.includes('{{') ? { ...q, q: q.q.replace(/\{\{[^}]*\}\}/g, '____') } : q;
}
