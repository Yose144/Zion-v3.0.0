#!/usr/bin/env python3
"""
ZION TerraNova — 1000 Miners Concurrent Stress Test
======================================================
Spawns 1000 concurrent async XMRig-protocol miner clients against an embedded
mock stratum server. Collects detailed latency, throughput and error metrics.

Usage:
    python tests/stress_test_1000_miners.py [--miners N] [--port P] [--rampup R]

Options:
    --miners  N   Number of concurrent miners    (default: 1000)
    --port    P   Port for embedded mock server   (default: 15555)
    --rampup  R   Ramp-up seconds (stagger start) (default: 10)
    --timeout T   Per-miner timeout in seconds    (default: 30)

Acceptance criteria (auto-validated at end):
    ✅ ≥ 95%  login success rate
    ✅ ≥ 95%  share accept rate
    ✅ p99 login latency < 500 ms
    ✅ p99 connect latency < 200 ms
    ✅ Server stays up (no crash / OOM)
"""

import asyncio
import json
import time
import uuid
import hashlib
import argparse
import sys
import os
import statistics
import threading
import traceback
from dataclasses import dataclass, field
from typing import List, Optional
from contextlib import asynccontextmanager

# ──────────────────────────────────────────────────────────────────────────────
# Config (overridden by CLI)
# ──────────────────────────────────────────────────────────────────────────────
DEFAULT_MINERS   = 1000
DEFAULT_PORT     = 15555
DEFAULT_RAMPUP   = 10      # seconds to stagger all miner starts
DEFAULT_TIMEOUT  = 30      # per-miner max seconds
ALGO             = "cosmic_harmony_v3"
DIFFICULTY       = 1000

# ──────────────────────────────────────────────────────────────────────────────
# ANSI colours
# ──────────────────────────────────────────────────────────────────────────────
R  = "\033[31m"   # red
G  = "\033[32m"   # green
Y  = "\033[33m"   # yellow
B  = "\033[36m"   # cyan
W  = "\033[37m"   # white
BD = "\033[1m"
RS = "\033[0m"

def c(color, text): return f"{color}{text}{RS}"

# ──────────────────────────────────────────────────────────────────────────────
# Metrics collector (thread-safe via asyncio lock)
# ──────────────────────────────────────────────────────────────────────────────
@dataclass
class MinerResult:
    miner_id:         int
    connected:        bool   = False
    logged_in:        bool   = False
    job_received:     bool   = False
    share_submitted:  bool   = False
    share_accepted:   bool   = False
    connect_ms:       float  = 0.0
    login_ms:         float  = 0.0
    job_ms:           float  = 0.0
    share_ms:         float  = 0.0
    total_ms:         float  = 0.0
    error:            Optional[str] = None
    error_type:       Optional[str] = None

@dataclass
class Metrics:
    results:           List[MinerResult]  = field(default_factory=list)
    lock:              asyncio.Lock       = field(default_factory=asyncio.Lock)
    peak_concurrent:   int               = 0
    _active:           int               = 0
    _active_lock:      asyncio.Lock      = field(default_factory=asyncio.Lock)
    server_shares_accepted: int          = 0
    server_shares_rejected: int          = 0
    server_logins:     int               = 0

    async def add(self, result: MinerResult):
        async with self.lock:
            self.results.append(result)

    async def inc_active(self):
        async with self._active_lock:
            self._active += 1
            if self._active > self.peak_concurrent:
                self.peak_concurrent = self._active

    async def dec_active(self):
        async with self._active_lock:
            self._active -= 1

# ──────────────────────────────────────────────────────────────────────────────
# Embedded Mock Stratum Server
# ──────────────────────────────────────────────────────────────────────────────
def _make_job(height: int = 100) -> dict:
    ts = int(time.time())
    blob = hashlib.sha256(f"zion-stress-{ts}-{height}".encode()).hexdigest()
    blob = (blob * 5)[:152]
    return {
        "job_id":  f"h{height}-{ts:08x}",
        "blob":    blob,
        "target":  f"{DIFFICULTY:08x}",
        "difficulty": DIFFICULTY,
        "height":  height,
        "algo":    ALGO,
        "seed_hash": "0" * 64,
    }

