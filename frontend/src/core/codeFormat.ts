/**
 * Puts a code example that arrived on a single line back on several lines.
 *
 * AI-written lessons sometimes hand over `num = 5 if num > 0: print('Positive') else: print('Not positive')` as one
 * line. New courses are asked again by the backend; this repairs courses that were already saved that way.
 *
 * It is deliberately conservative:
 *  - code that already has line breaks, short snippets and languages other than Python and the brace languages
 *    (JavaScript, TypeScript, Java, C, …) are returned unchanged;
 *  - text inside strings, comments and brackets is never touched;
 *  - the result must contain exactly the same characters as the input (apart from whitespace, and the `;` that
 *    separates Python statements) — otherwise the original is returned;
 *  - if nothing can be split with confidence, the original is returned.
 * Where the end of a Python loop or `if` body cannot be told, later statements stay in the body.
 */

const MIN_LENGTH = 30;
const PYTHON = new Set(['python', 'py', 'python3']);
const BRACE = new Set(['javascript', 'js', 'typescript', 'ts', 'tsx', 'jsx', 'java', 'c', 'cpp', 'c++', 'csharp', 'c#']);
const PY_INDENT = '    ';
const JS_INDENT = '  ';

type Kind = 'word' | 'num' | 'str' | 'group' | 'op' | 'comment';
interface Tok {
  t: string;
  k: Kind;
  /** Whitespace came before the token in the original. */
  sp: boolean;
}

export function formatCode(code: string, language: string): string {
  const lang = language.trim().toLowerCase();
  const python = PYTHON.has(lang);
  if (!python && !BRACE.has(lang)) return code;
  if (code.trim().includes('\n')) return code; // already on several lines
  // A model that wrote its line breaks out as text (a backslash and an n). Without quotes it cannot be a string literal.
  if ((code.match(/\\n/g)?.length ?? 0) >= 2 && !/["']/.test(code)) return code.replace(/\\n/g, '\n');
  const text = code.trim();
  if (text.length < MIN_LENGTH) return code;
  const toks = python ? tokenisePython(text) : tokeniseBrace(text);
  if (!toks) return code;
  const lines = python ? layoutPython(toks) : layoutBrace(toks);
  if (lines.length < 2) return code;
  const out = lines.join('\n');
  const ignore = python ? /[\s;]+/g : /\s+/g;
  return out.replace(ignore, '') === text.replace(ignore, '') ? out : code;
}

// ── Tokens ────────────────────────────────────────────────────────────────

/** End index (exclusive) of the string starting at `i`, or -1 when it is not closed. */
function readString(s: string, i: number, python: boolean): number {
  const q = s[i];
  const triple = python && s.startsWith(q.repeat(3), i);
  let j = i + (triple ? 3 : 1);
  while (j < s.length) {
    if (s[j] === '\\') j += 2;
    else if (triple ? s.startsWith(q.repeat(3), j) : s[j] === q) return j + (triple ? 3 : 1);
    else j++;
  }
  return -1;
}

/** End index (exclusive) of the bracket group starting at `i`, strings skipped, or -1. */
function readGroup(s: string, i: number): number {
  const closers: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'") {
      const end = readString(s, j, true);
      if (end < 0) return -1;
      j = end - 1;
    } else if (closers[c]) stack.push(closers[c]);
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) return -1;
      if (!stack.length) return j + 1;
    }
  }
  return -1;
}

const WORD = /^[\p{L}_$][\p{L}\p{N}_$]*/u;
const NUM = /^\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const PY_OP = /^(?:==|!=|<=|>=|:=|->|\*\*=?|\/\/=?|<<=?|>>=?|[+\-*/%&|^@]=|[\s\S])/;
const JS_OP = /^(?:===|!==|=>|\+\+|--|&&|\|\||\?\?|==|!=|<=|>=|\*\*|[+\-*/%&|^]=|[\s\S])/;

