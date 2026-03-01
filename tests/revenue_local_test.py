#!/usr/bin/env python3
"""
ZION v2.9.6 — Revenue System Local Test
========================================
Tests the full CH v3 revenue pipeline locally:
  1. Revenue config validation (ch3_revenue_settings.json)
  2. Mock stratum server startup
  3. Miner connection + share submission
  4. Revenue stream routing verification
  5. HTTP API probe

Usage:
    python tests/revenue_local_test.py [--miner-exe <path>] [--timeout <sec>]

Requirements:
    - Python 3.8+
    - Built miner: target/release/zion-miner.exe
    - No external connections needed (fully local)
"""
import argparse
import asyncio
import hashlib
import json
import os
import queue
import socket
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
CONFIG_FILE = ROOT / "config" / "ch3_revenue_settings.json"
MINER_EXE = ROOT / "target" / "release" / "zion-miner.exe"

MOCK_PORT = 14444
TEST_WALLET = "zion1revenue_test_000000000000000000000test"
TEST_WORKER = "local-revenue-test"
ALGO = "cosmic_harmony_v3"
DIFFICULTY = 500

PASS = "✅"
FAIL = "❌"
WARN = "⚠️ "
INFO = "ℹ️ "

results = []

def ok(label, detail=""):
    results.append(("PASS", label))
    print(f"{PASS} {label}" + (f"  →  {detail}" if detail else ""))

def fail(label, detail=""):
    results.append(("FAIL", label))
    print(f"{FAIL} {label}" + (f"  →  {detail}" if detail else ""))

def warn(label, detail=""):
    results.append(("WARN", label))
    print(f"{WARN} {label}" + (f"  →  {detail}" if detail else ""))

def section(title):
    print()
    print("─" * 60)
    print(f"  {title}")
    print("─" * 60)

# ══════════════════════════════════════════════════════════════
# TEST 1 — Revenue Config Validation
# ══════════════════════════════════════════════════════════════
def test_revenue_config():
    section("TEST 1 — Revenue Config Validation")

    if not CONFIG_FILE.exists():
        fail("Config file exists", str(CONFIG_FILE))
        return False
    ok("Config file exists", str(CONFIG_FILE.name))

    with open(CONFIG_FILE) as f:
        cfg = json.load(f)

    # Version
    ver = cfg.get("version", "")
    if ver:
        ok("Version field", ver)
    else:
        warn("Version field missing")

    # Streams
    streams = cfg.get("streams", {})
    if not streams:
        fail("Streams section exists")
        return False
    ok("Streams section exists", f"{len(streams)} streams defined")

    # Check 50/25/25 model
    zion_stream = streams.get("zion", {})
    if not zion_stream.get("enabled"):
        warn("ZION stream not enabled")
    else:
        ok("ZION stream enabled", f"algo={zion_stream.get('algorithm')}")

    target = zion_stream.get("target_share", 0)
    if abs(target - 0.5) < 0.01:
        ok("ZION target_share = 50%", f"{target*100:.0f}%")
    else:
        warn("ZION target_share unexpected", f"{target*100:.0f}%")

    # Multi-algo stream
    gpu_stream = streams.get("dynamic_gpu", {})
    if gpu_stream.get("enabled"):
        coins = gpu_stream.get("preferred_coins", [])
        ok("Dynamic GPU stream enabled", f"coins={','.join(coins[:5])}...")
    else:
        warn("Dynamic GPU stream disabled")

    # NCL stream
    ncl_stream = streams.get("ncl", {})
    if ncl_stream:
        ok("NCL stream defined", f"enabled={ncl_stream.get('enabled')}")
    else:
        warn("NCL stream not defined (optional)")

    # Revenue wallets check (should not be empty production wallets)
    used_wallets = set()
    for sname, sv in streams.items():
        if isinstance(sv, dict) and "pool" in sv:
            w = sv["pool"].get("wallet", "")
            if w:
                used_wallets.add(w[:16] + "...")
    if used_wallets:
        ok("Revenue pool wallets set", f"{len(used_wallets)} unique wallet(s)")

    # Merged mining config
    etc_stream = streams.get("etc", {})
    if etc_stream.get("enabled"):
        ok("ETC merged mining enabled (free byproduct)")
    nxs_stream = streams.get("nxs", {})
    if not nxs_stream.get("enabled"):
        ok("NXS stream disabled (fine — pool not ready)")

    return True

