"""security/env.py - Multi-cloud environment resolver. Zero dependencies."""
import os

_PROD_ENV_KEYS: tuple[str, ...] = (
    "VERCEL", "AWS_EXECUTION_ENV", "KUBERNETES_SERVICE_HOST", "FLY_APP_NAME", "RENDER",
)


def is_production() -> bool:
    """Return True if running in a known production environment."""
    if os.getenv("ENVIRONMENT", "").strip().lower() in {"production", "prod"}:
        return True
    return any(bool(os.getenv(k)) for k in _PROD_ENV_KEYS)


def is_dev_backdoor_enabled() -> bool:
    """Dev backdoors need a non-production env AND explicit NOVA_DEV_LOGIN=1."""
    return not is_production() and os.getenv("NOVA_DEV_LOGIN") == "1"
