# ZION v3 Miner — Vega 64 / GCN s4_memhard GPU-CPU Mismatch

> **Status:** s4_mode is now the **default** for GCN. Full GPU pipeline (stages 1-6 on GPU) remains broken on GCN due to compiler bugs.
> **Date:** 2026-06-06
> **Target:** SMOS Rig 518837 (ZionRig) — AMD RX Vega 64 (gfx900, GCN 5.0)
> **Also applies to:** All AMD GCN (gfx6-9); RDNA (gfx10) uses full pipeline OK
> **Pool:** 77.42.71.94:8444 (Edge primary)
> **Latest stable release:** `v3.0.33-sm-fix`

---

## 1. Executive Summary

The `s4_memhard` GPU-CPU mismatch that plagued Vega 64 (and all AMD GPUs) was **not** an unsolvable AMD GCN compiler bug. The real root cause was a **consensus algorithm mismatch** between the GPU OpenCL kernel and the CPU Rust implementation:

| Component | Scratchpad Algorithm | Result |
|-----------|---------------------|--------|
| CPU L1 consensus (`deeksha.rs`) | **Blake3 XOF** (fast, ~8-12× faster) | Correct mainnet hash |
| GPU kernel (broken state) | **SHA3-512 chain** (slow, wrong) | Wrong hash → `GPU_MISMATCH` |

Additionally, the Blake3 XOF function in the GPU kernel had a critical bug where the output counter was hard-coded to `0` instead of incrementing per block, causing every 64-byte block of the scratchpad to be identical.

**Fixing both issues restored:**
- GPU self-test: **100% MATCH**
- RX 5600 XT hashrate: **8.44 KH/s** (was ~0.9 KH/s with broken SHA3)

---

## 2. Problem History

### Original Symptom (Vega 64)
```
SELF_TEST s1_keccak256=OK
SELF_TEST s2_sha3_512=OK
SELF_TEST s3_golden=OK
SELF_TEST s4_memhard=FAIL
  gpu=6c1e224f...  cpu=2c3739e1...
GPU_SELF_TEST_ERROR: GPU-CPU mismatch in self-test
```

### Earlier (Mis)Diagnosis
The issue was previously attributed to:
1. AMD GCN compiler bugs with 64-bit rotates (`ROL64`)
2. `keccak_f1600` inlining/optimization issues
3. `volatile` local variables
4. `__global` scratchpad alignment

**Current default:** GCN devices automatically use `s4_mode` (GPU stages 1-4, CPU stages 5-6). No env var needed. Full GPU pipeline can be forced with `ZION_NO_GCN_S4_MODE=1` (not recommended).

### Actual Root Cause (2026-06-06)
The GPU kernel had been silently switched from **Blake3** to **SHA3-512** in the scratchpad init/mix functions. The CPU consensus code never changed — it always used Blake3.

---

## 3. Architecture Comparison

### CPU Path (Rust) — Always Correct
```rust
// deeksha.rs → cosmic_harmony_ekam_deeksha_v2()
let s4 = memory_hard_transform_ekam_light_v2(&s3.data);
// └─→ scratchpad_ekam.rs
//     └─→ init_scratchpad_ekam()  → blake3::Hasher::new() + finalize_xof()
//     └─→ sequential_passes_ekam() → mix_block_ekam() → blake3 XOF mixing
```

### GPU Path (OpenCL) — Broken State
```c
// cosmic_harmony_deeksha.cl
void memory_hard_transform(const uchar input[64], __global uchar *pad, ...) {
    init_scratchpad(input, pad);        // ← SHA3-512 chain (WRONG!)
    sequential_passes(pad);              // ← SHA3-512 mix_block (WRONG!)
    random_read_mix_sha3(input, pad, ...);
}
```

The kernel still contained `ekam_init_scratchpad()` and `ekam_mix_block()` (Blake3) from the `db55e983` era, but the main entrypoints (`ekam_deeksha_mine`, `ekam_deeksha_mine_s4`) called the SHA3 versions instead.

---

## 4. Fix Details

### Fix A: Switch GPU Entrypoints to Blake3
**File:** `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl`

Changed all kernel entrypoints to call `ekam_memory_hard_transform()` (Blake3) instead of `memory_hard_transform()` (SHA3):

| Entrypoint | Before | After |
|-----------|--------|-------|
| `deeksha_mine` | `memory_hard_transform(s3, pad, s4)` | `ekam_memory_hard_transform(s3, pad, s4)` |
| `ekam_deeksha_mine` | `memory_hard_transform(buf_a, pad, buf_b)` | `ekam_memory_hard_transform(buf_a, pad, buf_b)` |
| `ekam_deeksha_mine_s4` | `memory_hard_transform(buf_a, pad, buf_b)` | `ekam_memory_hard_transform(buf_a, pad, buf_b)` |

