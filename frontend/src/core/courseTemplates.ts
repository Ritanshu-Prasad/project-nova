import type { Block, Course, Level, Module, Question, Topic, TopicKind, Panel } from './courseSchema';
import { makeId } from './courseSchema';

/**
 * Built-in course templates (used until the AI backend generates courses) plus a generic starter plan
 * for any other goal. Everything is expressed in the structured schema, so the UI renders AI output the same way.
 */

const mcq = (q: string, options: string[], why: string, difficulty = 1): Question => ({ type: 'mcq', q, options, answer: 0, why, difficulty });
const multi = (q: string, options: string[], answers: number[], why: string, difficulty = 2): Question => ({ type: 'multi', q, options, answers, why, difficulty });
const tf = (q: string, answer: boolean, why: string, difficulty = 1): Question => ({ type: 'truefalse', q, answer, why, difficulty });
const fill = (q: string, answer: string, why: string, accept: string[] = [], difficulty = 2): Question => ({ type: 'fill', q, answer, accept, why, difficulty });
/** Write-code question: each check is [label, regex source] matched against the pilot's code. */
const code = (q: string, language: string, solution: string, checks: [string, string][], why: string, starter?: string, difficulty = 3): Question => ({
  type: 'code',
  q,
  language,
  starter,
  solution,
  checks: checks.map(([label, pattern]) => ({ label, pattern })),
  why,
  difficulty,
});

const terms = (...t: [string, string][]): Block => ({ type: 'keyTerms', terms: t.map(([term, def]) => ({ term, def })) });

/** Write-the-code questions for topics where code is the skill. */
const CODE_QS: Record<string, Question[]> = {
  'ai-1': [
    code(
      'Write neuron(x, w, b): the weighted sum of inputs x and weights w, plus the bias b (before any activation).',
      'python',
      'def neuron(x, w, b):\n    return sum(xi * wi for xi, wi in zip(x, w)) + b',
      [
        ['Defines neuron(x, w, b)', String.raw`def\s+neuron\s*\(\s*x\s*,\s*w\s*,\s*b\s*\)`],
        ['Multiplies inputs by weights', String.raw`\*|dot\(|@`],
        ['Adds the bias', String.raw`\+\s*b\b|\bb\s*\+`],
        ['Returns the result', String.raw`\breturn\b`],
      ],
      'A neuron is a weighted sum plus a bias: w·x + b.',
      'def neuron(x, w, b):\n    ',
      2,
    ),
  ],
  'ai-2': [
    code(
      'Write step(w, grad, lr): one gradient-descent update that returns the new weight.',
      'python',
      'def step(w, grad, lr):\n    return w - lr * grad',
      [
        ['Defines step(w, grad, lr)', String.raw`def\s+step\s*\(\s*w\s*,\s*grad\s*,\s*lr\s*\)`],
        ['Moves against the gradient', String.raw`w\s*-\s*lr\s*\*\s*grad|w\s*-\s*grad\s*\*\s*lr|w\s*-=`],
        ['Returns the new weight', String.raw`\breturn\b`],
      ],
      'Step against the gradient, scaled by the learning rate: w ← w − η·∂L/∂w.',
      'def step(w, grad, lr):\n    ',
      2,
    ),
  ],
  'react-1': [
    code(
      'Write a Panel component that takes title and children and renders the title in an <h2> above the children.',
      'tsx',
      'function Panel({ title, children }) {\n  return (\n    <section>\n      <h2>{title}</h2>\n      {children}\n    </section>\n  );\n}',
      [
        ['Receives title and children', String.raw`\{\s*(title\s*,\s*children|children\s*,\s*title)\s*\}`],
        ['Renders the title in an <h2>', String.raw`<h2[^>]*>\s*\{\s*title\s*\}\s*</h2>`],
        ['Renders the children', String.raw`\{\s*children\s*\}\s*(<|\))`],
      ],
      'Composition: the parent decides what goes inside by passing children.',
      'function Panel({ title, children }) {\n  return (\n    \n  );\n}',
      2,
    ),
  ],
  'react-2': [
    code(
      'Write a custom hook useToggle(initial) that returns [value, toggle], where toggle flips the value.',
      'tsx',
      'function useToggle(initial = false) {\n  const [value, setValue] = useState(initial);\n  const toggle = () => setValue((v) => !v);\n  return [value, toggle];\n}',
      [
        ['Named useToggle', String.raw`(function|const)\s+useToggle\b`],
        ['Keeps state with useState', String.raw`useState\s*\(`],
        ['Flips the value', String.raw`!\s*\w+`],
        ['Returns [value, toggle]', String.raw`return\s*\[`],
      ],
      'A custom hook is a function starting with “use” that calls other hooks and returns what callers need.',
      'function useToggle(initial = false) {\n  \n}',
    ),
  ],
  'react-3': [
    code(
      'In a Badge component, read the current theme from ThemeContext and use it as the className of a <span>.',
      'tsx',
      'function Badge() {\n  const theme = useContext(ThemeContext);\n  return <span className={theme}>New</span>;\n}',
      [
        ['Calls useContext(ThemeContext)', String.raw`useContext\s*\(\s*ThemeContext\s*\)`],
        ['Uses it as the className', String.raw`className=\{\s*\w+\s*\}`],
      ],
      'useContext reads the nearest Provider’s value — no props needed.',
      'function Badge() {\n  \n}',
      2,
    ),
  ],
  'react-4': [
    code(
      'Memoise total so it is only recomputed when items changes.',
      'tsx',
      'const total = useMemo(\n  () => items.reduce((sum, i) => sum + i.price, 0),\n  [items],\n);',
      [
        ['Wraps the work in useMemo', String.raw`useMemo\s*\(\s*\(\s*\)\s*=>`],
        ['Depends on items', String.raw`\[\s*items\s*\]`],
      ],
      'useMemo caches a value and recomputes it only when a dependency changes.',
      'const total = items.reduce((sum, i) => sum + i.price, 0);',
      2,
    ),
  ],
  'la-1': [
    code(
      'Write dot(a, b): the dot product of two lists of the same length.',
      'python',
      'def dot(a, b):\n    return sum(x * y for x, y in zip(a, b))',
      [
        ['Defines dot(a, b)', String.raw`def\s+dot\s*\(\s*a\s*,\s*b\s*\)`],
        ['Pairs up the entries', String.raw`zip\(|range\(|\[\s*i\s*\]`],
        ['Multiplies and sums', String.raw`sum\(|\+=`],
      ],
      'Multiply matching components and add them up.',
      'def dot(a, b):\n    ',
      2,
    ),
  ],
  'la-2': [
    code(
      'Write matvec(M, v): multiply a 2×2 matrix M (a list of rows) by a vector v of length 2.',
      'python',
      'def matvec(M, v):\n    return [row[0] * v[0] + row[1] * v[1] for row in M]',
      [
        ['Defines matvec(M, v)', String.raw`def\s+matvec\s*\(\s*M\s*,\s*v\s*\)`],
        ['Works row by row', String.raw`for\s+\w+\s+in\s+M|M\[\s*\w+\s*\]`],
        ['Returns a new vector', String.raw`return\s*\[|return\s+\w+`],
      ],
      'Each entry of the result is the dot product of a matrix row with the vector.',
      'def matvec(M, v):\n    ',
    ),
  ],
};

/** Topic-specific side-panel sections — each topic gets the ones that suit it (the AI backend sends its own). */
const PANELS: Record<string, Panel[]> = {
  'ai-5': [
    { title: 'Where it’s used', items: ['Search that understands meaning, not just keywords', 'Recommendations (“people who liked…”)', 'The first layer of every language model'] },
    { title: 'Memory trick', body: 'Embedding = an address on the meaning map. Similar meaning, similar address.' },
  ],
  'ai-6': [
    { title: 'Common mistakes', items: ['Judging a model by training accuracy alone', 'Tuning on the test set', 'Adding layers when the real fix is more data'] },
    { title: 'Try this', body: 'Plot training and validation loss on one chart — the moment they split is where overfitting begins.' },
  ],
  'la-5': [
    { title: 'Before you start', items: ['Adding and scaling vectors (topic 1.1)'] },
    { title: 'Common mistakes', items: ['Thinking any two vectors span the plane — parallel ones don’t', 'Forgetting the zero vector is always in the span'] },
  ],
  'ai-1': [
    { title: 'Common mistakes', items: ['Thinking more layers always means a smarter network', 'Forgetting the bias term', 'Using a linear activation everywhere'] },
    { title: 'Where it’s used', items: ['Image recognition in your phone’s camera', 'Spam filters', 'Speech-to-text'] },
  ],
  'ai-2': [
    { title: 'Common mistakes', items: ['Learning rate too high — the loss explodes', 'Reading one noisy batch as a trend', 'Forgetting to zero the gradients between steps'] },
    { title: 'Memory trick', body: 'Gradient points uphill, so we step against it: minus sign, small step, repeat.' },
    { title: 'Before you start', items: ['What a derivative measures', 'Weights and biases (topic 1.1)'] },
  ],
  'ai-3': [
    { title: 'Before you start', items: ['The chain rule from calculus', 'One step of gradient descent (topic 1.2)'] },
    { title: 'Common mistakes', items: ['Mixing up the forward and backward passes', 'Assuming backprop is a learning algorithm by itself — it only computes gradients'] },
  ],
  'ai-4': [
    { title: 'Where it’s used', items: ['ChatGPT-style chat assistants', 'Machine translation', 'Protein structure prediction'] },
    { title: 'Memory trick', body: 'Query asks, keys answer “how relevant am I?”, values carry the actual content.' },
    { title: 'Common mistakes', items: ['Forgetting positional information', 'Thinking attention reads tokens one by one — it looks at all of them at once'] },
  ],
  'react-1': [
    { title: 'Common mistakes', items: ['Deep inheritance chains between components', 'Giant components that do everything'] },
    { title: 'Try this', body: 'Split a card into Card, CardHeader and CardBody, then reuse them on two screens.' },
  ],
  'react-2': [
    { title: 'Rules of hooks', items: ['Call hooks at the top level only', 'Only call them from components or other hooks', 'Name custom hooks with a “use” prefix'] },
    { title: 'Common mistakes', items: ['Calling a hook inside a condition or loop', 'Missing dependencies in useEffect'] },
  ],
  'react-3': [
    { title: 'When to use it', items: ['Theme, language, signed-in user', 'Data many distant components need'] },
    { title: 'Common mistakes', items: ['Putting fast-changing values in one big context', 'Reaching for context when passing a prop twice would do'] },
  ],
  'react-4': [
    { title: 'Common mistakes', items: ['Memoising everything “just in case”', 'Passing new objects or arrays as props every render', 'Forgetting dependencies'] },
    { title: 'Measure first', body: 'Open the React Profiler, find the slow render, then memoise exactly that.' },
  ],
  'la-1': [
    { title: 'Where it’s used', items: ['Game physics: velocity and forces', 'Word embeddings in AI', 'GPS and navigation'] },
    { title: 'Common mistakes', items: ['Adding vectors of different lengths', 'Confusing the dot product (a number) with a vector'] },
    { title: 'Memory trick', body: 'Dot product = “how much do these two point the same way?” Same way: big. Perpendicular: zero.' },
  ],
  'la-2': [
    { title: 'Before you start', items: ['Vectors and the dot product (topic 1.1)'] },
    { title: 'Common mistakes', items: ['Assuming AB = BA', 'Multiplying matrices whose sizes don’t match'] },
    { title: 'Where it’s used', items: ['Rotating and scaling images', '3D graphics in every video game', 'Every layer of a neural network'] },
  ],
  'la-3': [
    { title: 'Memory trick', body: 'Determinant = area scale factor. Zero means the shape got squashed flat.' },
    { title: 'Common mistakes', items: ['Forgetting the sign — a negative determinant means the space was flipped', 'Expecting a determinant for non-square matrices'] },
  ],
  'la-4': [
    { title: 'Before you start', items: ['Matrix–vector multiplication (topic 1.2)', 'Determinants (topic 2.1)'] },
    { title: 'Where it’s used', items: ['Google’s original PageRank', 'Principal component analysis (PCA)', 'Vibration analysis of bridges'] },
  ],
  'bio-1': [
    { title: 'Memory trick', body: 'Phospholipid = tadpole: water-loving head, water-fearing tails tucked inside.' },
    { title: 'Exam focus', items: ['Diffusion vs active transport', 'Why the membrane is “fluid mosaic”'] },
  ],
  'bio-2': [
    { title: 'Common mistakes', items: ['Thinking prokaryotes have a nucleus', 'Mixing up chromatin and chromosomes'] },
    { title: 'Exam focus', items: ['Role of nuclear pores', 'Where mRNA is made'] },
  ],
  'bio-3': [
    { title: 'Memory trick', body: 'Mitochondria: Most ATP. Folded cristae = more surface = more energy.' },
    { title: 'Where it’s used', items: ['Why muscles burn during sprints (anaerobic respiration)', 'Inherited mitochondrial diseases'] },
  ],
  'bio-4': [
    { title: 'Memory trick', body: 'PMAT: Prophase, Metaphase, Anaphase, Telophase. Meiosis does it twice.' },
    { title: 'Common mistakes', items: ['Mitosis makes identical cells; meiosis makes four different ones', 'Crossing over happens in meiosis only'] },
  ],
};

function topic(
  id: string,
  title: string,
  planet: string,
  kind: TopicKind,
  summary: string,
  lesson: { minutes: number; objectives: string[]; simple: string; blocks: Block[] },
  quiz: Question[],
): Topic {
  return { id, title, planet, kind, summary, lesson: { ...lesson, panels: PANELS[id] }, quiz: [...quiz, ...(CODE_QS[id] ?? [])] };
}

