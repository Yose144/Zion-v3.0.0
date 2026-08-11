#!/usr/bin/env python3
"""
ZION V3 — Mainnet Launch Dashboard Server
Zero-dependency: uses only Python stdlib. Serves a live HTML dashboard
and parses local log files via a JSON API.
"""

import base64
import gzip
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
import urllib.request
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import v31
import marketplace

# ── TTL cache helper for expensive RPC/log scrapers ─────────────────────

def _ttl_cache_fn(ttl_seconds: float):
    def decorator(fn):
        _cache = {}
        _lock = threading.Lock()
        def wrapper(*args, **kwargs):
            key = (fn.__name__, args, tuple(sorted(kwargs.items())))
            now = time.time()
            with _lock:
                if key in _cache:
                    value, expires = _cache[key]
                    if now < expires:
                        return value
            result = fn(*args, **kwargs)
            with _lock:
                _cache[key] = (result, now + ttl_seconds)
            return result
        return wrapper
    return decorator

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

# Cache for deriving V31 banner shares/sec from the Edge pool total-shares counter
_V31_BANNER_POOL_TOTALS = {"ts": 0.0, "shares": 0.0}

def _v31_pool_api_port() -> int:
    """Return the V31 pool HTTP API/metrics port.

    The pool binary exposes Prometheus metrics and /stats on its --api-bind
    address, which defaults to 0.0.0.0:8080.  Prefer ZION_POOL_API_BIND or
    ZION_POOL_API_PORT env, fall back to 8080.
    """
    bind = os.environ.get("ZION_POOL_API_BIND", "")
    if bind and ":" in bind:
        try:
            return int(bind.split(":")[-1])
        except Exception:
            pass
    p = os.environ.get("ZION_POOL_API_PORT")
    if p is not None:
        return int(p)
    return 8080

V31_POOL_API_PORT = _v31_pool_api_port()

# Unified service → log file mapping used by all log endpoints
SERVICE_LOG_MAP = {
    # Blockchain nodes — V31 (journalctl-backed, see V31_JOURNAL_MAP)
    "v31-node":        "v31-node.log",         # V31 Node 1 (Primary)
    "v31-node2":       "v31-node2.log",        # V31 Node 2 (Follower)
    "v31-node3":       "v31-node3.log",        # V31 Node 3 (Follower)
    # Legacy node aliases (fallback to log files)
    "node1":           "node1.log",            # legacy alias
    "edge-node1":      "node1.log",            # Edge Node 1 (primary) — log forwarded via SSH tunnel
    "node2":           "node2.log",            # legacy alias
    "edge-node2":      "node2.log",            # Edge Node 2 (follower)
    "local-backup":    "node-backup.log",      # Local backup node
    "node-backup":     "node-backup.log",      # alias
    # L1 services — V31 (journalctl-backed)
    "v31-pool":        "v31-pool.log",         # V31 Pool
    "v31-miner":       "v31-miner.log",        # V31 Miner
    # L1 services — legacy
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
    # L3 — Multichain (bridge/warp/swap unified)
    "multichain":      "warp.log",             # V31 multichain (journalctl-backed)
    "warp":            "warp.log",             # alias
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

# V31 systemd services — log stream uses journalctl instead of log files
V31_JOURNAL_MAP = {
    "v31-node":      "zion-v31-node.service",
    "v31-node2":     "zion-v31-node2.service",
    "v31-node3":     "zion-v31-node3.service",
    "v31-pool":      "zion-v31-pool.service",
    "v31-miner":     "zion-v31-miner.service",
    "multichain":    "zion-v31-multichain.service",
    "dao-daemon":    "zion-v31-dao.service",
    "oasis":         "zion-v31-oasis.service",
    "dashboard":     "zion-edge-python-dashboard.service",
    "marketplace":   "zion-marketplace.service",
    "website":       "zion-website.service",
}

# ── ANSI escape strip ─────────────────────────────────────────────────────
_ANSI_RE = re.compile(r'\x1b\[[0-9;]*[mKABCDEFGHJSTfhilmnprsuABCD]')
def strip_ansi(s: str) -> str:
    return _ANSI_RE.sub('', s) if s else s

def _systemctl_show(service: str) -> dict:
    """Get systemd service properties."""
    try:
        r = subprocess.run(
            ["systemctl", "show", service,
             "--property=ActiveState,SubState,UnitFileState,MainPID,MemoryCurrent"],
            capture_output=True, text=True, timeout=5
        )
        props = {}
        for line in r.stdout.strip().split("\n"):
            if "=" in line:
                k, v = line.split("=", 1)
                props[k] = v
        return props
    except Exception:
        return {}

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

# Canonical Edge systemd units used by servers-setup, processes, and health maps.
# V31-first after cutover; V3 services are masked/archived and not started.
EDGE_SERVICE_ORDER = [
    "zion-v31-node", "zion-v31-pool", "zion-v31-miner", "zion-v31-multichain",
    "zion-v31-watchdog", "zion-v31-dao", "zion-v31-oasis",
    "zion-edge-python-dashboard",
    "prometheus", "grafana-server",
    "zion-website", "zion-marketplace",
    "zion-edge-backup", "zion-edge-maintenance",
    "zion-edge-node1", "zion-edge-node2", "zion-edge-pool",
    "zion-edge-bridge", "zion-edge-dao", "zion-edge-atomic-swap",
    "zion-edge-warp", "zion-edge-oasis", "zion-edge-dex",
    "zion-edge-dashboard", "nginx",
]

# Map logical dashboard service names to actual systemd units.
# zion-v31-watchdog is a timer; its .service is oneshot and only active briefly.
_EDGE_SYSTEMD_UNITS = {
    "zion-v31-watchdog": "zion-v31-watchdog.timer",
}

# ── Basic Auth (HTTP 401) — multi-user ───────────────────────────────────
# Supports multiple user accounts. Credentials are stored as SHA-256 hashes
# for security. Plaintext passwords are NEVER stored on disk.
#
# Users are configured via the DASHBOARD_USERS env var (comma-separated
# "user:sha256hex" pairs) or fall back to compiled defaults below.
#
# SECURITY NOTE: The compiled defaults are convenient for local-dev dashboards
# (127.0.0.1). For the Edge/production dashboard exposed to the internet,
# ALWAYS override via DASHBOARD_USERS env var with strong unique credentials.
#
# To generate a hash: python3 -c "import hashlib; print(hashlib.sha256(b'password').hexdigest())"
import hashlib as _hashlib

def _sha256(s: str) -> str:
    return _hashlib.sha256(s.encode("utf-8")).hexdigest()

# Default users — used when DASHBOARD_USERS env var is not set.
# Override via DASHBOARD_USERS env var for production deployments.
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
AUTH_EXEMPT_ROUTES = {"/api/health", "/health", "/favicon.ico", "/v31/favicon.ico", "/v31/symbol-200x200.png", "/api/poc/html", "/api/poc/status", "/api/pool/miners-dashboard", "/stats"}

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
        # even if 127.0.0.1:9443 is reachable (could be SSH tunnel)
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
    # v3.0.7: Use repo symlink "ssh-key-zion-edge" -> ~/.ssh/zion-edge-post-wipe-2026-07-29, or SSH alias "zion-new"
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

# ── ZION block economics (from V3/L1/core/src/emission.rs) ───────────
ZION_BLOCK_REWARD = 5400.067           # BASE_REWARD = 5_400_067_000 flowers
TARGET_BLOCK_TIME_SECS = 60            # BLOCK_TIME_SECONDS = 60s → 1440 blocks/day max
MAX_BLOCKS_PER_DAY = 86400 // TARGET_BLOCK_TIME_SECS  # 1440

# ── Hashrate fallback helpers ─────────────────────────────────────────────
# The V31 pool does not receive attempted_hashes/elapsed_ms from V3 Trinity
# miners, so its built-in hashrate telemetry stays at 0.  We estimate hashrate
# from the number of full blocks found by the pool and the current network
# difficulty: hashes = blocks * difficulty, rate = hashes / pool_uptime.

@_ttl_cache_fn(15.0)
def _v31_chain_info() -> dict:
    """Fetch live V31 chain info from the local node (cached 15 s)."""
    try:
        req = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "getChainInfo", "params": []}) + "\n"
        with socket.create_connection((EDGE_RPC_HOST, 9445), timeout=2.0) as s:
            s.sendall(req.encode())
            resp = b""
            while True:
                chunk = s.recv(8192)
                if not chunk:
                    break
                resp += chunk
                if b"\n" in chunk:
                    break
        r = json.loads(resp.decode("utf-8", errors="replace").strip())
        if "error" in r and r["error"]:
            return {}
        res = r.get("result") or {}
        return {
            "chain_height": res.get("native_chain_height") or res.get("chain_height"),
            "difficulty": res.get("difficulty"),
            "accepted_blocks": res.get("accepted_blocks"),
            "tip_hash": res.get("tip_hash"),
        }
    except Exception:
        return {}


def _estimate_hashrate_from_pool_metrics(metrics_body: str, network_difficulty: float = None) -> dict:
    """Estimate pool and per-worker hashrate from pool Prometheus metrics.

    Returns a dict with:
      - "pool_hps": aggregate pool hashrate in hashes/second
      - "workers_hps": { worker_label: hps }
      - "avg_share_diff": inferred average share difficulty
      - "pool_khs": aggregate pool hashrate in kH/s
    """
    result = {"pool_hps": 0.0, "workers_hps": {}, "avg_share_diff": 0.0, "pool_khs": 0.0}
    if network_difficulty is None:
        cinfo = _v31_chain_info()
        network_difficulty = cinfo.get("difficulty")
    if not network_difficulty:
        return result

    uptime_s = 0.0
    blocks_found = 0
    shares_accepted = 0
    workers: dict = {}
    for line in metrics_body.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("zion_pool_uptime_s "):
            uptime_s = float(line.split()[-1])
        elif line.startswith("zion_pool_blocks_found_total "):
            blocks_found = int(float(line.split()[-1]))
        elif line.startswith("zion_pool_shares_accepted "):
            shares_accepted = int(float(line.split()[-1]))
        elif line.startswith("zion_pool_worker_valid_shares{worker="):
            m = re.search(r'worker="([^"]+)"\}\s+([\d.]+)', line)
            if m:
                workers[m.group(1)] = int(float(m.group(2)))

    if not (uptime_s > 0 and blocks_found > 0 and network_difficulty > 0):
        return result

    # Pool hashrate = (blocks_found * network_difficulty) / uptime
    # Each full block represents ~network_difficulty hashes on average.
    pool_hps = (blocks_found * float(network_difficulty)) / uptime_s
    result["pool_hps"] = pool_hps
    result["pool_khs"] = pool_hps / 1000.0

    # Infer average share difficulty from pool hashrate and accepted shares.
    avg_share_diff = 0.0
    if shares_accepted > 0:
        avg_share_diff = (pool_hps * uptime_s) / shares_accepted
    result["avg_share_diff"] = avg_share_diff

    if avg_share_diff > 0:
        for worker, valid in workers.items():
            result["workers_hps"][worker] = (valid * avg_share_diff) / uptime_s

    return result


# V31 Mainnet (2026-08-06 genesis reset) canonical public addresses.
# Source: V31/L1/core/src/v3_compat.rs, V31/deploy/config/edge-environment.sh
V31_CANONICAL_POOL_PAYOUT_WALLET = "zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6"
V31_CANONICAL_DEFAULT_MINER_WALLET = "zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2"
V31_CANONICAL_HUMANITARIAN_WALLET  = "zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8"
V31_CANONICAL_ISSOBELLA_WALLET     = "zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0"
V31_CANONICAL_POOL_FEE_WALLET      = "zion1l0h428f536s6u3x7h5f0d5c2z644j7t8u8va3x0"

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
RESOURCE_CPU_PREV = {"total": None, "idle": None}

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
            # Linux: /proc/meminfo + /proc/stat (CPU) + statvfs
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
            # CPU usage via /proc/stat delta (global aggregate, all cores)
            try:
                with open("/proc/stat") as f:
                    line1 = f.readline()
                fields1 = list(map(int, line1.split()[1:]))
                idle1 = fields1[3] + (fields1[4] if len(fields1) > 4 else 0)
                total1 = sum(fields1)
                with RESOURCE_LOCK:
                    prev = RESOURCE_CPU_PREV.get("total"), RESOURCE_CPU_PREV.get("idle")
                if prev[0] is not None and total1 > prev[0]:
                    dt = total1 - prev[0]
                    di = idle1 - prev[1]
                    result["cpu_percent"] = round(max(0, (dt - di) / dt * 100), 1)
                with RESOURCE_LOCK:
                    RESOURCE_CPU_PREV["total"] = total1
                    RESOURCE_CPU_PREV["idle"] = idle1
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
        svc_names = ["zion-v31-node", "zion-v31-pool", "zion-v31-miner",
                     "zion-v31-multichain", "zion-v31-watchdog", "zion-v31-dao",
                     "zion-v31-oasis", "zion-edge-python-dashboard",
                     "zion-website", "zion-marketplace", "nginx"]
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
    """Scrape built-in pool metrics endpoint (Prometheus format on :{V31_POOL_API_PORT}). Cached 15 s."""
    now = time.time()
    with MONITORING_LOCK:
        if now - MONITORING_CACHE["ts"] < 15:
            return MONITORING_CACHE["data"]

    metrics_host = "127.0.0.1"
    metrics_port = V31_POOL_API_PORT
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
            elif line.startswith("zion_pool_pplns_registered_miners "):
                if miners_tracked == 0:
                    miners_tracked = int(float(line.split()[-1]))
                    result["prometheus"]["targets_total"] = miners_tracked
            elif line.startswith("zion_pool_shares_accepted "):
                accepted = int(float(line.split()[-1]))
                if shares == 0:
                    shares = accepted
            elif line.startswith("zion_pool_accepted_total "):
                if accepted == 0:
                    accepted = int(float(line.split()[-1]))
                shares += accepted
            elif line.startswith("zion_pool_shares_rejected "):
                rejected = int(float(line.split()[-1]))
                shares += rejected
            elif line.startswith("zion_pool_rejected_total "):
                if rejected == 0:
                    rejected = int(float(line.split()[-1]))
                shares += rejected
            elif line.startswith("zion_pool_hashrate_hps "):
                hashrate_hps = float(line.split()[-1])
            elif line.startswith("zion_pool_hashrate_khs "):
                hashrate_hps = float(line.split()[-1]) * 1000.0
            elif line.startswith("zion_pool_hashrate_1h_hps "):
                # ignore; we use live
                pass
            elif line.startswith("zion_pool_blocks_found ") or line.startswith("zion_pool_blocks_found_total "):
                blocks_found = int(float(line.split()[-1]))
            elif line.startswith("zion_pool_submits_total "):
                submits = int(float(line.split()[-1]))
        # V31 may report 0 active sessions while shares are flowing; use tracked as proxy.
        if active_sessions == 0 and (accepted or shares) and (miners_tracked or 0) > 0:
            active_sessions = miners_tracked
            result["prometheus"]["targets_up"] = active_sessions
        if submits == 0 and (accepted or rejected):
            submits = accepted + rejected
        # Fallback hashrate estimate for miners that don't report work samples.
        if hashrate_hps <= 0 and body:
            try:
                hr_est = _estimate_hashrate_from_pool_metrics(body)
                if hr_est.get("pool_hps", 0.0) > 0:
                    hashrate_hps = hr_est["pool_hps"]
            except Exception:
                pass
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
     "ports": {"p2p": 8333, "rpc": 9443, "metrics": 9100},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "rpc", "severity": "critical", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:9443/health",
     "purpose": "Primary / Genesis node — P2P 8333, RPC 9443, metrics 9100. Fresh genesis v3.0.4.",
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
    {"id": "v31-node", "name": "V31 Node (PROD)", "icon": "🚀", "level": "L1", "kind": "node",
     "ports": {"p2p": 8335, "rpc": 9445},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "critical", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:9445",
     "purpose": "V31 Mainnet Alpha 3.1.0-beta (protocol 3.1.0-alpha) — PROD node. P2P 8335, RPC 9445. Independent of V3. systemd zion-v31-node.service.",
     "child_says": "🚀 V31 PROD node — mainnet alpha!",
     "depends_on": []},
    {"id": "v31-pool", "name": "V31 Pool (PROD)", "icon": "🌐", "level": "L1", "kind": "pool",
     "ports": {"stratum": 8444},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "critical", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8444",
     "purpose": "V31 PROD pool — stratum 8444, validates shares, → Node RPC 9445. systemd zion-v31-pool.service.",
     "child_says": "🌐 V31 PROD pool — miners connect here!",
     "depends_on": ["v31-node"]},
    {"id": "v31-miner", "name": "V31 Miner (PROD)", "icon": "⛏️", "level": "L1", "kind": "miner",
     "ports": {},
     "log": None, "start": None, "stop": None,
     "health_method": "systemd", "severity": "warning", "autoheal": False,
     "health_endpoint": None,
     "purpose": "V31 PROD CPU miner — 2 threads, ~500-950 kH/s. → Pool 127.0.0.1:8444. systemd zion-v31-miner.service.",
     "child_says": "⛏️ V31 PROD miner — digs for ZION!",
     "depends_on": ["v31-pool"]},
    {"id": "v31-multichain", "name": "V31 Multichain (PROD)", "icon": "🌀", "level": "L2", "kind": "multichain",
     "ports": {"api": 8453},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8453/health",
     "purpose": "V31 PROD multichain — bridge/warp/swap unified. API 8453 → Node RPC 9445. systemd zion-v31-multichain.service.",
     "child_says": "🌀 V31 PROD multichain — cross-chain hub!",
     "depends_on": ["v31-node"]},
    {"id": "v31-dao", "name": "V31 DAO (PROD)", "icon": "🗳️", "level": "L2", "kind": "dao",
     "ports": {"api": 8456},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "http", "severity": "warning", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8456/api/dao/health",
     "purpose": "V31 PROD DAO — governance, proposals, treasury. API 8456. systemd zion-v31-dao.service.",
     "child_says": "🗳️ V31 PROD DAO — vote on the future of ZION!",
     "depends_on": ["v31-node"]},
    {"id": "v31-oasis", "name": "V31 OASIS Game (PROD)", "icon": "🪷", "level": "L4", "kind": "app",
     "ports": {"api": 8094, "metrics": 9102},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "http", "severity": "info", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8094/health",
     "purpose": "V31 OASIS L4 game API — avatars, quests, guilds, territories. Port 8094. systemd zion-v31-oasis.service.",
     "child_says": "🪷 V31 OASIS — the avatar consciousness game!",
     "depends_on": ["v31-node"]},
    {"id": "pool-edge", "name": "V3 Pool (DISABLED)", "icon": "⛔", "level": "L1", "kind": "pool",
     "ports": {"stratum": 8444},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:8444",
     "purpose": "V3 pool — DISABLED, replaced by V31 Pool. Kept for reference.",
     "child_says": "⛔ V3 pool — disabled, use V31 Pool!",
     "depends_on": ["edge-node1"]},
    {"id": "miner", "name": "V3 Miner (ARCHIVED)", "icon": "📦", "level": "L1", "kind": "miner",
     "ports": {},
     "log": "miner.log", "start": None, "stop": None,
     "health_method": "log", "severity": "info", "autoheal": False,
     "health_endpoint": None,
     "purpose": "V3 GPU/CPU miner — ARCHIVED, replaced by V31 Miner. Kept for reference.",
     "child_says": "📦 V3 miner — archived, use V31 Miner!",
     "depends_on": ["pool-edge"]},

    # ── L2: Bridge & DAO (running on new server) ────────────────────────
    {"id": "bridge", "name": "ZION Bridge", "icon": "🌉", "level": "L2", "kind": "bridge",
     "ports": {"api": 8453},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "Cross-chain relay: moves ZION between L1 and EVM chains (6 chains). Metrics on 9101.",
     "child_says": "🌉 A magical bridge to send ZION to other crypto worlds!",
     "depends_on": ["edge-node1"]},
    {"id": "dao", "name": "ZION DAO", "icon": "🗳️", "level": "L2", "kind": "dao",
     "ports": {"api": 8456},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "Decentralized governance: proposals, voting, treasury management. API on 8456.",
     "child_says": "🗳️ Everyone votes here to decide what ZION should do next!",
     "depends_on": ["edge-node1"]},
    {"id": "atomic-swap", "name": "Atomic Swap", "icon": "🔄", "level": "L2", "kind": "swap",
     "ports": {"api": 8453},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "Trustless cross-chain atomic swaps via HTLC. API on 8453 (V31 multichain).",
     "child_says": "🔄 Swap ZION for other coins without a middleman!",
     "depends_on": ["edge-node1"]},
    {"id": "dex", "name": "ZionDex Router", "icon": "💱", "level": "L2", "kind": "dex",
     "ports": {"api": 8454},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "Cross-chain DEX router — 7 chains, AMM aggregation, multi-path quotes. API on 8454.",
     "child_says": "💱 Find the best swap route across all chains!",
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
     "depends_on": ["v31-node"]},
    {"id": "nginx", "name": "Nginx Reverse Proxy", "icon": "🔒", "level": "Infra", "kind": "proxy",
     "ports": {"http": 80, "https": 443},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "critical", "autoheal": False,
     "purpose": "Reverse proxy + SSL termination (Let's Encrypt). Serves zionterranova.com + dashboard.zionterranova.com.",
     "child_says": "🔒 The gatekeeper that protects our websites!",
     "depends_on": []},
    {"id": "web-next", "name": "Next.js Website", "icon": "🌐", "level": "Infra", "kind": "web",
     "ports": {"http": 3000},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "Next.js 16.2.9 website — 73+ routes, Docker container zion-web:nextjs. Port 3000 (host network).",
     "child_says": "🌐 The public face of ZION — our website!",
     "depends_on": ["nginx"]},
    {"id": "marketplace", "name": "OASIS Marketplace", "icon": "🏪", "level": "Infra", "kind": "web",
     "ports": {"http": 3100},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "OASIS Artifact Marketplace (Next.js + ERC-1155). Port 3100 behind nginx.",
     "child_says": "🏪 Buy and sell OASIS artifacts!",
     "depends_on": ["nginx"]},
    {"id": "prometheus", "name": "Prometheus", "icon": "📈", "level": "Infra", "kind": "metrics",
     "ports": {"metrics": 9090},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Metrics scraper — V31 pool, node exporter, system targets. Port 9090.",
     "child_says": "📈 Scrapes metrics for dashboards!",
     "depends_on": []},
    {"id": "grafana", "name": "Grafana", "icon": "📊", "level": "Infra", "kind": "metrics",
     "ports": {"web": 3001},
     "host": "127.0.0.1",
     "log": None, "start": None, "stop": None,
     "health_method": "tcp", "severity": "info", "autoheal": False,
     "purpose": "Grafana dashboards — V31 Mainnet Alpha embedded in /dashboard. Port 3001.",
     "child_says": "📊 Beautiful charts for the full dashboard!",
     "depends_on": ["prometheus"]},
]

SERVICE_REGISTRY_LOCAL_DEV = [
    # ── L1: Consensus (Local-dev topology) ───────────────────────────────
    {"id": "node1", "name": "Node 1 (Genesis)", "icon": "🔷", "level": "L1", "kind": "node",
     "ports": {"p2p": 8333, "rpc": 9443, "metrics": 9115},
     "log": "node1.log", "start": "start-node1", "stop": None,
     "health_method": "rpc", "severity": "critical", "autoheal": False,
     "health_endpoint": "http://127.0.0.1:9443/health",
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
     "ports": {"api": 8456},
     "log": "dao.log", "start": "start-dao", "stop": "stop-dao",
     "health_method": "tcp", "severity": "warning", "autoheal": False,
     "purpose": "Decentralized governance: proposals, voting, treasury management. API on 8456.",
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
    # Prometheus/Grafana removed — replaced by built-in pool metrics on :{V31_POOL_API_PORT}
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

# ── V31 primary / V3 archived markers ───────────────────────────────────
PRIMARY_SERVICES = {"v31-node", "v31-pool", "v31-miner", "v31-multichain", "v31-dao", "v31-oasis"}
ARCHIVED_SERVICES = {
    "edge-node1", "edge-node2", "pool-edge", "miner",
    "bridge", "dao", "atomic-swap", "dex", "warp",
    "oasis", "free-world", "issobella",
    "node1", "node2", "swap-aggregator", "ncl",
    "hiranyagarbha", "ai-native", "node-exporter",
}


def _enrich_service_registry(registry: list) -> list:
    """Tag services as primary / archived in the active registry."""
    for svc in registry:
        svc["primary"] = svc["id"] in PRIMARY_SERVICES
        svc["archived"] = svc["id"] in ARCHIVED_SERVICES
    return registry


SERVICE_REGISTRY = _enrich_service_registry(SERVICE_REGISTRY)

LEVEL_ORDER = {"L1": 0, "L2": 1, "L3": 2, "L4": 3, "L5": 4, "L6": 5, "Infra": 9}


def get_service(sid: str) -> dict:
    return next((s for s in SERVICE_REGISTRY if s["id"] == sid), None)

# ── Health checks ───────────────────────────────────────────────────────

import urllib.request as _urlreq

# Install a global opener so urllib does not rebuild one per urlopen call
# (rebuilding creates HTTPSHandler/SSLContext repeatedly, which adds ~40ms).
_URLLIB_OPENER = _urlreq.build_opener()
_urlreq.install_opener(_URLLIB_OPENER)

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

    # Miner edge-primary: check Edge pool metrics for active/tracked miners
    if sid == "miner" and TOPOLOGY == "edge-primary" and svc.get("health_endpoint"):
        try:
            import urllib.request as _ur
            with _ur.urlopen(svc["health_endpoint"], timeout=2.0) as _r:
                _txt = _r.read().decode("utf-8")
            _active = 0
            _miners = 0
            for _line in _txt.splitlines():
                if _line.startswith("zion_pool_active_sessions "):
                    _active = int(float(_line.split()[-1]))
                elif _line.startswith("zion_pool_miners_tracked "):
                    _miners = int(float(_line.split()[-1]))
            if _active > 0 or _miners > 0:
                log_alive = True
                log_age = 0
                proc_info = {"has_pid": True, "alive": True, "pid": -1}
                details_parts_preview = f"Edge pool: {_active} active session(s), {_miners} miner(s) tracked"
            else:
                details_parts_preview = f"Edge pool: 0 active sessions ({_miners} tracked)"
        except Exception as _e:
            details_parts_preview = f"Edge pool metrics check failed: {str(_e)[:40]}"
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

    elif method == "systemd":
        # Check systemd service status for V31 services
        systemd_map = {
            "v31-miner": "zion-v31-miner.service",
            "v31-pool": "zion-v31-pool.service",
            "v31-node": "zion-v31-node.service",
            "v31-multichain": "zion-v31-multichain.service",
        }
        svc_name = systemd_map.get(sid)
        if svc_name:
            try:
                r = subprocess.run(["systemctl", "is-active", svc_name],
                                 capture_output=True, text=True, timeout=2)
                active = r.stdout.strip() == "active"
                alive = active
                status = "running" if active else "stopped"
                details_parts.append(f"systemd {svc_name}: {r.stdout.strip()}")
            except Exception as e:
                details_parts.append(f"systemd check failed: {e}")
        else:
            details_parts.append(f"no systemd mapping for {sid}")

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
    """Propagate dependency failures: if a dependency is down, mark dependent as degraded.
    Archived services do not propagate dependency failures (V3 is no longer the source of truth)."""
    h = health_map.get(svc["id"], {})
    if not h.get("alive") or svc.get("archived"):
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


@_ttl_cache_fn(3.0)
def all_services_health() -> list:
    # First pass: raw health (parallel to avoid serial TCP timeouts)
    raw = {}
    ex = ThreadPoolExecutor(max_workers=min(8, len(SERVICE_REGISTRY) or 1))
    try:
        futures = {ex.submit(check_service_health, svc): svc["id"] for svc in SERVICE_REGISTRY}
        for fut in as_completed(futures, timeout=3.0):
            sid = futures[fut]
            try:
                raw[sid] = fut.result()
            except Exception:
                raw[sid] = {"alive": False, "status": "error", "details": "health check failed"}
    finally:
        ex.shutdown(wait=False, cancel_futures=True)
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
            "primary": svc.get("primary", False),
            "archived": svc.get("archived", False),
        })
    # V31 primary first, archived/legacy last, then by layer and kind
    out.sort(key=lambda s: (
        1 if s.get("archived") else 0,
        0 if s.get("primary") else 1,
        LEVEL_ORDER.get(s.get("level"), 99),
        s.get("kind", ""),
        s.get("name", ""),
    ))
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
    # Edge server stores live state under /data/zion (not under the repo tree).
    (Path("/data/zion/state"),               "json",   "node1", "Node 1 state"),
    (Path("/data/zion/state-node2"),           "json",   "node2", "Node 2 state"),
    (Path("/data/zion/pplns-state.json"),      "json",   "pool",  "Pool PPLNS"),
    (Path("/data/zion/bridge-mainnet.db"),     "sqlite", "bridge","Bridge events"),
    (Path("/data/zion/dao-mainnet.db"),        "sqlite", "dao",   "DAO governance"),
    (Path("/data/zion/warp-mainnet.db"),       "sqlite", "warp",  "WARP relay"),
    (Path("/data/zion/atomic-swap.db"),        "sqlite", "atomic-swap", "Atomic Swap"),
    (Path("/data/zion/ziondex-router.db"),     "sqlite", "ncl",   "NCL Gateway"),
    (Path("/data/zion/oasis.db"),              "sqlite", "oasis", "OASIS Avatar Hub"),
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

def get_bridge_db_path() -> Path:
    """Return the live bridge SQLite DB path (Edge or local)."""
    for path, kind, sid, _ in DB_LOCATIONS:
        if sid == "bridge" and kind == "sqlite":
            if path.exists():
                return path
    # Fallback to legacy local path
    return REPO_ROOT / "V3" / "data" / "bridge.db"

def get_dao_db_path() -> Path:
    """Return the live DAO SQLite DB path (Edge or local)."""
    for path, kind, sid, _ in DB_LOCATIONS:
        if sid == "dao" and kind == "sqlite":
            if path.exists():
                return path
    return REPO_ROOT / "V3" / "data" / "dao.db"

