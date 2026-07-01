#!/usr/bin/env python3
"""
ZION Pool Stress Test -- simulates N miners connecting to the pool.

Protocol: JSON line-based (newline-delimited JSON over TCP).
  Miner -> Pool: {"type":"hello","miner_id":"...","worker_name":"...","algorithm":"...","payout_address":"...","backend":"..."}
  Pool -> Miner: {"type":"welcome",...}
  Pool -> Miner: {"type":"job",...}
  Miner -> Pool: {"type":"submit",...} (optional -- we send fake shares)

Usage:
  python stress_test_pool.py --host 77.42.71.94 --port 8444 --miners 1000 --batch-size 50 --batch-delay 1.0

Metrics collected:
  - Connection success rate
  - Time to connect all miners
  - Welcome received rate
  - Job received rate
  - Pool RSS memory before/after
  - Pool active_sessions metric (via Prometheus)
  - Pool CPU usage
  - Share submission test (100 fake shares)
  - Disconnect cleanup time
"""

import argparse
import json
import socket
import ssl
import sys
import time
import threading
import urllib.request
import subprocess
from collections import defaultdict
from datetime import datetime

# ── Stats ──────────────────────────────────────────────────────────────
stats = defaultdict(int)
stats_lock = threading.Lock()
errors = defaultdict(int)
welcome_times = []
job_times = []
connect_times = []

def stat_inc(key, n=1):
    with stats_lock:
        stats[key] += n

def err_inc(key, n=1):
    with stats_lock:
        errors[key] += n

# ── Pool metrics fetch ─────────────────────────────────────────────────
def fetch_pool_metrics(host="100.76.16.108", port=8455):
    """Fetch Prometheus metrics from pool."""
    try:
        url = f"http://{host}:{port}/metrics"
        with urllib.request.urlopen(url, timeout=5) as r:
            body = r.read().decode("utf-8", errors="ignore")
        metrics = {}
        for line in body.splitlines():
            line = line.strip()
            if line.startswith("#") or not line:
                continue
            parts = line.split()
            if len(parts) >= 2:
                try:
                    metrics[parts[0]] = float(parts[1])
                except ValueError:
                    pass
        return metrics
    except Exception as e:
        return {"error": str(e)}

def get_pool_rss_ssh():
    """Get pool RSS via SSH (only works if SSH key is available)."""
    try:
        import subprocess as sp
        result = sp.run(
            ["ssh", "-i", "ssh-key-zion-edge", "-o", "StrictHostKeyChecking=accept-new",
             "-o", "ConnectTimeout=5", "-o", "BatchMode=yes",
             "root@100.76.16.108",
             "ps -C zion-pool-serve -o rss= --no-headers 2>/dev/null; echo '---'; ps -C zion-pool-serve -o %cpu= --no-headers 2>/dev/null"],
            capture_output=True, text=True, timeout=10
        )
        lines = result.stdout.strip().split("---")
        rss = int(lines[0].strip()) if lines and lines[0].strip().isdigit() else 0
        cpu = float(lines[1].strip()) if len(lines) > 1 and lines[1].strip() else 0.0
        return rss, cpu
    except Exception:
        return 0, 0.0

