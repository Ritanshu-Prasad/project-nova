const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/core/courseTemplates.ts');
let code = fs.readFileSync(file, 'utf8');

// The error on line 2028 is:
// 'Yes, before 'because'', 'Yes, after 'because'', 'Yes, after 'shoes''
code = code.replace(/'Yes, before 'because''/g, "'Yes, before \\'because\\''");
code = code.replace(/'Yes, after 'because''/g, "'Yes, after \\'because\\''");
code = code.replace(/'Yes, after 'shoes''/g, "'Yes, after \\'shoes\\''");

// Error on line 2109 is probably related to another single quote. Let's check 2109.
// I will just use regex to fix all the `['string with ' inside']` issues.
// But it's safer to just look at 2109.
// Oh wait, 2109 is probably `eng-gen-21`:
// "brain to the reader's." -> I fixed "brain to the reader\\'s" but it might be in the summary or MCQ.
// Let's replace the whole eng-gen array with properly escaped strings.
// Actually, I can just use a regex replace to catch any `'... ' ...'` inside the mcq() call? No, too dangerous.

fs.writeFileSync(file, code);
console.log('Fixed quotes 2');
