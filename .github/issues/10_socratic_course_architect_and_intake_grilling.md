# Issue 10: Socratic Course Architect — Interactive Diagnostic Intake ("Grilling") & Deep Modular Curriculum Synthesis

**Labels:** `skill`, `backend`, `ai`, `ux`, `curriculum`, `priority-high`  
**Target Files:** `backend/socratic_forge.py` [NEW], `backend/generator.py`, `frontend/src/ui/app/CurriculumSetup.tsx`

---

## 🎯 Goal
Create an intelligent **Socratic Course Architect** skill and backend pipeline that actively interviews ("grills") the user about their background, learning goals, prerequisites, and target projects before custom-synthesizing a tailored multi-module, deep-subsection course with comprehensive question banks.

---

## 📋 Problem Statement
Currently, when a user enters a topic into the Course Forge (e.g., *"I want to learn Rust"* or *"Machine Learning"*), a one-shot generation prompt is sent. This often produces generic, textbook-standard courses that:
1. Don't know what the user already knows (wasting time explaining basic concepts they already master, or skipping complex prerequisites they lack).
2. Don't know the user's specific end goal (e.g., building high-frequency trading engines vs. WebAssembly frontend vs. embedded robotics).
3. Do not allow the user to co-design and refine the module hierarchy and subsections before content generation begins.

To make the learning platform truly personalized, the system must act as an expert academic advisor that **diagnostically interviews ("grills")** the learner to extract their exact needs, then builds tailored modules and in-depth subsections.

---

## 🛠️ Required Technical Implementation

### 1. Interactive Diagnostic Intake Protocol ("The Grill")
Implement a multi-turn Socratic conversation endpoint (`POST /api/courses/forge/interview`):
* **Turn 1 — Background & Depth Calibration:**
  * When the user gives an initial objective, NOVA probes their actual current knowledge:
    * *"What languages/math have you used before?"*
    * *"Are we starting from scratch, or should we skip introductory syntax and jump straight into memory models?"*
* **Turn 2 — Practical Outcome / Capstone Elicitation:**
  * NOVA drills into the specific goal:
    * *"What concrete project or milestone do you want to build by the final planet?"*
* **Turn 3 — Architectural Preference & Modality:**
  * *"Do you prefer code-first benchmarks, KaTeX mathematical proofs, or conceptual analogies?"*
  * *"How many modules and estimated hours per week fit your schedule?"*

---

### 2. Module & Subsection (Topic) Outline Generation
Once the interview concludes, the backend generates an interactive **Course Architecture Blueprint**:
* **Module Breakdown:** 3–6 structured modules organized in a pedagogical progression arc (Foundations → Core Mechanics → Production Patterns → Advanced Nuances & Failure Modes).
* **Subsection (Topic) Granularity:** 2–4 detailed subsections per module, each representing a distinct planet on the course route.
* **Blueprint Approval Interface:**
  * The frontend renders the proposed modules and subsections.
  * The user can rename, reorder, delete unneeded subsections, or click *"Add Subsection"* to insert a custom topic before the final synthesis.

---

### 3. Deep Subsection Synthesis & Question Generation
Once the user approves the blueprint, the backend generates:
* **Rich Lesson Blocks per Subsection:**
  * `overview`: Clear mental model and why this subsection matters.
  * `analogies` & `keyTerms`: Crucial definitions and intuitive metaphors.
  * `code` / `formula`: Production snippets and KaTeX expressions.
  * `steps`: Actionable step-by-step procedures.
  * `pitfalls`: Common mistakes to avoid.
* **In-Depth Question Bank:**
  * Generates 15–20 application-based practice questions per subsection (`mcq`, `msq`, `truefalse`, `fill`, `code`).

---

## ✅ Acceptance Criteria
- [ ] Backend exposes an interactive interview endpoint (`POST /api/courses/forge/interview`) that dynamically asks targeted diagnostic questions.
- [ ] Users with different backgrounds requesting the same subject receive completely different, tailored module blueprints (e.g. Python for Data Science vs Python for Web Backend).
- [ ] The user can review and customize the generated modules and subsections before locking in the course.
- [ ] Every generated subsection adheres to the strict `Course` schema and includes 15–20 varied practice questions.