def _build_bridge_transfers(db_path: Path, limit: int = 50) -> list:
    """Read L1 locks and EVM burns from the bridge DB and normalize for the UI."""
    if not db_path.exists():
        return []
    transfers = []
    try:
        con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        con.row_factory = sqlite3.Row
        cur = con.cursor()

        # L1 -> EVM (locks / mints)
        if "l1_locks" in [t[0] for t in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
            cur.execute("""
                SELECT l1_tx_hash, l1_block_height, l1_sender, amount_flowers, target_chain, evm_recipient,
                       status, detected_at, completed_at, evm_tx_hash
                FROM l1_locks
                ORDER BY detected_at DESC
                LIMIT ?
            """, (limit,))
            for row in cur.fetchall():
                amount_zion = int(row["amount_flowers"] or 0) / 1_000_000.0
                ts = row["completed_at"] or row["detected_at"] or "—"
                tx_hash = row["evm_tx_hash"] or row["l1_tx_hash"] or "—"
                explorer = ""
                if tx_hash.startswith("0x"):
                    explorer = f"https://basescan.org/tx/{tx_hash}"
                transfers.append({
                    "tx_hash": tx_hash,
                    "from_chain": "zion",
                    "to_chain": row["target_chain"] or "base",
                    "amount": round(amount_zion, 4),
                    "status": (row["status"] or "unknown").lower(),
                    "timestamp": ts,
                    "block_height": row["l1_block_height"],
                    "explorer_url": explorer,
                })

        # EVM -> L1 (burns / unlocks)
        if "evm_burns" in [t[0] for t in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]:
            cur.execute("""
                SELECT evm_tx_hash, evm_block_number, evm_chain, evm_burner, amount_flowers, l1_recipient,
                       status, detected_at, completed_at, l1_unlock_tx
                FROM evm_burns
                ORDER BY detected_at DESC
                LIMIT ?
            """, (limit,))
            for row in cur.fetchall():
                amount_zion = int(row["amount_flowers"] or 0) / 1_000_000.0
                ts = row["completed_at"] or row["detected_at"] or "—"
                tx_hash = row["evm_tx_hash"] or row["l1_unlock_tx"] or "—"
                explorer = ""
                if tx_hash.startswith("0x"):
                    explorer = f"https://basescan.org/tx/{tx_hash}"
                transfers.append({
                    "tx_hash": tx_hash,
                    "from_chain": row["evm_chain"] or "base",
                    "to_chain": "zion",
                    "amount": round(amount_zion, 4),
                    "status": (row["status"] or "unknown").lower(),
                    "timestamp": ts,
                    "block_height": row["evm_block_number"],
                    "explorer_url": explorer,
                })

        con.close()
    except Exception:
        pass
    # Sort all transfers by timestamp, newest first, then trim
    transfers.sort(key=lambda x: x["timestamp"] if x["timestamp"] and x["timestamp"] != "—" else "", reverse=True)
    return transfers[:limit]

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
        con = None
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
            return {"kind": "sqlite", "name": friendly, "path": str(path), "tables": tables_info}
        except Exception as e:
            return {"error": f"SQLite error: {e}", "kind": "sqlite"}
        finally:
            if con is not None:
                con.close()

    return {"error": f"Unknown kind: {kind}"}

# ── Log parsers ─────────────────────────────────────────────────────────

def tail_log(filename: str, n: int = 100) -> list[str]:
    path = Path(filename) if Path(filename).is_absolute() else LOG_DIR / filename
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return [ln.rstrip("\n") for ln in deque(f, maxlen=n)]

def head_log(filename: str, n: int = 50) -> list[str]:
    path = Path(filename) if Path(filename).is_absolute() else LOG_DIR / filename
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
    Accepts name with or without .log suffix.
    Searches LOG_DIR first, then REPO_ROOT and SCRIPT_DIR/logs for legacy/deploy layouts."""
    base = name.removesuffix(".log")
    candidates = []
    search_dirs = [LOG_DIR]
    if REPO_ROOT.resolve() != LOG_DIR.resolve():
        search_dirs.append(REPO_ROOT)
    script_logs = SCRIPT_DIR / "logs"
    if script_logs.resolve() != LOG_DIR.resolve() and script_logs.resolve() != REPO_ROOT.resolve():
        search_dirs.append(script_logs)
    for d in search_dirs:
        if not d.exists():
            continue
        candidates.extend(d.glob(f"{base}.*.log"))
        candidates.extend(d.glob(f"{base}_*.log"))
        fallback = d / f"{base}.log"
        if fallback.exists():
            candidates.append(fallback)
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]

def parse_node_log(name: str) -> dict:
    log_path = latest_log_path(name)
    recent = tail_log(str(log_path), 200) if log_path else []
    startup = head_log(str(log_path), 50) if log_path else []
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

# Map generic manifest service names to the Edge deployment systemd units.
# A value of None means the service has no Edge unit and should be reported stopped.
ORCHESTRATOR_EDGE_SERVICE_UNITS = {
    "zion-node": "zion-edge-node1",
    "zion-node2": "zion-edge-node2",
    "zion-pool": "zion-edge-pool",
    "zion-miner": None,
    "zion-bridge": "zion-edge-bridge",
    "zion-dao": "zion-edge-dao",
    "zion-atomic-swap": "zion-edge-atomic-swap",
    "zion-warp": "zion-edge-warp",
    "zion-oasis": "zion-edge-oasis",
    "zion-hiranyagarbha": None,
    "zion-hiran-inference": None,
    "zion-cli": None,
    "zion-mining-agent": None,
    "zion-dashboard": "zion-edge-dashboard",
    "zion-dashboard-web": "zion-edge-python-dashboard",
    "zion-desktop-dashboard": None,
    "zion-mobile-app": None,
    "zion-website": None,
    "zion-wallet-sdk": None,
    "zion-prometheus": "prometheus",
    "zion-grafana": "grafana-server",
    "zion-alertmanager": "alertmanager",
    "zion-node-exporter": "prometheus-node-exporter",
    "zion-auto-update": None,
    "zion-watchdog": "zion-edge-watchdog",
}

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

def _orchestrator_systemd_state(unit: str) -> tuple[str | None, int | None]:
    """Return (state, pid) for a systemd unit, or (None, None) if unit not known to systemd."""
    try:
        r = subprocess.run(["systemctl", "is-active", unit + ".service"], capture_output=True, text=True, timeout=5)
        active = r.stdout.strip() == "active"
        pid = None
        if active:
            rp = subprocess.run(["systemctl", "show", "--property=MainPID", unit + ".service"], capture_output=True, text=True, timeout=5)
            try:
                pid = int(rp.stdout.strip().split("=")[-1])
                if pid <= 0:
                    pid = None
            except Exception:
                pass
        return ("running" if active else "stopped", pid)
    except Exception:
        return (None, None)


def get_orchestrator_status() -> dict:
    """Check status of all services defined in manifest.
    On Edge deployments this prefers the real systemd units (zion-edge-*)."""
    manifest = load_orchestrator_manifest()
    services = manifest.get("services", {})
    status = {}
    for name, cfg in services.items():
        binary = cfg.get("binary", "")
        pid = None
        state = "stopped"

        # Edge-first: map manifest name to the deployed systemd unit
        edge_unit = ORCHESTRATOR_EDGE_SERVICE_UNITS.get(name) if TOPOLOGY == "edge-primary" else None
        if edge_unit is not None:
            _state, _pid = _orchestrator_systemd_state(edge_unit)
            if _state is not None:
                state, pid = _state, _pid
        elif TOPOLOGY == "edge-primary":
            # Explicitly mapped to None on Edge means the service is not deployed
            state = "stopped"
        else:
            # Local / fallback: check process table, but avoid false substring matches
            try:
                if binary:
                    # Match the binary path followed by end-of-string or whitespace so
                    # e.g. V3/target/release/zion does not match zion-atomic-swap.
                    pattern = f"{re.escape(binary)}($|[[:space:]])"
                    result = subprocess.run(["pgrep", "-f", pattern], capture_output=True, text=True)
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
    """Start, stop, or restart a service.
    On Edge deployments this uses the mapped systemd units via sudo systemctl."""
    manifest = load_orchestrator_manifest()
    services = manifest.get("services", {})
    if service not in services:
        return {"ok": False, "error": f"Service '{service}' not found in manifest"}
    cfg = services[service]

    edge_unit = ORCHESTRATOR_EDGE_SERVICE_UNITS.get(service) if TOPOLOGY == "edge-primary" else None
    if edge_unit:
        unit = f"{edge_unit}.service"
        if action == "start":
            _state, _pid = _orchestrator_systemd_state(edge_unit)
            if _state == "running":
                return {"ok": True, "message": f"{service} is already running", "pid": _pid, "action": "start"}
            try:
                subprocess.run(["sudo", "-n", "systemctl", "start", unit], capture_output=True, text=True, timeout=30)
                _state, _pid = _orchestrator_systemd_state(edge_unit)
                return {"ok": _state == "running", "message": f"Started {service}", "pid": _pid, "action": "start"}
            except Exception as e:
                return {"ok": False, "error": str(e), "action": "start"}
        elif action == "stop":
            try:
                subprocess.run(["sudo", "-n", "systemctl", "stop", unit], capture_output=True, text=True, timeout=30)
                return {"ok": True, "message": f"Stopped {service}", "action": "stop"}
            except Exception as e:
                return {"ok": False, "error": str(e), "action": "stop"}
        elif action == "restart":
            try:
                subprocess.run(["sudo", "-n", "systemctl", "restart", unit], capture_output=True, text=True, timeout=30)
                _state, _pid = _orchestrator_systemd_state(edge_unit)
                return {"ok": _state == "running", "message": f"Restarted {service}", "pid": _pid, "action": "restart"}
            except Exception as e:
                return {"ok": False, "error": str(e), "action": "restart"}
        return {"ok": False, "error": f"Unknown action: {action}"}

    # Local / fallback: launch/stop by binary path
    binary = cfg.get("binary", "")
    args = cfg.get("args", [])
    env = cfg.get("env", {})
    log_file = cfg.get("log_file", f"logs/{service}.log")
    if action == "start":
        # Check if already running (avoid false substring matches)
        try:
            if binary:
                pattern = f"{re.escape(binary)}($|[[:space:]])"
                result = subprocess.run(["pgrep", "-f", pattern], capture_output=True, text=True)
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
            if binary:
                pattern = f"{re.escape(binary)}($|[[:space:]])"
                subprocess.run(["pkill", "-f", pattern], capture_output=True, text=True)
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
            "rpc_port": node_config.get("rpc_port", 9445),
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
                node_status["chain_height"] = rpc_info.get("native_chain_height") or rpc_info.get("chain_height")
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
                    metrics_port = miner_config.get("metrics_port", V31_POOL_API_PORT)
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

    # Edge-primary: no local miner; reflect active pool miners via Prometheus metrics
    if not stats.get("running") and TOPOLOGY == "edge-primary":
        try:
            import urllib.request as _ur
            with _ur.urlopen(f"http://{EDGE_RPC_HOST}:{V31_POOL_API_PORT}/metrics", timeout=2.0) as _r:
                _txt = _r.read().decode("utf-8", errors="ignore")
            _active = _tracked = _accepted = _rejected = 0
            for _ln in _txt.splitlines():
                _ln = _ln.strip()
                if _ln.startswith("zion_pool_active_sessions "):
                    _active = int(float(_ln.split()[-1]))
                elif _ln.startswith("zion_pool_miners_tracked "):
                    _tracked = int(float(_ln.split()[-1]))
                elif _ln.startswith("zion_pool_pplns_registered_miners "):
                    if _tracked == 0:
                        _tracked = int(float(_ln.split()[-1]))
                elif _ln.startswith("zion_pool_shares_accepted "):
                    _accepted = int(float(_ln.split()[-1]))
                elif _ln.startswith("zion_pool_accepted_total "):
                    if _accepted == 0:
                        _accepted = int(float(_ln.split()[-1]))
                elif _ln.startswith("zion_pool_shares_rejected "):
                    _rejected = int(float(_ln.split()[-1]))
                elif _ln.startswith("zion_pool_rejected_total "):
                    if _rejected == 0:
                        _rejected = int(float(_ln.split()[-1]))
            _hashrate = 0.0
            for _ln in _txt.splitlines():
                if _ln.startswith("zion_pool_hashrate_khs "):
                    _hashrate = float(_ln.split()[-1])
                elif _ln.startswith("zion_pool_hashrate_hps "):
                    _hashrate = float(_ln.split()[-1]) / 1000.0
                elif _ln.startswith("zion_pool_worker_hashrate_hps{worker="):
                    m = re.search(r'worker="([^"]+)"\}\s+([\d.]+)', _ln)
                    if m and (m.group(1).endswith(".v31-miner") or m.group(1).endswith(".v31-edge-lite")):
                        _hashrate = float(m.group(2)) / 1000.0
                        stats["worker_name"] = m.group(1).split(".")[-1]
                        break
                elif _ln.startswith("zion_pool_worker_hashrate_khs{worker="):
                    m = re.search(r'worker="([^"]+)"\}\s+([\d.]+)', _ln)
                    if m and (m.group(1).endswith(".v31-miner") or m.group(1).endswith(".v31-edge-lite")):
                        _hashrate = float(m.group(2))
                        stats["worker_name"] = m.group(1).split(".")[-1]
                        break
            if _active > 0 or _tracked > 0:
                stats["running"] = True
                stats["shares_accepted"] = _accepted
                stats["shares_rejected"] = _rejected
                stats["pool_addr"] = f"{EDGE_PUBLIC_IP}:8444"
                stats["gpu_backend"] = "pool"
                # Fallback estimate only if the live metrics don't report hashrate.
                if _hashrate <= 0:
                    hr_est = _estimate_hashrate_from_pool_metrics(_txt)
                    _hashrate = hr_est["pool_khs"]
                    for worker, hps in hr_est["workers_hps"].items():
                        if worker.endswith(".v31-miner") or worker.endswith(".v31-edge-lite"):
                            _hashrate = hps / 1000.0
                            stats["worker_name"] = worker.split(".")[-1]
                            break
                stats["hashrate"] = _hashrate if _hashrate > 0 else stats.get("hashrate")
        except Exception:
            pass

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

    # Real on-chain balance for the active miner payout address
    miner_wallet = _get_active_miner_wallet()
    on_chain_zion = None
    try:
        atomic, ok = _get_on_chain_balance(miner_wallet)
        if ok:
            on_chain_zion = flowers_to_zion(atomic)
    except Exception:
        pass

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
        "payout_address": miner_wallet,
        "on_chain_balance_zion": on_chain_zion,
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
            "rpc_bind": "0.0.0.0:9443",
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
        log_file = str(best_path)
        recent = tail_log(log_file, 200)
        # Read from both head and tail to find the most-recent startup block
        # (log may have multiple sessions; the last session's startup data is
        # in the tail region, while head_log would find the first/oldest one).
        startup_head = head_log(log_file, 50)
        startup_tail = tail_log(log_file, 300)  # large enough to include last startup
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

# ── Backup node beacon cache ──────────────────────────────────────────────
# The operator's local machine POSTs its backup node status here every 15s.
# We cache it and use it in _build_status_edge_primary() so the dashboard
# shows the remote backup node as online/offline with real data.
_BACKUP_BEACON: dict = {}
_BACKUP_BEACON_TIME: float = 0.0
_BACKUP_BEACON_LOCK = threading.Lock()
BACKUP_BEACON_TTL_SEC: float = 90.0  # offline if no beacon for 90s

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

def _compute_v31_banner_metrics(pool_status: dict, v31_multichain_status: dict, v31_node_status: dict = None, v31_dao_status: dict = None, v31_oasis_status: dict = None) -> dict:
    """Compute the V31 Mainnet Alpha banner KPIs for the full dashboard.

    Uses data already collected in _build_status_edge_primary plus a quick DAO
    stats call.  pool_status must contain 'hashrate_khs' and 'total_shares'.
    """
    # Pool hashrate: pool_status.hashrate_khs is in kH/s from Prometheus
    hashrate_hps = None
    if pool_status.get("hashrate_khs") is not None:
        try:
            hashrate_hps = float(pool_status["hashrate_khs"]) * 1000.0
        except Exception:
            hashrate_hps = None

    # Derive shares/sec from total-shares delta (same logic as v31.py)
    shares_per_sec = None
    total_shares = pool_status.get("total_shares")
    if total_shares is not None:
        global _V31_BANNER_POOL_TOTALS
        now = time.time()
        prev = _V31_BANNER_POOL_TOTALS
        try:
            total = float(total_shares)
            if prev["ts"] > 0 and total >= prev["shares"]:
                dt = now - prev["ts"]
                if dt > 0:
                    shares_per_sec = round((total - prev["shares"]) / dt, 2)
            prev["ts"] = now
            prev["shares"] = total
        except Exception:
            pass

    multichain_ok = bool(v31_multichain_status.get("ok", False))
    multichain_transfers_total = v31_multichain_status.get("transfers_total", 0) or 0
    multichain_transfers_pending = v31_multichain_status.get("transfers_pending", 0) or 0

    # DAO proposal counts from the V31 DAO service (port 8456)
    dao_total = 0
    dao_active = 0
    if v31_dao_status:
        dao_total = v31_dao_status.get("proposals_total", 0)
        dao_active = v31_dao_status.get("proposals_active", 0)
    # Only fall back to a live DAO call if we have no status dict at all.
    if v31_dao_status is None:
        try:
            with urllib.request.urlopen("http://127.0.0.1:8456/api/dao/proposals", timeout=1.5) as r:
                dao_st = json.loads(r.read().decode("utf-8", errors="ignore"))
                if isinstance(dao_st, dict) and "_error" not in dao_st:
                    dao_total = dao_st.get("total") or dao_st.get("proposals_total") or dao_st.get("proposals", 0)
                    dao_active = dao_st.get("active") or dao_st.get("active_proposals") or dao_st.get("proposals_active") or dao_st.get("open_proposals", 0)
        except Exception:
            pass

    vns = v31_node_status or {}
    return {
        "height": vns.get("chain_height") or vns.get("canonical_height"),
        "sync_lag": vns.get("sync_lag"),
        "node_running": vns.get("running", False),
        "node_reachable": vns.get("running", False),
        "pool_hashrate_hps": hashrate_hps,
        "shares_per_sec": shares_per_sec,
        "pool_total_shares": total_shares,
        "multichain_ok": multichain_ok,
        "multichain_transfers_total": multichain_transfers_total,
        "multichain_transfers_pending": multichain_transfers_pending,
        "dao_proposals_total": int(dao_total) if dao_total is not None else 0,
        "dao_proposals_active": int(dao_active) if dao_active is not None else 0,
    }


def _build_status_edge_primary() -> dict:
    """Build status for edge-primary topology: fast, parallel RPC with short timeouts."""
    t0 = time.time()


    # ── Parallel RPC probes ─────────────────────────────────────────────────
    # V3 nodes (port 9443, 8448) are archived — only V31 nodes are probed.

    def _v31_rpc_call():
        # V31 Node — TCP JSON-RPC on port 9445 (not HTTP)
        import socket as _sock
        def _call(method, params=None):
            req = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}) + "\n"
            try:
                with _sock.create_connection(("127.0.0.1", 9445), timeout=2.0) as s:
                    s.sendall(req.encode())
                    resp = b""
                    while True:
                        chunk = s.recv(8192)
                        if not chunk:
                            break
                        resp += chunk
                        if b"\n" in chunk:
                            break
                    r = json.loads(resp.decode("utf-8", errors="replace").strip())
                    if "error" in r and r["error"]:
                        return None
                    return r.get("result")
            except Exception:
                return None
        status = _call("getStatus")
        if status is None:
            return ("v31", None)
        nodeinfo = _call("getNodeInfo")
        peers = _call("getPeerInfo")
        chaininfo = _call("getChainInfo")
        combined = dict(status) if isinstance(status, dict) else {}
        if isinstance(nodeinfo, dict):
            combined.update(nodeinfo)
        if isinstance(peers, dict):
            combined["known_peers"] = peers.get("count", 0)
            combined["active_peers"] = peers.get("active_count", 0)
            combined["peers"] = peers.get("peers", [])
        if isinstance(chaininfo, dict):
            # getChainInfo returns native_chain_height (real height) vs chain_height (V3=0)
            if chaininfo.get("native_chain_height") is not None:
                combined["native_chain_height"] = chaininfo["native_chain_height"]
                combined["chain_height"] = chaininfo["native_chain_height"]
            if chaininfo.get("tip_hash"):
                combined["tip_hash"] = chaininfo["tip_hash"]
            if chaininfo.get("difficulty") is not None:
                combined["difficulty"] = chaininfo["difficulty"]
            if chaininfo.get("accepted_blocks") is not None:
                combined["accepted_blocks"] = chaininfo["accepted_blocks"]
        return ("v31", combined)

    def _v31_systemd_call():
        # V31 systemd service status
        try:
            import subprocess as _sp
            r = _sp.run(
                ["systemctl", "show", "zion-v31-node.service",
                 "--property=ActiveState,SubState,MainPID,MemoryCurrent"],
                capture_output=True, text=True, timeout=3
            )
            props = {}
            for line in r.stdout.strip().split("\n"):
                if "=" in line:
                    k, v = line.split("=", 1)
                    props[k] = v
            return ("v31_sys", props)
        except Exception:
            return ("v31_sys", {})

    def _v31_follower_rpc_call(port, key):
        """RPC call for V31 follower nodes (node2=9446, node3=9447)."""
        import socket as _sock
        def _call(method, params=None):
            req = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}) + "\n"
            try:
                with _sock.create_connection(("127.0.0.1", port), timeout=2.0) as s:
                    s.sendall(req.encode())
                    resp = b""
                    while True:
                        chunk = s.recv(8192)
                        if not chunk:
                            break
                        resp += chunk
                        if b"\n" in chunk:
                            break
                    r = json.loads(resp.decode("utf-8", errors="replace").strip())
                    if "error" in r and r["error"]:
                        return None
                    return r.get("result")
            except Exception:
                return None
        status = _call("getStatus")
        if status is None:
            return (key, None)
        nodeinfo = _call("getNodeInfo")
        peers = _call("getPeerInfo")
        chaininfo = _call("getChainInfo")
        combined = dict(status) if isinstance(status, dict) else {}
        if isinstance(nodeinfo, dict):
            combined.update(nodeinfo)
        if isinstance(peers, dict):
            combined["known_peers"] = peers.get("count", 0)
            combined["active_peers"] = peers.get("active_count", 0)
            combined["peers"] = peers.get("peers", [])
        if isinstance(chaininfo, dict):
            if chaininfo.get("native_chain_height") is not None:
                combined["native_chain_height"] = chaininfo["native_chain_height"]
                combined["chain_height"] = chaininfo["native_chain_height"]
            if chaininfo.get("tip_hash"):
                combined["tip_hash"] = chaininfo["tip_hash"]
        return (key, combined)

    def _v31_follower_systemd_call(service, key):
        """systemd status for V31 follower nodes."""
        try:
            import subprocess as _sp
            r = _sp.run(
                ["systemctl", "show", service,
                 "--property=ActiveState,SubState,MainPID,MemoryCurrent"],
                capture_output=True, text=True, timeout=3
            )
            props = {}
            for line in r.stdout.strip().split("\n"):
                if "=" in line:
                    k, v = line.split("=", 1)
                    props[k] = v
            return (key, props)
        except Exception:
            return (key, {})

    v31_rpc_info = None
    v31_sys_info = {}
    v31_node2_rpc_info = None
    v31_node2_sys_info = {}
    v31_node3_rpc_info = None
    v31_node3_sys_info = {}
    ex = ThreadPoolExecutor(max_workers=6)
    futures = {
        ex.submit(_v31_rpc_call),
        ex.submit(_v31_systemd_call),
        ex.submit(_v31_follower_rpc_call, 9446, "v31_node2"),
        ex.submit(_v31_follower_systemd_call, "zion-v31-node2.service", "v31_node2_sys"),
        ex.submit(_v31_follower_rpc_call, 9447, "v31_node3"),
        ex.submit(_v31_follower_systemd_call, "zion-v31-node3.service", "v31_node3_sys"),
    }
    try:
        for fut in as_completed(futures, timeout=5.0):
            try:
                key, val = fut.result()
                if key == "v31":
                    v31_rpc_info = val
                elif key == "v31_sys":
                    v31_sys_info = val or {}
                elif key == "v31_node2":
                    v31_node2_rpc_info = val
                elif key == "v31_node2_sys":
                    v31_node2_sys_info = val or {}
                elif key == "v31_node3":
                    v31_node3_rpc_info = val
                elif key == "v31_node3_sys":
                    v31_node3_sys_info = val or {}
            except Exception:
                pass
    except TimeoutError:
        pass
    finally:
        # Do not block the dashboard if an RPC thread is still stuck waiting
        # for a node response. Running threads will time out on their own.
        ex.shutdown(wait=False, cancel_futures=True)

    # ── V31 Alpha Node — V3-compatible P2P sync ─────────────────────────────
    v31_active = v31_sys_info.get("ActiveState", "unknown")
    v31_pid = 0
    try:
        v31_pid = int(v31_sys_info.get("MainPID", 0))
    except (ValueError, TypeError):
        pass
    v31_mem_mb = None
    try:
        mc = v31_sys_info.get("MemoryCurrent", "")
        if mc and mc != "[not set]":
            v31_mem_mb = round(int(mc) / 1048576, 1)
    except (ValueError, TypeError):
        pass
    v31_chain_height = None
    v31_tip_hash = None
    v31_mempool = 0
    _vr = {}
    if v31_rpc_info and isinstance(v31_rpc_info, dict):
        _vr = v31_rpc_info.get("result") or v31_rpc_info
        if isinstance(_vr, dict):
            v31_chain_height = _vr.get("native_chain_height") or _vr.get("chain_height")
            v31_tip_hash = _vr.get("tip_hash") or _vr.get("tip_hash_hex")
            v31_mempool = int(_vr.get("mempool_account_transactions", 0)) + int(_vr.get("mempool_utxo_transactions", 0))
            if _vr.get("mempool_transactions") is not None:
                v31_mempool = int(_vr.get("mempool_transactions", 0))
    v31_node_status = {
        "running": v31_active == "active",
        "systemd_active": v31_active,
        "systemd_sub": v31_sys_info.get("SubState", "unknown"),
        "node_pid": v31_pid or None,
        "memory_mb": v31_mem_mb,
        "chain_height": v31_chain_height,
        "tip_hash": v31_tip_hash,
        "mempool_size": v31_mempool,
        "network": _vr.get("network", "mainnet"),
        "protocol_version": _vr.get("protocol_version", "3.1.0-alpha"),
        "accepted_blocks": _vr.get("accepted_blocks"),
        "node_id": _vr.get("node_id", "zion-edge-v31"),
        "p2p_bind": _vr.get("p2p_bind", "0.0.0.0:8335"),
        "rpc_bind": _vr.get("rpc_bind", "127.0.0.1:9445"),
        "host": "127.0.0.1:9445",
        "version": "3.1.0-beta",
        "known_peers": _vr.get("known_peers", 0),
        "active_peers": _vr.get("active_peers", 0),
        "sync_lag": 0,
    }

    # Peer discovery from V31 primary node (replaces old V3 edge_peers)
    edge_peers = None
    if v31_rpc_info and isinstance(v31_rpc_info, dict):
        edge_peers = {
            "count": v31_rpc_info.get("known_peers", 0),
            "peers": v31_rpc_info.get("peers", []),
        }

    # ── V31 Node 2 (Follower) — port 9446 ──────────────────────────────────
    v31_n2_active = v31_node2_sys_info.get("ActiveState", "unknown")
    v31_n2_pid = 0
    try:
        v31_n2_pid = int(v31_node2_sys_info.get("MainPID", 0))
    except (ValueError, TypeError):
        pass
    v31_n2_mem_mb = None
    try:
        mc = v31_node2_sys_info.get("MemoryCurrent", "")
        if mc and mc != "[not set]":
            v31_n2_mem_mb = round(int(mc) / 1048576, 1)
    except (ValueError, TypeError):
        pass
    _vr2 = {}
    v31_n2_height = None
    v31_n2_tip = None
    v31_n2_mempool = 0
    if v31_node2_rpc_info and isinstance(v31_node2_rpc_info, dict):
        _vr2 = v31_node2_rpc_info.get("result") or v31_node2_rpc_info
        if isinstance(_vr2, dict):
            v31_n2_height = _vr2.get("native_chain_height") or _vr2.get("chain_height")
            v31_n2_tip = _vr2.get("tip_hash") or _vr2.get("tip_hash_hex")
            v31_n2_mempool = int(_vr2.get("mempool_account_transactions", 0)) + int(_vr2.get("mempool_utxo_transactions", 0))
            if _vr2.get("mempool_transactions") is not None:
                v31_n2_mempool = int(_vr2.get("mempool_transactions", 0))
    v31_node2_status = {
        "running": v31_n2_active == "active",
        "systemd_active": v31_n2_active,
        "systemd_sub": v31_node2_sys_info.get("SubState", "unknown"),
        "node_pid": v31_n2_pid or None,
        "memory_mb": v31_n2_mem_mb,
        "chain_height": v31_n2_height,
        "tip_hash": v31_n2_tip,
        "mempool_size": v31_n2_mempool,
        "network": _vr2.get("network", "mainnet"),
        "protocol_version": _vr2.get("protocol_version", "3.1.0-alpha"),
        "accepted_blocks": _vr2.get("accepted_blocks"),
        "node_id": _vr2.get("node_id", "zion-edge-v31-node2"),
        "p2p_bind": _vr2.get("p2p_bind", "0.0.0.0:8336"),
        "rpc_bind": _vr2.get("rpc_bind", "127.0.0.1:9446"),
        "host": "127.0.0.1:9446",
        "version": "3.1.0-beta",
        "known_peers": _vr2.get("known_peers", 0),
        "active_peers": _vr2.get("active_peers", 0),
        "sync_lag": 0,
    }

    # ── V31 Node 3 (Follower) — port 9447 ──────────────────────────────────
    v31_n3_active = v31_node3_sys_info.get("ActiveState", "unknown")
    v31_n3_pid = 0
    try:
        v31_n3_pid = int(v31_node3_sys_info.get("MainPID", 0))
    except (ValueError, TypeError):
        pass
    v31_n3_mem_mb = None
    try:
        mc = v31_node3_sys_info.get("MemoryCurrent", "")
        if mc and mc != "[not set]":
            v31_n3_mem_mb = round(int(mc) / 1048576, 1)
    except (ValueError, TypeError):
        pass
    _vr3 = {}
    v31_n3_height = None
    v31_n3_tip = None
    v31_n3_mempool = 0
    if v31_node3_rpc_info and isinstance(v31_node3_rpc_info, dict):
        _vr3 = v31_node3_rpc_info.get("result") or v31_node3_rpc_info
        if isinstance(_vr3, dict):
            v31_n3_height = _vr3.get("native_chain_height") or _vr3.get("chain_height")
            v31_n3_tip = _vr3.get("tip_hash") or _vr3.get("tip_hash_hex")
            v31_n3_mempool = int(_vr3.get("mempool_account_transactions", 0)) + int(_vr3.get("mempool_utxo_transactions", 0))
            if _vr3.get("mempool_transactions") is not None:
                v31_n3_mempool = int(_vr3.get("mempool_transactions", 0))
    v31_node3_status = {
        "running": v31_n3_active == "active",
        "systemd_active": v31_n3_active,
        "systemd_sub": v31_node3_sys_info.get("SubState", "unknown"),
        "node_pid": v31_n3_pid or None,
        "memory_mb": v31_n3_mem_mb,
        "chain_height": v31_n3_height,
        "tip_hash": v31_n3_tip,
        "mempool_size": v31_n3_mempool,
        "network": _vr3.get("network", "mainnet"),
        "protocol_version": _vr3.get("protocol_version", "3.1.0-alpha"),
        "accepted_blocks": _vr3.get("accepted_blocks"),
        "node_id": _vr3.get("node_id", "zion-edge-v31-node3"),
        "p2p_bind": _vr3.get("p2p_bind", "0.0.0.0:8337"),
        "rpc_bind": _vr3.get("rpc_bind", "127.0.0.1:9447"),
        "host": "127.0.0.1:9447",
        "version": "3.1.0-beta",
        "known_peers": _vr3.get("known_peers", 0),
        "active_peers": _vr3.get("active_peers", 0),
        "sync_lag": 0,
    }

    # Compute sync lag of followers relative to primary
    if v31_node_status.get("chain_height") is not None:
        _primary_h = int(v31_node_status["chain_height"])
        if v31_node2_status.get("chain_height") is not None:
            v31_node2_status["sync_lag"] = _primary_h - int(v31_node2_status["chain_height"])
        if v31_node3_status.get("chain_height") is not None:
            v31_node3_status["sync_lag"] = _primary_h - int(v31_node3_status["chain_height"])
    # ── V31 Pool (PROD) — systemd + share count from journald ──────────────
    v31_pool_sys = _systemctl_show("zion-v31-pool.service")
    v31_pool_active = v31_pool_sys.get("ActiveState", "unknown")
    v31_pool_shares = 0
    v31_pool_jobs = 0
    try:
        r = subprocess.run(
            ["journalctl", "-u", "zion-v31-pool.service", "--no-pager", "-n", "200", "--output=cat"],
            capture_output=True, text=True, timeout=5
        )
        for line in r.stdout.strip().split("\n"):
            if "share accepted" in line:
                v31_pool_shares += 1
            if "broadcasting mining.notify" in line:
                v31_pool_jobs += 1
    except Exception:
        pass
    v31_pool_status = {
        "running": v31_pool_active == "active",
        "systemd_active": v31_pool_active,
        "port": 8444,
        "shares_accepted": v31_pool_shares,
        "jobs_broadcast": v31_pool_jobs,
    }
    # ── V31 Miner (PROD) — systemd + hashrate from journald ────────────────
    v31_miner_sys = _systemctl_show("zion-v31-miner.service")
    v31_miner_active = v31_miner_sys.get("ActiveState", "unknown")
    v31_miner_hashrate = None
    v31_miner_shares = 0
    v31_miner_accepted = 0
    try:
        r = subprocess.run(
            ["journalctl", "-u", "zion-v31-miner.service", "--no-pager", "-n", "100", "--output=cat"],
            capture_output=True, text=True, timeout=5
        )
        for line in r.stdout.strip().split("\n"):
            # Universal miner summary: "hashrate=0 H/s submitted=0 accepted=7 rejected=0 ..."
            if "hashrate=" in line:
                m = re.search(r"hashrate=(\d+(?:\.\d+)?)", line)
                if m:
                    val = float(m.group(1))
                    if val:
                        v31_miner_hashrate = int(val)
                # Fallback: stream stats line like "stream=zion ... hashrate=123 status=active"
                if v31_miner_hashrate is None or v31_miner_hashrate == 0:
                    m2 = re.search(r"stream=zion .*?hashrate=(\d+(?:\.\d+)?)", line)
                    if m2:
                        val2 = float(m2.group(1))
                        if val2:
                            v31_miner_hashrate = int(val2)
            m_sub = re.search(r"\bsubmitted=(\d+)", line)
            if m_sub:
                v31_miner_shares = int(m_sub.group(1))
            m_acc = re.search(r"\baccepted=(\d+)", line)
            if m_acc:
                v31_miner_accepted = int(m_acc.group(1))
    except Exception:
        pass
    # Real on-chain balance for the active miner payout address
    v31_miner_wallet = _get_active_miner_wallet()
    v31_miner_on_chain = None
    try:
        atomic, ok = _get_on_chain_balance(v31_miner_wallet)
        if ok:
            v31_miner_on_chain = flowers_to_zion(atomic)
    except Exception:
        pass

    v31_miner_status = {
        "running": v31_miner_active == "active",
        "systemd_active": v31_miner_active,
        "hashrate": v31_miner_hashrate,
        "shares_submitted": v31_miner_shares,
        "shares_accepted": v31_miner_accepted,
        "worker": "v31-miner",
        "payout_address": v31_miner_wallet,
        "on_chain_balance_zion": v31_miner_on_chain,
    }
    # ── V31 Multichain (PROD) — systemd + /health ──────────────────────────
    v31_mc_sys = _systemctl_show("zion-v31-multichain.service")
    v31_mc_active = v31_mc_sys.get("ActiveState", "unknown")
    v31_mc_health = {}
    try:
        with urllib.request.urlopen("http://127.0.0.1:8453/health", timeout=2) as resp:
            v31_mc_health = json.loads(resp.read().decode())
    except Exception:
        pass
    v31_multichain_status = {
        "running": v31_mc_active == "active",
        "systemd_active": v31_mc_active,
        "ok": v31_mc_health.get("ok", False),
        "transfers_total": v31_mc_health.get("transfers_total", 0),
        "transfers_pending": v31_mc_health.get("transfers_pending", 0),
        "version": v31_mc_health.get("version", "—"),
    }
    # ── V31 DAO (PROD) — systemd + /health ─────────────────────────────────
    v31_dao_sys = _systemctl_show("zion-v31-dao.service")
    v31_dao_active = v31_dao_sys.get("ActiveState", "unknown")
    v31_dao_health = {}
    v31_dao_total = 0
    v31_dao_active_proposals = 0
    try:
        with urllib.request.urlopen("http://127.0.0.1:8456/api/dao/health", timeout=2) as resp:
            v31_dao_health = json.loads(resp.read().decode())
    except Exception:
        pass
    try:
        with urllib.request.urlopen("http://127.0.0.1:8456/api/dao/proposals", timeout=2) as resp:
            proposals = json.loads(resp.read().decode())
            if isinstance(proposals, dict):
                v31_dao_total = proposals.get("total", 0) or proposals.get("proposals_total", 0)
                v31_dao_active_proposals = proposals.get("active", 0) or proposals.get("active_proposals", 0)
    except Exception:
        pass
    v31_dao_status = {
        "running": v31_dao_active == "active",
        "systemd_active": v31_dao_active,
        "ok": v31_dao_health.get("success", False) or v31_dao_health.get("ok", False),
        "proposals_total": v31_dao_total,
        "proposals_active": v31_dao_active_proposals,
    }
    # ── V31 OASIS (PROD) — systemd + /health ───────────────────────────────
    v31_oasis_sys = _systemctl_show("zion-v31-oasis.service")
    v31_oasis_active = v31_oasis_sys.get("ActiveState", "unknown")
    v31_oasis_health = {}
    try:
        with urllib.request.urlopen("http://127.0.0.1:8094/health", timeout=2) as resp:
            v31_oasis_health = json.loads(resp.read().decode())
    except Exception:
        pass
    v31_oasis_status = {
        "running": v31_oasis_active == "active",
        "systemd_active": v31_oasis_active,
        "ok": v31_oasis_health.get("success", False) or v31_oasis_health.get("ok", False),
    }
    # ── Local Backup Node — from beacon cache ───────────────────────────────
    # The operator's local machine pushes status via /api/backup-beacon every
    # 15s. If the beacon is fresh (< 90s), we show the node as online.
    now_ts = time.time()
    beacon = {}
    with _BACKUP_BEACON_LOCK:
        beacon_age = now_ts - _BACKUP_BEACON_TIME
        if beacon_age < BACKUP_BEACON_TTL_SEC:
            beacon = dict(_BACKUP_BEACON)
    if beacon:
        local_backup_status = {
            "running": True,
            "chain_height": beacon.get("chain_height"),
            "tip_hash": beacon.get("tip_hash"),
            "known_peers": beacon.get("known_peers", 0),
            "mempool_size": beacon.get("mempool_size", 0),
            "network": beacon.get("network"),
            "protocol_version": beacon.get("protocol_version"),
            "consensus_profile": beacon.get("consensus_profile"),
            "accepted_blocks": beacon.get("accepted_blocks"),
            "node_id": beacon.get("node_id", "local-backup-node"),
            "p2p_bind": beacon.get("p2p_bind", "0.0.0.0:8333"),
            "rpc_bind": beacon.get("rpc_bind", "127.0.0.1:8446"),
            "host": beacon.get("host", "local-pc"),
            "uptime_seconds": beacon.get("uptime_seconds"),
            "last_beacon_age_s": round(beacon_age, 1),
        }
    else:
        local_backup_status = {
            "running": False,
            "chain_height": None,
            "tip_hash": None,
            "known_peers": 0,
            "mempool_size": 0,
            "network": None,
            "protocol_version": None,
            "consensus_profile": None,
            "accepted_blocks": None,
            "node_id": None,
            "p2p_bind": None,
            "rpc_bind": None,
            "host": "local-pc (no beacon received)",
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

    # ── Edge Pool ────────────────────────────────────────────────────────────
    # Skip slow local check_service_health — probe Edge pool metrics directly
    pool_edge_svc = get_service("pool-edge")
    pool_edge_health = {"alive": False}
    edge_metrics = {"active_miners": None, "hashrate": 0.0, "hashrate_1h": None, "accept_rate_pct": None,
                    "shares_accepted": None, "shares_rejected": None, "miners_tracked": None,
                    "blocks_found": 0, "total_hashes": None, "total_shares": None}
    edge_payout = {"pplns_rounds": 0, "pplns_total_paid": 0, "pplns_total_unpaid": 0,
                   "pplns_window_size": 0, "pplns_window_used": 0, "pplns_registered_miners": 0,
                   "fee_humanitarian": 0, "fee_issobella": 0, "fee_pool": 0, "fee_miner_pct": 89,
                   "miner_balances": []}
    body = ""
    try:
        # Direct Edge pool metrics probe (port V31_POOL_API_PORT)
        url = f"http://{EDGE_RPC_HOST}:{V31_POOL_API_PORT}/metrics"
        with _urlreq.urlopen(url, timeout=3.0) as r:
            body = r.read().decode("utf-8", errors="ignore")
            for line in body.splitlines():
                line = line.strip()
                if not line:
                    continue
                if line.startswith("zion_pool_active_sessions "):
                    edge_metrics["active_miners"] = int(line.split()[-1])
                elif line.startswith("zion_pool_total_hashes "):
                    edge_metrics["total_hashes"] = int(line.split()[-1])
                elif line.startswith("zion_pool_shares_accepted "):
                    val = int(line.split()[-1])
                    edge_metrics["total_shares"] = val
                    if edge_metrics["shares_accepted"] is None:
                        edge_metrics["shares_accepted"] = val
                elif line.startswith("zion_pool_accepted_total "):
                    val = int(line.split()[-1])
                    if edge_metrics["shares_accepted"] is None:
                        edge_metrics["shares_accepted"] = val
                    if edge_metrics["total_shares"] is None:
                        edge_metrics["total_shares"] = val
                elif line.startswith("zion_pool_shares_rejected "):
                    edge_metrics["shares_rejected"] = int(line.split()[-1])
                elif line.startswith("zion_pool_rejected_total "):
                    if edge_metrics["shares_rejected"] is None:
                        edge_metrics["shares_rejected"] = int(line.split()[-1])
                elif line.startswith("zion_pool_blocks_found ") or line.startswith("zion_pool_blocks_found_total "):
                    edge_metrics["blocks_found"] = int(line.split()[-1])
                elif line.startswith("zion_pool_hashrate_khs "):
                    edge_metrics["hashrate"] = float(line.split()[-1])
                elif line.startswith("zion_pool_hashrate_hps "):
                    edge_metrics["hashrate"] = float(line.split()[-1]) / 1000.0
                elif line.startswith("zion_pool_hashrate_1h_hps "):
                    edge_metrics["hashrate_1h"] = float(line.split()[-1]) / 1000.0
                elif line.startswith("zion_pool_worker_hashrate_hps{worker="):
                    m = re.search(r'worker="([^"]+)"\}\s+([\d.]+)', line)
                    if m and m.group(1).endswith(".v31-miner"):
                        edge_metrics["edge_worker_khs"] = float(m.group(2)) / 1000.0
                elif line.startswith("zion_pool_worker_hashrate_khs{worker="):
                    m = re.search(r'worker="([^"]+)"\}\s+([\d.]+)', line)
                    if m and m.group(1).endswith(".v31-miner"):
                        edge_metrics["edge_worker_khs"] = float(m.group(2))
                elif line.startswith("zion_pool_accept_rate_pct "):
                    edge_metrics["accept_rate_pct"] = float(line.split()[-1])
                elif line.startswith("zion_pool_miners_tracked "):
                    edge_metrics["miners_tracked"] = int(line.split()[-1])
                elif line.startswith("zion_pool_pplns_payout_rounds ") or line.startswith("zion_pplns_payout_rounds "):
                    edge_payout["pplns_rounds"] = int(line.split()[-1])
                elif line.startswith("zion_pool_pplns_total_paid_flowers ") or line.startswith("zion_pplns_total_paid_flowers "):
                    edge_payout["pplns_total_paid"] = int(line.split()[-1])
                elif line.startswith("zion_pool_pplns_total_unpaid_flowers ") or line.startswith("zion_pplns_total_unpaid_flowers "):
                    edge_payout["pplns_total_unpaid"] = int(line.split()[-1])
                elif line.startswith("zion_pool_pplns_window_size ") or line.startswith("zion_pplns_window_size "):
                    edge_payout["pplns_window_size"] = int(line.split()[-1])
                elif line.startswith("zion_pool_pplns_window_used ") or line.startswith("zion_pplns_window_used "):
                    edge_payout["pplns_window_used"] = int(line.split()[-1])
                elif line.startswith("zion_pool_pplns_registered_miners ") or line.startswith("zion_pplns_registered_miners "):
                    val = int(line.split()[-1])
                    edge_payout["pplns_registered_miners"] = val
                    if edge_metrics["miners_tracked"] is None:
                        edge_metrics["miners_tracked"] = val
                elif line.startswith("zion_fee_humanitarian_pct ") or line.startswith("zion_fee_humanitarian_flowers "):
                    edge_payout["fee_humanitarian"] = int(line.split()[-1])
                elif line.startswith("zion_fee_issobella_pct ") or line.startswith("zion_fee_issobella_flowers "):
                    edge_payout["fee_issobella"] = int(line.split()[-1])
                elif line.startswith("zion_fee_pool_pct ") or line.startswith("zion_fee_pool_flowers "):
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
    # Fallback: V31 pool may show 0 active stratum sessions for miners that
    # submit via block-submit / RPC while still accepting shares. Use the
    # tracked/registered miner count as a sensible active-miners proxy.
    _am = edge_metrics.get("active_miners")
    if (_am is None or _am == 0) and (edge_metrics.get("shares_accepted") or 0) > 0:
        _tracked = edge_metrics.get("miners_tracked") or edge_payout.get("pplns_registered_miners") or 0
        if _tracked > 0:
            edge_metrics["active_miners"] = _tracked
    # Hashrate fallback: V31 Trinity miners don't always submit
    # attempted_hashes/elapsed_ms, so the pool's built-in hashrate metric can be
    # 0 or only reflect a subset of workers.  Estimate from full blocks found,
    # current network difficulty, and pool uptime.  Only used when the live
    # metric is unavailable (0/None).
    if body and (edge_metrics.get("hashrate") is None or edge_metrics["hashrate"] <= 0) and (edge_metrics.get("blocks_found") or 0) > 0:
        network_difficulty = None
        if v31_rpc_info and isinstance(v31_rpc_info, dict):
            network_difficulty = v31_rpc_info.get("difficulty")
        if network_difficulty:
            try:
                hr_est = _estimate_hashrate_from_pool_metrics(body, network_difficulty)
                if hr_est.get("pool_khs", 0) > 0:
                    edge_metrics["hashrate"] = round(hr_est["pool_khs"], 6)
                    edge_metrics["hashrate_1h"] = round(hr_est["pool_khs"], 6)
                    # Remember per-worker estimates so the Edge miner panel can show
                    # its own hashrate rather than the whole pool's.
                    for worker, hps in hr_est.get("workers_hps", {}).items():
                        if worker.endswith(".v31-miner") or worker.endswith(".v31-edge-lite"):
                            edge_metrics["edge_worker_khs"] = round(hps / 1000.0, 6)
                            break
            except Exception:
                pass

    # Mark pool as alive if we successfully fetched metrics
    if edge_metrics.get("active_miners") is not None:
        pool_edge_health = {"alive": True}
    # Fallback: TCP probe to pool metrics port V31_POOL_API_PORT (NOT stratum port 8444,
    # which would create a spurious session on the pool server).
    if not pool_edge_health["alive"]:
        try:
            pool_edge_health = {"alive": tcp_probe("127.0.0.1", V31_POOL_API_PORT, timeout=0.5)}
        except Exception:
            pool_edge_health = {"alive": False}


    edge_pool_wallet = os.environ.get("ZION_POOL_WALLET", "") or V31_CANONICAL_POOL_PAYOUT_WALLET
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
        "pplns_total_unpaid": edge_payout["pplns_total_unpaid"],
        "pplns_total_unpaid_zion": flowers_to_zion(edge_payout["pplns_total_unpaid"]),
        "pplns_window_size": edge_payout["pplns_window_size"],
        "pplns_window_used": edge_payout["pplns_window_used"],
        "pplns_registered_miners": edge_payout["pplns_registered_miners"],
        "miners_tracked": edge_metrics["miners_tracked"] if edge_metrics["miners_tracked"] is not None else edge_payout["pplns_registered_miners"],
        "fee_humanitarian": edge_payout["fee_humanitarian"],
        "fee_issobella": edge_payout["fee_issobella"],
        "fee_pool": edge_payout["fee_pool"],
        "fee_miner_pct": edge_payout["fee_miner_pct"],
        "miner_balances": edge_payout["miner_balances"],
    }

    # Sync gap (local backup vs V31 primary)
    sync_gap = None
    if n1.get("chain_height") and v31_node_status.get("chain_height"):
        sync_gap = abs(n1["chain_height"] - v31_node_status["chain_height"])

    # v3.0.4: No Tailscale — single server topology, not needed

    miner_status = parse_miner_log()

    # Edge-primary: no local miner process; reflect active pool miners instead
    active_miners = (edge_metrics.get("active_miners") or 0) if edge_metrics else 0
    tracked_miners = (edge_metrics.get("miners_tracked") or 0) if edge_metrics else 0
    if active_miners > 0 or tracked_miners > 0:
        # Edge-primary: the "miner" card reflects the pool's activity.  Prefer
        # the Edge worker's estimated hashrate, then the pool aggregate, and
        # overwrite any stale local-log value.
        if not miner_status.get("running"):
            miner_status["running"] = True
            miner_status["pool_addr"] = f"{EDGE_PUBLIC_IP}:8444"
        _mh = edge_metrics.get("edge_worker_khs") or edge_metrics.get("hashrate") if edge_metrics else None
        if _mh is not None:
            miner_status["hashrate"] = _mh
        miner_status["shares_accepted"] = edge_metrics.get("shares_accepted") or 0
        miner_status["shares_rejected"] = edge_metrics.get("shares_rejected") or 0

    # Backfill the V31 miner card with the Edge worker's estimated hashrate
    # (the systemd journal does not expose hashrate for Trinity miners).
    if v31_miner_status.get("hashrate") is None:
        _ew = edge_metrics.get("edge_worker_khs") if edge_metrics else None
        if _ew:
            v31_miner_status["hashrate"] = round(_ew * 1000.0, 1)

    # ── L2/L3 Edge services health — TCP port check on Edge (fast, 0.5s) ────
    _edge = "127.0.0.1"
    _edge_ports = {
        "bridge":     8453,   # V31 multichain (bridge/warp/swap unified)
        "dao":        8456,   # V31 DAO API
        "warp":       8453,   # V31 multichain WARP relay
        "atomic_swap": 8453,  # V31 multichain (atomic swap is part of multichain)
        "dex":        8454,   # V31 multichain DEX router
        "oasis":      8094,   # V31 OASIS API
        "free_world": 8095,   # V31 Free World (if running)
        "issobella":  8096,   # V31 Issobella (if running)
    }
    _health_map = {}
    for _sid, _port in _edge_ports.items():
        _open = check_port_open(_edge, _port, 0.5)
        _health_map[_sid] = {"alive": _open, "status": "ok" if _open else "down", "ports_open": [_port] if _open else []}
    bridge_health     = _health_map["bridge"]
    dao_health        = _health_map["dao"]
    warp_health       = _health_map["warp"]
    atomic_swap_health = _health_map["atomic_swap"]
    oasis_health      = _health_map["oasis"]
    free_world_health = _health_map["free_world"]
    issobella_health  = _health_map["issobella"]

    # ── Build all_nodes list for the All Nodes panel ──────────────────────────
    # Combines our 3 known nodes + any external P2P peers discovered via getPeerInfo.
    all_nodes = []
    for _label, _st, _role, _icon in [
        ("V31 Node 1 (Primary)", v31_node_status, "primary", "🚀"),
        ("V31 Node 2 (Follower)", v31_node2_status, "follower", "🛰️"),
        ("V31 Node 3 (Follower)", v31_node3_status, "follower", "📡"),
        ("Local Backup Node", local_backup_status, "backup", "💾"),
    ]:
        # Always include all known nodes — even offline ones — so the overview
        # shows the full topology.  Running nodes get full stats; offline ones
        # show "offline" state but are still visible.
        all_nodes.append({
            "name": _label,
            "role": _role,
            "icon": _icon,
            "running": (_st or {}).get("running", False),
            "chain_height": (_st or {}).get("chain_height"),
            "tip_hash": (_st or {}).get("tip_hash"),
            "node_id": (_st or {}).get("node_id"),
            "p2p_bind": (_st or {}).get("p2p_bind"),
            "rpc_bind": (_st or {}).get("rpc_bind"),
            "host": (_st or {}).get("host", ""),
            "known_peers": (_st or {}).get("known_peers", 0),
            "mempool_size": (_st or {}).get("mempool_size", 0),
            "protocol_version": (_st or {}).get("protocol_version"),
            "network": (_st or {}).get("network"),
            "consensus_profile": (_st or {}).get("consensus_profile"),
            "accepted_blocks": (_st or {}).get("accepted_blocks"),
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

    v31_banner = _compute_v31_banner_metrics(pool_status, v31_multichain_status, v31_node_status, v31_dao_status, v31_oasis_status)

    elapsed = time.time() - t0
    return {
        "timestamp": datetime.now().isoformat(),
        "topology": "edge-primary",
        "v31_banner": v31_banner,
        "node1": n1,
        "node2": {"running": False, "chain_height": None, "tip_hash": None, "known_peers": 0, "mempool_size": 0},
        "v31_node": v31_node_status,
        "v31_node2": v31_node2_status,
        "v31_node3": v31_node3_status,
        "v31_pool": v31_pool_status,
        "v31_miner": v31_miner_status,
        "v31_multichain": v31_multichain_status,
        "v31_dao": v31_dao_status,
        "v31_oasis": v31_oasis_status,
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
        "atomic_swap": {
            "running": atomic_swap_health["alive"],
            "status": atomic_swap_health.get("status", "unknown"),
            "details": atomic_swap_health.get("details", ""),
            "ports_open": atomic_swap_health.get("ports_open", []),
            "ports_closed": atomic_swap_health.get("ports_closed", []),
            "pid_alive": atomic_swap_health.get("pid_alive", False),
            "pid": atomic_swap_health.get("pid"),
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
    pool_metrics = {"active_miners": None, "hashrate": None, "blocks_found": None,
                    "pplns_window_size": 0, "pplns_window_used": 0, "pplns_rounds": 0,
                    "pplns_total_paid": 0, "pplns_total_unpaid": 0, "pplns_registered": 0}
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
                    elif line.startswith("zion_pool_pplns_window_size ") or line.startswith("zion_pplns_window_size "):
                        pool_metrics["pplns_window_size"] = int(line.split()[-1])
                    elif line.startswith("zion_pool_pplns_window_used ") or line.startswith("zion_pplns_window_used "):
                        pool_metrics["pplns_window_used"] = int(line.split()[-1])
                    elif line.startswith("zion_pool_pplns_payout_rounds ") or line.startswith("zion_pplns_payout_rounds "):
                        pool_metrics["pplns_rounds"] = int(line.split()[-1])
                    elif line.startswith("zion_pool_pplns_total_paid_flowers ") or line.startswith("zion_pplns_total_paid_flowers "):
                        pool_metrics["pplns_total_paid"] = int(line.split()[-1])
                    elif line.startswith("zion_pool_pplns_total_unpaid_flowers ") or line.startswith("zion_pplns_total_unpaid_flowers "):
                        pool_metrics["pplns_total_unpaid"] = int(line.split()[-1])
                    elif line.startswith("zion_pool_pplns_registered_miners ") or line.startswith("zion_pplns_registered_miners "):
                        pool_metrics["pplns_registered"] = int(line.split()[-1])
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
        "pplns_window_size": pool_metrics["pplns_window_size"],
        "pplns_window_used": pool_metrics["pplns_window_used"],
        "pplns_rounds": pool_metrics["pplns_rounds"],
        "pplns_total_paid_zion": flowers_to_zion(pool_metrics["pplns_total_paid"]),
        "pplns_total_unpaid_zion": flowers_to_zion(pool_metrics["pplns_total_unpaid"]),
        "pplns_registered_miners": pool_metrics["pplns_registered"],
    }

    # Compute sync gap between node1 and node2
    sync_gap = None
    if n1.get("chain_height") and n2.get("chain_height"):
        sync_gap = abs(n1["chain_height"] - n2["chain_height"])
        _ = sync_gap  # reserved for future alert threshold

    return {
        "timestamp": datetime.now().isoformat(),
        "topology": "local-dev",
        "v31_banner": {
            "height": n1.get("chain_height"),
            "sync_lag": None,
            "node_running": n1.get("running", False),
            "node_reachable": n1.get("running", False),
            "pool_hashrate_hps": pool_status.get("hashrate_khs") and float(pool_status["hashrate_khs"]) * 1000.0 or None,
            "shares_per_sec": None,
            "pool_total_shares": pool_status.get("total_shares"),
            "multichain_ok": False,
            "multichain_transfers_total": 0,
            "multichain_transfers_pending": 0,
            "dao_proposals_total": 0,
            "dao_proposals_active": 0,
        },
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
        # Backup script writes to /opt/zion/backups/{daily,weekly}/ (see
        # ZION_OS/infra/scripts/backup-edge.sh). Accept any recent archive
        # in either location. Fallback to /root/zion-backups for legacy.
        backup_dirs = [
            Path("/opt/zion/backups/daily"),
            Path("/opt/zion/backups/weekly"),
            Path("/root/zion-backups"),
        ]
        has_backups = any(
            bd.exists() and any(bd.glob("zion-edge-*.tar.gz"))
            for bd in backup_dirs
        )
        edge_backup_ok = timer_active and has_backups
    except Exception:
        pass

    if topology == "edge-primary":
        v31_node = status.get("v31_node", {})
        v31_pool = status.get("v31_pool", {})
        v31_miner = status.get("v31_miner", {})
        chain_height = v31_node.get("chain_height") or status.get("v31_node", {}).get("chain_height")
        checks = [
            {"id": "keys",       "label": "Offline key generation complete",          "ok": True},
            {"id": "env",        "label": "Env file assembled (.env.mainnet)",        "ok": True},
            {"id": "v31-node",   "label": "V31 Alpha Node running & synced (P2P)",     "ok": v31_node.get("running", False) and v31_node.get("chain_height") is not None},
            {"id": "v31-pool",   "label": "V31 Pool running & accepting miners",       "ok": v31_pool.get("running", False)},
            {"id": "v31-miner",  "label": "V31 Miner running",                         "ok": v31_miner.get("running", False)},
            {"id": "local-backup", "label": "Local Backup Node running & synced",      "ok": status.get("local_backup", {}).get("running", False) and status.get("local_backup", {}).get("known_peers", 0) > 0},
            {"id": "pool",       "label": "Edge Pool running & accepting miners",     "ok": status["pool"]["running"] and status["pool"]["active_sessions"] is not None},
            {"id": "pool-edge",  "label": "Edge Pool TCP reachable",                  "ok": status.get("pool_edge", {}).get("running", False)},
            {"id": "chain",      "label": "Chain height advancing",                   "ok": chain_height is not None and chain_height > 0},
            {"id": "payout",     "label": "Payout mechanism ready (fee split active)", "ok": status["pool"]["running"] and status["pool"]["fee_split"] == "89/5/5/1"},
            {"id": "fee_split",  "label": "Fee split 89/5/5/1 (burn model) active",    "ok": status["pool"]["fee_split"] == "89/5/5/1"},
            {"id": "logs",       "label": "Log directory writable",                   "ok": LOG_DIR.exists()},
            {"id": "node1",      "label": "Local Backup Node P2P synced",             "ok": status.get("local_backup", {}).get("running", False) and status.get("local_backup", {}).get("known_peers", 0) > 0},
            {"id": "miner",      "label": "Local GPU miner (optional)",               "ok": True},
            {"id": "edge-backup","label": "Edge database auto-backup (optional)",     "ok": edge_backup_ok},
        ]
    else:  # local-dev
        checks = [
            {"id": "keys",      "label": "Offline key generation complete",         "ok": True},
            {"id": "env",       "label": "Env file assembled (.env.mainnet)",       "ok": True},
            {"id": "node1",     "label": "Node 1 (Genesis) running",               "ok": status["node1"]["running"] and status["node1"]["p2p_bind"] is not None},
            {"id": "node2",     "label": "Node 2 (Follower) synced if running",    "ok": not status["node2"]["running"] or status["node2"]["known_peers"] > 0},
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
    # Edge-primary topology weights — V31 is production
    "v31-node": 20, "v31-pool": 10, "v31-miner": 10,
    "v31-multichain": 8, "v31-dao": 5, "v31-oasis": 3,
    # Legacy V3 services (archived, contribute 0)
    "edge-node": 0, "node1": 0, "pool-edge": 0, "miner": 0,
    # Local-dev topology weights (node1 becomes primary)
    "pool": 10,
    # Common L2-L6 weights (V3 archived; V31 multichain/dao/oasis above)
    "bridge": 0, "dao": 0, "atomic-swap": 0, "dex": 0, "warp": 0,
    "ai-native": 0, "hiranyagarbha": 0, "ncl": 0, "oasis": 0, "free-world": 0, "issobella": 0,
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
    v31_node = status.get("v31_node", {})
    v31_node2 = status.get("v31_node2", {})
    v31_node3 = status.get("v31_node3", {})

    def _sev(svc_id: str, default: str = "warning") -> str:
        svc = get_service(svc_id)
        return svc.get("severity", default) if svc else default

    if topology == "edge-primary":
        # V31 Node 1 (Primary) alerts
        if not v31_node.get("running"):
            alerts.append({"severity": _sev("v31-node", "critical"), "title": "V31 Node 1 (Primary) not reachable",
                           "detail": "V31 primary node on Edge (127.0.0.1:9445) is not responding. Check: systemctl status zion-v31-node",
                           "action": None})
        elif v31_node.get("chain_height") == 0:
            alerts.append({"severity": _sev("v31-node", "warning"), "title": "V31 chain stuck at height 0",
                           "detail": "V31 node 1 is up but no blocks have been mined yet.",
                           "action": None})

        # V31 Node 2 (Follower) alerts
        if not v31_node2.get("running"):
            alerts.append({"severity": _sev("v31-node2", "warning"), "title": "V31 Node 2 (Follower) not reachable",
                           "detail": "V31 follower node 2 (127.0.0.1:9446) is not responding. Check: systemctl status zion-v31-node2",
                           "action": None})

        # V31 Node 3 (Follower) alerts
        if not v31_node3.get("running"):
            alerts.append({"severity": _sev("v31-node3", "warning"), "title": "V31 Node 3 (Follower) not reachable",
                           "detail": "V31 follower node 3 (127.0.0.1:9447) is not responding. Check: systemctl status zion-v31-node3",
                           "action": None})

        # Sync gap: V31 Node 1 vs followers
        if v31_node.get("running") and v31_node.get("chain_height") is not None:
            for _fn, _fs in [("V31 Node 2", v31_node2), ("V31 Node 3", v31_node3)]:
                if _fs.get("running") and _fs.get("chain_height") is not None:
                    gap = abs(v31_node["chain_height"] - _fs["chain_height"])
                    if gap > 10:
                        alerts.append({"severity": "warning", "title": f"{_fn} far behind Node 1",
                                       "detail": f"Node1@{v31_node['chain_height']} vs {_fn}@{_fs['chain_height']} — gap {gap}",
                                       "action": None})

        # NOTE: Local backup node is intentionally not monitored on Edge (it lives
        # on the operator's local PC, not on the Edge server), so no alerts here.
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

    # Miner alerts: use V31 miner in edge-primary, legacy miner in local-dev
    _miner = status.get("v31_miner") if topology == "edge-primary" else miner
    if _miner and _miner.get("running") and not _miner.get("hashrate"):
        alerts.append({"severity": _sev("v31-miner", "warning"), "title": "Miner not hashing",
                       "detail": "V31 miner is active but no hashrate samples in recent logs. Check CPU/GPU init.",
                       "action": "restart-v31-miner"})

    if _miner and _miner.get("running") and _miner.get("hashrate") and _miner["hashrate"] < 1.0:
        alerts.append({"severity": "info", "title": "Low hashrate",
                       "detail": f"Hashrate {_miner['hashrate']} H/s seems low. Expected ~500-950 kH/s on CPU.",
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

def _add_block_event(key: str, ts: int, source: str, height: int, hash_hex: str | None, etype: str):
    with BLOCK_EVENTS_LOCK:
        if key not in (e["key"] for e in BLOCK_EVENTS):
            BLOCK_EVENTS.append({
                "key": key,
                "ts": ts,
                "source": source,
                "height": height,
                "hash": hash_hex,
                "type": etype,
            })

def scan_block_events():
    """Scan logs, the live chain, and the pool DB for new block events."""
    # Log-derived events (local-dev / non-Edge setups where node writes log files)
    for name in ("node1", "node2"):
        for line in tail_log(f"{name}.log", 500):
            if m := re.search(r'relay_block height=(\d+) hash=([a-f0-9…]+)', line):
                _add_block_event(
                    f"{name}-{m.group(1)}-{m.group(2)}",
                    int(time.time()), name, int(m.group(1)), m.group(2), "block_relay"
                )
    for line in tail_log("pool.log", 500):
        if m := re.search(r'BLOCK_FOUND.*height=(\d+)', line):
            _add_block_event(f"pool-found-{m.group(1)}", int(time.time()), "pool",
                            int(m.group(1)), None, "block_found")

    # Edge / log-less setups: use the live chain + pool DB
    try:
        explorer = build_explorer()
        now_ts = int(time.time())
        for blk in explorer.get("recent_blocks", [])[:20]:
            h = blk.get("height")
            if h is None:
                continue
            _add_block_event(f"node1-{h}", now_ts, "node1", h,
                             blk.get("hash"), "block_relay")
    except Exception:
        pass

    try:
        pool_data = get_pool_blocks(limit=20)
        now_ts = int(time.time())
        for blk in pool_data.get("blocks", [])[:20]:
            h = blk.get("height")
            if h is None:
                continue
            _add_block_event(f"pool-db-{h}", blk.get("ts", now_ts), "pool", h,
                             blk.get("hash"), "block_found")
    except Exception:
        pass

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
    # Security: strip any path components — only allow filenames in REPO_ROOT
    safe_name = Path(name).name
    if not safe_name.startswith(".env"):
        return {"error": "Only .env* files are allowed", "vars": []}
    path = REPO_ROOT / safe_name
    if not path.exists() or not path.is_file():
        return {"error": "File not found", "vars": []}
    # Double-check resolved path is within REPO_ROOT
    if not path.resolve().is_relative_to(REPO_ROOT.resolve()):
        return {"error": "Access denied", "vars": []}

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
                    display_value = "***REDACTED***" if is_sensitive else v
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

def _rpc_call_tcp(host: str, port: int, method: str, params: dict, timeout: float = 2.0) -> dict:
    """Raw TCP JSON-RPC call used by V31 node (port 9445).

    V31 node exposes a line-delimited JSON-RPC socket instead of HTTP.
    Sends a single JSON line and reads the response until the first newline.
    """
    req = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}) + "\n"
    try:
        with socket.create_connection((host, port), timeout=timeout) as s:
            s.settimeout(timeout)
            s.sendall(req.encode("utf-8"))
            resp = b""
            while True:
                chunk = s.recv(65536)
                if not chunk:
                    break
                resp += chunk
                if b"\n" in chunk:
                    break
            text = resp.decode("utf-8", errors="replace").strip()
            if not text:
                return {"_rpc_error": "empty TCP response"}
            r = json.loads(text.split("\n")[0])
            if "error" in r and r["error"]:
                return {"_rpc_error": r["error"]}
            return r.get("result")
    except Exception as e:
        return {"_rpc_error": str(e)[:120]}

def _get_node_rpc_addr() -> tuple:
    """Return canonical (host, port) for the active node RPC from env."""
    rpc_addr = os.environ.get("ZION_NODE_RPC_ADDR", "")
    if rpc_addr and ":" in rpc_addr:
        try:
            h, p = rpc_addr.rsplit(":", 1)
            return (h or "127.0.0.1", int(p))
        except Exception:
            pass
    return ("127.0.0.1", 9445)

def rpc_call(host: str, port: int, method: str, params: dict, timeout: float = 2.0) -> dict:
    """JSON-RPC call to ZION node.

    V31 nodes (port 9445) use raw TCP JSON-RPC, so we route those directly.
    If the caller still targets the legacy port 9443 on localhost but
    ZION_NODE_RPC_ADDR points to a different (V31) port, honour the configured
    node address.  We do not overwrite an explicit remote host.
    """
    # Honour active node RPC config when legacy localhost port 9443 is requested
    if port == 9443 and host in ("127.0.0.1", "localhost", "0.0.0.0"):
        cfg_host, cfg_port = _get_node_rpc_addr()
        if cfg_port != 9443:
            host, port = cfg_host, cfg_port
    if port == 9445:
        return _rpc_call_tcp(host, port, method, params, timeout=timeout)
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

def parse_premine_from_genesis(rpc_host: str = None, rpc_port: int = None) -> list:
    """Extract premine addresses and amounts from the actual genesis block via RPC.
    This reflects the true on-chain state, which may differ from PREMINE_ADDRESSES_PUBLIC.txt
    after wallet rotation."""
    wallets = []
    cfg_host, cfg_port = _get_node_rpc_addr()
    if rpc_host is None:
        rpc_host = cfg_host
    if rpc_port is None:
        rpc_port = cfg_port
    genesis = rpc_call(rpc_host, rpc_port, "getBlockByHeight", {"height": 0}, timeout=2.0)
    if not genesis or not genesis.get("transactions"):
        # Fallback to Edge RPC
        genesis = rpc_call(EDGE_HOST, 9445, "getBlockByHeight", {"height": 0}, timeout=2.0)
    if not genesis or not genesis.get("transactions"):
        # Fallback to public Edge RPC
        genesis = rpc_call(EDGE_PUBLIC_IP, 8443, "getBlockByHeight", {"height": 0}, timeout=3.0)
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
        "Bridge Seed Fund — EVM Bridge Liquidity",
        "Bridge Vault UTXO — EVM Bridge Unlock Liquidity",
    ]
    tx_lists = [
        genesis.get("transactions", []),
        genesis.get("utxo_transactions", []),
    ]
    i = 0
    for tx_group in tx_lists:
        for tx in tx_group:
            if not isinstance(tx, dict):
                continue
            # V31 genesis UTXO: { outputs: [{ amount, address: <string> }] }
            outputs = tx.get("outputs", [])
            if outputs:
                for out in outputs:
                    if not isinstance(out, dict):
                        continue
                    addr = out.get("address", "") or ""
                    if isinstance(addr, dict):
                        addr = addr.get("encoded", "")
                    amt = out.get("amount", 0)
                    if isinstance(amt, dict):
                        amt = amt.get("0", 0)
                    if not addr:
                        continue
                    amount = int(amt) if amt is not None else 0
                    wallets.append({
                        "index": i + 1,
                        "address": addr,
                        "label": labels[i] if i < len(labels) else f"Premine Output {i+1}",
                        "amount_zion": flowers_to_zion(amount),  # flowers -> ZION (auto-detects legacy 1e12)
                        "source": "genesis",
                        "category": "premine",
                    })
                    i += 1
            else:
                # V31 account transaction: { to, amount_zion }
                addr = tx.get("to", "")
                raw = tx.get("amount_zion", "0")
                if isinstance(raw, dict):
                    raw = raw.get("0", "0")
                amount = int(raw) if raw is not None else 0
                if not addr:
                    continue
                wallets.append({
                    "index": i + 1,
                    "address": addr,
                    "label": labels[i] if i < len(labels) else f"Premine Output {i+1}",
                    "amount_zion": flowers_to_zion(amount),  # flowers -> ZION (auto-detects legacy 1e12)
                    "source": "genesis",
                    "category": "premine",
                })
                i += 1
    return wallets

def parse_premine_from_file() -> list:
    """Parse PREMINE_ADDRESSES_PUBLIC.txt for canonical premine wallet list."""
    for path in [REPO_ROOT / "PREMINE_ADDRESSES_PUBLIC.txt",
                 REPO_ROOT / "docs" / "PREMINE_ADDRESSES_PUBLIC.txt"]:
        if path.exists():
            break
    else:
        path = None
    wallets = []
    if not path:
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

    # 2. Operational wallets — prefer actual recipients from the latest block,
    #    then env / canonical V31 addresses. We use real on-chain balances, so
    #    we need the real payout addresses from the current chain tip.
    node_addrs = parse_node_startup_addresses()
    latest_recipients = _get_latest_block_recipients(timeout=3.0)
    rpc_host, rpc_port = _get_node_rpc_addr()
    _ping = rpc_call(rpc_host, rpc_port, "getChainInfo", {}, timeout=1.5)
    rpc_reachable = _ping and not _ping.get("_rpc_error")
    if not rpc_reachable:
        node_addrs = {}
    # Canonical Edge pool wallet (AGENTS.md) — always include
    canonical_pool = V31_CANONICAL_POOL_PAYOUT_WALLET
    op_sources = [
        (canonical_pool, "Pool Canonical (Main Payout)", "canonical"),
        (latest_recipients.get("miner") or find_env_value("ZION_MINER_ADDRESS") or node_addrs.get("miner") or V31_CANONICAL_DEFAULT_MINER_WALLET, "Miner Payout", "node"),
        (latest_recipients.get("humanitarian") or find_env_value("ZION_HUMANITARIAN_WALLET") or node_addrs.get("humanitarian") or V31_CANONICAL_HUMANITARIAN_WALLET, "Humanitarian Tithe", "node"),
        (latest_recipients.get("issobella") or find_env_value("ZION_ISSOBELLA_WALLET") or node_addrs.get("issobella") or V31_CANONICAL_ISSOBELLA_WALLET, "Issobella Fund", "node"),
        (find_env_value("ZION_POOL_FEE_WALLET") or node_addrs.get("pool_fee") or V31_CANONICAL_POOL_FEE_WALLET, "Pool Fee Recipient", "node"),
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
                        active_miner = node_addrs.get("miner") or find_env_value("ZION_MINER_ADDRESS") or V31_CANONICAL_DEFAULT_MINER_WALLET
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

    # 4. On-chain UTXO balance via fast getUtxos RPC (replaces block-by-block scan).
    for w in wallets:
        addr = w.get("address", "")
        if addr and addr.startswith("zion1"):
            atomic, ok = _get_on_chain_balance(addr)
            if ok:
                w["balance_zion"] = flowers_to_zion(atomic)
                w["balance_atomic"] = atomic
                w["balance_source"] = "utxo"
                w["rpc_ok"] = True
            else:
                w["balance_zion"] = None
                w["balance_atomic"] = None
                w["balance_source"] = "rpc_unavailable"
                w["rpc_ok"] = False
        else:
            w["balance_zion"] = None
            w["balance_atomic"] = None
            w["balance_source"] = "no_address"
            w["rpc_ok"] = False

    # 5. Fallback if getUtxos RPC failed:
    #    - Premine wallets: use the genesis output amount (authoritative from block 0).
    #    - Operational wallets: show 0 when no live data is available.
    for w in wallets:
        if w.get("rpc_ok"):
            continue
        if w.get("category") == "premine" and w.get("amount_zion"):
            w["balance_zion"] = float(w["amount_zion"])
            w["balance_atomic"] = int(w["amount_zion"] * FLOWERS_PER_ZION)
            w["balance_source"] = "genesis"
            w["rpc_ok"] = False
        elif w.get("category") == "operational":
            w["balance_zion"] = None
            w["balance_atomic"] = None
            w["balance_source"] = "estimated"

    total_premine = sum(w.get("amount_zion", 0) for w in wallets if w.get("category") == "premine")
    with_balance = [w for w in wallets if w.get("balance_zion") is not None]
    live_balance_count = len([w for w in wallets if w.get("rpc_ok")])

    # Category breakdown for premine (canonical V31 ordering from genesis block 0)
    category_summary = {}
    for w in wallets:
        if w.get("category") == "premine":
            idx = w.get("index")
            label = w.get("label", "")
            if isinstance(idx, int) and 1 <= idx <= 14:
                if 1 <= idx <= 5:
                    group = "oasis"
                elif 6 <= idx <= 8:
                    group = "dao"
                elif 9 <= idx <= 11:
                    group = "infrastructure"
                elif idx == 12:
                    group = "humanitarian"
                elif idx == 13:
                    group = "bridge_seed"
                elif idx == 14:
                    group = "bridge_vault_utxo"
                else:
                    group = "other"
            else:
                # Group by purpose label as a fallback
                if "OASIS" in label:
                    group = "oasis"
                elif "DAO" in label:
                    group = "dao"
                elif "Core Dev" in label or "Infrastructure" in label or "Creator" in label or "Seed" in label:
                    group = "infrastructure"
                elif "Humanitarian" in label or "Children" in label:
                    group = "humanitarian"
                elif "Issobella" in label or "Space" in label:
                    group = "issobella"
                else:
                    group = "other"
            category_summary.setdefault(group, {"count": 0, "total_zion": 0, "labels": []})
            category_summary[group]["count"] += 1
            amt = w.get("amount_zion", 0)
            if isinstance(amt, (int, float)):
                category_summary[group]["total_zion"] += amt
            category_summary[group]["labels"].append(label[:40])

    # Operational breakdown
    op_total = sum((w.get("balance_zion") or 0) for w in wallets if w.get("category") == "operational")

    # scan_ok now reflects whether getUtxos RPC lookups succeeded for at least one wallet
    scan_ok = live_balance_count > 0

    return {
        "ok": True,
        "wallets": wallets,
        "summary": {
            "total_wallets": len(wallets),
            "premine_wallets": len(premine),
            "operational_wallets": len([w for w in wallets if w.get("category") == "operational"]),
            "with_live_balance": live_balance_count,
            "with_balance": len(with_balance),
            "total_premine_zion": total_premine,
            "total_operational_zion": round(op_total, 6),
        },
        "category_summary": category_summary,
        "rpc": {"host": EDGE_PUBLIC_IP if scan_ok else "127.0.0.1", "port": 8443 if scan_ok else 9445, "reachable": scan_ok},
    }

# ── Block detail ────────────────────────────────────────────────────────

def _bytes_to_hex(obj) -> str:
    """Convert a list of byte values to a hex string."""
    if isinstance(obj, list) and obj:
        try:
            return "".join(f"{b:02x}" for b in obj)
        except Exception:
            return "—"
    return "—"


def get_block_detail(height: int = None, hash_hex: str = None) -> dict:
    """Fetch full block details by height or hash."""
    blk = None
    if height is not None:
        blk, _, _ = _rpc_with_fallback("getBlockByHeight", {"height": height}, timeout=2)
    elif hash_hex:
        # Try canonical V3 method first, fall back to legacy getBlockByHash.
        blk, _, _ = _rpc_with_fallback("getBlock", {"hash": hash_hex}, timeout=2)
        if not blk or blk.get("_rpc_error"):
            blk, _, _ = _rpc_with_fallback("getBlockByHash", {"hash": hash_hex}, timeout=2)
    if not blk or blk.get("_rpc_error"):
        return {"found": False, "error": blk.get("_rpc_error") if blk else "RPC unavailable"}

    header = blk.get("header", {}) if isinstance(blk, dict) else {}
    # V31 fields: hash is stored_hash bytes, timestamp is in header, previous_hash is parent
    block_hash = blk.get("hash_hex") or _bytes_to_hex(blk.get("stored_hash")) or _bytes_to_hex(header.get("previous_hash"))
    prev_hash = blk.get("prev_hash_hex") or _bytes_to_hex(header.get("previous_hash"))
    height = blk.get("height") or (header.get("height") if isinstance(header, dict) else None)
    timestamp = blk.get("timestamp") or (header.get("timestamp") if isinstance(header, dict) else None)
    difficulty = blk.get("difficulty") or (header.get("difficulty") if isinstance(header, dict) else None)

    tx_list = []
    reward_zion = 0.0
    total_fees_zion = 0.0
    for tx in blk.get("transactions", []):
        from_addr = tx.get("from") or tx.get("from_address") or "—"
        to_addr = tx.get("to") or tx.get("to_address") or "—"
        amount = tx.get("amount_zion", 0)
        fee = tx.get("fee_zion", 0)
        try:
            amount_f = float(amount) / 1_000_000
        except Exception:
            amount_f = 0.0
        try:
            fee_f = float(fee) / 1_000_000
        except Exception:
            fee_f = 0.0
        if from_addr == "coinbase":
            reward_zion += amount_f
        total_fees_zion += fee_f
        tx_list.append({
            "tx_id": tx.get("tx_id", "—"),
            "type": "coinbase" if from_addr == "coinbase" else tx.get("tx_type", "transfer"),
            "from": from_addr,
            "to": to_addr,
            "amount_zion": amount,
            "fee_zion": fee,
        })

    return {
        "found": True,
        "height": height,
        "hash": block_hash or "—",
        "timestamp": timestamp,
        "difficulty": difficulty,
        "miner": blk.get("miner_address", "—"),
        "reward_zion": round(reward_zion, 6),
        "total_fees_zion": round(total_fees_zion, 6),
        "nonce": blk.get("nonce"),
        "prev_hash": prev_hash,
        "tx_count": len(tx_list),
        "transactions": tx_list,
        "body_hash": blk.get("body_hash_hex", "—"),
    }

# ── Mempool detail ────────────────────────────────────────────────────

def _parse_mempool_tx(tx: dict) -> dict:
    """Normalize a transaction dict for the mempool UI."""
    return {
        "tx_id": tx.get("tx_id") or tx.get("txid") or tx.get("hash") or "—",
        "from": tx.get("from") or "—",
        "to": tx.get("to") or "—",
        "amount_zion": float(tx.get("amount_zion", 0)) if tx.get("amount_zion") is not None else 0,
        "fee_zion": float(tx.get("fee_zion", 0)) if tx.get("fee_zion") is not None else 0,
    }

@_ttl_cache_fn(2.0)
def get_mempool_detail() -> dict:
    """Fetch mempool transactions and stats via getMempoolInfo + getBlockTemplate RPC."""
    info, rpc_host, rpc_port = _rpc_with_fallback("getMempoolInfo", {}, timeout=1.5)
    if info and not info.get("_rpc_error"):
        template, _, _ = _rpc_with_fallback("getBlockTemplate", {}, timeout=1.5)
        template = template or {}
        tx_ids = template.get("transaction_ids", [])
        tx_count = info.get("size", 0) or len(tx_ids)
        transactions = []
        for txid in tx_ids[:50]:
            tx, _, _ = _rpc_with_fallback("getTransaction", {"txid": txid}, timeout=0.8)
            if tx and not tx.get("_rpc_error") and (tx.get("tx_id") or tx.get("txid")):
                transactions.append(_parse_mempool_tx(tx))
            else:
                transactions.append({
                    "tx_id": txid,
                    "from": "—",
                    "to": "—",
                    "amount_zion": 0,
                    "fee_zion": 0,
                })
        return {
            "rpc_reachable": True,
            "tx_count": tx_count,
            "template_tx_count": info.get("template_transactions", len(tx_ids)),
            "total_fees_zion": info.get("template_total_fees_zion", template.get("total_fees_zion", 0)),
            "transaction_model": info.get("transaction_model", "hybrid"),
            "transactions": transactions,
        }
    # Fallback to getChainInfo
    info, _, _ = _rpc_with_fallback("getChainInfo", {}, timeout=1.5)
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
    """Parse miner.log (or miner-low.log) for accepted/rejected shares over time.
    On Edge (no local miner log) fall back to the in-memory pool metrics history."""
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

    # Edge fallback: use the live pool metrics history recorded by the dashboard
    if not history and (TOPOLOGY == "edge-primary" or not miner_log_exists()):
        for s in HISTORY.snapshot()[-limit:]:
            history.append({
                "t": s.get("t"),
                "accepted": s.get("shares_ok", 0),
                "rejected": s.get("shares_bad", 0),
                "hashrate": s.get("hashrate", 0),
            })
        # If we still have no history, return the current live pool sample
        if not history:
            ps = get_pool_status() or {}
            history = [{
                "accepted": ps.get("shares_accepted", 0),
                "rejected": ps.get("shares_rejected", 0),
                "hashrate": ps.get("hashrate", 0),
            }]

    # Deduplicate by accepted count (keep last occurrence)
    seen = set()
    dedup = []
    for h in reversed(history):
        key = (h.get("accepted"), h.get("rejected"))
        if key not in seen:
            seen.add(key)
            dedup.append(h)
    dedup.reverse()
    return {"samples": dedup[-limit:]}


def miner_log_exists() -> bool:
    """Return True if a non-empty local miner log file exists."""
    for name in ("miner.log", "miner-low.log"):
        for path in _log_search_paths(name):
            try:
                if path.exists() and path.stat().st_size > 0:
                    return True
            except Exception:
                pass
    return False

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

# ── Decade Decay helpers (mirror src/lib/constants.ts + src/lib/supply.ts) ──

_BLOCK_REWARD_ZION_PY = 5_400.067
_DECAY_FACTOR_PY = 0.8
_BLOCKS_PER_DECADE_PY = 5_256_000
_MAX_DECAY_DECADES_PY = 10
_TAIL_REWARD_ZION_PY = 724.785
_TOTAL_SUPPLY_ZION_PY = 144_000_000_000
_GENESIS_PREMINE_ZION_PY = 16_780_000_000
# V31 fee_split burns 1% of the block subsidy as pool fee; only 99% is minted.
_MINTED_SUBSIDY_PCT_PY = 0.99


def _block_reward_at_height(height: int) -> float:
    if height <= 0:
        return 0.0
    decade = (height - 1) // _BLOCKS_PER_DECADE_PY
    if decade >= _MAX_DECAY_DECADES_PY:
        return _TAIL_REWARD_ZION_PY
    return _BLOCK_REWARD_ZION_PY * (_DECAY_FACTOR_PY ** decade)


def _estimate_mined_supply_at_height(height: int) -> float:
    remaining = max(0, int(height))
    mined = 0.0
    decade = 0
    while remaining > 0 and decade < _MAX_DECAY_DECADES_PY:
        blocks_this_decade = min(remaining, _BLOCKS_PER_DECADE_PY)
        # Only 99% of each block subsidy is minted; 1% is burned as pool fee.
        mined += blocks_this_decade * _block_reward_at_height(max(1, decade * _BLOCKS_PER_DECADE_PY + 1)) * _MINTED_SUBSIDY_PCT_PY
        remaining -= blocks_this_decade
        decade += 1
    if remaining > 0:
        mined += remaining * _TAIL_REWARD_ZION_PY * _MINTED_SUBSIDY_PCT_PY
    max_mineable = max(0.0, _TOTAL_SUPPLY_ZION_PY - _GENESIS_PREMINE_ZION_PY)
    return max(0.0, min(mined, max_mineable))


def _estimate_circulating_supply_at_height(height: int) -> float:
    return min(
        _GENESIS_PREMINE_ZION_PY + _estimate_mined_supply_at_height(height),
        _TOTAL_SUPPLY_ZION_PY,
    )


def _rpc_with_fallback(method: str, params: dict, timeout: float = 2.0):
    """Call RPC on the configured local endpoint, falling back to Edge.
    Returns (result, effective_host, effective_port)."""
    rpc_host, rpc_port = _get_node_rpc_addr()

    result = rpc_call(rpc_host, rpc_port, method, params, timeout=timeout)
    if result and not result.get("_rpc_error"):
        return result, rpc_host, rpc_port

    # Fallback to Edge RPC
    result = rpc_call(EDGE_HOST, 9445, method, params, timeout=timeout)
    if result and not result.get("_rpc_error"):
        return result, EDGE_HOST, 9445

    # Final fallback: public Edge RPC (nginx TCP stream on 8443 -> V31 node)
    result = rpc_call(EDGE_PUBLIC_IP, 8443, method, params, timeout=timeout)
    if result and not result.get("_rpc_error"):
        return result, EDGE_PUBLIC_IP, 8443
    return None, rpc_host, rpc_port


# ── On-chain UTXO balance scanner ──────────────────────────────────────

# Persistent incremental UTXO scanner state.
_UTXO_SCAN: dict = {
    "lock": threading.Lock(),
    "last_height": -1,
    "last_tip_hash": None,
    "utxo": {},  # (txid, vout) -> (address, amount_flowers)
}


def _apply_block_to_utxo(utxo: dict, blk: dict) -> None:
    """Apply a single block's transactions to the UTXO set in-place."""
    tx_lists = [blk.get("transactions", []), blk.get("utxo_transactions", [])]
    for tx_group in tx_lists:
        if not isinstance(tx_group, list):
            continue
        for tx in tx_group:
            if not isinstance(tx, dict):
                continue
            tx_id = tx.get("tx_id") or tx.get("transaction_id")
            if not tx_id:
                continue
            # Mark inputs as spent
            for inp in tx.get("inputs", []):
                if not isinstance(inp, dict):
                    continue
                po = inp.get("previous_output")
                if po is None:
                    continue
                if isinstance(po, dict):
                    prev_tx = po.get("tx_id") or po.get("transaction_id")
                    vout = int(po.get("index", po.get("vout", 0)) or 0)
                elif isinstance(po, str):
                    prev_tx = po
                    vout = int(inp.get("index", 0) or 0)
                else:
                    continue
                if prev_tx:
                    utxo.pop((prev_tx, vout), None)
            # Record outputs
            for idx, out in enumerate(tx.get("outputs", [])):
                if not isinstance(out, dict):
                    continue
                addr = out.get("address") or out.get("to")
                if not addr:
                    continue
                try:
                    amount = int(out.get("amount", 0))
                except (ValueError, TypeError):
                    amount = 0
                if amount < 0:
                    amount = 0
                utxo[(tx_id, idx)] = (addr, amount)


@_ttl_cache_fn(15.0)
def _scan_all_utxo_balances(timeout_per_block: float = 3.0, max_total_time: float = 60.0) -> dict:
    """Return address -> flowers for all unspent UTXOs.

    Uses an in-memory incremental cache: on the first call it walks the whole
    chain, on subsequent calls it only fetches newly added blocks. If the tip
    hash changed without the height growing, the cache is reset to handle
    re-orgs.
    """
    start = time.monotonic()
    chain_info, _, _ = _rpc_with_fallback("getChainInfo", {}, timeout=5.0)
    if not chain_info or chain_info.get("_rpc_error"):
        return {}
    height = int(chain_info.get("chain_height", 0) or 0)
    tip_hash = chain_info.get("tip_hash") or chain_info.get("native_tip_hash")

    state = _UTXO_SCAN
    with state["lock"]:
        # Detect re-org or first run
        if height <= 0:
            state["last_height"] = -1
            state["last_tip_hash"] = None
            state["utxo"].clear()
            return {}

        reset = (
            state["last_height"] < 0
            or height < state["last_height"]
            or (height == state["last_height"] and tip_hash and tip_hash != state["last_tip_hash"])
        )
        if reset:
            state["last_height"] = -1
            state["last_tip_hash"] = None
            state["utxo"].clear()

        start_height = state["last_height"] + 1
        # Scan new blocks only
        for h in range(start_height, height + 1):
            if time.monotonic() - start > max_total_time:
                break
            blk, _, _ = _rpc_with_fallback("getBlockByHeight", {"height": h}, timeout=timeout_per_block)
            if not blk or (isinstance(blk, dict) and blk.get("_rpc_error")):
                continue
            if not isinstance(blk, dict):
                continue
            _apply_block_to_utxo(state["utxo"], blk)

        state["last_height"] = height
        if tip_hash:
            state["last_tip_hash"] = tip_hash

        # Build balances from current UTXO set
        balances: dict[str, int] = {}
        for (tx_id, vout), (addr, amount) in state["utxo"].items():
            balances[addr] = balances.get(addr, 0) + amount
        return balances


@_ttl_cache_fn(15.0)
def _get_utxo_balance(address: str) -> int:
    """Return the confirmed UTXO balance (in flowers) for a single address.

    Uses the node's `getUtxos` RPC, which is authoritative and O(1) per
    address instead of scanning the whole chain block-by-block. Cached for
    15 s so multiple dashboard panels can reuse the same lookup cheaply.
    """
    if not address or not isinstance(address, str) or not address.startswith("zion1"):
        return 0
    try:
        result, _, _ = _rpc_with_fallback("getUtxos", [address], timeout=5.0)
        if not result or not isinstance(result, dict) or result.get("_rpc_error"):
            return 0
        utxos = result.get("utxos") or []
        return sum(int(u.get("amount", 0)) for u in utxos)
    except Exception:
        return 0


def _get_on_chain_balance(address: str, scan: dict = None) -> tuple[int, bool]:
    """Return (balance_flowers, ok) for a single address.

    Prefers the fast `getUtxos` RPC. The legacy `scan` dict is accepted but
    no longer required; it is only used as a fallback if the RPC fails.
    """
    if not address or not isinstance(address, str) or not address.startswith("zion1"):
        return 0, False
    try:
        bal = _get_utxo_balance(address)
        return bal, True
    except Exception:
        pass
    if scan:
        return int(scan.get(address, 0)), bool(scan)
    return 0, False


def _get_latest_block_recipients(timeout: float = 5.0) -> dict:
    """Return {miner, humanitarian, issobella} from the tip block.

    V31 coinbase transactions have outputs ordered [miner, humanitarian,
    issobella]. If the order is ambiguous (e.g. equal 5% outputs), we prefer
    the first coinbase tx output for the miner and the remaining two for
    humanitarian / issobella.
    """
    try:
        info, _, _ = _rpc_with_fallback("getChainInfo", {}, timeout=timeout)
        height = (info or {}).get("chain_height", 0) if isinstance(info, dict) else 0
        if not height:
            return {}
        blk, _, _ = _rpc_with_fallback("getBlockByHeight", {"height": height}, timeout=timeout)
        if not blk or not isinstance(blk, dict) or blk.get("_rpc_error"):
            return {}
        miner = blk.get("miner_address")
        txs = blk.get("transactions", [])
        coinbase = None
        for tx in txs:
            if not isinstance(tx, dict):
                continue
            if not tx.get("inputs"):
                coinbase = tx
                break
        if not coinbase:
            coinbase = txs[0] if txs else None
        outputs = (coinbase or {}).get("outputs", []) if isinstance(coinbase, dict) else []
        out_addrs = [o.get("address") for o in outputs if isinstance(o, dict)]
        recipients = {}
        if miner:
            recipients["miner"] = miner
        if out_addrs:
            if not recipients.get("miner"):
                recipients["miner"] = out_addrs[0]
            if len(out_addrs) >= 2:
                recipients["humanitarian"] = out_addrs[1]
            if len(out_addrs) >= 3:
                recipients["issobella"] = out_addrs[2]
        return recipients
    except Exception:
        return {}


@_ttl_cache_fn(60.0)
def _get_active_miner_wallet() -> str:
    """Return the best available active miner payout address.

    Priority:
      1. miner address from the latest block (authoritative for current chain tip)
      2. ZION_MINER_ADDRESS env / .env files
      3. wallet from zion.toml [miner] section
      4. canonical V31 default miner wallet
    """
    # 1. live tip block
    try:
        latest = _get_latest_block_recipients(timeout=3.0)
        addr = latest.get("miner", "")
        if addr and addr.startswith("zion1"):
            return addr
    except Exception:
        pass

    # 2. env / .env files
    env_addr = find_env_value("ZION_MINER_ADDRESS")
    if env_addr and env_addr.startswith("zion1"):
        return env_addr

    # 3. zion.toml [miner] wallet
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
                        if addr and addr.startswith("zion1"):
                            return addr
                    if line.startswith("[") and "]" in line and not line.startswith("[miner"):
                        # Reached next section without finding wallet
                        break
        except Exception:
            pass

    # 4. canonical fallback
    return V31_CANONICAL_DEFAULT_MINER_WALLET


# ── Explorer data builder ──────────────────────────────────────────────

@_ttl_cache_fn(5.0)
def build_explorer() -> dict:
    """Fetch blockchain overview for the Explorer tab."""
    info, rpc_host, rpc_port = _rpc_with_fallback("getChainInfo", {}, timeout=2.5)
    chain_height = info.get("chain_height", 0) if info else 0

    # Genesis block with fallback
    genesis, _, _ = _rpc_with_fallback("getBlockByHeight", {"height": 0}, timeout=1.5)

    # Recent blocks: grab last 10 with short timeouts
    recent_blocks = []
    try:
        for h in range(max(0, chain_height - 9), chain_height + 1):
            blk = rpc_call(rpc_host, rpc_port, "getBlockByHeight", {"height": h}, timeout=0.5)
            if not blk or blk.get("_rpc_error"):
                continue
            # V31 block: { "header": { "height", "timestamp", "difficulty", ... }, "transactions": [...] }
            # V3 block: flat { "height", "timestamp", "difficulty", "hash_hex", "transaction_ids" / "transactions" }
            header = blk.get("header", {}) if isinstance(blk, dict) else {}
            transactions = blk.get("transactions", []) if isinstance(blk, dict) else []
            tx_ids = blk.get("transaction_ids", []) if isinstance(blk, dict) else []
            # V31: difficulty/height are top-level; timestamp is in header
            height = blk.get("height", h) if isinstance(blk, dict) else h
            if height is None and isinstance(header, dict):
                height = header.get("height", h)
            timestamp = (header.get("timestamp") if isinstance(header, dict) else None) if isinstance(header, dict) else None
            if timestamp is None and isinstance(blk, dict):
                timestamp = blk.get("timestamp", 0)
            difficulty = blk.get("difficulty") if isinstance(blk, dict) else 0
            if difficulty is None and isinstance(header, dict):
                difficulty = header.get("difficulty", 0)
            tx_count = len(tx_ids) if tx_ids else len(transactions)
            # V31 block hash is stored_hash (list of bytes); previous_hash is the parent.
            hash_hex = blk.get("hash_hex")
            if not hash_hex:
                stored = blk.get("stored_hash") if isinstance(blk, dict) else None
                if isinstance(stored, list) and stored:
                    try:
                        hash_hex = "".join(f"{b:02x}" for b in stored)
                    except Exception:
                        hash_hex = None
            if not hash_hex and isinstance(header, dict):
                prev = header.get("previous_hash")
                if isinstance(prev, list) and prev:
                    try:
                        hash_hex = "".join(f"{b:02x}" for b in prev)
                    except Exception:
                        hash_hex = "—"
                else:
                    hash_hex = "—"
            # Truncate the hash for the overview table (explorer uses its own full copy)
            if hash_hex and hash_hex != "—":
                hash_display = hash_hex[:24] + "…"
            else:
                hash_display = hash_hex
            recent_blocks.append({
                "height": height,
                "hash": hash_display,
                "timestamp": timestamp,
                "tx_count": tx_count,
                "difficulty": difficulty,
            })
    except Exception:
        pass

    # Mempool
    mempool_size = info.get("mempool_transactions", 0) if info else 0
    template_txs = info.get("active_template_transactions", 0) if info else 0

    # Supply estimate using Decade Decay
    block_reward = _block_reward_at_height(max(1, chain_height))
    circulating_estimate = _estimate_circulating_supply_at_height(chain_height)

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
        "block_reward_zion": round(block_reward, 6),
        "estimated_circulating_zion": round(circulating_estimate, 2),
        "total_supply_zion": _TOTAL_SUPPLY_ZION_PY,
        "premine_zion": _GENESIS_PREMINE_ZION_PY,
        "genesis_hash": genesis.get("hash_hex", "")[:24] + "…" if genesis else "—",
        "recent_blocks": recent_blocks,
        "peer_count": peer_count,
        "protocol_version": info.get("protocol_version", "") if info else "",
        "fee_split": "89/5/5/1",
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
        combined_cmd = "cat /proc/loadavg && free -m && df -h / | tail -1 && echo '===TOP===' && ps -eo rss,comm --sort=-rss | head -6 | tail -5 && echo '===SVC===' && systemctl is-active zion-v31-node zion-v31-pool zion-v31-miner zion-v31-multichain zion-v31-watchdog.timer zion-v31-dao zion-v31-oasis zion-edge-python-dashboard zion-website zion-marketplace nginx 2>/dev/null"
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
        svc_names = ["v31-node", "v31-pool", "v31-miner", "v31-multichain",
                     "v31-watchdog", "v31-dao", "v31-oasis", "dashboard",
                     "website", "marketplace", "nginx"]
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
        "restart-node1":          "sudo systemctl restart zion-node",
        "restart-node2":          "echo 'node2 not deployed on v3.0.4 single-server topology'",
        "restart-v31-node":       "sudo systemctl restart zion-v31-node.service",
        "stop-v31-node":          "sudo systemctl stop zion-v31-node.service",
        "start-v31-node":         "sudo systemctl start zion-v31-node.service",
        "restart-v31-node2":      "sudo systemctl restart zion-v31-node2.service",
        "stop-v31-node2":         "sudo systemctl stop zion-v31-node2.service",
        "start-v31-node2":        "sudo systemctl start zion-v31-node2.service",
        "restart-v31-node3":      "sudo systemctl restart zion-v31-node3.service",
        "stop-v31-node3":         "sudo systemctl stop zion-v31-node3.service",
        "start-v31-node3":        "sudo systemctl start zion-v31-node3.service",
        "restart-v31-pool":       "sudo systemctl restart zion-v31-pool.service",
        "stop-v31-pool":          "sudo systemctl stop zion-v31-pool.service",
        "start-v31-pool":         "sudo systemctl start zion-v31-pool.service",
        "restart-v31-miner":      "sudo systemctl restart zion-v31-miner.service",
        "stop-v31-miner":         "sudo systemctl stop zion-v31-miner.service",
        "start-v31-miner":        "sudo systemctl start zion-v31-miner.service",
        "restart-v31-multichain": "sudo systemctl restart zion-v31-multichain.service",
        "stop-v31-multichain":    "sudo systemctl stop zion-v31-multichain.service",
        "start-v31-multichain":   "sudo systemctl start zion-v31-multichain.service",
        "restart-pool":           "sudo systemctl restart zion-pool",
        "restart-dao":            "sudo systemctl restart zion-dao",
        "restart-warp":           "sudo systemctl restart zion-warp",
        "restart-dashboard":      "sudo systemctl restart zion-dashboard",
        "restart-hiran":          "sudo systemctl restart zion-hiran-inference 2>/dev/null || echo 'hiran not deployed'",
        "restart-hiranyagarbha":  "sudo systemctl restart zion-hiranyagarbha 2>/dev/null || echo 'hiranyagarbha not deployed'",
        "restart-bridge":         "sudo systemctl restart zion-bridge",
        "restart-website":        "sudo systemctl restart zion-website 2>&1",
        "clean-docker":           "docker builder prune -af 2>&1; docker image prune -af 2>&1; docker container prune -f 2>&1",
        "security-audit":         "echo 'Security audit placeholder — run manually'",
        "full-health":            "sudo systemctl is-active zion-v31-node zion-v31-pool zion-v31-miner zion-v31-multichain zion-v31-watchdog.timer zion-v31-dao zion-v31-oasis zion-website zion-marketplace nginx 2>&1",
        "memory-limit":           "echo 'Memory limits configured in systemd unit files'",
        # ── Edge maintenance (scripts/edge-maintenance.sh) ───────────────
        # Safe: never touches critical services (node/pool/bridge/dao/warp).
        # See scripts/edge-maintenance.sh for full documentation.
        "maint-disk":             "sudo /opt/zion/scripts/edge-maintenance.sh disk --force 2>&1",
        "maint-ram":              "sudo /opt/zion/scripts/edge-maintenance.sh ram --force 2>&1",
        "maint-all":              "sudo /opt/zion/scripts/edge-maintenance.sh all --force 2>&1",
        "maint-dry-run":          "sudo /opt/zion/scripts/edge-maintenance.sh all --dry-run --verbose 2>&1",
        "maint-status":           "/opt/zion/scripts/edge-maintenance.sh status 2>&1 || echo 'maintenance script not installed'",
    }

    cmd = ACTION_MAP.get(action)
    if not cmd:
        return {"ok": False, "error": f"Unknown action: {action}"}

    try:
        # Maintenance actions can take several minutes (docker prune, apt clean).
        # Other actions stay at 30s.
        if action.startswith("maint-"):
            timeout = 300
            output_cap = 4000
        else:
            timeout = 30
            output_cap = 300
        result = _run_edge_cmd(cmd, timeout=timeout)
        output = (result.stdout + "\n" + result.stderr).strip()
        ok = result.returncode == 0
        # Invalidate edge status cache after restarts or maintenance (disk/ram freed)
        if action.startswith("restart-") or action == "clean-docker" or action.startswith("maint-"):
            _edge_status_cache["data"] = None
            _edge_status_cache["ts"] = 0
        return {"ok": ok, "result": output[-output_cap:] if output else "OK", "action": action}
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


