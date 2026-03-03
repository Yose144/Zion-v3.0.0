#!/usr/bin/env python3
"""
Phase 1.12 — 100 Miners Stress Test
====================================
Spawns N concurrent synthetic miners against an in-process ZION Mock Stratum
Server (same event loop — no subprocess, reliable cross-platform).

Usage:
    # Self-contained (starts its own in-process mock server on 13333):
    python tests/stress_100_miners.py

    # Against an external server (e.g. testnet pool Helsinki):
    python tests/stress_100_miners.py --host 77.42.31.72 --port 3333 --external

Options:
    --host   STRATUM_HOST      default: 127.0.0.1
    --port   STRATUM_PORT      default: 13333
    --miners N                 default: 100
    --shares SHARES_PER_MINER  default: 10
    --ramp-ms RAMP_MS          default: 30   (ms between miner spawns)
    --timeout SECONDS          default: 90
    --external                 Connect to external server (skip in-process mock)

Exit codes:
    0 — PASS  (≥ 95% connected, ≥ 90% shares accepted, p99 < 1000ms)
    1 — FAIL
"""

import asyncio
import json
import sys
import os
import time
import argparse
import statistics
import hashlib
import uuid
from dataclasses import dataclass, field
from typing import List, Optional

# ─── CLI ───────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="ZION 100-Miners Stress Test (Phase 1.12)")
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", type=int, default=13333)
parser.add_argument("--miners", type=int, default=100)
parser.add_argument("--shares", type=int, default=10, help="Shares per miner")
parser.add_argument("--ramp-ms", type=int, default=30)
parser.add_argument("--timeout", type=int, default=90)
parser.add_argument("--external", action="store_true", help="Use external server, skip mock")
ARGS = parser.parse_args()

ALGO = "cosmic_harmony_v3"
DIFFICULTY = 1000

# ─── In-process mock Stratum server ──────────────────────────────────────────
def _make_job(height: int) -> dict:
    ts = int(time.time())
    blob = hashlib.sha256(f"zion-stress-{ts}-{height}".encode()).hexdigest() * 5
    return {
        "job_id": f"h{height}-{ts:08x}",
        "blob": blob[:152],
        "target": f"{DIFFICULTY:08x}",
        "difficulty": DIFFICULTY,
        "height": height,
        "algo": ALGO,
        "seed_hash": "0" * 64,
    }

class _MockServer:
    def __init__(self):
        self.height = 1000
        self.shares_accepted = 0

    async def handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        sid = str(uuid.uuid4())
        try:
            while True:
                data = await asyncio.wait_for(reader.readline(), timeout=60)
                if not data:
                    break
                try:
                    msg = json.loads(data.decode().strip())
                except Exception:
                    continue
                method = msg.get("method", "")
                mid = msg.get("id")

                if method == "login":
                    resp = {"jsonrpc": "2.0", "id": mid,
                            "result": {"id": sid, "job": _make_job(self.height), "status": "OK"}}
                elif method == "submit":
                    self.shares_accepted += 1
                    resp = {"jsonrpc": "2.0", "id": mid, "result": {"status": "OK"}}
                elif method == "keepalived":
                    resp = {"jsonrpc": "2.0", "id": mid, "result": {"status": "KEEPALIVED"}}
                elif method == "getjob":
                    resp = {"jsonrpc": "2.0", "id": mid, "result": _make_job(self.height)}
                else:
                    resp = {"jsonrpc": "2.0", "id": mid, "error": {"code": -1, "message": "unknown"}}

                writer.write((json.dumps(resp) + "\n").encode())
                await writer.drain()
        except (asyncio.TimeoutError, ConnectionResetError, asyncio.CancelledError):
            pass
        except Exception:
            pass
        finally:
            try:
                writer.close()
            except Exception:
                pass

# ─── Metrics ──────────────────────────────────────────────────────────────────
@dataclass
class MinerResult:
    miner_id: int
    connected: bool = False
    login_ok: bool = False
    shares_submitted: int = 0
    shares_accepted: int = 0
    errors: int = 0
    latencies_ms: List[float] = field(default_factory=list)

# ─── Single async miner ───────────────────────────────────────────────────────
async def run_miner(
    miner_id: int, host: str, port: int,
    shares_target: int, result: MinerResult,
):
    wallet = f"ZSTRESS_{miner_id:04d}"
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=10
        )
        result.connected = True
    except Exception:
        result.errors += 1
        return

    async def send(msg: dict):
        writer.write((json.dumps(msg) + "\n").encode())
        await writer.drain()

    async def recv() -> Optional[dict]:
        try:
            line = await asyncio.wait_for(reader.readline(), timeout=15)
            return json.loads(line.decode().strip()) if line.strip() else None
        except Exception:
            return None

    try:
        await send({"method": "login", "params": {
            "login": wallet, "pass": "x",
            "rigid": f"w{miner_id:04d}",
            "agent": f"stress/1.12 #{miner_id}",
        }, "id": 1})

        resp = await recv()
        if not resp or resp.get("error"):
            result.errors += 1
            return
        result.login_ok = True
        job = resp.get("result", {}).get("job", {})
        sid = resp.get("result", {}).get("id", "?")

        for i in range(shares_target):
            t0 = time.perf_counter()
            await send({"method": "submit", "params": {
                "id": sid,
                "job_id": job.get("job_id", "j"),
                "nonce": f"{miner_id:08x}{i:08x}",
                "result": "0" * 64,
            }, "id": 10 + i})
            r = await recv()
            lat = (time.perf_counter() - t0) * 1000
            result.shares_submitted += 1
            if r and not r.get("error"):
                result.shares_accepted += 1
                result.latencies_ms.append(lat)
            else:
                result.errors += 1
            await asyncio.sleep(0.02)

    except asyncio.CancelledError:
        pass
    except Exception:
        result.errors += 1
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass

