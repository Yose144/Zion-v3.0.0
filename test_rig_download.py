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

# Download file directly on rig and check
print(">> download zip on rig via curl")
api("PATCH", "/rigs/execute-command", {
    "rigIds": [RIG], "commandId": 7,
    "commandOptions": (
        "rm -f /tmp/test-download.zip && "
        "curl -L -o /tmp/test-download.zip http://77.42.71.94/zion-miner/zion-sm3042c.zip && "
        "echo '=== SIZE ===' && ls -la /tmp/test-download.zip && "
        "echo '=== FILE TYPE ===' && head -c 4 /tmp/test-download.zip | xxd && "
        "echo '=== ZIP TEST ===' && unzip -t /tmp/test-download.zip"
    ),
})
time.sleep(30)

text = console()
print("=== RESULT ===")
for ln in text.splitlines()[-25:]:
    print(ln)
