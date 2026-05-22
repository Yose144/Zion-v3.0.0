#!/usr/bin/env python3
"""
ZION V3 — Mainnet Launch Dashboard Server
Zero-dependency: uses only Python stdlib. Serves a live HTML dashboard
and parses local log files via a JSON API.
"""

import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.parse
from collections import deque
from datetime import datetime
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ── Config ──────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent.resolve()
REPO_ROOT = SCRIPT_DIR.parent
LOG_DIR = REPO_ROOT / "logs"
SCRIPTS_DIR = REPO_ROOT / "scripts"
if not LOG_DIR.exists():
    LOG_DIR = Path("../logs")

HOST = "127.0.0.1"
PORT = 8765

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
                "n1_height": status["node1"]["chain_height"],
                "n2_height": status["node2"]["chain_height"],
                "n1_peers": status["node1"]["known_peers"],
                "hashrate": status["miner"]["hashrate"],
                "shares_ok": status["pool"]["shares_accepted"],
                "shares_bad": status["pool"]["shares_rejected"],
                "blocks": status["pool"]["blocks_found"],
                "sessions": status["pool"]["active_sessions"],
            })

    def snapshot(self) -> list:
        with self.lock:
            return list(self.samples)

HISTORY = MetricsHistory()
BLOCK_EVENTS: deque = deque(maxlen=50)
LAST_BLOCK_EVENT_TIME = {"node1": 0, "node2": 0, "pool": 0}

# ── Service Registry ────────────────────────────────────────────────────
# Single source of truth: every service the mainnet stack might run.
# Used to render service cards, health checks, network topology, and controls.

SERVICE_REGISTRY = [
    # ── L1: Consensus ────────────────────────────────────────────────────
    {"id": "node1", "name": "Node 1 (Genesis)", "icon": "🔷", "level": "L1", "kind": "node",
     "ports": {"p2p": 8333, "rpc": 8443, "ws": 8445, "metrics": 9115},
     "log": "node1.log", "start": "start-node1", "stop": None,
     "purpose": "Source of chain truth: validates blocks, manages mempool, talks to peers via P2P.",
     "child_says": "🔷 This is the boss — it remembers every block ever made.",
     "depends_on": []},
    {"id": "node2", "name": "Node 2 (Follower)", "icon": "🔶", "level": "L1", "kind": "node",
     "ports": {"p2p": 8334, "rpc": 8446, "ws": 8447},
     "log": "node2.log", "start": "start-node2", "stop": None,
     "purpose": "Backup node — syncs from Node 1 and validates independently for redundancy.",
     "child_says": "🔶 Like Node 1's twin — they double-check each other!",
     "depends_on": ["node1"]},
    {"id": "pool", "name": "Core Mining Pool", "icon": "⚡", "level": "L1", "kind": "pool",
     "ports": {"stratum": 8444, "metrics": 9550},
     "log": "pool.log", "start": "start-pool", "stop": None,
     "purpose": "Primary pool — local miners, validates shares, distributes payouts (89/5/5/1).",
     "child_says": "⚡ The pool helps lots of computers work together to find blocks!",
     "depends_on": ["node1"]},
    {"id": "pool-edge", "name": "Edge Mining Pool", "icon": "🌐", "level": "L1", "kind": "pool",
     "ports": {"stratum": 8444, "metrics": 9550},
     "host": "100.66.162.125",
     "log": None, "start": None, "stop": None,
     "purpose": "Edge relay pool — accepts external miners via public IP, syncs with Core pool.",
     "child_says": "🌐 The edge pool lets miners from all over the world connect!",
     "depends_on": ["node1"]},
    {"id": "miner", "name": "GPU Miner", "icon": "⛏️", "level": "L1", "kind": "miner",
     "ports": {},
     "log": "miner.log", "start": "start-miner", "stop": None,
     "purpose": "Performs cosmic_harmony PoW hashing on GPU to find new blocks.",
     "child_says": "⛏️ The miner is like a digger — it digs for new gold (ZION coins)!",
     "depends_on": ["pool"]},

    # ── L2: Bridge & DAO ────────────────────────────────────────────────
    {"id": "bridge", "name": "ZION Bridge", "icon": "🌉", "level": "L2", "kind": "bridge",
     "ports": {"api": 8550, "metrics": 9551},
     "log": "bridge.log", "start": None, "stop": None,
     "purpose": "Cross-chain relay: moves ZION between L1 and EVM chains (Ethereum, Polygon).",
     "child_says": "🌉 A magical bridge to send ZION to other crypto worlds!",
     "depends_on": ["node1"]},
    {"id": "dao", "name": "ZION DAO", "icon": "🗳️", "level": "L2", "kind": "dao",
     "ports": {"api": 8560, "metrics": 9552},
     "log": "dao.log", "start": None, "stop": None,
     "purpose": "Decentralized governance: proposals, voting, treasury management.",
     "child_says": "🗳️ Everyone votes here to decide what ZION should do next!",
     "depends_on": ["node1"]},
    {"id": "atomic-swap", "name": "Atomic Swap", "icon": "🔄", "level": "L2", "kind": "swap",
     "ports": {"api": 8570, "metrics": 9553},
     "log": "atomic-swap.log", "start": None, "stop": None,
     "purpose": "HTLC-based atomic swaps between ZION and other chains (no middleman).",
     "child_says": "🔄 Trade coins safely with strangers without anyone cheating!",
     "depends_on": ["node1"]},

    # ── L3: Advanced ─────────────────────────────────────────────────────
    {"id": "warp", "name": "WARP Relay", "icon": "🌀", "level": "L3", "kind": "relay",
     "ports": {"api": 8580, "metrics": 9554},
     "log": "warp.log", "start": None, "stop": None,
     "purpose": "Multi-chain relay for fast cross-chain messaging.",
     "child_says": "🌀 A super-fast message tube between blockchains!",
     "depends_on": []},
    {"id": "ncl", "name": "NCL Gateway", "icon": "🧠", "level": "L3", "kind": "gateway",
     "ports": {"api": 8590},
     "log": "ncl.log", "start": None, "stop": None,
     "purpose": "Network Computing Layer gateway — distributed compute fabric.",
     "child_says": "🧠 Helps many computers think together as one big brain!",
     "depends_on": ["node1"]},
    {"id": "ai-native", "name": "AI Native (Hiran)", "icon": "🤖", "level": "L3", "kind": "ai",
     "ports": {"api": 8002},
     "log": "hiran-inference.log", "start": None, "stop": None,
     "purpose": "Hiran v2.2 language model serving inference for ZION ecosystem queries.",
     "child_says": "🤖 A robot helper that knows everything about ZION!",
     "depends_on": []},

    # ── L4: Apps ─────────────────────────────────────────────────────────
    {"id": "oasis", "name": "OASIS Avatar Hub", "icon": "🪷", "level": "L4", "kind": "app",
     "ports": {"api": 8600},
     "log": "oasis.log", "start": None, "stop": None,
     "purpose": "Avatar registry and humanitarian impact tracking.",
     "child_says": "🪷 A garden where your ZION avatar lives and helps the world!",
     "depends_on": ["node1"]},

    # ── L5: Free World Humanitarian ──────────────────────────────────────
    {"id": "free-world", "name": "Free World Humanitarian", "icon": "🕊️", "level": "L5", "kind": "humanitarian",
     "ports": {"api": 8095},
     "log": "free-world.log", "start": None, "stop": None,
     "purpose": "Humanitarian aid coordination — mesh networks, medical tables, community DAOs.",
     "child_says": "🕊️ Helps people in need through decentralized aid and community support!",
     "depends_on": ["node1"]},

    # ── L6: Issobella Space ──────────────────────────────────────────────
    {"id": "issobella", "name": "Issobella Space Layer", "icon": "🚀", "level": "L6", "kind": "space",
     "ports": {"api": 8096},
     "log": "issobella.log", "start": None, "stop": None,
     "purpose": "Space infrastructure coordination — satellite relay, off-world settlements, orbital DAOs.",
     "child_says": "🚀 Takes ZION beyond Earth — to the stars and beyond!",
     "depends_on": ["node1"]},

    # ── Infrastructure ───────────────────────────────────────────────────
    {"id": "prometheus", "name": "Prometheus", "icon": "📊", "level": "Infra", "kind": "metrics",
     "ports": {"web": 9090},
     "log": None, "start": "start-prometheus", "stop": None,
     "purpose": "Collects and stores metrics from all services (every 15s).",
     "child_says": "📊 A super-memory that remembers all the numbers!",
     "depends_on": []},
    {"id": "grafana", "name": "Grafana", "icon": "📈", "level": "Infra", "kind": "dashboards",
     "ports": {"web": 3000},
     "log": None, "start": "start-grafana", "stop": None,
     "purpose": "Beautiful charts and dashboards for Prometheus metrics.",
     "child_says": "📈 Pretty pictures showing how everything is doing!",
     "depends_on": ["prometheus"]},
]

