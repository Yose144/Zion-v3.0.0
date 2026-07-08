#!/usr/bin/env python3
"""Switch rig to Deeksha group and reload."""
import requests, json, time

BASE = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
headers = {
    "X-AUTH-TOKEN": TOKEN,
    "Content-Type": "application/merge-patch+json",
}
headers_get = {"X-AUTH-TOKEN": TOKEN}

# Step 1: Switch group to ZION-Deeksha-AMD (1765707)
print("Step 1: Switching rig to ZION-Deeksha-AMD group...")
payload = {"rigIds": [518837], "rigGroupId": 1765707, "execute": "reload"}
r = requests.patch(f"{BASE}/rigs/change-rig-group", headers=headers, json=payload, timeout=15)
print(f"  HTTP {r.status_code} -> {r.text}")

# Step 2: Verify the group was changed
print("\nStep 2: Verifying group change...")
r2 = requests.get(f"{BASE}/rigs/518837", headers=headers_get, timeout=15)
rig = r2.json()
rg = rig.get("rigGroup", {})
print(f"  Group: {rg.get('name')} (id={rg.get('id')})")
print(f"  ExecuteStatus: {rig.get('executeStatus')}")
print(f"  Online: {rig.get('isOnline')}")

if rg.get("id") == 1765707:
    print("\n  GROUP SWITCH OK")
else:
    print(f"\n  WARNING: Expected group 1765707, got {rg.get('id')}")
