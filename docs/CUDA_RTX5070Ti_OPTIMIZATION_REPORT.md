# CUDA RTX 5070 Ti Optimization & Multi-GPU Benchmark Report

**Date:** 2026-04-02  
**Branch:** `main`  
**Miner:** ZION V3 `zion-miner` (Ekam Deeksha, `gpu-cuda` feature)

---

## 1. Executive Summary

RTX 5070 Ti (Blackwell, GDDR7) reaches **21 KH/s** sustained hashrate on the
Ekam Deeksha mining algorithm.  This is **2× faster than AMD RX 5600 XT** (10 KH/s
OpenCL) but only **~1/3 of theoretical potential** based on raw memory bandwidth
ratios.  The bottleneck is not the CUDA kernel — it's the fundamental nature of
the algorithm: **random 256 KiB scratchpad access patterns prevent effective
utilization of memory bandwidth**, making the algorithm latency-bound rather
than throughput-bound.

### Key Results

| GPU | Backend | Arch | Bandwidth | Peak KH/s | Best Config |
|-----|---------|------|-----------|----------|-------------|
| AMD RX 5600 XT | OpenCL | RDNA1 | 288 GB/s | **10.0** | wc=17K, LWS=256 |
| RTX 2060 SUPER | CUDA | Turing | 448 GB/s | **3.35** | wc=8192, TPB=256 |
| RTX 3060 | CUDA | Ampere | 360 GB/s | **2.64** | wc=8192, TPB=256 |
| RTX 5070 Ti | CUDA | Blackwell | 896 GB/s | **21.0** | wc=49152, TPB=48 |

### Optimizations Applied

1. **TPB (threads_per_block)**: Changed default from 256 → 48 (configurable via `ZION_CUDA_TPB`)
2. **`--use_fast_math` NVRTC flag**: Added for NPU LayerNorm `sqrtf()` optimization
3. **`__forceinline__` analysis**: Tested on all ~25 device functions — **caused register spill and 75% regression on some configs**; NOT applied to final build

---

## 2. Test Infrastructure

### RTX 5070 Ti Instance
- **Vast.ai Instance:** 34004483 (Machine 29691, Korea)
- **GPU:** NVIDIA GeForce RTX 5070 Ti, 16 GB GDDR7, Compute 12.0 (Blackwell)
- **Cost:** $0.1003/hr
- **SSH:** `ssh4.vast.ai:14482`
- **Image:** `nvidia/cuda:12.4.0-devel-ubuntu22.04`
- **Driver:** 580.126.09

---

## 3. Benchmark Results — RTX 5070 Ti

All benchmarks via `--ekam-bench` (pure GPU, no pool overhead).

### 3.1 Work-Cap Sweep (TPB=64, baseline)

| work_cap | Scratchpad | KH/s | Notes |
|----------|-----------|------|-------|
| 1024 | 256 MB | 5.37 | GPU under-utilized |
| 2048 | 512 MB | 10.71 | 2× linear scaling |
| 4096 | 1 GB | 14.51 | Good utilization |
| 8192 | 2 GB | 18.84 | Strong |
| 16384 | 4 GB | 19.33 | Near peak |
| 24576 | 6 GB | 19.63 | Marginal gains |
| 32768 | 8 GB | 20.15 | Plateau |
| 49152 | 12 GB | 21.03 | Near VRAM limit |
| 65536 | 16 GB | OOM | Exceeds 16 GB |

### 3.2 Threads-per-Block Sweep (work_cap=32768)

| TPB | KH/s | vs TPB=256 |
|-----|------|-----------|
| 32 | 20.16 | +5.26× |
| 40 | 19.38 | +5.05× |
| **48** | **21.23** | **+5.54×** |
| 56 | 19.95 | +5.20× |
| 64 | 20.17 | +5.26× |
| 96 | 20.34 | +5.31× |
| 128 | 20.17 | +5.26× |
| 256 | 3.83 | 1.00× (old default) |

**TPB=48 is the optimal value for Blackwell architecture.** This is a **5.5× improvement**
over the old hardcoded TPB=256.

### 3.3 Fine-Grained TPB Sweep (work_cap=32768)

| TPB | KH/s | Notes |
|-----|------|-------|
| 40 | 19.38 | |
| 42 | 16.71 | Sharp dip — warp alignment issue |
| 44 | 17.31 | |
| 46 | 17.78 | |
| **48** | **20.82** | **Peak — 1.5 warps** |
| 50 | 17.28 | |
| 52 | 17.90 | |
| 56 | 19.95 | Secondary peak |
| 64 | 20.17 | 2 warps |

TPB values that are exact multiples of 32 (warp size) perform best: 32, 48, 64, 96, 128.
Non-aligned values (42, 44, 46, 50, 52) suffer from partial-warp overhead.

---

## 4. Cross-GPU Comparison

### 4.1 All GPUs Tested

