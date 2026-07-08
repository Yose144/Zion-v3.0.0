#!/usr/bin/env python3
"""Read debug/system console from rig to get bash command output."""
import json, urllib.request, base64, re

API = "https://api.simplemining.net"
TOKEN = "api-7a77595ab5176d2ea864c14e8b976a937c34b7e29cb486840e30729ad40f06c8"
RIG = 518837

def api_get(path):
    req = urllib.request.Request(
        f"{API}{path}", method="GET",
        headers={"X-AUTH-TOKEN": TOKEN, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def decode(b64):
    try:
        d = base64.b64decode(b64).decode(errors="replace")
        return re.sub(r"\x1b\[[0-9;]*m", "", re.sub(r"<[^>]+>", "", d))
    except Exception:
        return b64

rig = api_get(f"/rigs/{RIG}")
rd = rig.get("redisData", {})

print("=== MINER CONSOLE ===")
con = rd.get("console", "")
if con:
    print(decode(con)[-3000:])

print("\n=== SYSTEM CONSOLE ===")
sys_con = rd.get("consoleSystem", "")
if sys_con:
    print(decode(sys_con))

print("\n=== CPU CONSOLE ===")
cpu_con = rd.get("consoleCpu", "")
if cpu_con:
    print(decode(cpu_con))

# Also try debug console endpoint
print("\n=== DEBUG CONSOLE ===")
for ctype in ["debug", "system", "bash"]:
    try:
        data = api_get(f"/rigs/{RIG}/console?type={ctype}")
        txt = data.get("console", "")
        if txt:
            print(f"--- type={ctype} ---")
            print(decode(txt)[-3000:])
    except Exception as e:
        print(f"  type={ctype}: error {e}")
