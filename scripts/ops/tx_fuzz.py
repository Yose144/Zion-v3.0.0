#!/usr/bin/env python3
"""
F2 — transaction fuzzing harness (24h run).
Sends random/malformed JSON-RPC payloads to submitUtxoTransaction and other
node RPC endpoints while polling getStatus/getChainInfo. If the node stops
responding or returns panics, the harness records it.

Originally developed for the G7 chaos/load test preview (10 min, 2 280 req,
0 health fails). For F2, run with --duration 86400 for the full 24h cycle.
"""
import argparse
import json
import os
import random
import socket
import statistics
import string
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone


def rand_hex(length: int) -> str:
    return "".join(random.choice("0123456789abcdef") for _ in range(length))


def rand_string(length: int) -> str:
    return "".join(random.choice(string.ascii_letters + string.digits) for _ in range(length))


def rand_payload(rpc_id: int):
    method = random.choice([
        "submitUtxoTransaction",
        "submitBlock",
        "getTransaction",
        "getStatus",
        "getBlockTemplate",
        "getChainInfo",
    ])
    if method == "submitUtxoTransaction":
        params = [{
            "inputs": [{"previous_output": rand_hex(64), "index": random.randint(0, 1_000_000)}] * random.randint(1, 5),
            "outputs": [{"address": "zion1" + rand_string(38), "amount": str(random.randint(0, 1_000_000_000_000))}] * random.randint(1, 3),
            "signature": rand_hex(128),
        }]
    elif method == "submitBlock":
        params = [{
            "header": {"prev_hash": rand_hex(64), "height": random.randint(0, 2**32), "nonce": random.randint(0, 2**32)},
            "transactions": []
        }]
    elif method in ("getTransaction",):
        params = [rand_hex(64)]
    elif method in ("getBlockTemplate",):
        params = [{"wallet": "zion1" + rand_string(38)}]
    else:
        params = []

    return {
        "jsonrpc": "2.0",
        "id": rpc_id,
        "method": method,
        "params": params,
    }


def rpc_call(host: str, port: int, payload: dict, timeout: float = 10.0):
    t0 = time.perf_counter()
    try:
        body = json.dumps(payload).encode()
        req = urllib.request.Request(
            f"http://{host}:{port}/",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            resp = r.read().decode("utf-8", "ignore")
        elapsed = time.perf_counter() - t0
        return True, resp, elapsed
    except Exception as e:
        elapsed = time.perf_counter() - t0
        return False, str(e), elapsed


def raw_send(host: str, port: int, data: bytes, timeout: float = 5.0):
    t0 = time.perf_counter()
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        sock.sendall(data)
        sock.settimeout(timeout)
        sock.recv(4096)
        sock.close()
        return True, time.perf_counter() - t0
    except Exception as e:
        return False, time.perf_counter() - t0


def health_check(host: str, port: int):
    ok, _, elapsed = rpc_call(host, port, {"jsonrpc": "2.0", "id": 0, "method": "getStatus", "params": []}, timeout=10.0)
    return ok, elapsed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8443)
    parser.add_argument("--duration", type=int, default=600, help="Fuzz duration in seconds")
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    print(f"Starting transaction fuzz against {args.host}:{args.port} for {args.duration}s with {args.concurrency} workers")

    ok_count = 0
    err_count = 0
    health_ok = 0
    health_fail = 0
    latencies = []
    health_latencies = []
    start = time.time()
    rpc_id = 1

    while time.time() - start < args.duration:
        batch_start = time.time()
        with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
            futures = []
            for _ in range(args.concurrency):
                kind = random.random()
                if kind < 0.8:
                    futures.append(ex.submit(rpc_call, args.host, args.port, rand_payload(rpc_id)))
                elif kind < 0.95:
                    futures.append(ex.submit(rpc_call, args.host, args.port, {"jsonrpc": "2.0", "id": rpc_id, "method": "getStatus", "params": []}))
                else:
                    garbage = os.urandom(random.randint(1, 4096))
                    futures.append(ex.submit(raw_send, args.host, args.port, garbage))
                rpc_id += 1

            for fut in as_completed(futures):
                res = fut.result()
                if len(res) == 3:
                    ok, _, latency = res
                    if ok:
                        ok_count += 1
                    else:
                        err_count += 1
                    latencies.append(latency)
                else:
                    ok, latency = res
                    if ok:
                        ok_count += 1
                    else:
                        err_count += 1
                    latencies.append(latency)

        # Periodic health check every ~second.
        h_ok, h_lat = health_check(args.host, args.port)
        if h_ok:
            health_ok += 1
        else:
            health_fail += 1
        health_latencies.append(h_lat)

        # Throttle to roughly one batch per second.
        elapsed = time.time() - batch_start
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)

    duration = time.time() - start
    latencies.sort()
    health_latencies.sort()

    report = f"""# Transaction fuzz report

Generated: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")}
Target: {args.host}:{args.port}
Duration: {duration:.1f}s
Concurrency: {args.concurrency}
Total RPC-ish requests: {ok_count + err_count}
Health checks: {health_ok + health_fail}

| Metric | Value |
|--------|-------|
| RPC success | {ok_count} ({(ok_count/(ok_count+err_count)*100) if (ok_count+err_count) else 0:.1f}%) |
| RPC errors | {err_count} |
| Health OK | {health_ok} |
| Health fail | {health_fail} |
| RPC latency avg | {statistics.mean(latencies)*1000:.1f} ms |
| RPC latency p50 | {latencies[len(latencies)//2]*1000 if latencies else 0:.1f} ms |
| RPC latency p99 | {latencies[int(len(latencies)*0.99)]*1000 if latencies else 0:.1f} ms |
| Health latency avg | {statistics.mean(health_latencies)*1000:.1f} ms |
| Health latency p99 | {health_latencies[int(len(health_latencies)*0.99)]*1000 if health_latencies else 0:.1f} ms |

Note: Errors are expected for malformed / random payloads; the important signal
is that the node stays responsive and does not crash.
"""
    if args.output:
        with open(args.output, "w") as f:
            f.write(report)
        print(f"Report written to {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    main()
