#!/usr/bin/env python3
"""G1 real-rig E2E monitor.

Polls the local miner metrics endpoint and a SimpleMining OS rig console,
logs accepted/rejected shares for both, and reports a 1-hour accept-rate
summary.

Usage:
    export SMOS_API_TOKEN="api-..."
    python3 scripts/monitor_g1_rigs.py [duration_minutes=60] [interval_secs=60]

Output:
    /tmp/zion-g1-monitor.log
"""
import base64
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

SMOS_API = "https://api.simplemining.net"
SMOS_RIG = int(os.environ.get("SMOS_RIG_ID", "518837"))
LOCAL_METRICS = "http://127.0.0.1:9101/metrics"
LOG_FILE = "/tmp/zion-g1-monitor.log"


def log(msg):
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    line = f"[{now}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def smos_api(method, path, token):
    req = urllib.request.Request(
        f"{SMOS_API}{path}",
        method=method,
        headers={"X-AUTH-TOKEN": token},
    )
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else {}


def smos_console(token):
    rig = smos_api("GET", f"/rigs/{SMOS_RIG}", token)
    raw = (rig.get("redisData") or {}).get("console") or ""
    try:
        raw = base64.b64decode(raw).decode("utf-8", errors="replace")
    except Exception:
        pass
    return re.sub(r"<[^>]+>", "", raw)


def parse_smos_stats(text):
    stats = {
        "total_accepted": None,
        "total_rejected": None,
        "rate": None,
        "zion_hashrate": None,
        "zion_accepted": None,
        "zion_rejected": None,
        "zano_hashrate": None,
        "zano_accepted": None,
        "zano_rejected": None,
    }
    for line in text.splitlines()[-80:]:
        m = re.search(r"(\d+) accepted\s*/\s*(\d+) rejected\s*\(([-\d.]+)%\)", line)
        if m:
            stats["total_accepted"] = int(m.group(1))
            stats["total_rejected"] = int(m.group(2))
            stats["rate"] = float(m.group(3))
        m = re.search(r"ZION\s+ZION[^\d]*(\d+\.?\d*)\s*KH/s\s*(\d+)/(\d+)", line)
        if m:
            stats["zion_hashrate"] = float(m.group(1))
            stats["zion_accepted"] = int(m.group(2))
            stats["zion_rejected"] = int(m.group(3))
        m = re.search(r"GPU PROFIT\s+ZANO[^\d]*(\d+\.?\d*)\s*MH/s\s*(\d+)/(\d+)", line)
        if m:
            stats["zano_hashrate"] = float(m.group(1))
            stats["zano_accepted"] = int(m.group(2))
            stats["zano_rejected"] = int(m.group(3))
    return stats


def parse_local_metrics(text):
    out = {}
    for line in text.splitlines():
        if line.startswith("#"):
            continue
        if "zion_miner_shares_accepted" in line and "coin=\"zion\"" in line:
            out["accepted"] = int(line.split()[-1])
        if "zion_miner_shares_rejected" in line and "coin=\"zion\"" in line:
            out["rejected"] = int(line.split()[-1])
        if "zion_miner_hash_rate" in line and "coin=\"zion\"" in line:
            out["hashrate"] = float(line.split()[-1])
    return out


def fetch_local():
    try:
        with urllib.request.urlopen(LOCAL_METRICS, timeout=10) as r:
            return parse_local_metrics(r.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}


def fetch_smos(token):
    try:
        return parse_smos_stats(smos_console(token))
    except Exception as e:
        return {"error": str(e)}


def accept_rate(acc, rej):
    total = acc + rej
    return (acc / total * 100.0) if total > 0 else 0.0


def main():
    token = os.environ.get("SMOS_API_TOKEN", "").strip()
    if not token:
        sys.exit("Set SMOS_API_TOKEN environment variable")

    duration_min = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    interval = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    samples = (duration_min * 60) // interval

    log(f"G1 monitor starting: {duration_min} min, interval {interval}s, SMOS rig {SMOS_RIG}")

    local_first = local_last = None
    smos_first = smos_last = None

    for i in range(samples):
        local = fetch_local()
        smos = fetch_smos(token)

        log(
            f"sample={i+1}/{samples} "
            f"local={local.get('hashrate', 0):.0f}H/s "
            f"a={local.get('accepted')} r={local.get('rejected')} "
            f"| smos_zion={smos.get('zion_hashrate')}KH/s "
            f"za={smos.get('zion_accepted')} zr={smos.get('zion_rejected')} "
            f"smos_zano={smos.get('zano_hashrate')}MH/s "
            f"| smos_total={smos.get('total_accepted')}/{smos.get('total_rejected')} "
            f"({smos.get('rate')}%)"
        )

        if local_first is None and local.get("accepted") is not None:
            local_first = local
        if local.get("accepted") is not None:
            local_last = local

        if smos_first is None and smos.get("total_accepted") is not None:
            smos_first = smos
        if smos.get("total_accepted") is not None:
            smos_last = smos

        if i < samples - 1:
            time.sleep(interval)

    log("--- G1 summary ---")
    if local_first and local_last:
        d_acc = local_last["accepted"] - local_first["accepted"]
        d_rej = local_last["rejected"] - local_first["rejected"]
        rate = accept_rate(d_acc, d_rej)
        log(
            f"LOCAL MINER: {d_acc} accepted / {d_rej} rejected "
            f"=> {rate:.2f}% accept rate over {duration_min} min"
        )
    else:
        log("LOCAL MINER: no samples collected")

    if smos_first and smos_last:
        d_acc = smos_last["total_accepted"] - smos_first["total_accepted"]
        d_rej = smos_last["total_rejected"] - smos_first["total_rejected"]
        rate = accept_rate(d_acc, d_rej)
        log(
            f"SMOS RIG: {d_acc} accepted / {d_rej} rejected "
            f"=> {rate:.2f}% accept rate over {duration_min} min"
        )
    else:
        log("SMOS RIG: no samples collected")


if __name__ == "__main__":
    main()
