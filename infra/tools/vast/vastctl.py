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
import base64
import html
import json
import os
import re
import shlex
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import uuid
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


HIRAN_API = os.environ.get("VASTCTL_HIRAN_API", "http://127.0.0.1:8003")


def hiran_probe():
    """SMOS rig llama.cpp (Hiran) via Edge-tunnel loopback :8003."""
    try:
        d = _http_json(f"{HIRAN_API}/v1/models", timeout=8)
        models = [m.get("id") for m in d.get("data", []) if isinstance(m, dict)]
        return {"reachable": True, "models": models, "model": models[0] if models else None}
    except Exception:
        return {"reachable": False, "models": [], "model": None}


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
        "hiran": hiran_probe(),
        "note": (
            "VRAM totals are inventory only. GPUs on separate Vast hosts do not "
            "form shared memory for one model."
        ),
    }


# Curated vLLM-ready model catalog. vLLM pulls weights from HuggingFace
# on the rig at deploy time — this is metadata only.
# Tiered by VRAM. `vram_gb` = approx weights footprint (bf16 ≈ 2 GB/1B;
# AWQ ≈ 4-bit, FP8 ≈ 8-bit, MXFP4 native). `latest_vllm` marks models the
# pinned v0.8.5 image cannot load — auto-deploy passes `image` then.
# `internal` marks ZION's own Hiran weights — served via llama.cpp
# (hiran-core / SMOS rig), not deployable through vLLM.
MODEL_CATALOG = [
    # ── internal: Hiran family (ZION's own GGUF builds, llama.cpp) ──
    # Named after the corpus figures; see HIRAN-MARKETPLACE-PLAN.md.
    # live  = served now (hiran-core PC / SMOS llama.cpp / EDGE2 CPU)
    # mockup = planned fine-tune, shown for roadmap visibility
    {"hf": "zion/hiran-v2.3mini-Q5_K_M", "params": "8B", "vram_gb": 6,
     "tags": ["hiran", "gguf", "chat", "live"], "internal": True,
     "desc": "Qwen3-8B + LoRA r32/a64 · live on hiran-core + EDGE2 fallback"},
    {"hf": "zion/hiran-amitabha-Q4_K_M", "params": "14B", "vram_gb": 9,
     "tags": ["hiran", "gguf", "thinking"], "internal": True, "mockup": True,
     "desc": "\"the Voice\" — deep reasoning tier, planned on Qwen3-14B"},
    {"hf": "zion/hiran-issobella-Q4_K_M", "params": "30B MoE", "vram_gb": 19,
     "tags": ["hiran", "gguf", "code", "agentic"], "internal": True,
     "mockup": True,
     "desc": "code/agentic tier, planned on Qwen3-Coder-30B-A3B GGUF"},
    {"hf": "zion/hiran-maitreya-Q5_K_M", "params": "27B", "vram_gb": 20,
     "tags": ["hiran", "gguf", "rag", "lore"], "internal": True,
     "mockup": True,
     "desc": "teacher/oracle over the book corpus, planned on gemma-4/27B"},
    # ── ≤10 GB — runs beside dual mining ──
    {"hf": "Qwen/Qwen3-4B-Instruct-2507", "params": "4B", "vram_gb": 9,
     "tags": ["chat"], "desc": "2507 refresh · fast beside mining"},
    {"hf": "google/gemma-3-4b-it", "params": "4B", "vram_gb": 9,
     "tags": ["chat", "vision"], "desc": "google small, multimodal"},
    {"hf": "Qwen/Qwen3-8B-AWQ", "params": "8B", "vram_gb": 6,
     "tags": ["thinking", "reasoning"], "desc": "hybrid thinking on 12 GB"},
    {"hf": "Qwen/Qwen3-14B-AWQ", "params": "14B", "vram_gb": 10,
     "tags": ["thinking", "reasoning"], "desc": "best quality on consumer GPU"},
    # ── 12-20 GB ──
    {"hf": "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B", "params": "8B", "vram_gb": 16,
     "tags": ["reasoning"], "desc": "R1 reasoning distilled into Qwen3"},
    {"hf": "openai/gpt-oss-20b", "params": "21B MoE", "vram_gb": 14,
     "tags": ["chat", "tools"], "latest_vllm": True,
     "desc": "OpenAI open weights, MXFP4 native (needs latest vLLM)"},
    {"hf": "LiquidAI/LFM2.5-8B-A1B", "params": "8B MoE", "vram_gb": 16,
     "tags": ["chat", "fast"], "latest_vllm": True,
     "desc": "edge MoE, fastest tok/s per GB"},
    {"hf": "microsoft/phi-4", "params": "14B", "vram_gb": 28,
     "tags": ["reasoning"], "desc": "strong STEM reasoning"},
    # ── 24-48 GB (4090/A5000 class) ──
    {"hf": "Qwen/Qwen3-32B-AWQ", "params": "32B", "vram_gb": 19,
     "tags": ["thinking", "reasoning"], "desc": "single 4090-class card"},
    {"hf": "Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8", "params": "30B MoE",
     "vram_gb": 31, "tags": ["code", "agentic"], "latest_vllm": True,
     "desc": "coding daily driver, 3B active params"},
    {"hf": "mistralai/Devstral-Small-2-24B-Instruct-2512", "params": "24B",
     "vram_gb": 48, "tags": ["code", "agentic"], "latest_vllm": True,
     "desc": "agentic coding, Dec 2025"},
    # ── 48 GB+ (A100/H100) ──
    {"hf": "Qwen/Qwen3.8-27B", "params": "27B", "vram_gb": 54,
     "tags": ["thinking", "reasoning"], "latest_vllm": True,
     "desc": "current-cycle flagship dense"},
    {"hf": "google/gemma-4-31B-it", "params": "31B", "vram_gb": 62,
     "tags": ["chat", "vision"], "latest_vllm": True,
     "desc": "Gemma 4 gen, Apr 2026"},
    {"hf": "zai-org/GLM-4.7-Flash", "params": "30B MoE", "vram_gb": 60,
     "tags": ["chat", "tools"], "latest_vllm": True,
     "desc": "Z.ai flash MoE, current gen"},
]

LATEST_VLLM_IMAGE = "vllm/vllm-openai:latest"

_HF_CACHE = {"ts": 0.0, "q": "", "data": None}


def hf_search(query, limit=12):
    """Live HuggingFace search proxy — find any text-generation model."""
    query = (query or "").strip()
    if not query:
        return []
    if (_HF_CACHE["data"] is not None and _HF_CACHE["q"] == query
            and time.time() - _HF_CACHE["ts"] < 120):
        return _HF_CACHE["data"]
    url = ("https://huggingface.co/api/models?"
           f"search={urllib.parse.quote(query)}&filter=text-generation"
           f"&sort=likes&direction=-1&limit={int(limit)}")
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "vastctl/1.0"})
        with urllib.request.urlopen(req, timeout=12) as r:
            raw = json.loads(r.read().decode())
    except Exception as e:
        raise SystemExit(f"hf search failed: {e}")
    out = []
    for m in raw:
        if not isinstance(m, dict) or not m.get("id"):
            continue
        out.append({
            "hf": m["id"],
            "likes": m.get("likes", 0),
            "downloads": m.get("downloads", 0),
            "gated": bool(m.get("gated")),
            "tags": [t for t in (m.get("tags") or [])
                     if t in {"gguf", "vllm", "awq", "gptq", "text-generation"}],
        })
    _HF_CACHE.update({"ts": time.time(), "q": query, "data": out})
    return out


