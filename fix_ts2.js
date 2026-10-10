const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend/src/core/templates');
const files = fs.readdirSync(dir).filter(f => f.startsWith('english_m') && f.endsWith('.ts') && f !== 'english_index.ts');

for (const file of files) {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');

  // Fix remaining kind issues (some might have double quotes)
  content = content.replace(/kind:\s*["'](?:Lexis|Syntax|Punctuation|Writing)["']/g, "kind: 'language'");

  // Fix questions inside lesson again. 
  // Look for any `questions:` in the file and replace it with `}, quiz:`
  // But ensure it only happens once or twice per file.
  // Actually, replacing `questions:` with `}, quiz:` works if it's the last property of lesson.
  content = content.replace(/questions:\s*\[/g, "}, quiz: [");
  // Clean up double `}}`
  content = content.replace(/\]\s*\}\s*\}/g, "] }");
  content = content.replace(/\]\s*\}\s*,/g, "],");

  // Fix summary body -> points (if double quotes used)
  content = content.replace(/\{\s*type:\s*['"]summary['"],\s*body:\s*('[^']+'|"[^"]+")\s*\}/g, "{ type: 'summary', points: [$1] }");
  
  // Fix keyTerms items -> terms
  content = content.replace(/\{\s*type:\s*['"]keyTerms['"],\s*items:/g, "{ type: 'keyTerms', terms:");
  
  // Fix keyTerms definition -> def (if any left)
  content = content.replace(/definition:/g, "def:");
  
  // Fix terms: [['term', 'def'], ...] -> terms: [{term: '...', def: '...'}, ...]
  // A global regex to catch `[ 'abc', 'def' ]`
  content = content.replace(/\[\s*(['"][^'"]+['"])\s*,\s*(['"][^'"]+['"])\s*\]/g, "{ term: $1, def: $2 }");

  fs.writeFileSync(p, content);
}
console.log('Fixed more syntax issues.');