def _split_worker_username(username: str) -> tuple:
    """Split 'wallet.worker' or 'wallet' into (miner_id, worker_name)."""
    if not username:
        return ("", "")
    if "." in username:
        wallet, worker = username.split(".", 1)
        return (wallet, worker)
    return (username, "default")


def _pplns_worker_keys(miner_id: str, worker_name: str = "", full_worker: str = "") -> list:
    """Return candidate PPLNS keys for looking up a worker in PPLNS state maps.

    V31 pool historically persisted keys both as 'wallet.worker' (dot) and
    'wallet/worker' (slash) depending on the pool binary version, and may use
    just 'wallet' for the default worker.  We try all common variants so the
    dashboard matches telemetry, PPLNS state and Prometheus labels reliably.
    """
    keys = []
    if full_worker:
        keys.append(full_worker)
    if miner_id:
        if worker_name and worker_name != "default":
            keys.append(f"{miner_id}.{worker_name}")
            keys.append(f"{miner_id}/{worker_name}")
            # Some PPLNS snapshots store only the wallet as the key even with workers
            keys.append(miner_id)
        else:
            keys.append(miner_id)
            keys.append(f"{miner_id}/default")
    return keys


def _pplns_dict_lookup(pplns_dict: dict, miner_id: str, worker_name: str = "", full_worker: str = "", default=None):
    """Look up a PPLNS value by trying dot, slash and wallet-only key variants."""
    if not pplns_dict or not isinstance(pplns_dict, dict):
        return default
    for key in _pplns_worker_keys(miner_id, worker_name, full_worker):
        if key in pplns_dict:
            val = pplns_dict[key]
            return default if val is None else val
    return default

