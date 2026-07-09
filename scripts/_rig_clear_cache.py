import os
#!/usr/bin/env python3
"""Clear cached miner binary on SMOS rig and reload to force fresh download."""
import requests, json, time

BASE = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
headers = {
    "X-AUTH-TOKEN": TOKEN,
    "Content-Type": "application/merge-patch+json",
}

# Step 1: Execute bash command to delete cached miner binary
print("Step 1: Deleting cached miner binary on rig...")
payload = {
    "rigIds": [518837],
    "commandId": 7,
    "commandOptions": "rm -rf /root/miner/custom_zion-miner-v3.0.0 && echo CACHE_CLEARED"
}
r = requests.patch(f"{BASE}/rigs/execute-command", headers=headers, json=payload, timeout=15)
print(f"  Bash command: HTTP {r.status_code} -> {r.text}")

# Step 2: Reload rig to force fresh download
print("\nStep 2: Reloading rig to download fresh binary...")
payload2 = {"rigIds": [518837]}
r2 = requests.patch(f"{BASE}/rigs/execute-reload", headers=headers, json=payload2, timeout=15)
print(f"  Reload: HTTP {r2.status_code} -> {r2.text}")

print("\nDone! Rig will now:")
print("  1. Delete /root/miner/custom_zion-miner-v3.0.0/")
print("  2. Re-download zion-miner-v3.0.0.zip (new glibc 2.31 build)")
print("  3. Extract and start miner")
print("\nRun _rig_console.py to monitor startup.")
