"""
V31 Mainnet Alpha dashboard helpers.
Imported by app.py; keeps V31-specific code isolated.

Updated 2026-08-03: V31 now runs as systemd service `zion-v31-node.service`.
Uses systemctl for status/control and journald for logs instead of PID files.
"""

import json
import os
import re
import socket
import subprocess
import time
from pathlib import Path
from urllib.parse import parse_qs

SCRIPT_DIR = Path(__file__).parent.resolve()
REPO_ROOT = SCRIPT_DIR.parent.parent
LOG_DIR = REPO_ROOT / "logs"
V31_DATA_DIR = REPO_ROOT / "data" / "v31"

NODE_RPC_HOST = "127.0.0.1"
NODE_RPC_PORT = 9445
POOL_PORT = 8444
POOL_API_PORT = 8080
MULTICHAIN_PORT = 8453
DAO_PORT = 8081
V3_STATE_FILE = REPO_ROOT / "data" / "state"
SYNC_LOG = V31_DATA_DIR / "sync.log"
SYNC_STATE_FILE = V31_DATA_DIR / "sync-state.json"
SYNC_MODE_FILE = V31_DATA_DIR / "sync-mode.txt"
V31_DB_PATH = V31_DATA_DIR / "node.db"
V31_CHECKPOINT = V31_DATA_DIR / "v3-checkpoint.json"

SYSTEMD_SERVICE = "zion-v31-node.service"
POOL_SERVICE = "zion-v31-pool.service"
MINER_SERVICE = "zion-v31-miner.service"
MULTICHAIN_SERVICE = "zion-v31-multichain.service"
DAO_SERVICE = "zion-v31-dao.service"

ALL_V31_SERVICES = [
    ("node", SYSTEMD_SERVICE),
    ("pool", POOL_SERVICE),
    ("miner", MINER_SERVICE),
    ("multichain", MULTICHAIN_SERVICE),
    ("dao", DAO_SERVICE),
]


def _strip_ansi(s: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*[mKABCDEFGHJSTfhilmnprsuABCD]", "", s)


def _tcp_jsonrpc(method: str, params=None, timeout: float = 3.0):
    """Send a JSON-RPC line to the V31 node and return the response dict."""
    if params is None:
        params = {}
    req = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}) + "\n"
    try:
        with socket.create_connection((NODE_RPC_HOST, NODE_RPC_PORT), timeout=timeout) as s:
            s.sendall(req.encode())
            resp = s.recv(8192).decode("utf-8", errors="replace").strip()
            return json.loads(resp)
    except Exception as e:
        return {"_rpc_error": str(e)}


def _probe_port(host: str, port: int, timeout: float = 0.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def _systemctl_status() -> dict:
    """Get systemd service status for V31 node."""
    try:
        r = subprocess.run(
            ["systemctl", "show", SYSTEMD_SERVICE,
             "--property=ActiveState,SubState,UnitFileState,MainPID,ExecMainStartTimestamp,MemoryCurrent"],
            capture_output=True, text=True, timeout=5
        )
        props = {}
        for line in r.stdout.strip().split("\n"):
            if "=" in line:
                k, v = line.split("=", 1)
                props[k] = v
        active = props.get("ActiveState", "unknown")
        sub = props.get("SubState", "unknown")
        enabled = props.get("UnitFileState", "unknown")
        pid = int(props.get("MainPID", 0)) or None
        mem = props.get("MemoryCurrent", "")
        try:
            mem_mb = round(int(mem) / 1048576, 1) if mem and mem != "[not set]" else None
        except (ValueError, TypeError):
            mem_mb = None
        start_ts = props.get("ExecMainStartTimestamp", "")
        return {
            "systemd_active": active,
            "systemd_sub": sub,
            "systemd_enabled": enabled,
            "node_pid": pid,
            "memory_mb": mem_mb,
            "start_timestamp": start_ts,
            "is_running": active == "active",
        }
    except Exception as e:
        return {
            "systemd_active": "error",
            "systemd_sub": str(e)[:80],
            "systemd_enabled": "unknown",
            "node_pid": None,
            "memory_mb": None,
            "start_timestamp": "",
            "is_running": False,
        }


def _journalctl_logs(lines: int = 50) -> list:
    """Read V31 node logs from journald."""
    try:
        r = subprocess.run(
            ["journalctl", "-u", SYSTEMD_SERVICE, "--no-pager", "-n", str(lines),
             "--output=cat"],
            capture_output=True, text=True, timeout=5
        )
        return [_strip_ansi(l.rstrip()) for l in r.stdout.strip().split("\n") if l.strip()]
    except Exception:
        return ["[journalctl unavailable]"]


def _http_get_json(host: str, port: int, path: str, timeout: float = 3.0):
    """Fetch JSON from an HTTP endpoint."""
    import urllib.request
    url = f"http://{host}:{port}{path}"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"_error": str(e)}


