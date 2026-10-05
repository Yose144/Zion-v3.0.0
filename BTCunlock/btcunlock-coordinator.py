#!/usr/bin/env python3
"""
btcunlock-coordinator.py — distributed keyscan work coordinator.

Hands out key-range *units* to workers so a key lottery (e.g. Bitcoin puzzle
#71) is searched systematically across any number of machines instead of each
worker wandering the range on its own.

Protocol (all JSON):
  POST /api/lease   {worker_id, label, unit_size_exp?} → {unit_id, start, end,
                    targets, label}            — requires Bearer token
  POST /api/report  {worker_id, unit_id, tested, next_key?, done?} — token
  POST /api/hit     {worker_id, unit_id, key, key_hex, wif, address, target}
                                               — token, stored mode-600
  GET  /api/status  — aggregate stats (public, no secrets)
  GET  /api/units   — recent units list (public, trimmed)
  GET  /api/vault   — full hit records incl. WIF — requires Bearer token

Design:
  * Range [start, end) split into fixed units (default 2^36 keys each).
  * Units are leased in index order; a lease expires after LEASE_TTL and the
    unit returns to the pool — a dead worker only wastes one unit.
  * State is a single JSON file written atomically (tmp + rename + fsync).
  * Hits append to hits.jsonl (mode 600) AND an individual record file.
  * No dependencies beyond the stdlib.
"""

import json
import os
import re
import stat
import sys
import threading
import time
import urllib.parse
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE = Path.home() / "btcunlock"
STATE_FILE = Path(os.environ.get("COORD_STATE", BASE / "coordinator-state.json"))
HITS_DIR = Path(os.environ.get("COORD_HITS", BASE / "coordinator-hits"))
TOKEN = os.environ.get("BTCUNLOCK_COORD_TOKEN", "")

# ── Job definition: puzzle #71 by default, overridable via env ──────────────
RANGE_START = int(os.environ.get("COORD_START", "0x400000000000000000"), 16)
RANGE_END   = int(os.environ.get("COORD_END",   "0x800000000000000000"), 16)
UNIT_SIZE   = int(os.environ.get("COORD_UNIT_SIZE", str(1 << 36)), 10)
TARGETS = [t.strip() for t in os.environ.get(
    "COORD_TARGETS", "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU").split(",") if t.strip()]
LABEL = os.environ.get("COORD_LABEL", "puzzle #71")
LEASE_TTL = int(os.environ.get("COORD_LEASE_TTL", "10800"), 10)  # 3 h
MAX_UNITS_KEPT = int(os.environ.get("COORD_MAX_UNITS", "20000"), 10)

RANGE_KEYS = RANGE_END - RANGE_START
N_UNITS = (RANGE_KEYS + UNIT_SIZE - 1) // UNIT_SIZE

_lock = threading.RLock()
_state = None


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _default_state():
    return {
        "version": 1,
        "created": now_iso(),
        "range_start": hex(RANGE_START),
        "range_end": hex(RANGE_END),
        "unit_size": UNIT_SIZE,
        "label": LABEL,
        "targets": TARGETS,
        "cursor": 0,              # next never-leased unit index
        "leased": {},             # unit_id -> {worker_id,label,leased_at,tested,next_key}
        "done": {},               # unit_id -> {worker_id,tested,finished_at,hits}
        "done_count": 0,
        "tested_total": 0,
        "hits_total": 0,
        "workers": {},            # worker_id -> {label,last_seen,total_tested,units_done,rate_mks}
    }


def load_state():
    global _state
    if _state is not None:
        return _state
    try:
        _state = json.loads(STATE_FILE.read_text())
        # Sanity: state file must describe the same job.
        if (_state.get("range_start") != hex(RANGE_START)
                or _state.get("range_end") != hex(RANGE_END)
                or _state.get("unit_size") != UNIT_SIZE):
            raise ValueError("state describes a different job — refusing to merge")
    except FileNotFoundError:
        _state = _default_state()
    return _state


def save_state():
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(_state))
    os.chmod(tmp, 0o600)
    fd = os.open(tmp, os.O_RDONLY)
    try:
        os.rename(tmp, STATE_FILE)
        os.fsync(fd)
    finally:
        os.close(fd)


def janitor():
    """Return expired leases to the pool."""
    now = time.time()
    expired = [uid for uid, u in _state["leased"].items()
               if now - u.get("leased_ts", 0) > LEASE_TTL]
    for uid in expired:
        u = _state["leased"].pop(uid)
        idx = int(uid)
        if idx < _state["cursor"]:
            _state["cursor"] = idx


