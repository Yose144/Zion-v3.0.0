#!/usr/bin/env python3
"""
Vega OC v5 - back to best known + tweak.
Best so far: PL=100(orig), Core=1150, Mem=950 → CC=1097 MC=1000 P=186W → 15.89 MH/s
Second best: PL=3, Core=1200, Mem=1000 → CC=1115 MC=800 P=187W → 16.68 MH/s

ProgPow is compute-bound, so core matters more than memory.
Let's try: Core=1300, Mem=950, PL=4, VDDC=975, ocMode=false
"""
import requests, json, time, base64, re

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
RIG = 518837

H_JSON = {"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/json"}
H_PATCH = {"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/merge-patch+json"}
H_GET = {"X-AUTH-TOKEN": TOKEN}

oc = {
    "ocCore": "1300",
    "ocMemory": "950",
    "ocPowerLimit": "4",
    "ocVddc": "975",
    "ocMvdd": "",
    "ocMvddci": "",
    "ocMode": False,
}

print("="*60)
print("OC v5: Core=1300 Mem=950 PL=4 VDDC=975 Mode=off")
print("="*60)

r = requests.put(f"{API}/rigs/{RIG}", headers=H_JSON, json=oc)
print(f"PUT: HTTP {r.status_code}")

time.sleep(1)
r = requests.patch(f"{API}/rigs/execute-reload", headers=H_PATCH, json={"rigIds": [RIG]})
print(f"Reload: HTTP {r.status_code}")

print("Waiting 75s...")
time.sleep(75)

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
    print(f"\nLast 12 lines:")
    for l in lines[-12:]:
        print(f"  {l}")
except:
    pass
