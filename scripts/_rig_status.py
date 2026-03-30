#!/usr/bin/env python3
"""Quick rig status check."""
import json, urllib.request

API = "https://api.simplemining.net"
TOKEN = "api-2ca5dec3ec452561ea893f8804e61e2f43b9ecd30d0614404a2e8e43b7d0212d"
RIG = 518837
GROUP = 1765707

def api_get(path):
    req = urllib.request.Request(
        f"{API}{path}", method="GET",
        headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

rig = api_get(f"/rigs/{RIG}")
print("=== RIG STATUS ===")
keys = [
    "isOnline", "osSeries", "osVersion", "gpuCount", "gpuCountMax",
    "minerName", "minerOptions", "minerOptionsExtra",
    "ocCore", "ocMemory", "ocPowerLimit", "ocVddc", "ocMvdd", "ocMvddci",
    "gpuPcieGen", "gpuPcieWidth", "gpuCoreClock", "gpuMemoryClock",
    "gpuTemp", "gpuFanPercent", "gpuPwrCur", "gpuHashrate", "gpuBusId",
    "gpuName", "gpuBrand", "uptimeMinutes",
]
for k in keys:
    v = rig.get(k, "N/A")
    print(f"  {k}: {v}")

print("\n=== GROUP CONFIG ===")
group = api_get(f"/rig-groups/{GROUP}")
for k in ["name", "minerOptions", "minerOptionsExtra"]:
    print(f"  {k}: {group.get(k, 'N/A')}")

print("\n=== FULL RIG JSON (compact) ===")
print(json.dumps(rig, indent=2, default=str)[:3000])
