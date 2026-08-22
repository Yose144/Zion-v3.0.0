#!/usr/bin/env python3
"""
H5 — AuxPoW E2E smoke test.

Starts a local mock upstream stratum server (Decred/Blake3, standard stratum),
a local zion-pool bridge, and a CPU-only zion-miner. The goal is to observe at
least one AuxPoW share forwarded from the miner → local pool → mock upstream
within a short timeout.

Requires:
  - V31 zion-node running on 127.0.0.1:8446 (or override with --l1-rpc).
  - V31 zion-pool and zion-miner release binaries in V31/target/release.

Usage:
  python3 scripts/ops/auxpow_e2e_test.py --timeout 120
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


class MockUpstreamStratum(threading.Thread):
    """Minimal standard-stratum server for Decred (Blake3).

    Sends an easy job after subscribe+authorize and accepts any share.
    """

    def __init__(self, port: int):
        super().__init__(daemon=True)
        self.port = port
        self.shares: list[dict] = []
        self._stop = threading.Event()
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server.bind(("127.0.0.1", port))
        self.server.listen(1)

    def run(self) -> None:
        self.server.settimeout(1.0)
        try:
            while not self._stop.is_set():
                try:
                    conn, _ = self.server.accept()
                except socket.timeout:
                    continue
                conn.settimeout(0.5)
                handler = threading.Thread(
                    target=self._handle_client, args=(conn,), daemon=True
                )
                handler.start()
        finally:
            self.server.close()

    def _handle_client(self, conn: socket.socket) -> None:
        try:
            buf = b""
            subscribed = False
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
                    if not subscribed and msg.get("method") == "mining.subscribe":
                        subscribed = True
                        # Easy target: 0x1d00ffff scaled to share target ~ max.
                        send_line(
                            conn,
                            {
                                "id": None,
                                "method": "mining.set_difficulty",
                                "params": [1.0],
                            },
                        )
                        send_line(
                            conn,
                            {
                                "id": None,
                                "method": "mining.notify",
                                "params": [
                                    "job1",
                                    "0000000000000000000000000000000000000000000000000000000000000000",
                                    "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff200208620101",
                                    "01000000000000000000000000000000000000000000000000000000000000000000000000",
                                    [],
                                    "01000000",
                                    "1d00ffff",
                                    "686f6e67",
                                    True,
                                ],
                            },
                        )
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
        if method == "mining.subscribe":
            send_line(
                conn,
                {
                    "id": msg_id,
                    "result": ["s1", "00000000000000000000000000000000", 4],
                    "error": None,
                },
            )
        elif method == "mining.authorize":
            send_line(conn, {"id": msg_id, "result": True, "error": None})
        elif method == "mining.submit":
            self.shares.append(msg)
            send_line(conn, {"id": msg_id, "result": True, "error": None})
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
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--l1-rpc", default="http://127.0.0.1:8446")
    parser.add_argument("--pool-bin", default=str(Path(__file__).parents[2] / "V31" / "target" / "release" / "zion-pool"))
    parser.add_argument("--miner-bin", default=str(Path(__file__).parents[2] / "V31" / "target" / "release" / "zion-miner"))
    args = parser.parse_args()

    repo_root = Path(__file__).parents[2]
    tmpdir = Path(tempfile.mkdtemp(prefix="auxpow_e2e_"))
    upstream_port = get_free_port()
    pool_port = get_free_port()
    api_port = get_free_port()

    print(f"[e2e] tmpdir={tmpdir}")
    print(f"[e2e] upstream=127.0.0.1:{upstream_port}")
    print(f"[e2e] pool=127.0.0.1:{pool_port}")
    print(f"[e2e] l1_rpc={args.l1_rpc}")

    upstream = MockUpstreamStratum(upstream_port)
    upstream.start()

    env = os.environ.copy()
    env["RUST_LOG"] = "info"
    env["ZION_POOL_AUXPOW_COINS"] = "DCR"
    env["ZION_POOL_AUXPOW_WALLET_DCR"] = "DsUbTWsZKHjbZhZTPLR9HkwxQ2fbZJuoDd"
    env["ZION_POOL_AUXPOW_POOL_DCR"] = f"127.0.0.1:{upstream_port}"
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
        miner_env["ZION_STREAM1_ENABLED"] = "1"
        miner_env["ZION_STREAM2_ENABLED"] = "0"
        miner_env["ZION_STREAM3_ENABLED"] = "1"
        miner_env["ZION_MINER_CPU_COIN"] = "DCR"
        miner_env["ZION_INTERACTIVE"] = "0"
        miner_env["ZION_MINER_THREADS"] = "2"

        miner_log = tmpdir / "miner.log"
        miner_proc = subprocess.Popen(
            [
                args.miner_bin,
                "--pool", f"127.0.0.1:{pool_port}",
                "--wallet", "zion1auxpowtest",
                "--worker", "auxpow-e2e",
                "--gpu", "cpu",
                "--v3-trinity",
                "--no-gpu",
                "--no-tui",
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
        for p in (pool_proc,):
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    p.kill()
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
