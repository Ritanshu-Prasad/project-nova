const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/core/courseTemplates.ts');
let code = fs.readFileSync(file, 'utf8');

const laContent = {
  1: { t: "Dot Product Geometric Interpretation", txt: "The dot product of two vectors tells you how much they point in the same direction. Geometrically, it is the length of the projection of vector A onto vector B, multiplied by the length of B. If they are perpendicular, the dot product is zero." },
  2: { t: "The Cross Product", txt: "While the dot product yields a scalar, the cross product of two 3D vectors yields a new vector that is perfectly orthogonal (perpendicular) to both original vectors. Its length represents the area of the parallelogram formed by the two vectors." },
  3: { t: "The Right-Hand Rule", txt: "To find the direction of a cross product (A x B), point your index finger in the direction of A and your middle finger in the direction of B. Your thumb will point in the direction of the resulting cross product vector." },
  4: { t: "Linear Combinations", txt: "A linear combination involves multiplying a set of vectors by scalar numbers and adding the results together. The entire coordinate system you use every day (x, y) is just a linear combination of the basis vectors i-hat and j-hat." },
  5: { t: "Span of Vectors", txt: "The 'span' of a set of vectors is the set of all possible points you can reach through linear combinations of those vectors. Two non-parallel 2D vectors span the entire 2D plane. Two parallel 2D vectors only span a single 1D line." },
  6: { t: "Linear Dependence", txt: "If you have a set of vectors, and one of them can be created by a linear combination of the others, that vector is redundant. The set is 'linearly dependent'. It adds no new dimensions to your span." },
  7: { t: "Basis Vectors", txt: "A 'basis' for a vector space is a set of linearly independent vectors that span the entire space. It is the minimum number of vectors needed to describe every point in that space. For 3D space, you need exactly 3 basis vectors." },
  8: { t: "Matrices as Transformations", txt: "Do not think of a matrix as just a grid of numbers. Think of it as a function that transforms space. When you multiply a vector by a matrix, you are stretching, rotating, or shearing the coordinate system itself." },
  9: { t: "Tracking the Basis Vectors", txt: "To understand what a 2x2 matrix transformation does to 2D space, you only need to know where it sends the two basis vectors (i-hat and j-hat). The columns of the matrix literally tell you the new coordinates of i-hat and j-hat." },
  10: { t: "Matrix Composition", txt: "Multiplying two matrices together (AB) is the geometric equivalent of applying transformation B, and then applying transformation A. Matrix multiplication is not commutative (AB != BA) because order matters when you rotate and shear space." },
  11: { t: "The Identity Matrix", txt: "The Identity Matrix (1s on the diagonal, 0s elsewhere) is the matrix equivalent of the number 1. It represents a transformation that does absolutely nothing to the space. Multiplying any matrix by the Identity Matrix leaves it unchanged." },
  12: { t: "Eigenvectors: The Unchanged", txt: "During a matrix transformation, most vectors get knocked off their original span. Eigenvectors are the special, rare vectors that stay on their exact original line after the transformation. They are only stretched or squished." },
  13: { t: "Eigenvalues: The Scale Factor", txt: "If an eigenvector stays on its original line during a transformation, the eigenvalue is the scalar number representing how much it was stretched or squished. An eigenvalue of 2 means the eigenvector doubled in length. An eigenvalue of -1 means it flipped direction." },
  14: { t: "Diagonalization", txt: "If a matrix has enough eigenvectors, you can change your coordinate system so the eigenvectors become the new basis vectors. In this new basis, the transformation matrix becomes diagonal, making calculations (like raising the matrix to a power) trivially easy." },
  15: { t: "Singular Value Decomposition", txt: "SVD is the crown jewel of linear algebra. It proves that ANY matrix transformation can be broken down into three simple steps: a rotation, a scaling along the axes, and another rotation. This is widely used in data compression and machine learning." }
};

let matchCount = 0;

for (let i = 1; i <= 15; i++) {
  const id = 'la-gen-' + i;
  const t = laContent[i];
  if (!t) continue;
  
  const regex = new RegExp(`topic\\('${id}'[\\s\\S]*?\\\]\\)`);
  
  const replacement = `topic('${id}', '${t.t.replace(/'/g, "\\'")}', 'Vectoris', 'concept', 'Explore linear algebra.', {
    minutes: 6,
    objectives: ['Understand geometric interpretations', 'Apply algebraic rules'],
    simple: 'A detailed look at Linear Algebra.',
    blocks: [
      { type: 'text', body: '${t.txt.replace(/'/g, "\\'")}' },
      { type: 'summary', points: ['Geometric intuition', 'Algebraic computation', 'Real-world application'] }
    ]
  }, [
    mcq('Why is this geometric intuition important?', ['It prevents memorizing blind formulas.', 'It helps you write HTML.', 'It replaces calculus.', 'It runs on the GPU.'], 'Visualizing the math makes the formulas intuitive.'),
    tf('Linear algebra only applies to 2D space.', false, 'The rules of linear algebra generalize to N-dimensional space.')
  ])`;
  
  if (regex.test(code)) {
    code = code.replace(regex, replacement);
    matchCount++;
  }
}

fs.writeFileSync(file, code);
console.log('Fixed ' + matchCount + ' Linear Algebra topics!');
