# 🚀 Project NOVA

<div align="center">

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-black?style=for-the-badge&logo=vercel)](https://project-nova-ai.vercel.app/)
[![Nebius AI Studio](https://img.shields.io/badge/Inference-Nebius_AI_Studio-blueviolet?style=for-the-badge&logo=cloud)](https://studio.nebius.ai/)
[![NVIDIA Nemotron](https://img.shields.io/badge/Model-NVIDIA_Nemotron-76B900?style=for-the-badge&logo=nvidia)](https://developer.nvidia.com/)
[![React 19](https://img.shields.io/badge/Frontend-React_19_%2B_Three.js-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](./LICENSE)

**Autonomous, Gamified 3D Learning Platform Built for the Nebius x NVIDIA Global AI Hackathon**

[Live Demo](https://project-nova-ai.vercel.app/) • [Nebius & NVIDIA Integration](#-nebius-ai-studio--nvidia-ai-integration) • [Core Features](#-core-features) • [Quick Start](#-quick-start) • [Evaluation](#-testing--evaluations) • [Credits](#-credits)

</div>

---

## 🌟 Overview & Hackathon Mission

Online self-directed education suffers from a notorious completion crisis: passive video lectures, rigid one-size-fits-all curricula, and static multiple-choice trivia leave learners disengaged and unprepared for practical problem-solving.

**Project NOVA** transforms self-directed learning into an interplanetary expedition. Powered by **NVIDIA Nemotron** models running on **Nebius AI Studio**, NOVA autonomously deconstructs any ambitious learning goal into a structured multi-planetary curriculum. Every station along the journey features interactive lessons, deep Socratic tutoring with zero-spoiler safety guards, application-driven multi-format assessments, and a 7-tier spaceship progression ladder (Probe → Titan) driven by real-time Elo rating (RR) and spaced-repetition retention curves.

> [!IMPORTANT]
> **Hackathon Track Alignment:**
> * **Autonomous AI Agents & Next-Gen Productivity:** Self-architecting course pipelines, dynamic diagnostic placement, and a real-time Socratic flight copilot.
> * **High-Performance Generative AI Inference:** Sub-second streaming responses, multi-stage curriculum structuring, and on-demand challenge synthesis powered by Nebius AI Studio's serverless token factory.

---

## ⚡ Nebius AI Studio & NVIDIA AI Integration

Project NOVA is built from the ground up to harness high-throughput serverless inference from **Nebius AI Studio** paired with the advanced reasoning capabilities of **NVIDIA Nemotron** models.

### 1. Nebius AI Studio: High-Throughput Serverless Token Factory
Nebius AI Studio acts as the foundational compute engine for NOVA, providing:
* **Sub-Second Streaming Inference:** Nebius AI Studio's high-speed Token Factory endpoints (`https://api.tokenfactory.nebius.com/v1`) deliver low-latency, sustained token streaming. This enables real-time generation of rich curricula and dynamic conversational turns with zero perceived latency for the pilot.
* **Serverless Elasticity:** Handles concurrent multi-turn pedagogical dialogues, real-time diagnostic scoring, and multi-module course synthesis without requiring dedicated cluster management or experiencing throttling timeouts.
* **Cost-Efficient Token Economics:** Enables granular tracking of prompt and completion token usage, ensuring complex educational synthesis remains cost-effective at scale.

### 2. NVIDIA Nemotron: Advanced Pedagogical Reasoning
NVIDIA Nemotron models provide the reasoning intelligence driving each layer of the learning experience:
* **Complex Schema Adherence & Structured Synthesis:**
  Curriculum generation requires generating deeply nested JSON structures—modules, topics, definitions, step-by-step analogies, formulas, and 15–20 questions per station. Nemotron models excel at strict JSON schema compliance, ensuring generated courses survive strict Pydantic and TypeScript runtime validation without malformed structures.
* **Autonomous Multi-Stage Course Generation:**
  NOVA transforms any user prompt (from "Quantum Computing Algorithms" to "Aviation Aerodynamics") into a cohesive planetary expedition. Nemotron autonomously structures the curriculum hierarchy, synthesizes conceptual foundations, authors intuitive real-world analogies, and formats actionable takeaways.
* **Socratic AI Tutor Copilot with Anti-Spoiler Guardrails:**
  Learners can summon their shipboard tutor at any point. Governed by prompt-guided pedagogical guardrails, the Nemotron-powered tutor diagnoses misconceptions, guides problem-solving through targeted hints, and creates practice variations without ever spoiling active quiz answers.
* **Adaptive Diagnostic Placement:**
  Learners uncertain of their starting level can launch a 5-question calibration flight. Nemotron evaluates the pilot's responses across difficulty tiers to calibrate the curriculum between `beginner`, `intermediate`, and `advanced`.
* **On-Demand Challenge & Question Bank Synthesis:**
  Instead of static question pools, Nemotron generates varied application-oriented challenges—including multiple-choice, multi-select, true/false, fill-in-the-blank, and live executable code exercises.
* **Preset Fast-Path vs. On-Demand Synthesis:**
  To guarantee immediate access to benchmark masterclasses (*Neural Networks to Transformers*, *Advanced React Patterns*, *Linear Algebra Basics*, *Cellular Biology*, and *English Essentials*), NOVA provides a local fast-path that loads instantly with zero token consumption, while reserving live Nemotron generation for custom user-defined learning goals.

---

## 🌌 Core Features

| Feature | Description | Powered By |
| :--- | :--- | :--- |
| **Cinematic 3D Flight Deck & Space World** | Real-time WebGL cockpit and celestial lounge with interactive lighting, reactive particles, and two-stage warp traversal. | Three.js, React Three Fiber, GLSL Shaders |
| **Autonomous Curriculum Architect** | Transforms any learning objective into structured modules and bite-sized planetary stations. | NVIDIA Nemotron on Nebius AI Studio |
| **Application-Driven Assessment Forge** | Multi-format quiz engine: MCQs, Multi-Select, True/False, Fill-in-the-Blank, and live executable code challenges. | Nemotron reasoning + Regex validation |
| **Socratic AI Tutor & Anti-Spoiler** | Real-time streaming tutor that answers questions, guides problem-solving, and prevents answer leaks. | Nebius streaming + Socratic guardrails |
| **7-Tier Spacecraft RR Ladder** | Elo-style skill rating ladder (*Probe → Scout → Corvet → Frigate → Cruiser → Battleship → Titan*) with spaced repetition. | Dynamic RR calibration + Ebbinghaus curve |
| **Fleet Leaderboard & Crew Rankings** | Real-time global crew standings comparing pilot XP, RR, cleared planets, and daily streaks. | Upstash Redis REST / Neon PostgreSQL |
| **Avatar Studio & Doodle Pad** | Upload custom flight patches or hand-draw pilot callsigns and avatars directly on an HTML5 canvas. | Canvas API + Local/Remote pilot store |
| **Preset Masterclasses** | Pre-authored textbook-quality courses for instant access without triggering models or token consumption. | In-memory authored content chunks |

---

## 🛠 Tech Stack

* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Three.js, React Three Fiber, `@react-three/drei`, Framer Motion, Zustand
* **Backend:** Python 3.11, FastAPI, Uvicorn, HTTPX, Pydantic v2, SlowAPI
* **AI & Cloud Infrastructure:** 
  * **Nebius AI Studio:** Serverless Token Factory (`https://api.tokenfactory.nebius.com/v1`)
  * **AI Models:** NVIDIA Nemotron reasoning models (`nvidia/Nemotron-3_5-Lightning`) for curriculum synthesis, question banks, and Socratic tutoring, with multi-stage planning support
  * **Datastores:** Upstash Redis, Neon PostgreSQL, Vercel Edge Cache
* **Verification & Testing:** Pytest, Playwright, Vitest, Node.js Contract Validator, GitHub Actions CI

---

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/Ritanshu-Prasad/project-nova.git
cd project-nova
```

### 2. Configure Environment Keys
Copy the example environment file:
```bash
cp .env.example .env
```

Add your Nebius AI Studio credentials in `.env`:
```env
NEBIUS_API_KEY=your_nebius_api_key_here
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1
```

### 3. Launch Frontend
```bash
cd frontend
npm install
npm run dev
```
The client will start at `http://localhost:5173`. The Vite development proxy automatically forwards `/api` requests to the local backend.

### 4. Launch Backend
In a separate terminal:
```bash
# From repository root:
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```
The FastAPI backend will start at `http://localhost:8000`. You can inspect the interactive OpenAPI documentation at `http://localhost:8000/docs`.

---

## 🧪 Testing & Evaluations

NOVA includes a multi-tier testing pipeline ensuring high schema fidelity and reliable AI outputs:

```bash
# 1. Backend Unit & Regression Suite (1,173 tests, zero network dependency)
pip install -r backend/requirements-dev.txt
pytest backend/tests -q

# 2. Frontend Test Suite (146 tests)
cd frontend
npm test -- --run

# 3. Frontend Contract Check (validates backend fixtures vs React TypeScript validators)
npm run check:contract

# 4. Production Build Validation
npm run build

# 5. Live Nemotron Evaluation Suite (evaluates pedagogical quality & token efficiency)
cd ../backend
python -m evals.run_eval --cases smoke
```

---

## 📊 Observability & Cost Tracking

NOVA includes a built-in admin dashboard for real-time observability:
* **Cost & Token Telemetry:** Tracks input/output token counts, pricing, and latency across Nebius model calls.
* **Course Quality Metrics:** Audits question validity, variety, and student error rates.
* Access the dashboard at `http://localhost:8000/admin` by supplying the `NOVA_ADMIN_TOKEN` configured in your `.env`.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 👥 Credits

Developed with ❤️ for the **Nebius x NVIDIA Global AI Hackathon** by:

* **Devansh Sangule**
* **Devjit Sarkar**
* **Ritanshu Prasad**
* **Shrinkhal**

---

## 🏆 Acknowledgements

Special thanks to **Nebius AI Studio** and **NVIDIA** for providing state-of-the-art serverless AI infrastructure, high-throughput token streaming, and powerful Nemotron reasoning models that made building Project NOVA possible.