/** A number, name or operator starting at `s` (already past whitespace). */
function readSimple(s: string, op: RegExp): { end: number; k: Kind } {
  const m = NUM.exec(s) ?? WORD.exec(s);
  if (m) return { end: m[0].length, k: /^\d/.test(m[0]) ? 'num' : 'word' };
  return { end: (op.exec(s) as RegExpExecArray)[0].length, k: 'op' };
}

function tokenisePython(s: string): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const start = i;
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    const sp = i > start;
    const c = s[i];
    let end: number;
    let k: Kind;
    if (c === '"' || c === "'") {
      end = readString(s, i, true);
      k = 'str';
    } else if (c === '(' || c === '[' || c === '{') {
      end = readGroup(s, i);
      k = 'group';
    } else if (c === '#') {
      end = s.length;
      k = 'comment';
    } else if (c === ')' || c === ']' || c === '}') return null;
    else {
      const r = readSimple(s.slice(i), PY_OP);
      end = i + r.end;
      k = r.k;
    }
    if (end < 0) return null;
    toks.push({ t: s.slice(i, end), k, sp });
    i = end;
  }
  return toks;
}

function tokeniseBrace(s: string): Tok[] | null {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const start = i;
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    const sp = i > start;
    const c = s[i];
    let end: number;
    let k: Kind;
    if (c === '"' || c === "'" || c === '`') {
      end = readString(s, i, false);
      k = 'str';
    } else if (s.startsWith('//', i)) {
      end = s.length;
      k = 'comment';
    } else if (s.startsWith('/*', i)) {
      const close = s.indexOf('*/', i + 2);
      end = close < 0 ? -1 : close + 2;
      k = 'comment';
    } else {
      const r = readSimple(s.slice(i), JS_OP);
      end = i + r.end;
      k = r.k;
    }
    if (end < 0) return null;
    toks.push({ t: s.slice(i, end), k, sp });
    i = end;
  }
  return toks;
}

// ── Python layout ─────────────────────────────────────────────────────────

const HEAD = new Set(['if', 'for', 'while', 'def', 'class', 'try', 'with']);
const CLAUSE = new Set(['elif', 'else', 'except', 'finally']);
const STATEMENT = new Set(['return', 'raise', 'import', 'assert', 'del', 'global', 'nonlocal']);
const VALUE = new Set(['None', 'True', 'False', 'pass', 'break', 'continue']);
const OPERATOR_WORDS = new Set(['and', 'or', 'not', 'in', 'is', 'as', 'lambda', 'await', 'async', 'from', 'yield']);

const isKeyword = (t: Tok) => t.k === 'word' && (HEAD.has(t.t) || CLAUSE.has(t.t) || STATEMENT.has(t.t) || OPERATOR_WORDS.has(t.t));
/** The token ends a value, so a name or statement keyword right after it must start a new statement. */
const endsOperand = (t: Tok | undefined) => !!t && (t.k === 'num' || t.k === 'str' || t.k === 'group' || (t.k === 'word' && (VALUE.has(t.t) || !isKeyword(t))));

/** Whether the keyword at `i` opens a compound statement: a ':' (outside brackets and strings) follows it. */
function isHeader(toks: Tok[], i: number): boolean {
  const kw = toks[i].t;
  if (kw === 'else' || kw === 'try' || kw === 'finally') return toks[i + 1]?.t === ':';
  for (let j = i + 1; j < toks.length; j++) {
    const t = toks[j];
    if (t.k === 'op' && t.t === ':') return true;
    if (t.k === 'op' && t.t === '=') return false; // an assignment: "x = a if b else c"
    if (kw === 'if' && t.k === 'word' && t.t === 'else') return false; // a conditional expression
  }
  return false;
}

