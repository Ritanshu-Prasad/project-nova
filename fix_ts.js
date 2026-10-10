const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend/src/core/templates');
const files = fs.readdirSync(dir).filter(f => f.startsWith('english_m') && f.endsWith('.ts') && f !== 'english_index.ts');

for (const file of files) {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');

  // Fix kind
  content = content.replace(/kind:\s*'(Lexis|Syntax|Punctuation|Writing)'/g, "kind: 'language'");
  
  // Fix type -> planet
  content = content.replace(/type:\s*'concept',/g, "planet: 'Earth',");

  // Fix simple -> summary (first level)
  // It appears as `simple: '...'` inside the topic root, and inside lesson.
  // Actually, we can just change simple: to summary: everywhere except inside lesson.
  // Topic has `summary`, Lesson has `simple`.
  content = content.replace(/(\s+)simple:(\s*['"])/g, (match, space, quote) => {
    return space + 'summary:' + quote;
  });
  // Now revert it back for the one inside lesson: {
  // Wait, lesson has `simple: string`. It is easier to just rename simple to summary. But lesson actually requires `simple: string`.
  // Let's just blindly rename simple to summary, then rename `lesson: {\s*minutes: \d+,\s*objectives: \[.*?\],\s*summary:` back to `simple:`.
  
  // Actually, a smarter regex:
  // We know the topic `simple:` comes right after `type: 'concept',` (now `planet: 'Earth',`).
  content = content.replace(/planet: 'Earth',\s+simple:/g, "planet: 'Earth',\n    summary:");

  // Fix questions inside lesson
  // The structure is `lesson: { ..., questions: [ ... ] }`
  // We want to close the lesson and open quiz.
  // Find `questions: [` and replace with `}, quiz: [`
  // But we need to remove the trailing `}` that closed the lesson.
  content = content.replace(/questions:\s*\[/g, "}, quiz: [");
  // Now there is an extra `}` at the end of the topic object!
  // `quiz: [...] } }` -> `quiz: [...] }`
  content = content.replace(/\]\s*\}\s*\}/g, "] }");
  content = content.replace(/\]\s*\}\s*,/g, "],");

  // Fix summary body -> points
  content = content.replace(/\{\s*type:\s*'summary',\s*body:\s*('[^']+'|"[^"]+")\s*\}/g, "{ type: 'summary', points: [$1] }");
  
  // Fix keyTerms items -> terms
  content = content.replace(/\{\s*type:\s*'keyTerms',\s*items:/g, "{ type: 'keyTerms', terms:");
  
  // Fix keyTerms definition -> def
  content = content.replace(/definition:/g, "def:");
  
  // Fix terms: [['term', 'def']] into terms: [{term: 'x', def: 'y'}]
  // Only some files might have it? `error TS2322: Type 'string' is not assignable to type '{ term: string; def: string; }'`
  content = content.replace(/\[\s*('[^']+'),\s*('[^']+')\s*\]/g, "{ term: $1, def: $2 }");

  fs.writeFileSync(p, content);
}
console.log('Fixed syntax and schema issues in english templates.');
