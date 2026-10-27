#!/usr/bin/env python3
"""zion-vast-agent — push-model fleet agent (2.B11 MVP).

Runs on a rig, POSTs heartbeats to `vastctl serve` and executes tasks the
control plane returns — so rigs behind NAT (no inbound SSH) stay
manageable. Task results are POSTed back; executed task ids are kept in a
seen-file so redelivery never re-runs a command.

Env:
  VAST_AGENT_URL       control plane base, e.g. http://127.0.0.1:8088
  VAST_AGENT_TOKEN     shared bearer token (must match VASTCTL_AGENT_TOKEN)
  VAST_AGENT_RIG_ID    stable rig id (default: hostname)
  VAST_AGENT_INTERVAL  heartbeat seconds (default 60)
  VAST_AGENT_SEEN      seen-task file (default ~/.local/share/vast-agent-seen.json)
"""
from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

URL = os.environ.get("VAST_AGENT_URL", "http://127.0.0.1:8088").rstrip("/")
TOKEN = os.environ.get("VAST_AGENT_TOKEN", "")
RIG_ID = os.environ.get("VAST_AGENT_RIG_ID", socket.gethostname())
INTERVAL = int(os.environ.get("VAST_AGENT_INTERVAL", "60"))
SEEN_FILE = Path(os.environ.get(
    "VAST_AGENT_SEEN", os.path.expanduser("~/.local/share/vast-agent-seen.json")))
SEEN_KEEP = 500
TASK_TIMEOUT = 600


def _req(path, payload):
    data = json.dumps(payload).encode()
    r = urllib.request.Request(
        URL + path, data=data, method="POST",
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(r, timeout=20) as resp:
        return json.loads(resp.read() or b"{}")


def _load_seen():
    try:
        return json.loads(SEEN_FILE.read_text())[-SEEN_KEEP:]
    except Exception:
        return []


def _save_seen(seen):
    SEEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = SEEN_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(seen[-SEEN_KEEP:]))
    tmp.rename(SEEN_FILE)


def collect():
    hb = {"rig_id": RIG_ID, "hostname": socket.gethostname(), "ts": time.time()}
    try:
        hb["uptime_s"] = float(Path("/proc/uptime").read_text().split()[0])
    except Exception:
        pass
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,utilization.gpu,temperature.gpu",
             "--format=csv,noheader"],
            capture_output=True, text=True, timeout=10).stdout.strip()
        if out:
            hb["gpus"] = out.splitlines()
    except Exception:
        pass
    try:
        out = subprocess.run(
            ["pgrep", "-a", "-f", "SRBMiner|xmrig|zion-miner|ccminer"],
            capture_output=True, text=True, timeout=10).stdout.strip()
        if out:
            hb["miners"] = [l.split(None, 1)[1] for l in out.splitlines()]
    except Exception:
        pass
    return hb


def run_task(task, seen):
    tid, op, args = task["id"], task["op"], task.get("args", {})
    if tid in seen:
        return
    if op != "exec":
        rc, out = 2, f"unsupported op {op}"
    else:
        try:
            r = subprocess.run(args["cmd"], shell=True, capture_output=True,
                               text=True, timeout=TASK_TIMEOUT)
            rc, out = r.returncode, (r.stdout + r.stderr).strip()
        except subprocess.TimeoutExpired:
            rc, out = 124, f"task timeout ({TASK_TIMEOUT}s)"
        except Exception as e:
            rc, out = 1, f"exec error: {e}"
    try:
        _req("/api/agent/result",
             {"rig_id": RIG_ID, "task_id": tid, "rc": rc, "out": out})
    except Exception as e:
        print(f"result post failed for {tid}: {e}", file=sys.stderr)
        return  # keep unseen → retried on next delivery
    seen.append(tid)


def main():
    if not TOKEN:
        sys.exit("VAST_AGENT_TOKEN required")
    print(f"vast-agent {RIG_ID} → {URL} every {INTERVAL}s")
    seen = _load_seen()
    while True:
        try:
            resp = _req("/api/agent/heartbeat", collect())
            for task in resp.get("tasks", []):
                run_task(task, seen)
            _save_seen(seen)
        except Exception as e:
            print(f"heartbeat failed: {e}", file=sys.stderr)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
