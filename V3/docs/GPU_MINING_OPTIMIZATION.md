# ZION V3 GPU Mining Optimization Guide

> **Version:** 1.0.0  
> **Date:** 2026-06-07  
> **Applies to:** `zion-miner` (GPU backends: OpenCL, CUDA, Metal), `zion-pool` server  
> **Target consensus:** `deeksha_lite_v1`

---

## The Problem

Live stratum mining reported **~0.05 H/s** while `zion-miner --ekam-bench` reported **~1.1 KH/s** on the same AMD RX 5700 XT (`gfx1010`).

**Root cause:** The pool's default `ZION_NONCE_COUNT=4096` sends GPU batches so small that the card finishes in ~3.7 seconds, then sits idle for the remaining ~11.3 seconds of the 15-second job TTL waiting for the next network round-trip.

**GPU utilisation: ~25%.**

---

## How It Works

The ZION stratum protocol works like this:

1. Pool sends a `Job` message containing:
   - `header_hex` — block header to hash
   - `start_nonce` — beginning of nonce range
   - `nonce_count` — how many nonces the miner should try
   - `target_hex` — share target (from vardiff)
   - `job_ttl_ms` — how long the job remains valid

2. The miner scans `start_nonce .. start_nonce + nonce_count`.

3. If a hash meets the target, the miner immediately submits it.
   Otherwise, after exhausting the range, it requests the next job.

4. The pool expires jobs after `job_ttl_ms` and sends `stale`/`cancel`.

**The bottleneck:** For GPUs, kernel launch + PCIe transfer overhead is significant. Small batches amortise this overhead poorly.

---

## The Fix

Increase `ZION_NONCE_COUNT` so that GPU work time ≈ job TTL:

```
optimal_nonce_count ≈ hashrate × job_ttl_ms / 1000
```

### Measured Example (RX 5700 XT)

| Metric | Before | After |
|--------|--------|-------|
| `ZION_NONCE_COUNT` | 4096 | 65536 |
| `ZION_JOB_TTL_MS` | 15000 | 60000 |
| `ZION_NONCE_STRIDE` | (unset) | 262144 |
| Time per batch | ~3.7 s | ~60 s |
| GPU utilisation | ~25% | ~95% |
| Live hashrate | ~0.05 H/s | ~5 KH/s |
| Benchmark (`--ekam-bench`) | 1.1 KH/s | 1.1 KH/s |

> Note: The benchmark hashrate did not change — it always used the GPU's full `work_size`. The live stratum improvement comes from eliminating idle time between jobs.

---

## Configuration Reference

### Pool Server (`edge-environment.sh` or systemd)

| Variable | Default | Recommended (GPU) | Description |
|----------|---------|-------------------|-------------|
| `ZION_NONCE_COUNT` | 1024 | 65536 | Nonces sent per job batch. Increase for GPU. |
| `ZION_JOB_TTL_MS` | 15000 | 60000 | Job validity window (ms). Should exceed batch time. |
| `ZION_NONCE_STRIDE` | 1024 | 262144 | Spacing between consecutive job batches across sessions. |
| `ZION_POOL_LOOP_COUNT` | 1 | 1000000 | Iterations before pool says `Bye`. Must be >1 for sustained mining. |

### Miner (local environment)

| Variable | Default | Recommended | Description |
|----------|---------|-------------|-------------|
| `ZION_LOOP_COUNT` | 1 | 1000000 | Miner iterations before reconnecting. |
| `ZION_GPU_BACKEND` | `auto` | `opencl` / `cuda` / `metal` | Force GPU backend (skip CPU fallback). |
| `ZION_GPU_WORK_SIZE` | device-specific | device-specific | Override OpenCL global work size. |
| `ZION_PAYOUT_ADDRESS` | (none) | **Required** | Valid 44-char `zion1...` address. Pool rejects without it. |
| `ZION_NONCE_COUNT_MIN` | 10000 | 10000 | Miner's lower bound for auto-tuning (local mode only). |
| `ZION_NONCE_COUNT_MAX` | 5000000 | 5000000 | Miner's upper bound for auto-tuning (local mode only). |

> **Remote pool mode:** The miner **must** respect the `nonce_count` sent by the pool in each `Job` message. The pool fully controls the batch size.

---

## Tuning Methodology

