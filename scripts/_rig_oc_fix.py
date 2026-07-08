#!/usr/bin/env python3
"""Push OC fix and reload ZANO miner on rig 518837."""
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

# Step 1: Push OC
print("=== Pushing OC: Core=1100 Mem=900 PL=70 VDDC=900 ===")
oc = {
    "ocCore": "1100",
    "ocMemory": "900",
    "ocPowerLimit": "70",
    "ocVddc": "900",
    "ocMvdd": "",
    "ocMvddci": "",
}
result = api("PUT", f"/rigs/{RIG}", oc)
print("OC result:", result)

# Step 2: Reload miner
print("\n=== Reloading miner ===")
result2 = api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})
print("Reload result:", result2)

print("\nWaiting 60s for miner to restart and stabilize...")
time.sleep(60)

# Step 3: Check result
print("\n=== Checking status ===")
rig = api("GET", f"/rigs/{RIG}")
rd = rig.get("redisData", {})
print(f"Online: {rig.get('isOnline')}")
print(f"Process uptime: {rig.get('processUptime')} min")
print(f"OC applied: Core={rig.get('ocCore')} Mem={rig.get('ocMemory')} PL={rig.get('ocPowerLimit')} VDDC={rig.get('ocVddc')}")
print(f"GPU temp: {rd.get('gpuTemp')}")
print(f"GPU hash: {rd.get('hash')}")
print(f"Sys power: {rd.get('sysPwr')}W")

# Console
data = api("GET", f"/rigs/{RIG}/console")
txt = data.get("console", "")
try:
    decoded = base64.b64decode(txt).decode(errors="replace")
    clean = re.sub(r"<[^>]+>", "", decoded)
except Exception:
    clean = txt
print("\n=== MINER CONSOLE ===")
print(clean[-3000:])
