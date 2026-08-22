#!/usr/bin/env python3
"""Poll SimpleMining console for rig 518837 and extract ZION mining stats.

Usage:
    export SMOS_API_TOKEN="api-..."
    python3 scripts/monitor_smos.py [interval_secs=60]
"""
import base64
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

API = "https://api.simplemining.net"
RIG = 518837


def token():
    t = os.environ.get("SMOS_API_TOKEN", "").strip()
    if not t:
        sys.exit("Set SMOS_API_TOKEN")
    return t


def api(method, path):
    req = urllib.request.Request(
        f"{API}{path}",
        method=method,
        headers={"X-AUTH-TOKEN": token()},
    )
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else {}


def console():
    rig = api("GET", f"/rigs/{RIG}")
    raw = (rig.get("redisData") or {}).get("console") or ""
    try:
        raw = base64.b64decode(raw).decode("utf-8", errors="replace")
    except Exception:
        pass
    return re.sub(r"<[^>]+>", "", raw)


def extract_stats(text):
    # Look for the TOTAL / accepted / rejected line and recent share lines
    stats = {"total_accepted": None, "total_rejected": None, "rate": None}
    for line in text.splitlines()[-60:]:
        m = re.search(r"(\d+) accepted\s*/\s*(\d+) rejected\s*\(([-\d.]+)%\)", line)
        if m:
            stats["total_accepted"] = int(m.group(1))
            stats["total_rejected"] = int(m.group(2))
            stats["rate"] = float(m.group(3))
        m = re.search(r"ZION.*?(\d+\.\d+)\s*KH/s\s*(\d+)/(\d+)", line)
        if m:
            stats["zion_hashrate"] = float(m.group(1))
            stats["zion_accepted"] = int(m.group(2))
            stats["zion_rejected"] = int(m.group(3))
    return stats


def main():
    interval = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    print(f"[monitor] polling rig {RIG} every {interval}s")
    last_stats = {}
    while True:
        try:
            text = console()
            stats = extract_stats(text)
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            zion = stats.get("zion_hashrate")
            zion_a = stats.get("zion_accepted")
            zion_r = stats.get("zion_rejected")
            total_a = stats.get("total_accepted")
            total_r = stats.get("total_rejected")
            rate = stats.get("rate")
            print(
                f"[{now}] ZION={zion} KH/s ({zion_a}/{zion_r}) "
                f"TOTAL={total_a}/{total_r} ({rate}%)"
            )
            if last_stats and total_a is not None and last_stats.get("total_accepted"):
                delta_a = total_a - last_stats["total_accepted"]
                delta_r = total_r - last_stats["total_rejected"]
                if delta_a + delta_r > 0:
                    interval_rate = delta_a / (delta_a + delta_r) * 100
                    print(f"[{now}] last-interval accept rate: {interval_rate:.1f}%")
            last_stats = stats
        except Exception as e:
            print(f"[{datetime.now(timezone.utc).isoformat()}] error: {e}")
        time.sleep(interval)


if __name__ == "__main__":
    main()
