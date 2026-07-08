#!/usr/bin/env python3
"""
Vega OC v8 - careful push with REBOOT.
After reboot: CC=1128 MC=950 P=194W → 15.40 MH/s
Now: Core=1200 Mem=1000 PL=100 VDDC=950 + REBOOT
"""
import requests, json, time, base64, re

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
RIG = 518837

H_JSON = {"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/json"}
H_PATCH = {"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/merge-patch+json"}
H_GET = {"X-AUTH-TOKEN": TOKEN}

oc = {
    "ocCore": "1200",
    "ocMemory": "1000",
    "ocPowerLimit": "100",
    "ocVddc": "950",
    "ocMvdd": "900",
    "ocMvddci": "900",
    "ocMode": False,
}

print("="*60)
print("OC v8: Core=1200 Mem=1000 PL=100 + REBOOT")
print("="*60)

r = requests.put(f"{API}/rigs/{RIG}", headers=H_JSON, json=oc)
print(f"PUT: HTTP {r.status_code}")
time.sleep(1)
r = requests.patch(f"{API}/rigs/execute-reboot", headers=H_PATCH, json={"rigIds": [RIG]})
print(f"Reboot: HTTP {r.status_code}")

print("Waiting 120s...")
time.sleep(120)

for attempt in range(10):
    r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET)
    rig = r.json()
    if rig.get('isOnline'):
        break
    print(f"  Still offline... ({attempt+1})")
    time.sleep(15)

time.sleep(30)

print(f"\nocCore={rig.get('ocCore')} ocMem={rig.get('ocMemory')} ocPL={rig.get('ocPowerLimit')} ocVDDC={rig.get('ocVddc')}")

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