def _all_service_status() -> list:
    """Get systemd status for all V31 services."""
    result = []
    for name, unit in ALL_V31_SERVICES:
        try:
            r = subprocess.run(
                ["systemctl", "show", unit,
                 "--property=ActiveState,SubState,MainPID,MemoryCurrent"],
                capture_output=True, text=True, timeout=3
            )
            props = {}
            for line in r.stdout.strip().split("\n"):
                if "=" in line:
                    k, v = line.split("=", 1)
                    props[k] = v
            active = props.get("ActiveState", "unknown")
            mem = props.get("MemoryCurrent", "")
            try:
                mem_mb = round(int(mem) / 1048576, 1) if mem and mem != "[not set]" else None
            except (ValueError, TypeError):
                mem_mb = None
            result.append({
                "name": name,
                "unit": unit,
                "active": active == "active",
                "active_state": active,
                "sub_state": props.get("SubState", "unknown"),
                "pid": int(props.get("MainPID", 0)) or None,
                "memory_mb": mem_mb,
            })
        except Exception as e:
            result.append({
                "name": name,
                "unit": unit,
                "active": False,
                "active_state": "error",
                "sub_state": str(e)[:60],
                "pid": None,
                "memory_mb": None,
            })
    return result


def _pool_metrics() -> dict:
    """Fetch pool metrics from the pool HTTP API."""
    return _http_get_json("127.0.0.1", POOL_API_PORT, "/stats")


def _pool_prometheus() -> dict:
    """Fetch pool Prometheus metrics and parse key values."""
    import urllib.request
    url = f"http://127.0.0.1:{POOL_API_PORT}/metrics"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            text = resp.read().decode("utf-8")
        metrics = {}
        for line in text.strip().split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 2:
                try:
                    metrics[parts[0]] = float(parts[1])
                except ValueError:
                    pass
        return metrics
    except Exception as e:
        return {"_error": str(e)}


def _multichain_health() -> dict:
    """Fetch multichain health."""
    return _http_get_json("127.0.0.1", MULTICHAIN_PORT, "/health")


def _detect_sync_mode(v3_height: int) -> str:
    if v3_height > 0:
        return "v3-p2p-sync"
    if SYNC_MODE_FILE.exists():
        return SYNC_MODE_FILE.read_text(encoding="utf-8").strip()
    if V31_CHECKPOINT.exists():
        return "v3-checkpoint"
    return "genesis"


def _sqlite_tip() -> dict:
    """Read V31 DB tip directly from SQLite."""
    if not V31_DB_PATH.exists():
        return {"db_height": 0, "db_tip_hash": None}
    try:
        r = subprocess.run(
            ["sqlite3", str(V31_DB_PATH),
             "SELECT tip_height, hex(tip_hash) FROM v3_chain_state;"],
            capture_output=True, text=True, timeout=3
        )
        parts = r.stdout.strip().split("|")
        if len(parts) >= 2:
            return {"db_height": int(parts[0]), "db_tip_hash": parts[1]}
        return {"db_height": 0, "db_tip_hash": None}
    except Exception:
        return {"db_height": 0, "db_tip_hash": None}


def _v3_state_height() -> int:
    """Read V3 state file height."""
    if not V3_STATE_FILE.exists():
        return 0
    try:
        with open(V3_STATE_FILE, "r") as f:
            state = json.load(f)
        blocks = state.get("accepted_blocks", [])
        if blocks:
            return int(blocks[-1].get("height", 0))
        return int(state.get("height", 0))
    except Exception:
        return 0


