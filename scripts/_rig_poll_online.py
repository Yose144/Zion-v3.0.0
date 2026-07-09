import os
#!/usr/bin/env python3
"""Poll rig status every 60s until it comes back online."""
import requests, time, base64, re

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
RIG = 518837
H = {"X-AUTH-TOKEN": TOKEN}
H_PATCH = {"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/merge-patch+json"}

print("Polling rig status every 60s until back online...")
print("(Rig went offline at ~11:33 for reboot/reflash)\n")

for i in range(30):  # up to 30 minutes
    try:
        r = requests.get(f"{API}/rigs/{RIG}", headers=H, timeout=10)
        rig = r.json()
        redis = rig.get('redisData', {}) or {}
        online = rig.get('isOnline', False)
        kernel = redis.get('kernel', '?')
        driver = redis.get('driver', '?')
        ts = time.strftime('%H:%M:%S')
        
        if online:
            print(f"\n[{ts}] >>> RIG IS BACK ONLINE! <<<")
            print(f"  Kernel: {kernel}")
            print(f"  Driver: {driver}")
            print(f"  Group:  {rig.get('rigGroup')}")
            
            # Check if it's i066d
            if '066' in kernel or 'a21' in driver:
                print(f"\n  ✅ Successfully reflashed to i066d!")
            else:
                print(f"\n  Still on old image ({kernel}). Sending i066d reflash (commandId=40)...")
                r2 = requests.patch(f"{API}/rigs/execute-command", 
                    headers=H_PATCH, 
                    json={"rigIds": [RIG], "commandId": 40})
                print(f"  HTTP {r2.status_code}  Response: {r2.text[:200]}")
            
            # Check console
            r3 = requests.get(f"{API}/rigs/{RIG}/console", headers=H, timeout=10)
            console = r3.json().get("console", "")
            try:
                decoded = base64.b64decode(console).decode('utf-8')
                clean = re.sub(r'<[^>]+>', '\n', decoded)
                lines = [l.strip() for l in clean.split('\n') if l.strip()]
                print(f"\n  Console (last 10 lines):")
                for line in lines[-10:]:
                    print(f"    {line}")
            except:
                print(f"  Console: {console[:300]}")
            
            # Check GPU
            gpu_list = rig.get('gpuList', [])
            for g in gpu_list:
                print(f"\n  GPU: {g.get('gpuName','?')} CC={g.get('gpuCoreClock','?')} P={g.get('gpuPower','?')}W T={g.get('gpuTemp','?')}C")
            
            print(f"\n  hashrate: {redis.get('hashrate', {})}")
            break
        else:
            print(f"[{ts}] offline  (kernel={kernel} driver={driver})")
    except Exception as e:
        ts = time.strftime('%H:%M:%S')
        print(f"[{ts}] error: {e}")
    
    time.sleep(60)
else:
    print("\n  Timeout after 30 minutes. Rig may need manual intervention.")
    print("  Possible causes:")
    print("    1. USB drive corrupted from interrupted reflash")
    print("    2. PXE boot not configured in BIOS")
    print("    3. Network issue preventing rig from contacting SMOS")
    print("  Solution: Re-flash USB drive manually or check physical rig")
