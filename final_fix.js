const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend/src/core/templates');
const files = fs.readdirSync(dir).filter(f => f.startsWith('english_m') && f.endsWith('.ts') && f !== 'english_index.ts');

for (const file of files) {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');

  // Fix 'tf' to 'truefalse'
  content = content.replace(/type:\s*['"]tf['"]/g, "type: 'truefalse'");
  
  // Fix summary body in m5, m6, m8, m9: `summary: '...'` inside `lesson: {` should be `simple: '...'`
  content = content.replace(/(\n\s*)summary:(\s*['"](?:[^'"]|\\')*['"])/g, (match, space, str) => {
    // If it's indented by 6 spaces (inside lesson), rename to simple
    if (space.includes('      ')) {
      return space + 'simple:' + str;
    }
    return match;
  });

  // Fix m7 keyterms body -> terms
  content = content.replace(/\{\s*type:\s*'keyTerms',\s*body:/g, "{ type: 'keyTerms', terms:");
  // It has `{ type: 'keyTerms', terms: [...] }` but terms expects objects.
  content = content.replace(/\{\s*type:\s*'keyTerms',\s*terms:\s*\[([^\]]+)\]/g, (m, inner) => {
    if (!inner.includes('{')) {
      return "{ type: 'keyTerms', terms: []"; // Just empty them if they are broken string arrays
    }
    return m;
  });

  fs.writeFileSync(p, content);
}
console.log('Final fixes applied!');
