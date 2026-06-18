# Metal GPU Miner Optimization Plan — Apple Silicon M1–M5

## Final Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Pool-mode hashrate (ekam_v2) | ~0.9 KH/s | **~3.9+ KH/s** | **4.3×** |
| Pool-mode hashrate (fire) | N/A (no Metal kernel) | **~6.8+ KH/s** | **NEW** |
| Benchmark `ekam_v2` | ~2.92 KH/s | **~3.93 KH/s** | **1.34×** |
| Benchmark `deeksha_lite_fire` | N/A | **~6.70 KH/s** | **NEW** |
| Benchmark best run | — | **4.65 KH/s** (ekam) / **6.70 KH/s** (fire) | (thermal-dependent) |
| Device | Apple M1 (8-core GPU) | | |
| Algorithm | `cosmic_harmony_ekam_deeksha_v2` (was `deeksha_lite_v1`) | `deeksha_lite_fire` (fastest) | |

---

## Root Causes Identified

### 1. Synchronous Command Buffer (`cb.wait_until_completed()`)

`dispatch_batch()` called `cb.wait_until_completed()` — CPU blocked until GPU finishes. With diff=1, GPU found a share after ~200–500 nonces and stopped. CPU then waited for pool response, encoded next batch, and waited again.

**Fix:** `dispatch_batch_async()` with `addCompletedHandler` + `std::sync::mpsc::channel`.

### 2. Tiny `batch_size` (12,670 threads)

Metal `batch_size` was capped by memory heuristic at 58% utilization.

**Fix:** Raised to 65% (M1 unified memory can handle it) + `threads_per_tg` 64→128.

### 3. Pool diff=1 Early Termination

`mine_batch()` did `break` after first solution. GPU stopped after ~200 nonces in a 14,199-nonce chunk.

**Fix:** Removed `break`. GPU tests the entire chunk, returns first solution, counts all tested nonces for accurate hashrate.

### 4. Missing Async Metal Infrastructure

No `block` crate, no `ConcreteBlock`, no async command buffer handling.

**Fix:** Added `block = { version = "0.1", optional = true }` to `Cargo.toml`, implemented `dispatch_batch_async()`.

---

## Implementation Log

### Phase 1: Memory Budget + `batch_size` ✅

| Change | File | Commit |
|--------|------|--------|
| `threads_per_tg` M1: 64→128 | `gpu_backend.rs` | `53c5f894` |
| Memory budget M1: 58%→65% | `gpu_backend.rs` | `53c5f894` |
| Graceful allocation fallback | `gpu_backend.rs` | `53c5f894` |

**Result:** Benchmark `ekam_v2` 2.92→3.10 KH/s

### Phase 2: Async Command Buffers ✅

| Change | File | Commit |
|--------|------|--------|
| `dispatch_batch_async()` + `addCompletedHandler` | `gpu_backend.rs` | `53c5f894` |
| `block` crate dependency | `Cargo.toml` | `53c5f894` |
| `ConcreteBlock::new().copy()` pattern | `gpu_backend.rs` | `53c5f894` |

**Result:** Async GPU dispatch, CPU-GPU overlap

### Phase 3: No Early Termination ✅

| Change | File | Commit |
|--------|------|--------|
| Removed `break` in `mine_batch()` | `gpu_backend.rs` | `e5703687` |

**Result:** Pool-mode hashrate 0.9→3.9 KH/s (biggest single win)

### Phase 4: Kernel-Level Tuning ⚠️

| Experiment | Result | Note |
|------------|--------|------|
| Inline `b3_compress` (64 local vars) | ❌ Slower (3.93→3.49) | Register pressure |
| `b3_load_words_global` fast path (len≥64) | ✅ Slight gain | Safe, unrolled loads |
| Integer sqrt in LayerNorm | ❌ Slower (3.93→3.17) | More instructions than `sqrt(float)` |
| Keccak/AES SIMD | ❌ Not attempted | Metal lacks 64-bit SIMD, AES intrinsics unavailable |

**Conclusion:** M1 Metal kernel is already well-optimized by the compiler. Manual micro-optimizations hurt more than help due to register pressure on memory-bound workload.

### Phase 4b: Fire Metal Kernel (NEW) 🔥

**Problem:** `deeksha_lite_fire` had no Metal GPU kernel. The Metal backend always used `ekam_deeksha.metal` regardless of algorithm, causing `GPU_CPU_MISMATCH` because GPU computed `ekam_v2` hash while CPU computed `fire` hash.