### Fix B: b3_xof_fill_* Counter Bug
**File:** `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl`

The Blake3 XOF fill functions had `counter=0UL` hard-coded:
```c
// BROKEN — every 64B block is identical
b3_compress(co.input_cv, co.block_words, 0UL, co.block_len, co.flags | BLAKE3_ROOT, st);
```

Correct version passes the output block number:
```c
// FIXED — counter increments per 64B block
b3_compress(co.input_cv, co.block_words, (ulong)ob, co.block_len, co.flags | BLAKE3_ROOT, st);
```

**Impact:** With counter=0, the entire scratchpad was filled with the same 64-byte pattern repeated 4096 times. The random read positions were still "random" but all pointed to identical data. The resulting hash was deterministic but wrong.

### Fix C: Self-Test Reference
**File:** `V3/L1/miner/src/gpu_backend.rs`

The GPU self-test was comparing against `memory_hard_transform_ekam_light_v2_sha3()` (a debug-only SHA3 CPU function), not the actual mainnet Blake3 function. Changed to:
```rust
use zion_cosmic_harmony::scratchpad_ekam::memory_hard_transform_ekam_light_v2;
let cpu_s4 = memory_hard_transform_ekam_light_v2(&cpu_s3.data);
```

---

## 5. Results

### RX 5600 XT (RDNA, gfx1010:xnack-)
| Metric | Before (Broken SHA3) | After (Fixed Blake3) |
|--------|---------------------|---------------------|
| Self-test | FAIL s4_memhard | **MATCH** |
| Hashrate | ~0.9 KH/s | **8.44 KH/s** |
| Build opts | Conservative | Fast-relaxed-math safe |

### Vega 64 (GCN, gfx900)
| Metric | Before (Broken SHA3) | After (Blake3 + s4_mode) | After (Full GPU pipeline) |
|--------|---------------------|-------------------------|---------------------------|
| Mode | GPU s1-s4 + CPU NPU/fusion | GPU s1-s4 + CPU s5-s6 | Full GPU 6 stages |
| Self-test | FAIL s4 (ignored) | **MATCH** | **FAIL** stages 5-6 |
| Accepted shares | 0% | **15-25%** | 0% |
| Effective hashrate | ~0 H/s | **~50 H/s** | ~0 H/s |
| Build flags | `-cl-fast-relaxed-math` | `-cl-std=CL1.2` (conservative) | `-cl-std=CL1.2` |

**Note:** Vega 64 **requires s4_mode** (`ZION_GCN_S4_MODE=1`) for correct mining. Full GPU pipeline (stages 1-6 on GPU) fails due to additional GCN compiler bugs in NPU/fusion stages (pointer casts + 64-bit arithmetic).

---

## 6. How to Verify on Your Rig

### Step 1: Build latest miner
```bash
cd /root/zion-2.9.6-main/V3
cargo build --release -p zion-miner --features gpu-opencl
```

### Step 2: Run self-test
```bash
ZION_GPU_BACKEND=opencl ./target/release/zion-miner --ekam-bench 5
```

**Expected output:**
```
=== GPU SELF-TEST START ===
SELF_TEST s1_keccak256=OK
SELF_TEST s2_sha3_512=OK
SELF_TEST s3_golden=OK
SELF_TEST s4_memhard=OK
SELF_TEST s5_npu=OK
SELF_TEST s6_fusion=OK
SELF_TEST gpu_hash=... cpu_hash=... MATCH
=== GPU SELF-TEST END ===
```

### Step 3: Live mining test
```bash
ZION_POOL_ADDR=77.42.71.94:8444 \
ZION_WORKER_NAME=vega-test \
ZION_MINER_ID=rig-518837 \
ZION_LOOP_COUNT=1000000 \
ZION_GPU_BACKEND=opencl \
./target/release/zion-miner
```

Watch for:
- `share_accepted` messages
- Zero `GPU_MISMATCH` or `RejectedLowDifficulty`

### Step 4: Disable gcn_s4_mode (test if full GPU pipeline works)
```bash
# Unset the env var that forces s4-only mode
# (just don't set ZION_GCN_S4_MODE=1)
ZION_GPU_BACKEND=opencl ./target/release/zion-miner --ekam-bench 5
```

If self-test passes without `ZION_GCN_S4_MODE=1`, the full GPU pipeline works on your GCN card and you don't need the workaround.

---

## 7. Vega 64 Specific Notes

### Known GCN Quirks (Still Relevant)
Even with the Blake3 fix, GCN cards may still have these issues:

1. **`-cl-fast-relaxed-math`** — May still break on GCN (gfx6-9) due to aggressive FP→integer optimizations. RDNA (gfx10) handles it safely. If you see `GPU_MISMATCH` with fast-relaxed-math, remove it:
   ```bash
   ZION_OCL_BUILD_OPTS="-cl-std=CL1.2 -cl-mad-enable" ./zion-miner
   ```

