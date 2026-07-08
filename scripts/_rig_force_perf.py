#!/usr/bin/env python3
"""Force Vega into high-performance DPM, set OC, verify power draw."""
import json, urllib.request, time, base64, re

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
RIG = 518837
ZANO_GROUP = 1765837

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    ct = "application/merge-patch+json" if method == "PATCH" else "application/json"
    req = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": ct})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else {}

def decode_con(data):
    txt = data.get("console", "")
    try:
        d = base64.b64decode(txt).decode(errors="replace")
        return re.sub(r"<[^>]+>", "", d)
    except Exception:
        return txt

# Step 1: Set OC back
print("=== Step 1: Set OC (Core=1150, Mem=950, PL=100, VDDC=950) ===")
api("PUT", f"/rigs/{RIG}", {
    "ocCore": "1150",
    "ocMemory": "950",
    "ocPowerLimit": "100",
    "ocVddc": "950",
    "ocMvdd": "900",
    "ocMvddci": "900",
})
print("  OC set.")

# Step 2: Force high DPM via sysfs before miner starts
# This forces the card out of power-save state
print("\n=== Step 2: Force high performance DPM + power cap via sysfs ===")
force_script = r"""
echo '=== Forcing Vega into performance mode ==='
CARD=""
for c in /sys/class/drm/card*/device; do
  if grep -q '0x1002' "$c/vendor" 2>/dev/null; then
    CARD="$c"
    echo "AMD card: $c"
    break
  fi
done

if [ -z "$CARD" ]; then
  echo 'NO AMD CARD'; exit 1
fi

# Current state
echo '--- BEFORE ---'
echo -n "perf_level: "; cat "$CARD/power_dpm_force_performance_level" 2>/dev/null
echo -n "gpu_busy: "; cat "$CARD/gpu_busy_percent" 2>/dev/null || echo 'N/A'
echo -n "pp_dpm_sclk: "; cat "$CARD/pp_dpm_sclk" 2>/dev/null | tr '\n' ' '; echo
echo -n "pp_dpm_mclk: "; cat "$CARD/pp_dpm_mclk" 2>/dev/null | tr '\n' ' '; echo
for h in "$CARD"/hwmon/hwmon*; do
  echo -n "  power1_cap: "; cat "$h/power1_cap" 2>/dev/null || echo 'N/A'
  echo -n "  power1_cap_max: "; cat "$h/power1_cap_max" 2>/dev/null || echo 'N/A'
  echo -n "  power1_average: "; cat "$h/power1_average" 2>/dev/null || echo 'N/A'
  echo -n "  temp1: "; cat "$h/temp1_input" 2>/dev/null || echo 'N/A'
done

# Force HIGH performance
echo 'high' > "$CARD/power_dpm_force_performance_level" 2>/dev/null && echo 'Set perf=high OK' || echo 'FAILED to set perf=high'

# Set power cap to 295W (295000000 microwatts)
for h in "$CARD"/hwmon/hwmon*; do
  echo '295000000' > "$h/power1_cap" 2>/dev/null && echo "Set power_cap=295W OK" || echo "FAILED to set power_cap"
done

# Set compute profile
echo '5' > "$CARD/pp_power_profile_mode" 2>/dev/null && echo 'Set profile=COMPUTE OK' || echo 'FAILED profile'

sleep 3

# After state
echo '--- AFTER ---'
echo -n "perf_level: "; cat "$CARD/power_dpm_force_performance_level" 2>/dev/null
echo -n "gpu_busy: "; cat "$CARD/gpu_busy_percent" 2>/dev/null || echo 'N/A'
echo -n "pp_dpm_sclk: "; cat "$CARD/pp_dpm_sclk" 2>/dev/null | tr '\n' ' '; echo
echo -n "pp_dpm_mclk: "; cat "$CARD/pp_dpm_mclk" 2>/dev/null | tr '\n' ' '; echo
for h in "$CARD"/hwmon/hwmon*; do
  echo -n "  power1_cap: "; cat "$h/power1_cap" 2>/dev/null || echo 'N/A'
  echo -n "  power1_average: "; cat "$h/power1_average" 2>/dev/null || echo 'N/A'
  echo -n "  temp1: "; cat "$h/temp1_input" 2>/dev/null || echo 'N/A'
done
echo '=== SYSFS DONE ==='
"""
api("PATCH", "/rigs/execute-command",
    {"rigIds": [RIG], "commandId": 7, "commandOptions": force_script})
print("  Sysfs force sent.")

# Step 3: Reload miner
print("\n=== Step 3: Reload miner ===")
time.sleep(5)  # Let sysfs commands finish first
api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})
print("  Reload sent. Waiting 120s for auto-tune to settle...")
time.sleep(120)

# Step 4: Check result
print("\n=== Step 4: Result ===")
rig = api("GET", f"/rigs/{RIG}")
rd = rig.get("redisData", {})
print(f"Online: {rig.get('isOnline')}")
print(f"Process uptime: {rig.get('processUptime')} min")
print(f"Group: {rig.get('rigGroup', {}).get('name')}")
print(f"OC: C={rig.get('ocCore')} M={rig.get('ocMemory')} PL={rig.get('ocPowerLimit')} V={rig.get('ocVddc')}")
print(f"GPU temp: {rd.get('gpuTemp')}, Fan: {rd.get('gpuFan')}")
print(f"Hash: {rd.get('hash')}")
print(f"Sys power: {rd.get('sysPwr')}W")

con_data = api("GET", f"/rigs/{RIG}/console")
con = decode_con(con_data)
print("\n=== CONSOLE ===")
print(con[-2500:])
