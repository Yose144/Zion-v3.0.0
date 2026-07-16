#!/usr/bin/env python3
"""Deploy the v3.1.9-triple-fixed4 SMOS package + clear rig cache + reload.

This script preserves the existing miner options in SimpleMining group 1773590
and only updates the customMiner URL to the fixed4 zip. It then clears the
cached miner on rig 518837 and reloads it.

Usage:
    export SMOS_API_TOKEN="..."
    python3 scripts/deploy_smos_triple_fixed4.py

After the reload, copy the pre-generated EPIC DAG to the rig:

    mkdir -p /home/miner/.zion/dag-cache
    curl -C - -o /home/miner/.zion/dag-cache/progpow_epoch120.bin \
        https://zionterranova.com/zion-miner/dag-cache/progpow_epoch120.bin
"""
import base64
import json
import os
import re
import sys
import time
import urllib.request

API = "https://api.simplemining.net"
RIG = 518837
GROUP = 1773590
MINER_URL = "https://zionterranova.com/zion-miner/zion-miner-v3.1.9-triple-fixed12.zip"


def token():
    t = os.environ.get("SMOS_API_TOKEN", "").strip()
    if not t:
        sys.exit("Set SMOS_API_TOKEN")
    return t


def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    ct = "application/merge-patch+json" if method == "PATCH" else "application/json"
    req = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method=method,
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

    print(f">> fetch current config for group {GROUP}")
    group = api("GET", f"/rig-groups/{GROUP}")
    opts = group.get("minerOptions", "")
    print(f"   current minerOptions: {opts[:120]}...")

    # The first token in minerOptions is the custom miner zip URL.
    new_opts = " ".join([MINER_URL] + (opts.split()[1:] if opts else []))

    print(f">> update group {GROUP} minerOptions")
    api("PUT", f"/rig-groups/{GROUP}", {"customMiner": MINER_URL, "minerOptions": new_opts})

    print(">> clear cached miner on rig")
    api(
        "PATCH",
        "/rigs/execute-command",
        {
            "rigIds": [RIG],
            "commandId": 7,
            "commandOptions": (
                "rm -rf /root/miner/custom_* /var/tmp/miner/custom_* ; echo CACHE_CLEARED"
            ),
        },
    )
    time.sleep(5)

    print(">> reload rig")
    api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})

    print(">> waiting 90s for startup...")
    time.sleep(90)

    text = console()
    print("=== MINER (last 20 lines) ===")
    for ln in text.splitlines()[-20:]:
        print(ln)