# ─── Main orchestrator ────────────────────────────────────────────────────────
async def main():
    n = ARGS.miners

    print(f"\n{'='*62}")
    print(f"  ZION Phase 1.12 — {n} Miners Stress Test")
    print(f"{'='*62}")
    print(f"  Host      : {ARGS.host}:{ARGS.port}")
    print(f"  Miners    : {n}")
    print(f"  Shares    : {ARGS.shares}/miner  ({n * ARGS.shares} total)")
    print(f"  Ramp      : {ARGS.ramp_ms} ms between spawns")
    print(f"  Timeout   : {ARGS.timeout}s")

    server_task = None
    mock = None

    if not ARGS.external:
        mock = _MockServer()
        srv = await asyncio.start_server(mock.handle, "127.0.0.1", ARGS.port)
        server_task = asyncio.create_task(srv.serve_forever(), name="mock-server")
        print(f"  Mode      : in-process mock server")
    else:
        print(f"  Mode      : external server")
    print(f"{'='*62}\n")

    results = [MinerResult(miner_id=i) for i in range(n)]
    t_start = time.perf_counter()

    tasks = []
    for i, r in enumerate(results):
        if ARGS.ramp_ms > 0:
            await asyncio.sleep(ARGS.ramp_ms / 1000)
        task = asyncio.create_task(
            run_miner(i, ARGS.host, ARGS.port, ARGS.shares, r),
            name=f"m{i}",
        )
        tasks.append(task)
        if (i + 1) % 10 == 0:
            conn_so_far = sum(1 for rx in results[:i+1] if rx.connected)
            print(f"  [{i+1:3d}/{n}] spawned  (connected: {conn_so_far})")

    try:
        await asyncio.wait_for(
            asyncio.gather(*tasks, return_exceptions=True),
            timeout=ARGS.timeout,
        )
    except asyncio.TimeoutError:
        print(f"\n[!] Timeout ({ARGS.timeout}s) — cancelling remaining tasks")
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    elapsed = time.perf_counter() - t_start

    if server_task:
        server_task.cancel()
        try:
            await server_task
        except (asyncio.CancelledError, Exception):
            pass

    # ── Metrics ────────────────────────────────────────────────────────────
    connected  = sum(1 for r in results if r.connected)
    logged_in  = sum(1 for r in results if r.login_ok)
    total_sub  = sum(r.shares_submitted for r in results)
    total_acc  = sum(r.shares_accepted  for r in results)
    total_err  = sum(r.errors           for r in results)
    all_lat    = sorted([lat for r in results for lat in r.latencies_ms])

    acc_rate   = (total_acc / total_sub * 100) if total_sub else 0
    tps        = total_acc / elapsed if elapsed > 0 else 0

    if all_lat:
        lat_min = all_lat[0]
        lat_max = all_lat[-1]
        lat_avg = statistics.mean(all_lat)
        lat_med = statistics.median(all_lat)
        lat_p95 = all_lat[max(0, int(len(all_lat) * 0.95) - 1)]
        lat_p99 = all_lat[max(0, int(len(all_lat) * 0.99) - 1)]
    else:
        lat_min = lat_max = lat_avg = lat_med = lat_p95 = lat_p99 = 0.0

    print(f"\n{'='*62}")
    print(f"  RESULTS")
    print(f"{'='*62}")
    print(f"  Duration          : {elapsed:.2f}s")
    print(f"  Connected         : {connected}/{n}  ({connected/n*100:.1f}%)")
    print(f"  Logged in         : {logged_in}/{n}  ({logged_in/n*100:.1f}%)")
    print(f"  Shares submitted  : {total_sub}")
    print(f"  Shares accepted   : {total_acc}  ({acc_rate:.1f}%)")
    print(f"  Errors            : {total_err}")
    print(f"  Throughput        : {tps:.1f} accepted shares/s")
    print(f"  Latency (ms)      : min={lat_min:.1f}  avg={lat_avg:.1f}  med={lat_med:.1f}")
    print(f"                      p95={lat_p95:.1f}  p99={lat_p99:.1f}  max={lat_max:.1f}")
    print(f"{'='*62}")

    ok = True
    conn_pct = connected / n * 100
    if conn_pct < 95:
        print(f"  ❌  Connections {conn_pct:.1f}% < 95%")
        ok = False
    else:
        print(f"  ✅  Connections {conn_pct:.1f}% ≥ 95%")

    if acc_rate < 90:
        print(f"  ❌  Accept rate {acc_rate:.1f}% < 90%")
        ok = False
    else:
        print(f"  ✅  Accept rate {acc_rate:.1f}% ≥ 90%")

    if lat_p99 > 1000:
        print(f"  ❌  p99 latency {lat_p99:.0f}ms > 1000ms")
        ok = False
    else:
        print(f"  ✅  p99 latency {lat_p99:.0f}ms ≤ 1000ms")

    verdict = "PASS ✓" if ok else "FAIL ✗"
    print(f"\n  {'='*58}")
    print(f"  PHASE 1.12  {verdict}")
    print(f"  {'='*58}\n")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