interface Template {
  id: string;
  title: string;
  subtitle: string;
  match: RegExp;
  modules: Module[];
}

const TEMPLATES: Template[] = [
  {
    id: 'ai',
    title: 'Neural Networks to Transformers',
    subtitle: 'From a single neuron to self-attention',
    match: /neural|transformer|machine learning|deep learning|\bai\b|\bml\b|llm|attention|gpt/i,
    modules: [
      {
        id: 'ai-m1',
        title: 'How networks learn',
        topics: [
          topic('ai-1', 'Neurons & layers', 'Perceptra', 'concept', 'The building blocks of every neural network.', {
            minutes: 6,
            objectives: ['Describe what a single neuron computes', 'Explain why activation functions matter'],
            simple: 'Each neuron is a tiny voter: it weighs its inputs, adds them up and decides how strongly to pass the signal on.',
            blocks: [
              { type: 'text', title: 'The idea', body: 'A neural network is built from simple units called neurons. Each neuron multiplies its inputs by weights, adds a bias and passes the result through an activation function.\n\nStacking neurons into layers lets the network learn increasingly abstract features — edges, then shapes, then whole objects.' },
              { type: 'formula', expr: 'y = f(w · x + b)', caption: 'A neuron: weighted sum, plus bias, through an activation f.' },
              terms(['Weight', 'How strongly an input influences the neuron.'], ['Bias', 'A learned offset added before the activation.'], ['Activation', 'A non-linear function such as ReLU or sigmoid.']),
              { type: 'analogy', body: 'Think of a panel of judges: each input is a judge, the weight is how much you trust them, and the activation decides whether the verdict is loud enough to pass on.' },
              { type: 'callout', tone: 'fact', body: 'Without non-linear activations, any stack of layers collapses into one linear function.' },
              { type: 'summary', points: ['Neurons compute a weighted sum plus bias', 'Activations add non-linearity', 'Layers build features step by step'] },
            ],
          }, [
            mcq('What does an activation function add to a neural network?', ['Non-linearity', 'More training data', 'Faster disk access', 'A bias term'], 'Without non-linear activations, stacked layers collapse into one linear function.'),
            fill('A neuron computes w·x + b. The b term is called the ____.', 'bias', 'b is the bias — a learned offset added before the activation.'),
            tf('Adding more layers without activation functions makes a network more expressive.', false, 'Linear layers compose into a single linear layer, so depth adds nothing without non-linearity.'),
          ]),
          topic('ai-2', 'Learning with gradients', 'Gradia', 'math', 'How training nudges weights downhill on the loss.', {
            minutes: 7,
            objectives: ['Define a loss function', 'Explain one step of gradient descent', 'Pick a sensible learning rate'],
            simple: 'Walking downhill in fog: feel the slope under your feet and take a small step down, again and again.',
            blocks: [
              { type: 'text', title: 'Training is optimisation', body: 'Training means adjusting the weights to reduce a loss — a number measuring how wrong the predictions are. Gradient descent nudges every weight a small step in the direction that lowers the loss.' },
              { type: 'formula', expr: 'w ← w − η · ∂L/∂w', caption: 'Update rule: η is the learning rate, ∂L/∂w the gradient of the loss.' },
              { type: 'steps', title: 'One training step', steps: ['Run a batch through the network (forward pass)', 'Measure the loss', 'Compute gradients (backpropagation)', 'Move each weight against its gradient'] },
              { type: 'compare', title: 'Learning rate', columns: ['Too small', 'Too large'], rows: [['Speed', 'Painfully slow progress', 'Fast but unstable'], ['Loss curve', 'Smooth, slow decline', 'Bounces or explodes'], ['Fix', 'Increase gradually', 'Lower it or use a schedule']] },
              { type: 'callout', tone: 'tip', body: 'Plot the loss every few steps — a curve that zig-zags upward usually means the learning rate is too high.' },
              { type: 'summary', points: ['Loss measures error', 'Gradients point uphill — step the other way', 'The learning rate sets the step size'] },
            ],
          }, [
            mcq('In gradient descent, the weights move…', ['Opposite to the gradient', 'Along the gradient', 'Randomly', 'Only when the loss is zero'], 'The gradient points uphill; stepping against it lowers the loss.'),
            mcq('What usually happens if the learning rate is far too high?', ['Training diverges or oscillates', 'Training becomes perfectly stable', 'The model gains layers', 'The loss is always zero'], 'Huge steps overshoot the minimum, so the loss bounces around or explodes.', 2),
            fill('In the update w ← w − η·∂L/∂w, the symbol η is the learning ____.', 'rate', 'η (eta) is the learning rate — the size of each step.'),
          ]),
        ],
      },
      {
        id: 'ai-m2',
        title: 'Modern architectures',
        topics: [
          topic('ai-3', 'Backpropagation', 'Backprop Prime', 'math', 'Computing every gradient efficiently with the chain rule.', {
            minutes: 7,
            objectives: ['Distinguish the forward and backward pass', 'Explain the role of the chain rule'],
            simple: 'After a missed shot, the coach walks back through your motion and tells each part how to adjust.',
            blocks: [
              { type: 'text', title: 'Error flows backwards', body: 'After a forward pass produces a prediction, backpropagation sends the error back through the network layer by layer. The chain rule multiplies local derivatives, telling each weight exactly how much it contributed to the loss.' },
              { type: 'formula', expr: '∂L/∂w = ∂L/∂y · ∂y/∂z · ∂z/∂w', caption: 'The chain rule links the loss back to an individual weight.' },
              { type: 'compare', columns: ['Forward pass', 'Backward pass'], rows: [['Direction', 'Input → output', 'Output → input'], ['Produces', 'Prediction and loss', 'Gradients for every weight'], ['Reuses', 'Weights', 'Values cached in the forward pass']] },
              { type: 'example', title: 'Tiny example', body: 'If y = 3z and z = 2w, then ∂y/∂w = 3 × 2 = 6: nudging w by 0.01 moves y by about 0.06.' },
              { type: 'summary', points: ['Forward pass → prediction', 'Backward pass → gradients', 'The chain rule connects the layers'] },
            ],
          }, [
            mcq('Which rule of calculus makes backpropagation work?', ['The chain rule', 'The quotient rule', 'L’Hôpital’s rule', 'Simpson’s rule'], 'The chain rule multiplies local derivatives from the output back to the input.'),
            tf('The forward pass computes the gradients for every weight.', false, 'The forward pass computes outputs and the loss; gradients come from the backward pass.'),
            multi('Which are produced or used during the backward pass?', ['Gradients of the loss', 'Values cached in the forward pass', 'New training labels', 'A fresh random initialisation'], [0, 1], 'Backprop reuses forward-pass activations to compute gradients; it does not create labels or re-initialise weights.'),
          ]),
          topic('ai-4', 'Attention & Transformers', 'Attentia', 'concept', 'Letting every token look at every other token.', {
            minutes: 8,
            objectives: ['Explain queries, keys and values', 'Say why attention scores are scaled'],
            simple: 'When reading a sentence, attention is the model deciding which other words matter most for each word.',
            blocks: [
              { type: 'text', title: 'Self-attention', body: 'Transformers process a whole sequence at once. Self-attention lets every token score its relevance to every other token: queries meet keys to produce weights, and those weights mix the values into context-aware representations.' },
              { type: 'formula', expr: 'Attention(Q, K, V) = softmax(Q·Kᵀ / √dₖ) · V', caption: 'Scaled dot-product attention.' },
              terms(['Query', 'What a token is looking for.'], ['Key', 'What a token offers to others.'], ['Value', 'The information that gets mixed in.']),
              { type: 'steps', title: 'Inside one attention head', steps: ['Project each token into Q, K and V', 'Score every query against every key', 'Scale and softmax the scores into weights', 'Blend the values with those weights'] },
              { type: 'callout', tone: 'tip', body: 'Multi-head attention runs several heads in parallel so the model can track different relationships at once.' },
              { type: 'summary', points: ['Queries × keys → scores', 'Softmax → weights', 'Weighted values → context'] },
            ],
          }, [
            mcq('In self-attention, relevance scores come from comparing…', ['Queries with keys', 'Values with labels', 'Keys with the loss', 'Tokens with pixels'], 'Each query is compared with every key (a dot product) to score relevance.'),
            mcq('Why are attention scores scaled by 1/√dₖ?', ['To keep softmax from saturating', 'To make the model smaller', 'To remove the bias', 'To sort the tokens'], 'Large dot products push softmax into flat regions; scaling keeps gradients healthy.', 3),
            fill('Scores are turned into weights with the ____ function.', 'softmax', 'Softmax converts raw scores into positive weights that sum to 1.', ['soft max', 'soft-max']),
          ]),
        ],
      },
    ],
  },
  {
    id: 'react',
    title: 'Advanced React Patterns',
    subtitle: 'Composition, hooks, context and performance',
    match: /react|hook|component|jsx|frontend|next\.?js/i,
    modules: [
      {
        id: 'react-m1',
        title: 'Building blocks',
        topics: [
          topic('react-1', 'Composition over inheritance', 'Componentia', 'programming', 'Assemble UIs from small, swappable pieces.', {
            minutes: 6,
            objectives: ['Use children and props as slots', 'Prefer composition to inheritance'],
            simple: 'Build with LEGO bricks: small pieces snapped together, not one giant mould.',
            blocks: [
              { type: 'text', body: 'React favours composing small components. Pass UI in as children or props instead of building deep inheritance chains — components stay flexible, testable and reusable.' },
              { type: 'code', language: 'tsx', code: 'function Card({ title, children }: { title: string; children: React.ReactNode }) {\n  return (\n    <section className="card">\n      <h2>{title}</h2>\n      {children}\n    </section>\n  );\n}\n\n<Card title="Today">\n  <TaskList />\n</Card>', caption: 'Card renders whatever is nested inside it.' },
              terms(['children', 'Whatever is nested between a component’s tags.'], ['Slot prop', 'A prop that accepts JSX, e.g. header or footer.']),
              { type: 'callout', tone: 'tip', body: 'If you reach for “extends”, try passing a component or element as a prop instead.' },
              { type: 'summary', points: ['Compose with children', 'Use props as named slots', 'Keep components small'] },
            ],
          }, [
            mcq('Which prop lets a component render whatever is nested between its tags?', ['children', 'nested', 'slot', 'inner'], 'Anything between a component’s opening and closing tags arrives as props.children.'),
            tf('React recommends class inheritance for sharing UI between components.', false, 'React recommends composition through props and children.'),
            fill('A prop that accepts JSX, like header or footer, acts as a named ____.', 'slot', 'Props that take elements work as named slots.'),
          ]),
          topic('react-2', 'Custom hooks', 'Hookara', 'programming', 'Share stateful logic without sharing markup.', {
            minutes: 7,
            objectives: ['Write a custom hook', 'Follow the Rules of Hooks'],
            simple: 'A custom hook is a recipe card for behaviour that any component can follow.',
            blocks: [
              { type: 'text', body: 'Custom hooks extract stateful logic into reusable functions whose names start with “use”. They can call other hooks, so components share behaviour without sharing markup.' },
              { type: 'code', language: 'tsx', code: 'function useOnline() {\n  const [online, setOnline] = useState(navigator.onLine);\n  useEffect(() => {\n    const on = () => setOnline(true);\n    const off = () => setOnline(false);\n    window.addEventListener("online", on);\n    window.addEventListener("offline", off);\n    return () => {\n      window.removeEventListener("online", on);\n      window.removeEventListener("offline", off);\n    };\n  }, []);\n  return online;\n}', caption: 'Any component can now call useOnline().' },
              { type: 'steps', title: 'Rules of Hooks', steps: ['Only call hooks at the top level', 'Only call them from components or other hooks', 'Name custom hooks starting with “use”'] },
              { type: 'summary', points: ['Hooks share logic, not UI', 'Name them use…', 'Keep the call order stable'] },
            ],
          }, [
            mcq('A custom hook’s name must start with…', ['use', 'hook', 'with', 'get'], 'The “use” prefix lets React and linters enforce the Rules of Hooks.'),
            multi('Where may hooks be called?', ['At the top level of a component', 'At the top level of a custom hook', 'Inside a for-loop', 'Inside an if-statement'], [0, 1], 'Hooks must run in the same order on every render, so call them only at the top level of components or hooks.'),
            tf('A custom hook can call other hooks such as useState.', true, 'That is exactly what makes custom hooks useful.'),
          ]),
        ],
      },
      {
        id: 'react-m2',
        title: 'State & performance',
        topics: [
          topic('react-3', 'Context & lifting state', 'Contextor', 'programming', 'Share data across the tree without prop drilling.', {
            minutes: 6,
            objectives: ['Lift state to a common parent', 'Know when to reach for Context'],
            simple: 'Instead of passing a note hand-to-hand down a line, pin it on a noticeboard everyone can read.',
            blocks: [
              { type: 'text', body: 'When siblings need the same data, lift the state to their closest common parent. For data needed deep in the tree, Context provides it without prop drilling — but every consumer re-renders when the value changes.' },
              { type: 'code', language: 'tsx', code: 'const Theme = createContext("dark");\n\nfunction App() {\n  return (\n    <Theme.Provider value="light">\n      <Toolbar />\n    </Theme.Provider>\n  );\n}\n\nfunction Button() {\n  const theme = useContext(Theme);\n  return <button className={theme}>Save</button>;\n}' },
              { type: 'compare', columns: ['Lift state up', 'Context'], rows: [['Best for', 'A few nearby siblings', 'Data used deep in the tree'], ['Cost', 'Some prop passing', 'All consumers re-render on change']] },
              { type: 'summary', points: ['Lift state up first', 'Context avoids prop drilling', 'Consumers re-render on change'] },
            ],
          }, [
            mcq('What problem does Context mainly solve?', ['Prop drilling', 'Slow network requests', 'CSS conflicts', 'Large bundle size'], 'Context hands data to deep components without threading props through every level.'),
            mcq('Two sibling components need the same state. Where should it live?', ['In their closest common parent', 'In each sibling separately', 'In a global variable', 'In localStorage'], 'Lifting state to the common parent gives both siblings one source of truth.'),
            tf('Every component that reads a Context re-renders when its value changes.', true, 'Context consumers re-render whenever the provided value changes.', 2),
          ]),
          topic('react-4', 'Memoisation', 'Memora', 'programming', 'Skip work that does not need repeating.', {
            minutes: 6,
            objectives: ['Choose between useMemo, useCallback and React.memo', 'Measure before optimising'],
            simple: 'Memoisation is remembering an answer so you don’t redo the sum when nothing changed.',
            blocks: [
              { type: 'text', body: 'useMemo caches a computed value and useCallback caches a function between renders, recomputing only when dependencies change. React.memo skips re-rendering a component whose props are unchanged.' },
              { type: 'code', language: 'tsx', code: 'const sorted = useMemo(() => sortBig(list), [list]);\nconst onSelect = useCallback((id: string) => setActive(id), []);\nexport default React.memo(Row);' },
              terms(['useMemo', 'Caches a computed value.'], ['useCallback', 'Caches a function.'], ['React.memo', 'Skips a component re-render when props are equal.']),
              { type: 'callout', tone: 'warning', body: 'Memoisation has a cost too — profile first and memoise only what is measurably slow.' },
              { type: 'summary', points: ['useMemo → values', 'useCallback → functions', 'React.memo → components'] },
            ],
          }, [
            mcq('Which hook memoises a computed value?', ['useMemo', 'useCallback', 'useRef', 'useEffect'], 'useMemo returns a cached value until one of its dependencies changes.'),
            mcq('React.memo skips a re-render when…', ['Props are shallowly equal', 'State changes', 'Context changes', 'The parent unmounts'], 'React.memo shallow-compares props; state or context changes still re-render.', 2),
            fill('To cache a function between renders, use use____.', 'Callback', 'useCallback returns the same function until its dependencies change.', ['callback', 'usecallback']),
          ]),
        ],
      },
    ],
  },
  {
    id: 'linalg',
    title: 'Linear Algebra Basics',
    subtitle: 'Vectors, matrices and what they do to space',
    match: /linear|algebra|matri|vector|eigen|determinant/i,
    modules: [
      {
        id: 'la-m1',
        title: 'Objects',
        topics: [
          topic('la-1', 'Vectors', 'Vectoria', 'math', 'Arrows with magnitude and direction.', {
            minutes: 5,
            objectives: ['Add and scale vectors', 'Compute a dot product'],
            simple: 'A vector is an arrow: how far, and which way.',
            blocks: [
              { type: 'text', body: 'A vector is an ordered list of numbers describing magnitude and direction. Add vectors component by component, and scale one by multiplying every component. The dot product measures how aligned two vectors are.' },
              { type: 'formula', expr: 'a · b = a₁b₁ + a₂b₂ + … + aₙbₙ', caption: 'Dot product.' },
              { type: 'example', title: 'Worked example', body: '(1, 2) + (3, 4) = (4, 6).  (1, 2) · (3, 4) = 1×3 + 2×4 = 11.' },
              { type: 'callout', tone: 'fact', body: 'Perpendicular vectors have a dot product of exactly zero.' },
              { type: 'summary', points: ['Add component-wise', 'Scale every component', 'Dot product = alignment'] },
            ],
          }, [
            mcq('(1, 2) + (3, 4) = ?', ['(4, 6)', '(3, 8)', '(4, 8)', '(2, 2)'], 'Add component by component: 1 + 3 and 2 + 4.'),
            fill('The dot product of (1, 0) and (0, 1) is ____.', '0', '1·0 + 0·1 = 0 — perpendicular vectors.', ['zero']),
            tf('Scaling a vector by 2 doubles its length.', true, 'Every component doubles, so the length doubles too.'),
          ]),
          topic('la-2', 'Matrices', 'Matrixa', 'math', 'Machines that transform vectors.', {
            minutes: 6,
            objectives: ['Multiply a matrix by a vector', 'Check dimensions before multiplying'],
            simple: 'A matrix is a machine: an arrow goes in, a moved or stretched arrow comes out.',
            blocks: [
              { type: 'text', body: 'A matrix is a grid of numbers that transforms vectors. Multiplying a matrix by a vector combines the matrix’s columns, weighted by the vector’s entries. The identity matrix leaves every vector unchanged.' },
              { type: 'formula', expr: '(m×n) · (n×1) = (m×1)', caption: 'Inner dimensions must match.' },
              { type: 'steps', title: 'Matrix × vector', steps: ['Check the inner dimensions match', 'Multiply each row by the vector (dot product)', 'Each result becomes one entry of the output'] },
              { type: 'summary', points: ['Columns get combined', 'Inner dimensions must match', 'Identity changes nothing'] },
            ],
          }, [
            mcq('A 2×3 matrix times a 3×1 vector gives a…', ['2×1 vector', '3×1 vector', '3×3 matrix', 'Single number'], 'The inner dimensions (3) cancel, leaving a 2×1 result.'),
            mcq('The identity matrix I satisfies I·v = …', ['v', '0', '2v', '−v'], 'The identity maps every vector to itself.'),
            tf('You can multiply a 2×3 matrix by a 2×1 vector.', false, 'The inner dimensions (3 and 2) do not match.', 2),
          ]),
        ],
      },
      {
        id: 'la-m2',
        title: 'Transformations',
        topics: [
          topic('la-3', 'Determinants', 'Determina', 'math', 'How much a matrix scales area.', {
            minutes: 6,
            objectives: ['Compute a 2×2 determinant', 'Link a zero determinant to invertibility'],
            simple: 'The determinant says how much a shape grows or shrinks after the matrix acts on it.',
            blocks: [
              { type: 'text', body: 'The determinant measures how a matrix scales area (or volume). A determinant of zero means the transformation squashes space into a lower dimension, so the matrix has no inverse.' },
              { type: 'formula', expr: 'det [[a, b], [c, d]] = ad − bc' },
              { type: 'example', title: 'Worked example', body: 'det [[2, 0], [0, 3]] = 2×3 − 0×0 = 6, so areas grow six-fold.' },
              { type: 'callout', tone: 'warning', body: 'A negative determinant means the transformation also flips orientation.' },
              { type: 'summary', points: ['Area scale factor', 'Zero → no inverse', 'Sign shows a flip'] },
            ],
          }, [
            mcq('The determinant of [[2, 0], [0, 3]] is…', ['6', '5', '0', '1'], 'ad − bc = 2×3 − 0 = 6.'),
            mcq('If det(A) = 0, then A is…', ['Not invertible', 'The identity', 'Always symmetric', 'Orthogonal'], 'A zero determinant collapses space, so no inverse can undo it.', 2),
            fill('For [[a, b], [c, d]] the determinant is ad − ____.', 'bc', 'det = ad − bc.', ['b*c', 'cb']),
          ]),
          topic('la-4', 'Eigenvectors', 'Eigenon', 'math', 'Directions a transformation only stretches.', {
            minutes: 7,
            objectives: ['State the eigenvector equation', 'Interpret an eigenvalue'],
            simple: 'Eigenvectors are the directions a transformation only stretches and never turns.',
            blocks: [
              { type: 'text', body: 'An eigenvector of A keeps its direction when transformed: Av = λv. The scalar λ is its eigenvalue — how much that direction is stretched or shrunk.' },
              { type: 'formula', expr: 'A v = λ v', caption: 'v ≠ 0 is an eigenvector, λ its eigenvalue.' },
              { type: 'example', body: 'For A = [[2, 0], [0, 3]], the x-axis is stretched by 2 and the y-axis by 3: eigenvalues 2 and 3.' },
              { type: 'summary', points: ['Av = λv', 'λ is the stretch', 'Direction is preserved'] },
            ],
          }, [
            mcq('If Av = 3v, the eigenvalue is…', ['3', 'v', 'A', '1/3'], 'The eigenvalue is the scalar multiplying v: λ = 3.'),
            tf('An eigenvector changes direction under its matrix.', false, 'By definition it keeps its direction and is only scaled.'),
            multi('Which are eigenvalues of [[2, 0], [0, 3]]?', ['2', '3', '5', '6'], [0, 1], 'A diagonal matrix’s eigenvalues are its diagonal entries.', 2),
          ]),
        ],
      },
    ],
  },
  {
    id: 'bio',
    title: 'Cellular Biology',
    subtitle: 'Inside the basic unit of life',
    match: /biolog|cell|dna|mitochond|organelle|gene/i,
    modules: [
      {
        id: 'bio-m1',
        title: 'Structure',
        topics: [
          topic('bio-1', 'The cell membrane', 'Membrana', 'science', 'The selective gate around every cell.', {
            minutes: 5,
            objectives: ['Describe the phospholipid bilayer', 'Name the jobs of membrane proteins'],
            simple: 'The membrane is the cell’s security gate, letting the right things in and out.',
            blocks: [
              { type: 'text', body: 'The plasma membrane is a phospholipid bilayer that controls what enters and leaves the cell. Proteins embedded in it act as channels, pumps and receptors.' },
              terms(['Phospholipid', 'A molecule with a water-loving head and water-fearing tails.'], ['Channel', 'A protein tunnel for specific ions or molecules.'], ['Receptor', 'A protein that detects signals from outside.']),
              { type: 'analogy', body: 'Picture a city wall with gates (channels), toll booths that spend energy (pumps) and doorbells (receptors).' },
              { type: 'summary', points: ['Phospholipid bilayer', 'Selective permeability', 'Proteins move and sense'] },
            ],
          }, [
            mcq('The cell membrane is mainly a…', ['Phospholipid bilayer', 'Cellulose wall', 'Protein crystal', 'Coil of DNA'], 'Two layers of phospholipids form the membrane’s flexible barrier.'),
            mcq('Which molecules form channels and pumps in the membrane?', ['Proteins', 'Only carbohydrates', 'Nucleic acids', 'Vitamins'], 'Membrane proteins move specific molecules across the bilayer.'),
            tf('Pumps can move substances against their concentration gradient using energy.', true, 'Active transport pumps use ATP to move molecules uphill.', 2),
          ]),
          topic('bio-2', 'The nucleus', 'Nucleon', 'science', 'Where the instructions live.', {
            minutes: 6,
            objectives: ['Trace DNA → mRNA → protein', 'Say where proteins are built'],
            simple: 'The nucleus is a library of instruction books; RNA is the photocopy taken to the factory.',
            blocks: [
              { type: 'text', body: 'The nucleus stores the cell’s DNA and controls gene expression. DNA is transcribed into messenger RNA, which leaves the nucleus to be translated into proteins by ribosomes.' },
              { type: 'steps', title: 'From gene to protein', steps: ['Transcription: DNA → mRNA (nucleus)', 'mRNA exits through nuclear pores', 'Translation: ribosomes read mRNA', 'Amino acids fold into a protein'] },
              { type: 'summary', points: ['DNA lives in the nucleus', 'Transcription makes mRNA', 'Ribosomes build proteins'] },
            ],
          }, [
            fill('Transcription copies DNA into ____.', 'mRNA', 'Transcription produces messenger RNA from a DNA template.', ['messenger rna', 'rna']),
            mcq('Where are proteins built?', ['Ribosomes', 'The nuclear membrane', 'Lysosomes', 'Vacuoles'], 'Ribosomes translate mRNA into chains of amino acids.'),
            tf('Translation happens inside the nucleus.', false, 'Translation happens at ribosomes in the cytoplasm (or on the rough ER).', 2),
          ]),
        ],
      },
      {
        id: 'bio-m2',
        title: 'Energy & division',
        topics: [
          topic('bio-3', 'Mitochondria & energy', 'Mitochondra', 'science', 'Power stations of the cell.', {
            minutes: 5,
            objectives: ['Explain what ATP is for', 'Link respiration to oxygen'],
            simple: 'Mitochondria are power stations that turn food into ATP, the cell’s energy currency.',
            blocks: [
              { type: 'text', body: 'Mitochondria produce most of the cell’s ATP through cellular respiration, using oxygen to break down glucose. They even carry their own small genome.' },
              { type: 'formula', expr: 'C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + ATP', caption: 'Aerobic respiration, overall.' },
              { type: 'callout', tone: 'fact', body: 'Mitochondrial DNA is usually inherited from the mother.' },
              { type: 'summary', points: ['ATP is energy currency', 'Respiration uses oxygen', 'Own small genome'] },
            ],
          }, [
            mcq('Mitochondria mainly produce…', ['ATP', 'DNA', 'Glucose', 'Cellulose'], 'Cellular respiration in mitochondria generates most of the cell’s ATP.'),
            mcq('Aerobic respiration in mitochondria requires…', ['Oxygen', 'Nitrogen gas', 'Sunlight', 'Only carbon dioxide'], 'Oxygen is the final electron acceptor in aerobic respiration.'),
            tf('Mitochondria have their own DNA.', true, 'They carry a small circular genome of their own.'),
          ]),
          topic('bio-4', 'Cell division', 'Divisia', 'science', 'Copies for growth, shuffles for diversity.', {
            minutes: 6,
            objectives: ['Contrast mitosis and meiosis'],
            simple: 'Mitosis makes copies; meiosis shuffles the deck to deal unique cards.',
            blocks: [
              { type: 'text', body: 'Mitosis produces two identical daughter cells for growth and repair. Meiosis produces four genetically different gametes with half the chromosome number.' },
              { type: 'compare', columns: ['Mitosis', 'Meiosis'], rows: [['Daughter cells', 'Two', 'Four'], ['Genetics', 'Identical', 'All different'], ['Chromosomes', 'Same number', 'Half the number'], ['Purpose', 'Growth & repair', 'Making gametes']] },
              { type: 'summary', points: ['Mitosis → 2 identical', 'Meiosis → 4 gametes', 'Gametes have half the chromosomes'] },
            ],
          }, [
            mcq('Mitosis produces…', ['Two identical cells', 'Four gametes', 'One larger cell', 'Two different gametes'], 'Mitosis copies the cell into two genetically identical daughters.'),
            fill('Gametes are made by ____.', 'meiosis', 'Meiosis halves the chromosome number to make gametes.'),
            multi('Which are true of meiosis?', ['It produces four cells', 'Daughter cells are genetically different', 'It doubles the chromosome number', 'It is used for wound repair'], [0, 1], 'Meiosis makes four genetically distinct cells with half the chromosomes.', 2),
          ]),
        ],
      },
    ],
  },
  {
    id: 'eng',
    title: 'English Essentials',
    subtitle: 'Grammar, punctuation, and clear communication',
    match: /english|grammar|language|writing|speaking|punctuation/i,
    modules: [
      {
        id: 'eng-m1',
        title: 'Grammar Fundamentals',
        topics: [
          topic('eng-1', 'Nouns and Verbs', 'Terra', 'language', 'The building blocks of every sentence.', {
            minutes: 5,
            objectives: ['Identify nouns and verbs', 'Understand subject-verb agreement'],
            simple: 'Nouns are the things, and verbs are the actions they do.',
            blocks: [
              { type: 'text', body: 'A sentence needs a subject (a noun or pronoun) and a predicate (a verb). The subject is the "who" or "what," and the verb tells what the subject does or is.' },
              terms(['Noun', 'A person, place, thing, or idea.'], ['Verb', 'An action or state of being.']),
              { type: 'example', body: 'In "The dog barks," "dog" is the noun and "barks" is the verb.' },
              { type: 'summary', points: ['Nouns are things', 'Verbs are actions', 'Subjects and verbs must agree'] }
            ]
          }, [
            mcq('What part of speech is an action word?', ['Verb', 'Noun', 'Adjective', 'Adverb'], 'A verb expresses action or a state of being.'),
            fill('A person, place, thing, or idea is a ____.', 'noun', 'Nouns represent the entities in a sentence.'),
            tf('Every complete sentence must have at least one verb.', true, 'A sentence without a verb is just a fragment.')
          ]),
          topic('eng-2', 'Punctuation Basics', 'Comma', 'language', 'Making sentences clear and readable.', {
            minutes: 5,
            objectives: ['Use commas and periods correctly', 'Understand sentence boundaries'],
            simple: 'Punctuation tells the reader when to pause and when to stop.',
            blocks: [
              { type: 'text', body: 'Periods end a complete thought. Commas separate items in a list, link clauses, and indicate brief pauses. Using them correctly prevents run-on sentences and confusion.' },
              { type: 'compare', columns: ['Punctuation', 'Purpose'], rows: [['Period (.)', 'Ends a declarative sentence', 'Full stop'], ['Comma (,)', 'Separates clauses or lists', 'Brief pause'], ['Question Mark (?)', 'Ends a question', 'Rising tone']] },
              { type: 'summary', points: ['Periods end thoughts', 'Commas add pauses', 'Punctuation creates clarity'] }
            ]
          }, [
            mcq('Which punctuation mark is used to separate items in a list?', ['Comma', 'Period', 'Question Mark', 'Exclamation Point'], 'Commas separate three or more items in a series.'),
            tf('A run-on sentence happens when two independent clauses are joined without proper punctuation.', true, 'Run-on sentences lack the necessary periods or conjunctions to separate distinct thoughts.', 2),
            fill('A ____ is used to indicate a full stop at the end of a sentence.', 'period', 'Periods mark the end of declarative sentences.')
          ])
        ]
      },
      {
        id: 'eng-m2',
        title: 'Effective Writing',
        topics: [
          topic('eng-3', 'Active Voice', 'Activa', 'language', 'Making your writing energetic and direct.', {
            minutes: 6,
            objectives: ['Identify active and passive voice', 'Rewrite passive sentences into active ones'],
            simple: 'Active voice puts the doer of the action first, making sentences punchier.',
            blocks: [
              { type: 'text', body: 'In the active voice, the subject performs the action. In the passive voice, the subject receives the action. Active writing is generally clearer and more direct.' },
              { type: 'compare', columns: ['Active Voice', 'Passive Voice'], rows: [['The chef cooked the meal.', 'The meal was cooked by the chef.', 'Clearer vs Wordy'], ['I made a mistake.', 'Mistakes were made.', 'Takes responsibility vs Avoids it']] },
              { type: 'summary', points: ['Active voice is direct', 'The subject does the action', 'Use passive voice sparingly'] }
            ]
          }, [
            mcq('Which sentence is in the active voice?', ['The cat chased the mouse.', 'The mouse was chased by the cat.', 'The ball was thrown.', 'The song was sung.'], 'In the active voice, the subject (the cat) performs the action (chased).'),
            tf('Passive voice is always grammatically incorrect.', false, 'Passive voice is grammatically correct and useful when the actor is unknown, but active voice is usually preferred for clarity.', 2),
            fill('When the subject performs the action, the sentence is in the ____ voice.', 'active', 'Active voice emphasizes the doer.')
          ])
        ]
      }
    ]
  }
];

