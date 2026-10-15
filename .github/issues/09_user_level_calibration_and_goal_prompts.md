# Issue 9: Adaptive User-Level Calibration & Goal Prompt Architecture

**Labels:** `backend`, `ai`, `pedagogy`, `priority-high`  
**Target Files:** `backend/generator.py`, `backend/prompts.py` [NEW]

---

## 🎯 Goal
Define and implement strict pedagogical calibration rules and prompt contracts that translate user level (`beginner`, `intermediate`, `advanced`) and raw user input (`objective`) into appropriately paced, depth-tailored curriculums and questions.

---

## 📋 Problem Statement
When a user requests a course on a topic (e.g. *"Quantum Computing"* or *"Neural Networks"*), the frontend passes:
* `objective`: raw user text (e.g. *"I want to master Transformers from scratch"*).
* `level`: `"beginner" | "intermediate" | "advanced"`.

Without strict pedagogical prompt definitions:
- An LLM often produces generic, mid-level content regardless of the selected level.
- A "beginner" user might be overwhelmed with dense mathematical proofs or unexplained code snippets.
- An "advanced" user might receive trivial dictionary definitions (e.g. *"A neural network is like a human brain"*), leading to boredom and dissatisfaction.
- Unsanitized user inputs could lead to prompt injection or hallucinated course structures.

---

## 🛠️ Required Technical Implementation

### 1. Pedagogical Calibration Matrix (`backend/prompts.py`)
Implement strict prompt guidelines injected into the Nemotron system prompt based on `req.level`:

#### A. Level: Beginner
* **Audience:** Novice with zero domain assumptions.
* **Tone & Approach:** Intuitive, welcoming, and grounded in relatable real-world analogies.
* **Math & Formalism:** Qualitative descriptions. Any necessary formulas must be introduced with step-by-step plain English explanations of each variable.
* **Code:** High-level, heavily commented pseudocode or simple scripts.
* **Question Pool Design:** Focus on core intuition, concept recognition, taxonomy matching, and avoiding common misconceptions.

#### B. Level: Intermediate
* **Audience:** Practitioner with standard foundational knowledge (undergrad or 1–2 years industry experience).
* **Tone & Approach:** Applied, architectural, mechanism-oriented.
* **Math & Formalism:** Standard equations, vectors/matrices, standard loss functions, performance trade-offs.
* **Code:** Production-like code snippets (idiomatic Python/TypeScript, PyTorch, React hooks).
* **Question Pool Design:** Multi-select edge cases, predicting code execution outputs, troubleshooting bugs, comparing alternative implementations.

#### C. Level: Advanced
* **Audience:** Senior engineer, researcher, or specialist seeking state-of-the-art mastery.
* **Tone & Approach:** Highly technical, rigorous, focused on internal mechanics, failure modes, and hardware/compiler optimization.
* **Math & Formalism:** Complete mathematical rigor (LaTeX/KaTeX formulas: derivations, loss gradients, algorithmic bounds, matrix dimensions).
* **Code:** Low-level implementations, custom kernels, distributed patterns, memory management.
* **Question Pool Design:** Complex architectural trade-offs, debugging subtle race conditions or memory leaks, multi-step calculation challenges.

---

### 2. User Input Sanitization & Goal Decomposition
* **Sanitization:** Strip special instruction escape sequences, control characters, and prompt injection attempts from `req.objective`.
* **Syllabus Sizing Heuristic:**
  * Narrow/Targeted Objective (e.g. *"Docker container networking"*): Generate 3 focused modules, 2–3 topics per module.
  * Broad/Comprehensive Objective (e.g. *"Full Stack Deep Learning"*): Generate 5–6 comprehensive modules, 3–4 topics per module.
* **Progression Arc:** Ensure modules follow a natural learning progression:
  1. *Foundations & Conceptual Mental Model*
  2. *Core Mechanics & Working Machinery*
  3. *Deep Dive / Implementation Patterns*
  4. *Advanced Scenarios, Optimization & Failure Modes*

---

## ✅ Acceptance Criteria
- [ ] Generating the same topic (e.g. "Attention Mechanisms") at `beginner` vs `advanced` yields distinctly calibrated content:
  * Beginner uses analogies and qualitative explanations.
  * Advanced includes matrix dimension equations ($Q, K, V \in \mathbb{R}^{n \times d_k}$) and scaled dot-product attention derivations.
- [ ] Question pools for `advanced` test rigorous edge cases and code implementation rather than basic vocabulary.
- [ ] Malformed or adversarial user objectives are sanitized and do not break JSON schema output.
