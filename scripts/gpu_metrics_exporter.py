#!/usr/bin/env python3
"""
ZION GPU Metrics Exporter — Prometheus compatible

Scrapes lolminer/teamredminer/t-rex APIs and exposes
/metrics endpoint for Prometheus/Grafana.

Metrics:
  zion_gpu_hashrate_mhs{miner,coin,algo}
  zion_gpu_shares_total{miner,type}  (accepted/rejected/stale)
  zion_gpu_temp_celsius{device}
  zion_gpu_power_watts{device}
  zion_gpu_profit_usd_day{coin}
"""

import os
import json
import time
import logging
import http.server
import urllib.request

EXPORTER_PORT  = int(os.environ.get("EXPORTER_PORT", "9200"))
LOLMINER_API   = os.environ.get("LOLMINER_API", "http://lolminer:19999")
TREX_API       = os.environ.get("TREX_API",     "")
TRM_API        = os.environ.get("TRM_API",      "")
POLL_INTERVAL  = int(os.environ.get("POLL_INTERVAL_SEC", "30"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [GPU-EXPORTER] %(message)s")
log = logging.getLogger(__name__)

# Cache
_metrics_cache = ""
_last_update   = 0


def fetch_json(url: str) -> dict:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ZION-Exporter/1.0"})
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())
    except Exception:
        return {}


def collect_lolminer(data: dict) -> list[str]:
    lines = []
    if not data:
        return lines

    session = data.get("Session", {})
    gpus    = data.get("GPUs", [])
    coin    = session.get("Active_Coin", "?")
    algo    = session.get("Active_Algo", "?")

    # Total hashrate
    hr = session.get("Performance_Factor", 0)
    lines.append(f'zion_gpu_hashrate_mhs{{miner="lolminer",coin="{coin}",algo="{algo}"}} {hr:.3f}')

    # Shares
    acc  = session.get("Accepted",  0)
    rej  = session.get("Rejected",  0)
    stale = session.get("Stale",    0)
    lines.append(f'zion_gpu_shares_total{{miner="lolminer",type="accepted"}} {acc}')
    lines.append(f'zion_gpu_shares_total{{miner="lolminer",type="rejected"}} {rej}')
    lines.append(f'zion_gpu_shares_total{{miner="lolminer",type="stale"}}    {stale}')

    # Per-GPU
    for i, gpu in enumerate(gpus):
        name  = gpu.get("Model", f"GPU{i}").replace(" ", "_")
        temp  = gpu.get("Core_Temp", 0)
        power = gpu.get("Power_Usage", 0)
        fan   = gpu.get("Fan_Speed_pct", 0)
        g_hr  = gpu.get("Performance", 0)
        lines.append(f'zion_gpu_hashrate_mhs{{miner="lolminer",device="{name}",id="{i}",coin="{coin}"}} {g_hr:.3f}')
        lines.append(f'zion_gpu_temp_celsius{{device="{name}",id="{i}"}} {temp}')
        lines.append(f'zion_gpu_power_watts{{device="{name}",id="{i}"}} {power}')
        lines.append(f'zion_gpu_fan_pct{{device="{name}",id="{i}"}} {fan}')

    return lines


def collect_trex(data: dict) -> list[str]:
    lines = []
    if not data:
        return lines

    algo = data.get("algorithm", "?")
    coin = data.get("coin", "?")

    total_hr = sum(g.get("hashrate", 0) for g in data.get("gpus", [])) / 1e6
    lines.append(f'zion_gpu_hashrate_mhs{{miner="trex",coin="{coin}",algo="{algo}"}} {total_hr:.3f}')

    acc = data.get("accepted_count", 0)
    rej = data.get("rejected_count", 0)
    lines.append(f'zion_gpu_shares_total{{miner="trex",type="accepted"}} {acc}')
    lines.append(f'zion_gpu_shares_total{{miner="trex",type="rejected"}} {rej}')

    for gpu in data.get("gpus", []):
        name  = gpu.get("name", "?").replace(" ", "_")
        i     = gpu.get("gpu_id", 0)
        g_hr  = gpu.get("hashrate", 0) / 1e6
        temp  = gpu.get("temperature", 0)
        power = gpu.get("power_usage", 0)
        fan   = gpu.get("fan_speed", 0)
        lines.append(f'zion_gpu_hashrate_mhs{{miner="trex",device="{name}",id="{i}",coin="{coin}"}} {g_hr:.3f}')
        lines.append(f'zion_gpu_temp_celsius{{device="{name}",id="{i}"}} {temp}')
        lines.append(f'zion_gpu_power_watts{{device="{name}",id="{i}"}} {power}')
        lines.append(f'zion_gpu_fan_pct{{device="{name}",id="{i}"}} {fan}')

    return lines


def build_metrics() -> str:
    global _metrics_cache, _last_update

    now = time.time()
    if now - _last_update < POLL_INTERVAL:
        return _metrics_cache

    lines = [
        "# HELP zion_gpu_hashrate_mhs GPU hashrate in MH/s",
        "# TYPE zion_gpu_hashrate_mhs gauge",
        "# HELP zion_gpu_shares_total Total shares submitted",
        "# TYPE zion_gpu_shares_total counter",
        "# HELP zion_gpu_temp_celsius GPU temperature in Celsius",
        "# TYPE zion_gpu_temp_celsius gauge",
        "# HELP zion_gpu_power_watts GPU power consumption in Watts",
        "# TYPE zion_gpu_power_watts gauge",
        "# HELP zion_gpu_fan_pct GPU fan speed percentage",
        "# TYPE zion_gpu_fan_pct gauge",
    ]

    lolminer_data = fetch_json(f"{LOLMINER_API}/summary")
    lines.extend(collect_lolminer(lolminer_data))

    if TREX_API:
        trex_data = fetch_json(f"{TREX_API}/summary")
        lines.extend(collect_trex(trex_data))

    lines.append(f'zion_gpu_exporter_scrape_timestamp {int(now * 1000)}')

    _metrics_cache = "\n".join(lines) + "\n"
    _last_update = now
    return _metrics_cache


class MetricsHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass

    def do_GET(self):
        if self.path == "/metrics":
            body = build_metrics().encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; version=0.0.4")
            self.end_headers()
            self.wfile.write(body)
        elif self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    log.info(f"ZION GPU Metrics Exporter listening on :{EXPORTER_PORT}")
    server = http.server.HTTPServer(("0.0.0.0", EXPORTER_PORT), MetricsHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
