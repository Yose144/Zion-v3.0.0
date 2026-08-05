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

def _load_nodes() -> dict:
    """Load V31 node/miner/port configuration from nodes.json."""
    path = SCRIPT_DIR / "nodes.json"
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _load_services() -> dict:
    """Load V31 service manifest from services.json."""
    path = SCRIPT_DIR / "services.json"
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _nodes() -> dict:
    """Return the cached nodes config."""
    if not hasattr(_nodes, "_cache"):
        _nodes._cache = _load_nodes()
    return _nodes._cache


def _services() -> dict:
    """Return the cached services config."""
    if not hasattr(_services, "_cache"):
        _services._cache = _load_services()
    return _services._cache


def _detection_ports() -> dict:
    """Return detection ports from nodes.json, or sensible V31 defaults."""
    return _nodes().get("detection", {}).get("ports", {})


def _node_rpc_host() -> str:
    nodes = _nodes()
    first = next(iter(nodes.get("nodes", {}).values()), {})
    return os.environ.get("ZION_NODE_RPC_HOST", first.get("host", "127.0.0.1"))


def _node_rpc_port() -> int:
    # V31 node RPC is on 9445 by default. Do not trust V3 nodes.json (8443).
    p = os.environ.get("ZION_NODE_RPC_PORT")
    if p is not None:
        return int(p)
    return 9445


def _pool_stratum_port() -> int:
    p = _detection_ports().get("pool_stratum")
    if p is None:
        p = os.environ.get("ZION_POOL_STRATUM_PORT", "8444")
    return int(p)


def _pool_api_port() -> int:
    # V31 pool HTTP API / Prometheus metrics default is 8080.
    bind = os.environ.get("ZION_POOL_API_BIND", "")
    if bind and ":" in bind:
        try:
            return int(bind.split(":")[-1])
        except Exception:
            pass
    p = os.environ.get("ZION_POOL_API_PORT")
    if p is not None:
        return int(p)
    # Do not trust stale nodes.json pool_metrics; use 8080 default.
    return 8080


def _multichain_port() -> int:
    p = _detection_ports().get("multichain_api")
    if p is None:
        p = os.environ.get("ZION_MULTICHAIN_PORT", "8453")
    return int(p)


def _dao_port() -> int:
    p = _detection_ports().get("dao_api")
    if p is not None:
        return int(p)
    # Parse ZION_DAO_BIND (e.g. "127.0.0.1:8456") or fall back to 8456
    bind = os.environ.get("ZION_DAO_BIND", "")
    if bind and ":" in bind:
        try:
            return int(bind.split(":")[-1])
        except Exception:
            pass
    return int(os.environ.get("DAO_API_PORT", "8456"))


def _service_unit(name: str) -> str:
    """Resolve a logical service name (node, pool, miner, multichain, dao)
    to a systemd unit name using services.json, then env, then default."""
    env_var = f"ZION_{name.upper()}_SERVICE"
    if os.environ.get(env_var):
        return os.environ[env_var]
    for key, cfg in _services().items():
        if not isinstance(cfg, dict):
            continue
        if cfg.get("bin") == name or cfg.get("bin") == f"zion-{name}" or key == name:
            unit = cfg.get("service_id")
            if unit:
                return f"{unit}.service"
    return f"zion-v31-{name}.service"


def _all_service_names() -> list:
    """List of logical V31 service names to monitor."""
    # Service *names* are logical; the actual systemd unit for each is looked
    # up in services.json via _service_unit().  This keeps the canonical set
    # small and lets local Edge vs. PC manifests differ.
    return ["node", "pool", "miner", "multichain", "dao"]


V3_STATE_FILE = REPO_ROOT / "data" / "state"
SYNC_LOG = V31_DATA_DIR / "sync.log"
SYNC_STATE_FILE = V31_DATA_DIR / "sync-state.json"
SYNC_MODE_FILE = V31_DATA_DIR / "sync-mode.txt"
V31_DB_PATH = V31_DATA_DIR / "node.db"
V31_CHECKPOINT = V31_DATA_DIR / "v3-checkpoint.json"


def _strip_ansi(s: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*[mKABCDEFGHJSTfhilmnprsuABCD]", "", s)


def _tcp_jsonrpc(method: str, params=None, timeout: float = 3.0):
    """Send a JSON-RPC line to the V31 node and return the response dict."""
    if params is None:
        params = {}
    req = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}) + "\n"
    try:
        with socket.create_connection((_node_rpc_host(), _node_rpc_port()), timeout=timeout) as s:
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


