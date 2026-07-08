#!/usr/bin/env python3
"""Full pre-deployment check for Deeksha miner on SMOS with correct auth."""
import requests, json

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
H = {"X-AUTH-TOKEN": TOKEN}

# 1) Rig details
print("=== Rig 518837 ===")
r = requests.get(f"{API}/rigs/518837", headers=H, timeout=10)
print(f"HTTP {r.status_code}")
if r.status_code == 200:
    rig = r.json()
    for k in ["name", "status", "ip", "kernel", "osSeries", "osVersion",
              "executeStatus", "ocCore", "ocMemory", "ocPowerLimit", "ocVddc"]:
        print(f"  {k}: {rig.get(k, '')}")
    # rigGroup
    rg = rig.get("rigGroup", {})
    if rg:
        print(f"  rigGroup: id={rg.get('id')} name={rg.get('name')}")
    # GPUs
    gpus = rig.get("gpuList", [])
    print(f"  gpuList: {len(gpus)} GPUs")
    for g in gpus:
        print(f"    {json.dumps(g)[:200]}")
    # redisData (live telemetry)
    rd = rig.get("redisData")
    if rd:
        print(f"  redisData keys: {list(rd.keys())[:20]}")
        for k in ["status", "kernel", "driver", "minerUptime", "accepted", 
                   "hashrate", "gpus"]:
            v = rd.get(k)
            if v is not None:
                if k == "gpus" and isinstance(v, list):
                    for gi, gd in enumerate(v):
                        print(f"    gpu[{gi}]: {json.dumps(gd)[:200]}")
                else:
                    print(f"    {k}: {v}")
else:
    print(f"  {r.text[:200]}")

print()

# 2) Group configs
print("=== Group Configs ===")
r2 = requests.get(f"{API}/rig-groups/user-list", headers=H, timeout=10)
print(f"HTTP {r2.status_code}")
if r2.status_code == 200:
    groups = r2.json()
    for g in groups:
        gid = g.get("id")
        name = g.get("name", "")
        mp = g.get("minerProgram", {})
        mpname = mp.get("name", "") if isinstance(mp, dict) else str(mp)
        mopts = g.get("minerOptions", "")[:100]
        online = g.get("rigsOnlineCount", 0)
        total = g.get("rigsTotalCount", 0)
        print(f"  id={gid} name={name} miner={mpname} online={online}/{total}")
        if mopts:
            print(f"    minerOptions: {mopts}")
