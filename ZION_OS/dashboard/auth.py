"""Authentication, CSRF, and rate-limiting for the dashboard."""
import os
import secrets
import time

from models.config import MAX_RPS, RATE_WINDOW

# ── API key ─────────────────────────────────────────────────────────────
DASHBOARD_API_KEY = os.environ.get("DASHBOARD_API_KEY", "")

# ── CSRF token (rotates on each restart; enough for localhost scenarios) ─
_CSRF_TOKEN = secrets.token_hex(16) if DASHBOARD_API_KEY else ""

# ── Rate limiting ────────────────────────────────────────────────────────
_RATE_LIMIT = {}  # ip -> [timestamp, ...]


def check_rate_limit(ip: str) -> bool:
    """Return True if request is allowed, False if rate-limited."""
    now = time.time()
    stamps = _RATE_LIMIT.get(ip, [])
    # Keep only stamps within window
    stamps = [t for t in stamps if now - t < RATE_WINDOW]
    _RATE_LIMIT[ip] = stamps
    if len(stamps) >= MAX_RPS:
        return False
    stamps.append(now)
    return True


def require_auth(handler) -> bool:
    """Return False if auth check passes, otherwise send 401 and return True."""
    if not DASHBOARD_API_KEY:
        return False
    key = handler.headers.get("X-API-Key", "")
    if key != DASHBOARD_API_KEY:
        handler.send_error(401, "Unauthorized")
        return True
    return False


def require_csrf(handler, payload: dict) -> bool:
    """Return False if CSRF check passes, otherwise send 403 and return True."""
    if not DASHBOARD_API_KEY or not _CSRF_TOKEN:
        return False
    token = payload.get("_csrf", "") or handler.headers.get("X-CSRF-Token", "")
    if token != _CSRF_TOKEN:
        handler.send_error(403, "Invalid CSRF token")
        return True
    return False
