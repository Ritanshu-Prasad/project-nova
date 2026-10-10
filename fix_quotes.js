const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/core/courseTemplates.ts');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/Implied 'You' in commands/g, "Implied \\'You\\' in commands");
code = code.replace(/Describes the subject's action/g, "Describes the subject\\'s action");
code = code.replace(/reader's logic/g, "reader\\'s logic");

fs.writeFileSync(file, code);
console.log('Fixed quotes!');