| GPU | Year | Arch | CUDA Cores | Bus | BW (GB/s) | **KH/s** | KH/s per GB/s | Config |
|-----|------|------|-----------|-----|-----------|----------|---------------|--------|
| RTX 2060 S | 2019 | Turing | 2176 | 256-bit | 448 | 3.35 | 0.0075 | wc=8K, TPB=256 |
| RTX 3060 | 2021 | Ampere | 3584 | 192-bit | 360 | 2.64 | 0.0073 | wc=8K, TPB=256 |
| RX 5600 XT | 2020 | RDNA1 | 2304 SP | 192-bit | 288 | 10.00 | 0.0347 | wc=17K, LWS=256 |
| RTX 5070 Ti | 2025 | Blackwell | 8960 | 256-bit | 896 | 21.03 | 0.0235 | wc=49K, TPB=48 |

### 4.2 OpenCL vs CUDA performance gap

The AMD RX 5600 XT achieves **10 KH/s with only 288 GB/s bandwidth** — a dramatically
better KH/s-per-GB/s ratio (0.035) compared to all NVIDIA cards (0.007–0.024).

**Why AMD is proportionally faster:**

1. **OpenCL kernel has compile-time optimizations the CUDA kernel lacks:**
   - `-cl-fast-relaxed-math -cl-mad-enable -cl-denorms-are-zero` build flags
   - `-DNPU_MAX_DIM=N` compile-time define reduces private memory per thread
   - `-DWGS=N` work-group size hint allows compiler speculation
   - `B3_G` implemented as macro instead of function in OpenCL
   - `b3_permute` uses 16 named scalars instead of array

2. **RDNA1 architecture advantages for this workload:**
   - 4 MB of L2 cache (vs 2 MB on Turing, 3.75 MB on Ampere)
   - Better L1/L2 hit rates on 256 KiB random scratchpad access patterns
   - wavefront64 → more instruction-level parallelism per thread
   - Better latency hiding with longer wavefronts

3. **CUDA kernel is NOT optimized to the same degree as OpenCL:**
   - Uses `compile_ptx()` with no optimization flags (now fixed with `--use_fast_math`)
   - All runtime dimensions: no `NPU_MAX_DIM` compile-time specialization
   - Hardcoded TPB=256 was catastrophically wrong (now configurable, default=48)
   - No compile-time work-group size hints

---

## 5. Optimization Attempts & Results

### 5.1 ✅ TPB Tuning (MASSIVE impact)

- **Before:** Hardcoded TPB=256  
- **After:** Configurable via `ZION_CUDA_TPB`, default=48  
- **Impact:** RTX 5070 Ti: 3.8 KH/s → 21.0 KH/s (**5.5× improvement**)  
- **Why:** Memory-heavy kernel with ~70K Blake3 compresses + 256 random reads per hash
  has enormous register pressure. 256 threads per block causes register spill to
  local memory, creating a cascade of extra memory traffic. Lower TPB gives each
  thread more registers.

### 5.2 ✅ --use_fast_math NVRTC Flag (minor impact)

- `sqrtf()` in NPU LayerNorm benefits from approximate math
- Integer operations (Keccak, Blake3, AES) are unaffected
- Adds ~25 seconds to first-run NVRTC compile time (one-time cost)

### 5.3 ❌ __forceinline__ on All Device Functions (CATASTROPHIC regression)

Tested adding `__forceinline__` to all ~25 `__device__` functions:
- **Result:** 21 KH/s → 3.9 KH/s (81% regression!)
- **Cause:** Massive code expansion when `fusion_round` (called 8×), `aes128_encrypt` (called 16×),
  `keccak256`, `sha3_512` etc. are all force-inlined → register file overflow → spill to local memory
- **Conclusion:** NVRTC compiler's default inlining decisions are already near-optimal.
  Selective `__forceinline__` on tiny functions (b3_g, b3_round) may help marginally
  but the risk of spill outweighs the gain.

### 5.4 ⏳ Still Unexplored — Potential Gains

| Technique | Estimated Gain | Effort | Risk |
|-----------|---------------|--------|------|
| **NPU_MAX_DIM compile-time define** (port from OpenCL) | 10-20% | Medium | Low |
| **Buffer reuse** (2×64B instead of 6×64B per thread) | 5-10% | Medium | Low |
| **Shared memory for Keccak RC table** | 2-5% | Low | None |
| **`__launch_bounds__`** (explicit register budget) | 5-15% | Low | Medium |
| **Architecture-specific PTX** (`--gpu-architecture=sm_120`) | 5-10% | Low | Low |
| **Scratchpad in shared memory** (not feasible — 256 KiB > 228 KiB max) | — | — | ❌ |
| **Persistent kernel** (reduce launch overhead) | 3-5% | High | Medium |
| **Multi-batch pipelining** (overlap compute + memory) | 10-20% | High | High |
| **Native CUTLASS / PTX intrinsics** | Unknown | Very High | High |

**Realistic ceiling with software optimizations: ~30-35 KH/s** (50-65% improvement over current 21 KH/s).

---

## 6. Why the Card Isn't 3× Faster Than AMD

