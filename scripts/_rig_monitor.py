import os
#!/usr/bin/env python3
"""Monitor rig status and console after Deeksha deployment."""
import requests, json

BASE = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
headers = {"X-AUTH-TOKEN": TOKEN}

# Check rig status
r = requests.get(f"{BASE}/rigs/518837", headers=headers, timeout=15)
rig = r.json()
print("=== RIG STATUS ===")
print(f"Name: {rig.get('name')}")
print(f"Online: {rig.get('isOnline')}")
print(f"ExecuteStatus: {rig.get('executeStatus')}")
rg = rig.get("rigGroup", {})
print(f"Group: {rg.get('name')} (id={rg.get('id')})")
rd = rig.get("redisData", {})
if rd:
    print(f"Hashrate: {rd.get('hashrate')}")
    print(f"Miner: {rd.get('miner')}")
    gpus = rd.get("gpuList", [])
    for g in gpus:
        print(f"  GPU: {g.get('name')} temp={g.get('temp')}C fan={g.get('fan')}%")

print()
print("=== CONSOLE OUTPUT (last 4000 chars) ===")
r2 = requests.get(f"{BASE}/rigs/518837/console", headers=headers, timeout=15)
console = r2.json()
text = console.get("console", "")
if len(text) > 4000:
    text = text[-4000:]
print(text)