def get_service(sid: str) -> dict:
    return next((s for s in SERVICE_REGISTRY if s["id"] == sid), None)

# ── Health checks ───────────────────────────────────────────────────────

import socket
import urllib.request as _urlreq
HEALTH_CACHE = {}  # id -> {"alive": bool, "ts": int, "details": str}
HEALTH_TTL = 5  # seconds

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

def check_service_health(svc: dict) -> dict:
    sid = svc["id"]
    cached = HEALTH_CACHE.get(sid)
    now = int(time.time())
    if cached and now - cached["ts"] < HEALTH_TTL:
        return cached

    ports = svc.get("ports", {})
    if not ports:
        # No ports → infer from log file activity
        if svc.get("log"):
            path = LOG_DIR / svc["log"]
            if path.exists():
                mtime_age = now - int(path.stat().st_mtime)
                alive = mtime_age < 60
                result = {"alive": alive, "ts": now,
                          "details": f"log mtime {mtime_age}s ago",
                          "ports_open": [], "ports_closed": []}
            else:
                result = {"alive": False, "ts": now, "details": "no log file",
                          "ports_open": [], "ports_closed": []}
        else:
            result = {"alive": False, "ts": now, "details": "no ports & no log",
                      "ports_open": [], "ports_closed": []}
        HEALTH_CACHE[sid] = result
        return result

    open_ports = []
    closed_ports = []
    host = svc.get("host", "127.0.0.1")
    timeout = 1.5 if host != "127.0.0.1" else 0.15
    for name, port in ports.items():
        if tcp_probe(host, port, timeout):
            open_ports.append(f"{name}:{port}@{host}")
        else:
            closed_ports.append(f"{name}:{port}@{host}")

    alive = len(open_ports) > 0
    result = {"alive": alive, "ts": now,
              "details": f"{len(open_ports)}/{len(ports)} ports open",
              "ports_open": open_ports, "ports_closed": closed_ports}
    HEALTH_CACHE[sid] = result
    return result

