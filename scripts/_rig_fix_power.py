#!/usr/bin/env python3
"""Short bash: diagnose + fix Vega power, minimal payload to avoid 403."""
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
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw.strip() else {}
    except Exception as e:
        print(f"  ERR: {e}")
        return None

def get_console():
    data = api("GET", f"/rigs/{RIG}/console")
    if not data: return ""
    txt = data.get("console", "")
    try:
        d = base64.b64decode(txt).decode(errors="replace")
        return re.sub(r"<[^>]+>", "", d)
    except Exception:
        return txt

# Wait for rig to come back from reboot
print("Waiting 90s for rig to reboot and stabilize...")
time.sleep(90)

rig = api("GET", f"/rigs/{RIG}")
if rig:
    print(f"Online: {rig.get('isOnline')}, uptime: {rig.get('redisData',{}).get('uptime')}s")
else:
    print("Rig not reachable yet, waiting 60s more...")
    time.sleep(60)

# Step 1: Short diag command
print("\n=== Sending short diag ===")
cmd = "cat /sys/module/amdgpu/parameters/ppfeaturemask;cat /sys/class/drm/card1/device/pp_dpm_sclk 2>/dev/null;cat /sys/class/drm/card1/device/power_dpm_force_performance_level 2>/dev/null;cat /sys/class/drm/card1/device/hwmon/hwmon0/power1_cap 2>/dev/null;cat /sys/class/drm/card1/device/hwmon/hwmon0/power1_cap_max 2>/dev/null"
r = api("PATCH", "/rigs/execute-command",
    {"rigIds": [RIG], "commandId": 7, "commandOptions": cmd})
print(f"  Result: {r}")

time.sleep(10)

# Step 2: Force performance mode
print("\n=== Forcing performance mode ===")
fix_cmd = "echo high > /sys/class/drm/card1/device/power_dpm_force_performance_level 2>/dev/null;echo 5 > /sys/class/drm/card1/device/pp_power_profile_mode 2>/dev/null;echo 295000000 > /sys/class/drm/card1/device/hwmon/hwmon0/power1_cap 2>/dev/null;echo DONE"
r2 = api("PATCH", "/rigs/execute-command",
    {"rigIds": [RIG], "commandId": 7, "commandOptions": fix_cmd})
print(f"  Result: {r2}")

time.sleep(10)

# Step 3: Reload miner
print("\n=== Reloading miner ===")
api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})
print("  Waiting 120s for auto-tune...")
time.sleep(120)

# Check
rig = api("GET", f"/rigs/{RIG}")
rd = rig.get("redisData", {}) if rig else {}
print(f"\n=== RESULT ===")
print(f"Hash: {rd.get('hash')}")
print(f"GPU temp: {rd.get('gpuTemp')}, Fan: {rd.get('gpuFan')}")
print(f"Sys power: {rd.get('sysPwr')}W")

con = get_console()
print(f"\n=== CONSOLE ===")
print(con[-2500:])
