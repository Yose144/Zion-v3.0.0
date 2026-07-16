# ZION Mining Optimization Report — 2026-07-16

## Hardware

| Component | Spec |
|-----------|------|
| GPU | AMD RX 5700 XT (gfx1010, 6 GB VRAM, 18 CUs, RDNA) |
| CPU | AMD Ryzen 5 3600 (6C/12T, AVX2, AES-NI, SHA-NI, PCLMUL) |
| RAM | ~30 GB, 768 huge pages |
| OS | Ubuntu 24.04, ROCm OpenCL |

---

## Phase 1: CPU Auto-Tuning (commit `25281df20`)

### What was done

- **CPU detection** in `gpu_backend.rs`: reads `/proc/cpuinfo` (Linux), `sysctl` (macOS), `wmic` (Windows) for vendor, model, physical/logical cores
- **CPU architecture classification**: `CpuArch` enum (AmdZen, IntelCore, AppleSilicon, Other)
- **`auto_tune_verushash()`**: per-architecture thread count + nonce batch size:
  - AmdZen: `logical.min(physical+6)`, nonce 5M/2M/1M by thread count
  - IntelCore: `logical.min(physical+4)`, same nonce scaling
  - AppleSilicon: `physical-1` if GPU active, same nonce scaling
  - Other: `physical` only, same nonce scaling
- **`AutoTuneResult`** struct extended with CPU fields
- **`MinerConfig`** extended with `verushash_nonce_count` field
- **`--auto-tune` CLI** shows CPU model, cores, nonce_count
- **`Start.sh`** updated: `ZION_EXT_CPU_NONCE_COUNT` auto-tuned (commented out)

### Benchmark

| Metric | Value |
|--------|-------|
| VRSC (VerusHash) | 12.14 MH/s |
| Accepted / Rejected | 58 / 0 (100%) |

### Files modified

- `V3/L1/miner/src/gpu_backend.rs` — CPU detection, auto_tune_verushash
- `V3/L1/miner/src/main.rs` — MinerConfig, ext_cpu_thread, CLI output
- `TripleStream_AutoTune.md` — new §4b section
- `Desktop/Start.sh` — auto-tune comments

---

## Phase 2: Crash Protection (commit `67ce28eb1`)

### What was done

- **Signal handler** (`crash_handler` module in `main.rs`): catches SIGABRT (exit 134) and SIGSEGV (exit 139) from AMD OpenCL driver crashes, writes crash log to `/tmp/zion-miner-crash.log`
- **Watchdog restart loop** in `Start.sh`: monitors exit codes, auto-restarts miner on crash with configurable delay (`ZION_RESTART_DELAY=5`) and max restarts (`ZION_MAX_RESTARTS=999999`)
- **`serde` dependency** added to `Cargo.toml` (needed by `PoolStreamConfig` deserialize from external commit)
- **Build fixes** for external commit `f6d6abf73`: `ExternalCoin::protocol()` match for 8 new coins (KLS, ZCL, QTC, VTC, IRON, NEXA, RTM, DNX), `AtomicBool::store()` missing bool argument

### Benchmark

| Metric | Value |
|--------|-------|
| ZION GPU | 12.25 KH/s |
| VRSC CPU | 11.25 MH/s |
| Accepted / Rejected | 91 / 0 (100%) |

---

## Phase 3: GPU Kernel Optimization (commits `e54950dfb`, `7ba4d5ea8`)

### Bottleneck analysis

The `deeksha_lite.cl` kernel is **compute-bound on `fill_scratchpad`** — 8192 sequential SHA3-512 calls per thread. The original `sha3_512()` function used a generic loop with conditional branch per byte (`if (++pos == 72)`), wasting ALU cycles on branch prediction.

### Optimizations applied

1. **`sha3_512_65()` — specialized SHA3-512 for 65-byte input** (commit `e54950dfb`):
   - Eliminates 65 conditional branches per call (×8192 calls = 532,480 branches/thread eliminated)
   - Vectorizes state zeroing (25 × u64) and output copy (64 bytes) via `ulong4` vload/vstore
   - Direct byte-by-byte absorption unrolled (no loop, no pos check)
   - Input always fits in one Keccak block (rate=72 > 65), so no mid-absorption permutation needed

2. **`sequential_passes` register caching** (commit `7ba4d5ea8`):
   - Cache previous/next block in register during forward/backward passes
   - Halves global memory reads (3→2 accesses per iteration)
   - Eliminates branch for wrap-around index calculation

3. **`keccak_f1600` always_inline** (commit `7ba4d5ea8`):
   - Forces consistent inlining across all call sites

4. **`#pragma unroll 2` on fill_scratchpad loop** (uncommitted):
   - Allows compiler to overlap global memory writes with Keccak computation

### Benchmark results

