#!/usr/bin/env python3
"""
btcunlock-worker.py — distributed-scan worker.

Loops: lease a unit from the coordinator → run `btcunlock keyscan` on it →
report progress → repeat. Hits are POSTed to the coordinator immediately (the
scanner binary also writes its own mode-600 backup beside the log).

  BTCUNLOCK_COORD_URL=https://dashboard.zionterranova.com/lottery
  BTCUNLOCK_COORD_TOKEN=…  (or --token / env file)
  python3 btcunlock-worker.py --gpu --worker-id rig-01 --label "1070 Ti"
"""

import json
import os
import re
import signal
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE = Path.home() / "btcunlock"
HERE = Path(__file__).resolve().parent
BIN = os.environ.get("BTCUNLOCK_BIN", str(HERE / "target/release/btcunlock"))
LOG = BASE / "worker.log"
REPORT_EVERY = float(os.environ.get("WORKER_REPORT_S", "20"))

COORD = os.environ.get("BTCUNLOCK_COORD_URL", "http://127.0.0.1:8779").rstrip("/")
TOKEN = os.environ.get("BTCUNLOCK_COORD_TOKEN", "")

_re_hit = re.compile(r"^HIT\s+key=0x([0-9a-fA-F]+)")
_re_keyhex = re.compile(r"key hex:\s*(0x[0-9a-fA-F]+)")
_re_wif = re.compile(r"WIF:\s*(\S+)")
_re_addr = re.compile(r"address:\s*(\S+)")
_re_progress = re.compile(
    r"(0x[0-9a-fA-F]+)\s*\([\d.]+%\)\s*—\s*([\d.]+)\s*Mk/s")

_stop = threading.Event()
_child = None


def api(method, path, body=None, timeout=20):
    req = urllib.request.Request(
        COORD + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def log(msg):
    line = f"[worker {time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    try:
        BASE.mkdir(exist_ok=True)
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


def run_unit(worker_id, label, unit, extra):
    """Run btcunlock on one leased unit; stream + parse output."""
    global _child
    uid = unit["unit_id"]
    cmd = [BIN, "keyscan",
           "--start", unit["start"], "--end", unit["end"],
           "--checkpoint", str(BASE / f"unit-{uid}.ckpt")]
    for t in unit.get("targets", []):
        cmd += ["--target", t]
    cmd += extra
    log(f"unit {uid}: {unit['start']} .. {unit['end']}  ({unit['label']})")
    log(f"  $ {' '.join(cmd)}")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True,
                            bufsize=1)
    _child = proc
    tested = 0
    next_key = unit["start"]
    rate = 0.0
    last_report = time.time()
    hits_sent = 0
    hit = {}
    try:
        for line in proc.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            m = _re_progress.search(line)
            if m:
                next_key = m.group(1)
                rate = float(m.group(2))
                # position → tested within unit
                try:
                    tested = int(next_key, 16) - int(unit["start"], 16)
                except Exception:
                    pass
            hm = _re_hit.search(line)
            if hm:
                hit["key"] = hm.group(1)
            kh, wm, am = _re_keyhex.search(line), _re_wif.search(line), _re_addr.search(line)
            if kh:
                hit["key_hex"] = kh.group(1)
            if wm:
                hit["wif"] = wm.group(1)
            if am:
                hit["address"] = am.group(1)
            if hit.get("key") and hit.get("wif") and hit.get("address"):
                payload = {"worker_id": worker_id, "unit_id": uid, **hit}
                # The hit IS the jackpot — retry hard in a background
                # thread so stdout keeps draining (a full pipe would
                # stall the scanner). Local mode-600 backup is fallback.
                def _post_hit(p=payload):
                    for attempt in range(10):
                        try:
                            api("POST", "/api/hit", p, timeout=15)
                            log(f"unit {uid}: HIT reported to coordinator")
                            return
                        except Exception as e:
                            log(f"unit {uid}: HIT report attempt {attempt + 1} failed: {e}")
                            time.sleep(min(60, 2 ** attempt))
                    log(f"unit {uid}: HIT report FAILED after 10 tries — "
                        f"key is in local hits dir")
                threading.Thread(target=_post_hit, daemon=True).start()
                hit = {}
            now = time.time()
            if now - last_report >= REPORT_EVERY:
                try:
                    api("POST", "/api/report", {
                        "worker_id": worker_id, "unit_id": uid,
                        "tested": tested, "next_key": next_key,
                        "rate_mks": rate})
                except Exception as e:
                    log(f"unit {uid}: report failed: {e}")
                last_report = now
        proc.wait()
    finally:
        _child = None
        ck = BASE / f"unit-{uid}.ckpt"
        try:
            ck.unlink(missing_ok=True)
        except Exception:
            pass
    if _stop.is_set():
        return "stopped"
    if proc.returncode != 0:
        log(f"unit {uid}: scanner exited rc={proc.returncode}")
    # final report — mark done only when the scan truly covered the unit
    done = proc.returncode == 0
    if done:
        tested = int(unit["end"], 16) - int(unit["start"], 16)
    try:
        r = api("POST", "/api/report", {
            "worker_id": worker_id, "unit_id": uid,
            "tested": tested, "next_key": next_key,
            "done": done, "rate_mks": rate})
        log(f"unit {uid}: final report done={done} → {r}")
    except Exception as e:
        log(f"unit {uid}: final report failed: {e}")
    return "done" if done else "failed"


