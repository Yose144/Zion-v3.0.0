#!/usr/bin/env python3
"""ZION v2.9.5 — Native (Rust) Pool E2E Test

Scope: Rust pool HTTP + Stratum + optional NCL.

What it proves:
- HTTP: /health, /stats, /metrics respond on native API port.
- Stratum: login returns a job; submit flow responds.
- NCL (optional but default): register/get_task/submit works and deterministic
  hash_chaining_v1 gets ACCEPTED.

Defaults match native deployments used in 2.9.5 docs:
- Stratum: 3333
- API:    8080

Exit code:
- 0 = PASS
- 1 = FAIL
"""

from __future__ import annotations

import argparse
import json
import socket
import sys
import time
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple


DEFAULT_REGIONS = {
    "Helsinki": {"host": "77.42.31.72", "stratum": 3333, "api": 8080},
    "USA": {"host": "5.78.145.234", "stratum": 3333, "api": 8080},
    "SG": {"host": "5.223.56.124", "stratum": 3333, "api": 8080},
}

DEFAULT_WALLET = "zion1e2enative000000000000000000000000000test"


@dataclass
class RegionTarget:
    name: str
    host: str
    stratum_port: int
    api_port: int


def http_get_json(url: str, timeout: int = 8) -> Dict[str, Any]:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        return json.loads(body)


def http_get_text(url: str, timeout: int = 8) -> str:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def stratum_send_recv(sock: socket.socket, msg: Dict[str, Any], timeout: float = 10.0) -> Dict[str, Any]:
    payload = json.dumps(msg) + "\n"
    sock.sendall(payload.encode("utf-8"))

    sock.settimeout(timeout)
    buf = sock.recv(65535).decode("utf-8", errors="replace").strip()
    # Server can send multiple JSON lines; pick the first valid JSON object.
    for line in buf.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue
    raise RuntimeError(f"No JSON response. Raw={buf!r}")


def test_http(region: RegionTarget) -> Tuple[bool, str]:
    base = f"http://{region.host}:{region.api_port}"

    health = http_get_json(f"{base}/health")
    if health.get("status") != "ok":
        return False, f"/health unexpected: {health}"

    _stats = http_get_json(f"{base}/stats")

    metrics = http_get_text(f"{base}/metrics")
    if "# TYPE" not in metrics and "prometheus" not in metrics.lower():
        return False, "/metrics did not look like Prometheus exposition"

    return True, "ok"


def test_stratum_login_and_submit(region: RegionTarget, wallet: str, worker: str) -> Tuple[bool, str]:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect((region.host, region.stratum_port))

    try:
        login = {
            "id": 1,
            "method": "login",
            "params": {"login": wallet, "pass": "x", "agent": f"e2e-native/2.9.5:{worker}"},
        }
        data = stratum_send_recv(sock, login)
        if data.get("result", {}).get("status") != "OK":
            return False, f"login failed: {data}"

        job = data.get("result", {}).get("job")
        if not job:
            return False, f"no job in login response: {data}"

        job_id = job.get("job_id")
        if not job_id:
            return False, f"job missing job_id: {job}"

        session_id = data.get("result", {}).get("id") or data.get("result", {}).get("session_id")
        if not session_id:
            return False, f"login missing session id: {data}"

        # Submit an intentionally invalid share; we only prove the submit flow responds.
        submit = {
            "id": 2,
            "method": "submit",
            "params": {
                "id": session_id,
                "job_id": job_id,
                "nonce": "deadbeef",
                "result": "0" * 64,
            },
        }
        resp = stratum_send_recv(sock, submit, timeout=10)
        # Accept either error or OK; we just need a well-formed response.
        if not isinstance(resp, dict) or ("result" not in resp and "error" not in resp):
            return False, f"submit response malformed: {resp}"

        return True, "ok"
    finally:
        try:
            sock.close()
        except Exception:
            pass


def blake3_chain(seed_hex: str, rounds: int) -> str:
    try:
        from blake3 import blake3  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "Missing python package 'blake3'. Install via: pip install blake3 "
            "(or run with --skip-ncl)."
        ) from e

    seed_hex = seed_hex.strip().lower().removeprefix("0x")
    state = bytes.fromhex(seed_hex)
    if len(state) != 32:
        raise ValueError(f"seed must be 32 bytes hex, got {len(state)}")

    for _ in range(int(rounds)):
        state = blake3(state).digest()
    return state.hex()


