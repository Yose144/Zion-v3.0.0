#!/usr/bin/env python3
import json, os, sys, time, urllib.request

API = "https://api.simplemining.net"
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

print(">> check current group")
group = api("GET", f"/rig-groups/{GROUP}")
print(f"  minerProgram={group.get('minerProgram', 'N/A')}")

print(">> set minerProgram")
api("PUT", f"/rig-groups/{GROUP}", {
    "minerProgram": "http://77.42.71.94/zion-miner/zion-sm3042c.zip",
    "minerOptions": "--algorithm deeksha_lite_fire --pool 77.42.71.94:8444 --wallet zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604 --worker vega-smos"
})
time.sleep(2)

print(">> verify")
group = api("GET", f"/rig-groups/{GROUP}")
print(f"  minerProgram={group.get('minerProgram', 'N/A')}")
print(f"  minerOptions={group.get('minerOptions', 'N/A')}")
