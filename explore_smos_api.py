#!/usr/bin/env python3
import json, os, sys, urllib.request

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SMOS_API_TOKEN", "").strip()

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    ct = "application/merge-patch+json" if method == "PATCH" else "application/json"
    req = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": ct},
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            raw = r.read()
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.reason}")
        return {}
    except Exception as e:
        print(f"  Error: {e}")
        return {}

# Try different endpoints for custom miner
endpoints = [
    "/rig-groups/1773590",
    "/rig-groups/1773590/miners",
    "/rigs/518837",
    "/rigs/518837/miner",
    "/rigs/518837/config",
    "/miners",
    "/miner-versions",
]

for ep in endpoints:
    print(f"GET {ep}:")
    result = api("GET", ep)
    if result:
        print(f"  keys: {list(result.keys()) if isinstance(result, dict) else 'list'}")
    print()