def unit_bounds(idx):
    start = RANGE_START + idx * UNIT_SIZE
    end = min(start + UNIT_SIZE, RANGE_END)
    return start, end


def do_lease(worker_id, label):
    janitor()
    if _state["cursor"] >= N_UNITS:
        return None  # range exhausted
    idx = _state["cursor"]
    _state["cursor"] += 1
    start, end = unit_bounds(idx)
    _state["leased"][str(idx)] = {
        "worker_id": worker_id, "label": label,
        "leased_at": now_iso(), "leased_ts": time.time(),
        "tested": 0, "next_key": hex(start),
    }
    w = _state["workers"].setdefault(worker_id, {
        "label": label, "first_seen": now_iso(),
        "total_tested": 0, "units_done": 0, "rate_mks": 0.0,
    })
    w["label"] = label or w["label"]
    w["last_seen"] = now_iso()
    save_state()
    return {"unit_id": idx, "start": hex(start), "end": hex(end),
            "targets": TARGETS, "label": LABEL,
            "lease_ttl": LEASE_TTL}


def do_report(worker_id, unit_id, tested, next_key, done, rate_mks):
    uid = str(unit_id)
    u = _state["leased"].get(uid)
    if u is None:
        return {"ok": False, "error": "unit not leased"}
    if u["worker_id"] != worker_id:
        return {"ok": False, "error": "unit owned by another worker"}
    delta = max(0, int(tested) - int(u.get("tested", 0)))
    u["tested"] = tested
    if next_key:
        u["next_key"] = next_key
    w = _state["workers"].setdefault(worker_id, {
        "label": "", "first_seen": now_iso(),
        "total_tested": 0, "units_done": 0, "rate_mks": 0.0,
    })
    w["last_seen"] = now_iso()
    w["total_tested"] = int(w.get("total_tested", 0)) + delta
    if rate_mks:
        w["rate_mks"] = float(rate_mks)
    _state["tested_total"] = int(_state["tested_total"]) + delta
    if done:
        del _state["leased"][uid]
        _state["done"][uid] = {"worker_id": worker_id, "tested": int(tested),
                               "finished_at": now_iso(), "hits": u.get("hits", 0)}
        _state["done_count"] = int(_state["done_count"]) + 1
        w["units_done"] = int(w.get("units_done", 0)) + 1
        # Bound memory: keep only the newest done entries.
        if len(_state["done"]) > MAX_UNITS_KEPT:
            for old in sorted(_state["done"], key=lambda k: int(k))[:len(_state["done"]) - MAX_UNITS_KEPT]:
                del _state["done"][old]
    save_state()
    return {"ok": True}


def do_hit(worker_id, unit_id, rec):
    rec = dict(rec)
    rec.update({"worker_id": worker_id, "unit_id": unit_id, "ts": now_iso()})
    HITS_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(HITS_DIR, 0o700)
    with open(HITS_DIR / "hits.jsonl", "a") as f:
        f.write(json.dumps(rec) + "\n")
        f.flush()
        os.fsync(f.fileno())
    os.chmod(HITS_DIR / "hits.jsonl", 0o600)
    safe = re.sub(r"[^0-9a-fA-Fx]", "", str(rec.get("key_hex", "key")))[:80]
    single = HITS_DIR / f"hit-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{safe}.txt"
    single.write_text("\n".join(f"{k}={v}" for k, v in rec.items()) + "\n")
    os.chmod(single, 0o600)
    _state["hits_total"] = int(_state["hits_total"]) + 1
    uid = str(unit_id)
    if uid in _state["leased"]:
        _state["leased"][uid]["hits"] = int(_state["leased"][uid].get("hits", 0)) + 1
    save_state()
    return {"ok": True}


def status_payload():
    janitor()
    s = _state
    tested = int(s["tested_total"])
    coverage = tested / RANGE_KEYS if RANGE_KEYS else 0.0
    workers = []
    rate_sum = 0.0
    now = time.time()
    for wid, w in s["workers"].items():
        try:
            seen = datetime.fromisoformat(
                w.get("last_seen", "").replace("Z", "+00:00")).timestamp()
        except Exception:
            seen = 0
        active = (now - seen) < LEASE_TTL
        r = float(w.get("rate_mks", 0))
        if active:
            rate_sum += r
        workers.append({
            "worker_id": wid, "label": w.get("label", ""),
            "last_seen": w.get("last_seen"), "active": active,
            "total_tested": int(w.get("total_tested", 0)),
            "units_done": int(w.get("units_done", 0)),
            "rate_mks": round(r, 3),
        })
    workers.sort(key=lambda x: -(x["total_tested"]))
    idx = min(s["cursor"], N_UNITS - 1)
    front_start, _ = unit_bounds(idx)
    eta_s = (RANGE_KEYS - tested) / (rate_sum * 1e6) if rate_sum > 0 else None
    return {
        "ok": True, "label": s.get("label", LABEL), "targets": s.get("targets", TARGETS),
        "range_start": s["range_start"], "range_end": s["range_end"],
        "range_keys": str(RANGE_KEYS), "unit_size": UNIT_SIZE,
        "n_units": N_UNITS, "cursor": s["cursor"],
        "units_done": int(s["done_count"]),
        "units_leased": len(s["leased"]),
        "tested_total": tested,
        "coverage": coverage,
        "rate_mks": round(rate_sum, 3),
        "eta_s": eta_s,
        "frontier": hex(front_start),
        "hits_total": int(s["hits_total"]),
        "workers": workers,
        "updated": now_iso(),
    }


