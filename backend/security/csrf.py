"""security/csrf.py - Custom-header CSRF dependency."""
from fastapi import HTTPException, Request

SAFE_METHODS: frozenset[str] = frozenset({"GET", "HEAD", "OPTIONS"})


async def require_csrf(request: Request) -> None:
    """Reject state-mutating requests lacking `X-Nova: 1` (forces a CORS preflight cross-origin)."""
    if request.method in SAFE_METHODS:
        return
    if request.headers.get("X-Nova") != "1":
        raise HTTPException(status_code=403, detail="Forbidden: Missing or invalid X-Nova header")
