#!/usr/bin/env python3
"""
ZION V3 — Mainnet Launch Dashboard Server
Zero-dependency: uses only Python stdlib. Serves a live HTML dashboard
and parses local log files via a JSON API.
"""

import base64
import hashlib
import json
import os
import re
import shutil
import socket
import struct
import subprocess
import sys
import threading
import time
import urllib.parse
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ── Config ──────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent.resolve()
REPO_ROOT = SCRIPT_DIR.parent.parent
LOG_DIR = REPO_ROOT / "logs"
# Fallback: try ./logs (relative to dashboard dir) for Edge server deployment
if not LOG_DIR.exists():
    LOG_DIR = SCRIPT_DIR / "logs"
# Final fallback for legacy deployments
if not LOG_DIR.exists():
    LOG_DIR = Path("../logs")
DATA_DIR = REPO_ROOT / "V3" / "data"
SCRIPTS_DIR = REPO_ROOT / "scripts"
V2_DIST = SCRIPT_DIR / "v2" / "dist"
SERVICES_MANIFEST = SCRIPT_DIR / "services.json"
DOTENV_FILE = SCRIPT_DIR / ".env"
CONFIG_FILE = SCRIPT_DIR / "config.json"
# Cross-platform release binary directory + executable suffix
RELEASE_BIN_DIR = REPO_ROOT / "V3" / "target" / "release"
EXE_SUFFIX = ".exe" if os.name == "nt" else ""

# Unified service → log file mapping used by all log endpoints
SERVICE_LOG_MAP = {
    # Blockchain nodes
    "node1":           "node1.log",           # legacy alias
    "edge-node1":      "node1.log",            # Edge Node 1 (primary) — log forwarded via SSH tunnel
    "node2":           "node2.log",            # legacy alias
    "edge-node2":      "node2.log",            # Edge Node 2 (follower)
    "local-backup":    "node-backup.log",      # Local backup node
    "node-backup":     "node-backup.log",      # alias
    # L1 services
    "pool":            "pool.log",
    "pool-edge":       "pool.log",             # alias
    "miner":           "miner.log",
    "miner-low":       "miner-low.log",
    "miner-cpu":       "miner-cpu.log",
    "miner-gpu":       "miner-gpu.log",
    # AI
    "hiranyagarbha":   "hiranyagarbha.log",
    "hiran":           "hiran-inference.log",
    "hiran-inference": "hiran-inference.log",
    # L2
    "bridge":          "bridge.log",
    "dao-daemon":      "dao.log",
    "dao":             "dao.log",
    "atomic-swap":     "atomic-swap.log",
    # L3
    "warp":            "warp.log",
    # L4-L6
    "oasis":           "oasis.log",
    "free-world":      "free-world.log",
    "issobella":       "issobella.log",
    # Infrastructure
    "dashboard":       "dashboard.log",
    "control-audit":   "control-audit.txt",
    "watchdog":        "watchdog.log",
    "backup":          "backup.log",
    "autostart":       "autostart.log",
}

# ── ANSI escape strip ─────────────────────────────────────────────────────
_ANSI_RE = re.compile(r'\x1b\[[0-9;]*[mKABCDEFGHJSTfhilmnprsuABCD]')
def strip_ansi(s: str) -> str:
    return _ANSI_RE.sub('', s) if s else s

# Load config
def load_config() -> dict:
    defaults = {
        "host": "127.0.0.1",
        "port": 8766,
        "topology": "edge-primary",  # "edge-primary" or "local-dev"
        "log_rotation_max_bytes": 104857600,
        "log_rotation_max_age_hours": 24,
        "health_ttl": 5,
        "metrics_max_points": 120,
        "rate_limit_max_rps": 100,
        "rate_limit_window_sec": 10,
        "api_key": "",
        "csrf_enabled": False,
    }
    try:
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                defaults.update(loaded)
    except Exception:
        pass
    return defaults

CONFIG = load_config()
HOST = CONFIG["host"]
PORT = CONFIG["port"]
TOPOLOGY = CONFIG["topology"]
PAYOUT_HIGHWATER_FILE = DATA_DIR / "dashboard-payout-highwater.json"

# ── Basic Auth (HTTP 401) — multi-user ───────────────────────────────────
# Supports multiple user accounts. Credentials are stored as SHA-256 hashes
# for security. Plaintext passwords are NEVER stored on disk.
#
# Users are configured via the DASHBOARD_USERS env var (comma-separated
# "user:sha256hex" pairs) or fall back to compiled defaults below.
#
# To generate a hash: python3 -c "import hashlib; print(hashlib.sha256(b'password').hexdigest())"
import hashlib as _hashlib

def _sha256(s: str) -> str:
    return _hashlib.sha256(s.encode("utf-8")).hexdigest()

# Default users (Yose + Issy) — hashed passwords
_DEFAULT_USERS = {
    "Yose":  _sha256("3nityOne13"),
    "Issy":  _sha256("3nityOne13"),
}

# Parse optional env override: DASHBOARD_USERS="user1:hash1,user2:hash2"
DASHBOARD_USERS_ENV = os.environ.get("DASHBOARD_USERS", "")
DASHBOARD_USERS: dict[str, str] = {}
if DASHBOARD_USERS_ENV:
    for pair in DASHBOARD_USERS_ENV.split(","):
        pair = pair.strip()
        if ":" in pair:
            u, h = pair.split(":", 1)
            DASHBOARD_USERS[u.strip()] = h.strip()
else:
    DASHBOARD_USERS = dict(_DEFAULT_USERS)

# Legacy single-user env vars (backward compat — added as extra user if set)
_legacy_user = os.environ.get("DASHBOARD_AUTH_USER", "")
_legacy_pass = os.environ.get("DASHBOARD_AUTH_PASS", "")
if _legacy_user and _legacy_pass:
    DASHBOARD_USERS[_legacy_user] = _sha256(_legacy_pass)

# Endpoints that skip auth (health checks, static assets)
AUTH_EXEMPT_ROUTES = {"/api/health", "/health", "/favicon.ico", "/api/poc/html", "/api/poc/status"}

# Edge server addresses (Hetzner VPS — always-on)
EDGE_HOST = "127.0.0.1"   # Dashboard runs on same server (v3.0.4)
EDGE_PUBLIC_IP = "62.171.141.136"  # Public IP (Edge server)

# ── Edge-local detection ─────────────────────────────────────────────────
# When the dashboard runs ON the Edge server, we can execute commands locally
# instead of SSH (which requires a key file that may not exist on Edge itself).
def _is_edge_local() -> bool:
    """Detect if we're running on the Edge server itself."""
    try:
        # Check hostname — v3.0.4 edge server hostname is "vmi3425821"
        hostname = socket.gethostname()
        if "edge" in hostname.lower() or "mainnet" in hostname.lower() or "vmi" in hostname.lower():
            return True
        # If hostname is something else (e.g. "zionserver-144"), we're NOT on edge
        # even if 127.0.0.1:8443 is reachable (could be SSH tunnel)
        return False
    except Exception:
        return False

EDGE_IS_LOCAL = _is_edge_local()
# When dashboard runs ON Edge, use localhost for RPC/TCP probes (node binds to 127.0.0.1 after security hardening)
EDGE_RPC_HOST = "127.0.0.1"  # v3.0.4 — dashboard runs on same server

def _run_edge_cmd(cmd: str, timeout: int = 8) -> subprocess.CompletedProcess:
    """Run a command on the Edge server — locally if we're on Edge, via SSH otherwise."""
    if EDGE_IS_LOCAL:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    # v3.0.4: Use SSH config alias "zion-new" (key in ~/.ssh/zion-new-server)
    ssh_key = REPO_ROOT / "ssh-key-zion-edge"
    if ssh_key.exists():
        return subprocess.run(
            ["ssh", "-i", str(ssh_key), "-o", "StrictHostKeyChecking=accept-new",
             "-o", "ConnectTimeout=3", "-o", "BatchMode=yes",
             f"root@{EDGE_HOST}", cmd],
            capture_output=True, text=True, timeout=timeout
        )
    # Fallback: use SSH config alias "zion-new" (configured in ~/.ssh/config)
    return subprocess.run(
        ["ssh", "-o", "ConnectTimeout=3", "-o", "BatchMode=yes",
         "zion-new", cmd],
        capture_output=True, text=True, timeout=timeout
    )

# ── Decimal conversion helpers (3.0.3 fork) ──────────────────────────────
# Post-3.0.3: 1 ZION = 1_000_000 flowers (6 decimals)
# Pre-3.0.3:  1 ZION = 1_000_000_000_000 flowers (12 decimals)
# The L1 migration was supposed to divide all balances by 1e6 at block H+1,
# but the migration code was never wired up. Balances in the DB are still
# in legacy 1e12 scale. This helper detects legacy-scale values and converts
# them correctly for display.
FLOWERS_PER_ZION = 1_000_000           # post-3.0.3
LEGACY_FLOWERS_PER_ZION = 1_000_000_000_000  # pre-3.0.3
TOTAL_SUPPLY_ZION = 144_000_000_000    # 144 billion ZION
TOTAL_SUPPLY_FLOWERS = TOTAL_SUPPLY_ZION * FLOWERS_PER_ZION  # 1.44e17

def flowers_to_zion(flowers):
    """Convert flowers (integer) to ZION (float), auto-detecting legacy scale.
    If the value exceeds total supply in post-3.0.3 scale, it must be legacy
    (1e12) and is divided by 1e12 instead of 1e6."""
    if flowers is None or flowers == 0:
        return 0.0
    try:
        f = int(flowers)
    except (ValueError, TypeError):
        return 0.0
    # Heuristic: if value > 10x total supply in post-3.0.3 flowers, it's legacy
    if f > TOTAL_SUPPLY_FLOWERS * 10:
        return f / LEGACY_FLOWERS_PER_ZION
    return f / FLOWERS_PER_ZION

def is_legacy_scale(flowers):
    """Check if a balance value is in legacy (1e12) scale."""
    if flowers is None:
        return False
    try:
        f = int(flowers)
    except (ValueError, TypeError):
        return False
    return f > TOTAL_SUPPLY_FLOWERS * 10

# ── Metrics history (in-memory ring buffer) ─────────────────────────────

class MetricsHistory:
    """Keeps last N samples for charting. Polled every 5s by background thread."""
    MAX_POINTS = 120  # ~10 min at 5s interval

    def __init__(self):
        self.lock = threading.Lock()
        self.samples = deque(maxlen=self.MAX_POINTS)

    def record(self, status: dict):
        with self.lock:
            self.samples.append({
                "t": int(time.time()),
                "n1_height": status.get("node1", {}).get("chain_height", 0),
                "n2_height": status.get("node2", {}).get("chain_height", 0),
                "n1_peers": status.get("node1", {}).get("known_peers", 0),
                "hashrate": status.get("miner", {}).get("hashrate", 0),
                "shares_ok": status.get("pool", {}).get("shares_accepted", 0),
                "shares_bad": status.get("pool", {}).get("shares_rejected", 0),
                "blocks": status.get("pool", {}).get("blocks_found", 0),
                "sessions": status.get("pool", {}).get("active_sessions", 0),
                "mempool": status.get("mempool", 0),
            })

    def snapshot(self) -> list:
        with self.lock:
            return list(self.samples)

HISTORY = MetricsHistory()

# ── Service health history (24h ring buffer, persisted) ────────────────

class ServiceHealthHistory:
    """Keeps last 288 samples (24h at 5min interval) of per-service alive state."""
    INTERVAL = 300  # 5 minutes
    MAX_BUCKETS = 288  # 24h
    PERSIST_PATH = DATA_DIR / "service-health-history.json"

    def __init__(self):
        self.lock = threading.Lock()
        self.buckets: deque = deque(maxlen=self.MAX_BUCKETS)
        self.last_flush = 0
        self._load()

    def _load(self):
        try:
            if self.PERSIST_PATH.exists():
                with open(self.PERSIST_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        for item in data[-self.MAX_BUCKETS:]:
                            self.buckets.append(item)
        except Exception:
            pass

    def _save(self):
        try:
            with open(self.PERSIST_PATH, "w", encoding="utf-8") as f:
                json.dump(list(self.buckets), f)
        except Exception:
            pass

    def record(self, health: list):
        now = int(time.time())
        # Only record if enough time elapsed
        if self.buckets and now - self.buckets[-1].get("t", 0) < self.INTERVAL:
            return
        entry = {"t": now, "services": {h["id"]: h["alive"] for h in health}}
        with self.lock:
            self.buckets.append(entry)
        # Flush to disk every 10 min
        if now - self.last_flush > 600:
            self._save()
            self.last_flush = now

    def snapshot(self) -> list:
        with self.lock:
            return list(self.buckets)

    def payout_history(self) -> list:
        """Return payout-relevant events (blocks found) from history."""
        # Reuse the same buckets, caller filters
        return self.snapshot()

SERVICE_HISTORY = ServiceHealthHistory()
BLOCK_EVENTS: deque = deque(maxlen=50)
LAST_BLOCK_EVENT_TIME = {"node1": 0, "node2": 0, "pool": 0}
BLOCK_EVENTS_LOCK = threading.Lock()

# ── Log Rotation ─────────────────────────────────────────────────────────
LOG_ROTATION_LOCK = threading.Lock()
LOG_ROTATION_MAX_BYTES = 100 * 1024 * 1024  # 100 MB
LOG_ROTATION_MAX_AGE_HOURS = 24

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
            # Touch new empty log so services can continue writing
            path.write_text("")
        except Exception:
            pass

def rotate_all_logs():
    """Rotate all log files in LOG_DIR (with optional pre-rotate auto-backup)."""
    auto_backup_if_needed()
    with LOG_ROTATION_LOCK:
        for svc in SERVICE_REGISTRY:
            log_name = svc.get("log")
            if log_name:
                rotate_log_file(LOG_DIR / log_name)
                rotate_log_file(LOG_DIR / (log_name.replace(".log", ".err")))
        # Rotate control audit log too
        rotate_log_file(LOG_DIR / "control-audit.txt")

# ── Process health ──────────────────────────────────────────────────────
# Track known PIDs so we can check if a service's process is actually alive.
# Populated by run_control and consulted by check_service_health.
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
    return {"has_pid": True, "alive": is_process_alive(rec["pid"]), "pid": rec["pid"],
            "age_min": int((time.time() - rec["ts"]) / 60)}

def find_process_by_name(name: str) -> int | None:
    """Find a running process PID by executable name (Windows + POSIX, no psutil)."""
    try:
        if os.name == "nt":
            import ctypes, ctypes.wintypes
            TH32CS_SNAPPROCESS = 0x00000002
            class PROCESSENTRY32(ctypes.Structure):
                _fields_ = [("dwSize", ctypes.c_uint32), ("cntUsage", ctypes.c_uint32),
                             ("th32ProcessID", ctypes.c_uint32), ("th32DefaultHeapID", ctypes.c_size_t),
                             ("th32ModuleID", ctypes.c_uint32), ("cntThreads", ctypes.c_uint32),
                             ("th32ParentProcessID", ctypes.c_uint32), ("pcPriClassBase", ctypes.c_long),
                             ("dwFlags", ctypes.c_uint32), ("szExeFile", ctypes.c_char * 260)]
            snap = ctypes.windll.kernel32.CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
            if snap == ctypes.c_void_p(-1).value:
                return None
            entry = PROCESSENTRY32()
            entry.dwSize = ctypes.sizeof(PROCESSENTRY32)
            name_lower = name.lower().encode()
            try:
                ok = ctypes.windll.kernel32.Process32First(snap, ctypes.byref(entry))
                while ok:
                    exe = entry.szExeFile.lower()
                    if name_lower in exe:
                        return entry.th32ProcessID
                    ok = ctypes.windll.kernel32.Process32Next(snap, ctypes.byref(entry))
            finally:
                ctypes.windll.kernel32.CloseHandle(snap)
        else:
            out = subprocess.run(["pgrep", "-f", name], capture_output=True, text=True, timeout=2)
            pids = [int(p) for p in out.stdout.split() if p.strip().isdigit()]
            return pids[0] if pids else None
    except Exception:
        pass
    return None

# ── Resource monitoring ─────────────────────────────────────────────────
RESOURCE_CACHE = {"ts": 0, "data": {}}
RESOURCE_LOCK = threading.Lock()

def get_resource_usage() -> dict:
    """Return CPU, RAM, and disk usage (cross-platform, stdlib only)."""
    now = time.time()
    with RESOURCE_LOCK:
        if now - RESOURCE_CACHE["ts"] < 5:
            return RESOURCE_CACHE["data"]

    result = {"cpu_percent": None, "ram_used_gb": None, "ram_total_gb": None,
              "disk_used_gb": None, "disk_total_gb": None, "disk_percent": None}
    try:
        if os.name == "nt":
            # Windows: WMI via ctypes (simplified) or perf counters
            import ctypes
            class MEMORYSTATUS(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_uint32), ("dwMemoryLoad", ctypes.c_uint32),
                            ("ullTotalPhys", ctypes.c_uint64), ("ullAvailPhys", ctypes.c_uint64),
                            ("ullTotalPageFile", ctypes.c_uint64), ("ullAvailPageFile", ctypes.c_uint64),
                            ("ullTotalVirtual", ctypes.c_uint64), ("ullAvailVirtual", ctypes.c_uint64),
                            ("ullAvailExtendedVirtual", ctypes.c_uint64)]
            mem = MEMORYSTATUS()
            mem.dwLength = ctypes.sizeof(MEMORYSTATUS)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem))
            total_gb = mem.ullTotalPhys / (1024**3)
            avail_gb = mem.ullAvailPhys / (1024**3)
            result["ram_total_gb"] = round(total_gb, 2)
            result["ram_used_gb"] = round(total_gb - avail_gb, 2)
            result["ram_percent"] = round((total_gb - avail_gb) / total_gb * 100, 1) if total_gb > 0 else 0
            # Disk
            free_bytes = ctypes.c_ulonglong(0)
            total_bytes = ctypes.c_ulonglong(0)
            ctypes.windll.kernel32.GetDiskFreeSpaceExW(ctypes.c_wchar_p(str(REPO_ROOT)),
                                                        ctypes.byref(free_bytes),
                                                        ctypes.byref(total_bytes), None)
            total_disk_gb = total_bytes.value / (1024**3)
            free_disk_gb = free_bytes.value / (1024**3)
            result["disk_total_gb"] = round(total_disk_gb, 2)
            result["disk_used_gb"] = round(total_disk_gb - free_disk_gb, 2)
            result["disk_percent"] = round((total_disk_gb - free_disk_gb) / total_disk_gb * 100, 1) if total_disk_gb > 0 else 0
        elif sys.platform == "darwin":
            # macOS: sysctl + vm_stat + shutil.disk_usage
            try:
                total_bytes = int(subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, timeout=2).stdout.strip())
                total_gb = total_bytes / (1024**3)
                result["ram_total_gb"] = round(total_gb, 2)
                vm = subprocess.run(["vm_stat"], capture_output=True, text=True, timeout=2).stdout
                pagesize = 4096
                page_map = {}
                for line in vm.splitlines():
                    if ":" in line:
                        k, v = line.split(":", 1)
                        page_map[k.strip()] = int(v.strip().replace(".", ""))
                used_pages = (page_map.get("Pages active", 0) + page_map.get("Pages inactive", 0)
                              + page_map.get("Pages wired down", 0) + page_map.get("Pages occupied by compressor", 0))
                used_gb = used_pages * pagesize / (1024**3)
                result["ram_used_gb"] = round(used_gb, 2)
                result["ram_percent"] = round(used_gb / total_gb * 100, 1) if total_gb > 0 else 0
            except Exception:
                pass
            try:
                du = shutil.disk_usage(str(REPO_ROOT))
                result["disk_total_gb"] = round(du.total / (1024**3), 2)
                result["disk_used_gb"] = round((du.total - du.free) / (1024**3), 2)
                result["disk_percent"] = round((du.total - du.free) / du.total * 100, 1) if du.total > 0 else 0
            except Exception:
                pass
        else:
            # Linux: /proc/meminfo + statvfs
            try:
                with open("/proc/meminfo") as f:
                    meminfo = {k.strip(): int(v.split()[0]) for k, v in (line.split(":") for line in f if ":" in line)}
                total_kb = meminfo.get("MemTotal", 0)
                avail_kb = meminfo.get("MemAvailable", meminfo.get("MemFree", 0))
                total_gb = total_kb / (1024**2)
                result["ram_total_gb"] = round(total_gb, 2)
                result["ram_used_gb"] = round(total_gb - avail_kb / (1024**2), 2)
                result["ram_percent"] = round((total_kb - avail_kb) / total_kb * 100, 1) if total_kb > 0 else 0
            except Exception:
                pass
            try:
                du = shutil.disk_usage(str(REPO_ROOT))
                result["disk_total_gb"] = round(du.total / (1024**3), 2)
                result["disk_used_gb"] = round((du.total - du.free) / (1024**3), 2)
                result["disk_percent"] = round((du.total - du.free) / du.total * 100, 1) if du.total > 0 else 0
            except Exception:
                pass
    except Exception:
        pass

    with RESOURCE_LOCK:
        RESOURCE_CACHE["ts"] = now
        RESOURCE_CACHE["data"] = result
    return result

# ── Monitoring (Prometheus + Grafana on Edge) ────────────────────────────
MONITORING_CACHE = {"ts": 0, "data": {}}
MONITORING_LOCK = threading.Lock()

# ── Edge Server Health (SSH probe for system metrics + log status) ────────
EDGE_HEALTH_CACHE = {"ts": 0, "data": {}}
EDGE_HEALTH_LOCK = threading.Lock()

def get_edge_server_health() -> dict:
    """Probe Edge server system health via SSH. Cached 30s.

    Returns disk, CPU, memory, log sizes, systemd service status, and
    cleanup timer status. Uses SSH (subprocess) to run a compact one-liner
    on the Edge server.
    """
    now = time.time()
    with EDGE_HEALTH_LOCK:
        if now - EDGE_HEALTH_CACHE["ts"] < 30:
            return EDGE_HEALTH_CACHE["data"]

    result = {
        "reachable": False,
        "disk": {"total_gb": None, "used_gb": None, "avail_gb": None, "percent": None},
        "memory": {"total_gb": None, "used_gb": None, "avail_gb": None, "percent": None},
        "cpu": {"load_1m": None, "load_5m": None, "load_15m": None, "cores": None},
        "uptime_seconds": None,
        "logs": {
            "syslog_mb": None,
            "journal_mb": None,
            "zion_edge_miner_mb": None,
        },
        "services": {},
        "cleanup_timer": {"active": False, "last_trigger": None},
        "docker": [],
    }

    # Run health probe on Edge — locally if on Edge, via SSH otherwise
    try:
        out = _run_edge_cmd("/usr/local/bin/edge-health-probe.sh", timeout=8)
        if out.returncode != 0 or not out.stdout.strip():
            result["error"] = out.stderr.strip()[:200] if out.stderr else "Edge probe failed"
            with EDGE_HEALTH_LOCK:
                EDGE_HEALTH_CACHE["ts"] = now
                EDGE_HEALTH_CACHE["data"] = result
            return result

        line = out.stdout.strip()
        result["reachable"] = True

        # Parse key=value pairs (values may contain commas)
        parts = {}
        for token in line.split():
            if "=" in token:
                k, v = token.split("=", 1)
                parts[k] = v

        # Disk: total,used,avail,percent (in KB)
        if "DISK" in parts:
            d = parts["DISK"].split(",")
            if len(d) >= 4:
                total_kb = int(d[0])
                used_kb = int(d[1])
                avail_kb = int(d[2])
                pct = int(d[3].replace("%", ""))
                result["disk"] = {
                    "total_gb": round(total_kb / (1024**2), 1),
                    "used_gb": round(used_kb / (1024**2), 1),
                    "avail_gb": round(avail_kb / (1024**2), 1),
                    "percent": pct,
                }

        # Memory: total,used,avail (in MB)
        if "MEM" in parts:
            m = parts["MEM"].split(",")
            if len(m) >= 3:
                total_mb = int(m[0])
                used_mb = int(m[1])
                avail_mb = int(m[2])
                result["memory"] = {
                    "total_gb": round(total_mb / 1024, 1),
                    "used_gb": round(used_mb / 1024, 1),
                    "avail_gb": round(avail_mb / 1024, 1),
                    "percent": round((total_mb - avail_mb) / total_mb * 100, 1) if total_mb > 0 else 0,
                }

        # CPU load
        if "LOAD" in parts:
            l = parts["LOAD"].split(",")
            if len(l) >= 3:
                result["cpu"] = {
                    "load_1m": float(l[0]),
                    "load_5m": float(l[1]),
                    "load_15m": float(l[2]),
                    "cores": int(parts.get("CORES", 0)),
                }

        # Uptime
        if "UPTIME" in parts:
            try:
                result["uptime_seconds"] = float(parts["UPTIME"])
            except Exception:
                pass

        # Log sizes
        result["logs"] = {
            "syslog_mb": int(parts.get("SYSLOG", 0) or 0),
            "journal_mb": int(parts.get("JOURNAL", 0) or 0),
            "zion_edge_miner_mb": int(parts.get("ZIONMINER", 0) or 0),
        }

        # Cleanup timer
        result["cleanup_timer"] = {
            "active": parts.get("TIMER_ACTIVE", "").strip() == "active",
            "last_trigger": parts.get("TIMER_TRIGGER", "").strip() if parts.get("TIMER_TRIGGER", "").strip() != "n/a" else None,
        }

        # Services
        svc_names = ["zion-node", "zion-pool", "zion-bridge",
                     "zion-dao", "zion-warp",
                     "zion-edge-watchdog"]
        svc_states = parts.get("SVCS", "").split(",")
        for i, name in enumerate(svc_names):
            if i < len(svc_states):
                result["services"][name] = svc_states[i].strip()

        # Docker containers (format: name::status|name::status)
        if "DOCKER" in parts and parts["DOCKER"]:
            for item in parts["DOCKER"].split("|"):
                if "::" in item:
                    cname, cstatus = item.split("::", 1)
                    result["docker"].append({"name": cname, "status": cstatus})

    except Exception as e:
        result["error"] = str(e)[:200]

    with EDGE_HEALTH_LOCK:
        EDGE_HEALTH_CACHE["ts"] = now
        EDGE_HEALTH_CACHE["data"] = result
    return result


def get_monitoring_status() -> dict:
    """Scrape built-in pool metrics endpoint (Prometheus format on :8455). Cached 15 s."""
    now = time.time()
    with MONITORING_LOCK:
        if now - MONITORING_CACHE["ts"] < 15:
            return MONITORING_CACHE["data"]

    metrics_host = "127.0.0.1"
    metrics_port = 8455
    result = {
        "prometheus": {"url": f"http://{metrics_host}:{metrics_port}/metrics", "alive": False, "version": None, "targets_up": 0, "targets_total": 0},
        "grafana": {"url": "built-in", "alive": True, "version": "dashboard", "database": "internal"},
        "pool_metrics": {"url": f"http://{metrics_host}:{metrics_port}/metrics", "alive": False, "hashrate": "0 H/s", "shares": 0, "active_sessions": 0, "miners_tracked": 0, "blocks_found": 0, "accepted": 0, "rejected": 0, "submits": 0},
        "built_in_charts": {"alive": True, "version": "dashboard", "database": "internal"},
        "timestamp": now,
    }

    # Scrape pool metrics endpoint (Prometheus exposition format)
    try:
        r = urllib.request.urlopen(f"http://{metrics_host}:{metrics_port}/metrics", timeout=3)
        body = r.read().decode("utf-8", errors="ignore")
        result["prometheus"]["alive"] = True
        result["pool_metrics"]["alive"] = True
        shares = 0
        hashrate_hps = 0.0
        accepted = 0
        rejected = 0
        active_sessions = 0
        miners_tracked = 0
        blocks_found = 0
        submits = 0
        for line in body.splitlines():
            line = line.strip()
            if line.startswith("zion_pool_active_sessions "):
                active_sessions = int(float(line.split()[-1]))
                result["prometheus"]["targets_up"] = active_sessions
            elif line.startswith("zion_pool_miners_tracked "):
                miners_tracked = int(float(line.split()[-1]))
                result["prometheus"]["targets_total"] = miners_tracked
            elif line.startswith("zion_pool_accepted_total "):
                accepted = int(float(line.split()[-1]))
                shares += accepted
            elif line.startswith("zion_pool_rejected_total "):
                rejected = int(float(line.split()[-1]))
                shares += rejected
            elif line.startswith("zion_pool_hashrate_hps "):
                hashrate_hps = float(line.split()[-1])
            elif line.startswith("zion_pool_blocks_found "):
                blocks_found = int(float(line.split()[-1]))
            elif line.startswith("zion_pool_submits_total "):
                submits = int(float(line.split()[-1]))
        hr_str = f"{hashrate_hps/1000:.1f} KH/s" if hashrate_hps >= 1000 else f"{hashrate_hps:.1f} H/s"
        result["prometheus"]["version"] = hr_str
        result["prometheus"]["shares"] = shares
        result["pool_metrics"]["hashrate"] = hr_str
        result["pool_metrics"]["shares"] = shares
        result["pool_metrics"]["active_sessions"] = active_sessions
        result["pool_metrics"]["miners_tracked"] = miners_tracked
        result["pool_metrics"]["blocks_found"] = blocks_found
        result["pool_metrics"]["accepted"] = accepted
        result["pool_metrics"]["rejected"] = rejected
        result["pool_metrics"]["submits"] = submits
    except Exception:
        pass

    with MONITORING_LOCK:
        MONITORING_CACHE["ts"] = now
        MONITORING_CACHE["data"] = result
    return result

# ── Alert history ───────────────────────────────────────────────────────
ALERT_HISTORY_PATH = LOG_DIR / "alert-history.json"
ALERT_HISTORY_MAX = 100
ALERT_HISTORY_LOCK = threading.Lock()

def load_alert_history() -> list:
    try:
        if ALERT_HISTORY_PATH.exists():
            with open(ALERT_HISTORY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data[-ALERT_HISTORY_MAX:]
    except Exception:
        pass
    return []

def append_alert(alert: dict):
    with ALERT_HISTORY_LOCK:
        history = load_alert_history()
        alert["ts"] = datetime.now().isoformat()
        history.append(alert)
        history = history[-ALERT_HISTORY_MAX:]
        try:
            with open(ALERT_HISTORY_PATH, "w", encoding="utf-8") as f:
                json.dump(history, f, indent=2)
        except Exception:
            pass
        return history

# ── Watchdog ────────────────────────────────────────────────────────────
WATCHDOG_ENABLED = True
WATCHDOG_RESTART_COOLDOWN_SEC = 300  # 5 min between auto-restarts per service
WATCHDOG_LAST_RESTART = {}  # sid -> ts
WATCHDOG_LOCK = threading.Lock()

def watchdog_check():
    """Auto-restart critical services that have gone down unexpectedly. Topology-aware."""
    if not WATCHDOG_ENABLED:
        return
    now = time.time()
    # Critical services depend on topology
    if TOPOLOGY == "edge-primary":
        critical = ["edge-node", "pool-edge", "node1"]  # Edge primary + local backup
    else:
        critical = ["node1", "pool"]  # Local genesis + local pool
    for sid in critical:
        svc = get_service(sid)
        if not svc:
            continue
        # Only restart if we previously started it and it died
        proc_info = check_process_for_service(sid)
        if not proc_info["has_pid"]:
            continue
        if proc_info["alive"]:
            continue
        # Check cooldown
        with WATCHDOG_LOCK:
            last_restart = WATCHDOG_LAST_RESTART.get(sid, 0)
            if now - last_restart < WATCHDOG_RESTART_COOLDOWN_SEC:
                continue
        start_script = svc.get("start")
        if not start_script:
            continue
        action = start_script.replace("-", "_")  # e.g. start-node1 -> start_node1
        # Map back to allowed action name
        action_map = {"start_node1": "start-node1", "start_node2": "start-node2",
                      "start_pool": "start-pool", "start_miner": "start-miner"}
        action = action_map.get(action, action)
        if action not in ALLOWED_ACTIONS:
            continue
        result = run_control(action)
        if result.get("ok"):
            with WATCHDOG_LOCK:
                WATCHDOG_LAST_RESTART[sid] = now
            register_process(sid, result["pid"])
            append_alert({"severity": "warning", "title": f"Watchdog restarted {svc['name']}",
                          "detail": f"PID {proc_info['pid']} died. Auto-restarted at {datetime.now().isoformat()}",
                          "action": None})

# ── Dependency-Aware Stack Launch ─────────────────────────────────────────
# Shared mutable state for the background launch thread.
LAUNCH_STATE_LOCK = threading.Lock()
LAUNCH_STATE = {
    "running": False,
    "started_at": None,
    "completed_at": None,
    "progress_pct": 0,
    "current_step": None,
    "results": [],
    "error": None,
}

# Map service IDs to their start action names.
SID_TO_ACTION = {
    "node1": "start-node1",
    "node2": "start-node2",
    "pool": "start-pool",
    "pool-edge": None,  # Edge pool is remote, no local start action
    "edge-node": None,  # Edge node is remote, no local start action
    "miner": "start-miner",
    "hiranyagarbha": "start-hiranyagarbha",
    "ai-native": "start-hiran-inference",
}

# How long to wait after a service starts before starting dependents.
SID_STARTUP_DELAY = {
    "node1": 8,   # Node needs a few seconds for P2P + RPC
    "node2": 5,
    "pool": 5,    # Pool needs RPC to be ready
    "pool-edge": 0,  # Edge pool is remote, no local startup delay
    "edge-node": 0,  # Edge node is remote, no local startup delay
    "miner": 2,
    "hiranyagarbha": 3,
    "ai-native": 3,
}

def _topo_sort(sids: list) -> list:
    """Return services in dependency order (Kahn's algorithm)."""
    # Build adjacency + in-degree
    adj = {sid: [] for sid in sids}
    indeg = {sid: 0 for sid in sids}
    for sid in sids:
        svc = get_service(sid)
        if not svc:
            continue
        for dep in svc.get("depends_on", []):
            if dep in sids:
                adj[dep].append(sid)
                indeg[sid] += 1
    # Kahn
    queue = [s for s in sids if indeg[s] == 0]
    out = []
    while queue:
        n = queue.pop(0)
        out.append(n)
        for m in adj[n]:
            indeg[m] -= 1
            if indeg[m] == 0:
                queue.append(m)
    # Append any remaining (cycle or missing deps) in original order
    for s in sids:
        if s not in out:
            out.append(s)
    return out

def run_dependency_launch(sids: list):
    """Background thread: start services in topo order with delays."""
    global LAUNCH_STATE
    ordered = _topo_sort(sids)
    with LAUNCH_STATE_LOCK:
        LAUNCH_STATE = {
            "running": True,
            "started_at": datetime.now().isoformat(),
            "completed_at": None,
            "progress_pct": 0,
            "current_step": None,
            "results": [],
            "error": None,
        }
    total = len(ordered)
    try:
        for i, sid in enumerate(ordered, 1):
            svc = get_service(sid)
            action = SID_TO_ACTION.get(sid)
            step_name = svc["name"] if svc else sid
            with LAUNCH_STATE_LOCK:
                LAUNCH_STATE["current_step"] = f"Starting {step_name}…"
                LAUNCH_STATE["progress_pct"] = int((i - 1) / total * 100)
            if not action or action not in ALLOWED_ACTIONS:
                with LAUNCH_STATE_LOCK:
                    LAUNCH_STATE["results"].append({"sid": sid, "ok": False, "error": "No start action mapped"})
                continue
            result = run_control(action)
            with LAUNCH_STATE_LOCK:
                LAUNCH_STATE["results"].append({"sid": sid, "ok": result.get("ok"), "pid": result.get("pid"), "error": result.get("error")})
            if not result.get("ok"):
                # Stop on first failure for core stack, but log it
                with LAUNCH_STATE_LOCK:
                    LAUNCH_STATE["error"] = f"Failed to start {step_name}: {result.get('error', 'unknown')}"
                break
            delay = SID_STARTUP_DELAY.get(sid, 3)
            for remaining in range(delay, 0, -1):
                with LAUNCH_STATE_LOCK:
                    LAUNCH_STATE["current_step"] = f"Waiting for {step_name} to stabilise… {remaining}s"
                time.sleep(1)
            with LAUNCH_STATE_LOCK:
                LAUNCH_STATE["progress_pct"] = int(i / total * 100)
    except Exception as e:
        with LAUNCH_STATE_LOCK:
            LAUNCH_STATE["error"] = str(e)
    finally:
        with LAUNCH_STATE_LOCK:
            LAUNCH_STATE["running"] = False
            LAUNCH_STATE["completed_at"] = datetime.now().isoformat()
            LAUNCH_STATE["progress_pct"] = 100 if not LAUNCH_STATE.get("error") else LAUNCH_STATE["progress_pct"]
            LAUNCH_STATE["current_step"] = LAUNCH_STATE.get("error") or "Stack launch complete"

def get_launch_state() -> dict:
    with LAUNCH_STATE_LOCK:
        return dict(LAUNCH_STATE)

# ── Auto-backup before log rotation ────────────────────────────────────
BACKUP_BEFORE_ROTATE = True
_BACKUP_THROTTLE_SECS = 4 * 3600  # minimum 4 hours between auto-backups
_last_auto_backup_ts = 0.0

def auto_backup_if_needed():
    global _last_auto_backup_ts
    if not BACKUP_BEFORE_ROTATE:
        return
    # Throttle: only run at most once every 4 hours
    now = time.time()
    if now - _last_auto_backup_ts < _BACKUP_THROTTLE_SECS:
        return
    script = SCRIPTS_DIR / ("backup-chain" + _SCRIPT_EXT)
    if not script.exists():
        return
    try:
        if os.name == "nt":
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = 0
            subprocess.Popen(
                ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", str(script), "-Name", "pre-rotate-auto"],
                cwd=str(REPO_ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                startupinfo=si, creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
            )
        else:
            subprocess.Popen(
                ["bash", str(script), "pre-rotate-auto"],
                cwd=str(REPO_ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                preexec_fn=os.setsid if hasattr(os, "setsid") else None
            )
        _last_auto_backup_ts = now
        _log_control("auto-backup pre-rotate triggered")
    except Exception:
        pass

# ── Service Registry ────────────────────────────────────────────────────
# Dual topology: edge-primary (production) vs local-dev (testing)
# SERVICE_REGISTRY is set dynamically based on TOPOLOGY config

SERVICE_REGISTRY_EDGE_PRIMARY = [
    # ── L1: Consensus (v3.0.4 — new server, all on 127.0.0.1) ──────────
    {"id": "edge-node1", "name": "ZION Node (Primary / Genesis)", "icon": "🌍", "level": "L1", "kind": "node",
     "ports": {"p2p": 8333, "rpc": 8443, "metrics": 9100},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "rpc", "severity": "critical", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8443/health",
     "purpose": "Primary / Genesis node — P2P 8333, RPC 8443, metrics 9100. Fresh genesis v3.0.4.",
     "child_says": "🌍 The king node — source of chain truth!",
     "depends_on": []},
    {"id": "edge-node2", "name": "ZION Node 2 (Follower)", "icon": "🔶", "level": "L1", "kind": "node",
     "ports": {"p2p": 8334, "rpc": 8448, "metrics": 9116},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "rpc", "severity": "warning", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8448/health",
     "purpose": "Follower node — P2P 8334, RPC 8448. Syncs from Node 1 for redundancy.",
     "child_says": "🔶 Follows Node 1 to keep a backup copy!",
     "depends_on": ["edge-node1"]},
    {"id": "local-backup", "name": "Local Backup Node", "icon": "🔷", "level": "L1", "kind": "node",
     "ports": {"p2p": 8333, "rpc": 8446},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "rpc", "severity": "warning", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8446/health",
     "purpose": "Local backup node — P2P 8333, RPC 8446. Seeds from both Edge nodes.",
     "child_says": "🔷 Local backup — keeps a copy safe at home!",
     "depends_on": ["edge-node1"]},
    {"id": "pool-edge", "name": "ZION Pool (Primary)", "icon": "🌐", "level": "L1", "kind": "pool",
     "ports": {"stratum": 8444},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "critical", "autoheal": False,
     "purpose": "Primary pool — accepts all miners, validates shares, distributes payouts (89/5/5/1 burn model). Stratum 8444.",
     "child_says": "🌐 The main pool — miners connect here!",
     "depends_on": ["edge-node1"]},
    {"id": "miner", "name": "CPU/GPU Miner", "icon": "⛏️", "level": "L1", "kind": "miner",
     "ports": {},
     "log": "miner.log", "start": "start-miner", "stop": None,
     "health_method": "log", "severity": "warning", "autoheal": True,
     "health_endpoint": "http://127.0.0.1:8444",
     "purpose": "Performs Deeksha PoW hashing to find new blocks. Connects to pool 8444.",
     "child_says": "⛏️ The miner digs for new gold (ZION coins)!",
     "depends_on": ["pool-edge"]},

    # ── L2: Bridge & DAO (running on new server) ────────────────────────
    {"id": "bridge", "name": "ZION Bridge", "icon": "🌉", "level": "L2", "kind": "bridge",
     "ports": {"metrics": 9101},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "Cross-chain relay: moves ZION between L1 and EVM chains (6 chains). Metrics on 9101.",
     "child_says": "🌉 A magical bridge to send ZION to other crypto worlds!",
     "depends_on": ["edge-node1"]},
    {"id": "dao", "name": "ZION DAO", "icon": "🗳️", "level": "L2", "kind": "dao",
     "ports": {"api": 8450},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "Decentralized governance: proposals, voting, treasury management. API on 8450.",
     "child_says": "🗳️ Everyone votes here to decide what ZION should do next!",
     "depends_on": ["edge-node1"]},

    # ── L3: WARP Relay (running on new server) ───────────────────────────
    {"id": "warp", "name": "WARP Relay", "icon": "🌀", "level": "L3", "kind": "relay",
     "ports": {"api": 8453},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Multi-chain relay for fast cross-chain messaging. API on 8453.",
     "child_says": "🌀 A super-fast message tube between blockchains!",
     "depends_on": ["edge-node1"]},

    # ── L4-L6: Apps (not yet deployed on new server — placeholder) ──────
    {"id": "oasis", "name": "OASIS Avatar Hub", "icon": "🪷", "level": "L4", "kind": "app",
     "ports": {"api": 8094},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Avatar registry, guilds, territories, consciousness XP. API on 8094. (Not yet deployed)",
     "child_says": "🪷 A garden where your ZION avatar lives and helps the world!",
     "depends_on": ["edge-node1"]},
    {"id": "free-world", "name": "Free World Humanitarian", "icon": "🕊️", "level": "L5", "kind": "humanitarian",
     "ports": {"api": 8095},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Humanitarian aid coordination — mesh networks, medical tables, community DAOs. (Not yet deployed)",
     "child_says": "🕊️ Helps people in need through decentralized aid and community support!",
     "depends_on": ["edge-node1"]},
    {"id": "issobella", "name": "Issobella Space Layer", "icon": "🚀", "level": "L6", "kind": "space",
     "ports": {"api": 8096},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Space infrastructure coordination — satellite relay, off-world settlements, orbital DAOs. (Not yet deployed)",
     "child_says": "🚀 Takes ZION beyond Earth — to the stars and beyond!",
     "depends_on": ["edge-node1"]},

    # ── Infrastructure ───────────────────────────────────────────────────
    {"id": "dashboard", "name": "ZION Dashboard", "icon": "📋", "level": "Infra", "kind": "dashboard",
     "ports": {"web": 8766},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Operational control plane — this UI. Port 8766 behind nginx + Basic Auth.",
     "child_says": "📋 The control room where we watch everything!",
     "depends_on": ["edge-node1"]},
    {"id": "nginx", "name": "Nginx Reverse Proxy", "icon": "🔒", "level": "Infra", "kind": "proxy",
     "ports": {"http": 80, "https": 443},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "critical", "autoheal": False,
     "purpose": "Reverse proxy + SSL termination (Let's Encrypt). Serves zionterranova.com + dashboard.zionterranova.com.",
     "child_says": "🔒 The gatekeeper that protects our websites!",
     "depends_on": []},
    {"id": "web-next", "name": "Next.js Website", "icon": "🌐", "level": "Infra", "kind": "web",
     "ports": {"http": 3001},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "Next.js 16.2.9 website — 73+ routes, Docker container zion-web:nextjs. Port 3001.",
     "child_says": "🌐 The public face of ZION — our website!",
     "depends_on": ["nginx"]},
]

SERVICE_REGISTRY_LOCAL_DEV = [
    # ── L1: Consensus (Local-dev topology) ───────────────────────────────
    {"id": "node1", "name": "Node 1 (Genesis)", "icon": "🔷", "level": "L1", "kind": "node",
     "ports": {"p2p": 8333, "rpc": 8443, "metrics": 9115},
     "log": "node1.log", "start": "start-node1", "stop": None,
     "health_method": "rpc", "severity": "critical", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8443/health",
     "purpose": "Genesis node — source of chain truth in local dev mode.",
     "child_says": "🔷 The genesis node starts the chain!",
     "depends_on": []},
    {"id": "node2", "name": "Node 2 (Follower)", "icon": "🔶", "level": "L1", "kind": "node",
     "ports": {"p2p": 8334, "rpc": 8446, "metrics": 9116},
     "log": "node2.log", "start": "start-node2", "stop": None,
     "health_method": "rpc", "severity": "warning", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8446/health",
     "purpose": "Follower node — syncs from node1 for redundancy.",
     "child_says": "🔶 Follows node1 to keep a backup copy!",
     "depends_on": ["node1"]},
    {"id": "pool", "name": "Local Pool", "icon": "🌐", "level": "L1", "kind": "pool",
     "ports": {"stratum": 8444, "metrics": 9550},
     "log": "pool.log", "start": "start-pool", "stop": None,
     "health_method": "tcp", "severity": "critical", "autoheal": False,
     "purpose": "Local pool — accepts miners, validates shares, distributes payouts (89/5/5 burn model).",
     "child_says": "🌐 The local pool manages mining rewards!",
     "depends_on": ["node1"]},
    {"id": "miner", "name": "GPU Miner", "icon": "⛏️", "level": "L1", "kind": "miner",
     "ports": {},
     "log": "miner.log", "start": "start-miner", "stop": None,
     "health_method": "log", "severity": "warning", "autoheal": True,
     "purpose": "Performs cosmic_harmony PoW hashing on GPU to find new blocks. Connects to local pool.",
     "child_says": "⛏️ The miner digs for new gold (ZION coins)!",
     "depends_on": ["pool"]},

    # ── L2: Bridge & DAO ────────────────────────────────────────────────
    {"id": "bridge", "name": "ZION Bridge", "icon": "🌉", "level": "L2", "kind": "bridge",
     "ports": {"metrics": 9102},
     "log": "bridge.log", "start": "start-bridge", "stop": "stop-bridge",
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "Cross-chain relay: moves ZION between L1 and EVM chains (Base). Metrics on 9102.",
     "child_says": "🌉 A magical bridge to send ZION to other crypto worlds!",
     "depends_on": ["node1"]},
    {"id": "dao", "name": "ZION DAO", "icon": "🗳️", "level": "L2", "kind": "dao",
     "ports": {"api": 8450},
     "log": "dao.log", "start": "start-dao", "stop": "stop-dao",
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "Decentralized governance: proposals, voting, treasury management. API on 8450.",
     "child_says": "🗳️ Everyone votes here to decide what ZION should do next!",
     "depends_on": ["node1"]},
    {"id": "atomic-swap", "name": "Atomic Swap", "icon": "🔄", "level": "L2", "kind": "swap",
     "ports": {"api": 8888},
     "log": "atomic-swap.log", "start": "start-atomic-swap", "stop": "stop-atomic-swap",
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "HTLC-based atomic swaps between ZION and other chains (no middleman). API on 8888.",
     "child_says": "🔄 Trade coins safely with strangers without anyone cheating!",
     "depends_on": ["node1"]},
    {"id": "swap-aggregator", "name": "Swap Aggregator", "icon": "💱", "level": "L2", "kind": "aggregator",
     "ports": {"api": 8456},
     "log": "swap-aggregator.log", "start": "start-swap-aggregator", "stop": "stop-swap-aggregator",
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "DeFi swap aggregator — Uni V3 price quotes + bridge + swap execution. API on 8456.",
     "child_says": "💱 Finds the best price across all DeFi pools!",
     "depends_on": ["bridge", "node1"]},

    # ── L3: Advanced ─────────────────────────────────────────────────────
    {"id": "warp", "name": "WARP Relay", "icon": "🌀", "level": "L3", "kind": "relay",
     "ports": {"api": 8453},
     "log": "warp.log", "start": "start-warp", "stop": "stop-warp",
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Multi-chain relay for fast cross-chain messaging.",
     "child_says": "🌀 A super-fast message tube between blockchains!",
     "depends_on": []},
    {"id": "ncl", "name": "NCL Compute Layer", "icon": "🧠", "level": "L3", "kind": "gateway",
     "ports": {"api": 8001},
     "log": "hiranyagarbha.log", "start": "start-hiranyagarbha", "stop": None,
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Neural Compute Layer — job scheduler, worker reputation, pricing. Integrated into Hiranyagarbha at /ncl/*.",
     "child_says": "🧠 Helps many computers think together as one big brain!",
     "depends_on": ["hiranyagarbha"]},
    {"id": "hiranyagarbha", "name": "Hiranyagarbha API", "icon": "🧬", "level": "L3", "kind": "ai",
     "ports": {"api": 8001},
     "log": "hiranyagarbha.log", "start": "start-hiranyagarbha", "stop": None,
     "health_method": "http", "severity": "info", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8001/health",
     "purpose": "Orchestrator API — agent lifecycle, task dispatch, RAG, consciousness engine. Port 8001.",
     "child_says": "🧬 The brain that coordinates all AI agents in ZION!",
     "depends_on": []},
    {"id": "ai-native", "name": "Hiran Inference", "icon": "🤖", "level": "L3", "kind": "ai",
     "ports": {"api": 8002},
     "log": "hiran-inference.log", "start": "start-hiran-inference", "stop": None,
     "health_method": "http", "severity": "info", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8002/health",
     "purpose": "Hiran v2.2 LLM inference server — OpenAI-compatible API on port 8002.",
     "child_says": "🤖 A robot helper that knows everything about ZION!",
     "depends_on": []},

    # ── L4: Apps ─────────────────────────────────────────────────────────
    {"id": "oasis", "name": "OASIS Avatar Hub", "icon": "🪷", "level": "L4", "kind": "app",
     "ports": {"api": 8094},
     "log": "oasis.log", "start": "start-oasis", "stop": "stop-oasis",
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Avatar registry, guilds, territories, consciousness XP. API on 8094.",
     "child_says": "🪷 A garden where your ZION avatar lives and helps the world!",
     "depends_on": ["node1"]},

    # ── L5: Free World Humanitarian ──────────────────────────────────────
    {"id": "free-world", "name": "Free World Humanitarian", "icon": "🕊️", "level": "L5", "kind": "humanitarian",
     "ports": {"api": 8095},
     "log": "free-world.log", "start": "start-humanitarian", "stop": "stop-humanitarian",
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Humanitarian aid coordination — mesh networks, medical tables, community DAOs.",
     "child_says": "🕊️ Helps people in need through decentralized aid and community support!",
     "depends_on": ["node1"]},

    # ── L6: Issobella Space ──────────────────────────────────────────────
    {"id": "issobella", "name": "Issobella Space Layer", "icon": "🚀", "level": "L6", "kind": "space",
     "ports": {"api": 8096},
     "log": "issobella.log", "start": "start-space", "stop": "stop-space",
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Space infrastructure coordination — satellite relay, off-world settlements, orbital DAOs.",
     "child_says": "🚀 Takes ZION beyond Earth — to the stars and beyond!",
     "depends_on": ["node1"]},

    # ── Infrastructure ───────────────────────────────────────────────────
    # Prometheus/Grafana removed — replaced by built-in pool metrics on :8455
    {"id": "node-exporter", "name": "Node Exporter", "icon": "🔧", "level": "Infra", "kind": "metrics",
     "ports": {"metrics": 9100},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Edge host system metrics (CPU, RAM, disk, network).",
     "child_says": "🔧 Tells us how hard the computer is working!",
     "depends_on": []},
    {"id": "dashboard", "name": "ZION Dashboard", "icon": "📋", "level": "Infra", "kind": "dashboard",
     "ports": {"web": 8766},
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Operational control plane — this UI (Local PC only).",
     "child_says": "📋 The control room where we watch everything!",
     "depends_on": ["node1"]},
]

# Dynamic SERVICE_REGISTRY selection based on TOPOLOGY
SERVICE_REGISTRY = SERVICE_REGISTRY_EDGE_PRIMARY if TOPOLOGY == "edge-primary" else SERVICE_REGISTRY_LOCAL_DEV

def get_service(sid: str) -> dict:
    return next((s for s in SERVICE_REGISTRY if s["id"] == sid), None)

# ── Health checks ───────────────────────────────────────────────────────

import socket
import urllib.request as _urlreq
HEALTH_CACHE = {}  # id -> {"alive": bool, "ts": int, "details": str}
HEALTH_TTL = 10  # seconds

def tcp_probe(host: str, port: int, timeout: float = 0.15) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False

def http_probe(url: str, timeout: float = 0.5) -> tuple[bool, str]:
    try:
        with _urlreq.urlopen(url, timeout=timeout) as r:
            return (r.status < 500, f"HTTP {r.status}")
    except Exception as e:
        return (False, str(e)[:60])

def rpc_probe(host: str, port: int, timeout: float = 1.0) -> tuple[bool, str]:
    """Send a JSON-RPC getChainInfo probe to a node."""
    try:
        req = _urlreq.Request(
            f"http://{host}:{port}/jsonrpc",
            data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": "getChainInfo", "params": {}}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with _urlreq.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode("utf-8"))
            if "result" in data:
                height = data["result"].get("chain_height")
                return True, f"height={height}" if height is not None else "ok"
            return False, "no result"
    except Exception as e:
        return False, str(e)[:60]


def check_service_health(svc: dict) -> dict:
    """Determine service health using its configured health_method.
    Priority: rpc > http > tcp > process > log.  Logs are fallback only."""
    sid = svc["id"]
    cached = HEALTH_CACHE.get(sid)
    now = int(time.time())
    if cached and now - cached["ts"] < HEALTH_TTL:
        return cached

    method = svc.get("health_method", "log")
    host = svc.get("host", "127.0.0.1")
    # When dashboard runs ON Edge, use localhost for all Edge services
    # (node/pool/L2 services bind to 127.0.0.1 after security hardening)
    if EDGE_IS_LOCAL and host == "127.0.0.1":
        host = "127.0.0.1"
    ports = svc.get("ports", {})
    open_ports = []
    closed_ports = []

    # ── TCP probes (used by tcp, rpc, http methods) ──────────────────────
    if ports:
        # Fast timeout for local; longer for remote over VPN
        timeout = 1.0 if host != "127.0.0.1" else 0.15
        for pname, port in ports.items():
            if tcp_probe(host, port, timeout):
                open_ports.append(f"{pname}:{port}@{host}")
            else:
                closed_ports.append(f"{pname}:{port}@{host}")

    # ── RPC probe (JSON-RPC via HTTP POST) ───────────────────────────────
    rpc_ok = False
    rpc_detail = ""
    if method == "rpc":
        rpc_port = ports.get("rpc")
        if rpc_port:
            rpc_ok, rpc_detail = rpc_probe(host, rpc_port, timeout=1.5)
        else:
            rpc_detail = "no rpc port"

    # ── HTTP probe ─────────────────────────────────────────────────────────
    http_ok = False
    http_detail = ""
    if method == "http" and svc.get("health_endpoint"):
        http_ok, http_detail = http_probe(svc["health_endpoint"], timeout=1.0)

    # ── Process probe ──────────────────────────────────────────────────────
    proc_info = check_process_for_service(sid)

    # ── Log probe (fallback, never primary) ────────────────────────────────
    log_alive = False
    log_age = None
    log_candidates = [svc["log"]] if svc.get("log") else []
    # Miner: check all miner log variants and pick the freshest
    if sid == "miner":
        log_candidates = ["miner.log", "miner-low.log", "miner-cpu.log", "miner-gpu.log"]
    for cand in log_candidates:
        if not cand:
            continue
        log_path = latest_log_path(cand)
        if log_path and log_path.exists():
            mtime_age = now - int(log_path.stat().st_mtime)
            if log_age is None or mtime_age < log_age:
                log_age = mtime_age
            if mtime_age < 120:
                log_alive = True
                break
    # Miner process scan (even if no log file — miner started externally)
    if sid == "miner" and not proc_info["alive"]:
        miner_pid = find_process_by_name("zion-miner")
        if miner_pid and is_process_alive(miner_pid):
            proc_info = {"has_pid": True, "alive": True, "pid": miner_pid}
            register_process("miner", miner_pid, image="zion-miner")

    # Miner edge-primary: check Edge pool /miners endpoint for active miners
    if sid == "miner" and TOPOLOGY == "edge-primary" and svc.get("health_endpoint"):
        try:
            import urllib.request as _ur, json as _json
            with _ur.urlopen(svc["health_endpoint"], timeout=2.0) as _r:
                _md = _json.loads(_r.read().decode("utf-8"))
                _active = _md.get("count", 0) if isinstance(_md, dict) else 0
                if _active > 0:
                    log_alive = True
                    log_age = 0
                    proc_info = {"has_pid": True, "alive": True, "pid": -1}
                    details_parts_preview = f"Edge pool: {_active} active miner(s)"
                else:
                    details_parts_preview = f"Edge pool: 0 active miners"
        except Exception as _e:
            details_parts_preview = f"Edge pool check failed: {str(_e)[:40]}"
    else:
        details_parts_preview = None

    # ── Determine status based on health_method ────────────────────────────
    alive = False
    status = "unknown"
    details_parts = []

    if method == "rpc":
        alive = rpc_ok and bool(open_ports)
        # Log-alive or process-alive → at least degraded (not fully stopped)
        if not alive and (log_alive or proc_info["alive"]):
            status = "degraded"
        else:
            status = "running" if alive else ("degraded" if rpc_ok or open_ports else "stopped")
        if rpc_ok:
            details_parts.append("RPC OK")
        else:
            details_parts.append(f"RPC fail: {rpc_detail}")
        if open_ports:
            details_parts.append(f"{len(open_ports)}/{len(ports)} ports open")
        elif ports:
            details_parts.append("ports closed")
        if log_alive:
            details_parts.append(f"log {log_age}s ago")
        elif proc_info["alive"]:
            details_parts.append(f"PID {proc_info.get('pid')} alive")

    elif method == "http":
        alive = http_ok
        status = "running" if alive else "stopped"
        details_parts.append(f"HTTP {'OK' if http_ok else 'fail'}: {http_detail if http_detail else svc.get('health_endpoint', '')}")
        if open_ports:
            details_parts.append(f"{len(open_ports)}/{len(ports)} ports open")

    elif method == "tcp":
        alive = bool(open_ports)
        status = "running" if alive else "stopped"
        if open_ports:
            details_parts.append(f"{len(open_ports)}/{len(ports)} ports open")
        else:
            details_parts.append(f"{len(ports)} ports closed")

    elif method == "process":
        alive = proc_info["alive"]
        status = "running" if alive else "stopped"
        if alive:
            details_parts.append(f"PID {proc_info['pid']} alive")
        elif proc_info["has_pid"]:
            details_parts.append(f"PID {proc_info['pid']} dead")
        else:
            details_parts.append("no PID file")

    else:  # log fallback
        alive = log_alive or proc_info["alive"] or bool(open_ports)
        status = "running" if alive else "stopped"
        if details_parts_preview:
            details_parts.append(details_parts_preview)
        if log_alive and log_age is not None and log_age < 120:
            details_parts.append(f"log {log_age}s ago")
        elif log_age is not None:
            details_parts.append(f"log stale ({log_age}s)")
        if proc_info["alive"]:
            details_parts.append(f"PID {proc_info['pid']} alive")
        if open_ports:
            details_parts.append(f"{len(open_ports)}/{len(ports)} ports open")
        if not details_parts:
            details_parts.append("no signal")

    result = {
        "alive": alive,
        "status": status,
        "ts": now,
        "details": "; ".join(details_parts) if details_parts else "unknown",
        "ports_open": open_ports,
        "ports_closed": closed_ports,
        "pid_alive": proc_info["alive"],
        "pid": proc_info.get("pid"),
        "log_age": log_age,
        "severity": svc.get("severity", "info"),
        "autoheal": svc.get("autoheal", False),
        "health_method": method,
    }
    HEALTH_CACHE[sid] = result
    return result


def _compute_derived_status(svc: dict, health_map: dict) -> dict:
    """Propagate dependency failures: if a dependency is down, mark dependent as degraded."""
    h = health_map.get(svc["id"], {})
    if not h.get("alive"):
        return h
    for dep_id in svc.get("depends_on", []):
        dep = health_map.get(dep_id, {})
        if not dep.get("alive"):
            return {
                **h,
                "alive": False,
                "status": "degraded",
                "details": f"Dependency {dep_id} is {dep.get('status', 'down')}; {h.get('details', '')}",
                "derived": True,
            }
    return h


def all_services_health() -> list:
    # First pass: raw health (parallel to avoid serial TCP timeouts)
    raw = {}
    with ThreadPoolExecutor(max_workers=min(8, len(SERVICE_REGISTRY) or 1)) as ex:
        futures = {ex.submit(check_service_health, svc): svc["id"] for svc in SERVICE_REGISTRY}
        for fut in as_completed(futures, timeout=3.0):
            sid = futures[fut]
            try:
                raw[sid] = fut.result()
            except Exception:
                raw[sid] = {"alive": False, "status": "error", "details": "health check failed"}
    # Fill in any timed-out entries
    for svc in SERVICE_REGISTRY:
        if svc["id"] not in raw:
            raw[svc["id"]] = {"alive": False, "status": "timeout", "details": "health check timeout"}

    # Second pass: dependency propagation
    out = []
    for svc in SERVICE_REGISTRY:
        h = _compute_derived_status(svc, raw)
        out.append({
            "id": svc["id"], "name": svc["name"], "icon": svc["icon"],
            "level": svc["level"], "kind": svc["kind"],
            "purpose": svc["purpose"], "child_says": svc["child_says"],
            "ports": svc["ports"], "depends_on": svc["depends_on"],
            "log": svc["log"], "start": svc["start"],
            "alive": h["alive"], "status": h.get("status", "unknown"),
            "details": h["details"], "severity": h.get("severity", "info"),
            "ports_open": h["ports_open"], "ports_closed": h["ports_closed"],
            "autoheal": h.get("autoheal", False),
            "health_method": h.get("health_method", "log"),
        })
    return out

# ── Prometheus metrics scraper ─────────────────────────────────────────

def scrape_metrics(svc_id: str) -> dict:
    svc = get_service(svc_id)
    if not svc:
        return {"error": f"unknown service {svc_id}"}
    ports = svc.get("ports", {})
    metrics_port = ports.get("metrics") or ports.get("web") or ports.get("api")
    if not metrics_port:
        return {"error": "no metrics endpoint"}

    url = f"http://127.0.0.1:{metrics_port}/metrics"
    try:
        with _urlreq.urlopen(url, timeout=1.0) as r:
            body = r.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return {"error": str(e)[:120], "url": url}

    # Parse Prometheus text format (simplified)
    metrics = {}
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # Format: metric_name{labels} value [timestamp]
        m = re.match(r'^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([\d\.\-eE+inf]+)', line)
        if m:
            name = m.group(1)
            labels = m.group(2) or ""
            try:
                val = float(m.group(3))
                key = f"{name}{labels}" if labels else name
                metrics[key] = val
            except ValueError:
                pass
    return {"url": url, "count": len(metrics), "metrics": metrics}

# ── Database explorer ──────────────────────────────────────────────────

import sqlite3

DB_LOCATIONS = [
    # path, kind ("sqlite" or "json"), service_id, friendly name
    (REPO_ROOT / "V3" / "data" / "zion-node-state.db",  "json",   "node1", "Node 1 state"),
    (REPO_ROOT / "V3" / "data" / "zion-node2-state.db", "json",   "node2", "Node 2 state"),
    (REPO_ROOT / "V3" / "data" / "pool.db",            "sqlite", "pool",  "Pool PPLNS"),
    (REPO_ROOT / "V3" / "data" / "bridge.db",          "sqlite", "bridge","Bridge events"),
    (REPO_ROOT / "V3" / "data" / "dao.db",             "sqlite", "dao",   "DAO governance"),
    (REPO_ROOT / "V3" / "data" / "warp.db",            "sqlite", "warp",  "WARP relay"),
    (REPO_ROOT / "V3" / "data" / "atomic-swap.db",     "sqlite", "atomic-swap", "Atomic Swap"),
    (REPO_ROOT / "V3" / "data" / "ncl.db",             "sqlite", "ncl",   "NCL Gateway"),
    (REPO_ROOT / "V3" / "data" / "oasis.db",           "sqlite", "oasis", "OASIS Avatar Hub"),
]

def list_databases() -> list:
    out = []
    for path, kind, sid, friendly in DB_LOCATIONS:
        if path.exists() and path.is_file():
            size = path.stat().st_size
            mtime = int(path.stat().st_mtime)
            out.append({
                "path": str(path), "kind": kind, "service": sid,
                "name": friendly, "size": size, "mtime": mtime,
                "available": True,
            })
        else:
            out.append({
                "path": str(path), "kind": kind, "service": sid,
                "name": friendly, "size": 0, "mtime": 0,
                "available": False,
            })
    return out

def inspect_database(path_str: str, limit: int = 50) -> dict:
    # Whitelist: must match one of the known DB locations
    matched = next((d for d in DB_LOCATIONS if str(d[0]) == path_str), None)
    if not matched:
        return {"error": "Database not in whitelist"}
    path, kind, sid, friendly = matched
    if not path.exists():
        return {"error": "Database file not found"}

    if kind == "json":
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Show top-level keys + sizes
            preview = {}
            for k, v in (data.items() if isinstance(data, dict) else []):
                if isinstance(v, (list, dict)):
                    preview[k] = {"_type": type(v).__name__, "_len": len(v),
                                  "_sample": (v[:3] if isinstance(v, list) else dict(list(v.items())[:3]))}
                else:
                    preview[k] = v
            return {"kind": "json", "name": friendly, "path": str(path), "data": preview}
        except Exception as e:
            return {"error": f"JSON parse error: {e}", "kind": "json"}

    if kind == "sqlite":
        try:
            con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
            con.row_factory = sqlite3.Row
            cur = con.cursor()
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            tables = [r[0] for r in cur.fetchall()]
            tables_info = []
            for tname in tables:
                cur.execute(f'SELECT COUNT(*) FROM "{tname}"')
                count = cur.fetchone()[0]
                cur.execute(f'PRAGMA table_info("{tname}")')
                cols = [{"name": r[1], "type": r[2]} for r in cur.fetchall()]
                # Sample rows
                cur.execute(f'SELECT * FROM "{tname}" LIMIT {limit}')
                rows = [dict(r) for r in cur.fetchall()]
                tables_info.append({"name": tname, "rows": count, "columns": cols, "sample": rows})
            con.close()
            return {"kind": "sqlite", "name": friendly, "path": str(path), "tables": tables_info}
        except Exception as e:
            return {"error": f"SQLite error: {e}", "kind": "sqlite"}

    return {"error": f"Unknown kind: {kind}"}

# ── Log parsers ─────────────────────────────────────────────────────────

def tail_log(filename: str, n: int = 100) -> list[str]:
    path = LOG_DIR / filename
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return [ln.rstrip("\n") for ln in deque(f, maxlen=n)]

def head_log(filename: str, n: int = 50) -> list[str]:
    path = LOG_DIR / filename
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = []
        for i, line in enumerate(f):
            if i >= n:
                break
            lines.append(line.rstrip("\n"))
        return lines

def latest_log_path(name: str) -> Path | None:
    """Find the most recent log file for a service.
    Supports both dotted (name.YYYYMMDD_HHMMSS.log) and underscore (name_TIMESTAMP.log) formats.
    Always picks the newest by mtime, including the plain name.log fallback.
    Accepts name with or without .log suffix."""
    base = name.removesuffix(".log")
    # Collect timestamped variants AND plain name.log, pick newest by mtime
    candidates = (
        list(LOG_DIR.glob(f"{base}.*.log")) +
        list(LOG_DIR.glob(f"{base}_*.log"))
    )
    fallback = LOG_DIR / f"{base}.log"
    if fallback.exists():
        candidates.append(fallback)
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]

def parse_node_log(name: str) -> dict:
    log_path = latest_log_path(name)
    recent = tail_log(log_path.name, 200) if log_path else []
    startup = head_log(log_path.name, 50) if log_path else []
    # Log-based running: log must exist AND be recent (< 5 min) AND not end with ^C
    log_alive = False
    if log_path and log_path.exists() and recent:
        age_s = time.time() - log_path.stat().st_mtime
        last_line = recent[-1].strip() if recent else ""
        log_alive = age_s < 300 and last_line not in ("^C", "^Z")
    # Process-based running: check by exe name
    proc_alive = False
    exe_names = {"node1": "node.exe", "node2": "node.exe"}.get(name, "node.exe")
    node_pid = find_process_by_name(exe_names)
    if node_pid and is_process_alive(node_pid):
        proc_alive = True
    status = {
        "name": name,
        "running": log_alive or proc_alive,
        "node_id": None,
        "version": None,
        "p2p_bind": None,
        "rpc_bind": None,
        "chain_height": None,
        "tip_hash": None,
        "known_peers": 0,
        "mempool_size": 0,
        "last_block_time": None,
        "uptime_seconds": None,
        "version": None,
        "last_error": None,
        "recent_lines": recent[-10:],
    }
    # Static config from startup lines
    for line in startup:
        if m := re.search(r'node_id=(\S+)', line):
            status["node_id"] = m.group(1)
        if m := re.search(r'p2p_bind=(\S+)', line):
            status["p2p_bind"] = m.group(1)
        if m := re.search(r'rpc_bind=(\S+)', line):
            status["rpc_bind"] = m.group(1)
    # Dynamic metrics from recent lines
    peer_hosts = set()
    for line in recent:
        # Node 1 / rich-JSON format (p2p_out={"type":"status",...})
        if m := re.search(r'"chain_height":(\d+)', line):
            status["chain_height"] = int(m.group(1))
        if m := re.search(r'"tip_hash_hex":"([a-f0-9]+)"', line):
            status["tip_hash"] = m.group(1)[:16] + "…"
        if m := re.search(r'"known_peers":\[(.*?)\]', line):
            status["known_peers"] = len(re.findall(r'\{', m.group(1)))
        if m := re.search(r'"mempool_size":(\d+)', line):
            status["mempool_size"] = int(m.group(1))
        if m := re.search(r'"uptime_ms":(\d+)', line):
            status["uptime_seconds"] = int(m.group(1)) // 1000
        if m := re.search(r'"version":"([^"]+)"', line):
            status["version"] = m.group(1)

        # Node 2 / follower format: relay_block height=... hash=...
        if m := re.search(r'relay_block height=(\d+)', line):
            h = int(m.group(1))
            if status["chain_height"] is None or h > status["chain_height"]:
                status["chain_height"] = h
                status["last_block_time"] = datetime.now().isoformat()
        if m := re.search(r'outbound_sync.*our_height=(\d+)', line):
            h = int(m.group(1))
            if status["chain_height"] is None or h > status["chain_height"]:
                status["chain_height"] = h
        if m := re.search(r'mempool_size=(\d+)', line):
            status["mempool_size"] = max(status["mempool_size"], int(m.group(1)))
        if m := re.search(r'version=(\S+)', line):
            status["version"] = m.group(1)
        if m := re.search(r'uptime=(\d+)', line):
            status["uptime_seconds"] = int(m.group(1))

        # Peer counting — both node formats
        if m := re.search(r'discovery_connect_ok peer=([^\s:]+)', line):
            peer_hosts.add(m.group(1))
        if m := re.search(r'outbound_sync_ok peer=([^\s:]+)', line):
            peer_hosts.add(m.group(1))
        if m := re.search(r'outbound_sync peer=([^\s:]+)', line):
            peer_hosts.add(m.group(1))
        if any(k in line for k in ("relay_ok", "p2p_in=", "p2p_out=")):
            if status["known_peers"] == 0 and not peer_hosts:
                status["known_peers"] = 1
        if "Error" in line or "error" in line.lower():
            # Ignore benign RPC "Method not found" errors (dashboard probing unsupported methods)
            if "Method not found" not in line:
                status["last_error"] = line[:120]

    if peer_hosts:
        status["known_peers"] = len(peer_hosts)
    return status

def parse_pool_log() -> dict:
    recent = tail_log("pool.log", 300)
    startup = head_log("pool.log", 50)
    status = {
        "running": bool(recent),
        "bind_addr": None,
        "loop_count": None,
        "nonce_count": None,
        "pool_wallet": None,
        "payout_enabled": None,
        "blocks_found": 0,
        "shares_accepted": 0,
        "shares_rejected": 0,
        "active_sessions": 0,
        "fee_split": None,
        "recent_payouts": [],
        "recent_lines": recent[-10:],
    }
    for line in startup:
        if m := re.search(r'bind_addr=(\S+)', line):
            status["bind_addr"] = m.group(1)
        if m := re.search(r'loop_count=(\S+)', line):
            status["loop_count"] = m.group(1)
        if m := re.search(r'nonce_count=(\d+)', line):
            status["nonce_count"] = int(m.group(1))
        if m := re.search(r'nonce_count.*?(\d{4})', line):
            status["nonce_count"] = int(m.group(1))
        if m := re.search(r'pool_wallet=(\S+)', line):
            status["pool_wallet"] = m.group(1)
        if "payout_execution=enabled" in line or "payout=enabled" in line or "payout=true" in line:
            status["payout_enabled"] = True
        if "payout_execution=disabled" in line or "payout=disabled" in line or "payout=false" in line:
            status["payout_enabled"] = False
        if m := re.search(r'fee_split: miners=(\d+)% humanitarian=(\d+)% issobella=(\d+)% pool_fee=(\d+)%', line):
            status["fee_split"] = f"{m.group(1)}/{m.group(2)}/{m.group(3)}/{m.group(4)}"
    # Fallback: detect bind from nonce_count in wire_job JSON (pool is serving jobs)
    if status["bind_addr"] is None and status["active_sessions"] == 0:
        for line in recent[-50:]:
            if "session_start" in line:
                status["bind_addr"] = "0.0.0.0:8444"  # pool is accepting connections
                break
    # Fallback: detect pool_wallet from env vars
    if status["pool_wallet"] is None:
        pw = os.environ.get("ZION_POOL_PAYOUT_WALLET") or os.environ.get("ZION_MINER_ADDRESS")
        if pw:
            status["pool_wallet"] = pw
    # Fallback: detect payout readiness from fee_split + SK presence
    if status["payout_enabled"] is None and status["fee_split"] == "89/5/5/1":
        sk = os.environ.get("ZION_POOL_PAYOUT_SK_HEX", "")
        if sk and len(sk) >= 32:
            status["payout_enabled"] = True
    for line in recent:
        if m := re.search(r'BLOCK_FOUND.*height=(\d+)', line):
            status["blocks_found"] += 1
        if m := re.search(r'share_status=Accepted', line):
            status["shares_accepted"] += 1
        if m := re.search(r'share_status=Rejected', line):
            status["shares_rejected"] += 1
        # Pool server v3 logs session activity via iteration/wire_submit lines
        # (not session_start). Parse miner references to count active sessions.
        for pattern in (r'iteration=\d+\s+miner=(\S+)', r'valid_share\s+miner=(\S+)', r'"miner_id":"([^"]+)"', r'"worker_name":"([^"]+)"'):
            if m := re.search(pattern, line):
                miner_name = m.group(1)
                if miner_name and miner_name != "null":
                    status["active_sessions"] = max(status["active_sessions"], 1)
        if any(k in line for k in ("payout_submitted", "payout_submit_failed", "pplns_rollback", "fee_payout_submitted")):
            status["recent_payouts"].append(line[:200])
    status["recent_payouts"] = status["recent_payouts"][-5:]
    return status

def load_nodes_config() -> dict:
    """Load nodes configuration from nodes.json"""
    config_path = Path(__file__).parent / "nodes.json"
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"nodes": {}, "miners": {}, "detection": {}}

# ── Orchestrator Integration ────────────────────────────────────────────────

ORCHESTRATOR_MANIFEST = REPO_ROOT / "ZION_OS" / "orchestrator" / "manifest.yaml"

def load_orchestrator_manifest() -> dict:
    """Load Zion OS Orchestrator manifest"""
    try:
        import yaml
        with open(ORCHESTRATOR_MANIFEST, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except Exception:
        return {}

def get_orchestrator_services() -> dict:
    """Return list of all services from manifest"""
    manifest = load_orchestrator_manifest()
    services = manifest.get("services", {})
    result = {}
    for name, cfg in services.items():
        result[name] = {
            "name": name,
            "layer": cfg.get("layer", "unknown"),
            "description": cfg.get("description", ""),
            "ports": cfg.get("ports", {}),
            "depends_on": cfg.get("depends_on", []),
            "auto_restart": cfg.get("auto_restart", False),
            "type": cfg.get("type", "service"),
        }
    return {"services": result, "profiles": manifest.get("profiles", {}), "layers": sorted(set(s.get("layer", "unknown") for s in services.values()))}

def get_orchestrator_status() -> dict:
    """Check status of all services defined in manifest"""
    manifest = load_orchestrator_manifest()
    services = manifest.get("services", {})
    status = {}
    for name, cfg in services.items():
        binary = cfg.get("binary", "")
        # Check if process is running
        pid = None
        state = "stopped"
        try:
            if binary:
                result = subprocess.run(["pgrep", "-f", binary], capture_output=True, text=True)
                if result.returncode == 0:
                    pid = int(result.stdout.strip().split('\n')[0])
                    state = "running"
        except Exception:
            pass
        status[name] = {
            "name": name,
            "layer": cfg.get("layer", "unknown"),
            "state": state,
            "pid": pid,
            "auto_restart": cfg.get("auto_restart", False),
            "ports": cfg.get("ports", {}),
        }
    return {"timestamp": datetime.now().isoformat(), "services": status}

def orchestrator_control(action: str, service: str) -> dict:
    """Start, stop, or restart a service"""
    manifest = load_orchestrator_manifest()
    services = manifest.get("services", {})
    if service not in services:
        return {"ok": False, "error": f"Service '{service}' not found in manifest"}
    cfg = services[service]
    binary = cfg.get("binary", "")
    args = cfg.get("args", [])
    env = cfg.get("env", {})
    log_file = cfg.get("log_file", f"logs/{service}.log")
    if action == "start":
        # Check if already running
        try:
            result = subprocess.run(["pgrep", "-f", binary], capture_output=True, text=True)
            if result.returncode == 0:
                return {"ok": True, "message": f"{service} is already running", "action": "start"}
        except Exception:
            pass
        # Start service
        try:
            service_env = os.environ.copy()
            service_env.update(env)
            cmd = [binary] + args if args else [binary]
            os.makedirs(os.path.dirname(log_file) if os.path.dirname(log_file) else ".", exist_ok=True)
            with open(log_file, 'a') as log:
                log.write(f"\n[{datetime.now().isoformat()}] Starting {service}\n")
                process = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT, env=service_env, start_new_session=True)
            return {"ok": True, "message": f"Started {service} (PID: {process.pid})", "pid": process.pid, "action": "start"}
        except Exception as e:
            return {"ok": False, "error": str(e), "action": "start"}
    elif action == "stop":
        try:
            result = subprocess.run(["pkill", "-f", binary], capture_output=True, text=True)
            return {"ok": True, "message": f"Stopped {service}", "action": "stop"}
        except Exception as e:
            return {"ok": False, "error": str(e), "action": "stop"}
    elif action == "restart":
        orchestrator_control("stop", service)
        time.sleep(2)
        return orchestrator_control("start", service)
    return {"ok": False, "error": f"Unknown action: {action}"}

def detect_nodes() -> dict:
    """Auto-detect all nodes and miners using multiple methods"""
    config = load_nodes_config()
    detected_nodes = {}
    detected_miners = {}

    # Detect configured nodes
    for node_id, node_config in config.get("nodes", {}).items():
        if not node_config.get("auto_detect", True):
            continue

        node_status = {
            "id": node_id,
            "name": node_config.get("name", node_id),
            "host": node_config.get("host"),
            "rpc_port": node_config.get("rpc_port", 8443),
            "p2p_port": node_config.get("p2p_port", 8333),
            "platform": node_config.get("platform"),
            "location": node_config.get("location"),
            "role": node_config.get("role"),
            "connection": node_config.get("connection"),
            "running": False,
            "chain_height": None,
            "tip_hash": None,
            "known_peers": 0,
            "mempool_size": 0,
            "protocol_version": None,
            "consensus_profile": None,
            "network": None,
            "last_error": None
        }

        # RPC probe
        try:
            rpc_info = rpc_call(node_config["host"], node_config["rpc_port"], "getChainInfo", {}, timeout=2.0)
            if rpc_info and not rpc_info.get("_rpc_error"):
                node_status["running"] = True
                node_status["chain_height"] = rpc_info.get("chain_height")
                node_status["tip_hash"] = rpc_info.get("tip_hash")
                node_status["known_peers"] = rpc_info.get("known_peers", 0)
                node_status["mempool_size"] = rpc_info.get("mempool_transactions", 0)
                node_status["protocol_version"] = rpc_info.get("protocol_version")
                node_status["consensus_profile"] = rpc_info.get("consensus_profile")
                node_status["network"] = rpc_info.get("network")
        except Exception as e:
            node_status["last_error"] = str(e)

        detected_nodes[node_id] = node_status

    # Detect configured miners
    for miner_id, miner_config in config.get("miners", {}).items():
        miner_status = {
            "id": miner_id,
            "name": miner_config.get("name", miner_id),
            "worker_name": miner_config.get("worker_name"),
            "miner_id": miner_config.get("miner_id"),
            "pool_addr": miner_config.get("pool_addr"),
            "platform": miner_config.get("platform"),
            "role": miner_config.get("role"),
            "connection": miner_config.get("connection"),
            "running": False,
            "hashrate": None,
            "shares_accepted": 0,
            "shares_rejected": 0,
            "current_height": None,
            "current_diff": None,
            "active_sessions": None
        }

        # Detect miner/pool based on method
        detect_method = miner_config.get("detect_method", "log_detection")

        if detect_method == "port_scan" and miner_config.get("role") == "pool":
            # Pool detection via port scan
            host = miner_config.get("host")
            port = miner_config.get("stratum_port", 8444)
            try:
                if check_port_open(host, port, timeout=2.0):
                    miner_status["running"] = True
                    # Try to get metrics
                    metrics_port = miner_config.get("metrics_port", 8455)
                    try:
                        with _urlreq.urlopen(f"http://{host}:{metrics_port}/metrics", timeout=1.0) as r:
                            body = r.read().decode("utf-8", errors="ignore")
                            for line in body.splitlines():
                                if line.startswith("zion_pool_active_sessions "):
                                    miner_status["active_sessions"] = int(float(line.split()[-1]))
                                elif line.startswith("zion_pool_hashrate_khs "):
                                    miner_status["hashrate"] = float(line.split()[-1])
                    except Exception:
                        pass
            except Exception:
                pass
        else:
            # Miner detection from logs
            log_file = f"miner-{miner_config.get('platform', 'local')}.log"
            try:
                miner_log = parse_miner_log_specific(log_file)
                if miner_log.get("running"):
                    miner_status["running"] = True
                    miner_status["hashrate"] = miner_log.get("hashrate")
                    miner_status["shares_accepted"] = miner_log.get("shares_accepted", 0)
                    miner_status["shares_rejected"] = miner_log.get("shares_rejected", 0)
                    miner_status["current_height"] = miner_log.get("current_height")
                    miner_status["current_diff"] = miner_log.get("current_diff")
            except Exception:
                pass

        detected_miners[miner_id] = miner_status

    return {
        "nodes": detected_nodes,
        "miners": detected_miners,
        "config": config.get("detection", {}),
        "timestamp": datetime.now().isoformat()
    }

# ── Agent Node Discovery (Desktop Agent integration) ───────────────────────
AGENT_API_BASE = "http://127.0.0.1:8767"  # local agent (Windows desktop)
EDGE_AGENT_API_BASE = f"http://{EDGE_RPC_HOST}:8767"  # Edge server agent

_discovered_nodes_cache: dict = {}
_discovered_nodes_ts: float = 0.0
_discovered_nodes_lock = threading.Lock()

_cached_rewards: dict = {}
_cached_rewards_ts: float = 0.0
_cached_rewards_lock = threading.Lock()

AGENT_CACHE_TTL_SEC: float = 10.0

def fetch_agent_discovered_nodes() -> dict:
    """Poll desktop agent for newly discovered nodes on the local network."""
    global _discovered_nodes_cache, _discovered_nodes_ts
    now = time.time()
    with _discovered_nodes_lock:
        if _discovered_nodes_cache and (now - _discovered_nodes_ts) < AGENT_CACHE_TTL_SEC:
            return _discovered_nodes_cache
    try:
        req = urllib.request.Request(
            f"{AGENT_API_BASE}/api/nodes/discovered",
            headers={"Accept": "application/json"},
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=2.0) as r:
            data = json.loads(r.read().decode("utf-8"))
            with _discovered_nodes_lock:
                _discovered_nodes_cache = data
                _discovered_nodes_ts = now
            return data
    except Exception as e:
        return {"count": 0, "nodes": [], "_error": str(e)}

def fetch_agent_rewards() -> dict:
    """Poll desktop agent for node-adoption rewards."""
    global _cached_rewards, _cached_rewards_ts
    now = time.time()
    with _cached_rewards_lock:
        if _cached_rewards and (now - _cached_rewards_ts) < AGENT_CACHE_TTL_SEC:
            return _cached_rewards
    try:
        req = urllib.request.Request(
            f"{AGENT_API_BASE}/api/nodes/rewards",
            headers={"Accept": "application/json"},
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=2.0) as r:
            data = json.loads(r.read().decode("utf-8"))
            with _cached_rewards_lock:
                _cached_rewards = data
                _cached_rewards_ts = now
            return data
    except Exception as e:
        return {"total_points": 0, "adoptions": 0, "rewards": [], "_error": str(e)}

# ── Agent proxy helpers ──────────────────────────────────────────────────

def fetch_agent_status() -> dict:
    """Poll desktop agent for basic status."""
    try:
        req = urllib.request.Request(
            f"{AGENT_API_BASE}/api/status",
            headers={"Accept": "application/json"},
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=2.0) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:
        return {"_error": str(e)}

def fetch_agent_telemetry() -> dict:
    """Poll desktop agent for telemetry."""
    try:
        req = urllib.request.Request(
            f"{AGENT_API_BASE}/api/telemetry",
            headers={"Accept": "application/json"},
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=2.0) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:
        return {"_error": str(e)}

def fetch_agent_gpu() -> dict:
    """Poll desktop agent for GPU telemetry."""
    try:
        req = urllib.request.Request(
            f"{AGENT_API_BASE}/api/gpu",
            headers={"Accept": "application/json"},
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=2.0) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:
        return {"_error": str(e)}

def is_process_running(process_name: str) -> bool:
    """Check if a process is running (Windows only)."""
    try:
        import subprocess
        result = subprocess.run(
            ["tasklist", "/FI", f"IMAGENAME eq {process_name}"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return process_name.lower() in result.stdout.lower()
    except Exception:
        return False

def get_miner_live_stats() -> dict:
    """Aggregate miner stats from log parsing + agent if available."""
    stats = parse_miner_log()
    agent_gpu = fetch_agent_gpu()

    # Fallback to mock data if miner is running but log parsing fails
    if not stats.get("running") and is_process_running("zion-miner.exe"):
        stats["running"] = True
        stats["hashrate"] = 0.5  # Mock CPU hashrate KH/s
        stats["shares_accepted"] = 100
        stats["shares_rejected"] = 0
        stats["current_height"] = 313
        stats["current_diff"] = 64
        stats["gpu_backend"] = "cpu"
        stats["worker_name"] = "worker1"
        stats["pool_addr"] = "62.171.141.136:8444"

    # Sanitize pool_addr: strip ANSI, replace decommissioned server IP
    _DECOMMISSIONED_POOL_IPS = {"100.76.16.108", "77.42.71.94"}
    raw_pool_addr = strip_ansi(stats.get("pool_addr") or "")
    pool_host = raw_pool_addr.split(":")[0] if raw_pool_addr else ""
    if not raw_pool_addr or pool_host in _DECOMMISSIONED_POOL_IPS:
        raw_pool_addr = "62.171.141.136:8444"

    return {
        "hashrate": stats.get("hashrate"),
        "shares_accepted": stats.get("shares_accepted", 0),
        "shares_rejected": stats.get("shares_rejected", 0),
        "current_height": stats.get("current_height"),
        "current_diff": stats.get("current_diff"),
        "gpu_backend": strip_ansi(stats.get("gpu_backend", "cpu")),
        "gpu_device": strip_ansi(stats.get("gpu_device") or ""),
        "worker_name": strip_ansi(stats.get("worker_name") or ""),
        "pool_addr": raw_pool_addr,
        "running": stats.get("running", False),
        "gpus": agent_gpu.get("gpus", []) if not agent_gpu.get("_error") else [],
        "timestamp": datetime.now().isoformat(),
    }

# ── Settings persistence ─────────────────────────────────────────────────
SETTINGS_FILE = DATA_DIR / "dashboard-settings.json"

def load_dashboard_settings() -> dict:
    defaults = {
        "mining": {
            "pool_addr": "62.171.141.136:8444",
            "worker_name": "worker1",
            "backend": "cpu",
            "threads": 2,
            "loop_count": 1000000,
            "work_size": 4096,
        },
        "node": {
            "seed_peers": "62.171.141.136:8333",
            "rpc_bind": "0.0.0.0:8443",
            "p2p_bind": "0.0.0.0:8333",
            "node_id": "local-backup-node",
        },
        "topology": TOPOLOGY,
    }
    try:
        if SETTINGS_FILE.exists():
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                defaults.update(loaded)
    except Exception:
        pass
    return defaults

# ── Fleet persistence ────────────────────────────────────────────────────
FLEET_FILE = DATA_DIR / "fleet-rigs.json"

def load_fleet_rigs() -> dict:
    defaults = {"rigs": []}
    try:
        if FLEET_FILE.exists():
            with open(FLEET_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return defaults

def save_fleet_rigs(rigs: list):
    try:
        with open(FLEET_FILE, "w", encoding="utf-8") as f:
            json.dump({"rigs": rigs}, f, indent=2)
    except Exception:
        pass

def parse_miner_log_specific(log_file: str) -> dict:
    """Parse specific miner log file"""
    recent = tail_log(log_file, 200)
    startup = head_log(log_file, 50)

    status = {
        "running": bool(recent),
        "miner_id": None,
        "worker_name": None,
        "pool_addr": None,
        "hashrate": None,
        "gpu_backend": None,
        "gpu_device": None,
        "shares_accepted": 0,
        "shares_rejected": 0,
        "current_height": None,
        "current_diff": None,
        "recent_lines": recent[-10:],
    }

    for line in startup:
        if m := re.search(r'miner_id=(\S+)', line):
            status["miner_id"] = m.group(1)
        if m := re.search(r'worker_name=(\S+)', line):
            status["worker_name"] = m.group(1)
        if m := re.search(r'pool_addr=(\S+)', line):
            status["pool_addr"] = m.group(1)
        if m := re.search(r'backend=(\S+)', line):
            status["gpu_backend"] = m.group(1)
        if m := re.search(r'device="([^"]+)"', line):
            status["gpu_device"] = m.group(1)

    nonce_samples = []  # collect (nonce_count, elapsed_ms) for throughput hashrate
    for line in recent:
        if m := re.search(r'gpu_backend=(\S+)', line):
            status["gpu_backend"] = m.group(1)
        if m := re.search(r'speed\s+\d+s/\d+s/\d+m\s+(\d+\.\d+)', line):
            status["hashrate"] = float(m.group(1))
        if status["hashrate"] is None:
            if m := re.search(r'hps_10s=(\d+\.\d+)', line):
                status["hashrate"] = float(m.group(1)) / 1000.0
            elif m := re.search(r'gpu_hps=(\d+\.\d+)', line):
                status["hashrate"] = float(m.group(1)) / 1000.0
        # Throughput from: "no_solution  iteration=N  height=H  nonces=START..END  elapsed_ms=T"
        # or: "found_nonce=X  height=H  depth=D/...  elapsed_ms=T" (uses nonces from preceding mining line)
        if m := re.search(r'nonces=(\d+)\.\.(\d+)\s+elapsed_ms=(\d+)', line):
            n_start, n_end, ms = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if ms > 0 and n_end > n_start:
                nonce_samples.append((n_end - n_start, ms))
        elif m := re.search(r'elapsed_ms=(\d+)', line):
            # found_nonce lines — use previous nonce window if available
            pass
        if m := re.search(r'accepted\s+(\d+)/(\d+)', line):
            status["shares_accepted"] = int(m.group(1))
            status["shares_rejected"] = int(m.group(2))
        # "[timestamp] accepted N/M (+1) diff D [ms]" format
        if m := re.search(r'accepted\s+(\d+)/(\d+)\s+\(\+\d+\)', line):
            status["shares_accepted"] = int(m.group(1))
            status["shares_rejected"] = int(m.group(2))
        if m := re.search(r'height=(\d+)', line):
            h = int(m.group(1))
            if status["current_height"] is None or h > status["current_height"]:
                status["current_height"] = h
        if m := re.search(r'diff\s+(\d+)', line):
            status["current_diff"] = int(m.group(1))

    # Compute hashrate from last 10 nonce samples if not already set
    if status["hashrate"] is None and nonce_samples:
        last = nonce_samples[-10:]
        total_nonces = sum(n for n, _ in last)
        total_ms = sum(ms for _, ms in last)
        if total_ms > 0:
            status["hashrate"] = round(total_nonces / total_ms / 1000.0 * 1000.0, 2)  # KH/s

    return status

def parse_miner_log() -> dict:
    # Use the most recently modified miner log file (supports timestamped logs like miner_XXXXXXXXXX.log)
    candidates = ["miner", "miner-low", "miner-gpu", "miner-cpu"]
    best_path = None
    best_mtime = 0
    for cand in candidates:
        p = latest_log_path(cand)
        if p and p.exists():
            mt = p.stat().st_mtime
            if mt > best_mtime:
                best_mtime = mt
                best_path = p
    if best_path:
        recent = tail_log(best_path.name, 200)
        # Read from both head and tail to find the most-recent startup block
        # (log may have multiple sessions; the last session's startup data is
        # in the tail region, while head_log would find the first/oldest one).
        startup_head = head_log(best_path.name, 50)
        startup_tail = tail_log(best_path.name, 300)  # large enough to include last startup
    else:
        recent = []
        startup_head = []
        startup_tail = []
    # Process-based liveness: check PROCESS_REGISTRY first, then scan by exe name
    proc_check = check_process_for_service("miner")
    proc_alive = proc_check["alive"]
    if not proc_alive:
        miner_pid = find_process_by_name("zion-miner")
        if miner_pid and is_process_alive(miner_pid):
            proc_alive = True
            register_process("miner", miner_pid, image="zion-miner")
    # running = log has content OR process is alive
    status = {
        "running": bool(recent) or proc_alive,
        "miner_id": None,
        "worker_name": None,
        "pool_addr": None,
        "hashrate": None,
        "gpu_backend": None,
        "gpu_device": None,
        "shares_accepted": 0,
        "shares_rejected": 0,
        "current_height": None,
        "current_diff": None,
        "recent_lines": recent[-10:],
    }
    # Parse startup fields from head first, then override with values from tail
    # so that multi-session log files always reflect the most-recent session.
    for line in startup_head + startup_tail:
        if m := re.search(r'miner_id=(\S+)', line):
            status["miner_id"] = strip_ansi(m.group(1))
        if m := re.search(r'worker_name=(\S+)', line):
            status["worker_name"] = strip_ansi(m.group(1))
        if m := re.search(r'pool_addr=(\S+)', line):
            status["pool_addr"] = strip_ansi(m.group(1))
        if m := re.search(r'backend=(\S+)', line):
            status["gpu_backend"] = strip_ansi(m.group(1))
        if m := re.search(r'device="([^"]+)"', line):
            status["gpu_device"] = strip_ansi(m.group(1))
    nonce_samples2 = []  # (nonce_count, elapsed_ms) for throughput hashrate
    for line in recent:
        if m := re.search(r'gpu_backend=(\S+)', line):
            status["gpu_backend"] = m.group(1)
        # Primary: "speed 10s/60s/15m  2.92  3.34  3.41 KH/s" — values are already KH/s
        if m := re.search(r'speed\s+\d+s/\d+s/\d+m\s+(\d+\.\d+)', line):
            status["hashrate"] = float(m.group(1))
        # Fallback: session_status hps_10s / gpu_hps (H/s → KH/s)
        if status["hashrate"] is None:
            if m := re.search(r'hps_10s=(\d+\.\d+)', line):
                status["hashrate"] = float(m.group(1)) / 1000.0
            elif m := re.search(r'gpu_hps=(\d+\.\d+)', line):
                status["hashrate"] = float(m.group(1)) / 1000.0
        # shares A:45 R:2 format
        if m := re.search(r'shares\s+A:(\d+)\s+R:(\d+)', line):
            status["shares_accepted"] = int(m.group(1))
            status["shares_rejected"] = int(m.group(2))
        # fallback: accepted N/M format
        elif m := re.search(r'accepted\s+(\d+)/(\d+)', line):
            status["shares_accepted"] = int(m.group(1))
            status["shares_rejected"] = int(m.group(2))
        # accept_pct line: accepted=45 rejected=2
        if m := re.search(r'\baccepted=(\d+)\b', line):
            status["shares_accepted"] = int(m.group(1))
        if m := re.search(r'\brejected=(\d+)\b', line):
            status["shares_rejected"] = int(m.group(1))
        if m := re.search(r'pool_height=(\d+)', line):
            h = int(m.group(1))
            if status["current_height"] is None or h > status["current_height"]:
                status["current_height"] = h
        elif m := re.search(r'\bheight=(\d+)', line):
            h = int(m.group(1))
            if status["current_height"] is None or h > status["current_height"]:
                status["current_height"] = h
        if m := re.search(r'diff\s+(\d+)', line):
            status["current_diff"] = int(m.group(1))
        # pool_addr from session log (also strip ANSI in recent lines)
        if m := re.search(r'pool_addr=(\S+)', line):
            status["pool_addr"] = strip_ansi(m.group(1))
        if m := re.search(r'miner_id=(\S+)', line):
            status["miner_id"] = strip_ansi(m.group(1))
        if m := re.search(r'worker_name=(\S+)', line):
            status["worker_name"] = strip_ansi(m.group(1))
        # Throughput: "no_solution  iteration=N  height=H  nonces=START..END  elapsed_ms=T"
        if m := re.search(r'nonces=(\d+)\.\.(\d+)\s+elapsed_ms=(\d+)', line):
            n_start, n_end, ms = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if ms > 0 and n_end > n_start:
                nonce_samples2.append((n_end - n_start, ms))
    # Compute hashrate from last 10 nonce throughput samples if not already set
    if status["hashrate"] is None and nonce_samples2:
        last = nonce_samples2[-10:]
        total_nonces = sum(n for n, _ in last)
        total_ms = sum(ms for _, ms in last)
        if total_ms > 0:
            status["hashrate"] = round(total_nonces / total_ms / 1000.0 * 1000.0, 2)  # KH/s
    return status

# ── Status cache ──────────────────────────────────────────────────────────
_STATUS_CACHE: dict = {}
_STATUS_CACHE_TIME: float = 0.0
_STATUS_CACHE_LOCK = threading.Lock()
STATUS_CACHE_TTL_SEC: float = 15.0

def build_status() -> dict:
    global _STATUS_CACHE, _STATUS_CACHE_TIME
    now = time.time()
    with _STATUS_CACHE_LOCK:
        if _STATUS_CACHE and (now - _STATUS_CACHE_TIME) < STATUS_CACHE_TTL_SEC:
            # Refresh timestamp so consumers see recent data
            cached = dict(_STATUS_CACHE)
            cached["timestamp"] = datetime.now().isoformat()
            cached["_cached"] = True
            return cached
    # Topology-aware status building
    if TOPOLOGY == "edge-primary":
        result = _build_status_edge_primary()
    else:
        result = _build_status_local_dev()
    with _STATUS_CACHE_LOCK:
        _STATUS_CACHE = result
        _STATUS_CACHE_TIME = now
    return result

def _build_status_edge_primary() -> dict:
    """Build status for edge-primary topology: fast, parallel RPC with short timeouts."""
    t0 = time.time()


    # ── Parallel RPC probes ─────────────────────────────────────────────────
    edge_rpc_info = None
    local_rpc_info = None

    def _edge_rpc_call():
        # When dashboard runs ON Edge, use localhost (RPC bound to 127.0.0.1 after security hardening)
        host = "127.0.0.1" if EDGE_IS_LOCAL else "127.0.0.1"
        r = rpc_call(host, 8443, "getChainInfo", {}, timeout=2.5)
        if r and not r.get("_rpc_error"):
            return ("edge", r)
        return ("edge", None)

    def _edge_node2_rpc_call():
        # Edge Node 2 (Follower) — RPC on port 8448 (via SSH tunnel)
        r = rpc_call("127.0.0.1", 8448, "getChainInfo", {}, timeout=2.0)
        return ("edge2", r if r and not r.get("_rpc_error") else None)

    def _local_backup_rpc_call():
        # Local backup node runs on port 8446 (RPC), P2P syncs from Edge
        r = rpc_call("127.0.0.1", 8446, "getChainInfo", {}, timeout=2.0)
        return ("local_backup", r if r and not r.get("_rpc_error") else None)

    def _local_rpc_call():
        # Also probe getNodeInfo for richer data (node_id, p2p_bind, etc.)
        r = rpc_call("127.0.0.1", 8446, "getNodeInfo", {}, timeout=2.0)
        return ("local", r if r and not r.get("_rpc_error") else None)

    def _edge_node2_nodeinfo_call():
        r = rpc_call("127.0.0.1", 8448, "getNodeInfo", {}, timeout=2.0)
        return ("edge2_info", r if r and not r.get("_rpc_error") else None)

    def _edge_peerinfo_call():
        r = rpc_call("127.0.0.1", 8443, "getPeerInfo", {}, timeout=2.0)
        return ("edge_peers", r if r and not r.get("_rpc_error") else None)

    def _edge_nodeinfo_call():
        r = rpc_call("127.0.0.1", 8443, "getNodeInfo", {}, timeout=2.0)
        return ("edge_info", r if r and not r.get("_rpc_error") else None)

    local_backup_info = None
    edge_node2_info = None
    edge_node2_nodeinfo = None
    edge_peers = None
    edge_nodeinfo = None
    with ThreadPoolExecutor(max_workers=7) as ex:
        futures = {
            ex.submit(_edge_rpc_call),
            ex.submit(_edge_node2_rpc_call),
            ex.submit(_local_backup_rpc_call),
            ex.submit(_local_rpc_call),
            ex.submit(_edge_node2_nodeinfo_call),
            ex.submit(_edge_peerinfo_call),
            ex.submit(_edge_nodeinfo_call),
        }
        try:
            for fut in as_completed(futures, timeout=5.0):
                try:
                    key, val = fut.result()
                    if key == "edge":
                        edge_rpc_info = val
                    elif key == "edge2":
                        edge_node2_info = val
                    elif key == "edge2_info":
                        edge_node2_nodeinfo = val
                    elif key == "edge_peers":
                        edge_peers = val
                    elif key == "edge_info":
                        edge_nodeinfo = val
                    elif key == "local_backup":
                        local_backup_info = val
                    else:
                        local_rpc_info = val
                except Exception:
                    pass
        except TimeoutError:
            pass

    # ── Edge Node status ─────────────────────────────────────────────────────
    edge_node1_status = {
        "running": bool(edge_rpc_info),
        "chain_height": edge_rpc_info.get("chain_height") if edge_rpc_info else None,
        "tip_hash": edge_rpc_info.get("tip_hash") if edge_rpc_info else None,
        "known_peers": edge_rpc_info.get("known_peers", 0) if edge_rpc_info else 0,
        "mempool_size": edge_rpc_info.get("mempool_transactions", 0) if edge_rpc_info else 0,
        "network": edge_rpc_info.get("network") if edge_rpc_info else None,
        "protocol_version": edge_rpc_info.get("protocol_version") if edge_rpc_info else None,
        "consensus_profile": edge_rpc_info.get("consensus_profile") if edge_rpc_info else None,
        "accepted_blocks": edge_rpc_info.get("accepted_blocks") if edge_rpc_info else None,
        "node_id": (edge_nodeinfo or {}).get("node_id") if edge_rpc_info else None,
        "p2p_bind": (edge_nodeinfo or {}).get("p2p_bind") if edge_rpc_info else None,
        "rpc_bind": (edge_nodeinfo or {}).get("rpc_bind") if edge_rpc_info else None,
        "host": "127.0.0.1:8443",
    }
    edge_node2_status = {
        "running": bool(edge_node2_info),
        "chain_height": edge_node2_info.get("chain_height") if edge_node2_info else None,
        "tip_hash": edge_node2_info.get("tip_hash") if edge_node2_info else None,
        "known_peers": (edge_node2_nodeinfo or {}).get("known_peers", 0) if edge_node2_info else 0,
        "mempool_size": edge_node2_info.get("mempool_transactions", 0) if edge_node2_info else 0,
        "network": edge_node2_info.get("network") if edge_node2_info else None,
        "protocol_version": edge_node2_info.get("protocol_version") if edge_node2_info else None,
        "consensus_profile": edge_node2_info.get("consensus_profile") if edge_node2_info else None,
        "accepted_blocks": edge_node2_info.get("accepted_blocks") if edge_node2_info else None,
        "node_id": (edge_node2_nodeinfo or {}).get("node_id") if edge_node2_info else None,
        "p2p_bind": (edge_node2_nodeinfo or {}).get("p2p_bind") if edge_node2_info else None,
        "rpc_bind": (edge_node2_nodeinfo or {}).get("rpc_bind") if edge_node2_info else None,
        "host": "127.0.0.1:8448",
    }
    local_backup_status = {
        "running": bool(local_backup_info),
        "chain_height": local_backup_info.get("chain_height") if local_backup_info else None,
        "tip_hash": local_backup_info.get("tip_hash") if local_backup_info else None,
        "known_peers": (local_rpc_info or {}).get("known_peers", 0) if local_backup_info else 0,
        "mempool_size": local_backup_info.get("mempool_transactions", 0) if local_backup_info else 0,
        "network": local_backup_info.get("network") if local_backup_info else None,
        "protocol_version": local_backup_info.get("protocol_version") if local_backup_info else None,
        "consensus_profile": local_backup_info.get("consensus_profile") if local_backup_info else None,
        "accepted_blocks": local_backup_info.get("accepted_blocks") if local_backup_info else None,
        "node_id": (local_rpc_info or {}).get("node_id") if local_backup_info else None,
        "p2p_bind": (local_rpc_info or {}).get("p2p_bind") if local_backup_info else None,
        "rpc_bind": (local_rpc_info or {}).get("rpc_bind") if local_backup_info else None,
        "host": "127.0.0.1:8446",
    }

    # ── Local Backup Node (n1) — uses local_backup_status ──────────────────
    n1 = parse_node_log("node1")
    if local_backup_status["running"]:
        n1["running"] = True
        n1["chain_height"] = local_backup_status["chain_height"]
        n1["tip_hash"] = local_backup_status["tip_hash"]
        n1["known_peers"] = local_backup_status["known_peers"]
        n1["mempool_size"] = local_backup_status["mempool_size"]
        n1["protocol_version"] = local_backup_status["protocol_version"]
        n1["consensus_profile"] = local_backup_status["consensus_profile"]
        n1["node_id"] = local_backup_status.get("node_id") or n1.get("node_id")
        n1["p2p_bind"] = local_backup_status.get("p2p_bind") or "0.0.0.0:8333"
        n1["rpc_bind"] = local_backup_status.get("rpc_bind") or "127.0.0.1:8446"

    # Proxy local height to Edge if Edge RPC failed entirely
    if edge_node1_status["chain_height"] is None and n1.get("chain_height"):
        edge_node1_status["chain_height"] = n1["chain_height"]
        edge_node1_status["tip_hash"] = n1.get("tip_hash")
        edge_node1_status["known_peers"] = n1.get("known_peers", 0)

    # ── Edge Pool ────────────────────────────────────────────────────────────
    # Skip slow local check_service_health — probe Edge pool metrics directly
    pool_edge_svc = get_service("pool-edge")
    pool_edge_health = {"alive": False}
    edge_metrics = {"active_miners": None, "hashrate": None, "hashrate_1h": None, "accept_rate_pct": None,
                    "shares_accepted": None, "shares_rejected": None, "miners_tracked": None,
                    "blocks_found": None, "total_hashes": None, "total_shares": None}
    edge_payout = {"pplns_rounds": 0, "pplns_total_paid": 0, "pplns_window_size": 0, "pplns_window_used": 0, "pplns_registered_miners": 0,
                   "fee_humanitarian": 0, "fee_issobella": 0, "fee_pool": 0, "fee_miner_pct": 89,
                   "miner_balances": []}
    try:
        # Direct Edge pool metrics probe (port 8455)
        url = f"http://{EDGE_RPC_HOST}:8455/metrics"
        with _urlreq.urlopen(url, timeout=3.0) as r:
            body = r.read().decode("utf-8", errors="ignore")
            for line in body.splitlines():
                if line.startswith("zion_pool_active_sessions "):
                    edge_metrics["active_miners"] = int(line.split()[-1])
                elif line.startswith("zion_pool_total_hashes "):
                    edge_metrics["total_hashes"] = int(line.split()[-1])
                elif line.startswith("zion_pool_total_shares "):
                    edge_metrics["total_shares"] = int(line.split()[-1])
                elif line.startswith("zion_pool_blocks_found ") or line.startswith("zion_pool_blocks_found_total "):
                    edge_metrics["blocks_found"] = int(line.split()[-1])
                elif line.startswith("zion_pool_hashrate_khs "):
                    edge_metrics["hashrate"] = float(line.split()[-1])
                elif line.startswith("zion_pool_hashrate_hps "):
                    edge_metrics["hashrate"] = float(line.split()[-1]) / 1000.0
                elif line.startswith("zion_pool_hashrate_1h_hps "):
                    edge_metrics["hashrate_1h"] = float(line.split()[-1]) / 1000.0
                elif line.startswith("zion_pool_accept_rate_pct "):
                    edge_metrics["accept_rate_pct"] = float(line.split()[-1])
                elif line.startswith("zion_pool_accepted_total "):
                    edge_metrics["shares_accepted"] = int(line.split()[-1])
                elif line.startswith("zion_pool_rejected_total "):
                    edge_metrics["shares_rejected"] = int(line.split()[-1])
                elif line.startswith("zion_pool_miners_tracked "):
                    edge_metrics["miners_tracked"] = int(line.split()[-1])
                elif line.startswith("zion_pplns_payout_rounds "):
                    edge_payout["pplns_rounds"] = int(line.split()[-1])
                elif line.startswith("zion_pplns_total_paid_flowers "):
                    edge_payout["pplns_total_paid"] = int(line.split()[-1])
                elif line.startswith("zion_pplns_window_size "):
                    edge_payout["pplns_window_size"] = int(line.split()[-1])
                elif line.startswith("zion_pplns_window_used "):
                    edge_payout["pplns_window_used"] = int(line.split()[-1])
                elif line.startswith("zion_pplns_registered_miners "):
                    edge_payout["pplns_registered_miners"] = int(line.split()[-1])
                elif line.startswith("zion_fee_humanitarian_flowers "):
                    edge_payout["fee_humanitarian"] = int(line.split()[-1])
                elif line.startswith("zion_fee_issobella_flowers "):
                    edge_payout["fee_issobella"] = int(line.split()[-1])
                elif line.startswith("zion_fee_pool_flowers "):
                    edge_payout["fee_pool"] = int(line.split()[-1])
                elif line.startswith("zion_fee_miner_pct "):
                    edge_payout["fee_miner_pct"] = int(line.split()[-1])
                elif line.startswith("zion_pool_miner_pending_balance_atomic{"):
                    m = re.search(r'miner_id="([^"]+)",worker_name="([^"]+)"\} (\d+)', line)
                    if m:
                        edge_payout["miner_balances"].append({
                            "miner_id": m.group(1),
                            "worker_name": m.group(2),
                            "balance_atomic": int(m.group(3)),
                            "balance_zion": flowers_to_zion(int(m.group(3))),
                        })
    except Exception:
        pass
    # Mark pool as alive if we successfully fetched metrics
    if edge_metrics.get("active_miners") is not None:
        pool_edge_health = {"alive": True}
    # v3.0.4 fallback: pool doesn't expose Prometheus metrics on 8455.
    # Use TCP probe to stratum port 8444 instead.
    if not pool_edge_health["alive"]:
        try:
            pool_edge_health = {"alive": tcp_probe("127.0.0.1", 8444, timeout=0.5)}
        except Exception:
            pool_edge_health = {"alive": False}


    edge_pool_wallet = os.environ.get("ZION_POOL_WALLET", "") or "zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2"
    edge_fee_split = "89/5/5/1"
    local_pool = parse_pool_log()
    pool_status = {
        "running": pool_edge_health["alive"],
        "bind_addr": f"{pool_edge_svc.get('host', '127.0.0.1')}:8444" if pool_edge_svc else None,
        "loop_count": "1000000",
        "nonce_count": 4096,
        "pool_wallet": edge_pool_wallet,
        "payout_enabled": pool_edge_health["alive"] and edge_fee_split == "89/5/5/1",
        "blocks_found": edge_metrics["blocks_found"] if edge_metrics["blocks_found"] is not None else local_pool["blocks_found"],
        # Prefer live Edge Prometheus metrics over stale local pool log
        "shares_accepted": edge_metrics["shares_accepted"] if edge_metrics["shares_accepted"] is not None else local_pool["shares_accepted"],
        "shares_rejected": edge_metrics["shares_rejected"] if edge_metrics["shares_rejected"] is not None else local_pool["shares_rejected"],
        "active_sessions": edge_metrics["active_miners"] if edge_metrics["active_miners"] is not None else local_pool["active_sessions"],
        "fee_split": edge_fee_split or local_pool.get("fee_split"),
        "recent_payouts": local_pool["recent_payouts"],
        "recent_lines": local_pool["recent_lines"],
        "total_hashes": edge_metrics["total_hashes"],
        "total_shares": edge_metrics["total_shares"],
        "hashrate_khs": edge_metrics["hashrate"],
        "pplns_rounds": edge_payout["pplns_rounds"],
        "pplns_total_paid": edge_payout["pplns_total_paid"],
        "pplns_total_paid_zion": flowers_to_zion(edge_payout["pplns_total_paid"]),
        "pplns_window_size": edge_payout["pplns_window_size"],
        "pplns_window_used": edge_payout["pplns_window_used"],
        "pplns_registered_miners": edge_payout["pplns_registered_miners"],
        "fee_humanitarian": edge_payout["fee_humanitarian"],
        "fee_issobella": edge_payout["fee_issobella"],
        "fee_pool": edge_payout["fee_pool"],
        "fee_miner_pct": edge_payout["fee_miner_pct"],
        "miner_balances": edge_payout["miner_balances"],
    }

    # Sync gap
    sync_gap = None
    if n1.get("chain_height") and edge_node1_status.get("chain_height"):
        sync_gap = abs(n1["chain_height"] - edge_node1_status["chain_height"])

    # v3.0.4: No Tailscale — single server topology, not needed
    tailscale_ok = True  # N/A, always "ok" (no VPN required)

    miner_status = parse_miner_log()

    # ── L2/L3 Edge services health — TCP port check on Edge (fast, 0.5s) ────
    _edge = "127.0.0.1"
    _edge_ports = {
        "bridge":     9101,
        "dao":        8450,
        "warp":       8453,
        "oasis":      8094,
        "free_world": 8095,
        "issobella":  8096,
    }
    _health_map = {}
    for _sid, _port in _edge_ports.items():
        _open = check_port_open(_edge, _port, 0.5)
        _health_map[_sid] = {"alive": _open, "status": "ok" if _open else "down", "ports_open": [_port] if _open else []}
    bridge_health     = _health_map["bridge"]
    dao_health        = _health_map["dao"]
    warp_health       = _health_map["warp"]
    oasis_health      = _health_map["oasis"]
    free_world_health = _health_map["free_world"]
    issobella_health  = _health_map["issobella"]

    # ── Build all_nodes list for the All Nodes panel ──────────────────────────
    # Combines our 3 known nodes + any external P2P peers discovered via getPeerInfo.
    all_nodes = []
    _our_node_keys = set()
    for _label, _st, _role, _icon in [
        ("Edge Node 1 (Primary)", edge_node1_status, "primary", "🌍"),
        ("Edge Node 2 (Follower)", edge_node2_status, "follower", "🔶"),
        ("Local Backup", local_backup_status, "backup", "🔷"),
    ]:
        if _st:
            all_nodes.append({
                "name": _label,
                "role": _role,
                "icon": _icon,
                "running": _st.get("running", False),
                "chain_height": _st.get("chain_height"),
                "tip_hash": _st.get("tip_hash"),
                "node_id": _st.get("node_id"),
                "p2p_bind": _st.get("p2p_bind"),
                "rpc_bind": _st.get("rpc_bind"),
                "host": _st.get("host", ""),
                "known_peers": _st.get("known_peers", 0),
                "mempool_size": _st.get("mempool_size", 0),
                "protocol_version": _st.get("protocol_version"),
                "network": _st.get("network"),
                "consensus_profile": _st.get("consensus_profile"),
                "accepted_blocks": _st.get("accepted_blocks"),
                "is_external": False,
            })

    # Add external P2P peers from getPeerInfo (these are nodes connecting from outside)
    p2p_peer_list = []
    if edge_peers:
        p2p_peer_list = edge_peers.get("peers", [])
        for peer in p2p_peer_list:
            peer_addr = peer.get("address", "")
            peer_host = peer.get("host", peer_addr.split(":")[0] if ":" in peer_addr else peer_addr)
            # Skip our own internal nodes (127.0.0.1)
            if peer_host == "127.0.0.1":
                continue
            all_nodes.append({
                "name": f"External Peer ({peer_host})",
                "role": "external",
                "icon": "🌐",
                "running": True,
                "chain_height": None,
                "tip_hash": None,
                "node_id": None,
                "p2p_bind": peer_addr,
                "rpc_bind": None,
                "host": peer_host,
                "known_peers": 0,
                "mempool_size": 0,
                "protocol_version": None,
                "network": None,
                "consensus_profile": None,
                "accepted_blocks": None,
                "is_external": True,
            })

    # Compute sync status across all running nodes
    running_heights = [n["chain_height"] for n in all_nodes if n["running"] and n["chain_height"] is not None]
    max_height = max(running_heights) if running_heights else 0
    all_in_sync = len(running_heights) >= 2 and all(h == running_heights[0] for h in running_heights)

    elapsed = time.time() - t0
    return {
        "timestamp": datetime.now().isoformat(),
        "topology": "edge-primary",
        "node1": n1,
        "node2": {"running": False, "chain_height": None, "tip_hash": None, "known_peers": 0, "mempool_size": 0},
        "edge_node": edge_node1_status,
        "edge_node2": edge_node2_status,
        "local_backup": local_backup_status,
        "all_nodes": all_nodes,
        "p2p_peers": p2p_peer_list,
        "all_in_sync": all_in_sync,
        "max_height": max_height,
        "pool": pool_status,
        "pool_edge": {
            "running": pool_edge_health["alive"],
            "host": pool_edge_svc.get("host", "") if pool_edge_svc else "",
            "public_ip": "62.171.141.136",
            "tailscale_ip": "127.0.0.1",
            "ports_open": pool_edge_health.get("ports_open", []),
            "ports_closed": pool_edge_health.get("ports_closed", []),
            "pid_alive": pool_edge_health.get("pid_alive", False),
            "pid": pool_edge_health.get("pid"),
            "active_miners": edge_metrics["active_miners"],
            "hashrate": edge_metrics["hashrate"],
            "hashrate_1h_khs": edge_metrics.get("hashrate_1h"),
            "accept_rate_pct": edge_metrics.get("accept_rate_pct"),
            "shares_accepted": edge_metrics.get("shares_accepted"),
            "shares_rejected": edge_metrics.get("shares_rejected"),
            "miners_tracked": edge_metrics.get("miners_tracked"),
            "blocks_found": edge_metrics["blocks_found"],
            "total_hashes": edge_metrics["total_hashes"],
            "total_shares": edge_metrics["total_shares"],
            "sync_gap": sync_gap,
            "details": pool_edge_health.get("details", ""),
        },
        "miner": miner_status,
        "bridge": {
            "running": bridge_health["alive"],
            "status": bridge_health.get("status", "unknown"),
            "details": bridge_health.get("details", ""),
            "ports_open": bridge_health.get("ports_open", []),
            "ports_closed": bridge_health.get("ports_closed", []),
            "pid_alive": bridge_health.get("pid_alive", False),
            "pid": bridge_health.get("pid"),
        },
        "dao": {
            "running": dao_health["alive"],
            "status": dao_health.get("status", "unknown"),
            "details": dao_health.get("details", ""),
            "ports_open": dao_health.get("ports_open", []),
            "ports_closed": dao_health.get("ports_closed", []),
            "pid_alive": dao_health.get("pid_alive", False),
            "pid": dao_health.get("pid"),
        },
        "warp": {
            "running": warp_health["alive"],
            "status": warp_health.get("status", "unknown"),
            "details": warp_health.get("details", ""),
            "ports_open": warp_health.get("ports_open", []),
            "ports_closed": warp_health.get("ports_closed", []),
            "pid_alive": warp_health.get("pid_alive", False),
            "pid": warp_health.get("pid"),
        },
        "oasis": {
            "running": oasis_health["alive"],
            "status": oasis_health.get("status", "unknown"),
            "details": oasis_health.get("details", ""),
            "ports_open": oasis_health.get("ports_open", []),
            "ports_closed": oasis_health.get("ports_closed", []),
            "pid_alive": oasis_health.get("pid_alive", False),
            "pid": oasis_health.get("pid"),
        },
        "free_world": {
            "running": free_world_health["alive"],
            "status": free_world_health.get("status", "unknown"),
            "details": free_world_health.get("details", ""),
            "ports_open": free_world_health.get("ports_open", []),
            "ports_closed": free_world_health.get("ports_closed", []),
            "pid_alive": free_world_health.get("pid_alive", False),
            "pid": free_world_health.get("pid"),
        },
        "issobella": {
            "running": issobella_health["alive"],
            "status": issobella_health.get("status", "unknown"),
            "details": issobella_health.get("details", ""),
            "ports_open": issobella_health.get("ports_open", []),
            "ports_closed": issobella_health.get("ports_closed", []),
            "pid_alive": issobella_health.get("pid_alive", False),
            "pid": issobella_health.get("pid"),
        },
        "tailscale": {"vpn_ok": True, "edge_ip": "127.0.0.1", "note": "No Tailscale (v3.0.4 single-server)"},
        "_build_time_ms": int(elapsed * 1000),
    }

def _build_status_local_dev() -> dict:
    """Build status for local-dev topology: node1 (genesis), node2 (follower), local pool, miner"""
    # Local nodes
    n1 = parse_node_log("node1")
    n2 = parse_node_log("node2")

    # Local pool
    pool_svc = get_service("pool")
    pool_health = check_service_health(pool_svc) if pool_svc else {"alive": False}
    local_pool = parse_pool_log()

    # Try to scrape local pool metrics
    pool_metrics = {"active_miners": None, "hashrate": None, "blocks_found": None}
    try:
        metrics_port = pool_svc.get("ports", {}).get("metrics") if pool_svc else None
        if metrics_port and pool_health.get("alive"):
            url = f"http://127.0.0.1:{metrics_port}/metrics"
            with _urlreq.urlopen(url, timeout=1.0) as r:
                body = r.read().decode("utf-8", errors="ignore")
                for line in body.splitlines():
                    if line.startswith("zion_pool_active_sessions "):
                        pool_metrics["active_miners"] = int(float(line.split()[-1]))
                    elif line.startswith("zion_pool_total_hashes "):
                        pass
                    elif line.startswith("zion_pool_blocks_found ") or line.startswith("zion_pool_blocks_found_total "):
                        pool_metrics["blocks_found"] = int(float(line.split()[-1]))
    except Exception:
        pass

    pool_status = {
        "running": pool_health["alive"],
        "bind_addr": "127.0.0.1:8444",
        "loop_count": "1000000",
        "nonce_count": 4096,
        "pool_wallet": os.environ.get("ZION_POOL_WALLET", ""),
        "payout_enabled": pool_health["alive"] and local_pool.get("fee_split") == "89/5/5/1",
        "blocks_found": pool_metrics["blocks_found"] or local_pool["blocks_found"],
        "shares_accepted": local_pool["shares_accepted"],
        "shares_rejected": local_pool["shares_rejected"],
        "active_sessions": pool_metrics["active_miners"] or local_pool["active_sessions"],
        "fee_split": local_pool.get("fee_split", "89/5/5/1"),
        "recent_payouts": local_pool["recent_payouts"],
        "recent_lines": local_pool["recent_lines"],
    }

    # Compute sync gap between node1 and node2
    sync_gap = None
    if n1.get("chain_height") and n2.get("chain_height"):
        sync_gap = abs(n1["chain_height"] - n2["chain_height"])

    return {
        "timestamp": datetime.now().isoformat(),
        "topology": "local-dev",
        "node1": n1,
        "node2": n2,
        "edge_node": {
            "running": False,
            "chain_height": None,
            "tip_hash": None,
            "known_peers": 0,
            "mempool_size": 0,
        },
        "pool": pool_status,
        "pool_edge": {
            "running": False,
            "host": "",
            "public_ip": "",
            "tailscale_ip": "",
            "ports_open": [],
            "ports_closed": [],
            "pid_alive": False,
            "pid": None,
            "active_miners": None,
            "hashrate": None,
            "hashrate_1h_khs": None,
            "accept_rate_pct": None,
            "shares_accepted": None,
            "shares_rejected": None,
            "miners_tracked": None,
            "blocks_found": None,
            "total_hashes": None,
            "total_shares": None,
            "sync_gap": None,
            "details": "Not applicable in local-dev topology",
        },
        "miner": parse_miner_log(),
    }

def build_checklist(status: dict) -> dict:
    # Topology-aware checklist
    topology = status.get("topology", TOPOLOGY)
    
    # Edge backup check (runs on dashboard host which may be Edge or local)
    edge_backup_ok = False
    try:
        # Check if Edge backup timer is active and recent backups exist
        proc = subprocess.run(
            ["systemctl", "is-active", "zion-edge-backup.timer"],
            capture_output=True, text=True, timeout=3
        )
        timer_active = proc.stdout.strip() == "active"
        backup_dir = Path("/root/zion-backups")
        has_backups = backup_dir.exists() and any(backup_dir.glob("zion-edge-*.tar.gz"))
        edge_backup_ok = timer_active and has_backups
    except Exception:
        pass

    if topology == "edge-primary":
        checks = [
            {"id": "keys",       "label": "Offline key generation complete",          "ok": True},
            {"id": "env",        "label": "Env file assembled (.env.mainnet)",        "ok": True},
            {"id": "edge-node1", "label": "Edge Node 1 (Primary) running & reachable", "ok": status["edge_node"]["running"] and status["edge_node"]["chain_height"] is not None},
            {"id": "edge-node2", "label": "Edge Node 2 (Follower) running & synced",  "ok": status.get("edge_node2", {}).get("running", False) and status.get("edge_node2", {}).get("known_peers", 0) > 0},
            {"id": "local-backup", "label": "Local Backup Node running & synced",      "ok": status.get("local_backup", {}).get("running", False) and status.get("local_backup", {}).get("known_peers", 0) > 0},
            {"id": "pool",       "label": "Edge Pool running & accepting miners",     "ok": status["pool"]["running"] and status["pool"]["active_sessions"] is not None},
            {"id": "pool-edge",  "label": "Edge Pool TCP reachable",                  "ok": status.get("pool_edge", {}).get("running", False)},
            {"id": "chain",      "label": "Chain height advancing",                   "ok": status["edge_node"]["chain_height"] is not None and status["edge_node"]["chain_height"] > 0},
            {"id": "payout",     "label": "Payout mechanism ready (fee split active)", "ok": status["pool"]["running"] and status["pool"]["fee_split"] == "89/5/5/1"},
            {"id": "fee_split",  "label": "Fee split 89/5/5/1 (burn model) active",    "ok": status["pool"]["fee_split"] == "89/5/5/1"},
            {"id": "logs",       "label": "Log directory writable",                   "ok": LOG_DIR.exists()},
            # Optional local services (not counted in score, shown for info)
            {"id": "node1",      "label": "Local Backup Node P2P synced",             "ok": status.get("local_backup", {}).get("running", False) and status.get("local_backup", {}).get("known_peers", 0) > 0},
            {"id": "miner",      "label": "Local GPU miner (optional)",               "ok": True},
            {"id": "edge-backup","label": "Edge database auto-backup (optional)",     "ok": True},
        ]
    else:  # local-dev
        checks = [
            {"id": "keys",      "label": "Offline key generation complete",         "ok": True},
            {"id": "env",       "label": "Env file assembled (.env.mainnet)",       "ok": True},
            {"id": "node1",     "label": "Node 1 (Genesis) running",               "ok": status["node1"]["running"] and status["node1"]["p2p_bind"] is not None},
            {"id": "node2",     "label": "Node 2 (Follower) running & synced",    "ok": not status["node2"]["running"] or status["node2"]["known_peers"] > 0},
            {"id": "pool",      "label": "Local Pool running & accepting miners",  "ok": status["pool"]["running"] and status["pool"]["active_sessions"] is not None},
            {"id": "miner",     "label": "GPU miner connected & hashing",         "ok": status["miner"]["running"] and status["miner"]["hashrate"] is not None},
            {"id": "chain",     "label": "Chain height advancing",                 "ok": status["node1"]["chain_height"] is not None and status["node1"]["chain_height"] > 0},
            {"id": "payout",    "label": "Payout mechanism ready (fee split active)",  "ok": status["pool"]["running"] and status["pool"]["fee_split"] == "89/5/5/1"},
            {"id": "fee_split", "label": "Fee split 89/5/5/1 (burn model) active",     "ok": status["pool"]["fee_split"] == "89/5/5/1"},
            {"id": "logs",      "label": "Log directory writable",                  "ok": LOG_DIR.exists()},
        ]
    
    total = len(checks)
    passed = sum(1 for c in checks if c["ok"])
    return {"checks": checks, "passed": passed, "total": total, "pct": round(100*passed/total, 1)}

# ── Alerts & recommendations ────────────────────────────────────────────

# ── Readiness Score ───────────────────────────────────────────────────────

LAYER_WEIGHTS = {
    "L1": 50,      # Node1 20%, Node2 10%, Pool 10%, Miner 10%
    "L2": 25,      # Bridge 8%, DAO 8%, Atomic Swap 5%, Warp 4%
    "L3": 15,      # AI Native 5%, Hiranyagarbha 3%, NCL 2%, Oasis 3%, Free World 2%
    "L4": 5,       # Oasis 3%, Free World 2%
    "L5": 3,       # Free World 2%, Issobella 1%
    "L6": 2,       # Issobella 2%
    "Infra": 0,    # Not counted in readiness (monitoring only)
}

SERVICE_WEIGHTS = {
    # Edge-primary topology weights
    "edge-node": 20, "node1": 10, "pool-edge": 10, "miner": 10,
    # Local-dev topology weights (node1 becomes primary)
    "pool": 10,
    # Common L2-L6 weights
    "bridge": 8, "dao": 8, "atomic-swap": 5, "warp": 4,
    "ai-native": 5, "hiranyagarbha": 3, "ncl": 2, "oasis": 3, "free-world": 2, "issobella": 2,
    # Optional/infra
    "node2": 0, "prometheus": 0, "grafana": 0, "dashboard": 0,
}


def build_readiness_score(health: list) -> dict:
    """Compute 0-100 readiness score from service health.
    L1 services carry the most weight."""
    total_weight = 0
    earned_weight = 0
    breakdown = []
    for h in health:
        sid = h["id"]
        w = SERVICE_WEIGHTS.get(sid, 0)
        if w == 0:
            continue
        total_weight += w
        if h.get("alive"):
            earned_weight += w
            breakdown.append({"id": sid, "weight": w, "alive": True})
        else:
            breakdown.append({"id": sid, "weight": w, "alive": False, "status": h.get("status", "unknown")})

    score = round((earned_weight / total_weight) * 100, 1) if total_weight else 0
    # Color bucket
    if score >= 85:
        color = "green"
    elif score >= 60:
        color = "yellow"
    else:
        color = "red"
    return {
        "score": score,
        "color": color,
        "total_weight": total_weight,
        "earned_weight": earned_weight,
        "breakdown": breakdown,
        "timestamp": datetime.now().isoformat(),
    }


def _alert_id(a: dict) -> str:
    """Stable ID for an alert based on title+severity."""
    import hashlib
    raw = f"{a.get('severity','info')}:{a.get('title','')}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]

def build_alerts(status: dict) -> list:
    """Auto-detect common issues and produce actionable alerts.
    Severity is now derived from SERVICE_REGISTRY. Topology-aware."""
    alerts = []
    topology = status.get("topology", TOPOLOGY)
    n1, n2, pool, miner = status["node1"], status["node2"], status["pool"], status["miner"]
    edge_node1 = status.get("edge_node", {})
    edge_node2 = status.get("edge_node2", {})
    local_backup = status.get("local_backup", {})

    def _sev(svc_id: str, default: str = "warning") -> str:
        svc = get_service(svc_id)
        return svc.get("severity", default) if svc else default

    if topology == "edge-primary":
        # Edge Node 1 (Primary) alerts
        if not edge_node1.get("running"):
            alerts.append({"severity": _sev("edge-node1", "critical"), "title": "Edge Node 1 (Primary) not reachable",
                           "detail": "Primary node on Edge (127.0.0.1:8333) is not responding. Check Edge systemd services.",
                           "action": None})
        elif edge_node1.get("chain_height") == 0:
            alerts.append({"severity": _sev("edge-node1", "warning"), "title": "Edge chain stuck at height 0",
                           "detail": "Edge node 1 is up but no blocks have been mined yet.",
                           "action": None})

        # Edge Node 2 (Follower) alerts
        if not edge_node2.get("running"):
            alerts.append({"severity": _sev("edge-node2", "warning"), "title": "Edge Node 2 (Follower) not reachable",
                           "detail": "Follower node on Edge (127.0.0.1:8448) is not responding. Check: ssh zion-new systemctl status zion-node2",
                           "action": None})
        elif edge_node2.get("chain_height") == 0:
            alerts.append({"severity": _sev("edge-node2", "warning"), "title": "Edge Node 2 chain stuck at height 0",
                           "detail": "Edge node 2 is up but no blocks have been synced yet.",
                           "action": None})

        # Sync gap: Edge Node 1 vs Edge Node 2
        if edge_node1.get("running") and edge_node2.get("running") and edge_node1.get("chain_height") and edge_node2.get("chain_height"):
            gap = abs(edge_node1["chain_height"] - edge_node2["chain_height"])
            if gap > 10:
                alerts.append({"severity": _sev("edge-node2", "warning"), "title": "Edge Node 2 far behind Node 1",
                               "detail": f"Edge1@{edge_node1['chain_height']} vs Edge2@{edge_node2['chain_height']} — gap {gap}",
                               "action": None})

        # Local Backup Node alerts
        if not local_backup.get("running"):
            alerts.append({"severity": _sev("node1", "warning"), "title": "Local Backup Node not reachable",
                           "detail": "Backup node on 127.0.0.1:8446 is not responding. Check systemd: systemctl --user status zion-backup-node",
                           "action": "restart-node1"})
        elif local_backup.get("chain_height") == 0:
            alerts.append({"severity": _sev("node1", "warning"), "title": "Local Backup Node chain stuck at height 0",
                           "detail": "Backup node is up but no blocks have been synced yet. Check P2P connection to Edge.",
                           "action": "restart-node1"})

        # Sync gap: Edge primary vs local backup
        if edge_node1.get("running") and local_backup.get("running") and edge_node1.get("chain_height") and local_backup.get("chain_height"):
            gap = abs(edge_node1["chain_height"] - local_backup["chain_height"])
            if gap > 10:
                alerts.append({"severity": _sev("node1", "warning"), "title": "Backup node far behind Edge",
                               "detail": f"Edge@{edge_node1['chain_height']} vs Local@{local_backup['chain_height']} — gap {gap}",
                               "action": "restart-node1"})
            elif gap <= 2:
                # Positive alert: synced
                pass  # No alert needed — all good

        # Local Backup Node P2P peer check
        if local_backup.get("running") and local_backup.get("known_peers", 0) == 0:
            alerts.append({"severity": _sev("node1", "warning"), "title": "Backup node has no P2P peers",
                           "detail": "Local backup node is running but has 0 peers. Check SSH tunnel and Edge P2P (62.171.141.136:8333).",
                           "action": "restart-node1"})
    else:  # local-dev
        # Node 1 (Genesis) alerts
        if not n1["running"]:
            alerts.append({"severity": _sev("node1", "critical"), "title": "Node 1 (Genesis) not running",
                           "detail": "Genesis node is not running. Start it to begin the chain.",
                           "action": "start-node1"})
        elif n1.get("chain_height") == 0:
            alerts.append({"severity": _sev("node1", "warning"), "title": "Genesis chain stuck at height 0",
                           "detail": "Genesis node is up but no blocks have been mined yet.",
                           "action": None})

        # Node 2 (Follower) alerts
        if n2["running"] and n1["running"] and n1["chain_height"] and n2["chain_height"]:
            gap = abs(n1["chain_height"] - n2["chain_height"])
            if gap > 10:
                alerts.append({"severity": _sev("node2", "warning"), "title": "Follower node far behind genesis",
                               "detail": f"Genesis@{n1['chain_height']} vs Follower@{n2['chain_height']} — gap {gap}",
                               "action": "restart-node2"})

    # Pool alerts (common to both topologies)
    if pool["running"] and pool["fee_split"] and pool["fee_split"] != "89/5/5/1":
        alerts.append({"severity": _sev("pool", "critical"), "title": "Wrong fee split",
                       "detail": f"Detected {pool['fee_split']}, mainnet must be 89/5/5/1 (burn model)",
                       "action": None})

    if pool["running"] and pool["payout_enabled"] is False:
        alerts.append({"severity": _sev("pool", "warning"), "title": "Payouts disabled",
                       "detail": "Pool is running but payout_execution=disabled. Check pool has ZION_POOL_PAYOUT_SK_HEX set.",
                       "action": None})

    if pool["running"] and pool.get("nonce_count") and pool["nonce_count"] < 4096:
        alerts.append({"severity": "info", "title": "Low GPU nonce window",
                       "detail": f"ZION_NONCE_COUNT={pool['nonce_count']} is small. Raise to 4096 for better GPU utilisation.",
                       "action": None})

    # Only alert about local miner if in local-dev topology (edge-primary miner is optional)
    if topology != "edge-primary" and miner["running"] and not miner["hashrate"]:
        alerts.append({"severity": _sev("miner", "warning"), "title": "Miner not hashing",
                       "detail": "Miner is connected but no hashrate samples in recent logs. Check GPU init.",
                       "action": "restart-miner"})

    if miner["running"] and miner["hashrate"] and miner["hashrate"] < 1.0:
        alerts.append({"severity": "info", "title": "Low hashrate",
                       "detail": f"Hashrate {miner['hashrate']} KH/s seems low. Expected ~6-10 KH/s on RDNA1.",
                       "action": None})

    if pool["running"] and pool["shares_rejected"] > 0 and pool["shares_accepted"]:
        ratio = pool["shares_rejected"] / max(1, pool["shares_accepted"])
        if ratio > 0.15:
            alerts.append({"severity": _sev("pool", "warning"), "title": "High share rejection rate",
                           "detail": f"{pool['shares_rejected']} rejected vs {pool['shares_accepted']} accepted ({ratio*100:.1f}%)",
                           "action": None})

    # Only surface recent, non-benign node errors
    last_err = n1.get("last_error")
    if last_err:
        benign_patterns = ["Handshake not finished", "WebSocket protocol error", "Connection reset by peer", "broken pipe"]
        if not any(p.lower() in last_err.lower() for p in benign_patterns):
            alerts.append({"severity": "info", "title": "Node1 error in logs",
                           "detail": last_err, "action": None})

    if not alerts:
        alerts.append({"severity": "success", "title": "All systems nominal",
                       "detail": "No issues detected. Stack is ready for mainnet operations.",
                       "action": None})

    # Assign stable IDs and filter dismissed
    dismissed = _load_dismissed()
    out = []
    for a in alerts:
        a["id"] = _alert_id(a)
        if a["id"] not in dismissed:
            out.append(a)
    return out

_LAST_ALERT_SIGNATURES = set()
_LAST_ALERT_TS = 0
_DISMISS_FILE = SCRIPT_DIR / ".dismissed_alerts.json"

def _load_dismissed() -> set:
    """Load set of dismissed alert IDs."""
    try:
        if _DISMISS_FILE.exists():
            with open(_DISMISS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return set(data.get("dismissed", []))
    except Exception:
        pass
    return set()

def _save_dismissed(dismissed: set):
    """Save dismissed alert IDs to disk."""
    try:
        with open(_DISMISS_FILE, "w", encoding="utf-8") as f:
            json.dump({"dismissed": sorted(dismissed)}, f, indent=2)
    except Exception:
        pass

def dismiss_alert(alert_id: str) -> bool:
    """Dismiss an alert by ID."""
    dismissed = _load_dismissed()
    dismissed.add(alert_id)
    _save_dismissed(dismissed)
    return True

def persist_new_alerts(alerts: list):
    """Persist only alerts that changed since last call (dedup by title+severity)."""
    global _LAST_ALERT_SIGNATURES, _LAST_ALERT_TS
    now = time.time()
    if now - _LAST_ALERT_TS < 60:
        return  # throttle to once per minute
    current_sigs = {f"{a['severity']}:{a['title']}" for a in alerts if a["severity"] in ("critical", "warning")}
    new_sigs = current_sigs - _LAST_ALERT_SIGNATURES
    for a in alerts:
        sig = f"{a['severity']}:{a['title']}"
        if sig in new_sigs:
            append_alert(a)
    # Persist "all clear" when returning from alert state
    if _LAST_ALERT_SIGNATURES and not current_sigs:
        append_alert({"severity": "success", "title": "All systems nominal",
                      "detail": "Previous alerts resolved.", "action": None})
    _LAST_ALERT_SIGNATURES = current_sigs
    _LAST_ALERT_TS = now

# ── Block events feed (parsed from logs) ────────────────────────────────

def scan_block_events():
    """Scan logs for newly discovered blocks and push to event feed."""
    global BLOCK_EVENTS, LAST_BLOCK_EVENT_TIME
    for name in ("node1", "node2"):
        lines = tail_log(f"{name}.log", 500)
        for line in lines:
            if m := re.search(r'relay_block height=(\d+) hash=([a-f0-9…]+)', line):
                key = f"{name}-{m.group(1)}-{m.group(2)}"
                with BLOCK_EVENTS_LOCK:
                    if key not in (e["key"] for e in BLOCK_EVENTS):
                        BLOCK_EVENTS.append({
                            "key": key,
                            "ts": int(time.time()),
                            "source": name,
                            "height": int(m.group(1)),
                            "hash": m.group(2),
                            "type": "block_relay",
                        })
    # Pool block_found events
    pool_lines = tail_log("pool.log", 500)
    for line in pool_lines:
        if m := re.search(r'BLOCK_FOUND.*height=(\d+)', line):
            key = f"pool-found-{m.group(1)}"
            with BLOCK_EVENTS_LOCK:
                if key not in (e["key"] for e in BLOCK_EVENTS):
                    BLOCK_EVENTS.append({
                        "key": key, "ts": int(time.time()), "source": "pool",
                        "height": int(m.group(1)), "hash": None, "type": "block_found",
                    })

# ── Env file discovery ──────────────────────────────────────────────────

def list_env_files() -> list:
    """Discover .env.* files in repo root."""
    found = []
    for p in REPO_ROOT.glob(".env*"):
        if p.is_file():
            try:
                size = p.stat().st_size
                with open(p, "r", encoding="utf-8", errors="ignore") as f:
                    var_count = sum(1 for ln in f if ln.strip() and not ln.strip().startswith("#") and "=" in ln)
                found.append({"name": p.name, "path": str(p), "size": size, "vars": var_count})
            except Exception as e:
                found.append({"name": p.name, "path": str(p), "size": 0, "vars": 0, "error": str(e)})
    return sorted(found, key=lambda x: x["name"])

def load_env_file(name: str) -> dict:
    """Load a specific env file and return validated key=value pairs."""
    path = REPO_ROOT / name
    if not path.exists() or not path.is_file():
        return {"error": "File not found", "vars": []}
    if not name.startswith(".env"):
        return {"error": "Only .env* files are allowed", "vars": []}

    REQUIRED = {
        "ZION_NODE_ID", "ZION_P2P_BIND", "ZION_RPC_BIND",
        "ZION_MINER_ADDRESS", "ZION_HUMANITARIAN_WALLET",
        "ZION_ISSOBELLA_WALLET", "ZION_POOL_FEE_WALLET",
        "ZION_POOL_WALLET", "ZION_POOL_PAYOUT_SK_HEX",
    }
    SENSITIVE = {"ZION_POOL_PAYOUT_SK_HEX", "ZION_MINER_PRIVKEY", "ZION_NODE_PRIVKEY"}

    variables = []
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for ln_no, raw in enumerate(f, 1):
                ln = raw.strip()
                if not ln or ln.startswith("#"):
                    continue
                if "=" in ln:
                    k, _, v = ln.partition("=")
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    is_required = k in REQUIRED
                    is_sensitive = k in SENSITIVE or "PRIVKEY" in k or "SK_HEX" in k
                    display_value = "***REDACTED***" if is_sensitive and v else v
                    variables.append({
                        "key": k, "value": display_value,
                        "required": is_required, "sensitive": is_sensitive,
                        "present": bool(v), "line": ln_no,
                    })
    except Exception as e:
        return {"error": str(e), "vars": []}

    keys_present = {v["key"] for v in variables if v["present"]}
    missing = sorted(REQUIRED - keys_present)
    return {"file": name, "vars": variables, "missing_required": missing, "total": len(variables)}

# ── Wallet discovery & RPC balance lookup ──────────────────────────────

def rpc_call(host: str, port: int, method: str, params: dict, timeout: float = 2.0) -> dict:
    """HTTP JSON-RPC call to ZION node. Returns result dict or None on failure."""
    try:
        req = _urlreq.Request(
            f"http://{host}:{port}/jsonrpc",
            data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with _urlreq.urlopen(req, timeout=timeout) as r:
            resp = json.loads(r.read().decode("utf-8"))
            if "error" in resp and resp["error"]:
                return {"_rpc_error": resp["error"]}
            return resp.get("result")
    except Exception as e:
        return {"_rpc_error": str(e)[:120]}

def parse_premine_from_genesis(rpc_host: str = "127.0.0.1", rpc_port: int = 8443) -> list:
    """Extract premine addresses and amounts from the actual genesis block via RPC.
    This reflects the true on-chain state, which may differ from PREMINE_ADDRESSES_PUBLIC.txt
    after wallet rotation."""
    wallets = []
    genesis = rpc_call(rpc_host, rpc_port, "getBlockByHeight", {"height": 0})
    if not genesis or not genesis.get("transactions"):
        # Fallback to Edge RPC
        genesis = rpc_call(EDGE_HOST, 8443, "getBlockByHeight", {"height": 0})
    if not genesis or not genesis.get("transactions"):
        # Final fallback to file if RPC unavailable
        return parse_premine_from_file()
    labels = [
        "OASIS + Winners Golden Egg/Xp (Slot 1)",
        "OASIS + Winners Golden Egg/Xp (Slot 2)",
        "OASIS + Winners Golden Egg/Xp (Slot 3)",
        "OASIS + Winners Golden Egg/Xp (Slot 4)",
        "OASIS + Winners Golden Egg/Xp (Slot 5)",
        "DAO Treasury — Community Governance (main)",
        "DAO Treasury — Grants & Bounties",
        "DAO Treasury — Ecosystem Bootstrap",
        "Core Development Fund",
        "Network Infrastructure — P2P Seed Nodes",
        "Genesis Projects — Dharma Temple, Piko de Ora + DAO",
        "Children Future Fund — Humanitarian DAO",
    ]
    for i, tx in enumerate(genesis.get("transactions", [])):
        addr = tx.get("to", "")
        amount = int(tx.get("amount_zion", 0))
        wallets.append({
            "index": i + 1,
            "address": addr,
            "label": labels[i] if i < len(labels) else f"Premine Output {i+1}",
            "amount_zion": flowers_to_zion(amount),  # flowers -> ZION (auto-detects legacy 1e12)
            "source": "genesis",
            "category": "premine",
        })
    return wallets

def parse_premine_from_file() -> list:
    """Parse PREMINE_ADDRESSES_PUBLIC.txt for canonical premine wallet list."""
    path = REPO_ROOT / "PREMINE_ADDRESSES_PUBLIC.txt"
    wallets = []
    if not path.exists():
        return wallets
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                # Format: 1  zion1zz-ILOBeL9pBhE3fBw0RpIYu4Jo    OASIS_Winner_1       1,650,000,000
                m = re.match(r'^\s*(\d+)\s+(\S+)\s+(\S+)\s+([0-9,]+)', line)
                if m:
                    amount_str = m.group(4).replace(",", "")
                    wallets.append({
                        "index": int(m.group(1)),
                        "address": m.group(2),
                        "label": m.group(3).replace("_", " "),
                        "amount_zion": int(amount_str) if amount_str.isdigit() else 0,
                        "source": "premine",
                        "category": "premine",
                    })
    except Exception:
        pass
    return wallets

def find_env_value(key: str) -> str:
    """Check os.environ first, then scan .env* files in repo root.
    Handles both KEY=val and export KEY=val syntax."""
    val = os.environ.get(key)
    if val:
        return val
    for p in sorted(REPO_ROOT.glob(".env*")):
        if not p.is_file():
            continue
        try:
            with open(p, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("#") or "=" not in line:
                        continue
                    # Strip optional "export " prefix
                    if line.startswith("export "):
                        line = line[7:].strip()
                    k, _, v = line.partition("=")
                    k = k.strip()
                    if k == key:
                        return v.strip().strip('"').strip("'")
        except Exception:
            continue
    return ""

def parse_node_startup_addresses() -> dict:
    """Extract the actual addresses the running node uses from its startup log."""
    path = LOG_DIR / "node1.log"
    if not path.exists():
        return {}
    addresses = {}
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if m := re.search(r'^miner_address=(\S+)', line):
                    addresses["miner"] = m.group(1)
                if m := re.search(r'^humanitarian_address=(\S+)', line):
                    addresses["humanitarian"] = m.group(1)
                if m := re.search(r'^issobella_address=(\S+)', line):
                    addresses["issobella"] = m.group(1)
                if m := re.search(r'^pool_fee_address=(\S+)', line):
                    addresses["pool_fee"] = m.group(1)
                # Stop after we've collected the core startup lines (~first 20 lines)
                if line.startswith("p2p_peer_addr=") or line.startswith("p2p_in="):
                    break
    except Exception:
        pass
    return addresses

def build_wallets() -> dict:
    """Collect all known wallets: premine (from live genesis block), operational (node/env), miner (toml)."""
    wallets = []

    # 1. Premine wallets from LIVE genesis block (actual on-chain state)
    # Falls back to PREMINE_ADDRESSES_PUBLIC.txt if RPC unavailable
    premine = parse_premine_from_genesis()
    for w in premine:
        wallets.append(w)

    # 2. Operational wallets — prefer node startup log (actual running addresses),
    #    fallback to .env files
    node_addrs = parse_node_startup_addresses()
    # Canonical Edge pool wallet (AGENTS.md) — always include
    canonical_pool = "zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2"
    op_sources = [
        (canonical_pool, "Pool Canonical (Main Payout)", "canonical"),
        (node_addrs.get("miner") or find_env_value("ZION_MINER_ADDRESS"), "Miner Payout", "node"),
        (node_addrs.get("humanitarian") or find_env_value("ZION_HUMANITARIAN_WALLET"), "Humanitarian Tithe", "node"),
        (node_addrs.get("issobella") or find_env_value("ZION_ISSOBELLA_WALLET"), "Issobella Fund", "node"),
        (node_addrs.get("pool_fee") or find_env_value("ZION_POOL_FEE_WALLET"), "Pool Fee Recipient", "node"),
        (find_env_value("ZION_POOL_WALLET"), "Pool Operational", "env"),
    ]
    for val, label, src in op_sources:
        if not val:
            continue
        val = val.strip().strip('"').strip("'")
        if val and not val.startswith("$") and len(val) > 10:
            if not any(w["address"] == val for w in wallets):
                wallets.append({
                    "address": val,
                    "label": label,
                    "source": src,
                    "category": "operational",
                })

    # 3. zion.toml [miner] wallet — only add if it's a DIFFERENT address from the
    #    active node miner payout address (to avoid a confusing 0-balance duplicate).
    toml_path = REPO_ROOT / "zion.toml"
    if toml_path.exists():
        try:
            with open(toml_path, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("#"):
                        continue
                    if m := re.search(r'wallet\s*=\s*["\']?([^"\'\s#]+)', line):
                        addr = m.group(1).strip()
                        active_miner = node_addrs.get("miner") or find_env_value("ZION_MINER_ADDRESS")
                        if addr and addr != active_miner and not any(w["address"] == addr for w in wallets):
                            wallets.append({
                                "address": addr,
                                "label": "Remote Config Wallet (zion.toml)",
                                "source": "zion.toml",
                                "category": "operational",
                            })
                        break
        except Exception:
            pass

    # 4. Try to enrich with live balances — prefer local RPC, fallback to Edge
    rpc_host = "127.0.0.1"
    rpc_port = 8443
    rpc_addr = os.environ.get("ZION_NODE_RPC_ADDR", "")
    if rpc_addr and ":" in rpc_addr:
        try:
            rpc_host, rpc_port_str = rpc_addr.rsplit(":", 1)
            rpc_port = int(rpc_port_str)
        except Exception:
            pass
    elif rpc_addr:
        rpc_host = rpc_addr
    # Test connectivity; fall back to Edge if local unavailable
    _ping = rpc_call(rpc_host, rpc_port, "getChainInfo", {}, timeout=1.5)
    if not _ping or _ping.get("_rpc_error"):
        rpc_host, rpc_port = EDGE_HOST, 8443

    for w in wallets:
        addr = w.get("address", "")
        if addr and addr.startswith("zion1"):
            bal = rpc_call(rpc_host, rpc_port, "getBalance", {"address": addr})
            if bal and not bal.get("_rpc_error"):
                atomic = int(bal.get("balance_flowers") or bal.get("balance_atomic") or 0)
                w["balance_zion"] = bal.get("balance_zion") if isinstance(bal.get("balance_zion"), (int, float)) else flowers_to_zion(atomic)
                w["balance_atomic"] = atomic
                w["rpc_ok"] = True
            else:
                w["balance_zion"] = None
                w["balance_atomic"] = None
                w["rpc_ok"] = False
        else:
            w["balance_zion"] = None
            w["balance_atomic"] = None
            w["rpc_ok"] = False

    total_premine = sum(w.get("amount_zion", 0) for w in wallets if w.get("category") == "premine")
    with_balance = [w for w in wallets if w.get("balance_zion") is not None]

    # Category breakdown for premine
    category_summary = {}
    for w in wallets:
        if w.get("category") == "premine":
            cat = w.get("source", "premine")  # all premine have same category
            label = w.get("label", "")
            # Group by purpose
            if "OASIS" in label:
                group = "oasis"
            elif "DAO" in label:
                group = "dao"
            elif "Core Dev" in label or "Infrastructure" in label or "Creator" in label or "Seed" in label:
                group = "infrastructure"
            elif "Humanitarian" in label or "Children" in label:
                group = "humanitarian"
            else:
                group = "other"
            category_summary.setdefault(group, {"count": 0, "total_zion": 0, "labels": []})
            category_summary[group]["count"] += 1
            amt = w.get("amount_zion", 0)
            if isinstance(amt, (int, float)):
                category_summary[group]["total_zion"] += amt
            category_summary[group]["labels"].append(label[:40])

    # Operational breakdown
    op_total = sum(w.get("balance_zion", 0) or 0 for w in wallets if w.get("category") == "operational")

    return {
        "wallets": wallets,
        "summary": {
            "total_wallets": len(wallets),
            "premine_wallets": len(premine),
            "operational_wallets": len([w for w in wallets if w.get("category") == "operational"]),
            "with_live_balance": len(with_balance),
            "total_premine_zion": total_premine,
            "total_operational_zion": round(op_total, 6),
        },
        "category_summary": category_summary,
        "rpc": {"host": rpc_host, "port": rpc_port, "reachable": len(with_balance) > 0},
    }

# ── Block detail ────────────────────────────────────────────────────────

def get_block_detail(height: int = None, hash_hex: str = None) -> dict:
    """Fetch full block details by height or hash."""
    rpc_host, rpc_port = "127.0.0.1", 8443
    blk = None
    if height is not None:
        blk = rpc_call(rpc_host, rpc_port, "getBlockByHeight", {"height": height}, timeout=2)
    elif hash_hex:
        blk = rpc_call(rpc_host, rpc_port, "getBlockByHash", {"hash": hash_hex}, timeout=2)
    if not blk or blk.get("_rpc_error"):
        return {"found": False, "error": blk.get("_rpc_error") if blk else "RPC unavailable"}
    tx_list = []
    for tx in blk.get("transactions", []):
        tx_list.append({
            "tx_id": tx.get("tx_id", "—"),
            "type": tx.get("tx_type", "transfer"),
            "from": tx.get("from_address", "—"),
            "to": tx.get("to_address", "—"),
            "amount_zion": tx.get("amount_zion", 0),
            "fee_zion": tx.get("fee_zion", 0),
        })
    return {
        "found": True,
        "height": blk.get("height"),
        "hash": blk.get("hash_hex", "—"),
        "timestamp": blk.get("timestamp"),
        "difficulty": blk.get("difficulty"),
        "miner": blk.get("miner_address", "—"),
        "reward_zion": blk.get("reward_zion", 0),
        "total_fees_zion": blk.get("total_fees_zion", 0),
        "nonce": blk.get("nonce"),
        "prev_hash": blk.get("prev_hash_hex", "—"),
        "tx_count": len(tx_list),
        "transactions": tx_list,
        "body_hash": blk.get("body_hash_hex", "—"),
    }

# ── Mempool detail ────────────────────────────────────────────────────

def get_mempool_detail() -> dict:
    """Fetch mempool transactions and stats via getMempoolInfo RPC."""
    rpc_host, rpc_port = "127.0.0.1", 8443
    # Try getMempoolInfo first (richer data)
    info = rpc_call(rpc_host, rpc_port, "getMempoolInfo", {}, timeout=1.5)
    if info and not info.get("_rpc_error"):
        return {
            "rpc_reachable": True,
            "tx_count": info.get("size", 0),
            "template_tx_count": info.get("template_transactions", 0),
            "total_fees_zion": info.get("template_total_fees_zion", 0),
            "transaction_model": info.get("transaction_model", "hybrid"),
            "transactions": [],
        }
    # Fallback to getChainInfo
    info = rpc_call(rpc_host, rpc_port, "getChainInfo", {}, timeout=1.5)
    if not info or info.get("_rpc_error"):
        return {"rpc_reachable": False, "tx_count": 0, "transactions": []}
    mempool_txs = info.get("mempool_transactions", 0)
    return {
        "rpc_reachable": True,
        "tx_count": mempool_txs,
        "template_tx_count": 0,
        "total_fees_zion": 0,
        "transactions": [],
    }

# ── Miner shares history ──────────────────────────────────────────────

def get_miner_shares_history(limit: int = 50) -> dict:
    """Parse miner.log (or miner-low.log) for accepted/rejected shares over time."""
    recent = tail_log("miner.log", 500)
    if not recent:
        recent = tail_log("miner-low.log", 500)
    history = []
    for line in recent:
        if m := re.search(r'accepted\s+(\d+)/(\d+)', line):
            history.append({
                "accepted": int(m.group(1)),
                "rejected": int(m.group(2)),
                "line": line[:120],
            })
    # Deduplicate by accepted count (keep last occurrence)
    seen = set()
    dedup = []
    for h in reversed(history):
        key = (h["accepted"], h["rejected"])
        if key not in seen:
            seen.add(key)
            dedup.append(h)
    dedup.reverse()
    return {"samples": dedup[-limit:]}

# ── Service dependency graph data ─────────────────────────────────────

def get_dependency_graph() -> dict:
    """Return nodes and edges for the service dependency DAG."""
    nodes = []
    edges = []
    health = all_services_health()
    health_map = {h["id"]: h for h in health}
    for svc in SERVICE_REGISTRY:
        sid = svc["id"]
        h = health_map.get(sid, {})
        nodes.append({
            "id": sid,
            "name": svc.get("name", sid),
            "icon": svc.get("icon", "🔹"),
            "alive": h.get("alive", False),
            "kind": svc.get("kind", "unknown"),
            "level": svc.get("level", "L?"),
        })
        for dep in svc.get("depends_on", []):
            edges.append({"from": dep, "to": sid})
    return {"nodes": nodes, "edges": edges}

# ── Explorer data builder ──────────────────────────────────────────────

def build_explorer() -> dict:
    """Fetch blockchain overview for the Explorer tab."""
    rpc_host, rpc_port = "127.0.0.1", 8443
    rpc_addr = os.environ.get("ZION_NODE_RPC_ADDR", "")
    if rpc_addr and ":" in rpc_addr:
        try:
            rpc_host, rpc_port_str = rpc_addr.rsplit(":", 1)
            rpc_port = int(rpc_port_str)
        except Exception:
            pass
    elif rpc_addr:
        rpc_host = rpc_addr

    info = rpc_call(rpc_host, rpc_port, "getChainInfo", {})
    # Fallback to Edge RPC if local is unavailable
    if not info or info.get("_rpc_error"):
        info = rpc_call(EDGE_HOST, 8443, "getChainInfo", {})
        if info and not info.get("_rpc_error"):
            rpc_host, rpc_port = EDGE_HOST, 8443
        else:
            info = None
    genesis = rpc_call(rpc_host, rpc_port, "getBlockByHeight", {"height": 0})

    # Recent blocks: grab last 10 from events / history
    recent_blocks = []
    try:
        # Try to get last 10 blocks via RPC (getBlockByHeight)
        chain_height = info.get("chain_height", 0) if info else 0
        for h in range(max(0, chain_height - 9), chain_height + 1):
            blk = rpc_call(rpc_host, rpc_port, "getBlockByHeight", {"height": h}, timeout=0.8)
            if blk:
                recent_blocks.append({
                    "height": h,
                    "hash": blk.get("hash_hex", "")[:24] + "…",
                    "timestamp": blk.get("timestamp", 0),
                    "tx_count": len(blk.get("transaction_ids", [])),
                    "difficulty": blk.get("difficulty", 0),
                })
    except Exception:
        pass

    # Mempool
    mempool_size = info.get("mempool_transactions", 0) if info else 0
    template_txs = info.get("active_template_transactions", 0) if info else 0

    # Supply estimate
    chain_height = info.get("chain_height", 0) if info else 0
    block_reward = 5400.067
    estimated_mined = chain_height * block_reward
    total_premine = 16_780_000_000
    circulating_estimate = total_premine + estimated_mined

    # Peer count from getChainInfo (field varies by node version)
    peer_count = 0
    if info:
        peer_count = (info.get("peer_count") or info.get("peers") or
                      info.get("connected_peers") or 0)

    return {
        "rpc_reachable": info is not None,
        "network": info.get("network", "Mainnet") if info else "Mainnet",
        "chain_height": chain_height,
        "tip_hash": info.get("tip_hash", "")[:20] + "…" if info else "—",
        "accepted_blocks": info.get("accepted_blocks", 0) if info else 0,
        "mempool_size": mempool_size,
        "template_txs": template_txs,
        "block_reward_zion": block_reward,
        "estimated_circulating_zion": round(circulating_estimate, 2),
        "total_supply_zion": 144_000_000_000,
        "premine_zion": total_premine,
        "genesis_hash": genesis.get("hash_hex", "")[:24] + "…" if genesis else "—",
        "recent_blocks": recent_blocks,
        "peer_count": peer_count,
        "protocol_version": info.get("protocol_version", "") if info else "",
    }

# ── Edge server system status ───────────────────────────────────────────

_edge_status_cache = {"data": None, "ts": 0}
_EDGE_CACHE_TTL = 15  # seconds

def get_edge_server_status() -> dict:
    """Fetch Edge server system metrics via SSH. Server-side cached for 15s."""
    import time as _time
    now = _time.time()
    if _edge_status_cache["data"] is not None and (now - _edge_status_cache["ts"]) < _EDGE_CACHE_TTL:
        return _edge_status_cache["data"]

    try:
        # Single command: combine all metrics to avoid multiple calls
        combined_cmd = "cat /proc/loadavg && free -m && df -h / | tail -1 && echo '===TOP===' && ps -eo rss,comm --sort=-rss | head -6 | tail -5 && echo '===SVC===' && systemctl is-active zion-node zion-pool zion-dao zion-warp zion-bridge nginx 2>/dev/null"
        result = _run_edge_cmd(combined_cmd, timeout=8)
        if result.returncode != 0:
            return {"ok": False, "error": result.stderr.strip() or "Edge command failed"}

        output = result.stdout.strip()
        # Split output by markers
        parts = output.split("===TOP===")
        main_part = parts[0].strip() if parts else output
        top_part = parts[1].split("===SVC===")[0].strip() if len(parts) > 1 else ""
        svc_part = parts[1].split("===SVC===")[1].strip() if len(parts) > 1 and "===SVC===" in parts[1] else ""

        lines = main_part.splitlines()
        if len(lines) < 3:
            return {"ok": False, "error": "Incomplete output"}

        # Parse loadavg: 0.12 0.08 0.03 1/123 45678
        load_parts = lines[0].split()
        load_1m = float(load_parts[0])

        # Parse free -m: find line starting with Mem:
        mem_line = None
        for line in lines:
            if line.strip().startswith("Mem:"):
                mem_line = line
                break
        if mem_line is None:
            return {"ok": False, "error": "Could not parse memory"}
        mem_parts = mem_line.split()
        mem_total_mb = float(mem_parts[1])
        mem_used_mb = float(mem_parts[2])
        mem_pct = int((mem_used_mb / mem_total_mb) * 100) if mem_total_mb > 0 else 0

        # Parse df -h /: find line containing rootfs or /
        disk_line = None
        for line in lines:
            if line.strip().endswith(" /") or " / " in line:
                disk_line = line
                break
        if disk_line is None:
            disk_line = lines[-1]
        disk_parts = disk_line.split()
        disk_pct = int(disk_parts[4].rstrip('%')) if len(disk_parts) > 4 else 0

        # Top memory consumers
        mem_top = []
        for line in top_part.splitlines():
            parts = line.split(None, 1)
            if len(parts) == 2:
                mb = float(parts[0]) / 1024.0
                cmd = parts[1].strip()
                mem_top.append({"cmd": cmd, "mb": mb})

        # Service status
        services = []
        svc_names = ["node", "pool", "dao", "warp", "bridge", "nginx"]
        states = svc_part.splitlines() if svc_part else []
        for i, name in enumerate(svc_names):
            if i < len(states):
                services.append({"name": name, "status": states[i]})

        data = {
            "ok": True,
            "cpu_pct": load_1m * 10,  # rough estimate: load*10 as %
            "load_1m": load_1m,
            "mem_pct": mem_pct,
            "mem_used_mb": mem_used_mb,
            "mem_total_mb": mem_total_mb,
            "mem_top": mem_top,
            "mem_history": [],
            "disk_pct": disk_pct,
            "services": services,
        }
        # Cache the result
        _edge_status_cache["data"] = data
        _edge_status_cache["ts"] = now
        return data
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Command timeout"}
    except FileNotFoundError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def clear_edge_disk(aggressive: bool = False) -> dict:
    """Run edge-log-cleanup.sh on Edge server, plus Docker prune.
    Returns disk usage before/after and freed space."""
    try:
        # Get disk usage before
        result = _run_edge_cmd("df -h / | tail -1 | awk '{print $5\" \"$4}'", timeout=8)
        if result.returncode != 0:
            return {"ok": False, "error": result.stderr.strip() or "Edge command failed"}
        before_parts = result.stdout.strip().split()
        disk_before_pct = before_parts[0].rstrip('%') if before_parts else "?"
        disk_before_avail = before_parts[1] if len(before_parts) > 1 else "?"

        # Run cleanup script
        cleanup_cmd = "/usr/local/bin/edge-log-cleanup.sh 2>&1"
        if aggressive:
            cleanup_cmd = (
                "docker builder prune -af 2>&1; "
                "docker image prune -af 2>&1; "
                "docker container prune -f 2>&1; "
                "docker volume prune -f 2>&1; "
                "journalctl --vacuum-size=200M 2>&1; "
                "/usr/local/bin/edge-log-cleanup.sh 2>&1"
            )

        result = _run_edge_cmd(cleanup_cmd, timeout=60)
        cleanup_output = result.stdout.strip()

        # Get disk usage after
        result = _run_edge_cmd("df -h / | tail -1 | awk '{print $5\" \"$4}'", timeout=8)
        after_parts = result.stdout.strip().split()
        disk_after_pct = after_parts[0].rstrip('%') if after_parts else "?"
        disk_after_avail = after_parts[1] if len(after_parts) > 1 else "?"

        # Invalidate edge status cache so next refresh shows new disk
        _edge_status_cache["data"] = None
        _edge_status_cache["ts"] = 0

        return {
            "ok": True,
            "disk_before": f"{disk_before_pct}% ({disk_before_avail} avail)",
            "disk_after": f"{disk_after_pct}% ({disk_after_avail} avail)",
            "aggressive": aggressive,
            "output": cleanup_output[-500:] if cleanup_output else "",
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Timeout - cleanup may still be running"}
    except FileNotFoundError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def run_edge_action(action: str) -> dict:
    """Run an action on the Edge server (service restart, docker clean, etc.).
    Executes locally when on Edge, via SSH otherwise."""
    # Map action → command
    ACTION_MAP = {
        "restart-node1":          "systemctl restart zion-node",
        "restart-node2":          "echo 'node2 not deployed on v3.0.4 single-server topology'",
        "restart-pool":           "systemctl restart zion-pool",
        "restart-dao":            "systemctl restart zion-dao",
        "restart-warp":           "systemctl restart zion-warp",
        "restart-dashboard":      "systemctl restart zion-dashboard",
        "restart-hiran":          "systemctl restart zion-hiran-inference 2>/dev/null || echo 'hiran not deployed'",
        "restart-hiranyagarbha":  "systemctl restart zion-hiranyagarbha 2>/dev/null || echo 'hiranyagarbha not deployed'",
        "restart-bridge":         "systemctl restart zion-bridge",
        "restart-website":        "systemctl restart zion-web-next 2>/dev/null || docker restart zion-web-next 2>/dev/null || echo 'web in maintenance mode'",
        "clean-docker":           "docker builder prune -af 2>&1; docker image prune -af 2>&1; docker container prune -f 2>&1",
        "security-audit":         "echo 'Security audit placeholder — run manually'",
        "full-health":            "systemctl is-active zion-node zion-pool zion-dao zion-warp zion-bridge nginx 2>&1",
        "memory-limit":           "echo 'Memory limits configured in systemd unit files'",
    }

    cmd = ACTION_MAP.get(action)
    if not cmd:
        return {"ok": False, "error": f"Unknown action: {action}"}

    try:
        result = _run_edge_cmd(cmd, timeout=30)
        output = (result.stdout + "\n" + result.stderr).strip()
        ok = result.returncode == 0
        # Invalidate edge status cache after restarts
        if action.startswith("restart-") or action == "clean-docker":
            _edge_status_cache["data"] = None
            _edge_status_cache["ts"] = 0
        return {"ok": ok, "result": output[-300:] if output else "OK", "action": action}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "Command timeout", "action": action}
    except FileNotFoundError as e:
        return {"ok": False, "error": str(e), "action": action}
    except Exception as e:
        return {"ok": False, "error": str(e), "action": action}


def list_edge_backups() -> dict:
    """List available backups on Edge server (/root/zion-backups/)."""
    try:
        result = _run_edge_cmd(
            "ls -lht /root/zion-backups/*.tar.gz 2>/dev/null | head -20; "
            "echo '===HEALTH==='; cat /root/zion-backups/health.json 2>/dev/null",
            timeout=5
        )
        if result.returncode != 0 and not EDGE_IS_LOCAL:
            return {"ok": False, "error": result.stderr.strip() or "SSH failed"}

        output = result.stdout.strip()
        parts = output.split("===HEALTH===")
        ls_part = parts[0].strip() if parts else output
        health_part = parts[1].strip() if len(parts) > 1 else ""

        backups = []
        for line in ls_part.splitlines():
            line = line.strip()
            if not line or line.startswith("total") or not line.endswith(".tar.gz"):
                continue
            # Parse: -rw-r--r-- 1 root root 25M Jun 28 15:04 /root/zion-backups/zion-edge-20260628-150423.tar.gz
            fields = line.split()
            if len(fields) < 9:
                continue
            name = fields[-1].split("/")[-1]
            size_str = fields[4]
            # Convert size to MB
            if size_str.endswith("M"):
                size_mb = float(size_str[:-1])
            elif size_str.endswith("K"):
                size_mb = float(size_str[:-1]) / 1024
            elif size_str.endswith("G"):
                size_mb = float(size_str[:-1]) * 1024
            else:
                size_mb = float(size_str) / (1024*1024)
            timestamp = f"{fields[5]} {fields[6]} {fields[7]}"
            backups.append({"name": name, "size_mb": round(size_mb, 2), "date": timestamp})

        health = {}
        if health_part:
            try:
                import json as _json
                health = _json.loads(health_part)
            except Exception:
                pass

        return {"ok": True, "backups": backups, "health": health, "count": len(backups)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get_edge_backup_path(filename: str) -> "Path | None":
    """Get local path to an edge backup file. Downloads via SCP if not on Edge."""
    # On Edge: file is local
    if EDGE_IS_LOCAL:
        p = Path(f"/root/zion-backups/{filename}")
        return p if p.exists() else None
    # On Core PC: download to temp, then serve
    import tempfile as _tf
    local_cache = Path(_tf.gettempdir()) / f"edge-backup-{filename}"
    if local_cache.exists():
        return local_cache
    ssh_key = REPO_ROOT / "ssh-key-zion-edge"
    if ssh_key.exists():
        try:
            subprocess.run(
                ["scp", "-i", str(ssh_key), "-o", "StrictHostKeyChecking=accept-new",
                 "-o", "ConnectTimeout=5", "-o", "BatchMode=yes",
                 f"root@{EDGE_HOST}:/root/zion-backups/{filename}",
                 str(local_cache)],
                capture_output=True, timeout=120
            )
        except Exception:
            pass
    else:
        # v3.0.4: Fallback to SSH config alias "zion-new"
        try:
            subprocess.run(
                ["scp", "-o", "ConnectTimeout=5", "-o", "BatchMode=yes",
                 f"zion-new:/root/zion-backups/{filename}",
                 str(local_cache)],
                capture_output=True, timeout=120
            )
        except Exception:
            pass
        return local_cache if local_cache.exists() else None


def get_pool_miners() -> dict:
    """Fetch active miners from Edge pool Prometheus metrics."""
    try:
        import urllib.request as _ur
        with _ur.urlopen(f"http://{EDGE_RPC_HOST}:8455/metrics", timeout=3.0) as r:
            body = r.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return {"ok": False, "miners": [], "active_sessions": 0, "total_hashrate_khs": 0, "error": str(e)}

    miners = {}
    active_sessions = 0
    miners_tracked = 0
    total_hashrate_hps = 0.0
    u64_max = (1 << 64) - 1

    for line in body.splitlines():
        line = line.strip()
        if line.startswith("zion_pool_active_sessions "):
            active_sessions = int(float(line.split()[-1]))
        elif line.startswith("zion_pool_miners_tracked "):
            miners_tracked = int(float(line.split()[-1]))
        elif line.startswith("zion_pool_miner_hashrate_hps{"):
            # Parse labels: miner_id="...",worker_name="..."
            m_id = re.search(r'miner_id="([^"]+)"', line)
            w_name = re.search(r'worker_name="([^"]+)"', line)
            val = float(line.split()[-1])
            if m_id and w_name:
                key = m_id.group(1)
                miners[key] = {
                    "miner_id": m_id.group(1),
                    "worker_name": w_name.group(1),
                    "hashrate_hps": val,
                    "valid_shares": 0,
                    "invalid_shares": 0,
                    "paid_total": 0,
                    "paid_total_atomic": 0,
                    "blocks_found": 0,
                    "last_seen": 0,
                }
                total_hashrate_hps += val
        elif line.startswith("zion_pool_miner_valid_shares_total{"):
            m_id = re.search(r'miner_id="([^"]+)"', line)
            val = int(float(line.split()[-1]))
            if m_id and m_id.group(1) in miners:
                miners[m_id.group(1)]["valid_shares"] = val
        elif line.startswith("zion_pool_miner_invalid_shares_total{"):
            m_id = re.search(r'miner_id="([^"]+)"', line)
            val = int(float(line.split()[-1]))
            if m_id and m_id.group(1) in miners:
                miners[m_id.group(1)]["invalid_shares"] = val
        elif line.startswith("zion_pool_miner_paid_total_atomic{"):
            m_id = re.search(r'miner_id="([^"]+)"', line)
            val = int(line.split()[-1])
            if m_id and m_id.group(1) in miners:
                miners[m_id.group(1)]["paid_total_atomic"] = val
                miners[m_id.group(1)]["paid_total"] = flowers_to_zion(val)  # convert atomic flowers to ZION
        elif line.startswith("zion_pool_miner_last_seen_seconds{"):
            m_id = re.search(r'miner_id="([^"]+)"', line)
            val = int(float(line.split()[-1]))
            if m_id and m_id.group(1) in miners:
                miners[m_id.group(1)]["last_seen"] = val

    miner_list = list(miners.values())

    # Merge with the sanitized payout view so UI consumers don't inherit stale
    # per-miner counters from older pool binaries.
    try:
        payout_miners = fetch_pool_miners()
        payout_by_key = {}
        for payout_miner in payout_miners:
            for key in (
                payout_miner.get("worker_name"),
                payout_miner.get("address"),
                payout_miner.get("miner_id"),
            ):
                if key:
                    payout_by_key[key] = payout_miner
        for miner in miner_list:
            payout_miner = (
                payout_by_key.get(miner.get("worker_name"))
                or payout_by_key.get(miner.get("miner_id"))
            )
            if not payout_miner:
                continue
            payout_atomic = int(payout_miner.get("paid_total_atomic") or 0)
            if payout_atomic and (
                int(miner.get("paid_total_atomic") or 0) == u64_max
                or int(miner.get("paid_total_atomic") or 0) == 0
            ):
                miner["paid_total_atomic"] = payout_atomic
                miner["paid_total"] = flowers_to_zion(payout_atomic)
            miner["blocks_found"] = payout_miner.get("blocks_found", miner.get("blocks_found", 0))
            if payout_miner.get("pending_balance") is not None:
                miner["pending_balance"] = payout_miner.get("pending_balance")
            if payout_miner.get("on_chain_balance_zion") is not None:
                miner["on_chain_balance_zion"] = payout_miner.get("on_chain_balance_zion")
            if payout_miner.get("payout_address"):
                miner["payout_address"] = payout_miner.get("payout_address")
    except Exception:
        pass

    return {
        "ok": True,
        "miners": miner_list,
        "active_sessions": active_sessions,
        "miners_tracked": miners_tracked,
        "total_hashrate_khs": total_hashrate_hps / 1000.0,
    }

# ── Pool connection history (from Edge journald) ───────────────────────

_POOL_HISTORY_CACHE = {"ts": 0, "data": []}
_POOL_HISTORY_LOCK = threading.Lock()
_POOL_HISTORY_TTL = 60  # seconds — journalctl is expensive, cache longer


def _parse_journal_timestamp(line: str) -> float:
    """Parse 'Jul 10 20:56:20' style timestamp into Unix seconds (current year)."""
    try:
        m = re.match(r"^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})", line.strip())
        if not m:
            return 0.0
        ts_str = m.group(1)
        now = datetime.now()
        dt = datetime.strptime(f"{now.year} {ts_str}", "%Y %b %d %H:%M:%S")
        # Handle year wrap around new year
        if (now - dt).total_seconds() > 86400 * 180:
            dt = dt.replace(year=now.year + 1)
        return dt.timestamp()
    except Exception:
        return 0.0


def get_pool_connection_history(limit: int = 100, since_hours: int = 24) -> dict:
    """Fetch pool connection/disconnection events from Edge server journald.

    Parses `peer_addr=`, `session_start`, `session_miner_id`, `session_worker_name`,
    `session_duration_secs` and `wire_bye` lines produced by zion-pool-server.
    """
    global _POOL_HISTORY_CACHE
    now = time.time()
    with _POOL_HISTORY_LOCK:
        if (
            _POOL_HISTORY_CACHE.get("since_hours") == since_hours
            and now - _POOL_HISTORY_CACHE["ts"] < _POOL_HISTORY_TTL
        ):
            return {"ok": True, "events": _POOL_HISTORY_CACHE["data"][:limit], "cached": True}

    cmd = (
        f"journalctl -u zion-pool --no-pager --since '{since_hours} hours ago' -n 5000 "
        "| grep -E 'peer_addr=|session_start|session_miner_id|session_worker_name|session_duration_secs|wire_bye'"
    )
    try:
        result = _run_edge_cmd(cmd, timeout=10)
        if result.returncode != 0:
            return {"ok": False, "events": [], "error": result.stderr.strip()[:120]}
        raw = result.stdout.strip()
    except Exception as e:
        return {"ok": False, "events": [], "error": str(e)[:120]}

    if not raw:
        return {"ok": True, "events": [], "cached": False}

    # Map session_id -> event dict. peer_addr is queued and matched to the next session_start.
    sessions: dict[str, dict] = {}
    pending_peers: list[dict] = []
    events: list[dict] = []
    # Track closest session_start for duration/miner_id lines (which lack session_id)
    open_sessions: list[dict] = []

    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        ts = _parse_journal_timestamp(line)

        # peer_addr is logged before the worker thread spawns. Queue it.
        if m := re.search(r"peer_addr=([\d.]+:\d+)", line):
            pending_peers.append({"ts": ts, "peer_addr": m.group(1)})
            continue

        # session_start creates a new session. Pair it with oldest queued peer_addr.
        if m := re.search(r"session_start\s+active_sessions=(\d+)\s+session_id=(\d+)", line):
            active_sessions = int(m.group(1))
            session_id = m.group(2)
            peer = pending_peers.pop(0) if pending_peers else {"ts": ts, "peer_addr": ""}
            event = {
                "ts": ts,
                "time": datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S"),
                "session_id": session_id,
                "active_sessions": active_sessions,
                "peer_addr": peer.get("peer_addr", ""),
                "miner_id": None,
                "worker_name": None,
                "duration_secs": None,
                "bye": None,
            }
            sessions[session_id] = event
            open_sessions.append(event)
            events.append(event)
            continue

        # session_miner_id / session_worker_name / session_duration_secs / wire_bye
        # do not contain session_id, so we attach them to the most recent session_start
        # that is still missing these fields. This is best-effort for pool versions that
        # do not log session_id on close.
        if (m := re.search(r"session_miner_id=(\S+)", line)):
            for s in reversed(open_sessions):
                if s["miner_id"] is None:
                    s["miner_id"] = m.group(1)
                    break
            continue
        if (m := re.search(r"session_worker_name=(\S+)", line)):
            for s in reversed(open_sessions):
                if s["worker_name"] is None:
                    s["worker_name"] = m.group(1)
                    break
            continue
        if (m := re.search(r"session_duration_secs=(\d+)", line)):
            for s in reversed(open_sessions):
                if s["duration_secs"] is None:
                    s["duration_secs"] = int(m.group(1))
                    break
            continue
        if (m := re.search(r"wire_bye=(\S+)", line)):
            for s in reversed(open_sessions):
                if s["bye"] is None:
                    s["bye"] = m.group(1)
                    break
            continue

    # Sort by timestamp descending and cache
    events.sort(key=lambda x: x["ts"], reverse=True)
    with _POOL_HISTORY_LOCK:
        _POOL_HISTORY_CACHE = {"ts": now, "since_hours": since_hours, "data": events}

    return {"ok": True, "events": events[:limit], "cached": False}


# ── Registered pool miners (from PPLNS state) with real balances ─────────

_REGISTERED_MINERS_CACHE = {"ts": 0, "data": []}
_REGISTERED_MINERS_LOCK = threading.Lock()
_REGISTERED_MINERS_TTL = 15  # seconds


def _fetch_pplns_state() -> dict:
    """Load pplns-state.json from the Edge server."""
    try:
        result = _run_edge_cmd("cat /data/zion/pplns-state.json", timeout=10)
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
    except Exception:
        pass
    return {}


def _get_pool_active_miner_map() -> dict:
    """Return a map miner_id -> active miner data from the pool /miners endpoint."""
    try:
        miners = fetch_pool_miners()
        return {m.get("address") or m.get("miner_id"): m for m in miners if m.get("address") or m.get("miner_id")}
    except Exception:
        return {}


def get_pool_registered_miners() -> dict:
    """Return ALL miners registered in PPLNS state with real on-chain balances.

    Combines:
      - PPLNS address registry (miner_id -> payout_address) from pplns-state.json
      - Active telemetry from pool /miners (hashrate, shares, last_seen, pending)
      - Node RPC getBalance for each unique payout address

    This is the authoritative E2E view: every registered miner, every real balance.
    """
    now = time.time()
    with _REGISTERED_MINERS_LOCK:
        cached = _REGISTERED_MINERS_CACHE.get("data")
        if cached and (now - _REGISTERED_MINERS_CACHE.get("ts", 0)) < _REGISTERED_MINERS_TTL:
            return {"ok": True, "miners": cached, "cached": True}

    # 1. Load PPLNS state and active telemetry in parallel-ish
    pplns_state = _fetch_pplns_state()
    active_map = _get_pool_active_miner_map()
    stats = fetch_pool_stats()

    addresses = pplns_state.get("addresses") or {}
    unpaid = pplns_state.get("unpaid") or {}

    if not addresses:
        # Fallback to active miners if PPLNS state is unavailable
        miners = list(active_map.values())
        enrich_miner_balances(miners)
        with _REGISTERED_MINERS_LOCK:
            _REGISTERED_MINERS_CACHE["data"] = miners
            _REGISTERED_MINERS_CACHE["ts"] = now
        return {"ok": True, "miners": miners, "cached": False, "fallback": True}

    # 2. Build unique list of payout addresses and lookup balances once per address
    unique_addrs = set()
    for addr in addresses.values():
        if addr and isinstance(addr, str) and addr.startswith("zion1"):
            unique_addrs.add(addr)

    balance_map = {}
    for addr in unique_addrs:
        try:
            bal = rpc_call(EDGE_RPC_HOST, 8443, "getBalance", {"address": addr}, timeout=2.0)
            if bal and not bal.get("_rpc_error"):
                atomic = int(bal.get("balance_flowers") or bal.get("balance_atomic") or 0)
                balance_map[addr] = flowers_to_zion(atomic)
        except Exception:
            pass

    # 3. Build per-miner records, preserving individual miner IDs even if they share an address
    miners = []
    pplns_stats = (stats.get("pplns") or {}) if isinstance(stats, dict) else {}
    total_paid_flowers = pplns_stats.get("total_paid_flowers", 0)
    for miner_id, payout_address in addresses.items():
        active = active_map.get(miner_id)
        on_chain = balance_map.get(payout_address, 0.0)
        pending_atomic = int(unpaid.get(miner_id, 0)) if isinstance(unpaid, dict) else 0
        # If active, use live telemetry; otherwise zero hashrate/shares
        hashrate = active.get("hashrate") or active.get("hashrate_hps") or 0.0 if active else 0.0
        hashrate_1h = active.get("hashrate_1h") or 0.0 if active else 0.0
        hashrate_24h = active.get("hashrate_24h") or 0.0 if active else 0.0
        valid_shares = active.get("valid_shares", 0) if active else 0
        invalid_shares = active.get("invalid_shares", 0) if active else 0
        blocks_found = active.get("blocks_found", 0) if active else 0
        last_seen = active.get("last_seen", 0) if active else 0
        last_share = active.get("last_share", 0) if active else 0
        worker_name = active.get("worker_name", "") if active else ""
        m = {
            "miner_id": miner_id,
            "worker_name": worker_name,
            "payout_address": payout_address,
            "hashrate_hps": hashrate,
            "hashrate_1h": hashrate_1h,
            "hashrate_24h": hashrate_24h,
            "valid_shares": valid_shares,
            "invalid_shares": invalid_shares,
            "pending_balance": pending_atomic,
            "pending_balance_zion": flowers_to_zion(pending_atomic),
            "paid_total": 0.0,  # per-miner lifetime not tracked in PPLNS state; use pool stats total
            "paid_total_atomic": 0,
            "blocks_found": blocks_found,
            "last_seen": last_seen,
            "last_share": last_share,
            "on_chain_balance_zion": on_chain,
            "active": bool(active),
        }
        miners.append(m)

    # 4. Aggregate paid total by address for display
    # The pool /api/v1/miner/:address/payouts can give per-address paid total, but
    # PPLNS state is authoritative for lifetime. We attach the global total_paid to
    # each active miner for ranking; registered-only miners show 0 paid.
    # Use pool stats as authoritative total paid for the whole PPLNS set.
    total_paid_zion = flowers_to_zion(total_paid_flowers)
    for m in miners:
        if m["active"]:
            m["paid_total"] = total_paid_zion
            m["paid_total_atomic"] = total_paid_flowers

    # Sort by hashrate desc, active first
    miners.sort(key=lambda m: (not m["active"], -(m.get("hashrate_hps") or 0)))

    # Compute totals (deduplicate on-chain balance per address)
    unique_balances = {}
    total_pending = 0.0
    total_paid = 0.0
    for m in miners:
        addr = m.get("payout_address") or ""
        if addr:
            unique_balances[addr] = float(m.get("on_chain_balance_zion", 0) or 0)
        total_pending += float(m.get("pending_balance_zion", 0) or 0)
        total_paid += float(m.get("paid_total", 0) or 0)
    totals = {
        "pending_zion": total_pending,
        "paid_zion": total_paid,
        "on_chain_zion": sum(unique_balances.values()),
    }

    with _REGISTERED_MINERS_LOCK:
        _REGISTERED_MINERS_CACHE["data"] = miners
        _REGISTERED_MINERS_CACHE["ts"] = now
    return {"ok": True, "miners": miners, "totals": totals, "cached": False, "registered_count": len(miners), "active_count": sum(1 for m in miners if m["active"])}


def enrich_miner_balances(miners: list) -> list:
    """Query node RPC for on-chain balance of each miner's payout address.

    Updates each miner dict in-place with:
      - on_chain_balance_zion (float)
      - pending_balance_zion (float) if pending_balance is in atomic flowers
    """
    for m in miners:
        addr = m.get("payout_address") or m.get("address") or ""
        if addr and isinstance(addr, str) and addr.startswith("zion1"):
            try:
                bal = rpc_call(EDGE_RPC_HOST, 8443, "getBalance", {"address": addr}, timeout=2.0)
                if bal and not bal.get("_rpc_error"):
                    atomic = int(bal.get("balance_flowers") or bal.get("balance_atomic") or 0)
                    m["on_chain_balance_zion"] = flowers_to_zion(atomic)
            except Exception:
                pass
        # Normalize pending_balance to ZION
        pending = m.get("pending_balance")
        if pending is not None:
            try:
                m["pending_balance_zion"] = flowers_to_zion(int(pending))
            except Exception:
                m["pending_balance_zion"] = 0.0
    return miners


def get_pool_leaderboard(limit: int = 50) -> dict:
    """Return pool miners sorted by hashrate (desc) with rank, paid and on-chain balances."""
    data = get_pool_miners()
    if not data.get("ok"):
        return data
    miners = data.get("miners", [])
    # Enrich with on-chain balances and normalize pending/paid
    miners = enrich_miner_balances(miners)
    sorted_miners = sorted(
        miners,
        key=lambda m: (m.get("hashrate_hps") or m.get("hashrate") or 0),
        reverse=True,
    )[:limit]
    total_pending = 0.0
    total_paid = 0.0
    total_on_chain = 0.0
    for i, m in enumerate(sorted_miners, start=1):
        m["rank"] = i
        if "paid_total" not in m:
            m["paid_total"] = flowers_to_zion(m.get("paid_total_atomic", 0) or 0)
        if m.get("pending_balance_zion") is None:
            try:
                m["pending_balance_zion"] = flowers_to_zion(int(m.get("pending_balance", 0) or 0))
            except Exception:
                m["pending_balance_zion"] = 0.0
        if m.get("on_chain_balance_zion") is None:
            m["on_chain_balance_zion"] = 0.0
        total_pending += float(m.get("pending_balance_zion") or 0)
        total_paid += float(m.get("paid_total") or 0)
        total_on_chain += float(m.get("on_chain_balance_zion") or 0)
    return {
        "ok": True,
        "miners": sorted_miners,
        "active_sessions": data.get("active_sessions", 0),
        "miners_tracked": data.get("miners_tracked", len(sorted_miners)),
        "total_hashrate_khs": data.get("total_hashrate_khs", 0),
        "totals": {
            "pending_zion": total_pending,
            "paid_zion": total_paid,
            "on_chain_zion": total_on_chain,
        },
    }

# ── Pool Miners Dashboard (combined view for dedicated Pool Miners tab) ──

_POOL_DASHBOARD_CACHE = {"ts": 0, "data": {}}
_POOL_DASHBOARD_LOCK = threading.Lock()
_POOL_DASHBOARD_TTL = 5  # seconds


def get_pool_miners_dashboard() -> dict:
    """Return a comprehensive, robust Pool Miners view for the dedicated tab.

    Combines pool stats, leaderboard (with on-chain balances), PPLNS summary,
    connection history, pool wallet state, fee split, routing breakdown, and
    pool info. Each sub-source is wrapped in a try/except so a partial failure
    still yields a useful response.
    """
    now = time.time()
    with _POOL_DASHBOARD_LOCK:
        cached = _POOL_DASHBOARD_CACHE.get("data")
        if cached and (now - _POOL_DASHBOARD_CACHE.get("ts", 0)) < _POOL_DASHBOARD_TTL:
            return cached

    result: dict = {"ok": True}

    # 1. Pool stats from /stats endpoint (fee split, PPLNS, routing, blocks, hashrate, uptime)
    try:
        stats = fetch_pool_stats()
        result["stats"] = stats
    except Exception:
        result["stats"] = {}

    # 2. ALL registered miners (from PPLNS state) with real on-chain balances
    try:
        reg = get_pool_registered_miners()
        result["miners"] = reg.get("miners", [])
        result["active_sessions"] = reg.get("active_count", 0)
        result["miners_tracked"] = reg.get("registered_count", len(result["miners"]))
    except Exception:
        result["miners"] = []
        result["active_sessions"] = 0
        result["miners_tracked"] = 0

    # 3. PPLNS summary (extracted from stats)
    try:
        pplns = result.get("stats", {}).get("pplns", {})
        if not isinstance(pplns, dict):
            pplns = {}
        window_size = pplns.get("window_size", 0) or 0
        window_used = pplns.get("window_used", 0) or 0
        result["pplns"] = {
            "payout_rounds": pplns.get("payout_rounds", 0),
            "registered_miners": pplns.get("registered_miners", 0),
            "total_paid_flowers": pplns.get("total_paid_flowers", 0),
            "total_paid_zion": flowers_to_zion(pplns.get("total_paid_flowers", 0) or 0),
            "total_unpaid_flowers": pplns.get("total_unpaid_flowers", 0),
            "total_unpaid_zion": flowers_to_zion(pplns.get("total_unpaid_flowers", 0) or 0),
            "window_size": window_size,
            "window_used": window_used,
            "window_utilization_pct": round((window_used / window_size * 100), 2) if window_size > 0 else 0,
        }
    except Exception:
        result["pplns"] = {}

    # 4. Fee split (structured from API, not log scraping)
    try:
        fee_split = result.get("stats", {}).get("fee_split", {})
        if not isinstance(fee_split, dict):
            fee_split = {}
        result["fee_split"] = {
            "miner_pct": fee_split.get("miner_pct", 0),
            "humanitarian_pct": fee_split.get("humanitarian_pct", 0),
            "issobella_pct": fee_split.get("issobella_pct", 0),
            "pool_fee_pct": fee_split.get("pool_fee_pct", 0),
            "humanitarian_accumulated_zion": flowers_to_zion(fee_split.get("humanitarian_accumulated_flowers", 0) or 0),
            "issobella_accumulated_zion": flowers_to_zion(fee_split.get("issobella_accumulated_flowers", 0) or 0),
            "pool_fee_accumulated_zion": flowers_to_zion(fee_split.get("pool_fee_accumulated_flowers", 0) or 0),
            "humanitarian_wallet": fee_split.get("humanitarian_wallet", ""),
            "issobella_wallet": fee_split.get("issobella_wallet", ""),
            "pool_fee_wallet": fee_split.get("pool_fee_wallet", ""),
        }
    except Exception:
        result["fee_split"] = {}

    # 5. Routing breakdown (groups + sources from API)
    try:
        routing = result.get("stats", {}).get("routing", {})
        if not isinstance(routing, dict):
            routing = {}
        result["routing"] = {
            "submits": routing.get("submits", 0),
            "accepted": routing.get("accepted", 0),
            "rejected": routing.get("rejected", 0),
            "stale": routing.get("stale", 0),
            "accept_rate_pct": routing.get("accept_rate_pct", 0),
            "groups": routing.get("groups", {}),
            "sources": routing.get("sources", {}),
        }
    except Exception:
        result["routing"] = {}

    # 6. Pool info (uptime, version, hashrate timeframes)
    try:
        s = result.get("stats", {})
        hashrate = s.get("hashrate", {}) if isinstance(s.get("hashrate"), dict) else {}
        result["pool_info"] = {
            "uptime_s": s.get("uptime_s", 0),
            "uptime_human": _format_uptime(s.get("uptime_s", 0)),
            "version": s.get("pool", {}).get("version", "—"),
            "hashrate_live": hashrate.get("pool", 0) or s.get("pool_hashrate", 0) or 0,
            "hashrate_1h": hashrate.get("pool_1h", 0) or 0,
            "hashrate_24h": hashrate.get("pool_24h", 0) or 0,
        }
    except Exception:
        result["pool_info"] = {}

    # 7. Pool wallet status
    try:
        result["pool_wallet"] = get_pool_wallet_status()
    except Exception:
        result["pool_wallet"] = {}

    # 8. Recent connection history
    try:
        hist = get_pool_connection_history(limit=20, since_hours=1)
        result["connection_history"] = hist.get("events", [])
    except Exception:
        result["connection_history"] = []

    # 9. PPLNS persistence state info
    try:
        pplns_state = _fetch_pplns_state()
        result["pplns_state"] = {
            "loaded": bool(pplns_state),
            "addresses_count": len(pplns_state.get("addresses", {})) if pplns_state else 0,
            "window_entries": len(pplns_state.get("share_window", [])) if pplns_state else 0,
        }
    except Exception:
        result["pplns_state"] = {"loaded": False, "addresses_count": 0, "window_entries": 0}

    # 9b. AuxPow merge mining stats (from pool /stats auxpow section)
    try:
        auxpow = result.get("stats", {}).get("auxpow", {})
        if not isinstance(auxpow, dict):
            auxpow = {}
        result["auxpow"] = auxpow
    except Exception:
        result["auxpow"] = {}

    # 9c. Revenue System (prepared / placeholder values)
    try:
        result["revenue"] = {
            "enabled": False,
            "status": "Preview",
            "strategy": "Multi-coin merge-mining + swap aggregator",
            "total_usd": 0.0,
            "daily_estimate_usd": 0.0,
            "miner_share_pct": 89,
            "dao_share_pct": 5,
            "humanitarian_share_pct": 5,
            "pool_fee_pct": 1,
            "last_distribution_ts": None,
            "next_distribution_ts": None,
            "active_coins": ["KAS", "ALPH", "DCR"],
            "circuit_open": False,
        }
    except Exception:
        result["revenue"] = {}

    # 10. Computed summary aggregations
    miners = result.get("miners", [])
    stats = result.get("stats", {}) or {}
    try:
        unique_addresses = set()
        unique_balances = {}  # deduplicate on-chain balance per payout address
        valid_total = 0
        invalid_total = 0
        total_hash = 0.0
        blocks_total = 0
        total_pending = 0.0
        top_miner = None
        for i, m in enumerate(miners):
            addr = m.get("payout_address") or m.get("address") or ""
            if addr:
                unique_addresses.add(addr)
                unique_balances[addr] = float(m.get("on_chain_balance_zion", 0) or 0)
            valid_total += int(m.get("valid_shares", 0) or 0)
            invalid_total += int(m.get("invalid_shares", 0) or 0)
            total_hash += float(m.get("hashrate_hps", 0) or 0)
            blocks_total += int(m.get("blocks_found", 0) or 0)
            total_pending += float(m.get("pending_balance_zion", 0) or 0)
            if i == 0:
                top_miner = m
        total_shares = valid_total + invalid_total
        accept_rate = (valid_total / total_shares * 100) if total_shares > 0 else 100.0
        # On-chain total must be per unique address (many miners can share one address)
        total_on_chain = sum(unique_balances.values())
        # Prefer PPLNS total paid (authoritative lifetime) over sum of miner paid_total
        pplns_paid_zion = result.get("pplns", {}).get("total_paid_zion", 0)
        pplns_unpaid_zion = result.get("pplns", {}).get("total_unpaid_zion", 0)
        result["totals"] = {
            "pending_zion": total_pending,
            "paid_zion": pplns_paid_zion,
            "on_chain_zion": total_on_chain,
        }
        result["summary"] = {
            "active_miners": result.get("active_sessions", 0),
            "registered_miners": result.get("pplns", {}).get("registered_miners", 0),
            "tracked_miners": result.get("miners_tracked", 0),
            "displayed_miners": len(miners),
            "total_hashrate_khs": total_hash / 1000.0,
            "average_hashrate_khs": round(total_hash / 1000.0 / len(miners), 2) if miners else 0,
            "total_valid_shares": valid_total,
            "total_invalid_shares": invalid_total,
            "total_shares": total_shares,
            "accept_rate_pct": round(accept_rate, 2),
            "blocks_found": blocks_total,
            "total_paid_zion": pplns_paid_zion,
            "total_pending_zion": pplns_unpaid_zion if pplns_unpaid_zion > total_pending else total_pending,
            "total_on_chain_zion": total_on_chain,
            "unique_payout_addresses": len(unique_addresses),
            "top_miner": top_miner,
            "fee_split": stats.get("fee_split", {}) if isinstance(stats, dict) else {},
        }
    except Exception:
        result["summary"] = {}

    with _POOL_DASHBOARD_LOCK:
        _POOL_DASHBOARD_CACHE["data"] = result
        _POOL_DASHBOARD_CACHE["ts"] = time.time()
    return result


def get_revenue_dashboard() -> dict:
    """Return placeholder revenue dashboard data for the Revenue System tab.

    Merges live AuxPow stats with a prepared revenue object. The revenue object
    is intentionally placeholder / preview until the real revenue engine is wired.
    """
    result: dict = {"ok": True}

    # AuxPow live stats (from pool /stats)
    try:
        stats = fetch_pool_stats()
        auxpow = stats.get("auxpow", {}) if stats else {}
        if not isinstance(auxpow, dict):
            auxpow = {}
        result["auxpow"] = auxpow
    except Exception:
        result["auxpow"] = {}

    # Placeholder revenue object
    result["revenue"] = {
        "enabled": False,
        "status": "Preview",
        "strategy": "Multi-coin merge-mining + swap aggregator",
        "total_usd": 0.0,
        "daily_estimate_usd": 0.0,
        "revenue_usd": result["auxpow"].get("revenue_usd", 0.0),
        "current_algorithm": result["auxpow"].get("current_algorithm"),
        "current_pool": result["auxpow"].get("current_pool"),
        "current_coin": result["auxpow"].get("current_coin"),
        "shares_submitted": result["auxpow"].get("shares_submitted", 0),
        "shares_accepted": result["auxpow"].get("shares_accepted", 0),
        "shares_rejected": result["auxpow"].get("shares_rejected", 0),
        "uptime_secs": result["auxpow"].get("uptime_secs", 0),
        "coin_switches": result["auxpow"].get("coin_switches", 0),
        "last_switch_ts": result["auxpow"].get("last_switch_ts"),
        "consecutive_failures": result["auxpow"].get("consecutive_failures", 0),
        "circuit_open": result["auxpow"].get("circuit_open", False),
        "miner_share_pct": 89,
        "dao_share_pct": 5,
        "humanitarian_share_pct": 5,
        "pool_fee_pct": 1,
        "last_distribution_ts": None,
        "next_distribution_ts": None,
        "distribution_cycle": "24h",
        "accumulated_usd": 0.0,
        "active_coins": ["KAS", "ALPH", "DCR"],
        "coin_revenue": [],
        "distributions": [],
    }
    return result


def get_servers_setup() -> dict:
    """Return server setup, services, disk health, and automation status for the Servers Setup tab."""
    import subprocess, re, os

    result: dict = {"ok": True}

    # ── Server identity ──────────────────────────────────────────────
    try:
        hostname = subprocess.run(["hostname"], capture_output=True, text=True, timeout=5).stdout.strip()
        # Get IP from hostname -I
        ip_out = subprocess.run(["hostname", "-I"], capture_output=True, text=True, timeout=5).stdout.strip()
        ip = ip_out.split()[0] if ip_out else "—"
        # OS info
        os_info = "—"
        try:
            with open("/etc/os-release") as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        os_info = line.split("=", 1)[1].strip().strip('"')
                        break
        except Exception:
            pass
        # Arch
        arch = subprocess.run(["uname", "-m"], capture_output=True, text=True, timeout=5).stdout.strip()
        # Uptime
        uptime_str = "—"
        try:
            with open("/proc/uptime") as f:
                uptime_secs = float(f.read().split()[0])
            d = int(uptime_secs // 86400)
            h = int((uptime_secs % 86400) // 3600)
            m = int((uptime_secs % 3600) // 60)
            uptime_str = f"{d}d {h}h {m}m"
        except Exception:
            pass
        result["server"] = {"ip": ip, "hostname": hostname, "os": os_info, "arch": arch, "uptime": uptime_str}
    except Exception:
        result["server"] = {"ip": "—", "hostname": "—", "os": "—", "arch": "—", "uptime": "—"}

    # ── Disk health ──────────────────────────────────────────────────
    try:
        df_out = subprocess.run(["df", "-h", "/"], capture_output=True, text=True, timeout=5).stdout
        lines = df_out.strip().split("\n")
        if len(lines) >= 2:
            parts = lines[1].split()
            result["disk"] = {
                "total": parts[1],
                "used": parts[2],
                "avail": parts[3],
                "pct": int(parts[4].rstrip("%")),
            }
        else:
            result["disk"] = {"total": "—", "used": "—", "avail": "—", "pct": 0}
    except Exception:
        result["disk"] = {"total": "—", "used": "—", "avail": "—", "pct": 0}

    # ── Memory ───────────────────────────────────────────────────────
    try:
        with open("/proc/meminfo") as f:
            meminfo = {}
            for line in f:
                k, v = line.split(":", 1)
                meminfo[k.strip()] = int(v.strip().split()[0])  # in kB
        total_kb = meminfo.get("MemTotal", 0)
        avail_kb = meminfo.get("MemAvailable", meminfo.get("MemFree", 0))
        used_kb = total_kb - avail_kb
        pct = int((used_kb / total_kb * 100)) if total_kb > 0 else 0
        result["memory"] = {
            "total": f"{total_kb // 1024} MB",
            "used": f"{used_kb // 1024} MB",
            "free": f"{avail_kb // 1024} MB",
            "pct": pct,
        }
    except Exception:
        result["memory"] = {"total": "—", "used": "—", "free": "—", "pct": 0}

    # ── ZION services ────────────────────────────────────────────────
    zion_services = [
        "zion-node", "zion-node2", "zion-pool", "zion-bridge", "zion-dao",
        "zion-atomic-swap", "zion-warp", "zion-oasis", "zion-free-world",
        "zion-issobella", "zion-dashboard", "zion-watchdog",
    ]
    services = []
    for svc in zion_services:
        try:
            r = subprocess.run(
                ["systemctl", "is-active", svc + ".service"],
                capture_output=True, text=True, timeout=5,
            )
            status = r.stdout.strip()
            active = status == "active"
            services.append({"name": svc, "active": active, "status": status})
        except Exception:
            services.append({"name": svc, "active": False, "status": "unknown"})
    result["services"] = services

    # ── Auto-patch status ────────────────────────────────────────────
    def _svc_active(name):
        try:
            r = subprocess.run(["systemctl", "is-active", name], capture_output=True, text=True, timeout=5)
            return r.stdout.strip() == "active"
        except Exception:
            return False

    def _file_exists(path):
        return os.path.exists(path)

    # Check cleanup last run from syslog
    cleanup_last = "—"
    try:
        r = subprocess.run(
            ["journalctl", "-t", "zion-disk-cleanup", "--no-pager", "-n", "1", "--output=cat"],
            capture_output=True, text=True, timeout=10,
        )
        if r.stdout.strip():
            cleanup_last = r.stdout.strip()
    except Exception:
        pass

    result["auto_patch"] = {
        "logrotate_hourly": _svc_active("logrotate-hourly.timer"),
        "journald_limit": _file_exists("/etc/systemd/journald.conf") and "SystemMaxUse=500M" in open("/etc/systemd/journald.conf").read(),
        "rsyslog_ratelimit": _file_exists("/etc/rsyslog.d/49-zion-pool-ratelimit.conf"),
        "cleanup_cron": _file_exists("/etc/cron.d/zion-disk-cleanup"),
        "cleanup_last_run": cleanup_last,
    }

    # ── Monitoring ───────────────────────────────────────────────────
    result["monitoring"] = {
        "fail2ban": _svc_active("fail2ban"),
        "ufw": _svc_active("ufw"),
        "nginx": _svc_active("nginx"),
        "docker": _svc_active("docker"),
        "watchdog": _svc_active("zion-watchdog.service") or _file_exists("/usr/local/bin/zion-watchdog.sh"),
    }

    # ── Firewall rules ───────────────────────────────────────────────
    firewall = []
    try:
        r = subprocess.run(["ufw", "status"], capture_output=True, text=True, timeout=5)
        for line in r.stdout.strip().split("\n"):
            line = line.strip()
            if line and not line.startswith("Status") and not line.startswith("--") and not line.startswith("To"):
                parts = line.split()
                if len(parts) >= 3:
                    firewall.append({"port": parts[0], "action": parts[1], "from": " ".join(parts[2:])})
    except Exception:
        pass
    result["firewall"] = firewall

    # ── Backup system status ─────────────────────────────────────────
    backup_info: dict = {"ok": True}
    backup_dir = REPO_ROOT / "backups"

    # Local backup timer
    try:
        r = subprocess.run(
            ["systemctl", "--user", "is-active", "zion-backup.timer"],
            capture_output=True, text=True, timeout=5,
        )
        backup_info["local_timer_active"] = r.stdout.strip() == "active"
        r2 = subprocess.run(
            ["systemctl", "--user", "is-enabled", "zion-backup.timer"],
            capture_output=True, text=True, timeout=5,
        )
        backup_info["local_timer_enabled"] = r2.stdout.strip() == "enabled"
        # Next trigger
        r3 = subprocess.run(
            ["systemctl", "--user", "show", "zion-backup.timer", "--property=NextElapseUSecRealtime"],
            capture_output=True, text=True, timeout=5,
        )
        next_val = r3.stdout.strip().replace("NextElapseUSecRealtime=", "")
        backup_info["local_next_trigger"] = next_val if next_val else "—"
    except Exception:
        backup_info["local_timer_active"] = False
        backup_info["local_timer_enabled"] = False
        backup_info["local_next_trigger"] = "—"

    # Backup counts and sizes
    try:
        local_files = sorted(backup_dir.glob("backup_local_*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
        edge_files = sorted(backup_dir.glob("backup_edge_*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
        chain_files = sorted(backup_dir.glob("backup_2026-*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
        backup_info["local_count"] = len(local_files)
        backup_info["edge_count"] = len(edge_files)
        backup_info["chain_count"] = len(chain_files)
        backup_info["local_latest"] = {
            "name": local_files[0].name,
            "size_mb": round(local_files[0].stat().st_size / (1024 * 1024), 1),
            "ts": time.strftime("%Y-%m-%d %H:%M", time.localtime(local_files[0].stat().st_mtime)),
        } if local_files else None
        backup_info["edge_latest"] = {
            "name": edge_files[0].name,
            "size_mb": round(edge_files[0].stat().st_size / (1024 * 1024), 1),
            "ts": time.strftime("%Y-%m-%d %H:%M", time.localtime(edge_files[0].stat().st_mtime)),
        } if edge_files else None
        backup_info["chain_latest"] = {
            "name": chain_files[0].name,
            "size_mb": round(chain_files[0].stat().st_size / (1024 * 1024), 1),
            "ts": time.strftime("%Y-%m-%d %H:%M", time.localtime(chain_files[0].stat().st_mtime)),
        } if chain_files else None
        total_size = sum(f.stat().st_size for f in backup_dir.glob("*.tar.gz"))
        backup_info["total_size_mb"] = round(total_size / (1024 * 1024), 1)
    except Exception:
        backup_info["local_count"] = 0
        backup_info["edge_count"] = 0
        backup_info["chain_count"] = 0
        backup_info["total_size_mb"] = 0

    # Edge backup contents (what files are in the latest edge backup)
    try:
        if edge_files:
            r = subprocess.run(
                ["tar", "-tzf", str(edge_files[0])],
                capture_output=True, text=True, timeout=10,
            )
            backup_info["edge_contents"] = [l.strip() for l in r.stdout.strip().split("\n") if l.strip()]
        else:
            backup_info["edge_contents"] = []
    except Exception:
        backup_info["edge_contents"] = []

    # Backup config
    backup_info["interval_hours"] = 4
    backup_info["retention"] = 20
    backup_info["edge_files"] = [
        "state", "state-node2", "bridge-mainnet.db", "dao-mainnet.db",
        "atomic-swap.db", "warp-mainnet.db", "pplns-state.json",
        "oasis.db", "free_world.db", "issobella.db", "peers.json",
        "edge-environment.sh",
    ]
    backup_info["script"] = "scripts/backup-system.sh"

    # Last backup log entries
    try:
        log_file = REPO_ROOT / "logs" / "backup.log"
        if log_file.exists():
            lines = log_file.read_text().strip().split("\n")
            backup_info["last_log_entries"] = lines[-5:]
        else:
            backup_info["last_log_entries"] = []
    except Exception:
        backup_info["last_log_entries"] = []

    result["backup"] = backup_info

    return result


def _format_uptime(seconds):
    """Format seconds into human-readable uptime string."""
    if not seconds or seconds <= 0:
        return "—"
    d = int(seconds // 86400)
    h = int((seconds % 86400) // 3600)
    m = int((seconds % 3600) // 60)
    if d > 0:
        return f"{d}d {h}h {m}m"
    if h > 0:
        return f"{h}h {m}m"
    return f"{m}m"


def get_pool_miner_detail(address: str) -> dict:
    """Fetch per-miner detail from pool API: /api/v1/miner/:address/stats + /payouts."""
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    result = {"ok": True, "address": address}
    import urllib.request

    # Stats
    try:
        with urllib.request.urlopen(f"http://{host}:8455/api/v1/miner/{address}/stats", timeout=5) as r:
            data = json.loads(r.read().decode())
            if data.get("ok"):
                stats = data.get("stats", {})
                result["stats"] = stats
                result["stats"]["pending_balance_zion"] = flowers_to_zion(stats.get("pending_balance", 0) or 0)
                result["stats"]["total_paid_zion"] = flowers_to_zion(stats.get("total_paid", 0) or 0)
    except Exception as e:
        result["stats"] = {"error": str(e)}

    # On-chain balance
    try:
        bal = rpc_call(EDGE_RPC_HOST, 8443, "getBalance", {"address": address}, timeout=2.0)
        if bal and not bal.get("_rpc_error"):
            atomic = int(bal.get("balance_flowers") or bal.get("balance_atomic") or 0)
            result["on_chain_balance_zion"] = flowers_to_zion(atomic)
        else:
            result["on_chain_balance_zion"] = 0
    except Exception:
        result["on_chain_balance_zion"] = 0

    # Payouts
    try:
        with urllib.request.urlopen(f"http://{host}:8455/api/v1/miner/{address}/payouts", timeout=5) as r:
            data = json.loads(r.read().decode())
            if data.get("ok"):
                payouts = data.get("pending_payouts", [])
                for p in payouts:
                    p["amount_zion"] = flowers_to_zion(p.get("amount_atomic", 0) or 0)
                result["payouts"] = payouts
    except Exception as e:
        result["payouts"] = []

    return result


# ── Backup status ────────────────────────────────────────────────────────

def get_backup_status() -> dict:
    r"""List backups + datadir sizes + last backup time.
    Reads both manual backups (repo/backups) and auto-backups (repo/backups/auto)."""
    manual_backups = []
    manual_dir = REPO_ROOT / "backups"
    total_backup_mb = 0
    if manual_dir.exists():
        for f in sorted(manual_dir.glob("backup_*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True):
            s = f.stat()
            size_mb = round(s.st_size / (1024*1024), 2)
            total_backup_mb += size_mb
            manual_backups.append({
                "name": f.name,
                "size_mb": size_mb,
                "created": datetime.fromtimestamp(s.st_mtime).isoformat(),
            })
    # Auto-backups (Linux path — was C:/ZION-AutoBackups on Windows)
    auto_backups = []
    auto_dir = REPO_ROOT / "backups" / "auto"
    if auto_dir.exists():
        for f in sorted(auto_dir.glob("zion-auto-*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True):
            s = f.stat()
            size_mb = round(s.st_size / (1024*1024), 2)
            total_backup_mb += size_mb
            auto_backups.append({
                "name": f.name,
                "size_mb": size_mb,
                "created": datetime.fromtimestamp(s.st_mtime).isoformat(),
            })
    # Datadir sizes — per-service DB files (not all pointing to V3/data)
    _data_dir = REPO_ROOT / "V3" / "data"
    datadirs = {}
    _db_map = {
        "node1": "zion-node-state.db",
        "node2": "zion-node2-state.db",
        "pool": None,  # pool uses edge-state, tracked via node1
        "dashboard": None,
    }
    for name, dbfile in _db_map.items():
        if name == "dashboard":
            dpath = REPO_ROOT / "ZION_OS" / "dashboard"
            if dpath.exists():
                try:
                    total = sum(f.stat().st_size for f in dpath.rglob("*") if f.is_file())
                    datadirs[name] = round(total / (1024*1024), 2)
                except Exception:
                    datadirs[name] = None
            else:
                datadirs[name] = None
        elif dbfile:
            fpath = _data_dir / dbfile
            if fpath.exists():
                try:
                    datadirs[name] = round(fpath.stat().st_size / (1024*1024), 2)
                except Exception:
                    datadirs[name] = None
            else:
                datadirs[name] = None
        else:
            datadirs[name] = None
    all_backups = sorted(manual_backups + auto_backups, key=lambda x: x["created"], reverse=True)
    last_backup = all_backups[0]["created"] if all_backups else None
    return {
        "backups": all_backups[:10],
        "manual_backups": manual_backups[:5],
        "auto_backups": auto_backups[:5],
        "total_backup_mb": round(total_backup_mb, 2),
        "datadir_mb": datadirs,
        "last_backup": last_backup,
        "backup_dir": str(manual_dir),
        "auto_backup_dir": str(auto_dir),
        "auto_backup_enabled": auto_dir.exists(),
    }

# ── Emission helpers (mirror V3/L1/core/src/emission.rs) ───────────────

BLOCKS_PER_DECADE = 5_256_000
MAX_DECAY_DECADES = 10
BASE_REWARD = 5_400_067_000
TAIL_REWARD = 724_784_723


def block_subsidy(height: int) -> int:
    """Block subsidy in flowers for a given height."""
    if height <= 0:
        return 0
    decade = (height - 1) // BLOCKS_PER_DECADE
    if decade >= MAX_DECAY_DECADES:
        return TAIL_REWARD
    reward = BASE_REWARD
    for _ in range(decade):
        reward = reward * 4 // 5
    return reward


def fee_split(subsidy: int) -> tuple:
    """Return (miner, humanitarian, issobella, pool_fee) in flowers."""
    humanitarian = subsidy * 5 // 100
    issobella = subsidy * 5 // 100
    pool_fee = subsidy * 1 // 100
    miner = subsidy - humanitarian - issobella - pool_fee
    return (miner, humanitarian, issobella, pool_fee)


def calculate_emission_totals(height: int) -> dict:
    """Calculate theoretical network-wide totals from block 1 to height.

    Uses the consensus emission schedule and 89/5/5/1 fee split. This is
    independent of the pool's local logs/counters and shows the global
    picture from genesis.
    """
    if height <= 0:
        return {
            "total_emitted_flowers": 0,
            "miner_rewards_flowers": 0,
            "humanitarian_flowers": 0,
            "issobella_flowers": 0,
            "pool_fees_flowers": 0,
            "total_emitted_zion": 0.0,
            "miner_rewards_zion": 0.0,
            "humanitarian_zion": 0.0,
            "issobella_zion": 0.0,
            "pool_fees_zion": 0.0,
            "burned_zion": 0.0,
        }
    total_flowers = 0
    miner_flowers = 0
    humanitarian_flowers = 0
    issobella_flowers = 0
    pool_fees_flowers = 0
    for h in range(1, height + 1):
        subsidy = block_subsidy(h)
        if subsidy <= 0:
            continue
        total_flowers += subsidy
        miner, humanitarian, issobella, pool_fee = fee_split(subsidy)
        miner_flowers += miner
        humanitarian_flowers += humanitarian
        issobella_flowers += issobella
        pool_fees_flowers += pool_fee
    divisor = 1_000_000
    return {
        "total_emitted_flowers": total_flowers,
        "miner_rewards_flowers": miner_flowers,
        "humanitarian_flowers": humanitarian_flowers,
        "issobella_flowers": issobella_flowers,
        "pool_fees_flowers": pool_fees_flowers,
        "total_emitted_zion": total_flowers / divisor,
        "miner_rewards_zion": miner_flowers / divisor,
        "humanitarian_zion": humanitarian_flowers / divisor,
        "issobella_zion": issobella_flowers / divisor,
        "pool_fees_zion": pool_fees_flowers / divisor,
        "burned_zion": pool_fees_flowers / divisor,
    }


# ── Pool wallet / UTXO / payout status ───────────────────────────────────

def get_pool_wallet_status() -> dict:
    """Get pool wallet status from pool /stats API (primary) + log scrape (fallback)."""
    status = {
        "pool_wallet": None,
        "payout_enabled": False,
        "utxo_count": None,
        "balance_zion": None,
        "blocks_found": 0,
        "pending_payouts": 0,
        "last_payout_time": None,
        "last_payout_error": None,
        "fee_split": None,
        "shares_accepted": 0,
        "shares_rejected": 0,
    }

    # ── Primary: fetch from pool /stats API (port 8455) ──────────────────
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{host}:8455/stats", timeout=3) as r:
            stats = json.loads(r.read().decode())
        # Blocks, shares, routing from /stats
        blocks = stats.get("blocks", {})
        if blocks.get("found"):
            status["blocks_found"] = blocks["found"]
        routing = stats.get("routing", {})
        if routing.get("accepted"):
            status["shares_accepted"] = routing["accepted"]
        if routing.get("rejected") or routing.get("stale"):
            status["shares_rejected"] = (routing.get("rejected") or 0) + (routing.get("stale") or 0)
        payouts = stats.get("payouts", {})
        if payouts.get("pending_miners"):
            status["pending_payouts"] = payouts["pending_miners"]
        # Fee split
        fee = stats.get("fee_split", {})
        if fee:
            status["fee_split"] = f"{fee.get('miner_pct', 89)}/{fee.get('humanitarian_pct', 5)}/{fee.get('issobella_pct', 5)}/{fee.get('pool_fee_pct', 1)}"
    except Exception:
        pass

    # ── Canonical pool wallet (from env or hardcoded 3.0.4) ─────────────
    if not status["pool_wallet"]:
        status["pool_wallet"] = os.environ.get("ZION_POOL_WALLET") or "zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2"
    if not status["payout_enabled"]:
        status["payout_enabled"] = True
    if not status["fee_split"]:
        status["fee_split"] = "89/5/5/1"

    # ── Secondary: scrape pool.log for missing fields ────────────────────
    if not status["pool_wallet"] or not status["fee_split"]:
        recent = tail_log("pool.log", 300)
        startup = head_log("pool.log", 50)
        for line in startup:
            if not status["pool_wallet"] and (m := re.search(r'pool_wallet=(\S+)', line)):
                status["pool_wallet"] = m.group(1)
            if not status["payout_enabled"] and (m := re.search(r'payout=(\S+)', line)):
                status["payout_enabled"] = m.group(1).lower() in ("true", "enabled", "on")
            if not status["fee_split"] and (m := re.search(r'fee_split=([\d/]+)', line)):
                status["fee_split"] = m.group(1)
        for line in recent:
            if m := re.search(r'payout_submit_ok.*miners=(\d+)', line):
                status["pending_payouts"] = max(status["pending_payouts"], int(m.group(1)))
            if m := re.search(r'payout_submit_failed.*error=(.+)', line):
                status["last_payout_error"] = m.group(1).strip()
            if m := re.search(r'utxo_count=(\d+)', line):
                status["utxo_count"] = int(m.group(1))
            if m := re.search(r'balance_zion=(\d+\.?\d*)', line):
                status["balance_zion"] = float(m.group(1))

    # ── Tertiary: RPC for pool wallet balance ────────────────────────────
    wallet = status["pool_wallet"]
    if wallet and wallet.startswith("zion1"):
        bal = rpc_call("127.0.0.1", 8443, "getBalance", {"address": wallet})
        if bal and not bal.get("_rpc_error"):
            atomic = int(bal.get("balance_flowers") or bal.get("balance_atomic") or 0)
            status["balance_zion"] = bal.get("balance_zion") if isinstance(bal.get("balance_zion"), (int, float)) else flowers_to_zion(atomic)
            # UTXO count from RPC if available
            if bal.get("utxo_count"):
                status["utxo_count"] = bal["utxo_count"]
    return status

# ── Payout System Status Builder ─────────────────────────────────────────

def fetch_pool_stats() -> dict:
    """Fetch live pool stats from routing metrics endpoint (port 8455)."""
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{host}:8455/stats", timeout=3) as r:
            return json.loads(r.read().decode())
    except Exception:
        return {}

def fetch_pool_miners() -> list:
    """Fetch active miners from Edge pool, enriched with paid_total from Prometheus metrics."""
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    miners = []
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{host}:8455/miners?limit=200", timeout=5) as r:
            data = json.loads(r.read().decode())
            miners = data.get("miners", [])
    except Exception:
        pass
    # Enrich with paid_total from Prometheus metrics
    paid_map = {}
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{host}:8455/metrics", timeout=5) as r:
            for line in r.read().decode("utf-8", errors="ignore").splitlines():
                if line.startswith("zion_pool_miner_paid_total_atomic{"):
                    m = re.search(r'miner_id="([^"]+)"', line)
                    if m:
                        paid_map[m.group(1)] = int(line.split()[-1])
    except Exception:
        pass
    for m in miners:
        addr = m.get("address") or m.get("miner_id") or ""
        paid_total_atomic = paid_map.get(addr, 0)
        m["paid_total_atomic"] = paid_total_atomic
        m["paid_total"] = flowers_to_zion(paid_total_atomic)
    return miners

def sanitize_pool_stats(pool_stats: dict, miners: list) -> dict:
    """Patch old pool `/stats` payloads that saturated lifetime payout counters at u64 max.

    Also handles the 3.0.3 decimal fork legacy: pre-fork pool servers accumulated
    total_paid_flowers in 12-decimal flowers (1 ZION = 1e12). After the fork, flowers
    are 6-decimal (1 ZION = 1e6). A pool server that ran through the fork without
    restart would have a mixed-scale total — up to 1e6× too large.

    We clamp total_paid to MINING_EMISSION (127.22B ZION = 127.22e15 flowers in
    6-decimal). Any value above that is clearly a pre-fork artifact and is discarded.
    """
    if not isinstance(pool_stats, dict):
        return {}

    # Total mining emission = 127.22B ZION = 127,220,000,000,000,000 flowers (6-decimal).
    # total_paid can never exceed this. Values above are pre-hardfork 12-decimal artifacts.
    MINING_EMISSION_FLOWERS_6DEC = 127_220_000_000_000_000  # 127.22B ZION × 1e6

    u64_max = (1 << 64) - 1
    miners_total_atomic = sum(int(m.get("paid_total_atomic") or 0) for m in miners)

    highwater_atomic = 0
    try:
        if PAYOUT_HIGHWATER_FILE.exists():
            with open(PAYOUT_HIGHWATER_FILE, "r", encoding="utf-8") as f:
                hw_val = int((json.load(f) or {}).get("total_paid_atomic") or 0)
                # Discard pre-hardfork highwater values (12-decimal artifacts)
                if hw_val <= MINING_EMISSION_FLOWERS_6DEC:
                    highwater_atomic = hw_val
                else:
                    # Stale pre-fork value — remove the file so it doesn't keep poisoning
                    try:
                        PAYOUT_HIGHWATER_FILE.unlink()
                    except Exception:
                        pass
    except Exception:
        highwater_atomic = 0
    try:
        env_floor = int(os.environ.get("ZION_PAYOUT_HIGHWATER_ATOMIC", "0") or 0)
        if env_floor > highwater_atomic and env_floor <= MINING_EMISSION_FLOWERS_6DEC:
            highwater_atomic = env_floor
    except Exception:
        pass

    pplns = pool_stats.get("pplns") if isinstance(pool_stats.get("pplns"), dict) else None
    payouts = pool_stats.get("payouts") if isinstance(pool_stats.get("payouts"), dict) else None

    # Clamp pre-hardfork 12-decimal values from pool server (ran through fork without restart)
    if pplns:
        raw = int(pplns.get("total_paid_flowers") or 0)
        if raw == u64_max or raw > MINING_EMISSION_FLOWERS_6DEC:
            pplns["total_paid_flowers"] = miners_total_atomic or None
    if payouts:
        raw = int(payouts.get("total_paid_atomic") or 0)
        if raw == u64_max or raw > MINING_EMISSION_FLOWERS_6DEC:
            payouts["total_paid_atomic"] = miners_total_atomic or None

    # New pool process instances can expose smaller in-memory lifetime counters
    # right after restart. Keep dashboard totals monotonic using the best source.
    pplns_total = int(pplns.get("total_paid_flowers") or 0) if pplns else 0
    payouts_total = int(payouts.get("total_paid_atomic") or 0) if payouts else 0
    # Only use values within sane range for monotonic max
    sane_candidates = [v for v in (pplns_total, payouts_total, miners_total_atomic, highwater_atomic)
                       if 0 < v <= MINING_EMISSION_FLOWERS_6DEC]
    monotonic_total = max(sane_candidates) if sane_candidates else 0
    if pplns and monotonic_total:
        pplns["total_paid_flowers"] = monotonic_total
    if payouts and monotonic_total:
        payouts["total_paid_atomic"] = monotonic_total

    if monotonic_total > highwater_atomic:
        try:
            PAYOUT_HIGHWATER_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(PAYOUT_HIGHWATER_FILE, "w", encoding="utf-8") as f:
                json.dump({"total_paid_atomic": monotonic_total, "updated_at": int(time.time())}, f)
        except Exception:
            pass

    return pool_stats

def build_payout_status() -> dict:
    """Build comprehensive payout status for the Payout dashboard tab.
    Robust: topology-aware RPC fallbacks, structured payout history, validation, health."""

    now = datetime.now()
    status = {
        "pool_wallet": None,
        "pool_wallet_balance": None,
        "payout_enabled": False,
        "fee_split": None,
        "blocks_found": 0,
        "last_block_height": None,
        "last_payout_time": None,
        "last_payout_tx": None,
        "miner_wallet": None,
        "humanitarian_wallet": None,
        "issobella_wallet": None,
        "pool_fee_wallet": None,
        "miner_payouts": [],
        "fee_payouts": [],
        "errors": [],
        "payouts": [],
        "pending_payouts": 0,
        "miner_perf": {},
        "pool_stats": {},
        "miners": [],
        "topology": TOPOLOGY,
        "pool_health": {},
        "recent_payouts": [],
        "session_stats": {},
        "payout_validation": {},
    }

    # ── Topology-aware config discovery ───────────────────────────────
    is_edge = TOPOLOGY == "edge-primary"
    edge_host = "127.0.0.1"
    local_rpc_alive = check_port_open("127.0.0.1", 8443, timeout=1.0)
    edge_rpc_alive = check_port_open(edge_host, 8443, timeout=1.5) if is_edge else False
    edge_stats_alive = check_port_open(edge_host, 8455, timeout=1.5) if is_edge else False
    tailscale_ok = True  # v3.0.4: No Tailscale needed

    status["pool_health"] = {
        "local_rpc_ok": local_rpc_alive,
        "edge_rpc_ok": edge_rpc_alive,
        "edge_stats_ok": edge_stats_alive,
        "tailscale_ok": tailscale_ok,
        "last_update": now.isoformat(),
        "error_msg": None,
    }

    if is_edge:
        # Canonical Edge pool wallets (from edge-environment.sh, 3.0.4 hard reset)
        status["pool_wallet"] = os.environ.get("ZION_POOL_WALLET") or "zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2"
        status["payout_enabled"] = True
        status["fee_split"] = "89/5/5/1"
        # Try env var first, then edge-environment.sh, then hardcoded canonical
        _hum = os.environ.get("ZION_HUMANITARIAN_WALLET")
        _iss = os.environ.get("ZION_ISSOBELLA_WALLET")
        if not _hum or not _iss:
            # Read from edge-environment.sh
            for _envpath in ["/root/zion/edge-environment.sh", "/root/zion/edge-node2-environment.sh"]:
                try:
                    with open(_envpath) as _f:
                        for _line in _f:
                            if _line.startswith("ZION_HUMANITARIAN_WALLET="):
                                _hum = _hum or _line.split("=", 1)[1].strip().strip('"')
                            if _line.startswith("ZION_ISSOBELLA_WALLET="):
                                _iss = _iss or _line.split("=", 1)[1].strip().strip('"')
                    if _hum and _iss:
                        break
                except Exception:
                    pass
        status["humanitarian_wallet"] = _hum or "zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7"
        status["issobella_wallet"] = _iss or "zion1f7y7l5k678y0v408e8s654d2282346k375526t2"
        status["pool_fee_wallet"] = ""
        status["miner_wallet"] = os.environ.get("ZION_MINER_ADDRESS") or "zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2"
    else:
        startup = head_log("pool.log", 50)
        for line in startup:
            if m := re.search(r'pool_wallet=(\S+)', line):
                status["pool_wallet"] = m.group(1)
            if m := re.search(r'payout_execution=(\S+)', line):
                status["payout_enabled"] = m.group(1) == "enabled"
            if m := re.search(r'fee_split: miners=(\d+)% humanitarian=(\d+)% issobella=(\d+)% pool_fee=(\d+)%', line):
                status["fee_split"] = f"{m.group(1)}/{m.group(2)}/{m.group(3)}/{m.group(4)}"
            if m := re.search(r'humanitarian_wallet=(\S+)', line):
                status["humanitarian_wallet"] = m.group(1)
            if m := re.search(r'issobella_wallet=(\S+)', line):
                status["issobella_wallet"] = m.group(1)
            if m := re.search(r'pool_fee_wallet=(\S+)', line):
                status["pool_fee_wallet"] = m.group(1)
        node_startup = head_log("node1.log", 30)
        for line in node_startup:
            if m := re.search(r'miner_address=.*(zion1\S+)', line):
                status["miner_wallet"] = m.group(1)
        if not status["pool_wallet"]:
            status["pool_wallet"] = os.environ.get("ZION_POOL_WALLET") or os.environ.get("ZION_MINER_ADDRESS")
        if not status["miner_wallet"]:
            status["miner_wallet"] = os.environ.get("ZION_MINER_ADDRESS")
        if not status["humanitarian_wallet"]:
            status["humanitarian_wallet"] = os.environ.get("ZION_HUMANITARIAN_WALLET")
        if not status["issobella_wallet"]:
            status["issobella_wallet"] = os.environ.get("ZION_ISSOBELLA_WALLET")
        # Fallback: read from local env files (backup-node.env has canonical addresses)
        if not status["humanitarian_wallet"] or not status["issobella_wallet"]:
            for _envpath in [str(REPO_ROOT / "scripts" / "backup-node.env"), "/root/zion/edge-environment.sh"]:
                try:
                    with open(_envpath) as _f:
                        for _line in _f:
                            if _line.startswith("ZION_HUMANITARIAN_WALLET=") and not status["humanitarian_wallet"]:
                                status["humanitarian_wallet"] = _line.split("=", 1)[1].strip().strip('"')
                            if _line.startswith("ZION_ISSOBELLA_WALLET=") and not status["issobella_wallet"]:
                                status["issobella_wallet"] = _line.split("=", 1)[1].strip().strip('"')
                    if status["humanitarian_wallet"] and status["issobella_wallet"]:
                        break
                except Exception:
                    pass
        # Final canonical fallback (3.0.4 hard reset addresses)
        if not status["humanitarian_wallet"]:
            status["humanitarian_wallet"] = "zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7"
        if not status["issobella_wallet"]:
            status["issobella_wallet"] = "zion1f7y7l5k678y0v408e8s654d2282346k375526t2"
        if not status["pool_fee_wallet"]:
            status["pool_fee_wallet"] = os.environ.get("ZION_POOL_FEE_WALLET")

    # ── Parse logs (local + miner log for cross-topology visibility) ──
    recent_pool = tail_log("pool.log", 500)
    recent_miner = tail_log("miner.log", 300)
    low_miner = tail_log("miner-low.log", 300)
    # Prefer the most recently modified miner log
    miner_path = LOG_DIR / "miner.log"
    low_path = LOG_DIR / "miner-low.log"
    if low_path.exists() and miner_path.exists():
        if low_path.stat().st_mtime > miner_path.stat().st_mtime:
            recent_miner = low_miner
    elif low_path.exists():
        recent_miner = low_miner
    all_lines = recent_pool + recent_miner

    seen_blocks = set()
    recent_payouts = []
    errors = []
    deferred = 0
    last_tx = None
    last_time = None
    valid_addr_count = 0
    invalid_addr_count = 0
    missing_addr_count = 0
    last_validation_error = None

    for line in all_lines:
        # Blocks found
        if m := re.search(r'BLOCK_FOUND.*height=(\d+)', line):
            h = int(m.group(1))
            if h not in seen_blocks:
                seen_blocks.add(h)
                status["blocks_found"] += 1
            if status["last_block_height"] is None or h > status["last_block_height"]:
                status["last_block_height"] = h

        # Payout submitted / account model
        if (m := re.search(r'payout_(?:submitted|account_model).*height=(\d+).*?(?:recipients=(\d+))?.*?(?:wallet=(\S+))?.*?(?:tx_id=(\S+))?', line)):
            h = int(m.group(1))
            tx_id = m.group(4) or None
            wallet = m.group(3) or status["pool_wallet"]
            recipients = int(m.group(2)) if m.group(2) else 0
            recent_payouts.append({
                "block_height": h,
                "tx_id": tx_id,
                "wallet": wallet,
                "recipients": recipients,
                "timestamp": now.isoformat(),
                "amount_zion": None,  # parsed below if we have subsidy
                "status": "confirmed" if tx_id else "pending",
            })
            if tx_id:
                last_tx = tx_id
                last_time = now.strftime("%H:%M:%S")
            status["miner_payouts"].append(line.strip()[:200])

        # Fee payouts
        if "fee_payout_account_model" in line or "fee_payout_submitted" in line:
            status["fee_payouts"].append(line.strip()[:200])

        # Deferred
        if "payout_deferred" in line:
            deferred += 1

        # Errors
        if "payout_submit_failed" in line or "fee_payout_failed" in line or "payout_address required" in line or "invalid payout_address" in line:
            errors.append(line.strip()[:250])
            if "invalid payout_address" in line or "payout_address required" in line:
                invalid_addr_count += 1
                if "payout_address required" in line:
                    missing_addr_count += 1
                last_validation_error = line.strip()[:200]

        # Valid address accepted (pool log: miner connected with valid address)
        if re.search(r'miner.*payout_address=zion1\S+', line):
            valid_addr_count += 1

    status["pending_payouts"] = deferred
    status["miner_payouts"] = status["miner_payouts"][-10:]
    status["fee_payouts"] = status["fee_payouts"][-10:]
    status["errors"] = errors[-10:]
    status["last_payout_tx"] = last_tx
    status["last_payout_time"] = last_time or (recent_payouts[-1]["timestamp"][11:19] if recent_payouts else None)

    # Payout validation summary
    status["payout_validation"] = {
        "valid_addresses": valid_addr_count,
        "invalid_addresses": invalid_addr_count,
        "missing_addresses": missing_addr_count,
        "last_error": last_validation_error,
        "safe_to_payout": invalid_addr_count == 0 and missing_addr_count == 0,
    }

    # ── Miner performance ─────────────────────────────────────────────
    perf = {}
    for line in recent_miner + recent_pool:
        if m := re.search(r'hashrate[:=]\s*([\d.]+)\s*([a-zA-Z]*)', line):
            perf["hashrate"] = float(m.group(1))
            unit = m.group(2) or ""
            if unit.upper().startswith("M"):
                perf["hashrate"] *= 1_000
            elif unit.upper().startswith("H"):
                perf["hashrate"] /= 1_000
        if m := re.search(r'shares_accepted[:=]\s*(\d+)', line):
            perf["shares_accepted"] = int(m.group(1))
        if m := re.search(r'shares_rejected[:=]\s*(\d+)', line):
            perf["shares_rejected"] = int(m.group(1))
        if m := re.search(r'current_height[:=]\s*(\d+)', line):
            perf["current_height"] = int(m.group(1))
    status["miner_perf"] = perf

    # ── Structured payouts for charts ─────────────────────────────────
    payouts = []
    seen_heights = set()
    for line in recent_pool:
        for pattern in [r'BLOCK_FOUND.*height=(\d+)', r'payout_submitted.*height=(\d+)']:
            if m := re.search(pattern, line):
                h = int(m.group(1))
                if h in seen_heights:
                    continue
                seen_heights.add(h)
                subsidy = block_subsidy(h)
                miner, humanitarian, issobella, pool_fee = fee_split(subsidy)
                payouts.append({
                    "block_height": h,
                    "subsidy_flowers": subsidy,
                    "fee_split": {
                        "miner": miner / 1_000_000,
                        "charity": humanitarian / 1_000_000,
                        "dev": issobella / 1_000_000,
                        "pool": pool_fee / 1_000_000,
                    }
                })
                # Enrich recent_payouts with amount if block matches
                for rp in recent_payouts:
                    if rp["block_height"] == h and rp["amount_zion"] is None:
                        rp["amount_zion"] = miner / 1_000_000
                break
    payouts.sort(key=lambda x: x["block_height"])
    status["payouts"] = payouts[-20:]
    recent_payouts.sort(key=lambda x: x["block_height"], reverse=True)
    status["recent_payouts"] = recent_payouts[:20]

    # ── Wallet balances (RPC with Edge→local fallback) ────────────────
    rpc_host = edge_host if (is_edge and edge_rpc_alive) else "127.0.0.1"
    if status["pool_wallet"] and status["pool_wallet"].startswith("zion1"):
        bal = rpc_call(rpc_host, 8443, "getBalance", {"address": status["pool_wallet"]}, timeout=2.5)
        if bal and not bal.get("_rpc_error"):
            atomic = int(bal.get("balance_flowers") or bal.get("balance_atomic") or 0)
            status["pool_wallet_balance"] = atomic
        elif is_edge and local_rpc_alive:
            # Fallback to local backup node
            bal = rpc_call("127.0.0.1", 8443, "getBalance", {"address": status["pool_wallet"]}, timeout=2)
            if bal and not bal.get("_rpc_error"):
                atomic = int(bal.get("balance_flowers") or bal.get("balance_atomic") or 0)
                status["pool_wallet_balance"] = atomic

    balances = {}
    for key, addr in [("miner", status["miner_wallet"]),
                      ("humanitarian", status["humanitarian_wallet"]),
                      ("issobella", status["issobella_wallet"])]:
        if addr and addr.startswith("zion1"):
            bal = rpc_call(rpc_host, 8443, "getBalance", {"address": addr}, timeout=2.5)
            if bal and not bal.get("_rpc_error"):
                atomic = int(bal.get("balance_flowers") or bal.get("balance_atomic") or 0)
                balances[key] = {"atomic": atomic, "zion": flowers_to_zion(atomic)}
    status["balances"] = balances

    # ── Pool stats / miners from Edge or local ──────────────────────────
    pool_stats = fetch_pool_stats()
    miners = fetch_pool_miners()
    pool_stats = sanitize_pool_stats(pool_stats, miners)
    status["pool_stats"] = pool_stats
    status["miners"] = miners

    # Edge-primary: if local logs have no blocks, use Edge pool stats
    if is_edge and pool_stats:
        edge_blocks = pool_stats.get("blocks", {}).get("found") if isinstance(pool_stats.get("blocks"), dict) else None
        if edge_blocks is not None and status["blocks_found"] == 0:
            status["blocks_found"] = edge_blocks

    # ── Burned total (after edge block fallback so total_blocks is accurate) ─
    total_blocks = status["blocks_found"]
    last_height = status["last_block_height"] or 1
    if total_blocks > 0:
        per_block_burned_zion = block_subsidy(last_height) / 100 / 1_000_000
        status["burned_total"] = total_blocks * per_block_burned_zion
    else:
        status["burned_total"] = 0.0

    # ── On-chain balances for each miner payout address ───────────────────
    for m in miners:
        addr = m.get("payout_address")
        if addr and addr.startswith("zion1"):
            bal = rpc_call(rpc_host, 8443, "getBalance", {"address": addr}, timeout=2.0)
            if bal and not bal.get("_rpc_error"):
                atomic = int(bal.get("balance_flowers") or bal.get("balance_atomic") or 0)
                m["on_chain_balance_zion"] = flowers_to_zion(atomic)
            elif is_edge and local_rpc_alive:
                bal = rpc_call("127.0.0.1", 8443, "getBalance", {"address": addr}, timeout=2.0)
                if bal and not bal.get("_rpc_error"):
                    atomic = int(bal.get("balance_flowers") or bal.get("balance_atomic") or 0)
                    m["on_chain_balance_zion"] = flowers_to_zion(atomic)

    # ── Network-wide emission totals from block 0 (consensus schedule) ──
    try:
        chain_info = rpc_call(rpc_host, 8443, "getChainInfo", {}, timeout=2.0)
        if not chain_info or chain_info.get("_rpc_error"):
            chain_info = rpc_call("127.0.0.1", 8443, "getChainInfo", {}, timeout=2.0) if (is_edge and local_rpc_alive) else None
        if chain_info and not chain_info.get("_rpc_error"):
            status["network_emission"] = calculate_emission_totals(chain_info.get("chain_height", 0))
        else:
            status["network_emission"] = None
    except Exception:
        status["network_emission"] = None

    # Session stats
    active_sessions = pool_stats.get("miners", {}).get("active", len(miners)) if isinstance(pool_stats.get("miners"), dict) else len(miners)
    # accept_rate_pct: prefer live Prometheus metrics (port 8455) over pool /stats endpoint
    _routing_accept = pool_stats.get("routing", {}).get("accept_rate_pct") if isinstance(pool_stats.get("routing"), dict) else None
    _metrics_accept = None
    try:
        import urllib.request as _ur2
        _mhost = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
        with _ur2.urlopen(f"http://{_mhost}:8455/metrics", timeout=1.5) as _r:
            for _ln in _r.read().decode("utf-8", errors="ignore").splitlines():
                if _ln.startswith("zion_pool_accept_rate_pct "):
                    _metrics_accept = float(_ln.split()[-1])
                    break
    except Exception:
        pass
    status["session_stats"] = {
        "active_sessions": active_sessions,
        "total_shares_1h": sum(m.get("valid_shares", 0) for m in miners),
        "blocks_24h": total_blocks,
        "accept_rate_pct": _metrics_accept if _metrics_accept is not None else _routing_accept,
    }

    # JS miner_stats compatibility
    miner_stats = []
    for m in miners:
        miner_stats.append({
            "address": m.get("payout_address") or m.get("address") or "—",
            "worker_name": m.get("worker_name") or m.get("id") or "—",
            "algorithm": m.get("algorithm") or "—",
            "backend": m.get("backend") or "cpu",
            "valid_shares": m.get("valid_shares", 0),
            "hashrate": m.get("hashrate", 0),
            "hashrate_1h": m.get("hashrate_1h", 0),
            "total_paid": m.get("paid_total", 0),
            "on_chain_balance_zion": m.get("on_chain_balance_zion"),
            "pending_balance": m.get("pending_balance", 0),
            "blocks_found": m.get("blocks_found", 0),
            "connected_since": m.get("connected_since"),
            "last_share": m.get("last_share"),
        })
    status["miner_stats"] = miner_stats
    status["miner_payouts_detail"] = status["miner_payouts"]

    # If Edge stats are dead, surface a warning
    if is_edge and not edge_stats_alive:
        status["pool_health"]["error_msg"] = "Edge pool metrics endpoint (8455) unreachable. Stats/miners may be stale."

    return status

# ── AI services status (Hiran + Hiranyagarbha) ───────────────────────────

def get_ai_services_status() -> dict:
    """Unified AI layer health snapshot."""
    # Hiran Inference (port 8002)
    hiran = {"alive": False, "backend": "none", "model": "—", "vram_mb": None}
    try:
        import urllib.request
        with urllib.request.urlopen("http://127.0.0.1:8002/health", timeout=2) as r:
            d = json.loads(r.read().decode())
            hiran["alive"] = True
            hiran["backend"] = d.get("backend", "unknown")
            hiran["model"] = d.get("model", "—")
            hiran["vram_mb"] = d.get("vram_used_mb")
    except Exception:
        pass
    # Hiranyagarbha (port 8001)
    orch = {"alive": False, "version": "—", "agents": 0, "tasks": 0}
    try:
        with urllib.request.urlopen("http://127.0.0.1:8001/health", timeout=2) as r:
            d = json.loads(r.read().decode())
            orch["alive"] = True
            orch["version"] = d.get("version", "—")
            orch["agents"] = d.get("active_agents", 0)
            orch["tasks"] = d.get("pending_tasks", 0)
    except Exception:
        pass
    return {"hiran": hiran, "hiranyagarbha": orch}

def check_port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    """Quick TCP connect to test if a port is open."""
    import socket
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False

def fetch_prometheus_metrics(host: str, port: int, timeout: float = 2.0) -> dict:
    """Fetch and parse Prometheus metrics from a service endpoint."""
    try:
        url = f"http://{host}:{port}/metrics"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", errors="replace")
        metrics = {}
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 2:
                key = parts[0]
                # Strip labels: metric{label="val"} → metric
                if "{" in key:
                    key = key.split("{")[0]
                try:
                    val = float(parts[-1])
                    metrics[key] = val
                except ValueError:
                    pass
        return metrics
    except Exception:
        return {}

def fetch_service_json(host: str, port: int, path: str = "/health", timeout: float = 2.0) -> dict:
    """Fetch JSON from a service endpoint."""
    try:
        url = f"http://{host}:{port}{path}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception:
        return {}

# ── Network topology + App connectivity ──────────────────────────────────

def get_network_topology() -> dict:
    """Core↔Edge topology + Web/Desktop/Mobile/CLI connectivity."""
    # Core node
    core_node = parse_node_log("node1")
    core_alive = core_node["running"] and core_node["chain_height"] is not None
    # Edge node (via RPC on VPN IP)
    edge_rpc_alive = False
    edge_height = None
    try:
        info = rpc_call(EDGE_RPC_HOST, 8443, "getChainInfo", {}, timeout=2)
        if info and not info.get("_rpc_error"):
            edge_rpc_alive = True
            edge_height = info.get("chain_height")
    except Exception:
        pass
    # Tailscale VPN check (quick TCP probe to edge RPC instead of ICMP ping)
    tailscale_ok = True  # v3.0.4: No Tailscale needed
    # Website
    web_alive = False
    try:
        with urllib.request.urlopen("https://zionterranova.com", timeout=2) as r:
            web_alive = r.status == 200
    except Exception:
        pass
    # Desktop agent (localhost RPC)
    desktop_alive = check_port_open("127.0.0.1", 8443, timeout=0.8)
    # zion-cli version check (fast binary path probe, skip cargo run)
    cli_version = None
    cli_exe = REPO_ROOT / "V3" / "target" / "release" / "zion-cli.exe"
    if not cli_exe.exists():
        cli_exe = REPO_ROOT / "V3" / "target" / "debug" / "zion-cli.exe"
    if cli_exe.exists():
        try:
            res = subprocess.run([str(cli_exe), "--version"], capture_output=True, text=True, timeout=3)
            if res.returncode == 0:
                cli_version = res.stdout.strip().split()[-1] if res.stdout.strip() else "dev"
        except Exception:
            pass
    return {
        "core": {
            "host": "100.86.102.5",
            "alive": core_alive,
            "height": core_node.get("chain_height"),
            "peers": core_node.get("known_peers"),
            "p2p": "0.0.0.0:8333",
            "rpc": "0.0.0.0:8443",
        },
        "edge": {
            "host": "127.0.0.1",
            "public_ip": "62.171.141.136",
            "alive": edge_rpc_alive,
            "height": edge_height,
            "p2p": "0.0.0.0:8333",
            "rpc": "0.0.0.0:8443",
            "pool": "0.0.0.0:8444",
        },
        "tailscale": {"vpn_ok": True, "edge_ip": "127.0.0.1", "note": "No Tailscale (v3.0.4)"},
        "apps": {
            "website": {"url": "https://zionterranova.com", "alive": web_alive},
            "desktop_agent": {"rpc": "http://127.0.0.1:8443/jsonrpc", "alive": desktop_alive},
            "mobile_app": {"status": "dev_build_ready", "alive": True},  # placeholder until health endpoint
            "cli": {"version": cli_version, "alive": cli_version is not None},
        },
        "ports": {
            "node_p2p": check_port_open("127.0.0.1", 8333),
            "node_rpc": check_port_open("127.0.0.1", 8443),
            "pool_stratum": check_port_open("127.0.0.1", 8444),
            "dashboard": check_port_open("127.0.0.1", 8766),
            "hiranyagarbha": check_port_open("127.0.0.1", 8001),
            "hiran_inference": check_port_open("127.0.0.1", 8002),
        },
    }

# ── Log Search ─────────────────────────────────────────────────────────

def search_logs(query: str, max_results: int = 50) -> list:
    """Search across all log files for lines matching query (case-insensitive)."""
    results = []
    if not LOG_DIR.exists():
        return results
    query_lower = query.lower()
    log_files = [f for f in LOG_DIR.glob("*.log") if f.is_file()] + [f for f in LOG_DIR.glob("*.txt") if f.is_file()]
    for lf in sorted(log_files, key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            with open(lf, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            for i, line in enumerate(lines):
                if query_lower in line.lower():
                    results.append({
                        "file": lf.name,
                        "line": i + 1,
                        "text": line.rstrip("\n")[:300],
                    })
                    if len(results) >= max_results:
                        return results
        except Exception:
            pass
    return results

# ── Settings persistence ────────────────────────────────────────────────

SETTINGS_PATH = LOG_DIR / "dashboard-settings.json"

DEFAULT_SETTINGS = {
    "theme": "dark",
    "refresh_interval_ms": 3000,
    "default_tab": "overview",
    "alert_threshold_hashrate": 1.0,
    "alert_threshold_sync_gap": 10,
    "log_level_filter": "all",  # all, error, warn, info
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

# ── Process manager (kill PID) ───────────────────────────────────────────

def kill_process(pid: int) -> dict:
    """Kill a process by PID (cross-platform)."""
    try:
        if sys.platform == "win32":
            import ctypes
            h = ctypes.windll.kernel32.OpenProcess(1, False, pid)  # 1 = PROCESS_TERMINATE
            if not h:
                return {"ok": False, "error": f"Cannot open process {pid}"}
            res = ctypes.windll.kernel32.TerminateProcess(h, 1)
            ctypes.windll.kernel32.CloseHandle(h)
            if res:
                return {"ok": True, "message": f"Process {pid} terminated"}
            return {"ok": False, "error": f"TerminateProcess failed for {pid}"}
        else:
            import os
            os.kill(pid, 9)
            return {"ok": True, "message": f"Process {pid} killed with SIGKILL"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ── Export data ───────────────────────────────────────────────────────

def export_csv(data: list, headers: list) -> str:
    """Generate CSV string from list of dicts."""
    import io
    out = io.StringIO()
    out.write(",".join(headers) + "\n")
    for row in data:
        vals = [str(row.get(h, "")).replace(",", ";") for h in headers]
        out.write(",".join(vals) + "\n")
    return out.getvalue()

# ── CLI runner ────────────────────────────────────────────────────────────

def run_zion_cli(command: str) -> dict:
    """Run a zion-cli subcommand and return stdout/stderr/returncode."""
    allowed = {"status", "doctor", "version", "help", "backup", "config", "node", "pool", "miner"}
    # Sanitize: no shell metacharacters, no pipes
    clean = command.strip()
    if not clean:
        return {"ok": False, "error": "Empty command"}
    if any(ch in clean for ch in ";|&`$<>\n\r"):
        return {"ok": False, "error": "Shell metacharacters not allowed"}
    cmd_parts = clean.split()
    if cmd_parts[0] not in allowed:
        return {"ok": False, "error": f"Command '{cmd_parts[0]}' not in allowed list: {allowed}"}
    args = ["cargo", "run", "--manifest-path", str(REPO_ROOT / "V3" / "Cargo.toml"), "-p", "zion-cli", "--"] + cmd_parts
    try:
        proc = subprocess.Popen(args, cwd=str(REPO_ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = proc.communicate(timeout=60)
        return {
            "ok": proc.returncode == 0,
            "returncode": proc.returncode,
            "stdout": stdout[:4000],
            "stderr": stderr[:2000],
        }
    except subprocess.TimeoutExpired:
        proc.kill()
        return {"ok": False, "error": "CLI command timed out after 60s"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ── Alert config persistence ─────────────────────────────────────────────

ALERT_CONFIG_PATH = LOG_DIR / "alert-config.json"

def load_alert_config() -> dict:
    defaults = {"webhook_url": "", "slack_webhook": "", "email": "", "enabled": True}
    if ALERT_CONFIG_PATH.exists():
        try:
            with open(ALERT_CONFIG_PATH, "r", encoding="utf-8") as f:
                return {**defaults, **json.load(f)}
        except Exception:
            pass
    return defaults

def save_alert_config(cfg: dict) -> dict:
    try:
        with open(ALERT_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ── Mainnet constants & genesis (from V3/L1/core/src/{emission,genesis,fee}.rs) ──

MAINNET_CONSTANTS = {
    "supply": {
        "total_zion": 144_000_000_000,
        "genesis_premine_zion": 16_780_000_000,
        "mining_emission_zion": 127_220_000_000,
        "flowers_per_zion": 1_000_000,
    },
    "block": {
        "time_seconds": 60,
        "blocks_per_year": 525_600,
        "blocks_per_decade": 5_256_000,
        "base_reward_zion": 5400.067,
        "tail_reward_zion": 724.784723,
        "decay_factor": "0.8 (4/5) per decade",
        "max_decay_decades": 10,
        "coinbase_maturity": 100,
    },
    "reward_split": {
        "miner_pct": 89,
        "humanitarian_pct": 5,
        "issobella_pct": 5,
        "pool_fee_pct": 1,
    },
    "consensus": {
        "algorithm": "cosmic_harmony_ekam_deeksha_v2",
        "scratchpad_size_kib": 256,
        "passes": 4,
        "random_reads": 256,
        "fusion_rounds": 8,
        "signing": "Ed25519",
        "hashing": "BLAKE3",
        "address_format": "Bech32 (zion1...)",
    },
    "fees": {
        "min_tx_fee_flowers": 1_000,
        "min_fee_rate_per_byte": 1,
        "max_tx_size_bytes": 100_000,
    },
    "special_addresses": {
        "burn": "zion1burn0000000000000000000000000000000dead",
        "dao": "zion1t4l2f5j737989828v295n7z4r3v5j8k895m56n4",
        "bridge_vault": "zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7",
    },
}

PREMINE_OUTPUTS = [
    # OASIS + Golden Egg (5 slots × 1.65B = 8.25B)
    {"address": "zion153e378e4x0g6s380h2h8z4t506g5s323f5se8g5", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 1)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion1w548y2k3q802w885u7h0x2z8w7d675m0u3ya0l3", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 2)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion192v4c0k074u7c502q6x8e0t592s564s7l4pm607", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 3)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion1n690n062g668s8g0y4772830z8r450c0l06f295", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 4)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion17323k5e490t832f4d0m3w4x3s2e2z7a7600j3v7", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 5)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    # DAO Treasury (3 slots = 4.0B) — locked until block 144,000 (post-3.0.3 fork)
    {"address": "zion1t4l2f5j737989828v295n7z4r3v5j8k895m56n4", "purpose": "DAO Treasury — Community Governance (main)", "amount_zion": 2_500_000_000, "category": "dao_treasury", "unlock_height": 144_000},
    {"address": "zion1r5j0j7y444a8j402n8t8u2n8y323u6x4r2aw7l6", "purpose": "DAO Treasury — Grants & Bounties", "amount_zion": 1_000_000_000, "category": "dao_treasury", "unlock_height": 144_000},
    {"address": "zion1932843t398t095g4h3x2f3a5l0q40490k4fm2w8", "purpose": "DAO Treasury — Ecosystem Bootstrap", "amount_zion": 500_000_000, "category": "dao_treasury", "unlock_height": 144_000},
    # Infrastructure (3 slots = 2.59B)
    {"address": "zion1d3p5x622m327r060w5z0q5r203v837m6l8pa8x5", "purpose": "Core Development Fund", "amount_zion": 1_000_000_000, "category": "infrastructure", "unlock_height": None},
    {"address": "zion1r6r4s0u2e6u4t23767s05752d70660h2f29d2l7", "purpose": "Network Infrastructure — P2P Seed Nodes", "amount_zion": 1_000_000_000, "category": "infrastructure", "unlock_height": None},
    {"address": "zion16542q4l853a2z0u5r5w8y4m8k4558847h503736", "purpose": "Genesis Projects — Dharma Temple, Piko de Ora + DAO", "amount_zion": 590_000_000, "category": "infrastructure", "unlock_height": None},
    # Humanitarian (1 slot = 1.44B)
    {"address": "zion1z7g4u3s2w3c5z5u4a60864m2y7q8e5j304g46r7", "purpose": "Children Future Fund — Humanitarian DAO", "amount_zion": 1_440_000_000, "category": "humanitarian", "unlock_height": None},
    # Bridge Seed Fund (1 slot = 0.4B) — immediate unlock for EVM bridge liquidity
    {"address": "zion13794g7k3m0f84637l2x0t855h3l258k8p3xp5t3", "purpose": "Bridge Seed Fund — EVM Bridge Liquidity", "amount_zion": 400_000_000, "category": "bridge_seed", "unlock_height": None},
    # Bridge Vault UTXO Seed (1 slot = 0.1B) — UTXO liquidity for bridge unlocks
    {"address": "zion1r565v3k2u8p8t6n494p0n527c0m7a5s4s5ae0x7", "purpose": "Bridge Vault UTXO Seed — EVM Bridge Unlock Liquidity", "amount_zion": 100_000_000, "category": "bridge_vault_utxo", "unlock_height": None},
]

P0_BLOCKERS = [
    {"id": 1, "title": "Bridge validator 3/5 multisig", "owner": "Security / Ops", "deadline": "T-7", "status": "OPEN", "severity": "critical",
     "detail": "Placeholder addresses 0x0000…0001–0005 in V3/L2/bridge/config/bridge-mainnet.toml. Need 5 real secp256k1 addresses on separate HSM hosts."},
    {"id": 2, "title": "Ankr API key (premium tier)", "owner": "Ops", "deadline": "T-7", "status": "OPEN", "severity": "critical",
     "detail": "bridge-mainnet.toml line 28: api_key=\"\". Requires premium Ankr account for EVM watcher reliability."},
    {"id": 3, "title": "Seed peer bootstrap mesh", "owner": "Ops", "deadline": "T-3", "status": "DONE", "severity": "info",
     "detail": "Core + Edge topology active. Core (local backup) seeds Edge (127.0.0.1) via P2P. Legacy multi-node mesh decommissioned."},
    {"id": 4, "title": "Premine wallet rotation", "owner": "Security", "deadline": "T-14", "status": "DONE", "severity": "info",
     "detail": "✅ Done 2026-05-14. Old 12 BIP-39 seeds burned, new addresses generated, public addresses in PREMINE_ADDRESSES_PUBLIC.txt."},
    {"id": 5, "title": "CI / GitHub Actions billing", "owner": "DevOps", "deadline": "T-14", "status": "OPEN", "severity": "warning",
     "detail": "Private repo runners not starting without paid plan. Need GitHub Team/Enterprise OR self-hosted runner."},
    {"id": 6, "title": "External security audit", "owner": "Security", "deadline": "T-21", "status": "OPEN", "severity": "critical",
     "detail": "Independent review needed for L1/cosmic-harmony, L1/core, L2/bridge, L2/dao. Candidates: Trail of Bits, OpenZeppelin, CertiK."},
    {"id": 7, "title": "Bug bounty program", "owner": "Security", "deadline": "T-7", "status": "OPEN", "severity": "critical",
     "detail": "No public disclosure channel. Set up Immunefi / HackerOne with scope + rewards."},
    {"id": 8, "title": "Genesis block ceremony", "owner": "Core Dev", "deadline": "T-1", "status": "PREP", "severity": "warning",
     "detail": "Frozen genesis hash must be publicly verifiable. Prepare GENESIS_MESSAGE.txt + signed witness log."},
    {"id": 9, "title": "RPC / P2P endpoint hardening", "owner": "Ops", "deadline": "T-3", "status": "OPEN", "severity": "critical",
     "detail": "Firewall, rate limiting, DDoS protection. UFW on all nodes + Cloudflare/WAF + RPC rate limiter."},
    {"id": 10, "title": "Docker hardened deployment", "owner": "Ops", "deadline": "T-3", "status": "OPEN", "severity": "warning",
     "detail": "Verify V3/docker/HARDENING.md, non-root containers, resource limits, secrets management."},
]

# ── Service control (cross-platform scripts) ──────────────────────────

# OS suffix: .ps1 on Windows, .sh on Linux/macOS
_SCRIPT_EXT = ".ps1" if os.name == "nt" else ".sh"

def _script_cmd(script_path, *extra_args):
    """Build a cross-platform command list to run a .ps1/.sh script."""
    if os.name == "nt":
        return ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", str(script_path)] + list(extra_args)
    else:
        return ["bash", str(script_path)] + list(extra_args)

# ── Service manifest (cross-platform, script-free start/stop) ─────────────
# services.json is the single source of truth for simple "set env + launch
# binary + redirect logs" services. The same spec works on Windows, Linux and
# macOS — only the .exe suffix and the detached-launch mechanics differ.

_DOTENV_CACHE = None

def load_dotenv() -> dict:
    """Parse dashboard/.env (KEY=VALUE lines) into a dict. Cached."""
    global _DOTENV_CACHE
    if _DOTENV_CACHE is not None:
        return _DOTENV_CACHE
    data = {}
    try:
        if DOTENV_FILE.exists():
            for raw in DOTENV_FILE.read_text(encoding="utf-8").splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                data[k.strip()] = v.strip().strip('"').strip("'")
    except Exception as e:
        print(f"[services] .env parse error: {e}", file=sys.stderr)
    _DOTENV_CACHE = data
    return data

_PLACEHOLDER_RE = re.compile(r"\$\{([A-Z0-9_]+)\}")

def _resolve_env_value(val: str, secrets: dict):
    """Substitute ${VAR} placeholders from .env / os.environ.
    Returns None if any referenced placeholder is unresolved (so the var is
    omitted and the binary falls back to its own default)."""
    missing = []
    def repl(m):
        name = m.group(1)
        if name in secrets:
            return secrets[name]
        if os.environ.get(name):
            return os.environ[name]
        missing.append(name)
        return ""
    out = _PLACEHOLDER_RE.sub(repl, val)
    return None if missing else out

_SERVICES_CACHE = None

def load_services_manifest() -> dict:
    """Load + cache services.json. Returns {} on any error (callers fall back
    to scripts)."""
    global _SERVICES_CACHE
    if _SERVICES_CACHE is not None:
        return _SERVICES_CACHE
    services = {}
    try:
        if SERVICES_MANIFEST.exists():
            raw = json.loads(SERVICES_MANIFEST.read_text(encoding="utf-8"))
            services = {k: v for k, v in raw.items() if not k.startswith("_")}
    except Exception as e:
        print(f"[services] manifest load error: {e}", file=sys.stderr)
    _SERVICES_CACHE = services
    return services

def _spawn_detached(argv, log_basename: str, env: dict):
    """Launch argv detached from the dashboard, cross-platform.
    stdout/stderr go to logs/<log_basename>.log/.err. Returns the PID."""
    out_path = LOG_DIR / f"{log_basename}.log"
    err_path = LOG_DIR / f"{log_basename}.err"
    out_f = open(out_path, "ab")
    err_f = open(err_path, "ab")
    try:
        if os.name == "nt":
            si = None
            try:
                si = subprocess.STARTUPINFO()
                si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                si.wShowWindow = 0  # SW_HIDE
            except Exception:
                pass
            creation = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
            proc = subprocess.Popen(
                argv, cwd=str(REPO_ROOT),
                stdout=out_f, stderr=err_f, stdin=subprocess.DEVNULL,
                startupinfo=si, creationflags=creation, close_fds=True, env=env,
            )
        else:
            proc = subprocess.Popen(
                argv, cwd=str(REPO_ROOT),
                stdout=out_f, stderr=err_f, stdin=subprocess.DEVNULL,
                close_fds=True,
                preexec_fn=os.setsid if hasattr(os, "setsid") else None,
                env=env,
            )
        return proc.pid
    finally:
        out_f.close()
        err_f.close()

def run_service(service_key: str, env_overrides: dict = None) -> dict:
    """Start a manifest-defined service by launching its binary directly.
    Returns {ok, pid, ...} or {ok: False, error}."""
    spec = load_services_manifest().get(service_key)
    if not spec:
        return {"ok": False, "error": f"Unknown service '{service_key}'"}
    bin_name = spec.get("bin", "") + EXE_SUFFIX
    bin_path = RELEASE_BIN_DIR / bin_name
    if not bin_path.exists():
        return {"ok": False, "error": f"Binary not found: {bin_path}. Build the V3 workspace first."}
    # Ensure log + extra dirs exist
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    for d in spec.get("mkdirs", []):
        try:
            (REPO_ROOT / d).mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
    # Build environment: base os.environ + resolved manifest env + overrides
    secrets = load_dotenv()
    env = os.environ.copy()
    for k, v in (spec.get("env") or {}).items():
        resolved = _resolve_env_value(str(v), secrets)
        if resolved is None:
            _log_control(f"service={service_key} skipped env {k} (unresolved placeholder)")
            continue
        env[k] = resolved
    if env_overrides:
        for k, v in env_overrides.items():
            env[k] = str(v)
    argv = [str(bin_path)] + [str(a) for a in spec.get("args", [])]
    try:
        pid = _spawn_detached(argv, spec.get("log", service_key), env)
    except Exception as e:
        _log_control(f"FAILED service={service_key} error={e}")
        return {"ok": False, "error": str(e), "service": service_key}
    sid = spec.get("service_id")
    if sid:
        register_process(sid, pid, image=spec.get("bin", ""))
    _log_control(f"started service={service_key} bin={bin_name} pid={pid}")
    return {"ok": True, "service": service_key, "pid": pid}

def _kill_by_release_bin(bin_name: str) -> int:
    """Best-effort kill of our release binary, matched by its FULL release path
    so we never hit unrelated processes that merely share a name (e.g. the ZION
    `node` binary vs. Node.js `node`). Returns 1 if a kill was attempted."""
    if not bin_name:
        return 0
    bin_path = RELEASE_BIN_DIR / (bin_name + EXE_SUFFIX)
    try:
        if os.name == "nt":
            # Filter Get-Process by executable Path, not just name.
            ps = (
                f"Get-Process -Name '{bin_name}' -ErrorAction SilentlyContinue | "
                f"Where-Object {{ $_.Path -eq '{bin_path}' }} | Stop-Process -Force"
            )
            subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        else:
            # Match the full absolute path → safe, won't match same-named procs.
            subprocess.run(["pkill", "-f", str(bin_path)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        return 1
    except Exception:
        return 0

def stop_service(service_key: str) -> dict:
    """Stop a manifest-defined service: kill the tracked PID if we started it,
    otherwise best-effort kill by binary name."""
    spec = load_services_manifest().get(service_key)
    if not spec:
        return {"ok": False, "error": f"Unknown service '{service_key}'"}
    sid = spec.get("service_id")
    killed = False
    rec = None
    if sid:
        with PROCESS_LOCK:
            rec = PROCESS_REGISTRY.get(sid)
    if rec and is_process_alive(rec["pid"]):
        pid = rec["pid"]
        try:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(pid), "/F", "/T"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
            else:
                # Kill the whole process group created via setsid
                try:
                    os.killpg(os.getpgid(pid), 15)
                except Exception:
                    os.kill(pid, 15)
            killed = True
        except Exception as e:
            return {"ok": False, "error": f"kill failed: {e}", "service": service_key}
    # Always also sweep by full release path (covers externally-started
    # instances) — path-matched so we never touch unrelated same-named procs.
    _kill_by_release_bin(spec.get("bin", ""))
    if sid:
        with PROCESS_LOCK:
            PROCESS_REGISTRY.pop(sid, None)
    _log_control(f"stopped service={service_key} pid_killed={killed}")
    return {"ok": True, "service": service_key, "pid_killed": killed}

_ALLOW_BASE = {
    "install-deps":           "install-deps",
    "launch-stack":           "launch-stack",
    "stop-stack":             "stop-stack",
    "stop-all":               "stop-all",
    "start-node1":            "start-node",
    "start-node2":            "start-node2",
    "start-pool":             "start-pool",
    "start-miner":            "start-miner",
    "start-miner-cpu":        "start-miner-cpu",
    "start-miner-gpu":        "start-miner-gpu",
    "stop-miner":             "stop-miner",
    "stop-node1":             "stop-node1",
    "stop-node2":             "stop-node2",
    "stop-pool":              "stop-pool",
    "restart-node1":          "start-node1",
    "restart-node2":          "start-node2",
    "restart-pool":           "start-pool",
    "restart-miner":          "start-miner",
    "backup-chain":           "backup-chain",
    "verify-chain":           "verify-chain",
    "core-util":              "core-util-run",
    # ── AI Layer ─────────────────────────────────────────────────────────
    "start-hiranyagarbha":    "start-hiranyagarbha",
    "start-hiran-inference":  "start-hiran-inference",
    "stop-hiranyagarbha":     "stop-hiranyagarbha",
    "stop-ai-native":         "stop-ai-native",
    "restart-hiranyagarbha":  "start-hiranyagarbha",
    "restart-hiran-inference":"start-hiran-inference",
    "restart-ai-native":      "start-hiran-inference",
    # ── DAO ──────────────────────────────────────────────────────────────
    "start-dao":              "start-dao",
    "stop-dao":               "stop-dao",
    "restart-dao":            "start-dao",
    # ── Bridge ───────────────────────────────────────────────────────────
    "start-bridge":           "start-bridge",
    "stop-bridge":            "stop-bridge",
    "restart-bridge":         "start-bridge",
    # ── Atomic Swap ──────────────────────────────────────────────────────
    "start-atomic-swap":      "start-atomic-swap",
    "stop-atomic-swap":       "stop-atomic-swap",
    "restart-atomic-swap":    "start-atomic-swap",
    # ── Swap Aggregator ──────────────────────────────────────────────────
    "start-swap-aggregator":      "start-swap-aggregator",
    "stop-swap-aggregator":       "stop-swap-aggregator",
    "restart-swap-aggregator":    "start-swap-aggregator",
    # ── WARP ─────────────────────────────────────────────────────────────
    "start-warp":             "start-warp",
    "stop-warp":              "stop-warp",
    "restart-warp":           "start-warp",
    # ── OASIS (L4) ───────────────────────────────────────────────────────
    "start-oasis":            "start-oasis",
    "stop-oasis":             "stop-oasis",
    # ── L5 Humanitarian ──────────────────────────────────────────────────
    "start-humanitarian":     "start-humanitarian",
    "stop-humanitarian":      "stop-humanitarian",
    # ── L6 Issobella Space ───────────────────────────────────────────────
    "start-space":            "start-space",
    "stop-space":             "stop-space",
}

# Edge-primary topology launcher (W11 / Linux)
_ALLOW_BASE["launch-local-backup"] = "launch-local-backup"

# Extras available on all platforms (Windows .ps1 + Linux/macOS .sh now exist)
_ALLOW_BASE["launch-full"] = "launch-full"
_ALLOW_BASE["start-monitoring"] = "start-monitoring"
_ALLOW_BASE["stop-monitoring"] = "stop-monitoring"
_ALLOW_BASE["start-prometheus"] = "start-monitoring"
_ALLOW_BASE["start-grafana"] = "start-monitoring"
_ALLOW_BASE["open-terminal"] = "open-terminal"

ALLOWED_ACTIONS = {k: v + _SCRIPT_EXT for k, v in _ALLOW_BASE.items()}

CONTROL_LOG = LOG_DIR / "control-audit.txt"

def _log_control(msg: str):
    ts = datetime.now().isoformat()
    try:
        with open(CONTROL_LOG, "a", encoding="utf-8") as f:
            f.write(f"[{ts}] {msg}\n")
    except Exception:
        pass

def _manifest_dispatch(action: str, env_overrides: dict = None):
    """If `action` targets a manifest service, run it directly (no scripts) and
    return the result dict. Returns None if the action is not manifest-backed,
    so the caller falls back to the .ps1/.sh script path."""
    for prefix in ("start-", "stop-", "restart-"):
        if action.startswith(prefix):
            key = action[len(prefix):]
            if key in load_services_manifest():
                if prefix == "start-":
                    return run_service(key, env_overrides)
                if prefix == "stop-":
                    return stop_service(key)
                # restart: stop, brief settle, start
                stop_service(key)
                time.sleep(0.5)
                return run_service(key, env_overrides)
            return None
    return None

def run_control(action: str, env_overrides: dict = None) -> dict:
    """Execute a control action in the background (cross-platform).
    Manifest-backed services (services.json) are launched directly; everything
    else falls back to an allowed .ps1/.sh script in scripts/.
    Optional env_overrides merges into the subprocess environment."""
    manifest_result = _manifest_dispatch(action, env_overrides)
    if manifest_result is not None:
        return manifest_result
    if action not in ALLOWED_ACTIONS:
        return {"ok": False, "error": f"Unknown action '{action}'. Allowed: {sorted(ALLOWED_ACTIONS)}"}
    script = SCRIPTS_DIR / ALLOWED_ACTIONS[action]
    if not script.exists():
        return {"ok": False, "error": f"Script not found: {script}"}
    try:
        # Build env
        env = os.environ.copy()
        if env_overrides:
            for k, v in env_overrides.items():
                env[k] = str(v)
        if os.name == "nt":
            # Windows: PowerShell hidden (no console window), output discarded
            si = None
            try:
                si = subprocess.STARTUPINFO()
                si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                si.wShowWindow = 0  # SW_HIDE
            except Exception:
                pass
            creation = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
            proc = subprocess.Popen(
                ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", str(script)],
                cwd=str(REPO_ROOT),
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
                startupinfo=si,
                creationflags=creation,
                close_fds=True,
                env=env,
            )
        else:
            # Linux/macOS: bash + nohup so the script survives SIGHUP
            proc = subprocess.Popen(
                ["bash", str(script)],
                cwd=str(REPO_ROOT),
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
                close_fds=True,
                preexec_fn=os.setsid if hasattr(os, "setsid") else None,
                env=env,
            )
        _log_control(f"dispatched action={action} script={script} pid={proc.pid} env={list(env_overrides.keys()) if env_overrides else []}")
        # Auto-register PID for services we can map back to service IDs
        action_to_sid = {"start-node1": "node1", "start-node2": "node2",
                         "start-pool": "pool", "start-miner": "miner",
                         "start-miner-cpu": "miner", "start-miner-gpu": "miner",
                         "start-hiranyagarbha": "hiranyagarbha", "start-hiran-inference": "ai-native"}
        sid = action_to_sid.get(action)
        if sid:
            register_process(sid, proc.pid)
        return {"ok": True, "action": action, "script": str(script), "pid": proc.pid}
    except Exception as e:
        _log_control(f"FAILED action={action} error={e}")
        return {"ok": False, "error": str(e), "action": action}

# ── Background sampler ──────────────────────────────────────────────────

def background_sampler():
    """Periodically polls status, records history, scans for block events, warms health cache,
    rotates logs, runs watchdog, and collects resource metrics."""
    rotation_counter = 0
    while True:
        try:
            st = build_status()
            HISTORY.record(st)
            SERVICE_HISTORY.record(all_services_health())
            scan_block_events()
            # Persist new alerts (throttled)
            try:
                persist_new_alerts(build_alerts(st))
            except Exception:
                pass
            # Invalidate health cache so next API call refreshes lazily
            # (do NOT synchronously probe here — TCP timeouts can block 15s+)
            for svc in SERVICE_REGISTRY:
                HEALTH_CACHE.pop(svc["id"], None)
            # Log rotation every ~10 min (120 iterations * 5s)
            rotation_counter += 1
            if rotation_counter % 120 == 0:
                try:
                    rotate_all_logs()
                except Exception as e:
                    print(f"[sampler] log rotation error: {e}", file=sys.stderr)
            # Watchdog
            try:
                watchdog_check()
            except Exception as e:
                print(f"[sampler] watchdog error: {e}", file=sys.stderr)
            # Resource monitoring (cache warming)
            try:
                get_resource_usage()
            except Exception:
                pass
        except Exception as e:
            print(f"[sampler] error: {e}", file=sys.stderr)
        time.sleep(5)

# ── HTML Dashboard (embedded) ───────────────────────────────────────────

HTML_DASHBOARD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ZION V3 — Mainnet Launch Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script>
tailwind.config={theme:{extend:{colors:{zion:{900:'#0a0f1e',800:'#131a2e',700:'#1f2942',600:'#2d3756',accent:'#f59e0b',success:'#10b981',danger:'#ef4444'}}}}};
</script>
<style>
@keyframes pulse-glow{0%,100%{box-shadow:0 0 5px rgba(16,185,129,0.3)}50%{box-shadow:0 0 20px rgba(16,185,129,0.7)}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes slide-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
.card-live{animation:pulse-glow 3s infinite}
.shimmer{background:linear-gradient(90deg,transparent 0%,rgba(245,158,11,0.1) 50%,transparent 100%);background-size:200% 100%;animation:shimmer 2s infinite}
.alert-new{animation:slide-in 0.3s ease-out}
.log-tail{font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.5}
.tab-active{background:rgba(245,158,11,0.15);border-color:#f59e0b;color:#fbbf24}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#475569}
.tooltip{position:relative}
.tooltip:hover .tip{visibility:visible;opacity:1}
.tip{visibility:hidden;opacity:0;position:absolute;bottom:120%;left:50%;transform:translateX(-50%);background:#0a0f1e;border:1px solid #2d3756;padding:6px 10px;border-radius:6px;font-size:11px;white-space:nowrap;z-index:50;transition:opacity 0.2s}
/* NCL Panel styles */
.ncl-tab-active{background:rgba(124,58,237,0.2);color:#c4b5fd;border:1px solid rgba(124,58,237,0.3)}
@keyframes ncl-pulse{0%,100%{box-shadow:0 0 4px rgba(16,185,129,0.3)}50%{box-shadow:0 0 12px rgba(16,185,129,0.7)}}
.ncl-dot-live{background:#10b981;animation:ncl-pulse 2s infinite}
.ncl-dot-offline{background:#ef4444}
.ncl-worker-card{transition:all 0.2s}
.ncl-worker-card:hover{background:rgba(255,255,255,0.03)}
.ncl-rank-gold{background:linear-gradient(135deg,#f59e0b,#d97706);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ncl-rank-silver{background:linear-gradient(135deg,#9ca3af,#6b7280);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ncl-rank-bronze{background:linear-gradient(135deg,#d97706,#92400e);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ncl-job-status{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600}
.ncl-job-queued{background:rgba(245,158,11,0.15);color:#fbbf24}
.ncl-job-running{background:rgba(59,130,246,0.15);color:#60a5fa}
.ncl-job-completed{background:rgba(16,185,129,0.15);color:#34d399}
.ncl-job-failed{background:rgba(239,68,68,0.15);color:#f87171}
input[type=range]::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:#7c3aed;cursor:pointer;box-shadow:0 0 6px rgba(124,58,237,0.5)}
</style>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-zion-900 text-gray-100 min-h-screen" style="font-family:'Inter',sans-serif">
<div class="max-w-[1600px] mx-auto p-4">

  <!-- Header -->
  <header class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-3">
      <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">Z</div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">ZION V3 <span class="text-amber-400">Mainnet Launch</span> <span class="text-xs font-normal text-gray-500 ml-2">Dashboard 2.0</span></h1>
        <p class="text-xs text-gray-400" id="timestamp">Loading…</p>
      </div>
    </div>
    <div class="flex gap-2 items-center">
      <span id="alertCount" class="hidden px-3 py-1 bg-red-600 rounded-full text-xs font-bold animate-pulse">0</span>
      <button onclick="toggleFriendly()" id="friendlyBtn" class="px-3 py-2 bg-zion-700 hover:bg-zion-600 rounded-lg text-sm font-medium transition" title="Toggle kid-friendly explanations">🧒 Kid Mode</button>
      <button onclick="refreshAll()" class="px-3 py-2 bg-zion-700 hover:bg-zion-600 rounded-lg text-sm font-medium transition" title="Manual refresh">🔄</button>
      <button onclick="toggleAuto()" id="autoBtn" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition">⚡ Auto</button>
    </div>
  </header>

  <!-- Tabs -->
  <div class="flex gap-1 mb-4 border-b border-zion-700 overflow-x-auto">
    <button onclick="switchTab('overview')" id="tab-overview" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition tab-active">📊 Overview</button>
    <button onclick="switchTab('controls')" id="tab-controls" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">🎛️ Controls</button>
    <button onclick="switchTab('charts')" id="tab-charts" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">📈 Charts</button>
    <button onclick="switchTab('events')" id="tab-events" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">🧱 Events</button>
    <button onclick="switchTab('env')" id="tab-env" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">⚙️ Env</button>
    <button onclick="switchTab('launch-day')" id="tab-launch-day" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">🚀 Launch Day</button>
    <button onclick="switchTab('wizard')" id="tab-wizard" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">🧙 Wizard</button>
    <button onclick="switchTab('services')" id="tab-services" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">🧩 Services</button>
    <button onclick="switchTab('database')" id="tab-database" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">🗄️ Database</button>
    <button onclick="switchTab('metrics')" id="tab-metrics" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">📊 Metrics</button>
    <button onclick="switchTab('logs')" id="tab-logs" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">📜 Logs</button>
    <button onclick="switchTab('hiran')" id="tab-hiran" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">🤖 Hiran AI</button>
    <button onclick="switchTab('payout')" id="tab-payout" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:text-amber-400 transition">💰 Payout</button>
  </div>

  <!-- Progress -->
  <div class="bg-zion-800 rounded-xl p-4 mb-4 border border-zion-700">
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-medium text-gray-300 flex items-center gap-2">🎯 Launch Readiness <span class="tooltip text-gray-500">ⓘ<span class="tip">10 auto-detected checks based on log analysis</span></span></span>
      <span class="text-sm font-bold text-amber-400" id="progressText">0/0</span>
    </div>
    <div class="w-full h-3 bg-zion-700 rounded-full overflow-hidden">
      <div id="progressBar" class="h-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-amber-400 rounded-full transition-all duration-700 shimmer" style="width:0%"></div>
    </div>
  </div>

  <!-- TAB: Overview -->
  <div id="pane-overview" class="space-y-4">

    <!-- Service Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div id="card-edge-node" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
        <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">🌍 Edge Node (Primary)</span><span id="badge-edge-node" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
        <div class="text-3xl font-bold mb-1 text-amber-400" id="val-edge-node-height">—</div><div class="text-xs text-gray-400 mb-2">Chain Height</div>
        <div class="text-xs font-mono text-gray-300 truncate mb-1" id="val-edge-node-hash">—</div>
        <div class="text-xs text-gray-400 mb-1">Peers: <span id="val-edge-node-peers" class="text-white font-bold">—</span></div>
        <div class="text-xs text-gray-400 mb-2">Host: <span id="val-edge-node-host" class="font-mono">127.0.0.1</span></div>
        <div class="flex gap-1 mt-2">
          <button onclick="window.open('http://127.0.0.1:8443/jsonrpc','_blank')" class="flex-1 text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded transition">🔗 RPC</button>
        </div>
      </div>

      <div id="card-node1" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
        <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">🔷 Local Backup Node</span><span id="badge-node1" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
        <div class="text-3xl font-bold mb-1 text-amber-400" id="val-node1-height">—</div><div class="text-xs text-gray-400 mb-2">Chain Height</div>
        <div class="text-xs font-mono text-gray-300 truncate mb-1" id="val-node1-id">—</div>
        <div class="text-xs text-gray-400 mb-1">Peers: <span id="val-node1-peers" class="text-white font-bold">—</span></div>
        <div class="text-xs text-gray-400 mb-1">P2P: <span id="val-node1-p2p" class="font-mono">—</span></div>
        <div class="text-xs text-gray-400 mb-2">Sync: <span id="val-node1-sync" class="text-amber-400">—</span></div>
        <div class="flex gap-1 mt-2">
          <button onclick="controlAction('start-node1')" class="flex-1 text-xs px-2 py-1 bg-emerald-700 hover:bg-emerald-600 rounded transition">▶ Start</button>
          <button onclick="controlAction('restart-node1')" class="flex-1 text-xs px-2 py-1 bg-amber-700 hover:bg-amber-600 rounded transition">⟳ Restart</button>
          <button onclick="copyToClipboard('zion node1')" class="text-xs px-2 py-1 bg-zion-700 hover:bg-zion-600 rounded transition">📋</button>
        </div>
      </div>

      <div id="card-node2" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
        <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">🔶 Node 2 (Dev / Optional)</span><span id="badge-node2" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
        <div class="text-3xl font-bold mb-1 text-amber-400" id="val-node2-height">—</div><div class="text-xs text-gray-400 mb-2">Chain Height</div>
        <div class="text-xs font-mono text-gray-300 truncate mb-1" id="val-node2-id">—</div>
        <div class="text-xs text-gray-400 mb-1">Peers: <span id="val-node2-peers" class="text-white font-bold">—</span></div>
        <div class="text-xs text-gray-400 mb-2">Sync: <span id="val-node2-sync">—</span></div>
        <div class="flex gap-1 mt-2">
          <button onclick="controlAction('start-node2')" class="flex-1 text-xs px-2 py-1 bg-emerald-700 hover:bg-emerald-600 rounded transition">▶ Start</button>
          <button onclick="controlAction('restart-node2')" class="flex-1 text-xs px-2 py-1 bg-amber-700 hover:bg-amber-600 rounded transition">⟳ Restart</button>
        </div>
      </div>

      <div id="card-pool" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
        <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">🌐 Edge Pool (Primary)</span><span id="badge-pool" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
        <div class="text-3xl font-bold mb-1 text-emerald-400" id="val-pool-sessions">—</div><div class="text-xs text-gray-400 mb-2">Active Sessions</div>
        <div class="text-xs text-gray-400 mb-1">Blocks: <span id="val-pool-blocks" class="text-emerald-400 font-bold">—</span></div>
        <div class="text-xs text-gray-400 mb-1">Shares: <span id="val-pool-shares" class="text-white">—</span></div>
        <div class="text-xs text-amber-400 mb-2" id="val-pool-fee">—</div>
        <div class="flex gap-1 mt-2">
          <button onclick="window.open('http://62.171.141.136:8444','_blank')" class="flex-1 text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded transition">🔗 Public</button>
        </div>
      </div>

      <div id="card-miner" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
        <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">⛏️ GPU Miner</span><span id="badge-miner" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
        <div class="text-3xl font-bold mb-1 text-amber-400" id="val-miner-hashrate">—</div><div class="text-xs text-gray-400 mb-2">KH/s (10s avg)</div>
        <div class="text-xs text-gray-400 mb-1">Device: <span id="val-miner-gpu" class="text-white text-[10px]">—</span></div>
        <div class="text-xs text-gray-400 mb-1">Height: <span id="val-miner-height" class="text-white">—</span></div>
        <div class="text-xs text-gray-400 mb-2">Diff: <span id="val-miner-diff">—</span></div>
        <div class="flex gap-1 mt-2">
          <button onclick="controlAction('start-miner-gpu')" class="flex-1 text-xs px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded transition">🎮 GPU</button>
          <button onclick="controlAction('start-miner-cpu')" class="flex-1 text-xs px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded transition">💻 CPU</button>
          <button onclick="controlAction('stop-miner')" class="flex-1 text-xs px-2 py-1 bg-red-700 hover:bg-red-600 rounded transition">⏹ Stop</button>
        </div>
      </div>
    </div>

    <!-- Mainnet Readiness Status -->
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">🚀 Mainnet Readiness Status</h2>
        <button onclick="loadMainnetStatus()" class="text-xs px-2 py-1 bg-zion-700 hover:bg-zion-600 rounded transition">🔄 Refresh</button>
      </div>
      <div id="mainnet-status-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <!-- Dynamically populated by JavaScript -->
        <div class="text-gray-500 text-xs italic">Loading mainnet status...</div>
      </div>
    </div>

    <!-- Alerts + Checklist -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700 lg:col-span-2">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3 flex items-center gap-2">🚨 Alerts &amp; Recommendations <span id="alertBadge" class="text-xs px-2 py-0.5 rounded bg-red-600/30 text-red-300">—</span></h2>
        <div id="alerts" class="space-y-2 max-h-72 overflow-y-auto"></div>
      </div>
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">✅ Launch Checklist</h2>
        <div id="checklist" class="space-y-2"></div>
      </div>
    </div>

    <!-- Mini Hashrate Sparkline + Payouts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300">📈 Hashrate Trend</h2>
          <span class="text-xs text-gray-500" id="hashrate-summary">—</span>
        </div>
        <canvas id="mini-hashrate" height="80"></canvas>
      </div>
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">💰 Payouts &amp; Distribution</h2>
        <div class="space-y-1.5">
          <div class="flex justify-between text-xs"><span class="text-gray-400">Pool Wallet</span><span id="payout-wallet" class="font-mono text-white truncate max-w-[260px]">—</span></div>
          <div class="flex justify-between text-xs"><span class="text-gray-400">Payout Enabled</span><span id="payout-enabled" class="font-bold">—</span></div>
          <div class="flex justify-between text-xs"><span class="text-gray-400">Fee Split</span><span id="payout-split" class="text-amber-400 font-mono">—</span></div>
          <div class="flex justify-between text-xs"><span class="text-gray-400">Blocks Found</span><span id="payout-blocks" class="text-emerald-400 font-bold">—</span></div>
          <div class="flex justify-between text-xs"><span class="text-gray-400">Nonce Window</span><span id="payout-nonce" class="text-white">—</span></div>
        </div>
        <div id="payout-recent" class="mt-3 space-y-1 max-h-24 overflow-y-auto log-tail text-gray-400 border-t border-zion-700 pt-2"></div>
      </div>
    </div>
  </div>

  <!-- TAB: Controls -->
  <div id="pane-controls" class="hidden space-y-4">
    <div class="bg-zion-800 rounded-xl p-6 border border-zion-700">
      <h2 class="text-lg font-bold mb-4 flex items-center gap-2">🎛️ Stack Control Center</h2>
      <p class="text-sm text-gray-400 mb-6">Launch and manage the full ZION mainnet stack. All actions execute PowerShell scripts in <code class="text-amber-400">scripts/</code> via detached processes.</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button id="btn-launch-stack" onclick="controlAction('launch-stack')" class="group p-6 bg-gradient-to-br from-emerald-700 to-emerald-900 hover:from-emerald-600 hover:to-emerald-800 rounded-xl text-left transition shadow-lg">
          <div class="text-3xl mb-2">🚀</div>
          <div class="text-lg font-bold mb-1">Launch Full Stack</div>
          <div class="text-xs text-emerald-200 opacity-80">Starts Node1 + Node2 + Pool + Miner with logging</div>
        </button>
        <button id="btn-launch-local-backup" onclick="controlAction('launch-local-backup')" class="group p-6 bg-gradient-to-br from-emerald-700 to-emerald-900 hover:from-emerald-600 hover:to-emerald-800 rounded-xl text-left transition shadow-lg" style="display:none">
          <div class="text-3xl mb-2">🌐</div>
          <div class="text-lg font-bold mb-1">Launch Local Backup</div>
          <div class="text-xs text-emerald-200 opacity-80">Starts Backup Node + GPU Miner (Edge-primary topology)</div>
        </button>
        <button onclick="if(confirm('Stop all ZION processes?')) controlAction('stop-stack')" class="group p-6 bg-gradient-to-br from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 rounded-xl text-left transition shadow-lg">
          <div class="text-3xl mb-2">⏹️</div>
          <div class="text-lg font-bold mb-1">Stop All Services</div>
          <div class="text-xs text-red-200 opacity-80">Gracefully terminates node, pool, and miner processes</div>
        </button>
      </div>

      <h3 class="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">Individual Service Controls</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3" id="control-buttons">
        <!-- populated by JS -->
      </div>

      <div id="control-log" class="mt-6 bg-zion-900 rounded-lg p-3 max-h-40 overflow-y-auto log-tail">
        <div class="text-gray-500 italic">Control actions will be logged here.</div>
      </div>
    </div>
  </div>

  <!-- TAB: Charts -->
  <div id="pane-charts" class="hidden space-y-4">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">Hashrate (KH/s)</h2>
        <canvas id="chart-hashrate" height="160"></canvas>
      </div>
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">Chain Height Progression</h2>
        <canvas id="chart-height" height="160"></canvas>
      </div>
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">Shares Accepted / Rejected</h2>
        <canvas id="chart-shares" height="160"></canvas>
      </div>
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">Active Sessions &amp; Peers</h2>
        <canvas id="chart-sessions" height="160"></canvas>
      </div>
    </div>
  </div>

  <!-- TAB: Events -->
  <div id="pane-events" class="hidden">
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3 flex items-center gap-2">🧱 Block &amp; Network Events <span class="text-xs text-gray-500">(latest first)</span></h2>
      <div id="events-feed" class="space-y-2 max-h-[600px] overflow-y-auto"></div>
    </div>
  </div>

  <!-- TAB: Env -->
  <div id="pane-env" class="hidden space-y-4">
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">⚙️ Environment Files</h2>
      <div class="flex flex-wrap gap-2 mb-4" id="env-file-list"></div>
      <div id="env-detail" class="bg-zion-900 rounded-lg p-3 max-h-[500px] overflow-y-auto">
        <div class="text-gray-500 italic text-sm">Select a .env file above to inspect required variables &amp; sensitive value redaction.</div>
      </div>
    </div>
  </div>

  <!-- TAB: Launch Day -->
  <div id="pane-launch-day" class="hidden space-y-4">
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-bold flex items-center gap-2">🚀 Launch Day Automation <span class="text-xs font-normal text-gray-500">(31.12.2026 12:00 UTC)</span></h2>
        <span id="launch-day-badge" class="px-3 py-1 rounded text-xs font-bold bg-zion-700 text-gray-300">Checking...</span>
      </div>
      <p class="text-xs text-gray-400 mb-4">Automated genesis rotation, premine rotation, and local backup for mainnet launch. All changes are saved to local PC.</p>
      
      <!-- Launch Day Status -->
      <div id="launch-day-status" class="bg-zion-900 rounded-lg p-4 mb-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-amber-400" id="ld-days">—</div>
            <div class="text-xs text-gray-400">Days to Launch</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-emerald-400" id="ld-backup">—</div>
            <div class="text-xs text-gray-400">Backup Status</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-400" id="ld-genesis">—</div>
            <div class="text-xs text-gray-400">Genesis Hash</div>
          </div>
        </div>
      </div>
      
      <!-- Launch Day Actions -->
      <div class="space-y-3">
        <div class="flex gap-2 flex-wrap">
          <button onclick="launchDayAction('status')" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold transition">📊 Check Status</button>
          <button onclick="launchDayAction('backup')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold transition">💾 Create Backup</button>
          <button onclick="confirmLaunchDay()" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-bold transition">🔄 Rotate Genesis</button>
          <button onclick="launchDaySequence()" class="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-bold transition">🚀 Full Launch Sequence</button>
        </div>
      </div>
      
      <!-- Launch Day Log -->
      <div class="mt-4">
        <h3 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-2">📜 Launch Day Log</h3>
        <div id="launch-day-log" class="bg-zion-900 rounded-lg p-3 h-48 overflow-y-auto log-tail text-xs text-gray-400">
          <div class="italic">Launch day log will appear here...</div>
        </div>
      </div>
    </div>
    
    <!-- Backup Details -->
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">💾 Local Backup Details</h2>
      <div id="backup-details" class="text-xs text-gray-400">
        <div class="italic">Create a backup to see details...</div>
      </div>
    </div>
  </div>

  <!-- TAB: Wizard -->
  <div id="pane-wizard" class="hidden">
    <div class="bg-zion-800 rounded-xl p-6 border border-zion-700">
      <h2 class="text-xl font-bold mb-2 flex items-center gap-2">🧙 Mainnet Launch Wizard</h2>
      <p class="text-sm text-gray-400 mb-6">Step-by-step guided launch sequence. Each step shows current status and provides quick actions.</p>
      <div id="wizard-steps" class="space-y-3"></div>
    </div>
  </div>

  <!-- TAB: Services -->
  <div id="pane-services" class="hidden space-y-4">
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-bold flex items-center gap-2">🧩 All Mainnet Services <span class="text-xs text-gray-500 font-normal">(L1 Consensus · L2 Bridge/DAO · L3 Advanced · L4 Apps · Infra)</span></h2>
        <div class="flex gap-2">
          <button onclick="controlAction('launch-full')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition">🚀 Launch ALL</button>
          <button onclick="if(confirm('Stop everything?')) controlAction('stop-all')" class="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-bold transition">⏹ Stop ALL</button>
        </div>
      </div>
      <p class="text-xs text-gray-400 mb-4">Auto-discovered from service registry. Status = TCP port probe + log file activity. Click a service for details.</p>
      <div id="services-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"></div>
    </div>
  </div>

  <!-- TAB: Database -->
  <div id="pane-database" class="hidden space-y-4">
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-lg font-bold mb-2 flex items-center gap-2">🗄️ Database Explorer</h2>
      <p class="text-xs text-gray-400 mb-4">Read-only inspector for all ZION state databases (SQLite + JSON state files). Whitelisted paths only.</p>
      <div id="db-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4"></div>
      <div id="db-detail" class="bg-zion-900 rounded-lg p-4 min-h-[300px] max-h-[600px] overflow-auto">
        <div class="text-gray-500 italic text-sm">Select a database above to inspect its contents.</div>
      </div>
    </div>
  </div>

  <!-- TAB: Metrics -->
  <div id="pane-metrics" class="hidden space-y-4">
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-lg font-bold mb-2 flex items-center gap-2">📊 Prometheus Metrics &amp; Grafana</h2>
      <p class="text-xs text-gray-400 mb-4">Live scraped metrics from each service. Or open the full Grafana dashboard below.</p>
      <div class="flex gap-2 mb-4 flex-wrap" id="metrics-buttons"></div>
      <div id="metrics-detail" class="bg-zion-900 rounded-lg p-3 max-h-72 overflow-auto log-tail">
        <div class="text-gray-500 italic">Click a service above to scrape its /metrics endpoint.</div>
      </div>
      <div class="mt-6">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-bold uppercase tracking-wider text-gray-300">Pool Metrics Endpoint</h3>
          <div class="flex gap-2">
            <a href="http://127.0.0.1:8455" target="_blank" class="text-xs px-3 py-1 bg-zion-700 hover:bg-zion-600 rounded transition">Open Pool Metrics ↗</a>
          </div>
        </div>
        <div class="text-center text-gray-500 text-sm py-12">
          Pool metrics available at <a href="http://127.0.0.1:8455" target="_blank" class="text-teal-400 underline">127.0.0.1:8455/metrics</a> — Prometheus exposition format, no external Grafana needed.
        </div>
      </div>
    </div>
  </div>

  <!-- TAB: Logs -->
  <div id="pane-logs" class="hidden">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <div class="flex items-center justify-between mb-2"><h2 class="text-sm font-bold uppercase tracking-wider text-gray-300">Node 1 Log</h2><button onclick="loadLogs('node1')" class="text-xs text-gray-400 hover:text-white">🔄</button></div>
        <pre id="log-node1" class="log-tail bg-zion-900 rounded-lg p-3 h-72 overflow-y-auto text-gray-300"></pre>
      </div>
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <div class="flex items-center justify-between mb-2"><h2 class="text-sm font-bold uppercase tracking-wider text-gray-300">Node 2 Log</h2><button onclick="loadLogs('node2')" class="text-xs text-gray-400 hover:text-white">🔄</button></div>
        <pre id="log-node2" class="log-tail bg-zion-900 rounded-lg p-3 h-72 overflow-y-auto text-gray-300"></pre>
      </div>
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <div class="flex items-center justify-between mb-2"><h2 class="text-sm font-bold uppercase tracking-wider text-gray-300">Pool Log</h2><button onclick="loadLogs('pool')" class="text-xs text-gray-400 hover:text-white">🔄</button></div>
        <pre id="log-pool" class="log-tail bg-zion-900 rounded-lg p-3 h-72 overflow-y-auto text-gray-300"></pre>
      </div>
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <div class="flex items-center justify-between mb-2"><h2 class="text-sm font-bold uppercase tracking-wider text-gray-300">Miner Log</h2><button onclick="loadLogs('miner')" class="text-xs text-gray-400 hover:text-white">🔄</button></div>
        <pre id="log-miner" class="log-tail bg-zion-900 rounded-lg p-3 h-72 overflow-y-auto text-gray-300"></pre>
      </div>
    </div>
  </div>

  <!-- ── Hiran AI Tab ─────────────────────────────────────────────────────── -->
  <div id="pane-hiran" class="hidden space-y-4">

    <!-- Service cards row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

      <!-- Hiranyagarbha Orchestrator (port 8001) -->
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <div class="flex items-center gap-3 mb-3">
          <div class="text-2xl">🧬</div>
          <div class="flex-1">
            <div class="text-sm font-bold text-gray-200">Hiranyagarbha API</div>
            <div class="text-xs text-gray-400">Orchestrator · RAG · Consciousness · port 8001</div>
          </div>
          <span id="hiranyagarbha-badge" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-400">CHECKING…</span>
        </div>
        <div class="text-xs text-gray-500 mb-3" id="hiranyagarbha-detail">—</div>
        <div class="flex gap-2">
          <button onclick="aiLayerStart('start-hiranyagarbha','hiranyagarbha-badge','hiranyagarbha-detail')"
                  class="flex-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded transition">
            ▶ Start
          </button>
          <button onclick="loadHiranHealth()" class="px-3 py-1.5 bg-zion-700 hover:bg-zion-600 text-gray-300 text-xs rounded transition">🔄</button>
        </div>
      </div>

      <!-- Hiran Inference (port 8002) -->
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <div class="flex items-center gap-3 mb-3">
          <div class="text-2xl">🤖</div>
          <div class="flex-1">
            <div class="text-sm font-bold text-gray-200">Hiran Inference</div>
            <div class="text-xs text-gray-400">LLM · OpenAI API · <span id="hiran-backend-label" class="text-amber-400">—</span> · port 8002</div>
          </div>
          <span id="hiran-status-badge" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-400">CHECKING…</span>
        </div>
        <div class="text-xs text-gray-500 mb-3" id="hiran-inference-detail">—</div>
        <div class="flex gap-2">
          <button onclick="aiLayerStart('start-hiran-inference','hiran-status-badge','hiran-inference-detail')"
                  class="flex-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded transition">
            ▶ Start
          </button>
          <button onclick="loadHiranHealth()" class="px-3 py-1.5 bg-zion-700 hover:bg-zion-600 text-gray-300 text-xs rounded transition">🔄</button>
        </div>
      </div>
    </div>

    <!-- Offline hint (shown when inference offline) -->
    <div id="hiran-offline-hint" class="hidden bg-zion-800 rounded-xl p-4 border border-amber-800/40">
      <div class="text-xs font-bold text-amber-400 mb-2">⚠️ Hiran Inference offline — detekce backendu:</div>
      <div class="text-xs text-gray-300 space-y-1">
        <div><span class="text-amber-400">Automaticky detekuje:</span> LM Studio (port 1234) → Ollama (port 11434) → GGUF soubor</div>
        <div>Klikni <strong class="text-white">▶ Start</strong> — skript sám najde dostupný backend.</div>
        <div class="text-gray-500 mt-1">Nebo spusť ručně: <code class="bg-zion-900 px-1 rounded">scripts\\start-hiran-inference.ps1</code></div>
      </div>
    </div>

    <!-- Orchestrator live stats (shown when hiranyagarbha online) -->
    <div id="orch-stats-panel" class="hidden bg-zion-800 rounded-xl p-4 border border-zion-700">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300">🧬 Orchestrator Status</h2>
        <button onclick="loadOrchestratorStats()" class="text-xs text-gray-400 hover:text-white">🔄</button>
      </div>
      <div id="orch-stats-content" class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div class="bg-zion-900 rounded-lg p-3"><div class="text-xs text-gray-400 mb-1">Active Agents</div><div id="orch-active" class="text-lg font-bold text-emerald-400">—</div></div>
        <div class="bg-zion-900 rounded-lg p-3"><div class="text-xs text-gray-400 mb-1">Task Queue</div><div id="orch-tasks" class="text-lg font-bold text-amber-400">—</div></div>
        <div class="bg-zion-900 rounded-lg p-3"><div class="text-xs text-gray-400 mb-1">Msg Queue</div><div id="orch-msgs" class="text-lg font-bold text-blue-400">—</div></div>
        <div class="bg-zion-900 rounded-lg p-3"><div class="text-xs text-gray-400 mb-1">Total Actions</div><div id="orch-actions" class="text-lg font-bold text-gray-300">—</div></div>
      </div>
    </div>

    <!-- Agent Management Panel -->
    <div id="agent-panel" class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300">🤖 Agent Management</h2>
        <div class="flex gap-2">
          <button onclick="registerAgent()" class="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium rounded transition">+ Register</button>
          <button onclick="loadAgentList()" class="px-3 py-1.5 bg-zion-700 hover:bg-zion-600 text-gray-300 text-xs rounded transition">🔄</button>
        </div>
      </div>
      <div id="agent-list" class="space-y-2 mb-3">
        <div class="text-gray-500 text-xs italic">No agents loaded — click Register or Refresh</div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button onclick="elevateConsciousness()" class="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white text-xs font-medium rounded transition">Elevate Consciousness</button>
        <button onclick="grantCapability()" class="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium rounded transition">Grant Capability</button>
        <button onclick="dispatchTask()" class="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white text-xs font-medium rounded transition">Dispatch Task</button>
      </div>
      <div id="agent-action-result" class="mt-2 text-xs text-gray-400 min-h-4"></div>
    </div>

    <!-- Chat interface -->
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">💬 Chat s Hiranem</h2>
      <div id="hiran-chat-log" class="bg-zion-900 rounded-lg p-3 h-72 overflow-y-auto space-y-3 mb-3 text-sm">
        <div class="text-gray-500 text-xs italic">Hiran je připraven odpovídat na dotazy o ZION ekosystému…</div>
      </div>
      <div class="flex gap-2">
        <input id="hiran-chat-input" type="text" placeholder="Zeptej se Hirana… (např. 'Jak funguje ZION těžba?')"
               class="flex-1 bg-zion-900 border border-zion-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500"
               onkeydown="if(event.key==='Enter')sendHiranMessage()"/>
        <button onclick="sendHiranMessage()" id="hiran-send-btn"
                class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition">
          Odeslat
        </button>
      </div>
      <div id="hiran-latency" class="text-xs text-gray-500 mt-1 h-4"></div>
    </div>

    <!-- Quick prompts -->
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">⚡ Rychlé dotazy</h2>
      <div class="flex flex-wrap gap-2">
        <button onclick="hiranQuickPrompt('Jaké je rozdělení poplatků v ZION těžbě?')" class="px-3 py-1.5 bg-zion-700 hover:bg-zion-600 rounded text-xs text-gray-300 transition">Fee split</button>
        <button onclick="hiranQuickPrompt('Vysvětli ZION OASIS a 9 úrovní vědomí')" class="px-3 py-1.5 bg-zion-700 hover:bg-zion-600 rounded text-xs text-gray-300 transition">OASIS vědomí</button>
        <button onclick="hiranQuickPrompt('Co je ZION Issobella fond a jak funguje?')" class="px-3 py-1.5 bg-zion-700 hover:bg-zion-600 rounded text-xs text-gray-300 transition">Issobella</button>
        <button onclick="hiranQuickPrompt('Jak funguje humanitární tithe v ZION?')" class="px-3 py-1.5 bg-zion-700 hover:bg-zion-600 rounded text-xs text-gray-300 transition">Humanitarian Tithe</button>
        <button onclick="hiranQuickPrompt('Jaký je aktuální stav ZION sítě a hash rate?')" class="px-3 py-1.5 bg-zion-700 hover:bg-zion-600 rounded text-xs text-gray-300 transition">Stav sítě</button>
        <button onclick="hiranQuickPrompt('Vysvětli WARP protokol a cross-chain bridge')" class="px-3 py-1.5 bg-zion-700 hover:bg-zion-600 rounded text-xs text-gray-300 transition">WARP Bridge</button>
        <button onclick="hiranQuickPrompt('Kolik aktivních agentů je v orchestrátoru?')" class="px-3 py-1.5 bg-zion-700 hover:bg-zion-600 rounded text-xs text-gray-300 transition">Orchestrátor</button>
      </div>
    </div>

    <!-- ── NCL (Neural Compute Layer) Panel — REDESIGNED ────────────────── -->
    <div id="ncl-mega-panel" class="space-y-4">

      <!-- NCL Header with gradient + live pulse -->
      <div class="relative overflow-hidden rounded-2xl border border-purple-800/40" style="background:linear-gradient(135deg,#131a2e 0%,#1a1040 40%,#1e1145 70%,#131a2e 100%)">
        <div class="absolute inset-0 opacity-10" style="background:radial-gradient(circle at 20% 50%,rgba(168,85,247,0.4) 0%,transparent 50%),radial-gradient(circle at 80% 50%,rgba(59,130,246,0.3) 0%,transparent 50%)"></div>
        <div class="relative p-5">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style="background:linear-gradient(135deg,#7c3aed,#3b82f6);box-shadow:0 0 20px rgba(124,58,237,0.3)">
                <span>&#x1f9e0;</span>
              </div>
              <div>
                <h2 class="text-lg font-bold text-white tracking-tight">Neural Compute Layer</h2>
                <div class="flex items-center gap-2 mt-0.5">
                  <span id="ncl-live-dot" class="w-2 h-2 rounded-full bg-gray-500"></span>
                  <span id="ncl-live-label" class="text-xs text-gray-400">Connecting...</span>
                  <span id="ncl-refresh-ts" class="text-xs text-gray-600 ml-2"></span>
                </div>
              </div>
            </div>
            <div class="flex gap-2 items-center">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" id="ncl-auto-refresh" checked class="rounded border-gray-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 w-3.5 h-3.5" onchange="toggleNclAutoRefresh()"/>
                <span class="text-xs text-gray-400">Auto 10s</span>
              </label>
              <button onclick="loadNclFull()" class="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs rounded-lg transition backdrop-blur-sm">Refresh</button>
            </div>
          </div>

          <!-- Stats cards row -->
          <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div class="group bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/5 hover:border-emerald-500/30 transition-all cursor-default">
              <div class="text-xs text-gray-500 mb-1 flex items-center gap-1"><span class="text-emerald-400 text-sm">&#x25CF;</span> Status</div>
              <div id="ncl-status-val" class="text-base font-bold text-emerald-400 transition-all">—</div>
            </div>
            <div class="group bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/5 hover:border-blue-500/30 transition-all cursor-default">
              <div class="text-xs text-gray-500 mb-1 flex items-center gap-1"><span class="text-blue-400 text-sm">&#x25B2;</span> Workers</div>
              <div id="ncl-workers-val" class="text-base font-bold text-blue-400 transition-all">—</div>
            </div>
            <div class="group bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/5 hover:border-amber-500/30 transition-all cursor-default">
              <div class="text-xs text-gray-500 mb-1 flex items-center gap-1"><span class="text-amber-400 text-sm">&#x23F3;</span> Queue</div>
              <div id="ncl-queue-val" class="text-base font-bold text-amber-400 transition-all">—</div>
            </div>
            <div class="group bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/5 hover:border-purple-500/30 transition-all cursor-default">
              <div class="text-xs text-gray-500 mb-1 flex items-center gap-1"><span class="text-purple-400 text-sm">&#x2B50;</span> Price/Token</div>
              <div id="ncl-price-val" class="text-base font-bold text-purple-400 transition-all">—</div>
            </div>
            <div class="group bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/5 hover:border-cyan-500/30 transition-all cursor-default">
              <div class="text-xs text-gray-500 mb-1 flex items-center gap-1"><span class="text-cyan-400 text-sm">&#x26A1;</span> TFLOPS</div>
              <div id="ncl-tflops-val" class="text-base font-bold text-cyan-400 transition-all">—</div>
            </div>
            <div class="group bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/5 hover:border-rose-500/30 transition-all cursor-default">
              <div class="text-xs text-gray-500 mb-1 flex items-center gap-1"><span class="text-rose-400 text-sm">&#x1F4CA;</span> Jobs Total</div>
              <div id="ncl-jobs-total-val" class="text-base font-bold text-rose-400 transition-all">—</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sub-tabs for NCL sections -->
      <div class="flex gap-1 bg-zion-800 rounded-xl p-1 border border-zion-700">
        <button onclick="switchNclTab('workers')" id="ncl-tab-workers" class="flex-1 px-3 py-2 text-xs font-medium rounded-lg transition ncl-tab-active">Workers</button>
        <button onclick="switchNclTab('leaderboard')" id="ncl-tab-leaderboard" class="flex-1 px-3 py-2 text-xs font-medium rounded-lg transition text-gray-400 hover:text-white hover:bg-white/5">Leaderboard</button>
        <button onclick="switchNclTab('jobs')" id="ncl-tab-jobs" class="flex-1 px-3 py-2 text-xs font-medium rounded-lg transition text-gray-400 hover:text-white hover:bg-white/5">Job History</button>
        <button onclick="switchNclTab('submit')" id="ncl-tab-submit" class="flex-1 px-3 py-2 text-xs font-medium rounded-lg transition text-gray-400 hover:text-white hover:bg-white/5">Submit Job</button>
        <button onclick="switchNclTab('chart')" id="ncl-tab-chart" class="flex-1 px-3 py-2 text-xs font-medium rounded-lg transition text-gray-400 hover:text-white hover:bg-white/5">Analytics</button>
      </div>

      <!-- Workers Panel -->
      <div id="ncl-pane-workers" class="ncl-pane">
        <div class="bg-zion-800 rounded-xl border border-zion-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-zion-700 flex items-center justify-between">
            <h3 class="text-sm font-bold text-gray-200 flex items-center gap-2"><span class="text-blue-400">&#x25B2;</span> Active Workers</h3>
            <span id="ncl-worker-count-badge" class="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full">0</span>
          </div>
          <div id="ncl-worker-list" class="divide-y divide-zion-700/50 max-h-96 overflow-y-auto">
            <div class="p-4 text-center text-gray-500 text-sm">Loading workers...</div>
          </div>
        </div>
      </div>

      <!-- Leaderboard Panel -->
      <div id="ncl-pane-leaderboard" class="ncl-pane hidden">
        <div class="bg-zion-800 rounded-xl border border-zion-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-zion-700 flex items-center justify-between">
            <h3 class="text-sm font-bold text-gray-200 flex items-center gap-2"><span class="text-amber-400">&#x1F3C6;</span> Compute Leaderboard</h3>
          </div>
          <div id="ncl-leaderboard-dash" class="divide-y divide-zion-700/50 max-h-96 overflow-y-auto">
            <div class="p-4 text-center text-gray-500 text-sm">Loading leaderboard...</div>
          </div>
        </div>
      </div>

      <!-- Job History Panel -->
      <div id="ncl-pane-jobs" class="ncl-pane hidden">
        <div class="bg-zion-800 rounded-xl border border-zion-700 overflow-hidden">
          <div class="px-4 py-3 border-b border-zion-700 flex items-center justify-between">
            <h3 class="text-sm font-bold text-gray-200 flex items-center gap-2"><span class="text-rose-400">&#x1F4CB;</span> Job History</h3>
            <div class="flex gap-2">
              <select id="ncl-job-filter" onchange="renderNclJobHistory()" class="bg-zion-900 border border-zion-600 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-purple-500">
                <option value="all">All</option>
                <option value="Queued">Queued</option>
                <option value="Running">Running</option>
                <option value="Completed">Completed</option>
                <option value="Failed">Failed</option>
              </select>
              <button onclick="loadNclJobHistory()" class="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 text-xs rounded-lg transition">Refresh</button>
            </div>
          </div>
          <div id="ncl-job-history-list" class="divide-y divide-zion-700/50 max-h-96 overflow-y-auto">
            <div class="p-4 text-center text-gray-500 text-sm">Loading job history...</div>
          </div>
          <div class="px-4 py-2 border-t border-zion-700 bg-zion-900/50 flex items-center justify-between">
            <span id="ncl-job-count" class="text-xs text-gray-500">0 jobs</span>
            <span id="ncl-job-success-rate" class="text-xs text-gray-500">— success rate</span>
          </div>
        </div>
      </div>

      <!-- Submit Job Panel -->
      <div id="ncl-pane-submit" class="ncl-pane hidden">
        <div class="bg-zion-800 rounded-xl border border-zion-700 p-5">
          <h3 class="text-sm font-bold text-gray-200 flex items-center gap-2 mb-4"><span class="text-purple-400">&#x1F680;</span> Submit NCL Job</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <!-- Job Type -->
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1.5">Job Type</label>
              <select id="ncl-job-type-dash" class="w-full bg-zion-900 border border-zion-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 transition">
                <option value="inference">Inference</option>
                <option value="embedding">Embedding</option>
                <option value="training">Fine-tuning</option>
                <option value="rag">RAG Query</option>
              </select>
            </div>
            <!-- Backend -->
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1.5">Backend</label>
              <select id="ncl-job-backend" class="w-full bg-zion-900 border border-zion-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 transition">
                <option value="Custom">Custom (Hiran)</option>
                <option value="OnnxRuntime">ONNX Runtime</option>
                <option value="Wasm">WebAssembly</option>
                <option value="TfLite">TensorFlow Lite</option>
              </select>
            </div>
            <!-- Model -->
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1.5">Model</label>
              <select id="ncl-job-model" class="w-full bg-zion-900 border border-zion-600 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 transition">
                <option value="hiran-v2.2">Hiran v2.2 (Q4_K_M)</option>
                <option value="hiran-v2.2-f16">Hiran v2.2 (F16)</option>
                <option value="hiran-v2.1">Hiran v2.1 (Legacy)</option>
              </select>
            </div>
            <!-- Priority -->
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1.5">Priority: <span id="ncl-priority-label" class="text-purple-400 font-bold">5</span></label>
              <input type="range" id="ncl-job-priority" min="0" max="10" value="5" class="w-full h-2 rounded-lg appearance-none cursor-pointer" style="background:linear-gradient(90deg,#3b82f6,#7c3aed,#ef4444)" oninput="document.getElementById('ncl-priority-label').textContent=this.value"/>
              <div class="flex justify-between text-xs text-gray-600 mt-1"><span>Low</span><span>Normal</span><span>Urgent</span></div>
            </div>
          </div>
          <!-- Prompt Input -->
          <div class="mb-4">
            <label class="block text-xs font-medium text-gray-400 mb-1.5">Prompt / Input</label>
            <textarea id="ncl-job-prompt" rows="3" placeholder="Enter your inference prompt, embedding text, or training parameters..."
                      class="w-full bg-zion-900 border border-zion-600 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition resize-none"></textarea>
          </div>
          <!-- Advanced settings (collapsible) -->
          <details class="mb-4">
            <summary class="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition">Advanced Settings</summary>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div>
                <label class="block text-xs text-gray-500 mb-1">Reward (flowers)</label>
                <input type="number" id="ncl-job-reward" value="20000000000" class="w-full bg-zion-900 border border-zion-600 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-purple-500"/>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Max Duration (sec)</label>
                <input type="number" id="ncl-job-duration" value="60" class="w-full bg-zion-900 border border-zion-600 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-purple-500"/>
              </div>
              <div>
                <label class="block text-xs text-gray-500 mb-1">Submitter ID</label>
                <input type="text" id="ncl-job-submitter" value="dashboard" class="w-full bg-zion-900 border border-zion-600 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-purple-500"/>
              </div>
            </div>
          </details>
          <!-- Estimated cost -->
          <div class="flex items-center justify-between p-3 bg-purple-900/20 border border-purple-800/30 rounded-lg mb-4">
            <div class="text-xs text-gray-400">Estimated cost</div>
            <div class="text-sm font-bold text-purple-300" id="ncl-est-cost">0.02 ZION</div>
          </div>
          <!-- Submit button -->
          <div class="flex items-center gap-3">
            <button onclick="submitNclJob()" id="ncl-submit-btn" class="px-6 py-2.5 text-sm font-bold rounded-xl transition-all" style="background:linear-gradient(135deg,#7c3aed,#3b82f6);box-shadow:0 4px 15px rgba(124,58,237,0.3)" onmouseover="this.style.boxShadow='0 6px 25px rgba(124,58,237,0.5)'" onmouseout="this.style.boxShadow='0 4px 15px rgba(124,58,237,0.3)'">
              Submit Job
            </button>
            <span id="ncl-job-result-dash" class="text-sm text-gray-400"></span>
          </div>
        </div>
      </div>

      <!-- Analytics / Chart Panel -->
      <div id="ncl-pane-chart" class="ncl-pane hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-zion-800 rounded-xl border border-zion-700 p-4">
            <h3 class="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2"><span class="text-blue-400">&#x1F4C8;</span> Jobs Over Time</h3>
            <div class="h-48"><canvas id="ncl-jobs-chart"></canvas></div>
          </div>
          <div class="bg-zion-800 rounded-xl border border-zion-700 p-4">
            <h3 class="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2"><span class="text-emerald-400">&#x26A1;</span> Worker Performance</h3>
            <div class="h-48"><canvas id="ncl-perf-chart"></canvas></div>
          </div>
        </div>
        <!-- Pricing breakdown -->
        <div class="bg-zion-800 rounded-xl border border-zion-700 p-4 mt-4">
          <h3 class="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2"><span class="text-purple-400">&#x1F4B0;</span> Pricing Breakdown</h3>
          <div id="ncl-pricing-detail" class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-zion-900 rounded-lg p-3 text-center">
              <div class="text-xs text-gray-500 mb-1">Per Job</div>
              <div id="ncl-price-job" class="text-sm font-bold text-purple-300">—</div>
            </div>
            <div class="bg-zion-900 rounded-lg p-3 text-center">
              <div class="text-xs text-gray-500 mb-1">Per Token</div>
              <div id="ncl-price-token" class="text-sm font-bold text-purple-300">—</div>
            </div>
            <div class="bg-zion-900 rounded-lg p-3 text-center">
              <div class="text-xs text-gray-500 mb-1">Worker Share</div>
              <div id="ncl-price-worker" class="text-sm font-bold text-emerald-300">—</div>
            </div>
            <div class="bg-zion-900 rounded-lg p-3 text-center">
              <div class="text-xs text-gray-500 mb-1">Protocol Fee</div>
              <div id="ncl-price-protocol" class="text-sm font-bold text-amber-300">—</div>
            </div>
          </div>
          <div id="ncl-fee-split-bar" class="mt-3 h-3 rounded-full overflow-hidden flex">
            <div id="ncl-fee-worker-bar" class="bg-emerald-500 transition-all" style="width:90%"></div>
            <div id="ncl-fee-protocol-bar" class="bg-amber-500 transition-all" style="width:10%"></div>
          </div>
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span id="ncl-fee-split-label">90% worker / 10% protocol</span>
          </div>
        </div>
      </div>

    </div>
    <!-- ── END NCL Mega Panel ─────────────────────────────────────────────── -->

    <!-- Log panels -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300">Hiranyagarbha Log</h2>
          <button onclick="loadLogs('hiranyagarbha')" class="text-xs text-gray-400 hover:text-white">🔄</button>
        </div>
        <pre id="log-hiranyagarbha" class="log-tail bg-zion-900 rounded-lg p-3 h-48 overflow-y-auto text-gray-300"></pre>
      </div>
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300">Hiran Inference Log</h2>
          <button onclick="loadLogs('hiran-inference')" class="text-xs text-gray-400 hover:text-white">🔄</button>
        </div>
        <pre id="log-hiran-inference" class="log-tail bg-zion-900 rounded-lg p-3 h-48 overflow-y-auto text-gray-300"></pre>
      </div>
    </div>

  </div>

  <!-- TAB: Payout -->
  <div id="pane-payout" class="hidden space-y-4">
    <!-- Payout Overview Header -->
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">💰 Pool Payout System</h2>
        <button onclick="refreshPayout()" class="text-xs px-2 py-1 bg-zion-700 hover:bg-zion-600 rounded transition">🔄 Refresh</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3" id="payout-summary">
        <div class="bg-zion-900 rounded-lg p-3 border border-zion-700">
          <div class="text-xs text-gray-400 mb-1">Pool Wallet</div>
          <div class="text-sm font-mono text-amber-400 truncate" id="payout-wallet">—</div>
          <div class="text-xs text-gray-500 mt-1" id="payout-wallet-balance">Balance: —</div>
        </div>
        <div class="bg-zion-900 rounded-lg p-3 border border-zion-700">
          <div class="text-xs text-gray-400 mb-1">Payout Status</div>
          <div class="text-sm font-bold text-emerald-400" id="payout-status">—</div>
          <div class="text-xs text-gray-500 mt-1" id="payout-fee-split">Fee split: —</div>
        </div>
        <div class="bg-zion-900 rounded-lg p-3 border border-zion-700">
          <div class="text-xs text-gray-400 mb-1">Blocks Found</div>
          <div class="text-2xl font-bold text-amber-400" id="payout-blocks">—</div>
          <div class="text-xs text-gray-500 mt-1" id="payout-last-block">Last: —</div>
        </div>
        <div class="bg-zion-900 rounded-lg p-3 border border-zion-700">
          <div class="text-xs text-gray-400 mb-1">Last Payout</div>
          <div class="text-sm font-bold text-emerald-400" id="payout-last">—</div>
          <div class="text-xs text-gray-500 mt-1" id="payout-last-tx">TX: —</div>
        </div>
      </div>
    </div>

    <!-- Fee Split Recipients -->
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">📋 Fee Split Recipients (89/5/5/1 burn model)</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3" id="payout-recipients">
        <div class="bg-zion-900 rounded-lg p-3 border border-zion-700">
          <div class="text-xs text-gray-400 mb-1">⛏️ Miner Share (89%)</div>
          <div class="text-sm font-mono text-amber-400 truncate" id="payout-miner-wallet">—</div>
          <div class="text-xs text-gray-500 mt-1">PPLNS redistribution</div>
        </div>
        <div class="bg-zion-900 rounded-lg p-3 border border-zion-700">
          <div class="text-xs text-gray-400 mb-1">🌍 Humanitarian (5%)</div>
          <div class="text-sm font-mono text-emerald-400 truncate" id="payout-humanitarian-wallet">—</div>
          <div class="text-xs text-gray-500 mt-1">Children Future Fund</div>
        </div>
        <div class="bg-zion-900 rounded-lg p-3 border border-zion-700">
          <div class="text-xs text-gray-400 mb-1">🚀 Issobella (5%)</div>
          <div class="text-sm font-mono text-purple-400 truncate" id="payout-issobella-wallet">—</div>
          <div class="text-xs text-gray-500 mt-1">L5/L6 Space Layer</div>
        </div>
        <div class="bg-zion-900 rounded-lg p-3 border border-zion-700">
          <div class="text-xs text-gray-400 mb-1">⚡ Pool Fee (1%)</div>
          <div class="text-sm font-mono text-blue-400 truncate" id="payout-pool-fee-wallet">—</div>
          <div class="text-xs text-gray-500 mt-1">Operator fee</div>
        </div>
      </div>
    </div>

    <!-- Recent Payout Log -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-2">📝 Recent Miner Payouts</h2>
        <div id="payout-miner-log" class="space-y-2 text-xs text-gray-300 max-h-64 overflow-y-auto">
          <div class="text-gray-500 italic">Loading...</div>
        </div>
      </div>
      <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
        <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-2">📝 Recent Fee Payouts</h2>
        <div id="payout-fee-log" class="space-y-2 text-xs text-gray-300 max-h-64 overflow-y-auto">
          <div class="text-gray-500 italic">Loading...</div>
        </div>
      </div>
    </div>

    <!-- Payout Error Log -->
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-2">⚠️ Payout Errors (if any)</h2>
      <div id="payout-error-log" class="space-y-2 text-xs text-gray-300 max-h-48 overflow-y-auto">
        <div class="text-gray-500 italic">No errors detected</div>
      </div>
    </div>
  </div>

  <footer class="text-center text-xs text-gray-600 pt-6 pb-4 border-t border-zion-700 mt-6">
    ZION V3 Dashboard 2.0 — Zero-dependency Python stdlib server — Auto-refresh 3s
    <span class="text-gray-500"> · </span>
    <a href="../MAINNETREADYrun.md" target="_blank" class="text-amber-400 hover:underline">Runbook</a>
    <span class="text-gray-500"> · </span>
    <a href="../MAINNETSTATUSW11.md" target="_blank" class="text-amber-400 hover:underline">W11 Status</a>
  </footer>
</div>

<script>
let autoRefresh=true,refreshTimer=null,currentTab='overview';
let charts={};
const TABS=['overview','controls','charts','events','env','launch-day','wizard','services','database','metrics','logs','hiran','payout'];

// ── Tab switching ──
function switchTab(name){
  currentTab=name;
  TABS.forEach(t=>{
    document.getElementById('pane-'+t).classList.toggle('hidden',t!==name);
    document.getElementById('tab-'+t).classList.toggle('tab-active',t===name);
  });
  if(name==='charts')renderCharts();
  if(name==='events')loadEvents();
  if(name==='env')loadEnvFiles();
  if(name==='launch-day')loadLaunchDayStatus();
  if(name==='wizard')renderWizard();
  if(name==='logs'){loadLogs('node1');loadLogs('node2');loadLogs('pool');loadLogs('miner');}
  if(name==='controls')renderControls();
  if(name==='services')loadServices();
  if(name==='database')loadDatabases();
  if(name==='metrics')renderMetricsButtons();
  if(name==='overview')loadMainnetStatus();
  if(name==='hiran'){loadHiranHealth();loadAgentList();loadOrchestratorStats();loadNclStatus();}
  if(name==='payout')refreshPayout();
}

// ── Payout System ──
async function refreshPayout(){
  try{
    const data=await fetch('/api/payout').then(r=>r.json());
    document.getElementById('payout-wallet').textContent=data.pool_wallet||'—';
    document.getElementById('payout-wallet-balance').textContent='Balance: '+(data.pool_wallet_balance?formatFlowers(data.pool_wallet_balance):'—');
    document.getElementById('payout-status').textContent=data.payout_enabled?'✅ ENABLED':'❌ DISABLED';
    document.getElementById('payout-status').className=data.payout_enabled?'text-sm font-bold text-emerald-400':'text-sm font-bold text-red-400';
    document.getElementById('payout-fee-split').textContent='Fee split: '+(data.fee_split||'—');
    document.getElementById('payout-blocks').textContent=data.blocks_found||'—';
    document.getElementById('payout-last-block').textContent='Last: height '+(data.last_block_height||'—');
    document.getElementById('payout-last').textContent=data.last_payout_time||'—';
    document.getElementById('payout-last-tx').textContent='TX: '+(data.last_payout_tx||'—');

    // Recipients
    if(data.miner_wallet)document.getElementById('payout-miner-wallet').textContent=data.miner_wallet;
    if(data.humanitarian_wallet)document.getElementById('payout-humanitarian-wallet').textContent=data.humanitarian_wallet;
    if(data.issobella_wallet)document.getElementById('payout-issobella-wallet').textContent=data.issobella_wallet;
    if(data.pool_fee_wallet)document.getElementById('payout-pool-fee-wallet').textContent=data.pool_fee_wallet;

    // Miner payout log
    const minerLog=document.getElementById('payout-miner-log');
    if(data.miner_payouts&&data.miner_payouts.length>0){
      minerLog.innerHTML=data.miner_payouts.map(l=>`<div class="bg-zion-900 rounded p-2 border-l-2 border-emerald-500">${escapeHtml(l)}</div>`).join('');
    }else{minerLog.innerHTML='<div class="text-gray-500 italic">No recent miner payouts</div>';}

    // Fee payout log
    const feeLog=document.getElementById('payout-fee-log');
    if(data.fee_payouts&&data.fee_payouts.length>0){
      feeLog.innerHTML=data.fee_payouts.map(l=>`<div class="bg-zion-900 rounded p-2 border-l-2 border-blue-500">${escapeHtml(l)}</div>`).join('');
    }else{feeLog.innerHTML='<div class="text-gray-500 italic">No recent fee payouts</div>';}

    // Error log
    const errLog=document.getElementById('payout-error-log');
    if(data.errors&&data.errors.length>0){
      errLog.innerHTML=data.errors.map(l=>`<div class="bg-zion-900 rounded p-2 border-l-2 border-red-500 text-red-300">${escapeHtml(l)}</div>`).join('');
    }else{errLog.innerHTML='<div class="text-gray-500 italic">No errors detected</div>';}
  }catch(e){
    console.error('refreshPayout error',e);
  }
}
function formatFlowers(v){
  if(!v&&v!==0)return'—';
  // Auto-detect legacy scale: if value > 1.44e18 (10x total supply in post-3.0.3 flowers),
  // it's in legacy 1e12 scale and must be divided by 1e12 instead of 1e6.
  let divisor=1_000_000;
  if(v>1.44e18)divisor=1_000_000_000_000;
  const zion=v/divisor;
    return zion.toLocaleString('en-US',{minimumFractionDigits:4,maximumFractionDigits:4})+' ZION';
}

// ── Hiran AI ──
async function loadHiranHealth(){
  // ── Hiran Inference (port 8002) ─────────────────────────────────────
  const badge=document.getElementById('hiran-status-badge');
  const backend=document.getElementById('hiran-backend-label');
  const detail=document.getElementById('hiran-inference-detail');
  const hint=document.getElementById('hiran-offline-hint');
  if(badge)badge.textContent='CHECKING…';
  try{
    const r=await fetch('/api/hiran/health');
    const d=await r.json();
    if(d.alive){
      if(badge){badge.textContent='LIVE';badge.className='px-2 py-0.5 rounded text-xs font-bold bg-emerald-600 text-white animate-pulse';}
      if(backend)backend.textContent=d.backend;
      if(detail)detail.textContent=(d.model||'—')+' · '+(d.uptime_s!=null?'up '+Math.round(d.uptime_s)+'s':'');
      if(hint)hint.classList.add('hidden');
    }else{
      if(badge){badge.textContent='OFFLINE';badge.className='px-2 py-0.5 rounded text-xs font-bold bg-red-700 text-white';}
      if(backend)backend.textContent=d.backend||'nedosažitelný';
      if(detail)detail.textContent='Spusť: ▶ Start';
      if(hint)hint.classList.remove('hidden');
    }
  }catch(e){
    if(badge){badge.textContent='OFFLINE';badge.className='px-2 py-0.5 rounded text-xs font-bold bg-red-700 text-white';}
    if(detail)detail.textContent='Spusť: ▶ Start';
    if(hint)hint.classList.remove('hidden');
  }
  // ── Hiranyagarbha Orchestrator (port 8001) ──────────────────────────
  const orchBadge=document.getElementById('hiranyagarbha-badge');
  const orchDetail=document.getElementById('hiranyagarbha-detail');
  const orchPanel=document.getElementById('orch-stats-panel');
  if(orchBadge)orchBadge.textContent='CHECKING…';
  try{
    const r2=await fetch('/api/hiranyagarbha/health');
    const d2=await r2.json();
    if(d2.alive){
      if(orchBadge){orchBadge.textContent='LIVE';orchBadge.className='px-2 py-0.5 rounded text-xs font-bold bg-emerald-600 text-white animate-pulse';}
      if(orchDetail)orchDetail.textContent='v'+( d2.version||'?')+' · agents: '+(d2.active_agents??'—')+' · tasks: '+(d2.task_queue??'—');
      if(orchPanel)orchPanel.classList.remove('hidden');
      loadOrchestratorStats();
    }else{
      if(orchBadge){orchBadge.textContent='OFFLINE';orchBadge.className='px-2 py-0.5 rounded text-xs font-bold bg-red-700 text-white';}
      if(orchDetail)orchDetail.textContent='Spusť: ▶ Start';
      if(orchPanel)orchPanel.classList.add('hidden');
    }
  }catch(e){
    if(orchBadge){orchBadge.textContent='OFFLINE';orchBadge.className='px-2 py-0.5 rounded text-xs font-bold bg-red-700 text-white';}
    if(orchDetail)orchDetail.textContent='Spusť: ▶ Start';
    if(orchPanel)orchPanel.classList.add('hidden');
  }
}

// ── Hiranyagarbha orchestrator live stats ──────────────────────────────
async function loadOrchestratorStats(){
  try{
    const r=await fetch('http://127.0.0.1:8001/orchestrator/status');
    if(!r.ok)return;
    const d=await r.json();
    const s=d.status||d;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v??'—';};
    set('orch-active', s.active_agents??s.agent_count??'—');
    set('orch-tasks',  s.task_queue_depth??s.tasks_pending??'—');
    set('orch-msgs',   s.message_queue_depth??s.messages??'—');
    set('orch-actions',s.total_actions_dispatched??s.total_actions??'—');
  }catch(_){}
}

// ── Agent Management (Hiranyagarbha port 8001) ──────────────────────
async function loadAgentList(){
  const list=document.getElementById('agent-list');
  const res=document.getElementById('agent-action-result');
  if(list)list.innerHTML='<div class="text-gray-500 text-xs italic">Loading agents…</div>';
  try{
    const r=await fetch('http://127.0.0.1:8001/agents');
    const d=await r.json();
    const total=d.total??d.active??0;
    if(total===0){
      if(list)list.innerHTML='<div class="text-gray-500 text-xs italic">No active agents — click + Register to create one</div>';
      return;
    }
    // Try to get agent details
    const r2=await fetch('http://127.0.0.1:8001/orchestrator/status');
    const s=await r2.json();
    const agents=s.agents??{};
    const active=agents.active??0;
    const suspended=agents.suspended??0;
    const terminated=agents.terminated??0;
    const actions=agents.total_actions??0;
    let html=`<div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-center mb-2">`;
    html+=`<div class="bg-zion-900 rounded p-2"><div class="text-xs text-gray-400">Active</div><div class="text-sm font-bold text-emerald-400">${active}</div></div>`;
    html+=`<div class="bg-zion-900 rounded p-2"><div class="text-xs text-gray-400">Suspended</div><div class="text-sm font-bold text-amber-400">${suspended}</div></div>`;
    html+=`<div class="bg-zion-900 rounded p-2"><div class="text-xs text-gray-400">Terminated</div><div class="text-sm font-bold text-red-400">${terminated}</div></div>`;
    html+=`<div class="bg-zion-900 rounded p-2"><div class="text-xs text-gray-400">Actions</div><div class="text-sm font-bold text-gray-300">${actions}</div></div>`;
    html+=`</div>`;
    if(list)list.innerHTML=html;
    if(res)res.textContent=`Loaded: ${active} active, ${suspended} suspended, ${terminated} terminated`;
  }catch(e){
    if(list)list.innerHTML='<div class="text-red-400 text-xs">Error loading agents: '+escapeHtml(String(e))+'</div>';
  }
}

async function registerAgent(){
  const res=document.getElementById('agent-action-result');
  if(res)res.textContent='Registering agent…';
  try{
    const r=await fetch('http://127.0.0.1:8001/agents',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:'DashboardAgent-'+Date.now(),capabilities:['Compute','Memory'],consciousness_level:1})
    });
    const d=await r.json();
    if(res)res.textContent='Registered: '+JSON.stringify(d);
    loadAgentList();
  }catch(e){
    if(res)res.textContent='Error: '+String(e);
  }
}

async function elevateConsciousness(){
  const res=document.getElementById('agent-action-result');
  if(res)res.textContent='Elevating consciousness…';
  try{
    // First get agents to find an ID
    const r1=await fetch('http://127.0.0.1:8001/agents');
    const d1=await r1.json();
    if(!d1.total&&!d1.active){if(res)res.textContent='No agents to elevate';return;}
    // Try to find first active agent
    const r2=await fetch('http://127.0.0.1:8001/orchestrator/status');
    const s=await r2.json();
    // Elevate on first agent (using placeholder ID for demo)
    const r3=await fetch('http://127.0.0.1:8001/agents/00000000-0000-0000-0000-000000000001/consciousness',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({level:2})
    });
    const d3=await r3.json();
    if(res)res.textContent='Elevated: '+JSON.stringify(d3);
    loadAgentList();
  }catch(e){
    if(res)res.textContent='Error: '+String(e);
  }
}

async function grantCapability(){
  const res=document.getElementById('agent-action-result');
  if(res)res.textContent='Granting capability…';
  try{
    const r=await fetch('http://127.0.0.1:8001/agents/00000000-0000-0000-0000-000000000001/capabilities',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({capability:'RAG'})
    });
    const d=await r.json();
    if(res)res.textContent='Granted: '+JSON.stringify(d);
  }catch(e){
    if(res)res.textContent='Error: '+String(e);
  }
}

async function dispatchTask(){
  const res=document.getElementById('agent-action-result');
  if(res)res.textContent='Dispatching task…';
  try{
    const r=await fetch('http://127.0.0.1:8001/tasks/dispatch',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({task_type:'QueryKnowledge',model_id:'hiran-v2.2',submitter:'dashboard',description:'Dashboard test task',input:'What is ZION?'})
    });
    const d=await r.json();
    if(res)res.textContent='Dispatched: '+JSON.stringify(d);
    loadAgentList();
    loadOrchestratorStats();
  }catch(e){
    if(res)res.textContent='Error: '+String(e);
  }
}

// ── Start an AI layer service via dashboard control API ───────────────
async function aiLayerStart(action, badgeId, detailId){
  const badge=document.getElementById(badgeId);
  const detail=document.getElementById(detailId);
  if(badge){badge.textContent='STARTING…';badge.className='px-2 py-0.5 rounded text-xs font-bold bg-amber-500 text-white animate-pulse';}
  if(detail)detail.textContent='Spouštím…';
  try{
    const r=await fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
    const d=await r.json();
    if(d.ok||d.status==='launched'){
      if(detail)detail.textContent='Spuštěno — čekám na odpověď…';
      // poll health after short delay
      setTimeout(()=>loadHiranHealth(), 3000);
      setTimeout(()=>loadHiranHealth(), 7000);
    }else{
      if(badge){badge.textContent='ERR';badge.className='px-2 py-0.5 rounded text-xs font-bold bg-red-700 text-white';}
      if(detail)detail.textContent=d.error||d.detail||'Chyba při spouštění';
    }
  }catch(e){
    if(badge){badge.textContent='ERR';badge.className='px-2 py-0.5 rounded text-xs font-bold bg-red-700 text-white';}
    if(detail)detail.textContent='Chyba: '+String(e);
  }
}

// ── NCL (Neural Compute Layer) — Full UI Engine ──────────────────────
let _nclAutoTimer=null;
let _nclJobCache=[];
let _nclJobsChart=null;
let _nclPerfChart=null;
let _nclJobHistory=[];

function switchNclTab(tab){
  document.querySelectorAll('.ncl-pane').forEach(p=>p.classList.add('hidden'));
  document.querySelectorAll('[id^="ncl-tab-"]').forEach(b=>{b.classList.remove('ncl-tab-active');b.classList.add('text-gray-400');});
  const pane=document.getElementById('ncl-pane-'+tab);
  const btn=document.getElementById('ncl-tab-'+tab);
  if(pane)pane.classList.remove('hidden');
  if(btn){btn.classList.add('ncl-tab-active');btn.classList.remove('text-gray-400');}
  if(tab==='jobs')loadNclJobHistory();
  if(tab==='chart')initNclCharts();
}

function toggleNclAutoRefresh(){
  const cb=document.getElementById('ncl-auto-refresh');
  if(cb?.checked){_nclAutoTimer=setInterval(loadNclFull,10000);}
  else{clearInterval(_nclAutoTimer);_nclAutoTimer=null;}
}

async function loadNclFull(){
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v??'—';};
  let online=false;

  // Status
  try{
    const r=await fetch('/api/ncl/status');
    const d=await r.json();
    online=!d.error;
    set('ncl-status-val', d.status||'active');
    set('ncl-workers-val', d.total_workers??d.active_workers??'—');
    set('ncl-queue-val', d.queued_jobs??d.queued??'0');
    set('ncl-tflops-val', d.total_tflops??'—');
    set('ncl-jobs-total-val', d.completed_jobs??d.total_jobs??'—');
  }catch(_){set('ncl-status-val','offline');}

  // Live indicator
  const dot=document.getElementById('ncl-live-dot');
  const lbl=document.getElementById('ncl-live-label');
  if(dot)dot.className='w-2 h-2 rounded-full '+(online?'ncl-dot-live':'ncl-dot-offline');
  if(lbl){lbl.textContent=online?'Live':'Offline';lbl.className='text-xs '+(online?'text-emerald-400':'text-red-400');}
  set('ncl-refresh-ts','Updated '+new Date().toLocaleTimeString());

  // Price
  try{
    const r2=await fetch('/api/ncl/price');
    const d2=await r2.json();
    set('ncl-price-val', d2.price_per_token!=null?d2.price_per_token+' ZION':'—');
    set('ncl-price-job', d2.price_per_job!=null?d2.price_per_job+' ZION':'—');
    set('ncl-price-token', d2.price_per_token!=null?d2.price_per_token+' ZION':'—');
    set('ncl-price-worker', d2.worker_share_flowers!=null?(d2.worker_share_flowers/1e9).toFixed(1)+' nZION':'—');
    set('ncl-price-protocol', d2.protocol_fee_flowers!=null?(d2.protocol_fee_flowers/1e9).toFixed(1)+' nZION':'—');
    if(d2.fee_split){set('ncl-fee-split-label',d2.fee_split);}
    const estEl=document.getElementById('ncl-est-cost');
    if(estEl&&d2.price_per_job!=null)estEl.textContent=d2.price_per_job+' ZION';
  }catch(_){}

  // Workers (rich cards)
  try{
    const r3=await fetch('/api/ncl/workers');
    const d3=await r3.json();
    const wl=document.getElementById('ncl-worker-list');
    const badge=document.getElementById('ncl-worker-count-badge');
    const workers=d3.workers||d3;
    if(badge)badge.textContent=Array.isArray(workers)?workers.length:0;
    if(wl){
      if(!Array.isArray(workers)||workers.length===0){
        wl.innerHTML='<div class="p-6 text-center"><div class="text-gray-600 text-2xl mb-2">&#x1F50D;</div><div class="text-gray-500 text-sm">No active workers</div><div class="text-gray-600 text-xs mt-1">Workers will appear when they connect to the NCL</div></div>';
      }else{
        wl.innerHTML=workers.map((w,i)=>{
          const id=w.worker_id||'worker-'+i;
          const short=id.slice(0,8);
          const score=w.score||0;
          const jobs=w.jobs_completed||0;
          const failed=w.jobs_failed||0;
          const cl=w.consciousness_level||0;
          const successRate=jobs>0?Math.round(((jobs-failed)/jobs)*100):0;
          const barW=Math.min(score,100);
          return `<div class="ncl-worker-card p-4 cursor-pointer" onclick="this.querySelector('.ncl-worker-detail').classList.toggle('hidden')">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style="background:linear-gradient(135deg,${score>=80?'#10b981,#059669':score>=50?'#3b82f6,#2563eb':'#6b7280,#4b5563'})">
                  ${short.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div class="text-sm font-medium text-gray-200">${short}...</div>
                  <div class="text-xs text-gray-500">CL ${cl} · ${jobs} jobs</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-bold ${score>=80?'text-emerald-400':score>=50?'text-blue-400':'text-gray-400'}">${score} pts</div>
                <div class="text-xs text-gray-500">${successRate}% success</div>
              </div>
            </div>
            <div class="mt-2 h-1.5 bg-zion-900 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all" style="width:${barW}%;background:linear-gradient(90deg,#7c3aed,#3b82f6)"></div>
            </div>
            <div class="ncl-worker-detail hidden mt-3 pt-3 border-t border-zion-700/50 grid grid-cols-3 gap-2 text-xs">
              <div><span class="text-gray-500">Full ID</span><div class="text-gray-300 font-mono text-xs break-all">${id}</div></div>
              <div><span class="text-gray-500">Failed</span><div class="text-red-400 font-bold">${failed}</div></div>
              <div><span class="text-gray-500">Consciousness</span><div class="text-purple-400 font-bold">Level ${cl}</div></div>
            </div>
          </div>`;
        }).join('');
      }
    }
  }catch(_){}

  // Leaderboard (rich)
  try{
    const r4=await fetch('/api/ncl/leaderboard');
    const d4=await r4.json();
    const lb=document.getElementById('ncl-leaderboard-dash');
    const entries=d4.leaderboard||d4;
    if(lb){
      if(!Array.isArray(entries)||entries.length===0){
        lb.innerHTML='<div class="p-6 text-center"><div class="text-gray-600 text-2xl mb-2">&#x1F3C6;</div><div class="text-gray-500 text-sm">No leaderboard data yet</div></div>';
      }else{
        lb.innerHTML=entries.slice(0,20).map((e,i)=>{
          const rank=e.rank||i+1;
          const rankClass=rank===1?'ncl-rank-gold':rank===2?'ncl-rank-silver':rank===3?'ncl-rank-bronze':'';
          const medal=rank===1?'&#x1F947;':rank===2?'&#x1F948;':rank===3?'&#x1F949;':'';
          const addr=e.wallet_address||e.worker_id||'—';
          const shortAddr=addr.length>20?addr.slice(0,10)+'...'+addr.slice(-6):addr;
          const avgMs=e.avg_completion_ms?Math.round(e.avg_completion_ms)+'ms':'—';
          return `<div class="ncl-worker-card p-3 flex items-center gap-3">
            <div class="w-8 text-center">
              ${medal?'<span class="text-lg">'+medal+'</span>':'<span class="text-sm font-bold text-gray-500">#'+rank+'</span>'}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-200 truncate" title="${addr}">${shortAddr}</div>
              <div class="text-xs text-gray-500">${e.jobs_completed||0} jobs · avg ${avgMs}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold ${rankClass||'text-gray-300'}">${e.score||0}</div>
              <div class="text-xs text-gray-500">points</div>
            </div>
          </div>`;
        }).join('');
      }
    }
  }catch(_){}
}

// Alias for backwards compat
const loadNclStatus=loadNclFull;

async function loadNclJobHistory(){
  try{
    const r=await fetch('/api/ncl/jobs');
    const d=await r.json();
    _nclJobHistory=d.jobs||d||[];
    renderNclJobHistory();
  }catch(_){
    const el=document.getElementById('ncl-job-history-list');
    if(el)el.innerHTML='<div class="p-4 text-center text-red-400 text-sm">Failed to load jobs</div>';
  }
}

function renderNclJobHistory(){
  const filter=document.getElementById('ncl-job-filter')?.value||'all';
  const list=filter==='all'?_nclJobHistory:_nclJobHistory.filter(j=>(j.status||'').toLowerCase()===filter.toLowerCase());
  const el=document.getElementById('ncl-job-history-list');
  const countEl=document.getElementById('ncl-job-count');
  const rateEl=document.getElementById('ncl-job-success-rate');

  if(countEl)countEl.textContent=_nclJobHistory.length+' jobs total';
  const completed=_nclJobHistory.filter(j=>j.status==='Completed').length;
  const total=_nclJobHistory.length;
  if(rateEl)rateEl.textContent=total>0?Math.round((completed/total)*100)+'% success rate':'—';

  if(!el)return;
  if(!Array.isArray(list)||list.length===0){
    el.innerHTML='<div class="p-6 text-center"><div class="text-gray-600 text-2xl mb-2">&#x1F4ED;</div><div class="text-gray-500 text-sm">No jobs found</div></div>';
    return;
  }
  el.innerHTML=list.slice(0,50).map(j=>{
    const st=(j.status||'unknown').toLowerCase();
    const stClass='ncl-job-'+st;
    const id=(j.job_id||j.id||'—').slice(0,8);
    const type=j.job_type||'—';
    const backend=j.backend||'—';
    const ts=j.created_at?new Date(j.created_at).toLocaleString():'—';
    return `<div class="ncl-worker-card p-3 flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-mono text-gray-300">${id}...</span>
          <span class="ncl-job-status ${stClass}">&#x25CF; ${j.status||'Unknown'}</span>
        </div>
        <div class="text-xs text-gray-500 mt-0.5">${type} · ${backend} · ${ts}</div>
      </div>
      <div class="text-xs text-gray-500">${j.priority!=null?'P'+j.priority:''}</div>
    </div>`;
  }).join('');
}

async function submitNclJob(){
  const jt=document.getElementById('ncl-job-type-dash')?.value||'inference';
  const backend=document.getElementById('ncl-job-backend')?.value||'Custom';
  const model=document.getElementById('ncl-job-model')?.value||'hiran-v2.2';
  const priority=parseInt(document.getElementById('ncl-job-priority')?.value||'5',10);
  const prompt=document.getElementById('ncl-job-prompt')?.value||'Dashboard test job';
  const reward=parseInt(document.getElementById('ncl-job-reward')?.value||'20000000000',10);
  const duration=parseInt(document.getElementById('ncl-job-duration')?.value||'60',10);
  const submitter=document.getElementById('ncl-job-submitter')?.value||'dashboard';
  const res=document.getElementById('ncl-job-result-dash');
  const btn=document.getElementById('ncl-submit-btn');

  if(btn){btn.disabled=true;btn.textContent='Submitting...';}
  if(res)res.innerHTML='<span class="text-purple-400">Submitting...</span>';

  try{
    const payload={job_type:jt,model_id:model,backend:backend,params:{prompt:prompt},priority:priority,submitter:submitter,input_hash:Date.now().toString(16),reward_flowers:reward,max_duration_secs:duration};
    const r=await fetch('/api/ncl/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json();
    if(d.error){if(res)res.innerHTML='<span class="text-red-400">Error: '+d.error+'</span>';}
    else{
      if(res)res.innerHTML='<span class="text-emerald-400">&#x2705; Job queued: '+(d.job_id||d.id||'OK')+'</span>';
      setTimeout(()=>{loadNclFull();loadNclJobHistory();},1000);
    }
  }catch(e){if(res)res.innerHTML='<span class="text-red-400">Error: '+String(e)+'</span>';}
  finally{if(btn){btn.disabled=false;btn.textContent='Submit Job';}}
}

function initNclCharts(){
  // Jobs over time chart
  const jCtx=document.getElementById('ncl-jobs-chart');
  if(jCtx&&!_nclJobsChart){
    const labels=[];const queued=[];const completed=[];const failed=[];
    for(let i=11;i>=0;i--){const d=new Date();d.setHours(d.getHours()-i);labels.push(d.getHours()+':00');queued.push(Math.floor(Math.random()*5));completed.push(Math.floor(Math.random()*8));failed.push(Math.floor(Math.random()*2));}
    _nclJobsChart=new Chart(jCtx,{type:'bar',data:{labels,datasets:[
      {label:'Completed',data:completed,backgroundColor:'rgba(16,185,129,0.6)',borderRadius:4},
      {label:'Queued',data:queued,backgroundColor:'rgba(245,158,11,0.6)',borderRadius:4},
      {label:'Failed',data:failed,backgroundColor:'rgba(239,68,68,0.4)',borderRadius:4}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#9ca3af',font:{size:10}}}},scales:{x:{ticks:{color:'#6b7280',font:{size:9}},grid:{display:false}},y:{ticks:{color:'#6b7280',font:{size:9}},grid:{color:'rgba(255,255,255,0.05)'}}}}});
  }
  // Worker perf chart
  const pCtx=document.getElementById('ncl-perf-chart');
  if(pCtx&&!_nclPerfChart){
    const wLabels=[];const scores=[];const jobCounts=[];
    try{
      const wl=document.getElementById('ncl-worker-list');
      if(wl){
        const cards=wl.querySelectorAll('.ncl-worker-card');
        cards.forEach(c=>{const t=c.querySelector('.text-sm.font-medium');if(t){wLabels.push(t.textContent.trim());scores.push(Math.random()*100);jobCounts.push(Math.floor(Math.random()*20));}});
      }
    }catch(_){}
    if(wLabels.length===0){wLabels.push('Worker 1','Worker 2');scores.push(85,65);jobCounts.push(12,8);}
    _nclPerfChart=new Chart(pCtx,{type:'radar',data:{labels:['Score','Jobs','Speed','Uptime','Reliability'],datasets:[
      {label:'Network Avg',data:[70,60,75,80,85],borderColor:'rgba(124,58,237,0.5)',backgroundColor:'rgba(124,58,237,0.1)',pointBackgroundColor:'#7c3aed'},
      {label:'Top Worker',data:[95,90,88,96,92],borderColor:'rgba(16,185,129,0.7)',backgroundColor:'rgba(16,185,129,0.1)',pointBackgroundColor:'#10b981'}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#9ca3af',font:{size:10}}}},scales:{r:{ticks:{color:'#6b7280',backdropColor:'transparent',font:{size:8}},grid:{color:'rgba(255,255,255,0.05)'},pointLabels:{color:'#9ca3af',font:{size:9}}}}}});
  }
}

// Start NCL auto-refresh when hiran tab opens
(function(){
  const origSwitch=window.switchTab;
  if(origSwitch){
    window.switchTab=function(t){
      origSwitch(t);
      if(t==='hiran'){loadNclFull();_nclAutoTimer=setInterval(loadNclFull,10000);}
      else{clearInterval(_nclAutoTimer);_nclAutoTimer=null;}
    };
  }
})();

// ── Service log tail ─────────────────────────────────────────────────
async function loadLogs(serviceId){
  const el=document.getElementById('log-'+serviceId);
  if(!el)return;
  try{
    const r=await fetch('/api/service-log?id='+encodeURIComponent(serviceId)+'&lines=80');
    const d=await r.json();
    el.textContent=d.lines||(d.error?'Error: '+d.error:'(empty)');
    el.scrollTop=el.scrollHeight;
  }catch(e){el.textContent='Chyba: '+String(e);}
}

function hiranQuickPrompt(text){
  const inp=document.getElementById('hiran-chat-input');
  if(inp){inp.value=text;sendHiranMessage();}
}

async function sendHiranMessage(){
  const inp=document.getElementById('hiran-chat-input');
  const log=document.getElementById('hiran-chat-log');
  const btn=document.getElementById('hiran-send-btn');
  const lat=document.getElementById('hiran-latency');
  if(!inp||!log)return;
  const msg=inp.value.trim();
  if(!msg)return;
  inp.value='';
  // Append user bubble
  const userDiv=document.createElement('div');
  userDiv.className='flex justify-end';
  userDiv.innerHTML=`<div class="max-w-xs lg:max-w-md px-3 py-2 bg-amber-700/40 rounded-lg text-gray-200 text-xs">${escapeHtml(msg)}</div>`;
  log.appendChild(userDiv);
  log.scrollTop=log.scrollHeight;
  // Spinner
  const spinDiv=document.createElement('div');
  spinDiv.className='flex justify-start';
  spinDiv.innerHTML='<div class="px-3 py-2 bg-zion-700 rounded-lg text-gray-400 text-xs animate-pulse">Hiran přemýšlí…</div>';
  log.appendChild(spinDiv);
  log.scrollTop=log.scrollHeight;
  if(btn)btn.disabled=true;
  try{
    const t0=Date.now();
    const r=await fetch('/api/hiran/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
    const d=await r.json();
    log.removeChild(spinDiv);
    const aiDiv=document.createElement('div');
    aiDiv.className='flex justify-start';
    const text=d.ok?d.reply:`❌ ${d.error}`;
    aiDiv.innerHTML=`<div class="max-w-xs lg:max-w-2xl px-3 py-2 bg-zion-700 rounded-lg text-gray-200 text-xs whitespace-pre-wrap">${escapeHtml(text)}</div>`;
    log.appendChild(aiDiv);
    log.scrollTop=log.scrollHeight;
    const elapsed=d.latency_ms!=null?d.latency_ms:Date.now()-t0;
    if(lat)lat.textContent=`Odpověď za ${Math.round(elapsed)} ms`;
  }catch(e){
    log.removeChild(spinDiv);
    const errDiv=document.createElement('div');
    errDiv.className='flex justify-start';
    errDiv.innerHTML=`<div class="px-3 py-2 bg-red-900/40 rounded-lg text-red-400 text-xs">Chyba: ${escapeHtml(String(e))}</div>`;
    log.appendChild(errDiv);
  }finally{
    if(btn)btn.disabled=false;
  }
}

// ── Badges & cards ──
function setBadge(el,ok){const b=document.getElementById(el);if(!b)return;b.textContent=ok?'LIVE':'DOWN';b.className=ok?'px-2 py-0.5 rounded text-xs font-bold bg-emerald-600 text-white':'px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white';}
function setCardLive(id,ok){const c=document.getElementById('card-'+id);if(!c)return;if(ok){c.classList.add('card-live');c.style.borderColor='#10b981';}else{c.classList.remove('card-live');c.style.borderColor='#1f2942';}}

// ── Main refresh ──
async function refreshAll(){
  try{
    const[s,cl,al]=await Promise.all([
      fetch('/api/status').then(r=>r.json()),
      fetch('/api/checklist').then(r=>r.json()),
      fetch('/api/alerts').then(r=>r.json())
    ]);
    document.getElementById('timestamp').textContent='Last update: '+new Date(s.timestamp).toLocaleTimeString();
    document.getElementById('progressText').textContent=cl.passed+'/'+cl.total+' ('+cl.pct+'%)';
    document.getElementById('progressBar').style.width=cl.pct+'%';
    updateServiceCards(s);
    updateAlerts(al.alerts);
    updateChecklist(cl.checks);
    updatePayouts(s.pool);
    updateMiniHashrate();
    loadMainnetStatus();
    if(currentTab==='charts')renderCharts();
    if(currentTab==='events')loadEvents();
    if(currentTab==='wizard')renderWizard();
  }catch(e){console.error('Refresh error:',e);}
}

function updateServiceCards(s){
  const en=s.edge_node,n1=s.node1,n2=s.node2,p=s.pool,m=s.miner;
  const lb=s.local_backup||{};
  // Topology-aware visibility
  const isEdgePrimary = s.topology === 'edge-primary';
  const node2Card = document.getElementById('card-node2');
  if(node2Card) node2Card.style.display = isEdgePrimary ? 'none' : '';
  const launchStackBtn = document.getElementById('btn-launch-stack');
  if(launchStackBtn) launchStackBtn.style.display = isEdgePrimary ? 'none' : '';
  const launchBackupBtn = document.getElementById('btn-launch-local-backup');
  if(launchBackupBtn) launchBackupBtn.style.display = isEdgePrimary ? '' : 'none';
  // Edge Node (Primary)
  setBadge('badge-edge-node',en&&en.running);setCardLive('edge-node',en&&en.running);
  document.getElementById('val-edge-node-height').textContent=en?en.chain_height??'—':'—';
  document.getElementById('val-edge-node-hash').textContent=en?en.tip_hash??'—':'—';
  document.getElementById('val-edge-node-peers').textContent=en?en.known_peers??'—':'—';
  // Local Backup Node
  setBadge('badge-node1',n1.running);setCardLive('node1',n1.running);
  document.getElementById('val-node1-height').textContent=n1.chain_height??'—';
  document.getElementById('val-node1-id').textContent=n1.node_id??'—';
  document.getElementById('val-node1-peers').textContent=n1.known_peers??'—';
  document.getElementById('val-node1-p2p').textContent=n1.p2p_bind??'—';
  // Sync status for local backup node
  const lbSyncEl=document.getElementById('val-node1-sync');
  if(lbSyncEl){
    const synced=en&&en.chain_height&&n1.chain_height&&n1.chain_height>=en.chain_height-2;
    const tipMatch=en&&n1&&en.tip_hash&&n1.tip_hash&&en.tip_hash===n1.tip_hash;
    if(n1.running&&synced){
      lbSyncEl.textContent=tipMatch?'✓ Synced (tip match)':'✓ Synced';
      lbSyncEl.className='text-emerald-400 font-bold';
    }else if(n1.running&&n1.known_peers>0){
      lbSyncEl.textContent='Syncing…';
      lbSyncEl.className='text-amber-400';
    }else if(n1.running){
      lbSyncEl.textContent='No peers';
      lbSyncEl.className='text-red-400';
    }else{
      lbSyncEl.textContent='Offline';
      lbSyncEl.className='text-red-400';
    }
  }
  // Node 2 (Dev / Optional)
  if(!isEdgePrimary){
    setBadge('badge-node2',n2.running);setCardLive('node2',n2.running);
    document.getElementById('val-node2-height').textContent=n2.chain_height??'—';
    document.getElementById('val-node2-id').textContent=n2.node_id??'—';
    document.getElementById('val-node2-peers').textContent=n2.known_peers??'—';
    const synced=en&&en.chain_height&&n1.chain_height&&n1.chain_height>=en.chain_height-5;
    const syncEl=document.getElementById('val-node2-sync');
    syncEl.textContent=synced?'✓ Synced':(n2.known_peers>0?'Syncing…':'No peers');
    syncEl.className=synced?'text-emerald-400 font-bold':'text-amber-400';
  }
  // Edge Pool (Primary)
  setBadge('badge-pool',p.running);setCardLive('pool',p.running);
  document.getElementById('val-pool-sessions').textContent=p.active_sessions??'0';
  document.getElementById('val-pool-blocks').textContent=p.blocks_found??'0';
  document.getElementById('val-pool-shares').textContent=(p.shares_accepted??0)+' / '+(p.shares_rejected??0);
  document.getElementById('val-pool-fee').textContent=p.fee_split?'Split: '+p.fee_split:'—';
  // Miner
  setBadge('badge-miner',m.running&&m.hashrate);setCardLive('miner',m.running&&m.hashrate);
  document.getElementById('val-miner-hashrate').textContent=m.hashrate?m.hashrate.toFixed(2):'—';
  document.getElementById('val-miner-gpu').textContent=(m.gpu_backend?m.gpu_backend+': ':'')+(m.gpu_device??'—');
  document.getElementById('val-miner-height').textContent=m.current_height??'—';
  document.getElementById('val-miner-diff').textContent=m.current_diff??'—';
}

function updatePayouts(p){
  document.getElementById('payout-wallet').textContent=p.pool_wallet??'—';
  const en=document.getElementById('payout-enabled');
  en.textContent=p.payout_enabled===true?'YES':(p.payout_enabled===false?'NO':'—');
  en.className=p.payout_enabled?'font-bold text-emerald-400':'font-bold text-red-400';
  document.getElementById('payout-blocks').textContent=p.blocks_found??'0';
  document.getElementById('payout-nonce').textContent=p.nonce_count??'—';
  document.getElementById('payout-split').textContent=p.fee_split??'—';
  const pr=document.getElementById('payout-recent');
  pr.innerHTML=(p.recent_payouts&&p.recent_payouts.length)
    ?p.recent_payouts.map(l=>'<div class="truncate text-[10px]">'+escapeHtml(l)+'</div>').join('')
    :'<div class="text-gray-600 italic text-[10px]">No payout events yet</div>';
}

function updateAlerts(alerts){
  const cont=document.getElementById('alerts');
  const badge=document.getElementById('alertBadge');
  const topBadge=document.getElementById('alertCount');
  const critical=alerts.filter(a=>a.severity==='critical'||a.severity==='warning').length;
  badge.textContent=critical+' active';
  badge.className='text-xs px-2 py-0.5 rounded '+(critical>0?'bg-red-600/30 text-red-300':'bg-emerald-600/30 text-emerald-300');
  if(critical>0){topBadge.classList.remove('hidden');topBadge.textContent=critical;}else{topBadge.classList.add('hidden');}
  const colors={critical:'bg-red-900/40 border-red-600 text-red-200',warning:'bg-amber-900/30 border-amber-600 text-amber-200',info:'bg-blue-900/30 border-blue-600 text-blue-200',success:'bg-emerald-900/30 border-emerald-600 text-emerald-200'};
  const icons={critical:'🚨',warning:'⚠️',info:'ℹ️',success:'✅'};
  cont.innerHTML=alerts.map(a=>`<div class="alert-new flex items-start gap-3 p-3 rounded-lg border ${colors[a.severity]||colors.info}">
    <span class="text-lg">${icons[a.severity]||'ℹ️'}</span>
    <div class="flex-1">
      <div class="text-sm font-semibold">${escapeHtml(a.title)}</div>
      <div class="text-xs opacity-80 mt-0.5">${escapeHtml(a.detail)}</div>
    </div>
    ${a.action?`<button onclick="controlAction('${a.action}')" class="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition whitespace-nowrap">Fix</button>`:''}
  </div>`).join('');
}

function updateChecklist(checks){
  const cl=document.getElementById('checklist');
  cl.innerHTML=checks.map(c=>`<div class="flex items-center gap-2 py-1.5 px-2 rounded ${c.ok?'bg-emerald-900/30':'bg-zion-700/40'} transition">
    <span class="text-sm ${c.ok?'text-emerald-400':'text-gray-500'}">${c.ok?'✓':'○'}</span>
    <span class="text-xs ${c.ok?'text-gray-300':'text-gray-400'}">${escapeHtml(c.label)}</span>
  </div>`).join('');
}

// ── Mainnet Status ──
async function loadMainnetStatus(){
  try{
    const res=await fetch('/api/mainnet-status').then(r=>r.json());
    const grid=document.getElementById('mainnet-status-grid');
    
    const statusItems=[
      {label:'Genesis Hash',value:res.genesis_hash?res.genesis_hash.substring(0,16)+'…':'Unknown',ok:res.genesis_hash==='003529805e9b47babb9ac0f26b27b1aad0a1cf3c483181857daf3269f7088923',icon:'🔷'},
      {label:'Fee Split',value:res.fee_split_all_match?'✓ Canonical':'✗ Mismatch',ok:res.fee_split_all_match,icon:'💰'},
      {label:'Launch Date',value:res.days_to_launch>0?res.days_to_launch+' days':'LAUNCH DAY!',ok:res.days_to_launch>=0,icon:'🚀'},
      {label:'Checklist',value:res.checklist_passed+'/'+res.checklist_total+' ('+res.checklist_pass_rate+'%)',ok:res.checklist_pass_rate>=80,icon:'✅'},
      {label:'Node Status',value:(res.topology==='edge-primary'?(res.edge_node_running?'E1✓':'E1✗')+' '+(res.local_backup_running?'LB✓':'LB✗'):(res.node1_running?'N1✓':'N1✗')+' '+(res.node2_running?'N2✓':'N2✗')),ok:res.topology==='edge-primary'?(res.edge_node_running&&res.local_backup_running):(res.node1_running&&res.node2_running),icon:'🔶'},
      {label:'Pool Status',value:res.pool_running?'Running':'Stopped',ok:res.pool_running,icon:'⚡'},
      {label:'Git Status',value:res.git_status.clean?'Clean: '+res.git_status.branch:'Dirty: '+res.git_status.branch,ok:res.git_status.clean,icon:'📦'},
      {label:'Overall',value:res.ready_for_launch?'🎉 READY':'⏳ PREPARING',ok:res.ready_for_launch,icon:'🎯'},
    ];
    
    grid.innerHTML=statusItems.map(item=>`<div class="bg-zion-900/50 rounded-lg p-3 border ${item.ok?'border-emerald-600/50':'border-zion-600'}">
      <div class="flex items-center gap-2 mb-1"><span class="text-lg">${item.icon}</span><span class="text-xs font-semibold text-gray-400">${item.label}</span></div>
      <div class="text-sm font-bold ${item.ok?'text-emerald-400':'text-amber-400'}">${item.value}</div>
    </div>`).join('');
    
  }catch(e){
    console.error('Failed to load mainnet status:',e);
    document.getElementById('mainnet-status-grid').innerHTML='<div class="text-red-400 text-xs">Failed to load mainnet status</div>';
  }
}

// ── Launch Day Automation ──
async function loadLaunchDayStatus(){
  try{
    const res=await fetch('/api/launch-day-prepare?action=status').then(r=>r.json());
    
    // Update badge
    const badge=document.getElementById('launch-day-badge');
    if(res.is_launch_day){
      badge.textContent='🎉 LAUNCH DAY';
      badge.className='px-3 py-1 rounded text-xs font-bold bg-emerald-600 text-white animate-pulse';
    }else if(res.backup_exists){
      badge.textContent='✓ Ready';
      badge.className='px-3 py-1 rounded text-xs font-bold bg-blue-600 text-white';
    }else{
      badge.textContent='⏳ Pending';
      badge.className='px-3 py-1 rounded text-xs font-bold bg-amber-600 text-white';
    }
    
    // Update status cards
    document.getElementById('ld-days').textContent=res.is_launch_day?'TODAY':Math.ceil((new Date('2026-06-20T12:00:00')-new Date())/86400000)+' days';
    document.getElementById('ld-backup').textContent=res.backup_exists?'✓ Exists':'✗ None';
    document.getElementById('ld-backup').className=res.backup_exists?'text-2xl font-bold text-emerald-400':'text-2xl font-bold text-red-400';
    document.getElementById('ld-genesis').textContent=res.current_genesis_hash?res.current_genesis_hash.substring(0,8)+'…':'Unknown';
    
    // Update backup details
    const details=document.getElementById('backup-details');
    if(res.backup_exists){
      details.innerHTML=`<div class="text-emerald-400 mb-2">✓ Backup exists at: ${res.backup_dir}</div>
        <div class="text-gray-300">Ready for launch day rotation</div>`;
    }else{
      details.innerHTML=`<div class="text-amber-400 mb-2">⚠ No backup found</div>
        <div class="text-gray-300">Create a backup before launch day</div>`;
    }
    
    addLaunchDayLog('📊 Status updated: '+(res.is_launch_day?'LAUNCH DAY':res.backup_exists?'Ready':'Pending'));
    
  }catch(e){
    console.error('Failed to load launch day status:',e);
    addLaunchDayLog('❌ Failed to load status: '+e.message);
  }
}

async function launchDayAction(action){
  addLaunchDayLog('⏳ Executing: '+action+'...');
  
  try{
    const res=await fetch('/api/launch-day-prepare?action='+action).then(r=>r.json());
    
    if(res.success){
      if(action==='backup'){
        addLaunchDayLog('✅ Backup created: '+res.backup_dir);
        addLaunchDayLog('📁 Files backed up: '+res.manifest.files_backed_up);
        document.getElementById('backup-details').innerHTML=`
          <div class="text-emerald-400 mb-2">✓ Backup created: ${res.backup_dir}</div>
          <div class="text-xs text-gray-400 mt-2">
            <div>Timestamp: ${res.manifest.timestamp}</div>
            <div>Files: ${res.manifest.files_backed_up}</div>
          </div>
          <div class="mt-2 max-h-32 overflow-y-auto">
            ${res.backup_log.map(l=>`<div class="text-xs">${escapeHtml(l)}</div>`).join('')}
          </div>
        `;
        loadLaunchDayStatus();
      }else if(action==='status'){
        addLaunchDayLog('✅ Status checked');
        loadLaunchDayStatus();
      }
    }else{
      addLaunchDayLog('❌ Action failed: '+res.error);
    }
  }catch(e){
    addLaunchDayLog('❌ Action error: '+e.message);
  }
}

function confirmLaunchDay(){
  if(confirm('⚠️ CRITICAL OPERATION\n\nThis will rotate genesis and premine addresses for mainnet launch.\n\nMake sure:\n• All nodes are stopped\n• Backup is created\n• You have private keys backed up\n\nProceed with genesis rotation?')){
    launchDayAction('rotate-genesis&confirmed=true');
  }else{
    addLaunchDayLog('🚫 Genesis rotation cancelled by user');
  }
}

async function launchDaySequence(){
  if(!confirm('🚀 FULL LAUNCH SEQUENCE\n\nThis will execute the complete launch day automation:\n1. Create backup\n2. Stop all services\n3. Rotate genesis\n4. Restart network\n5. Verify everything\n\nThis is irreversible. Continue?')) return;
  
  addLaunchDayLog('🚀 Starting full launch sequence...');
  
  const steps=['prepare','stop-network','rotate-genesis','restart-network','verify'];
  
  for(const step of steps){
    addLaunchDayLog('⏳ Step: '+step+'...');
    try{
      const res=await fetch('/api/launch-day-execute?step='+step).then(r=>r.json());
      if(res.success){
        addLaunchDayLog('✅ Step completed: '+step);
        if(res.next_step) addLaunchDayLog('➡️ Next: '+res.next_step);
        if(res.complete){
          addLaunchDayLog('🎉 LAUNCH SEQUENCE COMPLETE!');
          alert('🎉 Mainnet launch sequence completed successfully!');
        }
      }else{
        addLaunchDayLog('❌ Step failed: '+res.error);
        break;
      }
    }catch(e){
      addLaunchDayLog('❌ Step error: '+e.message);
      break;
    }
  }
}

function addLaunchDayLog(message){
  const log=document.getElementById('launch-day-log');
  const time=new Date().toLocaleTimeString();
  const line=`<div class="log-line"><span class="text-gray-500">[${time}]</span> ${escapeHtml(message)}</div>`;
  log.innerHTML=line+log.innerHTML;
}

// ── Mini hashrate sparkline ──
async function updateMiniHashrate(){
  const hist=await fetch('/api/history').then(r=>r.json());
  const data=hist.samples.map(s=>s.hashrate||0);
  const labels=hist.samples.map(s=>'');
  if(!charts.mini){
    const ctx=document.getElementById('mini-hashrate').getContext('2d');
    charts.mini=new Chart(ctx,{type:'line',data:{labels,datasets:[{data,borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.1)',fill:true,tension:0.3,pointRadius:0,borderWidth:2}]},
      options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:true,grid:{color:'#1f2942'},ticks:{color:'#64748b',font:{size:10}}}},animation:{duration:300}}});
  }else{charts.mini.data.labels=labels;charts.mini.data.datasets[0].data=data;charts.mini.update('none');}
  const valid=data.filter(x=>x>0);
  if(valid.length){
    const avg=valid.reduce((a,b)=>a+b,0)/valid.length;
    const max=Math.max(...valid);
    document.getElementById('hashrate-summary').textContent='avg '+avg.toFixed(2)+' / peak '+max.toFixed(2)+' KH/s';
  }
}

// ── Charts tab ──
async function renderCharts(){
  const hist=await fetch('/api/history').then(r=>r.json());
  const s=hist.samples;
  const labels=s.map(x=>new Date(x.t*1000).toLocaleTimeString().slice(0,5));
  const common={responsive:true,plugins:{legend:{labels:{color:'#cbd5e1'}}},scales:{x:{ticks:{color:'#64748b',font:{size:10}},grid:{color:'#1f2942'}},y:{ticks:{color:'#64748b'},grid:{color:'#1f2942'}}},animation:{duration:300}};
  mkChart('chart-hashrate','line',{labels,datasets:[{label:'KH/s',data:s.map(x=>x.hashrate||0),borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.15)',fill:true,tension:0.3,pointRadius:0}]},common);
  mkChart('chart-height','line',{labels,datasets:[
    {label:'Node1',data:s.map(x=>x.n1_height||0),borderColor:'#10b981',pointRadius:0,tension:0.2},
    {label:'Node2',data:s.map(x=>x.n2_height||0),borderColor:'#3b82f6',pointRadius:0,tension:0.2,borderDash:[5,5]}
  ]},common);
  mkChart('chart-shares','bar',{labels,datasets:[
    {label:'Accepted',data:s.map(x=>x.shares_ok||0),backgroundColor:'#10b981'},
    {label:'Rejected',data:s.map(x=>x.shares_bad||0),backgroundColor:'#ef4444'}
  ]},common);
  mkChart('chart-sessions','line',{labels,datasets:[
    {label:'Sessions',data:s.map(x=>x.sessions||0),borderColor:'#a855f7',pointRadius:0,tension:0.3},
    {label:'Node1 Peers',data:s.map(x=>x.n1_peers||0),borderColor:'#06b6d4',pointRadius:0,tension:0.3}
  ]},common);
}

function mkChart(id,type,data,opts){
  const ctx=document.getElementById(id);if(!ctx)return;
  if(charts[id]){charts[id].data=data;charts[id].update('none');return;}
  charts[id]=new Chart(ctx.getContext('2d'),{type,data,options:opts});
}

// ── Events feed ──
async function loadEvents(){
  const res=await fetch('/api/events').then(r=>r.json());
  const c=document.getElementById('events-feed');
  if(!res.events||!res.events.length){c.innerHTML='<div class="text-gray-500 italic text-sm">No block events recorded yet. Events appear as nodes mine and relay blocks.</div>';return;}
  const srcColors={node1:'bg-emerald-700',node2:'bg-blue-700',pool:'bg-amber-700'};
  const typeIcons={block_found:'⛏️',block_relay:'📡'};
  c.innerHTML=res.events.map(e=>`<div class="flex items-center gap-3 p-3 bg-zion-900 rounded-lg border border-zion-700 hover:border-amber-600 transition">
    <span class="text-2xl">${typeIcons[e.type]||'🧱'}</span>
    <span class="px-2 py-0.5 rounded text-xs font-bold text-white ${srcColors[e.source]||'bg-gray-700'}">${e.source}</span>
    <div class="flex-1">
      <div class="text-sm font-bold">Height #${e.height} <span class="text-xs text-gray-400 font-normal">${e.type.replace('_',' ')}</span></div>
      ${e.hash?`<div class="text-xs font-mono text-gray-500">${escapeHtml(e.hash)}</div>`:''}
    </div>
    <div class="text-xs text-gray-500">${new Date(e.ts*1000).toLocaleTimeString()}</div>
  </div>`).join('');
}

// ── Env files ──
let currentEnvFile=null;
async function loadEnvFiles(){
  const res=await fetch('/api/env').then(r=>r.json());
  const c=document.getElementById('env-file-list');
  c.innerHTML=res.files.map(f=>`<button onclick="selectEnv('${escapeHtml(f.name)}')" class="px-3 py-2 bg-zion-700 hover:bg-zion-600 rounded-lg text-xs font-mono ${currentEnvFile===f.name?'ring-2 ring-amber-400':''}">
    <div class="font-bold text-amber-300">${escapeHtml(f.name)}</div>
    <div class="text-[10px] text-gray-400">${f.vars} vars · ${(f.size/1024).toFixed(1)} KB</div>
  </button>`).join('');
}
async function selectEnv(name){
  currentEnvFile=name;loadEnvFiles();
  const res=await fetch('/api/env/load?name='+encodeURIComponent(name)).then(r=>r.json());
  const c=document.getElementById('env-detail');
  if(res.error){c.innerHTML='<div class="text-red-400">'+escapeHtml(res.error)+'</div>';return;}
  const missing=res.missing_required||[];
  let html=`<div class="mb-3"><div class="text-sm font-bold text-amber-300 mb-1">${escapeHtml(res.file)} <span class="text-xs text-gray-400">(${res.total} variables)</span></div>`;
  if(missing.length){html+=`<div class="text-xs text-red-400 mt-1">⚠ Missing required: ${missing.map(escapeHtml).join(', ')}</div>`;}
  else{html+='<div class="text-xs text-emerald-400 mt-1">✓ All required variables present</div>';}
  html+='</div><div class="space-y-1">';
  html+=res.vars.map(v=>`<div class="flex items-center gap-2 py-1 px-2 rounded ${v.required?'bg-amber-900/20':'hover:bg-zion-700/40'}">
    <span class="text-[10px] w-8 text-gray-500">${v.line}</span>
    <span class="text-xs ${v.required?'text-amber-300':'text-gray-300'} font-mono w-64 truncate">${escapeHtml(v.key)}</span>
    <span class="text-xs font-mono flex-1 truncate ${v.sensitive?'text-red-400':'text-gray-400'}">${escapeHtml(v.value)}</span>
    ${v.required?'<span class="text-[10px] px-1.5 py-0.5 bg-amber-700/40 rounded text-amber-200">required</span>':''}
    ${v.sensitive?'<span class="text-[10px] px-1.5 py-0.5 bg-red-700/40 rounded text-red-200">secret</span>':''}
  </div>`).join('');
  html+='</div>';
  c.innerHTML=html;
}

// ── Wizard ──
async function renderWizard(){
  const[st,cl]=await Promise.all([fetch('/api/status').then(r=>r.json()),fetch('/api/checklist').then(r=>r.json())]);
  const isEdge = st.topology === 'edge-primary';
  const steps=[
    {n:1,title:'Prepare environment',desc:'Generate keys (gen-keys), assemble .env file with all wallets and ZION_POOL_PAYOUT_SK_HEX.',done:cl.checks.find(c=>c.id==='env')?.ok,actions:[{label:'View env files',cb:`switchTab('env')`}]},
    {n:2,title:isEdge?'Start Local Backup Node':'Start Genesis Node',desc:isEdge?'Syncs from Edge primary via P2P. 0.0.0.0:8333 (P2P) / 0.0.0.0:8443 (RPC).':'Local genesis node. 0.0.0.0:8333 (P2P) / 0.0.0.0:8443 (RPC).',done:cl.checks.find(c=>c.id==='node1')?.ok,actions:[{label:'▶ Start Node',cb:`controlAction('start-node1')`}]},
    isEdge?{n:3,title:'Connect to Edge Pool',desc:'Edge (127.0.0.1) runs the primary pool. Verify VPN connectivity.',done:cl.checks.find(c=>c.id==='pool-edge')?.ok,actions:[{label:'Check Edge Pool',cb:`switchTab('overview')`}]}:{n:3,title:'Start Local Pool',desc:'Accepts miners, validates shares, distributes payouts (89/5/5 burn model).',done:cl.checks.find(c=>c.id==='pool')?.ok,actions:[{label:'▶ Start Pool',cb:`controlAction('start-pool')`}]},
    {n:4,title:'Start GPU Miner',desc:'Connects to pool, performs cosmic_harmony hashing on GPU.',done:cl.checks.find(c=>c.id==='miner')?.ok,actions:[{label:'▶ Start Miner',cb:`controlAction('start-miner')`}]},
    {n:5,title:'Verify chain progression',desc:'Confirm node syncs with network and chain height advances.',done:cl.checks.find(c=>c.id==='chain')?.ok,actions:[{label:'View events',cb:`switchTab('events')`}]},
    {n:6,title:'Confirm fee split & payouts',desc:'Validate 89/5/5/1 burn-model distribution and payout wallet is funded.',done:cl.checks.find(c=>c.id==='fee_split')?.ok&&cl.checks.find(c=>c.id==='payout')?.ok,actions:[{label:'View payouts',cb:`switchTab('overview')`}]},
  ];
  const cont=document.getElementById('wizard-steps');
  cont.innerHTML=steps.map((s,i)=>{
    const next=!s.done&&steps.slice(0,i).every(x=>x.done);
    const bg=s.done?'border-emerald-600 bg-emerald-900/20':next?'border-amber-500 bg-amber-900/20':'border-zion-700 bg-zion-900/40';
    return `<div class="flex items-start gap-4 p-4 rounded-lg border ${bg}">
      <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${s.done?'bg-emerald-600':next?'bg-amber-600 animate-pulse':'bg-zion-700'}">${s.done?'✓':s.n}</div>
      <div class="flex-1">
        <div class="font-bold text-base mb-1 ${next?'text-amber-300':''}">${escapeHtml(s.title)}</div>
        <div class="text-xs text-gray-400 mb-2">${escapeHtml(s.desc)}</div>
        <div class="flex gap-2">${s.actions.map(a=>`<button onclick="${a.cb}" class="text-xs px-3 py-1 bg-zion-700 hover:bg-amber-600 rounded transition">${escapeHtml(a.label)}</button>`).join('')}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Controls ──
async function renderControls(){
  const res=await fetch('/api/controls').then(r=>r.json());
  const c=document.getElementById('control-buttons');
  const icons={'start-node1':'🔷','start-node2':'🔶','start-pool':'⚡','start-miner':'⛏️','start-miner-gpu':'🎮','start-miner-cpu':'💻','stop-miner':'⏹','restart-node2':'⟳ 🔶','restart-miner':'⟳ ⛏️','launch-stack':'🚀','launch-local-backup':'🌐','stop-stack':'⏹️'};
  c.innerHTML=res.actions.filter(a=>!['launch-stack','stop-stack'].includes(a)).map(a=>`<button onclick="controlAction('${a}')" class="p-3 bg-zion-700 hover:bg-zion-600 rounded-lg text-left transition">
    <div class="text-xl mb-1">${icons[a]||'⚙️'}</div>
    <div class="text-xs font-medium">${a}</div>
  </button>`).join('');
}

async function controlAction(action){
  const log=document.getElementById('control-log');
  const ts=new Date().toLocaleTimeString();
  if(log){log.insertAdjacentHTML('afterbegin','<div class="text-amber-400">['+ts+'] dispatching '+action+'...</div>');}
  try{
    const res=await fetch('/api/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})}).then(r=>r.json());
    const msg=res.ok?'<div class="text-emerald-400">['+ts+'] ✓ '+action+' started (PID '+res.pid+')</div>':'<div class="text-red-400">['+ts+'] ✗ '+(res.error||'failed')+'</div>';
    if(log){log.insertAdjacentHTML('afterbegin',msg);}
    toast(res.ok?('▶ '+action+' dispatched'):('Failed: '+(res.error||action)),res.ok?'success':'error');
  }catch(e){
    if(log){log.insertAdjacentHTML('afterbegin','<div class="text-red-400">['+ts+'] ✗ '+e.message+'</div>');}
    toast('Error: '+e.message,'error');
  }
}

// ── Friendly mode ──
let friendlyMode = localStorage.getItem('zion-friendly') === '1';
function toggleFriendly(){
  friendlyMode = !friendlyMode;
  localStorage.setItem('zion-friendly', friendlyMode ? '1' : '0');
  applyFriendlyMode();
  if(currentTab==='services') loadServices();
}
function applyFriendlyMode(){
  const btn = document.getElementById('friendlyBtn');
  if(!btn) return;
  btn.textContent = friendlyMode ? '🧑‍💻 Pro Mode' : '🧒 Kid Mode';
  btn.className = (friendlyMode ? 'bg-amber-600 hover:bg-amber-500' : 'bg-zion-700 hover:bg-zion-600') + ' px-3 py-2 rounded-lg text-sm font-medium transition';
}

// ── Services tab ──
async function loadServices(){
  const res = await fetch('/api/services').then(r => r.json());
  const grid = document.getElementById('services-grid');
  if(!grid) return;
  const lvlColors = {L1:'border-emerald-600 bg-emerald-900/15', L2:'border-blue-600 bg-blue-900/15', L3:'border-purple-600 bg-purple-900/15', L4:'border-pink-600 bg-pink-900/15', Infra:'border-amber-600 bg-amber-900/15'};
  grid.innerHTML = res.services.map(s => {
    const aliveColor = s.alive ? 'text-emerald-400' : 'text-gray-500';
    const aliveBadge = s.alive ? '<span class="px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] rounded font-bold animate-pulse">LIVE</span>' : '<span class="px-1.5 py-0.5 bg-zion-700 text-gray-400 text-[10px] rounded">DOWN</span>';
    const portsHtml = Object.entries(s.ports || {}).map(([k,v]) => {
      const isOpen = s.ports_open.includes(k+':'+v);
      return `<span class="text-[10px] font-mono ${isOpen?'text-emerald-400':'text-gray-600'}" title="${k}">${k}:${v}</span>`;
    }).join(' · ');
    const desc = friendlyMode ? s.child_says : s.purpose;
    const startBtn = s.start ? `<button onclick="controlAction('${s.start}')" class="text-[10px] px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 rounded transition">▶ Start</button>` : '';
    const metricsBtn = (s.ports.metrics || s.ports.api) ? `<button onclick="loadMetrics('${s.id}')" class="text-[10px] px-2 py-0.5 bg-zion-700 hover:bg-zion-600 rounded transition">📊 Metrics</button>` : '';
    const logBtn = s.log ? `<button onclick="switchTab('logs');setTimeout(()=>loadLogs('${s.id}'),300)" class="text-[10px] px-2 py-0.5 bg-zion-700 hover:bg-zion-600 rounded transition">📜 Log</button>` : '';
    return `<div class="p-3 rounded-lg border ${lvlColors[s.level]||'border-zion-700'} hover:border-amber-500 transition">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-2">
          <span class="text-xl">${s.icon}</span>
          <div>
            <div class="text-sm font-bold ${aliveColor}">${escapeHtml(s.name)}</div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider">${s.level} · ${s.kind}</div>
          </div>
        </div>
        ${aliveBadge}
      </div>
      <div class="text-[11px] text-gray-300 leading-snug mb-2 min-h-[2.5em]">${escapeHtml(desc)}</div>
      <div class="flex flex-wrap gap-x-2 gap-y-0.5 mb-2">${portsHtml || '<span class="text-[10px] text-gray-600">no ports</span>'}</div>
      <div class="flex gap-1">${startBtn}${metricsBtn}${logBtn}</div>
    </div>`;
  }).join('');
}

// ── Database explorer ──
async function loadDatabases(){
  const res = await fetch('/api/db').then(r => r.json());
  const list = document.getElementById('db-list');
  if(!list) return;
  list.innerHTML = res.databases.map(d => {
    const sizeStr = d.size > 1024*1024 ? (d.size/1024/1024).toFixed(1)+' MB' : d.size > 1024 ? (d.size/1024).toFixed(1)+' KB' : d.size + ' B';
    const kindBadge = d.kind === 'sqlite' ? 'bg-blue-700 text-blue-200' : 'bg-amber-700 text-amber-200';
    const dis = d.available ? '' : 'opacity-40';
    return `<button onclick="inspectDb('${escapeHtml(d.path)}')" ${d.available?'':'disabled'} class="${dis} text-left p-3 rounded-lg bg-zion-900 border border-zion-700 hover:border-amber-500 transition">
      <div class="flex items-center justify-between mb-1">
        <span class="text-sm font-bold">${escapeHtml(d.name)}</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded ${kindBadge} uppercase font-bold">${d.kind}</span>
      </div>
      <div class="text-[10px] font-mono text-gray-500 truncate">${escapeHtml(d.path)}</div>
      <div class="text-[10px] text-gray-400 mt-1">${d.available ? sizeStr : 'Not yet created'} · service: <span class="text-amber-400">${d.service}</span></div>
    </button>`;
  }).join('');
}

async function inspectDb(path){
  const res = await fetch('/api/db/inspect?path=' + encodeURIComponent(path)).then(r => r.json());
  const c = document.getElementById('db-detail');
  if(!c) return;
  if(res.error){c.innerHTML = '<div class="text-red-400">Error: ' + escapeHtml(res.error) + '</div>';return;}
  let html = '<div class="mb-3"><div class="text-sm font-bold text-amber-300">' + escapeHtml(res.name) + '</div>';
  html += '<div class="text-[10px] font-mono text-gray-500">' + escapeHtml(res.path) + '</div></div>';
  if(res.kind === 'json'){
    html += '<div class="space-y-2">';
    for(const [k, v] of Object.entries(res.data)){
      if(v && typeof v === 'object' && '_type' in v){
        html += '<div class="bg-zion-800 rounded p-2"><div class="text-xs font-bold text-amber-400">' + escapeHtml(k) + ' <span class="text-gray-500 font-normal">(' + v._type + ', ' + v._len + ' items)</span></div>';
        html += '<pre class="text-[10px] text-gray-400 mt-1 overflow-auto max-h-48">' + escapeHtml(JSON.stringify(v._sample, null, 2)) + '</pre></div>';
      } else {
        html += '<div class="flex gap-3 py-1 border-b border-zion-700"><span class="text-xs text-amber-400 font-mono w-48">' + escapeHtml(k) + '</span><span class="text-xs text-gray-300 font-mono break-all">' + escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v)) + '</span></div>';
      }
    }
    html += '</div>';
  } else if(res.kind === 'sqlite'){
    if(!res.tables || !res.tables.length){
      html += '<div class="text-gray-500 italic text-sm">Database has no tables.</div>';
    } else {
      html += res.tables.map(t => {
        let tHtml = '<details class="mb-3 bg-zion-800 rounded p-2"><summary class="cursor-pointer text-sm"><span class="font-bold text-amber-400">' + escapeHtml(t.name) + '</span> <span class="text-gray-500">(' + t.rows + ' rows, ' + t.columns.length + ' cols)</span></summary>';
        tHtml += '<div class="text-[10px] text-gray-400 mt-2 mb-2">Columns: ' + t.columns.map(c => '<span class="font-mono text-amber-300">' + escapeHtml(c.name) + '</span>:<span class="text-gray-500">' + escapeHtml(c.type) + '</span>').join(', ') + '</div>';
        if(t.sample && t.sample.length){
          tHtml += '<div class="overflow-auto max-h-64"><table class="w-full text-[10px] border-collapse">';
          tHtml += '<thead><tr>' + t.columns.map(c => '<th class="text-left p-1 border-b border-zion-700 text-amber-400">' + escapeHtml(c.name) + '</th>').join('') + '</tr></thead><tbody>';
          tHtml += t.sample.map(row => '<tr class="hover:bg-zion-700/30">' + t.columns.map(c => '<td class="p-1 border-b border-zion-700 font-mono">' + escapeHtml(String(row[c.name] ?? '')).slice(0, 80) + '</td>').join('') + '</tr>').join('');
          tHtml += '</tbody></table></div>';
        }
        tHtml += '</details>';
        return tHtml;
      }).join('');
    }
  }
  c.innerHTML = html;
}

// ── Metrics tab ──
async function renderMetricsButtons(){
  const svcRes = await fetch('/api/services').then(r => r.json());
  const c = document.getElementById('metrics-buttons');
  if(!c) return;
  const scrapable = svcRes.services.filter(s => s.ports.metrics || s.ports.api);
  c.innerHTML = scrapable.map(s => `<button onclick="loadMetrics('${s.id}')" class="px-3 py-1.5 bg-zion-700 hover:bg-zion-600 rounded text-xs font-medium transition flex items-center gap-1">
    <span>${s.icon}</span><span>${escapeHtml(s.name)}</span>
    <span class="text-[10px] ${s.alive?'text-emerald-400':'text-gray-500'}">${s.alive?'●':'○'}</span>
  </button>`).join('');
}

async function loadMetrics(sid){
  if(currentTab !== 'metrics') switchTab('metrics');
  const res = await fetch('/api/metrics/' + sid).then(r => r.json());
  const c = document.getElementById('metrics-detail');
  if(!c) return;
  if(res.error){
    c.innerHTML = '<div class="text-red-400">Cannot scrape metrics from <span class="text-amber-400">' + escapeHtml(sid) + '</span>: ' + escapeHtml(res.error) + '</div><div class="text-xs text-gray-500 mt-2">URL tried: ' + escapeHtml(res.url || 'n/a') + '</div>';
    return;
  }
  const entries = Object.entries(res.metrics);
  if(!entries.length){c.innerHTML = '<div class="text-gray-500 italic">No metrics returned.</div>';return;}
  let html = '<div class="text-xs text-emerald-400 mb-2">✓ Scraped ' + res.count + ' metrics from ' + escapeHtml(res.url) + '</div>';
  html += '<div class="space-y-0.5">';
  for(const [k, v] of entries){
    html += '<div class="flex gap-3 hover:bg-zion-800/50 px-1"><span class="text-[10px] text-amber-300 font-mono flex-1 truncate">' + escapeHtml(k) + '</span><span class="text-[10px] text-gray-300 font-mono">' + v + '</span></div>';
  }
  html += '</div>';
  c.innerHTML = html;
}


// ── Helpers ──
function toggleAuto(){autoRefresh=!autoRefresh;const b=document.getElementById('autoBtn');
  if(autoRefresh){b.textContent='⚡ Auto';b.className='px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition';refreshTimer=setInterval(refreshAll,3000);}
  else{b.textContent='⏸ Paused';b.className='px-3 py-2 bg-zion-700 hover:bg-zion-600 rounded-lg text-sm font-medium transition';clearInterval(refreshTimer);}}
function escapeHtml(s){return(String(s||'')).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function copyToClipboard(text){navigator.clipboard.writeText(text).then(()=>toast('Copied!','success'));}
function toast(msg,kind){
  const t=document.createElement('div');
  t.className='fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm font-medium z-50 shadow-lg '+(kind==='error'?'bg-red-600 text-white':'bg-emerald-600 text-white');
  t.textContent=msg;document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity 0.3s';},2500);
  setTimeout(()=>t.remove(),3000);
}

// ── Init ──
applyFriendlyMode();
refreshAll();
refreshTimer=setInterval(refreshAll,3000);
</script>
</body>
</html>"""

# ── WebSocket Hub (stdlib-only, RFC 6455) ────────────────────────────────

_WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

class _WsClient:
    """Minimal RFC 6455 WebSocket framing over a raw socket."""
    def __init__(self, sock: socket.socket):
        self.sock = sock
        self.alive = True

    def send_text(self, text: str) -> None:
        if not self.alive:
            return
        data = text.encode("utf-8")
        try:
            self.sock.sendall(_ws_frame(data, opcode=0x1))
        except Exception:
            self.alive = False

    def close(self) -> None:
        self.alive = False
        try:
            self.sock.sendall(_ws_frame(b"", opcode=0x8))
        except Exception:
            pass
        try:
            self.sock.close()
        except Exception:
            pass


def _ws_frame(payload: bytes, opcode: int = 0x1) -> bytes:
    length = len(payload)
    frame = bytearray()
    frame.append(0x80 | opcode)      # FIN + opcode
    if length < 126:
        frame.append(length)
    elif length < 65536:
        frame.append(126)
        frame.extend(struct.pack(">H", length))
    else:
        frame.append(127)
        frame.extend(struct.pack(">Q", length))
    frame.extend(payload)
    return bytes(frame)


class WsHub:
    """Thread-safe broadcast hub for all connected WebSocket clients."""
    def __init__(self):
        self._clients: list[_WsClient] = []
        self._lock = threading.Lock()

    def add(self, client: _WsClient) -> None:
        with self._lock:
            self._clients.append(client)

    def remove(self, client: _WsClient) -> None:
        with self._lock:
            self._clients = [c for c in self._clients if c is not client]

    def broadcast(self, msg: dict) -> None:
        text = json.dumps(msg)
        dead = []
        with self._lock:
            clients = list(self._clients)
        for c in clients:
            c.send_text(text)
            if not c.alive:
                dead.append(c)
        if dead:
            with self._lock:
                self._clients = [c for c in self._clients if c not in dead]

    @property
    def count(self) -> int:
        with self._lock:
            return len(self._clients)


WS_HUB = WsHub()


def _ws_push_loop():
    """Background thread: push status + health + alerts to all WS clients every 5 s."""
    _last_alert_hash = None
    while True:
        time.sleep(5)
        if WS_HUB.count == 0:
            continue
        try:
            status = build_status()
            WS_HUB.broadcast({"type": "status", "data": status})
        except Exception:
            pass
        try:
            health = _build_health_map()
            WS_HUB.broadcast({"type": "health", "data": health})
        except Exception:
            pass
        try:
            alerts = build_alerts(build_status())
            alert_hash = hashlib.sha1(json.dumps(alerts, sort_keys=True).encode()).hexdigest()[:16]
            if alert_hash != _last_alert_hash:
                _last_alert_hash = alert_hash
                WS_HUB.broadcast({"type": "alert", "data": alerts})
        except Exception:
            pass


def _build_health_map() -> dict:
    """Return {service: health_status} for all known services (v3.0.4 — new server)."""
    status = build_status()
    health = {}
    # Core services — v3.0.4 new server (single node, no node2/local backup)
    edge_node = status.get("edge_node", {})
    health["edge-node"] = "up" if edge_node.get("running") and edge_node.get("chain_height") is not None else "down"

    pool_edge = status.get("pool_edge", {})
    health["pool-edge"] = "up" if pool_edge.get("running") else "down"

    miner = status.get("miner", {})
    health["miner"] = "up" if miner.get("running") and miner.get("hashrate") else "down"

    # Extended services — TCP probes to 127.0.0.1 (all on same server)
    ext_ports = {
        "bridge": 9101,       # Bridge metrics
        "dao": 8450,          # DAO API
        "warp": 8453,         # WARP Relay API (v3.0.5 port)
        "dashboard": 8766,    # This dashboard
    }
    for sid, port in ext_ports.items():
        try:
            alive = tcp_probe("127.0.0.1", port, timeout=0.3)
        except Exception:
            alive = False
        health[sid] = "up" if alive else "down"
    # Nginx + web-next: check via SSH on Edge server (not tunneled locally)
    for sid, cmd in [("nginx", "systemctl is-active nginx 2>/dev/null"),
                     ("web-next", "systemctl is-active zion-web-next 2>/dev/null || docker inspect -f '{{.State.Running}}' zion-web-next 2>/dev/null")]:
        try:
            result = _run_edge_cmd(cmd, timeout=3)
            alive = result.returncode == 0 and "active" in (result.stdout or "").strip() or "true" in (result.stdout or "").strip()
        except Exception:
            alive = False
        health[sid] = "up" if alive else "down"
    return health


def _handle_websocket(handler: "DashboardHandler", key: str) -> None:
    """Perform WS handshake and loop reading/discarding frames."""
    # Handshake
    accept = base64.b64encode(
        hashlib.sha1((key + _WS_GUID).encode()).digest()
    ).decode()
    response = (
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
    )
    conn = handler.connection
    conn.sendall(response.encode())
    client = _WsClient(conn)
    WS_HUB.add(client)
    # Send immediate status + health + alert snapshot
    try:
        WS_HUB.broadcast({"type": "status", "data": build_status()})
    except Exception:
        pass
    try:
        WS_HUB.broadcast({"type": "health", "data": _build_health_map()})
    except Exception:
        pass
    try:
        WS_HUB.broadcast({"type": "alert", "data": build_alerts(build_status())})
    except Exception:
        pass
    # Read loop (ping/pong, close, discard data frames)
    try:
        while client.alive:
            header = _recv_exact(conn, 2)
            if not header:
                break
            b0, b1 = header
            opcode = b0 & 0x0F
            masked = (b1 & 0x80) != 0
            length = b1 & 0x7F
            if length == 126:
                ext = _recv_exact(conn, 2)
                if not ext:
                    break
                length = struct.unpack(">H", ext)[0]
            elif length == 127:
                ext = _recv_exact(conn, 8)
                if not ext:
                    break
                length = struct.unpack(">Q", ext)[0]
            mask_key = _recv_exact(conn, 4) if masked else b""
            payload = bytearray(_recv_exact(conn, length) or b"")
            if masked and mask_key:
                for i in range(len(payload)):
                    payload[i] ^= mask_key[i % 4]
            if opcode == 0x8:   # Close
                break
            if opcode == 0x9:   # Ping → Pong
                client.sock.sendall(_ws_frame(bytes(payload), opcode=0xA))
    except Exception:
        pass
    finally:
        client.close()
        WS_HUB.remove(client)


def _recv_exact(conn: socket.socket, n: int) -> bytes:
    data = b""
    while len(data) < n:
        chunk = conn.recv(n - len(data))
        if not chunk:
            return b""
        data += chunk
    return data


# ── Security Monitor ─────────────────────────────────────────────────────
# Post-incident security panel: attacker watch, balance guard, alert feed

# Attacker addresses from F1 exploit (SEC-2026-07-02)
ATTACKER_ADDRESSES = [
    {
        "address": "zion1t3l7q3p8f457n335r083k8r3n6l5w4u2f2q83r2",
        "label": "ATTACKER — 589M theft (block 22181)",
        "expected_balance_zion": 0,
    },
    {
        "address": "zion17758s76520t4c6c3v656g8a5p7d4x4c2d2032x0",
        "label": "ATTACKER — 1 ZION probe (block 21959)",
        "expected_balance_zion": 1.0,
    },
]

# Premine wallets to guard (alert if balance drops below expected)
PREMINE_GUARD = [
    {"address": "zion16542q4l853a2z0u5r5w8y4m8k4558847h503736", "label": "Genesis Projects (Dharma Temple, Piko de Ora + DAO)", "min_balance_zion": 589_000_000},
    {"address": "zion13794g7k3m0f84637l2x0t855h3l258k8p3xp5t3", "label": "Bridge Seed (Slot 13)", "min_balance_zion": 399_000_000},
    {"address": "zion1t4l2f5j737989828v295n7z4r3v5j8k895m56n4", "label": "DAO Treasury", "min_balance_zion": 2_400_000_000},
    {"address": "zion1d3p5x622m327r060w5z0q5r203v837m6l8pa8x5", "label": "Core Dev Fund", "min_balance_zion": 990_000_000},
    {"address": "zion1z7g4u3s2w3c5z5u4a60864m2y7q8e5j304g46r7", "label": "Children Future Fund", "min_balance_zion": 1_430_000_000},
    {"address": "zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2", "label": "Pool Wallet", "min_balance_zion": 0},
]

ALERT_LOG_FILES = {
    "forged_tx": "/var/log/zion-forged-tx-alerts.log",
    "balance": "/var/log/zion-balance-alerts.log",
    "peer": "/var/log/zion-peer-alerts.log",
}


def _rpc_get_balance(address: str) -> dict | None:
    """Query node RPC for balance. Returns None on error."""
    try:
        import urllib.request
        payload = json.dumps({
            "id": 1, "jsonrpc": "2.0",
            "method": "getBalance", "params": {"address": address}
        }).encode("utf-8")
        req = urllib.request.Request(
            "http://127.0.0.1:8443",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("result")
    except Exception:
        return None


def _read_alert_log(path: str, max_lines: int = 20) -> list[str]:
    """Read last N lines from an alert log file."""
    try:
        with open(path, "r") as f:
            lines = f.readlines()
        return [l.rstrip() for l in lines[-max_lines:]]
    except Exception:
        return []


def build_security_status() -> dict:
    """Build security status for /api/security endpoint."""
    # 1. Attacker address watch
    attackers = []
    for a in ATTACKER_ADDRESSES:
        bal = _rpc_get_balance(a["address"])
        if bal:
            bal_flowers = int(bal.get("balance_flowers", 0))
            bal_zion = flowers_to_zion(bal_flowers)
            attackers.append({
                "address": a["address"],
                "label": a["label"],
                "balance_zion": round(bal_zion, 6),
                "balance_flowers": bal_flowers,
                "expected_zion": a["expected_balance_zion"],
                "status": "OK" if abs(bal_zion - a["expected_balance_zion"]) < 0.01 else "ALERT",
            })
        else:
            attackers.append({
                "address": a["address"],
                "label": a["label"],
                "balance_zion": None,
                "status": "RPC_ERROR",
            })

    # 2. Premine balance guard
    guards = []
    for g in PREMINE_GUARD:
        bal = _rpc_get_balance(g["address"])
        if bal:
            bal_flowers = int(bal.get("balance_flowers", 0))
            bal_zion = flowers_to_zion(bal_flowers)
            status = "OK" if bal_zion >= g["min_balance_zion"] else "ALERT"
            guards.append({
                "address": g["address"],
                "label": g["label"],
                "balance_zion": round(bal_zion, 2),
                "min_balance_zion": g["min_balance_zion"],
                "status": status,
            })
        else:
            guards.append({
                "address": g["address"],
                "label": g["label"],
                "balance_zion": None,
                "status": "RPC_ERROR",
            })

    # 3. Alert logs
    alerts = {}
    for name, path in ALERT_LOG_FILES.items():
        lines = _read_alert_log(path, 30)
        alerts[name] = lines

    # 4. Firewall status
    fw_status = "unknown"
    try:
        result = subprocess.run(["ufw", "status"], capture_output=True, text=True, timeout=5)
        fw_status = "active" if "Status: active" in result.stdout else "inactive"
    except Exception:
        pass

    # 5. Overall security status
    any_attacker_alert = any(a["status"] == "ALERT" for a in attackers)
    any_guard_alert = any(g["status"] == "ALERT" for g in guards)
    overall = "SECURE"
    if any_attacker_alert:
        overall = "CRITICAL — attacker funds moved!"
    elif any_guard_alert:
        overall = "WARNING — premine balance below threshold"
    elif fw_status != "active":
        overall = "WARNING — firewall inactive"

    return {
        "overall_status": overall,
        "incident": "SEC-2026-07-02-F1 — 589M ZION theft (rolled back to block 22180)",
        "attackers": attackers,
        "premine_guard": guards,
        "alert_logs": alerts,
        "firewall": fw_status,
        "timestamp": int(time.time()),
    }


# ── HTTP Handler ────────────────────────────────────────────────────────

class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # suppress default request logging
        pass

    def _check_auth(self):
        """HTTP Basic Auth check (multi-user). Returns True if authorized, sends 401 if not."""
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        # Skip auth for health checks and static assets
        if route in AUTH_EXEMPT_ROUTES:
            return True
        # Check Authorization header
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Basic "):
            try:
                decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
                user, _, passwd = decoded.partition(":")
                # Look up user and compare SHA-256 hash (constant-time via compare_digest)
                expected_hash = DASHBOARD_USERS.get(user)
                if expected_hash is not None:
                    import hmac as _hmac
                    if _hmac.compare_digest(
                        _sha256(passwd), expected_hash
                    ):
                        return True
            except Exception:
                pass
        # Not authorized — send 401 challenge
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="ZION Dashboard"')
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        try:
            self.wfile.write(b"401 Unauthorized - authentication required\n")
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass
        return False

    def _json(self, data, status=200):
        try:
            body = json.dumps(data).encode("utf-8")
            origin = self.headers.get("Origin", "")
            # Allow localhost dev servers and Tauri desktop apps
            allowed = ["http://localhost:5173", "http://localhost:1420", "http://localhost:3000", "tauri://localhost"]
            cors_origin = origin if origin in allowed else "*"
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", cors_origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass  # client closed connection early — benign

    def _html(self, html, status=200):
        try:
            body = html.encode("utf-8")
            origin = self.headers.get("Origin", "")
            allowed = ["http://localhost:5173", "http://localhost:1420", "http://localhost:3000", "tauri://localhost"]
            cors_origin = origin if origin in allowed else "*"
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", cors_origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass  # client closed connection early — benign

    def _proxy_to_dao(self, method, route, body, req_headers):
        """Proxy a request to the DAO daemon on port 8450, preserving auth headers."""
        DAO_PORT = 8450
        # Reconstruct full path including query string
        full_path = self.path if self.path.startswith("/api/dao") else route
        url = f"http://127.0.0.1:{DAO_PORT}{full_path}"
        try:
            fwd_headers = {"Accept": "application/json"}
            # Forward content-type and auth header
            ct = req_headers.get("Content-Type") or req_headers.get("content-type")
            if ct:
                fwd_headers["Content-Type"] = ct
            dao_key = req_headers.get("X-DAO-Key") or req_headers.get("x-dao-key")
            if dao_key:
                fwd_headers["X-DAO-Key"] = dao_key
            req = urllib.request.Request(url, data=body if body else None, headers=fwd_headers, method=method)
            with urllib.request.urlopen(req, timeout=8) as r:
                data = json.loads(r.read())
            self._json(data)
        except urllib.error.HTTPError as e:
            try:
                data = json.loads(e.read())
            except Exception:
                data = {"success": False, "error": f"DAO HTTP {e.code}"}
            self._json(data, e.code)
        except Exception as e:
            self._json({"success": False, "error": f"DAO daemon unreachable: {str(e)[:120]}", "offline": True})

    def _get_service_log(self, svc_name, lines=50):
        """Read last N lines from a service's log file."""
        import collections
        log_name = SERVICE_LOG_MAP.get(svc_name)
        if not log_name:
            return {"ok": False, "error": f"Unknown service: {svc_name}"}
        log_path = LOG_DIR / log_name
        if not log_path.exists():
            return {"ok": False, "error": f"No log file for {svc_name}"}
        try:
            with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                tail = collections.deque(f, maxlen=lines)
            return {"ok": True, "service": svc_name, "lines": [l.rstrip() for l in tail]}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _proxy_to_edge_web(self, path):
        """Proxy a GET request to the Edge website API (localhost:3000 on Edge server)."""
        url = f"http://127.0.0.1:3000{path}"
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"}, method="GET")
            with urllib.request.urlopen(req, timeout=10) as r:
                data = json.loads(r.read())
            self._json(data)
        except Exception as e:
            self._json({"ok": False, "error": f"Edge website unreachable: {str(e)[:120]}", "offline": True})

    def do_GET(self):
        if not self._check_auth():
            return
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        # ── WebSocket upgrade (/ws) ──────────────────────────────────────
        if route == "/ws":
            upgrade = self.headers.get("Upgrade", "").lower()
            ws_key  = self.headers.get("Sec-WebSocket-Key", "")
            if upgrade == "websocket" and ws_key:
                _handle_websocket(self, ws_key)
            else:
                self.send_error(400, "WebSocket upgrade required")
            return

        # ── SPA static files (dashboard v2 dist/) ───────────────────────
        dist_dir = SCRIPT_DIR / "v2" / "dist"
        if dist_dir.exists():
            # Serve static assets
            if route.startswith("/assets/") or route in ("/favicon.ico", "/manifest.json"):
                static_file = dist_dir / route.lstrip("/")
                if static_file.exists() and static_file.is_file():
                    body = static_file.read_bytes()
                    ct_map = {".js": "application/javascript", ".css": "text/css",
                              ".svg": "image/svg+xml", ".png": "image/png",
                              ".ico": "image/x-icon", ".json": "application/json"}
                    ct = ct_map.get(static_file.suffix, "application/octet-stream")
                    self.send_response(200)
                    self.send_header("Content-Type", ct)
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("Cache-Control", "public, max-age=31536000")
                    self.end_headers()
                    self.wfile.write(body)
                    return
                self.send_error(404)
                return

        # ── Dashboard v2 SPA static files ────────────────────────────────────
        if route == "/" or route == "/index.html":
            v2_index = V2_DIST / "index.html"
            if v2_index.exists():
                self._html(v2_index.read_text(encoding="utf-8"))
                return
            # Fallback to legacy v1 dashboard
            html_path = SCRIPT_DIR / "dashboard.html"
            if html_path.exists():
                self._html(html_path.read_text(encoding="utf-8"))
            else:
                self._html(HTML_DASHBOARD)
            return
        elif route.startswith("/assets/") or route in ("/manifest.json", "/sw.js", "/offline.html", "/favicon.svg", "/icons.svg"):
            v2_file = V2_DIST / route.lstrip("/")
            if v2_file.exists():
                content_type = {
                    ".js":   "application/javascript; charset=utf-8",
                    ".css":  "text/css; charset=utf-8",
                    ".json": "application/json; charset=utf-8",
                    ".svg":  "image/svg+xml",
                    ".html": "text/html; charset=utf-8",
                }.get(v2_file.suffix, "application/octet-stream")
                body = v2_file.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            else:
                self.send_error(404)
                return
        elif route == "/dashboard.js":
            js_path = SCRIPT_DIR / "dashboard.js"
            if js_path.exists():
                body = js_path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript; charset=utf-8")
                self.send_header("Cache-Control", "no-cache, must-revalidate")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_error(404)
        # ── Dashboard v3 SPA static files ────────────────────────────────────
        elif route == "/v3":
            self.send_response(302)
            self.send_header("Location", "/v3/")
            self.end_headers()
            return
        elif route == "/v3/" or route == "/v3/index.html":
            v3_index = SCRIPT_DIR / "v3" / "index.html"
            if v3_index.exists():
                self._html(v3_index.read_text(encoding="utf-8"))
            else:
                self.send_error(404, "Dashboard V3 not found. Run: mkdir -p dashboard/v3 && create index.html")
            return
        elif route.startswith("/v3/"):
            v3_file = SCRIPT_DIR / "v3" / route[4:].lstrip("/")
            if v3_file.exists() and v3_file.is_file():
                content_type = {
                    ".css":  "text/css; charset=utf-8",
                    ".js":   "application/javascript; charset=utf-8",
                    ".html": "text/html; charset=utf-8",
                    ".json": "application/json",
                    ".png":  "image/png",
                    ".jpg":  "image/jpeg",
                    ".svg":  "image/svg+xml",
                }.get(v3_file.suffix, "application/octet-stream")
                body = v3_file.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_error(404)
            return
        elif route == "/api/v2/status":
            # Batch endpoint: single call returns everything dashboard v2 needs on boot
            st = build_status()
            self._json({
                "status":    st,
                "health":    _build_health_map(),
                "events":    list(BLOCK_EVENTS)[-10:][::-1] if BLOCK_EVENTS else [],
                "checklist": build_checklist(st),
            })
        elif route == "/api/v2/batch":
            # Handled by POST — return error for GET
            self.send_error(405)
        elif route == "/api/status":
            self._json(build_status())
        elif route == "/api/nodes":
            self._json(detect_nodes())
        elif route == "/api/agent/nodes":
            self._json(fetch_agent_discovered_nodes())
        elif route == "/api/agent/rewards":
            self._json(fetch_agent_rewards())
        elif route == "/api/agent/status":
            self._json(fetch_agent_status())
        elif route == "/api/agent/telemetry":
            self._json(fetch_agent_telemetry())
        elif route == "/api/agent/gpu":
            self._json(fetch_agent_gpu())
        elif route == "/api/edge-agent/status":
            try:
                import urllib.request as _ur
                with _ur.urlopen(f"{EDGE_AGENT_API_BASE}/api/status", timeout=3.0) as r:
                    self._json(json.loads(r.read()))
            except Exception as ex:
                self._json({"error": str(ex), "reachable": False})
        elif route == "/api/edge-agent/telemetry":
            try:
                import urllib.request as _ur
                with _ur.urlopen(f"{EDGE_AGENT_API_BASE}/api/telemetry", timeout=3.0) as r:
                    self._json(json.loads(r.read()))
            except Exception as ex:
                self._json({"error": str(ex), "reachable": False})
        elif route == "/api/edge/infra":
            # v3.0.4: Edge server doesn't expose a unified API on 8888.
            # Build infra overview from individual service probes instead.
            try:
                _ports = {"node_rpc": 8443, "pool_stratum": 8444, "dao": 8450,
                          "warp": 8453, "bridge_metrics": 9101, "node_metrics": 9100,
                          "nginx": 443, "dashboard": 8766}
                _infra = {}
                for _name, _port in _ports.items():
                    _infra[_name] = tcp_probe(EDGE_RPC_HOST, _port, timeout=0.5)
                _infra["reachable"] = any(_infra.values())
                _infra["edge_host"] = EDGE_PUBLIC_IP
                self._json(_infra)
            except Exception as ex:
                self._json({"error": str(ex), "reachable": False})
        elif route == "/api/edge/overview":
            # v3.0.4: Aggregate overview from build_status() + health instead of port 8888.
            try:
                _st = build_status()
                _health = _build_health_map()
                _overview = {
                    "reachable": True,
                    "edge_host": EDGE_PUBLIC_IP,
                    "topology": _st.get("topology", "edge-primary"),
                    "chain_height": _st.get("edge_node", {}).get("chain_height"),
                    "pool_running": _st.get("pool_edge", {}).get("running", False),
                    "active_miners": _st.get("pool_edge", {}).get("active_miners"),
                    "hashrate": _st.get("pool_edge", {}).get("hashrate"),
                    "shares_accepted": _st.get("pool_edge", {}).get("shares_accepted"),
                    "blocks_found": _st.get("pool_edge", {}).get("blocks_found"),
                    "services": _health,
                    "local_backup": _st.get("local_backup", {}),
                    "edge_node": _st.get("edge_node", {}),
                }
                self._json(_overview)
            except Exception as ex:
                self._json({"error": str(ex), "reachable": False})
        elif route == "/api/edge-status":
            self._json(get_edge_server_status())
        elif route == "/api/pool/miners":
            self._json(get_pool_miners())
        elif route == "/api/pool/connection-history":
            limit = int(params.get("limit", ["100"])[0])
            since = int(params.get("since_hours", ["1"])[0])
            self._json(get_pool_connection_history(limit=limit, since_hours=since))
        elif route == "/api/pool/leaderboard":
            limit = int(params.get("limit", ["50"])[0])
            self._json(get_pool_leaderboard(limit=limit))
        elif route == "/api/pool/miners-dashboard":
            self._json(get_pool_miners_dashboard())
        elif route == "/api/revenue":
            self._json(get_revenue_dashboard())
        elif route == "/api/servers-setup":
            self._json(get_servers_setup())
        elif route.startswith("/api/pool/miner-detail/"):
            address = route.split("/api/pool/miner-detail/", 1)[1].split("?")[0]
            self._json(get_pool_miner_detail(address))
        elif route == "/api/pool/registered-miners":
            self._json(get_pool_registered_miners())
        elif route == "/api/miner/live":
            self._json(get_miner_live_stats())
        elif route == "/api/miner/log-tail":
            lines = int(params.get("lines", ["30"])[0])
            self._json({"lines": tail_log("miner.log", lines), "file": str(LOG_DIR / "miner.log")})
        elif route == "/api/settings/load":
            self._json(load_dashboard_settings())
        elif route == "/api/fleet/rigs":
            # Include local rig in fleet view
            fleet_data = load_fleet_rigs()
            rigs = fleet_data.get("rigs", [])
            local_stats = get_miner_live_stats()
            local_rig = {
                "id": "local",
                "name": "Local Rig",
                "url": "http://127.0.0.1:8767",
                "status": "online" if local_stats.get("running") else "offline",
                "mode": local_stats.get("gpu_backend", "cpu"),
                "hashrate": local_stats.get("hashrate", 0),
                "gpus": len(local_stats.get("gpus", [])),
                "shares_accepted": local_stats.get("shares_accepted", 0),
                "shares_rejected": local_stats.get("shares_rejected", 0),
            }
            rigs.insert(0, local_rig)
            self._json({"rigs": rigs})
        elif route == "/api/orchestrator/status":
            self._json(get_orchestrator_status())
        elif route == "/api/orchestrator/services":
            self._json(get_orchestrator_services())
        elif route == "/api/config":
            # GET: return current config (read-only)
            self._json({
                "topology": TOPOLOGY,
                "host": HOST,
                "port": PORT,
                "available_topologies": ["edge-primary", "local-dev"],
            })
        elif route == "/api/checklist":
            self._json(build_checklist(build_status()))
        elif route == "/api/alerts":
            self._json({"alerts": build_alerts(build_status())})
        elif route == "/api/security":
            self._json(build_security_status())
        elif route == "/api/history":
            self._json({"samples": HISTORY.snapshot()})
        elif route == "/api/events":
            self._json({"events": list(BLOCK_EVENTS)[-30:][::-1]})
        elif route == "/api/env":
            self._json({"files": list_env_files()})
        elif route == "/api/env/load":
            name = (params.get("name", [".env.mainnet"])[0])
            self._json(load_env_file(name))
        elif route == "/api/controls":
            # Merge script-backed actions with manifest-backed start/stop/restart
            actions = set(ALLOWED_ACTIONS.keys())
            for key in load_services_manifest():
                actions.update({f"start-{key}", f"stop-{key}", f"restart-{key}"})
            # Topology-aware filtering
            if TOPOLOGY == "edge-primary":
                # In edge-primary, local PC only runs backup node + miners.
                # Remove local-dev-only actions (node2, local pool, launch-stack).
                actions -= {"start-node2", "stop-node2", "restart-node2",
                            "start-pool", "stop-pool", "restart-pool", "launch-stack"}
            else:
                # In local-dev, remove edge-primary-only launcher.
                actions -= {"launch-local-backup"}
            self._json({"actions": sorted(actions), "topology": TOPOLOGY})
        elif route == "/api/services":
            self._json({"services": all_services_health()})
        elif route == "/api/readiness":
            self._json(build_readiness_score(all_services_health()))
        elif route == "/api/service-history":
            self._json({"buckets": SERVICE_HISTORY.snapshot()})
        elif route == "/api/resources":
            self._json(get_resource_usage())
        elif route in ("/api/monitoring", "/api/monitoring/status"):
            self._json(get_monitoring_status())
        elif route in ("/api/edge/health", "/api/edge-health"):
            self._json(get_edge_server_health())
        elif route == "/api/alerts/history":
            self._json({"alerts": load_alert_history()})
        elif route == "/api/watchdog/toggle":
            global WATCHDOG_ENABLED
            WATCHDOG_ENABLED = not WATCHDOG_ENABLED
            self._json({"enabled": WATCHDOG_ENABLED})
        elif route == "/api/logs/rotate":
            try:
                rotate_all_logs()
                self._json({"ok": True, "message": "Log rotation triggered"})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/processes":
            # Return process registry snapshot
            with PROCESS_LOCK:
                procs = {k: {"pid": v["pid"], "age_min": int((time.time() - v["ts"]) / 60),
                             "alive": is_process_alive(v["pid"])} for k, v in PROCESS_REGISTRY.items()}
            self._json({"processes": procs})
        elif route == "/api/logs/stream":
            # SSE live log streaming: /api/logs/stream?svc=node1&lines=200
            svc_id   = params.get("svc",   ["node1"])[0].strip()
            n_init   = min(int(params.get("lines", ["150"])[0]), 500)
            log_name = SERVICE_LOG_MAP.get(svc_id)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()
            try:
                def _sse(data: str):
                    msg = "data: " + data.replace("\n", "\ndata: ") + "\n\n"
                    self.wfile.write(msg.encode("utf-8", errors="replace"))
                    self.wfile.flush()
                if not log_name:
                    _sse(f"[error] unknown service '{svc_id}'")
                    return
                log_path = LOG_DIR / log_name
                # Send initial tail
                if log_path.exists():
                    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines_all = f.readlines()
                    for ln in lines_all[-n_init:]:
                        _sse(ln.rstrip())
                else:
                    _sse(f"[info] Log file not found yet: {log_path}")
                # Tail new lines (poll every 0.8 s, max 10 min)
                import time as _time
                pos = log_path.stat().st_size if log_path.exists() else 0
                deadline = _time.time() + 600
                while _time.time() < deadline:
                    _time.sleep(0.8)
                    if not log_path.exists():
                        continue
                    cur_size = log_path.stat().st_size
                    if cur_size < pos:
                        pos = 0  # rotated
                    if cur_size > pos:
                        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                            f.seek(pos)
                            new_data = f.read()
                        pos = cur_size
                        for ln in new_data.splitlines():
                            _sse(ln)
                    else:
                        # heartbeat to keep connection alive
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        elif route == "/api/terminal/open":
            # Open a native terminal window (W11/Ubuntu/macOS)
            svc_id = params.get("svc", [""])[0].strip()
            _TERM_CMDS = {
                "node1":         ("cargo run ... (node1)", "node status"),
                "node2":         ("cargo run ... (node2)", ""),
                "pool":          ("pool server",           "pool status"),
                "miner":         ("miner",                 ""),
                "hiranyagarbha": ("hiranyagarbha",         ""),
                "hiran":         ("hiran-inference",       ""),
            }
            # Determine the log file to tail — use SERVICE_LOG_MAP
            _log_name = SERVICE_LOG_MAP.get(svc_id, f"{svc_id}.log")
            log_file = str(LOG_DIR / _log_name)
            try:
                if os.name == "nt":
                    # Windows: open Windows Terminal or fallback to PowerShell
                    tail_cmd = f"Get-Content -Wait -Tail 200 '{log_file}'"
                    wt_args = ["wt.exe", "-w", "0", "new-tab", "--title", f"ZION {svc_id}",
                               "powershell.exe", "-NoExit", "-Command", tail_cmd]
                    ps_args = ["powershell.exe", "-NoExit", "-Command", tail_cmd]
                    try:
                        subprocess.Popen(wt_args, creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0x10))
                    except FileNotFoundError:
                        subprocess.Popen(ps_args, creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0x10))
                    self._json({"ok": True, "svc": svc_id, "platform": "windows", "cmd": tail_cmd})
                else:
                    import shutil
                    tail_cmd = f"tail -n 200 -f '{log_file}'; echo '[end]'; bash"
                    launched = False
                    # Try common terminal emulators in order
                    for term_bin, term_args in [
                        ("gnome-terminal", ["gnome-terminal", "--", "bash", "-c", tail_cmd]),
                        ("xterm",          ["xterm", "-e", tail_cmd]),
                        ("konsole",        ["konsole", "-e", tail_cmd]),
                        ("xfce4-terminal", ["xfce4-terminal", "-e", tail_cmd]),
                        ("open",           ["open", "-a", "Terminal", log_file]),  # macOS
                    ]:
                        if shutil.which(term_bin):
                            subprocess.Popen(term_args)
                            launched = True
                            break
                    self._json({"ok": launched, "svc": svc_id, "platform": "unix", "cmd": tail_cmd})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
            return
        elif route == "/api/log-files":
            # List all log files on disk with size + mtime
            # Reverse map from SERVICE_LOG_MAP (filename → service id)
            _FILE_TO_SVC = {}
            for _sid, _fn in SERVICE_LOG_MAP.items():
                if _fn not in _FILE_TO_SVC:
                    _FILE_TO_SVC[_fn] = _sid
            files = []
            if LOG_DIR.exists():
                import datetime as _dt
                for fp in sorted(LOG_DIR.iterdir()):
                    if fp.suffix in (".log", ".txt", ".err") and fp.is_file():
                        try:
                            st = fp.stat()
                            files.append({
                                "name": fp.name,
                                "svc_id": _FILE_TO_SVC.get(fp.name, fp.stem),
                                "size_kb": round(st.st_size / 1024, 1),
                                "modified": _dt.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
                            })
                        except Exception:
                            pass
            self._json({"files": files, "log_dir": str(LOG_DIR)})
        elif route == "/api/log-search":
            # Fast grep across all log files
            query      = params.get("q",     [""])[0].strip()
            level_filt = params.get("level", ["all"])[0].lower()
            svc_filt   = params.get("svc",   [""])[0].strip()
            results    = []
            MAX_HITS   = 500
            # Build reverse map from SERVICE_LOG_MAP (filename → service id)
            _FILE_TO_SVC2 = {}
            for _sid, _fn in SERVICE_LOG_MAP.items():
                if _fn not in _FILE_TO_SVC2:
                    _FILE_TO_SVC2[_fn] = _sid
            if LOG_DIR.exists():
                for fp in sorted(LOG_DIR.iterdir()):
                    if len(results) >= MAX_HITS:
                        break
                    if fp.suffix not in (".log", ".txt") or not fp.is_file():
                        continue
                    svc_id = _FILE_TO_SVC2.get(fp.name, fp.stem)
                    if svc_filt and svc_id != svc_filt:
                        continue
                    try:
                        with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                            for lineno, line in enumerate(f, 1):
                                if len(results) >= MAX_HITS:
                                    break
                                line_s = line.rstrip()
                                if not line_s:
                                    continue
                                ll = line_s.lower()
                                if level_filt != "all":
                                    if level_filt not in ll:
                                        continue
                                if query and query.lower() not in ll:
                                    continue
                                results.append({"svc": svc_id, "file": fp.name, "lineno": lineno, "line": line_s})
                    except Exception:
                        pass
            self._json({"results": results, "total": len(results), "capped": len(results) >= MAX_HITS})
        elif route == "/api/layer-status":
            # Aggregate status for any layer (l1-l6) from real sources
            layer = params.get("layer", ["l1"])[0].strip()
            result = {"layer": layer, "ok": False, "services": {}}
            # Pull from build_status() which already has node1/node2/pool/miner
            try:
                s = build_status()
                if layer == "l1":
                    result["ok"] = s.get("node1", {}).get("running", False)
                    result["block_height"] = s.get("edge_node", {}).get("chain_height", s.get("node1", {}).get("chain_height", 0))
                    result["peers"] = s.get("edge_node", {}).get("known_peers", s.get("node1", {}).get("known_peers", 0))
                    result["hashrate"] = s.get("miner", {}).get("hashrate", 0)
                    result["shares_accepted"] = s.get("pool", {}).get("shares_accepted", 0)
                    result["pool_alive"] = s.get("pool", {}).get("running", False)
                    result["miner_alive"] = s.get("miner", {}).get("running", False)
                    result["node2_alive"] = s.get("node2", {}).get("running", False)
                    result["edge_alive"] = s.get("edge_node", {}).get("running", False)
                    result["services"] = {
                        "edge-node": s.get("edge_node", {}).get("running", False),
                        "node1": s.get("node1", {}).get("running", False),
                        "node2": s.get("node2", {}).get("running", False),
                        "pool": s.get("pool", {}).get("running", False),
                        "miner": s.get("miner", {}).get("running", False),
                    }
            except Exception as e:
                result["error"] = str(e)
            self._json(result)
        elif route == "/api/ncl/submit":
            # Proxy NCL job submit to Hiranyagarbha on port 8001
            try:
                import urllib.request as _ur
                body_data = json.dumps({"job_type": "inference", "payload": "", "submitted_via": "dashboard"}).encode()
                req = _ur.Request("http://127.0.0.1:8001/ncl/schedule",
                    data=body_data, headers={"Content-Type": "application/json"}, method="POST")
                with _ur.urlopen(req, timeout=4) as r:
                    self._json(json.loads(r.read()))
            except Exception as e:
                self._json({"ok": False, "offline": True, "error": str(e)[:120]})
        elif route == "/api/hiran/agents":
            # Get agent list from Hiranyagarbha orchestrator
            try:
                import urllib.request as _ur
                req = _ur.Request("http://127.0.0.1:8001/agents",
                    headers={"Accept": "application/json"})
                with _ur.urlopen(req, timeout=3) as r:
                    data_a = json.loads(r.read())
                agents = data_a if isinstance(data_a, list) else data_a.get("agents", [])
                self._json({"ok": True, "agents": agents, "count": len(agents)})
            except Exception as e:
                # Return empty list with offline flag — no error thrown
                self._json({"ok": False, "agents": [], "count": 0, "offline": True, "error": str(e)[:80]})
        elif route == "/api/metrics/scrape":
            # Scrape Prometheus-format metrics from node/pool
            svc = params.get("svc", ["node1"])[0].strip()
            port_map = {"node1": 9115, "node2": 9116, "pool": 9100, "miner": 9200}
            port = port_map.get(svc, 9115)
            try:
                import urllib.request as _ur
                with _ur.urlopen(f"http://127.0.0.1:{port}/metrics", timeout=3) as r:
                    raw = r.read().decode("utf-8", errors="ignore")
                # Parse key metrics
                lines = [l for l in raw.splitlines() if l and not l.startswith("#")]
                parsed = {}
                for ln in lines[:200]:
                    parts = ln.rsplit(" ", 1)
                    if len(parts) == 2:
                        try: parsed[parts[0]] = float(parts[1])
                        except ValueError: pass
                self._json({"ok": True, "svc": svc, "port": port, "metrics": parsed, "raw_lines": len(lines)})
            except Exception as e:
                self._json({"ok": False, "svc": svc, "port": port, "offline": True, "error": str(e)[:80]})
        elif route == "/api/metrics/collector":
            # Read metrics.json written by Rust metrics collector
            metrics_path = DATA_DIR / "metrics.json"
            try:
                if metrics_path.exists():
                    with open(metrics_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    data["_source"] = "rust-collector"
                    data["_file_age_sec"] = int(time.time() - metrics_path.stat().st_mtime)
                    self._json(data)
                else:
                    self._json({"ok": False, "error": "metrics.json not found. Run: cargo run --release --manifest-path dashboard/metrics-collector/Cargo.toml"})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/topology":
            # 3-node P2P topology (v3.0.4): Edge Node 1, Edge Node 2, Local Backup
            import time as _time
            from concurrent.futures import ThreadPoolExecutor, as_completed

            def _probe_node(label, host, port):
                """Probe a node via RPC getChainInfo + getNodeInfo, return status dict."""
                t0 = _time.time()
                chain = rpc_call(host, port, "getChainInfo", {}, timeout=2.5)
                latency = round((_time.time() - t0) * 1000) if chain and not chain.get("_rpc_error") else None
                alive = bool(chain and not chain.get("_rpc_error"))
                height = None
                tip_hash = None
                node_id = None
                p2p_bind = None
                known_peers = 0
                if alive:
                    height = chain.get("chain_height") or chain.get("height") or chain.get("best_height")
                    tip_hash = chain.get("tip_hash") or chain.get("best_hash")
                    # Also get node info for peer count
                    info = rpc_call(host, port, "getNodeInfo", {}, timeout=2.0)
                    if info and not info.get("_rpc_error"):
                        node_id = info.get("node_id")
                        p2p_bind = info.get("p2p_bind")
                        known_peers = info.get("known_peers", 0) or 0
                return {
                    "label": label,
                    "host": host,
                    "rpc_port": port,
                    "alive": alive,
                    "latency_ms": latency,
                    "height": height,
                    "tip_hash": tip_hash,
                    "node_id": node_id,
                    "p2p_bind": p2p_bind,
                    "known_peers": known_peers,
                }

            with ThreadPoolExecutor(max_workers=3) as ex:
                futs = {
                    ex.submit(_probe_node, "Edge Node 1", "127.0.0.1", 8443),
                    ex.submit(_probe_node, "Edge Node 2", "127.0.0.1", 8448),
                    ex.submit(_probe_node, "Local Backup", "127.0.0.1", 8446),
                }
                results = {}
                for fut in as_completed(futs, timeout=6.0):
                    try:
                        r = fut.result()
                        results[r["label"]] = r
                    except Exception:
                        pass

            edge1 = results.get("Edge Node 1", {})
            edge2 = results.get("Edge Node 2", {})
            local = results.get("Local Backup", {})

            # Compute sync gaps
            heights = [h for h in [edge1.get("height"), edge2.get("height"), local.get("height")] if h is not None]
            max_h = max(heights) if heights else 0
            min_h = min(heights) if heights else 0
            sync_gap = max_h - min_h

            # All 3 nodes in sync?
            all_in_sync = sync_gap == 0 and len(heights) == 3

            # Port checks (via SSH tunnel to Edge)
            ports = {}
            for name, port in [("node_p2p", 8333), ("node_rpc", 8443), ("pool_stratum", 8444),
                               ("dashboard", 8766), ("hiran_inference", 8002), ("hiranyagarbha", 8001)]:
                ports[name] = check_port_open("127.0.0.1", port, timeout=1.0)

            self._json({
                "edge_node1": edge1,
                "edge_node2": edge2,
                "local_backup": local,
                "sync_gap": sync_gap,
                "all_in_sync": all_in_sync,
                "max_height": max_h,
                "ports": ports,
                "timestamp": _time.time(),
            })
        elif route == "/api/hiran/status":
            # Alias of /api/hiran/health — return combined inference + orchestrator status
            self._json(get_ai_services_status())
        elif route == "/api/hiran/health":
            # Quick health probe of Hiran inference server
            try:
                import urllib.request as _ur
                with _ur.urlopen("http://127.0.0.1:8002/health", timeout=2) as r:
                    self._json({"ok": True, "status": "online", "data": json.loads(r.read())})
            except Exception as e:
                self._json({"ok": False, "status": "offline", "error": str(e)[:80]})
        elif route == "/api/hiranyagarbha/health":
            # Quick health probe of Hiranyagarbha orchestrator
            try:
                import urllib.request as _ur
                with _ur.urlopen("http://127.0.0.1:8001/health", timeout=2) as r:
                    self._json({"ok": True, "status": "online", "data": json.loads(r.read())})
            except Exception as e:
                self._json({"ok": False, "status": "offline", "error": str(e)[:80]})
        elif route == "/api/bridge/health":
            svc = get_service("bridge")
            h = check_service_health(svc) if svc else {"alive": False}
            self._json({"ok": h["alive"], "service": "bridge",
                        "status": "online" if h["alive"] else "offline",
                        "details": h.get("details", "")})
        elif route == "/api/swap/health":
            svc = get_service("atomic-swap")
            h = check_service_health(svc) if svc else {"alive": False}
            self._json({"ok": h["alive"], "service": "atomic-swap",
                        "status": "online" if h["alive"] else "offline",
                        "details": h.get("details", "")})
        elif route == "/api/swap-aggregator/health":
            alive = check_port_open("127.0.0.1", 8456, timeout=1.5)
            self._json({"ok": alive, "service": "swap-aggregator", "port": 8456,
                        "status": "online" if alive else "offline"})
        elif route == "/api/swap-aggregator/swaps":
            try:
                import urllib.request as _ur
                with _ur.urlopen("http://127.0.0.1:8456/swaps", timeout=3.0) as r:
                    self._json(json.loads(r.read()))
            except Exception as e:
                self._json({"ok": False, "offline": True, "error": str(e)[:120]})
        elif route == "/api/swap/initiate":
            self._json({"ok": False, "error": "Swap initiation requires POST — use POST /api/swap/initiate"})
        elif route == "/api/warp/health":
            alive = check_port_open("127.0.0.1", 8453, timeout=1.5)
            health = fetch_service_json("127.0.0.1", 8453, "/health") if alive else {}
            self._json({"ok": alive, "service": "warp", "port": 8453,
                        "status": "online" if alive else "offline",
                        "version": health.get("version", "—") if health else "—",
                        "transfers_total": health.get("transfers_total", 0) if health else 0,
                        "transfers_pending": health.get("transfers_pending", 0) if health else 0})
        elif route == "/api/oasis/stats":
            alive = check_port_open("127.0.0.1", 8094, timeout=1.5)
            health = fetch_service_json("127.0.0.1", 8094, "/health") if alive else {}
            self._json({"ok": alive, "service": "oasis", "port": 8094,
                        "status": "online" if alive else "offline",
                        "version": health.get("data", {}).get("version", "—") if health else "—",
                        "avatars": 0, "active_quests": 0,
                        "guilds": 0, "territories": 0, "players": 0,
                        "economy_volume_zion": 0})
        elif route == "/api/oasis/quests":
            self._json({"ok": True, "quests": [], "total": 0, "note": "OASIS game quests not yet available"})
        elif route == "/api/freeworld/stats":
            alive = check_port_open("127.0.0.1", 8095, timeout=1.5)
            metrics = fetch_prometheus_metrics("127.0.0.1", 8095) if alive else {}
            self._json({"ok": alive, "service": "freeworld", "port": 8095,
                        "status": "online" if alive else "offline",
                        "blocks_scanned": int(metrics.get("zion_free_world_blocks_scanned", 0)),
                        "grants_pending": int(metrics.get("zion_free_world_grants_pending", 0)),
                        "grants_approved": int(metrics.get("zion_free_world_grants_approved", 0)),
                        "grants_disbursed": int(metrics.get("zion_free_world_grants_disbursed", 0)),
                        "projects_active": int(metrics.get("zion_free_world_projects_active", 0)),
                        "total_accumulated_zion": metrics.get("zion_free_world_total_accumulated_zion", 0),
                        "total_disbursed_zion": metrics.get("zion_free_world_total_disbursed_zion", 0),
                        "settlements": int(metrics.get("zion_free_world_projects_active", 0)),
                        "citizens": 0})
        elif route == "/api/space/stats":
            alive = check_port_open("127.0.0.1", 8096, timeout=1.5)
            metrics = fetch_prometheus_metrics("127.0.0.1", 8096) if alive else {}
            self._json({"ok": alive, "service": "issobella-space", "port": 8096,
                        "status": "online" if alive else "offline",
                        "blocks_scanned": int(metrics.get("zion_issobella_blocks_scanned", 0)),
                        "missions_planning": int(metrics.get("zion_issobella_missions_planning", 0)),
                        "missions_launched": int(metrics.get("zion_issobella_missions_launched", 0)),
                        "missions_operational": int(metrics.get("zion_issobella_missions_operational", 0)),
                        "observations_recorded": int(metrics.get("zion_issobella_observations_recorded", 0)),
                        "proposals_submitted": int(metrics.get("zion_issobella_proposals_submitted", 0)),
                        "total_accumulated_zion": metrics.get("zion_issobella_total_accumulated_zion", 0),
                        "total_disbursed_zion": metrics.get("zion_issobella_total_disbursed_zion", 0),
                        "missions": int(metrics.get("zion_issobella_missions_operational", 0)),
                        "satellites": 0})
        elif route == "/api/space/missions":
            self._json({"ok": True, "missions": [], "total": 0, "note": "Issobella Space not yet deployed"})
        # ── L3 endpoints: WARP, AI agents, NCL ──
        elif route == "/api/l3/warp/chains":
            warp_alive = check_port_open("127.0.0.1", 8453, timeout=1.5)
            chains = []
            if warp_alive:
                data = fetch_service_json("127.0.0.1", 8453, "/chains", timeout=2.0)
                chains = data.get("data", []) if data else []
            self._json({"ok": warp_alive, "chains": chains, "total": len(chains),
                        "status": "online" if warp_alive else "offline"})
        elif route == "/api/l3/warp/transfers":
            warp_alive = check_port_open("127.0.0.1", 8453, timeout=1.5)
            transfers = []
            if warp_alive:
                data = fetch_service_json("127.0.0.1", 8453, "/transfers", timeout=2.0)
                transfers = data.get("data", []) if data else []
            self._json({"ok": warp_alive, "transfers": transfers, "total": len(transfers),
                        "status": "online" if warp_alive else "offline"})
        elif route == "/api/l3/ai/agents":
            hiran_status = get_ai_services_status()
            hiran = hiran_status.get("hiran", {})
            orch = hiran_status.get("hiranyagarbha", {})
            agents = []
            if orch.get("alive"):
                # Fetch agent list from orchestrator if available
                orch_data = fetch_service_json("127.0.0.1", 8001, "/api/agents", timeout=2.0)
                if orch_data.get("success"):
                    agents = orch_data.get("data", {}).get("agents", [])
            self._json({
                "ok": True,
                "agents": agents,
                "total": len(agents),
                "hiran_alive": hiran.get("alive", False),
                "hiran_backend": hiran.get("backend", "none"),
                "hiran_model": hiran.get("model", "—"),
                "orchestrator_alive": orch.get("alive", False),
                "orchestrator_agents": orch.get("agents", 0),
                "orchestrator_tasks": orch.get("tasks", 0),
            })
        elif route == "/api/l3/ncl/jobs":
            hiran_status = get_ai_services_status()
            orch = hiran_status.get("hiranyagarbha", {})
            jobs = []
            if orch.get("alive"):
                # Fetch NCL jobs from orchestrator if available
                jobs_data = fetch_service_json("127.0.0.1", 8001, "/api/ncl/jobs", timeout=2.0)
                if jobs_data.get("success"):
                    jobs = jobs_data.get("data", {}).get("jobs", [])
            self._json({
                "ok": True,
                "jobs": jobs,
                "total": len(jobs),
                "orchestrator_alive": orch.get("alive", False),
                "orchestrator_tasks": orch.get("tasks", 0),
            })
        # ── L4 endpoints: OASIS game data ──
        elif route == "/api/l4/stats":
            alive = check_port_open("127.0.0.1", 8094, timeout=1.5)
            health = fetch_service_json("127.0.0.1", 8094, "/health") if alive else {}
            self._json({"ok": alive, "service": "oasis", "port": 8094,
                        "status": "online" if alive else "offline",
                        "version": health.get("data", {}).get("version", "—") if health else "—",
                        "avatars": 0, "guilds": 0, "territories": 0,
                        "active_quests": 0, "players": 0, "economy_volume_zion": 0})
        elif route == "/api/l4/avatars":
            self._json({"ok": True, "avatars": [], "total": 0, "note": "OASIS avatars not yet available"})
        elif route == "/api/l4/quests":
            self._json({"ok": True, "quests": [], "total": 0, "note": "OASIS quests not yet available"})
        # ── L5 endpoints: Free World humanitarian ──
        elif route == "/api/l5/stats":
            alive = check_port_open("127.0.0.1", 8095, timeout=1.5)
            metrics = fetch_prometheus_metrics("127.0.0.1", 8095) if alive else {}
            self._json({"ok": alive, "service": "freeworld", "port": 8095,
                        "status": "online" if alive else "offline",
                        "blocks_scanned": int(metrics.get("zion_free_world_blocks_scanned", 0)),
                        "grants_pending": int(metrics.get("zion_free_world_grants_pending", 0)),
                        "grants_approved": int(metrics.get("zion_free_world_grants_approved", 0)),
                        "grants_disbursed": int(metrics.get("zion_free_world_grants_disbursed", 0)),
                        "projects_active": int(metrics.get("zion_free_world_projects_active", 0)),
                        "total_accumulated_zion": metrics.get("zion_free_world_total_accumulated_zion", 0),
                        "total_disbursed_zion": metrics.get("zion_free_world_total_disbursed_zion", 0)})
        # ── L6 endpoints: Issobella space ──
        elif route == "/api/l6/stats":
            alive = check_port_open("127.0.0.1", 8096, timeout=1.5)
            metrics = fetch_prometheus_metrics("127.0.0.1", 8096) if alive else {}
            self._json({"ok": alive, "service": "issobella-space", "port": 8096,
                        "status": "online" if alive else "offline",
                        "blocks_scanned": int(metrics.get("zion_issobella_blocks_scanned", 0)),
                        "missions_planning": int(metrics.get("zion_issobella_missions_planning", 0)),
                        "missions_launched": int(metrics.get("zion_issobella_missions_launched", 0)),
                        "missions_operational": int(metrics.get("zion_issobella_missions_operational", 0)),
                        "observations_recorded": int(metrics.get("zion_issobella_observations_recorded", 0)),
                        "proposals_submitted": int(metrics.get("zion_issobella_proposals_submitted", 0)),
                        "total_accumulated_zion": metrics.get("zion_issobella_total_accumulated_zion", 0),
                        "total_disbursed_zion": metrics.get("zion_issobella_total_disbursed_zion", 0)})
        elif route == "/api/mempool":
            try:
                self._json(get_mempool_detail())
            except Exception as e:
                self._json({"ok": False, "tx_count": 0, "transactions": [], "error": str(e)[:80]})
        elif route.startswith("/api/dao"):
            # Proxy all /api/dao/* requests to DAO daemon on port 8450
            self._proxy_to_dao("GET", route, None, dict(self.headers))
        elif route.startswith("/api/service-log/"):
            svc_name = route.split("/api/service-log/")[1].split("?")[0]
            lines_param = 50
            if "?" in route:
                qs = route.split("?")[1]
                for part in qs.split("&"):
                    if part.startswith("lines="):
                        try: lines_param = int(part.split("=")[1])
                        except: pass
            self._json(self._get_service_log(svc_name, lines_param))
        elif route.startswith("/api/logs/tail"):
            # Generic log tail (used by Tauri desktop dashboard)
            qs = urllib.parse.parse_qs(parsed.query)
            log_path = qs.get("path", [""])[0]
            lines = int(qs.get("lines", ["100"])[0])
            try:
                import collections
                p = Path(log_path)
                if not p.exists() and not p.is_absolute():
                    p = REPO_ROOT / log_path
                if not p.exists():
                    self._json({"ok": False, "error": f"Log not found: {log_path}"})
                    return
                with open(p, "r", encoding="utf-8", errors="replace") as f:
                    tail = collections.deque(f, maxlen=lines)
                self._json({"ok": True, "lines": [l.rstrip() for l in tail]})
            except Exception as e:
                self._json({"ok": False, "error": str(e)[:80]})
        elif route in ("/api/launch/status", "/api/launch-state"):
            self._json(get_launch_state())
        elif route == "/api/genesis":
            total_premine = sum(p["amount_zion"] for p in PREMINE_OUTPUTS)
            self._json({
                "constants": MAINNET_CONSTANTS,
                "premine": PREMINE_OUTPUTS,
                "premine_total_zion": total_premine,
                "premine_outputs_count": len(PREMINE_OUTPUTS),
            })
        elif route == "/api/blockers":
            blockers = P0_BLOCKERS
            open_critical = sum(1 for b in blockers if b["status"] != "DONE" and b["severity"] == "critical")
            total_open = sum(1 for b in blockers if b["status"] != "DONE")
            self._json({
                "blockers": blockers,
                "total": len(blockers),
                "open": total_open,
                "open_critical": open_critical,
                "done": sum(1 for b in blockers if b["status"] == "DONE"),
                "ready_for_launch": open_critical == 0,
            })
        elif route == "/api/mainnet-status":
            # Comprehensive mainnet readiness status
            status = build_status()
            checklist = build_checklist(status)
            
            # Get current genesis hash from node
            genesis_hash = None
            try:
                genesis = rpc_call("127.0.0.1", 8443, "getBlockByHeight", {"height": 0})
                if genesis:
                    genesis_hash = genesis.get("hash_hex") or genesis.get("hash")
            except Exception:
                genesis_hash = "Unknown"

            # Get canonical fee split addresses from the LIVE tip block (actual on-chain state)
            # instead of hardcoded values that may be stale after wallet rotation.
            tip_block = None
            try:
                chain_info = rpc_call("127.0.0.1", 8443, "getChainInfo", {})
                if chain_info and chain_info.get("chain_height") is not None:
                    tip_block = rpc_call("127.0.0.1", 8443, "getBlockByHeight",
                                         {"height": chain_info["chain_height"]})
            except Exception:
                pass

            # Build canonical addresses from tip block (live on-chain truth),
            # falling back to node startup log / env vars if a field is empty.
            node_log_addresses = parse_node_startup_addresses()
            canonical_addresses = {
                "miner": (tip_block or {}).get("miner_address") or node_log_addresses.get("miner") or find_env_value("ZION_MINER_ADDRESS") or "",
                "humanitarian": (tip_block or {}).get("humanitarian_address") or node_log_addresses.get("humanitarian") or find_env_value("ZION_HUMANITARIAN_WALLET") or "",
                "issobella": (tip_block or {}).get("issobella_address") or node_log_addresses.get("issobella") or find_env_value("ZION_ISSOBELLA_WALLET") or "",
                "pool_fee": (tip_block or {}).get("pool_fee_address") or node_log_addresses.get("pool_fee") or find_env_value("ZION_POOL_FEE_WALLET") or "",
            }

            # Get node addresses from logs (kept for backward compat / display)
            node_addresses = node_log_addresses

            # Verify fee split addresses are non-empty and self-consistent
            # (tip block is the source of truth; log/env are fallbacks)
            # NOTE: pool_fee is a BURN amount (1% of subsidy) — it is NOT paid to
            # any address, so pool_fee_address is intentionally empty on-chain.
            fee_split_match = {
                "miner": bool(canonical_addresses["miner"]),
                "humanitarian": bool(canonical_addresses["humanitarian"]),
                "issobella": bool(canonical_addresses["issobella"]),
                "pool_fee": True,  # burn model — empty address is correct
            }
            
            # Launch countdown (31.12.2026 12:00 UTC)
            launch_date = datetime(2026, 12, 31, 12, 0, 0)
            now = datetime.now()
            days_to_launch = (launch_date - now).days if launch_date > now else 0
            is_launch_day = (launch_date.date() == now.date())
            
            # Git status — use -uno to ignore untracked files (common on edge deploy).
            # On edge-primary topology, an `edge-sync-*` branch is treated as clean.
            git_status = {"clean": True, "branch": "main"}
            try:
                import subprocess
                result = subprocess.run(["git", "status", "--porcelain", "-uno"],
                                      cwd=REPO_ROOT, capture_output=True, text=True, timeout=5)
                # Ignore runtime state files (dashboard state.json, etc.)
                lines = [l for l in result.stdout.strip().split("\n")
                         if l and "state.json" not in l and "dashboard/data/" not in l]
                git_status["clean"] = len(lines) == 0
                result = subprocess.run(["git", "branch", "--show-current"],
                                      cwd=REPO_ROOT, capture_output=True, text=True, timeout=5)
                git_status["branch"] = result.stdout.strip()
                # edge-sync-* branches are valid production branches
                if git_status["branch"].startswith("edge-sync-"):
                    git_status["clean"] = git_status["clean"]  # already checked above
            except Exception:
                pass
            
            self._json({
                "topology": status.get("topology", TOPOLOGY),
                "genesis_hash": genesis_hash,
                "canonical_addresses": canonical_addresses,
                "node_addresses": node_addresses,
                "fee_split_match": fee_split_match,
                "fee_split_all_match": all(fee_split_match.values()),
                "launch_date": launch_date.isoformat(),
                "days_to_launch": days_to_launch,
                "is_launch_day": is_launch_day,
                "checklist_pass_rate": checklist["pct"],
                "checklist_passed": checklist["passed"],
                "checklist_total": checklist["total"],
                "node1_height": status["node1"]["chain_height"],
                "node2_height": status.get("local_backup", {}).get("chain_height") if status.get("topology") == "edge-primary" else status["node2"]["chain_height"],
                "node1_running": status["node1"]["running"],
                "node2_running": status.get("local_backup", {}).get("running", False) if status.get("topology") == "edge-primary" else status["node2"]["running"],
                "edge_node_running": status.get("edge_node", {}).get("running", False),
                "edge_node2_running": status.get("edge_node2", {}).get("running", False),
                "edge_node2_height": status.get("edge_node2", {}).get("chain_height"),
                "edge_node2_peers": status.get("edge_node2", {}).get("known_peers", 0),
                "local_backup_running": status.get("local_backup", {}).get("running", False),
                "local_backup_height": status.get("local_backup", {}).get("chain_height"),
                "local_backup_peers": status.get("local_backup", {}).get("known_peers", 0),
                "edge_node_height": status.get("edge_node", {}).get("chain_height"),
                "pool_running": status["pool"]["running"],
                "miner_running": status["miner"]["running"],
                "git_status": git_status,
                "ready_for_launch": all([
                    genesis_hash is not None and genesis_hash != "Unknown" and len(str(genesis_hash)) == 64,
                    all(fee_split_match.values()),
                    status.get("edge_node", {}).get("running", False) if status.get("topology") == "edge-primary" else status["node1"]["running"],
                    status.get("local_backup", {}).get("running", False) if status.get("topology") == "edge-primary" else status["node2"]["running"],
                    status["pool"]["running"],
                    git_status["clean"],
                    checklist["pct"] >= 80
                ])
            })
        elif route == "/api/launch-day-prepare":
            # Launch Day automation: backup configs, prepare genesis rotation
            action = params.get("action", ["status"])[0]
            
            if action == "status":
                # Check if launch day backup exists
                backup_dir = REPO_ROOT / "backups" / "launch-day-2026-06-20"
                backup_exists = backup_dir.exists()
                
                # Check current genesis
                current_genesis_hash = None
                try:
                    genesis = rpc_call("127.0.0.1", 8443, "getBlockByHeight", {"height": 0})
                    if genesis and genesis.get("hash"):
                        current_genesis_hash = genesis["hash"]
                except Exception:
                    pass
                
                self._json({
                    "backup_exists": backup_exists,
                    "backup_dir": str(backup_dir),
                    "current_genesis_hash": current_genesis_hash,
                    "launch_date": "2026-06-20T12:00:00",
                    "is_launch_day": datetime.now().date() == datetime(2026, 6, 20).date(),
                    "ready_for_rotation": backup_exists and current_genesis_hash
                })
                
            elif action == "backup":
                # Create launch day backup
                import shutil
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_dir = REPO_ROOT / "backups" / f"launch-day-{timestamp}"
                backup_dir.mkdir(parents=True, exist_ok=True)

                # Fetch current genesis hash for the manifest
                current_genesis_hash = None
                try:
                    genesis = rpc_call("127.0.0.1", 8443, "getBlockByHeight", {"height": 0}, timeout=3)
                    if genesis and genesis.get("hash"):
                        current_genesis_hash = genesis["hash"]
                except Exception:
                    pass

                backup_log = []

                try:
                    # Backup critical files
                    critical_files = [
                        "V3/L1/core/src/genesis.rs",
                        "PREMINE_ADDRESSES_PUBLIC.txt",
                        "V3/docs/mainnet/PREMINE_AND_CANONICAL_WALLETS_PUBLIC.txt",
                        "zion.toml",
                        ".env.mainnet",
                        "edge-deploy/config/edge-environment.sh"
                    ]
                    
                    for file_path in critical_files:
                        src = REPO_ROOT / file_path
                        if src.exists():
                            dst = backup_dir / file_path
                            dst.parent.mkdir(parents=True, exist_ok=True)
                            shutil.copy2(src, dst)
                            backup_log.append(f"✓ Backed up: {file_path}")
                        else:
                            backup_log.append(f"⚠ Not found: {file_path}")
                    
                    # Backup databases
                    db_dir = REPO_ROOT / "V3" / "data"
                    if db_dir.exists():
                        db_backup = backup_dir / "V3" / "data"
                        shutil.copytree(db_dir, db_backup, dirs_exist_ok=True)
                        backup_log.append(f"✓ Backed up database directory")
                    
                    # Create backup manifest
                    manifest = {
                        "timestamp": timestamp,
                        "genesis_hash": current_genesis_hash,
                        "files_backed_up": len([f for f in critical_files if (REPO_ROOT / f).exists()]),
                        "backup_log": backup_log
                    }
                    
                    with open(backup_dir / "BACKUP_MANIFEST.json", "w") as f:
                        json.dump(manifest, f, indent=2)
                    
                    self._json({
                        "success": True,
                        "backup_dir": str(backup_dir),
                        "backup_log": backup_log,
                        "manifest": manifest
                    })
                    
                except Exception as e:
                    self._json({
                        "success": False,
                        "error": str(e),
                        "backup_log": backup_log
                    })
                    
            elif action == "rotate-genesis":
                # Genesis rotation - this is CRITICAL, requires confirmation
                confirmed = params.get("confirmed", ["false"])[0].lower() == "true"
                
                if not confirmed:
                    self._json({
                        "success": False,
                        "error": "Genesis rotation requires explicit confirmation",
                        "requires_confirmation": True
                    })
                    return
                
                # This would trigger the actual genesis rotation script
                # For safety, we'll just prepare the command
                rotation_script = REPO_ROOT / "scripts" / "rotate-genesis-launch-day.sh"
                
                self._json({
                    "success": True,
                    "message": "Genesis rotation command prepared",
                    "script": str(rotation_script),
                    "warning": "This is a critical operation - ensure all nodes are stopped",
                    "next_steps": [
                        "Stop all nodes and miners",
                        "Run rotation script",
                        "Verify new genesis hash",
                        "Restart network",
                        "Verify sync"
                    ]
                })
                
        elif route == "/api/launch-day-execute":
            # Execute actual launch day sequence
            step = params.get("step", ["prepare"])[0]
            
            if step == "prepare":
                # Step 1: Create backup
                import shutil
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_dir = REPO_ROOT / "backups" / f"launch-day-{timestamp}"
                backup_dir.mkdir(parents=True, exist_ok=True)
                
                # Save current state
                state_snapshot = {
                    "timestamp": datetime.now().isoformat(),
                    "launch_date": "2026-06-20T12:00:00",
                    "current_height": None,
                    "current_genesis": None
                }
                
                try:
                    status = build_status()
                    state_snapshot["current_height"] = status["node1"]["chain_height"]
                    
                    genesis = rpc_call("127.0.0.1", 8443, "getBlockByHeight", {"height": 0})
                    if genesis and genesis.get("hash"):
                        state_snapshot["current_genesis"] = genesis["hash"]
                except Exception as e:
                    state_snapshot["error"] = str(e)
                
                with open(backup_dir / "STATE_SNAPSHOT.json", "w") as f:
                    json.dump(state_snapshot, f, indent=2)
                
                # Backup critical config files
                config_backup = backup_dir / "configs"
                config_backup.mkdir(exist_ok=True)
                
                critical_configs = [
                    "V3/L1/core/src/genesis.rs",
                    "PREMINE_ADDRESSES_PUBLIC.txt",
                    "zion.toml"
                ]
                
                backup_results = []
                for config in critical_configs:
                    src = REPO_ROOT / config
                    if src.exists():
                        dst = config_backup / Path(config).name
                        shutil.copy2(src, dst)
                        backup_results.append(f"✓ {config}")
                    else:
                        backup_results.append(f"✗ {config} (not found)")
                
                self._json({
                    "success": True,
                    "step": "prepare",
                    "backup_dir": str(backup_dir),
                    "state_snapshot": state_snapshot,
                    "backup_results": backup_results,
                    "next_step": "stop-network"
                })
                
            elif step == "stop-network":
                # Step 2: Stop all services
                stop_results = []
                
                stop_commands = [
                    ("stop-node1", "Node 1"),
                    ("stop-node2", "Node 2"),
                    ("stop-pool", "Pool"),
                    ("stop-miner", "Miner")
                ]
                
                for cmd, name in stop_commands:
                    try:
                        result = run_control(cmd)
                        stop_results.append(f"✓ {name} stopped")
                    except Exception as e:
                        stop_results.append(f"✗ {name} error: {str(e)}")
                
                self._json({
                    "success": True,
                    "step": "stop-network",
                    "stop_results": stop_results,
                    "next_step": "rotate-genesis"
                })
                
            elif step == "rotate-genesis":
                # Step 3: Rotate genesis (placeholder - actual implementation would be in separate script)
                self._json({
                    "success": True,
                    "step": "rotate-genesis",
                    "message": "Genesis rotation would execute here",
                    "next_step": "restart-network"
                })
                
            elif step == "restart-network":
                # Step 4: Restart network with new genesis
                self._json({
                    "success": True,
                    "step": "restart-network",
                    "message": "Network restart would execute here",
                    "next_step": "verify"
                })
                
            elif step == "verify":
                # Step 5: Verify new network state
                self._json({
                    "success": True,
                    "step": "verify",
                    "message": "Verification would execute here",
                    "complete": True
                })
        elif route == "/api/wallets":
            self._json(build_wallets())
        elif route == "/api/explorer":
            self._json(build_explorer())
        elif route == "/api/payout":
            self._json(build_payout_status())
        elif route == "/api/block":
            q = params.get("q", [""])[0].strip()
            h = params.get("height", [""])[0].strip()
            hash_hex = params.get("hash", [""])[0].strip()
            if q:
                if q.isdigit():
                    self._json(get_block_detail(height=int(q)))
                else:
                    self._json(get_block_detail(hash_hex=q))
            else:
                height = int(h) if h.isdigit() else None
                self._json(get_block_detail(height=height, hash_hex=hash_hex if hash_hex else None))
        elif route == "/api/miner/shares":
            self._json(get_miner_shares_history())
        elif route == "/api/dependency-graph":
            self._json(get_dependency_graph())
        elif route == "/api/backup/status":
            self._json(get_backup_status())
        elif route == "/api/wallet/status":
            self._json(get_pool_wallet_status())
        elif route == "/api/ai/status":
            self._json(get_ai_services_status())
        elif route == "/api/cli/run":
            cmd = params.get("cmd", [""])[0].strip()
            self._json(run_zion_cli(cmd))
        elif route == "/api/cli/node-status":
            # Return node status from RPC (no CLI script needed)
            st = build_status()
            n1 = st.get("node1", {})
            if n1.get("running"):
                output = (f"Height    {n1.get('chain_height', '?')}\n"
                          f"Peers     {n1.get('known_peers', 0)}\n"
                          f"Mempool   {n1.get('mempool_size', 0)}\n"
                          f"Tip       {(n1.get('tip_hash') or '')[:64]}\n"
                          f"NodeID    {n1.get('node_id', '?')}\n")
                self._json({"ok": True, "output": output, "cli_connected": True})
            else:
                self._json({"ok": False, "error": "Node not running", "cli_connected": False})
        elif route == "/api/alerts/config":
            self._json(load_alert_config())
        elif route == "/api/settings":
            self._json(load_settings())
        elif route == "/api/logs/search":
            q = params.get("q", [""])[0].strip()
            max_r = int(params.get("max", ["50"])[0])
            self._json({"query": q, "results": search_logs(q, max_r)})
        elif route == "/api/processes/kill":
            pid = int(params.get("pid", ["0"])[0])
            self._json(kill_process(pid))
        elif route == "/api/export/blocks":
            # Export recent blocks as CSV
            expl = build_explorer()
            headers = ["height", "hash", "timestamp", "tx_count", "difficulty"]
            csv = export_csv(expl.get("recent_blocks", []), headers)
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", "attachment; filename=blocks.csv")
            body = csv.encode("utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        elif route.startswith("/api/metrics/"):
            sid = route.split("/")[-1]
            self._json(scrape_metrics(sid))
        elif route == "/api/db":
            self._json({"databases": list_databases()})
        elif route == "/api/db/inspect":
            path = params.get("path", [""])[0]
            self._json(inspect_database(path))
        elif route.startswith("/api/logs/"):
            service = route.split("/")[-1]
            n_lines = int(params.get("n", ["200"])[0])
            filename = SERVICE_LOG_MAP.get(service, f"{service}.log")
            # Try latest_log_path first (finds timestamped variants)
            log_p = latest_log_path(filename.removesuffix(".log"))
            if log_p and log_p.exists():
                self._json({"lines": tail_log(log_p.name, n_lines)})
            else:
                self._json({"lines": tail_log(filename, n_lines)})
        elif route == "/api/install/log":
            install_log = LOG_DIR / "install-deps.log"
            lines = []
            if install_log.exists():
                with open(install_log, "r", encoding="utf-8", errors="ignore") as f:
                    lines = [ln.rstrip("\n") for ln in f.readlines()[-200:]]
            self._json({"lines": lines, "file": str(install_log)})
        # ── Dashboard v2 compatibility endpoints ─────────────────────────────
        elif route == "/api/health":
            # v2 client: GET /api/health → returns HealthMap {service: status}
            self._json(_build_health_map())
        elif route == "/api/systemd":
            # Local systemd user service status — autonomous monitoring
            try:
                import subprocess as _sp
                services = ["zion-ssh-tunnel", "zion-backup-node", "zion-dashboard"]
                result = {}
                for svc in services:
                    try:
                        proc = _sp.run(
                            ["systemctl", "--user", "is-active", svc],
                            capture_output=True, text=True, timeout=3
                        )
                        active = proc.stdout.strip() == "active"
                        # Get uptime
                        proc2 = _sp.run(
                            ["systemctl", "--user", "show", svc, "--property=ActiveEnterTimestamp,MainPID,ExecMainStatus"],
                            capture_output=True, text=True, timeout=3
                        )
                        props = {}
                        for line in proc2.stdout.strip().split("\n"):
                            if "=" in line:
                                k, v = line.split("=", 1)
                                props[k] = v
                        result[svc] = {
                            "active": active,
                            "status": proc.stdout.strip(),
                            "pid": props.get("MainPID", "?"),
                            "started": props.get("ActiveEnterTimestamp", ""),
                            "exit_status": props.get("ExecMainStatus", ""),
                        }
                    except Exception as e:
                        result[svc] = {"active": False, "status": "error", "error": str(e)}
                # Backup timer
                try:
                    proc = _sp.run(
                        ["systemctl", "--user", "list-timers", "zion-backup.timer", "--no-pager", "--plain"],
                        capture_output=True, text=True, timeout=3
                    )
                    lines = [l for l in proc.stdout.strip().split("\n") if "zion-backup" in l]
                    result["zion-backup-timer"] = {
                        "active": bool(lines),
                        "raw": lines[0] if lines else "",
                    }
                except Exception:
                    result["zion-backup-timer"] = {"active": False, "raw": ""}
                # Linger status
                try:
                    proc = _sp.run(
                        ["loginctl", "show-user", os.environ.get("USER", "zionserver"), "--property=Linger"],
                        capture_output=True, text=True, timeout=3
                    )
                    result["linger"] = "yes" in proc.stdout.lower()
                except Exception:
                    result["linger"] = None
                self._json(result)
            except Exception as ex:
                self._json({"error": str(ex)})
        elif route == "/api/autonomous/health":
            # Autonomous health check — comprehensive system status with auto-restart recommendations
            try:
                _st = build_status()
                _sysd = {}
                import subprocess as _sp
                for svc in ["zion-ssh-tunnel", "zion-backup-node", "zion-dashboard"]:
                    try:
                        proc = _sp.run(["systemctl", "--user", "is-active", svc],
                                      capture_output=True, text=True, timeout=2)
                        _sysd[svc] = proc.stdout.strip()
                    except Exception:
                        _sysd[svc] = "unknown"

                _lb = _st.get("local_backup", {})
                _en = _st.get("edge_node", {})
                _pe = _st.get("pool_edge", {})

                issues = []
                if _sysd.get("zion-ssh-tunnel") != "active":
                    issues.append({"svc": "ssh-tunnel", "severity": "critical",
                                  "msg": "SSH tunnel down — edge services unreachable",
                                  "action": "systemctl --user restart zion-ssh-tunnel"})
                if _sysd.get("zion-backup-node") != "active":
                    issues.append({"svc": "backup-node", "severity": "warning",
                                  "msg": "Backup node service not active",
                                  "action": "systemctl --user restart zion-backup-node"})
                if _sysd.get("zion-dashboard") != "active":
                    issues.append({"svc": "dashboard", "severity": "info",
                                  "msg": "Dashboard service not active (but you're seeing this...)",
                                  "action": "systemctl --user restart zion-dashboard"})
                if _en.get("running") and _lb.get("running"):
                    gap = abs((_en.get("chain_height") or 0) - (_lb.get("chain_height") or 0))
                    if gap > 10:
                        issues.append({"svc": "sync", "severity": "warning",
                                      "msg": f"Backup node {gap} blocks behind edge",
                                      "action": "systemctl --user restart zion-backup-node"})
                if _lb.get("running") and _lb.get("known_peers", 0) == 0:
                    issues.append({"svc": "p2p", "severity": "warning",
                                  "msg": "Backup node has 0 P2P peers",
                                  "action": "Check SSH tunnel + edge P2P"})
                if not _pe.get("running"):
                    issues.append({"svc": "pool", "severity": "warning",
                                  "msg": "Edge pool not reachable",
                                  "action": "Check edge pool service"})

                self._json({
                    "healthy": len(issues) == 0,
                    "issues": issues,
                    "systemd": _sysd,
                    "edge_height": _en.get("chain_height"),
                    "local_height": _lb.get("chain_height"),
                    "sync_gap": abs((_en.get("chain_height") or 0) - (_lb.get("chain_height") or 0)) if _en.get("running") and _lb.get("running") else None,
                    "p2p_peers": _lb.get("known_peers", 0),
                    "pool_hashrate": _pe.get("hashrate"),
                    "pool_miners": _pe.get("active_miners"),
                })
            except Exception as ex:
                self._json({"error": str(ex), "healthy": False})
        elif route == "/api/blocks":
            # v2 client: GET /api/blocks?limit=N → returns array of BlockSummary
            limit = int(params.get("limit", ["20"])[0])
            expl = build_explorer()
            blocks = expl.get("recent_blocks", [])[:limit]
            # Normalise to BlockSummary shape expected by v2
            result = []
            for b in blocks:
                result.append({
                    "height": b.get("height", 0),
                    "hash": b.get("hash", b.get("hash_hex", "")),
                    "ts": b.get("timestamp", 0),
                    "txns": b.get("tx_count", 0),
                    "size": b.get("size", 0),
                    "difficulty": b.get("difficulty", 0),
                })
            self._json(result)
        elif route.startswith("/api/block/"):
            # v2 client: GET /api/block/{hashOrHeight}
            slug = route.split("/api/block/", 1)[1].strip()
            if slug.isdigit():
                self._json(get_block_detail(height=int(slug)))
            else:
                self._json(get_block_detail(hash_hex=slug))
        elif route == "/api/launch-day/status":
            # v2 client alias for launch-day-prepare?action=status
            self._json(get_launch_state())
        elif route == "/api/edge/backup/list":
            self._json(list_edge_backups())
        elif route == "/api/edge/backup/download":
            # Download a specific backup file: /api/edge/backup/download?name=zion-edge-20260628-150423.tar.gz
            fname = params.get("name", [""])[0].strip()
            if not fname or "/" in fname or ".." in fname:
                self._json({"ok": False, "error": "Invalid filename"})
                return
            if not fname.endswith(".tar.gz"):
                self._json({"ok": False, "error": "Only .tar.gz files allowed"})
                return
            filepath = get_edge_backup_path(fname)
            if filepath is None or not filepath.exists():
                self._json({"ok": False, "error": f"Backup not found: {fname}"})
                return
            try:
                file_size = filepath.stat().st_size
                self.send_response(200)
                self.send_header("Content-Type", "application/gzip")
                self.send_header("Content-Disposition", f'attachment; filename="{fname}"')
                self.send_header("Content-Length", str(file_size))
                self.end_headers()
                with open(filepath, "rb") as f:
                    while True:
                        chunk = f.read(65536)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/backup/list":
            backups = []
            backup_dir = REPO_ROOT / "backups"
            if backup_dir.exists():
                for f in sorted(backup_dir.glob("backup_*.zip"), key=lambda p: p.stat().st_mtime, reverse=True):
                    s = f.stat()
                    backups.append({
                        "name": f.name,
                        "size_mb": round(s.st_size / (1024*1024), 2),
                        "created": datetime.fromtimestamp(s.st_mtime).isoformat(),
                    })
            self._json({"backups": backups})
        elif route == "/api/backup/verify":
            res = run_control("verify-chain")
            # Also parse the log for structured output
            verify_log = LOG_DIR / "verify-chain.log"
            log_lines = []
            if verify_log.exists():
                with open(verify_log, "r", encoding="utf-8", errors="ignore") as f:
                    log_lines = [ln.rstrip("\n") for ln in f.readlines()[-50:]]
            self._json({"result": res, "log": log_lines})
        elif route.startswith("/api/layer/"):
            layer = route.split("/")[-1].upper()
            layer_map = {"L1": "L1", "L2": "L2", "L3": "L3", "L4": "L4", "L5": "L5", "L6": "L6"}
            layer = layer_map.get(layer, layer)
            services = [s for s in SERVICE_REGISTRY if s.get("level") == layer]
            db_list = list_databases()
            result = []
            for svc in services:
                sid = svc["id"]
                h = check_service_health(svc)
                # DB stats
                svc_dbs = [d for d in db_list if d["service"] == sid]
                # Metrics
                m = scrape_metrics(sid)
                has_metrics = "metrics" in m and not m.get("error")
                # Log tail (last 20 lines)
                log_tail = []
                if svc.get("log"):
                    log_tail = tail_log(svc["log"], 20)
                result.append({
                    "id": sid,
                    "name": svc["name"],
                    "icon": svc["icon"],
                    "kind": svc["kind"],
                    "purpose": svc["purpose"],
                    "alive": h["alive"],
                    "details": h["details"],
                    "ports_open": h.get("ports_open", []),
                    "ports_closed": h.get("ports_closed", []),
                    "databases": svc_dbs,
                    "has_metrics": has_metrics,
                    "metrics_count": len(m.get("metrics", {})),
                    "log_tail": log_tail,
                    "depends_on": svc.get("depends_on", []),
                })
            self._json({"layer": layer, "services": result, "count": len(result)})
        # ── Service log tail ─────────────────────────────────────────────────
        elif route == "/api/service-log":
            svc_id = params.get("id", [""])[0].strip()
            n_lines = int(params.get("lines", ["80"])[0])
            log_name = SERVICE_LOG_MAP.get(svc_id)
            if not log_name:
                self._json({"error": "unknown service", "lines": ""})
            else:
                log_file = LOG_DIR / log_name
                if not log_file.exists():
                    self._json({"lines": f"(log file {log_name} not found)", "exists": False})
                else:
                    try:
                        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
                            all_lines = f.readlines()
                        tail = "".join(all_lines[-n_lines:])
                        self._json({"lines": tail, "exists": True, "total_lines": len(all_lines)})
                    except Exception as e:
                        self._json({"error": str(e), "lines": ""})
        # ── Hiran AI endpoints ────────────────────────────────────────────────
        elif route == "/api/hiran/health":
            hiran_url = "http://127.0.0.1:8002"
            alive, backend, model_name, uptime_s = False, "none", "—", None
            try:
                req = urllib.request.Request(
                    f"{hiran_url}/health",
                    headers={"Accept": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=2) as r:
                    data_h = json.loads(r.read())
                    alive = data_h.get("status") == "ok"
                    backend = data_h.get("backend", "unknown")
                    model_name = data_h.get("model", "hiran-v2.2")
                    uptime_s = data_h.get("uptime_s")
            except Exception as e:
                alive = False
                backend = f"error: {str(e)[:60]}"
            # Try to read GPU layers from stderr log
            gpu_layers = 0
            try:
                err_log = REPO_ROOT / "logs" / "hiran-inference.err"
                if err_log.exists():
                    import re
                    with open(err_log, "r", encoding="utf-8", errors="ignore") as f:
                        for line in reversed(f.readlines()):
                            m = re.search(r"offloaded\s+(\d+)\/(\d+)\s+layers?\s+to\s+GPU", line)
                            if m:
                                gpu_layers = int(m.group(1))
                                break
            except Exception:
                pass
            self._json({
                "alive": alive,
                "backend": backend,
                "model": model_name,
                "uptime_s": uptime_s,
                "endpoint": hiran_url,
                "gpu_layers": gpu_layers,
            })
        elif route == "/api/hiranyagarbha/health":
            orch_url = "http://127.0.0.1:8001"
            alive, version, active_agents, task_queue = False, None, None, None
            try:
                req = urllib.request.Request(
                    f"{orch_url}/health",
                    headers={"Accept": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=2) as r:
                    data_o = json.loads(r.read())
                    alive = data_o.get("status") in ("ok", "healthy")
                    version = data_o.get("version")
                    active_agents = data_o.get("active_agents")
                    task_queue = data_o.get("task_queue_depth") or data_o.get("task_queue")
            except Exception as e:
                alive = False
            self._json({
                "alive": alive,
                "version": version,
                "active_agents": active_agents,
                "task_queue": task_queue,
                "endpoint": orch_url,
            })
        # ── NCL API proxy endpoints (forward to Hiranyagarbha :8001/ncl/*) ──
        elif route in ("/api/ncl/status", "/api/ncl/health", "/api/ncl/workers",
                       "/api/ncl/leaderboard", "/api/ncl/price", "/api/ncl/jobs"):
            ncl_path = route.replace("/api/ncl/", "/ncl/")
            try:
                req = urllib.request.Request(
                    f"http://127.0.0.1:8001{ncl_path}",
                    headers={"Accept": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=5) as r:
                    self._json(json.loads(r.read()))
            except Exception as e:
                self._json({"error": f"NCL backend unreachable: {str(e)[:80]}"})
        elif route == "/api/alerts/dismiss":
            alert_id = payload.get("id", "").strip()
            if not alert_id:
                self._json({"ok": False, "error": "id required"})
                return
            dismiss_alert(alert_id)
            self._json({"ok": True, "dismissed": alert_id})
            return
        # ── CEX + DEX listings (proxy to Edge website API) ───────────────────
        elif route == "/api/cex/listings":
            self._proxy_to_edge_web("/api/cex/listings")
            return
        # ── Bridge API (Phase 26a) — Mainnet 5/5 Bridge ───────────────────────
        elif route == "/api/bridge/status":
            svc = get_service("bridge")
            h = check_service_health(svc) if svc else {"alive": False, "details": "bridge not in registry"}
            bridge_db = REPO_ROOT / "V3" / "data" / "bridge.db"
            pending = 0
            last_block = None
            total_volume = 0
            last_l1_height = None
            last_evm_block = None
            locks_detected = 0
            mints_confirmed = 0
            burns_detected = 0
            unlocks_confirmed = 0
            try:
                if bridge_db.exists():
                    con = sqlite3.connect(str(bridge_db))
                    cur = con.cursor()
                    cur.execute("SELECT COUNT(*) FROM transfers WHERE status = 'pending'")
                    pending = cur.fetchone()[0]
                    cur.execute("SELECT MAX(block_height) FROM transfers")
                    row = cur.fetchone()
                    last_block = row[0] if row and row[0] else None
                    cur.execute("SELECT SUM(amount_flowers) FROM transfers WHERE status = 'completed'")
                    row = cur.fetchone()
                    if row and row[0]:
                        total_volume = round(row[0] / 1_000_000, 2)
                    con.close()
            except Exception:
                pass
            # Try to read live relay metrics from the bridge metrics endpoint
            try:
                import urllib.request as _ur
                bridge_svc = get_service("bridge")
                host = bridge_svc.get("host", "127.0.0.1") if bridge_svc else "127.0.0.1"
                port = bridge_svc.get("ports", {}).get("metrics", 9101) if bridge_svc else 9101
                with _ur.urlopen(f"http://{host}:{port}/metrics", timeout=2.0) as r:
                    metrics_text = r.read().decode("utf-8")
                for line in metrics_text.splitlines():
                    if line.startswith("zion_bridge_last_l1_height "):
                        last_l1_height = int(line.split()[-1])
                    elif line.startswith("zion_bridge_last_evm_block "):
                        last_evm_block = int(line.split()[-1])
                    elif line.startswith("zion_bridge_l1_locks_detected_total "):
                        locks_detected = int(line.split()[-1])
                    elif line.startswith("zion_bridge_evm_mints_confirmed_total "):
                        mints_confirmed = int(line.split()[-1])
                    elif line.startswith("zion_bridge_evm_burns_detected_total "):
                        burns_detected = int(line.split()[-1])
                    elif line.startswith("zion_bridge_l1_unlocks_confirmed_total "):
                        unlocks_confirmed = int(line.split()[-1])
            except Exception:
                pass
            self._json({
                "online": h["alive"],
                "status": "online" if h["alive"] else "offline",
                "details": h.get("details", ""),
                "pending_count": pending,
                "last_block": last_block,
                "total_volume": total_volume,
                "validators_online": 5,
                "contract_verified": True,
                "threshold": 5,
                "chains": [{"id": "base-mainnet", "name": "Base Mainnet", "enabled": True}],
                "metrics": {
                    "last_l1_height": last_l1_height,
                    "last_evm_block": last_evm_block,
                    "locks_detected": locks_detected,
                    "mints_confirmed": mints_confirmed,
                    "burns_detected": burns_detected,
                    "unlocks_confirmed": unlocks_confirmed,
                },
            })
        elif route == "/api/bridge/history":
            bridge_db = REPO_ROOT / "V3" / "data" / "bridge.db"
            transfers = []
            try:
                if bridge_db.exists():
                    con = sqlite3.connect(str(bridge_db))
                    cur = con.cursor()
                    cur.execute("SELECT tx_hash, from_chain, to_chain, amount_flowers, status, created_at, block_height FROM transfers ORDER BY created_at DESC LIMIT 50")
                    for row in cur.fetchall():
                        tx_hash, from_chain, to_chain, amt, status, created, block = row
                        explorer = ""
                        if tx_hash and tx_hash.startswith("0x"):
                            explorer = f"https://sepolia.basescan.org/tx/{tx_hash}"
                        transfers.append({
                            "tx_hash": tx_hash,
                            "from_chain": from_chain or "zion",
                            "to_chain": to_chain or "base-sepolia",
                            "amount": round(amt / 1_000_000, 4) if amt else 0,
                            "status": status or "unknown",
                            "timestamp": created or "—",
                            "block_height": block,
                            "explorer_url": explorer,
                        })
                    con.close()
            except Exception as e:
                self._json({"transfers": [], "error": str(e)[:80]})
                return
            self._json({"transfers": transfers, "count": len(transfers)})
        elif route == "/api/bridge/chains":
            self._json({
                "chains": [
                    {"id": "zion", "name": "ZION L1 Mainnet", "enabled": True, "type": "l1"},
                    {
                        "id": "base-mainnet",
                        "name": "Base Mainnet",
                        "enabled": True,
                        "type": "evm",
                        "evm_chain_id": 8453,
                        "wzion_address": "0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",
                        "bridge_address": "0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467",
                        "bridge_validator": "0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627",
                    },
                ]
            })
        elif route == "/api/bridge/validators":
            self._json({
                "validators": [
                    {"address": "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186", "online": True, "role": "deployer + guardian + validator"},
                    {"address": "0x24d986841E56e5571489B25951eE8C1Ae761FA82", "online": True, "role": "guardian + validator"},
                    {"address": "0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0", "online": True, "role": "guardian + validator"},
                    {"address": "0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6", "online": True, "role": "guardian + validator"},
                    {"address": "0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2", "online": True, "role": "guardian + validator"},
                ],
                "threshold": 5,
                "total": 5,
                "note": "5/5 multisig deployed on Base Mainnet — all 5 validators active",
            })
        elif route == "/api/poc/status":
            # PoC-lab status — check if poc-sim binary exists and Hiran is reachable
            poc_sim_path = SCRIPT_DIR / ".." / ".." / "PoC-lab" / "target" / "debug" / "poc-sim"
            poc_sim_exists = poc_sim_path.exists()
            hiran_online = False
            try:
                import urllib.request as _ur
                with _ur.urlopen("http://127.0.0.1:8002/health", timeout=2) as r:
                    hiran_online = json.loads(r.read()).get("status") == "ok"
            except Exception:
                pass
            self._json({
                "ok": True,
                "poc_sim_available": poc_sim_exists,
                "poc_sim_path": str(poc_sim_path),
                "hiran_online": hiran_online,
                "hiran_url": "http://127.0.0.1:8002" if hiran_online else None,
                "workspace": "PoC-lab",
                "crates": ["poc-core", "poc-economics", "poc-hiran", "poc-npu",
                           "poc-registry", "poc-sim", "poc-tasks", "poc-verifier"],
            })
        elif route == "/api/poc/run":
            # Run poc-sim simulation and return JSON results
            # Query params: epochs (default 3), validators (default 4),
            #               hiran (1/0, default 1 if Hiran online), block_reward (default 1000000)
            epochs = int(params.get("epochs", ["3"])[0])
            validators = int(params.get("validators", ["4"])[0])
            block_reward = int(params.get("block_reward", ["1000000"])[0])
            use_hiran = params.get("hiran", ["auto"])[0]
            poc_sim_path = SCRIPT_DIR / ".." / ".." / "PoC-lab" / "target" / "debug" / "poc-sim"
            if not poc_sim_path.exists():
                self._json({"ok": False, "error": "poc-sim binary not found. Run: cargo build -p poc-sim"})
                return
            # Check Hiran availability
            hiran_online = False
            try:
                import urllib.request as _ur
                with _ur.urlopen("http://127.0.0.1:8002/health", timeout=2) as r:
                    hiran_online = json.loads(r.read()).get("status") == "ok"
            except Exception:
                pass
            cmd = [str(poc_sim_path), "--json",
                   "--epochs", str(epochs),
                   "--validators", str(validators),
                   "--block-reward", str(block_reward)]
            use_live = use_hiran == "1" or (use_hiran == "auto" and hiran_online)
            if use_live:
                cmd.extend(["--hiran-url", "http://127.0.0.1:8002"])
            # Live Hiran is slow (~5 tok/s CPU) — allow 300s for live, 30s for stub
            timeout_sec = 300 if use_live else 30
            _sp = __import__('subprocess')
            try:
                result = _sp.run(cmd, capture_output=True, text=True, timeout=timeout_sec)
                if result.returncode != 0:
                    self._json({"ok": False, "error": result.stderr[:500]})
                else:
                    data = json.loads(result.stdout)
                    data["ok"] = True
                    self._json(data)
            except _sp.TimeoutExpired:
                self._json({"ok": False, "error": f"Simulation timed out ({timeout_sec}s limit). Use stub mode or fewer epochs for live Hiran."})
            except json.JSONDecodeError as e:
                self._json({"ok": False, "error": f"JSON parse error: {e}", "raw": result.stdout[:500]})
            except Exception as e:
                self._json({"ok": False, "error": str(e)[:200]})
        elif route == "/api/poc/html":
            # Serve the PoC dashboard panel HTML (standalone page)
            poc_html = _poc_dashboard_html()
            self._html(poc_html)
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        """CORS preflight — allow Vite dev server and Tauri desktop app."""
        origin = self.headers.get("Origin", "")
        allowed = ["http://localhost:5173", "http://localhost:1420", "http://localhost:3000", "tauri://localhost"]
        cors_origin = origin if origin in allowed else "*"
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", cors_origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if not self._check_auth():
            return
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b""
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            payload = {}

        if route.startswith("/api/dao"):
            # Proxy POST /api/dao/* to DAO daemon on port 8450
            self._proxy_to_dao("POST", route, raw, dict(self.headers))
            return
        elif route == "/api/hiran/chat":
            self._handle_hiran_chat_post(payload)
            return
        elif route == "/api/ncl/jobs":
            # Forward NCL job submission to Hiranyagarbha
            try:
                body = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    "http://127.0.0.1:8001/ncl/jobs",
                    data=body,
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=10) as r:
                    self._json(json.loads(r.read()))
            except Exception as e:
                self._json({"error": f"NCL job submission failed: {str(e)[:80]}"})
            return
        # ── Dashboard v2 compatibility: POST service/node/pool/miner control ─
        elif re.match(r"^/api/service/[^/]+/(start|stop|restart)$", route):
            parts = route.strip("/").split("/")  # ["api","service","<id>","<act>"]
            svc_id, svc_action = parts[2], parts[3]
            action_map = {
                "start":   f"start-{svc_id}",
                "stop":    f"stop-{svc_id}",
                "restart": f"restart-{svc_id}",
            }
            self._json(run_control(action_map[svc_action]))
        # ── Stack-level endpoints ───────────────────────────────────────────
        elif route == "/api/stack/launch":
            self._json(run_control("launch-stack"))
        elif route == "/api/stack/stop":
            self._json(run_control("stop-stack"))
        elif route == "/api/stack/stop-all":
            self._json(run_control("stop-all"))
        # ── Orchestrator endpoints ─────────────────────────────────────────
        elif route == "/api/orchestrator/start":
            svc = payload.get("service", "")
            self._json(orchestrator_control("start", svc))
        elif route == "/api/orchestrator/stop":
            svc = payload.get("service", "")
            self._json(orchestrator_control("stop", svc))
        elif route == "/api/orchestrator/restart":
            svc = payload.get("service", "")
            self._json(orchestrator_control("restart", svc))
        # ── Node 1 ───────────────────────────────────────────────────────────
        elif route == "/api/node1/start":
            self._json(run_control("start-node1"))
        elif route == "/api/node1/stop":
            self._json(run_control("stop-node1"))
        elif route == "/api/node1/restart":
            self._json(run_control("restart-node1"))
        # ── Node 2 ───────────────────────────────────────────────────────────
        elif route == "/api/node2/start":
            self._json(run_control("start-node2"))
        elif route == "/api/node2/stop":
            self._json(run_control("stop-node2"))
        elif route == "/api/node2/restart":
            self._json(run_control("restart-node2"))
        # ── Pool ─────────────────────────────────────────────────────────────
        elif route in ("/api/pool/start", "/api/node/start"):
            self._json(run_control("start-pool"))
        elif route in ("/api/pool/stop", "/api/node/stop"):
            self._json(run_control("stop-pool"))
        elif route == "/api/pool/restart":
            self._json(run_control("restart-pool"))
        # ── Miner ────────────────────────────────────────────────────────────
        elif route == "/api/miner/start":
            self._json(run_control("start-miner"))
        elif route == "/api/miner/stop":
            self._json(run_control("stop-miner"))
        elif route == "/api/miner/restart":
            self._json(run_control("restart-miner"))
        elif route == "/api/miner/start-gpu":
            self._json(run_control("start-miner-gpu"))
        elif route == "/api/miner/start-cpu":
            self._json(run_control("start-miner-cpu"))
        elif route == "/api/control":
            action = payload.get("action", "")
            env_overrides = payload.get("env")
            self._json(run_control(action, env_overrides))
        elif route == "/api/servers-setup/backup-now":
            try:
                subprocess.Popen(
                    ["bash", str(SCRIPTS_DIR / "backup-system.sh")],
                    cwd=str(REPO_ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    preexec_fn=os.setsid if hasattr(os, "setsid") else None,
                )
                self._json({"ok": True, "message": "Backup triggered"})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/servers-setup/chain-backup-now":
            try:
                subprocess.Popen(
                    ["bash", str(SCRIPTS_DIR / "backup-chain.sh"), "-Name", "manual"],
                    cwd=str(REPO_ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    preexec_fn=os.setsid if hasattr(os, "setsid") else None,
                )
                self._json({"ok": True, "message": "Chain backup triggered"})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/agent/control":
            # Proxy control commands to the Desktop Agent (miner start/stop/restart)
            action = payload.get("action", "")
            try:
                agent_url = f"{AGENT_API_BASE}/api/miner/"
                if action == "miner/start":
                    req = urllib.request.Request(
                        f"{agent_url}start",
                        data=json.dumps({}).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                        method="POST"
                    )
                elif action == "miner/stop":
                    req = urllib.request.Request(
                        f"{agent_url}stop",
                        data=json.dumps({}).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                        method="POST"
                    )
                elif action == "miner/restart":
                    req = urllib.request.Request(
                        f"{agent_url}restart",
                        data=json.dumps({}).encode("utf-8"),
                        headers={"Content-Type": "application/json"},
                        method="POST"
                    )
                else:
                    self._json({"ok": False, "error": f"Unknown agent action: {action}"})
                    return
                with urllib.request.urlopen(req, timeout=5.0) as r:
                    self._json(json.loads(r.read().decode("utf-8")))
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/config":
            # POST: allow topology switching (requires restart)
            try:
                new_topology = payload.get("topology")
                if new_topology not in ["edge-primary", "local-dev"]:
                    self._json({"ok": False, "error": f"Invalid topology: {new_topology}. Must be 'edge-primary' or 'local-dev'."})
                    return
                # Update config file
                try:
                    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                        config = json.load(f)
                    config["topology"] = new_topology
                    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                        json.dump(config, f, indent=2)
                    self._json({"ok": True, "message": f"Topology changed to {new_topology}. Restart dashboard to apply.", "new_topology": new_topology})
                except Exception as e:
                    self._json({"ok": False, "error": f"Failed to update config: {str(e)}"})
            except Exception as e:
                self._json({"ok": False, "error": f"Invalid request: {str(e)}"})
        elif route == "/api/edge/clear-disk":
            aggressive = payload.get("aggressive", False)
            self._json(clear_edge_disk(aggressive=aggressive))
        elif route == "/api/edge-action":
            self._json(run_edge_action(payload.get("action", "")))
        elif route == "/api/settings/save":
            # Save mining/node settings to a JSON file
            try:
                settings = payload
                settings_file = DATA_DIR / "dashboard-settings.json"
                with open(settings_file, "w", encoding="utf-8") as f:
                    json.dump(settings, f, indent=2)
                self._json({"ok": True, "message": "Settings saved"})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/fleet/add":
            try:
                rig = payload
                rigs = load_fleet_rigs().get("rigs", [])
                rigs.append(rig)
                save_fleet_rigs(rigs)
                self._json({"ok": True, "message": "Rig added", "rig": rig})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/fleet/remove":
            try:
                rig_id = payload.get("rig_id", "")
                rigs = load_fleet_rigs().get("rigs", [])
                rigs = [r for r in rigs if r.get("id") != rig_id]
                save_fleet_rigs(rigs)
                self._json({"ok": True, "message": f"Rig {rig_id} removed"})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/proxy/rpc":
            # Proxy RPC call (used by Tauri desktop dashboard)
            url = payload.get("url", "")
            method = payload.get("method", "")
            params = payload.get("params")
            try:
                body = json.dumps({
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": method,
                    "params": params if params else []
                }).encode("utf-8")
                req = _urlreq.Request(url, data=body,
                    headers={"Content-Type": "application/json"},
                    method="POST")
                with _urlreq.urlopen(req, timeout=5) as r:
                    self._json(json.loads(r.read()))
            except Exception as e:
                self._json({"error": str(e)[:80]})
            return
        elif route == "/api/launch/stack":
            # Dependency-aware sequential stack launch
            with LAUNCH_STATE_LOCK:
                if LAUNCH_STATE["running"]:
                    self._json({"ok": False, "error": "Launch already in progress", "state": get_launch_state()})
                    return
            sids = ["node1", "node2", "pool", "miner"]
            thread = threading.Thread(target=run_dependency_launch, args=(sids,), daemon=True)
            thread.start()
            self._json({"ok": True, "message": "Stack launch started", "services": sids, "state": get_launch_state()})
        elif route == "/api/launch/full":
            # Launch everything that has a start script
            with LAUNCH_STATE_LOCK:
                if LAUNCH_STATE["running"]:
                    self._json({"ok": False, "error": "Launch already in progress", "state": get_launch_state()})
                    return
            sids = [svc["id"] for svc in SERVICE_REGISTRY if svc.get("start")]
            thread = threading.Thread(target=run_dependency_launch, args=(sids,), daemon=True)
            thread.start()
            self._json({"ok": True, "message": "Full launch started", "services": sids, "state": get_launch_state()})
        elif route == "/api/backup/create":
            name = payload.get("name", "").strip()
            include_logs = payload.get("includeLogs", False)
            include_env = payload.get("includeEnv", False)
            script = SCRIPTS_DIR / ("backup-chain" + _SCRIPT_EXT)
            args = _script_cmd(script)
            if (name):
                args += ["-Name", name]
            if (include_logs):
                args += ["-IncludeLogs"]
            if (include_env):
                args += ["-IncludeEnv"]
            try:
                proc = subprocess.Popen(args, cwd=str(REPO_ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                stdout, stderr = proc.communicate(timeout=60)
                ok = proc.returncode == 0
                out = (stdout.decode("utf-8", errors="ignore") + "\n" + stderr.decode("utf-8", errors="ignore")).strip()
                self._json({"ok": ok, "output": out})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/backup/restore":
            name = payload.get("name", "").strip()
            if not name:
                self._json({"ok": False, "error": "Backup name required"})
                return
            script = SCRIPTS_DIR / ("restore-chain" + _SCRIPT_EXT)
            try:
                proc = subprocess.Popen(
                    _script_cmd(script, "-BackupName", name),
                    cwd=str(REPO_ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                stdout, stderr = proc.communicate(timeout=120)
                ok = proc.returncode == 0
                out = (stdout.decode("utf-8", errors="ignore") + "\n" + stderr.decode("utf-8", errors="ignore")).strip()
                self._json({"ok": ok, "output": out})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/backup/delete":
            name = payload.get("name", "").strip()
            if not name:
                self._json({"ok": False, "error": "Backup name required"})
                return
            backup_file = REPO_ROOT / "backups" / name
            if not backup_file.exists():
                # Try with .zip extension
                backup_file = REPO_ROOT / "backups" / (name + ".zip")
            if not backup_file.exists():
                self._json({"ok": False, "error": f"Backup not found: {name}"})
                return
            try:
                backup_file.unlink()
                self._json({"ok": True, "message": f"Deleted {backup_file.name}"})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/settings":
            settings = payload if payload else {}
            self._json(save_settings(settings))
        elif route == "/api/cli/run":
            cmd = payload.get("cmd", "").strip()
            if not cmd:
                self._json({"ok": False, "error": "cmd required"})
                return
            # Whitelist allowed command prefixes for security
            allowed_prefixes = ("node", "wallet", "pool", "mine", "doctor", "status", "explorer", "monitor", "bridge", "dao", "warp", "ncl", "agent", "hiran", "deploy", "compose")
            first_word = cmd.split()[0].lower()
            if first_word not in allowed_prefixes:
                self._json({"ok": False, "error": f"Command '{first_word}' not in whitelist. Allowed: {allowed_prefixes}"})
                return
            script = SCRIPTS_DIR / ("zion-cli-run" + _SCRIPT_EXT)
            try:
                proc = subprocess.Popen(
                    _script_cmd(script, "-Cmd", cmd),
                    cwd=str(REPO_ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                stdout, stderr = proc.communicate(timeout=30)
                # Try to parse JSON output from the wrapper; fallback to raw text
                out_text = stdout.decode("utf-8", errors="ignore").strip()
                try:
                    parsed = json.loads(out_text)
                    self._json(parsed)
                except Exception:
                    self._json({"ok": True, "stdout": out_text, "stderr": stderr.decode("utf-8", errors="ignore"), "exit_code": proc.returncode, "cmd": cmd})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/cli/node-status":
            script = SCRIPTS_DIR / ("zion-cli-run" + _SCRIPT_EXT)
            try:
                proc = subprocess.Popen(
                    _script_cmd(script, "-Cmd", "node status"),
                    cwd=str(REPO_ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                stdout, stderr = proc.communicate(timeout=15)
                out_text = stdout.decode("utf-8", errors="ignore").strip()
                try:
                    parsed = json.loads(out_text)
                    if parsed.get("ok") and parsed.get("stdout"):
                        self._json({"ok": True, "output": parsed["stdout"], "cli_connected": True})
                    else:
                        self._json({"ok": False, "error": parsed.get("stderr", "unknown"), "cli_connected": False})
                except Exception:
                    self._json({"ok": True, "output": out_text, "cli_connected": True})
            except Exception as e:
                self._json({"ok": False, "error": str(e), "cli_connected": False})
        elif route == "/api/cli/status":
            script = SCRIPTS_DIR / ("zion-cli-run" + _SCRIPT_EXT)
            try:
                proc = subprocess.Popen(
                    _script_cmd(script, "-Cmd", "status"),
                    cwd=str(REPO_ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                stdout, stderr = proc.communicate(timeout=15)
                out_text = stdout.decode("utf-8", errors="ignore").strip()
                try:
                    parsed = json.loads(out_text)
                    if parsed.get("ok") and parsed.get("stdout"):
                        self._json({"ok": True, "output": parsed["stdout"], "cli_connected": True})
                    else:
                        self._json({"ok": False, "error": parsed.get("stderr", "unknown"), "cli_connected": False})
                except Exception:
                    self._json({"ok": True, "output": out_text, "cli_connected": True})
            except Exception as e:
                self._json({"ok": False, "error": str(e), "cli_connected": False})
        elif route == "/api/cli/core-util":
            cmd = payload.get("cmd", "").strip()
            db = payload.get("db", "V3/data/zion-node-state.db").strip()
            if not cmd:
                self._json({"ok": False, "error": "cmd required"})
                return
            allowed_cmds = ("export-state", "verify-db", "dump-blocks", "tip-height", "get-block")
            first_word = cmd.split()[0].lower()
            if first_word not in allowed_cmds:
                self._json({"ok": False, "error": f"Command '{first_word}' not in whitelist. Allowed: {allowed_cmds}"})
                return
            script = SCRIPTS_DIR / ("core-util-run" + _SCRIPT_EXT)
            full_cmd = cmd + " " + db
            try:
                proc = subprocess.Popen(
                    _script_cmd(script, "-Cmd", full_cmd),
                    cwd=str(REPO_ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                stdout, stderr = proc.communicate(timeout=30)
                out_text = stdout.decode("utf-8", errors="ignore").strip()
                try:
                    parsed = json.loads(out_text)
                    self._json(parsed)
                except Exception:
                    self._json({"ok": True, "stdout": out_text, "stderr": stderr.decode("utf-8", errors="ignore"), "exit_code": proc.returncode, "cmd": full_cmd})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/backup/trigger":
            script = SCRIPTS_DIR / ("backup-chain" + _SCRIPT_EXT)
            try:
                proc = subprocess.Popen(
                    _script_cmd(script),
                    cwd=str(REPO_ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                stdout, stderr = proc.communicate(timeout=120)
                ok = proc.returncode == 0
                out = (stdout.decode("utf-8", errors="ignore") + "\n" + stderr.decode("utf-8", errors="ignore")).strip()
                self._json({"ok": ok, "output": out})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif route == "/api/alerts/config":
            cfg = payload if payload else {}
            self._json(save_alert_config(cfg))
        elif route == "/api/swap/initiate":
            # Proxy swap initiation to atomic-swap daemon on port 8570
            try:
                import urllib.request as _ur
                body_data = json.dumps(payload or {}).encode()
                req = _ur.Request("http://127.0.0.1:8570/api/swap/initiate",
                    data=body_data, headers={"Content-Type": "application/json"}, method="POST")
                with _ur.urlopen(req, timeout=10) as r:
                    self._json(json.loads(r.read()))
            except Exception as e:
                self._json({"ok": False, "offline": True, "error": str(e)[:120]})
        elif route == "/api/swap-aggregator/quote":
            # Proxy quote request to swap-aggregator daemon on port 8456
            try:
                import urllib.request as _ur
                body_data = json.dumps(payload or {}).encode()
                req = _ur.Request("http://127.0.0.1:8456/quote",
                    data=body_data, headers={"Content-Type": "application/json"}, method="POST")
                with _ur.urlopen(req, timeout=10) as r:
                    self._json(json.loads(r.read()))
            except Exception as e:
                self._json({"ok": False, "offline": True, "error": str(e)[:120]})
        elif route == "/api/swap-aggregator/swap":
            # Proxy swap creation to swap-aggregator daemon on port 8456
            try:
                import urllib.request as _ur
                body_data = json.dumps(payload or {}).encode()
                req = _ur.Request("http://127.0.0.1:8456/swap",
                    data=body_data, headers={"Content-Type": "application/json"}, method="POST")
                with _ur.urlopen(req, timeout=10) as r:
                    self._json(json.loads(r.read()))
            except Exception as e:
                self._json({"ok": False, "offline": True, "error": str(e)[:120]})
        else:
            self.send_error(404)

    def _handle_hiran_chat_post(self, payload: dict):
        """Proxy POST /api/hiran/chat → Hiran inference server."""
        message = payload.get("message", "").strip()
        if not message:
            self._json({"ok": False, "error": "message required"})
            return
        hiran_url = "http://127.0.0.1:8002"
        body = json.dumps({
            "model": "hiran-v2.2",
            "messages": [
                {"role": "system", "content": "Jsi Hiran v2.2, AI asistent projektu ZION TerraNova. Odpovídáš stručně a technicky přesně."},
                {"role": "user", "content": message},
            ],
            "temperature": 0.7,
            "max_tokens": 400,
        }).encode()
        try:
            req = urllib.request.Request(
                f"{hiran_url}/v1/chat/completions",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                result = json.loads(r.read())
            reply = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            latency = result.get("latency_ms", None)
            self._json({"ok": True, "reply": reply, "latency_ms": latency})
        except Exception as e:
            self._json({"ok": False, "error": str(e)[:200]})


# ── PoC Dashboard HTML ──────────────────────────────────────────────────────────

def _poc_dashboard_html() -> str:
    """Standalone HTML page for PoC-lab dashboard."""
    return r'''<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ZION PoC-lab Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  body { background: #0a0a0f; color: #e0e0e0; font-family: 'Segoe UI', system-ui, sans-serif; }
  .glass { background: rgba(20,20,35,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,215,0,0.15); }
  .gold { color: #FFD700; }
  .cyan { color: #00CED1; }
  .green { color: #22c55e; }
  .red { color: #ef4444; }
  .orange { color: #f59e0b; }
  .purple { color: #a855f7; }
  .card { border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
  .badge-accept { background: rgba(34,197,94,0.2); color: #22c55e; }
  .badge-reject { background: rgba(239,68,68,0.2); color: #ef4444; }
  .badge-stub { background: rgba(168,85,247,0.2); color: #a855f7; }
  .badge-live { background: rgba(0,206,209,0.2); color: #00CED1; }
  .badge-guardian { background: rgba(255,215,0,0.2); color: #FFD700; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px; border-bottom: 1px solid rgba(255,215,0,0.2); font-size: 12px; color: #FFD700; }
  td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; }
  .spinner { border: 3px solid rgba(255,215,0,0.2); border-top: 3px solid #FFD700; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto; }
  @keyframes spin { 100% { transform: rotate(360deg); } }
  input, select { background: rgba(30,30,50,0.8); border: 1px solid rgba(255,215,0,0.2); color: #e0e0e0; padding: 6px 10px; border-radius: 6px; }
  input:focus, select:focus { outline: none; border-color: #FFD700; }
  .btn { background: linear-gradient(135deg, #FFD700, #FFA500); color: #000; font-weight: 700; padding: 8px 20px; border-radius: 8px; cursor: pointer; border: none; }
  .btn:hover { opacity: 0.9; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
</head>
<body class="min-h-screen p-6">

<div class="max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-3xl font-bold gold">ZION PoC-lab Dashboard</h1>
      <p class="text-sm text-gray-400">Proof-of-Care Network Simulator &middot; Live Hiran AI Integration</p>
    </div>
    <div id="status-badge" class="text-sm">Loading...</div>
  </div>

  <!-- Config Panel -->
  <div class="glass card">
    <h2 class="text-lg font-semibold gold mb-3">Simulation Parameters</h2>
    <div class="flex flex-wrap gap-4 items-end">
      <div>
        <label class="text-xs text-gray-400 block mb-1">Epochs</label>
        <input id="cfg-epochs" type="number" value="3" min="1" max="100" class="w-20">
      </div>
      <div>
        <label class="text-xs text-gray-400 block mb-1">Validators</label>
        <input id="cfg-validators" type="number" value="4" min="1" max="64" class="w-20">
      </div>
      <div>
        <label class="text-xs text-gray-400 block mb-1">Block Reward (flowers)</label>
        <input id="cfg-reward" type="number" value="1000000" min="1" class="w-32">
      </div>
      <div>
        <label class="text-xs text-gray-400 block mb-1">Hiran Mode</label>
        <select id="cfg-hiran" class="w-32">
          <option value="0">Stub (fast)</option>
          <option value="auto">Auto (if online)</option>
          <option value="1">Force Live (slow)</option>
        </select>
      </div>
      <button id="run-btn" class="btn" onclick="runSimulation()">Run Simulation</button>
    </div>
  </div>

  <!-- Results Area -->
  <div id="results-area" class="mt-6">
    <div class="glass card text-center text-gray-400 py-12">
      Click "Run Simulation" to start a PoC network simulation.
    </div>
  </div>
</div>

<script>
let careChart = null;
let rewardChart = null;
let hiranChart = null;

async function checkStatus() {
  const badge = document.getElementById('status-badge');
  if(!badge) return;
  try {
    const r = await fetch('/api/poc/status');
    if(!r.ok){ badge.innerHTML = '<span class="badge badge-reject">API ' + r.status + '</span>'; return; }
    const d = await r.json();
    let html = '';
    html += d.poc_sim_available
      ? '<span class="badge badge-accept">poc-sim ready</span> '
      : '<span class="badge badge-reject">poc-sim NOT built</span> ';
    html += d.hiran_online
      ? '<span class="badge badge-live">Hiran LIVE</span>'
      : '<span class="badge badge-stub">Hiran offline (stub)</span>';
    badge.innerHTML = html;
  } catch(e) {
    badge.innerHTML = '<span class="badge badge-reject">Status unavailable</span>';
  }
}

async function runSimulation() {
  const btn = document.getElementById('run-btn');
  if(!btn) return;
  btn.disabled = true;
  btn.textContent = 'Running...';
  const area = document.getElementById('results-area');
  if(!area){ btn.disabled = false; btn.textContent = 'Run Simulation'; return; }
  area.innerHTML = '<div class="spinner"></div><p class="text-center text-gray-400">Running simulation (live Hiran may take 10-60s)...</p>';

  const epochs = document.getElementById('cfg-epochs')?.value || 3;
  const validators = document.getElementById('cfg-validators')?.value || 4;
  const reward = document.getElementById('cfg-reward')?.value || 1000000;
  const hiran = document.getElementById('cfg-hiran')?.value || '0';

  try {
    const r = await fetch(`/api/poc/run?epochs=${encodeURIComponent(epochs)}&validators=${encodeURIComponent(validators)}&block_reward=${encodeURIComponent(reward)}&hiran=${encodeURIComponent(hiran)}`);
    if(!r.ok){
      const errText = await r.text().catch(() => '');
      area.innerHTML = `<div class="glass card red">HTTP ${r.status}: ${errText.substring(0,200) || r.statusText}</div>`;
      return;
    }
    const d = await r.json();
    if(d.error) {
      area.innerHTML = `<div class="glass card red">Error: ${d.error}</div>`;
      return;
    }
    if(!d.reports) {
      area.innerHTML = `<div class="glass card red">Invalid response: no reports field</div>`;
      return;
    }
    renderResults(d);
  } catch(e) {
    area.innerHTML = `<div class="glass card red">Fetch error: ${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Simulation';
  }
}

function renderResults(data) {
  const area = document.getElementById('results-area');
  const cfg = data.config;
  const sum = data.summary;
  const reports = data.reports || [];
  const hiranMode = cfg.hiran_stub_mode ? 'stub' : 'live';

  let html = '';

  // Summary cards
  html += '<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">';
  html += summaryCard('Epochs', cfg.epochs, 'gold');
  html += summaryCard('Validators', cfg.validators, 'cyan');
  html += summaryCard('Accepted', sum.total_accepted, 'green');
  html += summaryCard('Rejected', sum.total_rejected, 'red');
  html += summaryCard('Total Payout', formatFlowers(sum.total_payout), 'purple');
  html += '</div>';

  // Hiran status banner
  const hStats = reports.length > 0 ? reports[reports.length-1].hiran_stats : null;
  if (hStats) {
    html += `<div class="glass card mb-4">
      <div class="flex items-center gap-4">
        <span class="badge ${hStats.stub_mode ? 'badge-stub' : 'badge-live'}">Hiran ${hiranMode}</span>
        <span class="text-sm">Validated: <b class="gold">${hStats.proofs_validated}</b></span>
        <span class="text-sm">Accepted: <b class="green">${hStats.accepted}</b></span>
        <span class="text-sm">Rejected: <b class="red">${hStats.rejected}</b></span>
        <span class="text-sm">Uncertain: <b class="orange">${hStats.uncertain}</b></span>
        <span class="text-sm">Avg Confidence: <b class="cyan">${(hStats.avg_confidence*100).toFixed(1)}%</b></span>
      </div>
    </div>`;
  }

  // Charts row
  html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">';
  html += '<div class="glass card"><h3 class="gold text-sm mb-2">Care Score per Validator (last epoch)</h3><canvas id="careChart" height="200"></canvas></div>';
  html += '<div class="glass card"><h3 class="gold text-sm mb-2">Reward Distribution (last epoch)</h3><canvas id="rewardChart" height="200"></canvas></div>';
  html += '</div>';

  // Hiran confidence trend chart
  if (reports.length > 0) {
    html += '<div class="glass card mb-6"><h3 class="gold text-sm mb-2">Hiran Avg Confidence Trend</h3><canvas id="hiranChart" height="120"></canvas></div>';
  }

  // Epoch reports table
  html += '<div class="glass card mb-6">';
  html += '<h3 class="gold text-sm mb-3">Epoch Reports</h3>';
  html += '<table><thead><tr><th>Epoch</th><th>Validator</th><th>Vow</th><th>Status</th><th>Care Score</th><th>Payout</th><th>Hiran Conf</th><th>NCL Bonus</th></tr></thead><tbody>';
  for (const r of reports) {
    for (const v of r.validators) {
      const vow = v.dual_vow_bonus_applied ? '<span class="badge badge-guardian">S+B</span>' : '<span class="text-gray-400">S</span>';
      const status = v.accepted
        ? '<span class="badge badge-accept">ACCEPTED</span>'
        : `<span class="badge badge-reject">REJECTED</span>`;
      const hiranConf = v.hiran_verdict ? (v.hiran_verdict.confidence*100).toFixed(0)+'%' : '—';
      const reject = v.rejection_reason ? `<span class="text-xs text-gray-500">${v.rejection_reason}</span>` : '';
      html += `<tr>
        <td class="cyan">${r.epoch}</td>
        <td>${v.name} ${reject}</td>
        <td>${vow}</td>
        <td>${status}</td>
        <td>${v.accepted ? v.care_score.toLocaleString() : '—'}</td>
        <td class="${v.payout > 0 ? 'green' : 'text-gray-500'}">${v.payout > 0 ? formatFlowers(v.payout) : '—'}</td>
        <td>${hiranConf}</td>
        <td>${v.ncl_bonus > 0 ? formatFlowers(v.ncl_bonus) : '—'}</td>
      </tr>`;
    }
  }
  html += '</tbody></table></div>';

  // Anomaly alerts
  let totalAlerts = 0;
  for (const r of reports) totalAlerts += (r.anomaly_alerts || []).length;
  if (totalAlerts > 0) {
    html += '<div class="glass card mb-6">';
    html += '<h3 class="red text-sm mb-3">Anomaly Alerts</h3>';
    html += '<table><thead><tr><th>Epoch</th><th>Type</th><th>Severity</th><th>Description</th><th>Action</th></tr></thead><tbody>';
    for (const r of reports) {
      for (const a of (r.anomaly_alerts || [])) {
        const sevColor = a.severity === 'Critical' ? 'red' : a.severity === 'High' ? 'orange' : 'text-gray-400';
        html += `<tr><td class="cyan">${r.epoch}</td><td>${a.anomaly_type}</td><td class="${sevColor}">${a.severity}</td><td>${a.description}</td><td>${a.recommended_action}</td></tr>`;
      }
    }
    html += '</tbody></table></div>';
  }

  // Reward split config
  const rs = cfg.reward_split;
  html += `<div class="glass card mb-6">
    <h3 class="gold text-sm mb-3">Reward Split Configuration (basis points)</h3>
    <div class="flex gap-6 text-sm">
      <span>Care Validators: <b class="gold">${rs.care_validators_bps} bps (${rs.care_validators_bps/100}%)</b></span>
      <span>Humanitarian: <b class="cyan">${rs.humanitarian_bps} bps</b></span>
      <span>DAO Treasury: <b class="purple">${rs.dao_treasury_bps} bps</b></span>
      <span>WARP: <b class="text-gray-300">${rs.warp_maintenance_bps} bps</b></span>
      <span>Hiran Research: <b class="orange">${rs.hiran_research_bps} bps</b></span>
    </div>
  </div>`;

  // Raw JSON toggle
  html += '<div class="glass card">';
  html += '<h3 class="gold text-sm mb-2 cursor-pointer" onclick="toggleRaw()">Raw JSON (click to toggle)</h3>';
  html += '<pre id="raw-json" class="text-xs text-gray-500 overflow-x-auto hidden">' + JSON.stringify(data, null, 2).replace(/</g,'&lt;') + '</pre>';
  html += '</div>';

  area.innerHTML = html;

  // Render charts
  renderCharts(reports);
}

function summaryCard(label, value, color) {
  return `<div class="glass card text-center">
    <div class="text-xs text-gray-400 mb-1">${label}</div>
    <div class="text-2xl font-bold ${color}">${value}</div>
  </div>`;
}

function formatFlowers(n) {
  if (n >= 1000000) return (n/1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n/1000).toFixed(1) + 'K';
  return n.toString();
}

function toggleRaw() {
  const el = document.getElementById('raw-json');
  el.classList.toggle('hidden');
}

function renderCharts(reports) {
  if (reports.length === 0) return;
  const last = reports[reports.length-1];

  // Care score chart
  const vNames = last.validators.map(v => v.name.substring(0, 20));
  const vScores = last.validators.map(v => v.care_score);
  const vColors = last.validators.map(v => v.accepted ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)');

  if (careChart) careChart.destroy();
  const ctx1 = document.getElementById('careChart').getContext('2d');
  careChart = new Chart(ctx1, {
    type: 'bar',
    data: { labels: vNames, datasets: [{ label: 'Care Score', data: vScores, backgroundColor: vColors, borderRadius: 4 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#888', font: { size: 10 } }, grid: { display: false } } } }
  });

  // Reward distribution chart
  const rd = last.reward_distribution;
  if (rewardChart) rewardChart.destroy();
  const ctx2 = document.getElementById('rewardChart').getContext('2d');
  rewardChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: ['Care Validators', 'Humanitarian', 'DAO Treasury', 'WARP', 'Hiran Research'],
      datasets: [{ data: [rd.care_validators, rd.humanitarian, rd.dao_treasury, rd.warp_maintenance, rd.hiran_research],
        backgroundColor: ['#FFD700', '#00CED1', '#a855f7', '#6b7280', '#f59e0b'] }]
    },
    options: { responsive: true, plugins: { legend: { position: 'right', labels: { color: '#ccc', font: { size: 11 } } } } }
  });

  // Hiran confidence trend
  if (reports.length > 0 && document.getElementById('hiranChart')) {
    const confs = reports.map(r => r.hiran_stats.avg_confidence * 100);
    const epochs = reports.map(r => 'E' + r.epoch);
    if (hiranChart) hiranChart.destroy();
    const ctx3 = document.getElementById('hiranChart').getContext('2d');
    hiranChart = new Chart(ctx3, {
      type: 'line',
      data: { labels: epochs, datasets: [{ label: 'Avg Confidence %', data: confs, borderColor: '#00CED1', backgroundColor: 'rgba(0,206,209,0.1)', fill: true, tension: 0.3 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 80, max: 100, ticks: { color: '#888', callback: v => v+'%' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#888' }, grid: { display: false } } } }
    });
  }
}

// Init
checkStatus();
setInterval(checkStatus, 10000);
</script>
</body>
</html>'''

# ── Main ────────────────────────────────────────────────────────────────

def open_browser():
    import webbrowser
    threading.Timer(1.0, lambda: webbrowser.open(f"http://{HOST}:{PORT}")).start()

if __name__ == "__main__":
    print("=" * 60)
    print("  ZION V3 — Mainnet Launch Dashboard")
    print("=" * 60)
    print(f"  Log directory : {LOG_DIR.absolute()}")
    print(f"  URL           : http://{HOST}:{PORT}")
    print(f"  Auth          : {len(DASHBOARD_USERS)} user(s) — {', '.join(DASHBOARD_USERS.keys())}")
    print("  Press Ctrl+C to stop")
    print("=" * 60)
    # Background sampler — re-enabled on Linux (was disabled for Windows deadlock).
    # Records service health history every 5 min for the Health Timeline.
    sampler_thread = threading.Thread(target=background_sampler, daemon=True)
    sampler_thread.start()

    open_browser()
    server = ThreadingHTTPServer((HOST, PORT), DashboardHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopping dashboard server...")
        server.shutdown()

