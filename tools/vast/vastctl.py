#!/usr/bin/env python3
"""vastctl — vast.ai multi-mining rig manager + web dashboard.

Stdlib only. Uses the `vastai` CLI for instance inventory and plain SSH
for probing rigs (nvidia-smi, miner processes, miner logs, xmrig API).

Usage:
    vastctl status                 # text table of all rigs
    vastctl serve [--port 8088]    # web dashboard (auto-refresh + market + launch)
    vastctl offers [--gpu RTX_3060] [--max-dph 0.08]
                                   # vast.ai offers, cheapest first
    vastctl rent <offer_id>        # rent → ssh instance (auto-provision)
    vastctl launch <id> srb|zion|xmr|all
                                   # start miners in tmux on a rig
    vastctl deploy-xmrig <id>      # push config + install + launch XMRig
    vastctl exec <id> <cmd...>     # run a command on a rig
    vastctl logs <id>              # tail miner logs on a rig
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import shlex
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import redirect_stderr, redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

VASTAI = os.environ.get("VASTAI_BIN", "vastai")
SSH_BASE = [
    "ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8",
    "-o", "BatchMode=yes", "-o", "LogLevel=ERROR",
]
DEFAULT_XMRIG_CONFIG = "xmrig-vast-cpu.json"
XMRIG_VERSION = "6.25.0"
XMRIG_TARBALL = f"https://github.com/xmrig/xmrig/releases/download/v{XMRIG_VERSION}/xmrig-{XMRIG_VERSION}-linux-static-x64.tar.gz"
AI_API_PORT = os.environ.get("VASTCTL_AI_PORT", "8000")

# ── miner launch presets (overridable via env) ──────────────────────────
SRB_DIR = "SRBMiner-Multi-3-7-9"
SRB_TARBALL = ("https://github.com/doktor83/SRBMiner-Multi/releases/"
               "download/3.7.9/SRBMiner-Multi-3-7-9-Linux.tar.gz")
PRL_POOL = os.environ.get("VASTCTL_PRL_POOL", "pearl-eu2.luckypool.io:3360")
# our own ZION pool HTTP API (Edge :8080) — live pool/routing/auxpow stats
POOL_API = os.environ.get("VASTCTL_POOL_API", "http://127.0.0.1:8080")
QTU_POOL = os.environ.get("VASTCTL_QTU_POOL", "eu.lproute.com:5660")
# Pearl + Nockchain merge mining (LuckyPool): the native Nockchain address is
# appended to the Pearl wallet with "+". Pearl stays the payout identity and
# Pearl rewards are unchanged; the pool pays NOCK on Nockchain itself to the
# appended address. A Nock address is base58 (letters/digits, no 0/O/I/l) —
# never a 0x wrapped-NOCK address on Base.
PRL_ADDRESS = os.environ.get(
    "VASTCTL_PRL_ADDRESS",
    "prl1pwqx7esdehf58j4yqq68q0kts3zy5j2cf8c9gnn9tc3qaj6ptaq6qy35v6h")
NOCK_ADDRESS = os.environ.get(
    "VASTCTL_NOCK_ADDRESS",
    "58CRHqNYCGcDZLUga3YB3NRJwH6Hri7d778aVo5DVifWNusb4Lnc2E7")
PRL_WALLET = os.environ.get(
    "VASTCTL_PRL_WALLET",
    f"{PRL_ADDRESS}+{NOCK_ADDRESS}" if NOCK_ADDRESS else PRL_ADDRESS)
QTU_WALLET = os.environ.get(
    "VASTCTL_QTU_WALLET",
    "qzjoHwaJ2GfiRSHyYkYcpoJFbHct9pb9EAbs7sE51Uhj8r2zb")
# zion pool = our project pool (gpu2 QTU route pin matches vast-dual* workers)
ZION_POOL = os.environ.get("VASTCTL_ZION_POOL", "62.171.141.136:8444")
ZION_WALLET = os.environ.get(
    "VASTCTL_ZION_WALLET", "zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6")
REPO_ROOT = Path(__file__).resolve().parents[2]
# rigs run ubuntu 22.04 (glibc 2.35) — do NOT scp the local glibc-2.43 build;
# the Edge-hosted binary is built in a bullseye container (glibc 2.31).
ZION_BIN_URL = os.environ.get(
    "VASTCTL_ZION_BIN_URL",
    # ops build: internal (non-public) → ext stream logs visible in /api/logs
    "http://62.171.141.136/zion-miner/zion-miner-v31-cuda-ops")
RENT_IMAGE = os.environ.get("VASTCTL_RENT_IMAGE",
                            "nvidia/cuda:12.4.1-base-ubuntu22.04")

# One SSH round-trip: GPU stats, miner processes, miner log tails, xmrig API.
PROBE_SCRIPT = r'''
echo "==GPU=="; nvidia-smi --query-gpu=utilization.gpu,power.draw,temperature.gpu,memory.used --format=csv,noheader 2>/dev/null
echo "==PROC=="; ps -eo pid,etime,args 2>/dev/null | grep -E "SRBMiner|xmrig|zion-miner|ccminer" | grep -v grep
echo "==TMUX=="; tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index}' 2>/dev/null | while read p; do echo "--pane:$p--"; tmux capture-pane -t "$p" -p -J 2>/dev/null | tail -60; done
echo "==LOGS=="; for f in /root/zion.log /root/srb-*.log /root/xmrig.log /root/miner*.log; do [ -f "$f" ] && echo "--$f--" && tail -45 "$f"; done
echo "==XMRIG_API=="; curl -s -m 3 http://127.0.0.1:16000/2/summary 2>/dev/null; echo
echo "==SESS=="; tmux ls 2>/dev/null | cut -d: -f1
echo "==NET=="; for hp in eu.lproute.com:5660 pearl-eu2.luckypool.io:3360 62.171.141.136:8444 xmr-eu2.nanopool.org:10300; do h=${hp%:*}; p=${hp#*:}; timeout 3 bash -c "</dev/tcp/$h/$p" 2>/dev/null && echo "net:$hp:ok" || echo "net:$hp:fail"; done
echo "==END=="
'''

HR_RE = re.compile(
    r"Hashrate\s+([0-9.]+)\s+([KMGT]?H/s|h/s)\s+.*?(\d+)\s+(\d+)\s+(\d+)\s*$"
)
ALGO_RE = re.compile(r"--algorithm[ =](\S+)")
POOL_RE = re.compile(r"--pool[ =](\S+)")
WORKER_RE = re.compile(r"--worker[ =](\S+)")
LOG_HEAD_RE = re.compile(r"^--(.+?)--$")


def run(cmd, timeout=30):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"
    except FileNotFoundError as e:
        return 127, "", str(e)


def instances():
    rc, out, err = run([VASTAI, "show", "instances", "--raw"], timeout=30)
    if rc != 0:
        raise SystemExit(f"vastai show instances failed: {err.strip() or out.strip()}")
    return json.loads(out)


def ssh(inst, script, timeout=30):
    host, port = inst.get("ssh_host"), inst.get("ssh_port")
    if not host or not port:
        return 1, "", "no ssh endpoint"
    # Script goes on stdin (`bash -s`) — long multi-line scripts passed as a
    # remote command argument were being dropped by sshd (rc 255, no output).
    try:
        p = subprocess.run(
            SSH_BASE + ["-p", str(port), f"root@{host}", "bash", "-s"],
            input=script, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"


def scp(inst, local, remote, timeout=60):
    host, port = inst.get("ssh_host"), inst.get("ssh_port")
    cmd = ["scp", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8",
           "-P", str(port), local, f"root@{host}:{remote}"]
    return run(cmd, timeout=timeout)


def parse_probe(inst, text):
    rig = {
        "id": inst["id"], "gpu_name": inst.get("gpu_name", "?"),
        "status": inst.get("actual_status", "?"),
        "dph": inst.get("dph_total", 0), "geo": inst.get("geolocation", "?"),
        "ssh": f"{inst.get('ssh_host')}:{inst.get('ssh_port')}",
        "gpu": {}, "miners": [], "xmrig_api": None, "error": None,
        "net": {}, "sessions": [],
    }
    sec = None
    log_file = None
    hr_by_log = {}
    pane_hrs = []          # [(algo, rate, unit, a, r)] from tmux panes
    zion_hrs = {}          # {coin: {rate,unit,a,r}} from [metrics] lines
    pane_algo = None
    pane_ok = False
    api_buf = []
    for line in text.splitlines():
        line = line.strip("\x1b").rstrip()
        clean = re.sub(r"\x1b\[[0-9;]*m", "", line).strip()
        if clean.startswith("==") and clean.endswith("=="):
            if sec == "XMRIG_API":
                _parse_xmrig_api(rig, api_buf)
            sec = clean.strip("=")
            continue
        if sec == "SESS" and clean:
            rig["sessions"].append(clean)
            continue
        if sec == "NET" and clean.startswith("net:"):
            parts = clean[4:].split(":")
            if len(parts) >= 2:
                rig["net"][":".join(parts[:-1])] = parts[-1] == "ok"
            continue
        if sec == "GPU" and "," in clean and not rig["gpu"]:
            parts = [p.strip() for p in clean.split(",")]
            if len(parts) >= 4:
                rig["gpu"] = {"util": parts[0], "power": parts[1],
                              "temp": parts[2], "mem": parts[3]}
        elif sec == "PROC" and clean:
            toks = clean.split()
            cmd = " ".join(toks[2:] if len(toks) > 2 else toks[1:])
            # skip shell wrappers (tmux env launcher) — count real binaries only
            if re.match(r"^(bash|sh|env|/bin/(bash|sh))\b", cmd):
                continue
            m = {"pid": toks[0], "etime": toks[1] if len(toks) > 2 else "",
                 "cmd": cmd,
                 "algo": None, "pool": None, "worker": None}
            for rx, key in ((ALGO_RE, "algo"), (POOL_RE, "pool"), (WORKER_RE, "worker")):
                g = rx.search(clean)
                if g:
                    m[key] = g.group(1)
            if "xmrig" in clean.lower():
                m["algo"] = m["algo"] or "rx/0"
            # fallback: derive algo from tmux session name in cmd
            # (e.g. "tmux new-session -d -s srb-qtu exec ./SRBMiner-MULTI ...")
            if not m["algo"]:
                if "srb-qtu" in clean or "quantus" in clean:
                    m["algo"] = "quantus"
                elif "srb-prl" in clean or "pearlhash" in clean:
                    m["algo"] = "pearlhash"
            rig["miners"].append(m)
        elif sec == "TMUX":
            g = re.match(r"^--pane:(.+)--$", clean)
            if g:
                pane_algo = None
                pane_ok = bool(re.match(r"^(srb|zion|xmr)", g.group(1)))
                # Extract algo from pane name when tmux capture-pane doesn't
                # emit [stats A1 - <algo>] header (e.g. SRBMiner sessions).
                pn = g.group(1)
                if "srb-qtu" in pn:
                    pane_algo = "quantus"
                elif "srb-prl" in pn:
                    pane_algo = "pearlhash"
                elif "zion" in pn:
                    pane_algo = "zion"
                continue
            ga = re.search(r"\[\s*A\d+\s*-\s*(\S+)\s*\]", clean)
            if ga:
                pane_algo = ga.group(1)
            h = HR_RE.search(clean)
            if h and pane_algo:
                # pane_ok is only required for [metrics] parsing (zion-miner),
                # not for generic Hashrate lines from SRBMiner/xmrig panes.
                pane_hrs.append((pane_algo, {
                    "rate": float(h.group(1)), "unit": h.group(2),
                    "a": int(h.group(3)), "r": int(h.group(4)),
                }))
            # zion-miner: "[metrics] PRL: 24.8 TH/s A3 R0 | QTU: 109.9 MH/s A7 R0"
            if "[metrics]" in clean and pane_ok:
                for cm in re.finditer(
                        r"([A-Za-z0-9_]+):\s*([0-9.]+)\s*([KMGT]?H/s|h/s)"
                        r"(?:\s*\[[^\]]*\])?\s*A(\d+)\s*R(\d+)", clean):
                    if "-" in cm.group(1):   # skip stream labels (gpu-external-2)
                        continue
                    zion_hrs[cm.group(1).upper()] = {
                        "rate": float(cm.group(2)), "unit": cm.group(3),
                        "a": int(cm.group(4)), "r": int(cm.group(5)),
                    }
        elif sec == "LOGS" and "[metrics]" in clean:
            for cm in re.finditer(
                    r"([A-Za-z0-9_]+):\s*([0-9.]+)\s*([KMGT]?H/s|h/s)"
                    r"(?:\s*\[[^\]]*\])?\s*A(\d+)\s*R(\d+)", clean):
                if "-" in cm.group(1):
                    continue
                zion_hrs[cm.group(1).upper()] = {
                    "rate": float(cm.group(2)), "unit": cm.group(3),
                    "a": int(cm.group(4)), "r": int(cm.group(5)),
                }
        elif sec == "LOGS":
            g = LOG_HEAD_RE.match(clean)
            if g:
                log_file = g.group(1)
                continue
            h = HR_RE.search(clean)
            if h and log_file:
                hr_by_log[log_file] = {
                    "rate": float(h.group(1)), "unit": h.group(2),
                    "a": int(h.group(3)), "r": int(h.group(4)),
                }
        elif sec == "XMRIG_API":
            if clean:
                # strip a glued-on ==END== marker (json lacks trailing \n)
                api_buf.append(re.sub(r"==[A-Z_]+==\s*$", "", clean).rstrip())
    if sec == "XMRIG_API":
        _parse_xmrig_api(rig, api_buf)

    # attach hashrates: tmux pane stats (primary), log tails (fallback)
    for m in rig["miners"]:
        algo = m.get("algo") or ""
        for pa, hr in reversed(pane_hrs):  # last stat wins
            if pa.split("-")[0].lower() == algo.split("-")[0].lower() or \
               pa.lower() == algo.lower():
                m["hashrate"] = hr
                break
        if "hashrate" not in m:
            for lf, hr in hr_by_log.items():
                if (algo and algo.split("-")[0][:3] in lf) or \
                   (algo == "pearlhash" and "prl" in lf) or \
                   (algo == "quantus" and "qtu" in lf):
                    m["hashrate"] = hr
                    break
        # xmrig proc: fill pool + hashrate from API
        if "xmrig" in (m.get("cmd") or "").lower() and rig["xmrig_api"]:
            xa = rig["xmrig_api"]
            m["pool"] = m["pool"] or xa.get("pool")
            m["hashrate"] = {"rate": round(xa["hps_15m"], 1), "unit": "H/s",
                             "a": xa["shares_good"],
                             "r": xa["shares_total"] - xa["shares_good"]}

    # zion-miner proc → expand one row per coin from [metrics] lines
    ZION_COIN_ALGO = {"PRL": "pearlhash", "QTU": "quantus", "ZION": "zion"}
    expanded = []
    for m in rig["miners"]:
        if "zion-miner" not in (m.get("cmd") or ""):
            expanded.append(m)
            continue
        if not zion_hrs:
            m["algo"] = m["algo"] or "zion-dual"
            expanded.append(m)
            continue
        for coin, hr in zion_hrs.items():
            mm = dict(m)
            mm["algo"] = ZION_COIN_ALGO.get(coin, coin.lower())
            mm["hashrate"] = hr
            expanded.append(mm)
    rig["miners"] = expanded
    return rig


def _parse_xmrig_api(rig, lines):
    try:
        api = json.loads("\n".join(lines))
    except json.JSONDecodeError:
        return
    hr = api.get("hashrate", {}).get("total", [])
    res = api.get("results", {})
    hps_10s = hr[0] if len(hr) > 0 and hr[0] is not None else 0
    hps_15m = hr[2] if len(hr) > 2 and hr[2] is not None else hps_10s
    rig["xmrig_api"] = {
        "hps_10s": hps_10s,
        "hps_15m": hps_15m,
        "shares_good": res.get("shares_good", 0),
        "shares_total": res.get("shares_total", 0),
        "algo": api.get("algo", "rx/0"),
        "pool": (api.get("connection") or {}).get("pool"),
        "uptime_s": api.get("uptime", 0),
    }


def probe(inst):
    rc, out, err = ssh(inst, PROBE_SCRIPT, timeout=35)
    rig = parse_probe(inst, out)
    if rc != 0 and not out:
        rig["error"] = err.strip() or "ssh failed"
    return rig


def status_all(ids=None):
    insts = instances()
    if ids:
        insts = [i for i in insts if str(i["id"]) in ids]
    rigs = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(probe, i): i for i in insts}
        for f in as_completed(futs):
            rigs.append(f.result())
    return sorted(rigs, key=lambda r: r["id"])


def ai_api_port():
    try:
        port = int(AI_API_PORT)
    except ValueError as exc:
        raise ValueError("VASTCTL_AI_PORT must be an integer") from exc
    if not 1 <= port <= 65535:
        raise ValueError("VASTCTL_AI_PORT must be between 1 and 65535")
    return port


def ai_probe_script(port):
    return f'''
echo "==GPU=="
nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw --format=csv,noheader,nounits 2>/dev/null || true
echo "==MODELS=="
curl -fsS --max-time 2 http://127.0.0.1:{port}/v1/models 2>/dev/null || true
echo
echo "==SERVER=="
for p in llama-server vllm ollama; do pgrep -x "$p" >/dev/null 2>&1 && echo "$p"; done
'''


def parse_ai_probe(inst, text, rc=0, err=""):
    rig = {
        "id": inst["id"],
        "gpu_name": inst.get("gpu_name", "?"),
        "dph": inst.get("dph_total", 0),
        "gpus": [],
        "models": [],
        "inference_reachable": False,
        "servers": [],
        "error": None,
    }
    section = None
    model_body = []
    for line in text.splitlines():
        if line.startswith("==") and line.endswith("=="):
            if section == "MODELS":
                try:
                    payload = json.loads("\n".join(model_body))
                    rig["models"] = [
                        item["id"] for item in payload.get("data", [])
                        if isinstance(item, dict) and isinstance(item.get("id"), str)
                    ]
                    rig["inference_reachable"] = True
                except (json.JSONDecodeError, AttributeError):
                    pass
            section = line.strip("=")
            continue
        if section == "GPU" and line.strip():
            columns = [part.strip() for part in line.split(",")]
            if len(columns) >= 7:
                try:
                    rig["gpus"].append({
                        "name": columns[0],
                        "memory_total_mib": int(float(columns[1])),
                        "memory_used_mib": int(float(columns[2])),
                        "memory_free_mib": int(float(columns[3])),
                        "utilization_pct": int(float(columns[4])),
                        "temperature_c": int(float(columns[5])),
                        "power_w": float(columns[6]) if columns[6] != "[N/A]" else None,
                    })
                except ValueError:
                    continue
        elif section == "MODELS" and line.strip():
            model_body.append(line)
        elif section == "SERVER" and line.strip() in {"llama-server", "vllm", "ollama"}:
            rig["servers"].append(line.strip())
    if section == "MODELS":
        try:
            payload = json.loads("\n".join(model_body))
            rig["models"] = [
                item["id"] for item in payload.get("data", [])
                if isinstance(item, dict) and isinstance(item.get("id"), str)
            ]
            rig["inference_reachable"] = True
        except (json.JSONDecodeError, AttributeError):
            pass
    if rc != 0 and not text:
        rig["error"] = err.strip() or "SSH probe failed"
    if not rig["gpus"] and not rig["error"]:
        rig["error"] = "GPU metrics unavailable"
    return rig


def ai_probe(inst, port):
    rc, out, err = ssh(inst, ai_probe_script(port), timeout=15)
    return parse_ai_probe(inst, out, rc, err)


def ai_status():
    port = ai_api_port()
    insts = instances()
    rigs = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = {ex.submit(ai_probe, inst, port): inst for inst in insts}
        for fut in as_completed(futs):
            rigs.append(fut.result())
    rigs.sort(key=lambda rig: rig["id"])
    gpus = [gpu for rig in rigs for gpu in rig["gpus"]]
    return {
        "ts": time.strftime("%Y-%m-%d %H:%M:%S"),
        "ai_api_port": port,
        "rigs": rigs,
        "totals": {
            "gpu_count": len(gpus),
            "memory_total_mib": sum(gpu["memory_total_mib"] for gpu in gpus),
            "memory_used_mib": sum(gpu["memory_used_mib"] for gpu in gpus),
            "memory_free_mib": sum(gpu["memory_free_mib"] for gpu in gpus),
            "gpu_utilization_pct": (
                round(sum(gpu["utilization_pct"] for gpu in gpus) / len(gpus))
                if gpus else None
            ),
            "inference_rigs": sum(rig["inference_reachable"] for rig in rigs),
        },
        "note": (
            "VRAM totals are inventory only. GPUs on separate Vast hosts do not "
            "form shared memory for one model."
        ),
    }


def fmt_rate(hr):
    if not hr:
        return "—"
    return f"{hr['rate']:.2f} {hr['unit']} (A{hr['a']} R{hr['r']})"


def cmd_status(args):
    rigs = status_all(args.id)
    print(f"{'ID':<10} {'GPU':<11} {'$/h':<8} {'GPU%':<5} {'W':<7} {'miners':<7} detail")
    print("-" * 100)
    for r in rigs:
        g = r["gpu"]
        line = f"{r['id']:<10} {r['gpu_name'][:10]:<11} {r['dph']:<8.4f} " \
               f"{g.get('util','?'):<5} {g.get('power','?'):<7} {len(r['miners']):<7}"
        print(line + (r["error"] or ""))
        for m in r["miners"]:
            hr = m.get("hashrate")
            print(f"{'':>12}- {m['algo'] or '?':<10} {m.get('pool','?'):<28} "
                  f"{m.get('worker') or '?':<14} {fmt_rate(hr)}")
        if r["xmrig_api"]:
            xa = r["xmrig_api"]
            print(f"{'':>12}- {xa['algo']:<10} {'xmrig(api)':<28} {'cpu':<14} "
                  f"{xa['hps_15m']:.0f} H/s 15m (S{xa['shares_good']}/{xa['shares_total']})")
        if not r["miners"] and not r["error"]:
            print(f"{'':>12}(idle — no miners detected)")


def cmd_exec(args):
    inst = [i for i in instances() if str(i["id"]) == args.id]
    if not inst:
        raise SystemExit(f"instance {args.id} not found")
    cmd_args = [c for c in args.cmd if c != "--"]
    rc, out, err = ssh(inst[0], " ".join(cmd_args), timeout=120)
    sys.stdout.write(out)
    sys.stderr.write(err)
    return rc


def cmd_logs(args):
    inst = [i for i in instances() if str(i["id"]) == args.id]
    if not inst:
        raise SystemExit(f"instance {args.id} not found")
    rc, out, err = ssh(inst[0], 'for f in /root/srb-*.log /root/xmrig.log; do [ -f "$f" ] && echo "=== $f ===" && tail -20 "$f"; done', timeout=30)
    sys.stdout.write(out)
    sys.stderr.write(err)
    return rc


# ── daemon: autonomous fleet loop ─────────────────────────────────────────

_history = {}   # (rig_id, algo) -> [rate, ...]
_deploy_fail_at = {}  # rig_id -> epoch of last failed autodeploy

# ── pool workers (SMOS / external rigs on the project pool) ──────────────
_pool_cache = {"ts": 0.0, "miners": None}
POOL_CACHE_TTL = 55
EDGE_SSH = os.environ.get("VASTCTL_EDGE_SSH", "zion-new")


# ── SimpleMining (SMOS) rigs via official REST API ───────────────────────
SMOS_API_KEY = os.environ.get("VASTCTL_SMOS_KEY", "")
SMOS_BASE = "https://api.simplemining.net"
_smos_cache = {"ts": 0.0, "rigs": None}
SMOS_CACHE_TTL = 55


def fetch_smos_rigs():
    """SMOS /rigs/user-list → normalized rig list (None = unreachable/unconfigured)."""
    if not SMOS_API_KEY:
        return None
    now = time.time()
    if now - _smos_cache["ts"] < SMOS_CACHE_TTL:
        return _smos_cache["rigs"]
    rigs = None
    try:
        import urllib.request
        req = urllib.request.Request(
            f"{SMOS_BASE}/rigs/user-list?itemsPerPage=100",
            headers={"X-AUTH-TOKEN": SMOS_API_KEY, "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        rigs = []
        for r in data:
            rd = r.get("redisData") or {}
            grp = r.get("rigGroup") or {}
            miner = (grp.get("minerProgram") or {}).get("name", "")
            rigs.append({
                "id": r.get("id"),
                "name": r.get("name") or f"rig-{r.get('id')}",
                "online": bool(r.get("isOnline")),
                "paused": bool(r.get("isPaused")),
                "group": grp.get("name") or "",
                "miner": miner,
                "gpus": r.get("gpuCount") or 0,
                "gpus_max": r.get("gpuCountMax") or 0,
                "hash": rd.get("hash") or 0,
                "hash2": rd.get("hash2") or 0,
                "gpu_hash": rd.get("gpuHash") or [],
                "gpu_hash2": rd.get("gpuHash2") or [],
                "gpu_temp": rd.get("gpuTemp") or [],
                "gpu_fan": rd.get("gpuFan") or [],
                "gpu_pwr": rd.get("gpuPwrCur") or [],
                "sys_pwr": rd.get("sysPwr") or "",
                "acc": rd.get("acc") or 0,
                "rej": rd.get("rej") or 0,
                "uptime": rd.get("uptime") or "",
                "proc_uptime": r.get("processUptime") or 0,
                "alerts": r.get("alerts") or [],
                "last_update": r.get("valueLastUpdate") or 0,
                "ip": r.get("ip") or "",
                "driver": rd.get("driver") or "",
                "kernel": rd.get("kernel") or "",
                "os": f"{r.get('osSeries','')} {r.get('osVersion','')}".strip(),
                "pwr_limit": r.get("ocPowerLimit") or "",
            })
    except Exception:
        rigs = None
    _smos_cache["ts"] = now
    _smos_cache["rigs"] = rigs
    return rigs


# ── external pool stats (luckypool QTU/PRL + nanopool XMR) ───────────────
XMR_WALLET = "42m86RBWf4PeuRf8P5rwA96XvmCKAfF77doWYJRv3KKAKrT8GTb5b3pbHTtaZsbJ4BERW1NHgh8WQgpAxAoEiXF82skcKsK"
_ext_cache = {"ts": 0.0, "data": None}
EXT_CACHE_TTL = 55
LUCKY_UNITS = {"quantus": 1e12, "pearl": 1e8, "nock": 65536}


def _http_json(url, timeout=12):
    import urllib.request
    req = urllib.request.Request(url, headers={
        "User-Agent": "vastctl/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def _lucky_stats(coin, wallet):
    """LuckyPool stats_address → normalized {hashrate, balances, workers[]}."""
    d = _http_json(f"https://{coin}.luckypool.io/api/stats_address?address={wallet}")
    st = d.get("stats") or {}
    u = LUCKY_UNITS[coin]
    def coin_units(v):
        try:
            return round(int(v) / u, 6)
        except (TypeError, ValueError):
            return 0
    workers = []
    for w in d.get("workers", []):
        avg = w.get("hashrateAvg") or {}
        workers.append({
            "name": w.get("name") or "?",
            "hashrate": w.get("hashrate") or 0,
            "h1": avg.get("1h") or 0, "h6": avg.get("6h") or 0,
            "h24": avg.get("24h") or 0,
            "accepted": int(w.get("acceptedShares") or 0),
            "last": int(w.get("lastShare") or 0) // 1000,
            "agent": w.get("agent") or w.get("minerAgent") or "",
        })
    return {
        "hashrate": st.get("hashrate") or 0,
        "avg": st.get("hashrateAvg") or {},
        "accepted": int(st.get("acceptedShares") or 0),
        "rejected": int(st.get("rejectedShares") or 0),
        "unlocked": coin_units(st.get("unlocked")),
        "locked": coin_units(st.get("locked")),
        "paid": coin_units(st.get("paid")),
        "workers": workers,
        "url": f"https://{coin}.luckypool.io/miner-stats/{wallet}",
    }


def _xmr_stats():
    base = f"https://api.nanopool.org/v1/xmr"
    bal = _http_json(f"{base}/balance/{XMR_WALLET}")
    hr = _http_json(f"{base}/hashrate/{XMR_WALLET}")
    avg = _http_json(f"{base}/avghashrate/{XMR_WALLET}")
    ws = _http_json(f"{base}/workers/{XMR_WALLET}")
    a = avg.get("data") or {}
    return {
        "hashrate": hr.get("data") or 0,
        "avg": {"1h": a.get("h1") or 0, "6h": a.get("h6") or 0, "24h": a.get("h24") or 0},
        "balance": bal.get("data") or 0,
        "workers": [{"name": w.get("id") or "?", "hashrate": w.get("hashrate") or 0,
                     "last": w.get("lastShare") or 0, "rating": w.get("rating") or 0}
                    for w in (ws.get("data") or [])],
        "url": f"https://xmr.nanopool.org/account/{XMR_WALLET}",
    }


def fetch_ext_pools():
    """External pool balances/workers → {qtu, prl, xmr, nock} (None per-coin on failure)."""
    now = time.time()
    if now - _ext_cache["ts"] < EXT_CACHE_TTL:
        return _ext_cache["data"]
    out = {}
    try:
        out["qtu"] = _lucky_stats("quantus", QTU_WALLET)
    except Exception:
        out["qtu"] = None
    try:
        # plain PRL address — the merged "+NOCK" wallet is only for stratum
        # login; a "+" in a query string would decode to a space.
        out["prl"] = _lucky_stats("pearl", PRL_ADDRESS)
    except Exception:
        out["prl"] = None
    try:
        out["xmr"] = _xmr_stats()
    except Exception:
        out["xmr"] = None
    try:
        out["nock"] = _lucky_stats("nock", NOCK_ADDRESS)
    except Exception:
        out["nock"] = None
    _ext_cache["ts"] = now
    _ext_cache["data"] = out
    return out


def fetch_pool_miners():
    """Pool /miners via the local pool API → normalized worker list (None = unreachable).

    The pool API listens on 127.0.0.1 on the same host, so this is a direct
    HTTP call — the previous variant shelled out over SSH without a port
    (Edge only listens on 2222) and therefore always came back empty.
    """
    now = time.time()
    if now - _pool_cache["ts"] < POOL_CACHE_TTL:
        return _pool_cache["miners"]
    miners = None
    try:
        with urllib.request.urlopen(f"{POOL_API}/miners?limit=200", timeout=10) as r:
            data = json.loads(r.read().decode())
        miners = []
        for m in data.get("miners", []):
            w = m.get("worker") or ""
            if w.startswith("probe"):
                continue
            miners.append({
                "worker": w,
                "address": m.get("address") or "",
                "streams": {
                    c: {"v": s.get("valid_shares", 0),
                        "i": s.get("invalid_shares", 0),
                        "t": s.get("last_share_time", 0)}
                    for c, s in (m.get("streams") or {}).items()
                },
                "hps": m.get("hashrate_hps") or 0,
                "hps_1h": m.get("hashrate_1h_hps") or 0,
                "last_seen": m.get("last_seen_s") or 0,
                "first_seen": m.get("first_seen_s") or 0,
                "blocks": m.get("blocks_found") or 0,
                "paid": m.get("paid_total_atomic") or 0,
            })
    except Exception:
        miners = None
    _pool_cache["ts"] = now
    _pool_cache["miners"] = miners
    return miners


def fetch_pool_stats():
    """Live stats from our own ZION pool (Edge :8080) — sessions, share
    routing, auxpow legs, PPLNS window, Pearl upstream counters.

    Returns None when the pool API is unreachable so the dashboard can show
    "pool API unavailable" instead of an empty card.
    """
    try:
        with urllib.request.urlopen(f"{POOL_API}/stats", timeout=8) as r:
            d = json.loads(r.read().decode())
    except Exception:
        return None
    if not isinstance(d, dict) or not d.get("ok"):
        return None
    aux = d.get("auxpow") or {}
    pearl = aux.get("pearl") or {}
    routing = d.get("routing") or {}
    out = {
        "sessions": d.get("sessions"),
        "total_connections": d.get("total_connections"),
        "uptime_s": d.get("uptime_s"),
        "config": d.get("pool") or {},
        "shares": d.get("shares") or {},
        "pplns": d.get("pplns") or {},
        "external_payouts": d.get("external_payouts") or {},
        "routing": {
            "total_submits": routing.get("total_submits"),
            "total_accepted": routing.get("total_accepted"),
            "total_rejected": routing.get("total_rejected"),
            "total_stale": routing.get("total_stale"),
            "total_accept_rate_pct": routing.get("total_accept_rate_pct"),
            "groups": routing.get("groups") or [],
            "sources": routing.get("sources") or [],
        },
        "pearl": {
            "upstream": pearl.get("upstream") or {},
            "native": pearl.get("native") or {},
            "served_upstream": pearl.get("served_upstream"),
            "served_native": pearl.get("served_native"),
        },
        "coins": [{
            "ticker": c.get("ticker"),
            "algorithm": c.get("algorithm"),
            "device": c.get("device"),
            "upstream": c.get("upstream"),
            "job_fresh": c.get("job_fresh"),
            "job_age_ms": c.get("job_age_ms"),
        } for c in (aux.get("coin_details") or []) if isinstance(c, dict)],
    }
    return out


def snapshot(ids=None):
    rigs = status_all(ids)
    for r in rigs:
        for m in r["miners"]:
            hr = m.get("hashrate")
            if hr:
                key = (r["id"], m.get("algo") or "?")
                h = _history.setdefault(key, [])
                h.append(hr["rate"])
                del h[:-90]
                m["hist"] = list(h)
        # xmrig_api hist is covered by the rx/0 miner row (hashrate attached)

    return {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "total_dph": round(sum(r["dph"] for r in rigs), 4),
        "rigs": rigs,
        "pool": fetch_pool_miners(),
        "poolstats": fetch_pool_stats(),
        "smos": fetch_smos_rigs(),
        "ext": fetch_ext_pools(),
    }


STATE_FILE = os.path.expanduser("~/.local/share/vastctl-state.json")


def _state():
    try:
        st = json.loads(Path(STATE_FILE).read_text())
        st.setdefault("desired", {})
        st.setdefault("last_fix", {})
        return st
    except Exception:
        return {"desired": {}, "last_fix": {}}


def _save_state(st):
    p = Path(STATE_FILE)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(st, indent=1))
    tmp.rename(p)


def _launch_group(mn):
    if mn.startswith("srb"):
        return "srb"
    if mn == "xmr":
        return "xmr"
    if mn in ("zion", "zion50", "zionmax", "prl", "qtu"):
        return "zion"
    return None


_EXPECT_PROC = {"srb": "SRBMiner", "xmr": "xmrig", "zion": "zion-miner"}


def snapshot_from(rigs):
    return {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "total_dph": round(sum(r["dph"] for r in rigs), 4),
        "rigs": rigs,
        "pool": fetch_pool_miners(),
        "poolstats": fetch_pool_stats(),
        "smos": fetch_smos_rigs(),
        "ext": fetch_ext_pools(),
    }


def _write_json_atomic(path, payload):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=1))
    tmp.rename(p)


def _local_ip_addrs():
    """Every IP assigned to this machine (loopback + all interfaces)."""
    ips = {"127.0.0.1", "::1"}
    try:
        ips.update(socket.gethostbyname_ex(socket.gethostname())[2])
    except Exception:
        pass
    # scan every interface — hostname alone often resolves to loopback only
    try:
        rc, out, _ = run(["ip", "-o", "addr", "show"], timeout=5)
        if rc == 0:
            for tok in out.split():
                if "/" in tok and re.match(r"^[0-9a-fA-F:.]+/\d+$", tok):
                    ips.add(tok.split("/")[0])
    except Exception:
        pass
    return ips


def _is_local_host(host):
    """True when the push host is this machine — self-push must not use SSH.

    Edge listens on port 2222 only (22 is closed), so the scp/ssh push path
    fails with "Connection refused" when the daemon pushes to its own host.
    """
    try:
        resolved = {ai[4][0] for ai in socket.getaddrinfo(host, None)}
    except socket.gaierror:
        return False
    return bool(resolved & _local_ip_addrs())


def cmd_daemon(args):
    """Autonomous loop: probe → json-out (+push) → optional xmrig autodeploy."""
    print(f"[daemon] interval={args.interval}s out={args.json_out} push={args.push or '-'} autodeploy={args.autodeploy_xmrig}")
    while True:
        try:
            snap = snapshot()
            _write_json_atomic(args.json_out, snap)
            if args.push:
                host, _, rpath = args.push.partition(":")
                if _is_local_host(host):
                    # self-push: plain local copy, no SSH involved
                    try:
                        dst = Path(rpath)
                        dst.parent.mkdir(parents=True, exist_ok=True)
                        tmp = dst.with_suffix(dst.suffix + ".tmp")
                        shutil.copyfile(args.json_out, tmp)
                        tmp.replace(dst)
                    except Exception as e:
                        print(f"[daemon] local push failed: {e}")
                else:
                    tmp = rpath + ".tmp"
                    push_port = os.environ.get("VASTCTL_PUSH_SSH_PORT")
                    scp_cmd = ["scp", "-o", "StrictHostKeyChecking=no",
                               "-o", "ConnectTimeout=10"]
                    if push_port:
                        scp_cmd += ["-P", push_port]
                    rc, _, err = run(scp_cmd + [args.json_out,
                                        f"{host}:{tmp}"], timeout=30)
                    if rc != 0:
                        print(f"[daemon] push failed: {err.strip()}")
                    else:
                        mv_cmd = SSH_BASE + [host,
                                   f"mv {shlex.quote(tmp)} {shlex.quote(rpath)}"]
                        if push_port:
                            mv_cmd = SSH_BASE + ["-p", push_port, host,
                                   f"mv {shlex.quote(tmp)} {shlex.quote(rpath)}"]
                        rc2, _, err2 = run(mv_cmd, timeout=15)
                        if rc2 != 0:
                            print(f"[daemon] push rename failed: {err2.strip()}")
            if args.autodeploy_xmrig:
                for r in snap["rigs"]:
                    if r["error"] or r["status"] != "running":
                        continue
                    has_xmrig = any("xmrig" in (m.get("cmd") or "") for m in r["miners"]) or r["xmrig_api"]
                    last = _deploy_fail_at.get(r["id"], 0)
                    if not has_xmrig and time.time() - last > 600:
                        print(f"[daemon] autodeploy xmrig → {r['id']}")
                        try:
                            ns = argparse.Namespace(id=str(r["id"]), config=args.config)
                            cmd_deploy_xmrig(ns)
                            _deploy_fail_at.pop(r["id"], None)
                        except SystemExit as e:
                            _deploy_fail_at[r["id"]] = time.time()
                            print(f"[daemon] deploy failed on {r['id']}: {e}")
            if getattr(args, "watchdog", False):
                st = _state()
                for r in snap["rigs"]:
                    rid = str(r["id"])
                    want = st["desired"].get(rid) or {}
                    if not want or r["error"] or r["status"] != "running":
                        continue
                    # host egress firewall → nothing can mine; don't churn
                    if r.get("net") and not all(r["net"].values()):
                        continue
                    cmds = " ".join(m.get("cmd") or "" for m in r["miners"])
                    sess = set(r.get("sessions") or [])
                    # session-level expectation per mode (dual srb = 2 panes)
                    _SESS_WANT = {"srb": {"srb-qtu", "srb-prl"},
                                  "srb-prl": {"srb-prl"},
                                  "srb-qtu": {"srb-qtu"},
                                  "zion": {"zion"}, "zion50": {"zion"},
                                  "zionmax": {"zion"}, "prl": {"zion"},
                                  "qtu": {"zion"}}
                    for grp, cfg in want.items():
                        mode = cfg.get("mode", grp)
                        want_sess = _SESS_WANT.get(mode, set())
                        missing = want_sess - sess
                        if not missing:
                            # sessions alive; also require the proc itself
                            proc = _EXPECT_PROC.get(grp)
                            if proc and proc in cmds:
                                continue
                            if grp == "xmr" and "xmrig" in cmds:
                                continue
                            if grp != "xmr" and proc and proc in cmds:
                                continue
                            if grp == "xmr" and "xmrig" not in cmds:
                                missing = {"xmr"}
                            elif grp != "xmr" and proc and proc not in cmds:
                                missing = want_sess or {mode}
                            else:
                                continue
                        # pick smallest relaunch that restores the missing pane(s)
                        if grp == "srb" and missing == {"srb-prl"}:
                            mode = "srb-prl"
                        elif grp == "srb" and missing == {"srb-qtu"}:
                            mode = "srb-qtu"
                        key = f"{rid}:{grp}"
                        if time.time() - st["last_fix"].get(key, 0) < 300:
                            continue
                        st["last_fix"][key] = time.time()
                        _save_state(st)
                        print(f"[watchdog] {rid}: {grp} missing {sorted(missing)} → relaunch {mode}")
                        try:
                            ns = argparse.Namespace(
                                id=rid, miners=[mode], config=args.config,
                                record=False,
                                duty=tuple(cfg["duty"]) if cfg.get("duty") else None)
                            cmd_launch(ns)
                        except SystemExit as e:
                            print(f"[watchdog] relaunch failed {rid}/{grp}: {e}")
            print(f"[daemon] {snap['ts']} rigs={len(snap['rigs'])} ${snap['total_dph']:.4f}/h")
        except Exception as e:
            print(f"[daemon] cycle error: {e}")
        time.sleep(args.interval)


def _cfg_path(args):
    cfg = Path(args.config)
    if not cfg.exists():
        alt = REPO_ROOT / args.config
        if alt.exists():
            cfg = alt
    return cfg


def cmd_deploy_xmrig(args):
    cfg = _cfg_path(args)
    if not cfg.exists():
        raise SystemExit(f"config not found: {cfg}")
    inst = [i for i in instances() if str(i["id"]) == args.id]
    if not inst:
        raise SystemExit(f"instance {args.id} not found")
    inst = inst[0]
    rid = f"vast-{args.id}-cpu"
    print(f"[1/4] ensuring xmrig {XMRIG_VERSION} on {args.id}…")
    rc, out, err = ssh(inst, f'''
mkdir -p ~/miners && cd ~/miners &&
[ -f xmrig-{XMRIG_VERSION}/xmrig ] || (wget -q {XMRIG_TARBALL} && tar xzf xmrig-{XMRIG_VERSION}-linux-static-x64.tar.gz) &&
ls xmrig-{XMRIG_VERSION}/xmrig
''', timeout=120)
    if "xmrig" not in out:
        raise SystemExit(f"install failed: {err} {out}")
    print("[2/4] pushing config…")
    rc, out, err = scp(inst, str(cfg), f"~/miners/xmrig-{XMRIG_VERSION}/config.json")
    if rc != 0:
        raise SystemExit(f"scp failed: {err}")
    print(f"[3/4] setting rig-id={rid}, launching…")
    rc, out, err = ssh(inst, f'''
cd ~/miners/xmrig-{XMRIG_VERSION} &&
sed -i 's|"rig-id": "[^"]*"|"rig-id": "{rid}"|g; s|\\.vast-cpu/|.{rid}/|g' config.json &&
pkill -x xmrig 2>/dev/null; sleep 1
setsid nohup ./xmrig > /dev/null 2>&1 &
sleep 3 && pgrep -x xmrig && tail -5 /root/xmrig.log 2>/dev/null
''', timeout=60)
    print(out.strip() or "(no output)")
    print("[4/4] done — verify with: vastctl status")


# ── marketplace: search offers + rent ────────────────────────────────────

def search_offers(gpu=None, max_dph=None, limit=30, order="dph"):
    """vastai search offers, cheapest first. Returns list of offer dicts."""
    q = "rentable=true verified=true num_gpus=1"
    if gpu and gpu.lower() != "any":
        q += f" gpu_name={gpu.replace(' ', '_')}"
    if max_dph:
        q += f" dph_total<={max_dph}"
    rc, out, err = run([VASTAI, "search", "offers", q, "-o", order,
                        "--raw", "--limit", str(limit)], timeout=60)
    if rc != 0:
        raise SystemExit(f"search failed: {err.strip() or out.strip()}")
    data = json.loads(out)
    return data.get("offers", data) if isinstance(data, dict) else data


def cmd_offers(args):
    offers = search_offers(args.gpu, args.max_dph, args.limit)
    print(f"{'offer':<10} {'GPU':<10} {'$/h':<8} {'$/day':<7} {'inet↓↑':<15} "
          f"{'reliab':<7} {'cuda':<5} {'ram':<6} {'disk':<6} location")
    print("-" * 105)
    for o in offers:
        rel = f"{o.get('reliability', 0) * 100:.1f}%"
        inet = f"{o.get('inet_down', 0):.0f}/{o.get('inet_up', 0):.0f}"
        ram = f"{o.get('cpu_ram', 0) / 1024:.0f}G"
        print(f"{o['id']:<10} {o.get('gpu_name', '?')[:9]:<10} "
              f"{o.get('dph_total', 0):<8.4f} {o.get('dph_total', 0) * 24:<7.2f} "
              f"{inet:<15} {rel:<7} {o.get('cuda_max_good', '?'):<5} "
              f"{ram:<6} {o.get('disk_space', 0):.0f}G   "
              f"{o.get('geolocation', '?')}")
    print(f"\n{len(offers)} offers — rent: vastctl rent <offer_id>")


def cmd_rent(args):
    """Rent an offer → ssh instance. Provision installs tmux + tools."""
    cli = [VASTAI, "create", "instance", str(args.offer_id),
           "--image", args.image, "--disk", str(args.disk),
           "--ssh", "--direct",
           "--onstart-cmd",
           "apt-get update -qq; apt-get install -y -qq tmux curl xz-utils "
           ">/dev/null 2>&1; touch /root/.vastctl-provisioned"]
    if args.label:
        cli += ["--label", args.label]
    rc, out, err = run(cli, timeout=120)
    txt = (out + err).strip()
    print(txt)
    m = re.search(r"'new_contract':\s*(\d+)|new_contract.?=.?(\d+)", txt)
    iid = next((g for g in (m.groups() if m else []) if g), None)
    if rc != 0 or not iid:
        raise SystemExit(f"rent failed: {txt[:400] or 'no output'}")
    print(f"\n→ instance {iid} — "
          f"boot takes ~1-3 min, then: vastctl launch {iid} all")


# ── launchers: per-miner start scripts (tmux sessions) ───────────────────

def _ensure_tools():
    return ("command -v tmux >/dev/null || "
            "(apt-get update -qq && apt-get install -y -qq tmux >/dev/null 2>&1)")


def _pool_url(pool):
    """SRBMiner needs an explicit stratum scheme — a bare host:port is not
    reliably accepted (our pool on :8444 included)."""
    p = str(pool).strip()
    if "://" in p:
        return p
    return "stratum+tcp://" + p


def _pool_wallet(pool, merged_wallet, plain_wallet):
    """Pick the wallet form a pool accepts.

    LuckyPool Pearl takes the merged `PRL+NOCK` wallet (Nockchain merge
    mining). Our own pool validates the wallet as a plain bech32 PRL
    address — the "+" form is not valid bech32 and is rejected as an
    invalid wallet.
    """
    if "luckypool" in str(pool).lower():
        return merged_wallet
    return plain_wallet


def launch_srb(inst, iid, coins=("qtu", "prl")):
    """SRBMiner sessions: PRL → luckypool, QTU → lproute, one tmux each."""
    wq, wp = f"vast-{iid}-qtu", f"vast-{iid}-prl"
    kills = ("tmux kill-session -t zion 2>/dev/null; "
             "pkill -f 'zion-miner --pool' 2>/dev/null\n")
    sessions = []
    # tmux sessions start in $HOME — the binary lives under /root/miners, so
    # the session has to cd there itself.
    srb_cd = f"cd /root/miners/{SRB_DIR} &&"
    if "qtu" in coins:
        kills += "tmux kill-session -t srb-qtu 2>/dev/null\n"
        sessions.append(
            f'tmux new-session -d -s srb-qtu "{srb_cd} '
            f'exec ./SRBMiner-MULTI '
            f'--algorithm quantus --pool {_pool_url(QTU_POOL)} --wallet {QTU_WALLET} '
            f'--worker {wq} --disable-cpu"')
    if "prl" in coins:
        kills += "tmux kill-session -t srb-prl 2>/dev/null\n"
        sessions.append(
            f'tmux new-session -d -s srb-prl "{srb_cd} '
            f'exec ./SRBMiner-MULTI '
            f'--algorithm pearlhash --pool {_pool_url(PRL_POOL)} '
            f'--wallet {_pool_wallet(PRL_POOL, PRL_WALLET, PRL_ADDRESS)} '
            f'--worker {wp} --disable-cpu"')
    script = f'''
{_ensure_tools()}
mkdir -p /root/miners && cd /root/miners &&
[ -x {SRB_DIR}/SRBMiner-MULTI ] || (wget -q {SRB_TARBALL} && tar xzf {os.path.basename(SRB_TARBALL)}) &&
cd {SRB_DIR} &&
{kills}sleep 1
{chr(10).join(sessions)}
sleep 4; tmux ls; pgrep -c -x SRBMiner-MULTI
'''
    return script


def launch_zion(inst, iid, prl_pct=50, qtu_pct=50):
    """zion-miner native streams via our pool. pct=0 disables that stream."""
    w = f"vast-dual-{iid}"   # matches ZION_POOL_AUXPOW_GPU_COIN2_ROUTE vast-dual*
    s2 = "1" if prl_pct > 0 else "0"
    s4 = "1" if qtu_pct > 0 else "0"
    script = f'''
{_ensure_tools()}
mkdir -p /root/zion-native && cd /root/zion-native &&
[ -x ./zion-miner ] || {{ echo "NO_BIN"; exit 1; }}
tmux kill-session -t zion 2>/dev/null
tmux kill-session -t srb-qtu 2>/dev/null; tmux kill-session -t srb-prl 2>/dev/null
pkill -x SRBMiner-MULTI 2>/dev/null; sleep 1
tmux new-session -d -s zion 'while true; do env \
ZION_MINER_ID={w} ZION_GPU_BACKEND=cuda ZION_PROFILE=pool ZION_VERBOSE=1 \
ZION_INTERACTIVE=0 ZION_NO_STICKY=1 ZION_LOG_INTERVAL=15 \
ZION_V3_TRINITY=1 ZION_AUTOTUNE=1 ZION_AUTOTUNE_SECS=3 ZION_IGNORE_GPU_SELF_TEST_FAIL=1 \
ZION_STREAM1_ENABLED=0 ZION_STREAM3_ENABLED=0 \
ZION_STREAM2_ENABLED={s2} ZION_STREAM2_FORCE_COIN=PRL ZION_PEARL_K=2048 \
ZION_PEARL_BATCH=64 ZION_PEARL_STREAMS=4 ZION_PEARL_CUMULATIVE_MMA=1 \
ZION_STREAM4_ENABLED={s4} ZION_STREAM4_FORCE_COIN=QTU ZION_QPOW_BACKEND=cuda \
ZION_EXT_GPU_TIME_DUTY_PCT={prl_pct} ZION_EXT_GPU2_TIME_DUTY_PCT={qtu_pct} \
ZION_EXT_GPU_GAP_MS=0 ZION_EXT_GPU_MAX_GAP_MS=5000 ZION_MINER_THREADS=4 \
./zion-miner --pool {ZION_POOL} --wallet {ZION_WALLET} \
--worker {w} --gpu cuda --threads 4 --log-interval 15 --v3-trinity \
>> /root/zion.log 2>&1; echo "ZION_EXIT=$? respawn in 5s" >> /root/zion.log; sleep 5; done'
sleep 4; tmux ls; pgrep -f "zion-miner --pool" | grep -v 'bash -c' | head -3
'''
    return script


STOP_SCRIPT = {
    "zion": "tmux kill-session -t zion 2>/dev/null; pkill -f 'zion-miner --pool' 2>/dev/null",
    "srb": "tmux kill-session -t srb-qtu 2>/dev/null; tmux kill-session -t srb-prl 2>/dev/null; pkill -x SRBMiner-MULTI 2>/dev/null",
    "srb-prl": "tmux kill-session -t srb-prl 2>/dev/null",
    "srb-qtu": "tmux kill-session -t srb-qtu 2>/dev/null",
    "xmr": "pkill -x xmrig 2>/dev/null",
}


def stop_script(miner):
    if miner == "all":
        return ("; ".join(dict.fromkeys(
            s for v in STOP_SCRIPT.values() for s in v.split("; ")))
            + "; sleep 1; tmux ls 2>/dev/null; echo STOPPED")
    if miner in STOP_SCRIPT:
        return STOP_SCRIPT[miner] + "; sleep 1; echo STOPPED"
    return None


def install_srb_script():
    """SRBMiner download+extract only (installed, not started)."""
    return f'''
mkdir -p /root/miners && cd /root/miners &&
[ -x {SRB_DIR}/SRBMiner-MULTI ] || (wget -q {SRB_TARBALL} && tar xzf {os.path.basename(SRB_TARBALL)}) &&
ls {SRB_DIR}/SRBMiner-MULTI
'''


def cmd_launch(args):
    inst = [i for i in instances() if str(i["id"]) == args.id]
    if not inst:
        raise SystemExit(f"instance {args.id} not found")
    inst = inst[0]
    miners = args.miners
    if "all" in miners:
        miners = ["srb", "zion", "xmr"]
    if "full" in miners:
        # one-button: SRBMiner PRL+QTU dual (production hashrate) + xmr cpu
        # + zion binary installed standby (native stream still in dev)
        miners = ["srb", "xmr", "_zion_install"]
    ZION_DUTY = {"zion": (50, 50), "zion50": (50, 50), "zionmax": (100, 40),
                 "prl": (100, 0), "qtu": (0, 100)}
    duty = getattr(args, "duty", None)
    if isinstance(duty, str) and "," in duty:
        try:
            duty = tuple(int(x) for x in duty.split(","))
        except ValueError:
            duty = None
    if duty:
        ZION_DUTY[miners[0]] = duty
    for mn in miners:
        print(f"[{args.id}] launch {mn}…")
        if mn == "xmr":
            ns = argparse.Namespace(id=args.id, config=args.config)
            cmd_deploy_xmrig(ns)
            if getattr(args, "record", True):
                st = _state()
                st["desired"].setdefault(str(args.id), {})["xmr"] = {"mode": "xmr"}
                _save_state(st)
            continue
        if mn in ZION_DUTY or mn == "_zion_install":
            # rig downloads the glibc-compatible build from Edge (local build
            # is glibc-2.43 — would not run on ubuntu 22.04 rigs)
            rc, out, _ = ssh(inst, "test -x /root/zion-native/zion-miner && echo OK")
            if "OK" not in out:
                print(f"  downloading {ZION_BIN_URL} on rig…")
                rc, out, err = ssh(
                    inst,
                    f"mkdir -p /root/zion-native && "
                    f"curl -fsSL -o /root/zion-native/zion-miner '{ZION_BIN_URL}' && "
                    f"chmod +x /root/zion-native/zion-miner && echo DL_OK",
                    timeout=180)
                if "DL_OK" not in out:
                    print(f"  download failed: {(out + err).strip()[:200]}")
                    continue
            if mn == "_zion_install":
                print("  zion-miner installed (standby — launch via zion modes)")
                continue
            script = launch_zion(inst, args.id, *ZION_DUTY[mn])
        elif mn == "_srb_install":
            script = install_srb_script()
        elif mn == "srb":
            script = launch_srb(inst, args.id)
        elif mn == "srb-prl":
            script = launch_srb(inst, args.id, ("prl",))
        elif mn == "srb-qtu":
            script = launch_srb(inst, args.id, ("qtu",))
        else:
            print(f"  unknown miner '{mn}' "
                  f"(full|zion|zionmax|prl|qtu|srb|srb-prl|srb-qtu|xmr|all)")
            continue
        rc, out, err = ssh(inst, script, timeout=180)
        print((out + err).strip() or f"(exit {rc})")
        grp = _launch_group(mn)
        if grp and rc == 0 and getattr(args, "record", True):
            st = _state()
            st["desired"].setdefault(str(args.id), {})[grp] = {
                "mode": mn,
                "duty": list(ZION_DUTY[mn]) if mn in ZION_DUTY else None,
            }
            _save_state(st)


def cmd_stop(args):
    inst = [i for i in instances() if str(i["id"]) == args.id]
    if not inst:
        raise SystemExit(f"instance {args.id} not found")
    inst = inst[0]
    for mn in args.miners:
        script = stop_script(mn)
        if not script:
            print(f"[{args.id}] unknown stop target '{mn}' "
                  f"(zion|srb|srb-prl|srb-qtu|xmr|all)")
            continue
        print(f"[{args.id}] stop {mn}…")
        rc, out, err = ssh(inst, script, timeout=60)
        print((out + err).strip() or f"(exit {rc})")
        # watchdog bookkeeping: stop clears the desired state so it won't relaunch
        st = _state()
        d = st["desired"].get(str(args.id))
        if d is not None:
            if mn == "all":
                d.clear()
            else:
                d.pop(_launch_group(mn) or "", None)
            _save_state(st)


def render_dashboard(rigs, ts):
    cards = []
    tot_cost = 0.0
    for r in rigs:
        tot_cost += r["dph"]
        rows = ""
        for m in r["miners"]:
            hr = m.get("hashrate")
            rows += (f"<tr><td>{html.escape(m['algo'] or '?')}</td>"
                     f"<td class=dim>{html.escape(m.get('pool') or '?')}</td>"
                     f"<td>{fmt_rate(hr)}</td></tr>")
        if r["xmrig_api"]:
            xa = r["xmrig_api"]
            rows += (f"<tr><td>{html.escape(xa['algo'])}</td><td class=dim>xmrig api</td>"
                     f"<td>{xa['hps_15m']:.0f} H/s 15m (S{xa['shares_good']}/{xa['shares_total']})</td></tr>")
        if not rows:
            rows = "<tr><td colspan=3 class=dim>idle</td></tr>"
        g = r["gpu"]
        err = f"<div class=err>{html.escape(r['error'])}</div>" if r["error"] else ""
        cards.append(f"""
