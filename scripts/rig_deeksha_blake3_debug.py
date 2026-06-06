#!/usr/bin/env python3
"""
Debug Vega 64 / SMOS rig for canonical Ekam Deeksha + Blake3 fix.

Requires:
  set SMOS_API_TOKEN=api-...   (from SimpleMining → Account → Subaccounts → API key)

Usage:
  python scripts/rig_deeksha_blake3_debug.py status
  python scripts/rig_deeksha_blake3_debug.py console
  python scripts/rig_deeksha_blake3_debug.py selftest
  python scripts/rig_deeksha_blake3_debug.py deploy-build
  python scripts/rig_deeksha_blake3_debug.py full
"""
from __future__ import annotations

import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

API = "https://api.simplemining.net"
RIG = int(os.environ.get("SMOS_RIG_ID", "518837"))
GROUP = int(os.environ.get("SMOS_GROUP_ID", "1765707"))
BASH_CMD_ID = 7
BUILD_DIR = "/tmp/zion-blake3-build"
PKG = "custom_zion-miner-blake3-fix"


def token() -> str:
    t = os.environ.get("SMOS_API_TOKEN", "").strip()
    if not t:
        print("ERROR: set SMOS_API_TOKEN (SimpleMining API key)", file=sys.stderr)
        sys.exit(1)
    return t


def api(method: str, path: str, body: dict | None = None) -> dict | None:
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body else None
    ct = "application/merge-patch+json" if method == "PATCH" else "application/json"
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"X-AUTH-TOKEN": token(), "Content-Type": ct},
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            raw = r.read()
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        print(f"API {method} {path} → HTTP {e.code}: {e.read().decode(errors='replace')[:400]}")
        return None
    except Exception as e:
        print(f"API {method} {path} → {e}")
        return None


def decode_console(raw: str) -> str:
    if not raw:
        return ""
    try:
        d = base64.b64decode(raw).decode("utf-8", errors="replace")
        if any(x in d for x in ("\n", "SELF_TEST", "miner", "GPU")):
            raw = d
    except Exception:
        pass
    raw = re.sub(r"<[^>]+>", "", raw)
    return (
        raw.replace("&nbsp;", " ")
        .replace("&gt;", ">")
        .replace("&lt;", "<")
        .replace("&amp;", "&")
    )


def get_console_text() -> str:
    rig = api("GET", f"/rigs/{RIG}")
    if not rig:
        return ""
    rd = rig.get("redisData") or {}
    return decode_console(rd.get("console") or rig.get("console") or "")


def print_status() -> None:
    rig = api("GET", f"/rigs/{RIG}")
    if not rig:
        return
    print(f"=== Rig {RIG} ===")
    for k in (
        "isOnline", "status", "rigName", "minerName", "minerUptime",
        "accepted", "rejected", "kernel", "driver", "gpuTemp", "gpuPower",
    ):
        print(f"  {k}: {rig.get(k)}")
    for i, gpu in enumerate(rig.get("gpus") or []):
        print(
            f"  GPU{i}: temp={gpu.get('gpuTemp')} hr={gpu.get('gpuHashrate')} "
            f"cc={gpu.get('gpuCoreClock')} mc={gpu.get('gpuMemClock')}"
        )
    grp = api("GET", f"/rig-groups/{GROUP}")
    if grp:
        print(f"\n=== Group {GROUP} ===")
        for k in ("minerName", "minerCustomUrl", "minerOptions"):
            print(f"  {k}: {str(grp.get(k, ''))[:240]}")


def print_console(tail: int = 120) -> None:
    text = get_console_text()
    lines = [ln for ln in text.splitlines() if ln.strip()]
    print(f"=== Console (last {tail} lines) ===")
    for ln in lines[-tail:]:
        print(ln)


def extract_selftest(text: str) -> None:
    keys = (
        "GPU SELF-TEST", "SELF_TEST", "s4_memhard", "MATCH", "FAIL",
        "gpu_gcn_s4_mode", "gpu_opencl_init", "share", "Rejected",
        "GPU_MISMATCH", "hashrate",
    )
    hits = [ln.strip() for ln in text.splitlines() if any(k in ln for k in keys)]
    if hits:
        print("=== Key lines ===")
        for ln in hits[-30:]:
            print(ln)


def run_bash(script: str) -> bool:
    r = api(
        "PATCH",
        "/rigs/execute-command",
        {"rigIds": [RIG], "commandId": BASH_CMD_ID, "commandOptions": script},
    )
    return r is not None