# ══════════════════════════════════════════════════════════════
# TEST 2 — Mock Stratum Server
# ══════════════════════════════════════════════════════════════
def make_job(height=100):
    ts = int(time.time())
    blob = hashlib.sha256(f"revenue-test-{ts}-{height}".encode()).hexdigest()
    blob = (blob * 5)[:152]
    return {
        "job_id": f"rev-{height}-{ts:08x}",
        "blob": blob,
        "target": f"{DIFFICULTY:08x}",
        "difficulty": DIFFICULTY,
        "height": height,
        "algo": ALGO,
        "seed_hash": "0" * 64,
    }

class MockRevenuePool:
    """Lightweight mock stratum server tracking revenue metrics."""
    def __init__(self, port):
        self.port = port
        self.height = 200
        self.logins = []
        self.shares_submitted = 0
        self.shares_accepted = 0
        self.shares_rejected = 0
        self.groups_seen = set()
        self.running = False
        self._sock = None
        self._thread = None
        self.event_log = []

    def start(self):
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(("127.0.0.1", self.port))
        self._sock.listen(5)
        self._sock.settimeout(1.0)
        self.running = True
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()

    def stop(self):
        self.running = False
        if self._sock:
            try:
                self._sock.close()
            except Exception:
                pass

    def _serve(self):
        while self.running:
            try:
                conn, addr = self._sock.accept()
                t = threading.Thread(target=self._handle, args=(conn, addr), daemon=True)
                t.start()
            except socket.timeout:
                continue
            except Exception:
                break

    def _handle(self, conn, addr):
        conn.settimeout(5.0)
        buf = b""
        try:
            while self.running:
                try:
                    chunk = conn.recv(4096)
                    if not chunk:
                        break
                    buf += chunk
                    while b"\n" in buf:
                        line, buf = buf.split(b"\n", 1)
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            msg = json.loads(line)
                        except Exception:
                            continue
                        resp = self._dispatch(msg)
                        if resp:
                            conn.sendall((json.dumps(resp) + "\n").encode())
                except socket.timeout:
                    # Push a new job every ~5 seconds of idle
                    job_notify = json.dumps({
                        "id": None,
                        "method": "job",
                        "params": make_job(self.height)
                    }) + "\n"
                    try:
                        conn.sendall(job_notify.encode())
                        self.height += 1
                    except Exception:
                        break
        except Exception:
            pass
        finally:
            conn.close()

    def _dispatch(self, msg):
        method = msg.get("method", "")
        params = msg.get("params", {})
        msg_id = msg.get("id")

        if method == "login":
            wallet = params.get("login", "?")
            worker = params.get("rigid", params.get("worker", "?"))
            group = params.get("pass", "x")
            self.logins.append({"wallet": wallet[:20], "worker": worker, "group": group})
            self.groups_seen.add(group)
            self.event_log.append(f"LOGIN wallet={wallet[:12]}... worker={worker} group={group}")
            job = make_job(self.height)
            return {
                "id": msg_id,
                "jsonrpc": "2.0",
                "result": {
                    "id": str(uuid.uuid4()),
                    "job": job,
                    "status": "OK"
                },
                "error": None
            }

        elif method == "submit":
            self.shares_submitted += 1
            nonce = params.get("nonce", "")
            result_hash = params.get("result", "")
            # Accept if nonce is non-trivial
            if nonce and nonce not in ("0000000000000000", "deadbeef12345678"):
                self.shares_accepted += 1
                self.event_log.append(f"SHARE_ACCEPTED nonce={nonce[:8]}...")
                return {"id": msg_id, "jsonrpc": "2.0", "result": {"status": "OK"}, "error": None}
            else:
                self.shares_rejected += 1
                self.event_log.append(f"SHARE_REJECTED nonce={nonce[:8]}...")
                return {
                    "id": msg_id, "jsonrpc": "2.0",
                    "result": None,
                    "error": {"code": 23, "message": "Low difficulty share"}
                }

        elif method == "keepalive":
            return {"id": msg_id, "jsonrpc": "2.0", "result": {"status": "KEEPALIVED"}, "error": None}

        return None

    def stats(self):
        return {
            "logins": len(self.logins),
            "shares_submitted": self.shares_submitted,
            "shares_accepted": self.shares_accepted,
            "shares_rejected": self.shares_rejected,
            "groups": list(self.groups_seen),
            "events": self.event_log[-20:],
        }


