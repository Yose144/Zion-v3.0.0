import os
#!/usr/bin/env python3
"""
Vega OC tuning v2 - fix content-type + update OC profile.
Current: CC=1097 MC=1000 P=186W → 15.78 MH/s
"""
import requests, json, time, base64, re

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
RIG = 518837
OC_ID = 128118  # "Vega" OC profile

H_JSON = {"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/json"}
H_PATCH = {"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/merge-patch+json"}
H_GET = {"X-AUTH-TOKEN": TOKEN}

# ── Step 1: Check current OC profile details ──
print("="*60)
print("STEP 1: Current OC profiles")
print("="*60)
r = requests.get(f"{API}/rig-ocs/user-list", headers=H_GET)
ocs = r.json()
for oc in ocs:
    if oc.get('id') == OC_ID:
        print(f"  OC Profile '{oc.get('name')}' (id={OC_ID}):")
        print(f"    Core:    {oc.get('ocCore')}")
        print(f"    Memory:  {oc.get('ocMemory')}")
        print(f"    PL:      {oc.get('ocPowerLimit')}")
        print(f"    VDDC:    {oc.get('ocVddc')}")
        print(f"    MVDD:    {oc.get('ocMvdd')}")
        print(f"    MVDDCI:  {oc.get('ocMvddci')}")
        print(f"    Mode:    {oc.get('ocMode')}")
        print(f"    AdvTool: {oc.get('isOcAdvToolsOn')}")

# ── Step 2: Update rig OC directly with correct content-type ──
print(f"\n{'='*60}")
print("STEP 2: Apply OC directly to rig (application/json)")
print("="*60)

oc_settings = {
    "ocCore": "1400",
    "ocMemory": "1100",
    "ocPowerLimit": "0",
    "ocVddc": "950",
    "ocMvdd": "900",
    "ocMvddci": "900",
}
print(f"  Settings: {json.dumps(oc_settings)}")

r = requests.put(f"{API}/rigs/{RIG}", headers=H_JSON, json=oc_settings)
print(f"  PUT (json): HTTP {r.status_code}")
if r.status_code != 200:
    print(f"  Response: {r.text[:400]}")
    # Try PATCH instead
    print(f"\n  Trying PATCH...")
    r = requests.patch(f"{API}/rigs/{RIG}", headers=H_PATCH, json=oc_settings)
    print(f"  PATCH: HTTP {r.status_code}")
    if r.status_code != 200:
        print(f"  Response: {r.text[:400]}")

# ── Step 3: Verify OC was applied ──
print(f"\n{'='*60}")
print("STEP 3: Verify OC settings on rig")
print("="*60)
time.sleep(2)
r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET)
rig = r.json()
print(f"  ocCore:    {rig.get('ocCore')}")
print(f"  ocMem:     {rig.get('ocMemory')}")
print(f"  ocPL:      {rig.get('ocPowerLimit')}")
print(f"  ocVDDC:    {rig.get('ocVddc')}")
print(f"  ocMVDD:    {rig.get('ocMvdd')}")
print(f"  ocMVDDCI:  {rig.get('ocMvddci')}")

# ── Step 4: Reload to apply ──
print(f"\n{'='*60}")
print("STEP 4: Reload rig to apply OC")
print("="*60)
r = requests.patch(f"{API}/rigs/execute-reload", headers=H_PATCH, json={"rigIds": [RIG]})
print(f"  Reload: HTTP {r.status_code}")

# ── Step 5: Wait and check result ──
print(f"\nWaiting 60s for miner to restart...")
time.sleep(60)

print(f"\n{'='*60}")
print("STEP 5: Post-reload GPU stats")
print("="*60)
r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET)
rig = r.json()
rd = rig.get('redisData') or {}

r2 = requests.get(f"{API}/rigs/{RIG}/console", headers=H_GET)
c = r2.json().get("console", "")
try:
    d = base64.b64decode(c).decode('utf-8')
    cl = re.sub(r'<[^>]+>', '\n', d)
    lines = [l.strip() for l in cl.split('\n') if l.strip()]
    # Find last GPU status line with CC/MC/P
    for l in reversed(lines):
        if 'CC:' in l and 'P:' in l:
            print(f"  GPU: {l}")
            break
    # Find last hashrate line
    for l in reversed(lines):
        if 'MH/s' in l and 'Total' in l:
            print(f"  Hash: {l}")
            break
    print(f"\n  Console (last 15 lines):")
    for l in lines[-15:]:
        print(f"    {l}")
except:
    pass