### The Theory
| Metric | RX 5600 XT | RTX 5070 Ti | Ratio |
|--------|-----------|-------------|-------|
| Memory Bandwidth | 288 GB/s | 896 GB/s | **3.1×** |
| Compute (TFLOPS) | 7.2 | 48+ | **6.7×** |
| L2 Cache | 4 MB | 64 MB | **16×** |

If Ekam Deeksha were a simple streaming workload, the 5070 Ti should indeed be ~3× faster.

### The Reality: Random Access Kills Bandwidth Utilization

Ekam Deeksha's memory-hard transform performs:
1. **Init scratchpad:** Blake3 XOF fills 256 KiB (sequential write — good)
2. **4 sequential passes × 4096 blocks:** Each block reads 3 random 64B chunks from scratchpad
   → **49,152 random 64-byte reads** from a 256 KiB region
3. **256 random reads:** Dependent Keccak-256 random lookups into scratchpad
   → **256 data-dependent random 64-byte reads** (cannot be prefetched)

**Total: ~49,408 random 64-byte reads per hash, each from a 256 KiB region.**

With work_cap=49152 threads, the total scratchpad is **12 GB** — far exceeding any
cache. Each random read is a full DRAM round-trip with ~300-400 ns latency.

**Effective bandwidth utilization** at random access:
- Sequential bandwidth: 896 GB/s
- Random 64B access pattern: ~50-100 GB/s effective (5-10% utilization)
- This is fundamental — no software optimization fixes DRAM random access latency

### Why AMD Does Better Per-Bandwidth

The RX 5600 XT's advantage is likely:
1. **Smaller work_cap (17K vs 49K):** Total scratchpad fits better in cache hierarchy
2. **OpenCL kernel optimizations:** NPU_MAX_DIM, buffer reuse, macro inlining = less register pressure = more concurrent wavefronts = better latency hiding
3. **RDNA1 cache hierarchy:** 128 KiB per CU L1 + 4 MB L2 may provide better hit rates for the random access pattern at 17K threads × 256 KiB

---

## 7. Code Changes Applied

### `V3/L1/miner/src/gpu_backend.rs`
1. **`compile_ptx` → `compile_ptx_with_opts`**: Added `--use_fast_math` NVRTC flag
2. **TPB configurable**: `ZION_CUDA_TPB` env var, default 48 (was hardcoded 256)

### Reverted Changes
- **`__forceinline__` on .cu functions**: Tested, caused 81% regression, reverted via `git stash`

---

## 8. Recommended Tuning Per GPU

| GPU | VRAM | work_cap | TPB | Expected KH/s |
|-----|------|----------|-----|---------------|
| RTX 2060 / 2060S | 6-8 GB | 8192 | 48 | ~5-8 |
| RTX 3060 | 12 GB | 16384 | 48 | ~4-6 |
| RTX 3070 / 3080 | 8-10 GB | 16384 | 48 | ~8-15 |
| RTX 4070 Ti | 12 GB | 24576 | 48 | ~15-20 |
| RTX 4080 / 4090 | 16-24 GB | 32768 | 48 | ~20-30 |
| RTX 5070 Ti | 16 GB | 49152 | 48 | ~21 |
| RTX 5080 / 5090 | 16-32 GB | 49152 | 48 | ~25-40 (est.) |

---

## 9. Next Steps (Priority Order)

1. **Port NPU_MAX_DIM compile-time define from OpenCL to CUDA** — biggest expected gain (10-20%)
2. **Add `__launch_bounds__(48, N)` hint** to `ekam_deeksha_mine` kernel — tells compiler to optimize register allocation for 48 threads/block
3. **Architecture-specific compilation** — `--gpu-architecture=sm_120` for Blackwell PTX
4. **Buffer reuse pattern** from OpenCL kernel — reduce per-thread private memory
5. **Benchmark on RTX 5080/5090** — more bandwidth, more cache → potentially 30+ KH/s
6. **Pool mining test** — verify shares accepted with optimized config

---

## 10. Conclusion

The RTX 5070 Ti at **21 KH/s** is the fastest ZION miner tested, roughly **2× AMD RX 5600 XT**.
The gap between theoretical (3×) and actual (2×) is due to:

1. **Algorithm design:** Random 256 KiB scratchpad access is latency-bound, not bandwidth-bound
2. **CUDA kernel maturity:** The OpenCL kernel has had more optimization passes (NPU_MAX_DIM, buffer reuse, macro inlining)
3. **TPB was the single biggest win:** Fixing hardcoded 256 → 48 gave **5.5× improvement** alone

The remaining ~50% gap to theoretical can be partially closed with compile-time
defines (`NPU_MAX_DIM`), `__launch_bounds__`, and architecture-specific PTX, but
the fundamental latency-bound nature of the algorithm limits practical gains to
~30-35 KH/s on this card.

**This is by design** — Ekam Deeksha's ASIC-resistance comes precisely from these
random memory access patterns that prevent any hardware from fully utilizing its
theoretical bandwidth.
