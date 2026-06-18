#!/usr/bin/env python3
"""Deploy ZION miner directly to SMOS rig via execute-command (bypass customMiner API)."""
import json, os, sys, time, urllib.request, base64, re

API = "https://api.simplemining.net"
RIG = 518837
GROUP = 1773590

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

# Step 1: Clear any existing custom miner config (use standard miner to avoid conflicts)
print(">> clear group customMiner")
api("PUT", f"/rig-groups/{GROUP}", {"customMiner": "", "minerOptions": ""})
time.sleep(2)

# Step 2: Create miner directory and download directly on rig
print(">> setup miner dir on rig")
api("PATCH", "/rigs/execute-command", {
    "rigIds": [RIG], "commandId": 7,
    "commandOptions": (
        "mkdir -p /root/miner/custom_miner && "
        "rm -f /root/miner/custom_miner.zip && "
        "curl -s -L -o /root/miner/custom_miner.zip http://77.42.71.94/zion-miner/zion-sm3042c.zip && "
        "echo 'DOWNLOAD_DONE'"
    ),
})
time.sleep(30)

# Step 3: Extract
print(">> extract miner")
api("PATCH", "/rigs/execute-command", {
    "rigIds": [RIG], "commandId": 7,
    "commandOptions": (
        "cd /root/miner && "
        "unzip -o custom_miner.zip -d custom_miner && "
        "chmod +x custom_miner/miner custom_miner/zion-miner && "
        "ls -la custom_miner/ && "
        "echo 'EXTRACT_DONE'"
    ),
})
time.sleep(15)

# Step 4: Poll for results
print(">> poll for results")
time.sleep(30)
text = console()
print("=== CONSOLE (last 20 lines) ===")
for ln in text.splitlines()[-20:]:
    print(ln)

# Step 5: Now set the group to use custom miner (try with direct file path)
# Note: SMOS may not support this, but let's try setting minerOptions to point to our miner
print(">> set miner options")
api("PUT", f"/rig-groups/{GROUP}", {
    "customMiner": "",
    "minerOptions": "--algorithm deeksha_lite_fire --pool 77.42.71.94:8444 --wallet zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604 --worker vega-smos"
})
time.sleep(2)

print(">> reload rig")
api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})

print(">> waiting 90s...")
time.sleep(90)

text = console()
print("=== AFTER RELOAD (last 15 lines) ===")
for ln in text.splitlines()[-15:]:
    print(ln)