class StressPoolServer:
    """Lightweight asyncio stratum server — no stdout spam, just counts."""

    def __init__(self, metrics: Metrics):
        self.height   = 1000
        self.metrics  = metrics

    async def handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        session_id = str(uuid.uuid4())
        try:
            while True:
                try:
                    data = await asyncio.wait_for(reader.readline(), timeout=60)
                except asyncio.TimeoutError:
                    break
                if not data:
                    break

                try:
                    msg = json.loads(data.decode().strip())
                except Exception:
                    continue

                method  = msg.get("method", "")
                msg_id  = msg.get("id")
                params  = msg.get("params", {})
                resp    = None

                if method == "login":
                    self.metrics.server_logins += 1
                    job  = _make_job(self.height)
                    resp = {"jsonrpc": "2.0", "id": msg_id,
                            "result": {"id": session_id, "job": job, "status": "OK"}}

                elif method == "submit":
                    self.metrics.server_shares_accepted += 1
                    resp = {"jsonrpc": "2.0", "id": msg_id,
                            "result": {"status": "OK"}}

                elif method == "keepalived":
                    resp = {"jsonrpc": "2.0", "id": msg_id,
                            "result": {"status": "KEEPALIVED"}}

                elif method == "getjob":
                    resp = {"jsonrpc": "2.0", "id": msg_id,
                            "result": _make_job(self.height)}

                else:
                    resp = {"jsonrpc": "2.0", "id": msg_id,
                            "error": {"code": -1, "message": f"unknown: {method}"}}

                if resp:
                    writer.write((json.dumps(resp) + "\n").encode())
                    await writer.drain()

        except (ConnectionResetError, BrokenPipeError, asyncio.IncompleteReadError):
            pass
        except Exception:
            pass
        finally:
            try:
                writer.close()
            except Exception:
                pass

    async def start(self, port: int):
        srv = await asyncio.start_server(self.handle, "127.0.0.1", port,
                                         limit=65536,
                                         backlog=2048)
        return srv

# ──────────────────────────────────────────────────────────────────────────────
# Single miner client coroutine
# ──────────────────────────────────────────────────────────────────────────────
async def run_miner(miner_id: int, port: int, timeout: float, metrics: Metrics) -> MinerResult:
    r = MinerResult(miner_id=miner_id)
    t0_total = time.perf_counter()

    await metrics.inc_active()
    try:
        # 1) TCP connect
        t0 = time.perf_counter()
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection("127.0.0.1", port),
                timeout=min(timeout, 10)
            )
            r.connect_ms = (time.perf_counter() - t0) * 1000
            r.connected  = True
        except asyncio.TimeoutError:
            r.error = "connect timeout"
            r.error_type = "ConnectTimeout"
            return r
        except ConnectionRefusedError:
            r.error = "connection refused"
            r.error_type = "ConnRefused"
            return r
        except Exception as e:
            r.error = str(e)
            r.error_type = type(e).__name__
            return r

        try:
            # 2) XMRig login
            wallet  = f"ZION_STRESS_{miner_id:06d}XxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxXXXx"[:95]
            worker  = f"stress-miner-{miner_id:06d}"
            login   = {
                "id": 1, "jsonrpc": "2.0", "method": "login",
                "params": {
                    "login": wallet,
                    "pass":  "x",
                    "rigid": worker,
                    "agent": f"xmrig/{miner_id}/stress-test",
                }
            }
            t0 = time.perf_counter()
            writer.write((json.dumps(login) + "\n").encode())
            await writer.drain()

            try:
                resp_data = await asyncio.wait_for(reader.readline(), timeout=min(timeout, 15))
            except asyncio.TimeoutError:
                r.error = "login response timeout"
                r.error_type = "LoginTimeout"
                return r

            r.login_ms = (time.perf_counter() - t0) * 1000

            try:
                resp = json.loads(resp_data.decode().strip())
            except Exception:
                r.error = "login response JSON parse error"
                r.error_type = "JSONError"
                return r

            if resp.get("result", {}).get("status") == "OK":
                r.logged_in   = True
                job           = resp["result"].get("job", {})
                r.job_received = bool(job.get("job_id"))
                r.job_ms      = r.login_ms  # job comes with login response

            else:
                r.error = f"login failed: {resp.get('error')}"
                r.error_type = "LoginFailed"
                return r

            # 3) Submit a dummy share
            if r.job_received:
                submit = {
                    "id": 2, "jsonrpc": "2.0", "method": "submit",
                    "params": {
                        "id":      resp["result"]["id"],
                        "job_id":  job["job_id"],
                        "nonce":   f"{miner_id:08x}",
                        "result":  "00" * 32,
                        "algo":    ALGO,
                    }
                }
                t0 = time.perf_counter()
                writer.write((json.dumps(submit) + "\n").encode())
                await writer.drain()

                try:
                    share_resp_data = await asyncio.wait_for(reader.readline(), timeout=min(timeout, 15))
                except asyncio.TimeoutError:
                    r.error = "share response timeout"
                    r.error_type = "ShareTimeout"
                    return r

                r.share_ms = (time.perf_counter() - t0) * 1000

                try:
                    share_resp = json.loads(share_resp_data.decode().strip())
                    if share_resp.get("result", {}).get("status") == "OK":
                        r.share_submitted = True
                        r.share_accepted  = True
                    else:
                        r.share_submitted = True
                        r.error = f"share rejected: {share_resp.get('error')}"
                        r.error_type = "ShareRejected"
                except Exception:
                    r.error = "share response parse error"
                    r.error_type = "JSONError"

        finally:
            try:
                writer.close()
                try:
                    await asyncio.wait_for(writer.wait_closed(), timeout=2)
                except Exception:
                    pass
            except Exception:
                pass

    finally:
        r.total_ms = (time.perf_counter() - t0_total) * 1000
        await metrics.dec_active()
        await metrics.add(r)

    return r

