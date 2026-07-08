#!/usr/bin/env python3
"""Run remote bash diag on rig and wait for result."""
import base64, json, urllib.request, re, time

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
        return json.loads(r.read())

# Check if miner process is actually running
script = (
    "echo '=== MINER PROC ==='; "
    "ps aux | grep -i 'srbminer\\|miner\\|zion' | grep -v grep; "
    "echo '=== GPU STATE ==='; "
    "for card in /sys/class/drm/card*/device; do "
    "  echo \"--- $card ---\"; "
    "  cat $card/uevent 2>/dev/null | head -5; "
    "  cat $card/hwmon/hwmon*/temp1_input 2>/dev/null && echo 'mC' || echo 'no temp'; "
    "  cat $card/hwmon/hwmon*/power1_average 2>/dev/null && echo 'uW' || echo 'no power'; "
    "  cat $card/current_link_speed 2>/dev/null || echo 'no link speed'; "
    "  cat $card/current_link_width 2>/dev/null || echo 'no link width'; "
    "done; "
    "echo '=== CLINFO ==='; "
    "clinfo --list 2>/dev/null || echo 'clinfo not available'; "
    "echo '=== IMAGE ==='; "
    "uname -r; cat /etc/smos-release 2>/dev/null || echo 'no smos-release'; "
    "echo '=== DMESG GPU ==='; "
    "dmesg | grep -iE 'amdgpu|gfx|gpu|error|stuck|hang|reset|fault' | tail -20; "
    "echo '=== DONE ==='"
)

print("Sending diagnostic script to rig...")
result = api("PATCH", "/rigs/execute-command",
    {"rigIds": [RIG], "commandId": 7, "commandOptions": script})
print("Command sent:", result)
print("Waiting 20s for execution...")
time.sleep(20)

# Get console
data = api("GET", f"/rigs/{RIG}/console")
txt = data.get("console", "")
try:
    decoded = base64.b64decode(txt).decode(errors="replace")
    clean = re.sub(r"<[^>]+>", "", decoded)
except Exception:
    clean = txt
print("\n=== CONSOLE AFTER DIAG ===")
print(clean[-5000:])