<div class=card>
  <div class=hd><b>#{r['id']}</b> · {html.escape(r['gpu_name'])} ·
    <span class=dim>{html.escape(str(r['geo']))} · ${r['dph']:.4f}/h</span></div>
  <div class=sub>gpu {g.get('util','?')} · {g.get('power','?')} · {g.get('temp','?')} · vram {g.get('mem','?')} · <span class=dim>{r['ssh']}</span></div>
  {err}<table>{rows}</table>
  <div class=btns>
    <button onclick="launch({r['id']},'full')" class=gold>▸ FULL deploy</button>
    <button onclick="stop({r['id']},'all')" class=red>■ all</button>
  </div>
  <div class=btns>
    <span class=lbl>zion</span>
    <button onclick="launch({r['id']},'zion')">50/50</button>
    <button onclick="launch({r['id']},'prl')">prl</button>
    <button onclick="launch({r['id']},'qtu')">qtu</button>
    <button onclick="stop({r['id']},'zion')" class=red>■</button>
    <button onclick="logs({r['id']},'zion')">log</button>
  </div>
  <div class=btns>
    <span class=lbl>srb</span>
    <button onclick="launch({r['id']},'srb')">dual</button>
    <button onclick="launch({r['id']},'srb-prl')">prl</button>
    <button onclick="launch({r['id']},'srb-qtu')">qtu</button>
    <button onclick="stop({r['id']},'srb')" class=red>■</button>
    <button onclick="logs({r['id']},'srb')">log</button>
  </div>
  <div class=btns>
    <span class=lbl>xmr</span>
    <button onclick="launch({r['id']},'xmr')">start</button>
    <button onclick="stop({r['id']},'xmr')" class=red>■</button>
    <button onclick="logs({r['id']},'xmr')">log</button>
    <button onclick="logs({r['id']},'all')">all-logs</button>
  </div>
  <form onsubmit="return run(this,{r['id']})"><input name=cmd placeholder="ssh cmd…"><button>run</button></form>