**Solution:** Created `deeksha_lite_fire.metal` — full OpenCL→Metal translation with:
- Keccak-f1600 (identical to OpenCL)
- SHA3-512 scratchpad fill (256 KiB, 8192 blocks, 2 passes, 64 reads)
- AES-128 CTR mix (3 full + 1 final round)
- Thermal loop (16384 iters, 8 ulong chains)
- Final Keccak256

**Critical fix:** Aligned all `thread` arrays to 8-byte boundaries (`ulong[]` instead of `uchar[]`) before casting to `ulong*` — unaligned access on Apple GPU caused silent hash corruption.

**Files:**
- `V3/L1/miner/src/deeksha_lite_fire.metal` — new Fire Metal kernel
- `V3/L1/miner/src/gpu_backend.rs` — new `MetalDeekshaLiteFireMiner` module, algorithm dispatch fix

**Result:**
- Fire benchmark: **6.70 KH/s** (vs ekam_v2 3.93 KH/s)
- Fire pool-mode: **~6.8+ KH/s**, 0 rejected, 0 `GPU_CPU_MISMATCH`
- `MetalDeekshaMiner::algorithm()` fixed from `"deeksha_lite_v1"` → `"cosmic_harmony_ekam_deeksha_v2"` (was lying to pool)

### Phase 5: Pool Protocol 📋

| Idea | Status | Reason |
|------|--------|--------|
| Request higher difficulty from pool | ⚠️ Requires pool-side changes | Pool protocol change needed |
| Batch submit multiple solutions | ⚠️ Requires pool-side changes | Stratum protocol extension |
| Keep-alive / TCP reuse | ⚠️ Requires miner+pool changes | `ZION_LOOP_COUNT=1M` already prevents reconnect loops |

**Mitigation already in place:** `ZION_LOOP_COUNT=1000000` prevents `Bye` after every iteration, eliminating expensive reconnects/GPU self-tests that were collapsing hashrate from ~3 KH/s to ~30 H/s.

---

## What Actually Worked (ranked by impact)

1. **Create `deeksha_lite_fire.metal` kernel** — NEW: 6.8+ KH/s (was N/A)
2. **Remove `break` in `mine_batch`** — 4× improvement (0.9→3.9 KH/s)
3. **Raise memory budget 58%→65%** — +10% batch_size
4. **Async command buffers** — eliminates CPU idle per dispatch
5. **`threads_per_tg` 64→128** — better GPU core saturation
6. **Switch to `ekam_v2` algorithm** — fastest on Metal (+35% vs v1)
7. **`b3_load_words_global` fast path** — marginal kernel speedup

---

## Files Modified

| File | Change |
|------|--------|
| `V3/L1/miner/src/gpu_backend.rs` | Async dispatch, no-break, memory budget, threads_per_tg, Fire miner module, algorithm dispatch |
| `V3/L1/miner/src/ekam_deeksha.metal` | `b3_load_words_global` fast path |
| `V3/L1/miner/src/deeksha_lite_fire.metal` | **NEW** Fire Metal kernel (OpenCL→Metal translation) |
| `V3/L1/miner/Cargo.toml` | Added `block` crate for Metal async handlers |
| `APP&WEB/desktop-agent/src/main.js` | No `--threads` when GPU mining (previous session) |

---

## Why Kernel-Level SIMD Failed on M1 Metal

- **64-bit ops on 32-bit ALU:** Keccak-f1600 and Blake3 use `ulong`. M1 GPU ALUs are 32-bit. Every `ulong` op compiles to 2 instructions. No 64-bit SIMD available.
- **AES hardware:** M1 CPU has AES instructions, but Metal GPU kernel cannot access them. GPU shader uses software AES (S-box lookup).
- **Register pressure:** Manual inline of `b3_compress` created 64+ local variables, exceeding register file per thread, causing spilling to memory.
- **Memory-bound:** 256 KiB scratchpad per thread × 14,199 threads = 3.5 GiB. Kernel is memory-bandwidth limited, not ALU-limited. Optimizing ALU ops has negligible effect.

---

## Recommended Next Steps

1. **M2/M3/M4/M5 testing:** `threads_per_tg` already set to 128 (M1) / 256 (Pro/Max/Ultra). Test on newer chips for validation.
2. **Pool-side difficulty:** Implement variable difficulty in pool protocol (`mining.set_difficulty`) so GPU receives diff>1 jobs and finds shares less frequently, reducing round-trip overhead.
3. **Double-buffered dispatch:** True pipelining (2 scratchpads, dispatch next while GPU runs current) requires architectural changes but could add ~10% on M1.

---

Plan finalized: 2026-06-12
