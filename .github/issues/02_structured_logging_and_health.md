# Issue 2: Structured Backend Logging, Request Tracing & Health Monitoring

**Labels:** `backend`, `observability`, `priority-medium`  
**Target Files:** `backend/main.py`

---

## 🎯 Goal
Implement structured application logging, request timing middleware, distributed request correlation IDs (`X-Request-ID`), and an operational `/api/health` diagnostic endpoint.

---

## 📋 Problem Statement
When debugging external LLM calls (Nebius AI Studio), Redis failures, or client upload bottlenecks during high-stress hackathon evaluations, FastAPI currently provides minimal console output. 

Without structured logging:
- Errors returned by upstream models (such as HTTP 429 Rate Limited or 502 Bad Gateway) are difficult to inspect.
- There is no latency measurement showing how long LLM streaming or PDF parsing takes.
- There is no automated health check endpoint to ping before presenting a demo.

---

## 🛠️ Required Technical Implementation

### 1. Structured Python Logging (`backend/main.py`)
* Configure standard `logging` with ISO-8601 timestamps, log level, module name, and request ID:
  ```python
  import logging
  logging.basicConfig(
      level=logging.INFO,
      format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
      datefmt="%Y-%m-%d %H:%M:%S"
  )
  logger = logging.getLogger("nova.backend")
  ```

### 2. Request Timing & Correlation Middleware
* Add FastAPI middleware:
  * Generates a unique UUID `request_id` (or preserves incoming `X-Request-ID`).
  * Measures execution time: `duration = time.perf_counter() - start_time`.
  * Logs: `METHOD PATH -> STATUS (duration ms)`.
  * Injects `X-Request-ID` and `X-Response-Time` into the response headers.

### 3. Upstream Nebius API Error Logging
* Wrap calls to `https://api.studio.nebius.com/v1/chat/completions` with explicit error logging:
  * Log exact upstream HTTP status code.
  * Log error response body payload if Nebius rejects a request.

### 4. Comprehensive Health Diagnostics (`GET /api/health`)
* Implement `/api/health` returning JSON:
  ```json
  {
    "status": "healthy",
    "timestamp": 1729000000000,
    "uptime_seconds": 1420.5,
    "services": {
      "redis": "connected",
      "nebius_ai": "configured",
      "storage_mode": "local"
    }
  }
  ```

---

## ✅ Acceptance Criteria
- [ ] Every incoming API request logs its method, URL, status code, and latency in milliseconds.
- [ ] Upstream model failures output clear debug logs detailing the failure reason.
- [ ] `GET /api/health` returns `200 OK` with service connectivity status.
- [ ] Running `python -m py_compile backend/main.py` passes with zero errors.