def status():
    """Return V31 runtime + chain status for the dashboard."""
    svc = _systemctl_status()
    node_reachable = _probe_port(NODE_RPC_HOST, NODE_RPC_PORT)

    # V3 state height (canonical reference)
    v3_ref_height = _v3_state_height()

    # V31 DB tip (from SQLite — always available even if RPC is down)
    db_tip = _sqlite_tip()

    out = {
        "ok": True,
        "node_running": svc["is_running"],
        "node_reachable": node_reachable,
        "systemd_active": svc["systemd_active"],
        "systemd_sub": svc["systemd_sub"],
        "systemd_enabled": svc["systemd_enabled"],
        "node_pid": svc["node_pid"],
        "memory_mb": svc["memory_mb"],
        "start_timestamp": svc["start_timestamp"],
        "pool_reachable": _probe_port("0.0.0.0", POOL_PORT),
        "pool_running": _probe_port("0.0.0.0", POOL_PORT),
        "pool_pid": None,
        # All V31 services
        "services": _all_service_status(),
        # Pool metrics from HTTP API
        "pool_metrics": _pool_metrics(),
        # Multichain health
        "multichain_health": _multichain_health(),
        # Chain status
        "v3_height": v3_ref_height,
        "db_height": db_tip["db_height"],
        "db_tip_hash": db_tip["db_tip_hash"],
        "canonical_height": 0,
        "tip_hash": None,
        "difficulty": 0,
        "target": None,
        "mempool_account": 0,
        "mempool_utxo": 0,
        "sync_mode": _detect_sync_mode(db_tip["db_height"]),
        "sync_lag": max(0, v3_ref_height - db_tip["db_height"]) if v3_ref_height > 0 else 0,
        "log_dir": str(LOG_DIR),
        "version": "3.1.0-alpha.2",
        "service_name": SYSTEMD_SERVICE,
    }

    if node_reachable:
        # Canonical chain height from the new-chain block template.
        tpl = _tcp_jsonrpc("getTemplate", {"miner_address": "zion1dashboard"})
        if "result" in tpl and isinstance(tpl["result"], dict):
            r = tpl["result"]
            out["canonical_height"] = max(0, int(r.get("height", 0)) - 1)
            out["difficulty"] = int(r.get("difficulty", 0))
            out["target"] = r.get("target")

        # V3 chain height from the V3 RPC layer.
        st = _tcp_jsonrpc("getStatus", [])
        if "result" in st and isinstance(st["result"], dict):
            r = st["result"]
            out["tip_hash"] = r.get("tip_hash") or r.get("tip_hash_hex")
            out["mempool_account"] = int(r.get("mempool_account_transactions", 0))
            out["mempool_utxo"] = int(r.get("mempool_utxo_transactions", 0))

    return out


