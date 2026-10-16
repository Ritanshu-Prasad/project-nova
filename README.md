# 🚀 Project NOVA

> Autonomous, gamified 3D learning platform built for the **Nebius x NVIDIA Global AI Hackathon**.

Project NOVA transforms self-directed learning into an interplanetary journey. Powered by **NVIDIA Nemotron** on **Nebius AI Studio**, NOVA synthesizes deep, textbook-quality curriculums, dynamically generates application-oriented practice quizzes, and provides real-time tutoring through an intelligent shipboard copilot.

---

## 🌌 Core Features

* **3D Cinematic Flight Deck:** Immersive WebGL cockpit and celestial lounge built with Three.js and React Three Fiber.
* **NVIDIA Nemotron Curriculum & Quiz Engine:** Generates structured multi-module courses with 15–20 high-variety questions per topic from learning goals or uploaded PDF documents.
* **Practice Arena AI Tutor:** Real-time streaming tutor that answers questions and generates un-spoiled, novel practice challenges.
* **Skill Journey & MMR Ladder:** 7-tier spaceship progression ladder (Probe → Titan) with real-time skill curve tracking and spaced-repetition assessment.
* **Fleet Leaderboard:** Global crew rankings comparing pilot XP, MMR, and cleared planets.
* **Avatar Studio & Doodle Pad:** Custom avatar image uploads and in-app canvas doodle drawing.

---

## 🛠️ Tech Stack

* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Three.js, React Three Fiber, Framer Motion, Zustand
* **Backend:** Python 3.11, FastAPI, Uvicorn, HTTPX, Pydantic, PyPDF
* **AI & Infrastructure:** NVIDIA Nemotron models via Nebius AI Studio, Upstash Redis, Vercel

---

## 🚀 Quick Start

### 1. Prerequisites
* Node.js 20+
* Python 3.11+

### 2. Environment Setup
```bash
cp .env.example .env
```
Populate your `NEBIUS_API_KEY` from [Nebius AI Studio](https://studio.nebius.ai/).

### 3. Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### 4. Backend Development
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000 --env-file .env
```

---

## 🧪 Testing

```bash
pip install -r backend/requirements-dev.txt
python -m pytest backend/tests -q          # backend, no network or API key needed

cd frontend
npm run check:contract                      # backend sample outputs vs the app's validators (Node 22.6+)
npm run test:e2e                            # browser tests with a mocked backend (npx playwright install chromium first)

cd ../backend
python -m evals.run_eval --cases smoke      # scores real generated courses (uses your NEBIUS_API_KEY and tokens)
```

`UPDATE_FIXTURES=1 python -m pytest backend/tests/test_contract.py` rewrites the sample outputs after an intentional change to the course format.

---

## 🛡️ Git Workflow & Contributing

Please review [`TEAM_GIT_WORKFLOW.md`](./TEAM_GIT_WORKFLOW.md) for contribution guidelines. 
All pushes are automatically verified by GitHub Actions CI to shield the live deployment.
