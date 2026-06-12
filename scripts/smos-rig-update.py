#!/usr/bin/env python3
"""Point SMOS rig 518837 at new miner zip and reload."""
import json, os, sys, time, urllib.request, base64, re

API = "https://api.simplemining.net"
RIG = 518837
GROUP = 1773590
MINER_URL = "https://zionterranova.com/zion-miner/zion-sm3042c.zip"
CUSTOM_MINER = MINER_URL  # Use customMiner field instead of options string
MINER_OPTS = (
    f"--pool 77.42.71.94:8444 "
    f"--wallet zion1n0s6e756p7r360a0e47582n7r5t2e3t4e2wq5c8 "
    f"--worker vega-smos"
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

def poll(secs=120):
    print(f">> polling {secs}s...")
    end = time.time() + secs
    while time.time() < end:
        text = console()
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        hits = [l for l in lines if any(k in l for k in (
            "SELF_TEST", "accepted", "Rejected", "gpu_opencl", "gcn_s4",
            "MATCH", "FAIL", "hashrate", "share_status",
        ))]
        if hits:
            print("KEY:", hits[-3:])
        for ln in lines[-8:]:
            print(ln)
        time.sleep(20)


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
            "rm -rf /root/miner/custom_zion-miner-v3.0.32-gpu "
            "/root/miner/custom_zion-sm3031 "
            "/var/tmp/miner/custom_* ; echo CACHE_CLEARED"
        ),
    })
    time.sleep(5)

    print(">> reload rig")
    api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})

    print(">> waiting 90s for startup...")
    time.sleep(90)

    sys_c = api("GET", f"/rigs/{RIG}")
    rd = sys_c.get("redisData") or {}
    sys_raw = rd.get("consoleSystem") or ""
    try:
        sys_raw = base64.b64decode(sys_raw).decode("utf-8", errors="replace")
    except Exception:
        pass
    print("=== SYSTEM ===")
    for ln in sys_raw.splitlines()[-8:]:
        print(ln)

    text = console()
    print("=== MINER (key lines) ===")
    for ln in text.splitlines():
        l = ln.strip()
        if any(k in l for k in (
            "SELF_TEST", "gpu_opencl", "gcn_s4", "accepted", "Rejected",
            "share_status", "MATCH", "wrapper", "v3.0.32"
        )):
            print(l)
    poll(120)