def units_payload(limit=200):
    janitor()
    s = _state
    out = []
    for uid, u in s["leased"].items():
        out.append({"unit_id": int(uid), "status": "leased",
                    "worker_id": u["worker_id"], "tested": int(u.get("tested", 0)),
                    "leased_at": u.get("leased_at"), "hits": int(u.get("hits", 0))})
    done_items = sorted(s["done"].items(), key=lambda kv: -int(kv[0]))[:limit]
    for uid, u in done_items:
        out.append({"unit_id": int(uid), "status": "done",
                    "worker_id": u["worker_id"], "tested": int(u.get("tested", 0)),
                    "finished_at": u.get("finished_at"), "hits": int(u.get("hits", 0))})
    out.sort(key=lambda x: -x["unit_id"])
    return {"ok": True, "units": out[:limit], "n_units": N_UNITS,
            "cursor": s["cursor"], "done_count": int(s["done_count"])}


class Handler(BaseHTTPRequestHandler):
    server_version = "BTCUnlockCoord/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (now_iso(), fmt % args))

    def _auth(self):
        if not TOKEN:
            return False
        h = self.headers.get("Authorization", "")
        return h == f"Bearer {TOKEN}"

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length", "0"))
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return {}

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path.rstrip("/") or "/"
        with _lock:
            if path.endswith("/status"):
                self._json(status_payload())
            elif path.endswith("/units"):
                self._json(units_payload())
            elif path.endswith("/vault"):
                if not self._auth():
                    self._json({"ok": False, "error": "auth required"}, 401)
                    return
                hits = []
                f = HITS_DIR / "hits.jsonl"
                if f.exists():
                    for line in f.read_text().splitlines():
                        try:
                            hits.append(json.loads(line))
                        except Exception:
                            pass
                self._json({"ok": True, "hits": hits})
            else:
                self._json({"ok": False, "error": "not found"}, 404)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path.rstrip("/")
        if not self._auth():
            self._json({"ok": False, "error": "auth required"}, 401)
            return
        b = self._body()
        with _lock:
            load_state()
            if path.endswith("/lease"):
                wid = str(b.get("worker_id", ""))[:64]
                if not wid:
                    self._json({"ok": False, "error": "worker_id required"}, 400)
                    return
                u = do_lease(wid, str(b.get("label", ""))[:64])
                if u is None:
                    self._json({"ok": False, "error": "range exhausted"}, 404)
                    return
                self._json({"ok": True, **u})
            elif path.endswith("/report"):
                r = do_report(str(b.get("worker_id", ""))[:64],
                              b.get("unit_id"), int(b.get("tested", 0)),
                              b.get("next_key"), bool(b.get("done")),
                              b.get("rate_mks"))
                self._json(r, 200 if r.get("ok") else 409)
            elif path.endswith("/hit"):
                r = do_hit(str(b.get("worker_id", ""))[:64],
                           b.get("unit_id"), b)
                self._json(r)
            else:
                self._json({"ok": False, "error": "not found"}, 404)


def main():
    import argparse
    ap = argparse.ArgumentParser(description="BTCunlock distributed scan coordinator")
    ap.add_argument("--host", default=os.environ.get("COORD_HOST", "127.0.0.1"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("COORD_PORT", "8779")))
    args = ap.parse_args()
    load_state()
    print(f"[coord] {LABEL} range [{hex(RANGE_START)} .. {hex(RANGE_END)}) "
          f"= {N_UNITS} units x 2^{UNIT_SIZE.bit_length()-1}")
    print(f"[coord] state={STATE_FILE} hits={HITS_DIR} "
          f"auth={'token' if TOKEN else 'OPEN-INSECURE!'} on {args.host}:{args.port}")
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