def get_pool_miners() -> dict:
    """Fetch active miners from Edge pool /miners endpoint.

    Uses the JSON /miners endpoint as the primary source for per-miner data;
    extracts aggregate counters (active_sessions, miners_tracked, shares) from
    Prometheus metrics and enriches each miner with PPLNS state data and live
    telemetry (hashrate, shares, blocks_found) when available.
    """
    active_sessions = 0
    miners_tracked = 0
    shares_accepted = 0
    shares_rejected = 0
    total_shares = 0
    try:
        import urllib.request as _ur
        with _ur.urlopen(f"http://{EDGE_RPC_HOST}:{V31_POOL_API_PORT}/metrics", timeout=3.0) as r:
            for line in r.read().decode("utf-8", errors="ignore").splitlines():
                line = line.strip()
                if line.startswith("zion_pool_active_sessions "):
                    active_sessions = int(float(line.split()[-1]))
                elif line.startswith("zion_pool_miners_tracked "):
                    miners_tracked = int(float(line.split()[-1]))
                elif line.startswith("zion_pool_pplns_registered_miners "):
                    if miners_tracked == 0:
                        miners_tracked = int(float(line.split()[-1]))
                elif line.startswith("zion_pool_shares_accepted "):
                    shares_accepted = int(float(line.split()[-1]))
                    if total_shares == 0:
                        total_shares = shares_accepted
                elif line.startswith("zion_pool_shares_rejected "):
                    shares_rejected = int(float(line.split()[-1]))
                elif line.startswith("zion_pool_accepted_total "):
                    if shares_accepted == 0:
                        shares_accepted = int(float(line.split()[-1]))
                        if total_shares == 0:
                            total_shares = shares_accepted
    except Exception:
        pass

    try:
        miner_list = fetch_pool_miners()
    except Exception as e:
        return {
            "ok": False, "miners": [], "active_sessions": active_sessions,
            "shares_accepted": shares_accepted, "shares_rejected": shares_rejected,
            "total_shares": total_shares, "total_hashrate_khs": 0, "error": str(e),
        }

    # Load PPLNS state (best-effort) to enrich miners with shares/blocks/paid/unpaid
    pplns_state = _fetch_pplns_state() or {}
    pplns_shares = pplns_state.get("shares_per_miner", {}) or {}
    pplns_last_share = pplns_state.get("last_share_time_per_miner", {}) or {}
    pplns_paid = pplns_state.get("paid_per_miner", {}) or {}
    pplns_unpaid = pplns_state.get("unpaid", {}) or {}
    pplns_addresses = pplns_state.get("addresses", {}) or {}

    # Normalize raw /miners fields used by the dashboard
    normalized = []
    for m in miner_list:
        worker = m.get("worker") or m.get("worker_name") or ""
        address = m.get("address") or m.get("miner_id") or ""
        if not address and worker:
            address, _ = _split_worker_username(worker)
        if not worker:
            worker = m.get("miner_id") or ""
        miner_id, worker_name = _split_worker_username(worker) if worker else (address, "default")
        if not miner_id:
            miner_id = address

        # PPLNS state is keyed by "wallet.worker" (dot) or "wallet/worker" (slash)
        # or just "wallet" for the default worker. Try all variants for robustness.
        full_worker = m.get("worker") or worker or ""
        stats = _pplns_dict_lookup(pplns_shares, miner_id, worker_name, full_worker, default={})
        if not isinstance(stats, dict):
            stats = {}
        last_share = _pplns_dict_lookup(pplns_last_share, miner_id, worker_name, full_worker, default=0)
        paid_flowers = _pplns_dict_lookup(pplns_paid, miner_id, worker_name, full_worker, default=0)
        unpaid_flowers = _pplns_dict_lookup(pplns_unpaid, miner_id, worker_name, full_worker, default=0)
        if isinstance(paid_flowers, (int, float, str)):
            try:
                paid_flowers = int(paid_flowers)
            except Exception:
                paid_flowers = 0
        if isinstance(unpaid_flowers, (int, float, str)):
            try:
                unpaid_flowers = int(unpaid_flowers)
            except Exception:
                unpaid_flowers = 0

        # Prefer live telemetry from the pool /miners endpoint over PPLNS state.
        hashrate_hps = float(m.get("hashrate_hps", 0.0) or 0.0)
        hashrate_1h_hps = float(m.get("hashrate_1h_hps", 0.0) or 0.0)
        hashrate_24h_hps = float(m.get("hashrate_24h_hps", 0.0) or 0.0)
        valid_shares_telemetry = int(m.get("valid_shares", 0) or 0)
        invalid_shares_telemetry = int(m.get("invalid_shares", 0) or 0)
        blocks_found_telemetry = int(m.get("blocks_found", 0) or 0)
        last_share_telemetry = m.get("last_share_time", 0) or 0
        last_seen_telemetry = m.get("last_seen_s", 0) or 0
        first_seen_telemetry = m.get("first_seen_s", 0) or 0
        algorithm = m.get("algorithm", "")
        backend = m.get("backend", "")
        paid_total_atomic_telemetry = int(m.get("paid_total_atomic", 0) or 0)
        streams = m.get("streams", {}) or {}

        # Use telemetry when it exists, else PPLNS state.
        if valid_shares_telemetry or invalid_shares_telemetry:
            valid_shares = valid_shares_telemetry
            invalid_shares = invalid_shares_telemetry
            blocks_found = blocks_found_telemetry
            last_share = last_share_telemetry if last_share_telemetry else last_share
        else:
            valid_shares = int(stats.get("valid", 0)) if isinstance(stats, dict) else 0
            invalid_shares = int(stats.get("invalid", 0)) if isinstance(stats, dict) else 0
            blocks_found = int(stats.get("blocks", 0)) if isinstance(stats, dict) else 0

        paid_total = paid_total_atomic_telemetry if paid_total_atomic_telemetry else paid_flowers

        enriched = {
            "miner_id": miner_id,
            "address": address or miner_id,
            "worker_name": worker_name,
            "worker": worker,
            "valid_shares": valid_shares,
            "invalid_shares": invalid_shares,
            "blocks_found": blocks_found,
            "last_share_time": last_share,
            "first_seen_s": first_seen_telemetry if first_seen_telemetry else 0,
            "last_seen_s": last_seen_telemetry if last_seen_telemetry else 0,
            "total_paid_flowers": paid_total,
            "paid_total": flowers_to_zion(paid_total),
            "paid_total_atomic": paid_total,
            "pending_balance": unpaid_flowers,
            "pending_balance_zion": flowers_to_zion(unpaid_flowers),
            "unpaid_total": flowers_to_zion(unpaid_flowers),
            "hashrate_hps": hashrate_hps,
            "hashrate_1h_hps": hashrate_1h_hps,
            "hashrate_24h_hps": hashrate_24h_hps,
            "algorithm": algorithm,
            "backend": backend,
            "streams": streams,
            "active": True,
        }
        normalized.append(enriched)

    total_hashrate_khs = sum(m.get("hashrate_hps", 0.0) or 0.0 for m in normalized) / 1000.0
    total_valid = sum(m.get("valid_shares", 0) or 0 for m in normalized)
    total_invalid = sum(m.get("invalid_shares", 0) or 0 for m in normalized)

    # V31 pool may report 0 active TCP sessions for miners that submit via block-submit
    # or that connect briefly; use the registered worker count as a sensible active proxy.
    if not miners_tracked and normalized:
        miners_tracked = len(normalized)
    if active_sessions == 0 and (shares_accepted or total_valid or total_invalid) and miners_tracked > 0:
        active_sessions = miners_tracked

    # Enrich with real on-chain balances so /api/pool/miners is self-contained.
    enrich_miner_balances(normalized)

    active_count = sum(1 for m in normalized if m.get("active"))
    return {
        "ok": True,
        "miners": normalized,
        "active_sessions": active_sessions,
        "active_count": active_count,
        "miners_tracked": miners_tracked,
        "registered_count": miners_tracked,
        "shares_accepted": shares_accepted if shares_accepted else total_valid,
        "shares_rejected": shares_rejected if shares_rejected else total_invalid,
        "total_shares": total_valid + total_invalid,
        "total_hashrate_khs": total_hashrate_khs,
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

    # Try the current Edge pool unit first, then legacy zion-pool. Fall back to pool.log.
    raw = ""
    for unit in ["zion-v31-pool", "zion-edge-pool", "zion-pool"]:
        cmd = (
            f"journalctl -q -u {unit} --no-pager --since '{since_hours} hours ago' -n 5000 "
            "| grep -E 'peer_addr=|session_start|session_miner_id|session_worker_name|session_duration_secs|wire_bye|share_submit|new_session|v3_hello|v3_bye'"
        )
        try:
            result = _run_edge_cmd(cmd, timeout=10)
            if result.returncode == 0:
                raw = result.stdout.strip()
                if raw:
                    break
        except Exception:
            pass

    if not raw:
        # Fallback: read pool.log directly (no journal permissions / unit not logging)
        log_path = (LOG_DIR / "pool.log") if (LOG_DIR / "pool.log").exists() else Path("/opt/zion/pool.log")
        if log_path.exists():
            try:
                with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                    raw = "".join(deque(f, maxlen=5000))
            except Exception:
                raw = ""

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

        # V31 stratum: v3_hello miner=<id> worker=<name> algo=... backend=... ip=<addr>
        if (m2 := re.search(r'v3_hello\s+miner=(\S+)\s+worker=(\S+)(?:\s+algo=\S+)?\s+backend=(\S*)\s+ip=([\d.]+)', line)):
            events.append({
                "ts": ts,
                "time": datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S"),
                "session_id": "v31",
                "active_sessions": 1,
                "peer_addr": m2.group(4),
                "miner_id": m2.group(1),
                "worker_name": m2.group(2),
                "duration_secs": None,
                "bye": None,
            })
            continue

        # V31 stratum disconnect
        if (m2 := re.search(r'v3_bye\s+miner=(\S+)\s+worker=(\S+)', line)):
            events.append({
                "ts": ts,
                "time": datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S"),
                "session_id": "v31",
                "active_sessions": 0,
                "peer_addr": "",
                "miner_id": m2.group(1),
                "worker_name": m2.group(2),
                "duration_secs": None,
                "bye": "bye",
            })
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
    """Return a map composite_key -> active miner data from the pool /miners endpoint.

    Uses composite key "address/worker_name" to match PPLNS state keys, since
    multiple workers can share the same miner_id (e.g. local-miner).
    V31 /miners returns worker as "address.worker_name", so we split it.
    """
    try:
        miners = fetch_pool_miners()
        result = {}
        for m in miners:
            worker_full = m.get("worker") or ""
            if worker_full:
                addr, worker = _split_worker_username(worker_full)
            else:
                addr = m.get("address") or m.get("miner_id") or ""
                worker = m.get("worker_name") or ""
            if not addr:
                addr = m.get("address") or m.get("miner_id") or ""
            m["miner_id"] = addr
            m["worker_name"] = worker or "default"
            key = f"{addr}/{worker}" if worker else addr
            if key:
                result[key] = m
        return result
    except Exception:
        return {}


def get_pool_debug_dump() -> dict:
    """Comprehensive pool debug dump — all data needed for diagnostics.

    Returns:
      - raw_metrics: raw Prometheus text from :{V31_POOL_API_PORT}/metrics
      - parsed_metrics: {name: value} dict
      - stats: JSON from :{V31_POOL_API_PORT}/stats (API routes, auxpow, etc.)
      - pplns_state: full pplns-state.json dump
      - pool_log_tail: last 100 lines from /opt/zion/pool.log
      - auxpow: auxpow config
      - registered_miners: registered miners summary
      - pool_env: pool-related env vars from edge-environment.sh
      - revenue_stats: from :{V31_POOL_API_PORT}/api/v1/revenue/stats
      - revenue_streams: from :{V31_POOL_API_PORT}/api/v1/revenue/streams
      - endpoints: list of available pool API endpoints with status
    """
    import urllib.request as _ur
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    port = V31_POOL_API_PORT
    result = {"ok": True, "ts": int(time.time()), "host": host, "port": port, "sections": {}}

    # 1. Raw Prometheus metrics
    try:
        with _ur.urlopen(f"http://{host}:{port}/metrics", timeout=3) as r:
            raw = r.read().decode("utf-8", errors="ignore")
        result["raw_metrics"] = raw
        # Parse into structured form: [{name, value, type, help, labels}]
        parsed = []
        current_help = {}
        for line in raw.splitlines():
            if line.startswith("# HELP "):
                parts = line.split(" ", 3)
                if len(parts) >= 4:
                    current_help[parts[2]] = parts[3]
            elif line.startswith("# TYPE "):
                parts = line.split(" ", 3)
                if len(parts) >= 4:
                    pass  # type info captured but not critical
            elif line and not line.startswith("#"):
                parts = line.rsplit(" ", 1)
                if len(parts) == 2:
                    name_full = parts[0]
                    try:
                        val = float(parts[1])
                    except ValueError:
                        continue
                    # Split labels: name{labels} -> name, labels
                    labels = ""
                    name = name_full
                    if "{" in name_full and name_full.endswith("}"):
                        name = name_full.split("{", 1)[0]
                        labels = name_full.split("{", 1)[1].rstrip("}")
                    parsed.append({
                        "name": name,
                        "labels": labels,
                        "value": val,
                        "help": current_help.get(name, ""),
                    })
        result["parsed_metrics"] = parsed
        result["sections"]["raw_metrics"] = "ok"
    except Exception as e:
        result["raw_metrics"] = None
        result["parsed_metrics"] = []
        result["sections"]["raw_metrics"] = f"error: {str(e)[:80]}"

    # 2. /stats endpoint
    try:
        with _ur.urlopen(f"http://{host}:{port}/stats", timeout=3) as r:
            result["stats"] = json.loads(r.read().decode("utf-8", errors="ignore"))
        result["sections"]["stats"] = "ok"
    except Exception as e:
        result["stats"] = None
        result["sections"]["stats"] = f"error: {str(e)[:80]}"

    # 3. PPLNS state
    try:
        result["pplns_state"] = _fetch_pplns_state()
        result["sections"]["pplns_state"] = "ok" if result["pplns_state"] else "empty"
    except Exception as e:
        result["pplns_state"] = None
        result["sections"]["pplns_state"] = f"error: {str(e)[:80]}"

    # 4. Pool log tail (last 100 lines)
    try:
        log_result = _run_edge_cmd("tail -100 /opt/zion/pool.log 2>/dev/null || tail -100 /opt/zion/logs/pool.log 2>/dev/null", timeout=5)
        if log_result.returncode == 0 and log_result.stdout.strip():
            result["pool_log_tail"] = log_result.stdout.strip().splitlines()
        else:
            result["pool_log_tail"] = []
        result["sections"]["pool_log_tail"] = f"ok ({len(result['pool_log_tail'])} lines)"
    except Exception as e:
        result["pool_log_tail"] = []
        result["sections"]["pool_log_tail"] = f"error: {str(e)[:80]}"

    # 5. AuxPow config
    try:
        result["auxpow"] = get_auxpow_config()
        result["sections"]["auxpow"] = "ok"
    except Exception as e:
        result["auxpow"] = None
        result["sections"]["auxpow"] = f"error: {str(e)[:80]}"

    # 6. Pool env vars from edge-environment.sh
    try:
        env_vars = {}
        if EDGE_ENV_FILE.exists():
            with open(EDGE_ENV_FILE, "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("#") or not line or "=" not in line:
                        continue
                    # Strip optional "export " prefix
                    if line.startswith("export "):
                        line = line[len("export "):].strip()
                    if "=" not in line:
                        continue
                    kv = line.split("=", 1)
                    if len(kv) == 2:
                        key = kv[0].strip()
                        val = kv[1].strip().strip('"').strip("'")
                        # Only pool/mining-related vars
                        if any(k in key.upper() for k in ["POOL", "MINER", "PAYOUT", "PPLNS", "FEE", "AUXPOW", "STRATUM"]):
                            env_vars[key] = val
        result["pool_env"] = env_vars
        result["sections"]["pool_env"] = f"ok ({len(env_vars)} vars)"
    except Exception as e:
        result["pool_env"] = {}
        result["sections"]["pool_env"] = f"error: {str(e)[:80]}"

    # 7. Revenue stats
    try:
        with _ur.urlopen(f"http://{host}:{port}/api/v1/revenue/stats", timeout=3) as r:
            result["revenue_stats"] = json.loads(r.read().decode("utf-8", errors="ignore"))
        result["sections"]["revenue_stats"] = "ok"
    except Exception as e:
        result["revenue_stats"] = None
        result["sections"]["revenue_stats"] = f"error: {str(e)[:80]}"

    # 8. Revenue streams
    try:
        with _ur.urlopen(f"http://{host}:{port}/api/v1/revenue/streams", timeout=3) as r:
            result["revenue_streams"] = json.loads(r.read().decode("utf-8", errors="ignore"))
        result["sections"]["revenue_streams"] = "ok"
    except Exception as e:
        result["revenue_streams"] = None
        result["sections"]["revenue_streams"] = f"error: {str(e)[:80]}"

    # 9. Endpoint probes (which pool API endpoints respond)
    endpoints = {}
    for ep in ["/stats", "/metrics", "/miners?limit=10", "/api/v1/revenue/stats", "/api/v1/revenue/streams", "/api/v1/profit/switcher"]:
        try:
            with _ur.urlopen(f"http://{host}:{port}{ep}", timeout=2) as r:
                endpoints[ep] = {"status": r.status, "ok": True}
        except Exception as e:
            endpoints[ep] = {"status": None, "ok": False, "error": str(e)[:60]}
    result["endpoints"] = endpoints

    return result


def get_pool_blocks(limit: int = 100) -> dict:
    """Proxy to pool /api/v1/blocks endpoint (DB-backed historical blocks).

    Returns blocks list + summary KPIs (total, confirmed, pending, orphaned,
    orphan_rate, pool_luck_64). Falls back to 503 if DB not configured.
    """
    import urllib.request as _ur
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    port = V31_POOL_API_PORT
    if limit < 1 or limit > 500:
        limit = 100
    try:
        with _ur.urlopen(f"http://{host}:{port}/api/v1/blocks?limit={limit}", timeout=5) as r:
            payload = json.loads(r.read().decode("utf-8", errors="ignore"))
        # Normalize: pool returns either {blocks:[...]} or a bare list
        blocks = payload.get("blocks", payload) if isinstance(payload, dict) else payload
        if not isinstance(blocks, list):
            blocks = []
        # Compute summary KPIs
        total = len(blocks)
        confirmed = sum(1 for b in blocks if (b.get("status") or b.get("state") or "").lower() in ("confirmed", "mature", "valid"))
        pending = sum(1 for b in blocks if (b.get("status") or b.get("state") or "").lower() in ("pending", "unconfirmed", "immature"))
        orphaned = sum(1 for b in blocks if (b.get("status") or b.get("state") or "").lower() in ("orphaned", "orphan", "invalid", "stale"))
        orphan_rate = (orphaned / total * 100.0) if total > 0 else 0.0
        return {
            "ok": True,
            "blocks": blocks,
            "summary": {
                "total": total,
                "confirmed": confirmed,
                "pending": pending,
                "orphaned": orphaned,
                "orphan_rate_pct": round(orphan_rate, 2),
                "pool_luck_64": payload.get("pool_luck_64") if isinstance(payload, dict) else None,
            },
            "host": host,
            "port": port,
            "ts": int(time.time()),
        }
    except _ur.HTTPError as e:
        return {"ok": False, "error": f"pool returned HTTP {e.code}", "blocks": [], "summary": {}, "ts": int(time.time())}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200], "blocks": [], "summary": {}, "ts": int(time.time())}


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
            return {
                "ok": True,
                "miners": cached,
                "totals": _REGISTERED_MINERS_CACHE.get("totals", {}),
                "cached": True,
                "registered_count": _REGISTERED_MINERS_CACHE.get("registered_count", len(cached)),
                "active_count": _REGISTERED_MINERS_CACHE.get("active_count", 0),
            }

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
            _REGISTERED_MINERS_CACHE["totals"] = {"pending_zion": 0, "paid_zion": 0, "on_chain_zion": 0}
            _REGISTERED_MINERS_CACHE["registered_count"] = len(miners)
            _REGISTERED_MINERS_CACHE["active_count"] = sum(1 for m in miners if m.get("active"))
        return {"ok": True, "miners": miners, "cached": False, "fallback": True}

    # 2. Build unique list of payout addresses and lookup balances once per address
    unique_addrs = set()
    for addr in addresses.values():
        if addr and isinstance(addr, str) and addr.startswith("zion1"):
            unique_addrs.add(addr)

    # Per-address on-chain balance via fast getUtxos RPC.
    balance_map = {}
    for addr in unique_addrs:
        try:
            atomic, ok = _get_on_chain_balance(addr)
            if ok:
                balance_map[addr] = flowers_to_zion(atomic)
        except Exception:
            pass

    # 3. Build per-miner records, preserving individual miner IDs even if they share an address.
    # PPLNS state keys may be "wallet.worker" (dot) or "wallet/worker" (slash).
    miners = []
    pplns_stats = (stats.get("pplns") or {}) if isinstance(stats, dict) else {}
    total_paid_flowers = pplns_stats.get("total_paid_flowers", 0)
    pplns_shares = pplns_state.get("shares_per_miner") or {}
    pplns_paid = pplns_state.get("paid_per_miner") or {}
    pplns_last_share = pplns_state.get("last_share_time_per_miner") or {}
    for pplns_key, payout_address in addresses.items():
        on_chain = balance_map.get(payout_address, 0.0)
        pending_atomic = int(_pplns_dict_lookup(unpaid, pplns_key, full_worker=pplns_key, default=0)) or 0
        # Split PPLNS key for display (dot or slash)
        if "." in pplns_key:
            display_miner_id, display_worker = pplns_key.split(".", 1)
        elif "/" in pplns_key:
            display_miner_id, display_worker = pplns_key.split("/", 1)
        else:
            display_miner_id, display_worker = pplns_key, "default"

        # Look up active telemetry using dot/slash/wallet key variants
        active = _pplns_dict_lookup(active_map, display_miner_id, display_worker, full_worker=pplns_key)

        # Per-miner PPLNS stats (shares, paid, last share time)
        pplns_share_stats = _pplns_dict_lookup(pplns_shares, display_miner_id, display_worker, full_worker=pplns_key, default={})
        if not isinstance(pplns_share_stats, dict):
            pplns_share_stats = {}
        pplns_paid_flowers = int(_pplns_dict_lookup(pplns_paid, display_miner_id, display_worker, full_worker=pplns_key, default=0)) or 0
        pplns_last_share_time = int(_pplns_dict_lookup(pplns_last_share, display_miner_id, display_worker, full_worker=pplns_key, default=0)) or 0

        # Prefer active telemetry, fall back to PPLNS state for inactive/registered miners
        if active:
            hashrate = active.get("hashrate") or active.get("hashrate_hps") or 0.0
            hashrate_1h = active.get("hashrate_1h") or active.get("hashrate_1h_hps", 0) or 0.0
            hashrate_24h = active.get("hashrate_24h") or active.get("hashrate_24h_hps", 0) or 0.0
            valid_shares = active.get("valid_shares", 0)
            invalid_shares = active.get("invalid_shares", 0)
            blocks_found = active.get("blocks_found", 0)
            last_seen = active.get("last_seen", 0) or active.get("last_seen_s", 0)
            last_share = active.get("last_share", 0) or active.get("last_share_time", 0) or active.get("last_share_time_s", 0)
            worker_name = display_worker or active.get("worker_name", "") or "default"
            streams = active.get("streams", {})
            paid_total_atomic = int(active.get("paid_total_atomic", 0) or 0)
            # /miners returns paid_total_atomic; older code used paid_total (zion)
            paid_total_zion = float(active.get("paid_total", 0.0) or 0.0) if active.get("paid_total") else flowers_to_zion(paid_total_atomic)
        else:
            hashrate = 0.0
            hashrate_1h = 0.0
            hashrate_24h = 0.0
            valid_shares = pplns_share_stats.get("valid", 0)
            invalid_shares = pplns_share_stats.get("invalid", 0)
            blocks_found = pplns_share_stats.get("blocks", 0)
            last_seen = 0
            last_share = pplns_last_share_time
            worker_name = display_worker or "default"
            streams = {}
            paid_total_atomic = pplns_paid_flowers
            paid_total_zion = flowers_to_zion(pplns_paid_flowers)

        m = {
            "miner_id": display_miner_id,
            "worker_name": worker_name,
            "pplns_key": pplns_key,
            "payout_address": payout_address,
            "hashrate_hps": float(hashrate or 0),
            "hashrate_1h": float(hashrate_1h or 0),
            "hashrate_24h": float(hashrate_24h or 0),
            "valid_shares": int(valid_shares or 0),
            "invalid_shares": int(invalid_shares or 0),
            "pending_balance": pending_atomic,
            "pending_balance_zion": flowers_to_zion(pending_atomic),
            "paid_total": paid_total_zion,
            "paid_total_atomic": paid_total_atomic,
            "blocks_found": int(blocks_found or 0),
            "last_seen": int(last_seen or 0),
            "last_share": int(last_share or 0),
            "on_chain_balance_zion": on_chain,
            "active": bool(active),
            "streams": streams or {},
        }
        miners.append(m)

    # 4. Total paid from PPLNS state (authoritative pool lifetime total) while
    # per-miner paid_total is already set from active telemetry above.
    total_paid_zion = flowers_to_zion(total_paid_flowers)

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
    # Use PPLNS authoritative total if available; otherwise sum of per-miner paid totals.
    if total_paid_zion > 0:
        total_paid = total_paid_zion
    totals = {
        "pending_zion": total_pending,
        "paid_zion": total_paid,
        "on_chain_zion": sum(unique_balances.values()),
    }

    with _REGISTERED_MINERS_LOCK:
        _REGISTERED_MINERS_CACHE["data"] = miners
        _REGISTERED_MINERS_CACHE["ts"] = now
        _REGISTERED_MINERS_CACHE["totals"] = totals
        _REGISTERED_MINERS_CACHE["registered_count"] = len(miners)
        _REGISTERED_MINERS_CACHE["active_count"] = sum(1 for m in miners if m["active"])
    return {"ok": True, "miners": miners, "totals": totals, "cached": False, "registered_count": len(miners), "active_count": sum(1 for m in miners if m["active"])}


