# 🎯 Project Nova - Problem Statement & Execution Plan

## 1. The Problem Statement
Modern digital learning platforms are often static, delivering one-size-fits-all content that fails to adapt to a student's actual cognitive load and mastery level. Conversely, pure AI chatbots are too unconstrained, leading to hallucinated curriculums, verbose answers, and high token costs. 

**The Goal:** To build a structured, AI-powered tutoring platform that acts like a game of "PvE" (Player vs. Environment). It must accurately diagnose a user's skill level and use an **MMR (Matchmaking Rating)** system to dynamically scale the difficulty of questions and lessons. It must be highly modular, cost-efficient, and visually engaging without relying on superficial gamification mechanics (like avatars or leagues).

---

## 2. Core Architecture & Stack
- **Frontend:** React, TypeScript, Tailwind CSS (v4) - Deployed to Vercel.
- **Backend:** PostgreSQL (with `pgvector` for similarity search). API orchestration via FastAPI (Python) or Node.js.
- **AI / Inference:** Nebius AI Studio / NVIDIA NIMs (Nemotron-3, LLaMA, or Gemini/Claude via user-supplied API keys).
- **Authentication:** Direct Google OAuth (no native email/password tables).

---

## 3. Scope & Feature Boundaries (MVP)

### ✅ INCLUDED in MVP:
1. **Diagnostic Placement Quiz:** A short onboarding quiz to accurately establish a baseline (Beginner/Intermediate/Advanced) rather than trusting self-reported competence.
2. **Adaptive MMR Questioning:** Dynamic difficulty ramping based on response accuracy and time-to-answer.
3. **Single-Feed Progression:** A clean, scrollable timeline of lessons and questions (dynamic grid/tile layouts).
4. **Contextual Feedback Controls:** Quick-action buttons below lessons (e.g., *"Explain in simpler terms"*, *"Skip concept"*).
5. **RAG Pipeline:** Document chunking, vector embeddings (~768 dimensions), and cosine similarity retrieval for prompt augmentation.
6. **Token Guardrails:** Strict input/output token caps enforced on the backend to maintain concise, focused AI responses.

### 🛑 EXCLUDED from MVP (To prevent scope creep):
1. **Heavy Gamification:** XP leagues, avatars, cosmetic unlocks, and streak mechanics are postponed.
2. **Complex Visualizations:** Obsidian-style interconnected graph visualizations are deferred.
3. **Advanced Ingestion:** Raw handwritten PDF extraction engines and complex calendar integrations are cut.

---

## 4. Engineering Methodology
- **Modular Design:** Strictly build small, explainable, and testable modules (e.g., granular `.tsx` components). 
- **No Monoliths:** Ban black-box monolithic AI code dumps to prevent technical debt.
- **Prompt Engineering:** Hardcode prompt templates on the backend using fixed input slots rather than exposing unconstrained free-text prompts to the user.

---
*Derived from team alignment syncs on Sept 11th & 13th, 2026*
