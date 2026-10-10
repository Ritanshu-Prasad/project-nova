const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend/src/core/templates');
const files = fs.readdirSync(dir).filter(f => f.startsWith('english_m') && f.endsWith('.ts') && f !== 'english_index.ts');

for (const file of files) {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');

  // Fix broken options arrays: `options: [{ term: 'A', def: 'B' }, { term: 'C', def: 'D' }]`
  // Actually, sometimes it's `options: [{ term: 'A', def: 'B' }, 'C', 'D']`
  // Let's just reverse the regex ONLY inside `options: `
  // We can do this easily by repeatedly replacing `{ term: (.*?), def: (.*?) }` with `$1, $2`
  content = content.replace(/\{ term: (['"][^'"]+['"]),\s*def: (['"][^'"]+['"]) \}/g, (match, p1, p2) => {
    return `${p1}, ${p2}`;
  });

  // Now, what about the ACTUAL keyTerms that NEEDED `{ term: ..., def: ... }`?
  // They are in `terms: [...]`.
  // We can fix `terms: ['A', 'B']` by running:
  content = content.replace(/terms:\s*\[\s*([^\{]+?)\s*\]/g, (match, inner) => {
    // If it's just strings like `'Noun', 'A word...'` we can wrap them.
    // Let's just use a naive split by comma if it doesn't contain `{`
    if (!inner.includes('{')) {
      // Split by comma
      const parts = inner.split(',').map(s => s.trim()).filter(Boolean);
      let newTerms = [];
      for(let i=0; i<parts.length; i+=2) {
        if (parts[i+1]) {
          newTerms.push(`{ term: ${parts[i]}, def: ${parts[i+1]} }`);
        } else {
          newTerms.push(`{ term: ${parts[i]}, def: 'See summary' }`);
        }
      }
      return `terms: [${newTerms.join(', ')}]`;
    }
    return match;
  });

  // Fix missing answer/why in `type: 'fill'`
  content = content.replace(/\{\s*type:\s*['"]fill['"]\s*,\s*q:\s*('[^']+'|"[^"]+")\s*\}/g, "{ type: 'fill', q: $1, answer: 'TODO', why: 'TODO' }");

  // Fix summary body in m12
  content = content.replace(/\{\s*type:\s*'summary',\s*body:\s*('[^']+'|"[^"]+")\s*\}/g, "{ type: 'summary', points: [$1] }");

  // Fix m7 terms being assigned a string instead of array
  content = content.replace(/terms:\s*('[^']+'|"[^"]+")/g, "terms: [{ term: $1, def: 'See summary' }]");

  fs.writeFileSync(p, content);
}
console.log('Fixed options and fill!');