# ── Miner simulation ───────────────────────────────────────────────────
def simulate_miner(host, port, miner_id, algo="deeksha_lite_v1", timeout=60):
    """Simulate a single miner: connect, hello, receive welcome+job, optionally submit."""
    sock = None
    try:
        t0 = time.time()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((host, port))
        t1 = time.time()
        connect_times.append(t1 - t0)
        stat_inc("connected")

        # Send Hello
        hello = {
            "type": "hello",
            "miner_id": miner_id,
            "worker_name": f"worker-{miner_id[-4:]}",
            "algorithm": algo,
            "payout_address": "zion1n0s6e756p7r360a0e47582n7r5t2e3t4e2wq5c8",
            "backend": "cpu",
        }
        sock.sendall((json.dumps(hello) + "\n").encode())

        # Receive Welcome
        buf = b""
        welcome_received = False
        job_received = False
        deadline = time.time() + timeout

        while time.time() < deadline:
            try:
                data = sock.recv(4096)
                if not data:
                    break
                buf += data
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        msg = json.loads(line)
                        mtype = msg.get("type", "")
                        if mtype == "welcome" and not welcome_received:
                            welcome_received = True
                            welcome_times.append(time.time() - t0)
                            stat_inc("welcome_received")
                        elif mtype == "job" and not job_received:
                            job_received = True
                            job_times.append(time.time() - t0)
                            stat_inc("job_received")
                            # Optionally submit a fake share
                            if stats.get("shares_to_send", 0) > 0:
                                submit = {
                                    "type": "submit",
                                    "job_id": msg.get("job_id", 1),
                                    "miner_id": miner_id,
                                    "worker_name": f"worker-{miner_id[-4:]}",
                                    "nonce": 12345,
                                    "hash_hex": "0" * 64,
                                }
                                sock.sendall((json.dumps(submit) + "\n").encode())
                                stat_inc("shares_submitted")
                    except json.JSONDecodeError:
                        pass
                    if welcome_received and job_received:
                        break
                if welcome_received and job_received:
                    break
            except socket.timeout:
                break

        if not welcome_received:
            stat_inc("no_welcome")
        if not job_received:
            stat_inc("no_job")

        # Keep connection alive for the test duration
        return sock, welcome_received, job_received

    except ConnectionRefusedError:
        err_inc("connection_refused")
        return None, False, False
    except socket.timeout:
        err_inc("connect_timeout")
        return None, False, False
    except OSError as e:
        err_inc(f"os_error_{type(e).__name__}")
        return None, False, False
    except Exception as e:
        err_inc(f"error_{type(e).__name__}")
        return None, False, False