/**
 * Course shape follows the subject's scope: bigger subjects get more modules, denser modules more topics.
 * Templates are regrouped here (topics can be shared across layouts); the AI backend sizes its own courses.
 */
const LAYOUTS: Record<string, { id: string; title: string; topics: string[] }[]> = {
  ai: [
    { id: 'ai-m1', title: '1. Vectors & Matrices for ML', topics: ['ai-gen-1', 'ai-gen-2'] },
    { id: 'ai-m2', title: '2. Calculus & Optimization', topics: ['ai-gen-3', 'ai-gen-4'] },
    { id: 'ai-m3', title: '3. Probabilities & Weights', topics: ['ai-gen-5', 'ai-gen-6'] },
    { id: 'ai-m4', title: '4. The Artificial Neuron', topics: ['ai-1', 'ai-2'] },
    { id: 'ai-m5', title: '5. Forward Propagation', topics: ['ai-3', 'ai-gen-7'] },
    { id: 'ai-m6', title: '6. Loss Functions Deep Dive', topics: ['ai-8', 'ai-gen-8'] },
    { id: 'ai-m7', title: '7. Backpropagation', topics: ['ai-7', 'ai-gen-9'] },
    { id: 'ai-m8', title: '8. Gradient Descent Variants', topics: ['ai-9', 'ai-gen-10'] },
    { id: 'ai-m9', title: '9. Regularization & Dropout', topics: ['ai-gen-11', 'ai-gen-12'] },
    { id: 'ai-m10', title: '10. Intro to Computer Vision', topics: ['ai-gen-13', 'ai-gen-14'] },
    { id: 'ai-m11', title: '11. Convolutional Filters', topics: ['ai-10', 'ai-gen-15'] },
    { id: 'ai-m12', title: '12. Pooling & Downsampling', topics: ['ai-11', 'ai-gen-16'] },
    { id: 'ai-m13', title: '13. Advanced CNNs (ResNet)', topics: ['ai-12', 'ai-gen-17'] },
    { id: 'ai-m14', title: '14. Sequential Data Basics', topics: ['ai-gen-18', 'ai-gen-19'] },
    { id: 'ai-m15', title: '15. Recurrent Neural Networks', topics: ['ai-13', 'ai-gen-20'] },
    { id: 'ai-m16', title: '16. LSTMs & Gates', topics: ['ai-14', 'ai-gen-21'] },
    { id: 'ai-m17', title: '17. Seq2Seq & The Bottleneck', topics: ['ai-15', 'ai-16'] },
    { id: 'ai-m18', title: '18. The Attention Mechanism', topics: ['ai-17', 'ai-18'] },
    { id: 'ai-m19', title: '19. The Transformer Architecture', topics: ['ai-19', 'ai-gen-22'] },
    { id: 'ai-m20', title: '20. LLMs & RLHF', topics: ['ai-20', 'ai-gen-23'] }
  ],
  react: [
    { id: 'react-m1', title: '1. The Virtual DOM', topics: ['react-gen-1', 'react-gen-2'] },
    { id: 'react-m2', title: '2. Fiber Architecture', topics: ['react-gen-3', 'react-gen-4'] },
    { id: 'react-m3', title: '3. Component Lifecycle', topics: ['react-gen-5', 'react-gen-6'] },
    { id: 'react-m4', title: '4. Hooks: useState & useEffect', topics: ['react-1', 'react-2'] },
    { id: 'react-m5', title: '5. Hooks: useRef & DOM', topics: ['react-3', 'react-gen-7'] },
    { id: 'react-m6', title: '6. Memoization & Performance', topics: ['react-4', 'react-gen-8'] },
    { id: 'react-m7', title: '7. Custom Hooks Architecture', topics: ['react-gen-9', 'react-gen-10'] },
    { id: 'react-m8', title: '8. Context API', topics: ['react-gen-11', 'react-gen-12'] },
    { id: 'react-m9', title: '9. Higher-Order Components', topics: ['react-gen-13', 'react-gen-14'] },
    { id: 'react-m10', title: '10. Render Props Pattern', topics: ['react-gen-15', 'react-gen-16'] },
    { id: 'react-m11', title: '11. Compound Components', topics: ['react-gen-17', 'react-gen-18'] },
    { id: 'react-m12', title: '12. State at Scale: Redux', topics: ['react-gen-19', 'react-gen-20'] },
    { id: 'react-m13', title: '13. State at Scale: Zustand', topics: ['react-gen-21', 'react-gen-22'] },
    { id: 'react-m14', title: '14. Server Components (RSC)', topics: ['react-gen-23', 'react-gen-24'] }
  ],
  linalg: [
    { id: 'la-m1', title: '1. Intro to Vectors', topics: ['la-1', 'la-5'] },
    { id: 'la-m2', title: '2. Dot Products & Angles', topics: ['la-17', 'la-gen-1'] },
    { id: 'la-m3', title: '3. Cross Products & Areas', topics: ['la-gen-2', 'la-gen-3'] },
    { id: 'la-m4', title: '4. Linear Combinations', topics: ['la-2', 'la-gen-4'] },
    { id: 'la-m5', title: '5. Span & Vector Spaces', topics: ['la-gen-5', 'la-gen-6'] },
    { id: 'la-m6', title: '6. Linear Independence', topics: ['la-6', 'la-gen-7'] },
    { id: 'la-m7', title: '7. Basis & Dimension', topics: ['la-gen-8', 'la-gen-9'] },
    { id: 'la-m8', title: '8. Matrices as Transformations', topics: ['la-3', 'la-7'] },
    { id: 'la-m9', title: '9. Matrix Multiplication', topics: ['la-8', 'la-gen-10'] },
    { id: 'la-m10', title: '10. Determinants', topics: ['la-10', 'la-11'] },
    { id: 'la-m11', title: '11. Inverse Matrices', topics: ['la-9', 'la-gen-11'] },
    { id: 'la-m12', title: '12. Column & Null Space', topics: ['la-12', 'la-13'] },
    { id: 'la-m13', title: '13. Eigenvectors', topics: ['la-14', 'la-gen-12'] },
    { id: 'la-m14', title: '14. Eigenvalues', topics: ['la-4', 'la-gen-13'] },
    { id: 'la-m15', title: '15. Diagonalization', topics: ['la-15', 'la-gen-14'] },
    { id: 'la-m16', title: '16. Singular Value Decomposition', topics: ['la-20', 'la-gen-15'] }
  ],
  bio: [
    { id: 'bio-m1', title: '1. Chemistry of Life', topics: ['bio-gen-1', 'bio-gen-2'] },
    { id: 'bio-m2', title: '2. Macromolecules', topics: ['bio-gen-3', 'bio-gen-4'] },
    { id: 'bio-m3', title: '3. The Plasma Membrane', topics: ['bio-1', 'bio-gen-5'] },
    { id: 'bio-m4', title: '4. Passive & Active Transport', topics: ['bio-gen-6', 'bio-gen-7'] },
    { id: 'bio-m5', title: '5. The Nucleus & Ribosomes', topics: ['bio-2', 'bio-gen-8'] },
    { id: 'bio-m6', title: '6. Endomembrane System', topics: ['bio-gen-9', 'bio-gen-10'] },
    { id: 'bio-m7', title: '7. Cytoskeleton', topics: ['bio-gen-11', 'bio-gen-12'] },
    { id: 'bio-m8', title: '8. Thermodynamics in Biology', topics: ['bio-gen-13', 'bio-gen-14'] },
    { id: 'bio-m9', title: '9. Enzymes & Catalysis', topics: ['bio-gen-15', 'bio-gen-16'] },
    { id: 'bio-m10', title: '10. Cellular Respiration Basics', topics: ['bio-3', 'bio-gen-17'] },
    { id: 'bio-m11', title: '11. Krebs Cycle', topics: ['bio-gen-18', 'bio-gen-19'] },
    { id: 'bio-m12', title: '12. Electron Transport Chain', topics: ['bio-gen-20', 'bio-gen-21'] },
    { id: 'bio-m13', title: '13. Photosynthesis Basics', topics: ['bio-gen-22', 'bio-gen-23'] },
    { id: 'bio-m14', title: '14. DNA Structure', topics: ['bio-gen-24', 'bio-gen-25'] },
    { id: 'bio-m15', title: '15. DNA Replication', topics: ['bio-gen-26', 'bio-gen-27'] },
    { id: 'bio-m16', title: '16. Transcription', topics: ['bio-gen-28', 'bio-gen-29'] },
    { id: 'bio-m17', title: '17. Translation', topics: ['bio-gen-30', 'bio-gen-31'] },
    { id: 'bio-m18', title: '18. Cell Cycle & Mitosis', topics: ['bio-4', 'bio-gen-32'] }
  ],
  eng: [
    { id: 'eng-m1', title: '1. Nouns & Pronouns', topics: ['eng-1', 'eng-gen-1'] },
    { id: 'eng-m2', title: '2. Verbs & Tense', topics: ['eng-gen-2', 'eng-gen-3'] },
    { id: 'eng-m3', title: '3. Adjectives & Adverbs', topics: ['eng-gen-4', 'eng-gen-5'] },
    { id: 'eng-m4', title: '4. Prepositions & Conjunctions', topics: ['eng-gen-6', 'eng-gen-7'] },
    { id: 'eng-m5', title: '5. Subjects & Predicates', topics: ['eng-gen-8', 'eng-gen-9'] },
    { id: 'eng-m6', title: '6. Independent & Dependent Clauses', topics: ['eng-gen-10', 'eng-gen-11'] },
    { id: 'eng-m7', title: '7. Sentence Types', topics: ['eng-gen-12', 'eng-gen-13'] },
    { id: 'eng-m8', title: '8. Commas & Semicolons', topics: ['eng-2', 'eng-gen-14'] },
    { id: 'eng-m9', title: '9. Colons & Dashes', topics: ['eng-gen-15', 'eng-gen-16'] },
    { id: 'eng-m10', title: '10. Fixing Run-ons & Fragments', topics: ['eng-gen-17', 'eng-gen-18'] },
    { id: 'eng-m11', title: '11. Active vs Passive Voice', topics: ['eng-3', 'eng-gen-19'] },
    { id: 'eng-m12', title: '12. Paragraph Cohesion', topics: ['eng-gen-20', 'eng-gen-21'] }
  ]
};

