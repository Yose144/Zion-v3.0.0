#!/usr/bin/env python3
"""Aggressively tune Vega OC to get power draw up to ~250W."""
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

def check_status(label):
    rig = api("GET", f"/rigs/{RIG}")
    rd = rig.get("redisData", {})
    hr = rd.get("hash", 0)
    temp = rd.get("gpuTemp", ["?"])
    fan = rd.get("gpuFan", ["?"])
    pwr = rd.get("sysPwr", "?")
    print(f"  [{label}] hash={hr} temp={temp} fan={fan} sysPwr={pwr}W "
          f"OC: C={rig.get('ocCore')} M={rig.get('ocMemory')} PL={rig.get('ocPowerLimit')} V={rig.get('ocVddc')}")
    con = get_console()
    # Extract last hashrate + power line
    for line in con.split("\n"):
        if "GPU0" in line and ("MH/s" in line or "kH/s" in line or "P:" in line):
            print(f"    {line.strip()}")
    return hr, temp, pwr

# Phase 1: Max power unlock - PL=300, stock clocks, stock voltage
print("=== PHASE 1: Power unlock (PL=300, Core=1100, Mem=950, VDDC=950) ===")
api("PUT", f"/rigs/{RIG}", {
    "ocCore": "1100",
    "ocMemory": "950",
    "ocPowerLimit": "300",
    "ocVddc": "950",
    "ocMvdd": "",
    "ocMvddci": "",
})
api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})
print("  Reload sent. Waiting 90s for auto-tune...")
time.sleep(90)
hr1, temp1, pwr1 = check_status("Phase1")

# Check if power is still too low
try:
    pwr_val = int(pwr1) if pwr1 != "?" else 0
except (ValueError, TypeError):
    pwr_val = 0

if pwr_val < 150:
    # Phase 2: Try even more aggressive - no voltage limit
    print("\n=== PHASE 2: Full unlock (PL=300, Core=1200, Mem=950, VDDC=1000) ===")
    api("PUT", f"/rigs/{RIG}", {
        "ocCore": "1200",
        "ocMemory": "950",
        "ocPowerLimit": "300",
        "ocVddc": "1000",
        "ocMvdd": "",
        "ocMvddci": "",
    })
    api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})
    print("  Reload sent. Waiting 90s...")
    time.sleep(90)
    hr2, temp2, pwr2 = check_status("Phase2")
else:
    print(f"\n  Power OK at {pwr_val}W, skipping Phase 2")

# Phase 3: If still low, try completely stock (no OC at all)
try:
    pwr_val2 = int(api("GET", f"/rigs/{RIG}").get("redisData", {}).get("sysPwr", 0))
except (ValueError, TypeError):
    pwr_val2 = 0

if pwr_val2 < 150:
    print("\n=== PHASE 3: Stock defaults (no OC, let driver decide) ===")
    api("PUT", f"/rigs/{RIG}", {
        "ocCore": "",
        "ocMemory": "",
        "ocPowerLimit": "",
        "ocVddc": "",
        "ocMvdd": "",
        "ocMvddci": "",
    })
    api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})
    print("  Reload sent. Waiting 90s...")
    time.sleep(90)
    hr3, temp3, pwr3 = check_status("Phase3-Stock")

# Final status
print("\n=== FINAL STATUS ===")
con = get_console()
print(con[-2000:])
