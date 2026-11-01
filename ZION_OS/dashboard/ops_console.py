"""Unified ops console API for the ZION dashboard (/api/ops/*).

One place for the rented GPU fleet (vast.ai), the project mining pool, the
SimpleMining rigs, the fleet agents and the inference endpoints.

Everything is read from processes that already run on this box:

    vastctl serve   127.0.0.1:8088   control plane: status, offers, rent,
                                     launch, stop, exec, logs, smos, inference
    pool API        127.0.0.1:8080   /stats, /miners, /api/v1/blocks
    status.json     /var/www/zion-maintenance/vast-rigs/status.json
                                     last-good snapshot of the probe daemon

The dashboard sits behind Basic Auth + an IP allowlist, so this module does not
add another credential layer — but every outbound call is bounded, cached and
whitelisted: /api/ops/action can only reach the vastctl endpoints below, never
an arbitrary URL.

Routes (GET unless noted):

    /api/ops/health            per-source liveness + latency
    /api/ops/overview          one merged snapshot + KPIs for the UI
    /api/ops/fleet             rigs only (vast + smos + agents)
    /api/ops/pool              pool stats + top miners + recent blocks
    /api/ops/market            GPU market offers (vast.ai), cheapest first
    /api/ops/ai                inference status per rig + model catalog
    /api/ops/audit             recent operator actions (whitelisted proxy log)
    /api/ops/status            raw vastctl snapshot (debug)
    /api/ops/logs?id=&src=     miner/session log tail (proxied)
    POST /api/ops/action       {"action": "...", "params": {...}}
    POST /api/ops/provision    rent a vast.ai GPU (if needed) and deploy a model
    GET  /api/ops/job?id=      progress log of a provisioning job
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

VASTCTL_URL = os.environ.get("OPS_VASTCTL_URL", "http://127.0.0.1:8088")
POOL_URL = os.environ.get("OPS_POOL_URL", "http://127.0.0.1:8080")
STATUS_JSON = os.environ.get(
    "OPS_STATUS_JSON", "/var/www/zion-maintenance/vast-rigs/status.json"
)
AUDIT_PATH = os.environ.get("OPS_AUDIT_PATH", "/opt/zion/data/dashboard-ops-audit.jsonl")

TIMEOUT = float(os.environ.get("OPS_HTTP_TIMEOUT", "8"))
SNAP_TTL = float(os.environ.get("OPS_SNAP_TTL", "10"))
POOL_TTL = float(os.environ.get("OPS_POOL_TTL", "15"))

# Only these vastctl surfaces are reachable through /api/ops/action. Anything
# else is a bug (or an attempt to abuse the dashboard as an open proxy).
_ALLOWED_ACTION = re.compile(
    r"^(?:"
    r"launch|stop|rent|exec|deploy-xmrig|logs|offers|ai/status"
    r"|smos/(?:action|console)"
    r"|inference/[a-z0-9-]+"
    r"|agent/(?:fleet|task|enqueue|heartbeat|result|sheet|group|catalog|bulk|bench|rig/remove)"
    r"|alerts/(?:status|test)"
    r")$"
)

_READ_ONLY_ACTIONS = {
    "logs",
    "offers",
    "ai/status",
    "smos/console",
    "agent/fleet",
    "agent/task",
    "alerts/status",
    "inference/catalog",
    "inference/models",
    "inference/hf-search",
}

_cache: dict[str, tuple[float, Any]] = {}


# ── transport ───────────────────────────────────────────────────────────────

def _http(url: str, timeout: float = TIMEOUT, method: str = "GET",
          body: bytes | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(url, method=method, data=body)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return int(getattr(r, "status", 200)), r.read()
    except urllib.error.HTTPError as e:
        return int(e.code), e.read() or b""
    except Exception:
        return 0, b""


def _json(url: str, timeout: float = TIMEOUT) -> Any:
    code, raw = _http(url, timeout)
    if code != 200 or not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8", "replace"))
    except Exception:
        return None


def _cached(key: str, ttl: float, producer):
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < ttl:
        return hit[1]
    value = producer()
    if value is not None:
        _cache[key] = (now, value)
    return value if value is not None else (hit[1] if hit else None)


# ── sources ─────────────────────────────────────────────────────────────────

def _read_status_file() -> Any:
    try:
        with open(STATUS_JSON, "rb") as fh:
            return json.load(fh)
    except Exception:
        return None


def snapshot() -> tuple[Any, str]:
    """Fleet snapshot.

    The probe daemon rewrites status.json every 60 s, so the file is the fast
    and cheap source — `vastctl serve /api/status` may run a live SSH probe and
    block for tens of seconds. Only ask serve when the file is stale or missing.
    """
    file_data = _read_status_file()
    age = _status_age(file_data)
    if isinstance(file_data, dict) and age is not None and age <= 180:
        return file_data, "file"
    live = _json(f"{VASTCTL_URL}/api/status", timeout=25)
    if isinstance(live, dict) and live.get("rigs") is not None:
        _cache["status"] = (time.time(), live)
        return live, "serve"
    if isinstance(file_data, dict):
        return file_data, "file-stale"
    return None, "unavailable"


def pool_snapshot() -> Any:
    """Pool totals from the pool API + per-worker hashrate from the fleet
    snapshot (`/miners` does not report hps, the daemon enriches it)."""

    def _live():
        stats = _json(f"{POOL_URL}/stats")
        if not isinstance(stats, dict):
            return None
        snap, _ = snapshot()
        blocks = _json(f"{POOL_URL}/public/v1/blocks?limit=20") or {}
        stats["_miners"] = (snap or {}).get("pool") or []
        stats["_blocks"] = blocks.get("blocks") if isinstance(blocks, dict) else None
        return stats

    return _cached("pool", POOL_TTL, _live)


def _status_age(data: Any) -> float | None:
    ts = (data or {}).get("ts")
    if not ts:
        return None
    from datetime import datetime

    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z"):
        try:
            return max(0.0, time.time() - datetime.strptime(str(ts), fmt).timestamp())
        except Exception:
            continue
    return None


# ── views ───────────────────────────────────────────────────────────────────

def _tcp_ok(url: str, timeout: float = 1.5) -> tuple[bool, int]:
    """Cheap liveness probe — `serve /api/status` can run a live SSH probe for
    tens of seconds, which would make a health badge lie."""
    import socket

    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 80
    t0 = time.time()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, int((time.time() - t0) * 1000)
    except Exception:
        return False, int((time.time() - t0) * 1000)


def health() -> dict:
    out: dict[str, Any] = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
    ok, ms = _tcp_ok(VASTCTL_URL)
    out["vastctl"] = {
        "ok": ok,
        "ms": ms,
        "url": VASTCTL_URL,
        "note": "control plane (launch/stop/rent/exec)" if ok else "not listening",
    }
    t0 = time.time()
    code, _ = _http(f"{POOL_URL}/stats", timeout=4)
    out["pool"] = {
        "ok": code == 200,
        "http": code,
        "ms": int((time.time() - t0) * 1000),
        "url": POOL_URL,
    }
    data, via = snapshot()
    out["status_json"] = {
        "ok": data is not None,
        "via": via,
        "age_s": _status_age(data),
        "path": STATUS_JSON,
        "fresh": (data or {}).get("fresh"),
        "errors": (data or {}).get("errors") or {},
    }
    out["ok"] = out["vastctl"]["ok"] or out["status_json"]["ok"]
    return out


def _coin_totals(rigs: list) -> list[dict]:
    totals: dict[str, dict] = {}
    for rig in rigs:
        for m in rig.get("miners") or []:
            hr = m.get("hashrate") or {}
            if not hr:
                continue
            algo = (m.get("algo") or "").lower()
            if "quantus" in algo or "qtu" in algo:
                name = "QTU"
            elif algo.startswith("rx/") or algo == "randomx":
                name = "XMR"
            elif "pearl" in algo:
                name = "PRL"
            elif "verus" in algo:
                name = "VRSC"
            else:
                name = (m.get("algo") or "?").upper()
            cur = totals.setdefault(
                name, {"name": name, "unit": hr.get("unit", ""), "value": 0.0, "accepted": 0,
                       "rejected": 0, "miners": 0}
            )
            cur["value"] += float(hr.get("rate") or 0)
            cur["accepted"] += int(hr.get("a") or 0)
            cur["rejected"] += int(hr.get("r") or 0)
            cur["miners"] += 1
    return sorted(totals.values(), key=lambda c: c["value"], reverse=True)


def overview() -> dict:
    data, via = snapshot()
    pool = pool_snapshot()
    rigs = list((data or {}).get("rigs") or [])

    fleet = {
        "rigs": len(rigs),
        "running": sum(1 for r in rigs if (r.get("status") or "").lower() == "running"),
        "dph_h": round(float((data or {}).get("total_dph") or 0.0), 4),
        "miners": sum(len(r.get("miners") or []) for r in rigs),
        "shares_accepted": sum(
            int(((m.get("hashrate") or {}).get("a") or 0))
            for r in rigs for m in (r.get("miners") or [])
        ),
        "errors": sum(1 for r in rigs if r.get("error")),
        "coins": _coin_totals(rigs),
    }
    fleet["dph_day"] = round(fleet["dph_h"] * 24, 2)

    pool_view: dict[str, Any] = {}
    if isinstance(pool, dict):
        miners = pool.get("_miners") or []
        blocks = pool.get("_blocks") or []
        shares = pool.get("shares") or {}
        routing = pool.get("routing") or {}
        pplns = pool.get("pplns") or {}
        bidx = pool.get("blocks") or {}
        top = sorted(
            (m for m in miners if (m.get("hps") or 0) > 0),
            key=lambda m: m.get("hps") or 0,
            reverse=True,
        )[:10]
        pool_view = {
            "sessions": pool.get("sessions"),
            "connections": pool.get("total_connections"),
            "uptime_s": pool.get("uptime_s"),
            "miners": len(miners),
            "active_miners": sum(1 for m in miners if (m.get("hps") or 0) > 0),
            "hashrate_hps": sum(float(m.get("hps") or 0) for m in miners),
            "accepted": shares.get("accepted"),
            "rejected": shares.get("rejected"),
            "accept_pct": routing.get("total_accept_rate_pct"),
            "submits": routing.get("total_submits"),
            "unpaid_miners": pplns.get("miners_with_unpaid"),
            "registered_miners": pplns.get("registered_miners"),
            "blocks_found": bidx.get("found"),
            "blocks_confirmed": bidx.get("confirmed"),
            "blocks_pending": bidx.get("pending"),
            "blocks_orphaned": bidx.get("orphaned"),
            "luck_100": bidx.get("luck_100"),
            "fee_bps": (pool.get("pool") or {}).get("fee_bps"),
            "top_miners": [
                {
                    "worker": m.get("worker") or m.get("address"),
                    "address": m.get("address"),
                    "hps": m.get("hps"),
                    "hps_1h": m.get("hps_1h"),
                    "blocks": m.get("blocks"),
                    "last_seen": m.get("last_seen"),
                    "streams": m.get("streams") or {},
                }
                for m in top
            ],
            "recent_blocks": (blocks or [])[:10],
        }

    return {
        "ts": (data or {}).get("ts"),
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "source": {"fleet": via, "pool": "api" if pool_view else "unavailable"},
        "stale": (_status_age(data) or 0) > 180,
        "fleet": fleet,
        "pool": pool_view,
        "rigs": rigs,
        "smos": (data or {}).get("smos"),
        "agents": (data or {}).get("agents"),
        "ext": (data or {}).get("ext"),
        "fresh": (data or {}).get("fresh"),
        "errors": (data or {}).get("errors") or {},
        "daemon": (data or {}).get("daemon"),
    }


def fleet() -> dict:
    data, via = snapshot()
    return {
        "ts": (data or {}).get("ts"),
        "source": via,
        "total_dph": (data or {}).get("total_dph"),
        "rigs": (data or {}).get("rigs") or [],
        "smos": (data or {}).get("smos"),
        "agents": (data or {}).get("agents"),
        "fresh": (data or {}).get("fresh"),
        "errors": (data or {}).get("errors") or {},
    }


def pool() -> dict:
    p = pool_snapshot()
    if not isinstance(p, dict):
        return {"error": "pool API unavailable", "url": POOL_URL}
    return p


def logs(params: dict) -> dict:
    rig = (params.get("id") or [""])[0]
    src = (params.get("src") or ["all"])[0]
    if not re.fullmatch(r"\d{3,20}", rig or ""):
        return {"error": "bad rig id"}
    if not re.fullmatch(r"[a-z0-9_-]{1,16}", src or ""):
        return {"error": "bad log source"}
    qs = urllib.parse.urlencode({"id": rig, "src": src})
    code, raw = _http(f"{VASTCTL_URL}/api/logs?{qs}", timeout=25)
    return {
        "http": code,
        "text": raw.decode("utf-8", "replace")[-20000:] if raw else "",
    }


# ── market / inference read-through ─────────────────────────────────────────

def market(params: dict) -> dict:
    gpu = (params.get("gpu") or ["any"])[0] or "any"
    if not re.fullmatch(r"[A-Za-z0-9_ .+-]{1,40}", gpu):
        return {"error": "bad gpu filter"}
    qs: dict[str, str] = {"gpu": gpu, "limit": str(min(int((params.get("limit") or ["30"])[0] or 30), 100))}
    dph = (params.get("max_dph") or [""])[0].strip()
    if dph:
        try:
            qs["max_dph"] = str(float(dph))
        except ValueError:
            pass
    code, raw = _http(f"{VASTCTL_URL}/api/offers?" + urllib.parse.urlencode(qs), timeout=40)
    if code != 200:
        return {"error": f"offers API returned HTTP {code}", "offers": []}
    try:
        offers = json.loads(raw.decode("utf-8", "replace"))
    except Exception:
        return {"error": "offers API returned invalid JSON", "offers": []}
    offers = [o for o in offers if isinstance(o, dict)]
    offers.sort(key=lambda o: float(o.get("dph_total") or 9e9))
    return {"offers": offers, "count": len(offers), "gpu": gpu}


def ai() -> dict:
    status, via = _json(f"{VASTCTL_URL}/api/ai/status", timeout=25), "serve"
    if not isinstance(status, dict):
        return {"error": "AI status unavailable", "rigs": [], "catalog": []}
    catalog = _json(f"{VASTCTL_URL}/api/inference/catalog", timeout=15) or []
    status["catalog"] = catalog if isinstance(catalog, list) else []
    status["source"] = via
    return status


# ── provisioning: rent a GPU on vast.ai and deploy, as one background job ───
#
# EDGE (and EDGE2) have no GPU at all — the control plane can only orchestrate.
# Anything that computes must run on a rented vast.ai instance, so the
# "auto → vast" path is: reuse a running rig if one can host the model, else
# pick the cheapest offer under a price cap, rent it, wait for boot, deploy.

import threading

_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()
_JOB_KEEP = 12


def _job_new(kind: str) -> dict:
    jid = f"{int(time.time())}-{os.urandom(3).hex()}"
    job = {
        "id": jid,
        "kind": kind,
        "state": "running",
        "started": time.strftime("%H:%M:%S"),
        "updated": time.time(),
        "log": [],
        "result": None,
        "error": None,
    }
    with _jobs_lock:
        _jobs[jid] = job
        for stale in sorted(_jobs)[:-_JOB_KEEP]:
            _jobs.pop(stale, None)
    return job


def _job_log(job: dict, msg: str) -> None:
    job["log"].append(f"{time.strftime('%H:%M:%S')}  {msg}")
    job["updated"] = time.time()


def _vastctl(path: str, method: str = "GET", params: dict | None = None,
             timeout: float = 60) -> tuple[int, str]:
    url = f"{VASTCTL_URL}/api/{path}"
    clean = {k: v for k, v in (params or {}).items() if v not in (None, "")}
    if clean:
        url += "?" + urllib.parse.urlencode(clean)
    code, raw = _http(url, timeout=timeout, method=method)
    return code, raw.decode("utf-8", "replace")


def _vastctl_json(path: str, params: dict | None = None, timeout: float = 60) -> Any:
    code, text = _vastctl(path, params=params, timeout=timeout)
    if code != 200:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def provision(params: dict) -> dict:
    """Start 'rent on vast.ai -> deploy model' as a background job."""
    model = str(params.get("model") or "").strip()
    if not model:
        return {"ok": False, "error": "model required"}
    gpu = str(params.get("gpu") or "RTX_3060")
    try:
        max_dph = float(params.get("max_dph") or os.environ.get("OPS_PROVISION_MAX_DPH", "0.15"))
    except (TypeError, ValueError):
        max_dph = 0.15
    dry = str(params.get("dry_run") or "") in ("1", "true", "True", "yes")
    job = _job_new("provision")
    threading.Thread(
        target=_run_provision, args=(job, model, gpu, max_dph, dry), daemon=True
    ).start()
    return {"ok": True, "job": job["id"], "dry_run": dry}


def _run_provision(job: dict, model: str, gpu: str, max_dph: float, dry: bool) -> None:
    try:
        _job_log(job, "model %s · hladam GPU %s do $%.2f/h%s" % (
            model, gpu, max_dph, " (dry-run, nic se nepronajme)" if dry else ""))

        st = _vastctl_json("ai/status", timeout=90) or {}
        rigs = st.get("rigs") or []
        _job_log(job, "vastctl vidi %d rig(u), %d s inference" % (
            len(rigs), sum(1 for r in rigs if r.get("inference_reachable"))))

        already = [r for r in rigs if model in (r.get("models") or []) and r.get("inference_reachable")]
        if already:
            _job_log(job, "model uz bezi na rig #%s - nic nepronajimam" % already[0]["id"])
            job["result"] = {"rig": already[0]["id"], "deployed": False, "rented": False}
            job["state"] = "done"
            return

        # 1) reuse a rig that can host the model — cheapest path is no new rental
        candidates = [r for r in rigs if (r.get("gpus") and not r.get("error"))]
        if candidates:
            best = max(candidates, key=lambda r: sum(g.get("memory_free_mib", 0) for g in r.get("gpus") or []))
            free = sum(g.get("memory_free_mib", 0) for g in best.get("gpus") or []) / 1024
            _job_log(job, "použiju existujici rig #%s (%.1f GiB free VRAM) - bez noveho nakladu" % (best["id"], free))
            if dry:
                job["result"] = {"rig": best["id"], "rented": False, "dry_run": True}
                job["state"] = "done"
                return
            code, text = _vastctl("inference/auto-deploy", method="POST",
                                  params={"confirm": 1, "model": model}, timeout=900)
            _job_log(job, "auto-deploy HTTP %d: %s" % (code, text[:400]))
            job["result"] = {"rig": best["id"], "deployed": code == 200, "rented": False,
                             "output": text[:2000]}
            job["state"] = "done" if code == 200 else "failed"
            if code != 200:
                job["error"] = text[:400]
            return

        # 2) nothing running -> rent the cheapest offer under the cap
        offers = _vastctl_json("offers", params={"gpu": gpu, "max_dph": "%.4f" % max_dph, "limit": 20},
                               timeout=90)
        if not isinstance(offers, list) or not offers:
            job["state"] = "failed"
            job["error"] = "zadna nabidka %s do $%.2f/h" % (gpu, max_dph)
            _job_log(job, job["error"])
            return
        cheapest = min(offers, key=lambda o: float(o.get("dph_total") or 9e9))
        dph = float(cheapest.get("dph_total") or 0)
        _job_log(job, "nejlevnejsi: %s $%.4f/h (%s, offer %s) ~ $%.2f/den" % (
            cheapest.get("gpu_name"), dph, cheapest.get("geolocation"),
            cheapest.get("id"), dph * 24))
        if dry:
            job["result"] = {"offer": cheapest, "rented": False, "dry_run": True,
                             "est_day": round(dph * 24, 2)}
            job["state"] = "done"
            return

        code, text = _vastctl("rent", method="POST", params={"id": cheapest.get("id")}, timeout=240)
        _job_log(job, "rent HTTP %d: %s" % (code, text[:300]))
        if code != 200:
            job["state"] = "failed"
            job["error"] = text[:400]
            return
        m = re.search(r"instance\s+(\d{5,})", text) or re.search(r"'new_contract':\s*(\d+)", text)
        iid = m.group(1) if m else None
        _job_log(job, "pronajato: instance %s - boot ~1-3 min, cekam" % (iid or "(nezname id)"))

        # 3) wait for the instance to come up
        deadline = time.time() + 8 * 60
        last = None
        booted = False
        while time.time() < deadline:
            time.sleep(15)
            snap = _vastctl_json("status", timeout=60) or {}
            rig = next((r for r in snap.get("rigs") or [] if iid and str(r.get("id")) == str(iid)), None)
            state = (rig or {}).get("status") or ("not-listed" if not rig else "unknown")
            if state != last:
                _job_log(job, "rig %s -> %s" % (iid or "?", state))
                last = state
            if rig and state.lower() == "running":
                booted = True
                break
        if not booted:
            _job_log(job, "rig nenabehl do 8 min - zkus 'auto-deploy' pozdeji rucne")

        # 4) deploy the model on whatever rig is now the best fit
        code, text = _vastctl("inference/auto-deploy", method="POST",
                              params={"confirm": 1, "model": model}, timeout=900)
        _job_log(job, "auto-deploy HTTP %d: %s" % (code, text[:400]))
        job["result"] = {"rig": iid, "deployed": code == 200, "rented": True,
                         "dph": dph, "offer": cheapest.get("id"), "output": text[:2000]}
        job["state"] = "done" if code == 200 else "failed"
        if code != 200:
            job["error"] = text[:400]
    except Exception as exc:  # never leave a job hanging in "running"
        job["state"] = "failed"
        job["error"] = str(exc)
        try:
            _job_log(job, "FAILED: %s" % exc)
        except Exception:
            pass


def job(job_id: str) -> dict:
    with _jobs_lock:
        j = _jobs.get(job_id)
        return dict(j) if j else {"error": "unknown job"}


# ── audit trail ─────────────────────────────────────────────────────────────

_audit_mem: list[dict] = []


def _audit(actor: str, name: str, params: dict, result: dict) -> None:
    rec = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "actor": actor,
        "action": name,
        "params": {k: (str(v)[:120]) for k, v in (params or {}).items()},
        "ok": bool(result.get("ok")),
        "http": result.get("http"),
    }
    _audit_mem.append(rec)
    del _audit_mem[:-300]
    try:
        import pathlib

        path = pathlib.Path(AUDIT_PATH)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:
        pass  # audit is best-effort, never block the action


def audit(limit: int = 40) -> dict:
    rows: list[dict] = []
    try:
        with open(AUDIT_PATH, "rb") as fh:
            fh.seek(0, 2)
            size = fh.tell()
            fh.seek(max(0, size - 64000))
            tail = fh.read().decode("utf-8", "replace")
        for line in tail.splitlines()[-limit:]:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except Exception:
                continue
    except Exception:
        rows = list(_audit_mem[-limit:])
    return {"entries": rows[-limit:], "path": AUDIT_PATH}


def action(name: str, params: dict, method: str | None = None) -> dict:
    if not name or not _ALLOWED_ACTION.match(name):
        return {"ok": False, "error": f"action '{name}' is not allowed"}
    clean = {
        k: v
        for k, v in (params or {}).items()
        if re.fullmatch(r"[a-z0-9_]{1,32}", k or "", re.I)
        and isinstance(v, (str, int, float, bool))
    }
    url = f"{VASTCTL_URL}/api/{name}"
    if clean:
        url += "?" + urllib.parse.urlencode(clean)
    verb = (method or ("GET" if name in _READ_ONLY_ACTIONS else "POST")).upper()
    code, raw = _http(url, timeout=120, method=verb)
    text = raw.decode("utf-8", "replace")
    out: dict[str, Any] = {"ok": 200 <= code < 300, "http": code, "action": name}
    try:
        out["data"] = json.loads(text) if text else None
    except Exception:
        out["text"] = text[-8000:]
    return out


# ── dispatch ────────────────────────────────────────────────────────────────

def handle(handler, route: str, params: dict, method: str = "GET",
           payload: dict | None = None) -> bool:
    """Serve /api/ops/*. Returns True when the route was handled."""

    try:
        if route == "/api/ops/health":
            handler._json(health())
        elif route == "/api/ops/overview":
            handler._json(overview())
        elif route == "/api/ops/fleet":
            handler._json(fleet())
        elif route == "/api/ops/pool":
            handler._json(pool())
        elif route == "/api/ops/market":
            handler._json(market(params))
        elif route == "/api/ops/ai":
            handler._json(ai())
        elif route == "/api/ops/audit":
            try:
                limit = int((params.get("limit") or ["40"])[0])
            except Exception:
                limit = 40
            handler._json(audit(max(1, min(limit, 300))))
        elif route == "/api/ops/job":
            handler._json(job((params.get("id") or [""])[0]))
        elif route == "/api/ops/provision":
            body = payload or {}
            result = provision(body if isinstance(body, dict) else {})
            actor = "unknown"
            try:
                actor = str(getattr(handler, "client_address", ("?",))[0])
            except Exception:
                pass
            _audit(actor, "provision", body if isinstance(body, dict) else {}, result)
            handler._json(result)
        elif route == "/api/ops/logs":
            handler._json(logs(params))
        elif route == "/api/ops/status":
            handler._json(_cached("status", SNAP_TTL, lambda: _json(f"{VASTCTL_URL}/api/status")) or {})
        elif route == "/api/ops/action":
            body = payload or {}
            name = str(body.get("action") or "").strip()
            act_params = body.get("params") or {}
            if not isinstance(act_params, dict):
                act_params = {}
            result = action(name, act_params, body.get("method"))
            actor = ""
            try:
                actor = getattr(handler, "client_address", ("",))[0]
                actor = f"{actor}:{getattr(handler, 'headers', {}).get('X-Real-IP', '')}"
            except Exception:
                pass
            _audit(actor or "unknown", name, act_params, result)
            handler._json(result)
        else:
            handler._json({"error": "unknown ops route"}, status=404)
    except Exception as exc:  # never take the dashboard down for an ops panel
        try:
            handler._json({"error": f"ops console failure: {exc}"}, status=500)
        except Exception:
            pass
    return True
