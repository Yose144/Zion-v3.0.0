#!/usr/bin/env python3
"""Correct SMOS deploy: URL as first arg in minerOptions, minerProgram=408 (custom)."""
import json, os, sys, time, urllib.request, base64, re

API = "https://api.simplemining.net"
RIG = 518837
GROUP = 1773590

MINER_URL = "http://77.42.71.94/zion-miner/zion-sm3042c.zip"
MINER_OPTS = (
    f"{MINER_URL} "
    f"--algorithm deeksha_lite_fire "
    f"--pool 77.42.71.94:8444 "
    f"--wallet zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604 "
    f"--worker vega-smos"
)

def token():
    t = os.environ.get("SMOS_API_TOKEN", "").strip()
    if not t:
        sys.exit("Set SMOS_API_TOKEN")
    return t

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    ct = "application/merge-patch+json" if method == "PATCH" else "application/json"
    req = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={"X-AUTH-TOKEN": token(), "Content-Type": ct},
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

if __name__ == "__main__":
    print(">> update group: minerProgram=408, minerOptions=URL first")
    api("PUT", f"/rig-groups/{GROUP}", {
        "minerProgram": 408,
        "minerOptions": MINER_OPTS
    })
    time.sleep(2)

    print(">> verify")
    group = api("GET", f"/rig-groups/{GROUP}")
    mp = group.get("minerProgram", {})
    print(f"  minerProgram id={mp.get('id')} name={mp.get('name')}")
    print(f"  minerOptions={group.get('minerOptions', 'N/A')}")

    print(">> clear cached miner on rig")
    api("PATCH", "/rigs/execute-command", {
        "rigIds": [RIG], "commandId": 7,
        "commandOptions": (
            "rm -rf /root/miner/custom_* /var/tmp/miner/custom_* ; echo CACHE_CLEARED"
        ),
    })
    time.sleep(5)

    print(">> reload rig")
    api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})

    print(">> waiting 90s for startup...")
    time.sleep(90)

    text = console()
    print("=== MINER (last 15 lines) ===")
    for ln in text.splitlines()[-15:]:
        print(ln)
