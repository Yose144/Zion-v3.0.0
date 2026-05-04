#!/usr/bin/env python3
"""Quick rig status check."""
import requests, base64, re

API = "https://api.simplemining.net"
TOKEN = "api-2ca5dec3ec452561ea893f8804e61e2f43b9ecd30d0614404a2e8e43b7d0212d"
H = {"X-AUTH-TOKEN": TOKEN}

r = requests.get(f"{API}/rigs/518837", headers=H)
rig = r.json()
rd = rig.get('redisData') or {}

print(f"online:   {rig.get('isOnline')}")
print(f"kernel:   {rd.get('kernel','?')}")
print(f"driver:   {rd.get('driver','?')}")
print(f"group:    {rig.get('rigGroup')}")
print(f"oc:       {rig.get('rigOc')}")
print(f"exec:     {rig.get('executeStatus','')}")
print(f"hashrate: {rd.get('hashrate',{})}")
print(f"osVer:    {rig.get('osVersion')}")

for g in rig.get('gpuList', []):
    print(f"GPU: {g.get('gpuName','?')} CC={g.get('gpuCoreClock','?')} MC={g.get('gpuMemClock','?')} P={g.get('gpuPower','?')}W T={g.get('gpuTemp','?')}C Fan={g.get('gpuFanSpeed','?')}%")

# Console
r2 = requests.get(f"{API}/rigs/518837/console", headers=H)
c = r2.json().get("console", "")
try:
    d = base64.b64decode(c).decode('utf-8')
    lines = [l.strip() for l in re.sub(r'<[^>]+>', '\n', d).split('\n') if l.strip()]
    print("\n--- console (last 25 lines) ---")
    for l in lines[-25:]:
        print(l)
except:
    print(f"console raw: ...{c[-300:]}")