</div>""")
    return f"""<!doctype html><meta charset=utf-8><title>vastctl</title><style>
body{{background:#0b0e14;color:#cfd8e3;font:14px/1.5 ui-monospace,monospace;margin:16px}}
h1{{font-size:18px}} .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px}}
.card{{background:#121723;border:1px solid #232c3d;border-radius:8px;padding:12px}}
.hd b{{color:#7ee787}} .sub,.dim{{color:#8b98a9}} .err{{color:#ff7b72}}
table{{width:100%;border-collapse:collapse;margin-top:8px}} td{{padding:2px 6px}}
input,select{{background:#0b0e14;border:1px solid #232c3d;color:#cfd8e3;padding:4px}}
input{{width:55%}}
button{{background:#1f6feb;color:#fff;border:0;padding:4px 10px;border-radius:4px;cursor:pointer}}
.btns{{margin:6px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap}}
.btns button{{background:#21262d;border:1px solid #30363d;font-size:12px}}
.btns button:hover{{border-color:#1f6feb}} .dim2{{opacity:.7}}
.btns .lbl{{color:#8b98a9;font-size:11px;text-transform:uppercase;letter-spacing:.05em;min-width:34px}}
.btns .gold{{background:#332d10;border-color:#9e7c1e;color:#fcd116}}
.btns .red{{background:#2d1416;border-color:#7a2e2e;color:#ff9b93}}
#market{{margin-top:22px;border-top:1px solid #232c3d;padding-top:10px}}
#market th{{color:#8b98a9;text-align:left;padding:2px 6px;font-weight:normal}}
#market td{{padding:2px 6px;border-top:1px solid #1c2330}}
.rent{{background:#238636}}
.tot{{color:#8b98a9;margin:10px 0}}</style>
<h1>vastctl — vast.ai multi-mining</h1>
<div class=tot>{len(rigs)} rigs · ${tot_cost:.4f}/h = ${tot_cost*24:.2f}/day · refreshed {ts} · auto 30s</div>
<div class=grid>{''.join(cards)}</div>
<div id=market>
  <h1>market — offers (cheapest first)</h1>
  <form onsubmit="return offers()">
    <select name=gpu>
      <option value="any">any GPU</option>
      <optgroup label="GTX / 16xx">
      <option value="GTX_1050_Ti">GTX 1050 Ti</option><option value="GTX_1060">GTX 1060</option>
      <option value="GTX_1070">GTX 1070</option><option value="GTX_1070_Ti">GTX 1070 Ti</option>
      <option value="GTX_1080">GTX 1080</option><option value="GTX_1080_Ti">GTX 1080 Ti</option>
      <option value="GTX_1650">GTX 1650</option><option value="GTX_1660">GTX 1660</option>
      <option value="GTX_1660_S">GTX 1660 S</option><option value="GTX_1660_Ti">GTX 1660 Ti</option>
      <option value="GTX_TITAN_X">GTX TITAN X</option>
      </optgroup>
      <optgroup label="RTX 20xx">
      <option value="RTX_2060">RTX 2060</option><option value="RTX_2060S">RTX 2060S</option>
      <option value="RTX_2070">RTX 2070</option><option value="RTX_2070S">RTX 2070S</option>
      <option value="RTX_2080">RTX 2080</option><option value="RTX_2080_Ti">RTX 2080 Ti</option>
      </optgroup>
      <optgroup label="RTX 30xx">
      <option value="RTX_3050">RTX 3050</option><option value="RTX_3060" selected>RTX 3060</option>
      <option value="RTX_3060_Ti">RTX 3060 Ti</option><option value="RTX_3070">RTX 3070</option>
      <option value="RTX_3070_Ti">RTX 3070 Ti</option><option value="RTX_3080">RTX 3080</option>
      <option value="RTX_3080_Ti">RTX 3080 Ti</option><option value="RTX_3090">RTX 3090</option>
      <option value="RTX_3090_Ti">RTX 3090 Ti</option>
      </optgroup>
      <optgroup label="RTX 40xx">
      <option value="RTX_4060">RTX 4060</option><option value="RTX_4060_Ti">RTX 4060 Ti</option>
      <option value="RTX_4070">RTX 4070</option><option value="RTX_4070S">RTX 4070S</option>
      <option value="RTX_4070_Ti">RTX 4070 Ti</option><option value="RTX_4070S_Ti">RTX 4070S Ti</option>
      <option value="RTX_4080">RTX 4080</option><option value="RTX_4080S">RTX 4080S</option>
      <option value="RTX_4090">RTX 4090</option>
      </optgroup>
      <optgroup label="RTX 50xx">
      <option value="RTX_5060">RTX 5060</option><option value="RTX_5060_Ti">RTX 5060 Ti</option>
      <option value="RTX_5070">RTX 5070</option><option value="RTX_5070_Ti">RTX 5070 Ti</option>
      <option value="RTX_5080">RTX 5080</option><option value="RTX_5090">RTX 5090</option>
      </optgroup>
      <optgroup label="Workstation">
      <option value="RTX_A2000">RTX A2000</option><option value="RTX_A4000">RTX A4000</option>
      <option value="RTX_A5000">RTX A5000</option><option value="RTX_A6000">RTX A6000</option>
      <option value="RTX_4000Ada">RTX 4000Ada</option><option value="RTX_4500Ada">RTX 4500Ada</option>
      <option value="RTX_5000Ada">RTX 5000Ada</option><option value="RTX_5880Ada">RTX 5880Ada</option>
      <option value="RTX_6000Ada">RTX 6000Ada</option>
      </optgroup>
      <optgroup label="Datacenter">
      <option value="A40">A40</option><option value="A100_PCIE">A100 PCIE</option>
      <option value="A100_SXM4">A100 SXM4</option><option value="L4">L4</option>
      <option value="L40">L40</option><option value="L40S">L40S</option>
      <option value="H100_PCIE">H100 PCIE</option><option value="H100_SXM">H100 SXM</option>
      <option value="H100_NVL">H100 NVL</option><option value="H200_NVL">H200 NVL</option>
      </optgroup>
      <optgroup label="Legacy / Tesla">
      <option value="Tesla_P40">Tesla P40</option><option value="Tesla_P100">Tesla P100</option>
      <option value="Tesla_T4">Tesla T4</option><option value="Tesla_V100">Tesla V100</option>
      <option value="Titan_RTX">Titan RTX</option><option value="Titan_V">Titan V</option>
      <option value="Titan_Xp">Titan Xp</option>
      </optgroup>
    </select>
    <input name=maxdph placeholder="max $/h (e.g. 0.08)" style="width:130px">
    <button>search</button>
    <span id=mstat class=dim></span>
  </form>
  <div id=offers></div>
</div>
<script>
setTimeout(()=>location.reload(),30000);
function run(f,id){{fetch('api/exec?id='+id+'&cmd='+encodeURIComponent(f.cmd.value)).then(r=>r.text()).then(alert);return false}}
function launch(id,m){{if(!confirm('launch '+m+' on '+id+'?'))return;
  fetch('api/launch?id='+id+'&m='+m,{{method:'POST'}}).then(r=>r.text()).then(alert)}}
function stop(id,m){{if(!confirm('stop '+m+' on '+id+'?'))return;
  fetch('api/stop?id='+id+'&m='+m,{{method:'POST'}}).then(r=>r.text()).then(alert)}}
function logs(id,src){{fetch('api/logs?id='+id+'&src='+src).then(r=>r.text()).then(t=>{{
  const w=window.open('','_blank');w.document.write('<pre style="background:#0b0e14;color:#cfd8e3;padding:16px;white-space:pre-wrap;font:12px monospace">'+t.replace(/</g,'&lt;')+'</pre>')}})}}
function offers(){{const f=document.forms[document.forms.length-1]||document.querySelector('#market form');
  const g=f.gpu.value,d=f.maxdph.value;
  document.getElementById('mstat').textContent=' searching…';
  fetch('api/offers?gpu='+g+'&max_dph='+d).then(r=>r.json()).then(os=>{{
    let h='<table><tr><th>offer</th><th>gpu</th><th>$/h</th><th>$/day</th><th>inet↓↑</th><th>reliab</th><th>cuda</th><th>ram</th><th>location</th><th></th></tr>';
    for(const o of os)h+=`<tr><td>${{o.id}}</td><td>${{o.gpu_name}}</td><td>${{o.dph_total.toFixed(4)}}</td><td>${{(o.dph_total*24).toFixed(2)}}</td><td>${{Math.round(o.inet_down)}}/${{Math.round(o.inet_up)}}</td><td>${{(o.reliability*100).toFixed(1)}}%</td><td>${{o.cuda_max_good}}</td><td>${{Math.round(o.cpu_ram/1024)}}G</td><td>${{o.geolocation}}</td><td><button class=rent onclick="rent(${{o.id}})">rent</button></td></tr>`;
    document.getElementById('offers').innerHTML=h+'</table>';
    document.getElementById('mstat').textContent=' '+os.length+' offers';
  }});return false}}
function rent(oid){{if(!confirm('RENT offer '+oid+'? this bills your vast.ai account!'))return;
  fetch('api/rent?id='+oid,{{method:'POST'}}).then(r=>r.text()).then(t=>{{alert(t);location.reload()}})}}
</script>"""


_serve_cache = {"ts": 0.0, "rigs": []}
SERVE_CACHE_TTL = 30.0


def cached_rigs():
    if time.time() - _serve_cache["ts"] > SERVE_CACHE_TTL:
        _serve_cache["rigs"] = status_all()
        _serve_cache["ts"] = time.time()
    return _serve_cache["rigs"]


def readonly():
    return os.environ.get("VASTCTL_READONLY") == "1"


def same_origin_request(origin, host):
    if not origin or not host:
        return False
    parsed = urlparse(origin)
    return (
        parsed.scheme in {"http", "https"}
        and bool(parsed.netloc)
        and parsed.netloc.lower() == host.lower()
        and not parsed.username
        and not parsed.password
        and parsed.path in {"", "/"}
        and not parsed.query
        and not parsed.fragment
    )


def inference_action(action, query):
    import io
    import vast_inference

    instance_id = query.get("id", [""])[0]
    if action == "deploy":
        if query.get("confirm") != ["1"]:
            raise ValueError("deployment requires explicit confirmation")
        args = argparse.Namespace(
            name=query.get("name", [vast_inference.DEFAULT_CONTAINER])[0],
            port=int(query.get("port", [vast_inference.REMOTE_API_PORT])[0]),
            gpu_memory_utilization=float(
                query.get("gpu_memory_utilization", [
                    str(vast_inference.DEFAULT_GPU_MEMORY_UTILIZATION)
                ])[0]
            ),
            max_model_len=int(query.get("max_model_len", [
                str(vast_inference.DEFAULT_MAX_MODEL_LEN)
            ])[0]),
            model=query.get("model", [""])[0],
            image=query.get("image", [vast_inference.DEFAULT_VLLM_IMAGE])[0],
        )
        script = vast_inference.build_deploy_script(args)
    elif action == "status":
        name = query.get("name", [vast_inference.DEFAULT_CONTAINER])[0]
        port = int(query.get("port", [str(vast_inference.REMOTE_API_PORT)])[0])
        script = vast_inference.build_status_script(name, port)
    elif action == "stop":
        if query.get("confirm") != ["1"]:
            raise ValueError("stopping inference requires explicit confirmation")
        name = query.get("name", [vast_inference.DEFAULT_CONTAINER])[0]
        script = vast_inference.build_stop_script(name)
    elif action == "chat":
        port = int(query.get("port", [str(vast_inference.REMOTE_API_PORT)])[0])
        prompt = query.get("prompt", [""])[0].strip()
        if not prompt:
            raise ValueError("prompt required")
        max_tok = int(query.get("max_tokens", ["256"])[0])
        script = (
            f'MODEL=$(curl -sS -m 10 http://127.0.0.1:{port}/v1/models '
            "| python3 -c 'import sys,json;"
            'print(json.load(sys.stdin)["data"][0]["id"])\' 2>/dev/null)\n'
            '[ -z "$MODEL" ] && echo "no model loaded on this rig" && exit 1\n'
            'echo "model: $MODEL"\n'
            'PAYLOAD=$(python3 -c \'import sys,json;print(json.dumps({'
            '"model":sys.argv[1],'
            '"messages":[{"role":"user","content":sys.argv[2]}],'
            '"max_tokens":int(sys.argv[3]),"temperature":0.7}))\' '
            f'"$MODEL" {shlex.quote(prompt)} {max_tok})\n'
            f"curl -sS -m 180 http://127.0.0.1:{port}/v1/chat/completions "
            '-H \'Content-Type: application/json\' -d "$PAYLOAD"'
            " | python3 -c 'import sys,json\n"
            "try:\n"
            " d=json.load(sys.stdin)\n"
            " c=d[\"choices\"][0]\n"
            " print(c[\"message\"][\"content\"])\n"
            " u=d.get(\"usage\",{})\n"
            " if u: print(f\"\\n-- {u.get('completion_tokens','?')} tok out / {u.get('prompt_tokens','?')} in\")\n"
            "except Exception:\n"
            " print(\"(no/invalid reply)\")'\n"
        )
    elif action == "tunnel":
        local_port = int(query.get("local_port", [
            str(vast_inference.REMOTE_API_PORT)
        ])[0])
        remote_port = int(query.get("remote_port", [
            str(vast_inference.REMOTE_API_PORT)
        ])[0])
        instance = vast_inference.get_running_instance(instance_id)
        command = vast_inference.tunnel_command(instance, local_port, remote_port)
        return (
            f"{command}\n"
            f"LLM_BASE_URL=http://127.0.0.1:{local_port}/v1",
            200,
        )
    else:
        raise ValueError("unknown inference action")

    instance = vast_inference.get_running_instance(instance_id)
    stdout, stderr = io.StringIO(), io.StringIO()
    with redirect_stdout(stdout), redirect_stderr(stderr):
        rc = vast_inference.execute_ssh(instance, script)
    output = (stdout.getvalue() + stderr.getvalue()).strip()
    return output or f"(exit {rc})", (200 if rc == 0 else 502)


class Handler(BaseHTTPRequestHandler):
    cfg_path = DEFAULT_XMRIG_CONFIG

    def log_message(self, *a):
        pass

    def _send(self, body, code=200, ctype="text/html; charset=utf-8"):
        b = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/api/status":
            self._send(json.dumps(snapshot_from(cached_rigs())), ctype="application/json")
        elif u.path == "/api/ai/status":
            try:
                self._send(json.dumps(ai_status()), ctype="application/json")
            except ValueError as e:
                self._send(json.dumps({"error": str(e)}), 500, "application/json")
            except (SystemExit, json.JSONDecodeError) as e:
                self._send(json.dumps({"error": str(e)}), 502, "application/json")
        elif u.path == "/api/offers":
            try:
                os_ = search_offers(q.get("gpu", ["RTX_3060"])[0],
                                    q.get("max_dph", [None])[0] or None)
                keep = ("id", "gpu_name", "dph_total", "geolocation", "inet_down",
                        "inet_up", "reliability", "cuda_max_good", "cpu_ram",
                        "disk_space", "num_gpus", "total_flops", "verification")
                self._send(json.dumps([{k: o.get(k) for k in keep} for o in os_]),
                           ctype="application/json")
            except SystemExit as e:
                self._send(json.dumps({"error": str(e)}), 500, "application/json")
        elif u.path == "/api/logs":
            iid = q.get("id", [""])[0]
            src = q.get("src", ["all"])[0]
            inst = [i for i in instances() if str(i["id"]) == iid]
            if not inst:
                self._send("bad request", 400, "text/plain")
                return
            if src == "zion":
                script = '''
tmux capture-pane -t zion -p 2>/dev/null | tail -40
[ -f /root/zion.log ] && echo "=== /root/zion.log ===" && tail -40 /root/zion.log
'''
            elif src == "srb":
                script = '''
for s in srb-qtu srb-prl; do tmux capture-pane -t "$s" -p 2>/dev/null | tail -25 | sed "s/^/[$s] /"; done
for f in /root/srb-*.log; do [ -f "$f" ] && echo "=== $f ===" && tail -20 "$f"; done
'''
            elif src == "xmr":
                script = '[ -f /root/xmrig.log ] && tail -45 /root/xmrig.log'
            else:
                script = '''
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index}' 2>/dev/null | while read p; do echo "=== $p ==="; tmux capture-pane -t "$p" -p 2>/dev/null | tail -18; done
for f in /root/zion.log /root/xmrig.log /root/srb-*.log /root/miner*.log; do [ -f "$f" ] && echo "=== $f ===" && tail -15 "$f"; done
'''
            rc, out, err = ssh(inst[0], script, timeout=40)
            self._send((out + err).strip() or f"(exit {rc})", ctype="text/plain")
        elif u.path == "/api/exec":
            if readonly():
                self._send("readonly mode", 403, "text/plain")
                return
            iid, cmd = q.get("id", [""])[0], q.get("cmd", [""])[0]
            inst = [i for i in instances() if str(i["id"]) == iid]
            if not inst or not cmd:
                self._send("bad request", 400, "text/plain")
                return
            rc, out, err = ssh(inst[0], cmd, timeout=60)
            self._send((out + err).strip() or f"(exit {rc})", ctype="text/plain")
        else:
            self._send(render_dashboard(cached_rigs(), time.strftime("%H:%M:%S")))

    def do_POST(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path.startswith("/api/inference/"):
            if readonly():
                self._send("readonly mode", 403, "text/plain")
                return
            if not same_origin_request(
                    self.headers.get("Origin"), self.headers.get("Host")):
                self._send("same-origin request required", 403, "text/plain")
                return
            action = u.path.removeprefix("/api/inference/")
            try:
                body, code = inference_action(action, q)
                self._send(body, code, "text/plain; charset=utf-8")
            except ValueError as e:
                self._send(str(e), 400, "text/plain; charset=utf-8")
            except (SystemExit, json.JSONDecodeError) as e:
                self._send(f"Vast instance lookup failed: {e}",
                           502, "text/plain; charset=utf-8")
        elif u.path == "/api/deploy-xmrig":
            if readonly():
                self._send("readonly mode", 403, "text/plain")
                return
            iid = q.get("id", [""])[0]
            try:
                ns = argparse.Namespace(id=iid, config=self.cfg_path)
                import io, contextlib
                buf = io.StringIO()
                with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                    cmd_deploy_xmrig(ns)
                self._send(buf.getvalue(), ctype="text/plain")
            except SystemExit as e:
                self._send(f"failed: {e}", 500, "text/plain")
            except Exception as e:
                self._send(f"failed: {e}", 500, "text/plain")
        elif u.path == "/api/launch":
            if readonly():
                self._send("readonly mode", 403, "text/plain")
                return
            iid, mn = q.get("id", [""])[0], q.get("m", [""])[0]
            duty = None
            p_, q_ = q.get("prl", [None])[0], q.get("qtu", [None])[0]
            if p_ is not None and q_ is not None:
                try:
                    duty = (max(0, min(100, int(p_))), max(0, min(100, int(q_))))
                except ValueError:
                    duty = None
            try:
                ns = argparse.Namespace(id=iid, miners=[mn], duty=duty,
                                        config=self.cfg_path)
                import io, contextlib
                buf = io.StringIO()
                with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                    cmd_launch(ns)
                self._send(buf.getvalue(), ctype="text/plain")
            except SystemExit as e:
                self._send(f"failed: {e}", 500, "text/plain")
            except Exception as e:
                self._send(f"failed: {e}", 500, "text/plain")
        elif u.path == "/api/stop":
            if readonly():
                self._send("readonly mode", 403, "text/plain")
                return
            iid, mn = q.get("id", [""])[0], q.get("m", [""])[0]
            try:
                ns = argparse.Namespace(id=iid, miners=[mn])
                import io, contextlib
                buf = io.StringIO()
                with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                    cmd_stop(ns)
                self._send(buf.getvalue(), ctype="text/plain")
            except SystemExit as e:
                self._send(f"failed: {e}", 500, "text/plain")
            except Exception as e:
                self._send(f"failed: {e}", 500, "text/plain")
        elif u.path == "/api/rent":
            if readonly():
                self._send("readonly mode", 403, "text/plain")
                return
            oid = q.get("id", [""])[0]
            try:
                ns = argparse.Namespace(offer_id=oid, image=RENT_IMAGE,
                                        disk=20, label="")
                import io, contextlib
                buf = io.StringIO()
                with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                    cmd_rent(ns)
                self._send(buf.getvalue(), ctype="text/plain")
            except SystemExit as e:
                self._send(f"failed: {e}", 500, "text/plain")
            except Exception as e:
                self._send(f"failed: {e}", 500, "text/plain")
        else:
            self._send("not found", 404, "text/plain")


def cmd_serve(args):
    Handler.cfg_path = args.config
    srv = ThreadingHTTPServer((args.bind, args.port), Handler)
    print(f"vastctl dashboard → http://{args.bind}:{args.port}  (ctrl-c to stop)")
    srv.serve_forever()


def main():
    ap = argparse.ArgumentParser(prog="vastctl", description=__doc__)
    ap.add_argument("--config", default=DEFAULT_XMRIG_CONFIG,
                    help="xmrig config json for deploy-xmrig/serve")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("status")
    p.add_argument("id", nargs="*")
    p = sub.add_parser("serve")
    p.add_argument("--port", type=int, default=8088)
    p.add_argument("--bind", default="127.0.0.1")
    p = sub.add_parser("deploy-xmrig")
    p.add_argument("id")
    p = sub.add_parser("exec")
    p.add_argument("id")
    p.add_argument("cmd", nargs=argparse.REMAINDER)
    p = sub.add_parser("logs")
    p.add_argument("id")
    p = sub.add_parser("offers", help="search vast.ai offers, cheapest first")
    p.add_argument("--gpu", default="RTX_3060",
                   help="gpu_name filter or 'any'")
    p.add_argument("--max-dph", type=float, default=None)
    p.add_argument("--limit", type=int, default=30)
    p = sub.add_parser("rent", help="rent an offer → ssh instance")
    p.add_argument("offer_id")
    p.add_argument("--image", default=RENT_IMAGE)
    p.add_argument("--disk", type=int, default=20)
    p.add_argument("--label", default="")
    p = sub.add_parser("launch", help="start miners on a rig (tmux)")
    p.add_argument("id")
    p.add_argument("miners", nargs="+",
                   help="full|zion|zionmax|prl|qtu|srb|srb-prl|srb-qtu|xmr|all")
    p = sub.add_parser("stop", help="stop miners on a rig")
    p.add_argument("id")
    p.add_argument("miners", nargs="+",
                   help="zion|srb|srb-prl|srb-qtu|xmr|all")
    p = sub.add_parser("daemon")
    p.add_argument("--interval", type=int, default=60)
    p.add_argument("--json-out", default="status.json")
    p.add_argument("--push", default="",
                   help="scp target host:/path for the status json (e.g. root@edge:/var/www/site/vast-rigs/status.json)")
    p.add_argument("--autodeploy-xmrig", action="store_true",
                   help="auto-deploy+launch xmrig on rigs that don't run it")
    p.add_argument("--watchdog", action="store_true",
                   help="relaunch miners that died (remembers last launch per rig; "
                        "stop clears intent; skips rigs with unreachable pools)")
    args = ap.parse_args()
    if args.cmd == "status":
        return cmd_status(args)
    if args.cmd == "serve":
        return cmd_serve(args)
    if args.cmd == "deploy-xmrig":
        return cmd_deploy_xmrig(args)
    if args.cmd == "exec":
        return cmd_exec(args)
    if args.cmd == "logs":
        return cmd_logs(args)
    if args.cmd == "offers":
        return cmd_offers(args)
    if args.cmd == "rent":
        return cmd_rent(args)
    if args.cmd == "launch":
        return cmd_launch(args)
    if args.cmd == "stop":
        return cmd_stop(args)
    if args.cmd == "daemon":
        return cmd_daemon(args)


if __name__ == "__main__":
    sys.exit(main() or 0)