2. **`local_work_size`** — GCN uses wave64. Default `local_ws=64` or `256` works best. RDNA prefers `128`.

3. **Work size cap** — Vega 64 has 8 GB HBM2. Default 25% VRAM gives `work_size=8192`. You can raise to 35% for better throughput:
   ```bash
   ZION_OCL_VRAM_PCT=35
   ```

### Why Full GPU Pipeline Fails on GCN
Even with Blake3 fixed and extensive pointer-cast / `long->int` fixes (v3.0.32-33), the full GPU pipeline (stages 1-6 on GPU) still produces **0% accepted shares** on GCN. The compiler bugs are deeper than initially suspected:

1. **Pointer casts** (`ulong *d = (ulong *)uchar_array`) — GCN generates wrong offsets/alignment
2. **64-bit arithmetic in NPU LayerNorm** (`long sum`, `long var_sum`) — overflow handling differs from CPU
3. **`fusion_round` pointer casts** — multiple `ulong*` casts in AES key/plaintext setup
4. **Additional suspected issues** — `npu_mix_packed` GELU, `ekam_memory_hard_transform` block indexing, or other subtle compiler optimizations

**Resolution:** After multiple attempted fixes, `s4_mode` (GPU stages 1-4, CPU stages 5-6) is now the **default and only supported path** for GCN. The full GPU pipeline is not viable on GCN at this time.

**Workaround:** s4_mode routes stages 5-6 to CPU (Rust), which handles 64-bit arithmetic and memory layouts correctly. Acceptance: **~10-15%** on Vega 64.

### If s4_memhard Still Fails on Vega 64
If s4_mode still fails self-test on your specific Vega 64:

1. Check driver version: `clinfo | grep "Driver Version"`
2. Verify s4_mode is active in logs: `gpu_opencl_init ... gcn_s4_mode=true`
3. Try conservative build flags:
   ```bash
   ZION_OCL_BUILD_OPTS="-cl-std=CL1.2 -cl-mad-enable"
   ```
4. Force full pipeline (debug only, not recommended):
   ```bash
   ZION_NO_GCN_S4_MODE=1
   ```
5. If still failing, the card may need a newer amdgpu-pro / ROCm driver

---

## 8. Key Files

| File | Purpose |
|------|---------|
| `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl` | OpenCL kernel (Blake3 + Keccak) |
| `V3/L1/cosmic-harmony/src/scratchpad_ekam.rs` | CPU reference (Blake3 XOF) |
| `V3/L1/miner/src/gpu_backend.rs` | GPU backend, self-test, build opts |
| `V3/L1/miner/src/test_kernel_versions.rs` | Kernel comparison benchmark |

---

## 9. Quick Commands

```bash
# Build
 cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl --bin zion-miner

# Benchmark
 ZION_GPU_BACKEND=opencl ./V3/target/release/zion-miner --ekam-bench 10

# Live mine
 ZION_POOL_ADDR=77.42.71.94:8444 ZION_WORKER_NAME=vega ZION_MINER_ID=rig1 ZION_LOOP_COUNT=1000000 ZION_GPU_BACKEND=opencl ./V3/target/release/zion-miner

# s4_mode is now default for GCN — no env var needed
# To force full pipeline (GCN debug only, NOT recommended):
 ZION_NO_GCN_S4_MODE=1 ZION_GPU_BACKEND=opencl ./V3/target/release/zion-miner

# Check clinfo
 clinfo | grep -E "Device Name|Driver Version|Max compute units"
```

---

## 10. SMOS Deployment Notes

When deploying to SimpleMining OS rigs:

1. **Binary name:** SMOS expects executable named `miner` inside ZIP root folder
2. **glibc compatibility:** Build with `cargo zigbuild` for older glibc (2.28 instead of 2.32+)
3. **GitHub CDN caching:** Use unique ZIP filenames per version (e.g., `zion-sm3031.zip`) to avoid stale cached binaries
4. **API token:** SMOS API uses `X-AUTH-TOKEN` header, endpoint `api.simplemining.net`
5. **Group config update:** `PUT /rig-groups/{id}` with `{"minerOptions": "<zip_url> <flags>"}`
6. **Cache clear:** Execute command `rm -rf /root/miner/custom_* /root/miner/custom_miner.zip` then reload

## 11. Timeline of Fixes

