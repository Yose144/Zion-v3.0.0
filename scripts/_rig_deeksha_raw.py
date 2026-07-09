import os
#!/usr/bin/env python3
"""Dump raw SMOS API responses for debugging."""
import requests, json

API = "https://api.simplemining.net"
H = {"Authorization": "Bearer " + os.environ.get("SIMPLEMINING_API_TOKEN", "")}

# Get ZION-Deeksha-AMD group config
print("=== Group 1765707 raw ===")
r = requests.get(f"{API}/rig-groups/1765707", headers=H)
print(f"  HTTP {r.status_code}")
data = r.json()
print(json.dumps(data, indent=2)[:3000])

print()

# Get rig status  
print("=== Rig 518837 raw ===")
r2 = requests.get(f"{API}/rigs/518837", headers=H)
print(f"  HTTP {r2.status_code}")
data2 = r2.json()
# Print just the keys and some key fields
if isinstance(data2, dict):
    keys = list(data2.keys())
    print(f"  Keys ({len(keys)}): {keys[:30]}")
    for k in ["status", "kernel", "driver", "minerUptime", "accepted", "rigGroupId", 
              "gpus", "minerName", "rigName", "osVersion"]:
        v = data2.get(k)
        if v is not None:
            if k == "gpus" and isinstance(v, list):
                print(f"  {k}: {len(v)} GPUs")
                for g in v[:2]:
                    print(f"    {json.dumps(g)[:200]}")
            else:
                print(f"  {k}: {v}")
    # print full for small responses
    if len(json.dumps(data2)) < 2000:
        print(json.dumps(data2, indent=2))
