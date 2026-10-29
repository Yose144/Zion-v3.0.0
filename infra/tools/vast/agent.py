#!/usr/bin/env python3
"""zion-vast-agent — push-model fleet agent (2.B11 / W3 B1).

Runs on a rig, POSTs heartbeats to `vastctl serve` and executes tasks the
control plane returns — so rigs behind NAT (no inbound SSH) stay
manageable. Task results are POSTed back; executed task ids are kept in a
seen-file so redelivery never re-runs a command.

Security model (A/W3):
  - Enroll once (`--enroll`) → rig_id + per-rig secret in STATE_FILE
    (chmod 600). Heartbeats auth as `Bearer rig_id:secret` — the CP
    stores only sha256(secret). Legacy shared VAST_AGENT_TOKEN still
    works for pre-enroll rigs.
  - `exec` tasks run ONLY commands matching the allowlist (prefix match,
    no shell metachars) — a compromised CP cannot run arbitrary shell.
    Operator extends via VAST_AGENT_EXEC_ALLOW{,_EXTRA} on the RIG side.
  - `code.run` (F2): coding tool jail + local LLM loop — see code_run.py.
    Not an open shell; writes require force (fleet default true).

Env:
  VAST_AGENT_URL         control plane base, e.g. https://zionterranova.com
  VAST_AGENT_TOKEN       legacy shared bearer (VASTCTL_AGENT_TOKEN)
  VAST_AGENT_ENROLL      enroll token for --enroll (VASTCTL_ENROLL_TOKEN)
  VAST_AGENT_RIG_ID      stable rig id (default: hostname)
  VAST_AGENT_INTERVAL    heartbeat seconds (default 60)
  VAST_AGENT_STATE       credential file (default ~/.local/share/vast-agent.json)
  VAST_AGENT_SEEN        seen-task file (default ~/.local/share/vast-agent-seen.json)
  VAST_AGENT_EXEC_ALLOW  replaces allowlist (comma-separated cmd prefixes)
  VAST_AGENT_EXEC_ALLOW_EXTRA  appended to the default allowlist
  VAST_AGENT_LLM_URL     OpenAI base for code.run (default http://127.0.0.1:8000/v1)
  VAST_AGENT_CODE_CWD    coding workspace (default /root/work)
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

try:
    import code_run as _code_run
except ImportError:  # pragma: no cover — same-dir import when cwd differs
    _code_run = None
    _here = Path(__file__).resolve().parent
    if str(_here) not in sys.path:
        sys.path.insert(0, str(_here))
    try:
        import code_run as _code_run
    except ImportError:
        _code_run = None

URL = os.environ.get("VAST_AGENT_URL", "http://127.0.0.1:8088").rstrip("/")
TOKEN = os.environ.get("VAST_AGENT_TOKEN", "")
RIG_ID = os.environ.get("VAST_AGENT_RIG_ID", socket.gethostname())
INTERVAL = int(os.environ.get("VAST_AGENT_INTERVAL", "60"))
STATE_FILE = Path(os.environ.get(
    "VAST_AGENT_STATE", os.path.expanduser("~/.local/share/vast-agent.json")))
SEEN_FILE = Path(os.environ.get(
    "VAST_AGENT_SEEN", os.path.expanduser("~/.local/share/vast-agent-seen.json")))
APPLIED_FILE = Path(os.environ.get(
    "VAST_AGENT_APPLIED",
    os.path.expanduser("~/.local/share/vast-agent-applied.json")))
SHEET_PATH = Path(os.environ.get(
    "VAST_AGENT_SHEET_PATH", "/root/vast-desired.json"))
APPLY_HOOK = os.environ.get(
    "VAST_AGENT_APPLY_HOOK", "/root/zion-sheet-apply.sh")
# self-update: the task carries {url, sha256} — the rig only accepts
# https downloads from an embedded host allowlist (compromising the CP
# token alone cannot push arbitrary code: the payload must be served
# from our infrastructure or the public repo mirror).
UPDATE_HOSTS = set(
    (os.environ.get("VAST_AGENT_UPDATE_HOSTS") or
     "zionterranova.com,raw.githubusercontent.com").split(","))
SEEN_KEEP = 500
TASK_TIMEOUT = 600

# exec allowlist — prefix match on the command + a metachar ban, so a
# queued task is a bounded action, never a shell. Interpreter-ish
# prefixes (python/sh -c/eval/tmux send-keys) are deliberately absent.
EXEC_ALLOW_DEFAULT = (
    "uptime", "nvidia-smi", "df", "free", "pgrep", "cat /proc/",
    "systemctl status", "systemctl is-active", "systemctl is-enabled",
    "systemctl restart", "systemctl start", "systemctl stop",
    "journalctl", "tmux ls", "tmux capture-pane", "tmux kill-session",
    "pkill -f SRBMiner", "pkill -f xmrig", "pkill -f zion-miner",
    "bash /root/", "sh /root/",
    # F2 path-B: allowlisted job wrapper (not arbitrary shell)
    "bash /root/zion-coder-job.sh",
)
EXEC_META_FORBIDDEN = (";", "|", "&", "`", "$(", ">", "<", "\n", "\r")


def _allowlist():
    if os.environ.get("VAST_AGENT_EXEC_ALLOW"):
        prefixes = os.environ["VAST_AGENT_EXEC_ALLOW"].split(",")
    else:
        prefixes = list(EXEC_ALLOW_DEFAULT)
    prefixes += os.environ.get("VAST_AGENT_EXEC_ALLOW_EXTRA", "").split(",")
    return tuple(p.strip() for p in prefixes if p.strip())


def exec_allowed(cmd, allowlist=None):
    """cmd must start with an allowlisted prefix and carry no shell
    metacharacters — keeps a queued exec a single bounded action."""
    cmd = (cmd or "").strip()
    if not cmd:
        return False
    if any(m in cmd for m in EXEC_META_FORBIDDEN):
        return False
    return cmd.startswith(tuple(allowlist or _allowlist()))


def _load_state():
    """{rig_id, secret} written by --enroll; {} when absent."""
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {}


def _bearer():
    st = _load_state()
    if st.get("rig_id") and st.get("secret"):
        return f"{st['rig_id']}:{st['secret']}"
    return TOKEN


def _req(path, payload, method="POST"):
    data = json.dumps(payload).encode()
    r = urllib.request.Request(
        URL + path, data=data, method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {_bearer()}"})
    with urllib.request.urlopen(r, timeout=20) as resp:
        return json.loads(resp.read() or b"{}")


def enroll():
    token = os.environ.get("VAST_AGENT_ENROLL", "")
    if not token:
        sys.exit("VAST_AGENT_ENROLL required")
    st = _load_state()
    if st.get("secret"):
        print(f"already enrolled as {st.get('rig_id')} — delete {STATE_FILE} to re-enroll")
        return
    payload = {"enroll_token": token, "rig_id": RIG_ID,
               "hostname": socket.gethostname()}
    req = urllib.request.Request(
        URL + "/api/agent/enroll", data=json.dumps(payload).encode(),
        method="POST", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            out = json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        sys.exit(f"enroll failed: HTTP {e.code} {e.read()[:200]!r}")
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(
        {"rig_id": out["rig_id"], "secret": out["secret"]}))
    STATE_FILE.chmod(0o600)
    print(f"enrolled rig_id={out['rig_id']} → {STATE_FILE}")


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


def _load_applied():
    """{hash, rc, ts, out?} — what the last sheet apply produced."""
    try:
        return json.loads(APPLIED_FILE.read_text())
    except Exception:
        return {}


def _save_applied(applied):
    APPLIED_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = APPLIED_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(applied))
    tmp.rename(APPLIED_FILE)


def apply_desired(desired, applied):
    """Desired-state apply (B3): CP resolves a sheet per rig; the local
    apply hook translates it into miner launches. Runs when the resolved
    hash changes (including transitions to none → hook gets {"miner": "none"}).
    The hook is argv-invoked (no shell) and lives at a root-owned path —
    the sheet can only change what an operator-installed hook allows."""
    want_hash = desired.get("hash") if desired else "none"
    if want_hash == applied.get("hash"):
        return applied
    sheet = {k: v for k, v in (desired or {}).items()
             if not k.startswith("_") and k != "hash"} or {"miner": "none"}
    SHEET_PATH.parent.mkdir(parents=True, exist_ok=True)
    SHEET_PATH.write_text(json.dumps(sheet))
    if not Path(APPLY_HOOK).exists():
        applied.update(hash=want_hash, rc=127, ts=time.time(),
                       note=f"apply hook missing: {APPLY_HOOK}")
        return applied
    try:
        r = subprocess.run(["bash", APPLY_HOOK, str(SHEET_PATH)],
                           capture_output=True, text=True,
                           timeout=TASK_TIMEOUT)
        out = (r.stdout + r.stderr).strip()[-2000:]
        applied.update(hash=want_hash, rc=r.returncode,
                       ts=time.time(), out=out or None)
    except subprocess.TimeoutExpired:
        applied.update(hash=want_hash, rc=124, ts=time.time(),
                       note=f"hook timeout ({TASK_TIMEOUT}s)")
    except Exception as e:
        applied.update(hash=want_hash, rc=1, ts=time.time(),
                       note=f"hook error: {e}")
    return applied


def collect():
    hb = {"rig_id": _load_state().get("rig_id") or RIG_ID,
          "hostname": socket.gethostname(), "ts": time.time(),
          "applied_sheet": _load_applied() or None}
    try:
        hb["uptime_s"] = float(Path("/proc/uptime").read_text().split()[0])
    except Exception:
        pass
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,utilization.gpu,temperature.gpu,power.draw,fan.speed",
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
    try:
        hb["load1"] = float(Path("/proc/loadavg").read_text().split()[0])
    except Exception:
        pass
    return hb


def _sha256_file(path):
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def valid_update_url(url):
    """https-only + host in the rig-embedded allowlist."""
    from urllib.parse import urlparse
    try:
        u = urlparse(str(url))
    except Exception:
        return False
    return u.scheme == "https" and u.hostname in UPDATE_HOSTS


def self_update(args):
    """Builtin op: download agent code pinned by sha256 from an allow-
    listed host, replace own file atomically, then re-exec in place
    (keeps the tmux session/PID alive). Returns (rc, out)."""
    url, want = str(args.get("url", "")), str(args.get("sha256", "")).lower()
    if not valid_update_url(url):
        return 126, f"update denied: url host not in {sorted(UPDATE_HOSTS)}"
    if len(want) != 64 or any(c not in "0123456789abcdef" for c in want):
        return 126, "update denied: sha256 must be 64 hex chars"
    me = Path(sys.argv[0]).resolve()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "vast-agent"})
        data = urllib.request.urlopen(req, timeout=60).read()
    except Exception as e:
        return 1, f"download failed: {e}"
    tmp = me.with_suffix(".update")
    tmp.write_bytes(data)
    got = _sha256_file(tmp)
    if got != want:
        tmp.unlink(missing_ok=True)
        return 126, f"update denied: sha256 mismatch (got {got[:12]}…)"
    try:
        import ast
        ast.parse(data.decode())
    except Exception as e:
        tmp.unlink(missing_ok=True)
        return 126, f"update denied: not valid python: {e}"
    backup = me.with_suffix(".bak-update")
    try:
        os.replace(me, backup)
        os.replace(tmp, me)
        os.chmod(me, 0o755)
    except Exception as e:
        tmp.unlink(missing_ok=True)
        return 1, f"install failed: {e}"
    # re-exec after the result is posted (flag consumed by run_task caller)
    os.environ["VAST_AGENT_REEXEC"] = "1"
    return 0, f"updated to {want[:12]} ({len(data)}B), restarting"


def run_task(task, seen):
    tid, op, args = task["id"], task["op"], task.get("args", {})
    if tid in seen:
        return
    # CP may cancel pending/delivered before we start — skip quietly.
    if task.get("state") == "cancelled":
        seen.append(tid)
        return
    if op == "self-update":
        rc, out = self_update(args)
    elif op == "code.run":
        if _code_run is None:
            rc, out = 2, "code.run unavailable: code_run.py not installed on rig"
        else:
            try:
                rc, out = _code_run.run_code_job(args if isinstance(args, dict) else {})
            except Exception as e:
                rc, out = 1, f"code.run error: {e}"
    elif op != "exec":
        rc, out = 2, f"unsupported op {op}"
    elif not exec_allowed(args.get("cmd", "")):
        rc, out = 126, "exec denied: command not in allowlist"
    else:
        try:
            r = subprocess.run(args["cmd"], shell=True, capture_output=True,
                               text=True, timeout=TASK_TIMEOUT)
            rc, out = r.returncode, (r.stdout + r.stderr).strip()
        except subprocess.TimeoutExpired:
            rc, out = 124, f"task timeout ({TASK_TIMEOUT}s)"
        except Exception as e:
            rc, out = 1, f"exec error: {e}"
    # Coding results may be longer than miner exec noise.
    out_cap = 24000 if op == "code.run" else 8000
    if isinstance(out, str) and len(out) > out_cap:
        out = out[: out_cap - 20] + "\n…[truncated]"
    try:
        _req("/api/agent/result",
             {"rig_id": _load_state().get("rig_id") or RIG_ID,
              "task_id": tid, "rc": rc, "out": out})
    except Exception as e:
        print(f"result post failed for {tid}: {e}", file=sys.stderr)
        return  # keep unseen → retried on next delivery
    seen.append(tid)
    if os.environ.pop("VAST_AGENT_REEXEC", None):
        print("self-update applied — re-exec", flush=True)
        os.execv(sys.executable, [sys.executable] + sys.argv)


def main():
    if "--enroll" in sys.argv:
        enroll()
        return
    if not _bearer():
        sys.exit("enroll first (--enroll) or set VAST_AGENT_TOKEN")
    print(f"vast-agent {RIG_ID} → {URL} every {INTERVAL}s "
          f"(auth: {'per-rig' if _load_state().get('secret') else 'shared'})")
    seen = _load_seen()
    applied = _load_applied()
    while True:
        try:
            resp = _req("/api/agent/heartbeat", collect())
            for task in resp.get("tasks", []):
                run_task(task, seen)
            _save_seen(seen)
            before = applied.get("hash")
            applied = apply_desired(resp.get("desired"), applied)
            if applied.get("hash") != before:
                _save_applied(applied)
                print(f"desired sheet {applied['hash']} → rc={applied.get('rc')}")
        except Exception as e:
            print(f"heartbeat failed: {e}", file=sys.stderr)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
