#!/usr/bin/env python3
"""Monitor reflash progress until complete."""
import requests, json, time, base64, re

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
RIG = 518837
H_GET = {"X-AUTH-TOKEN": TOKEN}

prev_kernel = None
check = 0

print("Monitoring reflash progress...")
print("Will check every 30s until image changes or rig reboots.\n")

for i in range(40):  # up to 20 minutes
    check += 1
    try:
        # Get rig status
        r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET, timeout=10)
        rig = r.json()
        redis = rig.get('redisData', {}) or {}
        online = rig.get('isOnline', False)
        kernel = redis.get('kernel', '?')
        driver = redis.get('driver', '?')
        
        # Get console
        r2 = requests.get(f"{API}/rigs/{RIG}/console", headers=H_GET, timeout=10)
        console = r2.json().get("console", "")
        
        # Decode console
        progress = "?"
        last_msg = "?"
        try:
            decoded = base64.b64decode(console).decode('utf-8')
            clean = re.sub(r'<[^>]+>', '\n', decoded)
            lines = [l.strip() for l in clean.split('\n') if l.strip()]
            last_msg = lines[-1] if lines else "?"
            
            # Find download progress bars
            for line in reversed(lines):
                if '%' in line and ('MiB/s' in line or '====' in line):
                    progress = line
                    break
                elif 'Write image' in line or 'Create config' in line or 'Flush' in line or 'Config verify' in line:
                    progress = line
                    break
                elif 'Download image' in line:
                    progress = line
                    break
        except:
            progress = "decode error"
        
        ts = time.strftime('%H:%M:%S')
        print(f"[{ts}] #{check:2d} | online={online} | kernel={kernel} | driver={driver}")
        print(f"          | progress: {progress}")
        
        # Check for kernel change
        if prev_kernel and kernel != prev_kernel:
            print(f"\n{'='*70}")
            print(f"  KERNEL CHANGED!  {prev_kernel} → {kernel}")
            print(f"  Driver: {driver}")
            print(f"{'='*70}")
            break
        
        # Check if rig went offline (rebooting)
        if not online:
            print(f"          | >>> RIG OFFLINE — rebooting!")
        
        # Check if we got i066d
        if '066' in kernel or 'a21' in driver:
            print(f"\n{'='*70}")
            print(f"  ✅ REFLASH COMPLETE! Now on i066d!")
            print(f"  Kernel: {kernel}")
            print(f"  Driver: {driver}")
            print(f"{'='*70}")
            break
            
        prev_kernel = kernel
    except Exception as e:
        ts = time.strftime('%H:%M:%S')
        print(f"[{ts}] #{check:2d} | Error: {e}")
    
    time.sleep(30)
else:
    print("\nTimeout after 20 minutes. Check manually.")

# Final full status
print(f"\n{'='*70}")
print("FINAL STATUS")
print(f"{'='*70}")
r = requests.get(f"{API}/rigs/{RIG}", headers=H_GET)
rig = r.json()
redis = rig.get('redisData', {}) or {}
print(f"  Online:  {rig.get('isOnline')}")
print(f"  Group:   {rig.get('rigGroup')}")
print(f"  Kernel:  {redis.get('kernel','?')}")
print(f"  Driver:  {redis.get('driver','?')}")
print(f"  OC:      {rig.get('rigOc')}")

r2 = requests.get(f"{API}/rigs/{RIG}/console", headers=H_GET)
console = r2.json().get("console", "")
try:
    decoded = base64.b64decode(console).decode('utf-8')
    clean = re.sub(r'<[^>]+>', '\n', decoded)
    lines = [l.strip() for l in clean.split('\n') if l.strip()]
    print(f"\n  Console (last 20 lines):")
    for line in lines[-20:]:
        print(f"    {line}")
except:
    pass
