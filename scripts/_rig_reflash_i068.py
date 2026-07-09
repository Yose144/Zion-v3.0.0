import os
#!/usr/bin/env python3
"""Reflash to i068b via SMOS commandId=72 with image parameter."""
import json, urllib.request, time

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
RIG = 518837

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    ct = "application/merge-patch+json" if method == "PATCH" else "application/json"
    req = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": ct})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw.strip() else {}
    except Exception as e:
        print(f"  ERR: {method} {path} => {e}")
        try:
            print(f"  Body: {e.read().decode(errors='replace')[:500]}")
        except Exception:
            pass
        return None

# commandId=72 is "OS Reflasher" 
# commandOptions should be the image identifier
# Previous reflash from i088->i085 used command 72
# Try different formats for specifying i068b

targets = [
    "i068b",
    "068b", 
    "68b",
    "68",
    "SM-i068b",
    "SM-i068b-5.15.80-a21.50.2-rf22.20.3-5.16.16-nv530.41.03-u20",
    "1317",  # possible version number
]

for t in targets:
    print(f"Trying commandId=72 with commandOptions='{t}'...")
    r = api("PATCH", "/rigs/execute-command",
        {"rigIds": [RIG], "commandId": 72, "commandOptions": t})
    if r is not None:
        print(f"  => Success: {r}")
    else:
        print(f"  => Failed")
    time.sleep(2)

# Check rig status after
print("\n=== Rig status ===")
rig = api("GET", f"/rigs/{RIG}")
if rig:
    rd = rig.get("redisData", {})
    print(f"  online={rig.get('isOnline')}")
    print(f"  executeStatus={rig.get('executeStatus')}")
    print(f"  kernel={rd.get('kernel')} driver={rd.get('driver')}")
    print(f"  osVersion={rig.get('osVersion')}")
