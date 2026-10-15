# Issue 3: In-Depth Curriculum & Quiz Generation Engine with NVIDIA Nemotron

**Labels:** `backend`, `ai`, `nemotron`, `priority-critical`  
**Target Files:** `backend/generator.py` [NEW], `backend/main.py`, `backend/requirements.txt`

---

## 🎯 Goal
Implement the core course synthesis endpoint `POST /api/courses/generate` powered by NVIDIA's **Nemotron** model on Nebius AI Studio, converting a learner's goal or uploaded PDF documents into a deeply structured curriculum with massive, high-variety question banks (15–20 questions per topic).

---

## 📋 Problem Statement
The frontend already features the "Course Forge" modal (`CurriculumSetup.tsx`) and initiates an HTTP POST request to `/api/courses/generate` via `frontend/src/core/courseApi.ts`. However, the backend endpoint does not yet exist! Currently, the app silently falls back to local static template generation.

Furthermore, a top requirement for this hackathon is utilizing **NVIDIA Nemotron** to create deep, non-"AI-ish", textbook-quality lessons with extensive, application-oriented question pools so users do not encounter repetitive quizzes.

---

## 🛠️ Required Technical Implementation

### 1. Endpoint Contract (`POST /api/courses/generate`)
* **Content-Type:** `multipart/form-data`
* **Request Fields:**
  * `mode`: `"goal" | "documents"`
  * `level`: `"beginner" | "intermediate" | "advanced"`
  * `objective`: string (required if `mode == "goal"`)
  * `files`: array of binary PDF uploads (required if `mode == "documents"`)
  * `focus`: optional string focus
  * `structure`: `"chapters" | "topics"`

### 2. PDF Parsing Module (`backend/generator.py`)
* Add `pypdf` or `pdfplumber` to `backend/requirements.txt`.
* If `mode == "documents"`, read the uploaded binary PDF files, extract clean text page-by-page, sanitize whitespace, and construct a concise contextual summary (up to 12,000 tokens) to pass to the Nemotron LLM.

### 3. Nemotron Model Integration
* Target Nebius AI Studio: `https://api.studio.nebius.com/v1/chat/completions`.
* **Model:** NVIDIA Nemotron (`nvidia/nemotron-4-340b-instruct` or specified model in `NOVA_GENERATE_MODEL`).
* **Prompt Engineering Strategy:**
  * System prompt instructs the model to act as a senior curriculum architect and master textbook author.
  * Must strictly output JSON conforming to the `Course` schema in `frontend/src/core/courseSchema.ts`.
  * Every topic must contain:
    * `title`, `planet` name, estimated `minutes`.
    * Rich `lesson.blocks`: `text`, `callout`, `keyTerms`, `formula`, `code`, `steps`, and `summary`.
    * **In-Depth Question Pool (`quiz` array):** At least **15 to 20 unique questions per topic**. Questions must be practical and application-oriented, testing comprehension of real scenarios (not just verbatim definitions).
    * Supported Question Types:
      * `mcq`: Multiple choice with 4 options and `answer` index.
      * `msq`: Multiple select with 4 options and array of correct indexes.
      * `truefalse`: Binary choice with boolean `answer`.
      * `fill`: Sentence completion with correct string `answer`.
      * `code`: Code challenge with expected solution string.

### 4. Schema Sanitization & Validation
* Parse and validate the returned JSON using Pydantic before responding to the frontend.
* Assign stable unique IDs: `course.id`, `module.id`, `topic.id` (e.g. `mod-1`, `mod-2`, `top-1-1`).
* Return HTTP 200 with the complete `Course` JSON object.

---

## ✅ Acceptance Criteria
- [ ] `POST /api/courses/generate` handles goal-based course generation in under 30 seconds.
- [ ] `POST /api/courses/generate` extracts text from uploaded PDFs and structures a customized course.
- [ ] Returned JSON strictly satisfies the frontend `Course` TypeScript interface.
- [ ] Generated topics include between 15 and 20 diverse questions per topic with zero duplicates.
- [ ] Backend gracefully handles Nebius rate limits or timeouts, returning an informative HTTP 502/503.
