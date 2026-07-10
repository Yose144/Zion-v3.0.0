#!/usr/bin/env python3
import json, os, sys, time, urllib.request

API = "https://api.simplemining.net"
RIG = 518837
GROUP = 1773590

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

print(">> test PATCH customMiner")
api("PATCH", f"/rig-groups/{GROUP}", {"customMiner": "http://62.171.141.136/zion-miner/zion-sm3042c.zip"})
time.sleep(2)

print(">> check group")
group = api("GET", f"/rig-groups/{GROUP}")
print(f"  customMiner={group.get('customMiner', 'N/A')}")
print(f"  minerOptions={group.get('minerOptions', 'N/A')}")
