# Issue 7: Backend Containerization, Environment Templates & Deployment Setup

**Labels:** `devops`, `deployment`, `priority-high`  
**Target Files:** `Dockerfile` [NEW], `.env.example`, `backend/requirements.txt`

---

## 🎯 Goal
Create an optimized Docker containerization setup for the FastAPI backend, complete dependency specifications, and provide clear deployment instructions for Nebius Serverless Endpoints and Vercel.

---

## 📋 Problem Statement
Teammates cloning the repository do not have a standard Dockerfile to run the backend in a containerized environment, leading to "it works on my machine" issues. Additionally, deploying to Nebius Serverless Endpoints or cloud containers requires a standardized entrypoint and minimal image size.

---

## 🛠️ Required Technical Implementation

### 1. Multi-Stage Dockerfile (`Dockerfile`)
* Create a lightweight, production-ready Dockerfile:
  ```dockerfile
  FROM python:3.11-slim AS builder
  WORKDIR /app
  COPY backend/requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt

  FROM python:3.11-slim
  WORKDIR /app
  COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
  COPY --from=builder /usr/local/bin /usr/local/bin
  COPY backend/ ./backend
  EXPOSE 8000
  CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```

### 2. Dependency Freeze (`backend/requirements.txt`)
* Ensure all backend dependencies are explicitly declared with clean versions:
  * `fastapi>=0.115.0`
  * `uvicorn[standard]>=0.30.0`
  * `python-multipart>=0.0.9`
  * `httpx>=0.27.0`
  * `pydantic>=2.8.0`
  * `pypdf>=5.0.0` (for document extraction)

### 3. Nebius Serverless Deployment Documentation
* Document how to deploy the container image to **Nebius Serverless Endpoints** or cloud runtime:
  1. Build and tag image: `docker build -t nova-backend .`
  2. Push to container registry.
  3. Deploy endpoint with required environment variables (`NEBIUS_API_KEY`, `SESSION_SECRET`, etc.).
  4. Point frontend `VITE_COURSE_API` to the new Nebius deployment URL.

---

## ✅ Acceptance Criteria
- [ ] `docker build -t nova-backend .` builds successfully with zero errors.
- [ ] Container launches and serves `http://localhost:8000/api/health` with `status: healthy`.
- [ ] Requirements.txt contains all dependencies without conflicting version constraints.
