#!/usr/bin/env python3
"""
ZION V3 GPU Miner — Ekam Deeksha via PyOpenCL
Speaks V3 pool protocol (PoolMessage JSON lines).
"""
from __future__ import annotations

import json
import os
import socket
import struct
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Optional, Tuple

# Ensure mining modules are importable
_HERE = Path(__file__).resolve().parent
_MINING = _HERE / "mining"
for p in (_HERE, _MINING, str(_MINING)):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

# ---------------------------------------------------------------------------
# GPU backend (Ekam Deeksha OpenCL)
# ---------------------------------------------------------------------------
_gpu: object = None
_gpu_name: str = "none"
_gpu_batch: int = 2048

try:
    from cosmic_harmony_v42_gpu import CHv42GPU
    _gpu = CHv42GPU(backend="auto", batch_size=2048)
    _gpu_name = _gpu.backend_name
    _gpu_batch = _gpu.batch_size
    print(f"[V3-GPU] GPU backend: {_gpu_name} (batch={_gpu_batch})", flush=True)
except Exception as e:
    print(f"[V3-GPU] GPU not available: {e}", flush=True)

# ---------------------------------------------------------------------------
# CPU hash via native FFI (fallback)
# ---------------------------------------------------------------------------
_native_hash = None
try:
    from cosmic_harmony_deeksha_fallback import _native, ensure_native_ffi
    if ensure_native_ffi():
        _native_hash = _native.hash
        print("[V3-GPU] CPU native FFI: ready", flush=True)
    else:
        print("[V3-GPU] CPU native FFI: not available", flush=True)
except Exception as e:
    print(f"[V3-GPU] CPU native FFI import failed: {e}", flush=True)

# Pure Python CPU hash (last resort)
_py_hash = None
try:
    from cosmic_harmony_deeksha_fallback import hash_deeksha
    _py_hash = hash_deeksha
except Exception:
    pass

# ---------------------------------------------------------------------------
# V3 Pool Protocol
# ---------------------------------------------------------------------------
class V3Pool:
    """V3 pool client speaking PoolMessage JSON-lines protocol."""

    def __init__(self, host: str, port: int, miner_id: str, worker: str, algo: str):
        self.host = host
        self.port = port
        self.miner_id = miner_id
        self.worker = worker
        self.algo = algo
        self._sock: Optional[socket.socket] = None
        self._buf = b""

    def connect(self) -> str:
        """Connect + Hello → Welcome. Returns protocol_version."""
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.settimeout(30.0)
        self._sock.connect((self.host, self.port))
        self._send({"type": "hello", "miner_id": self.miner_id,
                     "worker_name": self.worker, "algorithm": self.algo})
        welcome = self._recv()
        if welcome.get("type") != "welcome":
            raise RuntimeError(f"Expected welcome, got: {welcome}")
        return welcome.get("protocol_version", "?")

    def read_job(self) -> dict:
        """Block until next Job message (skips Stale/Cancel)."""
        while True:
            msg = self._recv()
            t = msg.get("type")
            if t == "job":
                return msg
            if t in ("stale", "cancel"):
                print(f"[V3-POOL] {t}: {msg}", flush=True)
                continue
            raise RuntimeError(f"Expected job, got: {msg}")

    def submit(self, job_id: int, nonce: int, hash_hex: str,
               attempted: int, elapsed_ms: int) -> dict:
        self._send({"type": "submit", "job_id": job_id,
                     "miner_id": self.miner_id, "worker_name": self.worker,
                     "nonce": nonce, "hash_hex": hash_hex,
                     "attempted_hashes": attempted, "elapsed_ms": elapsed_ms})
        return self._read_result()

    def no_solution(self, job_id: int, attempted: int, elapsed_ms: int) -> dict:
        self._send({"type": "no_solution", "job_id": job_id,
                     "miner_id": self.miner_id, "worker_name": self.worker,
                     "attempted_hashes": attempted, "elapsed_ms": elapsed_ms})
        return self._read_result()

    def _read_result(self) -> dict:
        while True:
            msg = self._recv()
            t = msg.get("type")
            if t == "result":
                return msg
            if t in ("stale", "cancel"):
                print(f"[V3-POOL] {t}: {msg}", flush=True)
                continue
            raise RuntimeError(f"Expected result, got: {msg}")

    def _send(self, msg: dict):
        data = json.dumps(msg, separators=(",", ":")) + "\n"
        self._sock.sendall(data.encode())

    def _recv(self) -> dict:
        while b"\n" not in self._buf:
            chunk = self._sock.recv(8192)
            if not chunk:
                raise ConnectionError("Pool disconnected")
            self._buf += chunk
        line, self._buf = self._buf.split(b"\n", 1)
        return json.loads(line)

    def close(self):
        if self._sock:
            try:
                self._sock.close()
            except OSError:
                pass
            self._sock = None


