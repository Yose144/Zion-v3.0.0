#!/usr/bin/env python3
"""
H5 — AuxPoW E2E smoke test.

Starts a local mock upstream CryptonoteStratum server (Monero/RandomX),
a local zion-pool bridge, and a CPU-only zion-miner. The goal is to observe at
least one AuxPoW share forwarded from the miner → local pool → mock upstream
within a short timeout.

Requires:
  - V31 zion-node running on 127.0.0.1:8446 (or override with --l1-rpc).
  - V31 zion-pool and zion-miner release binaries in V31/target/release.
    The miner binary must be built with the `native-randomx` feature so it
    can hash RandomX shares.

Usage:
  python3 scripts/ops/auxpow_e2e_test.py --timeout 180
"""

import argparse
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path


def get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def send_line(sock: socket.socket, obj: dict) -> None:
    line = json.dumps(obj) + "\n"
    sock.sendall(line.encode())


class MockUpstreamCryptonote(threading.Thread):
    """Minimal Monero/CryptonoteStratum server for RandomX (Stream 3 CPU)."""

    def __init__(self, port: int):
        super().__init__(daemon=True)
        self.port = port
        self.shares: list[dict] = []
        self._stop = threading.Event()
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server.bind(("127.0.0.1", port))
        self.server.listen(1)

    def _job(self, job_id: str) -> dict:
        # Monero mining blob is 76 bytes (152 hex chars); all-zero is fine for E2E.
        blob = "0" * 152
        # Max 32-bit target => every RandomX hash is a valid share locally.
        target = "ffffffff"
        return {
            "id": None,
            "method": "job",
            "params": {
                "blob": blob,
                "job_id": job_id,
                "target": target,
                "height": 1234567,
                "algo": "rx/0",
            },
        }

    def run(self) -> None:
        self.server.settimeout(1.0)
        try:
            while not self._stop.is_set():
                try:
                    conn, _ = self.server.accept()
                except (socket.timeout, OSError):
                    continue
                conn.settimeout(0.5)
                handler = threading.Thread(
                    target=self._handle_client, args=(conn,), daemon=True
                )
                handler.start()
        finally:
            try:
                self.server.close()
            except Exception:
                pass

    def _handle_client(self, conn: socket.socket) -> None:
        try:
            buf = b""
            logged_in = False
            while not self._stop.is_set():
                try:
                    data = conn.recv(4096)
                except socket.timeout:
                    continue
                if not data:
                    break
                buf += data
                while b"\n" in buf:
                    line, _, buf = buf.partition(b"\n")
                    try:
                        msg = json.loads(line.decode("utf-8", "ignore"))
                    except json.JSONDecodeError:
                        continue
                    self._handle_message(conn, msg)
                    if not logged_in and msg.get("method") == "login":
                        logged_in = True
                        send_line(conn, self._job("job1"))
        except Exception as e:
            print(f"[mock] client handler error: {e}", file=sys.stderr)
        finally:
            try:
                conn.close()
            except Exception:
                pass

    def _handle_message(self, conn: socket.socket, msg: dict) -> None:
        method = msg.get("method")
        msg_id = msg.get("id")
        if method == "login":
            send_line(
                conn,
                {
                    "id": msg_id,
                    "result": {
                        "id": "session1",
                        "job": {
                            "blob": "0" * 152,
                            "job_id": "job1",
                            "target": "ffffffff",
                            "height": 1234567,
                            "algo": "rx/0",
                        },
                        "status": "OK",
                    },
                    "error": None,
                },
            )
        elif method == "submit":
            self.shares.append(msg)
            send_line(conn, {"id": msg_id, "result": {"status": "OK"}, "error": None})
        else:
            send_line(conn, {"id": msg_id, "result": True, "error": None})

    def stop(self) -> None:
        self._stop.set()
        try:
            self.server.close()
        except Exception:
            pass


