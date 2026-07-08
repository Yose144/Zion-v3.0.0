#!/usr/bin/env python3
"""
Vega OC tuning for progpow_zano mining on i066d.
Current: CC=1097 MC=1000 P=186W → 15.89 MH/s
Target: ~250W power draw, maximum hashrate.

Vega optimal OC for ProgPow:
  Core: 1400 MHz (P7 state) 
  Memory: 1100 MHz (HBM2 sweet spot)
  VDDC: 950 mV (core voltage)
  MVDD: 900 mV (HBM voltage)
  MVDDCI: 900 mV (HBM I/O voltage)
  PowerLimit: 0 (default TDP ~295W for Vega 64, ~210W for Vega 56)
  
ProgPow is compute-heavy, so core clock matters most.
"""
import requests, json, time, base64, re

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
RIG = 518837
OC_ID = 128118  # "Vega" OC profile

H = {"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/merge-patch+json"}
H_GET = {"X-AUTH-TOKEN": TOKEN}

# ── Apply OC via rig PUT ──
# ProgPow Vega tuning: Core up, Mem modest, voltage controlled
oc_settings = {
    "ocCore": "1400",       # Core clock MHz (P7 state)
    "ocMemory": "1100",     # Memory clock MHz  
    "ocPowerLimit": "0",    # Default TDP (no limit reduction)
    "ocVddc": "950",        # Core voltage mV
    "ocMvdd": "900",        # HBM voltage
    "ocMvddci": "900",      # HBM I/O voltage
}

print("="*60)
print("OC TUNING: Vega for ProgPow ZANO")
print("="*60)
print(f"  Core:     {oc_settings['ocCore']} MHz")
print(f"  Memory:   {oc_settings['ocMemory']} MHz")
print(f"  PL:       {oc_settings['ocPowerLimit']} (default TDP)")
print(f"  VDDC:     {oc_settings['ocVddc']} mV")
print(f"  MVDD:     {oc_settings['ocMvdd']} mV")
print(f"  MVDDCI:   {oc_settings['ocMvddci']} mV")

# Apply via PUT to rig
print(f"\nApplying OC to rig {RIG}...")
r = requests.put(f"{API}/rigs/{RIG}", headers=H, json=oc_settings)
print(f"  PUT rig: HTTP {r.status_code} → {r.text[:300]}")

# Reload miner to apply
print(f"\nReloading rig...")
r2 = requests.patch(f"{API}/rigs/execute-reload", headers=H, json={"rigIds": [RIG]})
print(f"  Reload: HTTP {r2.status_code} → {r2.text[:200]}")

# Wait for miner to restart and stabilize
print(f"\nWaiting 90s for miner to restart and stabilize...")
time.sleep(90)

# Check result
print(f"\n{'='*60}")
print("POST-OC STATUS")
print(f"{'='*60}")
r3 = requests.get(f"{API}/rigs/{RIG}", headers=H_GET)
rig = r3.json()
rd = rig.get('redisData') or {}
print(f"  ocCore:    {rig.get('ocCore')}")
print(f"  ocMem:     {rig.get('ocMemory')}")
print(f"  ocPL:      {rig.get('ocPowerLimit')}")
print(f"  ocVDDC:    {rig.get('ocVddc')}")
print(f"  ocMVDD:    {rig.get('ocMvdd')}")
print(f"  ocMVDDCI:  {rig.get('ocMvddci')}")
print(f"  hashrate:  {rd.get('hashrate',{})}")

# Console for actual clocks/power
r4 = requests.get(f"{API}/rigs/{RIG}/console", headers=H_GET)
c = r4.json().get("console", "")
try:
    d = base64.b64decode(c).decode('utf-8')
    cl = re.sub(r'<[^>]+>', '\n', d)
    lines = [l.strip() for l in cl.split('\n') if l.strip()]
    print(f"\nConsole (last 25 lines):")
    for l in lines[-25:]:
        print(f"  {l}")
except:
    pass