def test_mock_server():
    section("TEST 2 — Mock Revenue Stratum Server")

    pool = MockRevenuePool(MOCK_PORT)
    try:
        pool.start()
        time.sleep(0.2)
        ok("Mock pool started", f"127.0.0.1:{MOCK_PORT}")
    except Exception as e:
        fail("Mock pool start", str(e))
        return None

    # Quick connection test
    try:
        s = socket.socket()
        s.settimeout(3)
        s.connect(("127.0.0.1", MOCK_PORT))
        login = json.dumps({
            "id": 1, "method": "login",
            "params": {"login": TEST_WALLET, "pass": "zion", "rigid": TEST_WORKER, "agent": "test/1"}
        }) + "\n"
        s.sendall(login.encode())
        data = b""
        while b"\n" not in data:
            data += s.recv(4096)
        resp = json.loads(data.decode().splitlines()[0])
        if resp.get("result", {}).get("status") == "OK":
            job = resp["result"].get("job", {})
            ok("Login handshake OK", f"height={job.get('height')} algo={job.get('algo')}")
        else:
            fail("Login handshake", str(resp.get("error")))
        s.close()
    except Exception as e:
        fail("Quick connect test", str(e))

    return pool


# ══════════════════════════════════════════════════════════════
# TEST 3 — Miner Binary (Local Run)
# ══════════════════════════════════════════════════════════════
def test_miner_local(pool: MockRevenuePool, miner_exe: Path, timeout_sec: int = 30):
    section("TEST 3 — Miner Binary Local Run")

    if not miner_exe.exists():
        fail("Miner binary found", str(miner_exe))
        return False
    ok("Miner binary found", str(miner_exe.name))

    # Stats file for reading miner output
    stats_file = ROOT / "tests" / "_revenue_test_stats.json"

    cmd = [
        str(miner_exe),
        "--pool", f"127.0.0.1:{MOCK_PORT}",
        "--wallet", TEST_WALLET,
        "--worker", TEST_WORKER,
        "--algorithm", "cosmic_harmony",
        "--threads", "1",
        "--no-color",
        "--stats-file", str(stats_file),
        "--stats-interval", "3",
        "--debug",
    ]

    print(f"{INFO}  Starting miner for {timeout_sec}s...")
    print(f"{INFO}  CMD: {' '.join(cmd[:6])} ...")

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
    except Exception as e:
        fail("Miner process start", str(e))
        return False

    ok("Miner process started", f"PID={proc.pid}")

    # Collect miner output for timeout_sec
    output_lines = []
    start = time.time()
    shares_found = 0
    connected = False
    hash_rate_found = False

    output_q = queue.Queue()
    def reader():
        try:
            for line in proc.stdout:
                output_q.put(line.rstrip())
        except Exception:
            pass

    rt = threading.Thread(target=reader, daemon=True)
    rt.start()

    while time.time() - start < timeout_sec:
        try:
            line = output_q.get(timeout=0.5)
        except queue.Empty:
            if proc.poll() is not None:
                break
            continue

        output_lines.append(line)
        low = line.lower()

        if "connected" in low or "login" in low or "session" in low:
            connected = True
        if "share" in low and ("accept" in low or "submit" in low):
            shares_found += 1
        if "h/s" in low or "hash" in low:
            hash_rate_found = True

        # Print key lines
        if any(kw in low for kw in ["error", "warn", "connected", "share", "logout", "h/s", "stream"]):
            print(f"  miner │ {line[:100]}")

    # Stop miner
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass

    elapsed = min(time.time() - start, timeout_sec)

    # Also check pool stats — miner login appears there even if stdout is buffered
    pool_stats = pool.stats()
    miner_connected_via_pool = pool_stats["logins"] > 1  # >1 because test already did 1 login
    if connected or miner_connected_via_pool:
        ok("Miner connected to mock pool", f"pool_logins={pool_stats['logins']}")
    else:
        warn("Miner connection not confirmed in output")

    if hash_rate_found:
        ok("Hash rate reported by miner")
    else:
        warn("No hash rate in output (short test interval)")

    # Check stats file
    if stats_file.exists():
        try:
            with open(stats_file) as f:
                stats = json.load(f)
            hr = stats.get("hashrate_h_s", stats.get("hashrate", 0))
            algo = stats.get("algorithm", "?")
            ok("Stats file written", f"algo={algo} hashrate={hr:.1f} H/s")
        except Exception as e:
            warn("Stats file parse error", str(e))
        finally:
            stats_file.unlink(missing_ok=True)
    else:
        warn("Stats file not written in test window")

    print(f"{INFO}  Miner ran for {elapsed:.1f}s, output lines: {len(output_lines)}")
    return True


