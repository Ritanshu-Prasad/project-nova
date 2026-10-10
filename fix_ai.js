const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/core/courseTemplates.ts');
let code = fs.readFileSync(file, 'utf8');

const aiContent = {
  1: { t: "Scalars, Vectors, and Tensors", txt: "In machine learning, data is represented mathematically. A scalar is a single number. A vector is a 1D array of numbers. A matrix is a 2D grid. A tensor is a generalization to n-dimensions. Most neural networks process data as multi-dimensional tensors." },
  2: { t: "Linear Transformations", txt: "A neural network layer is fundamentally a linear transformation (y = Wx + b) followed by a non-linear activation. The weight matrix W scales and rotates the input vector x, projecting it into a new representational space." },
  3: { t: "Derivatives and Gradients", txt: "To train a network, we need to know how changing a weight affects the error. The derivative tells us the slope of a function at a point. The gradient is simply a vector containing the partial derivatives for all weights in the network." },
  4: { t: "The Chain Rule", txt: "Neural networks are nested functions: f(g(x)). To find the derivative of the loss with respect to the first layer, we use the chain rule from calculus. This is the mathematical foundation of backpropagation." },
  5: { t: "Probability Distributions", txt: "Many ML models output probabilities. For example, a classifier doesn't just say 'Cat'; it outputs a probability distribution (e.g., 90% Cat, 10% Dog). Softmax is the function used to convert raw scores (logits) into a valid probability distribution." },
  6: { t: "Expected Value & Entropy", txt: "Cross-entropy loss measures the difference between two probability distributions: the model's prediction and the true label. Minimizing cross-entropy is equivalent to maximizing the likelihood of the training data under the model." },
  7: { t: "Activation Functions: ReLU", txt: "Without activation functions, a deep neural network collapses into a single linear transformation. ReLU (Rectified Linear Unit) is f(x) = max(0, x). It is computationally cheap and helps prevent the vanishing gradient problem." },
  8: { t: "Mean Squared Error vs Cross Entropy", txt: "For regression tasks (predicting a continuous number), Mean Squared Error (MSE) is the standard loss function. For classification tasks, Cross-Entropy is preferred because it penalizes confident wrong answers much more heavily." },
  9: { t: "The Vanishing Gradient Problem", txt: "In very deep networks using Sigmoid or Tanh activations, the gradients can become infinitesimally small as they propagate backwards. This means the earliest layers never update their weights and stop learning." },
  10: { t: "Stochastic Gradient Descent (SGD)", txt: "Instead of calculating the gradient over the entire massive dataset (which is too slow), SGD calculates the gradient on a small random 'batch' of data. This introduces noise but drastically speeds up the optimization process." },
  11: { t: "L1 and L2 Regularization", txt: "To prevent overfitting, we add a penalty to the loss function based on the size of the weights. L1 regularization (Lasso) forces many weights to become exactly zero, while L2 (Ridge) forces weights to be small but non-zero." },
  12: { t: "Dropout", txt: "Dropout is a powerful regularization technique where, during training, random neurons are temporarily disabled ('dropped out') on each forward pass. This forces the network to learn robust, redundant representations rather than relying on a few specific neurons." },
  13: { t: "Images as Tensors", txt: "A color image is represented as a 3D tensor: Height x Width x Channels (RGB). A batch of images is a 4D tensor (Batch x H x W x C). Convolutional networks are specifically designed to process this spatial grid structure efficiently." },
  14: { t: "Strides and Padding", txt: "When applying a convolutional filter, 'stride' determines how many pixels the filter moves at a time. 'Padding' adds zeros around the border of the image to preserve the spatial dimensions after a convolution." },
  15: { t: "1x1 Convolutions", txt: "A 1x1 convolution looks at a single pixel across all channels. It is mathematically equivalent to a standard Dense layer applied to every pixel independently. It is primarily used to reduce the depth (number of channels) of a feature map." },
  16: { t: "Global Average Pooling", txt: "Instead of flattening a massive spatial feature map into a 1D vector (which requires millions of parameters), Global Average Pooling takes the average value of each channel across the entire spatial dimensions. This drastically reduces overfitting." },
  17: { t: "Residual Connections (ResNet)", txt: "In ultra-deep networks, adding layers actually degrades performance. ResNets solve this using 'skip connections' (x + f(x)), allowing gradients to flow directly backwards through the network. This allowed networks to go from 20 layers to 152+ layers." },
  18: { t: "Word Embeddings", txt: "Words cannot be fed directly into a neural network. Word embeddings (like Word2Vec) map discrete words into a continuous, dense vector space where semantic relationships are captured by geometric distances (e.g., King - Man + Woman = Queen)." },
  19: { t: "The Problem with RNNs", txt: "RNNs process sequences step-by-step. This sequential nature prevents parallelization on GPUs, making them very slow to train. Furthermore, despite LSTMs, they struggle to retain information from the very beginning of a long sequence." },
  20: { t: "Bidirectional RNNs", txt: "Sometimes, understanding a word requires context from the future. 'He swung the bat and hit the ball.' To know 'bat' is a sports item, you need to see 'hit the ball'. Bidirectional RNNs process the sequence forwards and backwards simultaneously." },
  21: { t: "LSTMs: Forget and Input Gates", txt: "An LSTM cell uses 'gates' to control information flow. The Forget gate decides what past information to throw away. The Input gate decides what new information to add. This allows LSTMs to maintain a long-term memory state." },
  22: { t: "Positional Encoding", txt: "Because Transformers do not process sequences step-by-step, they have no inherent concept of word order. Positional encodings are mathematical sine/cosine waves added to the word embeddings so the network knows the position of each word." },
  23: { t: "RLHF: Alignment", txt: "Raw LLMs are just text predictors; they might generate toxic or useless text. Reinforcement Learning from Human Feedback (RLHF) uses human raters to score the model's outputs. A 'Reward Model' learns these preferences, and PPO is used to fine-tune the LLM to maximize this reward." }
};

let matchCount = 0;

for (let i = 1; i <= 23; i++) {
  const id = 'ai-gen-' + i;
  const t = aiContent[i];
  if (!t) continue;
  
  const regex = new RegExp(`topic\\('${id}'[\\s\\S]*?\\\]\\)`);
  
  const replacement = `topic('${id}', '${t.t.replace(/'/g, "\\'")}', 'Vectoris', 'concept', 'Explore deep learning mechanics.', {
    minutes: 6,
    objectives: ['Understand mathematical foundations', 'Implement neural architectures'],
    simple: 'A detailed look at Artificial Intelligence.',
    blocks: [
      { type: 'text', body: '${t.txt.replace(/'/g, "\\'")}' },
      { type: 'summary', points: ['Mathematical intuition', 'Architectural logic', 'Optimization'] }
    ]
  }, [
    mcq('Why is this concept crucial for Deep Learning?', ['It enables the network to learn complex patterns.', 'It renders the UI.', 'It connects to a SQL database.', 'It writes CSS.'], 'Neural networks rely on calculus and linear algebra to optimize their weights.'),
    tf('Deep learning models are magic boxes with no mathematical basis.', false, 'They are entirely deterministic mathematical functions optimized via calculus.')
  ])`;
  
  if (regex.test(code)) {
    code = code.replace(regex, replacement);
    matchCount++;
  }
}

fs.writeFileSync(file, code);
console.log('Fixed ' + matchCount + ' AI topics!');
