const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend/src/core/templates');
const files = fs.readdirSync(dir).filter(f => f.startsWith('english_m') && f.endsWith('.ts') && f !== 'english_index.ts');

for (const file of files) {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');

  // Fix missing Topic closing brace before the next Topic
  content = content.replace(/(\n\s*\])\s*,\s*\n(\s*\{\s*\n\s*id:)/g, '$1\n    },\n$2');
  
  // Fix missing Topic closing brace at the end of the file
  content = content.replace(/(\n\s*\])\s*\n(\s*\];)/g, '$1\n    }\n$2');
  
  // Fix missing closing braces on keyTerms
  // Some lines end with `def: '...' }],`
  // We need to change to `def: '...' }] },`
  content = content.replace(/(def:\s*(?:'[^']+'|"[^"]+"))\s*\}\s*\]\s*,/g, '$1 }] },');

  // And for the ones with commas like `type: 'keyTerms', terms: [{term: 'x', def: 'y'}, {term: 'a', def: 'b'}],`
  content = content.replace(/(\{\s*type:\s*['"]keyTerms['"].*?def:\s*(?:'[^']+'|"[^"]+"))\s*\}\s*\]\s*,/g, '$1 }] },');

  fs.writeFileSync(p, content);
}
console.log('Fixed braces!');
