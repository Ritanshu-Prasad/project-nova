const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/core/courseTemplates.ts');
let code = fs.readFileSync(file, 'utf8');

function injectBlocks(coursePrefix, extraBlocks) {
  // We'll search for topic('${coursePrefix}-gen-\\d+'
  // Then find its blocks: [
  // And insert the extraBlocks right after blocks: [
  
  // We can do this with a global regex replace, carefully matching the course prefix.
  const regex = new RegExp(`(topic\\('${coursePrefix}-gen-\\d+',[\\s\\S]*?blocks:\\s*\\[)`, 'g');
  
  code = code.replace(regex, (match) => {
    return match + '\\n      ' + extraBlocks + ',';
  });
}

const engExtra = `{ type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] }`;

const reactExtra = `{ type: 'code', language: 'tsx', code: 'function Component() {\\n  const [state, setState] = useState(0);\\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] }`;

const aiExtra = `{ type: 'formula', expr: 'L = -\\\\sum_{i=1}^{N} y_i \\\\log(\\\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] }`;

const laExtra = `{ type: 'formula', expr: 'A \\\\mathbf{v} = \\\\lambda \\\\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] }`;

const bioExtra = `{ type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] }`;

injectBlocks('eng', engExtra);
injectBlocks('react', reactExtra);
injectBlocks('ai', aiExtra);
injectBlocks('la', laExtra);
injectBlocks('bio', bioExtra);

fs.writeFileSync(file, code);
console.log('Successfully injected adapting sidebar blocks!');
