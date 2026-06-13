#!/usr/bin/env python3
import json, os, sys, time, urllib.request, base64, re

API = "https://api.simplemining.net"
RIG = 518837

def token():
    t = os.environ.get("SMOS_API_TOKEN", "").strip()
    if not t:
        sys.exit("Set SMOS_API_TOKEN")
    return t

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    ct = "application/merge-patch+json" if method == "PATCH" else "application/json"
    req = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={"X-AUTH-TOKEN": token(), "Content-Type": ct},
    )
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else {}

def console():
    rig = api("GET", f"/rigs/{RIG}")
    raw = (rig.get("redisData") or {}).get("console") or ""
    try:
        raw = base64.b64decode(raw).decode("utf-8", errors="replace")
    except Exception:
        pass
    return re.sub(r"<[^>]+>", "", raw)

print(">> check what SMOS downloaded")
api("PATCH", "/rigs/execute-command", {
    "rigIds": [RIG], "commandId": 7,
    "commandOptions": (
        "echo '=== FILE SIZE ===' && ls -la /root/miner/custom_miner.zip 2>/dev/null || echo 'NOT FOUND'; "
        "echo '=== FIRST 100 BYTES (hex) ===' && head -c 100 /root/miner/custom_miner.zip 2>/dev/null | xxd | head -5; "
        "echo '=== FIRST 200 BYTES (ascii) ===' && head -c 200 /root/miner/custom_miner.zip 2>/dev/null | cat -v"
    ),
})
time.sleep(15)

text = console()
print("=== CONSOLE OUTPUT ===")
for ln in text.splitlines()[-20:]:
    print(ln)
