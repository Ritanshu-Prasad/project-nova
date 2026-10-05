/**
 * Starter courses used until the RAG backend generates courses live.
 * Each subtopic is a "planet" on the journey map. In every question, `options[0]` is the correct answer
 * (the quiz shuffles them for display).
 */
export interface Question {
  q: string;
  options: [string, string, string, string];
  why: string;
}

export interface Subtopic {
  title: string;
  planet: string;
  lesson: string;
  simple: string;
  keys: [string, string, string];
  quiz: [Question, Question];
}

export interface CourseTemplate {
  id: string;
  title: string;
  match: RegExp;
  subtopics: Subtopic[];
}

export const COURSES: CourseTemplate[] = [
  {
    id: 'react',
    title: 'Advanced React Patterns',
    match: /react|hook|component|jsx|frontend/i,
    subtopics: [
      {
        title: 'Composition over inheritance',
        planet: 'Componentia',
        lesson: 'React favours composing small components. Pass UI in as children or props instead of building deep inheritance chains — components stay flexible, testable and reusable.',
        simple: 'Build with LEGO bricks: small pieces snapped together, not one giant mould.',
        keys: ['The children prop', 'Props as slots', 'Small reusable parts'],
        quiz: [
          { q: 'Which prop lets a component render whatever is nested between its tags?', options: ['children', 'nested', 'slot', 'inner'], why: 'Anything between a component’s opening and closing tags arrives as props.children.' },
          { q: 'React’s recommended way to reuse UI between components is…', options: ['Composition', 'Class inheritance', 'Global variables', 'Copy-pasting'], why: 'Composition through props and children keeps components decoupled.' },
        ],
      },
      {
        title: 'Custom hooks',
        planet: 'Hookara',
        lesson: 'Custom hooks extract stateful logic into reusable functions whose names start with “use”. They can call other hooks, so components share behaviour without sharing markup.',
        simple: 'A custom hook is a recipe card for behaviour that any component can follow.',
        keys: ['Name starts with use', 'Shares logic, not UI', 'Follows the Rules of Hooks'],
        quiz: [
          { q: 'A custom hook’s name must start with…', options: ['use', 'hook', 'with', 'get'], why: 'The “use” prefix lets React and linters enforce the Rules of Hooks.' },
          { q: 'Where may hooks be called?', options: ['At the top level of components or hooks', 'Inside loops', 'Inside if-statements', 'In any helper function'], why: 'Hooks must run in the same order on every render, so call them only at the top level.' },
        ],
      },
      {
        title: 'Context & lifting state',
        planet: 'Contextor',
        lesson: 'When siblings need the same data, lift the state to their closest common parent. For data needed deep in the tree, Context provides it without prop drilling — but every consumer re-renders when the value changes.',
        simple: 'Instead of passing a note hand-to-hand down a line, pin it on a noticeboard everyone can read.',
        keys: ['Lift state up', 'Context avoids prop drilling', 'Consumers re-render on change'],
        quiz: [
          { q: 'What problem does Context mainly solve?', options: ['Prop drilling', 'Slow network requests', 'CSS conflicts', 'Large bundle size'], why: 'Context hands data to deep components without threading props through every level.' },
          { q: 'Two sibling components need the same state. Where should it live?', options: ['In their closest common parent', 'In each sibling separately', 'In a global variable', 'In localStorage'], why: 'Lifting state to the common parent gives both siblings one source of truth.' },
        ],
      },
      {
        title: 'Memoisation',
        planet: 'Memora',
        lesson: 'useMemo caches a computed value and useCallback caches a function between renders, recomputing only when dependencies change. React.memo skips re-rendering a component whose props are unchanged. Measure first — memoisation has a cost too.',
        simple: 'Memoisation is remembering an answer so you don’t redo the sum when nothing changed.',
        keys: ['useMemo → values', 'useCallback → functions', 'React.memo → components'],
        quiz: [
          { q: 'Which hook memoises a computed value?', options: ['useMemo', 'useCallback', 'useRef', 'useEffect'], why: 'useMemo returns a cached value until one of its dependencies changes.' },
          { q: 'React.memo skips a re-render when…', options: ['Props are shallowly equal', 'State changes', 'Context changes', 'The parent unmounts'], why: 'React.memo shallow-compares props; state or context changes still re-render.' },
        ],
      },
    ],
  },
  {
    id: 'linalg',
    title: 'Linear Algebra Basics',
    match: /linear|algebra|matri|vector|eigen|determinant/i,
    subtopics: [
      {
        title: 'Vectors',
        planet: 'Vectoria',
        lesson: 'A vector is an ordered list of numbers describing magnitude and direction. Add vectors component by component, and scale one by multiplying every component. The dot product measures how aligned two vectors are.',
        simple: 'A vector is an arrow: how far, and which way.',
        keys: ['Component-wise addition', 'Scalar multiplication', 'Dot product = alignment'],
        quiz: [
          { q: '(1, 2) + (3, 4) = ?', options: ['(4, 6)', '(3, 8)', '(4, 8)', '(2, 2)'], why: 'Add component by component: 1 + 3 and 2 + 4.' },
          { q: 'The dot product of (1, 0) and (0, 1) is…', options: ['0', '1', '−1', '2'], why: '1·0 + 0·1 = 0 — perpendicular vectors have a zero dot product.' },
        ],
      },
      {
        title: 'Matrices',
        planet: 'Matrixa',
        lesson: 'A matrix is a grid of numbers that transforms vectors. Multiplying a matrix by a vector combines the matrix’s columns, weighted by the vector’s entries. The identity matrix leaves every vector unchanged.',
        simple: 'A matrix is a machine: an arrow goes in, a moved or stretched arrow comes out.',
        keys: ['Columns get combined', 'Inner dimensions must match', 'Identity changes nothing'],
        quiz: [
          { q: 'A 2×3 matrix times a 3×1 vector gives a…', options: ['2×1 vector', '3×1 vector', '3×3 matrix', 'Single number'], why: 'The inner dimensions (3) cancel, leaving a 2×1 result.' },
          { q: 'The identity matrix I satisfies I·v = …', options: ['v', '0', '2v', '−v'], why: 'The identity maps every vector to itself.' },
        ],
      },
      {
        title: 'Determinants',
        planet: 'Determina',
        lesson: 'The determinant measures how a matrix scales area (or volume). A determinant of zero means the transformation squashes space into a lower dimension, so the matrix has no inverse.',
        simple: 'The determinant says how much a shape grows or shrinks after the matrix acts on it.',
        keys: ['Area scale factor', 'Zero → no inverse', 'Sign shows a flip'],
        quiz: [
          { q: 'The determinant of [[2, 0], [0, 3]] is…', options: ['6', '5', '0', '1'], why: 'For a diagonal matrix, multiply the diagonal: 2 × 3 = 6.' },
          { q: 'If det(A) = 0, then A is…', options: ['Not invertible', 'The identity', 'Always symmetric', 'Orthogonal'], why: 'A zero determinant collapses space, so no inverse can undo it.' },
        ],
      },
      {
        title: 'Eigenvectors',
        planet: 'Eigenon',
        lesson: 'An eigenvector of A keeps its direction when transformed: Av = λv. The scalar λ is its eigenvalue — how much that direction is stretched or shrunk.',
        simple: 'Eigenvectors are the directions a transformation only stretches and never turns.',
        keys: ['Av = λv', 'λ is the stretch', 'Direction is preserved'],
        quiz: [
          { q: 'If Av = 3v, the eigenvalue is…', options: ['3', 'v', 'A', '1/3'], why: 'The eigenvalue is the scalar multiplying v: λ = 3.' },
          { q: 'Eigenvectors are directions that a matrix…', options: ['Only scales', 'Always rotates by 90°', 'Sends to zero', 'Reflects'], why: 'By definition they keep their direction and are only scaled.' },
        ],
      },
    ],
  },
  {
    id: 'bio',
    title: 'Cellular Biology',
    match: /biolog|cell|dna|mitochond|organelle|gene/i,
    subtopics: [
      {
        title: 'The cell membrane',
        planet: 'Membrana',
        lesson: 'The plasma membrane is a phospholipid bilayer that controls what enters and leaves the cell. Proteins embedded in it act as channels, pumps and receptors.',
        simple: 'The membrane is the cell’s security gate, letting the right things in and out.',
        keys: ['Phospholipid bilayer', 'Selective permeability', 'Protein channels & pumps'],
        quiz: [
          { q: 'The cell membrane is mainly a…', options: ['Phospholipid bilayer', 'Cellulose wall', 'Protein crystal', 'Coil of DNA'], why: 'Two layers of phospholipids form the membrane’s flexible barrier.' },
          { q: 'Which molecules form channels and pumps in the membrane?', options: ['Proteins', 'Only carbohydrates', 'Nucleic acids', 'Vitamins'], why: 'Membrane proteins move specific molecules across the bilayer.' },
        ],
      },
      {
        title: 'The nucleus',
        planet: 'Nucleon',
        lesson: 'The nucleus stores the cell’s DNA and controls gene expression. DNA is transcribed into messenger RNA, which leaves the nucleus to be translated into proteins by ribosomes.',
        simple: 'The nucleus is a library of instruction books; RNA is the photocopy taken to the factory.',
        keys: ['DNA lives here', 'Transcription → mRNA', 'Ribosomes build proteins'],
        quiz: [
          { q: 'Transcription copies DNA into…', options: ['mRNA', 'Protein', 'Lipids', 'ATP'], why: 'Transcription produces messenger RNA from a DNA template.' },
          { q: 'Where are proteins built?', options: ['Ribosomes', 'The nuclear membrane', 'Lysosomes', 'Vacuoles'], why: 'Ribosomes translate mRNA into chains of amino acids.' },
        ],
      },
      {
        title: 'Mitochondria & energy',
        planet: 'Mitochondra',
        lesson: 'Mitochondria produce most of the cell’s ATP through cellular respiration, using oxygen to break down glucose. They even carry their own small genome.',
        simple: 'Mitochondria are power stations that turn food into ATP, the cell’s energy currency.',
        keys: ['ATP production', 'Uses oxygen', 'Own small genome'],
        quiz: [
          { q: 'Mitochondria mainly produce…', options: ['ATP', 'DNA', 'Glucose', 'Cellulose'], why: 'Cellular respiration in mitochondria generates most of the cell’s ATP.' },
          { q: 'Aerobic respiration in mitochondria requires…', options: ['Oxygen', 'Nitrogen gas', 'Sunlight', 'Only carbon dioxide'], why: 'Oxygen is the final electron acceptor in aerobic respiration.' },
        ],
      },
      {
        title: 'Cell division',
        planet: 'Divisia',
        lesson: 'Mitosis produces two identical daughter cells for growth and repair. Meiosis produces four genetically different gametes with half the chromosome number.',
        simple: 'Mitosis makes copies; meiosis shuffles the deck to deal unique cards.',
        keys: ['Mitosis → 2 identical', 'Meiosis → 4 gametes', 'Half the chromosomes'],
        quiz: [
          { q: 'Mitosis produces…', options: ['Two identical cells', 'Four gametes', 'One larger cell', 'Two different gametes'], why: 'Mitosis copies the cell into two genetically identical daughters.' },
          { q: 'Gametes are made by…', options: ['Meiosis', 'Mitosis', 'Osmosis', 'Diffusion'], why: 'Meiosis halves the chromosome number to make gametes.' },
        ],
      },
    ],
  },
  {
    id: 'ai',
    title: 'Neural Networks to Transformers',
    match: /./,
    subtopics: [
      {
        title: 'Neurons & layers',
        planet: 'Perceptra',
        lesson: 'A neural network is built from simple units called neurons. Each neuron multiplies its inputs by weights, adds a bias and passes the result through an activation function. Stacking neurons into layers lets the network learn increasingly abstract features.',
        simple: 'Each neuron is a tiny voter: it weighs its inputs, adds them up and decides how strongly to pass the signal on.',
        keys: ['Weights scale inputs', 'Bias shifts the result', 'Activations add non-linearity'],
        quiz: [
          { q: 'What does an activation function add to a neural network?', options: ['Non-linearity', 'More training data', 'Faster disk access', 'A bias term'], why: 'Without non-linear activations, stacked layers collapse into one linear function.' },
          { q: 'A neuron computes w·x + b. What is b?', options: ['The bias', 'The batch size', 'The learning rate', 'The output label'], why: 'b is a learned offset added before the activation.' },
        ],
      },
      {
        title: 'Learning with gradients',
        planet: 'Gradia',
        lesson: 'Training means adjusting the weights to reduce a loss — a number measuring how wrong the predictions are. Gradient descent nudges every weight a small step in the direction that lowers the loss; the learning rate sets the step size.',
        simple: 'Walking downhill in fog: feel the slope under your feet and take a small step down, again and again.',
        keys: ['Loss measures error', 'Gradient points uphill', 'Learning rate = step size'],
        quiz: [
          { q: 'In gradient descent, the weights move…', options: ['Opposite to the gradient', 'Along the gradient', 'Randomly', 'Only when the loss is zero'], why: 'The gradient points uphill; stepping against it lowers the loss.' },
          { q: 'What usually happens if the learning rate is far too high?', options: ['Training diverges or oscillates', 'Training becomes perfectly stable', 'The model gains layers', 'The loss is always zero'], why: 'Huge steps overshoot the minimum, so the loss bounces around or explodes.' },
        ],
      },
      {
        title: 'Backpropagation',
        planet: 'Backprop Prime',
        lesson: 'Backpropagation efficiently computes the gradient of the loss for every weight. After a forward pass produces a prediction, the error flows backwards layer by layer using the chain rule, telling each weight how much it contributed.',
        simple: 'After a missed shot, the coach walks back through your motion and tells each part how to adjust.',
        keys: ['Forward pass → prediction', 'Backward pass → gradients', 'Chain rule links layers'],
        quiz: [
          { q: 'Which rule of calculus makes backpropagation work?', options: ['The chain rule', 'The quotient rule', 'L’Hôpital’s rule', 'Simpson’s rule'], why: 'The chain rule multiplies local derivatives from the output back to the input.' },
          { q: 'What does the forward pass produce?', options: ['A prediction and its loss', 'Updated weights', 'New training data', 'The gradients directly'], why: 'The forward pass computes outputs and the loss; gradients come from the backward pass.' },
        ],
      },
      {
        title: 'Attention & Transformers',
        planet: 'Attentia',
        lesson: 'Transformers process a whole sequence at once. Self-attention lets every token score its relevance to every other token: queries meet keys to produce weights, and those weights mix the values into context-aware representations.',
        simple: 'When reading a sentence, attention is the model deciding which other words matter most for each word.',
        keys: ['Queries × keys → scores', 'Softmax → weights', 'Weighted values → context'],
        quiz: [
          { q: 'In self-attention, relevance scores come from comparing…', options: ['Queries with keys', 'Values with labels', 'Keys with the loss', 'Tokens with pixels'], why: 'Each query is compared with every key (a dot product) to score relevance.' },
          { q: 'Why are attention scores scaled by 1/√dₖ?', options: ['To keep softmax from saturating', 'To make the model smaller', 'To remove the bias', 'To sort the tokens'], why: 'Large dot products push softmax into flat regions; scaling keeps gradients healthy.' },
        ],
      },
    ],
  },
];
