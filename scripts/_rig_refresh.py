import os
#!/usr/bin/env python3
"""Refresh console and check for bash output."""
import base64, json, urllib.request, re

API = "https://api.simplemining.net"
TOKEN = os.environ.get("SIMPLEMINING_API_TOKEN", "")
RIG = 518837

def api_get(path):
    req = urllib.request.Request(
        f"{API}{path}", method="GET",
        headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

# Console
data = api_get(f"/rigs/{RIG}/console")
txt = data.get("console", "")
try:
    decoded = base64.b64decode(txt).decode(errors="replace")
    clean = re.sub(r"<[^>]+>", "", decoded)
except Exception:
    clean = txt
print("=== MINER CONSOLE (full) ===")
print(clean)

# dmesg
print("\n\n=== DMESG ===")
data2 = api_get(f"/rigs/{RIG}/console?type=dmesg")
txt2 = data2.get("console", "") if data2 else ""
try:
    d2 = base64.b64decode(txt2).decode(errors="replace")
    c2 = re.sub(r"<[^>]+>", "", d2)
except Exception:
    c2 = txt2
print(c2[-3000:] if c2 else "(empty)")

# Full rig state
rig = api_get(f"/rigs/{RIG}")
rd = rig.get("redisData", {})
print("\n\n=== REDIS DATA ===")
# Print all redis fields
for k, v in sorted(rd.items()):
    if k != "console":
        print(f"  {k}: {v}")
