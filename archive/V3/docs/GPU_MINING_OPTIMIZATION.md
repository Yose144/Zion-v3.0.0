# ZION V3 GPU Mining Optimization Guide

> **Version:** 1.2.0  
> **Date:** 2026-06-10  
> **Applies to:** `zion-miner` (GPU backends: OpenCL, CUDA, Metal), `zion-pool` server  
> **Target consensus:** `deeksha_lite_v1`, `deeksha_lite_fire`, `cosmic_harmony_ekam_deeksha_v2`

---

## The Problem

Live stratum mining reported **~0.05 H/s** while `zion-miner --gpu-benchmark-all` reported **~19.25 KH/s** on the same AMD RX 5700 XT (`gfx1010`).

> **CRITICAL:** Benchmarks before 2026-06-07 were **inaccurate** due to missing `queue.finish()` after OpenCL buffer reads (commit `691a3398`). Old values like "1.1 KH/s" were artifacts. Always use current code for benchmarking.

**Root cause:** The pool's default `ZION_NONCE_COUNT=4096` sends GPU batches so small that the card finishes in ~0.2 seconds, then sits idle for the remaining ~59.8 seconds of the 60-second job TTL waiting for the next network round-trip.

**GPU utilisation: ~0.3%.**

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

| Metric | Before | After (v1.0) | After (v1.1) |
|--------|--------|--------------|--------------|
| `ZION_NONCE_COUNT` | 4096 | 65536 | **1048576** |
| `ZION_JOB_TTL_MS` | 15000 | 60000 | 60000 |
| `ZION_NONCE_STRIDE` | (unset) | 262144 | 262144 |
| Time per batch | ~0.2 s | ~5.2 s | **~54 s** |
| GPU utilisation | ~0.3% | ~8.6% | **~91%** |
| Live hashrate | ~0.05 H/s | ~3.7 KH/s | **~17.5 KH/s** |
| Benchmark (`--gpu-benchmark-all`) | — | 19.25 KH/s | 19.25 KH/s |

> **Note:** The benchmark hashrate (19.25 KH/s for `deeksha_lite_v1`) does not change with nonce_count — it always uses the GPU's full `work_size`. The live stratum improvement comes from eliminating idle time between jobs. With 1048576 nonces @ 19.25 KH/s, each batch takes ~54s, leaving only ~6s idle within a 60s TTL.

> **Three algorithms are available:**
> - `deeksha_lite_v1` (fastest, ~19 KH/s) — default for general mining
> - `deeksha_lite_fire` (~4 KH/s) — thermal stress / winter heating (ALU-intensive, 524288 thermal iters + extra cross-chain mul/rotate)
> - `cosmic_harmony_ekam_deeksha_v2` (~3.3 KH/s) — maximum ASIC resistance

---

## Configuration Reference

### Pool Server (`edge-environment.sh` or systemd)

| Variable | Default | Recommended (GPU) | Description |
|----------|---------|-------------------|-------------|
| `ZION_NONCE_COUNT` | 1024 | **1048576** | Nonces sent per job batch. See table below for per-algorithm tuning. |
| `ZION_JOB_TTL_MS` | 15000 | 60000 | Job validity window (ms). Should exceed batch time. |
| `ZION_NONCE_STRIDE` | 1024 | 262144 | Spacing between consecutive job batches across sessions. |
| `ZION_POOL_LOOP_COUNT` | 1 | 1000000 | Iterations before pool says `Bye`. Must be >1 for sustained mining. |
| `ZION_POOL_ALGORITHM` | `deeksha_lite_v1` | `deeksha_lite_v1` / `deeksha_lite_fire` | Pool algorithm. Miner must match. |

**Per-algorithm `nonce_count` tuning (RX 5700 XT @ 60s TTL):**

| Algorithm | Benchmark | Optimal `nonce_count` | GPU util |
|-----------|-----------|----------------------|----------|
| `deeksha_lite_v1` | 19.25 KH/s | **1048576** | ~91 % |
| `deeksha_lite_fire` | ~4 KH/s | **1048576** | ~91 % |
| `cosmic_harmony_ekam_deeksha_v2` | 3.29 KH/s | **262144** | ~73 % |

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

1. **Run the multi-algorithm benchmark** to find your GPU's raw capability:
   ```bash
   # With GPU support
   cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl
   ./target/release/zion-miner --gpu-benchmark-all
   ```
   Note the `KH/s` output for each algorithm.

2. **Pick a target job TTL:**  
   60 seconds is safe (block time is 60s). For faster feedback, use 30s.

3. **Calculate optimal `nonce_count`:**
   ```
   nonce_count = benchmark_hashrate × (target_ttl - 5)
   ```
   The `-5` is a safety margin for network + submit latency.
   Example (Lite v1): 19.25 KH/s × 55 s = 1,058,750. Round to power of 2: **1048576**.

4. **Set pool variables and restart:**
   ```bash
   # edge-environment.sh
   ZION_NONCE_COUNT=1048576
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

Only the **AMD RX 5700 XT** row below was measured directly on 2026-06-07 via `--gpu-benchmark-all`. All other GPUs are listed for reference format only — run the benchmark on your own hardware.

| GPU | Backend | Lite v1 | Fire | Cosmic Harmony | Status |
|-----|---------|---------|------|--------------|--------|
| AMD RX 5700 XT (`gfx1010`) | OpenCL | **~19 KH/s** | **~4 KH/s** | **~3.3 KH/s** | Measured |
| AMD RX 6700 XT | OpenCL | — | — | — | Not tested |
| NVIDIA RTX 3060 | CUDA | — | — | — | Not tested |
| NVIDIA RTX 4090 | CUDA | — | — | — | Not tested |
| Apple M3 (Metal) | Metal | — | — | — | Not tested |

> **Note:** Pre-2026-06-07 benchmarks reported ~1.1 KH/s for Lite v1 on RX 5700 XT. This was an artifact caused by missing `queue.finish()` (commit `691a3398`). The values above are corrected.
>
> **To verify your hardware:** Always run `./target/release/zion-miner --gpu-benchmark-all` on current code.

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

*Last updated: 2026-06-10 · Fire profile upgraded: THERMAL_ITERS=524288 + extra ALU mul/rotate, dynamic work_size up to 24576 · Verified on AMD RX 5700 XT (`gfx1010`)*
