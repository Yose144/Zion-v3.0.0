"""Process registry and cross-platform PID liveness checks."""
import os
import threading
import time

PROCESS_REGISTRY = {}  # service_id -> {"pid": int, "ts": float, "image": str}
PROCESS_LOCK = threading.Lock()


def register_process(sid: str, pid: int, image: str = ""):
    with PROCESS_LOCK:
        PROCESS_REGISTRY[sid] = {"pid": pid, "ts": time.time(), "image": image}


def is_process_alive(pid: int) -> bool:
    """Cross-platform PID liveness check (no external deps)."""
    if os.name == "nt":
        try:
            import ctypes
            kernel = ctypes.windll.kernel32
            SYNCHRONIZE = 0x00100000
            PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
            h = kernel.OpenProcess(SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            if h:
                kernel.CloseHandle(h)
                return True
            return False
        except Exception:
            return False
    else:
        try:
            os.kill(pid, 0)
            return True
        except (OSError, ProcessLookupError):
            return False


def check_process_for_service(sid: str) -> dict:
    """Check whether the registered PID for a service is still alive."""
    with PROCESS_LOCK:
        rec = PROCESS_REGISTRY.get(sid)
    if not rec:
        return {"has_pid": False, "alive": False}
    return {
        "has_pid": True,
        "alive": is_process_alive(rec["pid"]),
        "pid": rec["pid"],
        "age_min": int((time.time() - rec["ts"]) / 60),
    }