| Date | Commit | Change | Impact |
|------|--------|--------|--------|
| 2026-04-11 | `0cb6efba` | Added `gcn_s4_mode` workaround | Vega 64 mines at ~200 H/s |
| 2026-06-06 | `13922cbd` | RDNA lws=128, remove printf, revert fast-relaxed-math | RX 5600 XT: 3.2 KH/s |
| 2026-06-06 | `ad19b26d` | **Restore Blake3 scratchpad, fix b3_xof counter** | RX 5600 XT: 8.44 KH/s |
| 2026-06-06 | `04bfdbc8` | Route `mine_batch` through `s4_kernel.is_some()` instead of `is_gcn` | Fixes unconditional s4 routing |
| 2026-06-06 | `1b8f5582` | Conservative OpenCL build flags for GCN (remove fast-relaxed-math) | Vega 64: 0% → 15-25% accepted |
| 2026-06-06 | `50cec770` | GCN kernel workarounds: `ulong→uint` counter, noinline, remove pointer casts | Blake3 stability on GCN |
| 2026-06-06 | `ebf87158` | Remove pointer casts in full GPU pipeline `ekam_deeksha_mine` + `cosmic_fusion_ekam` | Testing full pipeline again |
| 2026-06-06 | `9f1f3d9f` | **Conditional GCN/RDNA kernel compilation** | RX 5600 XT: **9.27 KH/s** (benchmark) |
| 2026-06-06 | `9f1f3d9f` | GCN full pipeline pointer-cast + LayerNorm `long->int` fixes | Full pipeline still 0% acceptance on GCN |
| 2026-06-06 | `9c4b0a1f` | **Revert kernel to v3.0.31; make s4_mode default for GCN** | Vega 64: ~10-15% acceptance (stable) |

---

## 12. Conditional GCN/RDNA Kernel Compilation (2026-06-06)

### Problem
Commit `50cec770` added GCN workarounds (byte-level operations, noinline, uint counter) that fixed GCN but **slowed down RDNA** unnecessarily. The workarounds were applied to all AMD GPUs, causing RDNA performance degradation.

### Solution
**File:** `V3/L1/miner/src/gpu_backend.rs`

Added conditional compilation based on GPU architecture:

```rust
// Detect GCN for conditional workarounds in kernel
// RDNA (gfx10+) should NOT use GCN workarounds
let dev = device_name.to_ascii_lowercase();
let is_gcn = dev.contains("gfx6") || dev.contains("gfx7") || dev.contains("gfx8") || dev.contains("gfx9")
    || dev.contains("vega") || dev.contains("polaris")
    || dev.contains("fiji") || dev.contains("tonga")
    || dev.contains("ellesmere");

if is_gcn {
    opts.push_str("-DZION_GCN_WORKAROUNDS ");
}
```

**File:** `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl`

Wrapped GCN-specific workarounds in `#ifdef ZION_GCN_WORKAROUNDS` blocks:

```c
#ifdef ZION_GCN_WORKAROUNDS
// GCN-safe helper functions (byte-level operations)
ulong ulong_from_bytes(const uchar *bytes) { ... }
void ulong_to_bytes(ulong value, uchar *bytes) { ... }

// Byte-level memory operations in mix_block, keccak_absorb, XOR operations
uint counter instead of ulong in b3_compress
__attribute__((noinline)) on critical functions
int instead of long in LayerNorm and isqrt_floor
#else
// RDNA fast path: ulong-width operations, ulong counters, long arithmetic
#endif
```

### Results

| GPU | Architecture | Benchmark | Pool Mining | Build Options |
|-----|--------------|-----------|-------------|---------------|
| RX 5600 XT | RDNA (gfx1010:xnack-) | **9.27 KH/s** | 1.13 KH/s | `-cl-std=CL1.2 -cl-mad-enable` |
| Vega 64 | GCN (gfx900) | ~50 H/s (s4_mode) | ~50 H/s | `-cl-std=CL1.2 -cl-mad-enable -DZION_GCN_WORKAROUNDS` |

### Key Changes
- **GCN devices** (gfx6-9, Vega, Polaris, Fiji, Tonga): Use conservative byte-level operations
- **RDNA devices** (gfx10+): Use fast ulong-width operations without workarounds
- **Build flags**: Both use `-cl-std=CL1.2 -cl-mad-enable` (fast-relaxed-math removed for stability)

### Work Size Optimization
Due to 256 KiB scratchpad per thread, VRAM limits work_size:

| Work Size | Scratchpad | Benchmark | Notes |
|-----------|------------|-----------|-------|
| 6128 | 1532 MiB | 9.27 KH/s | **Optimal for 6 GB VRAM** |
| 16384 | 4096 MiB | 3.05 KH/s | Higher VRAM usage, lower efficiency |
| 20480 | 5120 MiB | 0.66 KH/s | Too large, causes thrashing |

**Configuration for RX 5600 XT:**
```bash
ZION_GPU_WORK_SIZE=6128
ZION_OCL_WORK_CAP=6128
ZION_OCL_VRAM_PCT=50
```

---

*Generated with Devin — Session 2026-06-06.*