def test_ncl(region: RegionTarget, wallet: str, worker: str, allocation: float) -> Tuple[bool, str]:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    sock.connect((region.host, region.stratum_port))

    try:
        # Login first (NCL handlers require Authenticated)
        login = {
            "id": 1,
            "method": "login",
            "params": {"login": wallet, "pass": "x", "agent": f"e2e-native-ncl/2.9.5:{worker}"},
        }
        data = stratum_send_recv(sock, login)
        if data.get("result", {}).get("status") != "OK":
            return False, f"login failed: {data}"

        # Register
        reg = {
            "id": 10,
            "jsonrpc": "2.0",
            "method": "ncl.register",
            "params": {
                "version": "1.0",
                "npu_type": "cpu",
                "npu_tflops": 0.5,
                "allocation": allocation,
                "supported_task_types": ["hash_chaining_v1"],
            },
        }
        reg_resp = stratum_send_recv(sock, reg)
        if "error" in reg_resp:
            return False, f"ncl.register error: {reg_resp}"

        # Get task
        get_task = {"id": 11, "jsonrpc": "2.0", "method": "ncl.get_task", "params": {}}
        task_resp = stratum_send_recv(sock, get_task)
        if "error" in task_resp:
            return False, f"ncl.get_task error: {task_resp}"

        result = task_resp.get("result") or {}
        task = result.get("task") or result  # tolerate either shape

        task_id = task.get("task_id")
        task_type = task.get("task_type")
        if not task_id or not task_type:
            return False, f"ncl.get_task missing task_id/task_type: {task_resp}"

        if task_type != "hash_chaining_v1":
            return False, f"unexpected task_type={task_type} (expected hash_chaining_v1)"

        verification = task.get("verification") or {}
        payload = task.get("payload") or {}

        seed = verification.get("seed") or payload.get("seed")
        rounds = verification.get("rounds") or payload.get("rounds")
        expected = verification.get("expected")
        method = verification.get("method")

        if not expected or not seed or rounds is None:
            return False, f"task missing required fields (expected/seed/rounds). task={task}"

        if method and str(method) not in {"blake3_chain", "blake3_chain_v1", "blake3"}:
            return False, f"unsupported verification method={method!r}"

        computed = blake3_chain(seed, int(rounds))
        if computed != str(expected).lower().removeprefix("0x"):
            return False, "computed result does not match expected (contract mismatch)"

        submit = {
            "id": 12,
            "jsonrpc": "2.0",
            "method": "ncl.submit",
            "params": {
                "version": "1.0",
                "task_id": task_id,
                "result": computed,
                "result_hash": computed,  # backward compat
                "compute_time_ms": 1,
            },
        }
        submit_resp = stratum_send_recv(sock, submit)
        if "error" in submit_resp:
            return False, f"ncl.submit error: {submit_resp}"

        status = (submit_resp.get("result") or {}).get("status")
        if status != "accepted":
            return False, f"ncl.submit not accepted: {submit_resp}"

        # Optional: status endpoint
        ncl_status = {"id": 13, "jsonrpc": "2.0", "method": "ncl.status", "params": {}}
        _ = stratum_send_recv(sock, ncl_status)

        return True, "ok"

    finally:
        try:
            sock.close()
        except Exception:
            pass


def run_for_region(region: RegionTarget, wallet: str, worker: str, skip_ncl: bool, allocation: float) -> bool:
    ok_http, msg_http = test_http(region)
    if not ok_http:
        print(f"❌ {region.name}: HTTP FAIL — {msg_http}")
        return False
    print(f"✅ {region.name}: HTTP OK")

    ok_stratum, msg_stratum = test_stratum_login_and_submit(region, wallet, worker)
    if not ok_stratum:
        print(f"❌ {region.name}: STRATUM FAIL — {msg_stratum}")
        return False
    print(f"✅ {region.name}: STRATUM OK")

    if not skip_ncl:
        ok_ncl, msg_ncl = test_ncl(region, wallet, worker, allocation)
        if not ok_ncl:
            print(f"❌ {region.name}: NCL FAIL — {msg_ncl}")
            return False
        print(f"✅ {region.name}: NCL OK")
    else:
        print(f"⏭️  {region.name}: NCL skipped")

    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--region", choices=list(DEFAULT_REGIONS.keys()) + ["ALL"], default="ALL")
    parser.add_argument("--wallet", default=DEFAULT_WALLET)
    parser.add_argument("--worker", default="e2e-native")
    parser.add_argument("--skip-ncl", action="store_true")
    parser.add_argument("--ncl-allocation", type=float, default=0.3)
    parser.add_argument("--host", help="Override host (single-run)")
    parser.add_argument("--stratum-port", type=int, help="Override stratum port (single-run)")
    parser.add_argument("--api-port", type=int, help="Override api port (single-run)")
    args = parser.parse_args()

    regions = []
    if args.host:
        regions.append(
            RegionTarget(
                name="Custom",
                host=args.host,
                stratum_port=args.stratum_port or 3333,
                api_port=args.api_port or 8080,
            )
        )
    else:
        if args.region == "ALL":
            for name, cfg in DEFAULT_REGIONS.items():
                regions.append(RegionTarget(name=name, host=cfg["host"], stratum_port=cfg["stratum"], api_port=cfg["api"]))
        else:
            cfg = DEFAULT_REGIONS[args.region]
            regions.append(RegionTarget(name=args.region, host=cfg["host"], stratum_port=cfg["stratum"], api_port=cfg["api"]))

    print("=" * 70)
    print("ZION v2.9.5 — Native (Rust) Pool E2E")
    print("=" * 70)

    all_ok = True
    for r in regions:
        try:
            ok = run_for_region(r, args.wallet, args.worker, args.skip_ncl, args.ncl_allocation)
        except Exception as e:
            ok = False
            print(f"❌ {r.name}: EXCEPTION — {e}")
        all_ok = all_ok and ok
        time.sleep(0.2)

    print("=" * 70)
    if all_ok:
        print("✅ ALL NATIVE E2E TESTS PASSED")
        return 0
    print("❌ SOME NATIVE E2E TESTS FAILED")
    return 1


if __name__ == "__main__":
    sys.exit(main())