def all_services_health() -> list:
    out = []
    for svc in SERVICE_REGISTRY:
        h = check_service_health(svc)
        out.append({
            "id": svc["id"], "name": svc["name"], "icon": svc["icon"],
            "level": svc["level"], "kind": svc["kind"],
            "purpose": svc["purpose"], "child_says": svc["child_says"],
            "ports": svc["ports"], "depends_on": svc["depends_on"],
            "log": svc["log"], "start": svc["start"],
            "alive": h["alive"], "details": h["details"],
            "ports_open": h["ports_open"], "ports_closed": h["ports_closed"],
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

def parse_node_log(name: str) -> dict:
    recent = tail_log(f"{name}.log", 200)
    startup = head_log(f"{name}.log", 50)
    status = {
        "name": name,
        "running": bool(recent),
        "node_id": None,
        "p2p_bind": None,
        "rpc_bind": None,
        "chain_height": None,
        "tip_hash": None,
        "known_peers": 0,
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

        # Node 2 / follower format: relay_block height=... hash=...
        if m := re.search(r'relay_block height=(\d+)', line):
            h = int(m.group(1))
            if status["chain_height"] is None or h > status["chain_height"]:
                status["chain_height"] = h
        if m := re.search(r'outbound_sync.*our_height=(\d+)', line):
            h = int(m.group(1))
            if status["chain_height"] is None or h > status["chain_height"]:
                status["chain_height"] = h

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
        if m := re.search(r'pool_wallet=(\S+)', line):
            status["pool_wallet"] = m.group(1)
        if "payout_execution=enabled" in line:
            status["payout_enabled"] = True
        if "payout_execution=disabled" in line:
            status["payout_enabled"] = False
        if m := re.search(r'fee_split: miners=(\d+)% humanitarian=(\d+)% issobella=(\d+)% pool_fee=(\d+)%', line):
            status["fee_split"] = f"{m.group(1)}/{m.group(2)}/{m.group(3)}/{m.group(4)}"
    for line in recent:
        if m := re.search(r'BLOCK_FOUND.*height=(\d+)', line):
            status["blocks_found"] += 1
        if m := re.search(r'share_status=Accepted', line):
            status["shares_accepted"] += 1
        if m := re.search(r'share_status=Rejected', line):
            status["shares_rejected"] += 1
        if m := re.search(r'session_start.*active_sessions=(\d+)', line):
            status["active_sessions"] = int(m.group(1))
        if any(k in line for k in ("payout_submitted", "payout_submit_failed", "pplns_rollback", "fee_payout_submitted")):
            status["recent_payouts"].append(line[:200])
    status["recent_payouts"] = status["recent_payouts"][-5:]
    return status

def parse_miner_log() -> dict:
    recent = tail_log("miner.log", 200)
    startup = head_log("miner.log", 50)
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
    for line in recent:
        if m := re.search(r'gpu_backend=(\S+)', line):
            status["gpu_backend"] = m.group(1)
        if m := re.search(r'speed\s+\d+s/\d+s/\d+m\s+(\d+\.\d+)', line):
            status["hashrate"] = float(m.group(1))
        if m := re.search(r'accepted\s+(\d+)/(\d+)', line):
            status["shares_accepted"] = int(m.group(1))
            status["shares_rejected"] = int(m.group(2))
        if m := re.search(r'height=(\d+)', line):
            status["current_height"] = int(m.group(1))
        if m := re.search(r'diff\s+(\d+)', line):
            status["current_diff"] = int(m.group(1))
    return status

def build_status() -> dict:
    # Edge pool health from cache (remote host probe)
    pool_edge_svc = get_service("pool-edge")
    pool_edge_health = check_service_health(pool_edge_svc) if pool_edge_svc else {"alive": False}
    return {
        "timestamp": datetime.now().isoformat(),
        "node1": parse_node_log("node1"),
        "node2": parse_node_log("node2"),
        "pool": parse_pool_log(),
        "pool_edge": {
            "running": pool_edge_health["alive"],
            "host": pool_edge_svc.get("host", "") if pool_edge_svc else "",
            "ports_open": pool_edge_health.get("ports_open", []),
        },
        "miner": parse_miner_log(),
    }

def build_checklist(status: dict) -> dict:
    checks = [
        {"id": "keys",      "label": "Offline key generation complete",         "ok": True},
        {"id": "env",       "label": "Env file assembled (.env.mainnet)",       "ok": True},
        {"id": "node1",     "label": "Node 1 running & P2P bound",              "ok": status["node1"]["running"] and status["node1"]["p2p_bind"] is not None},
        {"id": "node2",     "label": "Node 2 running & synced to Node 1",     "ok": status["node2"]["running"] and status["node2"]["known_peers"] > 0},
        {"id": "pool",      "label": "Core Pool running & accepting miners",    "ok": status["pool"]["running"] and status["pool"]["bind_addr"] is not None},
        {"id": "pool-edge", "label": "Edge Pool reachable from Core",           "ok": status.get("pool_edge", {}).get("running", False)},
        {"id": "miner",     "label": "GPU miner connected & hashing",         "ok": status["miner"]["running"] and status["miner"]["hashrate"] is not None},
        {"id": "chain",     "label": "Chain height advancing",                 "ok": status["node1"]["chain_height"] is not None and status["node1"]["chain_height"] > 0},
        {"id": "payout",    "label": "Payout mechanism ready (UTXOs funded)",    "ok": status["pool"]["payout_enabled"] is True and status["pool"]["pool_wallet"] is not None},
        {"id": "fee_split", "label": "Fee split 89/5/5/1 active",                "ok": status["pool"]["fee_split"] == "89/5/5/1"},
        {"id": "logs",      "label": "Log directory writable",                  "ok": LOG_DIR.exists()},
    ]
    total = len(checks)
    passed = sum(1 for c in checks if c["ok"])
    return {"checks": checks, "passed": passed, "total": total, "pct": round(100*passed/total, 1)}

# ── Alerts & recommendations ────────────────────────────────────────────

def build_alerts(status: dict) -> list:
    """Auto-detect common issues and produce actionable alerts."""
    alerts = []
    n1, n2, pool, miner = status["node1"], status["node2"], status["pool"], status["miner"]

    if not n1["running"]:
        alerts.append({"severity": "critical", "title": "Node 1 not running",
                       "detail": "Logs/node1.log is empty or missing. Start Node 1 from controls.",
                       "action": "start-node1"})
    elif n1["chain_height"] == 0:
        alerts.append({"severity": "warning", "title": "Chain stuck at height 0",
                       "detail": "Node 1 is up but no blocks have been mined yet.",
                       "action": None})

    if n1["running"] and n2["running"] and n1["chain_height"] and n2["chain_height"]:
        if abs(n1["chain_height"] - n2["chain_height"]) > 5:
            alerts.append({"severity": "warning", "title": "Nodes out of sync",
                           "detail": f"Node1@{n1['chain_height']} vs Node2@{n2['chain_height']} — gap {abs(n1['chain_height']-n2['chain_height'])}",
                           "action": "restart-node2"})

    if pool["running"] and pool["fee_split"] and pool["fee_split"] != "89/5/5/1":
        alerts.append({"severity": "critical", "title": "Wrong fee split",
                       "detail": f"Detected {pool['fee_split']}, mainnet must be 89/5/5/1",
                       "action": None})

    if pool["running"] and pool["payout_enabled"] is False:
        alerts.append({"severity": "warning", "title": "Payouts disabled",
                       "detail": "Pool is running but payout_execution=disabled. Set ZION_POOL_PAYOUT_SK_HEX.",
                       "action": None})

    if pool["running"] and pool["nonce_count"] and pool["nonce_count"] < 4096:
        alerts.append({"severity": "info", "title": "Low GPU nonce window",
                       "detail": f"ZION_NONCE_COUNT={pool['nonce_count']} is small. Raise to 4096 for better GPU utilisation.",
                       "action": None})

    if miner["running"] and not miner["hashrate"]:
        alerts.append({"severity": "warning", "title": "Miner not hashing",
                       "detail": "Miner is connected but no hashrate samples in recent logs. Check GPU init.",
                       "action": "restart-miner"})

    if miner["running"] and miner["hashrate"] and miner["hashrate"] < 1.0:
        alerts.append({"severity": "info", "title": "Low hashrate",
                       "detail": f"Hashrate {miner['hashrate']} KH/s seems low. Expected ~6-10 KH/s on RDNA1.",
                       "action": None})

    if pool["running"] and pool["shares_rejected"] > 0 and pool["shares_accepted"]:
        ratio = pool["shares_rejected"] / max(1, pool["shares_accepted"])
        if ratio > 0.05:
            alerts.append({"severity": "warning", "title": "High share rejection rate",
                           "detail": f"{pool['shares_rejected']} rejected vs {pool['shares_accepted']} accepted ({ratio*100:.1f}%)",
                           "action": None})

    if n1.get("last_error"):
        alerts.append({"severity": "info", "title": "Node1 error in logs",
                       "detail": n1["last_error"], "action": None})

    if not alerts:
        alerts.append({"severity": "success", "title": "All systems nominal",
                       "detail": "No issues detected. Stack is ready for mainnet operations.",
                       "action": None})

    return alerts

# ── Block events feed (parsed from logs) ────────────────────────────────

def scan_block_events():
    """Scan logs for newly discovered blocks and push to event feed."""
    global BLOCK_EVENTS, LAST_BLOCK_EVENT_TIME
    for name in ("node1", "node2"):
        lines = tail_log(f"{name}.log", 500)
        for line in lines:
            if m := re.search(r'relay_block height=(\d+) hash=([a-f0-9…]+)', line):
                key = f"{name}-{m.group(1)}-{m.group(2)}"
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
    """Simple TCP JSON-RPC call to ZION node. Returns result dict or None on failure."""
    try:
        payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}) + "\n"
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.sendall(payload.encode("utf-8"))
            sock.settimeout(timeout)
            data = b""
            while True:
                try:
                    chunk = sock.recv(4096)
                    if not chunk:
                        break
                    data += chunk
                    if b"\n" in data:
                        break
                except socket.timeout:
                    break
        for line in data.decode("utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                resp = json.loads(line)
                if "result" in resp:
                    return resp["result"]
                if "error" in resp and resp["error"]:
                    return {"_rpc_error": resp["error"]}
            except json.JSONDecodeError:
                continue
        return None
    except Exception:
        return None

def parse_premine_from_genesis(rpc_host: str = "127.0.0.1", rpc_port: int = 8443) -> list:
    """Extract premine addresses and amounts from the actual genesis block via RPC.
    This reflects the true on-chain state, which may differ from PREMINE_ADDRESSES_PUBLIC.txt
    after wallet rotation."""
    wallets = []
    genesis = rpc_call(rpc_host, rpc_port, "getBlockByHeight", {"height": 0})
    if not genesis or not genesis.get("transactions"):
        # Fallback to file if RPC unavailable
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
        "Genesis Creator — Lifetime Rent",
        "Children Future Fund — Humanitarian DAO",
    ]
    for i, tx in enumerate(genesis.get("transactions", [])):
        addr = tx.get("to", "")
        amount = int(tx.get("amount_zion", 0))
        wallets.append({
            "index": i + 1,
            "address": addr,
            "label": labels[i] if i < len(labels) else f"Premine Output {i+1}",
            "amount_zion": amount / 1_000_000_000_000,  # flowers -> ZION
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
    op_sources = [
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

    # 4. Try to enrich with live balances from Node 1 RPC
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

    for w in wallets:
        addr = w.get("address", "")
        if addr and addr.startswith("zion1"):
            bal = rpc_call(rpc_host, rpc_port, "getBalance", {"address": addr})
            if bal and not bal.get("_rpc_error"):
                atomic = int(bal.get("balance_flowers") or bal.get("balance_atomic") or 0)
                w["balance_zion"] = bal.get("balance_zion") if isinstance(bal.get("balance_zion"), (int, float)) else atomic / 1_000_000_000_000
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
        "rpc": {"host": rpc_host, "port": rpc_port, "reachable": len(with_balance) > 0 and with_balance[0].get("rpc_ok")},
    }

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
    total_premine = 16_280_000_000
    circulating_estimate = total_premine + estimated_mined

    return {
        "rpc_reachable": info is not None,
        "network": info.get("network", "unknown") if info else "unknown",
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
    }

# ── Mainnet constants & genesis (from V3/L1/core/src/{emission,genesis,fee}.rs) ──

MAINNET_CONSTANTS = {
    "supply": {
        "total_zion": 144_000_000_000,
        "genesis_premine_zion": 16_280_000_000,
        "mining_emission_zion": 127_720_000_000,
        "flowers_per_zion": 1_000_000_000_000,
    },
    "block": {
        "time_seconds": 60,
        "blocks_per_year": 525_600,
        "blocks_per_decade": 5_256_000,
        "base_reward_zion": 5400.067,
        "tail_reward_zion": 724.784723787776,
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
        "dao": "zion1dao00000000000000000000000000000treasury",
        "bridge_vault": "zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0",
    },
}

PREMINE_OUTPUTS = [
    # OASIS + Golden Egg (5 slots × 1.65B = 8.25B)
    {"address": "zion166e6v3k204h8p5w4w3a7m0x790q5m7z5z6n252p", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 1)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion1l2h8h0e3h7m6p8e297m6n624c5m7r2k364v684a", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 2)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion1e6r0q3g6t0r0v5f6h7k7c5f3v562j0v7e5e5d0a", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 3)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion1l7e4c4c5x8l440t295a7m4k5p5x8v8z7r043s23", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 4)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    {"address": "zion1n8h2a8p386z274859833h7v6c5n687f7a6k523u", "purpose": "ZION OASIS + Winners Golden Egg/Xp (Slot 5)", "amount_zion": 1_650_000_000, "category": "oasis_golden_egg", "unlock_height": None},
    # DAO Treasury (3 slots = 4.0B) — locked until block 525,600
    {"address": "zion176u8r6w53768e2k04035d4d3c2z5g555n6l4r3s", "purpose": "DAO Treasury — Community Governance (main)", "amount_zion": 2_500_000_000, "category": "dao_treasury", "unlock_height": 525_600},
    {"address": "zion12643n776r3m8f340484756q06485h5w4c2l405m", "purpose": "DAO Treasury — Grants & Bounties", "amount_zion": 1_000_000_000, "category": "dao_treasury", "unlock_height": 525_600},
    {"address": "zion1k8w734x422f3t6t536r287k2c6n3z0e05257606", "purpose": "DAO Treasury — Ecosystem Bootstrap", "amount_zion": 500_000_000, "category": "dao_treasury", "unlock_height": 525_600},
    # Infrastructure (3 slots = 2.59B)
    {"address": "zion1q540v6y4f0s4v3n0f8t740t53494z56024u645c", "purpose": "Core Development Fund", "amount_zion": 1_000_000_000, "category": "infrastructure", "unlock_height": None},
    {"address": "zion1h4w39686t8w376g0x0y426e775q6p2q0v698v43", "purpose": "Network Infrastructure — P2P Seed Nodes", "amount_zion": 1_000_000_000, "category": "infrastructure", "unlock_height": None},
    {"address": "zion1x638z5x6d2d0y6u3f7y8g7j56054a4a2a2c7l8f", "purpose": "Genesis Creator — Lifetime Rent", "amount_zion": 590_000_000, "category": "infrastructure", "unlock_height": None},
    # Humanitarian (1 slot = 1.44B)
    {"address": "zion1m4v5z8z850u480c5c208z274e334369275n5y20", "purpose": "Children Future Fund — Humanitarian DAO", "amount_zion": 1_440_000_000, "category": "humanitarian", "unlock_height": None},
]

P0_BLOCKERS = [
    {"id": 1, "title": "Bridge validator 3/5 multisig", "owner": "Security / Ops", "deadline": "T-7", "status": "OPEN", "severity": "critical",
     "detail": "Placeholder addresses 0x0000…0001–0005 in V3/L2/bridge/config/bridge-mainnet.toml. Need 5 real secp256k1 addresses on separate HSM hosts."},
    {"id": 2, "title": "Ankr API key (premium tier)", "owner": "Ops", "deadline": "T-7", "status": "OPEN", "severity": "critical",
     "detail": "bridge-mainnet.toml line 28: api_key=\"\". Requires premium Ankr account for EVM watcher reliability."},
    {"id": 3, "title": "Seed peer bootstrap mesh", "owner": "Ops", "deadline": "T-3", "status": "OPEN", "severity": "critical",
     "detail": "Helsinki must come online first as seed; US/SG/Prague need P2P mesh verification."},
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

_ALLOW_BASE = {
    "install-deps":      "install-deps",
    "launch-stack":      "launch-stack",
    "stop-stack":        "stop-stack",
    "stop-all":          "stop-all",
    "start-node1":       "start-node",
    "start-node2":       "start-node2",
    "start-pool":        "start-pool",
    "start-miner":       "start-miner",
    "restart-node2":     "start-node2",
    "restart-miner":     "start-miner",
    "backup-chain":      "backup-chain",
    "verify-chain":      "verify-chain",
    "core-util":         "core-util-run",
}

# Windows-only extras
if os.name == "nt":
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

def run_control(action: str) -> dict:
    """Execute an allowed control script in the background (cross-platform)."""
    if action not in ALLOWED_ACTIONS:
        return {"ok": False, "error": f"Unknown action '{action}'. Allowed: {sorted(ALLOWED_ACTIONS)}"}
    script = SCRIPTS_DIR / ALLOWED_ACTIONS[action]
    if not script.exists():
        return {"ok": False, "error": f"Script not found: {script}"}
    try:
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
            )
        else:
            # Linux/macOS: bash + nohup so the script survives SIGHUP
            proc = subprocess.Popen(
                ["bash", str(script)],
                cwd=str(REPO_ROOT),
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
                close_fds=True,
                preexec_fn=os.setsid if hasattr(os, "setsid") else None,
            )
        _log_control(f"dispatched action={action} script={script} pid={proc.pid}")
        return {"ok": True, "action": action, "script": str(script), "pid": proc.pid}
    except Exception as e:
        _log_control(f"FAILED action={action} error={e}")
        return {"ok": False, "error": str(e), "action": action}

# ── Background sampler ──────────────────────────────────────────────────

def background_sampler():
    """Periodically polls status, records history, scans for block events, warms health cache."""
    while True:
        try:
            st = build_status()
            HISTORY.record(st)
            scan_block_events()
            # Pre-warm health cache for all services in parallel
            for svc in SERVICE_REGISTRY:
                HEALTH_CACHE.pop(svc["id"], None)  # invalidate
                check_service_health(svc)
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
      <div id="card-node1" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
        <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">🔷 Node 1 (Genesis)</span><span id="badge-node1" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
        <div class="text-3xl font-bold mb-1 text-amber-400" id="val-node1-height">—</div><div class="text-xs text-gray-400 mb-2">Chain Height</div>
        <div class="text-xs font-mono text-gray-300 truncate mb-1" id="val-node1-id">—</div>
        <div class="text-xs text-gray-400 mb-1">Peers: <span id="val-node1-peers" class="text-white font-bold">—</span></div>
        <div class="text-xs text-gray-400 mb-2">P2P: <span id="val-node1-p2p" class="font-mono">—</span></div>
        <div class="flex gap-1 mt-2">
          <button onclick="controlAction('start-node1')" class="flex-1 text-xs px-2 py-1 bg-emerald-700 hover:bg-emerald-600 rounded transition">▶ Start</button>
          <button onclick="copyToClipboard('zion node1')" class="text-xs px-2 py-1 bg-zion-700 hover:bg-zion-600 rounded transition">📋</button>
        </div>
      </div>

      <div id="card-node2" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
        <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">🔶 Node 2 (Follower)</span><span id="badge-node2" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
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
        <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">⚡ Pool</span><span id="badge-pool" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
        <div class="text-3xl font-bold mb-1 text-emerald-400" id="val-pool-sessions">—</div><div class="text-xs text-gray-400 mb-2">Active Sessions</div>
        <div class="text-xs text-gray-400 mb-1">Blocks: <span id="val-pool-blocks" class="text-emerald-400 font-bold">—</span></div>
        <div class="text-xs text-gray-400 mb-1">Shares: <span id="val-pool-shares" class="text-white">—</span></div>
        <div class="text-xs text-amber-400 mb-2" id="val-pool-fee">—</div>
        <div class="flex gap-1 mt-2">
          <button onclick="controlAction('start-pool')" class="flex-1 text-xs px-2 py-1 bg-emerald-700 hover:bg-emerald-600 rounded transition">▶ Start</button>
        </div>
      </div>

      <div id="card-pool-edge" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
        <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">🌐 Edge Pool</span><span id="badge-pool-edge" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
        <div class="text-3xl font-bold mb-1 text-emerald-400" id="val-pool-edge-status">—</div><div class="text-xs text-gray-400 mb-2">Reachable</div>
        <div class="text-xs text-gray-400 mb-1">Host: <span id="val-pool-edge-host" class="text-white font-mono">—</span></div>
        <div class="text-xs text-gray-400 mb-1">Port: <span id="val-pool-edge-port" class="text-white">—</span></div>
        <div class="text-xs text-amber-400 mb-2" id="val-pool-edge-detail">—</div>
        <div class="flex gap-1 mt-2">
          <button onclick="window.open('http://77.42.71.94:8444','_blank')" class="flex-1 text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded transition">🔗 Public</button>
        </div>
      </div>

      <div id="card-miner" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
        <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">⛏️ GPU Miner</span><span id="badge-miner" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
        <div class="text-3xl font-bold mb-1 text-amber-400" id="val-miner-hashrate">—</div><div class="text-xs text-gray-400 mb-2">KH/s (10s avg)</div>
        <div class="text-xs text-gray-400 mb-1">Device: <span id="val-miner-gpu" class="text-white text-[10px]">—</span></div>
        <div class="text-xs text-gray-400 mb-1">Height: <span id="val-miner-height" class="text-white">—</span></div>
        <div class="text-xs text-gray-400 mb-2">Diff: <span id="val-miner-diff">—</span></div>
        <div class="flex gap-1 mt-2">
          <button onclick="controlAction('start-miner')" class="flex-1 text-xs px-2 py-1 bg-emerald-700 hover:bg-emerald-600 rounded transition">▶ Start</button>
          <button onclick="controlAction('restart-miner')" class="flex-1 text-xs px-2 py-1 bg-amber-700 hover:bg-amber-600 rounded transition">⟳ Restart</button>
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
        <button onclick="controlAction('launch-stack')" class="group p-6 bg-gradient-to-br from-emerald-700 to-emerald-900 hover:from-emerald-600 hover:to-emerald-800 rounded-xl text-left transition shadow-lg">
          <div class="text-3xl mb-2">🚀</div>
          <div class="text-lg font-bold mb-1">Launch Full Stack</div>
          <div class="text-xs text-emerald-200 opacity-80">Starts Node1 + Node2 + Pool + Miner with logging</div>
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
        <h2 class="text-lg font-bold flex items-center gap-2">🚀 Launch Day Automation <span class="text-xs font-normal text-gray-500">(20.6.2026 12:00 UTC)</span></h2>
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
          <h3 class="text-sm font-bold uppercase tracking-wider text-gray-300">Grafana Dashboard</h3>
          <div class="flex gap-2">
            <a href="http://127.0.0.1:3000" target="_blank" class="text-xs px-3 py-1 bg-zion-700 hover:bg-zion-600 rounded transition">Open Grafana ↗</a>
            <a href="http://127.0.0.1:9090" target="_blank" class="text-xs px-3 py-1 bg-zion-700 hover:bg-zion-600 rounded transition">Open Prometheus ↗</a>
            <button onclick="controlAction('start-monitoring')" class="text-xs px-3 py-1 bg-emerald-700 hover:bg-emerald-600 rounded transition">▶ Start Monitoring</button>
          </div>
        </div>
        <iframe src="http://127.0.0.1:3000" id="grafana-iframe" class="w-full bg-zion-900 rounded-lg border border-zion-700" style="height:600px" onerror="this.style.display='none'" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
        <div id="grafana-offline" class="hidden text-center text-gray-500 text-sm py-12">
          Grafana not running. Click <button onclick="controlAction('start-monitoring')" class="text-amber-400 underline">▶ Start Monitoring</button> to launch Prometheus + Grafana via Docker.
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
const TABS=['overview','controls','charts','events','env','launch-day','wizard','services','database','metrics','logs'];

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
  const n1=s.node1,n2=s.node2,p=s.pool,m=s.miner;
  setBadge('badge-node1',n1.running);setCardLive('node1',n1.running);
  document.getElementById('val-node1-height').textContent=n1.chain_height??'—';
  document.getElementById('val-node1-id').textContent=n1.node_id??'—';
  document.getElementById('val-node1-peers').textContent=n1.known_peers??'—';
  document.getElementById('val-node1-p2p').textContent=n1.p2p_bind??'—';
  setBadge('badge-node2',n2.running);setCardLive('node2',n2.running);
  document.getElementById('val-node2-height').textContent=n2.chain_height??'—';
  document.getElementById('val-node2-id').textContent=n2.node_id??'—';
  document.getElementById('val-node2-peers').textContent=n2.known_peers??'—';
  const synced=n2.chain_height&&n1.chain_height&&n2.chain_height>=n1.chain_height-1;
  const syncEl=document.getElementById('val-node2-sync');
  syncEl.textContent=synced?'✓ Synced':(n2.known_peers>0?'Syncing…':'No peers');
  syncEl.className=synced?'text-emerald-400 font-bold':'text-amber-400';
  setBadge('badge-pool',p.running);setCardLive('pool',p.running);
  document.getElementById('val-pool-sessions').textContent=p.active_sessions??'0';
  document.getElementById('val-pool-blocks').textContent=p.blocks_found??'0';
  document.getElementById('val-pool-shares').textContent=(p.shares_accepted??0)+' / '+(p.shares_rejected??0);
  document.getElementById('val-pool-fee').textContent=p.fee_split?'Split: '+p.fee_split:'—';
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
      {label:'Node Status',value:(res.node1_running?'N1✓':'N1✗')+' '+(res.node2_running?'N2✓':'N2✗'),ok:res.node1_running&&res.node2_running,icon:'🔶'},
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
  const steps=[
    {n:1,title:'Prepare environment',desc:'Generate keys (gen-keys), assemble .env file with all wallets and ZION_POOL_PAYOUT_SK_HEX.',done:cl.checks.find(c=>c.id==='env').ok,actions:[{label:'View env files',cb:`switchTab('env')`}]},
    {n:2,title:'Start Node 1 (Genesis)',desc:'Brings up the source-of-truth node at 0.0.0.0:8333 (P2P) / 0.0.0.0:8443 (RPC).',done:cl.checks.find(c=>c.id==='node1').ok,actions:[{label:'▶ Start Node 1',cb:`controlAction('start-node1')`}]},
    {n:3,title:'Start Node 2 (Follower)',desc:'Connects to Node1 as a peer, validates P2P handshake & block sync.',done:cl.checks.find(c=>c.id==='node2').ok,actions:[{label:'▶ Start Node 2',cb:`controlAction('start-node2')`}]},
    {n:4,title:'Start Pool',desc:'Pulls templates from Node1 RPC, accepts miner sessions on 0.0.0.0:8444.',done:cl.checks.find(c=>c.id==='pool').ok,actions:[{label:'▶ Start Pool',cb:`controlAction('start-pool')`}]},
    {n:5,title:'Start GPU Miner',desc:'Connects to pool, performs cosmic_harmony hashing on GPU.',done:cl.checks.find(c=>c.id==='miner').ok,actions:[{label:'▶ Start Miner',cb:`controlAction('start-miner')`}]},
    {n:6,title:'Verify chain progression',desc:'Confirm chain height advances and blocks propagate to Node 2.',done:cl.checks.find(c=>c.id==='chain').ok,actions:[{label:'View events',cb:`switchTab('events')`}]},
    {n:7,title:'Confirm fee split & payouts',desc:'Validate 89/5/5/1 distribution and payout wallet is funded.',done:cl.checks.find(c=>c.id==='fee_split').ok&&cl.checks.find(c=>c.id==='payout').ok,actions:[{label:'View payouts',cb:`switchTab('overview')`}]},
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
  const icons={'start-node1':'🔷','start-node2':'🔶','start-pool':'⚡','start-miner':'⛏️','restart-node2':'⟳ 🔶','restart-miner':'⟳ ⛏️','launch-stack':'🚀','stop-stack':'⏹️'};
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

// ── Logs ──
async function loadLogs(service){
  try{const res=await fetch('/api/logs/'+service);const data=await res.json();
    const el=document.getElementById('log-'+service);
    if(el)el.textContent=data.lines.slice(-50).join('\\n');
  }catch(e){console.error(e);}
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

# ── HTTP Handler ────────────────────────────────────────────────────────

class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # suppress default request logging
        pass

    def _json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, html, status=200):
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        if route == "/" or route == "/index.html":
            # Prefer external dashboard.html if it exists (new design)
            html_path = SCRIPT_DIR / "dashboard.html"
            if html_path.exists():
                self._html(html_path.read_text(encoding="utf-8"))
            else:
                self._html(HTML_DASHBOARD)
        elif route == "/dashboard.js":
            js_path = SCRIPT_DIR / "dashboard.js"
            if js_path.exists():
                body = js_path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_error(404)
        elif route == "/api/status":
            self._json(build_status())
        elif route == "/api/checklist":
            self._json(build_checklist(build_status()))
        elif route == "/api/alerts":
            self._json({"alerts": build_alerts(build_status())})
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
            self._json({"actions": sorted(ALLOWED_ACTIONS.keys())})
        elif route == "/api/services":
            self._json({"services": all_services_health()})
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
                if genesis and genesis.get("hash"):
                    genesis_hash = genesis["hash"]
            except Exception:
                genesis_hash = "Unknown"
            
            # Get canonical fee split addresses
            canonical_addresses = {
                "miner": "zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3",
                "humanitarian": "zion1m4v5z8z850u480c5c208z274e334369275n5y20",
                "issobella": "zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702",
                "pool_fee": "zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5"
            }
            
            # Get node addresses from logs
            node_addresses = parse_node_startup_addresses()
            
            # Verify fee split addresses match canonical
            fee_split_match = {
                "miner": node_addresses.get("miner") == canonical_addresses["miner"],
                "humanitarian": node_addresses.get("humanitarian") == canonical_addresses["humanitarian"],
                "issobella": node_addresses.get("issobella") == canonical_addresses["issobella"],
                "pool_fee": node_addresses.get("pool_fee") == canonical_addresses["pool_fee"]
            }
            
            # Launch countdown (20.6.2026 12:00 UTC)
            launch_date = datetime(2026, 6, 20, 12, 0, 0)
            now = datetime.now()
            days_to_launch = (launch_date - now).days if launch_date > now else 0
            is_launch_day = (launch_date.date() == now.date())
            
            # Git status
            git_status = {"clean": True, "branch": "main"}
            try:
                import subprocess
                result = subprocess.run(["git", "status", "--porcelain"], 
                                      cwd=REPO_ROOT, capture_output=True, text=True, timeout=5)
                git_status["clean"] = len(result.stdout.strip()) == 0
                result = subprocess.run(["git", "branch", "--show-current"], 
                                      cwd=REPO_ROOT, capture_output=True, text=True, timeout=5)
                git_status["branch"] = result.stdout.strip()
            except Exception:
                pass
            
            self._json({
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
                "node2_height": status["node2"]["chain_height"],
                "node1_running": status["node1"]["running"],
                "node2_running": status["node2"]["running"],
                "pool_running": status["pool"]["running"],
                "miner_running": status["miner"]["running"],
                "git_status": git_status,
                "ready_for_launch": all([
                    genesis_hash == "003529805e9b47babb9ac0f26b27b1aad0a1cf3c483181857daf3269f7088923",
                    all(fee_split_match.values()),
                    status["node1"]["running"],
                    status["node2"]["running"],
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
            mapping = {"node1": "node1.log", "node2": "node2.log", "pool": "pool.log", "miner": "miner.log"}
            filename = mapping.get(service, f"{service}.log")
            self._json({"lines": tail_log(filename, 200)})
        elif route == "/api/install/log":
            install_log = LOG_DIR / "install-deps.log"
            lines = []
            if install_log.exists():
                with open(install_log, "r", encoding="utf-8", errors="ignore") as f:
                    lines = [ln.rstrip("\n") for ln in f.readlines()[-200:]]
            self._json({"lines": lines, "file": str(install_log)})
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
        else:
            self.send_error(404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b""
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            payload = {}

        if route == "/api/control":
            action = payload.get("action", "")
            self._json(run_control(action))
        elif route == "/api/backup/create":
            name = payload.get("name", "").strip()
            include_logs = payload.get("includeLogs", False)
            include_env = payload.get("includeEnv", False)
            script = SCRIPTS_DIR / ("backup-chain" + _SCRIPT_EXT)
            args = ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", str(script)]
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
                    ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", str(script), "-BackupName", name],
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
                    ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", str(script), "-Cmd", cmd],
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
                    ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", str(script), "-Cmd", "node status"],
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
                    ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", str(script), "-Cmd", "status"],
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
                    ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", str(script), "-Cmd", full_cmd],
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
        else:
            self.send_error(404)

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
    print("  Press Ctrl+C to stop")
    print("=" * 60)
    # Start background sampler (history + block events)
    sampler_thread = threading.Thread(target=background_sampler, daemon=True)
    sampler_thread.start()

    open_browser()
    server = ThreadingHTTPServer((HOST, PORT), DashboardHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopping dashboard server...")
        server.shutdown()
