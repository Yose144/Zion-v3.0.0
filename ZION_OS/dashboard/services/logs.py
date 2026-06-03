"""Log rotation, tail, and head utilities."""
import threading
import time
from collections import deque
from datetime import datetime
from pathlib import Path

from models.config import LOG_DIR, LOG_ROTATION_MAX_BYTES, LOG_ROTATION_MAX_AGE_HOURS

LOG_ROTATION_LOCK = threading.Lock()


def rotate_log_file(path: Path):
    """Rotate a single log file if it exceeds size or age threshold."""
    if not path.exists():
        return
    size = path.stat().st_size
    age_hours = (time.time() - path.stat().st_mtime) / 3600
    if size > LOG_ROTATION_MAX_BYTES or age_hours > LOG_ROTATION_MAX_AGE_HOURS:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        rotated = path.parent / f"{path.stem}.{ts}{path.suffix}"
        try:
            path.rename(rotated)
            path.write_text("")
        except Exception:
            pass


def rotate_all_logs(SERVICE_REGISTRY):
    """Rotate all log files in LOG_DIR (with optional pre-rotate auto-backup)."""
    from app import auto_backup_if_needed  # avoid circular import
    auto_backup_if_needed()
    with LOG_ROTATION_LOCK:
        for svc in SERVICE_REGISTRY:
            log_name = svc.get("log")
            if log_name:
                rotate_log_file(LOG_DIR / log_name)
                rotate_log_file(LOG_DIR / (log_name.replace(".log", ".err")))
        rotate_log_file(LOG_DIR / "control-audit.txt")


def tail_log(filename: str, n: int = 100) -> list[str]:
    """Return last N lines from a log file (fast, stdlib only)."""
    path = LOG_DIR / filename
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return list(deque(f, maxlen=n))
    except Exception:
        return []


def head_log(filename: str, n: int = 50) -> list[str]:
    """Return first N lines from a log file."""
    path = LOG_DIR / filename
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return [line for _, line in zip(range(n), f)]
    except Exception:
        return []
