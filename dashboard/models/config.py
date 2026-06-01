"""Dashboard configuration — paths, constants, and config.json loading."""
import json
import os
from pathlib import Path

# Paths (computed from this file's location: dashboard/models/ -> dashboard/ -> repo-root)
SCRIPT_DIR = Path(__file__).parent.parent.resolve()
REPO_ROOT = SCRIPT_DIR.parent
LOG_DIR = REPO_ROOT / "logs"
SCRIPTS_DIR = REPO_ROOT / "scripts"
if not LOG_DIR.exists():
    LOG_DIR = Path("../logs")


def load_dashboard_config() -> dict:
    """Load optional dashboard.json config."""
    cfg_path = SCRIPT_DIR / "config.json"
    if cfg_path.exists():
        try:
            return json.loads(cfg_path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


_DASH_CFG = load_dashboard_config()

# Network / server
HOST = _DASH_CFG.get("host", "127.0.0.1")
PORT = _DASH_CFG.get("port", 8766)

# Log rotation
LOG_ROTATION_MAX_BYTES = _DASH_CFG.get("log_rotation_max_bytes", 100 * 1024 * 1024)
LOG_ROTATION_MAX_AGE_HOURS = _DASH_CFG.get("log_rotation_max_age_hours", 24)

# Health / rate limits
HEALTH_TTL = _DASH_CFG.get("health_ttl", 5)
MAX_RPS = _DASH_CFG.get("rate_limit_max_rps", 10)
RATE_WINDOW = _DASH_CFG.get("rate_limit_window_sec", 10)

# Metrics
METRICS_MAX_POINTS = _DASH_CFG.get("metrics_max_points", 120)
