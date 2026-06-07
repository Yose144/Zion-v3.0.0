# ZION V3 GPU Benchmark Report

> **Date:** 2026-06-07  
> **Hardware:** AMD RX 5700 XT (`gfx1010:xnack-`, RDNA, 6 GB VRAM)  
> **OS:** Windows 11 (MinGW)  
> **Miner:** `zion-miner` built with `--features gpu-opencl`  
> **Backend:** AMD APP SDK / OpenCL 1.2  
> **Command:** `zion-miner --gpu-benchmark-all`

---

## Executive Summary

| Algorithm | Throughput | Relative to Lite v1 | Primary Use |
|-----------|-----------|---------------------|-------------|
| `deeksha_lite_v1` | **19.25 KH/s** | 100 % (baseline) | General mining — maximum throughput |
| `deeksha_lite_fire` | **10.15 KH/s** | 53 % | Thermal stress / winter heating / stability burn-in |
| `cosmic_harmony_ekam_deeksha_v2` | **3.29 KH/s** | 17 % | Maximum ASIC/FPGA resistance |

> **Critical note:** Earlier benchmarks (before commit `691a3398`) were **inaccurate** due to missing `queue.finish()` after OpenCL buffer reads. Values like "1.1 KH/s" for Lite v1 or "18.2 MH/s" for Cosmic Harmony were artifacts. Always verify with `--gpu-benchmark-all` on current code.

---

## Methodology

1. Build miner with GPU OpenCL support:
   ```bash
   cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl
   ```

2. Run multi-algorithm benchmark:
   ```bash
   ./target/release/zion-miner --gpu-benchmark-all
   ```

3. Each algorithm is tested for **10 seconds** with auto-tuned `work_size` and `local_ws`.

4. The miner performs a GPU self-test before each algorithm to ensure hash correctness.

---

## Detailed Results

### Deeksha Lite v1 (`deeksha_lite_v1`)

```
gpu_opencl_lite_init family=AmdRdna device="gfx1010:xnack-"
  vram=6128MiB tuned_ws=8192 local_ws=128
  build_opts="-cl-std=CL1.2 -cl-mad-enable -cl-fast-relaxed-math"
  scratchpad_mib=2048

benchmark_algo=deeksha_lite_v1
  hashes=196608 elapsed=10.22s
  throughput=19.25 KH/s
```

- **Scratchpad:** 512 KiB per thread (Blake3 + SHA-3-512 memory-hard)
- **Best for:** Maximum throughput, general-purpose mining
- **Live stratum recommendation:** `ZION_NONCE_COUNT=1048576` with `ZION_JOB_TTL_MS=60000` for ~91 % GPU utilisation

### Cosmic Harmony Ekam Deeksha v2 (`cosmic_harmony_ekam_deeksha_v2`)

```
gpu_opencl_init device="gfx1010:xnack-"
  work_size=6128 local_ws=128 scratchpad_mib=1532
  npu_max_dim=128 is_gcn=false gcn_s4_mode=false
  build_opts="-cl-std=CL1.2 -cl-mad-enable -DNPU_MAX_DIM=128 -DWGS=128"

benchmark_algo=cosmic_harmony_ekam_deeksha_v2
  hashes=36768 elapsed=11.18s
  throughput=3.29 KH/s
```

- **Layers:** 6 (S1–S6) including NPU/fusion layer
- **Scratchpad:** 512 KiB per thread + matrix ops
- **Best for:** Highest ASIC/FPGA resistance, longest validation path
- **Trade-off:** 6× slower than Lite v1, but most decentralisation-friendly

### Deeksha Lite Fire (`deeksha_lite_fire`)

```
gpu_opencl_fire_init family=AmdRdna device="gfx1010:xnack-"
  vram=6128MiB tuned_ws=8192 local_ws=128
  build_opts="-cl-std=CL1.2 -cl-mad-enable -cl-fast-relaxed-math -cl-single-precision-constant"
  scratchpad_mib=1024

benchmark_algo=deeksha_lite_fire
  hashes=106496 elapsed=10.49s
  throughput=10.15 KH/s
```

