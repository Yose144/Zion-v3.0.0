#!/usr/bin/env python3
"""Read-only write-path probes -> node_exporter textfile (EDGE2).

Importing this module performs no I/O. Runtime credentials stay local and are
never included in metrics. Recorded payout freshness is separate from the
in-memory queue: queued entries deliberately have no creation timestamp.
"""
import json
import math
import os
import re
import subprocess
import time
import urllib.request

OUT = "/var/lib/prometheus/node-exporter/zion_writepath.prom"
RPC = "http://127.0.0.1:9445/jsonrpc"
ENV_FILE = "/opt/zion/shared/.env"
PAYOUT_URL = "http://127.0.0.1:8080/public/v1/payouts?source=recorded&coin=zion&limit=1"


def http_json(url, payload=None, timeout=5):
    try:
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except Exception:
        return None


_help_emitted = set()


def m(name, value, labels=None, help_text=None):
    lbl = ""
    if labels:
        lbl = "{" + ",".join(f'{k}={json.dumps(str(v))}' for k, v in labels.items()) + "}"
    out = []
    if help_text and name not in _help_emitted:
        _help_emitted.add(name)
        out.extend([f"# HELP {name} {help_text}", f"# TYPE {name} gauge"])
    out.append(f"{name}{lbl} {value}")
    return "\n".join(out)


def recorded_payout_timestamp(payload, now):
    """Read latest_recorded_ts. Never the first row and never the clock now.

    A queued row is `"ts": null` on purpose. An older pool that omits the
    field is not healthy: return None so the measurement gauge stays down.
    """
    if not isinstance(payload, dict) or payload.get("ok") is not True:
        return None
    ts = payload.get("latest_recorded_ts")
    if isinstance(ts, bool) or not isinstance(ts, (int, float)):
        return None
    if not math.isfinite(ts) or ts <= 0 or ts > now:
        return None
    return ts


def payout_metrics(payload, now):
    http_ok = isinstance(payload, dict) and payload.get("ok") is True
    metrics = [m("zion_pool_payouts_api_ok", int(http_ok),
                 help_text="Pool public payout endpoint responded")]
    if not http_ok:
        return metrics
    ts = recorded_payout_timestamp(payload, now)
    metrics.append(m("zion_pool_payout_measurement_ok", int(ts is not None),
                     help_text="latest_recorded_ts is a real ledger clock"))
    if ts is not None:
        metrics.append(m("zion_pool_last_payout_age_seconds", int(now - ts),
                         help_text="Age of newest recorded ZION payout ledger row"))
    return metrics