_AI_CACHE = {"ts": 0.0, "data": None}


def ai_status_cached(ttl=30):
    if _AI_CACHE["data"] is None or time.time() - _AI_CACHE["ts"] > ttl:
        _AI_CACHE["data"] = ai_status()
        _AI_CACHE["ts"] = time.time()
    return _AI_CACHE["data"]


def model_endpoints():
    """Unified inventory of loaded models across Vast vLLM rigs + Hiran."""
    eps = []
    for rig in ai_status_cached()["rigs"]:
        if rig["inference_reachable"]:
            free_mib = sum(g["memory_free_mib"] for g in rig["gpus"])
            for m in rig["models"]:
                eps.append({"model": m, "kind": "vast", "rig": rig["id"],
                            "free_mib": free_mib})
    for m in (hiran_probe().get("models") or []):
        eps.append({"model": m, "kind": "hiran", "rig": None, "free_mib": None})
    return eps


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


SMOS_ACTIONS = ("reboot", "pause", "resume", "reload", "shutdown",
                "command", "rig-detect", "rig-gpu-detect", "clear-counter")


def _smos_req(method, path, body=None):
    import urllib.request
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{SMOS_BASE}{path}", data=data, method=method,
        headers={"X-AUTH-TOKEN": SMOS_API_KEY,
                 "Content-Type": "application/merge-patch+json",
                 "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode()


def smos_action(rig_id, action, extra=None):
    """PATCH /rigs/execute-<action> {rigIds:[id]}. Returns response text."""
    if not SMOS_API_KEY:
        raise SystemExit("VASTCTL_SMOS_KEY not configured")
    if action not in SMOS_ACTIONS:
        raise ValueError(f"bad action {action!r}; one of {SMOS_ACTIONS}")
    body = {"rigIds": [int(rig_id)]}
    if extra:
        body.update(extra)
    return _smos_req("PATCH", f"/rigs/execute-{action}", body) or "ok"


def smos_console(rig_id):
    """GET /rigs/{id}/console → decoded plain-text miner console."""
    if not SMOS_API_KEY:
        raise SystemExit("VASTCTL_SMOS_KEY not configured")
    raw = _smos_req("GET", f"/rigs/{int(rig_id)}/console")
    try:
        htmltxt = base64.b64decode(json.loads(raw)["console"]).decode("utf-8", "replace")
    except Exception:
        return raw
    # strip tags → readable console text
    txt = re.sub(r"<br\s*/?>", "\n", htmltxt)
    txt = re.sub(r"</p>", "\n", txt)
    txt = re.sub(r"<[^>]+>", "", txt)
    import html as _h
    return _h.unescape(txt)


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


def _http_post(url, payload, timeout=180):
    import urllib.request
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode()


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


_HR_UNITS = {"h/s": 1.0, "kh/s": 1e3, "mh/s": 1e6, "gh/s": 1e9, "th/s": 1e12, "ph/s": 1e15}


def _attach_rig_hashrate(rigs, pool_miners):
    """Give external-coin pool workers a real hashrate.

    The pool's telemetry estimator only covers the ZION difficulty scale, so
    PRL/QTU workers come back with hps=0 (the comment in
    telemetry::record_external_share says so explicitly). The rig monitor
    already knows the true rate because it is read straight from the
    miner, so map the pool worker onto the rig worker by suffix.
    """
    if not pool_miners:
        return
    rig_hr = {}
    for r in rigs or []:
        for m in r.get("miners", []):
            hr = m.get("hashrate") or {}
            rate = hr.get("rate")
            unit = (hr.get("unit") or "").lower()
            if not rate or unit not in _HR_UNITS:
                continue
            w = m.get("worker") or ""
            if w:
                rig_hr[w] = rate * _HR_UNITS[unit]
    for pm in pool_miners:
        w = pm.get("worker") or ""
        if not w:
            continue
        for rw, hps in rig_hr.items():
            if w.endswith(rw) or rw in w:
                pm["hps"] = hps
                pm["hps_1h"] = hps
                pm["rig_worker"] = rw
                break


_LAST = {}          # section name → last-good payload (per-process)


def _section(name, fn, fresh, errors):
    """Fetch one snapshot section; on failure reuse the last-good payload.

    `fresh[name]` is True only when this call returned live data, so the
    dashboard can flag sections serving cached values. A clean ``None``
    (unconfigured source, API timeout inside the fetcher) also falls back
    to last-good when one exists; an exception is recorded in ``errors``.
    """
    try:
        val = fn()
    except BaseException as e:      # SystemExit from instances() too
        errors[name] = str(e)[:300]
        val = None
    if val is not None:
        _LAST[name] = val
        fresh[name] = True
        return val
    fresh[name] = False
    return _LAST.get(name)


def _build_snapshot(rigs, fresh, errors):
    pool_miners = _section("pool", fetch_pool_miners, fresh, errors)
    _attach_rig_hashrate(rigs, pool_miners or [])
    snap = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "total_dph": round(sum(r["dph"] for r in rigs), 4),
        "rigs": rigs,
        "pool": pool_miners,
        "poolstats": _section("poolstats", fetch_pool_stats, fresh, errors),
        "smos": _section("smos", fetch_smos_rigs, fresh, errors),
        "ext": _section("ext", fetch_ext_pools, fresh, errors),
        "agents": _section("agents", _agent_fleet_section, fresh, errors),
        "fresh": fresh,
    }
    if errors:
        snap["errors"] = errors
    return snap


def snapshot(ids=None):
    fresh, errors = {}, {}
    try:
        rigs = status_all(ids)
        _LAST["rigs"] = rigs
        fresh["rigs"] = True
    except BaseException as e:
        # vast.ai API/CLI outage must not kill the whole snapshot — keep
        # publishing pool/smos/ext legs and reuse the last-good fleet list
        errors["rigs"] = str(e)[:300]
        rigs = _LAST.get("rigs") or []
        fresh["rigs"] = False
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

    return _build_snapshot(rigs, fresh, errors)


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


def snapshot_from(rigs, rigs_live=True):
    fresh, errors = {}, {}
    fresh["rigs"] = rigs_live
    if not rigs_live:
        errors["rigs"] = "rig probe failed — serving cached fleet"
    return _build_snapshot(rigs, fresh, errors)


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
    daemon_state = {"pid": os.getpid(), "cycle": 0, "interval_s": args.interval,
                    "last_error": None}
    while True:
        try:
            t0 = time.time()
            snap = snapshot()
            daemon_state["cycle"] += 1
            snap["daemon"] = dict(daemon_state,
                                  cycle_ms=int((time.time() - t0) * 1000))
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
            daemon_state["last_error"] = str(e)[:300]
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


_serve_cache = {"ts": 0.0, "ok_ts": 0.0, "rigs": []}
SERVE_CACHE_TTL = 30.0


