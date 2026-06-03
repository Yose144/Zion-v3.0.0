"""Dashboard settings persistence (JSON file in logs dir)."""
import json

from models.config import LOG_DIR

SETTINGS_PATH = LOG_DIR / "dashboard-settings.json"

DEFAULT_SETTINGS = {
    "theme": "dark",
    "refresh_interval_ms": 3000,
    "default_tab": "overview",
    "alert_threshold_hashrate": 1.0,
    "alert_threshold_sync_gap": 10,
    "log_level_filter": "all",
    "auto_launch_watchdog": True,
    "show_tooltips": True,
}


def load_settings() -> dict:
    if SETTINGS_PATH.exists():
        try:
            with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
                return {**DEFAULT_SETTINGS, **json.load(f)}
        except Exception:
            pass
    return DEFAULT_SETTINGS.copy()


def save_settings(settings: dict) -> dict:
    try:
        merged = {**load_settings(), **settings}
        with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2)
        return {"ok": True, "settings": merged}
    except Exception as e:
        return {"ok": False, "error": str(e)}
