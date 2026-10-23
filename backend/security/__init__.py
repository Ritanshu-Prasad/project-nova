"""NovaShield - standalone security package (no game-logic coupling)."""
from security.anti_cheat import ScoreConcurrencyGuard
from security.cors import configure_cors
from security.csrf import require_csrf
from security.env import is_dev_backdoor_enabled, is_production
from security.guardrails import sanitize_prompt_text, wrap_untrusted_context
from security.headers import SecurityHeadersMiddleware
from security.rate_limiter import SlidingWindowRateLimiter
from security.schemas.base import SafeBaseModel
from security.schemas.progress import PilotSaveModel, ProgressPayload
from security.secrets import get_session_secret, validate_secrets_on_startup

__all__ = [
    "ScoreConcurrencyGuard", "configure_cors", "require_csrf", "is_dev_backdoor_enabled",
    "is_production", "sanitize_prompt_text", "wrap_untrusted_context",
    "SecurityHeadersMiddleware", "SlidingWindowRateLimiter", "SafeBaseModel",
    "PilotSaveModel", "ProgressPayload", "get_session_secret", "validate_secrets_on_startup",
]