def cached_rigs():
    """Fleet list for the serve endpoints — keeps last-good on probe failure
    so /api/status degrades to a marked-stale snapshot instead of a 500."""
    if time.time() - _serve_cache["ts"] > SERVE_CACHE_TTL:
        _serve_cache["ts"] = time.time()
        try:
            _serve_cache["rigs"] = status_all()
            _serve_cache["ok_ts"] = _serve_cache["ts"]
        except BaseException:
            pass
    return _serve_cache["rigs"]


def rigs_cache_live():
    """True when the cached fleet list was refreshed by the last attempt."""
    c = _serve_cache
    return c["ok_ts"] == c["ts"] and c["ok_ts"] > 0


# ── fleet agent registry (push-model, 2.B11) ──────────────────────────
# Agents POST heartbeats + poll tasks instead of being SSH-probed, so rigs
# behind NAT stay manageable. Auth: per-rig `Bearer rig_id:secret` issued
# by /api/agent/enroll (preferred), or the shared VASTCTL_AGENT_TOKEN
# bearer (legacy). With neither configured the endpoints fail closed.
AGENT_DB_FILE = os.environ.get(
    "VASTCTL_AGENT_DB",
    os.path.expanduser("~/.local/share/vastctl-agents.json"))
AGENT_TASK_TTL_S = int(os.environ.get("VASTCTL_AGENT_TASK_TTL", "3600"))
AGENT_RESULT_KEEP = 50
AGENT_EVENTS_KEEP = 200
_agents_lock = threading.Lock()
_agents_cache = None


def _agent_db():
    """Lazy registry: {rigs: {rid: {heartbeat, tasks, results}}}."""
    global _agents_cache
    if _agents_cache is None:
        try:
            _agents_cache = json.loads(Path(AGENT_DB_FILE).read_text())
        except Exception:
            _agents_cache = {"rigs": {}}
        _agents_cache.setdefault("rigs", {})
        _agents_cache.setdefault("secrets", {})
        _agents_cache.setdefault("events", [])
        _agents_cache.setdefault("desired", {"rigs": {}, "groups": {}})
        _agents_cache.setdefault("catalog", {})
    return _agents_cache


def _agent_event(kind, rig_id, detail=""):
    """Append an audit event — caller must hold _agents_lock."""
    db = _agent_db()
    ev = db.setdefault("events", [])
    ev.append({"ts": time.time(), "kind": kind,
               "rig_id": rig_id, "detail": str(detail)[:500]})
    db["events"] = ev[-AGENT_EVENTS_KEEP:]


def _sha256(s):
    import hashlib
    return hashlib.sha256(s.encode()).hexdigest()


def _agent_token_ok(headers):
    """Returns rig_id bound by the bearer (`rig_id:secret` per-rig auth),
    True for the legacy shared token, or False/None on failure.
    Also accepts X-Ops-Auth: 1 — set by the edge nginx only AFTER basic
    auth passes (/ops-api/). :8088 binds localhost, so the header is not
    client-spoofable over any public path."""
    if headers.get("X-Ops-Auth") == "1":
        return True
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    cred = auth[7:]
    if ":" in cred:
        # per-rig: bearer carries "rig_id:secret" — verify hash, never
        # store the plaintext server-side.
        rid, _, secret = cred.partition(":")
        if not rid or not secret:
            return False
        if _sha256(secret) == _agent_db().get("secrets", {}).get(rid):
            return rid
        return False
    token = os.environ.get("VASTCTL_AGENT_TOKEN", "")
    if token and cred == token:
        return True
    return False


# ── flight sheets / desired state (W3→W4 B3 v1) ────────────────────────
# Sheet = declarative mining assignment resolved per rig:
#   rig override  >  group sheet  >  none
# CP owns the *what*; the rig's local apply hook owns the *how* (vast.ai
# rigs have no systemd and miner launch differs per box).
SHEET_KEYS = {"miner", "coin", "pool", "wallet", "args", "duty", "oc", "group",
              "autopilot"}


def _sheet_hash(sheet):
    return _sha256(json.dumps(sheet, sort_keys=True))[:12]


def agent_set_sheet(kind, name, sheet, catalog=None):
    """Assign a flight sheet to a rig or group (kind=rig|group)."""
    if kind not in {"rig", "group"}:
        raise ValueError("kind must be rig or group")
    if catalog:
        sheet = _agent_db().get("catalog", {}).get(str(catalog))
        if not sheet:
            raise ValueError(f"catalog '{catalog}' not found")
    _validate_sheet(sheet)
    with _agents_lock:
        db = _agent_db()
        desired = db.setdefault("desired", {"rigs": {}, "groups": {}})
        desired[f"{kind}s"][str(name)] = dict(sheet)
        _agent_event("sheet_set", name, f"kind={kind} miner={sheet.get('miner')}")
        _write_json_atomic(AGENT_DB_FILE, db)
        return {"ok": True, "kind": kind, "name": name,
                "hash": _sheet_hash(sheet)}


def agent_clear_sheet(kind, name):
    if kind not in {"rig", "group"}:
        raise ValueError("kind must be rig or group")
    with _agents_lock:
        desired = _agent_db().setdefault("desired", {"rigs": {}, "groups": {}})
        existed = desired[f"{kind}s"].pop(str(name), None)
        _agent_event("sheet_clear", name, f"kind={kind} existed={bool(existed)}")
        _write_json_atomic(AGENT_DB_FILE, _agents_cache)
        return {"ok": True, "cleared": bool(existed)}


def agent_set_group(rig_id, group):
    """Set rig→group membership (sheet resolution picks the group sheet)."""
    with _agents_lock:
        rig = _agent_db()["rigs"].setdefault(
            rig_id, {"heartbeat": {}, "tasks": [], "results": []})
        rig["group"] = str(group or "") or None
        _agent_event("group", rig_id, f"group={group}")
        _write_json_atomic(AGENT_DB_FILE, _agents_cache)
        return {"ok": True, "rig_id": rig_id, "group": rig["group"]}


def _desired_for(db, rig):
    """Resolve the effective sheet for a rig: rig override > group > none."""
    desired = db.get("desired", {})
    sheet = desired.get("rigs", {}).get(rig)
    if sheet:
        return dict(sheet, _scope="rig")
    group = db["rigs"].get(rig, {}).get("group")
    sheet = group and desired.get("groups", {}).get(group)
    if sheet:
        return dict(sheet, _scope="group", _group=group)


def agent_remove_rig(rig_id):
    """Decommission a rig: drops rig state, secret and sheet override."""
    rid = str(rig_id)
    with _agents_lock:
        db = _agent_db()
        existed = db["rigs"].pop(rid, None) is not None
        db.get("secrets", {}).pop(rid, None)
        db.get("desired", {}).get("rigs", {}).pop(rid, None)
        _agent_event("rig_removed", rid, f"existed={existed}")
        _write_json_atomic(AGENT_DB_FILE, db)
        return {"ok": True, "removed": existed}