def wait_for_log(path: Path, pattern: str, timeout: float) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if path.exists():
            text = path.read_text(errors="ignore")
            if re.search(pattern, text):
                return True
        time.sleep(0.5)
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument("--l1-rpc", default="http://127.0.0.1:8446")
    parser.add_argument("--pool-bin", default=str(Path(__file__).parents[2] / "V31" / "target" / "release" / "zion-pool"))
    parser.add_argument("--miner-bin", default=str(Path(__file__).parents[2] / "V31" / "target" / "release" / "zion-miner"))
    args = parser.parse_args()

    tmpdir = Path(tempfile.mkdtemp(prefix="auxpow_e2e_"))
    upstream_port = get_free_port()
    pool_port = get_free_port()
    api_port = get_free_port()

    print(f"[e2e] tmpdir={tmpdir}")
    print(f"[e2e] upstream=127.0.0.1:{upstream_port}")
    print(f"[e2e] pool=127.0.0.1:{pool_port}")
    print(f"[e2e] l1_rpc={args.l1_rpc}")

    upstream = MockUpstreamCryptonote(upstream_port)
    upstream.start()

    env = os.environ.copy()
    env["RUST_LOG"] = "info"
    env["ZION_POOL_AUXPOW_COINS"] = "XMR"
    env["ZION_POOL_AUXPOW_WALLET_XMR"] = "44AFFq5kSiGBoZ4NMDk5ZV6Xz21K8W5wS8oV5mY5Xy8g9V9J1wS7oJ1wS7oJ1wS7oJ1wS7oJ1wS7oJ1wS7oJ1wS7oJ1wS7"
    env["ZION_POOL_AUXPOW_POOL_XMR"] = f"127.0.0.1:{upstream_port}"
    env["ZION_POOL_AUXPOW_WORKER"] = "auxpow-e2e"
    env["ZION_POOL_AUXPOW_PASSWORD"] = "x"

    pool_log = tmpdir / "pool.log"
    pool_proc = subprocess.Popen(
        [
            args.pool_bin,
            "--bind", f"127.0.0.1:{pool_port}",
            "--l1-rpc-url", args.l1_rpc,
            "--api-bind", f"127.0.0.1:{api_port}",
            "--state-path", str(tmpdir / "pool.json"),
            "--miner-address", "zion1auxpowtest",
        ],
        env=env,
        stdout=open(pool_log, "w"),
        stderr=subprocess.STDOUT,
    )

    try:
        print("[e2e] waiting for pool to bind...")
        if not wait_for_log(pool_log, r"API listening|pool API listening|Listening on", 30.0):
            print("[e2e] pool did not start in time", file=sys.stderr)
            print(pool_log.read_text(errors="ignore")[-2000:], file=sys.stderr)
            return 1

        miner_env = os.environ.copy()
        miner_env["RUST_LOG"] = "info"
        miner_env["ZION_GPU_BACKEND"] = "cpu"
        miner_env["ZION_STREAM1_ENABLED"] = "0"  # Mine only AuxPoW to reduce CPU noise.
        miner_env["ZION_STREAM2_ENABLED"] = "0"
        miner_env["ZION_STREAM3_ENABLED"] = "1"
        miner_env["ZION_MINER_CPU_COIN"] = "XMR"
        miner_env["ZION_INTERACTIVE"] = "0"
        miner_env["ZION_MINER_THREADS"] = "1"

        miner_log = tmpdir / "miner.log"
        miner_proc = subprocess.Popen(
            [
                args.miner_bin,
                "--pool", f"127.0.0.1:{pool_port}",
                "--wallet", "zion1auxpowtest",
                "--worker", "auxpow-e2e",
                "--gpu", "cpu",
                "--v3-trinity",
                "--no-zion",
                "--no-gpu",
                "--no-tui",
                "--threads", "1",
                "--log-interval", "5",
                "--watchdog-timeout", "0",
            ],
            env=miner_env,
            stdout=open(miner_log, "w"),
            stderr=subprocess.STDOUT,
        )

        deadline = time.time() + args.timeout
        success = False
        while time.time() < deadline:
            if upstream.shares:
                success = True
                break
            if pool_proc.poll() is not None or miner_proc.poll() is not None:
                break
            time.sleep(1.0)

        print("[e2e] shares received from upstream mock:", len(upstream.shares))
        if success:
            print("[e2e] PASS: AuxPoW share bridged miner → pool → upstream")
            for sh in upstream.shares[:3]:
                print("[e2e] share:", sh.get("params"))
            return 0
        else:
            print("[e2e] FAIL: no upstream share within timeout", file=sys.stderr)
            print("\n--- pool log tail ---", file=sys.stderr)
            print(pool_log.read_text(errors="ignore")[-2000:], file=sys.stderr)
            print("\n--- miner log tail ---", file=sys.stderr)
            print(miner_log.read_text(errors="ignore")[-2000:], file=sys.stderr)
            return 1
    finally:
        print("[e2e] cleaning up...")
        for proc in (pool_proc,):
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
        if 'miner_proc' in dir():
            if miner_proc.poll() is None:
                miner_proc.terminate()
                try:
                    miner_proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    miner_proc.kill()
        upstream.stop()
        upstream.join(timeout=2)
        print(f"[e2e] logs preserved at {tmpdir}")


if __name__ == "__main__":
    sys.exit(main())