def enrich_miner_balances(miners: list) -> list:
    """Query on-chain UTXO balance for each miner payout address.

    Updates each miner dict in-place with:
      - on_chain_balance_zion (float)
      - pending_balance_zion (float) if pending_balance is in atomic flowers
    """
    if not miners:
        return miners
    for m in miners:
        addr = m.get("payout_address") or m.get("address") or ""
        if addr and isinstance(addr, str) and addr.startswith("zion1"):
            try:
                atomic, ok = _get_on_chain_balance(addr)
                if ok:
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
    active_count = sum(1 for m in sorted_miners if m.get("active"))
    return {
        "ok": True,
        "miners": sorted_miners,
        "active_sessions": data.get("active_sessions", 0),
        "active_count": active_count,
        "miners_tracked": data.get("miners_tracked", len(sorted_miners)),
        "registered_count": data.get("miners_tracked", len(sorted_miners)),
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

    # 9c. Revenue System — live data from pool /stats + fee split
    try:
        rev = get_revenue_dashboard()
        result["revenue"] = rev.get("revenue", {})
        # Expose auxpow live snapshot for convenience
        result["auxpow"] = rev.get("auxpow", result.get("auxpow", {}))
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
        # registered_miners: prefer the larger of live PPLNS count, tracked count,
        # or the actual number of miners returned, so the KPI never undersells the table.
        _pplns_registered = int(result.get("pplns", {}).get("registered_miners", 0) or 0)
        _tracked = int(result.get("miners_tracked", 0) or 0)
        _displayed = len(miners)
        _registered_miners = max(_pplns_registered, _tracked, _displayed)
        result["summary"] = {
            "active_miners": result.get("active_sessions", 0),
            "registered_miners": _registered_miners,
            "tracked_miners": result.get("miners_tracked", 0),
            "displayed_miners": len(miners),
            "total_hashrate_khs": total_hash / 1000.0,
            "average_hashrate_khs": round(total_hash / 1000.0 / len(miners), 2) if miners else 0,
            "total_valid_shares": valid_total,
            "total_invalid_shares": invalid_total,
            "total_shares": total_shares,
            "accept_rate_pct": round(accept_rate, 2),
            "blocks_found": blocks_total,
            "payout_rounds": result.get("pplns", {}).get("payout_rounds", 0),
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
    """Return live revenue dashboard data for the Revenue System tab.

    Merges live AuxPow stats + ZION mining revenue + PPLNS payout data
    from the pool /stats endpoint into a unified revenue view.
    """
    result: dict = {"ok": True}

    # ── Fetch live pool stats ──────────────────────────────────────────
    stats: dict = {}
    try:
        stats = fetch_pool_stats() or {}
    except Exception:
        stats = {}

    auxpow = stats.get("auxpow", {}) if isinstance(stats.get("auxpow"), dict) else {}
    result["auxpow"] = auxpow

    # ── Stream profit (Deeksha Chv3 pipeline weights) ──────────────────
    stream_profit = stats.get("stream_profit", {}) if isinstance(stats.get("stream_profit"), dict) else {}
    result["stream_profit"] = stream_profit

    # ── ZION mining revenue (from pool stats) ──────────────────────────
    blocks_found = 0
    pool_uptime = 0
    total_paid_atomic = 0
    payout_rounds = 0
    pending_atomic = 0
    pool_hashrate = 0.0
    fee_split = {}
    pplns = {}

    try:
        blocks_found = int(stats.get("blocks", {}).get("found", 0))
    except Exception:
        pass
    try:
        pool_uptime = int(stats.get("pool", {}).get("uptime_secs", 0))
    except Exception:
        pass
    try:
        payouts = stats.get("payouts", {}) if isinstance(stats.get("payouts"), dict) else {}
        pplns = stats.get("pplns", {}) if isinstance(stats.get("pplns"), dict) else {}
        total_paid_atomic = int(payouts.get("total_paid_atomic") or pplns.get("total_paid_flowers") or 0)
        payout_rounds = int(payouts.get("payout_rounds") or pplns.get("payout_rounds") or 0)
        pending_atomic = int(payouts.get("pending_total_atomic") or pplns.get("total_unpaid_flowers") or 0)
    except Exception:
        pass
    try:
        pool_hashrate = float(stats.get("hashrate", {}).get("pool", 0))
    except Exception:
        pass
    # V31 pool exposes hashrate + blocks on /metrics if /stats lacks it
    _metrics_blocks = 0
    if pool_hashrate <= 0 or blocks_found <= 0:
        try:
            import urllib.request as _ur2
            _mhost = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
            with _ur2.urlopen(f"http://{_mhost}:{V31_POOL_API_PORT}/metrics", timeout=1.5) as _r:
                for _ln in _r.read().decode("utf-8", errors="ignore").splitlines():
                    if _ln.startswith("zion_pool_hashrate_hps "):
                        pool_hashrate = float(_ln.split()[-1])
                    elif _ln.startswith("zion_pool_blocks_found_total "):
                        _metrics_blocks = int(float(_ln.split()[-1]))
        except Exception:
            pass
    if blocks_found <= 0 and _metrics_blocks > 0:
        blocks_found = _metrics_blocks
    fee_split = stats.get("fee_split", {}) if isinstance(stats.get("fee_split"), dict) else {}
    pplns = stats.get("pplns", {}) if isinstance(stats.get("pplns"), dict) else {}

    # Block reward + economics constants (defined at module level, see top of file)
    # ZION_BLOCK_REWARD, TARGET_BLOCK_TIME_SECS, MAX_BLOCKS_PER_DAY, FLOWERS_PER_ZION

    # ZION mined (total from blocks found by this pool session)
    zion_mined_total = blocks_found * ZION_BLOCK_REWARD
    zion_paid_total = total_paid_atomic / FLOWERS_PER_ZION  # all-time PPLNS
    zion_pending = pending_atomic / FLOWERS_PER_ZION

    # Daily estimate: use actual block-find rate from this session,
    # but cap at network maximum (720 blocks/day).
    if pool_uptime > 3600:  # need at least 1h of data for meaningful rate
        raw_rate = blocks_found / pool_uptime * 86400
        blocks_per_day = min(raw_rate, MAX_BLOCKS_PER_DAY)
        zion_per_day = blocks_per_day * ZION_BLOCK_REWARD
    else:
        # Not enough uptime data — estimate from chain height delta instead
        blocks_per_day = 0
        zion_per_day = 0.0

    # AuxPow revenue
    aux_rev_usd = float(auxpow.get("revenue_usd", 0.0))
    aux_uptime = int(auxpow.get("uptime_secs", 0))
    aux_rev_per_hour = (aux_rev_usd / aux_uptime * 3600) if aux_uptime > 0 and aux_rev_usd > 0 else 0.0
    aux_rev_per_day = aux_rev_per_hour * 24

    # Total revenue USD (AuxPow only — ZION has no USD price feed yet)
    total_usd = aux_rev_usd
    daily_usd = aux_rev_per_day

    # ── Coin revenue table (live) ──────────────────────────────────────
    # Aligned with AuXpow/src/types.rs ExternalCoin defaults.
    # v3.0.6: Pearl (PRL) removed from canonical 3-stream mining.
    #         The 3 streams are: ZION GPU, one GPU profit coin, CPU Verus/RandomX.
    # Pool addresses aligned with AuXpow/src/types.rs default_pool()
    # E2E stratum test status from 2026-07-16 testing (commit b39f5cae8)
    # e2e: "ok" = full stratum E2E, "warn" = connectivity issues, "ok" (legacy) = previously tested
    SUPPORTED_COINS = [
        ("DCR",  "blake3",      "pool.woolypooly.com:3152",            "ok"),
        ("ALPH", "blake3",      "pool.woolypooly.com:3106",            "ok"),
        ("KAS",  "kheavyhash",  "kas.2miners.com:2020",                "ok"),
        ("ERG",  "autolykos",   "erg.2miners.com:8888",                "ok"),
        ("RVN",  "kawpow",      "rvn.2miners.com:6060",                "ok"),
        ("ETC",  "ethash",      "etc.2miners.com:1010",                "ok"),
        ("EVR",  "evrprogpow",  "evrprogpow.eu.mine.zpool.ca:1330",    "ok"),
        ("MEWC", "meowpow",     "meowpow.eu.mine.zpool.ca:1327",       "ok"),
        ("FLUX", "zelhash",     "flux.woolypooly.com:3000",            "ok"),
        ("CLORE","kawpow",      "clore.woolypooly.com:3090",           "ok"),
        ("XMR",  "randomx",     "gulf.moneroocean.stream:10001",       "ok"),
        ("VRSC", "verushash",   "eu.luckpool.net:3956",                "ok"),
        ("EPIC", "progpow",     "de.epicmine.io:3334",                 "ok"),
        ("QUAI", "kawpow",      "quaikawpow.2miners.com:4545",         "ok"),
        ("BEAM", "beamhash",    "beam.2miners.com:5252",               "ok"),
        ("KLS",  "karlsenhash", "pool.woolypooly.com:3132",            "warn"),
        ("ZCL",  "equihashzero","equihash192.eu.mine.zpool.ca:2144",   "ok"),
        ("QTC",  "qhash",       "qtc.suprnova.cc:5555",                "ok"),
        ("VTC",  "verthash",    "verthash.eu.mine.zpool.ca:4533",      "ok"),
        ("IRON", "fishhash",    "de.ironfish.herominers.com:1145",     "warn"),
        ("NEXA", "nexapow",     "nexa.2miners.com:5050",               "ok"),
        ("RTM",  "ghostrider",  "ghostrider.eu.mine.zpool.ca:5354",    "ok"),
        ("DNX",  "dynexsolve",  "dynex.herominers.com:1030",           "warn"),
    ]
    # E2E status notes for the 3 problematic coins
    COIN_E2E_NOTES = {
        "KLS":  "EthStratum auth pending — pool requires valid KLS wallet",
        "IRON": "Herominers TCP OK but no stratum response (30s timeout)",
        "DNX":  "All pools unreachable from datacenter IP",
    }
    current_coin = auxpow.get("current_coin", "")
    coin_revenue = []
    for coin, algo, pool_addr, e2e_status in SUPPORTED_COINS:
        is_active = (coin == current_coin) and auxpow.get("enabled", False)
        coin_revenue.append({
            "coin": coin,
            "algorithm": algo,
            "pool": pool_addr,
            "shares": int(auxpow.get("shares_submitted", 0)) if is_active else 0,
            "revenue_usd": float(auxpow.get("revenue_usd", 0.0)) if is_active else 0.0,
            "active": is_active,
            "e2e_status": e2e_status,
            "e2e_note": COIN_E2E_NOTES.get(coin, ""),
        })

    # ── Distributions table (from PPLNS payouts) ───────────────────────
    distributions = []
    if payout_rounds > 0:
        # Estimate last distribution time from pool uptime
        # PPLNS pays out every block (~2 min target), so last dist ~ recent
        import datetime as _dt
        now = _dt.datetime.now(_dt.timezone.utc)
        # Show last 5 "distributions" as PPLNS rounds
        for i in range(min(5, payout_rounds)):
            # Each round ~ pool_uptime / payout_rounds apart
            if payout_rounds > 0 and pool_uptime > 0:
                interval = pool_uptime / payout_rounds
                ts = now - _dt.timedelta(seconds=interval * i)
            else:
                ts = now
            # Average payout per round
            avg_per_round = zion_paid_total / payout_rounds if payout_rounds > 0 else 0
            distributions.append({
                "ts": ts.isoformat(),
                "amount_zion": round(avg_per_round, 4),
                "amount_usd": 0.0,  # no USD price feed
                "recipient": f"PPLNS round #{payout_rounds - i}",
                "type": "PPLNS payout",
            })

    # ── Fee split accumulated (in ZION) ────────────────────────────────
    humanitarian_accum = float(fee_split.get("humanitarian_accumulated_flowers", 0)) / FLOWERS_PER_ZION
    issobella_accum = float(fee_split.get("issobella_accumulated_flowers", 0)) / FLOWERS_PER_ZION
    pool_fee_accum = float(fee_split.get("pool_fee_accumulated_flowers", 0)) / FLOWERS_PER_ZION

    # ── Fee wallet addresses (from pool config / env / canonical fallback) ──
    humanitarian_wallet = fee_split.get("humanitarian_wallet") or find_env_value("ZION_HUMANITARIAN_WALLET") or V31_CANONICAL_HUMANITARIAN_WALLET
    issobella_wallet = fee_split.get("issobella_wallet") or find_env_value("ZION_ISSOBELLA_WALLET") or V31_CANONICAL_ISSOBELLA_WALLET
    pool_fee_wallet = fee_split.get("pool_fee_wallet") or find_env_value("ZION_POOL_FEE_WALLET") or V31_CANONICAL_POOL_FEE_WALLET

    # ── Service-based strategy detection (real status, not string parsing) ──
    # Check which L2/L3 services are actually running
    _status = build_status()
    _bridge_running = _status.get("bridge", {}).get("running", False)
    _dao_running = _status.get("dao", {}).get("running", False)
    _warp_running = _status.get("warp", {}).get("running", False)
    _swap_running = _status.get("atomic_swap", {}).get("running", False)

    # ── Build revenue object ───────────────────────────────────────────
    aux_enabled = bool(auxpow.get("enabled", False))
    result["revenue"] = {
        "enabled": aux_enabled,
        "status": "Active" if aux_enabled else "Preview",
        "strategy": "Multi-coin merge-mining + swap aggregator",
        # USD revenue (AuxPow)
        "total_usd": round(total_usd, 6),
        "daily_estimate_usd": round(daily_usd, 6),
        "revenue_usd": round(aux_rev_usd, 6),
        "revenue_per_hour_usd": round(aux_rev_per_hour, 6),
        # ZION mining revenue
        "zion_mined_total": round(zion_mined_total, 4),
        "zion_paid_total": round(zion_paid_total, 4),
        "zion_pending": round(zion_pending, 4),
        "zion_per_day": round(zion_per_day, 4),
        "blocks_found": blocks_found,
        "blocks_per_day": round(blocks_per_day, 2),
        "pool_hashrate": round(pool_hashrate, 2),
        # AuxPow live
        "current_algorithm": auxpow.get("current_algorithm"),
        "current_pool": auxpow.get("current_pool"),
        "current_coin": auxpow.get("current_coin"),
        "shares_submitted": int(auxpow.get("shares_submitted", 0)),
        "shares_accepted": int(auxpow.get("shares_accepted", 0)),
        "shares_rejected": int(auxpow.get("shares_rejected", 0)),
        "uptime_secs": aux_uptime,
        "coin_switches": int(auxpow.get("coin_switches", 0)),
        "last_switch_ts": auxpow.get("last_switch_ts"),
        "consecutive_failures": int(auxpow.get("consecutive_failures", 0)),
        "circuit_open": bool(auxpow.get("circuit_open", False)),
        # Fee split (real data from pool API; chain defaults: 89/5/5/1 from emission.rs).
        # dao_share_pct is preserved for backward UI compatibility and maps to Issobella Space.
        "miner_share_pct": int(fee_split.get("miner_pct", 89)),
        "dao_share_pct": int(fee_split.get("issobella_pct", 5)),
        "issobella_share_pct": int(fee_split.get("issobella_pct", 5)),
        "humanitarian_share_pct": int(fee_split.get("humanitarian_pct", 5)),
        "pool_fee_pct": int(fee_split.get("pool_fee_pct", 1)),
        "humanitarian_accumulated_zion": round(humanitarian_accum, 4),
        "issobella_accumulated_zion": round(issobella_accum, 4),
        "pool_fee_accumulated_zion": round(pool_fee_accum, 4),
        "humanitarian_wallet": humanitarian_wallet,
        "issobella_wallet": issobella_wallet,
        "pool_fee_wallet": pool_fee_wallet,
        # PPLNS
        "payout_rounds": payout_rounds,
        "pplns_window_size": int(pplns.get("window_size", 500000)),
        "pplns_window_used": int(pplns.get("window_used", 0)),
        "registered_miners": int(pplns.get("registered_miners", 0)),
        # Distributions
        "last_distribution_ts": distributions[0]["ts"] if distributions else None,
        "next_distribution_ts": None,  # no scheduled next — PPLNS pays per block
        "distribution_cycle": "Per-block (PPLNS)",
        "accumulated_usd": round(total_usd, 6),
        "active_coins": [c[0] for c in SUPPORTED_COINS],  # 23 supported coins (PRL removed v3.0.6, 8 new added)
        "coin_revenue": coin_revenue,
        "distributions": distributions,
        # Stream profit (Deeksha Chv3 pipeline weights)
        "stream_profit_enabled": bool(stream_profit.get("enabled", False)),
        "stream_profit_provider": stream_profit.get("provider", "fallback"),
        "stream_profit_live": bool(stream_profit.get("live", False)),
        "stream_profit_weights": stream_profit.get("weights", []),
        "stream_profit_weights_string": stream_profit.get("weights_string", ""),
        "stream_profit_description": stream_profit.get("description", ""),
        "stream_profit_interval": stream_profit.get("interval_secs", 120),
        "stream_profit_hysteresis": stream_profit.get("hysteresis_pct", 15.0),
        "stream_profit_sources": stream_profit.get("enabled_sources", ""),
        # Active strategies (real service status)
        "strategies": {
            "merge_mining": aux_enabled,
            "bridge": _bridge_running,
            "dao": _dao_running,
            "warp": _warp_running,
            "swap": _swap_running,
            "stream_profit": bool(stream_profit.get("enabled", False)),
        },
        # Block reward breakdown
        "block_reward_zion": ZION_BLOCK_REWARD,
        "target_block_time_secs": TARGET_BLOCK_TIME_SECS,
        "max_blocks_per_day": MAX_BLOCKS_PER_DAY,
    }
    return result


def _fetch_pool_revenue_stats() -> dict:
    """Fetch revenue stats from pool /api/v1/revenue/stats endpoint."""
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{host}:{V31_POOL_API_PORT}/api/v1/revenue/stats", timeout=3) as r:
            return json.loads(r.read().decode())
    except Exception:
        return {}


def _pool_coin_override_get(stream: str) -> dict:
    """GET current coin override from pool HTTP API. stream='cpu' or 'gpu'."""
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    port = V31_POOL_API_PORT
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{host}:{port}/api/v1/{stream}-coin", timeout=3) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"coin": None, "error": str(e)}


def _pool_coin_override_set(stream: str, coin: str) -> dict:
    """POST coin override to pool HTTP API. stream='cpu' or 'gpu'. Empty coin clears."""
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    port = V31_POOL_API_PORT
    try:
        import urllib.request
        body = json.dumps({"coin": coin}).encode()
        req = urllib.request.Request(
            f"http://{host}:{port}/api/v1/{stream}-coin",
            data=body,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=3) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return {"ok": False, "error": str(e)}


def _fetch_pool_revenue_streams() -> dict:
    """Fetch stream telemetry from pool /api/v1/revenue/streams endpoint."""
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{host}:{V31_POOL_API_PORT}/api/v1/revenue/streams", timeout=3) as r:
            return json.loads(r.read().decode())
    except Exception:
        return {}


def get_revenue_report() -> dict:
    """Comprehensive revenue report — per-source breakdown, stream telemetry, NCL metrics.

    Fetches data from the pool's /api/v1/revenue/stats endpoint and enriches it
    with ZION mining data and historical context from the existing revenue dashboard.
    """
    # Get the pool revenue stats
    pool_rev = _fetch_pool_revenue_stats()

    # Also get the existing revenue dashboard data for ZION mining context
    dashboard = get_revenue_dashboard()

    # Merge: pool revenue stats provide per-source breakdown, dashboard provides ZION mining data
    result = {
        "ok": True,
        "timestamp": pool_rev.get("timestamp", 0),
        "uptime_secs": pool_rev.get("uptime_secs", 0),
        "totals": pool_rev.get("totals", {}),
        "sources": pool_rev.get("sources", []),
        "auxpow": pool_rev.get("auxpow", {}),
        "stream_profit": pool_rev.get("stream_profit", {}),
        "fee_split": pool_rev.get("fee_split", {}),
        "pplns": pool_rev.get("pplns", {}),
        # Enrich with ZION mining data from dashboard
        "zion_mined_total": dashboard.get("revenue", {}).get("zion_mined_total", 0),
        "zion_paid_total": dashboard.get("revenue", {}).get("zion_paid_total", 0),
        "zion_pending": dashboard.get("revenue", {}).get("zion_pending", 0),
        "zion_per_day": dashboard.get("revenue", {}).get("zion_per_day", 0),
        "blocks_found": dashboard.get("revenue", {}).get("blocks_found", 0),
        "blocks_per_day": dashboard.get("revenue", {}).get("blocks_per_day", 0),
        "pool_hashrate": dashboard.get("revenue", {}).get("pool_hashrate", 0),
        "coin_revenue": dashboard.get("revenue", {}).get("coin_revenue", []),
        "active_coins": dashboard.get("revenue", {}).get("active_coins", []),
        "distributions": dashboard.get("revenue", {}).get("distributions", []),
    }
    return result


def get_revenue_streams() -> dict:
    """Per-stream telemetry — Deeksha Chv3 pipeline weights and work distribution."""
    return _fetch_pool_revenue_streams()


def get_multichain_dashboard() -> dict:
    """V31 Multichain service dashboard: WARP health, chains, transfers, DEX status."""
    host = "127.0.0.1"
    warp_port = 8453
    dex_port = 8454

    warp_alive = check_port_open(host, warp_port, timeout=1.5)
    warp_health = fetch_service_json(host, warp_port, "/health") if warp_alive else {}
    chains_resp = fetch_service_json(host, warp_port, "/chains") if warp_alive else {}
    transfers_resp = fetch_service_json(host, warp_port, "/transfers") if warp_alive else {}

    chains = chains_resp.get("data", []) if isinstance(chains_resp, dict) else []
    transfers = transfers_resp.get("data", []) if isinstance(transfers_resp, dict) else []

    dex_alive = check_port_open(host, dex_port, timeout=1.0)
    dex_health = {}
    if dex_alive:
        try:
            dex_health = fetch_service_json(host, dex_port, "/v1/multichain/health", timeout=1.5)
        except Exception:
            pass

    return {
        "ok": True,
        "warp": {
            "alive": warp_alive,
            "status": "online" if warp_alive else "offline",
            "version": warp_health.get("version", "—") if isinstance(warp_health, dict) else "—",
            "transfers_total": warp_health.get("transfers_total", 0) if isinstance(warp_health, dict) else 0,
            "transfers_pending": warp_health.get("transfers_pending", 0) if isinstance(warp_health, dict) else 0,
        },
        "chains": {
            "count": len(chains),
            "items": chains,
        },
        "transfers": {
            "count": len(transfers),
            "pending": len([t for t in transfers if isinstance(t, dict) and t.get("status") in ("pending", "initiated", "awaiting")]),
            "items": transfers[:20],
        },
        "dex": {
            "alive": dex_alive,
            "status": "online" if dex_alive else "offline",
            "health": dex_health if isinstance(dex_health, dict) else {},
        },
    }


# ── AuxPow / external-pool configuration helpers ─────────────────────────────

# Path to the Edge shared environment file loaded by zion-pool.service.
# AuxPow env vars are persisted here so they survive a pool restart.
# We try production locations first, then the local dev repo path.
_EDGE_ENV_CANDIDATES = [
    Path("/etc/zion/edge-environment.sh"),
    Path("/root/zion/edge-environment.sh"),
    Path("/root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh"),
    REPO_ROOT / "edge-deploy" / "config" / "edge-environment.sh",
]
EDGE_ENV_FILE = next((p for p in _EDGE_ENV_CANDIDATES if p.exists()), _EDGE_ENV_CANDIDATES[-1])

# Pool service name: zion-pool on current Edge deployment, zion-edge-pool in repo docs.
_AUXPOW_SERVICE_CANDIDATES = ["zion-pool", "zion-edge-pool"]

def _resolve_auxpow_service_name() -> str:
    """Pick the pool systemd service name present on this machine (or default)."""
    try:
        for name in _AUXPOW_SERVICE_CANDIDATES:
            out = subprocess.run(
                ["systemctl", "is-active", "--quiet", name],
                capture_output=True, timeout=3
            )
            if out.returncode in (0, 3):  # active or inactive but known
                return name
    except Exception:
        pass
    return _AUXPOW_SERVICE_CANDIDATES[0]

AUXPOW_SERVICE_NAME = _resolve_auxpow_service_name()

# Coins the pool can force-switch to. Keep in sync with AuXpow/src/types.rs ExternalCoin.
AUXPOW_SUPPORTED_COINS = [
    "DCR", "ALPH", "KAS", "ERG", "RVN", "ETC",
    "EVR", "MEWC", "FLUX", "CLORE", "XMR", "VRSC",
    "EPIC", "PRL", "QUAI", "BEAM",
    "KLS", "ZCL", "QTC", "VTC", "IRON", "NEXA", "RTM", "DNX",
]

AUXPOW_POOL_PREFERENCES = ["default", "nicehash", "herominers", "zpool"]


def _read_edge_env_var(key: str, default: str = "") -> str:
    """Read a single KEY=value from the Edge environment file if it exists."""
    try:
        if not EDGE_ENV_FILE.exists():
            return default
        text = EDGE_ENV_FILE.read_text(encoding="utf-8")
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == key:
                return v.strip().strip('"').strip("'")
    except Exception:
        pass
    return default


def _write_edge_env_vars(updates: dict) -> dict:
    """Update or append KEY=value pairs in the Edge environment file.

    Creates a timestamped backup before writing. Empty values are still written
    because the Rust parser ignores empty env vars.
    """
    try:
        backup = None
        if not EDGE_ENV_FILE.exists():
            EDGE_ENV_FILE.parent.mkdir(parents=True, exist_ok=True)
            existing_lines = ["# ZION Edge Server — shared environment\n"]
        else:
            existing_lines = EDGE_ENV_FILE.read_text(encoding="utf-8").splitlines(keepends=True)
            try:
                backup = EDGE_ENV_FILE.with_suffix(
                    EDGE_ENV_FILE.suffix + f".bak-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
                )
                shutil.copy2(str(EDGE_ENV_FILE), str(backup))
            except Exception:
                backup = None  # Skip backup if permission denied (read-only fs)

        parsed = {}
        for idx, line in enumerate(existing_lines):
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                parsed[idx] = None
                continue
            k, v = stripped.split("=", 1)
            parsed[idx] = (k.strip(), v.strip().strip('"').strip("'"))

        updated_keys = set()
        out_lines = list(existing_lines)

        for key, value in updates.items():
            found = False
            for idx, item in parsed.items():
                if item is None:
                    continue
                k, _ = item
                if k == key:
                    original = out_lines[idx]
                    ending = original[len(original.rstrip("\r\n")):]
                    out_lines[idx] = f'{key}="{value}"{ending}'
                    found = True
                    updated_keys.add(key)
                    break
            if not found:
                out_lines.append(f'{key}="{value}"\n')
                updated_keys.add(key)

        EDGE_ENV_FILE.write_text("".join(out_lines), encoding="utf-8")
        return {
            "ok": True,
            "updated_keys": sorted(updated_keys),
            "backup": str(backup) if backup else None,
        }
    except Exception as e:
        return {"ok": False, "error": f"Failed to write env file: {e}"}


def get_auxpow_config() -> dict:
    """Return current AuxPow configuration from the Edge environment file."""
    enabled = _read_edge_env_var("ZION_POOL_AUXPOW_ENABLED", "0").lower() in ("1", "true", "yes")
    coin = _read_edge_env_var("ZION_POOL_AUXPOW_COIN", "")
    pool_preference = _read_edge_env_var("ZION_POOL_AUXPOW_POOL_PREFERENCE", "default")
    region = _read_edge_env_var("ZION_POOL_AUXPOW_REGION", "eu")
    split_zion = _read_edge_env_var("ZION_POOL_AUXPOW_SPLIT_ZION", "")
    split_external = _read_edge_env_var("ZION_POOL_AUXPOW_SPLIT_EXTERNAL", "")
    wallet = _read_edge_env_var(
        "ZION_POOL_AUXPOW_WALLET",
        "bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh",
    )
    worker = _read_edge_env_var("ZION_POOL_AUXPOW_WORKER_NAME", "zion_auxpow")

    coin_wallets = {}
    for ticker in AUXPOW_SUPPORTED_COINS:
        v = _read_edge_env_var(f"ZION_POOL_AUXPOW_WALLET_{ticker}", "")
        if v:
            coin_wallets[ticker] = v

    if not enabled:
        mode = "zion"
    elif coin:
        mode = "force"
    else:
        mode = "auto"

    try:
        sz = int(split_zion) if split_zion.isdigit() else 50
    except Exception:
        sz = 50
    try:
        se = int(split_external) if split_external.isdigit() else 50
    except Exception:
        se = 50

    # ── Stream profit config (Deeksha Chv3 pipeline weights) ──────────
    sp_enabled = _read_edge_env_var("ZION_STREAM_PROFIT_SWITCH", "false").lower() in ("1", "true", "yes")
    sp_provider = _read_edge_env_var("ZION_STREAM_PROFIT_API_PROVIDER", "fallback")
    sp_interval = _read_edge_env_var("ZION_STREAM_PROFIT_INTERVAL", "120")
    sp_hysteresis = _read_edge_env_var("ZION_STREAM_HYSTERESIS_PCT", "15.0")
    sp_sources = _read_edge_env_var("ZION_STREAM_PROFIT_SOURCES", "zion,keccak_bonus,sha3_bonus,ncl_ai")

    return {
        "ok": True,
        "config": {
            "mode": mode,
            "enabled": enabled,
            "coin": coin,
            "pool_preference": pool_preference,
            "region": region,
            "split_zion": sz,
            "split_external": se,
            "wallet": wallet,
            "worker_name": worker,
            "coin_wallets": coin_wallets,
            # Stream profit config
            "stream_profit_enabled": sp_enabled,
            "stream_profit_provider": sp_provider,
            "stream_profit_interval": sp_interval,
            "stream_profit_hysteresis": sp_hysteresis,
            "stream_profit_sources": sp_sources,
        },
        "supported_coins": AUXPOW_SUPPORTED_COINS,
        "supported_preferences": AUXPOW_POOL_PREFERENCES,
        "supported_stream_sources": ["zion", "keccak_bonus", "sha3_bonus", "ncl_ai", "deeksha_lite", "thermal_bonus"],
        "supported_stream_providers": ["fallback", "nicehash", "whattomine", "coingecko"],
        "env_file": str(EDGE_ENV_FILE),
        "env_file_exists": EDGE_ENV_FILE.exists(),
    }


def update_auxpow_config(payload: dict) -> dict:
    """Validate and persist AuxPow configuration to the Edge environment file."""
    mode = payload.get("mode", "zion")
    if mode not in ("zion", "auto", "force"):
        return {"ok": False, "error": f"Invalid mode: {mode}. Use zion, auto or force."}

    enabled = mode != "zion"
    coin = (payload.get("coin") or "").upper().strip() if mode == "force" else ""
    if mode == "force" and coin not in AUXPOW_SUPPORTED_COINS:
        return {
            "ok": False,
            "error": f"Unsupported coin: {coin}. Supported: {', '.join(AUXPOW_SUPPORTED_COINS)}",
        }

    pool_preference = (payload.get("pool_preference") or "default").lower().strip()
    if pool_preference not in AUXPOW_POOL_PREFERENCES:
        return {
            "ok": False,
            "error": f"Unsupported pool preference: {pool_preference}",
        }

    region = (payload.get("region") or "eu").strip()
    try:
        split_zion = max(0, min(100, int(payload.get("split_zion", 50))))
    except Exception:
        split_zion = 50
    try:
        split_external = max(0, min(100, int(payload.get("split_external", 50))))
    except Exception:
        split_external = 50

    wallet = (payload.get("wallet") or "").strip()
    worker = (payload.get("worker_name") or "zion_auxpow").strip()
    coin_wallets = payload.get("coin_wallets") or {}

    updates = {
        "ZION_POOL_AUXPOW_ENABLED": "1" if enabled else "0",
        "ZION_POOL_AUXPOW_COIN": coin,
        "ZION_POOL_AUXPOW_POOL_PREFERENCE": pool_preference,
        "ZION_POOL_AUXPOW_REGION": region,
        "ZION_POOL_AUXPOW_SPLIT_ZION": str(split_zion),
        "ZION_POOL_AUXPOW_SPLIT_EXTERNAL": str(split_external),
        "ZION_POOL_AUXPOW_WALLET": wallet,
        "ZION_POOL_AUXPOW_WORKER_NAME": worker,
    }

    # ── Stream profit config (Deeksha Chv3 pipeline weights) ──────────
    sp_enabled = payload.get("stream_profit_enabled")
    if sp_enabled is not None:
        updates["ZION_STREAM_PROFIT_SWITCH"] = "true" if sp_enabled else "false"
    sp_provider = payload.get("stream_profit_provider")
    if sp_provider:
        updates["ZION_STREAM_PROFIT_API_PROVIDER"] = sp_provider
    sp_interval = payload.get("stream_profit_interval")
    if sp_interval:
        updates["ZION_STREAM_PROFIT_INTERVAL"] = str(sp_interval)
    sp_hysteresis = payload.get("stream_profit_hysteresis")
    if sp_hysteresis:
        updates["ZION_STREAM_HYSTERESIS_PCT"] = str(sp_hysteresis)
    sp_sources = payload.get("stream_profit_sources")
    if sp_sources:
        updates["ZION_STREAM_PROFIT_SOURCES"] = str(sp_sources)
    for ticker in AUXPOW_SUPPORTED_COINS:
        updates[f"ZION_POOL_AUXPOW_WALLET_{ticker}"] = str(coin_wallets.get(ticker, "")).strip()

    write_result = _write_edge_env_vars(updates)
    if not write_result.get("ok"):
        return write_result

    return {
        "ok": True,
        "message": "AuxPow configuration saved to Edge environment file.",
        "restarted": False,
        "config": get_auxpow_config()["config"],
        "env_file": str(EDGE_ENV_FILE),
    }


def restart_auxpow_pool_service() -> dict:
    """Reload systemd and restart the Edge pool so new AuxPow env vars take effect."""
    try:
        cmd = f"sudo systemctl daemon-reload && sudo systemctl restart {AUXPOW_SERVICE_NAME}"
        out = _run_edge_cmd(cmd, timeout=30)
        if out.returncode != 0:
            return {
                "ok": False,
                "error": out.stderr.strip() or f"sudo systemctl restart {AUXPOW_SERVICE_NAME} failed",
            }
        return {
            "ok": True,
            "message": f"{AUXPOW_SERVICE_NAME} restarted successfully.",
        }
    except Exception as e:
        return {"ok": False, "error": f"Restart failed: {e}"}


# ── Pool Setup: 3-stream configuration ────────────────────────────────
# Stream 1: ZION Deeksha (GPU primary, always native)
# Stream 2: GPU external coin (auto-switch or forced)
# Stream 3: CPU external coin (VRSC/XMR, auto-switch or forced)

# Supported coins (ticker, algorithm, pool_address, e2e_status)
# Aligned with AuXpow/src/types.rs ExternalCoin defaults.
# v3.0.6: 23 coins total (15 original + 8 new GPU-mineable)
POOL_SETUP_SUPPORTED_COINS = [
    ("DCR",  "blake3",      "pool.woolypooly.com:3152",            "ok"),
    ("ALPH", "blake3",      "pool.woolypooly.com:3106",            "ok"),
    ("KAS",  "kheavyhash",  "kas.2miners.com:2020",                "ok"),
    ("ERG",  "autolykos",   "erg.2miners.com:8888",                "ok"),
    ("RVN",  "kawpow",      "rvn.2miners.com:6060",                "ok"),
    ("ETC",  "ethash",      "etc.2miners.com:1010",                "ok"),
    ("EVR",  "evrprogpow",  "evrprogpow.eu.mine.zpool.ca:1330",    "ok"),
    ("MEWC", "meowpow",     "meowpow.eu.mine.zpool.ca:1327",       "ok"),
    ("FLUX", "zelhash",     "flux.woolypooly.com:3000",            "ok"),
    ("CLORE","kawpow",      "clore.woolypooly.com:3090",           "ok"),
    ("XMR",  "randomx",     "gulf.moneroocean.stream:10001",       "ok"),
    ("VRSC", "verushash",   "eu.luckpool.net:3956",                "ok"),
    ("EPIC", "progpow",     "de.epicmine.io:3334",                 "ok"),
    ("QUAI", "kawpow",      "quaikawpow.2miners.com:4545",         "ok"),
    ("BEAM", "beamhash",    "beam.2miners.com:5252",               "ok"),
    ("KLS",  "karlsenhash", "pool.woolypooly.com:3132",            "warn"),
    ("ZCL",  "equihashzero","equihash192.eu.mine.zpool.ca:2144",   "ok"),
    ("QTC",  "qhash",       "qtc.suprnova.cc:5555",                "ok"),
    ("VTC",  "verthash",    "verthash.eu.mine.zpool.ca:4533",      "ok"),
    ("IRON", "fishhash",    "de.ironfish.herominers.com:1145",     "warn"),
    ("NEXA", "nexapow",     "nexa.2miners.com:5050",               "ok"),
    ("RTM",  "ghostrider",  "ghostrider.eu.mine.zpool.ca:5354",    "ok"),
    ("DNX",  "dynexsolve",  "dynex.herominers.com:1030",           "warn"),
]

POOL_SETUP_COIN_E2E_NOTES = {
    "KLS":  "EthStratum auth pending — pool requires valid KLS wallet",
    "IRON": "Herominers TCP OK but no stratum response (30s timeout)",
    "DNX":  "All pools unreachable from datacenter IP",
}

# Coins suitable for each stream
STREAM2_GPU_COINS = [
    "DCR", "ALPH", "KAS", "ERG", "RVN", "ETC", "EVR", "MEWC",
    "FLUX", "CLORE", "EPIC", "QUAI", "BEAM", "KLS", "ZCL", "QTC",
    "VTC", "IRON", "NEXA", "DNX",
]
STREAM3_CPU_COINS = ["VRSC", "XMR", "RTM"]

# Algorithm → hardware type mapping
COIN_HARDWARE = {
    "VRSC": "CPU", "XMR": "CPU",
    "DCR": "GPU", "ALPH": "GPU", "KAS": "GPU", "ERG": "GPU",
    "RVN": "GPU", "ETC": "GPU", "EVR": "GPU", "MEWC": "GPU",
    "FLUX": "GPU", "CLORE": "GPU", "EPIC": "GPU", "QUAI": "GPU",
    "BEAM": "GPU", "KLS": "GPU", "ZCL": "GPU", "QTC": "GPU",
    "VTC": "GPU", "IRON": "GPU", "NEXA": "GPU", "RTM": "CPU", "DNX": "GPU",
}

# Algorithm → DAG requirement (None = no DAG, always fits VRAM)
COIN_DAG_SIZE = {
    "RVN": 4_294_967_296, "ETC": 2_684_354_560, "FLUX": 6_000_000_000,
    "CLORE": 4_294_967_296, "QUAI": 4_294_967_296, "EPIC": 2_684_354_560,
    "NEXA": 8_000_000_000, "RTM": 4_294_967_296,
}


def get_pool_setup_config() -> dict:
    """Return comprehensive 3-stream pool setup configuration."""
    # ── Stream 1: ZION (always native) ──
    s1_enabled = _read_edge_env_var("ZION_STREAM1_ENABLED", "1").lower() in ("1", "true", "yes")
    s1_algorithm = _read_edge_env_var("ZION_PRIMARY_ALGORITHM", "deeksha_lite_v1")
    s1_gpu_backend = _read_edge_env_var("ZION_PRIMARY_GPU_BACKEND", "opencl")
    s1_gpu_work_size = _read_edge_env_var("ZION_PRIMARY_GPU_WORK_SIZE", "262144")

    # ── Stream 2: GPU external ──
    s2_enabled = _read_edge_env_var("ZION_STREAM2_ENABLED", "1").lower() in ("1", "true", "yes")
    s2_coin = _read_edge_env_var("ZION_STREAM2_COIN", "").upper()
    s2_gpu_work_size = _read_edge_env_var("ZION_SECONDARY_GPU_WORK_SIZE", "4194304")
    s2_pearl_backend = _read_edge_env_var("ZION_PEARL_GPU_BACKEND", "opencl")
    s2_pearl_work_size = _read_edge_env_var("ZION_PEARL_GPU_WORK_SIZE", "262144")

    # ── Stream 3: CPU external ──
    s3_enabled = _read_edge_env_var("ZION_STREAM3_ENABLED", "1").lower() in ("1", "true", "yes")
    s3_coin = _read_edge_env_var("ZION_STREAM3_COIN", "").upper()
    s3_threads = _read_edge_env_var("ZION_THREADS", "4")
    # CPU bridge config (pool-side)
    cpu_coin = _read_edge_env_var("ZION_POOL_AUXPOW_CPU_COIN", "VRSC").upper()
    cpu_wallet = _read_edge_env_var("ZION_POOL_AUXPOW_CPU_WALLET", "")
    cpu_worker = _read_edge_env_var("ZION_POOL_AUXPOW_CPU_WORKER_NAME", "zion_triple")
    cpu_region = _read_edge_env_var("ZION_POOL_AUXPOW_CPU_REGION", "eu")

    # ── Pool-side AuxPow config ──
    aux_enabled = _read_edge_env_var("ZION_POOL_AUXPOW_ENABLED", "0").lower() in ("1", "true", "yes")
    aux_coin = _read_edge_env_var("ZION_POOL_AUXPOW_COIN", "").upper()
    aux_pool_pref = _read_edge_env_var("ZION_POOL_AUXPOW_POOL_PREFERENCE", "default")
    aux_region = _read_edge_env_var("ZION_POOL_AUXPOW_REGION", "eu")
    aux_split_zion = _read_edge_env_var("ZION_POOL_AUXPOW_SPLIT_ZION", "50")
    aux_split_ext = _read_edge_env_var("ZION_POOL_AUXPOW_SPLIT_EXTERNAL", "50")
    aux_wallet = _read_edge_env_var("ZION_POOL_AUXPOW_WALLET", "")
    aux_worker = _read_edge_env_var("ZION_POOL_AUXPOW_WORKER_NAME", "zion-pool")

    # ── Per-coin wallets ──
    coin_wallets = {}
    for ticker in AUXPOW_SUPPORTED_COINS:
        v = _read_edge_env_var(f"ZION_POOL_AUXPOW_WALLET_{ticker}", "")
        if v:
            coin_wallets[ticker] = v

    # ── Stream profit (Deeksha Chv3) ──
    sp_enabled = _read_edge_env_var("ZION_STREAM_PROFIT_SWITCH", "false").lower() in ("1", "true", "yes")
    sp_provider = _read_edge_env_var("ZION_STREAM_PROFIT_API_PROVIDER", "fallback")
    sp_interval = _read_edge_env_var("ZION_STREAM_PROFIT_INTERVAL", "120")
    sp_hysteresis = _read_edge_env_var("ZION_STREAM_HYSTERESIS_PCT", "15.0")
    sp_sources = _read_edge_env_var("ZION_STREAM_PROFIT_SOURCES", "zion,keccak_bonus,sha3_bonus,ncl_ai")

    # ── Autonomous mode ──
    autonomous = _read_edge_env_var("ZION_AUTONOMOUS", "0").lower() in ("1", "true", "yes")
    auto_mode = _read_edge_env_var("ZION_AUTO_MODE", "manual")
    profit_interval = _read_edge_env_var("ZION_PROFIT_INTERVAL", "300")
    profit_hysteresis = _read_edge_env_var("ZION_PROFIT_HYSTERESIS", "15")
    profit_api = _read_edge_env_var("ZION_PROFIT_API", "whattomine")
    elec_price = _read_edge_env_var("ZION_ELECTRICITY_PRICE", "0.12")
    gpu_tdp = _read_edge_env_var("ZION_GPU_TDP", "225")
    cpu_tdp = _read_edge_env_var("ZION_CPU_TDP", "65")

    # ── Pool failover ──
    pool_addrs = _read_edge_env_var("ZION_POOL_ADDR", "62.171.141.136:8444")

    # ── Build coin list with metadata ──
    coins_meta = []
    for coin, algo, pool_addr, e2e_status in POOL_SETUP_SUPPORTED_COINS:
        hw = COIN_HARDWARE.get(coin, "GPU")
        dag = COIN_DAG_SIZE.get(coin, None)
        coins_meta.append({
            "coin": coin,
            "algorithm": algo,
            "pool": pool_addr,
            "e2e_status": e2e_status,
            "e2e_note": POOL_SETUP_COIN_E2E_NOTES.get(coin, ""),
            "hardware": hw,
            "dag_size": dag,
            "wallet": coin_wallets.get(coin, ""),
            "stream": 2 if hw == "GPU" else 3,
        })

    # ── Runtime coin overrides (hot-switch via pool HTTP API) ──
    cpu_override = _pool_coin_override_get("cpu")
    gpu_override = _pool_coin_override_get("gpu")

    return {
        "ok": True,
        "runtime_overrides": {
            "cpu_coin": cpu_override.get("coin") or None,
            "gpu_coin": gpu_override.get("coin") or None,
        },
        "streams": {
            "stream1": {
                "name": "ZION Deeksha",
                "enabled": s1_enabled,
                "algorithm": s1_algorithm,
                "gpu_backend": s1_gpu_backend,
                "gpu_work_size": s1_gpu_work_size,
                "always_native": True,
                "coin": "ZION",
            },
            "stream2": {
                "name": "GPU External",
                "enabled": s2_enabled,
                "coin": s2_coin or aux_coin or "",
                "mode": "auto" if not (s2_coin or aux_coin) else "force",
                "gpu_work_size": s2_gpu_work_size,
                "pearl_backend": s2_pearl_backend,
                "pearl_work_size": s2_pearl_work_size,
                "candidate_coins": STREAM2_GPU_COINS,
            },
            "stream3": {
                "name": "CPU External",
                "enabled": s3_enabled,
                "coin": s3_coin or cpu_coin or "VRSC",
                "mode": "auto" if not (s3_coin or cpu_coin) else "force",
                "threads": s3_threads,
                "cpu_wallet": cpu_wallet,
                "cpu_worker": cpu_worker,
                "cpu_region": cpu_region,
                "candidate_coins": STREAM3_CPU_COINS,
            },
        },
        "auxpow": {
            "enabled": aux_enabled,
            "coin": aux_coin,
            "pool_preference": aux_pool_pref,
            "region": aux_region,
            "split_zion": aux_split_zion,
            "split_external": aux_split_ext,
            "wallet": aux_wallet,
            "worker_name": aux_worker,
        },
        "coin_wallets": coin_wallets,
        "stream_profit": {
            "enabled": sp_enabled,
            "provider": sp_provider,
            "interval": sp_interval,
            "hysteresis": sp_hysteresis,
            "sources": sp_sources,
        },
        "autonomous": {
            "enabled": autonomous,
            "auto_mode": auto_mode,
            "profit_interval": profit_interval,
            "profit_hysteresis": profit_hysteresis,
            "profit_api": profit_api,
            "electricity_price": elec_price,
            "gpu_tdp": gpu_tdp,
            "cpu_tdp": cpu_tdp,
        },
        "pool_failover": pool_addrs,
        "coins": coins_meta,
        "supported_coins": AUXPOW_SUPPORTED_COINS,
        "supported_preferences": AUXPOW_POOL_PREFERENCES,
        "supported_stream_sources": ["zion", "keccak_bonus", "sha3_bonus", "ncl_ai", "deeksha_lite", "thermal_bonus"],
        "supported_stream_providers": ["fallback", "nicehash", "whattomine", "coingecko"],
        "env_file": str(EDGE_ENV_FILE),
        "env_file_exists": EDGE_ENV_FILE.exists(),
    }


def update_pool_setup_config(payload: dict) -> dict:
    """Validate and persist 3-stream pool setup to the Edge environment file."""
    updates = {}

    # ── Stream 1 ──
    s1 = payload.get("stream1") or {}
    if "enabled" in s1:
        updates["ZION_STREAM1_ENABLED"] = "1" if s1["enabled"] else "0"
    if s1.get("algorithm"):
        updates["ZION_PRIMARY_ALGORITHM"] = s1["algorithm"]
    if s1.get("gpu_backend"):
        updates["ZION_PRIMARY_GPU_BACKEND"] = s1["gpu_backend"]
    if s1.get("gpu_work_size"):
        updates["ZION_PRIMARY_GPU_WORK_SIZE"] = str(s1["gpu_work_size"])

    # ── Stream 2 ──
    s2 = payload.get("stream2") or {}
    if "enabled" in s2:
        updates["ZION_STREAM2_ENABLED"] = "1" if s2["enabled"] else "0"
    s2_mode = s2.get("mode", "auto")
    s2_coin = (s2.get("coin") or "").upper().strip()
    if s2_mode == "force" and s2_coin:
        if s2_coin not in STREAM2_GPU_COINS:
            return {"ok": False, "error": f"Stream 2 coin {s2_coin} not a GPU coin"}
        updates["ZION_STREAM2_COIN"] = s2_coin
    elif s2_mode == "auto":
        updates["ZION_STREAM2_COIN"] = ""
    if s2.get("gpu_work_size"):
        updates["ZION_SECONDARY_GPU_WORK_SIZE"] = str(s2["gpu_work_size"])
    if s2.get("pearl_backend"):
        updates["ZION_PEARL_GPU_BACKEND"] = s2["pearl_backend"]
    if s2.get("pearl_work_size"):
        updates["ZION_PEARL_GPU_WORK_SIZE"] = str(s2["pearl_work_size"])

    # ── Stream 3 ──
    s3 = payload.get("stream3") or {}
    if "enabled" in s3:
        updates["ZION_STREAM3_ENABLED"] = "1" if s3["enabled"] else "0"
    s3_mode = s3.get("mode", "auto")
    s3_coin = (s3.get("coin") or "").upper().strip()
    if s3_mode == "force" and s3_coin:
        if s3_coin not in STREAM3_CPU_COINS:
            return {"ok": False, "error": f"Stream 3 coin {s3_coin} not a CPU coin"}
        updates["ZION_STREAM3_COIN"] = s3_coin
        updates["ZION_POOL_AUXPOW_CPU_COIN"] = s3_coin
    elif s3_mode == "auto":
        updates["ZION_STREAM3_COIN"] = ""
    if s3.get("threads"):
        updates["ZION_THREADS"] = str(s3["threads"])
    if s3.get("cpu_wallet"):
        updates["ZION_POOL_AUXPOW_CPU_WALLET"] = s3["cpu_wallet"]
    if s3.get("cpu_worker"):
        updates["ZION_POOL_AUXPOW_CPU_WORKER_NAME"] = s3["cpu_worker"]
    if s3.get("cpu_region"):
        updates["ZION_POOL_AUXPOW_CPU_REGION"] = s3["cpu_region"]

    # ── AuxPow global ──
    aux = payload.get("auxpow") or {}
    if "enabled" in aux:
        updates["ZION_POOL_AUXPOW_ENABLED"] = "1" if aux["enabled"] else "0"
    if aux.get("coin") is not None:
        coin = (aux["coin"] or "").upper().strip()
        if coin and coin not in AUXPOW_SUPPORTED_COINS:
            return {"ok": False, "error": f"Unsupported coin: {coin}"}
        updates["ZION_POOL_AUXPOW_COIN"] = coin
    if aux.get("pool_preference"):
        updates["ZION_POOL_AUXPOW_POOL_PREFERENCE"] = aux["pool_preference"]
    if aux.get("region"):
        updates["ZION_POOL_AUXPOW_REGION"] = aux["region"]
    if "split_zion" in aux:
        updates["ZION_POOL_AUXPOW_SPLIT_ZION"] = str(max(0, min(100, int(aux["split_zion"]))))
    if "split_external" in aux:
        updates["ZION_POOL_AUXPOW_SPLIT_EXTERNAL"] = str(max(0, min(100, int(aux["split_external"]))))
    if aux.get("wallet") is not None:
        updates["ZION_POOL_AUXPOW_WALLET"] = aux["wallet"]
    if aux.get("worker_name"):
        updates["ZION_POOL_AUXPOW_WORKER_NAME"] = aux["worker_name"]

    # ── Per-coin wallets ──
    coin_wallets = payload.get("coin_wallets") or {}
    for ticker in AUXPOW_SUPPORTED_COINS:
        if ticker in coin_wallets:
            updates[f"ZION_POOL_AUXPOW_WALLET_{ticker}"] = str(coin_wallets.get(ticker, "")).strip()

    # ── Stream profit ──
    sp = payload.get("stream_profit") or {}
    if "enabled" in sp:
        updates["ZION_STREAM_PROFIT_SWITCH"] = "true" if sp["enabled"] else "false"
    if sp.get("provider"):
        updates["ZION_STREAM_PROFIT_API_PROVIDER"] = sp["provider"]
    if sp.get("interval"):
        updates["ZION_STREAM_PROFIT_INTERVAL"] = str(sp["interval"])
    if sp.get("hysteresis"):
        updates["ZION_STREAM_HYSTERESIS_PCT"] = str(sp["hysteresis"])
    if sp.get("sources"):
        updates["ZION_STREAM_PROFIT_SOURCES"] = str(sp["sources"])

    # ── Autonomous ──
    auto = payload.get("autonomous") or {}
    if "enabled" in auto:
        updates["ZION_AUTONOMOUS"] = "1" if auto["enabled"] else "0"
    if auto.get("auto_mode"):
        updates["ZION_AUTO_MODE"] = auto["auto_mode"]
    if auto.get("profit_interval"):
        updates["ZION_PROFIT_INTERVAL"] = str(auto["profit_interval"])
    if auto.get("profit_hysteresis"):
        updates["ZION_PROFIT_HYSTERESIS"] = str(auto["profit_hysteresis"])
    if auto.get("profit_api"):
        updates["ZION_PROFIT_API"] = auto["profit_api"]
    if auto.get("electricity_price"):
        updates["ZION_ELECTRICITY_PRICE"] = str(auto["electricity_price"])
    if auto.get("gpu_tdp"):
        updates["ZION_GPU_TDP"] = str(auto["gpu_tdp"])
    if auto.get("cpu_tdp"):
        updates["ZION_CPU_TDP"] = str(auto["cpu_tdp"])

    # ── Pool failover ──
    if payload.get("pool_failover"):
        updates["ZION_POOL_ADDR"] = payload["pool_failover"]

    if not updates:
        return {"ok": False, "error": "No fields to update"}

    write_result = _write_edge_env_vars(updates)
    if not write_result.get("ok"):
        return write_result

    return {
        "ok": True,
        "message": "Pool setup configuration saved to Edge environment file.",
        "updated_keys": write_result.get("updated_keys", []),
        "backup": write_result.get("backup"),
        "config": get_pool_setup_config(),
        "env_file": str(EDGE_ENV_FILE),
    }


def get_servers_setup() -> dict:
    """Return server setup, services, disk health, and automation status for the Servers Setup tab."""
    import subprocess, os

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

    # ── ZION services (Edge deployment units) ──────────────────────
    zion_services = EDGE_SERVICE_ORDER
    services = []
    for svc in zion_services:
        try:
            unit = _EDGE_SYSTEMD_UNITS.get(svc, svc + ".service")
            r = subprocess.run(
                ["systemctl", "is-active", unit],
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
        with urllib.request.urlopen(f"http://{host}:{V31_POOL_API_PORT}/api/v1/miner/{address}/stats", timeout=5) as r:
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
        atomic, _ = _get_on_chain_balance(address)
        result["on_chain_balance_zion"] = flowers_to_zion(atomic)
    except Exception:
        result["on_chain_balance_zion"] = 0

    # Payouts
    try:
        with urllib.request.urlopen(f"http://{host}:{V31_POOL_API_PORT}/api/v1/miner/{address}/payouts", timeout=5) as r:
            data = json.loads(r.read().decode())
            if data.get("ok"):
                payouts = data.get("pending_payouts", [])
                for p in payouts:
                    p["amount_zion"] = flowers_to_zion(p.get("amount_atomic", 0) or 0)
                result["payouts"] = payouts
    except Exception:
        result["payouts"] = []

    # Ensure stats.total_paid matches the sum of the returned payout list so the
    # dashboard UI stays consistent even if a payout lands between the /stats
    # and /payouts calls.
    try:
        payouts = result.get("payouts", [])
        if payouts:
            payout_total = sum(int(p.get("amount_atomic", 0) or 0) for p in payouts)
            stats = result.setdefault("stats", {})
            stats["total_paid"] = payout_total
            stats["total_paid_zion"] = flowers_to_zion(payout_total)
    except Exception:
        pass

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
    auto_dir = REPO_ROOT / "backups" / "auto"
    auto_backups = []
    for sub_dir in (auto_dir, REPO_ROOT / "backups" / "daily", REPO_ROOT / "backups" / "weekly"):
        if sub_dir.exists():
            for f in sorted(sub_dir.glob("*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True):
                s = f.stat()
                size_mb = round(s.st_size / (1024*1024), 2)
                total_backup_mb += size_mb
                auto_backups.append({
                    "name": f"{sub_dir.name}/{f.name}" if f.parent != REPO_ROOT / "backups" / "auto" else f.name,
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

    # ── Primary: fetch from pool /stats API (port V31_POOL_API_PORT) ──────────────────
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{host}:{V31_POOL_API_PORT}/stats", timeout=3) as r:
            stats = json.loads(r.read().decode())
        # Blocks, shares, routing from /stats
        blocks = stats.get("blocks", {})
        if blocks.get("found"):
            status["blocks_found"] = blocks["found"]
        elif blocks.get("total_found"):
            status["blocks_found"] = blocks["total_found"]
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
        status["pool_wallet"] = os.environ.get("ZION_POOL_WALLET") or V31_CANONICAL_POOL_PAYOUT_WALLET
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

    # ── Tertiary: UTXO scan for pool wallet balance ─────────────────────
    wallet = status["pool_wallet"]
    if wallet and wallet.startswith("zion1"):
        try:
            atomic, _ = _get_on_chain_balance(wallet)
            status["balance_zion"] = flowers_to_zion(atomic)
        except Exception:
            pass
    status["ok"] = True
    return status

# ── Payout System Status Builder ─────────────────────────────────────────

def fetch_pool_stats() -> dict:
    """Fetch live pool stats from routing metrics endpoint (port V31_POOL_API_PORT)."""
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{host}:{V31_POOL_API_PORT}/stats", timeout=3) as r:
            return json.loads(r.read().decode())
    except Exception:
        return {}

def fetch_pool_miners() -> list:
    """Fetch active miners from Edge pool, enriched with paid_total.

    The pool's /miners endpoint now includes paid_total_atomic, so we only fall
    back to parsing Prometheus metrics when the field is missing (older pool
    binaries or stale responses).
    """
    host = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
    miners = []
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{host}:{V31_POOL_API_PORT}/miners?limit=200", timeout=5) as r:
            data = json.loads(r.read().decode())
            miners = data.get("miners", [])
    except Exception:
        pass

    # If every miner already has paid_total_atomic, normalize it and return.
    if miners and all(m.get("paid_total_atomic") is not None for m in miners):
        for m in miners:
            m["paid_total"] = flowers_to_zion(int(m.get("paid_total_atomic") or 0))
        return miners

    # Fallback: enrich with paid_total from Prometheus metrics.
    paid_map = {}
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{host}:{V31_POOL_API_PORT}/metrics", timeout=5) as r:
            for line in r.read().decode("utf-8", errors="ignore").splitlines():
                if line.startswith("zion_pool_miner_paid_total_atomic{"):
                    miner_id = re.search(r'miner_id="([^"]+)"', line)
                    worker_name = re.search(r'worker_name="([^"]+)"', line)
                    if miner_id:
                        key = f"{miner_id.group(1)}/{worker_name.group(1)}" if worker_name else miner_id.group(1)
                        paid_map[key] = int(line.split()[-1])
    except Exception:
        pass
    for m in miners:
        addr = m.get("address") or m.get("miner_id") or ""
        worker = m.get("worker_name") or ""
        key = f"{addr}/{worker}" if worker else addr
        paid_total_atomic = paid_map.get(key, paid_map.get(addr, 0))
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
        "shares_accepted": 0,
        "shares_rejected": 0,
    }

    # ── Topology-aware config discovery ───────────────────────────────
    is_edge = TOPOLOGY == "edge-primary"
    edge_host = "127.0.0.1"
    # V31 node RPC uses TCP on port 9445 (or whatever ZION_NODE_RPC_ADDR says)
    _rpc_addr = os.environ.get("ZION_NODE_RPC_ADDR", "")
    if _rpc_addr and ":" in _rpc_addr:
        try:
            _rpc_host_default, _rpc_port_str = _rpc_addr.rsplit(":", 1)
            rpc_port = int(_rpc_port_str)
            rpc_host_default = _rpc_host_default or "127.0.0.1"
        except Exception:
            rpc_port, rpc_host_default = 9445, "127.0.0.1"
    else:
        rpc_port, rpc_host_default = 9445, "127.0.0.1"
    local_rpc_alive = check_port_open(rpc_host_default, rpc_port, timeout=1.0)
    edge_rpc_alive = check_port_open(edge_host, rpc_port, timeout=1.5) if is_edge else False
    edge_stats_alive = check_port_open(edge_host, V31_POOL_API_PORT, timeout=1.5) if is_edge else False
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
        status["pool_wallet"] = os.environ.get("ZION_POOL_WALLET") or V31_CANONICAL_POOL_PAYOUT_WALLET
        status["payout_enabled"] = True
        status["fee_split"] = "89/5/5/1"
        # Try env var first, then edge-environment.sh, then hardcoded canonical
        _hum = os.environ.get("ZION_HUMANITARIAN_WALLET")
        _iss = os.environ.get("ZION_ISSOBELLA_WALLET")
        if not _hum or not _iss:
            # Read from edge-environment.sh
            for _envpath in ["/etc/zion/edge-environment.sh", "/root/zion/edge-environment.sh", "/root/zion/edge-node2-environment.sh"]:
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
        status["humanitarian_wallet"] = _hum or V31_CANONICAL_HUMANITARIAN_WALLET
        status["issobella_wallet"] = _iss or V31_CANONICAL_ISSOBELLA_WALLET
        status["pool_fee_wallet"] = ""
        status["miner_wallet"] = os.environ.get("ZION_MINER_ADDRESS") or V31_CANONICAL_DEFAULT_MINER_WALLET
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
        # Final canonical fallback (V2 mnemonic addresses, 2026-08-06 genesis reset)
        if not status["humanitarian_wallet"]:
            status["humanitarian_wallet"] = V31_CANONICAL_HUMANITARIAN_WALLET
        if not status["issobella_wallet"]:
            status["issobella_wallet"] = V31_CANONICAL_ISSOBELLA_WALLET
        if not status["pool_fee_wallet"]:
            status["pool_fee_wallet"] = os.environ.get("ZION_POOL_FEE_WALLET")

    # Override with actual addresses from the current chain tip when possible.
    try:
        latest_recipients = _get_latest_block_recipients(timeout=3.0)
        if latest_recipients.get("miner"):
            status["miner_wallet"] = latest_recipients["miner"]
        if latest_recipients.get("humanitarian"):
            status["humanitarian_wallet"] = latest_recipients["humanitarian"]
        if latest_recipients.get("issobella"):
            status["issobella_wallet"] = latest_recipients["issobella"]
    except Exception:
        pass

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

    # ── Wallet balances (on-chain UTXO via getUtxos RPC) ───────────────
    if status["pool_wallet"] and status["pool_wallet"].startswith("zion1"):
        atomic, ok = _get_on_chain_balance(status["pool_wallet"])
        if ok:
            status["pool_wallet_balance"] = atomic

    balances = {}
    for key, addr in [("miner", status["miner_wallet"]),
                      ("humanitarian", status["humanitarian_wallet"]),
                      ("issobella", status["issobella_wallet"]),
                      ("pool_fee", status.get("pool_fee_wallet"))]:
        if addr and addr.startswith("zion1"):
            atomic, ok = _get_on_chain_balance(addr)
            if ok:
                balances[key] = {"atomic": atomic, "zion": flowers_to_zion(atomic)}
        elif key == "pool_fee" and status.get("burned_total"):
            # Pool fee is burned (no recipient wallet) — show accumulated burn
            balances[key] = {"zion": status["burned_total"], "source": "burned"}
    status["balances"] = balances

    # ── Pool stats / miners from Edge or local ──────────────────────────
    pool_stats = fetch_pool_stats()
    miners = fetch_pool_miners()
    pool_stats = sanitize_pool_stats(pool_stats, miners)
    status["pool_stats"] = pool_stats
    status["miners"] = miners

    # Edge-primary: if local logs have no blocks, use Edge pool stats
    if is_edge and pool_stats:
        blocks_info = pool_stats.get("blocks") if isinstance(pool_stats.get("blocks"), dict) else {}
        edge_blocks = blocks_info.get("found") or blocks_info.get("total_found")
        if edge_blocks and status["blocks_found"] == 0:
            status["blocks_found"] = edge_blocks
        recent_blocks = blocks_info.get("recent") or []
        if recent_blocks and not status["last_block_height"]:
            try:
                status["last_block_height"] = int(recent_blocks[0].get("height", 0))
            except Exception:
                pass

    # ── Burned total (after edge block fallback so total_blocks is accurate) ─
    total_blocks = status["blocks_found"]
    last_height = status["last_block_height"] or 1
    if total_blocks > 0:
        per_block_burned_zion = block_subsidy(last_height) / 100 / 1_000_000
        status["burned_total"] = total_blocks * per_block_burned_zion
    else:
        status["burned_total"] = 0.0

    # ── On-chain UTXO balances + paid/pending normalization for each miner ─────────
    # Load PPLNS state once to backfill pending balances when telemetry is missing.
    try:
        pplns_state = _fetch_pplns_state() or {}
        pplns_unpaid = pplns_state.get("unpaid") or {}
    except Exception:
        pplns_unpaid = {}
    for m in miners:
        addr = m.get("payout_address") or m.get("address") or m.get("miner_id") or ""
        worker = m.get("worker") or ""
        mid, wn = _split_worker_username(worker) if worker else (addr, "default")
        if addr and addr.startswith("zion1"):
            try:
                atomic, ok = _get_on_chain_balance(addr)
                if ok:
                    m["on_chain_balance_zion"] = flowers_to_zion(atomic)
            except Exception:
                pass
        # Normalize paid_total and pending for the payout tab miner table
        if m.get("paid_total_atomic") is not None:
            m["paid_total"] = flowers_to_zion(int(m.get("paid_total_atomic") or 0))
        if m.get("pending_balance") is None:
            unpaid_flowers = _pplns_dict_lookup(pplns_unpaid, mid, wn, full_worker=worker, default=0)
            m["pending_balance"] = int(unpaid_flowers or 0)
            m["pending_balance_zion"] = flowers_to_zion(m["pending_balance"])
        elif m.get("pending_balance_zion") is None:
            m["pending_balance_zion"] = flowers_to_zion(int(m.get("pending_balance") or 0))
        if m.get("unpaid_total") is not None and m.get("pending_balance_zion") is None:
            m["pending_balance_zion"] = m["unpaid_total"]
        # Ensure worker_name exists
        if not m.get("worker_name"):
            m["worker_name"] = wn

    # ── Network-wide emission totals from block 0 (consensus schedule) ──
    try:
        chain_info, _, _ = _rpc_with_fallback("getChainInfo", {}, timeout=3.0)
        if chain_info and not chain_info.get("_rpc_error"):
            status["network_emission"] = calculate_emission_totals(chain_info.get("chain_height", 0))
        else:
            status["network_emission"] = None
    except Exception:
        status["network_emission"] = None

    # Session stats
    active_sessions = pool_stats.get("miners", {}).get("active", len(miners)) if isinstance(pool_stats.get("miners"), dict) else len(miners)
    # accept_rate_pct + hashrate: prefer live Prometheus metrics (port V31_POOL_API_PORT) over pool /stats endpoint
    _routing_accept = pool_stats.get("routing", {}).get("accept_rate_pct") if isinstance(pool_stats.get("routing"), dict) else None
    _metrics_accept = None
    _metrics_hashrate = None
    _metrics_blocks = 0
    # PPLNS metrics from Prometheus (used as fallback if pool /stats pplns object is missing)
    _metrics_pplns_window_size = 0
    _metrics_pplns_window_used = 0
    _metrics_pplns_rounds = 0
    _metrics_pplns_total_paid = 0
    _metrics_pplns_total_unpaid = 0
    _metrics_pplns_registered = 0
    try:
        import urllib.request as _ur2
        _mhost = EDGE_RPC_HOST if TOPOLOGY == "edge-primary" else "127.0.0.1"
        with _ur2.urlopen(f"http://{_mhost}:{V31_POOL_API_PORT}/metrics", timeout=1.5) as _r:
            for _ln in _r.read().decode("utf-8", errors="ignore").splitlines():
                if _ln.startswith("zion_pool_accept_rate_pct "):
                    _metrics_accept = float(_ln.split()[-1])
                elif _ln.startswith("zion_pool_hashrate_hps "):
                    _metrics_hashrate = float(_ln.split()[-1])
                elif _ln.startswith("zion_pool_blocks_found_total "):
                    _metrics_blocks = int(float(_ln.split()[-1]))
                # PPLNS Prometheus metrics (V31 pool exports these)
                elif _ln.startswith("zion_pool_pplns_window_size ") or _ln.startswith("zion_pplns_window_size "):
                    _metrics_pplns_window_size = int(_ln.split()[-1])
                elif _ln.startswith("zion_pool_pplns_window_used ") or _ln.startswith("zion_pplns_window_used "):
                    _metrics_pplns_window_used = int(_ln.split()[-1])
                elif _ln.startswith("zion_pool_pplns_payout_rounds ") or _ln.startswith("zion_pplns_payout_rounds "):
                    _metrics_pplns_rounds = int(_ln.split()[-1])
                elif _ln.startswith("zion_pool_pplns_total_paid_flowers ") or _ln.startswith("zion_pplns_total_paid_flowers "):
                    _metrics_pplns_total_paid = int(_ln.split()[-1])
                elif _ln.startswith("zion_pool_pplns_total_unpaid_flowers ") or _ln.startswith("zion_pplns_total_unpaid_flowers "):
                    _metrics_pplns_total_unpaid = int(_ln.split()[-1])
                elif _ln.startswith("zion_pool_pplns_registered_miners ") or _ln.startswith("zion_pplns_registered_miners "):
                    _metrics_pplns_registered = int(_ln.split()[-1])
    except Exception:
        pass
    if _metrics_blocks > 0 and status["blocks_found"] == 0:
        status["blocks_found"] = _metrics_blocks
        total_blocks = _metrics_blocks
    # Recompute burned total now that we have a definitive block count from metrics
    if total_blocks > 0:
        per_block_burned_zion = block_subsidy(status["last_block_height"] or 1) / 100 / 1_000_000
        status["burned_total"] = total_blocks * per_block_burned_zion
    status["session_stats"] = {
        "active_sessions": active_sessions,
        "total_shares_1h": sum(m.get("valid_shares", 0) for m in miners),
        "blocks_24h": total_blocks,
        "accept_rate_pct": _metrics_accept if _metrics_accept is not None else _routing_accept,
        "pool_hashrate_hps": _metrics_hashrate,
    }
    if _metrics_hashrate is not None:
        if not isinstance(pool_stats, dict):
            pool_stats = {}
        pool_stats.setdefault("hashrate", {})["pool"] = _metrics_hashrate

    # Expose top-level PPLNS fields used by the overview Pool Command Center
    try:
        _pplns = (pool_stats.get("pplns") or {}) if isinstance(pool_stats, dict) else {}
        _pplns_window_size = int(_pplns.get("window_size") or _metrics_pplns_window_size or 0) or 0
        _pplns_window_used = int(_pplns.get("window_used") or _metrics_pplns_window_used or 0) or 0
        _pplns_rounds = int(_pplns.get("payout_rounds") or _metrics_pplns_rounds or 0) or 0
        _pplns_registered = int(_pplns.get("registered_miners") or _metrics_pplns_registered or 0) or 0
        _pplns_total_paid = _pplns.get("total_paid_flowers") or _metrics_pplns_total_paid or 0
        _pplns_total_unpaid = _pplns.get("total_unpaid_flowers") or _metrics_pplns_total_unpaid or 0
        if _pplns_total_paid:
            _pplns_total_paid = int(_pplns_total_paid)
        if _pplns_total_unpaid:
            _pplns_total_unpaid = int(_pplns_total_unpaid)
        status["pplns_window_size"] = _pplns_window_size
        status["pplns_window_used"] = _pplns_window_used
        status["pplns_rounds"] = _pplns_rounds
        status["pplns_registered_miners"] = _pplns_registered
        status["pplns_total_paid_flowers"] = _pplns_total_paid
        status["pplns_total_unpaid_flowers"] = _pplns_total_unpaid
        status["pplns_total_paid_zion"] = flowers_to_zion(_pplns_total_paid)
        status["pplns_total_unpaid_zion"] = flowers_to_zion(_pplns_total_unpaid)
    except Exception:
        status["pplns_window_size"] = _metrics_pplns_window_size
        status["pplns_window_used"] = _metrics_pplns_window_used
        status["pplns_rounds"] = _metrics_pplns_rounds
        status["pplns_registered_miners"] = _metrics_pplns_registered
        status["pplns_total_paid_flowers"] = _metrics_pplns_total_paid
        status["pplns_total_unpaid_flowers"] = _metrics_pplns_total_unpaid
        status["pplns_total_paid_zion"] = flowers_to_zion(_metrics_pplns_total_paid)
        status["pplns_total_unpaid_zion"] = flowers_to_zion(_metrics_pplns_total_unpaid)

    # JS miner_stats compatibility
    miner_stats = []
    for m in miners:
        first_seen = m.get("connected_since") or m.get("first_seen_s") or m.get("first_seen")
        last_share = m.get("last_share") or m.get("last_share_time") or m.get("last_share_time_s")
        miner_stats.append({
            "address": m.get("payout_address") or m.get("address") or "—",
            "worker_name": m.get("worker_name") or m.get("id") or "—",
            "algorithm": m.get("algorithm") or "—",
            "backend": m.get("backend") or "cpu",
            "valid_shares": m.get("valid_shares", 0),
            "hashrate": m.get("hashrate_hps", m.get("hashrate", 0)),
            "hashrate_1h": m.get("hashrate_1h_hps", m.get("hashrate_1h", 0)),
            "total_paid": m.get("paid_total", 0),
            "on_chain_balance_zion": m.get("on_chain_balance_zion"),
            "pending_balance": m.get("pending_balance", 0),
            "blocks_found": m.get("blocks_found", 0),
            "connected_since": first_seen,
            "last_share": last_share,
        })
    status["miner_stats"] = miner_stats
    status["miner_payouts_detail"] = status["miner_payouts"]

    # Expose top-level share counters used by the wallet status panel
    routing = pool_stats.get("routing") if isinstance(pool_stats.get("routing"), dict) else {}
    status["shares_accepted"] = routing.get("accepted") or status["session_stats"].get("total_shares_1h") or sum(m.get("valid_shares", 0) for m in miners)
    status["shares_rejected"] = routing.get("rejected") or routing.get("stale") or 0

    # If Edge stats are dead, surface a warning
    if is_edge and not edge_stats_alive:
        status["pool_health"]["error_msg"] = "Edge pool metrics endpoint (V31_POOL_API_PORT) unreachable. Stats/miners may be stale."

    status["ok"] = True
    return status

def trigger_payout() -> dict:
    """Manual payout trigger endpoint.

    The pool uses PPLNS with per-block automatic settlement, so there is no
    separate manual-payout command.  This endpoint refreshes the dashboard view
    and returns the current payout state so the UI can confirm that the cycle
    is active without throwing a 404.
    """
    try:
        status = build_payout_status()
        return {
            "ok": True,
            "message": "Payout cycle is active — PPLNS settles automatically on each block.",
            "payout_enabled": status.get("payout_enabled", False),
            "pending_payouts": status.get("pending_payouts", 0),
            "blocks_found": status.get("blocks_found", 0),
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

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
        info = rpc_call(EDGE_RPC_HOST, 9445, "getChainInfo", {}, timeout=2)
        if info and not info.get("_rpc_error"):
            edge_rpc_alive = True
            edge_height = info.get("chain_height")
    except Exception:
        pass
    # Tailscale VPN check (quick TCP probe to edge RPC instead of ICMP ping)
    # v3.0.4: No Tailscale needed
    # Website
    web_alive = False
    try:
        with urllib.request.urlopen("https://zionterranova.com", timeout=2) as r:
            web_alive = r.status == 200
    except Exception:
        pass
    # Desktop agent (localhost RPC)
    desktop_alive = check_port_open("127.0.0.1", 9443, timeout=0.8)
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
            "rpc": "0.0.0.0:9443",
        },
        "edge": {
            "host": "127.0.0.1",
            "public_ip": "62.171.141.136",
            "alive": edge_rpc_alive,
            "height": edge_height,
            "p2p": "0.0.0.0:8333",
            "rpc": "0.0.0.0:9443",
            "pool": "0.0.0.0:8444",
        },
        "tailscale": {"vpn_ok": True, "edge_ip": "127.0.0.1", "note": "No Tailscale (v3.0.4)"},
        "apps": {
            "website": {"url": "https://zionterranova.com", "alive": web_alive},
            "desktop_agent": {"rpc": "http://127.0.0.1:9443/jsonrpc", "alive": desktop_alive},
            "mobile_app": {"status": "dev_build_ready", "alive": True},  # placeholder until health endpoint
            "cli": {"version": cli_version, "alive": cli_version is not None},
        },
        "ports": {
            "node_p2p": check_port_open("127.0.0.1", 8333),
            "node_rpc": check_port_open("127.0.0.1", 9443),
            "pool_stratum": check_port_open("127.0.0.1", V31_POOL_API_PORT),  # metrics port, not stratum 8444
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


def run_cli_core_util(cmd: str, db: str = "V3/data/zion-node-state.db") -> dict:
    """Run a core-util subcommand and return stdout/stderr/returncode."""
    if not cmd:
        return {"ok": False, "error": "cmd required"}
    allowed_cmds = ("export-state", "verify-db", "dump-blocks", "tip-height", "get-block")
    first_word = cmd.split()[0].lower()
    if first_word not in allowed_cmds:
        return {"ok": False, "error": f"Command '{first_word}' not in whitelist. Allowed: {allowed_cmds}"}
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
            return parsed
        except Exception:
            return {"ok": True, "stdout": out_text, "stderr": stderr.decode("utf-8", errors="ignore"), "exit_code": proc.returncode, "cmd": full_cmd}
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
        "dao": "zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5",
        "bridge_vault": "zion1j3w3h7k8m635h734y786j5804305m822t5uk546",
    },
}

PREMINE_OUTPUTS = [
    # V31 mainnet premine (14 outputs, 16.78B ZION). Matches V31/L1/core/src/v3_compat.rs.
    # OASIS + Golden Egg (5 slots × 1.65B = 8.25B)
    {"address": "zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 1)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion1s7x735r6v86485k7t36008l682g777g3q8pu3q0", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 2)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion1e0f4h6w3w394d4p355z2r440k4s2f6v5h4rl8f4", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 3)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion1h7r3v595y3g0z3e3l8p005h4c6l7l6s4s2xh708", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 4)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion1x535z563d3p6r6u3v6x0g0y445f507w8h6g8388", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 5)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    # DAO Treasury (3 slots = 4.0B) — locked until block 144,000
    {"address": "zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5", "purpose": "DAO Treasury — Community Governance (main)", "amount_zion": 2_500_000_000, "category": "dao_treasury", "unlock_height": 144_000},
    {"address": "zion1s27490u7n823g098w42077h8f2n824w0y75w0s3", "purpose": "DAO Treasury — Grants & Bounties", "amount_zion": 1_000_000_000, "category": "dao_treasury", "unlock_height": 144_000},
    {"address": "zion1n0r7k274z3t030h4v4g3g5h704c737z658aa238", "purpose": "DAO Treasury — Ecosystem Bootstrap", "amount_zion": 500_000_000, "category": "dao_treasury", "unlock_height": 144_000},
    # Infrastructure (3 slots = 2.59B)
    {"address": "zion1k752909323x66062k5j7074096f003z095ax8m7", "purpose": "Core Development Fund", "amount_zion": 1_000_000_000, "category": "infrastructure", "unlock_height": None},
    {"address": "zion1z3a4w726w5u4r4s4z644s8p897v4a2k045rt706", "purpose": "Network Infrastructure — P2P Seed Nodes", "amount_zion": 1_000_000_000, "category": "infrastructure", "unlock_height": None},
    {"address": "zion122v8f8g55398f4g884k7j482h3z845j6c6ta4f8", "purpose": "Genesis Projects — Dharma Temple, Piko de Ora + DAO", "amount_zion": 590_000_000, "category": "infrastructure", "unlock_height": None},
    # Humanitarian (1 slot = 1.44B)
    {"address": "zion1h6644748u5x6p4p784n6g2l7j77625w6a0k80s8", "purpose": "Children Future Fund — Humanitarian DAO", "amount_zion": 1_440_000_000, "category": "humanitarian", "unlock_height": None},
    # Bridge Seed Fund (1 slot = 0.4B) — immediate unlock for EVM bridge liquidity
    {"address": "zion1t6z3c0f0p3h0v233a3h432k5h764j0r3n5ml756", "purpose": "Bridge Seed Fund — EVM Bridge Liquidity", "amount_zion": 400_000_000, "category": "bridge_seed", "unlock_height": None},
    # Bridge Vault UTXO Seed (1 slot = 0.1B) — UTXO liquidity for bridge unlocks
    {"address": "zion1j3w3h7k8m635h734y786j5804305m822t5uk546", "purpose": "Bridge Vault UTXO Seed — EVM Bridge Unlock Liquidity", "amount_zion": 100_000_000, "category": "bridge_vault_utxo", "unlock_height": None},
]

P0_BLOCKERS = [
    {"id": 1, "title": "Bridge validator 3/5 multisig", "owner": "Security / Ops", "deadline": "T-7", "status": "OPEN", "severity": "critical",
     "detail": "Placeholder addresses 0x0000…0001–0005 in V3/L2/bridge/config/bridge-mainnet.toml. Need 5 real secp256k1 addresses on separate HSM hosts."},
    {"id": 2, "title": "Ankr API key (premium tier)", "owner": "Ops", "deadline": "T-7", "status": "OPEN", "severity": "critical",
     "detail": "bridge-mainnet.toml line 28: api_key=\"\". Requires premium Ankr account for EVM watcher reliability."},
    {"id": 3, "title": "Seed peer bootstrap mesh", "owner": "Ops", "deadline": "T-3", "status": "DONE", "severity": "info",
     "detail": "Core + Edge topology active. Core (local backup) seeds Edge (127.0.0.1) via P2P. Legacy multi-node mesh decommissioned."},
    {"id": 4, "title": "Premine wallet rotation", "owner": "Security", "deadline": "T-14", "status": "DONE", "severity": "info",
     "detail": "✅ Done 2026-08-06 (V3.2 One Love genesis reset). 35 BIP-39 24-word mnemonic keypairs rotated, public addresses in docs/PREMINE_ADDRESSES_PUBLIC.txt and V31/L1/core/src/v3_compat.rs."},
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
    # ── Edge maintenance actions: synchronous, return full output ────────
    # These run the edge-maintenance.sh script on the Edge server and return
    # the captured output (not fire-and-forget like service starts).
    if action.startswith("maint-"):
        return run_edge_action(action)
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

# ── HTML Dashboard: served from dashboard.html file (not inline) ───
# HTML_DASHBOARD inline block removed — dashboard.html is the canonical UI.

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
    """Return {service: health_status} for all known services (V31 + legacy)."""
    status = build_status()
    health = {}

    # V31 services (production)
    v31_node = status.get("v31_node", {})
    health["v31-node"] = "up" if v31_node.get("running") and v31_node.get("chain_height") is not None else "down"

    v31_pool = status.get("v31_pool", {})
    health["v31-pool"] = "up" if v31_pool.get("running") else "down"

    v31_miner = status.get("v31_miner", {})
    v31_miner_running = bool(v31_miner.get("running"))
    health["v31-miner"] = "up" if v31_miner_running else "down"
    # Keep legacy alias for v2 clients
    health["miner"] = health["v31-miner"]

    v31_multichain = status.get("v31_multichain", {})
    health["v31-multichain"] = "up" if v31_multichain.get("running") and v31_multichain.get("ok") else "down"

    # V31 node health (replaces legacy V3 edge-node)
    v31_node_h = status.get("v31_node", {})
    health["edge-node"] = "up" if v31_node_h.get("running") and v31_node_h.get("chain_height") is not None else "down"

    pool_edge = status.get("pool_edge", {})
    health["pool-edge"] = "up" if pool_edge.get("running") else "down"

    # Extended services — TCP probes to 127.0.0.1 (all on same server)
    ext_ports = {
        "v31-dao": 8456,      # V31 DAO API
        "v31-oasis": 8094,    # V31 OASIS API
        "bridge": 8453,       # V31 Multichain (bridge/warp/swap unified) — was V3 port 9101
        "dao": 8456,          # V31 DAO API — was V3 port 8450
        "warp": 8453,         # V31 Multichain WARP Relay
        "dashboard": 8766,    # This dashboard
    }
    for sid, port in ext_ports.items():
        try:
            alive = tcp_probe("127.0.0.1", port, timeout=0.3)
        except Exception:
            alive = False
        health[sid] = "up" if alive else "down"
    # Nginx + website: check via SSH on Edge server (not tunneled locally)
    for sid, cmd in [("nginx", "systemctl is-active nginx 2>/dev/null"),
                     ("website", "systemctl is-active zion-website 2>/dev/null")]:
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
    {"address": V31_CANONICAL_POOL_PAYOUT_WALLET, "label": "Pool Wallet", "min_balance_zion": 0},
]

ALERT_LOG_FILES = {
    "forged_tx": "/var/log/zion-forged-tx-alerts.log",
    "balance": "/var/log/zion-balance-alerts.log",
    "peer": "/var/log/zion-peer-alerts.log",
}


def _rpc_get_balance(address: str) -> dict | None:
    """Query on-chain UTXO balance. Returns dict with balance_zion / balance_flowers on success."""
    try:
        atomic, ok = _get_on_chain_balance(address)
        if ok:
            return {
                "balance_flowers": str(atomic),
                "balance_atomic": atomic,
                "balance_zion": flowers_to_zion(atomic),
            }
    except Exception:
        pass
    return None


def _read_alert_log(path: str, max_lines: int = 20) -> list[str]:
    """Read last N lines from an alert log file."""
    try:
        with open(path, "r") as f:
            lines = f.readlines()
        return [l.rstrip() for l in lines[-max_lines:]]
    except Exception:
        return []


def build_security_warnings(limit: int = 200) -> dict:
    """Build real-time server security warnings from zion-security.log and live probes."""
    warnings = []
    try:
        path = Path("/var/log/zion-security.log")
        if path.exists():
            with open(path, "r") as f:
                lines = f.readlines()
            for line in lines[-limit:]:
                try:
                    warnings.append(json.loads(line))
                except Exception:
                    continue
    except Exception as e:
        warnings.append({"ts": int(time.time()), "level": "ERROR", "message": f"cannot read security log: {e}"})

    # Live fail2ban banned IPs
    banned = []
    try:
        result = subprocess.run(["fail2ban-client", "status", "sshd"], capture_output=True, text=True, timeout=5)
        for line in result.stdout.splitlines():
            if "Banned IP list" in line:
                ips = line.split(":")[-1].strip()
                if ips and ips != "":
                    banned = [ip.strip() for ip in ips.split(",") if ip.strip()]
    except Exception:
        pass

    # Currently active SSH connections
    ssh_conns = []
    try:
        result = subprocess.run(["ss", "-tnp"], capture_output=True, text=True, timeout=5)
        for line in result.stdout.splitlines():
            if "sshd" in line and "ESTAB" in line:
                parts = line.split()
                if len(parts) >= 5:
                    ssh_conns.append({"local": parts[4], "peer": parts[5]})
    except Exception:
        pass

    # UFW active status
    fw_active = False
    try:
        result = subprocess.run(["ufw", "status"], capture_output=True, text=True, timeout=5)
        fw_active = "Status: active" in result.stdout
    except Exception:
        pass

    return {
        "warnings": warnings,
        "banned_ips": banned,
        "active_ssh": ssh_conns,
        "firewall_active": fw_active,
        "timestamp": int(time.time()),
    }


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
    # ufw status requires root; prefer the ufw systemd unit state, which the
    # dashboard user is allowed to query and accurately reflects whether the
    # firewall is enabled.
    fw_status = "unknown"
    try:
        result = subprocess.run(["systemctl", "is-active", "ufw"], capture_output=True, text=True, timeout=5)
        fw_status = "active" if result.stdout.strip() == "active" else "inactive"
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

# Maestro v2.4 CLI binary path (built from V3/L3/ai-native/src/bin/maestro.rs)
MAESTRO_BIN = "/opt/zion/target/release/maestro"


def _maestro_cli(args: list, timeout: int = 10) -> dict:
    """Run the maestro CLI binary with given args and parse JSON output.

    Returns {"ok": True, "data": <json>} on success, {"ok": False, "error": str} on failure.
    """
    
    try:
        if not Path(MAESTRO_BIN).exists():
            return {"ok": False, "error": f"maestro binary not found at {MAESTRO_BIN}", "binary": MAESTRO_BIN}
        proc = subprocess.run(
            [MAESTRO_BIN] + args,
            capture_output=True, text=True, timeout=timeout,
        )
        if proc.returncode != 0:
            return {"ok": False, "error": (proc.stderr or proc.stdout or "unknown error")[:300],
                    "returncode": proc.returncode}
        out = proc.stdout.strip()
        if not out:
            return {"ok": False, "error": "empty output from maestro"}
        try:
            return {"ok": True, "data": json.loads(out)}
        except json.JSONDecodeError as e:
            return {"ok": False, "error": f"JSON parse error: {e}", "raw": out[:300]}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"maestro timed out after {timeout}s"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


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
        # Desktop bundle mode: the Tauri app runs the server itself on
        # localhost, so requiring manual credentials would just be friction.
        if os.environ.get("ZION_DESKTOP_EMBEDDED") == "1" and self.client_address[0] in (
            "127.0.0.1", "::1", "localhost"
        ):
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
        body = b"401 Unauthorized - authentication required\n"
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="ZION Dashboard"')
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
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
            accepts_gzip = "gzip" in (self.headers.get("Accept-Encoding", "").lower())
            if accepts_gzip and len(body) > 1024:
                compressed = gzip.compress(body, compresslevel=6)
                self.send_response(status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Vary", "Accept-Encoding")
                self.send_header("Access-Control-Allow-Origin", cors_origin)
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.send_header("Content-Length", str(len(compressed)))
                self.end_headers()
                self.wfile.write(compressed)
            else:
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
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass  # client closed connection early — benign

    def _serve_html_file(self, html_path: Path, fallback_error: str = ""):
        """Serve a static HTML file, with optional gzip pre-compression."""
        if not html_path.exists():
            self.send_error(503, fallback_error or f"{html_path.name} not found")
            return
        gz_path = html_path.with_suffix(html_path.suffix + ".gz")
        _ensure_gz_uptodate(html_path, gz_path)
        accepts_gzip = "gzip" in (self.headers.get("Accept-Encoding", "").lower())
        if accepts_gzip:
            body = _get_gz_body(html_path)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self._html(html_path.read_text(encoding="utf-8"))

    def _proxy_to_dao(self, method, route, body, req_headers):
        """Proxy a request to the V31 DAO daemon on port 8456, preserving auth headers."""
        DAO_PORT = 8456
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

    def _proxy_to_hiran(self, method, route, body, req_headers):
        """Proxy a request to the Hiranyagarbha orchestrator on port 8001.
        Route /api/hiran/proxy/<path> is forwarded to http://127.0.0.1:8001/<path>."""
        HIRAN_PORT = 8001
        proxy_prefix = "/api/hiran/proxy"
        full_path = self.path if self.path.startswith(proxy_prefix) else route
        upstream_path = full_path[len(proxy_prefix):] or "/"
        url = f"http://127.0.0.1:{HIRAN_PORT}{upstream_path}"
        try:
            fwd_headers = {"Accept": "application/json"}
            ct = req_headers.get("Content-Type") or req_headers.get("content-type")
            if ct:
                fwd_headers["Content-Type"] = ct
            req = urllib.request.Request(url, data=body if body else None, headers=fwd_headers, method=method)
            with urllib.request.urlopen(req, timeout=10) as r:
                data = json.loads(r.read())
            self._json(data)
        except urllib.error.HTTPError as e:
            try:
                data = json.loads(e.read())
            except Exception:
                data = {"success": False, "error": f"Hiran HTTP {e.code}"}
            self._json(data, e.code)
        except Exception as e:
            self._json({"success": False, "error": f"Hiran orchestrator unreachable: {str(e)[:120]}", "offline": True})

    def _get_service_log(self, svc_name, lines=50):
        """Read last N lines from a service's log file.
        Searches LOG_DIR, REPO_ROOT, and SCRIPT_DIR/logs for the log file."""
        import collections
        log_name = SERVICE_LOG_MAP.get(svc_name)
        if not log_name:
            return {"ok": False, "error": f"Unknown service: {svc_name}"}
        log_path = latest_log_path(log_name)
        if not log_path or not log_path.exists():
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
        if route == "/security-warnings" or route == "/security":
            html_path = SCRIPT_DIR / "security-warnings.html"
            if html_path.exists():
                self._html(html_path.read_text(encoding="utf-8"))
            else:
                self.send_error(404)
            return

        if route == "/" or route == "/index.html":
            v31_index = SCRIPT_DIR / "v31" / "index.html"
            v2_index = V2_DIST / "index.html"
            if v31_index.exists():
                # V31 Mainnet Alpha is the default landing page
                self.send_response(302)
                self.send_header("Location", "/v31/")
                self.end_headers()
                return
            if v2_index.exists():
                self._html(v2_index.read_text(encoding="utf-8"))
                return
            # Fallback to legacy v1 dashboard
            self._serve_html_file(SCRIPT_DIR / "dashboard.html", "dashboard.html not found")
            return
        elif route in ("/dashboard", "/dashboard.html"):
            self._serve_html_file(SCRIPT_DIR / "dashboard.html", "dashboard.html not found")
            return
        elif route in ("/legacy", "/legacy.html"):
            self._serve_html_file(SCRIPT_DIR / "legacy.html", "legacy.html not found")
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
                accepts_gzip = "gzip" in (self.headers.get("Accept-Encoding", "").lower())
                gz_file = v2_file.with_suffix(v2_file.suffix + ".gz")
                _ensure_gz_uptodate(v2_file, gz_file)
                if accepts_gzip:
                    body = _get_gz_body(v2_file)
                    self.send_response(200)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Encoding", "gzip")
                    self.send_header("Vary", "Accept-Encoding")
                    self.send_header("Cache-Control", "public, max-age=31536000, immutable")
                    self.send_header("ETag", f'"{hashlib.md5(body).hexdigest()}"')
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                else:
                    body = v2_file.read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Cache-Control", "public, max-age=31536000, immutable")
                    self.send_header("ETag", f'"{hashlib.md5(body).hexdigest()}"')
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                return
            else:
                self.send_error(404)
                return
        elif route in ("/dashboard.js", "/dashboard.min.js"):
            # Serve the exact file requested — /dashboard.js → dashboard.js,
            # /dashboard.min.js → dashboard.min.js (with .gz when accepted).
            is_min = route == "/dashboard.min.js"
            if is_min:
                js_path = SCRIPT_DIR / "dashboard.min.js"
                gz_path = SCRIPT_DIR / "dashboard.min.js.gz"
                cc = "public, max-age=31536000, immutable"
            else:
                js_path = SCRIPT_DIR / "dashboard.js"
                gz_path = SCRIPT_DIR / "dashboard.js.gz"
                cc = "no-cache, no-store, must-revalidate"
            if js_path.exists():
                _ensure_gz_uptodate(js_path, gz_path)
                accepts_gzip = "gzip" in (self.headers.get("Accept-Encoding", "").lower())
                if accepts_gzip:
                    body = _get_gz_body(js_path)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/javascript; charset=utf-8")
                    self.send_header("Content-Encoding", "gzip")
                    self.send_header("Vary", "Accept-Encoding")
                    self.send_header("Cache-Control", cc)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                else:
                    body = js_path.read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/javascript; charset=utf-8")
                    self.send_header("Cache-Control", cc)
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
        # ── Marketplace admin dashboard ──────────────────────────────────────
        elif marketplace.handle_get(self, route, params):
            return
        # ── V31 Mainnet Alpha dashboard ──────────────────────────────────────
        elif v31.handle_get(self, route, params):
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
            # v2 batch is an alias for the full status bundle (GET/POST)
            st = build_status()
            self._json({
                "status":    st,
                "health":    _build_health_map(),
                "events":    list(BLOCK_EVENTS)[-10:][::-1] if BLOCK_EVENTS else [],
                "checklist": build_checklist(st),
            })
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
                _ports = {"node_rpc": 9443, "pool_stratum": 8444, "dao": 8450,
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
                    "chain_height": _st.get("v31_node", {}).get("chain_height"),
                    "pool_running": _st.get("pool_edge", {}).get("running", False),
                    "active_miners": _st.get("pool_edge", {}).get("active_miners"),
                    "hashrate": _st.get("pool_edge", {}).get("hashrate"),
                    "shares_accepted": _st.get("pool_edge", {}).get("shares_accepted"),
                    "blocks_found": _st.get("pool_edge", {}).get("blocks_found"),
                    "services": _health,
                    "local_backup": _st.get("local_backup", {}),
                    "v31_node": _st.get("v31_node", {}),
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
        elif route == "/api/pool/blocks":
            limit = int(params.get("limit", ["100"])[0])
            self._json(get_pool_blocks(limit=limit))
        elif route == "/api/revenue":
            self._json(get_revenue_dashboard())
        elif route == "/api/revenue/report":
            self._json(get_revenue_report())
        elif route == "/api/revenue/streams":
            self._json(get_revenue_streams())
        elif route == "/api/pool/auxpow":
            self._json(get_auxpow_config())
        elif route == "/api/pool/setup":
            self._json(get_pool_setup_config())
        elif route == "/api/pool/cpu-coin":
            self._json(_pool_coin_override_get("cpu"))
        elif route == "/api/pool/gpu-coin":
            self._json(_pool_coin_override_get("gpu"))
        elif route == "/api/servers-setup":
            self._json(get_servers_setup())
        elif route.startswith("/api/pool/miner-detail/"):
            address = route.split("/api/pool/miner-detail/", 1)[1].split("?")[0]
            self._json(get_pool_miner_detail(address))
        elif route == "/api/pool/registered-miners":
            self._json(get_pool_registered_miners())
        elif route == "/api/pool/debug":
            self._json(get_pool_debug_dump())
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
        elif route == "/api/security-warnings":
            limit = int(params.get("limit", ["200"])[0])
            self._json(build_security_warnings(limit=limit))
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
            # Return process registry snapshot as a list (the dashboard UI expects an array).
            # On Edge the registry only tracks processes we launched directly, so also include
            # the active zion-edge-* systemd units so the page is not empty.
            procs = []
            with PROCESS_LOCK:
                for sid, v in PROCESS_REGISTRY.items():
                    procs.append({
                        "name": sid,
                        "pid": v["pid"],
                        "age_min": int((time.time() - v["ts"]) / 60),
                        "alive": is_process_alive(v["pid"]),
                        "cpu_percent": None,
                        "memory_mb": None,
                    })
            if TOPOLOGY == "edge-primary" and not procs:
                for sid in EDGE_SERVICE_ORDER:
                    unit = _EDGE_SYSTEMD_UNITS.get(sid, sid + ".service")
                    try:
                        state = subprocess.run(["systemctl", "is-active", unit], capture_output=True, text=True, timeout=3)
                        if state.stdout.strip() == "active":
                            pid_out = subprocess.run(["systemctl", "show", "--property=MainPID", unit], capture_output=True, text=True, timeout=3)
                            pid = int(pid_out.stdout.strip().split("=")[-1]) if pid_out.returncode == 0 else None
                            procs.append({
                                "name": sid,
                                "pid": pid,
                                "age_min": None,
                                "alive": True,
                                "cpu_percent": None,
                                "memory_mb": None,
                            })
                    except Exception:
                        pass
            self._json({"processes": procs})
        elif route == "/api/logs/stream":
            # SSE live log streaming: /api/logs/stream?svc=v31-node&lines=200
            # V31 systemd services use journalctl; legacy services use log files
            svc_id   = params.get("svc",   ["v31-node"])[0].strip()
            n_init   = min(int(params.get("lines", ["150"])[0]), 500)
            journal_unit = V31_JOURNAL_MAP.get(svc_id)
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
                if journal_unit:
                    # ── journalctl-backed streaming (V31 systemd services) ──
                    import time as _time
                    # Send initial tail via journalctl
                    try:
                        r = subprocess.run(
                            ["journalctl", "-u", journal_unit, "--no-pager", "-n", str(n_init), "--output=cat"],
                            capture_output=True, text=True, timeout=10
                        )
                        for ln in strip_ansi(r.stdout).splitlines():
                            _sse(ln)
                    except Exception as e:
                        _sse(f"[error] journalctl initial tail failed: {e}")
                    # Tail new lines via journalctl --since (poll every 2s, max 10 min)
                    deadline = _time.time() + 600
                    last_ts = _time.time()
                    while _time.time() < deadline:
                        _time.sleep(2.0)
                        try:
                            since_str = _time.strftime("%Y-%m-%d %H:%M:%S", _time.localtime(last_ts))
                            r = subprocess.run(
                                ["journalctl", "-u", journal_unit, "--no-pager", "--since", since_str, "--output=cat"],
                                capture_output=True, text=True, timeout=10
                            )
                            new_lines = strip_ansi(r.stdout).splitlines()
                            if new_lines:
                                for ln in new_lines:
                                    _sse(ln)
                                last_ts = _time.time()
                            else:
                                self.wfile.write(b": ping\n\n")
                                self.wfile.flush()
                        except Exception:
                            self.wfile.write(b": ping\n\n")
                            self.wfile.flush()
                elif log_name:
                    # ── File-based streaming (legacy services) ──
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
                else:
                    _sse(f"[error] unknown service '{svc_id}'")
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        elif route == "/api/terminal/open":
            # Open a native terminal window (W11/Ubuntu/macOS)
            svc_id = params.get("svc", [""])[0].strip()
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
                    result["ok"] = s.get("v31_node", {}).get("running", False) or s.get("node1", {}).get("running", False)
                    result["block_height"] = s.get("v31_node", {}).get("chain_height", s.get("node1", {}).get("chain_height", 0))
                    result["peers"] = s.get("v31_node", {}).get("known_peers", s.get("node1", {}).get("known_peers", 0))
                    result["hashrate"] = s.get("miner", {}).get("hashrate", 0)
                    result["shares_accepted"] = s.get("pool", {}).get("shares_accepted", 0)
                    result["pool_alive"] = s.get("pool", {}).get("running", False)
                    result["miner_alive"] = s.get("miner", {}).get("running", False)
                    topo = s.get("topology", "edge-primary")
                    if topo == "edge-primary":
                        result["node2_alive"] = s.get("v31_node2", {}).get("running", False)
                    else:
                        result["node2_alive"] = s.get("node2", {}).get("running", False)
                    result["edge_alive"] = s.get("v31_node", {}).get("running", False)
                    result["services"] = {
                        "v31-node": s.get("v31_node", {}).get("running", False),
                        "v31-node2": s.get("v31_node2", {}).get("running", False) if topo == "edge-primary" else False,
                        "v31-node3": s.get("v31_node3", {}).get("running", False) if topo == "edge-primary" else False,
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
            # V31 P2P topology: V31 Node 1 (primary), Node 2, Node 3 (followers), Local Backup
            import time as _time
            from concurrent.futures import ThreadPoolExecutor, as_completed
            import socket as _sock

            def _probe_v31_node(label, port):
                """Probe a V31 node via TCP JSON-RPC."""
                def _call(method, params=None):
                    req = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}) + "\n"
                    try:
                        with _sock.create_connection(("127.0.0.1", port), timeout=2.5) as s:
                            s.sendall(req.encode())
                            resp = b""
                            while True:
                                chunk = s.recv(8192)
                                if not chunk:
                                    break
                                resp += chunk
                                if b"\n" in chunk:
                                    break
                            r = json.loads(resp.decode("utf-8", errors="replace").strip())
                            if "error" in r and r["error"]:
                                return None
                            return r.get("result")
                    except Exception:
                        return None
                t0 = _time.time()
                status = _call("getStatus")
                chain_info = _call("getChainInfo")
                latency = round((_time.time() - t0) * 1000) if status else None
                alive = bool(status)
                height = None
                tip_hash = None
                node_id = None
                p2p_bind = None
                known_peers = 0
                if alive:
                    # Prefer native_chain_height from getChainInfo (V3 chain_height
                    # is 0 when running with --v3-no-genesis).
                    if chain_info:
                        height = chain_info.get("native_chain_height") or chain_info.get("chain_height")
                    if height is None:
                        height = status.get("chain_height")
                    tip_hash = status.get("tip_hash") or status.get("tip_hash_hex")
                    nodeinfo = _call("getNodeInfo")
                    if nodeinfo:
                        node_id = nodeinfo.get("node_id")
                        p2p_bind = nodeinfo.get("p2p_bind")
                        known_peers = nodeinfo.get("known_peers", 0) or 0
                return {
                    "label": label,
                    "host": "127.0.0.1",
                    "rpc_port": port,
                    "alive": alive,
                    "latency_ms": latency,
                    "height": height,
                    "tip_hash": tip_hash,
                    "node_id": node_id,
                    "p2p_bind": p2p_bind,
                    "known_peers": known_peers,
                }

            def _probe_local_backup():
                """Get local backup from beacon."""
                beacon = {}
                beacon_age = None
                with _BACKUP_BEACON_LOCK:
                    beacon_age = _time.time() - _BACKUP_BEACON_TIME
                    if beacon_age < BACKUP_BEACON_TTL_SEC:
                        beacon = dict(_BACKUP_BEACON)
                if beacon:
                    return {
                        "label": "Local Backup",
                        "host": beacon.get("host", "local-pc"),
                        "rpc_port": beacon.get("rpc_bind", "127.0.0.1:8446").split(":")[-1],
                        "alive": True,
                        "latency_ms": None,
                        "height": beacon.get("chain_height"),
                        "tip_hash": beacon.get("tip_hash"),
                        "node_id": beacon.get("node_id", "local-backup-node"),
                        "p2p_bind": beacon.get("p2p_bind", "0.0.0.0:8333"),
                        "known_peers": beacon.get("known_peers", 0) or 0,
                        "beacon_age_s": round(beacon_age, 1),
                    }
                return {
                    "label": "Local Backup",
                    "host": "local-pc",
                    "rpc_port": 8446,
                    "alive": False,
                    "latency_ms": None,
                    "height": None,
                    "tip_hash": None,
                    "node_id": None,
                    "p2p_bind": None,
                    "known_peers": 0,
                }

            ex = ThreadPoolExecutor(max_workers=4)
            try:
                futs = {
                    ex.submit(_probe_v31_node, "V31 Node 1", 9445),
                    ex.submit(_probe_v31_node, "V31 Node 2", 9446),
                    ex.submit(_probe_v31_node, "V31 Node 3", 9447),
                    ex.submit(_probe_local_backup),
                }
                results = {}
                for fut in as_completed(futs, timeout=6.0):
                    try:
                        r = fut.result()
                        results[r["label"]] = r
                    except Exception:
                        pass
            finally:
                ex.shutdown(wait=False, cancel_futures=True)

            v31n1 = results.get("V31 Node 1", {})
            v31n2 = results.get("V31 Node 2", {})
            v31n3 = results.get("V31 Node 3", {})
            local = results.get("Local Backup", {})

            # Compute sync gaps
            heights = [h for h in [v31n1.get("height"), v31n2.get("height"), v31n3.get("height"), local.get("height")] if h is not None]
            max_h = max(heights) if heights else 0
            min_h = min(heights) if heights else 0
            sync_gap = max_h - min_h

            all_in_sync = sync_gap == 0 and len(heights) >= 2

            # Port checks
            ports = {}
            for name, port in [("v31_node_p2p", 8335), ("v31_node_rpc", 9445), ("pool_stratum", 8444),
                               ("dashboard", 8766)]:
                ports[name] = check_port_open("127.0.0.1", port, timeout=1.0)

            self._json({
                "v31_node1": v31n1,
                "v31_node2": v31n2,
                "v31_node3": v31n3,
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
        elif route == "/api/maestro/info":
            # Maestro v2.4 — static info (tools, sub-agents, intents)
            self._json(_maestro_cli(["info"]))
        elif route == "/api/maestro/health":
            # Maestro v2.4 — probe 26 services health matrix
            self._json(_maestro_cli(["health"]))
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
        elif route == "/api/multichain":
            self._json(get_multichain_dashboard())
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
        elif route.startswith("/api/hiran/proxy"):
            # Proxy all /api/hiran/proxy/* requests to Hiranyagarbha on port 8001
            self._proxy_to_hiran("GET", route, None, dict(self.headers))
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
                if not p.is_absolute():
                    p = REPO_ROOT / log_path
                p = p.resolve()
                # Security: prevent path traversal — only allow reads within
                # LOG_DIR, REPO_ROOT, or /tmp (for rotated/temp logs)
                allowed_roots = [LOG_DIR.resolve(), REPO_ROOT.resolve(), Path("/tmp")]
                if not any(p.is_relative_to(r) for r in allowed_roots):
                    self._json({"ok": False, "error": "Access denied: path outside allowed directories"})
                    return
                if not p.exists() or not p.is_file():
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
                genesis = rpc_call("127.0.0.1", 9445, "getBlockByHeight", {"height": 0})
                if genesis:
                    genesis_hash = genesis.get("hash_hex") or genesis.get("hash")
            except Exception:
                genesis_hash = "Unknown"

            # Get canonical fee split addresses from the LIVE tip block (actual on-chain state)
            # instead of hardcoded values that may be stale after wallet rotation.
            tip_block = None
            try:
                chain_info = rpc_call("127.0.0.1", 9445, "getChainInfo", {})
                if chain_info and chain_info.get("chain_height") is not None:
                    tip_block = rpc_call("127.0.0.1", 9445, "getBlockByHeight",
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
                "v31_node_running": status.get("v31_node", {}).get("running", False),
                "v31_node2_running": status.get("v31_node2", {}).get("running", False),
                "v31_node2_height": status.get("v31_node2", {}).get("chain_height"),
                "v31_node3_running": status.get("v31_node3", {}).get("running", False),
                "v31_node3_height": status.get("v31_node3", {}).get("chain_height"),
                "local_backup_running": status.get("local_backup", {}).get("running", False),
                "local_backup_height": status.get("local_backup", {}).get("chain_height"),
                "local_backup_peers": status.get("local_backup", {}).get("known_peers", 0),
                "v31_node_height": status.get("v31_node", {}).get("chain_height"),
                "pool_running": status["pool"]["running"],
                "miner_running": status["miner"]["running"],
                "git_status": git_status,
                "ready_for_launch": all([
                    genesis_hash is not None and genesis_hash != "Unknown" and len(str(genesis_hash)) == 64,
                    all(fee_split_match.values()),
                    status.get("v31_node", {}).get("running", False) if status.get("topology") == "edge-primary" else status["node1"]["running"],
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
                    genesis = rpc_call("127.0.0.1", 9445, "getBlockByHeight", {"height": 0})
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
                    genesis = rpc_call("127.0.0.1", 9445, "getBlockByHeight", {"height": 0}, timeout=3)
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
                        backup_log.append("✓ Backed up database directory")
                    
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
                    
                    genesis = rpc_call("127.0.0.1", 9445, "getBlockByHeight", {"height": 0})
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
        elif route == "/api/cli/core-util":
            cmd = params.get("cmd", [""])[0].strip()
            db = params.get("db", ["V3/data/zion-node-state.db"])[0].strip()
            self._json(run_cli_core_util(cmd, db))
        elif route == "/api/chain-info":
            info, _, _ = _rpc_with_fallback("getChainInfo", {}, timeout=5.0)
            if info and not info.get("_rpc_error"):
                self._json({"ok": True, "chain_height": info.get("chain_height", 0), "network": info.get("network", "mainnet"), "protocol_version": info.get("protocol_version", ""), "difficulty": info.get("difficulty", 0)})
            else:
                self._json({"ok": False, "error": "RPC unavailable"})
        elif route == "/api/cli/node-status":
            # Return V31 node status from RPC (no CLI script needed)
            st = build_status()
            n1 = st.get("v31_node", {}) or st.get("node1", {})
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
        elif route.startswith("/api/logs/") and not route.startswith("/api/v31/"):
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
        elif route == "/health":
            # Simple liveness endpoint for load balancers / uptime probes
            self._json({"ok": True, "status": "healthy", "version": "3.1.0-beta", "timestamp": int(time.time())})
        elif route == "/api/health":
            # v2 client: GET /api/health → returns HealthMap {service: status}
            self._json(_build_health_map())
        elif route == "/api/systemd":
            # Local systemd user service status — autonomous monitoring
            try:
                
                services = ["zion-ssh-tunnel", "zion-backup-node", "zion-dashboard"]
                result = {}
                for svc in services:
                    try:
                        proc = subprocess.run(
                            ["systemctl", "--user", "is-active", svc],
                            capture_output=True, text=True, timeout=3
                        )
                        active = proc.stdout.strip() == "active"
                        # Get uptime
                        proc2 = subprocess.run(
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
                    proc = subprocess.run(
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
                    proc = subprocess.run(
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
                
                for svc in ["zion-ssh-tunnel", "zion-backup-node", "zion-dashboard"]:
                    try:
                        proc = subprocess.run(["systemctl", "--user", "is-active", svc],
                                      capture_output=True, text=True, timeout=2)
                        _sysd[svc] = proc.stdout.strip()
                    except Exception:
                        _sysd[svc] = "unknown"

                _lb = _st.get("local_backup", {})
                _en = _st.get("v31_node", {})
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
                patterns = ["backup_*.tar.gz", "backup_*.zip"]
                for pattern in patterns:
                    for f in sorted(backup_dir.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True):
                        s = f.stat()
                        backups.append({
                            "name": f.name,
                            "size_mb": round(s.st_size / (1024*1024), 2),
                            "created": datetime.fromtimestamp(s.st_mtime).isoformat(),
                        })
                # Daily / weekly subdirectories used by the edge backup system
                for sub in ("daily", "weekly"):
                    sub_dir = backup_dir / sub
                    if sub_dir.exists():
                        for f in sorted(sub_dir.glob("*.tar.gz"), key=lambda p: p.stat().st_mtime, reverse=True):
                            s = f.stat()
                            backups.append({
                                "name": f"{sub}/{f.name}",
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
        elif route == "/api/genesis-backup":
            action = params.get("action", ["list"])[0]
            if action == "list":
                data = list_edge_backups()
                health = data.get("health") or {}
                backups = []
                for b in data.get("backups", []):
                    size_mb = b.get("size_mb", 0)
                    backups.append({
                        "name": b.get("name", "backup"),
                        "timestamp": b.get("date", ""),
                        "genesis_hash": health.get("genesis_hash", ""),
                        "wallet_count": health.get("wallet_count", 0),
                        "size_kb": round(size_mb * 1024, 1) if size_mb else 0,
                        "redundancy": health.get("redundancy", "local"),
                    })
                self._json({"success": True, "backups": backups})
            else:
                self._json({"success": False, "error": f"Action '{action}' not implemented"})
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
            # V31 systemd services → journalctl
            journal_unit = V31_JOURNAL_MAP.get(svc_id)
            if journal_unit:
                try:
                    r = subprocess.run(
                        ["journalctl", "-u", journal_unit, "--no-pager", "-n", str(n_lines), "--output=cat"],
                        capture_output=True, text=True, timeout=10
                    )
                    lines = strip_ansi(r.stdout).split("\n")
                    self._json({"lines": "\n".join(lines), "exists": True, "total_lines": len(lines), "source": "journalctl"})
                except Exception as e:
                    self._json({"error": str(e), "lines": ""})
            else:
                log_name = SERVICE_LOG_MAP.get(svc_id)
                if not log_name:
                    self._json({"error": "unknown service", "lines": ""})
                else:
                    log_path = latest_log_path(log_name)
                    if not log_path or not log_path.exists():
                        self._json({"lines": f"(log file {log_name} not found)", "exists": False})
                    else:
                        try:
                            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                                all_lines = f.readlines()
                            tail = "".join(all_lines[-n_lines:])
                            self._json({"lines": tail, "exists": True, "total_lines": len(all_lines)})
                        except Exception as e:
                            self._json({"error": str(e), "lines": ""})
        # ── V31 service journal logs (systemd) ────────────────────────────────
        elif route == "/api/v31/logs":
            svc = params.get("svc", ["node"])[0].strip().lower()
            n_lines = min(int(params.get("lines", ["50"])[0]), 500)
            v31_unit_map = {
                "node": "zion-v31-node",
                "pool": "zion-v31-pool",
                "miner": "zion-v31-miner",
                "multichain": "zion-v31-multichain",
                "dao": "zion-v31-dao",
                "oasis": "zion-v31-oasis",
            }
            unit = v31_unit_map.get(svc)
            if not unit:
                self._json({"error": "unknown v31 service", "lines": ""})
            else:
                try:
                    r = subprocess.run(
                        ["journalctl", "-u", unit, "--no-pager", "-n", str(n_lines), "--output=cat"],
                        capture_output=True, text=True, timeout=10
                    )
                    lines = strip_ansi(r.stdout.strip()).split("\n")
                    self._json({"lines": lines, "unit": unit, "exists": True})
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
            except Exception:
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
            alert_id = params.get("id", [""])[0].strip()
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
            bridge_db = get_bridge_db_path()
            pending = 0
            last_block = None
            total_volume = 0.0
            last_l1_height = None
            last_evm_block = None
            locks_detected = 0
            mints_confirmed = 0
            burns_detected = 0
            unlocks_confirmed = 0
            try:
                if bridge_db.exists():
                    con = sqlite3.connect(f"file:{bridge_db}?mode=ro", uri=True)
                    con.row_factory = sqlite3.Row
                    cur = con.cursor()
                    tables = [t[0] for t in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
                    if "l1_locks" in tables:
                        # Pending = not completed
                        cur.execute("SELECT COUNT(*) FROM l1_locks WHERE LOWER(status) != 'completed'")
                        pending += cur.fetchone()[0]
                        cur.execute("SELECT MAX(l1_block_height) FROM l1_locks")
                        row = cur.fetchone()
                        if row and row[0]:
                            last_block = max(last_block or 0, row[0])
                        cur.execute("SELECT SUM(amount_flowers) FROM l1_locks WHERE LOWER(status) = 'completed'")
                        row = cur.fetchone()
                        if row and row[0]:
                            total_volume += int(row[0]) / 1_000_000.0
                        cur.execute("SELECT COUNT(*) FROM l1_locks")
                        locks_detected = cur.fetchone()[0]
                        cur.execute("SELECT COUNT(*) FROM l1_locks WHERE LOWER(status) = 'completed'")
                        mints_confirmed = cur.fetchone()[0]
                    if "evm_burns" in tables:
                        cur.execute("SELECT COUNT(*) FROM evm_burns WHERE LOWER(status) != 'completed'")
                        pending += cur.fetchone()[0]
                        cur.execute("SELECT MAX(evm_block_number) FROM evm_burns")
                        row = cur.fetchone()
                        if row and row[0]:
                            last_block = max(last_block or 0, row[0])
                        cur.execute("SELECT SUM(amount_flowers) FROM evm_burns WHERE LOWER(status) = 'completed'")
                        row = cur.fetchone()
                        if row and row[0]:
                            total_volume += int(row[0]) / 1_000_000.0
                        cur.execute("SELECT COUNT(*) FROM evm_burns")
                        burns_detected = cur.fetchone()[0]
                        cur.execute("SELECT COUNT(*) FROM evm_burns WHERE LOWER(status) = 'completed'")
                        unlocks_confirmed = cur.fetchone()[0]
                    con.close()
                    last_block = last_block if last_block else None
                    total_volume = round(total_volume, 2)
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
            bridge_db = get_bridge_db_path()
            transfers = _build_bridge_transfers(bridge_db, limit=50)
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
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec)
                if result.returncode != 0:
                    self._json({"ok": False, "error": result.stderr[:500]})
                else:
                    data = json.loads(result.stdout)
                    data["ok"] = True
                    self._json(data)
            except subprocess.TimeoutExpired:
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
        elif route == "/api/maestro/orchestrate":
            # Maestro v2.4 — full orchestration: classify → plan → execute → JSON
            query = payload.get("query", "").strip()
            if not query:
                self._json({"error": "missing 'query' field"}, status=400)
                return
            self._json(_maestro_cli(["orchestrate", query], timeout=30))
            return
        elif route == "/api/maestro/classify":
            # Maestro v2.4 — classify intent only
            query = payload.get("query", "").strip()
            if not query:
                self._json({"error": "missing 'query' field"}, status=400)
                return
            self._json(_maestro_cli(["classify", query], timeout=5))
            return
        elif route == "/api/maestro/plan":
            # Maestro v2.4 — classify + plan (no execution)
            query = payload.get("query", "").strip()
            if not query:
                self._json({"error": "missing 'query' field"}, status=400)
                return
            self._json(_maestro_cli(["plan", query], timeout=5))
            return
        elif route.startswith("/api/hiran/proxy"):
            self._proxy_to_hiran("POST", route, raw, dict(self.headers))
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
        elif route == "/api/pool/auxpow":
            self._json(update_auxpow_config(payload))
        elif route == "/api/pool/setup":
            self._json(update_pool_setup_config(payload))
        elif route == "/api/pool/auxpow/restart":
            self._json(restart_auxpow_pool_service())
        # ── Coin hot-switch (runtime, no pool restart) ──
        elif route == "/api/pool/cpu-coin":
            coin = (payload or {}).get("coin", "")
            self._json(_pool_coin_override_set("cpu", coin))
        elif route == "/api/pool/gpu-coin":
            coin = (payload or {}).get("coin", "")
            self._json(_pool_coin_override_set("gpu", coin))
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
            self._json(run_cli_core_util(cmd, db))
        elif route == "/api/ncl/submit":
            # Proxy NCL job submit to Hiranyagarbha on port 8001
            try:
                body_data = json.dumps({
                    "job_type": payload.get("job_type", "inference"),
                    "payload": payload.get("payload", ""),
                    "params": payload.get("params", {}),
                    "priority": payload.get("priority", 0),
                    "submitter": payload.get("submitter", "dashboard"),
                    "input_hash": payload.get("input_hash", ""),
                    "reward_flowers": payload.get("reward_flowers", 0),
                    "max_duration_secs": payload.get("max_duration_secs", 300),
                    "submitted_via": "dashboard"
                }).encode()
                req = urllib.request.Request("http://127.0.0.1:8001/ncl/schedule",
                    data=body_data, headers={"Content-Type": "application/json"}, method="POST")
                with urllib.request.urlopen(req, timeout=8) as r:
                    self._json(json.loads(r.read()))
            except Exception as e:
                self._json({"ok": False, "offline": True, "error": str(e)[:120]})
        elif route == "/api/payout/trigger":
            self._json(trigger_payout())
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
        elif route == "/api/backup-beacon":
            # Receive backup node status from operator's local machine.
            # The beacon is cached and used in _build_status_edge_primary().
            global _BACKUP_BEACON, _BACKUP_BEACON_TIME
            with _BACKUP_BEACON_LOCK:
                _BACKUP_BEACON = payload
                _BACKUP_BEACON_TIME = time.time()
            self._json({"ok": True, "received_at": datetime.now().isoformat()})
        elif route == "/api/v2/batch":
            # v2 batch is an alias for the full status bundle (GET/POST)
            st = build_status()
            self._json({
                "status":    st,
                "health":    _build_health_map(),
                "events":    list(BLOCK_EVENTS)[-10:][::-1] if BLOCK_EVENTS else [],
                "checklist": build_checklist(st),
            })
        elif marketplace.handle_post(self, route, payload):
            return
        elif v31.handle_post(self, route, payload):
            return
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

# ── Static gzip helpers ────────────────────────────────────────────────

_GZ_BODY_CACHE: dict[str, tuple[float, bytes]] = {}
_GZ_CACHE_LOCK = threading.Lock()
_GZIP_ENSURE_TIMES: dict[str, float] = {}

def _get_gz_body(src_path: Path) -> bytes:
    """Return a gzip-compressed copy of *src_path*, caching by mtime.

    This avoids relying on write permissions for on-disk `.gz` siblings;
    the compressed bytes are generated in-memory and invalidated only when
    the source file changes.
    """
    key = str(src_path)
    src_mtime = src_path.stat().st_mtime
    with _GZ_CACHE_LOCK:
        cached_mtime, cached_body = _GZ_BODY_CACHE.get(key, (0.0, b""))
        if cached_mtime == src_mtime:
            return cached_body
    raw = src_path.read_bytes()
    compressed = gzip.compress(raw, compresslevel=6)
    with _GZ_CACHE_LOCK:
        _GZ_BODY_CACHE[key] = (src_mtime, compressed)
    return compressed

def _ensure_gz_uptodate(src_path: Path, gz_path: Path, min_interval: float = 1.0) -> None:
    """Regenerate a .gz sibling if the source file is newer or the archive is missing.

    Only checks the filesystem at most once per `min_interval` seconds per path
    to avoid repeated stat/gzip work under load. Failures (e.g. permission
    denied) are ignored because `_get_gz_body` provides an in-memory fallback.
    """
    if not src_path.exists():
        return
    key = str(gz_path)
    now = time.monotonic()
    last = _GZIP_ENSURE_TIMES.get(key, 0.0)
    if now - last < min_interval:
        return
    _GZIP_ENSURE_TIMES[key] = now
    try:
        src_mtime = src_path.stat().st_mtime
        if gz_path.exists() and gz_path.stat().st_mtime >= src_mtime:
            return
        with src_path.open("rb") as f_in, gzip.open(gz_path, "wb", compresslevel=6) as f_out:
            shutil.copyfileobj(f_in, f_out)
    except Exception:
        pass

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
    if not DASHBOARD_USERS_ENV and not (_legacy_user and _legacy_pass):
        print("  Auth source   : compiled defaults (set DASHBOARD_USERS env var for production)")
    print("  Press Ctrl+C to stop")
    print("=" * 60)
    # Background sampler — re-enabled on Linux (was disabled for Windows deadlock).
    # Records service health history every 5 min for the Health Timeline.
    sampler_thread = threading.Thread(target=background_sampler, daemon=True)
    sampler_thread.start()

    # Ensure pre-compressed static files are fresh before the first request.
    _ensure_gz_uptodate(SCRIPT_DIR / "dashboard.html", SCRIPT_DIR / "dashboard.html.gz", min_interval=0.0)
    _ensure_gz_uptodate(SCRIPT_DIR / "dashboard.js", SCRIPT_DIR / "dashboard.js.gz", min_interval=0.0)
    _ensure_gz_uptodate(SCRIPT_DIR / "dashboard.min.js", SCRIPT_DIR / "dashboard.min.js.gz", min_interval=0.0)

    open_browser()
    server = ThreadingHTTPServer((HOST, PORT), DashboardHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopping dashboard server...")
        server.shutdown()

