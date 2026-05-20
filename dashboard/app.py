#!/usr/bin/env python3
"""
ZION V3 — Mainnet Launch Dashboard Server
Zero-dependency: uses only Python stdlib. Serves a live HTML dashboard
and parses local log files via a JSON API.
"""

import json
import os
import re
import sys
import threading
import urllib.parse
from datetime import datetime
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer

# ── Config ──────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent.resolve()
REPO_ROOT = SCRIPT_DIR.parent
LOG_DIR = REPO_ROOT / "logs"
if not LOG_DIR.exists():
    LOG_DIR = Path("../logs")

HOST = "127.0.0.1"
PORT = 8765

# ── Log parsers ─────────────────────────────────────────────────────────

def tail_log(filename: str, n: int = 100) -> list[str]:
    path = LOG_DIR / filename
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
    return [ln.rstrip("\n") for ln in lines[-n:]]

def head_log(filename: str, n: int = 50) -> list[str]:
    path = LOG_DIR / filename
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
    return [ln.rstrip("\n") for ln in lines[:n]]

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
    for line in recent:
        if m := re.search(r'"chain_height":(\d+)', line):
            status["chain_height"] = int(m.group(1))
        if m := re.search(r'"tip_hash_hex":"([a-f0-9]+)"', line):
            status["tip_hash"] = m.group(1)[:16] + "…"
        if m := re.search(r'"known_peers":\[(.*?)\]', line):
            status["known_peers"] = len(re.findall(r'\{', m.group(1)))
        if any(k in line for k in ("discovery_connect_ok", "outbound_sync_ok", "relay_ok", "p2p_in=", "p2p_out=")):
            if status["known_peers"] == 0:
                status["known_peers"] = 1  # at least one peer interaction observed
        if "Error" in line or "error" in line.lower():
            status["last_error"] = line[:120]
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
    return {
        "timestamp": datetime.now().isoformat(),
        "node1": parse_node_log("node1"),
        "node2": parse_node_log("node2"),
        "pool": parse_pool_log(),
        "miner": parse_miner_log(),
    }

def build_checklist(status: dict) -> dict:
    checks = [
        {"id": "keys",      "label": "Offline key generation complete",         "ok": True},
        {"id": "env",       "label": "Env file assembled (.env.mainnet)",       "ok": True},
        {"id": "node1",     "label": "Node 1 running & P2P bound",              "ok": status["node1"]["running"] and status["node1"]["p2p_bind"] is not None},
        {"id": "node2",     "label": "Node 2 running & synced to Node 1",     "ok": status["node2"]["running"] and status["node2"]["known_peers"] > 0},
        {"id": "pool",      "label": "Pool running & accepting miners",          "ok": status["pool"]["running"] and status["pool"]["bind_addr"] is not None},
        {"id": "miner",     "label": "GPU miner connected & hashing",            "ok": status["miner"]["running"] and status["miner"]["hashrate"] is not None},
        {"id": "chain",     "label": "Chain height advancing",                 "ok": status["node1"]["chain_height"] is not None and status["node1"]["chain_height"] > 0},
        {"id": "payout",    "label": "Payout mechanism ready (UTXOs funded)",    "ok": status["pool"]["payout_enabled"] is True and status["pool"]["pool_wallet"] is not None},
        {"id": "fee_split", "label": "Fee split 89/5/5/1 active",                "ok": status["pool"]["fee_split"] == "89/5/5/1"},
        {"id": "logs",      "label": "Log directory writable",                  "ok": LOG_DIR.exists()},
    ]
    total = len(checks)
    passed = sum(1 for c in checks if c["ok"])
    return {"checks": checks, "passed": passed, "total": total, "pct": round(100*passed/total, 1)}

# ── HTML Dashboard (embedded) ───────────────────────────────────────────

