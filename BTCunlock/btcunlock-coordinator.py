#!/usr/bin/env python3
"""
btcunlock-coordinator.py — distributed keyscan work coordinator.

Hands out key-range *units* to workers so a key lottery (e.g. Bitcoin puzzle
#71) is searched systematically across any number of machines instead of each
worker wandering the range on its own.

Protocol (all JSON):
  POST /api/lease   {worker_id, label} → {unit_id, start, end, targets, label}
  POST /api/report  {worker_id, unit_id, tested, next_key?, done?, rate_mks?}
  POST /api/hit     {worker_id, unit_id, key?, key_hex?, wif, address, target?}
  GET  /api/status  — aggregate stats (public, no secrets)
  GET  /api/units   — recent units list (public, trimmed)
  GET  /api/vault   — full hit records incl. WIF — requires Bearer token

Persistence — SQLite (WAL) is the store:
  coordinator.db: meta(job cfg + cursor + counters), units(leased/done),
                  workers, hits
  Sidecars kept for humans: hits/hits.jsonl + hits/hit-*.txt (mode 600).
  Legacy coordinator-state.json is imported once on first boot.
  Auto-backup: DB snapshot + hits dir copied to backups/ every
  COORD_BACKUP_S seconds (default 900), newest COORD_BACKUP_KEEP kept.

Safety on hit (three layers):
  1. worker's scanner binary host-verifies before it even prints HIT
  2. coordinator re-checks address↔target binding (base58 → hash160)
  3. COORD_HIT_HOOK optional command fired with BTCUNLOCK_* env
"""

import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.parse
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE = Path.home() / "btcunlock"
DB_FILE = Path(os.environ.get("COORD_DB", BASE / "coordinator.db"))
LEGACY_STATE = Path(os.environ.get("COORD_STATE", BASE / "coordinator-state.json"))
HITS_DIR = Path(os.environ.get("COORD_HITS", BASE / "coordinator-hits"))
BACKUP_DIR = Path(os.environ.get("COORD_BACKUP_DIR", BASE / "backups"))
BACKUP_EVERY = int(os.environ.get("COORD_BACKUP_S", "900"), 10)
BACKUP_KEEP = int(os.environ.get("COORD_BACKUP_KEEP", "96"), 10)
TOKEN = os.environ.get("BTCUNLOCK_COORD_TOKEN", "")
HIT_HOOK = os.environ.get("COORD_HIT_HOOK", "")

# ── Job definition: puzzle #71 by default, overridable via env ──────────────
RANGE_START = int(os.environ.get("COORD_START", "0x400000000000000000"), 16)
RANGE_END   = int(os.environ.get("COORD_END",   "0x800000000000000000"), 16)
UNIT_SIZE   = int(os.environ.get("COORD_UNIT_SIZE", str(1 << 36)), 10)
TARGETS = [t.strip() for t in os.environ.get(
    "COORD_TARGETS", "1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU").split(",") if t.strip()]
LABEL = os.environ.get("COORD_LABEL", "puzzle #71")
LEASE_TTL = int(os.environ.get("COORD_LEASE_TTL", "10800"), 10)  # 3 h

RANGE_KEYS = RANGE_END - RANGE_START
N_UNITS = (RANGE_KEYS + UNIT_SIZE - 1) // UNIT_SIZE

_lock = threading.RLock()
_db = None

B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ─────────────────────────────────────────────── storage (SQLite)

def db():
    global _db
    if _db is None:
        DB_FILE.parent.mkdir(parents=True, exist_ok=True)
        _db = sqlite3.connect(str(DB_FILE), check_same_thread=False,
                              isolation_level=None)  # autocommit
        _db.execute("PRAGMA journal_mode=WAL")
        _db.execute("PRAGMA synchronous=FULL")
        _db.executescript("""
        CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
        CREATE TABLE IF NOT EXISTS units(
            unit_id INTEGER PRIMARY KEY,
            status TEXT NOT NULL,
            worker_id TEXT, label TEXT,
            leased_ts REAL, leased_at TEXT,
            tested INTEGER DEFAULT 0,
            next_key TEXT,
            finished_at TEXT,
            hits INTEGER DEFAULT 0);
        CREATE TABLE IF NOT EXISTS workers(
            worker_id TEXT PRIMARY KEY,
            label TEXT, first_seen TEXT, last_seen TEXT,
            total_tested INTEGER DEFAULT 0,
            units_done INTEGER DEFAULT 0,
            rate_mks REAL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS hits(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT, worker_id TEXT, unit_id INTEGER,
            key TEXT, key_hex TEXT, wif TEXT, address TEXT, target TEXT,
            verified INTEGER, raw TEXT);
        CREATE TABLE IF NOT EXISTS events(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT, kind TEXT, detail TEXT);
        """)
        _migrate_legacy()
        _init_meta()
    return _db


