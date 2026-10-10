import type { Topic } from '../courseSchema';

/**
 * Core topics that fill the gaps in the Neural Networks and Linear Algebra layouts (modules whose planned topics
 * were never written). Ids use the `-core-` prefix so they never clash with generated `-gen-` topics.
 */
export const coreTopics: Topic[] = [
  {
    id: 'ai-core-1',
    title: 'The Forward Pass',
    planet: 'Antares',
    kind: 'math',
    summary: 'How an input flows layer by layer to become a prediction.',
    lesson: {
      minutes: 8,
      objectives: ['Trace an input through a two-layer network by hand', 'Explain a layer as weights, bias and activation', 'Name the values cached for backpropagation'],
      simple: 'Data enters at the bottom, each layer reshapes it a little, and a prediction comes out at the top.',
      blocks: [
        {
          type: 'text',
          title: 'Layer by layer',
          body: 'A forward pass turns an input vector x into a prediction ŷ. Each layer computes a weighted sum per neuron, z = Wx + b, and then applies an activation such as ReLU: a = f(z). The output of one layer becomes the input of the next, so a three-layer network is one nested function: f₃(W₃ f₂(W₂ f₁(W₁x + b₁) + b₂) + b₃).',
        },
        { type: 'formula', expr: 'a[l] = f(W[l] · a[l−1] + b[l])', caption: 'Layer [l] takes the previous layer’s activations a[l−1], applies its weights and bias, then the activation f.' },
        {
          type: 'example',
          title: 'A tiny network by hand',
          body: 'Input x = (1, 2). Hidden layer: W₁ = [[0.5, −1], [1, 1]], b₁ = (0, −1). Then z = (0.5·1 − 1·2, 1·1 + 1·2 − 1) = (−1.5, 2), and ReLU gives a = (0, 2). Output layer: w₂ = (3, 0.5), b₂ = 1, so ŷ = 0·3 + 2·0.5 + 1 = 2.',
        },
        { type: 'steps', title: 'One forward pass', steps: ['Multiply the inputs by the layer’s weight matrix', 'Add the bias vector', 'Apply the activation function', 'Feed the result to the next layer', 'Read the final layer as the prediction'] },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Pre-activation (z)', def: 'The weighted sum Wx + b before the activation is applied.' },
            { term: 'Activation (a)', def: 'A layer’s output after the non-linearity, e.g. ReLU(z).' },
            { term: 'Logits', def: 'Raw scores from the final layer, before softmax turns them into probabilities.' },
          ],
        },
        { type: 'callout', tone: 'tip', body: 'Frameworks cache every z and a during the forward pass — backpropagation reuses them to compute gradients without recomputing anything.' },
        { type: 'summary', points: ['Each layer: weighted sum, bias, activation', 'Each layer’s output feeds the next', 'Activations are cached for backprop'] },
      ],
    },
    quiz: [
      { type: 'mcq', q: 'In z = Wx + b, what does each row of W hold?', options: ['The weights of one neuron', 'One training example', 'The biases of the layer', 'The learning rate'], answer: 0, why: 'Each row of W is one neuron’s weights; multiplying it by x gives that neuron’s weighted sum.', difficulty: 1 },
      { type: 'truefalse', q: 'Without activation functions, stacking more layers lets a network model non-linear patterns.', answer: false, why: 'Linear layers compose into a single linear map, so depth adds nothing without non-linearity.', difficulty: 1 },
      { type: 'fill', q: 'The raw scores of the final layer, before softmax, are called ____.', answer: 'logits', accept: ['logit'], why: 'Logits are the unnormalised outputs that softmax converts to probabilities.', difficulty: 2 },
      { type: 'multi', q: 'Which values are cached during the forward pass for backpropagation?', options: ['Pre-activations z', 'Activations a', 'The learning rate', 'The test labels'], answers: [0, 1], why: 'Backprop needs each layer’s z and a to compute local gradients.', difficulty: 2 },
    ],
  },
  {
    id: 'ai-core-2',
    title: 'Convolution Filters',
    planet: 'Capella',
    kind: 'math',
    summary: 'Small sliding windows that detect edges, textures and shapes.',
    lesson: {
      minutes: 8,
      objectives: ['Compute an output pixel of a 3×3 convolution', 'Explain weight sharing', 'Work out the output size from kernel, stride and padding'],
      simple: 'A filter is a little stamp that slides over the image and lights up wherever it finds its pattern.',
      blocks: [
        {
          type: 'text',
          title: 'Sliding and summing',
          body: 'A convolutional filter (or kernel) is a small grid of weights, usually 3×3. It slides across the image; at each position it multiplies the pixels under it by its weights and adds them up into a single output value. The grid of outputs — a feature map — is bright wherever the filter’s pattern appears.',
        },
        {
          type: 'text',
          title: 'Why convolutions are efficient',
          body: 'The same filter is reused at every position (weight sharing). A 3×3 filter on an RGB image has only 3·3·3 + 1 = 28 parameters, however large the image is. A dense layer connecting a 224×224×3 image to just 64 neurons would need about 9.6 million.',
        },
        { type: 'formula', expr: 'out = ⌊(n + 2p − k) / s⌋ + 1', caption: 'Output width for input width n, padding p, kernel size k and stride s.' },
        { type: 'example', title: 'An edge detector', body: 'The kernel [[−1, 0, 1], [−1, 0, 1], [−1, 0, 1]] responds strongly where brightness jumps from left to right — a vertical edge — and outputs zero over flat regions.' },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Kernel', def: 'The small grid of weights that slides over the input.' },
            { term: 'Feature map', def: 'The output grid produced by one filter.' },
            { term: 'Weight sharing', def: 'Using the same kernel weights at every position.' },
            { term: 'Receptive field', def: 'The region of the input that influences one output value.' },
          ],
        },
        { type: 'summary', points: ['Filters slide, multiply and sum', 'Weight sharing keeps parameters small', 'Deeper layers see larger patterns'] },
      ],
    },
    quiz: [
      { type: 'mcq', q: 'A 32×32 input, a 5×5 kernel, stride 1 and no padding: what is the output width?', options: ['28', '32', '27', '30'], answer: 0, why: '(32 + 0 − 5) / 1 + 1 = 28.', difficulty: 2 },
      { type: 'truefalse', q: 'Because of weight sharing, a convolution layer’s parameter count grows with the image size.', answer: false, why: 'The same kernel is reused everywhere, so parameters depend on kernel size and channels, not image size.', difficulty: 1 },
      { type: 'fill', q: 'The output grid produced by one filter is called a feature ____.', answer: 'map', why: 'Each filter produces one feature map.', difficulty: 1 },
      { type: 'mcq', q: 'What does the kernel [[−1, 0, 1], [−1, 0, 1], [−1, 0, 1]] detect?', options: ['Vertical edges', 'Horizontal edges', 'Uniform colour', 'Overall brightness'], answer: 0, why: 'It compares the right column with the left one, so it fires on left-to-right brightness changes.', difficulty: 2 },
    ],
  },
  {
    id: 'ai-core-3',
    title: 'How an RNN Works',
    planet: 'Deneb',
    kind: 'concept',
    summary: 'A loop that carries a memory from one step of a sequence to the next.',
    lesson: {
      minutes: 8,
      objectives: ['Write the hidden-state update of a simple RNN', 'Explain why the same weights are used at every step', 'Describe backpropagation through time'],
      simple: 'An RNN reads a sentence one word at a time and keeps a running note of what it has read so far.',
      blocks: [
        {
          type: 'text',
          title: 'A loop with memory',
          body: 'A recurrent neural network processes a sequence x₁, x₂, … one step at a time. At step t it combines the new input with its previous hidden state to produce a new one. The hidden state is the network’s memory of everything it has seen so far, and the same weights are reused at every step.',
        },
        { type: 'formula', expr: 'hₜ = tanh(Wₓ xₜ + Wₕ hₜ₋₁ + b)', caption: 'The same Wₓ, Wₕ and b are applied at every time step.' },
        { type: 'steps', title: 'Reading “the cat sat”', steps: ['Start with h₀ = 0', 'Read “the” → h₁', 'Read “cat” together with h₁ → h₂', 'Read “sat” together with h₂ → h₃', 'Use h₃ to predict the next word'] },
        {
          type: 'text',
          title: 'Training through time',
          body: 'To train an RNN we unroll it across the sequence and apply backpropagation through time (BPTT). Gradients are multiplied by Wₕ once per step, so over long sequences they tend to shrink towards zero (vanish) or blow up (explode) — the reason LSTMs and GRUs were invented.',
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Hidden state', def: 'The vector that carries information forward from earlier steps.' },
            { term: 'Unrolling', def: 'Drawing the RNN as one copy per time step so it can be trained.' },
            { term: 'BPTT', def: 'Backpropagation through time — backprop over the unrolled sequence.' },
          ],
        },
        { type: 'summary', points: ['The hidden state is a running memory', 'The same weights are used at every step', 'Long sequences cause vanishing or exploding gradients'] },
      ],
    },
    quiz: [
      { type: 'mcq', q: 'What does the hidden state hₜ represent?', options: ['A summary of the sequence up to step t', 'The next input token', 'The learning-rate schedule', 'The final loss'], answer: 0, why: 'hₜ folds every input so far into one vector.', difficulty: 1 },
      { type: 'truefalse', q: 'A simple RNN uses a different weight matrix at every time step.', answer: false, why: 'Weights are shared across time steps — that is what makes it recurrent.', difficulty: 1 },
      { type: 'fill', q: 'Training an unrolled RNN is called backpropagation through ____.', answer: 'time', why: 'BPTT applies backprop across the unrolled time steps.', difficulty: 1 },
      { type: 'multi', q: 'Which problems appear when training simple RNNs on long sequences?', options: ['Vanishing gradients', 'Exploding gradients', 'Too few inputs per step', 'Images cannot be used'], answers: [0, 1], why: 'Repeated multiplication by Wₕ makes gradients shrink or grow exponentially.', difficulty: 2 },
    ],
  },
  {
    id: 'ai-core-4',
    title: 'Encoder–Decoder and the Bottleneck',
    planet: 'Polaris',
    kind: 'concept',
    summary: 'Squeezing a whole sentence into one vector — and why that breaks.',
    lesson: {
      minutes: 7,
      objectives: ['Describe the roles of the encoder and the decoder', 'Explain the fixed-size bottleneck', 'Connect the bottleneck to the invention of attention'],
      simple: 'One network reads the whole sentence and writes a single summary note; another writes the translation using only that note.',
      blocks: [
        {
          type: 'text',
          title: 'Sequence to sequence',
          body: 'Seq2seq models map one sequence to another, such as English to Hindi. An encoder RNN reads the input and compresses it into its final hidden state, the context vector. A decoder RNN starts from that vector and generates the output one token at a time, feeding each prediction back in as its next input.',
        },
        { type: 'steps', title: 'Translating a sentence', steps: ['The encoder reads every input token', 'Its final hidden state becomes the context vector', 'The decoder receives the context and a start token', 'The decoder emits one token at a time', 'Generation stops at the end-of-sequence token'] },
        {
          type: 'text',
          title: 'The bottleneck',
          body: 'Every input — a three-word phrase or a fifty-word paragraph — has to fit into the same fixed-size context vector. Long inputs lose detail, and translation quality drops as sentences grow. Attention fixes this by letting the decoder look back at every encoder state instead of only the last one.',
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Encoder', def: 'The network that reads the input sequence into hidden states.' },
            { term: 'Decoder', def: 'The network that generates the output sequence token by token.' },
            { term: 'Context vector', def: 'The single vector passed from encoder to decoder in basic seq2seq.' },
            { term: 'Teacher forcing', def: 'Feeding the decoder the true previous token during training instead of its own guess.' },
          ],
        },
        { type: 'callout', tone: 'fact', body: 'The 2014 seq2seq paper by Sutskever et al. found that simply reversing the input sentence improved translation — a hint that the bottleneck was hurting long-range information.' },
        { type: 'summary', points: ['The encoder compresses, the decoder generates', 'One fixed-size vector is a bottleneck', 'Attention removes the bottleneck'] },
      ],
    },
    quiz: [
      { type: 'mcq', q: 'What is the context vector in a basic seq2seq model?', options: ['The encoder’s final hidden state', 'The first output token', 'The attention weights', 'The vocabulary size'], answer: 0, why: 'Basic seq2seq hands only the encoder’s last hidden state to the decoder.', difficulty: 1 },
      { type: 'truefalse', q: 'In basic seq2seq, a long sentence gets a larger context vector than a short one.', answer: false, why: 'The context vector has a fixed size — that is exactly the bottleneck.', difficulty: 1 },
      { type: 'fill', q: 'Feeding the decoder the true previous token during training is called teacher ____.', answer: 'forcing', why: 'Teacher forcing speeds up and stabilises seq2seq training.', difficulty: 2 },
      { type: 'mcq', q: 'Which idea removed the fixed-size bottleneck?', options: ['Attention over all encoder states', 'A larger learning rate', 'Dropout', 'Batch normalisation'], answer: 0, why: 'Attention lets the decoder weigh every encoder state at every step.', difficulty: 1 },
    ],
  },
  {
    id: 'ai-core-5',
    title: 'Inside a Transformer Block',
    planet: 'Rigel',
    kind: 'concept',
    summary: 'Attention, a small MLP, residuals and normalisation — stacked dozens of times.',
    lesson: {
      minutes: 9,
      objectives: ['List the sub-layers of a Transformer block in order', 'Explain residual connections and layer normalisation', 'Explain why multiple attention heads help'],
      simple: 'Each block lets every word look at the others, then think about what it saw — and the model repeats that many times.',
      blocks: [
        {
          type: 'text',
          title: 'Two sub-layers',
          body: 'A Transformer is a stack of identical blocks. Each block has two sub-layers: multi-head self-attention, which moves information between tokens, and a position-wise feed-forward network — a small MLP applied to each token independently. Each sub-layer is wrapped in a residual connection and layer normalisation.',
        },
        { type: 'formula', expr: 'Attention(Q, K, V) = softmax(QKᵀ / √dₖ) · V', caption: 'Scaled dot-product attention: queries are scored against keys, and the scores weight the values.' },
        { type: 'steps', title: 'One block (pre-norm)', steps: ['x → LayerNorm → multi-head attention → add back to x', 'x → LayerNorm → feed-forward MLP → add back to x', 'Pass x on to the next block'] },
        {
          type: 'text',
          title: 'Why many heads?',
          body: 'Each attention head has its own query, key and value projections, so different heads can track different relationships — one might link pronouns to the nouns they refer to, another might focus on neighbouring words. The heads’ outputs are concatenated and projected back to the model width.',
        },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Self-attention', def: 'Each token builds its new representation from a weighted mix of all tokens.' },
            { term: 'Multi-head attention', def: 'Several attention operations in parallel, each with its own projections.' },
            { term: 'Feed-forward network', def: 'An MLP applied to every token position separately.' },
            { term: 'Residual connection', def: 'Adds a sub-layer’s input to its output (x + f(x)) so gradients flow through deep stacks.' },
          ],
        },
        { type: 'summary', points: ['Attention mixes information between tokens', 'The MLP processes each token on its own', 'Residuals and LayerNorm keep deep stacks trainable'] },
      ],
    },
    quiz: [
      { type: 'mcq', q: 'Why divide by √dₖ in scaled dot-product attention?', options: ['To stop large dot products saturating the softmax', 'To normalise the vocabulary', 'To reduce the number of heads', 'To make attention causal'], answer: 0, why: 'Large dot products push softmax into regions with tiny gradients; scaling keeps them moderate.', difficulty: 2 },
      { type: 'truefalse', q: 'The feed-forward network inside a Transformer block mixes information between tokens.', answer: false, why: 'It is applied to each position independently; mixing between tokens happens in attention.', difficulty: 2 },
      { type: 'multi', q: 'Which are sub-layers of a standard Transformer block?', options: ['Multi-head self-attention', 'Feed-forward network', 'Convolutional pooling', 'Recurrent hidden state'], answers: [0, 1], why: 'A block is attention plus an MLP, each with a residual connection and normalisation.', difficulty: 1 },
      { type: 'fill', q: 'The x + f(x) shortcut around each sub-layer is called a ____ connection.', answer: 'residual', accept: ['skip'], why: 'Residual (skip) connections let gradients bypass sub-layers.', difficulty: 1 },
    ],
  },
  {
    id: 'ai-core-6',
    title: 'Pretraining: Next-Token Prediction',
    planet: 'Sirius',
    kind: 'concept',
    summary: 'How a language model learns by guessing the next word billions of times.',
    lesson: {
      minutes: 8,
      objectives: ['Explain the next-token objective', 'Describe tokens, the context window and the causal mask', 'Distinguish pretraining from fine-tuning'],
      simple: 'Show the model text with the next word hidden, let it guess, correct it — and repeat across a huge library of text.',
      blocks: [
        {
          type: 'text',
          title: 'One simple objective',
          body: 'A large language model is pretrained on a huge text corpus with one objective: predict the next token. Given “The capital of France is”, the model outputs a probability for every token in its vocabulary, and training raises the probability of “Paris”. Repeated over trillions of tokens, this forces the model to pick up grammar, facts and patterns of reasoning.',
        },
        { type: 'formula', expr: 'L = −Σₜ log p(xₜ | x₁, …, xₜ₋₁)', caption: 'The loss: negative log-likelihood of each true next token given everything before it.' },
        {
          type: 'text',
          title: 'Tokens and context',
          body: 'Text is split into tokens — common words or word pieces from a fixed vocabulary of tens of thousands of entries. The model only sees a limited number of recent tokens (its context window), and a causal mask ensures each position can attend only to earlier tokens, never to future ones.',
        },
        { type: 'steps', title: 'From raw text to assistant', steps: ['Collect and clean a large text corpus', 'Pretrain on next-token prediction', 'Fine-tune on instruction–response pairs', 'Align the model with human feedback (RLHF)'] },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Token', def: 'A word or word piece from the model’s vocabulary.' },
            { term: 'Context window', def: 'The maximum number of tokens the model can attend to at once.' },
            { term: 'Causal mask', def: 'Blocks attention to future positions during training and generation.' },
            { term: 'Fine-tuning', def: 'Further training a pretrained model on a smaller, targeted dataset.' },
          ],
        },
        { type: 'summary', points: ['The objective is to predict the next token', 'A causal mask hides the future', 'Pretrain broadly, then fine-tune and align'] },
      ],
    },
    quiz: [
      { type: 'mcq', q: 'What does a causal mask prevent?', options: ['A token attending to later tokens', 'Training on long documents', 'Using more than one attention head', 'Splitting rare words into pieces'], answer: 0, why: 'Each position may only use earlier tokens, matching how text is generated.', difficulty: 1 },
      { type: 'truefalse', q: 'Pretraining a language model requires a person to label every sentence.', answer: false, why: 'The next token is its own label, so plain text is enough — the training is self-supervised.', difficulty: 1 },
      { type: 'fill', q: 'The maximum number of tokens a model can see at once is its context ____.', answer: 'window', why: 'The context window limits how much text the model attends to.', difficulty: 1 },
      { type: 'mcq', q: 'Which step usually comes straight after pretraining?', options: ['Instruction fine-tuning', 'Training the tokeniser', 'Collecting the corpus', 'Choosing the vocabulary size'], answer: 0, why: 'Tokeniser and corpus come first; instruction tuning adapts the pretrained model to follow requests.', difficulty: 2 },
    ],
  },
  {
    id: 'la-core-1',
    title: 'Inverse Matrices & Solving Ax = b',
    planet: 'Altair',
    kind: 'math',
    summary: 'Undoing a transformation — and using it to solve linear systems.',
    lesson: {
      minutes: 8,
      objectives: ['Compute the inverse of a 2×2 matrix', 'Recognise when a matrix has no inverse', 'Solve Ax = b with an inverse'],
      simple: 'If a matrix moves points around, its inverse moves them back to where they started.',
      blocks: [
        {
          type: 'text',
          title: 'Undoing a transformation',
          body: 'The inverse A⁻¹ of a square matrix A undoes its transformation: A⁻¹A = AA⁻¹ = I. If A rotates the plane by 30°, A⁻¹ rotates it back by 30°. A matrix has an inverse exactly when its determinant is non-zero — a transformation that squashes space onto a line or a point has lost information and cannot be reversed.',
        },
        { type: 'formula', expr: '[[a, b], [c, d]]⁻¹ = 1/(ad − bc) · [[d, −b], [−c, a]]', caption: 'The 2×2 inverse: swap a and d, negate b and c, divide by the determinant.' },
        { type: 'example', title: 'Solving a system', body: 'Solve 2x + y = 5 and x + y = 3. Here A = [[2, 1], [1, 1]] and det(A) = 2·1 − 1·1 = 1, so A⁻¹ = [[1, −1], [−1, 2]]. Then (x, y) = A⁻¹(5, 3) = (5 − 3, −5 + 6) = (2, 1).' },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Inverse', def: 'The matrix A⁻¹ with A⁻¹A = I.' },
            { term: 'Identity matrix', def: 'I — ones on the diagonal, zeros elsewhere; it leaves vectors unchanged.' },
            { term: 'Singular matrix', def: 'A square matrix with determinant 0; it has no inverse.' },
          ],
        },
        { type: 'callout', tone: 'warning', body: 'In code, solve Ax = b directly (for example numpy.linalg.solve) rather than computing A⁻¹ first — it is faster and more numerically stable.' },
        { type: 'summary', points: ['A⁻¹ undoes A', 'An inverse exists only if det(A) ≠ 0', 'x = A⁻¹b solves Ax = b'] },
      ],
    },
    quiz: [
      { type: 'mcq', q: 'What is the inverse of [[2, 0], [0, 4]]?', options: ['[[0.5, 0], [0, 0.25]]', '[[−2, 0], [0, −4]]', '[[4, 0], [0, 2]]', 'It has no inverse'], answer: 0, why: 'A diagonal matrix inverts entry by entry: 1/2 and 1/4.', difficulty: 1 },
      { type: 'truefalse', q: 'A matrix with determinant 0 has an inverse.', answer: false, why: 'Determinant 0 means space is squashed, so the transformation cannot be undone.', difficulty: 1 },
      { type: 'fill', q: 'A square matrix with determinant zero is called ____.', answer: 'singular', why: 'Singular matrices are exactly the non-invertible ones.', difficulty: 1 },
      { type: 'mcq', q: 'If A⁻¹ = [[1, −1], [−1, 2]] and b = (5, 3), what is x = A⁻¹b?', options: ['(2, 1)', '(8, 1)', '(5, 3)', '(1, 2)'], answer: 0, why: '(1·5 − 1·3, −1·5 + 2·3) = (2, 1).', difficulty: 2 },
    ],
  },
  {
    id: 'la-core-2',
    title: 'Column Space & Null Space',
    planet: 'Bellatrix',
    kind: 'math',
    summary: 'Where a matrix can send vectors — and which vectors it crushes to zero.',
    lesson: {
      minutes: 8,
      objectives: ['Describe the column space as every possible output', 'Find the null space of a simple matrix', 'Check answers with rank–nullity'],
      simple: 'The column space is everywhere the matrix can reach; the null space is everything it squashes flat onto zero.',
      blocks: [
        {
          type: 'text',
          title: 'Two fundamental spaces',
          body: 'The column space of A is the span of its columns: every vector b for which Ax = b has a solution. Its dimension is the rank of A. The null space is the set of all x with Ax = 0 — the directions the transformation collapses onto the origin.',
        },
        { type: 'example', title: 'A rank-1 matrix', body: 'A = [[1, 2], [2, 4]]. The second column is twice the first, so the column space is the line through (1, 2) and the rank is 1. Ax = 0 means x₁ + 2x₂ = 0, so the null space is the line through (−2, 1).' },
        { type: 'formula', expr: 'rank(A) + nullity(A) = n', caption: 'Rank–nullity: for an m×n matrix, the output dimensions plus the collapsed dimensions equal the number of columns.' },
        {
          type: 'keyTerms',
          terms: [
            { term: 'Column space', def: 'All vectors Ax can produce — the span of A’s columns.' },
            { term: 'Null space', def: 'All x with Ax = 0.' },
            { term: 'Rank', def: 'The dimension of the column space.' },
            { term: 'Nullity', def: 'The dimension of the null space.' },
          ],
        },
        { type: 'summary', points: ['Column space = every reachable output', 'Null space = inputs sent to zero', 'rank + nullity = number of columns'] },
      ],
    },
    quiz: [
      { type: 'mcq', q: 'For A = [[1, 2], [2, 4]], what is the rank?', options: ['1', '2', '0', '4'], answer: 0, why: 'The columns are parallel, so they span only a line.', difficulty: 1 },
      { type: 'truefalse', q: 'The zero vector is always in the null space.', answer: true, why: 'A·0 = 0 for every matrix A.', difficulty: 1 },
      { type: 'fill', q: 'The dimension of the column space is called the ____.', answer: 'rank', why: 'Rank measures how many independent output directions A has.', difficulty: 1 },
      { type: 'mcq', q: 'A 3×5 matrix has rank 3. What is its nullity?', options: ['2', '3', '5', '0'], answer: 0, why: 'Rank–nullity: 5 − 3 = 2.', difficulty: 2 },
    ],
  },
];
