#!/usr/bin/env python3
import json, os, sys, time, urllib.request, base64, re

API = "https://api.simplemining.net"
RIG = 518837

def token():
    t = os.environ.get("SMOS_API_TOKEN", "").strip()
    if not t:
        print("Set SMOS_API_TOKEN", file=sys.stderr)
        sys.exit(1)
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

def console_text():
    rig = api("GET", f"/rigs/{RIG}")
    raw = (rig.get("redisData") or {}).get("console") or rig.get("console") or ""
    try:
        raw = base64.b64decode(raw).decode("utf-8", errors="replace")
    except Exception:
        pass
    return re.sub(r"<[^>]+>", "", raw)

def run_bash(script):
    return api("PATCH", "/rigs/execute-command",
               {"rigIds": [RIG], "commandId": 7, "commandOptions": script})

def wait_and_show(marker, secs=90):
    print(f"Waiting {secs}s...")
    time.sleep(secs)
    text = console_text()
    start = text.find(marker)
    if start >= 0:
        chunk = text[start:start+4000]
        print(chunk)
    else:
        print("Marker not found; tail:")
        lines = [l for l in text.splitlines() if l.strip()]
        for l in lines[-40:]:
            print(l)

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "diag"
    if cmd == "diag":
        script = (
            "echo '=== ZION DIAG START'; "
            "hostname; uname -m; "
            "ldd --version 2>/dev/null | head -1; "
            "echo '--- miner paths ---'; "
            "ls -la /root/miner/ 2>/dev/null; ls -la /var/tmp/miner/ 2>/dev/null; "
            "find /root/miner /var/tmp/miner -maxdepth 3 -type f 2>/dev/null | head -20; "
            "echo '--- repo ---'; ls -d /root/zion* 2>/dev/null; "
            "echo '--- cargo ---'; command -v cargo 2>/dev/null || echo NO_CARGO; "
            "echo '--- clinfo ---'; clinfo --list 2>/dev/null | head -5; "
            "echo '--- miner proc ---'; ps aux | grep -E 'zion|miner' | grep -v grep; "
            "echo '=== ZION DIAG END'"
        )
        print("Sending diag...")
        run_bash(script)
        wait_and_show("=== ZION DIAG START", 75)
    elif cmd == "selftest":
        script = (
            "echo '=== ZION SELFTEST START'; "
            "MINER=$(find /root/miner /var/tmp/miner -name miner.real 2>/dev/null | head -1); "
            "if [ -z \"$MINER\" ]; then MINER=$(find /root/miner /var/tmp/miner -name miner -type f 2>/dev/null | head -1); fi; "
            "echo MINER=$MINER; ls -la \"$MINER\" 2>/dev/null; "
            "export ZION_GPU_BACKEND=opencl; "
            "export ZION_OCL_BUILD_OPTS='-cl-std=CL1.2 -cl-mad-enable'; "
            "unset ZION_GCN_S4_MODE; "
            "timeout 90 \"$MINER\" --ekam-bench 3 2>&1 | tail -50; "
            "echo '=== ZION SELFTEST END'"
        )
        print("Sending selftest...")
        run_bash(script)
        wait_and_show("=== ZION SELFTEST START", 100)
    elif cmd == "check":
        script = (
            "echo '=== SMOS CHECK START'; "
            "ls -la /root/miner_org/custom_zion-sm3031* 2>/dev/null; "
            "ls -la /root/miner/custom_zion-sm3031/ 2>/dev/null; "
            "tail -40 /tmp/zion-blake3-build.log 2>/dev/null || echo NO_BUILD_LOG; "
            "echo '=== SMOS CHECK END'"
        )
        print("Sending check...")
        run_bash(script)
        wait_and_show("=== SMOS CHECK START", 70)
    elif cmd == "build":
        script = (
            "set -e; echo '=== ZION BUILD START'; "
            "export PATH=\"$HOME/.cargo/bin:$PATH\"; "
            "if ! command -v cargo >/dev/null 2>&1; then "
            "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y; "
            ". \"$HOME/.cargo/env\"; fi; "
            "SRC=/root/zion-2.9.6-main; "
            "if [ ! -d \"$SRC/V3\" ]; then "
            "cd /root; git clone --depth 1 https://github.com/Yose144/Zion-2.9.git zion-2.9.6-main 2>&1 | tail -3 || echo CLONE_FAIL; "
            "fi; "
            "if [ -d \"$SRC/V3\" ]; then "
            "cd \"$SRC\"; cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl 2>&1 | tail -25; "
            "ls -la \"$SRC/V3/target/release/zion-miner\"; "
            "else echo NO_REPO; fi; "
            "echo '=== ZION BUILD END'"
        )
        print("Sending build (may take several min)...")
        run_bash(script)
        wait_and_show("=== ZION BUILD START", 360)
