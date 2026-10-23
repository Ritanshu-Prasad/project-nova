import os
import sys

from fastapi import FastAPI

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # sibling modules on serverless runtimes too
from accounts import router as accounts_router  # noqa: E402
from admin import router as admin_router  # noqa: E402
from events import router as events_router  # noqa: E402
from reports import router as reports_router  # noqa: E402
from calibration import router as calibration_router  # noqa: E402
from fleet import router as fleet_router  # noqa: E402
from generator import router as generator_router  # noqa: E402
from observability import add_request_logging, configure_logging, log_startup, router as health_router  # noqa: E402
from tutor import router as tutor_router  # noqa: E402
from security import SecurityHeadersMiddleware, configure_cors, validate_secrets_on_startup  # noqa: E402

validate_secrets_on_startup()
configure_logging()
log_startup()
app = FastAPI(title="Project Nova API")
add_request_logging(app)
app.include_router(health_router)
app.include_router(accounts_router)
app.include_router(admin_router)
app.include_router(reports_router)
app.include_router(events_router)
app.include_router(calibration_router)
app.include_router(fleet_router)
app.include_router(generator_router)
app.include_router(tutor_router)

DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://project-nova-ai.vercel.app",
    "https://nova-badies.vercel.app",
]
origins_env = os.getenv("ALLOWED_ORIGINS")
parsed_origins = (
    [origin.strip().rstrip("/") for origin in origins_env.split(",") if origin.strip()]
    if origins_env
    else []
)
ALLOWED_ORIGINS = parsed_origins if parsed_origins else DEFAULT_ORIGINS

# Allow requests from our Vite frontend (explicit origins, methods and headers) and add security headers
os.environ["ALLOWED_ORIGINS"] = ",".join(ALLOWED_ORIGINS)
configure_cors(app)
app.add_middleware(SecurityHeadersMiddleware)


@app.get("/")
def read_root():
    return {"status": "System Online", "service": "Project Nova API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
