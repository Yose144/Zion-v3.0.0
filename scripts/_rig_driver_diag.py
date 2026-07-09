import os
#!/usr/bin/env python3
"""
Try to fix Vega power management on SMOS i085:
1. Check current amdgpu module parameters
2. Force ppfeaturemask for full power management
3. Reload amdgpu module with correct params
4. Set power cap + perf level via sysfs
"""
import json, urllib.request, time, base64, re

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
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
        print(f"  ERR: {method} {path} => {e}")
        return None

def get_console():
    data = api("GET", f"/rigs/{RIG}/console")
    if not data:
        return ""
    txt = data.get("console", "")
    try:
        d = base64.b64decode(txt).decode(errors="replace")
        return re.sub(r"<[^>]+>", "", d)
    except Exception:
        return txt

# Phase 1: Diagnose current driver state — write to file, read via base64
# Since SMOS console doesn't show bash output directly, we'll encode it
print("=== Phase 1: Deep driver diagnostics ===")
diag = r"""
exec 2>&1
OUT=/tmp/vega_diag.txt
{
echo '=== AMDGPU MODULE ==='
cat /sys/module/amdgpu/parameters/ppfeaturemask 2>/dev/null || echo 'no ppfeaturemask'
cat /sys/module/amdgpu/parameters/dpm 2>/dev/null || echo 'no dpm param'
cat /sys/module/amdgpu/parameters/gpu_recovery 2>/dev/null || echo 'no gpu_recovery'
lsmod | grep amdgpu

echo '=== GPU SYSFS ==='
CARD=""
for c in /sys/class/drm/card*/device; do
  if grep -q '0x1002' "$c/vendor" 2>/dev/null; then CARD="$c"; break; fi
done
echo "AMD card: $CARD"

echo '--- DPM sclk states ---'
cat "$CARD/pp_dpm_sclk" 2>/dev/null || echo 'N/A'
echo '--- DPM mclk states ---'
cat "$CARD/pp_dpm_mclk" 2>/dev/null || echo 'N/A'  
echo '--- perf level ---'
cat "$CARD/power_dpm_force_performance_level" 2>/dev/null || echo 'N/A'
echo '--- profile mode ---'
cat "$CARD/pp_power_profile_mode" 2>/dev/null || echo 'N/A'
echo '--- gpu_busy ---'
cat "$CARD/gpu_busy_percent" 2>/dev/null || echo 'N/A'
echo '--- OD clk voltage ---'
cat "$CARD/pp_od_clk_voltage" 2>/dev/null || echo 'N/A'

echo '--- HWMON ---'
for h in "$CARD"/hwmon/hwmon*; do
  echo "hwmon=$h"
  echo -n "power1_average="; cat "$h/power1_average" 2>/dev/null || echo 'N/A'
  echo -n "power1_cap="; cat "$h/power1_cap" 2>/dev/null || echo 'N/A'
  echo -n "power1_cap_max="; cat "$h/power1_cap_max" 2>/dev/null || echo 'N/A'
  echo -n "power1_cap_min="; cat "$h/power1_cap_min" 2>/dev/null || echo 'N/A'
  echo -n "temp1="; cat "$h/temp1_input" 2>/dev/null || echo 'N/A'
done

echo '--- PCIe ---'
cat "$CARD/current_link_speed" 2>/dev/null || echo 'N/A'
cat "$CARD/current_link_width" 2>/dev/null || echo 'N/A'

echo '=== BOOT CMDLINE ==='
cat /proc/cmdline

echo '=== DMESG AMDGPU ==='
dmesg | grep -i amdgpu | tail -30

echo '=== OPENCL ==='
clinfo --list 2>/dev/null || echo 'clinfo N/A'
ls /opt/rocm*/lib/libOpenCL* /opt/amdgpu*/lib/*/libOpenCL* /usr/lib/*/libOpenCL* 2>/dev/null || echo 'no OpenCL libs found'

echo '=== DONE ==='
} > "$OUT" 2>&1

# Output as base64 to miner stdout so it appears in console
echo "DIAG_BASE64_START"
base64 "$OUT"
echo "DIAG_BASE64_END"
"""
api("PATCH", "/rigs/execute-command",
    {"rigIds": [RIG], "commandId": 7, "commandOptions": diag})
print("  Diagnostic sent. Waiting 25s...")
time.sleep(25)

con = get_console()
# Try to find base64-encoded output
start = con.find("DIAG_BASE64_START")
end = con.find("DIAG_BASE64_END")
if start >= 0 and end >= 0:
    b64_data = con[start + len("DIAG_BASE64_START"):end].strip()
    try:
        decoded = base64.b64decode(b64_data).decode(errors="replace")
        print(decoded)
    except Exception as e:
        print(f"  Decode failed: {e}")
        print(f"  Raw: {b64_data[:500]}")
else:
    print("  Diag output not yet in console. Waiting 15s more...")
    time.sleep(15)
    con = get_console()
    start = con.find("DIAG_BASE64_START")
    end = con.find("DIAG_BASE64_END")
    if start >= 0 and end >= 0:
        b64_data = con[start + len("DIAG_BASE64_START"):end].strip()
        try:
            print(base64.b64decode(b64_data).decode(errors="replace"))
        except Exception:
            print(f"  Raw b64: {b64_data[:500]}")
    else:
        print("  Still no diag output. Console tail:")
        print(con[-2000:])
