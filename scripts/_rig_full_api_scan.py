import os
#!/usr/bin/env python3
"""Full SMOS API scan: commands list, rig status, group change, reflash."""
import requests, json, time

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
RIG = 518837
ZANO_GROUP = 1765837

H = {
    "X-AUTH-TOKEN": TOKEN,
    "Content-Type": "application/merge-patch+json"
}
H_GET = {"X-AUTH-TOKEN": TOKEN}

print("="*70)
print("STEP 1: GET /rig-commands — list ALL available commands")
print("="*70)
r = requests.get(f"{API}/rig-commands", headers=H_GET)
print(f"HTTP {r.status_code}")
cmds = r.json()
for c in cmds:
    print(f"  ID={c.get('id'):3d}  cmd={c.get('cmd','?'):30s}  name={c.get('name','?')}")
    if c.get('description'):
        print(f"         desc: {c['description'][:100]}")
print(f"\nTotal commands: {len(cmds)}")

# Find reflash-related commands
reflash_cmds = [c for c in cmds if 'reflash' in str(c).lower() or 'flash' in str(c).lower() or 'image' in str(c).lower() or 'os' in str(c).lower()]
if reflash_cmds:
    print(f"\n--- Reflash/OS related commands ---")
    for c in reflash_cmds:
        print(f"  ID={c.get('id')}  cmd={c.get('cmd')}  name={c.get('name')}  desc={c.get('description','')[:200]}")

print("\n" + "="*70)
print("STEP 2: GET /rigs/{id} — current rig status")
print("="*70)
r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET)
print(f"HTTP {r.status_code}")
rig = r.json()
print(f"  name:          {rig.get('name')}")
print(f"  isOnline:      {rig.get('isOnline')}")
print(f"  osSeries:      {rig.get('osSeries')}")
print(f"  osVersion:     {rig.get('osVersion')}")
print(f"  executeStatus: {rig.get('executeStatus')}")
print(f"  rigGroup:      {rig.get('rigGroup')}")
print(f"  rigOc:         {rig.get('rigOc')}")
print(f"  isPaused:      {rig.get('isPaused')}")
gpu_list = rig.get('gpuList', [])
for g in gpu_list:
    print(f"  GPU {g.get('gpuId')}: {g.get('gpuName','?')} CC={g.get('gpuCoreClock','?')} MC={g.get('gpuMemClock','?')} P={g.get('gpuPower','?')}W T={g.get('gpuTemp','?')}C")
redis = rig.get('redisData', {})
if redis:
    print(f"  kernel:  {redis.get('kernel','?')}")
    print(f"  driver:  {redis.get('driver','?')}")
    hr = redis.get('hashrate', {})
    if isinstance(hr, dict):
        print(f"  hashrate: {hr}")

print("\n" + "="*70)
print("STEP 3: PATCH /rigs/change-rig-group — switch to ZANO group")
print("="*70)
payload = {
    "rigIds": [RIG],
    "rigGroupId": ZANO_GROUP,
    "execute": "reload"
}
print(f"  Payload: {json.dumps(payload)}")
r = requests.patch(f"{API}/rigs/change-rig-group", headers=H, json=payload)
print(f"  HTTP {r.status_code}  Response: {r.text[:500]}")

print("\n" + "="*70)
print("STEP 4: Check group after change")
print("="*70)
time.sleep(2)
r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET)
rig2 = r.json()
print(f"  rigGroup: {rig2.get('rigGroup')}")
print(f"  executeStatus: {rig2.get('executeStatus')}")

print("\n" + "="*70)
print("STEP 5: GET /rig-groups/user-list — list all groups")
print("="*70)
r = requests.get(f"{API}/rig-groups/user-list", headers=H_GET)
print(f"HTTP {r.status_code}")
groups = r.json()
for g in groups:
    print(f"  ID={g.get('id')}  name={g.get('name')}  rigs={g.get('rigsTotalCount')}/{g.get('rigsOnlineCount')} online")
    print(f"    miner: {g.get('minerProgram')}")
    mo = g.get('minerOptions', '')
    if mo:
        print(f"    options: {mo[:150]}")

print("\nDone.")
