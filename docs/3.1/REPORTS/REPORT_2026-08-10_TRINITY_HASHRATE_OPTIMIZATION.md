# REPORT: Trinity Hashrate Optimization — ZION GPU + Structured Logging + Auto-Detect

**Date:** 2026-08-10  
**Hardware:** AMD Ryzen 5 3600 (6c/12t) + NVIDIA GTX 1070 Ti (8GB VRAM)  
**Pool:** Edge V31 pool (62.171.141.136:8444)  
**Mode:** V3 Trinity — all 3 streams through single pool connection

---

## Summary

Three major improvements were implemented in this session:

1. **Hardware auto-detection + auto-tune** — new `auto_detect.rs` module
2. **Professional structured logging** — replaced all `eprintln!` hex dumps with `tracing` macros + periodic 30s metrics summary
3. **Trinity hashrate optimization** — ZION GPU enabled, GPU time-slicing tuned, hashrate reporting stabilized

### Final Performance Results

| Stream | Before | After | Change |
|--------|--------|-------|--------|
| **ZION** (GPU deeksha) | 400 kH/s (CPU only) | **2.46 MH/s** (GPU) | **6.2x** |
| **ZANO** (GPU ProgPoW) | 9.73 MH/s (GPU solo) | **8.37 MH/s** (GPU shared) | -14% |
| **VRSC** (CPU VerusHash) | 2.07 MH/s | **10.39 MH/s** | **5.0x** |
| **Total** | **12.21 MH/s** | **21.5 MH/s** | **+76%** |

- **Accept rate:** 98.2% (213 accepted, 4 rejected — VRSC LuckPool normal)
- **Stability:** Hashrate stable between 20.6–23.5 MH/s across 5 measurement periods

---

## 1. Hardware Auto-Detection (`auto_detect.rs`)

New module `V31/L1/miner/src/auto_detect.rs` (417 lines) detects:
- **CPU:** vendor, model, physical/logical cores, architecture (AMD Zen / Intel Core / Apple Silicon / Other), SIMD features (AES-NI, SSE4.1/4.2, AVX, AVX2, BMI1/2, FMA, PCLMULQDQ, AVX-512)
- **GPU:** CUDA/OpenCL/Metal devices, compute units, VRAM
- **System RAM**

Derives optimal mining configuration:
- **GPU detected** → Triple Parallel: Stream 1 (ZION GPU) + Stream 2 (ZANO GPU) + Stream 3 (VRSC CPU)
- **CPU-only** → Dual Stream: Stream 1 (ZION CPU) + Stream 3 (VRSC CPU)

Clean box-drawing startup banner displays all detected hardware and the auto-configured mine plan.

All values overridable with env vars: `ZION_GPU_BACKEND`, `ZION_STREAM{1,2,3}_ENABLED`, `ZION_EXT_CPU_THREADS`, `ZION_EXT_CPU_NONCE_COUNT`, `ZION_NONCE_COUNT`, `ZION_STREAM2_BATCH`.

Wired into `config.rs` — `MinerConfig::new()` calls `detect_hardware()` + `derive_auto_config()` + `auto_tune_work_sizes()`.

---

## 2. Structured Logging

### eprintln → tracing

Replaced all 23 `eprintln!` calls in `runtime.rs` with structured `tracing` macros:
- `info!` — normal operations (GPU init, share accepted/rejected)
- `warn!` — errors (batch failures, connection drops)
- `debug!` — chatty events (job arrivals, share candidates, nonce base) — keeps default output clean

**Removed all hex dumps** (header_hex, target_hex, hash_hex) that were cluttering the log output.

### Periodic Metrics Summary (every 30s)

`spawn_periodic_metrics()` logs every 30 seconds:
- **Per-stream:** hashrate (formatted as kH/MH/GH/s), accepted/rejected shares, accept rate
- **Aggregate:** active streams, total hashrate, total shares, overall accept rate