def _validate_sheet(sheet):
    if not isinstance(sheet, dict):
        raise ValueError("sheet must be an object")
    bad = set(sheet) - SHEET_KEYS
    if bad:
        raise ValueError(f"unknown sheet keys: {sorted(bad)}")
    if not sheet.get("miner"):
        raise ValueError("sheet.miner required")


def agent_catalog_set(name, sheet):
    """Named catalog entry — a vetted preset assignable by name."""
    name = str(name).strip()
    if not name or len(name) > 64 or not re.fullmatch(r"[a-z0-9_-]+", name):
        raise ValueError("catalog name must be [a-z0-9_-]{1,64}")
    _validate_sheet(sheet)
    with _agents_lock:
        db = _agent_db()
        db.setdefault("catalog", {})[name] = dict(sheet)
        _agent_event("catalog_set", name, f"miner={sheet.get('miner')}")
        _write_json_atomic(AGENT_DB_FILE, db)
        return {"ok": True, "name": name, "hash": _sheet_hash(sheet)}


def agent_catalog_clear(name):
    with _agents_lock:
        db = _agent_db()
        existed = db.setdefault("catalog", {}).pop(str(name), None)
        _agent_event("catalog_clear", str(name),
                     f"existed={bool(existed)}")
        _write_json_atomic(AGENT_DB_FILE, db)
        return {"ok": True, "cleared": bool(existed)}


def agent_bulk(target, action):
    """Fan out one action across rigs: target = {rigs:[..]} | {group:n}
    | {all:true}; action = {task:{op,args}} | {sheet:{..}|catalog:name}
    | {clear_sheet:true} | {set_group:name}. Ops-only at the route."""
    with _agents_lock:
        db = _agent_db()
        if target.get("all"):
            rids = sorted(db["rigs"].keys())
        elif target.get("group"):
            g = str(target["group"])
            rids = sorted(r for r, v in db["rigs"].items()
                          if v.get("group") == g)
        else:
            rids = [str(r) for r in target.get("rigs") or []]
        if not rids:
            return {"ok": True, "matched": 0, "results": {}}
        desired = db.setdefault("desired", {"rigs": {}, "groups": {}})
        desired.setdefault("rigs", {})
        results = {}
        now = time.time()
        for rid in rids:
            rig = db["rigs"].setdefault(
                rid, {"heartbeat": {}, "tasks": [], "results": []})
            try:
                if "task" in action:
                    t = action["task"]
                    task = {"id": f"task-{_sec_tok(6)}", "op": str(t["op"]),
                            "args": t.get("args") or {}, "ts": now,
                            "state": "pending", "bulk": True}
                    rig["tasks"].append(task)
                    results[rid] = {"task_id": task["id"]}
                elif "sheet" in action or "catalog" in action:
                    sheet = action.get("sheet") or \
                        db.get("catalog", {}).get(str(action["catalog"]))
                    if not sheet:
                        raise ValueError(
                            f"catalog '{action['catalog']}' not found")
                    _validate_sheet(sheet)
                    desired["rigs"][rid] = dict(sheet)
                    results[rid] = {"hash": _sheet_hash(sheet)}
                elif action.get("clear_sheet"):
                    results[rid] = {
                        "cleared": bool(
                            desired["rigs"].pop(rid, None))}
                elif "set_group" in action:
                    rig["group"] = str(action["set_group"] or "") or None
                    results[rid] = {"group": rig["group"]}
                else:
                    raise ValueError("unknown bulk action")
            except (KeyError, ValueError) as e:
                results[rid] = {"error": str(e)}
        _agent_event("bulk", ",".join(rids),
                     f"action={sorted(action.keys())} matched={len(rids)}")
        _write_json_atomic(AGENT_DB_FILE, db)
        return {"ok": True, "matched": len(rids), "results": results}


def _sec_tok(n):
    import secrets as _s
    return _s.token_hex(n)


AGENT_OFFLINE_AFTER_S = int(
    os.environ.get("VASTCTL_AGENT_OFFLINE_AFTER", "600"))


# ── fleet alerting + profit switching (W7 B5) ─────────────────────────
# Alert state machine runs inside agent_fleet under _agents_lock; fired
# alerts are returned and notified AFTER the lock is released (network I/O
# must never run under the lock — a wedged Telegram endpoint would stall
# heartbeats).
ALERT_GPU_TEMP_C = float(os.environ.get("VASTCTL_ALERT_GPU_TEMP", "85"))
ALERT_GPU_CLEAR_C = float(
    os.environ.get("VASTCTL_ALERT_GPU_CLEAR", str(ALERT_GPU_TEMP_C - 5)))
ALERT_HPS_DROP_PCT = float(
    os.environ.get("VASTCTL_ALERT_HPS_DROP_PCT", "20"))
ALERT_HPS_BASELINE_S = int(
    os.environ.get("VASTCTL_ALERT_HPS_BASELINE_S", "900"))
HPS_RING_KEEP = 60            # ~1 h of samples at the 60 s daemon cadence
HPS_RING_MIN_GAP_S = 30

# sheet.miner → substring expected in the heartbeat `miners` cmdlines.
MINER_PROC = {
    "srbminer-dual": "srbminer", "srbminer": "srbminer",
    "zion-miner": "zion-miner", "zion": "zion-miner",
    "xmrig": "xmrig",
}


def _miner_proc(miner):
    m = str(miner or "").lower()
    return MINER_PROC.get(m, m)


def _gpu_temps(hb):
    """nvidia-smi CSV 'name, util %, temp C, power W, fan %' → [float|None]."""
    temps = []
    for line in hb.get("gpus") or []:
        parts = str(line).split(",")
        m = len(parts) > 2 and re.search(r"[\d.]+", parts[2])
        temps.append(float(m.group(0)) if m else None)
    return temps


def _rig_workers(hb, workers):
    """Pool-side workers belonging to this rig: worker names from the apply
    hook are `vast-{hostname[:12]}` (+ -qtu/-prl suffixes); a bare hostname
    substring match covers custom agent names."""
    hostname = str(hb.get("hostname") or "").lower()[:12]
    if not hostname:
        return []
    frags = (f"vast-{hostname}", hostname)
    return [w for w in workers
            if any(f in str(w.get("worker") or "").lower() for f in frags)]