def _meta_get(k, default=None):
    row = db().execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
    return row[0] if row else default


def _meta_set(k, v):
    db().execute("INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)", (k, str(v)))


def _init_meta():
    # Lock the job definition into meta — a coordinator must not silently
    # swap ranges between restarts.
    expected = {"range_start": hex(RANGE_START), "range_end": hex(RANGE_END),
                "unit_size": UNIT_SIZE, "label": LABEL}
    for k, v in expected.items():
        old = _meta_get(k)
        if old is None:
            _meta_set(k, v)
        elif k in ("range_start", "range_end") and old != str(v) \
                or k == "unit_size" and int(old) != int(v):
            raise SystemExit(f"coordinator DB job mismatch: {k}={old} vs env {v}")
    if _meta_get("cursor") is None:
        _meta_set("cursor", 0)
    if _meta_get("tested_total") is None:
        _meta_set("tested_total", 0)
    if _meta_get("hits_total") is None:
        _meta_set("hits_total", 0)


def _migrate_legacy():
    """One-shot import of the JSON state file (first boot after upgrade)."""
    if _meta_get("migrated") or not LEGACY_STATE.exists():
        return
    try:
        s = json.loads(LEGACY_STATE.read_text())
        if s.get("range_start") == hex(RANGE_START) \
                and int(s.get("unit_size", 0)) == UNIT_SIZE:
            _meta_set("cursor", int(s.get("cursor", 0)))
            _meta_set("tested_total", int(s.get("tested_total", 0)))
            _meta_set("hits_total", int(s.get("hits_total", 0)))
            for uid, u in s.get("leased", {}).items():
                db().execute(
                    "INSERT OR REPLACE INTO units(unit_id,status,worker_id,label,"
                    "leased_ts,leased_at,tested,next_key,hits) "
                    "VALUES(?,?,?,?,?,?,?,?,?)",
                    (int(uid), "leased", u.get("worker_id"), u.get("label"),
                     u.get("leased_ts", time.time()), u.get("leased_at"),
                     int(u.get("tested", 0)), u.get("next_key"),
                     int(u.get("hits", 0))))
            for uid, u in s.get("done", {}).items():
                db().execute(
                    "INSERT OR REPLACE INTO units(unit_id,status,worker_id,"
                    "tested,finished_at,hits) VALUES(?,?,?,?,?,?)",
                    (int(uid), "done", u.get("worker_id"),
                     int(u.get("tested", 0)), u.get("finished_at"),
                     int(u.get("hits", 0))))
            for wid, w in s.get("workers", {}).items():
                db().execute(
                    "INSERT OR REPLACE INTO workers(worker_id,label,first_seen,"
                    "last_seen,total_tested,units_done,rate_mks) "
                    "VALUES(?,?,?,?,?,?,?)",
                    (wid, w.get("label"), w.get("first_seen"),
                     w.get("last_seen"), int(w.get("total_tested", 0)),
                     int(w.get("units_done", 0)), float(w.get("rate_mks", 0))))
        _meta_set("migrated", now_iso())
        _event("migrate", f"legacy JSON state imported ({LEGACY_STATE})")
        print(f"[coord] migrated legacy state from {LEGACY_STATE}", flush=True)
    except Exception as e:
        print(f"[coord] legacy migration failed: {e}", file=sys.stderr)


def _event(kind, detail):
    db().execute("INSERT INTO events(ts,kind,detail) VALUES(?,?,?)",
                 (now_iso(), kind, str(detail)[:500]))


def janitor():
    """Return expired leases to the pool."""
    now = time.time()
    rows = db().execute(
        "SELECT unit_id FROM units WHERE status='leased' AND ?-leased_ts>?",
        (now, LEASE_TTL)).fetchall()
    for (uid,) in rows:
        db().execute("DELETE FROM units WHERE unit_id=?", (uid,))
        cur = int(_meta_get("cursor", 0))
        if uid < cur:
            _meta_set("cursor", uid)
        _event("lease_expired", f"unit {uid} returned to pool")