# ---------------------------------------------------------------------------
# Target helpers
# ---------------------------------------------------------------------------
def target_hex_to_u32(target_hex: str) -> int:
    """Convert 32-byte target hex to u32 for GPU kernel (first 4 bytes LE)."""
    b = bytes.fromhex(target_hex)
    return struct.unpack_from("<I", b)[0]


def hash_meets_target(hash_bytes: bytes, target_bytes: bytes) -> bool:
    """Full 32-byte comparison: hash <= target (byte-by-byte)."""
    return hash_bytes <= target_bytes


# ---------------------------------------------------------------------------
# CPU parallel scan (uses native FFI)
# ---------------------------------------------------------------------------
def cpu_scan_range(header: bytes, start_nonce: int, nonce_count: int,
                   target_bytes: bytes, height: int, threads: int) -> Optional[Tuple[int, bytes]]:
    """Parallel CPU scan using ThreadPoolExecutor."""
    hash_fn = _native_hash or _py_hash
    if hash_fn is None:
        return None

    found_event = threading.Event()
    result_box: list = []

    def scan_chunk(chunk_start: int, chunk_count: int):
        for i in range(chunk_count):
            if found_event.is_set():
                return
            nonce = chunk_start + i
            h = hash_fn(header, nonce, height)
            if hash_meets_target(h, target_bytes):
                found_event.set()
                result_box.append((nonce, h))
                return

    chunk_size = max(1, nonce_count // threads)
    futures = []
    with ThreadPoolExecutor(max_workers=threads) as pool:
        for t in range(threads):
            cs = start_nonce + t * chunk_size
            cc = chunk_size if t < threads - 1 else (nonce_count - t * chunk_size)
            if cc <= 0:
                break
            futures.append(pool.submit(scan_chunk, cs, cc))
        for f in as_completed(futures):
            f.result()

    return result_box[0] if result_box else None


# ---------------------------------------------------------------------------
# GPU batch scan
# ---------------------------------------------------------------------------
def gpu_scan_range(header: bytes, start_nonce: int, nonce_count: int,
                   target_u32: int, target_bytes: bytes,
                   height: int) -> Tuple[Optional[Tuple[int, bytes]], int]:
    """Scan nonce range with GPU in batches. Returns (solution, hashes_done)."""
    if _gpu is None:
        return (None, 0)

    batch = _gpu_batch
    hashes = 0
    offset = 0

    while offset < nonce_count:
        this_batch = min(batch, nonce_count - offset)
        nonce_base = start_nonce + offset
        result = _gpu.mine(header, nonce_base, this_batch, target_u32)
        hashes += this_batch
        offset += this_batch

        if result is not None:
            nonce, h = result
            # Verify against full target
            if hash_meets_target(h, target_bytes):
                return ((nonce, h), hashes)
            # GPU found partial match but CPU verify failed — continue
    return (None, hashes)


# ---------------------------------------------------------------------------
# Telemetry
# ---------------------------------------------------------------------------
class Telemetry:
    def __init__(self):
        self.total_hashes: int = 0
        self.accepted: int = 0
        self.rejected: int = 0
        self.start_time = time.monotonic()
        self._windows = {10: [], 60: [], 900: []}  # (timestamp, hashes)
        self.best_hashrate: float = 0

    def record_hashes(self, count: int):
        now = time.monotonic()
        self.total_hashes += count
        for w in self._windows.values():
            w.append((now, count))

    def hashrate(self, window_sec: int) -> float:
        now = time.monotonic()
        w = self._windows.get(window_sec, [])
        cutoff = now - window_sec
        # Prune old entries
        while w and w[0][0] < cutoff:
            w.pop(0)
        if not w:
            return 0.0
        total = sum(h for _, h in w)
        span = now - w[0][0] if len(w) > 1 else window_sec
        return total / max(span, 0.001)

    def overall_hashrate(self) -> float:
        elapsed = time.monotonic() - self.start_time
        return self.total_hashes / max(elapsed, 0.001)

    def print_status(self, height: int = 0, job_id: int = 0):
        h10 = self.hashrate(10)
        h60 = self.hashrate(60)
        h15m = self.hashrate(900)
        h_all = self.overall_hashrate()
        self.best_hashrate = max(self.best_hashrate, h10, h60)
        gpu_tag = f" [{_gpu_name}]" if _gpu_name != "none" else ""
        ts = time.strftime("%H:%M:%S")

        # XMRig-compatible speed line (parsed by desktop agent)
        print(f"[{ts}] speed 10s/60s/15m {_fmt(h10)} {_fmt(h60)} {_fmt(h15m)} H/s max {_fmt(self.best_hashrate)} H/s{gpu_tag}", flush=True)
        # V3 session status line (also parsed by desktop agent)
        total = self.accepted + self.rejected
        pct = (self.accepted / total * 100) if total > 0 else 100.0
        print(f"[{ts}] session_status height={height} accepted={self.accepted} rejected={self.rejected} "
              f"hashrate_10s={_fmt(h10)} hashrate_60s={_fmt(h60)} hashrate_15m={_fmt(h15m)} "
              f"hashrate_overall={_fmt(h_all)} best_ms=0 gpu={_gpu_name}", flush=True)


def _fmt(h: float) -> str:
    if h >= 1e6:
        return f"{h/1e6:.2f} MH/s"
    if h >= 1e3:
        return f"{h/1e3:.2f} kH/s"
    return f"{h:.2f}"


# ---------------------------------------------------------------------------
# Main mining loop
# ---------------------------------------------------------------------------
def main():
    import argparse
    p = argparse.ArgumentParser(description="ZION V3 GPU Miner")
    p.add_argument("--pool", required=True, help="host:port")
    p.add_argument("--wallet", required=True)
    p.add_argument("--worker", default="v3-gpu-miner")
    p.add_argument("--threads", type=int, default=max(1, os.cpu_count() - 1))
    p.add_argument("--gpu", default="opencl", help="opencl | metal | off")
    p.add_argument("--algorithm", default="cosmic_harmony_ekam_deeksha_v2")
    args = p.parse_args()

    host, port_str = args.pool.rsplit(":", 1)
    port = int(port_str)

    print("=" * 60, flush=True)
    print("  ZION V3 GPU Miner — Ekam Deeksha", flush=True)
    print(f"  Pool:    {args.pool}", flush=True)
    print(f"  Wallet:  {args.wallet}", flush=True)
    print(f"  Worker:  {args.worker}", flush=True)
    print(f"  Threads: {args.threads} CPU | GPU: {_gpu_name}", flush=True)
    print("=" * 60, flush=True)

    stats_interval = int(os.environ.get("ZION_METRICS_REPORT_SECS", "10"))
    telemetry = Telemetry()

    reconnect_delay = 2
    while True:
        pool_conn = V3Pool(host, port, args.wallet, args.worker, args.algorithm)
        try:
            proto = pool_conn.connect()
            print(f"[V3-POOL] Connected: {proto}", flush=True)
            reconnect_delay = 2

            last_status_time = time.monotonic()
            iteration = 0

            while True:
                job = pool_conn.read_job()
                job_id = job["job_id"]
                header_hex = job["header_hex"]
                target_hex = job["target_hex"]
                start_nonce = job["start_nonce"]
                nonce_count = job["nonce_count"]
                height = job["height"]

                header = bytes.fromhex(header_hex)
                target_bytes = bytes.fromhex(target_hex)
                target_u32 = target_hex_to_u32(target_hex)

                ts = time.strftime("%H:%M:%S")
                print(f"[{ts}] new job  height {height}  nonces {start_nonce}..{start_nonce + nonce_count}  algo cosmic_harmony_ekam_deeksha", flush=True)

                t0 = time.monotonic()

                # Try GPU first
                solution = None
                gpu_hashes = 0
                if _gpu is not None and args.gpu != "off":
                    solution, gpu_hashes = gpu_scan_range(
                        header, start_nonce, nonce_count, target_u32, target_bytes, height)
                    telemetry.record_hashes(gpu_hashes)

                # CPU fallback for remaining range (or full range if no GPU)
                if solution is None and (_native_hash or _py_hash):
                    cpu_start = start_nonce + gpu_hashes
                    cpu_count = nonce_count - gpu_hashes
                    if cpu_count > 0:
                        solution = cpu_scan_range(
                            header, cpu_start, cpu_count, target_bytes, height, args.threads)
                        telemetry.record_hashes(cpu_count)

                elapsed_ms = int((time.monotonic() - t0) * 1000)
                iteration += 1

                if solution is not None:
                    nonce, h = solution
                    result = pool_conn.submit(
                        job_id, nonce, h.hex(), nonce_count, elapsed_ms)
                    accepted = result.get("accepted", False)
                    status = result.get("status", "?")
                    if accepted:
                        telemetry.accepted += 1
                        total = telemetry.accepted + telemetry.rejected
                        pct = telemetry.accepted / total * 100
                        print(f"[{ts}] accepted {telemetry.accepted}/{telemetry.rejected} (+1) diff {height} [{elapsed_ms}ms] ({pct:.1f}%)", flush=True)
                    else:
                        telemetry.rejected += 1
                        total = telemetry.accepted + telemetry.rejected
                        print(f"[{ts}] rejected {telemetry.rejected}/{total} — {status} ({elapsed_ms} ms)", flush=True)
                else:
                    result = pool_conn.no_solution(
                        job_id, nonce_count, elapsed_ms)
                    accepted = result.get("accepted", False)
                    if accepted:
                        telemetry.accepted += 1

                # Periodic status report
                now = time.monotonic()
                if now - last_status_time >= stats_interval:
                    telemetry.print_status(height, job_id)
                    last_status_time = now

        except KeyboardInterrupt:
            print("\n[V3-GPU] Stopping...", flush=True)
            pool_conn.close()
            break
        except Exception as e:
            print(f"[V3-GPU] Error: {e} — reconnecting in {reconnect_delay}s", flush=True)
            pool_conn.close()
            time.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, 30)


if __name__ == "__main__":
    main()