def _check_alerts(db, now, workers=None):
    """Per-tick alert state machine — caller holds _agents_lock.
    Returns [(kind, rig_id, detail)] fired this tick for notification."""
    fired = []
    changed = False
    for rid, rig in db["rigs"].items():
        hb = rig.get("heartbeat") or {}
        ts = hb.get("server_ts")
        if ts and now - ts > AGENT_OFFLINE_AFTER_S:
            if not rig.get("alerted_offline"):
                rig["alerted_offline"] = True
                _agent_event("alert_offline", rid,
                             f"age_s={int(now - ts)}")
                fired.append(("alert_offline", rid,
                              f"no heartbeat for {int(now - ts)}s"))
                changed = True
            continue
        if not ts:
            continue

        # miner_down — only meaningful once the rig reports it applied the
        # exact sheet we asked for (hash match), and that sheet is active.
        desired = _desired_for(db, rid)
        if desired:
            dhash = _sheet_hash({k: v for k, v in desired.items()
                                 if not k.startswith("_")})
            applied = (hb.get("applied_sheet") or {}).get("hash")
            miner = str(desired.get("miner") or "").lower()
            if applied == dhash and miner not in {"", "none", "stop"}:
                proc = _miner_proc(miner)
                running = any(proc in m.lower()
                              for m in hb.get("miners") or [])
                flag = rig.get("alerted_miner")
                if not running and flag != dhash:
                    rig["alerted_miner"] = dhash
                    _agent_event("alert_miner_down", rid,
                                 f"miner={miner} sheet={dhash}")
                    fired.append(("alert_miner_down", rid,
                                  f"{miner} not running "
                                  f"(applied sheet {dhash})"))
                    changed = True
                elif running and flag == dhash:
                    rig.pop("alerted_miner", None)
                    _agent_event("alert_miner_recovered", rid,
                                 f"miner={miner}")
                    fired.append(("alert_miner_recovered", rid,
                                  f"{miner} is running again"))
                    changed = True
            elif miner in {"", "none", "stop"}:
                if rig.pop("alerted_miner", None):
                    changed = True

        # gpu_temp — per-GPU dedup, clear needs hysteresis below threshold.
        alerted = rig.setdefault("alerted_temp", {})
        for i, t in enumerate(_gpu_temps(hb)):
            if t is None:
                continue
            k = str(i)
            if t >= ALERT_GPU_TEMP_C and not alerted.get(k):
                alerted[k] = True
                _agent_event("alert_gpu_temp", rid,
                             f"gpu{i}={t:.0f}C>={ALERT_GPU_TEMP_C:.0f}C")
                fired.append(("alert_gpu_temp", rid,
                              f"GPU{i} at {t:.0f}°C "
                              f"(limit {ALERT_GPU_TEMP_C:.0f}°C)"))
                changed = True
            elif t <= ALERT_GPU_CLEAR_C and alerted.pop(k, None):
                _agent_event("alert_temp_recovered", rid,
                             f"gpu{i}={t:.0f}C")
                fired.append(("alert_temp_recovered", rid,
                              f"GPU{i} back to {t:.0f}°C"))
                changed = True

        # hashrate_drop — pool-side hashrate vs this rig's own baseline
        # (rolling max of same-sheet samples older than the baseline
        # window, so a sheet switch cannot inherit a stale baseline).
        if workers is not None:
            rig_hps = sum(w.get("hps") or 0 for w in _rig_workers(hb, workers))
            sheet_hash = ((hb.get("applied_sheet") or {}).get("hash")) or "?"
            ring = rig.setdefault("hps_ring", [])
            if not ring or now - ring[-1]["ts"] >= HPS_RING_MIN_GAP_S:
                ring.append({"ts": now, "hps": rig_hps,
                             "sheet": sheet_hash})
                rig["hps_ring"] = ring[-HPS_RING_KEEP:]
                changed = True
            base_samples = [s["hps"] for s in ring
                            if s["sheet"] == sheet_hash
                            and s["ts"] <= now - ALERT_HPS_BASELINE_S]
            if len(base_samples) >= 4:
                baseline = max(base_samples)
                floor = baseline * (1 - ALERT_HPS_DROP_PCT / 100)
                if baseline > 0 and rig_hps < floor \
                        and not rig.get("alerted_hps"):
                    rig["alerted_hps"] = True
                    _agent_event("alert_hashrate_drop", rid,
                                 f"hps={rig_hps:.0f} base={baseline:.0f}")
                    fired.append(("alert_hashrate_drop", rid,
                                  f"{rig_hps:.0f} H/s vs baseline "
                                  f"{baseline:.0f} H/s "
                                  f"(-{ALERT_HPS_DROP_PCT:.0f}%)"))
                    changed = True
                elif rig.get("alerted_hps") and rig_hps >= floor:
                    rig.pop("alerted_hps", None)
                    _agent_event("alert_hps_recovered", rid,
                                 f"hps={rig_hps:.0f}")
                    fired.append(("alert_hps_recovered", rid,
                                  f"hashrate back to {rig_hps:.0f} H/s"))
                    changed = True
    if changed:
        _write_json_atomic(AGENT_DB_FILE, db)
    return fired


# ── profit switching (W7 B5 MVP) ──────────────────────────────────────
# Revenue model v1: `bench[gpu_model][coin] = {hps, usd_day}` seeded by ops
# (whattomine/pool stats) via POST /api/agent/bench. A sheet opts in with
# `autopilot: ["preset-name", ...]` (catalog entries); the evaluator scores
# each preset's coin and switches when the best beats the current by the
# hysteresis margin. VASTCTL_PROFIT_SWITCH = "" | "dry" | "apply".
PROFIT_SWITCH_MODE = os.environ.get("VASTCTL_PROFIT_SWITCH", "")
PROFIT_EVAL_S = int(os.environ.get("VASTCTL_PROFIT_EVAL_S", "300"))
# Only the process that owns heartbeats (serve) may run alert/profit
# evaluation — other vastctl processes (daemon snapshot loop) would
# double-fire events+notifications over the same db file.
FLEET_CHECKS = os.environ.get("VASTCTL_FLEET_CHECKS", "1") != "0"
PROFIT_HYST_PCT = float(os.environ.get("VASTCTL_PROFIT_HYST_PCT", "15"))
PROFIT_COOLDOWN_S = int(
    os.environ.get("VASTCTL_PROFIT_COOLDOWN_S", "1800"))


def _norm_gpu_key(name):
    """'NVIDIA GeForce RTX 3060' → 'RTX_3060' — vendor-agnostic bench key."""
    name = re.sub(r"(?i)\b(geforce|nvidia|amd|radeon)\b", "", str(name))
    return re.sub(r"_+", "_", re.sub(r"[^A-Za-z0-9]+", "_",
                                    name).strip("_").upper()) or None


def _gpu_model(hb):
    """First GPU name → normalized key ('RTX 3060' → 'RTX_3060')."""
    gpus = hb.get("gpus") or []
    if not gpus:
        return None
    return _norm_gpu_key(str(gpus[0]).split(",")[0].strip())


def agent_bench_set(gpu, coin, hps=None, usd_day=None):
    """Seed/update one (gpu_model, coin) benchmark entry — ops only."""
    gpu = _norm_gpu_key(gpu) or ""
    coin = str(coin).lower().strip()
    if not gpu or not re.fullmatch(r"[a-z0-9]+", coin):
        raise ValueError("gpu and coin required")
    with _agents_lock:
        db = _agent_db()
        ent = db.setdefault("bench", {}).setdefault(gpu, {})
        cur = ent.setdefault(coin, {})
        if hps is not None:
            cur["hps"] = float(hps)
        if usd_day is not None:
            cur["usd_day"] = float(usd_day)
        cur["ts"] = time.time()
        _agent_event("bench_set", gpu, f"coin={coin} "
                     f"hps={cur.get('hps')} usd_day={cur.get('usd_day')}")
        _write_json_atomic(AGENT_DB_FILE, db)
        return {"ok": True, "gpu": gpu, "coin": coin, "bench": cur}