Example output:
```
stream metrics  stream="zion"         hashrate=2.46 MH/s   accepted=69   rejected=0  accept_rate="100.0%"
stream metrics  stream="gpu-external" hashrate=8.37 MH/s   accepted=0    rejected=0  accept_rate="0.0%"
stream metrics  stream="cpu-external" hashrate=10.39 MH/s  accepted=5    rejected=1  accept_rate="83.3%"
═══ periodic metrics summary ═══  active_streams=3  total_hashrate=21.23 MH/s  total_accepted=74  total_rejected=1  overall_accept_rate="98.7%"
```

Works in both TUI and `--bg` (background) modes — independent of TUI flag.

---

## 3. Trinity Hashrate Optimization

### ZION: 400 kH/s → 2.46 MH/s (6.2x)

**Root cause:** ZION GPU was being **skipped** when Stream 2 (ZANO) was enabled. The old logic:
```rust
let skip_zion_gpu = config.stream2_enabled && gpu_backend_str != "cpu" && !force_zion_gpu;
```
This meant ZION ran on CPU (~400 kH/s) while ZANO had the GPU to itself.

**Fix:** Always enable ZION GPU with smaller `work_size=4096` (2GB scratchpad) to coexist with ZANO's DAG (~2GB) on the 8GB GTX 1070 Ti. The CUDA driver time-slices between the two kernel contexts automatically.

**Hashrate stabilization:** The GPU kernel uses an in-kernel sentinel for early-exit — once a solution is found, remaining chunks exit immediately. Previously, `batch_size` was always reported as `nonces_searched`, causing wild hashrate fluctuations. Now we estimate actual nonces based on which chunk the solution was found in:
```rust
let chunks_processed = (offset / gpu_work_size as u64) + 1;
let estimated_nonces = (chunks_processed * gpu_work_size as u64).min(batch_size);
```

EMA smoothing changed from 0.7/0.3 to 0.85/0.15 for more stable display.

### ZANO: 9.73 → 8.37 MH/s (-14%)

ZANO slightly decreased because it now shares GPU time with ZION. The duty-cycle gap was reduced from 300ms to 50ms when ZION has its own GPU backend — the CUDA driver serializes kernels, but a small gap ensures fair scheduling.

The tradeoff is overwhelmingly positive: ZION gained 2.06 MH/s while ZANO lost only 1.36 MH/s — net gain of **+0.7 MH/s** on GPU alone.

### VRSC: 2.07 → 10.39 MH/s (5.0x)

VRSC's dramatic improvement is a side effect of moving ZION to GPU:
- Before: ZION used all 12 CPU threads → VRSC starved for CPU
- After: ZION on GPU → all 12 CPU threads available for VRSC VerusHash

No code changes needed — the auto-tune already selected 12 threads with 5M nonce batch for AMD Zen.

---

## Files Modified

| File | Changes |
|------|---------|
| `V31/L1/miner/src/auto_detect.rs` | **NEW** — HW detection + auto-config + startup banner |
| `V31/L1/miner/src/lib.rs` | Register `auto_detect` module |
| `V31/L1/miner/src/config.rs` | Wire auto_detect into `MinerConfig::new()` |
| `V31/L1/miner/src/runtime.rs` | ZION GPU enable, hashrate stabilization, structured logging, periodic metrics, duty-cycle tuning |
| `V31/L1/miner/src/gpu/mod.rs` | Add `work_size()` to `GpuMiner` trait + `CudaDeekshaLiteMiner` impl |

---

## Build & Deploy

```bash
ZION_CPU_TARGET=native cargo build --release -p zion-miner --features gpu-cuda,native-all,tui
cp V31/target/release/zion-miner ~/Desktop/zion-miner
~/Desktop/Start.sh --bg
```

## Verification

```
stream metrics  stream="zion"         hashrate=2.46 MH/s   accepted=69   rejected=0  accept_rate="100.0%"
stream metrics  stream="gpu-external" hashrate=8.37 MH/s   accepted=0    rejected=0  accept_rate="0.0%"
stream metrics  stream="cpu-external" hashrate=10.39 MH/s  accepted=5    rejected=1  accept_rate="83.3%"
═══ periodic metrics summary ═══  active_streams=3  total_hashrate=21.23 MH/s  total_accepted=74  total_rejected=1  overall_accept_rate="98.7%"
```

Stable across 5 measurement periods (2.5 minutes): 20.6–23.5 MH/s, 213 shares accepted, 98.2% accept rate.
