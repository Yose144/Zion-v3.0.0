"""
V31 Mainnet Alpha dashboard helpers.
Imported by app.py; keeps V31-specific code isolated.
"""

import json
import os
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
POOL_PORT = 8446
NODE_PID = V31_DATA_DIR / "v31-node.pid"
POOL_PID = V31_DATA_DIR / "v31-pool.pid"
V3_STATE_FILE = REPO_ROOT / "data" / "state"
SYNC_LOG = V31_DATA_DIR / "sync.log"
SYNC_STATE_FILE = V31_DATA_DIR / "sync-state.json"
SYNC_MODE_FILE = V31_DATA_DIR / "sync-mode.txt"


def _strip_ansi(s: str) -> str:
    import re
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


def _is_pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ValueError):
        return False


def _v31_process_status():
    node_pid = int(NODE_PID.read_text().strip()) if NODE_PID.exists() else None
    pool_pid = int(POOL_PID.read_text().strip()) if POOL_PID.exists() else None
    return {
        "node_running": bool(node_pid and _is_pid_alive(node_pid)),
        "node_pid": node_pid,
        "pool_running": bool(pool_pid and _is_pid_alive(pool_pid)),
        "pool_pid": pool_pid,
    }


def _detect_sync_mode(v3_height: int) -> str:
    if v3_height > 0:
        return "v3-checkpoint"
    if SYNC_MODE_FILE.exists():
        return SYNC_MODE_FILE.read_text(encoding="utf-8").strip()
    if (V31_DATA_DIR / "v3-checkpoint.json").exists():
        return "v3-checkpoint"
    return "genesis"


def status():
    """Return V31 runtime + chain status for the dashboard."""
    out = _v31_process_status()
    out["node_reachable"] = _probe_port(NODE_RPC_HOST, NODE_RPC_PORT)
    out["pool_reachable"] = _probe_port("0.0.0.0", POOL_PORT)
    out["canonical_height"] = 0
    out["v3_height"] = 0
    out["tip_hash"] = None
    out["difficulty"] = 0
    out["target"] = None
    out["mempool_account"] = 0
    out["mempool_utxo"] = 0

    if out["node_reachable"]:
        # Canonical chain height from the new-chain block template.
        tpl = _tcp_jsonrpc("getTemplate", {"miner_address": "zion1dashboard"})
        if "result" in tpl and isinstance(tpl["result"], dict):
            r = tpl["result"]
            # Template height = next block height.
            out["canonical_height"] = max(0, int(r.get("height", 0)) - 1)
            out["difficulty"] = int(r.get("difficulty", 0))
            out["target"] = r.get("target")

        # V3 chain height from the V3 RPC layer.
        st = _tcp_jsonrpc("getStatus", [])
        if "result" in st and isinstance(st["result"], dict):
            r = st["result"]
            out["v3_height"] = int(r.get("chain_height", 0))
            out["tip_hash"] = r.get("tip_hash")
            out["mempool_account"] = int(r.get("mempool_account_transactions", 0))
            out["mempool_utxo"] = int(r.get("mempool_utxo_transactions", 0))

    out["sync_mode"] = _detect_sync_mode(out["v3_height"])
    out["log_dir"] = str(LOG_DIR)
    return {"ok": True, **out}


def logs(svc: str = "node", lines: int = 50):
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

    v3_state_height = 0
    if V3_STATE_FILE.exists():
        try:
            with open(V3_STATE_FILE, "r", encoding="utf-8") as f:
                v3_state = json.load(f)
            v3_state_height = int(v3_state.get("height", 0))
        except Exception:
            pass

    return {
        "ok": True,
        "v3_state_height": v3_state_height,
        "v3_state_path": str(V3_STATE_FILE),
        "last_sync": state.get("last_sync"),
        "log": _read_sync_log(),
    }


def _run_background(cmd: list, log_path: Path):
    """Run a command in the background, redirecting stdout/stderr to a log file."""
    try:
        with open(log_path, "w", encoding="utf-8") as lf:
            subprocess.Popen(
                cmd,
                stdout=lf,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                start_new_session=True,
            )
    except Exception as e:
        raise RuntimeError(f"failed to start background process: {e}")


def control(action: str) -> dict:
    script = REPO_ROOT / "V31" / "scripts" / "v31-edge-runtime.sh"
    if not script.exists():
        return {"ok": False, "error": f"Runtime script not found: {script}"}
    if action not in ("start", "stop"):
        return {"ok": False, "error": f"Unknown action: {action}"}
    try:
        # Run via nohup for start so it survives the short-lived HTTP worker.
        if action == "start":
            subprocess.Popen(
                ["/usr/bin/nohup", "bash", str(script), action],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL,
                start_new_session=True,
            )
            # Give it a couple of seconds to spawn.
            time.sleep(2)
        else:
            subprocess.run(["bash", str(script), action], capture_output=True, text=True, timeout=30)
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
        _run_background(["bash", str(script), "state"], SYNC_LOG)
        return {"ok": True, "message": "V3 state sync spawend in the background. Watch sync log."}
    elif mode == "p2p":
        peers = payload.get("peers", [])
        if not peers:
            return {"ok": False, "error": "No V3 peers provided"}
        # Mark mode for status display.
        try:
            with open(SYNC_MODE_FILE, "w", encoding="utf-8") as f:
                f.write("v3-p2p")
        except Exception:
            pass
        _record_sync("p2p", "running", f"peers={','.join(peers)}")
        _run_background(["bash", str(script), "p2p"] + [str(p) for p in peers], SYNC_LOG)
        return {"ok": True, "message": f"V3 P2P sync spawend with peers {', '.join(peers)}"}
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
