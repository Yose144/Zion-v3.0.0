import os
#!/usr/bin/env python3
"""Check ZION-Deeksha-AMD group config and rig status before deployment."""
import requests, json

API = "https://api.simplemining.net"
H = {"Authorization": "Bearer " + os.environ.get("SIMPLEMINING_API_TOKEN", "")}

# Get ZION-Deeksha-AMD group config
r = requests.get(f"{API}/rig-groups/1765707", headers=H)
g = r.json()
print("=== ZION-Deeksha-AMD Group ===")
for k in ["minerName", "minerCustomUrl", "minerOptions", "minerType"]:
    print(f"  {k}: {g.get(k, '')}")

print()

# Get rig status
r2 = requests.get(f"{API}/rigs/518837", headers=H)
rig = r2.json()
print("=== Rig 518837 Status ===")
print(f"  status: {rig.get('status')}")
print(f"  rigGroupId: {rig.get('rigGroupId')}")
print(f"  kernel: {rig.get('kernel')}")
print(f"  driver: {rig.get('driver')}")
for gpu in rig.get("gpus", []):
    cc = gpu.get("gpuCoreClock", "?")
    mc = gpu.get("gpuMemClock", "?")
    pw = gpu.get("gpuPwrCur", "?")
    tp = gpu.get("gpuTemp", "?")
    hr = gpu.get("gpuHashrate", "?")
    print(f"  GPU: CC={cc} MC={mc} P={pw}W T={tp}C HR={hr}")
print(f"  accepted: {rig.get('accepted')}")
print(f"  minerUptime: {rig.get('minerUptime')}")
print(f"  minerName: {rig.get('minerName')}")

print()

# Check if the download URL works
url = g.get("minerCustomUrl", "")
if url:
    print(f"=== Testing download URL ===")
    print(f"  URL: {url}")
    try:
        r3 = requests.head(url, timeout=10, allow_redirects=True)
        print(f"  Status: {r3.status_code}")
        print(f"  Content-Length: {r3.headers.get('Content-Length', 'unknown')}")
        print(f"  Content-Type: {r3.headers.get('Content-Type', 'unknown')}")
    except Exception as e:
        print(f"  Error: {e}")
