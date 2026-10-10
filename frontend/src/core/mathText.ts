/**
 * Turns simple LaTeX (as AI output and some templates write formulas) into readable Unicode text:
 * `L = -\sum_{i=1}^{N} y_i \log(\hat{y}_i)` → `L = -Σᵢ₌₁ᴺ yᵢ log(ŷᵢ)`. Plain formulas pass through unchanged.
 */
const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', eta: 'η', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Lambda: 'Λ', Theta: 'Θ',
  sum: 'Σ', prod: 'Π', int: '∫', partial: '∂', nabla: '∇', infty: '∞', cdot: '·', times: '×', div: '÷', pm: '±',
  leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', to: '→', rightarrow: '→', leftarrow: '←', in: '∈',
  forall: '∀', exists: '∃', ldots: '…', cdots: '⋯', top: 'ᵀ', quad: ' ', qquad: '  ', left: '', right: '',
};
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼',
  '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', T: 'ᵀ', N: 'ᴺ', k: 'ᵏ', l: 'ˡ', t: 'ᵗ', x: 'ˣ', '*': '*', "'": '′',
};
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌',
  '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', x: 'ₓ',
};

const script = (s: string, map: Record<string, string>) => ([...s].every((c) => map[c]) ? [...s].map((c) => map[c]).join('') : null);

export function prettyMath(src: string): string {
  if (!/[\\^_]/.test(src)) return src;
  let t = src;
  t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
  t = t.replace(/\\(?:mathbf|mathrm|mathit|text|operatorname|boldsymbol)\{([^{}]*)\}/g, '$1');
  t = t.replace(/\\hat\{(\w)\}/g, '$1̂').replace(/\\bar\{(\w)\}/g, '$1̄').replace(/\\vec\{(\w)\}/g, '$1⃗');
  t = t.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  t = t.replace(/\\[,;!]/g, ' ');
  t = t.replace(/\\([A-Za-z]+)/g, (_, w: string) => SYMBOLS[w] ?? w);
  t = t.replace(/\^\{([^{}]*)\}|\^(\S)/g, (_, a: string | undefined, b: string | undefined) => {
    const v = a ?? b ?? '';
    return script(v, SUP) ?? `^(${v})`;
  });
  t = t.replace(/_\{([^{}]*)\}|_(\w)/g, (_, a: string | undefined, b: string | undefined) => {
    const v = a ?? b ?? '';
    return script(v, SUB) ?? `_${v}`;
  });
  return t.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}
