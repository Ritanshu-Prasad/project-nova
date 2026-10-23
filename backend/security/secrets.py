"""security/secrets.py - Secret lifecycle and fail-fast startup validator."""
import os
import secrets
from pathlib import Path

from security.env import is_production

DEV_SECRET_PATH: Path = Path(__file__).resolve().parent.parent / ".data" / "dev_session_secret.txt"
_in_memory_dev_secret: str | None = None

_INSECURE_DEFAULTS: frozenset[str] = frozenset({
    "secret", "changeme", "default", "session_secret",
    "12345678901234567890123456789012", "change_me_to_a_random_32_byte_secret_string",
})


def validate_secrets_on_startup() -> None:
    """Raise RuntimeError at boot if production lacks a strong SESSION_SECRET."""
    if not is_production():
        return
    val = os.getenv("SESSION_SECRET", "").strip()
    if not val:
        raise RuntimeError("CRITICAL SECURITY ERROR: SESSION_SECRET must be configured in production!")
    if len(val) < 32:
        raise RuntimeError(
            f"CRITICAL SECURITY ERROR: SESSION_SECRET must be >= 32 characters! (Got {len(val)})"
        )
    if val.lower() in _INSECURE_DEFAULTS:
        raise RuntimeError("CRITICAL SECURITY ERROR: SESSION_SECRET is using an insecure default value!")


def get_session_secret() -> bytes:
    """Return the signing secret; in dev, persist one to disk so reload workers share it."""
    global _in_memory_dev_secret
    val = os.getenv("SESSION_SECRET", "").strip()
    if val:
        return val.encode("utf-8")
    if is_production():
        raise RuntimeError("SESSION_SECRET missing in production")
    if _in_memory_dev_secret:
        return _in_memory_dev_secret.encode("utf-8")
    try:
        if DEV_SECRET_PATH.exists():
            content = DEV_SECRET_PATH.read_text("utf-8").strip()
            if len(content) >= 32:
                _in_memory_dev_secret = content
                return content.encode("utf-8")
    except OSError:
        pass
    generated = secrets.token_urlsafe(32)
    try:
        DEV_SECRET_PATH.parent.mkdir(parents=True, exist_ok=True)
        DEV_SECRET_PATH.write_text(generated, "utf-8")
        try:
            os.chmod(DEV_SECRET_PATH, 0o600)
        except OSError:
            pass
    except OSError:
        pass
    _in_memory_dev_secret = generated
    return generated.encode("utf-8")
