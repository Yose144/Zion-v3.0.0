#!/usr/bin/env python3
"""Flash rig to SMOS i068b — last stable image with proper Vega/GCN5 support."""
import json, urllib.request, time, base64, re

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
RIG = 518837

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    ct = "application/merge-patch+json" if method == "PATCH" else "application/json"
    req = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": ct})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw.strip() else {}
    except Exception as e:
        print(f"  ERR: {method} {path} => {e}")
        try:
            body_err = e.read().decode(errors="replace")
            print(f"  Body: {body_err[:500]}")
        except Exception:
            pass
        return None

def get_status():
    rig = api("GET", f"/rigs/{RIG}")
    if not rig: return None
    rd = rig.get("redisData", {})
    print(f"  online={rig.get('isOnline')} kernel={rd.get('kernel')} driver={rd.get('driver')}")
    print(f"  uptime={rd.get('uptime')}s hash={rd.get('hash')} temp={rd.get('gpuTemp')} pwr={rd.get('sysPwr')}W")
    return rig

# Check current state
print("=== Current state ===")
get_status()

# Method 1: Try SMOS reflash via bash
# i068b = SM-i068b-5.15.80-a21.50.2-rf22.20.3-5.16.16-nv530.41.03-u20
print("\n=== Attempting image reflash to i068b ===")
print("  Target: SM-i068b (kernel 5.15.80, AMD driver a21.50.2, ROCm 5.16.16)")
print("  Reason: i085 driver amd22.40.6r6.1.10 ignores Vega power management")

# Try known SMOS reflash methods
# 1. smosevent reflash
reflash_cmd = "smosevent reflash 68 2>&1 || smos-reflash 68 2>&1 || echo 'REFLASH_CMD_NOT_FOUND'"
r = api("PATCH", "/rigs/execute-command",
    {"rigIds": [RIG], "commandId": 7, "commandOptions": reflash_cmd})
print(f"  bash reflash result: {r}")

time.sleep(15)

# Check if that worked
rig = api("GET", f"/rigs/{RIG}")
if rig:
    es = rig.get("executeStatus", "")
    print(f"  executeStatus: {es}")

# 2. Try SMOS command 68 (image number)
print("\n=== Trying SMOS commandId for reflash ===")
# SMOS has special commandIds for reflash — 72 was used for i085
# Let's try commandId=68 or others
for cmd_id in [68, 72, 10]:
    print(f"  Trying commandId={cmd_id}...")
    r2 = api("PATCH", "/rigs/execute-command",
        {"rigIds": [RIG], "commandId": cmd_id, "commandOptions": "68"})
    if r2 is not None:
        print(f"    OK: {r2}")
        break
    else:
        print(f"    Failed")

time.sleep(10)

# Check
print("\n=== Status after reflash attempt ===")
rig = get_status()

# Also try via the osVersion field update
print("\n=== Try setting osVersion directly ===")
r3 = api("PUT", f"/rigs/{RIG}", {"osVersion": "1317"})  # i068b version code
if r3:
    print(f"  osVersion set result: osVersion={r3.get('osVersion')}")
