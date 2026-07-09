import os
#!/usr/bin/env python3
"""Move rig back to ZANO group and reload."""
import json, urllib.request, time, base64, re

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
RIG = 518837
ZANO_GROUP = 1765837

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    ct = "application/merge-patch+json" if method == "PATCH" else "application/json"
    req = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": ct})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else {}

def decode_con(data):
    txt = data.get("console", "")
    try:
        d = base64.b64decode(txt).decode(errors="replace")
        return re.sub(r"<[^>]+>", "", d)
    except Exception:
        return txt

# Step 1: Move rig to ZANO group
print("=== Moving rig to ZANO group ===")
result = api("PUT", f"/rigs/{RIG}", {"rigGroup": ZANO_GROUP})
new_grp = result.get("rigGroup", {}).get("name", "?")
print(f"  Group now: {new_grp} (id={result.get('rigGroup',{}).get('id')})")

# Step 2: OC for ZANO/ProgPow — leave PL high
print("\n=== Setting OC for ProgPow ===")
api("PUT", f"/rigs/{RIG}", {
    "ocCore": "1150",
    "ocMemory": "950",
    "ocPowerLimit": "100",
    "ocVddc": "950",
    "ocMvdd": "900",
    "ocMvddci": "900",
})

# Step 3: Reload
print("=== Reloading miner ===")
api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})
print("  Waiting 90s for ZANO miner to start and auto-tune...")
time.sleep(90)

# Step 4: Check
rig = api("GET", f"/rigs/{RIG}")
rd = rig.get("redisData", {})
print(f"\n=== STATUS ===")
print(f"Online: {rig.get('isOnline')}")
print(f"Group: {rig.get('rigGroup',{}).get('name')}")
print(f"Process uptime: {rig.get('processUptime')} min")
print(f"Hash: {rd.get('hash')}")
print(f"GPU temp: {rd.get('gpuTemp')}, Fan: {rd.get('gpuFan')}")
print(f"Sys power: {rd.get('sysPwr')}W")

con_data = api("GET", f"/rigs/{RIG}/console")
con = decode_con(con_data)
print(f"\n=== CONSOLE ===")
print(con[-3000:])