def collect_metrics():
    _help_emitted.clear()
    metrics = []
    st = http_json(RPC, {"jsonrpc": "2.0", "id": 1, "method": "getStatus", "params": {}})
    tip = st.get("result", {}).get("chain_height") if st else None
    if tip is not None:
        metrics.append(m("zion_chain_tip", tip, help_text="V31 chain tip from getStatus RPC"))
    metrics.append(m("zion_chain_tip_ok", int(tip is not None), help_text="getStatus RPC reachable"))

    for name, port in (("l5", 8095), ("l6", 8097)):
        d = http_json(f"http://127.0.0.1:{port}/api/v1/fund/balance")
        h = d.get("data", {}).get("last_block_height") if d and d.get("success") else None
        metrics.append(m("zion_scanner_api_ok", int(h is not None), {"layer": name}, f"Fund balance API reachable ({name})"))
        if h is not None:
            metrics.append(m("zion_scanner_height", h, {"layer": name}, f"Scanner last_block_height ({name})"))
            if tip is not None:
                metrics.append(m("zion_scanner_lag_blocks", max(0, tip - h), {"layer": name}, f"Chain tip minus scanner height ({name})"))

    pg_ok = 0
    pw = None
    try:
        with open(ENV_FILE) as f:
            mm = re.search(r'^DATABASE_URL="?postgresql://zion:([^@"]+)@', f.read(), re.M)
        pw = mm.group(1) if mm else None
    except OSError:
        pass
    if pw:
        e = dict(os.environ, PGPASSWORD=pw)
        try:
            r = subprocess.run(["psql", "-h", "localhost", "-U", "zion", "-d", "zion", "-tAc", "SELECT 1"],
                               capture_output=True, text=True, timeout=8, env=e)
            pg_ok = int(r.returncode == 0 and r.stdout.strip() == "1")
            if pg_ok:
                r = subprocess.run(["psql", "-h", "localhost", "-U", "zion", "-d", "zion", "-tAc",
                                    'SELECT COALESCE(EXTRACT(EPOCH FROM now() - max("lastShareAt"))::int, -1) FROM "MiningWorker"'],
                                   capture_output=True, text=True, timeout=8, env=e)
                age = int(r.stdout.strip())
                if r.returncode == 0 and age >= 0:
                    metrics.append(m("zion_dbsync_worker_last_share_age_seconds", age, help_text="Age of newest MiningWorker.lastShareAt"))
        except (OSError, subprocess.TimeoutExpired, ValueError):
            # Still publish the other probes; a PG timeout must not leave a
            # permanently green old textfile behind.
            pg_ok = 0
    metrics.append(m("zion_dbsync_pg_ok", pg_ok, help_text="db-sync credentials authenticate to PostgreSQL"))

    t0 = time.monotonic()
    stats = http_json("http://127.0.0.1:8080/stats", timeout=8)
    metrics.append(m("zion_pool_stats_api_ok", int(stats is not None), help_text="Pool /stats returns within 8s via edge tunnel"))
    metrics.append(m("zion_pool_stats_api_latency_seconds", round(time.monotonic() - t0, 3), help_text="Pool /stats response time"))
    metrics.extend(payout_metrics(http_json(PAYOUT_URL, timeout=8), time.time()))

    blk = http_json("http://127.0.0.1:8080/public/v1/blocks?limit=1", timeout=8)
    blk_ts = blk["blocks"][0].get("ts") if blk and blk.get("ok") and blk.get("blocks") else None
    if blk_ts is not None:
        metrics.append(m("zion_pool_last_block_age_seconds", max(0, int(time.time() - blk_ts)), help_text="Age of newest block found by the pool"))
        metrics.append(m("zion_pool_block_tip_height", int(blk["blocks"][0].get("height") or 0), help_text="Height of newest block found by the pool"))
    metrics.append(m("zion_pool_blocks_api_ok", int(blk_ts is not None), help_text="Pool public blocks endpoint returns a row"))

    t0 = time.monotonic()
    gw = http_json("http://127.0.0.1:8007/health", timeout=8)
    gw_ok = bool(gw and gw.get("status") == "ok")
    metrics.append(m("zion_hiran_gateway_ok", int(gw_ok), help_text="Hiran gateway /health responds"))
    metrics.append(m("zion_hiran_gateway_latency_seconds", round(time.monotonic() - t0, 3), help_text="Hiran gateway /health response time"))
    if gw_ok:
        for u in gw.get("upstreams", []):
            metrics.append(m("zion_hiran_upstream_live", int(bool(u.get("live"))),
                             {"alias": u.get("alias", "?"), "position": u.get("position", 0)}, "Upstream leg liveness per model alias"))
        metrics.append(m("zion_hiran_degraded_upstreams_live", sum(1 for u in gw.get("upstreams", []) if u.get("degraded") and u.get("live")),
                         help_text="Count of live fallback (degraded) upstream legs"))

    for unit, name in (("zion-v31-free-world", "l5"), ("zion-v31-issobella", "l6"), ("zion-db-sync", "dbsync")):
        r = subprocess.run(["systemctl", "is-active", unit], capture_output=True, text=True, timeout=8)
        metrics.append(m("zion_service_active", int(r.stdout.strip() == "active"), {"service": name}, f"systemd is-active {unit}"))
    metrics.append(m("zion_writepath_probe_success_timestamp_seconds", int(time.time()), help_text="Last complete write-path probe collection"))
    return "\n".join(metrics) + "\n"


def main():
    body = collect_metrics()
    tmp = OUT + ".tmp"
    with open(tmp, "w") as f:
        f.write(body)
    os.replace(tmp, OUT)


if __name__ == "__main__":
    main()
