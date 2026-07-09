import os
#!/usr/bin/env python3
"""Force AMD Vega performance mode via sysfs and check real power draw."""
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
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else {}

def get_console():
    data = api("GET", f"/rigs/{RIG}/console")
    txt = data.get("console", "")
    try:
        decoded = base64.b64decode(txt).decode(errors="replace")
        return re.sub(r"<[^>]+>", "", decoded)
    except Exception:
        return txt

# Step 1: Deep sysfs diagnostic — find out what AMD driver actually sees
diag_script = r"""
echo '=== AMD GPU sysfs deep diag ==='
CARD=""
for c in /sys/class/drm/card*/device; do
  if grep -q '0x1002' "$c/vendor" 2>/dev/null; then
    CARD="$c"
    echo "Found AMD card at $c"
    break
  fi
done
if [ -z "$CARD" ]; then
  echo 'NO AMD CARD FOUND'; exit 1
fi

echo '--- pp_dpm_sclk (core DPM states) ---'
cat "$CARD/pp_dpm_sclk" 2>/dev/null || echo 'no pp_dpm_sclk'

echo '--- pp_dpm_mclk (mem DPM states) ---'
cat "$CARD/pp_dpm_mclk" 2>/dev/null || echo 'no pp_dpm_mclk'

echo '--- power_dpm_force_performance_level ---'
cat "$CARD/power_dpm_force_performance_level" 2>/dev/null || echo 'N/A'

echo '--- pp_power_profile_mode ---'
cat "$CARD/pp_power_profile_mode" 2>/dev/null || echo 'N/A'

echo '--- hwmon power ---'
for h in "$CARD"/hwmon/hwmon*; do
  echo "hwmon: $h"
  echo -n "  power1_average: "; cat "$h/power1_average" 2>/dev/null || echo 'N/A'
  echo -n "  power1_cap: "; cat "$h/power1_cap" 2>/dev/null || echo 'N/A'
  echo -n "  power1_cap_max: "; cat "$h/power1_cap_max" 2>/dev/null || echo 'N/A'
  echo -n "  power1_cap_min: "; cat "$h/power1_cap_min" 2>/dev/null || echo 'N/A'
  echo -n "  temp1_input: "; cat "$h/temp1_input" 2>/dev/null || echo 'N/A'
  echo -n "  freq1_input: "; cat "$h/freq1_input" 2>/dev/null || echo 'N/A'
done

echo '--- gpu_busy_percent ---'
cat "$CARD/gpu_busy_percent" 2>/dev/null || echo 'N/A'

echo '--- mem_busy_percent ---'
cat "$CARD/mem_busy_percent" 2>/dev/null || echo 'N/A'

echo '--- current_link_speed ---'
cat "$CARD/current_link_speed" 2>/dev/null || echo 'N/A'

echo '--- current_link_width ---'
cat "$CARD/current_link_width" 2>/dev/null || echo 'N/A'

echo '--- pp_od_clk_voltage (OD table) ---'
cat "$CARD/pp_od_clk_voltage" 2>/dev/null || echo 'N/A'

echo '=== DONE ==='
"""

print("Sending sysfs diagnostic...")
api("PATCH", "/rigs/execute-command",
    {"rigIds": [RIG], "commandId": 7, "commandOptions": diag_script})
print("Waiting 20s...")
time.sleep(20)

con = get_console()
# Find our diagnostic output
idx = con.find("=== AMD GPU sysfs deep diag ===")
if idx >= 0:
    print(con[idx:])
else:
    print("Diag not visible yet, showing full console:")
    print(con[-4000:])