def cmd_selftest() -> None:
    """Run ekam-bench self-test on rig (full canonical pipeline, no GCN s4 fallback)."""
    script = (
        f"echo '=== ZION BLAKE3 SELFTEST $(date -u) ==='; "
        f"MINER=$(find /root/miner /var/tmp/miner -name 'miner.real' 2>/dev/null | head -1); "
        f"[ -z \"$MINER\" ] && MINER=$(find /root/miner /var/tmp/miner -name 'zion-miner' 2>/dev/null | head -1); "
        f"[ -z \"$MINER\" ] && MINER={BUILD_DIR}/target/release/zion-miner; "
        f"echo MINER=$MINER; "
        f"ls -la \"$MINER\" 2>/dev/null || echo MINER_NOT_FOUND; "
        f"export ZION_GPU_BACKEND=opencl; "
        f"export ZION_OCL_BUILD_OPTS='-cl-std=CL1.2 -cl-mad-enable'; "
        f"unset ZION_GCN_S4_MODE; "
        f"timeout 120 \"$MINER\" --ekam-bench 5 2>&1 | tail -40; "
        f"echo '=== SELFTEST DONE ==='"
    )
    print("Sending self-test bash to rig...")
    if not run_bash(script):
        return
    print("Waiting 90s for output...")
    time.sleep(90)
    text = get_console_text()
    extract_selftest(text)
    print_console(80)


def cmd_deploy_build() -> None:
    """Pull repo (if present), native build, package SMOS custom miner with Blake3-fix env."""
    script = (
        f"set -e; "
        f"echo '=== ZION NATIVE BUILD $(date -u) ==='; "
        f"export PATH=\"$HOME/.cargo/bin:$PATH\"; "
        f"command -v cargo >/dev/null || (curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y); "
        f". \"$HOME/.cargo/env\" 2>/dev/null || true; "
        f"SRC=/root/zion-2.9.6-main; "
        f"[ -d \"$SRC/V3\" ] || SRC=/root/zion-2.9.6; "
        f"[ -d \"$SRC/V3\" ] || {{ echo REPO_NOT_FOUND; exit 1; }}; "
        f"cd \"$SRC\"; "
        f"cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl 2>&1 | tail -20; "
        f"BIN=\"$SRC/V3/target/release/zion-miner\"; "
        f"test -x \"$BIN\" || {{ echo BUILD_FAILED; exit 1; }}; "
        f"mkdir -p /root/miner_org/{PKG}; "
        f"cp \"$BIN\" /root/miner_org/{PKG}/miner.real; "
        f"cat > /root/miner_org/{PKG}/miner << 'WRAPPER'\n"
        f"#!/bin/bash\n"
        f"export ZION_GPU_BACKEND=opencl\n"
        f"export ZION_LOOP_COUNT=1000000\n"
        f"export ZION_OCL_BUILD_OPTS='-cl-std=CL1.2 -cl-mad-enable'\n"
        f"export ZION_IGNORE_GPU_SELF_TEST_FAIL=1\n"
        f"# Full canonical pipeline; set ZION_GCN_S4_MODE=1 only if s4 still fails\n"
        f"unset ZION_GCN_S4_MODE\n"
        f"exec \"$(dirname \"$0\")/miner.real\" \"$@\"\n"
        f"WRAPPER\n"
        f"chmod +x /root/miner_org/{PKG}/miner /root/miner_org/{PKG}/miner.real; "
        f"cd /root/miner_org; "
        f"tar -czf {PKG}.tar.gz {PKG}; "
        f"md5sum {PKG}.tar.gz > {PKG}.tar.gz.md5; "
        f"ls -la {PKG}.tar.gz*; "
        f"echo BUILD_DEPLOY_OK"
    )
    print("Sending native build + package to rig (may take 3–5 min)...")
    if not run_bash(script):
        return
    print("Waiting 300s for build...")
    time.sleep(300)
    text = get_console_text()
    for marker in ("BUILD_DEPLOY_OK", "BUILD_FAILED", "REPO_NOT_FOUND", "Finished `release`"):
        if marker in text:
            print(f"  saw: {marker}")
    extract_selftest(text)
    print("Reloading rig...")
    api("PATCH", "/rigs/execute-reload", {"rigIds": [RIG]})
    print("Waiting 60s after reload...")
    time.sleep(60)
    print_console(60)


def cmd_full() -> None:
    print_status()
    cmd_deploy_build()
    cmd_selftest()
    print_status()


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)
    cmd = sys.argv[1].lower()
    if cmd == "status":
        print_status()
    elif cmd == "console":
        print_console()
        extract_selftest(get_console_text())
    elif cmd == "selftest":
        cmd_selftest()
    elif cmd == "deploy-build":
        cmd_deploy_build()
    elif cmd == "full":
        cmd_full()
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
