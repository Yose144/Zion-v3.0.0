#!/usr/bin/env python3
"""
ZION V3 Revenue System -- E2E Smoke Test
========================================
Spusti pool server a over session classification + routing pro user i backend minery.

Usage:
    python tests/revenue_e2e_smoke.py
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time

# -- Config ---------------------------------------------------------------
POOL_PORT = 19444
LOOP_COUNT = 1
TIMEOUT = 15

PASS = "[OK]"
FAIL = "[FAIL]"
WARN = "[WARN]"
INFO = "[INFO]"

results = []

def ok(label, detail=""):
    results.append(("PASS", label))
    print(f"{PASS} {label}" + (f"  ->  {detail}" if detail else ""))

def fail(label, detail=""):
    results.append(("FAIL", label))
    print(f"{FAIL} {label}" + (f"  ->  {detail}" if detail else ""))

def warn(label, detail=""):
    results.append(("WARN", label))
    print(f"{WARN} {label}" + (f"  ->  {detail}" if detail else ""))

def section(title):
    print()
    print("-" * 60)
    print(f"  {title}")
    print("-" * 60)

# -- Helpers ----------------------------------------------------------------
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def build_pool():
    section("BUILD -- zion-pool server")
    cmd = ["cargo", "build", "--manifest-path", "V3/Cargo.toml",
           "-p", "zion-pool", "--bin", "server"]
    print(f"{INFO} {' '.join(cmd)}")
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if proc.returncode != 0:
        fail("Pool build failed", proc.stderr[:200])
        return None
    ok("Pool built successfully")
    exe = os.path.join(ROOT, "V3", "target", "debug", "server.exe")
    if not os.path.exists(exe):
        # Try release path just in case
        exe = os.path.join(ROOT, "V3", "target", "release", "server.exe")
    return exe

def run_pool_smoke(pool_exe, miner_id, worker_name):
    """Run one miner session against the pool and return parsed log lines."""
    import socket

    env = os.environ.copy()
    env["ZION_POOL_BIND"] = f"127.0.0.1:{POOL_PORT}"
    env["ZION_REVENUE_MULTISTREAM"] = "true"
    env["ZION_STREAM_ZION_PCT"] = "50"
    env["ZION_STREAM_BLAKE3_PCT"] = "25"
    env["ZION_STREAM_NCL_PCT"] = "25"
    env["ZION_USER_DEFAULT_GROUP"] = "zion"
    env["ZION_BACKEND_WORKER_HINTS"] = "backend,revenue"
    env["ZION_BACKEND_AUTO_INCLUDE_ZION"] = "false"
    env["ZION_ROUTING_LOG_EVERY"] = "1"
    env["ZION_LOOP_COUNT"] = str(LOOP_COUNT)
    env["ZION_JOB_TTL_MS"] = "30000"
    # No node RPC -- pool generates dummy jobs
    # env["ZION_NODE_RPC_ADDR"] = ""
    # Use a very easy target so any hash passes
    env["ZION_TARGET"] = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    env["ZION_NONCE_COUNT"] = "1000"
    # Suppress payout execution warnings
    env["ZION_HUMANITARIAN_WALLET"] = "zion1m4v5z8z850u480c5c208z274e334369275n5y20"
    env["ZION_ISSOBELLA_WALLET"] = "zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702"
    env["ZION_POOL_FEE_WALLET"] = "zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5"

    # Start pool in background, capture stdout to a temp file
    log_path = os.path.join(tempfile.gettempdir(), f"zion_pool_{miner_id}.log")
    with open(log_path, "w") as logfile:
        proc = subprocess.Popen(
            [pool_exe],
            cwd=ROOT,
            env=env,
            stdout=logfile,
            stderr=subprocess.STDOUT,
        )

    # Wait for pool to bind and start listening
    time.sleep(3)

    # Check if pool is listening
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(3)
    try:
        sock.connect(("127.0.0.1", POOL_PORT))
    except Exception as e:
        proc.kill()
        proc.wait()
        return [], f"Pool not reachable: {e}"

    # Send messages
    def send(msg):
        line = json.dumps(msg) + "\n"
        sock.sendall(line.encode())

    def recv():
        buf = b""
        while b"\n" not in buf:
            chunk = sock.recv(4096)
            if not chunk:
                break
            buf += chunk
        lines = buf.decode().strip().split("\n")
        return [json.loads(l) for l in lines if l.strip()]

    # 1. Hello
    send({"type": "hello", "miner_id": miner_id, "worker_name": worker_name, "algorithm": "cosmic_harmony_ekam_deeksha_v2"})
    time.sleep(0.5)

    # 2. Read Welcome + SetDifficulty + Job
    messages = recv()
    msg_types = [m.get("type") for m in messages]

    # 3. Submit (any hash -- target is MAX so it should pass)
    job_msg = next((m for m in messages if m.get("type") == "job"), None)
    if job_msg:
        job_id = job_msg["job_id"]
        send({
            "type": "submit",
            "job_id": job_id,
            "miner_id": miner_id,
            "worker_name": worker_name,
            "nonce": 42,
            "hash_hex": "0000000000000000000000000000000000000000000000000000000000000000",
            "attempted_hashes": None,
            "elapsed_ms": None,
        })
        # 4. Read Result
        result_msgs = recv()
        msg_types += [m.get("type") for m in result_msgs]
    else:
        msg_types.append("no_job_received")

    # 5. Bye
    send({"type": "bye", "accepted_shares": 0, "rejected_shares": 0, "revenue_total_usd": "0.00000000"})
    time.sleep(0.3)
    sock.close()

    # Terminate pool
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except Exception:
        proc.kill()
        proc.wait()

    # Read log
    with open(log_path, "r") as f:
        log_lines = f.read().splitlines()
    os.unlink(log_path)

    return log_lines, msg_types

def parse_session_info(log_lines):
    """Extract session_group and routing info from pool stdout."""
    info = {}
    for line in log_lines:
        # session_group=log pattern
        m = re.search(r"session_group=(\w+)", line)
        if m:
            info["session_group"] = m.group(1)
        m = re.search(r"requested_group=(\w+)", line)
        if m:
            info["requested_group"] = m.group(1)
        m = re.search(r"revenue_mode=(\w+)", line)
        if m:
            info["revenue_mode"] = m.group(1)
        m = re.search(r"session_default_group=(\w+)", line)
        if m:
            info["session_default_group"] = m.group(1)
        if "routing_snapshot" in line:
            info["routing_snapshot"] = line
        if "routing_final" in line:
            info["routing_final"] = line
        if "share_status=Accepted" in line:
            info["share_accepted"] = True
        if "share_status=Rejected" in line or "share_status=NoSolution" in line:
            info["share_rejected"] = True
    return info

# -- Tests ------------------------------------------------------------------
def test_user_session():
    section("TEST A -- User Session (no hint -> zion)")
    pool_exe = build_pool()
    if not pool_exe:
        return False

    log_lines, msg_types = run_pool_smoke(pool_exe, "user-smoke", "rig-01")
    if isinstance(log_lines, str):
        fail("Pool connection", log_lines)
        return False

    print(f"{INFO} Wire messages received: {msg_types}")
    info = parse_session_info(log_lines)
    print(f"{INFO} Parsed: {json.dumps(info, indent=2)}")

    if "welcome" in msg_types and "job" in msg_types:
        ok("Pool handshake + job issued")
    else:
        fail("Pool handshake", f"got {msg_types}")

    sg = info.get("session_group", "?")
    if sg == "zion":
        ok("Session group = zion (user default)", sg)
    else:
        fail("Session group unexpected", f"expected zion, got {sg}")

    if info.get("share_accepted"):
        ok("Share accepted")
    elif info.get("share_rejected"):
        warn("Share rejected (hash may not meet target)")
    else:
        warn("No share status in log")

    rm = info.get("revenue_mode", "?")
    if rm == "multistream":
        ok("Revenue mode = multistream")
    else:
        warn("Revenue mode", rm)

    return True

def test_backend_session():
    section("TEST B -- Backend Session (hint -> revenue)")
    pool_exe = build_pool()
    if not pool_exe:
        return False

    log_lines, msg_types = run_pool_smoke(pool_exe, "backend-smoke", "backend-revenue")
    if isinstance(log_lines, str):
        fail("Pool connection", log_lines)
        return False

    print(f"{INFO} Wire messages received: {msg_types}")
    info = parse_session_info(log_lines)
    print(f"{INFO} Parsed: {json.dumps(info, indent=2)}")

    if "welcome" in msg_types and "job" in msg_types:
        ok("Pool handshake + job issued")
    else:
        fail("Pool handshake", f"got {msg_types}")

    sg = info.get("session_group", "?")
    if sg in ("revenue", "auto"):
        ok("Session group = revenue/auto (backend)", sg)
    else:
        fail("Session group unexpected", f"expected revenue/auto, got {sg}")

    if info.get("share_accepted"):
        ok("Share accepted")
    elif info.get("share_rejected"):
        warn("Share rejected")
    else:
        warn("No share status in log")

    return True

def test_explicit_group_hint():
    section("TEST C -- Explicit Group Hint (g=revenue)")
    pool_exe = build_pool()
    if not pool_exe:
        return False

    log_lines, msg_types = run_pool_smoke(pool_exe, "test-miner", "rig-g=revenue")
    if isinstance(log_lines, str):
        fail("Pool connection", log_lines)
        return False

    print(f"{INFO} Wire messages received: {msg_types}")
    info = parse_session_info(log_lines)
    print(f"{INFO} Parsed: {json.dumps(info, indent=2)}")

    sg = info.get("session_group", "?")
    if sg == "revenue":
        ok("Explicit hint respected -> revenue", sg)
    else:
        fail("Explicit hint ignored", f"expected revenue, got {sg}")

    return True

def print_summary():
    section("SUMMARY")
    passed = sum(1 for r in results if r[0] == "PASS")
    warned = sum(1 for r in results if r[0] == "WARN")
    failed = sum(1 for r in results if r[0] == "FAIL")

    print(f"  {PASS} PASSED:  {passed}")
    print(f"  {WARN} WARNINGS: {warned}")
    print(f"  {FAIL} FAILED:  {failed}")
    print()

    if failed == 0 and passed > 0:
        print("  Revenue E2E smoke PASSED")
    elif failed > 0:
        print("  Revenue E2E smoke FAILED -- check logs above")
    else:
        print("  No results")

    return failed == 0

if __name__ == "__main__":
    print()
    print("====================================================")
    print("  ZION V3 Revenue System -- E2E Smoke Test")
    print("====================================================")

    ok("Python 3 available", sys.version.split()[0])

    test_user_session()
    test_backend_session()
    test_explicit_group_hint()

    sys.exit(0 if print_summary() else 1)