- **Scratchpad:** 128 KiB per thread (intentionally small — ALU-bound)
- **Thermal loop:** 16 384 iterations, 6 independent `ulong` chains
- **Build flags:** RDNA-optimised (`-cl-single-precision-constant`)
- **Best for:** GPU thermal testing, stability burn-in, winter heating
- **VRAM requirement:** ~1 GiB free (128 KiB × 8192 threads)

---

## Pool Configuration Math

Given a target job TTL, the optimal `nonce_count` is:

```
nonce_count = benchmark_hashrate × (TTL_seconds - safety_margin)
```

where `safety_margin = 5 s` (network + submit latency).

### For RX 5700 XT @ 19.25 KH/s

| `ZION_JOB_TTL_MS` | Optimal `nonce_count` | Rounded (power of 2) | GPU util |
|-------------------|----------------------|---------------------|----------|
| 30 000 (30 s) | 481 250 | 524 288 | ~96 % |
| 60 000 (60 s) | 1 058 750 | 1 048 576 | ~91 % |
| 90 000 (90 s) | 1 635 000 | 1 048 576* | ~61 % |

\* Cap at 1 048 576 to avoid excessive memory usage. For 90 s TTL, a higher cap or `ZION_NONCE_COUNT_MAX` increase would be needed.

### For RX 5700 XT @ 10.15 KH/s (Fire)

| `ZION_JOB_TTL_MS` | Optimal `nonce_count` | Rounded | GPU util |
|-------------------|----------------------|---------|----------|
| 60 000 | 558 250 | 524 288 | ~94 % |

### For RX 5700 XT @ 3.29 KH/s (Cosmic Harmony)

| `ZION_JOB_TTL_MS` | Optimal `nonce_count` | Rounded | GPU util |
|-------------------|----------------------|---------|----------|
| 60 000 | 180 850 | 262 144 | ~73 % |

---

## Live Stratum vs Benchmark

| Metric | Benchmark | Live Stratum (Edge pool) | Difference |
|--------|-----------|-------------------------|------------|
| Lite v1 | 19.25 KH/s | ~14–17 KH/s* | ~20 % lower (network + validation overhead) |
| Fire | 10.15 KH/s | ~8–9 KH/s* | ~15 % lower |
| Cosmic Harmony | 3.29 KH/s | ~2.5–3 KH/s* | ~15 % lower |

\* Estimated based on pool metrics (`zion_pool_hashrate_hps`) with `nonce_count=1048576`.

---

## Comparison with Other Hardware

Only the **AMD RX 5700 XT** was directly measured. To add your hardware, run:

```bash
./target/release/zion-miner --gpu-benchmark-all
```

| GPU | Backend | Lite v1 | Fire | Cosmic Harmony | Date |
|-----|---------|---------|------|--------------|------|
| AMD RX 5700 XT (`gfx1010`) | OpenCL | **19.25 KH/s** | **10.15 KH/s** | **3.29 KH/s** | 2026-06-07 |
| *Your GPU here* | — | — | — | — | Run benchmark |

---

## Known Issues & Fixes

### Fixed: Benchmark inaccuracy (commit `691a3398`)

**Problem:** Missing `queue.finish()` after OpenCL `enqueue_read_buffer` caused the benchmark timer to stop before the kernel actually completed.

**Impact:**
- Reported impossible values like 18.2 MH/s for Cosmic Harmony.
- All pre-2026-06-07 benchmark data is invalid.

**Fix:** Added `queue.finish()` after every buffer read/write in `gpu_backend.rs`.

### Active: Pool hashrate metric under-reporting

The pool Prometheus metric `zion_pool_hashrate_hps` appears to smooth/average hashrate over time, producing lower values than instantaneous benchmark. Use benchmark for hardware capability and pool metric for trend analysis.

---

## Files Referenced

- `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl` — Lite v1 kernel
- `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl` — Cosmic Harmony kernel
- `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite_fire.cl` — Fire kernel
- `V3/L1/miner/src/gpu_backend.rs` — OpenCL backend (queue.finish() fix)
- `V3/docs/GPU_MINING_OPTIMIZATION.md` — Tuning guide

---

*Report generated: 2026-06-07 · Verified on AMD RX 5700 XT (gfx1010) · Commit: `691a3398` (queue.finish fix) + `ae343ebb` (Fire 16k iters)*