def _check_profit(db, now):
    """Evaluate autopilot sheets against the bench table. Returns fired
    alerts for notify; sheet rewrites happen in 'apply' mode only."""
    if PROFIT_SWITCH_MODE not in {"dry", "apply"}:
        return []
    prof = db.setdefault("profit", {})
    if now - prof.get("last_eval", 0) < PROFIT_EVAL_S:
        return []
    prof["last_eval"] = now
    fired = []
    changed = True  # last_eval bump
    bench = db.get("bench") or {}
    catalog = db.get("catalog") or {}
    for rid, rig in db["rigs"].items():
        hb = rig.get("heartbeat") or {}
        desired = _desired_for(db, rid)
        if not desired or not isinstance(desired.get("autopilot"), list):
            continue
        applied = (hb.get("applied_sheet") or {}).get("hash")
        dhash = _sheet_hash({k: v for k, v in desired.items()
                             if not k.startswith("_")})
        if applied != dhash:
            continue  # only steer rigs that honour their sheets
        gpu = _gpu_model(hb)
        if not gpu or gpu not in bench:
            continue
        # score each candidate preset's coin
        scored = {}
        for preset in desired["autopilot"]:
            sheet = catalog.get(str(preset))
            if not sheet:
                continue
            coin = str(sheet.get("coin") or "").lower()
            ent = bench[gpu].get(coin)
            if ent and ent.get("usd_day") is not None:
                scored[str(preset)] = (sheet, coin, float(ent["usd_day"]))
        if not scored:
            continue
        cur_coin = str(desired.get("coin") or "").lower()
        cur_usd = float((bench[gpu].get(cur_coin) or {}).get("usd_day") or 0)
        best_name, (best_sheet, best_coin, best_usd) = max(
            scored.items(), key=lambda kv: kv[1][2])
        if best_coin == cur_coin:
            continue
        if best_usd <= cur_usd * (1 + PROFIT_HYST_PCT / 100):
            continue
        if now - rig.get("profit_last_switch", 0) < PROFIT_COOLDOWN_S:
            continue
        detail = (f"{cur_coin or '?'}→{best_coin} preset={best_name} "
                  f"est ${cur_usd:.3f}→${best_usd:.3f}/day gpu={gpu}")
        _agent_event("profit_switch", rid,
                     f"{detail} mode={PROFIT_SWITCH_MODE}")
        fired.append(("profit_switch", rid, detail))
        if PROFIT_SWITCH_MODE == "apply":
            new_sheet = dict(best_sheet, autopilot=desired["autopilot"])
            db.setdefault("desired", {}).setdefault("rigs", {})[rid] = \
                new_sheet
            rig["profit_last_switch"] = now
        changed = True
    if changed:
        _write_json_atomic(AGENT_DB_FILE, db)
    return fired


def _notify_alert(kind, rig_id, detail):
    """Best-effort alert fan-out: Telegram bot + generic webhook. Called
    OUTSIDE _agents_lock; failures are silent (events are the record)."""
    text = f"[zion-fleet] {kind} rig={rig_id} {detail}"
    tok = os.environ.get("VASTCTL_TG_BOT_TOKEN", "")
    chat = os.environ.get("VASTCTL_TG_CHAT_ID", "")
    if tok and chat:
        try:
            body = json.dumps({"chat_id": chat, "text": text}).encode()
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{tok}/sendMessage",
                data=body, headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=5).close()
        except Exception:
            pass
    hook = os.environ.get("VASTCTL_ALERT_WEBHOOK", "")
    if hook:
        try:
            body = json.dumps({"kind": kind, "rig_id": rig_id,
                               "detail": detail, "ts": time.time()}).encode()
            req = urllib.request.Request(
                hook, data=body,
                headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=5).close()
        except Exception:
            pass


def agent_enroll(enroll_token, rig_id_hint, hostname):
    """One-time enroll: master enroll token → rig_id + per-rig secret.
    Secret plaintext is returned once and never stored (sha256 only)."""
    want = os.environ.get("VASTCTL_ENROLL_TOKEN", "")
    if not want:
        raise ValueError("enroll disabled (VASTCTL_ENROLL_TOKEN unset)")
    if not enroll_token or enroll_token != want:
        raise ValueError("invalid enroll token")
    import secrets as _sec
    with _agents_lock:
        db = _agent_db()
        rig_id = str(rig_id_hint or "").strip() or f"rig-{_sec.token_hex(4)}"
        secret = _sec.token_hex(16)
        db.setdefault("secrets", {})[rig_id] = _sha256(secret)
        rig = db["rigs"].setdefault(
            rig_id, {"heartbeat": {}, "tasks": [], "results": []})
        rig["enrolled_ts"] = time.time()
        if hostname:
            rig["enroll_hostname"] = str(hostname)[:120]
        _agent_event("enroll", rig_id, f"hostname={hostname}")
        _write_json_atomic(AGENT_DB_FILE, db)
    return {"ok": True, "rig_id": rig_id, "secret": secret}


def _agent_prune(rig):
    """Drop finished/expired tasks, cap result history."""
    now = time.time()
    rig["tasks"] = [
        t for t in rig["tasks"]
        if t["state"] in {"pending", "delivered"}
        and now - t["ts"] < AGENT_TASK_TTL_S]
    rig["results"] = rig["results"][-AGENT_RESULT_KEEP:]


def agent_heartbeat(rig_id, payload):
    """Store heartbeat, claim pending tasks for delivery, resolve sheet."""
    with _agents_lock:
        db = _agent_db()
        rig = db["rigs"].setdefault(
            rig_id, {"heartbeat": {}, "tasks": [], "results": []})
        rig["heartbeat"] = dict(payload, server_ts=time.time())
        if rig.pop("alerted_offline", None):
            _agent_event("alert_recovered", rig_id)
        _agent_prune(rig)
        due = [t for t in rig["tasks"] if t["state"] == "pending"]
        for t in due:
            t["state"] = "delivered"
            t["delivered_ts"] = time.time()
        sheet = _desired_for(db, rig_id)
        resp = {"ok": True, "tasks": [
            {"id": t["id"], "op": t["op"], "args": t["args"]} for t in due]}
        if sheet:
            sheet["hash"] = _sheet_hash(
                {k: v for k, v in sheet.items() if not k.startswith("_")})
            resp["desired"] = sheet
        _write_json_atomic(AGENT_DB_FILE, db)
        return resp


def agent_result(rig_id, task_id, rc, out):
    with _agents_lock:
        rig = _agent_db()["rigs"].setdefault(
            rig_id, {"heartbeat": {}, "tasks": [], "results": []})
        state = "done" if rc == 0 else "failed"
        for t in rig["tasks"]:
            if t["id"] == task_id:
                t["state"] = state
                t["finished_ts"] = time.time()
                break
        rig["results"].append({
            "task_id": task_id, "rc": rc,
            "out": out[-8000:] if isinstance(out, str) else "",
            "ts": time.time()})
        _agent_event("result", rig_id, f"task={task_id} rc={rc}")
        _agent_prune(rig)
        _write_json_atomic(AGENT_DB_FILE, _agents_cache)
        return {"ok": True, "state": state}


