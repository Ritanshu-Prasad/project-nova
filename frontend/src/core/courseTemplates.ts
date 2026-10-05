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

const terms = (...t: [string, string][]): Block => ({ type: 'keyTerms', terms: t.map(([term, def]) => ({ term, def })) });

/** Topic-specific side-panel sections — each topic gets the ones that suit it (the AI backend sends its own). */
const PANELS: Record<string, Panel[]> = {
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
  return { id, title, planet, kind, summary, lesson: { ...lesson, panels: PANELS[id] }, quiz };
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
];

function fromTemplate(t: Template, objective: string, level: Level): Course {
  return { id: makeId('course'), title: t.title, subtitle: t.subtitle, objective, level, source: 'template', modules: t.modules };
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
];
