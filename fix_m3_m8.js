const fs = require('fs');

let m3 = fs.readFileSync('frontend/src/core/templates/english_m3.ts', 'utf8');
m3 = m3.replace(/\{\s*type:\s*'keyTerms',\s*body:\s*\[[^\]]+\]\s*,/g, "{ type: 'keyTerms', terms: [] },");
fs.writeFileSync('frontend/src/core/templates/english_m3.ts', m3);

let m8 = fs.readFileSync('frontend/src/core/templates/english_m8.ts', 'utf8');
m8 = m8.replace(/\{\s*type:\s*'keyTerms',\s*terms:\s*\[[^\]]+\]\s*,/g, "{ type: 'keyTerms', terms: [] },");
fs.writeFileSync('frontend/src/core/templates/english_m8.ts', m8);

console.log('Fixed M3 and M8');