def unit_bounds(idx):
    start = RANGE_START + idx * UNIT_SIZE
    end = min(start + UNIT_SIZE, RANGE_END)
    return start, end


def do_lease(worker_id, label):
    janitor()
    cur = int(_meta_get("cursor", 0))
    if cur >= N_UNITS:
        return None  # range exhausted
    start, end = unit_bounds(cur)
    db().execute(
        "INSERT INTO units(unit_id,status,worker_id,label,leased_ts,leased_at,"
        "tested,next_key,hits) VALUES(?,?,?,?,?,?,0,?,0)",
        (cur, "leased", worker_id, label, time.time(), now_iso(), hex(start)))
    _meta_set("cursor", cur + 1)
    db().execute(
        "INSERT INTO workers(worker_id,label,first_seen,last_seen) "
        "VALUES(?,?,?,?) ON CONFLICT(worker_id) DO UPDATE SET "
        "label=excluded.label, last_seen=excluded.last_seen",
        (worker_id, label, now_iso(), now_iso()))
    _event("lease", f"unit {cur} → {worker_id}")
    return {"unit_id": cur, "start": hex(start), "end": hex(end),
            "targets": TARGETS, "label": LABEL, "lease_ttl": LEASE_TTL}


def do_report(worker_id, unit_id, tested, next_key, done, rate_mks):
    row = db().execute(
        "SELECT worker_id,tested FROM units WHERE unit_id=? AND status='leased'",
        (int(unit_id),)).fetchone()
    if row is None:
        return {"ok": False, "error": "unit not leased"}
    if row[0] != worker_id:
        return {"ok": False, "error": "unit owned by another worker"}
    delta = max(0, int(tested) - int(row[1] or 0))
    db().execute(
        "UPDATE units SET tested=?, next_key=COALESCE(?,next_key) "
        "WHERE unit_id=?", (int(tested), next_key, int(unit_id)))
    db().execute(
        "INSERT INTO workers(worker_id,last_seen,total_tested,rate_mks) "
        "VALUES(?,?,?,?) ON CONFLICT(worker_id) DO UPDATE SET "
        "last_seen=excluded.last_seen,"
        "total_tested=workers.total_tested+excluded.total_tested,"
        "rate_mks=excluded.rate_mks",
        (worker_id, now_iso(), delta, float(rate_mks or 0)))
    _meta_set("tested_total", int(_meta_get("tested_total", 0)) + delta)
    if done:
        db().execute(
            "UPDATE units SET status='done',finished_at=? WHERE unit_id=?",
            (now_iso(), int(unit_id)))
        db().execute("UPDATE workers SET units_done=units_done+1 WHERE worker_id=?",
                     (worker_id,))
        _event("done", f"unit {unit_id} by {worker_id} ({tested} keys)")
    return {"ok": True}


# ── hit verification: does the claimed address bind to a configured target?

def _b58decode(s):
    n = 0
    for c in s:
        n = n * 58 + B58.index(c)
    b = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    return b"\x00" * (len(s) - len(s.lstrip("1"))) + b


def _address_hash160(addr):
    """base58check P2PKH/P2SH → payload hash160; bech32 → witness program."""
    try:
        raw = _b58decode(addr)
        if len(raw) == 25 and hashlib.sha256(hashlib.sha256(raw[:-4]).digest()).digest()[:4] == raw[-4:]:
            return raw[1:21].hex()
    except Exception:
        pass
    if addr.lower().startswith("bc1"):
        try:
            # bech32 witness program — enough for binding check
            data = addr[3:]
            vals = [ord(c) - 48 if ord(c) <= 57 else
                    ord(c) - 65 + 10 if ord(c) <= 89 else ord(c) - 97 + 26
                    for c in data[:-6]]
            vals = vals[1:]  # drop version
            acc, bits, out = 0, 0, []
            for v in vals:
                acc = (acc << 5) | v
                bits += 5
                if bits >= 8:
                    bits -= 8
                    out.append((acc >> bits) & 0xFF)
            return bytes(out).hex()
        except Exception:
            return None
    return None


def _target_hash160s():
    out = []
    for t in TARGETS:
        if re.fullmatch(r"[0-9a-fA-F]{40}", t):
            out.append(t.lower())
        else:
            h = _address_hash160(t)
            if h:
                out.append(h)
    return out


