#!/usr/bin/env python3
"""
Vega OC tuning v3 - balanced for stability + performance.
Previous: CC=1224 MC=800 P=214W → 14.10 MH/s (mem crashed to 800)
Target: CC~1200 MC=1000+ P~220-250W → 16+ MH/s

Strategy: 
  Core=1200 (realistic for Vega at 950mV)
  Mem=1000 (stable HBM2 clock)
  PL=3 (power stage 3 = stock ~210-220W range)
  VDDC=950 (keep)
  MVDD/MVDDCI empty (let driver manage HBM voltage)
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
    "ocPowerLimit": "3",
    "ocVddc": "950",
    "ocMvdd": "",
    "ocMvddci": "",
}

print("="*60)
print("OC v3: Core=1200 Mem=1000 PL=3 VDDC=950")
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
    # Show accepts
    for l in reversed(lines):
        if 'accepted' in l.lower() or ('|' in l and 'MH/s' in l and 'GPU0' in l):
            print(f"Shares: {l}")
            break
    print(f"\nLast 10 lines:")
    for l in lines[-10:]:
        print(f"  {l}")
except:
    pass
