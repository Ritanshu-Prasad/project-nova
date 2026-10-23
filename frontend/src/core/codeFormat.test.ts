import { describe, expect, it } from 'vitest';
import { formatCode } from './codeFormat';
import type { Course } from './courseSchema';
import { tidyCourse } from './tidyCourse';

const py = (code: string) => formatCode(code, 'python');
const js = (code: string) => formatCode(code, 'javascript');

describe('formatCode — Python', () => {
  it('splits the one-line if/else from the lesson screenshot', () => {
    expect(py("num = 5 if num > 0: print('Positive') else: print('Not positive')")).toBe("num = 5\nif num > 0:\n    print('Positive')\nelse:\n    print('Not positive')");
  });

  it('indents nested bodies', () => {
    expect(py('for n in nums: if n % 2 == 0: print(n)')).toBe('for n in nums:\n    if n % 2 == 0:\n        print(n)');
  });

  it('puts a def body on its own line', () => {
    expect(py('def add(a, b): return a + b # sum of two numbers')).toBe('def add(a, b):\n    return a + b # sum of two numbers');
  });

  it('keeps try / except at the same level', () => {
    expect(py('try: value = int(text) except ValueError: value = 0')).toBe('try:\n    value = int(text)\nexcept ValueError:\n    value = 0');
  });

  it('splits statements that were run together', () => {
    expect(py('x = 5 y = 10 print(x + y) # show the total')).toBe('x = 5\ny = 10\nprint(x + y) # show the total');
    expect(py('import os import sys print(sys.argv)')).toBe('import os\nimport sys\nprint(sys.argv)');
  });

  it('turns semicolons into line breaks', () => {
    expect(py('a = 1; b = 2; print(a + b) # three statements')).toBe('a = 1\nb = 2\nprint(a + b) # three statements');
  });

  it('keeps "from … import" together', () => {
    expect(py('from math import sqrt print(sqrt(16) + sqrt(9))')).toBe('from math import sqrt\nprint(sqrt(16) + sqrt(9))');
  });

  it('leaves text inside strings and brackets alone', () => {
    const out = py("message = 'if a: b else: c' print({'if': 1, 'else': [2, 3]})");
    expect(out).toBe("message = 'if a: b else: c'\nprint({'if': 1, 'else': [2, 3]})");
  });

  it('does not split a number from a hex suffix', () => {
    expect(py('mask = 0xFF value = mask & 0x0F print(value)')).toBe('mask = 0xFF\nvalue = mask & 0x0F\nprint(value)');
  });

  it('leaves single statements alone', () => {
    const comprehension = 'squares = [n * n for n in range(10) if n % 2 == 0]';
    const conditional = 'total = price if in_stock else 0  # inline conditional';
    const lambda = 'double = lambda value: value * 2  # a one-line function';
    for (const code of [comprehension, conditional, lambda]) expect(py(code)).toBe(code);
  });
});

describe('formatCode — brace languages', () => {
  it('splits statements on semicolons', () => {
    expect(js('const a = 1; const b = 2; console.log(a + b);')).toBe('const a = 1;\nconst b = 2;\nconsole.log(a + b);');
  });

  it('opens a function body', () => {
    expect(js('function add(a, b) { return a + b; }')).toBe('function add(a, b) {\n  return a + b;\n}');
  });

  it('keeps else on the closing brace line', () => {
    expect(js('if (ready) { run(); } else { stop(); }')).toBe('if (ready) {\n  run();\n} else {\n  stop();\n}');
  });

  it('does not split the header of a for loop', () => {
    expect(js('for (let i = 0; i < 3; i++) { console.log(i); }')).toBe('for (let i = 0; i < 3; i++) {\n  console.log(i);\n}');
  });

  it('keeps object literals and destructuring inline', () => {
    expect(js("const user = { name: 'Asha', age: 30 }; console.log(user.name);")).toBe("const user = { name: 'Asha', age: 30 };\nconsole.log(user.name);");
    expect(js('const { name, age } = user; console.log(name, age);')).toBe('const { name, age } = user;\nconsole.log(name, age);');
  });

  it('formats a callback body', () => {
    expect(formatCode('items.forEach((item) => { console.log(item); });', 'typescript')).toBe('items.forEach((item) => {\n  console.log(item);\n});');
  });

  it('leaves a single statement alone', () => {
    const code = 'const doubled = values.map((value) => value * 2);';
    expect(js(code)).toBe(code);
  });
});

describe('formatCode — what it must not touch', () => {
  it('returns code that is already on several lines exactly as it was', () => {
    const code = 'if x:\n  print(x)\r\nelse:\n    print(0)';
    expect(py(code)).toBe(code);
  });

  it('returns short snippets and other languages unchanged', () => {
    expect(py("print('hi')")).toBe("print('hi')");
    const sql = 'SELECT name FROM users WHERE age > 30; SELECT 1; SELECT 2;';
    expect(formatCode(sql, 'sql')).toBe(sql);
    const shell = 'cd project && npm install && npm run build && npm test';
    expect(formatCode(shell, 'bash')).toBe(shell);
  });

  it('returns the original when a string is not closed', () => {
    const code = "message = 'unfinished if x: y else: z and then some more text";
    expect(py(code)).toBe(code);
  });

  it('turns written-out line breaks into real ones only when there are no quotes', () => {
    expect(py('x = 1\\nif x:\\n    print(x)')).toBe('x = 1\nif x:\n    print(x)');
    const withString = "print('first line\\nsecond line\\nthird line')";
    expect(py(withString)).toBe(withString);
  });

  it('is idempotent', () => {
    for (const code of ["num = 5 if num > 0: print('Positive') else: print('Not positive')", 'try: value = int(text) except ValueError: value = 0']) {
      const once = py(code);
      expect(py(once)).toBe(once);
    }
    const once = js('if (ready) { run(); } else { stop(); }');
    expect(js(once)).toBe(once);
  });
});

describe('tidyCourse', () => {
  const course = (): Course => ({
    id: 'c',
    title: 'T',
    subtitle: '',
    objective: 'o',
    source: 'ai',
    modules: [
      {
        id: 'm1',
        title: 'M',
        topics: [
          {
            id: 't1',
            title: 'T',
            planet: 'Vega',
            kind: 'programming',
            summary: 's',
            lesson: {
              minutes: 3,
              objectives: [],
              simple: '',
              blocks: [{ type: 'code', language: 'python', code: "num = 5 if num > 0: print('Positive') else: print('Not positive')", caption: 'Prints a label.' }],
            },
            quiz: [{ type: 'code', q: 'Write it', language: 'python', solution: "if x: print('y') else: print('n')", checks: [{ label: 'has if', pattern: 'if' }], why: 'Because.' }],
          },
        ],
      },
    ],
  });

  it('puts a one-line code block on several lines but leaves code questions alone', () => {
    const topic = tidyCourse(course()).modules[0].topics[0];
    const block = topic.lesson.blocks[0];
    expect(block.type === 'code' && block.code).toBe("num = 5\nif num > 0:\n    print('Positive')\nelse:\n    print('Not positive')");
    const question = topic.quiz[0];
    expect(question.type === 'code' && question.solution).toBe("if x: print('y') else: print('n')");
  });

  it('is idempotent on code blocks', () => {
    const once = tidyCourse(course());
    expect(tidyCourse(once)).toEqual(once);
  });
});