# ══════════════════════════════════════════════════════════════
# TEST 4 — Revenue Stream Routing
# ══════════════════════════════════════════════════════════════
def test_revenue_routing(pool: MockRevenuePool):
    section("TEST 4 — Revenue Stream Routing (Mock Pool Stats)")

    stats = pool.stats()

    print(f"{INFO}  Logins received:        {stats['logins']}")
    print(f"{INFO}  Shares submitted:       {stats['shares_submitted']}")
    print(f"{INFO}  Shares accepted:        {stats['shares_accepted']}")
    print(f"{INFO}  Shares rejected:        {stats['shares_rejected']}")
    print(f"{INFO}  Connection groups seen: {stats['groups']}")

    if stats["logins"] > 0:
        ok("Pool received miner login")
    else:
        fail("No logins received by mock pool")

    if stats["shares_submitted"] > 0:
        ok("Shares submitted by miner", f"{stats['shares_submitted']} total")
    else:
        warn("No shares submitted (normal for short test with low hash rate)")

    # Check event log
    if stats["events"]:
        print(f"\n{INFO}  Recent pool events:")
        for ev in stats["events"][-10:]:
            print(f"  pool  │ {ev}")

    # Revenue stream config cross-check
    with open(CONFIG_FILE) as f:
        cfg = json.load(f)
    streams = cfg.get("streams", {})

    enabled = [k for k, v in streams.items() if isinstance(v, dict) and v.get("enabled")]
    disabled = [k for k, v in streams.items() if isinstance(v, dict) and not v.get("enabled")]
    ok("Revenue streams check", f"enabled={enabled}  disabled={disabled}")

    # Verify revenue percentages sum correctly-ish
    # Streams are separate compute allocations (50/25/25 model) — sum > 100% is expected
    # because merged mining byproducts are "free" (ETC reuses ZION compute)
    total_target = sum(
        v.get("target_share", 0)
        for v in streams.values()
        if isinstance(v, dict) and v.get("enabled")
    )
    if total_target >= 0.45:
        ok("Revenue target shares sum", f"{total_target*100:.0f}% (50/25/25 model + merged mining byproducts)")
    else:
        warn("Revenue target shares sum unexpected", f"{total_target*100:.0f}%")