def agent_enqueue(rig_id, op, args):
    if op != "exec" or not isinstance(args.get("cmd"), str) or not args["cmd"]:
        raise ValueError("supported ops: exec with args.cmd")
    with _agents_lock:
        rig = _agent_db()["rigs"].setdefault(
            rig_id, {"heartbeat": {}, "tasks": [], "results": []})
        _agent_prune(rig)
        task = {"id": uuid.uuid4().hex[:12], "op": op, "args": args,
                "state": "pending", "ts": time.time()}
        rig["tasks"].append(task)
        _agent_event("enqueue", rig_id, f"task={task['id']} op={op}")
        _write_json_atomic(AGENT_DB_FILE, _agents_cache)
        return task


def agent_fleet():
    # fetch_pool_miners does HTTP against the local pool API — outside the
    # lock (cached; a wedged pool must not stall heartbeats/fleet reads).
    workers = fetch_pool_miners() if FLEET_CHECKS else None
    with _agents_lock:
        now = time.time()
        db = _agent_db()
        fired = []
        if FLEET_CHECKS:
            fired += _check_alerts(db, now, workers=workers)
            fired += _check_profit(db, now)
        out = []
        for rid, rig in db["rigs"].items():
            hb = rig["heartbeat"]
            desired = _desired_for(db, rid)
            if desired:
                desired["hash"] = _sheet_hash(
                    {k: v for k, v in desired.items()
                     if not k.startswith("_")})
            out.append({
                "rig_id": rid,
                "hostname": hb.get("hostname") or rig.get("enroll_hostname"),
                "enrolled": rid in db.get("secrets", {}),
                "group": rig.get("group"),
                "desired": desired,
                "applied_sheet": hb.get("applied_sheet"),
                "last_seen": hb.get("server_ts"),
                "age_s": round(now - hb["server_ts"], 1) if hb else None,
                "uptime_s": hb.get("uptime_s"),
                "load1": hb.get("load1"),
                "gpus": hb.get("gpus") or [],
                "miners": hb.get("miners") or [],
                "pending": sum(1 for t in rig["tasks"]
                               if t["state"] in {"pending", "delivered"}),
                "results": len(rig["results"]),
                "tasks_tail": [{"id": t["id"], "op": t["op"],
                                "state": t["state"], "ts": t["ts"]}
                               for t in rig["tasks"][-5:]],
                "results_tail": [{**r, "out": (r.get("out") or "")[-1500:]}
                                 for r in rig["results"][-3:]],
                "offline_alert": bool(rig.get("alerted_offline")),
                "miner_alert": rig.get("alerted_miner"),
                "temp_alerts": sorted(k for k, v in
                                      rig.get("alerted_temp", {}).items()
                                      if v),
                "hps_alert": bool(rig.get("alerted_hps")),
                "payload_keys": sorted(hb.keys())})
        result = {"rigs": sorted(out, key=lambda r: r["rig_id"]),
                  "sheets": db.get("desired", {"rigs": {}, "groups": {}}),
                  "catalog": db.get("catalog", {}),
                  "bench": db.get("bench", {}),
                  "profit_mode": PROFIT_SWITCH_MODE,
                  "events": db.get("events", [])[-20:]}
    for kind, rid, detail in fired:
        _notify_alert(kind, rid, detail)
    return result


