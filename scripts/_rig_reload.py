import os
#!/usr/bin/env python3
"""Reload rig to pick up new miner binary."""
import requests, json

BASE = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
headers = {
    "X-AUTH-TOKEN": TOKEN,
    "Content-Type": "application/merge-patch+json",
}

# Reload rig 518837 to re-download the miner binary
payload = {"rigIds": [518837]}

print("Reloading rig 518837 to pick up new glibc 2.31 binary...")
r = requests.patch(f"{BASE}/rigs/execute-reload", headers=headers, json=payload, timeout=15)
print(f"HTTP {r.status_code}")
print(f"Response: {r.text}")

if r.status_code == 200:
    print("\nReload sent! Rig will re-download zion-miner-v3.0.0.zip and restart.")
    print("Waiting a bit, then checking console...")
