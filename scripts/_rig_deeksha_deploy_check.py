import os
#!/usr/bin/env python3
"""Check ZION-Deeksha-AMD group and rig status before Deeksha deployment."""
import requests, json

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
H = {"Authorization": f"Bearer {TOKEN}"}

# 1) Get ZION-Deeksha-AMD group config
print("=== Group 1765707 (ZION-Deeksha-AMD) ===")
r = requests.get(f"{API}/rig-groups/1765707", headers=H)
print(f"  HTTP {r.status_code}")
if r.status_code == 200:
    g = r.json()
    for k in ["name", "minerName", "minerCustomUrl", "minerOptions", "minerType",
              "ocCoreClock", "ocMemClock", "ocPowerLimit", "ocVddc"]:
        print(f"  {k}: {g.get(k, '')}")
else:
    print(f"  {r.text[:200]}")

print()

# 2) Get rig status
print("=== Rig 518837 ===")
r2 = requests.get(f"{API}/rigs/518837", headers=H)
print(f"  HTTP {r2.status_code}")
if r2.status_code == 200:
    rig = r2.json()
    for k in ["status", "rigGroupId", "kernel", "driver", "minerUptime", 
              "accepted", "rigName", "minerName", "osVersion"]:
        print(f"  {k}: {rig.get(k, '')}")
    for gpu in rig.get("gpus", []):
        cc = gpu.get("gpuCoreClock", "?")
        mc = gpu.get("gpuMemClock", "?")
        pw = gpu.get("gpuPwrCur", "?")
        tp = gpu.get("gpuTemp", "?")
        hr = gpu.get("gpuHashrate", "?")
        fn = gpu.get("gpuFanSpeed", "?")
        print(f"  GPU: CC={cc} MC={mc} P={pw}W T={tp}C Fan={fn}% HR={hr}")
else:
    print(f"  {r2.text[:200]}")

print()

# 3) Check download URL
print("=== Testing miner download URL ===")
url = "https://zionterranova.com/downloads/zion-miner-v3.0.0.zip"
try:
    r3 = requests.head(url, timeout=10, allow_redirects=True)
    print(f"  URL: {url}")
    print(f"  Status: {r3.status_code}")
    print(f"  Content-Length: {r3.headers.get('Content-Length', 'unknown')}")
    print(f"  Content-Type: {r3.headers.get('Content-Type', 'unknown')}")
except Exception as e:
    print(f"  Error: {e}")