def logs(svc: str = "node", lines: int = 50):
    """Read V31 logs from journald (node) or log file (pool)."""
    if svc == "node":
        return {"ok": True, "svc": svc, "lines": _journalctl_logs(lines)}
    # Pool logs from file
    log_name = f"v31-{svc}.log"
    log_path = LOG_DIR / log_name
    if not log_path.exists():
        return {"ok": False, "error": f"Log not found: {log_path}"}
    try:
        from collections import deque
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            tail = [l.rstrip() for l in deque(f, maxlen=min(lines, 500))]
        return {"ok": True, "svc": svc, "lines": [_strip_ansi(l) for l in tail]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def tail(svc: str = "node", lines: int = 50):
    return logs(svc, lines)


def _record_sync(mode: str, status: str, detail: str = ""):
    state = {}
    if SYNC_STATE_FILE.exists():
        try:
            state = json.loads(SYNC_STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            state = {}
    state["last_sync"] = {
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "mode": mode,
        "status": status,
        "detail": detail,
    }
    try:
        with open(SYNC_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception:
        pass


def _read_sync_log():
    if not SYNC_LOG.exists():
        return ""
    try:
        return _strip_ansi(SYNC_LOG.read_text(encoding="utf-8", errors="replace"))[-4000:]
    except Exception as e:
        return f"error reading sync log: {e}"


def sync_info():
    state = {}
    if SYNC_STATE_FILE.exists():
        try:
            state = json.loads(SYNC_STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            state = {}

    v3_state_height = _v3_state_height()
    db_tip = _sqlite_tip()

    return {
        "ok": True,
        "v3_state_height": v3_state_height,
        "v31_db_height": db_tip["db_height"],
        "v31_db_tip_hash": db_tip["db_tip_hash"],
        "sync_lag": max(0, v3_state_height - db_tip["db_height"]) if v3_state_height > 0 else 0,
        "v3_state_path": str(V3_STATE_FILE),
        "checkpoint_path": str(V31_CHECKPOINT),
        "checkpoint_exists": V31_CHECKPOINT.exists(),
        "last_sync": state.get("last_sync"),
        "log": _read_sync_log(),
    }


def control(action: str) -> dict:
    """Control V31 node via systemctl."""
    if action not in ("start", "stop", "restart"):
        return {"ok": False, "error": f"Unknown action: {action}"}
    try:
        subprocess.run(
            ["systemctl", action, SYSTEMD_SERVICE],
            capture_output=True, text=True, timeout=30
        )
        time.sleep(2)
        return {"ok": True, "action": action, "status": status()}
    except Exception as e:
        return {"ok": False, "action": action, "error": str(e)}


def sync(payload: dict) -> dict:
    """Handle V3 sync requests from the dashboard."""
    mode = str(payload.get("mode", "")).strip()
    script = REPO_ROOT / "V31" / "scripts" / "v31-sync-v3.sh"
    if not script.exists():
        return {"ok": False, "error": f"Sync script not found: {script}"}
    if mode == "state":
        _record_sync("state", "running", "migrating V3 state and building checkpoint")
        subprocess.Popen(
            ["bash", str(script), "state"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL, start_new_session=True,
        )
        return {"ok": True, "message": "V3 state sync started in the background."}
    elif mode == "p2p":
        peers = payload.get("peers", [])
        if not peers:
            return {"ok": False, "error": "No V3 peers provided"}
        try:
            with open(SYNC_MODE_FILE, "w", encoding="utf-8") as f:
                f.write("v3-p2p")
        except Exception:
            pass
        _record_sync("p2p", "running", f"peers={','.join(peers)}")
        subprocess.Popen(
            ["bash", str(script), "p2p"] + [str(p) for p in peers],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL, start_new_session=True,
        )
        return {"ok": True, "message": f"V3 P2P sync started with peers {', '.join(peers)}"}
    else:
        return {"ok": False, "error": f"Unknown sync mode: {mode}"}


def _serve_static(handler, route: str):
    """Serve /v31/ static assets."""
    if route == "/v31":
        handler.send_response(302)
        handler.send_header("Location", "/v31/")
        handler.end_headers()
        return True
    if route == "/v31/" or route == "/v31/index.html":
        index = SCRIPT_DIR / "v31" / "index.html"
        if index.exists():
            handler._html(index.read_text(encoding="utf-8"))
        else:
            handler.send_error(404, "V31 dashboard not found")
        return True
    if route.startswith("/v31/"):
        rel = route[5:].lstrip("/")
        file = SCRIPT_DIR / "v31" / rel
        if file.exists() and file.is_file():
            ct = {
                ".css": "text/css; charset=utf-8",
                ".js": "application/javascript; charset=utf-8",
                ".html": "text/html; charset=utf-8",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".svg": "image/svg+xml",
            }.get(file.suffix, "application/octet-stream")
            body = file.read_bytes()
            handler.send_response(200)
            handler.send_header("Content-Type", ct)
            handler.send_header("Content-Length", str(len(body)))
            handler.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            handler.end_headers()
            handler.wfile.write(body)
        else:
            handler.send_error(404)
        return True
    return False


def handle_get(handler, route: str, params: dict):
    """Called from app.py do_GET for V31 routes."""
    if _serve_static(handler, route):
        return True

    if route == "/api/v31/status":
        handler._json(status())
        return True

    if route == "/api/v31/services":
        handler._json({"ok": True, "services": _all_service_status()})
        return True

    if route == "/api/v31/pool-metrics":
        handler._json(_pool_metrics())
        return True

    if route == "/api/v31/pool-prometheus":
        handler._json(_pool_prometheus())
        return True

    if route == "/api/v31/multichain-health":
        handler._json(_multichain_health())
        return True

    if route == "/api/v31/logs":
        svc = (params.get("svc", ["node"])[0]).strip() or "node"
        lines = int(params.get("lines", ["50"])[0])
        handler._json(logs(svc, lines))
        return True

    if route == "/api/v31/control":
        action = (params.get("action", [""])[0]).strip()
        handler._json(control(action))
        return True

    if route == "/api/v31/sync-info":
        handler._json(sync_info())
        return True

    return False


def handle_post(handler, route: str, payload: dict):
    if route == "/api/v31/control":
        action = str(payload.get("action", "")).strip()
        handler._json(control(action))
        return True
    if route == "/api/v31/sync":
        handler._json(sync(payload))
        return True
    return False