def do_hit(worker_id, unit_id, rec):
    key_hex = str(rec.get("key_hex") or
                  ("0x" + str(rec.get("key", "")) if rec.get("key") else ""))
    wif = str(rec.get("wif", ""))
    address = str(rec.get("address", ""))
    # server-side binding check: claimed address must hash to a known target
    verified = 0
    try:
        h = _address_hash160(address)
        verified = 1 if h and h in _target_hash160s() else 0
    except Exception:
        verified = 0
    ts = now_iso()
    db().execute(
        "INSERT INTO hits(ts,worker_id,unit_id,key,key_hex,wif,address,target,"
        "verified,raw) VALUES(?,?,?,?,?,?,?,?,?,?)",
        (ts, worker_id, int(unit_id) if unit_id is not None else None,
         str(rec.get("key", "")), key_hex, wif, address,
         str(rec.get("target", TARGETS[0] if TARGETS else "")),
         verified, json.dumps(rec)[:2000]))
    _meta_set("hits_total", int(_meta_get("hits_total", 0)) + 1)
    if unit_id is not None:
        db().execute("UPDATE units SET hits=hits+1 WHERE unit_id=?",
                     (int(unit_id),))
    # human sidecars (mode 600)
    HITS_DIR.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(HITS_DIR, 0o700)
    except Exception:
        pass
    line = json.dumps({"ts": ts, "worker_id": worker_id, "unit_id": unit_id,
                       "key": rec.get("key"), "key_hex": key_hex, "wif": wif,
                       "address": address, "verified": verified})
    jf = HITS_DIR / "hits.jsonl"
    with open(jf, "a") as f:
        f.write(line + "\n")
        f.flush()
        os.fsync(f.fileno())
    os.chmod(jf, 0o600)
    safe = re.sub(r"[^0-9a-fA-Fx]", "", key_hex)[:80] or "key"
    single = HITS_DIR / f"hit-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{safe}.txt"
    single.write_text(line + "\n")
    os.chmod(single, 0o600)
    _event("hit", f"unit {unit_id} by {worker_id} verified={verified} "
                  f"key={key_hex[:24]}…")
    if HIT_HOOK:
        env = dict(os.environ)
        env.update({"BTCUNLOCK_KEY": str(rec.get("key", "")),
                    "BTCUNLOCK_KEY_HEX": key_hex, "BTCUNLOCK_WIF": wif,
                    "BTCUNLOCK_ADDRESS": address, "BTCUNLOCK_WORKER": worker_id,
                    "BTCUNLOCK_VERIFIED": str(verified)})
        try:
            subprocess.Popen(HIT_HOOK, shell=True, env=env,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            _event("hook_err", str(e))
    return {"ok": True, "verified": bool(verified)}


def status_payload():
    janitor()
    tested = int(_meta_get("tested_total", 0))
    coverage = tested / RANGE_KEYS if RANGE_KEYS else 0.0
    now = time.time()
    leased_workers = {r[0] for r in db().execute(
        "SELECT DISTINCT worker_id FROM units WHERE status='leased'")}
    rows = db().execute(
        "SELECT worker_id,label,last_seen,total_tested,units_done,rate_mks "
        "FROM workers").fetchall()
    workers, rate_sum = [], 0.0
    for wid, label, last_seen, tot, ud, rate in rows:
        try:
            seen = datetime.fromisoformat(
                (last_seen or "").replace("Z", "+00:00")).timestamp()
        except Exception:
            seen = 0
        # Active = reported recently (heartbeat ~20 s) OR still holds a
        # live lease. A dead worker stops inflating the fleet rate fast.
        active = (now - seen) < 120 or wid in leased_workers
        if active:
            rate_sum += float(rate or 0)
        workers.append({"worker_id": wid, "label": label or "",
                        "last_seen": last_seen, "active": active,
                        "total_tested": int(tot or 0),
                        "units_done": int(ud or 0),
                        "rate_mks": round(float(rate or 0), 3)})
    workers.sort(key=lambda x: -x["total_tested"])
    done_n, leased_n = db().execute(
        "SELECT (SELECT COUNT(*) FROM units WHERE status='done'),"
        "       (SELECT COUNT(*) FROM units WHERE status='leased')").fetchone()
    cur = min(int(_meta_get("cursor", 0)), N_UNITS - 1)
    front_start, _ = unit_bounds(cur)
    eta_s = (RANGE_KEYS - tested) / (rate_sum * 1e6) if rate_sum > 0 else None
    return {
        "ok": True, "label": LABEL, "targets": TARGETS,
        "range_start": hex(RANGE_START), "range_end": hex(RANGE_END),
        "range_keys": str(RANGE_KEYS), "unit_size": UNIT_SIZE,
        "n_units": N_UNITS, "cursor": int(_meta_get("cursor", 0)),
        "units_done": done_n, "units_leased": leased_n,
        "tested_total": tested, "coverage": coverage,
        "rate_mks": round(rate_sum, 3), "eta_s": eta_s,
        "frontier": hex(front_start),
        "hits_total": int(_meta_get("hits_total", 0)),
        "workers": workers, "updated": now_iso(),
        "db": str(DB_FILE),
    }


def units_payload(limit=200):
    janitor()
    rows = db().execute(
        "SELECT unit_id,status,worker_id,tested,leased_at,finished_at,hits "
        "FROM units ORDER BY unit_id DESC LIMIT ?", (limit,)).fetchall()
    units = [{"unit_id": u, "status": s, "worker_id": w,
              "tested": int(t or 0), "leased_at": la, "finished_at": fa,
              "hits": int(h or 0)}
             for u, s, w, t, la, fa, h in rows]
    done_n = db().execute(
        "SELECT COUNT(*) FROM units WHERE status='done'").fetchone()[0]
    return {"ok": True, "units": units, "n_units": N_UNITS,
            "cursor": int(_meta_get("cursor", 0)), "done_count": done_n}


def vault_payload():
    rows = db().execute(
        "SELECT ts,worker_id,unit_id,key,key_hex,wif,address,target,verified "
        "FROM hits ORDER BY id").fetchall()
    return {"ok": True, "hits": [
        {"ts": t, "worker_id": w, "unit_id": u, "key": k, "key_hex": kh,
         "wif": wi, "address": a, "target": tg, "verified": bool(v)}
        for t, w, u, k, kh, wi, a, tg, v in rows]}


# ── periodic backup: DB snapshot + hits dir ─────────────────────────────────

def backup_loop(stop):
    while not stop.wait(BACKUP_EVERY):
        try:
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            dest = BACKUP_DIR / f"coordinator-{ts}.db"
            dst = sqlite3.connect(str(dest))
            db().backup(dst)
            dst.close()
            os.chmod(dest, 0o600)
            if HITS_DIR.exists():
                hd = BACKUP_DIR / f"hits-{ts}"
                shutil.copytree(HITS_DIR, hd)
                os.chmod(hd, 0o700)
            snaps = sorted(BACKUP_DIR.glob("coordinator-*.db"))
            for old in snaps[:-BACKUP_KEEP]:
                old.unlink(missing_ok=True)
            _event("backup", f"snapshot {dest.name}")
        except Exception as e:
            _event("backup_err", str(e))


class Handler(BaseHTTPRequestHandler):
    server_version = "BTCUnlockCoord/2.0"
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
            db()
            if path.endswith("/status"):
                self._json(status_payload())
            elif path.endswith("/units"):
                self._json(units_payload())
            elif path.endswith("/vault"):
                if not self._auth():
                    self._json({"ok": False, "error": "auth required"}, 401)
                    return
                self._json(vault_payload())
            else:
                self._json({"ok": False, "error": "not found"}, 404)

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path.rstrip("/")
        if not self._auth():
            self._json({"ok": False, "error": "auth required"}, 401)
            return
        b = self._body()
        with _lock:
            db()
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
    db()
    stop = threading.Event()
    threading.Thread(target=backup_loop, args=(stop,), daemon=True).start()
    print(f"[coord] {LABEL} range [{hex(RANGE_START)} .. {hex(RANGE_END)}) "
          f"= {N_UNITS} units x {UNIT_SIZE}", flush=True)
    print(f"[coord] db={DB_FILE} hits={HITS_DIR} backups={BACKUP_DIR} "
          f"auth={'token' if TOKEN else 'OPEN-INSECURE!'} "
          f"hook={'yes' if HIT_HOOK else 'no'} on {args.host}:{args.port}",
          flush=True)
    try:
        ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
    finally:
        stop.set()


if __name__ == "__main__":
    main()