# ── Main ───────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="ZION Pool Stress Test")
    parser.add_argument("--host", default="77.42.71.94", help="Pool host")
    parser.add_argument("--port", type=int, default=8444, help="Pool port")
    parser.add_argument("--miners", type=int, default=1000, help="Number of miners to simulate")
    parser.add_argument("--batch-size", type=int, default=50, help="Miners per batch")
    parser.add_argument("--batch-delay", type=float, default=1.0, help="Delay between batches (seconds)")
    parser.add_argument("--hold-time", type=float, default=10.0, help="How long to hold connections (seconds)")
    parser.add_argument("--shares", type=int, default=0, help="Number of fake shares to submit (total)")
    parser.add_argument("--metrics-host", default="100.76.16.108", help="Prometheus metrics host")
    parser.add_argument("--metrics-port", type=int, default=8455, help="Prometheus metrics port")
    parser.add_argument("--output", default=None, help="Output report file (default: stdout)")
    args = parser.parse_args()

    print(f"=== ZION Pool Stress Test ===")
    print(f"  Target:   {args.host}:{args.port}")
    print(f"  Miners:   {args.miners} (batches of {args.batch_size}, delay {args.batch_delay}s)")
    print(f"  Hold:     {args.hold_time}s")
    print(f"  Shares:   {args.shares}")
    print(f"==============================")
    print()

    # ── Baseline metrics ──────────────────────────────────────────────
    print("[PHASE 0] Collecting baseline metrics...")
    baseline_metrics = fetch_pool_metrics(args.metrics_host, args.metrics_port)
    baseline_rss, baseline_cpu = get_pool_rss_ssh()
    baseline_sessions = int(baseline_metrics.get("zion_pool_active_sessions", 0))
    baseline_hashrate = baseline_metrics.get("zion_pool_hashrate_hps", 0)
    print(f"  Pool active_sessions: {baseline_sessions}")
    print(f"  Pool hashrate:        {baseline_hashrate:.0f} H/s")
    print(f"  Pool RSS:             {baseline_rss} kB")
    print(f"  Pool CPU:             {baseline_cpu:.1f}%")
    print()

    # ── Phase 1: Connect miners ───────────────────────────────────────
    print(f"[PHASE 1] Connecting {args.miners} miners in batches of {args.batch_size}...")
    socks = []
    t_start = time.time()

    with stats_lock:
        stats["shares_to_send"] = args.shares

    batch_num = 0
    for i in range(0, args.miners, args.batch_size):
        batch_num += 1
        batch_start = i
        batch_end = min(i + args.batch_size, args.miners)
        batch_count = batch_end - batch_start
        threads = []

        for j in range(batch_start, batch_end):
            miner_id = f"stress-miner-{j:05d}"
            t = threading.Thread(target=simulate_miner, args=(args.host, args.port, miner_id), daemon=True)
            threads.append(t)

        for t in threads:
            t.start()

        for t in threads:
            t.join(timeout=30)

        elapsed = time.time() - t_start
        with stats_lock:
            connected = stats["connected"]
            welcomed = stats["welcome_received"]
            jobs = stats["job_received"]
        print(f"  Batch {batch_num}: {batch_count} miners -> total connected={connected}, welcomed={welcomed}, jobs={jobs} ({elapsed:.1f}s elapsed)")

        if i + args.batch_size < args.miners:
            time.sleep(args.batch_delay)

    t_connect_done = time.time()
    connect_duration = t_connect_done - t_start
    print(f"\n  All batches sent in {connect_duration:.1f}s")
    print()

    # ── Phase 2: Hold connections ─────────────────────────────────────
    print(f"[PHASE 2] Holding connections for {args.hold_time}s...")
    mid_metrics = fetch_pool_metrics(args.metrics_host, args.metrics_port)
    mid_rss, mid_cpu = get_pool_rss_ssh()
    mid_sessions = int(mid_metrics.get("zion_pool_active_sessions", 0))
    print(f"  Pool active_sessions: {mid_sessions}")
    print(f"  Pool RSS:             {mid_rss} kB (delta: {mid_rss - baseline_rss:+d} kB)")
    print(f"  Pool CPU:             {mid_cpu:.1f}%")

    time.sleep(args.hold_time)

    # Final metrics during hold
    hold_metrics = fetch_pool_metrics(args.metrics_host, args.metrics_port)
    hold_rss, hold_cpu = get_pool_rss_ssh()
    hold_sessions = int(hold_metrics.get("zion_pool_active_sessions", 0))
    print(f"  After hold -- sessions: {hold_sessions}, RSS: {hold_rss} kB, CPU: {hold_cpu:.1f}%")
    print()

    # ── Phase 3: Disconnect all ───────────────────────────────────────
    print("[PHASE 3] Disconnecting all miners...")
    t_disc_start = time.time()
    for s in socks:
        try:
            s.close()
        except Exception:
            pass
    time.sleep(3)
    t_disc_done = time.time()
    disc_duration = t_disc_done - t_disc_start

    post_metrics = fetch_pool_metrics(args.metrics_host, args.metrics_port)
    post_rss, post_cpu = get_pool_rss_ssh()
    post_sessions = int(post_metrics.get("zion_pool_active_sessions", 0))
    print(f"  Disconnected in {disc_duration:.1f}s")
    print(f"  Post-disconnect sessions: {post_sessions}")
    print(f"  Post-disconnect RSS:      {post_rss} kB")
    print()

    # ── Phase 4: Recovery check ───────────────────────────────────────
    print("[PHASE 4] Waiting 10s for recovery...")
    time.sleep(10)
    recovery_metrics = fetch_pool_metrics(args.metrics_host, args.metrics_port)
    recovery_rss, recovery_cpu = get_pool_rss_ssh()
    recovery_sessions = int(recovery_metrics.get("zion_pool_active_sessions", 0))
    print(f"  Recovery sessions: {recovery_sessions}")
    print(f"  Recovery RSS:      {recovery_rss} kB (delta from baseline: {recovery_rss - baseline_rss:+d} kB)")
    print()

    # ── Report ────────────────────────────────────────────────────────
    total_time = time.time() - t_start
    with stats_lock:
        s = dict(stats)
        e = dict(errors)

    connect_avg = sum(connect_times) / len(connect_times) if connect_times else 0
    connect_max = max(connect_times) if connect_times else 0
    welcome_avg = sum(welcome_times) / len(welcome_times) if welcome_times else 0
    job_avg = sum(job_times) / len(job_times) if job_times else 0

    report = f"""# ZION Pool Stress Test Report

> **Generated:** {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")}
> **Target:** {args.host}:{args.port}
> **Miners simulated:** {args.miners}
> **Batch size:** {args.batch_size} (delay {args.batch_delay}s)
> **Hold time:** {args.hold_time}s

## Results Summary

| Metric | Value |
|--------|-------|
| Total miners attempted | {args.miners} |
| Successfully connected | {s.get('connected', 0)} ({s.get('connected', 0)/args.miners*100:.1f}%) |
| Welcome received | {s.get('welcome_received', 0)} ({s.get('welcome_received', 0)/args.miners*100:.1f}%) |
| Job received | {s.get('job_received', 0)} ({s.get('job_received', 0)/args.miners*100:.1f}%) |
| No welcome | {s.get('no_welcome', 0)} |
| No job | {s.get('no_job', 0)} |
| Shares submitted | {s.get('shares_submitted', 0)} |
| Connect time (avg) | {connect_avg*1000:.0f} ms |
| Connect time (max) | {connect_max*1000:.0f} ms |
| Welcome time (avg) | {welcome_avg*1000:.0f} ms |
| Job time (avg) | {job_avg*1000:.0f} ms |
| Total test duration | {total_time:.1f}s |

## Pool Resource Usage

| Phase | Active Sessions | RSS (kB) | CPU % |
|-------|----------------|----------|-------|
| Baseline | {baseline_sessions} | {baseline_rss} | {baseline_cpu:.1f} |
| Mid-hold | {mid_sessions} | {mid_rss} | {mid_cpu:.1f} |
| End-hold | {hold_sessions} | {hold_rss} | {hold_cpu:.1f} |
| Post-disconnect | {post_sessions} | {post_rss} | {post_cpu:.1f} |
| Recovery (10s) | {recovery_sessions} | {recovery_rss} | {recovery_cpu:.1f} |

### Memory delta
- Baseline -> Peak: **{hold_rss - baseline_rss:+d} kB** ({(hold_rss - baseline_rss)/1024:+.1f} MB)
- Baseline -> Recovery: **{recovery_rss - baseline_rss:+d} kB** ({(recovery_rss - baseline_rss)/1024:+.1f} MB)
- Memory per miner: **{(hold_rss - baseline_rss)/max(hold_sessions,1):.1f} kB/miner**

## Errors

| Error | Count |
|-------|-------|"""
    for k, v in sorted(e.items(), key=lambda x: -x[1]):
        report += f"\n| {k} | {v} |"
    if not e:
        report += "\n| (none) | 0 |"

    report += f"""

## Capacity Estimate

Based on this test:
- Pool RSS per miner: **{(hold_rss - baseline_rss)/max(hold_sessions,1):.1f} kB**
- Edge available memory: ~5.6 GB (5,600,000 kB)
- Pool baseline RSS: {baseline_rss} kB
- Estimated max miners (memory-bound, 2GB pool budget): **{int(2_000_000 / max((hold_rss - baseline_rss)/max(hold_sessions,1), 1)):,}**
- Estimated max miners (memory-bound, 4GB pool budget): **{int(4_000_000 / max((hold_rss - baseline_rss)/max(hold_sessions,1), 1)):,}**

### Notes
- Pool server is single-threaded async (tokio). CPU is the likely bottleneck before memory.
- Each miner connection = 1 TCP socket + session state + PPLNS tracking.
- Job broadcast fan-out: pool sends Job to all sessions on each new block template.
- Share validation: each submit requires hash verification (CPU-intensive for real shares).
- This test used fake shares (hash_hex="0"*64) -- real share validation would use more CPU.
- Pool `ZION_MAX_SESSIONS_PER_IP=10` on Edge may reject connections from same IP.
  (Stress test may need to run from multiple IPs or this limit may need adjustment.)

## Pool Metrics (Prometheus)

### Baseline
```
{json.dumps(baseline_metrics, indent=2)}
```

### Peak (during hold)
```
{json.dumps(hold_metrics, indent=2)}
```

### Recovery
```
{json.dumps(recovery_metrics, indent=2)}
```
"""

    if args.output:
        with open(args.output, "w") as f:
            f.write(report)
        print(f"\nReport written to {args.output}")
    else:
        print(report)

    print("\n[OK] Stress test complete.")

if __name__ == "__main__":
    main()