/** Extra topics used by the layouts above. */
const EXTRA_TOPICS: Topic[] = [
  topic('ai-gen-1', 'Scalars, Vectors, and Tensors', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'In machine learning, data is represented mathematically. A scalar is a single number. A vector is a 1D array of numbers. A matrix is a 2D grid. A tensor is a generalization to n-dimensions. Most neural networks process data as multi-dimensional tensors.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-2', 'Linear Transformations', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'A neural network layer is fundamentally a linear transformation (y = Wx + b) followed by a non-linear activation. The weight matrix W scales and rotates the input vector x, projecting it into a new representational space.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-3', 'Derivatives and Gradients', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'To train a network, we need to know how changing a weight affects the error. The derivative tells us the slope of a function at a point. The gradient is simply a vector containing the partial derivatives for all weights in the network.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-4', 'The Chain Rule', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'Neural networks are nested functions: f(g(x)). To find the derivative of the loss with respect to the first layer, we use the chain rule from calculus. This is the mathematical foundation of backpropagation.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-5', 'Probability Distributions', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'Many ML models output probabilities. For example, a classifier doesn\'t just say \'Cat\'; it outputs a probability distribution (e.g., 90% Cat, 10% Dog). Softmax is the function used to convert raw scores (logits) into a valid probability distribution.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-6', 'Expected Value & Entropy', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'Cross-entropy loss measures the difference between two probability distributions: the model\'s prediction and the true label. Minimizing cross-entropy is equivalent to maximizing the likelihood of the training data under the model.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-7', 'Activation Functions: ReLU', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'Without activation functions, a deep neural network collapses into a single linear transformation. ReLU (Rectified Linear Unit) is f(x) = max(0, x). It is computationally cheap and helps prevent the vanishing gradient problem.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-8', 'Mean Squared Error vs Cross Entropy', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'For regression tasks (predicting a continuous number), Mean Squared Error (MSE) is the standard loss function. For classification tasks, Cross-Entropy is preferred because it penalizes confident wrong answers much more heavily.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-9', 'The Vanishing Gradient Problem', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'In very deep networks using Sigmoid or Tanh activations, the gradients can become infinitesimally small as they propagate backwards. This means the earliest layers never update their weights and stop learning.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-10', 'Stochastic Gradient Descent (SGD)', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'Instead of calculating the gradient over the entire massive dataset (which is too slow), SGD calculates the gradient on a small random \'batch\' of data. This introduces noise but drastically speeds up the optimization process.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-11', 'L1 and L2 Regularization', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'To prevent overfitting, we add a penalty to the loss function based on the size of the weights. L1 regularization (Lasso) forces many weights to become exactly zero, while L2 (Ridge) forces weights to be small but non-zero.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-12', 'Dropout', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'Dropout is a powerful regularization technique where, during training, random neurons are temporarily disabled (\'dropped out\') on each forward pass. This forces the network to learn robust, redundant representations rather than relying on a few specific neurons.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-13', 'Images as Tensors', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'A color image is represented as a 3D tensor: Height x Width x Channels (RGB). A batch of images is a 4D tensor (Batch x H x W x C). Convolutional networks are specifically designed to process this spatial grid structure efficiently.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-14', 'Strides and Padding', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'When applying a convolutional filter, \'stride\' determines how many pixels the filter moves at a time. \'Padding\' adds zeros around the border of the image to preserve the spatial dimensions after a convolution.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-15', '1x1 Convolutions', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'A 1x1 convolution looks at a single pixel across all channels. It is mathematically equivalent to a standard Dense layer applied to every pixel independently. It is primarily used to reduce the depth (number of channels) of a feature map.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-16', 'Global Average Pooling', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'Instead of flattening a massive spatial feature map into a 1D vector (which requires millions of parameters), Global Average Pooling takes the average value of each channel across the entire spatial dimensions. This drastically reduces overfitting.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-17', 'Residual Connections (ResNet)', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'In ultra-deep networks, adding layers actually degrades performance. ResNets solve this using \'skip connections\' (x + f(x)), allowing gradients to flow directly backwards through the network. This allowed networks to go from 20 layers to 152+ layers.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-18', 'Word Embeddings', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'Words cannot be fed directly into a neural network. Word embeddings (like Word2Vec) map discrete words into a continuous, dense vector space where semantic relationships are captured by geometric distances (e.g., King - Man + Woman = Queen).' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-19', 'The Problem with RNNs', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'RNNs process sequences step-by-step. This sequential nature prevents parallelization on GPUs, making them very slow to train. Furthermore, despite LSTMs, they struggle to retain information from the very beginning of a long sequence.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-20', 'Bidirectional RNNs', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'Sometimes, understanding a word requires context from the future. \'He swung the bat and hit the ball.\' To know \'bat\' is a sports item, you need to see \'hit the ball\'. Bidirectional RNNs process the sequence forwards and backwards simultaneously.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-21', 'LSTMs: Forget and Input Gates', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'An LSTM cell uses \'gates\' to control information flow. The Forget gate decides what past information to throw away. The Input gate decides what new information to add. This allows LSTMs to maintain a long-term memory state.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-22', 'Positional Encoding', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'Because Transformers do not process sequences step-by-step, they have no inherent concept of word order. Positional encodings are mathematical sine/cosine waves added to the word embeddings so the network knows the position of each word.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('ai-gen-23', 'RLHF: Alignment', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'formula', expr: 'L = -\\sum_{i=1}^{N} y_i \\log(\\hat{y}_i)' },
      { type: 'keyTerms', terms: [{ term: 'Gradient', def: 'The vector of partial derivatives.' }, { term: 'Loss', def: 'The penalty for a bad prediction.' }] },
      { type: 'text', body: 'Raw LLMs are just text predictors; they might generate toxic or useless text. Reinforcement Learning from Human Feedback (RLHF) uses human raters to score the model\'s outputs. A \'Reward Model\' learns these preferences, and PPO is used to fine-tune the LLM to maximize this reward.' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ]),
  topic('react-gen-1', 'The React Philosophy', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'React is fundamentally about UI as a pure function of state: UI = f(state). Instead of imperatively mutating the DOM (like jQuery), you declare what the UI should look like for any given state, and React handles the DOM updates.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-2', 'JSX: JavaScript XML', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'JSX looks like HTML but is syntactic sugar for React.createElement(). It allows you to embed JavaScript expressions directly into your markup using curly braces {}, combining rendering logic and markup in a single file.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-3', 'The Virtual DOM', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'Manipulating the real DOM is incredibly slow. React keeps a lightweight, in-memory representation of the DOM called the Virtual DOM. When state changes, React creates a new Virtual DOM tree and compares it to the old one.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-4', 'The Reconciliation Algorithm', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'The process of comparing the old and new Virtual DOM is called Reconciliation. React uses a heuristic O(n) algorithm. It assumes elements of different types produce different trees, and uses the \'key\' prop to track child elements across renders.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-5', 'React Fiber Architecture', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'Introduced in React 16, Fiber is a complete rewrite of the reconciliation engine. It breaks rendering work into chunks (fibers) that can be paused, aborted, or prioritized. This enables smooth UI rendering without blocking the main thread.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-6', 'Component Mounting', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'Mounting is the phase when a component is inserted into the DOM. In modern functional components, this happens when the component function is first executed, and any initial effects (useEffect with an empty dependency array) are fired.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-7', 'Understanding useEffect dependencies', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'The dependency array in useEffect tells React when to re-run the effect. If omitted, it runs on every render. If empty [], it runs only on mount. If it contains variables [x, y], the effect runs only when x or y change between renders.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-8', 'Cleanup Functions in useEffect', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'If your effect creates a subscription, timer, or event listener, it must return a cleanup function. React runs this cleanup function right before the component unmounts, or before re-running the effect due to changed dependencies, preventing memory leaks.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-9', 'The Rules of Hooks', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'Hooks must only be called at the top level of your component. Never call them inside loops, conditions, or nested functions. This rule is necessary because React relies on the call order of hooks to maintain state between renders.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-10', 'Custom Hooks', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'A custom hook is simply a JavaScript function whose name starts with \'use\' and that calls other hooks. They allow you to extract and reuse stateful logic across multiple components, adhering to the DRY principle without complex component hierarchies.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-11', 'Prop Drilling', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'Prop drilling occurs when you pass data through many layers of intermediate components that don\'t need the data themselves, just to reach a deeply nested child. It makes the intermediate components bloated and tightly coupled.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-12', 'The Context API', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'React Context provides a way to pass data through the component tree without having to pass props down manually at every level. It is ideal for global data like themes, user authentication status, or locale preferences.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-13', 'Higher-Order Components (HOCs)', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'An HOC is a function that takes a component and returns a new, enhanced component. While popular in class-component eras (e.g., connect() in Redux), they can lead to \'wrapper hell\' and have largely been superseded by Hooks.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-14', 'Render Props Pattern', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'The render props pattern involves passing a function as a prop to a component. The component calls this function to determine what to render, passing its internal state as an argument. This is another way to share stateful logic.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-15', 'Compound Components', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'Compound components are a pattern where two or more components work together to accomplish a useful task (like <select> and <option>). They often use Context implicitly to share state between the parent and child components without explicit prop passing.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-16', 'Controlled vs Uncontrolled Inputs', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'A controlled input has its value bound to React state (value={state} onChange={setState}). An uncontrolled input maintains its own internal DOM state, which you access using a ref. Controlled inputs are the React standard for forms.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-17', 'Memoization with React.memo', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'By default, when a parent component re-renders, all its children re-render. Wrapping a child in React.memo() tells React to skip rendering the child if its props haven\'t changed, performing a shallow comparison of the props.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-18', 'useMemo and useCallback', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'useMemo caches the result of an expensive calculation between renders. useCallback caches a function definition. They are crucial for maintaining referential equality of props passed to child components wrapped in React.memo.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-19', 'Redux Architecture', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'Redux uses a single, global immutable store. State can only be updated by dispatching an \'action\' object. Pure functions called \'reducers\' take the current state and the action, and return a completely new state object.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-20', 'Zustand & Modern State', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'Zustand is a modern, unopinionated state manager that uses hooks. It avoids the boilerplate of Redux (actions, reducers, providers) while still offering centralized state, transient updates, and devtools support.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-21', 'React Router Basics', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'React Router allows you to build single-page applications with client-side routing. The URL changes in the browser without requesting a new HTML document from the server, making navigation feel instantaneous.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-22', 'Suspense and Lazy Loading', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'React.lazy allows you to dynamically import a component file only when it\'s needed. You wrap the lazy component in a <Suspense> boundary, providing a \'fallback\' UI (like a spinner) while the network request fetches the component code.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-23', 'Server Components (RSC)', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'React Server Components run exclusively on the server and never ship their JavaScript to the client. They allow you to fetch data directly from the database during render, drastically reducing bundle size and improving initial load times.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('react-gen-24', 'Client vs Server Components', 'Reactis', 'concept', 'Advanced React patterns and mechanics.', {
    minutes: 6,
    objectives: ['Master advanced React patterns', 'Optimize component rendering'],
    simple: 'A deep dive into React architecture.',
    blocks: [
      { type: 'code', language: 'tsx', code: 'function Component() {\n  const [state, setState] = useState(0);\n  return <div onClick={() => setState(s => s+1)}>{state}</div>;\n}' },
      { type: 'keyTerms', terms: [{ term: 'State', def: 'Data that changes over time.' }, { term: 'Props', def: 'Read-only data passed from a parent.' }] },
      { type: 'text', body: 'In the modern app router (e.g., Next.js), you must explicitly mark Client Components with \'use client\' if they need interactivity (useState, onClick). Server components are the default and are best for static data and security.' },
      { type: 'summary', points: ['Core API', 'Architecture', 'Performance'] }
    ]
  }, [
    mcq('What is a key benefit of this React pattern?', ['It optimizes rendering and architecture.', 'It bypasses the Virtual DOM.', 'It turns JavaScript into HTML.', 'It disables the browser cache.'], 'Understanding patterns allows for scalable and performant React applications.'),
    tf('This pattern requires mutating the real DOM directly.', false, 'React strictly manages DOM updates via the Virtual DOM.')
  ]),
  topic('la-gen-1', 'Dot Product Geometric Interpretation', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'The dot product of two vectors tells you how much they point in the same direction. Geometrically, it is the length of the projection of vector A onto vector B, multiplied by the length of B. If they are perpendicular, the dot product is zero.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-2', 'The Cross Product', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'While the dot product yields a scalar, the cross product of two 3D vectors yields a new vector that is perfectly orthogonal (perpendicular) to both original vectors. Its length represents the area of the parallelogram formed by the two vectors.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-3', 'The Right-Hand Rule', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'To find the direction of a cross product (A x B), point your index finger in the direction of A and your middle finger in the direction of B. Your thumb will point in the direction of the resulting cross product vector.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-4', 'Linear Combinations', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'A linear combination involves multiplying a set of vectors by scalar numbers and adding the results together. The entire coordinate system you use every day (x, y) is just a linear combination of the basis vectors i-hat and j-hat.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-5', 'Span of Vectors', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'The \'span\' of a set of vectors is the set of all possible points you can reach through linear combinations of those vectors. Two non-parallel 2D vectors span the entire 2D plane. Two parallel 2D vectors only span a single 1D line.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-6', 'Linear Dependence', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'If you have a set of vectors, and one of them can be created by a linear combination of the others, that vector is redundant. The set is \'linearly dependent\'. It adds no new dimensions to your span.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-7', 'Basis Vectors', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'A \'basis\' for a vector space is a set of linearly independent vectors that span the entire space. It is the minimum number of vectors needed to describe every point in that space. For 3D space, you need exactly 3 basis vectors.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-8', 'Matrices as Transformations', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'Do not think of a matrix as just a grid of numbers. Think of it as a function that transforms space. When you multiply a vector by a matrix, you are stretching, rotating, or shearing the coordinate system itself.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-9', 'Tracking the Basis Vectors', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'To understand what a 2x2 matrix transformation does to 2D space, you only need to know where it sends the two basis vectors (i-hat and j-hat). The columns of the matrix literally tell you the new coordinates of i-hat and j-hat.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-10', 'Matrix Composition', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'Multiplying two matrices together (AB) is the geometric equivalent of applying transformation B, and then applying transformation A. Matrix multiplication is not commutative (AB != BA) because order matters when you rotate and shear space.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-11', 'The Identity Matrix', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'The Identity Matrix (1s on the diagonal, 0s elsewhere) is the matrix equivalent of the number 1. It represents a transformation that does absolutely nothing to the space. Multiplying any matrix by the Identity Matrix leaves it unchanged.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-12', 'Eigenvectors: The Unchanged', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'During a matrix transformation, most vectors get knocked off their original span. Eigenvectors are the special, rare vectors that stay on their exact original line after the transformation. They are only stretched or squished.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-13', 'Eigenvalues: The Scale Factor', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'If an eigenvector stays on its original line during a transformation, the eigenvalue is the scalar number representing how much it was stretched or squished. An eigenvalue of 2 means the eigenvector doubled in length. An eigenvalue of -1 means it flipped direction.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-14', 'Diagonalization', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'If a matrix has enough eigenvectors, you can change your coordinate system so the eigenvectors become the new basis vectors. In this new basis, the transformation matrix becomes diagonal, making calculations (like raising the matrix to a power) trivially easy.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('la-gen-15', 'Singular Value Decomposition', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'formula', expr: 'A \\mathbf{v} = \\lambda \\mathbf{v}' },
      { type: 'steps', steps: ['Define the basis vectors.', 'Apply the transformation matrix.', 'Observe the resulting vector space.'] },
      { type: 'text', body: 'SVD is the crown jewel of linear algebra. It proves that ANY matrix transformation can be broken down into three simple steps: a rotation, a scaling along the axes, and another rotation. This is widely used in data compression and machine learning.' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ]),
  topic('bio-gen-1', 'Water: The Solvent of Life', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Water is polar, meaning it has a partial positive charge on hydrogens and a partial negative charge on oxygen. This polarity allows it to form hydrogen bonds, making it an excellent solvent for other polar molecules and ions. Without water, cellular chemistry would halt.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-2', 'Carbon and Macromolecules', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Carbon\'s ability to form four covalent bonds makes it the backbone of life. It creates complex, diverse macromolecules like carbohydrates, lipids, proteins, and nucleic acids. These molecules are typically formed via dehydration synthesis reactions.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-3', 'Carbohydrates: Energy & Structure', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Carbohydrates (sugars) provide immediate energy and structural support. Glucose is the primary fuel for cells, while polysaccharides like cellulose provide structural integrity to plant cell walls, and glycogen stores energy in animals.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-4', 'Lipids: Membranes & Storage', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Lipids are hydrophobic molecules. Triglycerides store immense amounts of energy, while phospholipids form the fundamental bilayer of all cellular membranes. Steroids, like cholesterol, maintain membrane fluidity and act as signaling hormones.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-5', 'The Fluid Mosaic Model', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'The plasma membrane is a \'fluid mosaic\' of phospholipids, cholesterol, and proteins. It is not rigid; lipids and proteins constantly drift laterally. This flexibility is crucial for cell division, shape changes, and vesicle fusion.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-6', 'Simple vs Facilitated Diffusion', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Diffusion is the passive movement of molecules down their concentration gradient. Small, nonpolar molecules (like O2) simply slip through the membrane. Polar molecules or ions require \'facilitated diffusion\' via specific protein channels to cross the hydrophobic core.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-7', 'Active Transport & Pumps', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'When a cell needs to move substances against their gradient (from low to high concentration), it requires energy (ATP). The Sodium-Potassium pump is a classic example, using ATP to maintain vital electrochemical gradients across the membrane.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-8', 'The Nucleus: Command Center', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'The nucleus houses the cell\'s genetic material (DNA). It is enclosed by a double membrane called the nuclear envelope, punctuated by pores that regulate the entry and exit of RNA and proteins. The nucleolus, inside the nucleus, synthesizes ribosomes.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-9', 'Ribosomes: Protein Factories', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Ribosomes are complexes of rRNA and proteins that translate messenger RNA (mRNA) into polypeptide chains. They can be free-floating in the cytoplasm (making proteins for the cell\'s own use) or bound to the Endoplasmic Reticulum (for secreted proteins).' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-10', 'The Endoplasmic Reticulum', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'The ER is a massive network of membranous tubules. Rough ER (studded with ribosomes) synthesizes and folds proteins destined for membranes or secretion. Smooth ER lacks ribosomes and synthesizes lipids, detoxifies poisons, and stores calcium.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-11', 'The Golgi Apparatus', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'The Golgi is the cell\'s shipping and receiving center. It consists of flattened sacs called cisternae. Proteins arriving from the ER are modified (e.g., glycosylated), sorted, and packaged into transport vesicles bound for their final destinations.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-12', 'Lysosomes: Cellular Digestion', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Lysosomes are acidic sacs containing hydrolytic enzymes. They digest food particles, destroy invading viruses, and recycle damaged organelles in a process called autophagy. Without lysosomes, cellular waste would accumulate fatally.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-13', 'Microtubules & Microfilaments', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'The cytoskeleton provides structural support and motility. Microtubules are thick, hollow tubes acting as tracks for motor proteins and pulling chromosomes apart during division. Microfilaments (actin) are thin strands vital for cell contraction and shape.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-14', 'Enzyme Thermodynamics', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Enzymes do not alter the overall thermodynamics (Delta G) of a reaction; they only lower the activation energy required to start it. They achieve this by binding substrates at their active site, orienting them perfectly to facilitate the chemical reaction.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-15', 'Enzyme Inhibition', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Competitive inhibitors mimic the substrate and block the active site directly. Non-competitive (allosteric) inhibitors bind elsewhere, changing the enzyme\'s shape so the active site no longer functions. This is a common mechanism for feedback inhibition.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-16', 'ATP: The Cellular Currency', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Adenosine Triphosphate (ATP) stores energy in its unstable phosphate bonds. When the terminal phosphate is hydrolyzed (forming ADP), energy is released to power cellular work, such as active transport, muscle contraction, or chemical synthesis.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-17', 'Glycolysis: Splitting Sugar', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Glycolysis occurs in the cytoplasm and requires no oxygen. It splits one 6-carbon glucose into two 3-carbon pyruvate molecules, yielding a net gain of 2 ATP and 2 NADH. It is the universal first step of cellular respiration.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-18', 'Pyruvate Oxidation', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Before entering the Krebs cycle, pyruvate moves into the mitochondria where it is oxidized and converted into Acetyl-CoA. This step releases CO2 and reduces NAD+ to NADH, acting as the critical link between glycolysis and the Krebs cycle.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-19', 'The Krebs Cycle (Citric Acid)', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Occurring in the mitochondrial matrix, the Krebs cycle completely oxidizes the Acetyl-CoA. It produces a small amount of ATP, but its main purpose is to harvest high-energy electrons, transferring them to carrier molecules (NADH and FADH2).' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-20', 'The Electron Transport Chain', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Located on the inner mitochondrial membrane, the ETC is a series of protein complexes. Electrons from NADH and FADH2 are passed down the chain, releasing energy that is used to pump protons (H+) into the intermembrane space, creating a massive gradient.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-21', 'Chemiosmosis & ATP Synthase', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'The proton gradient created by the ETC represents potential energy. Protons flow back into the matrix through an enzyme called ATP Synthase. This flow spins a rotor within the enzyme, driving the synthesis of roughly 28-32 ATP molecules per glucose.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-22', 'Light-Dependent Reactions', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'In the chloroplast\'s thylakoid membranes, chlorophyll absorbs solar energy, which excites electrons. These electrons travel down a photosynthetic ETC, generating ATP and NADPH. Water is split to replace the electrons, releasing oxygen as a byproduct.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-23', 'The Calvin Cycle (Dark Reactions)', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Occurring in the chloroplast stroma, the Calvin Cycle uses the ATP and NADPH generated by the light reactions to fix carbon dioxide from the air into organic sugar molecules (G3P). This is the foundation of the global food chain.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-24', 'DNA: The Double Helix', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'DNA consists of two anti-parallel strands of nucleotides. The sugar-phosphate backbone provides structure, while the nitrogenous bases (A, T, C, G) point inward. A pairs with T via two hydrogen bonds, and C pairs with G via three, ensuring uniform width.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-25', 'Helicase and Topoisomerase', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'During replication, Helicase unzips the DNA double helix by breaking hydrogen bonds. This creates intense twisting tension ahead of the replication fork, which is relieved by Topoisomerase, an enzyme that cuts, untwists, and rejoins the DNA strands.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-26', 'DNA Polymerase and Ligase', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'DNA Polymerase synthesizes the new DNA strand by adding nucleotides to the 3\' end. Because it can only build 5\' to 3\', the \'lagging strand\' is built in chunks called Okazaki fragments. DNA Ligase then acts as cellular glue, sealing the fragments together.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-27', 'Transcription: DNA to mRNA', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Transcription occurs in the nucleus. RNA Polymerase binds to a promoter region on the DNA, unzips the helix, and builds a single-stranded messenger RNA (mRNA) transcript that is complementary to the template gene.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-28', 'RNA Processing (Splicing)', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Before leaving the nucleus, the raw pre-mRNA is modified. A 5\' cap and a 3\' poly-A tail are added for protection. Then, non-coding regions called introns are cut out (spliced), and the coding regions (exons) are joined together.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-29', 'Translation: mRNA to Protein', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'In the cytoplasm, the ribosome reads the mRNA sequence in triplets called codons. Transfer RNA (tRNA) molecules carry specific amino acids to the ribosome. The tRNA\'s anticodon binds to the mRNA codon, ensuring the correct amino acid is added to the chain.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-30', 'Mutations: Point vs Frameshift', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'A point mutation changes a single nucleotide. It might be silent, or it might change one amino acid (missense). A frameshift mutation (insertion or deletion) shifts the entire reading frame of the ribosome, usually resulting in a completely non-functional protein.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-31', 'The Cell Cycle (Interphase)', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'A cell spends most of its life in Interphase, which is divided into G1 (growth), S (DNA synthesis/replication), and G2 (preparation for division). Strict checkpoints ensure the cell does not divide if its DNA is damaged.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('bio-gen-32', 'Mitosis: PMAT', 'Gaia', 'concept', 'Explore cellular mechanisms.', {
    minutes: 6,
    objectives: ['Understand biological structures', 'Analyze cellular functions'],
    simple: 'A detailed look at cellular biology.',
    blocks: [
      { type: 'keyTerms', terms: [{ term: 'Enzyme', def: 'A protein that catalyzes a reaction.' }, { term: 'ATP', def: 'The primary energy carrier in cells.' }] },
      { type: 'steps', steps: ['Molecules bind to the receptor.', 'A cascade of signals occurs.', 'The cell responds to the stimulus.'] },
      { type: 'text', body: 'Mitosis divides the nucleus. Prophase (chromosomes condense), Metaphase (chromosomes align at the equator), Anaphase (sister chromatids are pulled apart), and Telophase (new nuclei form). This is immediately followed by cytokinesis, splitting the cell in two.' },
      { type: 'summary', points: ['Core concept', 'Mechanism', 'Biological importance'] }
    ]
  }, [
    mcq('Why is this biological mechanism important?', ['It sustains cellular function.', 'It creates infinite energy.', 'It destroys the cell.', 'It is vestigial.'], 'Cellular processes are highly conserved for survival.'),
    tf('This process occurs in complete isolation from other cellular functions.', false, 'Biological systems are deeply interconnected.')
  ]),
  topic('eng-gen-1', 'Pronouns in Practice', 'Lexis', 'concept', 'Replacing nouns to avoid repetition.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Replacing nouns to avoid repetition.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'Pronouns are the ultimate shortcut in language. Without them, we would have to repeat names endlessly: \'Mary went to Mary\'s car because Mary forgot Mary\'s keys.\' Instead, we use pronouns: \'Mary went to her car because she forgot her keys.\' Examples include I, you, he, she, it, we, and they. But beware of ambiguous pronouns! If you write \'The dog chased the cat until it fell exhausted,\' we don\'t know who \'it\' refers to.' },
      { type: 'summary', points: ['Pronouns replace nouns', 'Avoid ambiguous references', 'Case matters (he vs him)'] }
    ]
  }, [
    mcq('Which sentence avoids an ambiguous pronoun?', ['Sarah told Jane that Jane won the prize.', 'Sarah told Jane that she won the prize.', 'The car hit the wall and it broke.', 'When the teachers met the students, they were happy.'], 'Repeating the noun \'Jane\' ensures there is no confusion about who won.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-2', 'Action and Linking Verbs', 'Lexis', 'concept', 'Verbs do more than just show action.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Verbs do more than just show action.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'While most verbs express action (run, jump, write), linking verbs connect the subject to more information about it. For example, in the sentence \'The soup smells delicious,\' \'smells\' is a linking verb connecting \'soup\' to \'delicious.\' It doesn\'t mean the soup has a nose and is sniffing! Common linking verbs include forms of \'to be\' (is, am, are, was, were), seem, become, and feel.' },
      { type: 'summary', points: ['Action verbs show doing', 'Linking verbs connect states', 'To be is the most common'] }
    ]
  }, [
    mcq('Identify the linking verb in this sentence: \'The sky grew dark as the storm approached.\'', ['grew', 'dark', 'approached', 'storm'], '\'Grew\' links \'sky\' to the adjective \'dark\', indicating a change in state.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-3', 'Mastering Verb Tenses', 'Lexis', 'concept', 'Time travel using verbs.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Time travel using verbs.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'Verbs tell us not just what happened, but when. English relies on tense to indicate time. Simple past (I walked) means it\'s over. Present perfect (I have walked) means it happened in the past but is still relevant now. Past perfect (I had walked) is the \'past of the past\'—useful for establishing order: \'I had already eaten by the time John arrived.\' Using tenses consistently is the key to clear storytelling.' },
      { type: 'summary', points: ['Simple tenses (past, present, future)', 'Perfect tenses show completion', 'Consistency is crucial'] }
    ]
  }, [
    mcq('Which sentence correctly uses the past perfect tense?', ['She had finished the report before the meeting started.', 'She has finished the report yesterday.', 'She finishes the report before the meeting.', 'She finished the report and had left.'], 'Past perfect (\'had finished\') happens before another past action (\'started\').'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-4', 'Adjectives: Painting with Words', 'Lexis', 'concept', 'Modifying nouns for vivid imagery.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Modifying nouns for vivid imagery.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'Adjectives describe or modify nouns and pronouns. Instead of saying \'a dog,\' you might say \'a ferocious, foaming, giant dog.\' Order matters in English adjectives. Native speakers instinctively use the order: opinion, size, age, shape, color, origin, material, purpose. This is why \'a beautiful little old French silver whittling knife\' sounds perfectly natural, but \'a silver French beautiful little old whittling knife\' sounds completely wrong.' },
      { type: 'summary', points: ['Adjectives modify nouns', 'Order of adjectives matters', 'Use them sparingly for impact'] }
    ]
  }, [
    mcq('Which phrase follows the natural order of English adjectives?', ['A lovely little old wooden box', 'A wooden little old lovely box', 'An old lovely wooden little box', 'A little lovely old wooden box'], 'Opinion (lovely) comes before size (little), age (old), and material (wooden).'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-5', 'Adverbs: How, When, Where', 'Lexis', 'concept', 'Modifying verbs, adjectives, and other adverbs.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Modifying verbs, adjectives, and other adverbs.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'Adverbs modify verbs, adjectives, or even other adverbs. They answer questions like how (quickly), when (yesterday), where (everywhere), and to what extent (very). Example: \'He ran remarkably fast.\' \'Fast\' modifies the verb \'ran\', making it an adverb, and \'remarkably\' modifies \'fast\', making it an adverb too. Beware of the common mistake: \'I did good on the test.\' Good is an adjective. You should say, \'I did well on the test.\'' },
      { type: 'summary', points: ['Modify verbs and adjectives', 'Often end in -ly', 'Well vs. Good'] }
    ]
  }, [
    mcq('In the sentence \'The incredibly talented musician played perfectly,\' how many adverbs are there?', ['Two', 'One', 'Three', 'None'], '\'Incredibly\' modifies \'talented\' (adjective) and \'perfectly\' modifies \'played\' (verb).'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-6', 'Prepositional Phrases', 'Lexis', 'concept', 'Showing relationships in space and time.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Showing relationships in space and time.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'Prepositions tell you the relationship between a noun and another part of the sentence, often indicating space or time. Think of a preposition as anything a mouse can do to a log: it can go over, under, through, in, out, or around the log. The preposition combined with its noun is a \'prepositional phrase\' (e.g., \'under the bed\'). Avoid ending a sentence with a preposition if it sounds awkward, but don\'t force it—as Winston Churchill allegedly joked, \'This is the sort of English up with which I will not put.\'' },
      { type: 'summary', points: ['Indicate space and time', 'Preposition + Object = Phrase', 'Ending sentences with them is fine'] }
    ]
  }, [
    mcq('Identify the prepositional phrase: \'The cat slept peacefully on the warm radiator.\'', ['on the warm radiator', 'slept peacefully', 'The cat slept', 'peacefully on'], 'It starts with the preposition \'on\' and ends with the noun \'radiator\'.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-7', 'Conjunctions: The Glue', 'Lexis', 'concept', 'Joining words, phrases, and clauses.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Joining words, phrases, and clauses.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'Conjunctions connect ideas. Coordinating conjunctions (FANBOYS: For, And, Nor, But, Or, Yet, So) connect equal parts: \'I wanted ice cream, but the shop was closed.\' Subordinating conjunctions (because, although, if, since) connect an independent clause to a dependent clause: \'Because the shop was closed, I went home.\' Using the right conjunction clarifies the logic between your thoughts.' },
      { type: 'summary', points: ['FANBOYS for equal parts', 'Subordinating for dependent parts', 'Clarify logical relationships'] }
    ]
  }, [
    mcq('Which word is a coordinating conjunction?', ['But', 'Although', 'Because', 'Since'], '\'But\' is part of FANBOYS, used to connect independent clauses.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-8', 'Subjects: The \'Who\' or \'What\'', 'Lexis', 'concept', 'The star of the sentence.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'The star of the sentence.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'Every complete sentence must have a subject. The subject is the person, place, thing, or idea that is doing or being something. In \'The ancient, crumbling castle stood on the hill,\' the simple subject is just \'castle,\' while the complete subject is \'The ancient, crumbling castle.\' Sometimes the subject is understood but not written, as in the command: \'Stop!\' (The subject is an implied \'You\').' },
      { type: 'summary', points: ['The doer of the action', 'Simple vs Complete subject', 'Implied \'You\' in commands'] }
    ]
  }, [
    mcq('What is the simple subject in the sentence: \'A flock of wild geese flew overhead.\'?', ['flock', 'geese', 'flew', 'A flock of wild geese'], '\'Flock\' is the singular noun doing the flying; \'of wild geese\' is a prepositional phrase describing it.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-9', 'Predicates: The Action', 'Lexis', 'concept', 'What the subject does or is.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'What the subject does or is.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'If the subject is the star, the predicate is what the star does. It contains the verb and everything following it that describes the action. In \'The dog buried his bone in the garden,\' the complete predicate is \'buried his bone in the garden.\' The simple predicate is just the verb: \'buried.\' A sentence is not complete without a predicate, even if the subject is very long.' },
      { type: 'summary', points: ['Contains the verb', 'Describes the subject\'s action', 'Cannot be omitted'] }
    ]
  }, [
    mcq('What is the complete predicate in: \'The brave firefighter rescued the kitten.\'?', ['rescued the kitten', 'rescued', 'The brave firefighter rescued', 'kitten'], 'It includes the verb \'rescued\' and its object \'the kitten\'.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-10', 'Independent Clauses', 'Lexis', 'concept', 'A complete thought.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'A complete thought.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'An independent clause has a subject, a verb, and expresses a complete thought. It can stand alone as a sentence. \'The sun sets.\' is an independent clause. \'Although the sun sets\' is not. When you write, you are stringing together independent clauses. You can join two of them using a semicolon or a comma with a coordinating conjunction (FANBOYS).' },
      { type: 'summary', points: ['Subject + Verb + Complete Thought', 'Can stand alone', 'Joined by semicolons or FANBOYS'] }
    ]
  }, [
    mcq('Which of the following is an independent clause?', ['The dog barked loudly.', 'Because the dog barked loudly.', 'When the dog barked.', 'Barking loudly at the mailman.'], 'It has a subject (dog), verb (barked), and is a complete thought.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-11', 'Dependent Clauses', 'Lexis', 'concept', 'Needs help to stand up.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Needs help to stand up.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'A dependent clause has a subject and a verb, but it cannot stand alone because it begins with a subordinating word (like although, because, if, when, which). \'When the timer rings\' leaves you hanging. It must be attached to an independent clause: \'When the timer rings, take the cake out.\' Understanding this distinction is the secret to fixing sentence fragments.' },
      { type: 'summary', points: ['Has subject and verb', 'Starts with subordinating word', 'Cannot stand alone'] }
    ]
  }, [
    mcq('Identify the dependent clause: \'I will go to the park if it stops raining.\'', ['if it stops raining', 'I will go', 'to the park', 'I will go to the park'], 'It starts with the subordinating conjunction \'if\' and cannot stand alone.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-12', 'Simple and Compound Sentences', 'Lexis', 'concept', 'Sentence structures basics.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Sentence structures basics.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'A simple sentence consists of one independent clause: \'The ice melted.\' A compound sentence joins two independent clauses using a conjunction or semicolon: \'The ice melted, and the water spilled.\' Using a variety of simple and compound sentences gives your writing rhythm. Too many simple sentences sound choppy; too many compound sentences sound rambling.' },
      { type: 'summary', points: ['Simple: 1 clause', 'Compound: 2+ independent clauses', 'Vary sentence lengths'] }
    ]
  }, [
    mcq('What type of sentence is: \'She wanted to play outside, but it was raining.\'?', ['Compound', 'Simple', 'Complex', 'Fragment'], 'It connects two independent clauses with the conjunction \'but\'.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-13', 'Complex Sentences', 'Lexis', 'concept', 'Layering information.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Layering information.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'A complex sentence combines one independent clause with at least one dependent clause. \'Although she was tired (dependent), she finished her homework (independent).\' If the dependent clause comes first, use a comma. If the independent clause comes first, you usually don\'t need a comma: \'She finished her homework although she was tired.\'' },
      { type: 'summary', points: ['1 Independent + 1+ Dependent', 'Comma if dependent comes first', 'Adds nuance to writing'] }
    ]
  }, [
    mcq('Does this complex sentence need a comma: \'He bought the shoes because they were on sale.\'?', ['No comma needed', 'Yes, before \'because\'', 'Yes, after \'because\'', 'Yes, after \'shoes\''], 'Because the independent clause comes first, no comma is needed before the dependent clause.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-14', 'Mastering the Comma', 'Lexis', 'concept', 'The breath of the sentence.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'The breath of the sentence.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'Commas are often misused. Use them to separate items in a list (apples, oranges, and pears), to separate two independent clauses with a conjunction, or after an introductory dependent clause. Do NOT use a comma just because you would take a breath while speaking. The \'comma splice\' is a fatal error: joining two complete sentences with only a comma (\'I went home, I was tired\').' },
      { type: 'summary', points: ['Lists and introductions', 'FANBOYS joining complete sentences', 'Beware the comma splice'] }
    ]
  }, [
    mcq('Which sentence contains a comma splice error?', ['The wind blew fiercely, the trees shook.', 'The wind blew fiercely, and the trees shook.', 'Because the wind blew fiercely, the trees shook.', 'The wind blew fiercely; the trees shook.'], 'It illegally joins two complete sentences with just a comma.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-15', 'The Colon', 'Lexis', 'concept', 'The drumroll.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'The drumroll.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'A colon is a drumroll: it introduces something important that follows from what was just said. It can introduce a list, a quote, or an explanation. Crucially, the text before the colon must be a complete independent sentence. CORRECT: \'I have three favorite colors: red, blue, and green.\' INCORRECT: \'My favorite colors are: red, blue, and green.\' (Because \'My favorite colors are\' is not a complete sentence).' },
      { type: 'summary', points: ['Acts as a drumroll', 'Must follow an independent clause', 'Introduces lists or explanations'] }
    ]
  }, [
    mcq('Which sentence uses a colon correctly?', ['He had one rule: never look back.', 'She bought: apples, milk, and bread.', 'The best team is: the Eagles.', 'Such as: cats, dogs, and birds.'], '\'He had one rule\' is a complete sentence introducing an explanation.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-16', 'The Em Dash', 'Lexis', 'concept', 'The dramatic pause.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'The dramatic pause.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'The em dash (—) is the versatile bad boy of punctuation. It can replace commas for a more dramatic parenthetical thought, replace a colon for emphasis, or indicate an abrupt change in thought. \'The pie—which was supposed to be cherry—was filled with meat.\' It adds a highly stylized, punchy rhythm to your writing. Just don\'t overuse it, or your writing will feel frantic.' },
      { type: 'summary', points: ['Adds dramatic emphasis', 'Can replace commas or colons', 'Use sparingly for impact'] }
    ]
  }, [
    mcq('What is the primary effect of using an em dash instead of commas?', ['It adds dramatic emphasis or abruptness.', 'It makes the sentence grammatically formal.', 'It changes the tense of the verb.', 'It turns an independent clause into a dependent one.'], 'Em dashes disrupt the flow visually to emphasize the enclosed text.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-17', 'Fixing Run-On Sentences', 'Lexis', 'concept', 'Knowing when to stop.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Knowing when to stop.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'A run-on sentence isn\'t just a long sentence; it\'s a grammatical failure where two independent clauses are mashed together without proper punctuation. \'I drove to the store I bought milk.\' This is a fused sentence. You can fix it with a period (\'store. I\'), a semicolon (\'store; I\'), or a conjunction with a comma (\'store, and I\'). A 100-word sentence can be grammatically perfect, while a 5-word sentence can be a run-on.' },
      { type: 'summary', points: ['Not about length', 'Missing punctuation between clauses', 'Fix with periods or semicolons'] }
    ]
  }, [
    mcq('How can you fix this run-on: \'The alarm rang she woke up.\'?', ['The alarm rang; she woke up.', 'The alarm rang she, woke up.', 'The alarm, rang she woke up.', 'The alarm rang she woke, up.'], 'A semicolon properly separates two closely related independent clauses.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-18', 'Avoiding Sentence Fragments', 'Lexis', 'concept', 'Missing the core components.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Missing the core components.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'A fragment is a piece of a sentence pretending to be a whole one. It is usually missing a subject or a verb, or it\'s a dependent clause masquerading as an independent one. Example: \'Walking through the dark forest.\' Who is walking? What happened? The sentence is incomplete. Fix it by attaching it to a real sentence: \'Walking through the dark forest, the knight drew his sword.\'' },
      { type: 'summary', points: ['Missing subject or verb', 'Or is a lone dependent clause', 'Fix by combining sentences'] }
    ]
  }, [
    mcq('Which of the following is a sentence fragment?', ['Because the bridge collapsed during the storm.', 'The bridge collapsed during the storm.', 'They closed the bridge.', 'Storms collapse bridges.'], 'It starts with \'Because\', making it a dependent clause that needs an independent clause to finish the thought.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-19', 'Passive Voice Pitfalls', 'Lexis', 'concept', 'Who is doing what?', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Who is doing what?',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'In the active voice, the subject performs the action: \'The dog bit the man.\' In the passive voice, the subject receives the action: \'The man was bitten by the dog.\' Passive voice often requires more words and obscures responsibility (\'Mistakes were made\' vs \'I made mistakes\'). While passive voice isn\'t strictly grammatically incorrect, relying on active voice makes your writing punchier, clearer, and more direct.' },
      { type: 'summary', points: ['Active: Subject acts', 'Passive: Subject is acted upon', 'Active is usually clearer'] }
    ]
  }, [
    mcq('Identify the sentence written in the active voice:', ['The chef cooked a delicious meal.', 'A delicious meal was cooked by the chef.', 'The meal was cooked quickly.', 'The meal had been cooked.'], 'The subject (chef) is performing the action (cooked).'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-20', 'Paragraph Transitions', 'Lexis', 'concept', 'Bridging your thoughts.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Bridging your thoughts.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'Even if every sentence is grammatically perfect, your writing will fail if the ideas don\'t connect. Transitions are the bridges between paragraphs. Instead of jumping from a paragraph about apples directly into a paragraph about oranges, a transition sentence eases the reader in: \'While apples offer a crisp sweetness, citrus fruits like oranges provide an entirely different nutritional profile.\' Use transitional adverbs like however, furthermore, or conversely.' },
      { type: 'summary', points: ['Connect disparate ideas', 'Guide the reader\'s logic', 'Use transitional phrases'] }
    ]
  }, [
    mcq('Which word is best used to show a contrast between two paragraphs?', ['Conversely', 'Furthermore', 'Additionally', 'Consequently'], '\'Conversely\' indicates that the following idea is opposite or contrasting to the previous one.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ]),
  topic('eng-gen-21', 'The Art of Editing', 'Lexis', 'concept', 'Writing is rewriting.', {
    minutes: 6,
    objectives: ['Understand the grammar rule', 'Apply correctly in writing'],
    simple: 'Writing is rewriting.',
    blocks: [
      { type: 'example', body: 'Consider the sentence: "The quick brown fox jumps over the lazy dog." This demonstrates how every element of grammar fits perfectly together.' },
      { type: 'keyTerms', terms: [{ term: 'Syntax', def: 'The arrangement of words and phrases.' }, { term: 'Semantics', def: 'The meaning of a word or sentence.' }] },
      { type: 'text', body: 'Great writing doesn\'t happen on the first draft. The art of editing involves mercilessly cutting filler words (very, really, just, that), replacing weak adjectives with strong verbs, and reading your work aloud to catch awkward rhythms. If a sentence requires the reader to re-read it twice to understand it, the sentence is broken. Your goal is frictionless transfer of thought from your brain to the reader\'s.' },
      { type: 'summary', points: ['Cut filler words', 'Prioritize strong verbs', 'Read aloud for rhythm'] }
    ]
  }, [
    mcq('What is a highly effective technique for catching awkward phrasing during editing?', ['Reading the text aloud.', 'Running a spellchecker.', 'Changing the font size.', 'Adding more adjectives.'], 'Reading aloud engages your ear, quickly revealing unnatural rhythms and clunky phrasing.'),
    tf('Reviewing this rule makes you a better writer.', true, 'Mastery requires practice.')
  ])
];

function fromTemplate(t: Template, objective: string, level: Level): Course {
  const pool = [...t.modules.flatMap((m) => m.topics), ...EXTRA_TOPICS];
  const layout = LAYOUTS[t.id];
  const modules: Module[] = layout
    ? layout.map((l) => ({ id: l.id, title: l.title, topics: l.topics.map((id) => pool.find((x) => x.id === id)).filter((x): x is Topic => !!x) }))
    : t.modules;
  return { id: makeId('course'), title: t.title, subtitle: t.subtitle, objective, level, source: 'template', modules };
}

/** A generic, honest starter plan for any goal: how to learn it well, until the AI writes the subject lessons. */
function starterPlan(objective: string, level: Level): Course {
  const goal = objective.trim().replace(/^(i want to|teach me|help me)\s+(learn|understand|master|get better at)?\s*/i, '').replace(/[.!?]+$/, '') || 'your topic';
  const g = goal.length > 48 ? `${goal.slice(0, 45)}…` : goal;
  const mk = (id: string, title: string, planet: string, summary: string, blocks: Block[], simple: string, quiz: Question[], objectives: string[]): Topic =>
    topic(id, title, planet, 'concept', summary, { minutes: 5, objectives, simple, blocks }, quiz);
  return {
    id: makeId('course'),
    title: g.charAt(0).toUpperCase() + g.slice(1),
    subtitle: 'Starter plan — your AI tutor tailors these lessons once it is connected',
    objective,
    level,
    source: 'starter',
    modules: [
      {
        id: 'st-m1',
        title: 'Orientation',
        topics: [
          mk('st-1', `The big picture of ${g}`, 'Vega', 'Map the territory before diving in.', [
            { type: 'text', body: `Before memorising details of ${g}, sketch the territory: what are the main areas, what problems does it solve, and how do the pieces connect?` },
            { type: 'steps', title: 'Build your map', steps: ['List 5–7 big sub-areas', 'Write one sentence on why each matters', 'Draw arrows for how they depend on each other', 'Circle the one you need first'] },
            { type: 'callout', tone: 'tip', body: 'Upload your class notes or a textbook PDF and NOVA will build this map from your own material.' },
            { type: 'summary', points: ['Big picture first', 'Connect the pieces', 'Start where you need it most'] },
          ], 'Look at the whole map before walking the streets.', [
            tf('Seeing how topics connect makes new details easier to remember.', true, 'Connected knowledge gives new facts something to attach to.'),
            mcq('What should come first when starting a new subject?', ['A rough map of its main areas', 'Memorising definitions', 'The hardest problem you can find', 'Reading everything in order'], 'A map tells you where each detail fits.'),
          ], ['Sketch the main areas', 'Pick a starting point']),
          mk('st-2', 'Key vocabulary', 'Lyra', 'Collect the words experts use.', [
            { type: 'text', body: `Every field has its own language. Collect the ten terms that keep appearing in ${g} and define each in your own words.` },
            terms(['Flashcard', 'A prompt on one side, the answer on the other.'], ['Own words', 'A definition you could explain to a friend.']),
            { type: 'callout', tone: 'tip', body: 'Use the notes panel on the right to keep your growing glossary.' },
            { type: 'summary', points: ['Find the recurring terms', 'Define them yourself', 'Review them often'] },
          ], 'Learn the words and the sentences get easier.', [
            fill('Testing yourself with prompt-and-answer cards uses ____cards.', 'flash', 'Flashcards are a classic retrieval-practice tool.', ['flash cards']),
            tf('Copying a dictionary definition word-for-word is the best way to learn a term.', false, 'Rephrasing in your own words forces understanding.'),
          ], ['Build a 10-term glossary']),
        ],
      },
      {
        id: 'st-m2',
        title: 'Practice',
        topics: [
          mk('st-3', 'Learning by doing', 'Orion', 'Practice beats rereading.', [
            { type: 'text', body: 'Rereading feels productive but fades fast. Retrieval practice — answering questions from memory — and spacing your reviews over days make knowledge stick.' },
            { type: 'compare', columns: ['Rereading', 'Retrieval practice'], rows: [['Feels', 'Easy and familiar', 'Effortful'], ['Remembered after a week', 'Much less', 'Much more']] },
            { type: 'summary', points: ['Quiz yourself', 'Space your reviews', 'Effort is a good sign'] },
          ], 'Pulling an answer out of your head strengthens it — like a muscle.', [
            mcq('Which study habit leads to better long-term memory?', ['Testing yourself from memory', 'Rereading notes', 'Highlighting everything', 'Studying only the night before'], 'Retrieval practice strengthens memory far more than rereading.'),
            tf('Spreading reviews over several days beats one long session.', true, 'This is the spacing effect.', 2),
          ], ['Use retrieval practice', 'Plan spaced reviews']),
          mk('st-4', 'Teach it back', 'Atlas', 'Explain it simply to prove you know it.', [
            { type: 'text', body: `Pick one idea from ${g} and explain it as if to a curious twelve-year-old. Wherever you get stuck is exactly what to study next.` },
            { type: 'steps', title: 'The Feynman technique', steps: ['Choose a concept', 'Explain it in plain words', 'Spot the gaps', 'Go back to the source and simplify again'] },
            { type: 'summary', points: ['Explain simply', 'Gaps show what to study', 'Repeat until it is clear'] },
          ], 'If you can teach it, you know it.', [
            fill('Explaining a concept in plain words to find your gaps is the ____ technique.', 'Feynman', 'Named after physicist Richard Feynman.', ['feynman']),
            tf('Getting stuck while explaining is a sign you should give up.', false, 'Getting stuck shows you exactly what to learn next.'),
          ], ['Explain one concept simply']),
        ],
      },
    ],
  };
}

/** Picks a template for the goal, or builds a starter plan for anything else. */
export function courseFromObjective(objective: string, level: Level = 'beginner'): Course {
  const t = TEMPLATES.find((x) => x.match.test(objective));
  return t ? fromTemplate(t, objective, level) : starterPlan(objective, level);
}

export const TEMPLATE_PRESETS = [
  { label: 'Neural networks to Transformers', objective: 'Teach me how neural networks and Transformers work' },
  { label: 'Advanced React patterns', objective: 'Advanced React patterns' },
  { label: 'Linear algebra basics', objective: 'Linear algebra basics' },
  { label: 'Cellular biology', objective: 'Cellular biology' },
  { label: 'English Essentials', objective: 'English Essentials' },
];