def _agent_fleet_section():
    """Snapshot section: agent rigs or None when none registered."""
    rigs = agent_fleet()["rigs"]
    return rigs or None


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
            " if u: print(\"\\n-- \"+str(u.get(\"completion_tokens\",\"?\"))+"
            "\" tok out / \"+str(u.get(\"prompt_tokens\",\"?\"))+\" in\")\n"
            "except Exception:\n"
            " print(\"(no/invalid reply)\")'\n"
        )
    elif action == "auto-chat":
        prompt = query.get("prompt", [""])[0].strip()
        if not prompt:
            raise ValueError("prompt required")
        want = query.get("model", [""])[0].strip()
        eps = model_endpoints()
        if want:
            eps = [e for e in eps if e["model"] == want]
            if not eps:
                return f"model '{want}' not loaded on any endpoint", 502
        if not eps:
            return "no model loaded on any endpoint", 502
        ep = eps[0]
        if ep["kind"] == "hiran":
            return inference_action(
                "hiran-chat", {**query, "model": [ep["model"]]})
        return inference_action(
            "chat", {**query, "id": [str(ep["rig"])]})
    elif action == "auto-deploy":
        if query.get("confirm") != ["1"]:
            raise ValueError("deployment requires explicit confirmation")
        want = query.get("model", [""])[0].strip()
        if not want:
            raise ValueError("model required")
        st = ai_status_cached()
        for rig in st["rigs"]:
            if rig["inference_reachable"] and want in rig["models"]:
                return (f"model already loaded on rig #{rig['id']} — "
                        f"nothing to do", 200)
        cands = [(sum(g["memory_free_mib"] for g in r["gpus"]), r)
                 for r in st["rigs"] if r["gpus"] and not r["error"]]
        if not cands:
            return "no running rig with GPU inventory", 502
        free_mib, best = max(cands, key=lambda c: c[0])
        q = dict(query)
        q["id"] = [str(best["id"])]
        if "image" not in q:
            entry = next((m for m in MODEL_CATALOG if m["hf"] == want), None)
            if entry and entry.get("latest_vllm"):
                q["image"] = [LATEST_VLLM_IMAGE]
        out, code = inference_action("deploy", q)
        return (f"[auto-deploy] picked rig #{best['id']} "
                f"({free_mib / 1024:.1f} GiB free VRAM)\n{out}", code)
    elif action == "hiran-chat":
        prompt = query.get("prompt", [""])[0].strip()
        if not prompt:
            raise ValueError("prompt required")
        max_tok = int(query.get("max_tokens", ["256"])[0])
        hp = hiran_probe()
        if not hp["reachable"] or not hp["model"]:
            return "no model loaded on the hiran endpoint (SMOS rig offline?)", 502
        model = query.get("model", [""])[0].strip() or hp["model"]
        raw = _http_post(f"{HIRAN_API}/v1/chat/completions", {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tok, "temperature": 0.7})
        try:
            d = json.loads(raw)
            out = d["choices"][0]["message"]["content"]
            u = d.get("usage") or {}
            if u:
                out += (f"\n-- {u.get('completion_tokens', '?')} tok out / "
                        f"{u.get('prompt_tokens', '?')} in")
            return out, 200
        except Exception:
            return "(no/invalid reply)", 502
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

    def _read_body(self, limit=65536):
        try:
            n = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            n = 0
        if n <= 0 or n > limit:
            return None
        return self.rfile.read(n)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/api/agent/fleet":
            self._send(json.dumps(agent_fleet()), ctype="application/json")
        elif u.path == "/api/status":
            self._send(json.dumps(snapshot_from(cached_rigs(), rigs_live=rigs_cache_live())),
                       ctype="application/json")
        elif u.path == "/api/ai/status":
            try:
                self._send(json.dumps(ai_status()), ctype="application/json")
            except ValueError as e:
                self._send(json.dumps({"error": str(e)}), 500, "application/json")
            except (SystemExit, json.JSONDecodeError) as e:
                self._send(json.dumps({"error": str(e)}), 502, "application/json")
        elif u.path == "/api/inference/models":
            try:
                self._send(json.dumps(model_endpoints()),
                           ctype="application/json")
            except (SystemExit, json.JSONDecodeError) as e:
                self._send(json.dumps({"error": str(e)}), 502,
                           "application/json")
        elif u.path == "/api/inference/catalog":
            self._send(json.dumps(MODEL_CATALOG), ctype="application/json")
        elif u.path == "/api/inference/hf-search":
            try:
                self._send(json.dumps(hf_search(q.get("q", [""])[0])),
                           ctype="application/json")
            except SystemExit as e:
                self._send(json.dumps({"error": str(e)}), 502,
                           "application/json")
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
        elif u.path == "/api/smos/console":
            iid = q.get("id", [""])[0]
            try:
                self._send(smos_console(iid), ctype="text/plain")
            except (SystemExit, ValueError) as e:
                self._send(f"failed: {e}", 400, "text/plain")
            except Exception as e:
                self._send(f"failed: {e}", 500, "text/plain")
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
        if u.path == "/api/agent/enroll":
            # Bootstrap endpoint — the enroll token in the body is the gate
            # (no bearer exists yet). Issues rig_id + per-rig secret.
            body = self._read_body()
            try:
                payload = json.loads(body or b"{}")
                self._send(json.dumps(agent_enroll(
                    str(payload.get("enroll_token", "")),
                    str(payload.get("rig_id", "")),
                    str(payload.get("hostname", "")))),
                    ctype="application/json")
            except (ValueError, json.JSONDecodeError) as e:
                self._send(f"bad request: {e}", 403, "text/plain")
        elif u.path == "/api/agent/heartbeat":
            auth = _agent_token_ok(self.headers)
            if not auth:
                self._send("agent token required", 403, "text/plain")
                return
            body = self._read_body()
            try:
                payload = json.loads(body or b"{}")
                rig_id = str(payload.pop("rig_id", ""))
                if not rig_id:
                    raise ValueError("rig_id required")
                # Per-rig bearer binds the claimed rig_id — a rig cannot
                # report as another rig with its own secret.
                if isinstance(auth, str) and auth != rig_id:
                    raise ValueError("rig_id does not match credential")
                self._send(json.dumps(agent_heartbeat(rig_id, payload)),
                           ctype="application/json")
            except (ValueError, json.JSONDecodeError) as e:
                self._send(f"bad request: {e}", 400, "text/plain")
        elif u.path == "/api/agent/result":
            auth = _agent_token_ok(self.headers)
            if not auth:
                self._send("agent token required", 403, "text/plain")
                return
            body = self._read_body()
            try:
                payload = json.loads(body or b"{}")
                rig_id = str(payload["rig_id"])
                if isinstance(auth, str) and auth != rig_id:
                    raise ValueError("rig_id does not match credential")
                self._send(json.dumps(agent_result(
                    rig_id, str(payload["task_id"]),
                    int(payload.get("rc", 1)),
                    str(payload.get("out", "")))), ctype="application/json")
            except (KeyError, ValueError, json.JSONDecodeError) as e:
                self._send(f"bad request: {e}", 400, "text/plain")
        elif u.path in ("/api/agent/sheet", "/api/agent/sheet/clear",
                        "/api/agent/group", "/api/agent/rig/remove",
                        "/api/agent/catalog", "/api/agent/catalog/clear",
                        "/api/agent/bulk", "/api/agent/bench"):
            if readonly():
                self._send("readonly mode", 403, "text/plain")
                return
            # Ops-only — same reasoning as enqueue: same-origin is not an
            # auth boundary over the public nginx route.
            if _agent_token_ok(self.headers) is not True:
                self._send("ops token required", 403, "text/plain")
                return
            body = self._read_body()
            try:
                payload = json.loads(body or b"{}")
                if u.path == "/api/agent/sheet":
                    kind = "rig" if payload.get("rig_id") else "group"
                    name = str(payload.get("rig_id") or payload.get("group") or "")
                    if not name:
                        raise ValueError("rig_id or group required")
                    out = agent_set_sheet(
                        kind, name, payload.get("sheet"),
                        catalog=payload.get("catalog"))
                elif u.path == "/api/agent/sheet/clear":
                    kind = "rig" if payload.get("rig_id") else "group"
                    name = str(payload.get("rig_id") or payload.get("group") or "")
                    if not name:
                        raise ValueError("rig_id or group required")
                    out = agent_clear_sheet(kind, name)
                elif u.path == "/api/agent/group":
                    out = agent_set_group(
                        str(payload["rig_id"]), payload.get("group"))
                elif u.path == "/api/agent/rig/remove":
                    out = agent_remove_rig(str(payload["rig_id"]))
                elif u.path == "/api/agent/catalog":
                    out = agent_catalog_set(
                        str(payload["name"]), payload.get("sheet"))
                elif u.path == "/api/agent/catalog/clear":
                    out = agent_catalog_clear(str(payload["name"]))
                elif u.path == "/api/agent/bench":
                    out = agent_bench_set(
                        str(payload["gpu"]), str(payload["coin"]),
                        hps=payload.get("hps"),
                        usd_day=payload.get("usd_day"))
                else:
                    out = agent_bulk(
                        payload.get("target") or {},
                        payload.get("action") or {})
                self._send(json.dumps(out), ctype="application/json")
            except (KeyError, ValueError, json.JSONDecodeError) as e:
                self._send(f"bad request: {e}", 400, "text/plain")
        elif u.path == "/api/agent/enqueue":
            if readonly():
                self._send("readonly mode", 403, "text/plain")
                return
            # Ops-only: shared ops bearer required. same-origin is NOT an
            # auth boundary here — Origin/Host are both attacker-set over
            # the public nginx route, so a spoofed curl must never queue
            # fleet tasks. Per-rig secrets are rejected too (a rig does
            # not enqueue work for itself).
            if _agent_token_ok(self.headers) is not True:
                self._send("ops token required", 403, "text/plain")
                return
            body = self._read_body()
            try:
                payload = json.loads(body or b"{}")
                task = agent_enqueue(
                    str(payload["rig_id"]), str(payload.get("op", "exec")),
                    dict(payload.get("args", {})))
                self._send(json.dumps({"ok": True, "task": task}),
                           ctype="application/json")
            except (KeyError, ValueError, json.JSONDecodeError) as e:
                self._send(f"bad request: {e}", 400, "text/plain")
        elif u.path.startswith("/api/inference/"):
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
        elif u.path == "/api/smos/action":
            if readonly():
                self._send("readonly mode", 403, "text/plain")
                return
            if not same_origin_request(
                    self.headers.get("Origin"), self.headers.get("Host")):
                self._send("same-origin request required", 403, "text/plain")
                return
            iid, act = q.get("id", [""])[0], q.get("act", [""])[0]
            try:
                self._send(smos_action(iid, act), ctype="text/plain")
            except (SystemExit, ValueError) as e:
                self._send(f"failed: {e}", 400, "text/plain")
            except Exception as e:
                self._send(f"failed: {e}", 500, "text/plain")
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
