import os
#!/usr/bin/env python3
"""Reboot rig to clear reflash state, then re-send i066d reflash."""
import requests, json, time

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
RIG = 518837

H = {
    "X-AUTH-TOKEN": TOKEN,
    "Content-Type": "application/merge-patch+json"
}
H_GET = {"X-AUTH-TOKEN": TOKEN}

# ── Step 1: Reboot rig ──
print("="*70)
print("STEP 1: Reboot rig to clear reflash state")
print("="*70)
payload = {"rigIds": [RIG]}
r = requests.patch(f"{API}/rigs/execute-reboot", headers=H, json=payload)
print(f"  HTTP {r.status_code}  Response: {r.text[:500]}")

# ── Step 2: Wait and monitor ──
print("\n" + "="*70)
print("STEP 2: Monitoring rig status (checking every 15s)")
print("="*70)

for i in range(12):  # 3 minutes
    time.sleep(15)
    try:
        r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET, timeout=10)
        rig = r.json()
        redis = rig.get('redisData', {}) or {}
        online = rig.get('isOnline', False)
        kernel = redis.get('kernel', '?')
        driver = redis.get('driver', '?')
        exe_status = rig.get('executeStatus', '')
        print(f"  [{i*15:3d}s] online={online}  kernel={kernel}  driver={driver}  exec={exe_status}")
        
        # If it came back online after reboot
        if online and i > 2:  # Give it at least 45 seconds
            print(f"\n  Rig is back online!")
            print(f"  Kernel: {kernel}")
            print(f"  Driver: {driver}")
            
            if 'i066' in kernel or 'a21' in driver:
                print(f"\n  ✅ Already on i066d! No reflash needed.")
                break
            else:
                print(f"\n  Still on old image. Sending i066d reflash...")
                # Send i066d reflash
                payload2 = {"rigIds": [RIG], "commandId": 40}
                r2 = requests.patch(f"{API}/rigs/execute-command", headers=H, json=payload2)
                print(f"  HTTP {r2.status_code}  Response: {r2.text[:500]}")
                print(f"  i066d reflash command sent!")
                print(f"  Expected: ~5-10 min download + write + auto-reboot")
                break
    except Exception as e:
        print(f"  [{i*15:3d}s] Error: {e}")

# ── Final status ──
print("\n" + "="*70)
print("FINAL STATUS")
print("="*70)
time.sleep(3)
r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET)
rig = r.json()
redis = rig.get('redisData', {}) or {}
print(f"  Online:       {rig.get('isOnline')}")
print(f"  Group:        {rig.get('rigGroup')}")
print(f"  Kernel:       {redis.get('kernel','?')}")
print(f"  Driver:       {redis.get('driver','?')}")
print(f"  ExecStatus:   {rig.get('executeStatus','(empty)')}")
print(f"  OC profile:   {rig.get('rigOc')}")

# Check console
import base64, re
r = requests.get(f"{API}/rigs/{RIG}/console", headers=H_GET)
console = r.json().get("console", "")
try:
    decoded = base64.b64decode(console).decode('utf-8')
    clean = re.sub(r'<[^>]+>', '\n', decoded)
    lines = [l.strip() for l in clean.split('\n') if l.strip()]
    print(f"\n  Console (last 15 lines):")
    for line in lines[-15:]:
        print(f"    {line}")
except:
    print(f"  Console (raw, last 200 chars): ...{console[-200:]}")
