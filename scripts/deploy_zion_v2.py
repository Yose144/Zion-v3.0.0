#!/usr/bin/env python3
"""Point SMOS rig 518837 at new ZION miner zip and reload."""
import json, os, sys, time, urllib.request, base64, re

API = "https://api.simplemining.net"
RIG = 518837
GROUP = 1773590
MINER_URL = "https://zionterranova.com/zion-miner/zion-sm3042c-v2.zip"
CUSTOM_MINER = MINER_URL
MINER_OPTS = (
    "--algorithm deeksha_lite_fire "
    "--pool 62.171.141.136:8444 "
    "--wallet zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604 "
    "--worker vega-smos "
    "--api-enable"
)

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

if __name__ == "__main__":
    print(">> verify download URL")
    req = urllib.request.Request(MINER_URL, method="HEAD")
    with urllib.request.urlopen(req, timeout=30) as r:
        print(f"   HTTP {r.status} len={r.headers.get('Content-Length')}")

    print(f">> update group {GROUP} with customMiner + minerOptions")
    api("PUT", f"/rig-groups/{GROUP}", {"customMiner": CUSTOM_MINER, "minerOptions": MINER_OPTS})

    print(">> clear cached miner on rig")
    api("PATCH", "/rigs/execute-command", {
        "rigIds": [RIG], "commandId": 7,
        "commandOptions": (
            "rm -rf /root/miner/custom_* /var/tmp/miner/custom_* ; echo CACHE_CLEARED"
        ),
    })
    time.sleep(5)

    print(">> reload rig")
    api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})

    print(">> waiting 90s for startup...")
    time.sleep(90)

    text = console()
    print("=== MINER (last 15 lines) ===")
    for ln in text.splitlines()[-15:]:
        print(ln)