1. **Run the benchmark** to find your GPU's raw capability:
   ```bash
   zion-miner --ekam-bench
   ```
   Note the `KH/s` output.

2. **Pick a target job TTL:**  
   60 seconds is safe (block time is 60s). For faster feedback, use 30s.

3. **Calculate optimal `nonce_count`:**
   ```
   nonce_count = benchmark_hashrate × target_ttl
   ```
   Example: 1.1 KH/s × 60 s = 66000. Round to power of 2: **65536**.

4. **Set pool variables and restart:**
   ```bash
   # edge-environment.sh
   ZION_NONCE_COUNT=65536
   ZION_JOB_TTL_MS=60000
   ZION_NONCE_STRIDE=262144
   ```
   ```bash
   systemctl restart zion-edge-pool
   ```

5. **Verify in pool logs:**
   ```
   job_ttl_ms=60000
   iteration=1 miner=... nonces=42..65578
   iteration_elapsed_ms=...
   ```
   Elapsed should approach TTL (±10%).

6. **Check metrics:**
   ```bash
   curl -s http://POOL:8455/metrics | grep zion_pool_hashrate_hps
   ```
   Should now be in the same order of magnitude as the benchmark.

---

## Systemd Best Practice

**Problem discovered:** The Edge pool service had hardcoded `Environment=` directives that overrode the `EnvironmentFile`.

**Bad** (overrides env file, creates confusion):
```ini
[Service]
EnvironmentFile=/root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh
Environment="ZION_NONCE_COUNT=262144"
Environment="ZION_NONCE_STRIDE=262144"
```

**Good** (single source of truth):
```ini
[Service]
EnvironmentFile=/root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh
Environment="RUST_LOG=info,zion_pool=debug"
```

Keep only `RUST_LOG` and other non-operational settings in `Environment=`. All tuning variables belong in `edge-environment.sh`.

---

## Expected Hashrates by Hardware

| GPU | Backend | Benchmark | Typical Live (after tuning) |
|-----|---------|-----------|----------------------------|
| AMD RX 5700 XT (`gfx1010`) | OpenCL | ~1.1 KH/s | ~5 KH/s |
| AMD RX 6700 XT | OpenCL | ~1.5 KH/s | ~7 KH/s |
| NVIDIA RTX 3060 | CUDA | ~2.0 KH/s | ~10 KH/s |
| NVIDIA RTX 4090 | CUDA | ~8.0 KH/s | ~40 KH/s |
| Apple M3 (Metal) | Metal | ~0.8 KH/s | ~4 KH/s |

> Live hashrate is always slightly lower than benchmark because of network latency, share submission overhead, and vardiff retargeting.

---

## Troubleshooting

### "pool closed the connection" immediately after hello
- Missing or invalid `ZION_PAYOUT_ADDRESS`. Must be a valid 44-char `zion1...` address.
- Pool and miner binaries compiled from different source versions. **Always recompile pool after miner changes** (protocol is not backward compatible).

### Benchmark fast, live mining very slow
- `ZION_NONCE_COUNT` too small → increase on pool.
- `ZION_JOB_TTL_MS` too short → increase on pool.
- `ZION_POOL_LOOP_COUNT=1` on pool → miner gets `Bye` after every iteration, forcing expensive reconnects.

### Shares rejected (not accepted)
- Check `algorithm` mismatch: pool and miner must agree on `deeksha_lite_v1` or `deeksha_full_v1`.
- Check `difficulty` on pool metrics. If vardiff is too high, shares become rare but should still be valid.

### GPU init fails, falls back to CPU
- Set `ZION_GPU_BACKEND=opencl` (or `cuda`/`metal`) explicitly.
- Ensure GPU drivers are installed (`clinfo` for OpenCL, `nvidia-smi` for CUDA).
- On VPS without GPU: expected behaviour. Use CPU mining or external GPU rig.

---

## Related Files

- `edge-deploy/config/edge-environment.sh` — Edge pool environment
- `/etc/systemd/system/zion-edge-pool.service` — Edge pool systemd unit
- `AGENTS.md` — Local development commands for pool + miner
- `StatusV3.md` — Live infrastructure status

---

*Last updated: 2026-06-07 · Verified on Edge (77.42.71.94) with AMD RX 5700 XT miner `vega-smos` · Genesis: `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728`*