function layoutPython(toks: Tok[]): string[] {
  const lines: { ind: number; text: string }[] = [];
  const heads: number[] = [];
  let ind = 0;
  let pending = false; // a header is waiting for its colon
  let afterColon = false;
  let afterSemicolon = false;
  let first = '';
  toks.forEach((tok, i) => {
    const prev: Tok | undefined = toks[i - 1];
    if (tok.k === 'op' && tok.t === ';') {
      afterSemicolon = true;
      return;
    }
    const word = tok.k === 'word';
    const boundary = i === 0 || afterColon || afterSemicolon;
    const clause = word && CLAUSE.has(tok.t) && isHeader(toks, i);
    const head = word && HEAD.has(tok.t) && isHeader(toks, i) && (boundary || (tok.sp && endsOperand(prev)));
    const statement = word && tok.sp && STATEMENT.has(tok.t) && endsOperand(prev) && !(tok.t === 'import' && first === 'from');
    const name = word && tok.sp && !isKeyword(tok) && endsOperand(prev) && !(prev?.k === 'word' && prev.t === 'import');
    const newLine = boundary || clause || head || statement || name;
    if (clause) ind = heads.pop() ?? ind;
    afterColon = false;
    afterSemicolon = false;
    if (newLine || !lines.length) {
      lines.push({ ind, text: tok.t });
      first = tok.t;
    } else lines[lines.length - 1].text += (tok.sp ? ' ' : '') + tok.t;
    if (clause || head) {
      heads.push(ind);
      pending = true;
    } else if (pending && tok.k === 'op' && tok.t === ':') {
      pending = false;
      ind += 1;
      afterColon = true;
    }
  });
  return lines.map((l) => PY_INDENT.repeat(l.ind) + l.text);
}

// ── Brace-language layout ─────────────────────────────────────────────────

const BLOCK_WORDS = new Set(['else', 'try', 'finally', 'do']);
const DECLARATIONS = new Set(['class', 'interface', 'enum', 'namespace', 'module']);
const CONTINUES = new Set(['else', 'catch', 'finally', 'while']);
const AFTER_BRACE = new Set([')', ',', ';', '.', ']']);

function layoutBrace(toks: Tok[]): string[] {
  const lines: { ind: number; text: string }[] = [];
  const blocks: boolean[] = [];
  let ind = 0;
  let depth = 0; // open ( and [
  let brk = true;
  let lineFirst = '';
  const emit = (t: Tok) => {
    if (brk || !lines.length) {
      lines.push({ ind, text: t.t });
      lineFirst = t.t;
      brk = false;
    } else lines[lines.length - 1].text += (t.sp ? ' ' : '') + t.t;
  };
  toks.forEach((tok, i) => {
    const prev: Tok | undefined = toks[i - 1];
    const next: Tok | undefined = toks[i + 1];
    if (tok.k === 'comment') {
      emit(tok);
      brk = true;
      return;
    }
    if (tok.k !== 'op') {
      emit(tok);
      return;
    }
    switch (tok.t) {
      case '(':
      case '[':
        depth++;
        emit(tok);
        return;
      case ')':
      case ']':
        depth = Math.max(0, depth - 1);
        emit(tok);
        return;
      case ';':
        emit(tok);
        if (depth === 0) brk = true;
        return;
      case '{': {
        const block =
          next?.t !== '}' &&
          (!prev ||
            prev.t === ')' ||
            prev.t === '=>' ||
            (prev.k === 'word' && BLOCK_WORDS.has(prev.t)) ||
            (prev.k === 'word' && DECLARATIONS.has(lineFirst)) ||
            (prev.k === 'word' && toks[i - 2]?.t === ':' && toks[i - 3]?.t === ')'));
        blocks.push(!!block);
        emit(tok);
        if (block) {
          ind++;
          brk = true;
        }
        return;
      }
      case '}': {
        const block = blocks.pop() ?? false;
        if (block) {
          ind = Math.max(0, ind - 1);
          brk = true;
        }
        emit(tok);
        if (block) brk = !!next && !(next.k === 'word' && CONTINUES.has(next.t)) && !AFTER_BRACE.has(next.t);
        return;
      }
      default:
        emit(tok);
    }
  });
  return lines.map((l) => JS_INDENT.repeat(l.ind) + l.text);
}