| Version | ZION KH/s | Improvement |
|---------|-----------|-------------|
| Original (baseline) | 11.24 | — |
| + sha3_512_65 specialized | 19.42 | +73% |
| + sequential_passes cache + inline | 20.40 | +82% |
| + #pragma unroll 2 | 20-22 | +78-96% |

### Correctness verification

- 3/3 shares accepted, 0 rejected on live pool (62.171.141.136:8444)
- GPU self-test passes at epoch 83
- Hash output matches CPU reference implementation

### Work size experiments

| Work Size | KH/s | Notes |
|-----------|------|-------|
| 4096 | 5.28 | Too few wavefronts |
| 8192 | 19-22 | **Optimal** (18 CUs × 512 = 9216 → nearest pow2) |
| 16384 | 8.81 | VRAM pressure (4 GB scratchpad), worse occupancy |

**Conclusion**: 8192 is optimal for RX 5700 XT (18 CUs). The auto-tune formula `nearest_pow2(CUs × 512)` is correct.

---

## Phase 4: CPU Feature Detection + Build System (uncommitted)

### What was done

- **`cpu_features.rs`** module: runtime CPU feature detection (XMRig-style) using `is_x86_feature_detected!` — detects AES-NI, SSE4.2, AVX, AVX2, BMI1/2, FMA, AVX-512, PCLMUL, POPCNT
- **`ZION_CPU_TARGET` env var** in `AuXpow/build.rs` and `V3/L1/native-ffi/build.rs`:
  - `native` (default): `-march=native` (optimal for build machine)
  - `x86-64`: baseline (portable, for SMOS rigs with Pentium G4560)
  - `x86-64-v2`: SSE4.2 + POPCNT (2009+)
  - `x86-64-v3`: AVX2 + BMI1/2 + FMA (2013+ Haswell/Zen)
- Prevents SIGILL on CPUs without AVX/BMI2 when building with `ZION_CPU_TARGET=x86-64`

---

## Summary of commits

| Commit | Description |
|--------|-------------|
| `25281df20` | CPU auto-tuning per architecture (VerusHash threads + nonce_count) |
| `67ce28eb1` | Crash handler (SIGABRT/SIGSEGV) + serde dep + build fixes |
| `e54950dfb` | **SHA3-512 specialization — 73% ZION GPU hashrate gain** |
| `7ba4d5ea8` | Sequential passes register caching + keccak inline |

---

## Current performance (RX 5700 XT + Ryzen 5 3600)

| Algorithm | Hashrate | Status |
|-----------|----------|--------|
| ZION (deeksha_lite_v1, GPU) | 19-22 KH/s | ✅ Optimized |
| VRSC (VerusHash v2.2, CPU) | 12.14 MH/s | ✅ Auto-tuned |
| XMR (RandomX, CPU) | TBD | 🔜 Next |

---

## Next steps plan

### 1. XMR (Monero/RandomX) tuning — PRIORITY

- Benchmark current RandomX hashrate on Ryzen 5 3600
- Tune thread count (should be 6 physical cores for RandomX — no SMT benefit)
- Configure huge pages (768 already allocated)
- Test RandomX dataset memory (1:1 mode vs light mode)
- Optimize `ZION_CPU_TARGET=native` for AVX2/AES-NI paths in RandomX
- Target: 500+ H/s on Ryzen 5 3600 (reference: XMRig gets ~500 H/s)

### 2. Work size fine-tuning for ZION GPU

- Test work_size=6144 (non-power-of-2, closer to 18×512=9216)
- Test local_work_size=64 vs 128 vs 256 with auto-tune override
- Test `-cl-fast-relaxed-math` build flag (currently disabled due to AMD crash risk — retest)
- Test `-cl-uniform-work-group-size` build flag

### 3. Double-buffered async readback (GPU)

- Current: blocking readback of 256KB hash buffer per chunk
- Proposed: double-buffer with `clEnqueueReadBuffer` async + `clEnqueueMarker` overlap
- Expected: +15-25% by hiding readback latency behind next kernel launch
- Implementation: two output_hashes_buf, ping-pong between them

### 4. GPU-side target check (revisit)

- Previous attempt was slower (atomic contention on RX 5700 XT)
- Revisit with reduced atomic pressure: per-work-group local atomics → single global atomic
- Or: GPU-side early-exit via sentinel value (skip readback if no match)

### 5. DeekshaLite Fire (thermal) algorithm

- Benchmark `deeksha_lite_fire` with optimized SHA3-512
- May benefit from same `sha3_512_65` specialization
- Test thermal loop impact on hashrate vs heat output

### 6. Multi-coin profit switching

- 8 new ExternalCoin variants added (KLS, ZCL, QTC, VTC, IRON, NEXA, RTM, DNX)
- Need profit router benchmarks for each on this hardware
- Most won't work on 6GB VRAM (DAG too large) — focus on non-DAG coins