def _systemctl_status(unit: str = None) -> dict:
    """Get systemd service status for a V31 unit (defaults to node)."""
    if unit is None:
        unit = _service_unit("node")
    try:
        r = subprocess.run(
            ["systemctl", "show", unit,
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


def _journalctl_logs(lines: int = 50, unit: str = None) -> list:
    """Read V31 logs from journald for a given unit (defaults to node)."""
    if unit is None:
        unit = _service_unit("node")
    try:
        r = subprocess.run(
            ["journalctl", "-u", unit, "--no-pager", "-n", str(lines),
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
    for name in _all_service_names():
        unit = _service_unit(name)
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
    return _http_get_json("127.0.0.1", _pool_api_port(), "/stats")


def _miner_metrics(lines: int = 200) -> dict:
    """Parse the latest miner log file for key metrics.

    Recognises lines containing key=value pairs and also simple
    accepted/rejected/hashes word patterns.  Returns the most recent value
    seen for each metric so the dashboard always shows live data.
    """
    import re
    from collections import deque

    miner_cfg = _nodes().get("miners", {}).get("macos-miner", {})
    worker = miner_cfg.get("worker_name", "macos-miner")
    log_path = LOG_DIR / "v31-miner.log"
    if not log_path.exists():
        log_path = LOG_DIR / "miner.log"
    if not log_path.exists():
        return {"_error": f"miner log not found: {log_path}", "worker": worker}

    metrics = {"worker": worker}
    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            tail = deque(f, maxlen=lines)
    except Exception as e:
        return {"_error": f"error reading miner log: {e}", "worker": worker}

    # key=value and key: value patterns, e.g. hashrate=123.4, accepted=7
    kv_re = re.compile(r"\b([a-zA-Z_][a-zA-Z0-9_]*)[=:]\s*([0-9]+(?:\.[0-9]+)?)")
    # standalone counts: e.g. "accepted 42", "rejected 3"
    count_re = re.compile(r"\b(accepted|rejected|stale|invalid|errors)\D*([0-9]+)", re.I)
    # hashrate word pattern: e.g. "hashrate 1.23 MH/s" or "1.23 MH/s"
    hrate_re = re.compile(r"(?:hashrate|h/s)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*([kMGTP]?H/s)?", re.I)

    for line in tail:
        line = _strip_ansi(line)
        for m in kv_re.finditer(line):
            metrics[m.group(1).lower()] = float(m.group(2)) if "." in m.group(2) else int(m.group(2))
        for m in count_re.finditer(line):
            key = m.group(1).lower()
            metrics[key] = int(m.group(2))
        for m in hrate_re.finditer(line):
            metrics["hashrate"] = float(m.group(1))
            if m.group(2):
                metrics["hashrate_unit"] = m.group(2).upper()

    # Fallback: miner running? (probe pool stratum to infer)
    pool_addr = miner_cfg.get("pool_addr", "")
    metrics["pool_addr"] = pool_addr
    metrics["running"] = bool(pool_addr)
    return metrics


def _pool_prometheus() -> dict:
    """Fetch pool Prometheus metrics and parse key values."""
    import urllib.request
    url = f"http://127.0.0.1:{_pool_api_port()}/metrics"
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


# Cache for deriving shares/sec from total share counter
_LAST_POOL_TOTALS = {"ts": 0.0, "shares": 0.0}


def _pool_banner_metrics() -> dict:
    """Return pool hashrate (H/s) and shares/sec for the V31 banner."""
    prom = _pool_prometheus()
    hashrate = None
    if isinstance(prom, dict) and "_error" not in prom:
        if "zion_pool_hashrate_hps" in prom:
            hashrate = float(prom["zion_pool_hashrate_hps"])
        elif "zion_pool_hashrate_khs" in prom:
            hashrate = float(prom["zion_pool_hashrate_khs"]) * 1000.0
        elif "zion_pool_hashrate_1h_hps" in prom:
            hashrate = float(prom["zion_pool_hashrate_1h_hps"])

    sps = None
    total_shares = None

    # Try direct shares-per-second from /stats or prometheus
    stats = _pool_metrics()
    if isinstance(stats, dict) and "_error" not in stats:
        sps_field = stats.get("shares_per_second") or stats.get("shares_per_sec")
        if sps_field is not None:
            try:
                sps = float(sps_field)
            except Exception:
                pass
        total_shares = stats.get("total_shares") or stats.get("shares_total")

    if isinstance(prom, dict) and "_error" not in prom:
        if sps is None and "zion_pool_shares_per_second" in prom:
            try:
                sps = float(prom["zion_pool_shares_per_second"])
            except Exception:
                pass
        if total_shares is None:
            # V31 pool exposes accepted share counter as `zion_pool_shares_accepted`
            total_shares = prom.get("zion_pool_shares_accepted")

    # Derive shares/sec from total-share delta if a direct value is not available
    if sps is None and total_shares is not None:
        global _LAST_POOL_TOTALS
        now = time.time()
        prev = _LAST_POOL_TOTALS
        try:
            total = float(total_shares)
            if prev["ts"] > 0 and total >= prev["shares"]:
                dt = now - prev["ts"]
                if dt > 0:
                    sps = round((total - prev["shares"]) / dt, 2)
            prev["ts"] = now
            prev["shares"] = total
        except Exception:
            pass

    return {
        "hashrate_hps": hashrate,
        "shares_per_sec": sps,
        "total_shares": total_shares,
    }


def _dao_proposals() -> dict:
    """Extract DAO proposal counts from DAO stats."""
    st = _dao_stats()
    if not isinstance(st, dict) or "_error" in st:
        return {"total": 0, "active": 0}
    total = st.get("total_proposals") or st.get("proposals_total") or st.get("proposals", 0)
    active = st.get("active_proposals") or st.get("proposals_active") or st.get("open_proposals", 0)
    return {
        "total": int(total) if total is not None else 0,
        "active": int(active) if active is not None else 0,
    }


def _multichain_health() -> dict:
    """Fetch multichain health."""
    return _http_get_json("127.0.0.1", _multichain_port(), "/health")


def _dao_health() -> dict:
    """Fetch DAO health."""
    return _http_get_json("127.0.0.1", _dao_port(), "/api/dao/health")


def _dao_stats() -> dict:
    """Fetch DAO stats (proposals, votes, treasury, scanner)."""
    return _http_get_json("127.0.0.1", _dao_port(), "/api/dao/stats")


def _dao_prometheus() -> dict:
    """Fetch DAO Prometheus metrics."""
    import urllib.request
    url = f"http://127.0.0.1:{_dao_port()}/metrics"
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
    node_host = _node_rpc_host()
    node_port = _node_rpc_port()
    stratum_port = _pool_stratum_port()
    api_port = _pool_api_port()
    node_reachable = _probe_port(node_host, node_port)

    # V3 state height (canonical reference)
    v3_ref_height = _v3_state_height()

    # V31 DB tip (from SQLite — always available even if RPC is down)
    db_tip = _sqlite_tip()

    dao_port = _dao_port()

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
        "node_rpc_addr": f"{node_host}:{node_port}",
        "pool_stratum_port": stratum_port,
        "pool_api_port": api_port,
        "pool_reachable": _probe_port("0.0.0.0", stratum_port),
        "pool_api_reachable": _probe_port("0.0.0.0", api_port),
        "pool_pid": None,
        "dao_api_port": dao_port,
        "dao_reachable": _probe_port("127.0.0.1", dao_port),
        # All V31 services
        "services": _all_service_status(),
        # Pool metrics from HTTP API
        "pool_metrics": _pool_metrics(),
        # Miner metrics from log file
        "miner_metrics": _miner_metrics(),
        # Multichain health
        "multichain_health": _multichain_health(),
        # DAO health and stats
        "dao_health": _dao_health(),
        "dao_stats": _dao_stats(),
        "dao_prometheus": _dao_prometheus(),
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
        "service_name": _service_unit("node"),
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

    # Banner KPIs: hashrate, shares/sec, multichain /health, DAO proposals
    banner = _pool_banner_metrics()
    mc = _multichain_health()
    dao_p = _dao_proposals()
    out.update({
        "height": out.get("canonical_height") or out["db_height"],
        "pool_hashrate_hps": banner["hashrate_hps"],
        "shares_per_sec": banner["shares_per_sec"],
        "pool_total_shares": banner["total_shares"],
        "multichain_ok": bool(mc.get("ok")) if isinstance(mc, dict) and "_error" not in mc else False,
        "multichain_transfers_total": mc.get("transfers_total", 0) if isinstance(mc, dict) else 0,
        "multichain_transfers_pending": mc.get("transfers_pending", 0) if isinstance(mc, dict) else 0,
        "dao_proposals_total": dao_p["total"],
        "dao_proposals_active": dao_p["active"],
    })

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


def control(action: str, service: str = "node") -> dict:
    """Control a V31 service via systemctl (defaults to node)."""
    if action not in ("start", "stop", "restart"):
        return {"ok": False, "error": f"Unknown action: {action}"}
    unit = _service_unit(service)
    try:
        subprocess.run(
            ["systemctl", action, unit],
            capture_output=True, text=True, timeout=30
        )
        time.sleep(2)
        return {"ok": True, "action": action, "service": service, "status": status()}
    except Exception as e:
        return {"ok": False, "action": action, "service": service, "error": str(e)}


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

    if route == "/api/v31/miner-metrics":
        handler._json(_miner_metrics())
        return True

    if route == "/api/v31/multichain-health":
        handler._json(_multichain_health())
        return True

    if route == "/api/v31/dao-health":
        handler._json(_dao_health())
        return True

    if route == "/api/v31/dao-stats":
        handler._json(_dao_stats())
        return True

    if route == "/api/v31/dao-metrics":
        handler._json(_dao_prometheus())
        return True

    if route == "/api/v31/logs":
        svc = (params.get("svc", ["node"])[0]).strip() or "node"
        lines = int(params.get("lines", ["50"])[0])
        handler._json(logs(svc, lines))
        return True

    if route == "/api/v31/control":
        action = (params.get("action", [""])[0]).strip()
        service = (params.get("service", ["node"])[0]).strip() or "node"
        handler._json(control(action, service))
        return True

    if route == "/api/v31/sync-info":
        handler._json(sync_info())
        return True

    return False


def handle_post(handler, route: str, payload: dict):
    if route == "/api/v31/control":
        action = str(payload.get("action", "")).strip()
        service = str(payload.get("service", "node")).strip() or "node"
        handler._json(control(action, service))
        return True
    if route == "/api/v31/sync":
        handler._json(sync(payload))
        return True
    return False
