#!/usr/bin/env python3
"""ZION Pool Algorithm Smoketest Runner

Connects to a running pool, requests jobs for the specified algorithms, attempts to
find at least one valid share using the native hashing stack, and reports results.

Usage example:
    python scripts/mining/algo_smoketest.py \
        --pool-host 127.0.0.1 --pool-port 3333 \
        --wallet zion1yourwalletaddress --worker smoketest \
        --algos cosmic_harmony,randomx,yescrypt,autolykos_v2 \
        --max-seconds 180 --max-nonces 75000

Notes:
- Difficulty should be kept low on the target pool (e.g. POOL_BASE_DIFFICULTY
  set to ~10_000) to ensure the script can find a valid share quickly.
- The script uses the XMRig-style login flow and therefore works for both
  native miner compatibility and third-party miners like SRBMiner.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import secrets
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

# Ensure project root is on sys.path when running as a standalone script
ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.miner.network import MiningJob, PoolClient
from src.core import algorithms as core_algorithms


@dataclass
class AlgoResult:
    algorithm: str
    attempts: int = 0
    accepted: int = 0
    rejected: int = 0
    duration: float = 0.0
    status: str = "pending"
    last_error: Optional[str] = None
    difficulty: Optional[int] = None


class AlgoSmoketestRunner:
    """Runs a limited mining session for a single algorithm."""

    def __init__(
        self,
        host: str,
        port: int,
        wallet: str,
        worker: str,
        algorithm: str,
        protocol: str = "xmrig",
        max_seconds: int = 180,
        max_nonce_attempts: int = 100_000,
        target_shares: int = 1,
    ) -> None:
        self.algorithm = algorithm
        self.max_seconds = max_seconds
        self.max_nonce_attempts = max_nonce_attempts
        self.target_shares = target_shares

        self.client = PoolClient(
            host=host,
            port=port,
            wallet=wallet,
            worker=f"{worker}.{algorithm}",
            algorithm=algorithm,
            protocol=protocol,
        )

        self.client.on_job_callback = self._handle_job
        self.result = AlgoResult(algorithm=algorithm)

        self._stop_event = asyncio.Event()
        self._current_task: Optional[asyncio.Task] = None

    async def run(self) -> AlgoResult:
        start_time = time.time()
        try:
            ok = await self.client.start()
            if not ok:
                self.result.status = "connection-failed"
                self.result.last_error = "Unable to start pool client"
                return self.result

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.max_seconds)
            except asyncio.TimeoutError:
                self.result.status = "timeout"
                self.result.last_error = f"No accepted share within {self.max_seconds}s"
            finally:
                await self.client.stop()
        finally:
            self.result.duration = time.time() - start_time
            self.result.accepted = self.client.shares_accepted
            self.result.rejected = self.client.shares_rejected

            if self.result.accepted >= self.target_shares:
                self.result.status = "accepted"
            elif self.result.status == "pending":
                self.result.status = "incomplete"

            if self._current_task and not self._current_task.done():
                self._current_task.cancel()

        return self.result

    async def _handle_job(self, job: MiningJob) -> None:
        if not job.blob:
            self.result.last_error = "Job blob missing"
            return

        print(f"📦 Received job: {job.job_id} | algo={job.algorithm} | diff={job.difficulty} | target={job.target}")
        self.result.difficulty = job.difficulty

        if self._current_task and not self._current_task.done():
            self._current_task.cancel()

        self._current_task = asyncio.create_task(self._mine_job(job))

    async def _mine_job(self, job: MiningJob) -> None:
        # Target is little-endian hex string from pool
        target_bytes = bytes.fromhex(job.target)
        target_int = int.from_bytes(target_bytes, "little")
        nonce = secrets.randbits(32)
        attempts = 0
        
        print(f"⛏️  Mining job {job.job_id} | target_int={target_int} | max_attempts={self.max_nonce_attempts}")

        while attempts < self.max_nonce_attempts and not self._stop_event.is_set():
            nonce &= 0xFFFFFFFF
            blob = _apply_nonce(job.blob, nonce)

            try:
                hash_hex = core_algorithms.get_hash(job.algorithm, blob, nonce)
            except Exception as exc:  # pragma: no cover - runtime safeguard
                self.result.last_error = f"Hash error: {exc}"
                print(f"❌ Hash error: {exc}")
                return

            # Compare first 8 bytes of hash (little-endian) with target
            hash_bytes = bytes.fromhex(hash_hex)
            hash_int = int.from_bytes(hash_bytes[:8], "little")
            
            if attempts % 10000 == 0:
                print(f"⛏️  Attempt {attempts} | hash_int={hash_int} | target={target_int} | ratio={hash_int/target_int:.2f}")
            
            if hash_int <= target_int:
                prev_acc = self.client.shares_accepted
                prev_rej = self.client.shares_rejected

                submitted = await self.client.submit_share(
                    job_id=job.job_id,
                    nonce=f"{nonce:08x}",
                    result=hash_hex,
                )
                if not submitted:
                    self.result.last_error = "Submit failed"
                    return

                share_ok = await self._wait_for_share_result(prev_acc, prev_rej)
                if share_ok is True:
                    self._stop_event.set()
                    return
                if share_ok is False:
                    self.result.last_error = "Share rejected by pool"
                    return

            attempts += 1
            nonce = (nonce + 1) & 0xFFFFFFFF

        self.result.attempts += attempts

    async def _wait_for_share_result(self, prev_acc: int, prev_rej: int, timeout: int = 30) -> Optional[bool]:
        end_time = time.time() + timeout
        while time.time() < end_time:
            if self.client.shares_accepted > prev_acc:
                return True
            if self.client.shares_rejected > prev_rej:
                return False
            await asyncio.sleep(0.5)
        return None


def _apply_nonce(blob: bytes, nonce: int) -> bytes:
    if len(blob) < 43:
        raise ValueError("Blob too short to apply nonce")
    mutated = bytearray(blob)
    mutated[39:43] = nonce.to_bytes(4, "little")
    return bytes(mutated)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ZION algorithm smoketest runner")
    parser.add_argument("--pool-host", default=os.getenv("ZION_POOL_HOST", "127.0.0.1"))
    parser.add_argument("--pool-port", type=int, default=int(os.getenv("ZION_POOL_PORT", "3333")))
    parser.add_argument("--wallet", required=True, help="ZION wallet address for testing")
    parser.add_argument("--worker", default="smoketest", help="Worker name prefix")
    parser.add_argument(
        "--algos",
        default="cosmic_harmony,randomx,yescrypt,autolykos_v2",
        help="Comma-separated list of algorithms to test",
    )
    parser.add_argument("--protocol", choices=["xmrig", "stratum"], default="xmrig")
    parser.add_argument("--max-seconds", type=int, default=180)
    parser.add_argument("--max-nonces", type=int, default=100_000)
    parser.add_argument("--target-shares", type=int, default=1)
    return parser.parse_args()


def print_summary(results: List[AlgoResult]) -> None:
    print("\n=== ZION Algorithm Smoketest Summary ===")
    for res in results:
        status = res.status.upper()
        diff = res.difficulty or 0
        print(
            f"- {res.algorithm}: {status} | accepted={res.accepted} | "
            f"rejected={res.rejected} | attempts={res.attempts} | diff={diff} | "
            f"duration={res.duration:.1f}s"
        )
        if res.last_error:
            print(f"    last_error: {res.last_error}")


async def main_async() -> int:
    args = parse_args()
    algorithms = [a.strip().lower() for a in args.algos.split(",") if a.strip()]
    results: List[AlgoResult] = []

    for algo in algorithms:
        if not core_algorithms.is_available(algo):
            res = AlgoResult(
                algorithm=algo,
                status="unavailable",
                last_error="Algorithm not available in core registry",
            )
            results.append(res)
            continue

        runner = AlgoSmoketestRunner(
            host=args.pool_host,
            port=args.pool_port,
            wallet=args.wallet,
            worker=args.worker,
            algorithm=algo,
            protocol=args.protocol,
            max_seconds=args.max_seconds,
            max_nonce_attempts=args.max_nonces,
            target_shares=args.target_shares,
        )
        res = await runner.run()
        results.append(res)

    print_summary(results)
    # Exit with non-zero code if any algorithm failed outright
    failed = [r for r in results if r.status not in {"accepted", "unavailable"}]
    return 1 if failed else 0


def main() -> None:
    exit_code = asyncio.run(main_async())
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
