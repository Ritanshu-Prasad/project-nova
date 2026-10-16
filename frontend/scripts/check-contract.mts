// Checks that what the backend sends survives the app's own validators with nothing dropped.
// Samples are written by backend/tests/test_contract.py. Needs Node 22.6+ (runs TypeScript directly).
import { readFileSync } from 'node:fs';
import { normQuestion, normalizeCourse, normTopic, type Block, type Question } from '../src/core/courseSchema.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../backend/tests/fixtures/${name}.json`, import.meta.url), 'utf8'));
const problems: string[] = [];
const expect = (ok: boolean, message: string) => ok || problems.push(message);

const countBy = (items: { type: string }[]) => {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.type] = (counts[item.type] ?? 0) + 1;
  return JSON.stringify(Object.entries(counts).sort());
};
const termsIn = (blocks: Block[]) => blocks.flatMap((b) => (b.type === 'keyTerms' ? b.terms : [])).length;

function sameTopic(label: string, sent: any, got: any) {
  expect(countBy(sent.lesson.blocks) === countBy(got.lesson.blocks), `${label}: lesson blocks changed (${countBy(sent.lesson.blocks)} -> ${countBy(got.lesson.blocks)})`);
  expect(termsIn(sent.lesson.blocks) === termsIn(got.lesson.blocks), `${label}: key terms were dropped`);
  expect(countBy(sent.quiz) === countBy(got.quiz), `${label}: quiz questions changed`);
  expect(countBy(sent.practice) === countBy(got.practice), `${label}: practice questions changed`);
  for (const q of [...got.quiz, ...got.practice] as Question[]) {
    if (q.type === 'code') for (const c of q.checks) expect(!!new RegExp(c.pattern), `${label}: bad check pattern ${c.pattern}`);
  }
}

// An outline-only course keeps every topic, flagged as not written yet, and its module quizzes.
const lazy = read('lazy_course');
const lazyGot = normalizeCourse(lazy);
expect(lazyGot.modules.length === lazy.modules.length, 'lazy: modules were dropped');
for (const [m, module] of lazy.modules.entries()) {
  expect(lazyGot.modules[m].topics.length === module.topics.length, `lazy: topics of module ${m + 1} were dropped`);
  expect(lazyGot.modules[m].topics.every((t) => t.loaded === false), `lazy: module ${m + 1} has a topic that is not flagged as outline-only`);
  expect(countBy(lazyGot.modules[m].quiz ?? []) === countBy(module.quiz), `lazy: module ${m + 1} quiz changed`);
}

// A fully written course keeps everything and is not flagged.
const docs = read('documents_course');
const docsGot = normalizeCourse(docs);
expect(docsGot.meta?.documentsKey === docs.meta.documentsKey && !!docsGot.meta?.promptVersion, 'documents: meta was not kept');
expect(docsGot.source === 'documents' && docsGot.documents?.length === docs.documents.length, 'documents: source or document list changed');
for (const [m, module] of docs.modules.entries()) {
  expect(docsGot.modules[m].topics.length === module.topics.length, `documents: topics of module ${m + 1} were dropped`);
  for (const [t, topic] of module.topics.entries()) {
    const got = docsGot.modules[m].topics[t];
    expect(got.loaded === undefined, 'documents: a written topic is flagged as outline-only');
    sameTopic(`documents ${m + 1}.${t + 1}`, topic, got);
  }
}

// A topic fetched on demand.
const fetched = read('topic');
sameTopic('topic', fetched, normTopic({ ...fetched, title: 'Bridges' }));

// A module quiz written from the lessons.
const moduleQuiz = read('module_quiz');
const moduleQuizGot = moduleQuiz.quiz.map(normQuestion).filter((q: Question | null): q is Question => q !== null);
expect(countBy(moduleQuiz.quiz) === countBy(moduleQuizGot), 'module quiz: questions changed');

if (problems.length) {
  console.error(`Contract check failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('Contract check passed: the backend samples survive the frontend validators unchanged.');
