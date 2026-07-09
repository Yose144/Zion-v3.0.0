import os
#!/usr/bin/env python3
"""
Vega OC tuning v4 - push memory higher, try PL=5, higher VDDC.
Current: CC=1115 MC=800 P=187W → 16.68 MH/s (MC stuck at 800)

On SMOS i066d, "ocPowerLimit" for AMD is actually power stage (1-7).
PL=7 = maximum power. Let's try PL=5 to give more headroom.
Also try ocMode=true for aggressive undervolt mode which might help.
"""
import requests, json, time, base64, re

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
RIG = 518837

H_JSON = {"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/json"}
H_PATCH = {"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/merge-patch+json"}
H_GET = {"X-AUTH-TOKEN": TOKEN}

# Try higher settings
oc = {
    "ocCore": "1200",
    "ocMemory": "1100",
    "ocPowerLimit": "5",
    "ocVddc": "1000",
    "ocMvdd": "",
    "ocMvddci": "",
    "ocMode": True,     # Aggressive undervolt mode
}

print("="*60)
print("OC v4: Core=1200 Mem=1100 PL=5 VDDC=1000 Mode=aggressive")
print("="*60)

r = requests.put(f"{API}/rigs/{RIG}", headers=H_JSON, json=oc)
print(f"PUT: HTTP {r.status_code}")

time.sleep(1)
r = requests.patch(f"{API}/rigs/execute-reload", headers=H_PATCH, json={"rigIds": [RIG]})
print(f"Reload: HTTP {r.status_code}")

print("Waiting 75s...")
time.sleep(75)

# Check
r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET)
rig = r.json()
print(f"\nocCore={rig.get('ocCore')} ocMem={rig.get('ocMemory')} ocPL={rig.get('ocPowerLimit')} ocVDDC={rig.get('ocVddc')} ocMode={rig.get('ocMode')}")

r2 = requests.get(f"{API}/rigs/{RIG}/console", headers=H_GET)
c = r2.json().get("console", "")
try:
    d = base64.b64decode(c).decode('utf-8')
    cl = re.sub(r'<[^>]+>', '\n', d)
    lines = [l.strip() for l in cl.split('\n') if l.strip()]
    for l in reversed(lines):
        if 'CC:' in l and 'P:' in l:
            print(f"GPU: {l}")
            break
    for l in reversed(lines):
        if 'MH/s' in l and 'Total' in l:
            print(f"Hash: {l}")
            break
    for l in reversed(lines):
        if 'kH/W' in l:
            print(f"Eff: {l}")
            break
    for l in reversed(lines):
        if 'accepted' in l.lower():
            print(f"Share: {l}")
            break
    print(f"\nLast 15 lines:")
    for l in lines[-15:]:
        print(f"  {l}")
except:
    pass
