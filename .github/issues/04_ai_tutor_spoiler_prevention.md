# Issue 4: AI Tutor Chat Optimization & Quiz Spoiler Prevention

**Labels:** `backend`, `ai`, `tutor`, `priority-high`  
**Target Files:** `backend/main.py`

---

## 🎯 Goal
Upgrade the interactive AI tutor service (`POST /api/tutor/chat`) to use the NVIDIA Nemotron model on Nebius AI Studio, implement high-speed Server-Sent Events (SSE) streaming, and ensure in-chat practice questions never repeat or spoil formal module exam questions.

---

## 📋 Problem Statement
In `backend/main.py`, the AI Tutor model is currently pointing to a placeholder Llama model string (`meta-llama/Llama-3.3-70B-Instruct`). For hackathon evaluation, this must be switched to **NVIDIA Nemotron** (`nvidia/nemotron-4-340b-instruct` or specified in `NOVA_TUTOR_MODEL`).

Additionally, when a learner asks NOVA in the chat to quiz them on the lesson, NOVA must act as a creative **Practice Arena**. It must generate brand-new, unseen questions on the fly and strictly avoid any questions that appear in the course's graded module assessment (passed in the `avoid` list).

---

## 🛠️ Required Technical Implementation

### 1. Model Configuration (`backend/main.py`)
* Update default model to NVIDIA Nemotron:
  ```python
  TUTOR_MODEL = os.getenv("NOVA_TUTOR_MODEL", "nvidia/nemotron-4-340b-instruct")
  ```

### 2. Prompt Tuning for Practice Arena & Anti-Spoiler Logic
* Expand `TUTOR_PROMPT` to enforce:
  1. **Strict Context Alignment:** Ground answers in the lesson text provided in the prompt.
  2. **Spoiler Avoidance:** Read the `avoid` list sent by the frontend (`TutorContext.avoid`). Explicitly instruct the model:
     *"Under no circumstances generate or mention any question that appears in the Graded Questions list below. Formulate completely novel questions testing the same concepts from a different angle."*
  3. **Interactive Format:** Ask one question at a time. Wait for user response. Provide encouraging explanations with zero MMR stakes.

### 3. Resilient Streaming (`StreamingResponse`)
* Enhance the `relay()` generator:
  * Parse OpenAI-compatible SSE chunks (`data: {...}`).
  * Protect against broken client pipes (e.g. if the user closes the side panel mid-stream).
  * Automatically catch upstream Nebius timeout or connection drops and terminate the stream cleanly.

---

## ✅ Acceptance Criteria
- [ ] AI Tutor responds using NVIDIA Nemotron on Nebius AI Studio.
- [ ] Asking NOVA "Quiz me on this" generates novel practice questions that do NOT match any questions in the module assessment.
- [ ] SSE streaming delivers text smoothly into the frontend chat interface with minimal latency (<1s time-to-first-token).
- [ ] Connection drops or closing the chat window does not produce unhandled Python tracebacks.