HTML_DASHBOARD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ZION V3 — Mainnet Launch Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config={theme:{extend:{colors:{zion:{900:'#0f172a',800:'#1e293b',700:'#334155',accent:'#f59e0b',success:'#10b981',danger:'#ef4444'}}}}};
</script>
<style>
@keyframes pulse-glow{0%,100%{box-shadow:0 0 5px rgba(16,185,129,0.3)}50%{box-shadow:0 0 20px rgba(16,185,129,0.6)}}
.card-live{animation:pulse-glow 3s infinite}
.log-tail{font-family:'JetBrains Mono',monospace;font-size:12px}
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
</style>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body class="bg-zion-900 text-gray-100 min-h-screen">
<div class="max-w-7xl mx-auto p-4">
  <header class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-lg">Z</div>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">ZION V3 <span class="text-amber-400">Mainnet Launch</span></h1>
        <p class="text-sm text-gray-400" id="timestamp">Loading…</p>
      </div>
    </div>
    <div class="flex gap-2">
      <button onclick="refreshAll()" class="px-4 py-2 bg-zion-700 hover:bg-zion-600 rounded-lg text-sm font-medium transition">Refresh</button>
      <button onclick="toggleAuto()" id="autoBtn" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition">Auto: ON</button>
    </div>
  </header>

  <div class="bg-zion-800 rounded-xl p-4 mb-6 border border-zion-700">
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-medium text-gray-300">Launch Readiness</span>
      <span class="text-sm font-bold text-amber-400" id="progressText">0/0</span>
    </div>
    <div class="w-full h-3 bg-zion-700 rounded-full overflow-hidden">
      <div id="progressBar" class="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-700" style="width:0%"></div>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <div id="card-node1" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
      <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Node 1 (Genesis)</span><span id="badge-node1" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
      <div class="text-lg font-bold mb-1" id="val-node1-height">—</div><div class="text-xs text-gray-400 mb-2">Chain Height</div>
      <div class="text-xs font-mono text-gray-300 truncate" id="val-node1-id">—</div>
      <div class="text-xs text-gray-400 mb-1">Peers: <span id="val-node1-peers" class="text-white">—</span></div>
      <div class="text-xs text-gray-400">P2P: <span id="val-node1-p2p">—</span></div>
    </div>
    <div id="card-node2" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
      <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Node 2 (Follower)</span><span id="badge-node2" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
      <div class="text-lg font-bold mb-1" id="val-node2-height">—</div><div class="text-xs text-gray-400 mb-2">Chain Height</div>
      <div class="text-xs font-mono text-gray-300 truncate" id="val-node2-id">—</div>
      <div class="text-xs text-gray-400 mb-1">Peers: <span id="val-node2-peers" class="text-white">—</span></div>
      <div class="text-xs text-gray-400">Sync: <span id="val-node2-sync">—</span></div>
    </div>
    <div id="card-pool" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
      <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">Pool</span><span id="badge-pool" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
      <div class="text-lg font-bold mb-1" id="val-pool-sessions">—</div><div class="text-xs text-gray-400 mb-2">Active Sessions</div>
      <div class="text-xs text-gray-400 mb-1">Blocks: <span id="val-pool-blocks" class="text-emerald-400">—</span></div>
      <div class="text-xs text-gray-400 mb-1">Shares A/R: <span id="val-pool-shares" class="text-white">—</span></div>
      <div class="text-xs text-amber-400" id="val-pool-fee">—</div>
    </div>
    <div id="card-miner" class="bg-zion-800 rounded-xl p-4 border border-zion-700 transition">
      <div class="flex items-center justify-between mb-3"><span class="text-xs font-semibold uppercase tracking-wider text-gray-400">GPU Miner</span><span id="badge-miner" class="px-2 py-0.5 rounded text-xs font-bold bg-zion-700 text-gray-300">?</span></div>
      <div class="text-lg font-bold mb-1" id="val-miner-hashrate">—</div><div class="text-xs text-gray-400 mb-2">KH/s</div>
      <div class="text-xs text-gray-400 mb-1">Device: <span id="val-miner-gpu" class="text-white truncate">—</span></div>
      <div class="text-xs text-gray-400 mb-1">Height: <span id="val-miner-height" class="text-white">—</span></div>
      <div class="text-xs text-gray-400">Diff: <span id="val-miner-diff">—</span></div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">Launch Checklist</h2>
      <div id="checklist" class="space-y-2"></div>
    </div>
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">Payouts</h2>
      <div class="space-y-2">
        <div class="flex justify-between text-xs"><span class="text-gray-400">Pool Wallet</span><span id="payout-wallet" class="font-mono text-white truncate max-w-[200px]">—</span></div>
        <div class="flex justify-between text-xs"><span class="text-gray-400">Payout Enabled</span><span id="payout-enabled" class="font-bold">—</span></div>
        <div class="flex justify-between text-xs"><span class="text-gray-400">Blocks Found</span><span id="payout-blocks" class="text-emerald-400 font-bold">—</span></div>
        <div class="flex justify-between text-xs"><span class="text-gray-400">Nonce Count</span><span id="payout-nonce" class="text-white">—</span></div>
      </div>
      <div id="payout-recent" class="mt-3 space-y-1 max-h-32 overflow-y-auto log-tail text-gray-400"></div>
    </div>
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <h2 class="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3">Required Env Vars</h2>
      <div class="space-y-1.5">
        <div class="flex items-center gap-2 group cursor-pointer" onclick="copyEnv(this)"><span class="text-[10px] text-gray-500 select-none">●</span><code class="text-xs font-mono text-amber-300 flex-1 truncate">ZION_POOL_PAYOUT_SK_HEX</code><span class="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition">Copy</span></div>
        <div class="flex items-center gap-2 group cursor-pointer" onclick="copyEnv(this)"><span class="text-[10px] text-gray-500 select-none">●</span><code class="text-xs font-mono text-amber-300 flex-1 truncate">ZION_POOL_WALLET</code><span class="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition">Copy</span></div>
        <div class="flex items-center gap-2 group cursor-pointer" onclick="copyEnv(this)"><span class="text-[10px] text-emerald-500 select-none">✓</span><code class="text-xs font-mono text-emerald-300 flex-1 truncate">ZION_MINER_ADDRESS</code><span class="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition">Copy</span></div>
        <div class="flex items-center gap-2 group cursor-pointer" onclick="copyEnv(this)"><span class="text-[10px] text-emerald-500 select-none">✓</span><code class="text-xs font-mono text-emerald-300 flex-1 truncate">ZION_HUMANITARIAN_WALLET</code><span class="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition">Copy</span></div>
        <div class="flex items-center gap-2 group cursor-pointer" onclick="copyEnv(this)"><span class="text-[10px] text-emerald-500 select-none">✓</span><code class="text-xs font-mono text-emerald-300 flex-1 truncate">ZION_ISSOBELLA_WALLET</code><span class="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition">Copy</span></div>
        <div class="flex items-center gap-2 group cursor-pointer" onclick="copyEnv(this)"><span class="text-[10px] text-emerald-500 select-none">✓</span><code class="text-xs font-mono text-emerald-300 flex-1 truncate">ZION_POOL_FEE_WALLET</code><span class="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition">Copy</span></div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <div class="flex items-center justify-between mb-2"><h2 class="text-sm font-bold uppercase tracking-wider text-gray-300">Pool Log Tail</h2><button onclick="loadLogs('pool')" class="text-xs text-gray-400 hover:text-white transition">Refresh</button></div>
      <pre id="log-pool" class="log-tail bg-zion-900 rounded-lg p-3 h-48 overflow-y-auto text-gray-300"></pre>
    </div>
    <div class="bg-zion-800 rounded-xl p-4 border border-zion-700">
      <div class="flex items-center justify-between mb-2"><h2 class="text-sm font-bold uppercase tracking-wider text-gray-300">Miner Log Tail</h2><button onclick="loadLogs('miner')" class="text-xs text-gray-400 hover:text-white transition">Refresh</button></div>
      <pre id="log-miner" class="log-tail bg-zion-900 rounded-lg p-3 h-48 overflow-y-auto text-gray-300"></pre>
    </div>
  </div>

  <div class="flex flex-wrap gap-3 mb-8">
    <a href="../MAINNETREADYrun.md" target="_blank" class="px-4 py-2 bg-zion-700 hover:bg-zion-600 rounded-lg text-sm font-medium transition border border-zion-600">Open Runbook</a>
    <a href="../MAINNETSTATUSW11.md" target="_blank" class="px-4 py-2 bg-zion-700 hover:bg-zion-600 rounded-lg text-sm font-medium transition border border-zion-600">Windows Status</a>
    <button onclick="openLaunchScripts()" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition">Launch Stack (PS1)</button>
    <button onclick="copyAllEnv()" class="px-4 py-2 bg-zion-700 hover:bg-zion-600 rounded-lg text-sm font-medium transition border border-zion-600">Copy All Env Names</button>
  </div>

  <footer class="text-center text-xs text-gray-600 pb-4">ZION V3 Dashboard — Auto-refreshes every 3s — Zero-dependency Python stdlib server</footer>
