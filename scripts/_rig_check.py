#!/usr/bin/env python3
"""Quick rig status check + OC tuning for Vega."""
import requests, base64, re, json

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
RIG = 518837
H = {"X-AUTH-TOKEN": TOKEN}

r = requests.get(f"{API}/rigs/{RIG}", headers=H)
rig = r.json()
rd = rig.get('redisData') or {}

print("="*60)
print("RIG STATUS")
print("="*60)
print(f"  online:  {rig.get('isOnline')}")
print(f"  kernel:  {rd.get('kernel','?')}")
print(f"  driver:  {rd.get('driver','?')}")
print(f"  group:   {rig.get('rigGroup')}")
print(f"  oc prof: {rig.get('rigOc')}")
print(f"  ocCore:  {rig.get('ocCore')}")
print(f"  ocMem:   {rig.get('ocMemory')}")
print(f"  ocPL:    {rig.get('ocPowerLimit')}")
print(f"  ocVDDC:  {rig.get('ocVddc')}")
print(f"  ocMVDD:  {rig.get('ocMvdd')}")
print(f"  ocMVDDCI:{rig.get('ocMvddci')}")
print(f"  ocMode:  {rig.get('ocMode')}")
print(f"  hashrate:{rd.get('hashrate',{})}")

gl = rig.get('gpuList', [])
for g in gl:
    print(f"  GPU {g.get('gpuId')}: {g.get('gpuName','?')} CC={g.get('gpuCoreClock','?')} MC={g.get('gpuMemClock','?')} P={g.get('gpuPower','?')}W T={g.get('gpuTemp','?')}C Fan={g.get('gpuFanSpeed','?')}%")

# Console
r2 = requests.get(f"{API}/rigs/{RIG}/console", headers=H)
c = r2.json().get("console", "")
try:
    d = base64.b64decode(c).decode('utf-8')
    cl = re.sub(r'<[^>]+>', '\n', d)
    lines = [l.strip() for l in cl.split('\n') if l.strip()]
    print(f"\nConsole (last 20 lines):")
    for l in lines[-20:]:
        print(f"  {l}")
except:
    print(f"Console raw: {c[:500]}")
