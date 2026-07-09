import os
#!/usr/bin/env python3
"""Reflash rig to i066d (a21.50.2 driver, ROCm 5.16.16) + verify."""
import requests, json, time

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
RIG = 518837

H = {
    "X-AUTH-TOKEN": TOKEN,
    "Content-Type": "application/merge-patch+json"
}
H_GET = {"X-AUTH-TOKEN": TOKEN}

# ── Pre-flight: confirm current state ──
print("="*70)
print("PRE-FLIGHT: Current rig state")
print("="*70)
r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET)
rig = r.json()
redis = rig.get('redisData', {}) or {}
print(f"  Online:   {rig.get('isOnline')}")
print(f"  Group:    {rig.get('rigGroup')}")
print(f"  Kernel:   {redis.get('kernel','?')}")
print(f"  Driver:   {redis.get('driver','?')}")
print(f"  ExecStat: {rig.get('executeStatus','(empty)')}")

# ── Reflash to i066d ──
print("\n" + "="*70)
print("REFLASH: commandId=40 → i066d (a21.50.2, ROCm 5.16.16)")
print("="*70)
payload = {
    "rigIds": [RIG],
    "commandId": 40
}
print(f"  Payload: {json.dumps(payload)}")
r = requests.patch(f"{API}/rigs/execute-command", headers=H, json=payload)
print(f"  HTTP {r.status_code}  Response: {r.text[:500]}")

# ── Verify command was queued ──
print("\n" + "="*70)
print("VERIFY: Check executeStatus after reflash command")
print("="*70)
time.sleep(3)
r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET)
rig2 = r.json()
print(f"  executeStatus: {rig2.get('executeStatus','(empty)')}")
print(f"  isOnline:      {rig2.get('isOnline')}")
print(f"  rigGroup:      {rig2.get('rigGroup')}")

# Check console for reflash progress
print("\n" + "="*70)
print("CONSOLE: Check for reflash download/progress messages")
print("="*70)
for ctype in ["", "debug"]:
    params = {}
    if ctype:
        params["type"] = ctype
    r = requests.get(f"{API}/rigs/{RIG}/console", headers=H_GET, params=params)
    label = ctype or "miner"
    console = r.json().get("console", "")
    # Get last 30 lines
    lines = console.strip().split("\n")
    print(f"\n--- {label} console (last 30 lines) ---")
    for line in lines[-30:]:
        print(f"  {line}")

print("\n" + "="*70)
print("INFO: Reflash command sent.")
print("  The rig will download ~1GB image, write to disk, and reboot.")
print("  Expected new state after reboot:")
print("    kernel: 5.15.80-sm*#066d")
print("    driver: a21.50.2") 
print("    ROCm:   5.16.16")
print("  Check status in 5-10 minutes with _rig_status.py")
print("="*70)