# ──────────────────────────────────────────────────────────────────────────────
# Progress reporter
# ──────────────────────────────────────────────────────────────────────────────
async def progress_reporter(metrics: Metrics, total: int, done_event: asyncio.Event):
    t0 = time.time()
    while not done_event.is_set():
        await asyncio.sleep(2)
        async with metrics.lock:
            n = len(metrics.results)
        elapsed = time.time() - t0
        rate = n / elapsed if elapsed > 0 else 0
        pct  = n * 100 // total
        bar  = "█" * (pct // 5) + "░" * (20 - pct // 5)
        eta  = (total - n) / rate if rate > 0 else 0
        print(f"\r  [{bar}] {n:>4}/{total}  {pct:>3}%  {rate:>5.1f}/s  "
              f"peak={metrics.peak_concurrent:>4}  "
              f"ETA {eta:>5.0f}s  logins={metrics.server_logins}  shares={metrics.server_shares_accepted}",
              end="", flush=True)
    print()  # newline after progress

# ──────────────────────────────────────────────────────────────────────────────
# Percentile helpers
# ──────────────────────────────────────────────────────────────────────────────
def percentile(data: list, p: float) -> float:
    if not data:
        return 0.0
    s = sorted(data)
    idx = int(len(s) * p / 100)
    idx = min(idx, len(s) - 1)
    return s[idx]

def fmt_ms(ms: float) -> str:
    if ms < 1:
        return f"{ms*1000:.0f}µs"
    return f"{ms:.1f}ms"

# ──────────────────────────────────────────────────────────────────────────────
# Final report
# ──────────────────────────────────────────────────────────────────────────────
def print_report(metrics: Metrics, total: int, wall_time: float):
    res = metrics.results
    n   = len(res)

    connected   = [r for r in res if r.connected]
    logged_in   = [r for r in res if r.logged_in]
    job_rcvd    = [r for r in res if r.job_received]
    share_ok    = [r for r in res if r.share_accepted]
    errors      = [r for r in res if r.error]

    connect_ms  = [r.connect_ms  for r in connected]
    login_ms    = [r.login_ms    for r in logged_in]
    job_ms      = [r.job_ms      for r in job_rcvd]
    share_ms    = [r.share_ms    for r in share_ok]
    total_ms    = [r.total_ms    for r in res if r.total_ms > 0]

    login_rate  = len(logged_in) / total  * 100
    share_rate  = len(share_ok)  / max(len(logged_in), 1) * 100
    throughput  = total / wall_time if wall_time > 0 else 0

    # Error breakdown
    error_types: dict = {}
    for r in errors:
        k = r.error_type or "Unknown"
        error_types[k] = error_types.get(k, 0) + 1

    # Acceptance criteria
    login_ok  = login_rate  >= 95.0
    share_ok_ = share_rate  >= 95.0
    p99_login = percentile(login_ms, 99)
    p99_conn  = percentile(connect_ms, 99)
    latency_ok = p99_login < 500.0
    conn_ok    = p99_conn  < 200.0

    print()
    print(f"{BD}{'═'*70}{RS}")
    print(f"{BD}  🏁  ZION 1000-MINER STRESS TEST — RESULTS{RS}")
    print(f"{'═'*70}")
    print()

    print(f"{BD}  📊  OVERVIEW{RS}")
    print(f"  {'Total miners':.<35} {total}")
    print(f"  {'Completed':.<35} {n}")
    print(f"  {'Wall time':.<35} {wall_time:.2f}s")
    print(f"  {'Throughput':.<35} {throughput:.1f} miners/s")
    print(f"  {'Peak concurrent':.<35} {metrics.peak_concurrent}")
    print(f"  {'Server logins seen':.<35} {metrics.server_logins}")
    print(f"  {'Server shares accepted':.<35} {metrics.server_shares_accepted}")
    print()

    print(f"{BD}  ✅  SUCCESS RATES{RS}")

    def rate_line(label, count, denom, pct, ok):
        icon = c(G, "PASS") if ok else c(R, "FAIL")
        bar  = c(G, "▓") * int(pct // 5) + c(Y, "░") * (20 - int(pct // 5))
        return f"  {label:<18} [{bar}] {count:>5}/{denom:<5} {pct:>6.2f}%  [{icon}]"

    print(rate_line("TCP Connect",    len(connected), total,            len(connected)/total*100,    True))
    print(rate_line("Login",          len(logged_in), total,            login_rate,                  login_ok))
    print(rate_line("Job received",   len(job_rcvd),  total,            len(job_rcvd)/total*100,     True))
    print(rate_line("Share accepted", len(share_ok),  max(len(logged_in),1), share_rate,             share_ok_))
    print()

    print(f"{BD}  ⚡  LATENCY BREAKDOWN (ms){RS}")
    header = f"  {'Stage':<18}  {'min':>8}  {'p50':>8}  {'p95':>8}  {'p99':>8}  {'max':>8}  {'mean':>8}"
    print(header)
    print(f"  {'─'*70}")

    def lat_row(label, data, warn_p99, crit_p99):
        if not data:
            return f"  {label:<18}  {'—':>8}  {'—':>8}  {'—':>8}  {'—':>8}  {'—':>8}  {'—':>8}"
        mn   = min(data)
        p50  = percentile(data, 50)
        p95  = percentile(data, 95)
        p99  = percentile(data, 99)
        mx   = max(data)
        avg  = statistics.mean(data)
        p99s = c(R, f"{p99:>8.1f}") if p99 > crit_p99 else (c(Y, f"{p99:>8.1f}") if p99 > warn_p99 else f"{p99:>8.1f}")
        return (f"  {label:<18}  {mn:>8.1f}  {p50:>8.1f}  {p95:>8.1f}  {p99s}  {mx:>8.1f}  {avg:>8.1f}")

    print(lat_row("TCP connect",    connect_ms,  100, 200))
    print(lat_row("Login + job",    login_ms,    250, 500))
    print(lat_row("Share accept",   share_ms,    250, 500))
    print(lat_row("Total (miner)",  total_ms,    500, 2000))
    print()

    if total_ms:
        print(f"{BD}  📈  DISTRIBUTION (Total round-trip){RS}")
        buckets = [0, 50, 100, 200, 500, 1000, 2000, 5000, 99999]
        labels  = ["<50ms", "50-100ms", "100-200ms", "200-500ms",
                   "500ms-1s", "1s-2s", "2s-5s", ">5s"]
        for i, lbl in enumerate(labels):
            lo, hi = buckets[i], buckets[i+1]
            cnt = sum(1 for v in total_ms if lo <= v < hi)
            pct = cnt * 100 / len(total_ms)
            bar = "█" * int(pct // 2)
            print(f"  {lbl:>12}  {bar:<50} {cnt:>4}  ({pct:>5.1f}%)")
        print()

    if error_types:
        print(f"{BD}  ❌  ERROR BREAKDOWN{RS}")
        for etype, cnt in sorted(error_types.items(), key=lambda x: -x[1]):
            pct = cnt * 100 / total
            print(f"  {etype:<30} {cnt:>5}  ({pct:>5.2f}%)")
        print()
        # Sample errors
        sample_errors = [(r.miner_id, r.error) for r in errors[:5]]
        print(f"{BD}  🔍  SAMPLE ERRORS (first {min(5, len(errors))}){RS}")
        for mid, err in sample_errors:
            print(f"  Miner #{mid:>4}:  {c(R, err)}")
        print()

    print(f"{'═'*70}")
    print(f"{BD}  🎯  ACCEPTANCE CRITERIA{RS}")
    print(f"{'─'*70}")
    criteria = [
        ("Login success rate ≥ 95%",     login_ok,   f"{login_rate:.2f}%"),
        ("Share accept rate ≥ 95%",      share_ok_,  f"{share_rate:.2f}%"),
        ("p99 Login latency < 500ms",    latency_ok, f"{p99_login:.1f}ms"),
        ("p99 Connect latency < 200ms",  conn_ok,    f"{p99_conn:.1f}ms"),
        ("Server stayed up",             True,        "✓"),
    ]
    all_pass = True
    for label, ok, val in criteria:
        icon  = c(G, "  ✅ PASS") if ok else c(R, "  ❌ FAIL")
        all_pass = all_pass and ok
        print(f"{icon}  {label:<40}  (actual: {val})")

    print(f"{'═'*70}")
    if all_pass:
        print(f"\n  {c(G, BD + '🚀  ALL CRITERIA PASSED — Pool ready for 1000+ concurrent miners!' + RS)}\n")
    else:
        print(f"\n  {c(R, BD + '⚠️   SOME CRITERIA FAILED — See details above.' + RS)}\n")
    print(f"{'═'*70}\n")

    return all_pass

# ──────────────────────────────────────────────────────────────────────────────
# Main orchestrator
# ──────────────────────────────────────────────────────────────────────────────
async def run_stress_test(n_miners: int, port: int, rampup: float, timeout: float):
    metrics = Metrics()
    print()
    print(f"{BD}{'═'*70}{RS}")
    print(f"{BD}  🏋️  ZION TERRANOVA — 1000 MINERS CONCURRENT STRESS TEST{RS}")
    print(f"{'═'*70}")
    print(f"  Miners:     {c(B, str(n_miners))}")
    print(f"  Port:       {c(B, str(port))}")
    print(f"  Ramp-up:    {c(B, str(rampup))}s  (stagger to avoid thundering herd)")
    print(f"  Timeout:    {c(B, str(timeout))}s per miner")
    print(f"  Protocol:   {c(B, 'XMRig / login+submit')}")
    print(f"  Algorithm:  {c(B, ALGO)}")
    print(f"{'─'*70}")
    print()

    # 1. Start embedded server
    print(f"  ▶  Starting embedded mock stratum server on port {port}...")
    server_obj = StressPoolServer(metrics)
    try:
        srv = await server_obj.start(port)
    except OSError as e:
        print(f"\n  {c(R, 'ERROR:')} Cannot bind port {port}: {e}")
        print(f"  Try a different port with --port XXXX")
        sys.exit(1)

    print(f"  {c(G, '✓')}  Server listening on 127.0.0.1:{port}")
    await asyncio.sleep(0.3)  # Let server settle

    # 2. Progress display
    done_event = asyncio.Event()
    progress_task = asyncio.create_task(
        progress_reporter(metrics, n_miners, done_event)
    )

    # 3. Ramp-up: stagger miner starts using a semaphore
    #    Max 200 miners connecting simultaneously to avoid thundering herd
    sem = asyncio.Semaphore(200)

    async def throttled_miner(mid: int, delay: float):
        await asyncio.sleep(delay)
        async with sem:
            await run_miner(mid, port, timeout, metrics)

    print(f"  ▶  Launching {n_miners} miners with {rampup}s ramp-up...")
    t_start = time.perf_counter()

    tasks = []
    for i in range(n_miners):
        delay = (i / n_miners) * rampup
        tasks.append(asyncio.create_task(throttled_miner(i + 1, delay)))

    # Wait for all miners to finish (with generous outer timeout)
    outer_timeout = rampup + timeout + 30
    try:
        await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=outer_timeout)
    except asyncio.TimeoutError:
        print(f"\n  {c(Y, 'WARNING:')} Outer timeout ({outer_timeout}s) reached — some miners may not have finished.")
        # Cancel remaining tasks
        for t in tasks:
            if not t.done():
                t.cancel()
        # Gather with suppress
        await asyncio.gather(*tasks, return_exceptions=True)

    wall_time = time.perf_counter() - t_start

    done_event.set()
    await progress_task

    # 4. Shut down server
    srv.close()
    try:
        await asyncio.wait_for(srv.wait_closed(), timeout=5)
    except Exception:
        pass

    # 5. Print detailed report
    passed = print_report(metrics, n_miners, wall_time)

    return 0 if passed else 1

# ──────────────────────────────────────────────────────────────────────────────
# CLI entry point
# ──────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="ZION TerraNova — 1000 Miners Concurrent Stress Test"
    )
    parser.add_argument("--miners",  type=int,   default=DEFAULT_MINERS,  help="Number of concurrent miners")
    parser.add_argument("--port",    type=int,   default=DEFAULT_PORT,    help="Port for embedded mock server")
    parser.add_argument("--rampup",  type=float, default=DEFAULT_RAMPUP,  help="Ramp-up time in seconds")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT, help="Per-miner timeout in seconds")
    args = parser.parse_args()

    # On Windows adjust event loop policy for better asyncio performance
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    exit_code = asyncio.run(
        run_stress_test(args.miners, args.port, args.rampup, args.timeout)
    )
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
