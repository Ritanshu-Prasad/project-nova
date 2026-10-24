import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './mdParse';

describe('parseMarkdown', () => {
  it('splits paragraphs on blank lines and keeps single newlines as separate lines', () => {
    expect(parseMarkdown('one\ntwo\n\nthree')).toEqual([
      { type: 'p', lines: ['one', 'two'] },
      { type: 'p', lines: ['three'] },
    ]);
  });

  it('parses unordered and ordered lists after prose', () => {
    const [p, ul, ol] = parseMarkdown('Intro:\n- a\n- b\n1. x\n2) y');
    expect(p).toEqual({ type: 'p', lines: ['Intro:'] });
    expect(ul).toMatchObject({ type: 'list', kind: 'ul', items: [{ text: 'a' }, { text: 'b' }] });
    expect(ol).toMatchObject({ type: 'list', kind: 'ol', items: [{ text: 'x' }, { text: 'y' }] });
  });

  it('nests lists by indent', () => {
    const [l] = parseMarkdown('1. first\n  - sub a\n  - sub b\n2. second');
    expect(l).toMatchObject({ kind: 'ol', items: [{ text: 'first', children: [{ kind: 'ul', items: [{ text: 'sub a' }, { text: 'sub b' }] }] }, { text: 'second', children: [] }] });
  });

  it('keeps the letter of A) / A. option lines', () => {
    const [q, opts] = parseMarkdown('Which one?\nA) red\nB. blue\nC) green');
    expect(q).toEqual({ type: 'p', lines: ['Which one?'] });
    expect(opts).toMatchObject({ kind: 'options', items: [{ label: 'A)', text: 'red' }, { label: 'B.', text: 'blue' }, { label: 'C)', text: 'green' }] });
  });

  it('does not treat a sentence starting with a word as an option', () => {
    expect(parseMarkdown('A dog barks.')).toEqual([{ type: 'p', lines: ['A dog barks.'] }]);
  });

  it('reads code fences verbatim', () => {
    expect(parseMarkdown('text\n```js\n- not a list\n```\nafter')).toEqual([
      { type: 'p', lines: ['text'] },
      { type: 'code', code: '- not a list' },
      { type: 'p', lines: ['after'] },
    ]);
  });
});