def main():
    global COORD, TOKEN, BIN
    import argparse
    ap = argparse.ArgumentParser(description="BTCunlock distributed scan worker")
    ap.add_argument("--coord", default=COORD)
    ap.add_argument("--token", default=TOKEN)
    ap.add_argument("--worker-id", default=os.environ.get(
        "WORKER_ID", os.uname().nodename))
    ap.add_argument("--label", default=os.environ.get("WORKER_LABEL", "worker"))
    ap.add_argument("--bin", default=BIN)
    ap.add_argument("--gpu", action="store_true")
    ap.add_argument("--gpu-index", default=None)
    ap.add_argument("--stride", type=int, default=16)
    ap.add_argument("--batch", type=int, default=262144)
    ap.add_argument("--idle-retry", type=int, default=60)
    args = ap.parse_args()
    COORD = args.coord.rstrip("/")
    TOKEN = args.token
    BIN = args.bin

    def _sig(*_):
        _stop.set()
        if _child is not None:
            try:
                _child.terminate()
            except Exception:
                pass
    signal.signal(signal.SIGINT, _sig)
    signal.signal(signal.SIGTERM, _sig)

    extra = []
    if args.gpu:
        extra += ["--gpu", "--stride", str(args.stride), "--batch", str(args.batch)]
    if args.gpu_index:
        extra += ["--gpu-index", str(args.gpu_index)]

    log(f"coordinator={COORD} worker={args.worker_id} label={args.label}")
    # Drop stale per-unit checkpoints — an interrupted unit re-queues on
    # the coordinator after its lease TTL anyway; old ckpts only linger.
    for ck in BASE.glob("unit-*.ckpt"):
        try:
            if time.time() - ck.stat().st_mtime > 4 * 3600:
                ck.unlink()
                log(f"cleaned stale {ck.name}")
        except Exception:
            pass
    while not _stop.is_set():
        try:
            u = api("POST", "/api/lease",
                    {"worker_id": args.worker_id, "label": args.label})
        except urllib.error.HTTPError as e:
            if e.code == 404:
                log("range exhausted — nothing left to scan; exiting")
                return
            log(f"lease failed: {e}; retry in {args.idle_retry}s")
            _stop.wait(args.idle_retry)
            continue
        except Exception as e:
            log(f"lease failed: {e}; retry in {args.idle_retry}s")
            _stop.wait(args.idle_retry)
            continue
        run_unit(args.worker_id, args.label, u, extra)
        if _stop.is_set():
            break
    log("worker stopped")


if __name__ == "__main__":
    main()
