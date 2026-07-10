#!/usr/bin/env python3
"""PATCH only minerOptions with URL first."""
import json, os, sys, time, urllib.request, base64, re

API = "https://api.simplemining.net"
RIG = 518837
GROUP = 1773590

MINER_URL = "http://62.171.141.136/zion-miner/zion-sm3042c.zip"
MINER_OPTS = (
    f"{MINER_URL} "
    f"--algorithm deeksha_lite_fire "
    f"--pool 62.171.141.136:8444 "
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
    print(">> PATCH minerOptions only")
    api("PATCH", f"/rig-groups/{GROUP}", {"minerOptions": MINER_OPTS})
    time.sleep(2)

    print(">> verify")
    group = api("GET", f"/rig-groups/{GROUP}")
    print(f"  minerOptions={group.get('minerOptions', 'N/A')}")

    print(">> clear cache")
    api("PATCH", "/rigs/execute-command", {
        "rigIds": [RIG], "commandId": 7,
        "commandOptions": "rm -rf /root/miner/custom_* /var/tmp/miner/custom_* ; echo CLEAR",
    })
    time.sleep(5)

    print(">> reload")
    api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})

    print(">> wait 90s...")
    time.sleep(90)

    text = console()
    print("=== LAST 15 LINES ===")
    for ln in text.splitlines()[-15:]:
        print(ln)