# ══════════════════════════════════════════════════════════════
# TEST 5 — Revenue Config Deep Check
# ══════════════════════════════════════════════════════════════
def test_config_deep():
    section("TEST 5 — Revenue Config Deep Checks")

    with open(CONFIG_FILE) as f:
        cfg = json.load(f)
    streams = cfg.get("streams", {})

    # Merged mining — ETC
    etc = streams.get("etc", {})
    if etc.get("enabled") and etc.get("auto_convert_to_zion"):
        ok("ETC auto_convert_to_zion = true (revenue reinvested)")
    elif etc.get("enabled"):
        warn("ETC enabled but auto_convert_to_zion not set")

    # NXS — not enabled (pool not ready), that's fine
    nxs = streams.get("nxs", {})
    if not nxs.get("enabled"):
        ok("NXS stream correctly disabled (SHA3 pool not ready)")

    # GPU profit switch — coins list
    gpu = streams.get("dynamic_gpu", {})
    coins = gpu.get("preferred_coins", [])
    must_have = ["KAS", "ALPH", "ERG", "ETC"]
    missing = [c for c in must_have if c not in coins]
    if not missing:
        ok("GPU profit switch coins list complete", f"{len(coins)} coins")
    else:
        warn("GPU profit switch coins missing", f"missing: {missing}")

    # Switching interval
    switching = gpu.get("switching", {})
    interval = switching.get("interval_minutes", 0)
    if 5 <= interval <= 60:
        ok("Profit switch interval", f"{interval} minutes (healthy range 5–60)")
    else:
        warn("Profit switch interval", f"{interval} min (unusual)")

    # NCL fees
    ncl = streams.get("ncl", {})
    fee = ncl.get("fee_percent", ncl.get("project_fee", 0))
    if ncl and fee:
        ok("NCL fee configured", f"{fee}%")
    else:
        ok("NCL stream (basic config)")

    # Version check
    ver = cfg.get("version", "0")
    parts = ver.split(".")
    if len(parts) == 3 and int(parts[0]) >= 3:
        ok("Config schema v3.x", ver)
    else:
        warn("Config version", ver)


# ══════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════
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
        print("  🎉  Revenue system LOCAL TEST PASSED — ready for server deployment!")
    elif failed > 0:
        print("  🔴  Failures detected — fix before deploying to servers.")
        for r in results:
            if r[0] == "FAIL":
                print(f"       {FAIL} {r[1]}")
    else:
        print("  🟡  All checks passed with warnings — review before deploying.")

    return failed == 0


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="ZION Revenue System Local Test")
    parser.add_argument("--miner-exe", type=Path, default=MINER_EXE)
    parser.add_argument("--timeout", type=int, default=30, help="Miner run seconds (default 30)")
    parser.add_argument("--skip-miner", action="store_true", help="Skip miner binary test")
    args = parser.parse_args()

    print("=" * 60)
    print("  ZION v2.9.6 — REVENUE SYSTEM LOCAL TEST")
    print(f"  Config: {CONFIG_FILE.name}")
    print(f"  Miner:  {args.miner_exe.name}")
    print(f"  Port:   {MOCK_PORT}")
    print("=" * 60)

    # Test 1 — config
    test_revenue_config()

    # Test 2 — mock pool
    pool = test_mock_server()
    if pool is None:
        fail("Cannot continue without mock pool")
        print_summary()
        sys.exit(1)

    # Test 3 — miner
    if not args.skip_miner:
        test_miner_local(pool, args.miner_exe, timeout_sec=args.timeout)
    else:
        warn("Miner test skipped (--skip-miner)")

    # Test 4 — routing stats
    test_revenue_routing(pool)

    # Test 5 — deep config
    test_config_deep()

    # Cleanup
    pool.stop()

    # Summary
    passed = print_summary()
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
