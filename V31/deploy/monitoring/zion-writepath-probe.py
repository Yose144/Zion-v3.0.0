#!/usr/bin/env python3
"""Write-path health probe -> node_exporter textfile.

Lesson P0-1/P0-2 (2026-10-26): services can be systemd-active while their
write path is dead for days. This probe measures the write path itself:
  - L5/L6 scanner: last_block_height vs chain tip (scanner lag)
  - db-sync: real PG auth via its own DATABASE_URL + newest row freshness
"""
import json, os, re, subprocess, time, urllib.request

OUT = "/var/lib/prometheus/node-exporter/zion_writepath.prom"
RPC = "http://127.0.0.1:9445/jsonrpc"
ENV_FILE = "/opt/zion/shared/.env"


def http_json(url, payload=None, timeout=5):
    try:
        if payload is None:
            with urllib.request.urlopen(url, timeout=timeout) as r:
                return json.loads(r.read())
        data = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except Exception:
        return None


_help_emitted = set()


def m(name, value, labels=None, help_text=None):
    lbl = ""
    if labels:
        lbl = "{" + ",".join(f'{k}="{v}"' for k, v in labels.items()) + "}"
    out = []
    if help_text and name not in _help_emitted:
        _help_emitted.add(name)
        out.append(f"# HELP {name} {help_text}")
        out.append(f"# TYPE {name} gauge")
    out.append(f"{name}{lbl} {value}")
    return "\n".join(out)


metrics = []

# chain tip
tip = None
st = http_json(RPC, {"jsonrpc": "2.0", "id": 1, "method": "getStatus", "params": {}})
if st and st.get("result"):
    tip = st["result"].get("chain_height")
if tip is not None:
    metrics.append(m("zion_chain_tip", tip, help_text="V31 chain tip from getStatus RPC"))
metrics.append(m("zion_chain_tip_ok", 1 if tip is not None else 0, help_text="getStatus RPC reachable"))

# L5 / L6 scanner lag
for name, port in (("l5", 8095), ("l6", 8097)):
    d = http_json(f"http://127.0.0.1:{port}/api/v1/fund/balance")
    h = d.get("data", {}).get("last_block_height") if d and d.get("success") else None
    ok = 1 if h is not None else 0
    metrics.append(m("zion_scanner_api_ok", ok, {"layer": name}, f"Fund balance API reachable ({name})"))
    if h is not None:
        metrics.append(m("zion_scanner_height", h, {"layer": name}, f"Scanner last_block_height ({name})"))
        if tip is not None:
            metrics.append(m("zion_scanner_lag_blocks", max(0, tip - h), {"layer": name}, f"Chain tip minus scanner height ({name})"))

# db-sync: auth via its own credentials + write freshness
pg_ok = 0
pw = None
try:
    env = open(ENV_FILE).read()
    mm = re.search(r'^DATABASE_URL="?postgresql://zion:([^@"]+)@', env, re.M)
    pw = mm.group(1) if mm else None
except Exception:
    pass
if pw:
    e = dict(os.environ, PGPASSWORD=pw)
    r = subprocess.run(["psql", "-h", "localhost", "-U", "zion", "-d", "zion",
                        "-tAc", "SELECT 1"], capture_output=True, text=True,
                       timeout=8, env=e)
    pg_ok = 1 if r.returncode == 0 and r.stdout.strip() == "1" else 0
    if pg_ok:
        r = subprocess.run(["psql", "-h", "localhost", "-U", "zion", "-d", "zion",
                            "-tAc", 'SELECT COALESCE(EXTRACT(EPOCH FROM now() - max("lastShareAt"))::int, -1) FROM "MiningWorker"'],
                           capture_output=True, text=True, timeout=8, env=e)
        try:
            age = int(r.stdout.strip())
            if age >= 0:
                metrics.append(m("zion_dbsync_worker_last_share_age_seconds", age, help_text="Age of newest MiningWorker.lastShareAt"))
        except ValueError:
            pass
metrics.append(m("zion_dbsync_pg_ok", pg_ok, help_text="db-sync credentials authenticate to PostgreSQL"))

# Pool API latency — lesson 2026-10-26: /stats hung ~1h while /metrics
# stayed up (pool.lock() critical section). Prometheus scrape of /metrics
# alone cannot see that. Measure the pool's heaviest endpoint directly.
t0 = time.time()
stats = http_json("http://127.0.0.1:8080/stats", timeout=8)
lat = time.time() - t0
ok = 1 if stats is not None else 0
metrics.append(m("zion_pool_stats_api_ok", ok, help_text="Pool /stats returns within 8s via edge tunnel"))
metrics.append(m("zion_pool_stats_api_latency_seconds", round(lat, 3), help_text="Pool /stats response time"))

# G8 — Hiran inference gateway (api.zionterranova.com -> 127.0.0.1:8007).
# /health returns per-upstream liveness; export each leg so alerts can
# distinguish "gateway dead" from "primary GPU upstream offline" (which is
# expected when the operator PC sleeps — degraded fallback leg must be live).
t0 = time.time()
gw = http_json("http://127.0.0.1:8007/health", timeout=8)
gw_lat = time.time() - t0
gw_ok = 1 if gw and gw.get("status") == "ok" else 0
metrics.append(m("zion_hiran_gateway_ok", gw_ok, help_text="Hiran gateway /health responds"))
metrics.append(m("zion_hiran_gateway_latency_seconds", round(gw_lat, 3), help_text="Hiran gateway /health response time"))
if gw_ok:
    for u in gw.get("upstreams", []):
        alias = u.get("alias", "?")
        pos = u.get("position", 0)
        live = 1 if u.get("live") else 0
        metrics.append(m("zion_hiran_upstream_live", live,
                         {"alias": str(alias), "position": str(pos)},
                         "Upstream leg liveness per model alias"))
    degraded_live = sum(
        1 for u in gw.get("upstreams", [])
        if u.get("degraded") and u.get("live"))
    metrics.append(m("zion_hiran_degraded_upstreams_live", degraded_live,
                     help_text="Count of live fallback (degraded) upstream legs"))

for unit, name in (("zion-v31-free-world", "l5"), ("zion-v31-issobella", "l6"), ("zion-db-sync", "dbsync")):
    r = subprocess.run(["systemctl", "is-active", unit], capture_output=True, text=True)
    metrics.append(m("zion_service_active", 1 if r.stdout.strip() == "active" else 0, {"service": name}, f"systemd is-active {unit}"))

tmp = OUT + ".tmp"
with open(tmp, "w") as f:
    f.write("\n".join(metrics) + "\n")
os.replace(tmp, OUT)
