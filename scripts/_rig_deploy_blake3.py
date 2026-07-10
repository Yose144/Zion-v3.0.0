#!/usr/bin/env python3
"""Deploy Blake3-fix miner to SMOS rig 518837 via API bash + group update."""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import base64

API = "https://api.simplemining.net"
RIG = 518837
GROUP = 1773590
PKG = "custom_zion-sm3031"  # must match SMOS URL zion-sm3031.zip → custom_zion-sm3031


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
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else {}


def decode_console(raw: str) -> str:
    if not raw:
        return ""
    try:
        d = base64.b64decode(raw).decode("utf-8", errors="replace")
        if len(d) > 30:
            raw = d
    except Exception:
        pass
    return re.sub(r"<[^>]+>", "", raw).replace("&nbsp;", " ")


def get_consoles():
    rig = api("GET", f"/rigs/{RIG}")
    rd = rig.get("redisData") or {}
    return {
        "miner": decode_console(rd.get("console") or ""),
        "system": decode_console(rd.get("consoleSystem") or ""),
        "online": rig.get("isOnline"),
        "accepted": rig.get("accepted"),
        "rejected": rig.get("rejected"),
        "ip": rig.get("ip"),
    }


def run_bash(script: str):
    print(">> bash dispatched")
    return api(
        "PATCH",
        "/rigs/execute-command",
        {"rigIds": [RIG], "commandId": 7, "commandOptions": script},
    )


BUILD_SCRIPT = r"""
set -e
LOG=/tmp/zion-blake3-build.log
exec >"$LOG" 2>&1
echo "=== BUILD $(date -u) ==="
export PATH="$HOME/.cargo/bin:$PATH"
if ! command -v cargo >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  . "$HOME/.cargo/env"
fi
SRC=/root/zion-build
rm -rf "$SRC"
git clone --depth 1 https://github.com/Yose144/Zion-v3.0.0.git "$SRC"
cd "$SRC"
# Canonical full GPU pipeline: disable hardcoded force_s4=true
sed -i 's/let force_s4 = true;/let force_s4 = false;/' V3/L1/miner/src/gpu_backend.rs
grep -n 'force_s4' V3/L1/miner/src/gpu_backend.rs | head -3
cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl
BIN="$SRC/V3/target/release/zion-miner"
test -x "$BIN"
mkdir -p /root/miner_org/""" + PKG + r"""
cp "$BIN" /root/miner_org/""" + PKG + r"""/miner.real
cat > /root/miner_org/""" + PKG + r"""/miner << 'WRAP'
#!/bin/bash
export ZION_GPU_BACKEND=opencl
export ZION_LOOP_COUNT=1000000
export ZION_OCL_BUILD_OPTS='-cl-std=CL1.2 -cl-mad-enable'
export ZION_IGNORE_GPU_SELF_TEST_FAIL=1
unset ZION_GCN_S4_MODE
exec "$(dirname "$0")/miner.real" "$@"
WRAP
chmod +x /root/miner_org/""" + PKG + r"""/miner /root/miner_org/""" + PKG + r"""/miner.real
cd /root/miner_org
tar -czf """ + PKG + r""".tar.gz """ + PKG + r"""
md5sum """ + PKG + r""".tar.gz > """ + PKG + r""".tar.gz.md5
echo BUILD_OK
tail -5 "$LOG"
"""


def update_group_and_reload():
    opts = (
        f"https://github.com/Yose144/Zion-v3.0.0/releases/download/v3.0.31/zion-sm3031.zip "
        f"--pool 62.171.141.136:8444 "
        f"--wallet zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3 "
        f"--worker vega-smos"
    )
    # SMOS picks custom_* tar.gz from miner_org when present; URL is fallback.
    print(">> updating group miner options (no --gcn-s4-mode)")
    api("PUT", f"/rig-groups/{GROUP}", {"minerOptions": opts})
    print(">> reload rig")
    api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})


def main():
    c = get_consoles()
    print(f"Rig online={c['online']} ip={c['ip']}")
    print("System console tail:")
    for ln in c["system"].splitlines()[-5:]:
        print(" ", ln)

    if "--skip-build" not in sys.argv:
        run_bash(BUILD_SCRIPT)
        print("Waiting 360s for native build...")
        for i in range(12):
            time.sleep(30)
            c = get_consoles()
            sys_txt = c["system"]
            if "BUILD_OK" in sys_txt or "BUILD_OK" in c["miner"]:
                print(f"  build marker seen at {(i+1)*30}s")
                break
            print(f"  ... {(i+1)*30}s")

    update_group_and_reload()
    print("Waiting 90s after reload for miner startup...")
    time.sleep(90)

    c = get_consoles()
    print("\n=== SYSTEM after reload ===")
    for ln in c["system"].splitlines()[-15:]:
        print(ln)

    print("\n=== MINER tail ===")
    lines = [l.strip() for l in c["miner"].splitlines() if l.strip()]
    for ln in lines[-25:]:
        print(ln)

    hits = [l for l in lines if any(x in l for x in (
        "SELF_TEST", "accepted", "Rejected", "gpu_opencl", "gcn_s4", "MATCH", "FAIL"
    ))]
    if hits:
        print("\n=== KEY ===")
        for ln in hits[-15:]:
            print(ln)


if __name__ == "__main__":
    main()