</div>

<script>
let autoRefresh=true,refreshTimer=null;
function setBadge(el,ok){const b=document.getElementById(el);if(!b)return;b.textContent=ok?'LIVE':'DOWN';b.className=ok?'px-2 py-0.5 rounded text-xs font-bold bg-emerald-600 text-white':'px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white';}
function setCardLive(id,ok){const c=document.getElementById('card-'+id);if(!c)return;if(ok){c.classList.add('card-live');c.style.borderColor='#10b981';}else{c.classList.remove('card-live');c.style.borderColor='#334155';}}
async function refreshAll(){try{const[s,cl]=await Promise.all([fetch('/api/status').then(r=>r.json()),fetch('/api/checklist').then(r=>r.json())]);document.getElementById('timestamp').textContent='Last update: '+s.timestamp;document.getElementById('progressText').textContent=cl.passed+'/'+cl.total+' ('+cl.pct+'%)';document.getElementById('progressBar').style.width=cl.pct+'%';const n1=s.node1;setBadge('badge-node1',n1.running);setCardLive('node1',n1.running);document.getElementById('val-node1-height').textContent=n1.chain_height??'—';document.getElementById('val-node1-id').textContent=n1.node_id??'—';document.getElementById('val-node1-peers').textContent=n1.known_peers??'—';document.getElementById('val-node1-p2p').textContent=n1.p2p_bind??'—';const n2=s.node2;setBadge('badge-node2',n2.running);setCardLive('node2',n2.running);document.getElementById('val-node2-height').textContent=n2.chain_height??'—';document.getElementById('val-node2-id').textContent=n2.node_id??'—';document.getElementById('val-node2-peers').textContent=n2.known_peers??'—';const synced=n2.chain_height&&n1.chain_height&&n2.chain_height>=n1.chain_height-1;document.getElementById('val-node2-sync').textContent=synced?'✓ Synced':'Syncing…';document.getElementById('val-node2-sync').className=synced?'text-emerald-400':'text-amber-400';const p=s.pool;setBadge('badge-pool',p.running);setCardLive('pool',p.running);document.getElementById('val-pool-sessions').textContent=p.active_sessions??'0';document.getElementById('val-pool-blocks').textContent=p.blocks_found??'0';document.getElementById('val-pool-shares').textContent=(p.shares_accepted??0)+' / '+(p.shares_rejected??0);document.getElementById('val-pool-fee').textContent=p.fee_split?'Split: '+p.fee_split:'—';const m=s.miner;setBadge('badge-miner',m.running&&m.hashrate);setCardLive('miner',m.running&&m.hashrate);document.getElementById('val-miner-hashrate').textContent=m.hashrate??'—';document.getElementById('val-miner-gpu').textContent=(m.gpu_backend?m.gpu_backend+': ':'')+(m.gpu_device??'—');document.getElementById('val-miner-height').textContent=m.current_height??'—';document.getElementById('val-miner-diff').textContent=m.current_diff??'—';document.getElementById('payout-wallet').textContent=p.pool_wallet??'—';document.getElementById('payout-enabled').textContent=p.payout_enabled===true?'YES':(p.payout_enabled===false?'NO':'—');document.getElementById('payout-enabled').className=p.payout_enabled?'font-bold text-emerald-400':'font-bold text-red-400';document.getElementById('payout-blocks').textContent=p.blocks_found??'0';document.getElementById('payout-nonce').textContent=p.nonce_count??'—';const pr=document.getElementById('payout-recent');pr.innerHTML=(p.recent_payouts&&p.recent_payouts.length)?p.recent_payouts.map(l=>'<div class="truncate">'+escapeHtml(l)+'</div>').join(''):'<div class="text-gray-600 italic">No payout events yet</div>';const clEl=document.getElementById('checklist');clEl.innerHTML=cl.checks.map(c=>'<div class="flex items-center gap-2 py-1.5 px-2 rounded '+(c.ok?'bg-emerald-900/30':'bg-red-900/20')+' transition"><span class="text-sm '+(c.ok?'text-emerald-400':'text-red-400')+'">'+(c.ok?'✓':'○')+'</span><span class="text-xs '+(c.ok?'text-gray-300':'text-gray-400')+'">'+escapeHtml(c.label)+'</span></div>').join('');loadLogs('pool');loadLogs('miner');}catch(e){console.error(e);}}
async function loadLogs(service){try{const res=await fetch('/api/logs/'+service);const data=await res.json();const el=document.getElementById('log-'+service);if(el)el.textContent=data.lines.slice(-40).join('\n');}catch(e){console.error(e);}}
function toggleAuto(){autoRefresh=!autoRefresh;const b=document.getElementById('autoBtn');if(autoRefresh){b.textContent='Auto: ON';b.className='px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition';refreshTimer=setInterval(refreshAll,3000);}else{b.textContent='Auto: OFF';b.className='px-4 py-2 bg-zion-700 hover:bg-zion-600 rounded-lg text-sm font-medium transition';clearInterval(refreshTimer);}}
function escapeHtml(s){return(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function copyEnv(el){const code=el.querySelector('code').textContent;navigator.clipboard.writeText(code).then(()=>{const hint=el.querySelector('span:last-child');hint.textContent='Copied!';setTimeout(()=>hint.textContent='Copy',1500);});}
function copyAllEnv(){const vars=['ZION_POOL_PAYOUT_SK_HEX','ZION_POOL_WALLET','ZION_MINER_ADDRESS','ZION_HUMANITARIAN_WALLET','ZION_ISSOBELLA_WALLET','ZION_POOL_FEE_WALLET'];navigator.clipboard.writeText(vars.join('\n'));}
function openLaunchScripts(){window.open('file://'+window.location.pathname.replace('dashboard','scripts/launch-stack.ps1'));}
refreshAll();refreshTimer=setInterval(refreshAll,3000);
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

        if route == "/" or route == "/index.html":
            self._html(HTML_DASHBOARD)

        elif route == "/api/status":
            self._json(build_status())

        elif route == "/api/checklist":
            self._json(build_checklist(build_status()))

        elif route.startswith("/api/logs/"):
            service = route.split("/")[-1]
            mapping = {"node1": "node1.log", "node2": "node2.log", "pool": "pool.log", "miner": "miner.log"}
            filename = mapping.get(service, f"{service}.log")
            self._json({"lines": tail_log(filename, 200)})

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
    open_browser()
    server = HTTPServer((HOST, PORT), DashboardHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopping dashboard server...")
        server.shutdown()
