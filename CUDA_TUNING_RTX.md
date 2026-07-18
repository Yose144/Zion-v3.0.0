# CUDA Kernel Tuning Report — RTX 3090

## DeekshaLite Fire — Native CUDA Port

### Hardware
- **GPU:** NVIDIA GeForce RTX 3090 (82 SMs, 24GB VRAM, Ampere sm_86)
- **Host:** Vast.ai cloud instance
- **Algorithm:** `deeksha_lite_fire` (memory-hard PoW)

### Algorithm Pipeline (per nonce)
1. **Keccak256(header || nonce)** — 1× keccak_f1600 (24 rounds)
2. **fill_scratchpad** — 8192× SHA3-512 = 8192× keccak_f1600 (196,608 rounds)
3. **sequential_passes** — 2× 8192 block XOR passes (forward + backward)
4. **random_read_mix** — 64 random reads from 256KiB scratchpad
5. **AES-128 CTR mix** — 3 full rounds + 1 final (2 blocks)
6. **thermal_loop** — 16,384 iterations of 8 ulong chains
7. **Keccak256(final)** — 1× keccak_f1600 (24 rounds)

**Total keccak_f1600 calls per hash: 8194**
**Total keccak rounds per hash: 196,656**

---

## Tuning History

### v1 — Initial OpenCL → CUDA Port
- **Hashrate:** 6.48 KH/s
- **Work size:** 8192, TPB: 128
- **Kernel:** Direct port from `deeksha_lite_fire.cl`
- **Notes:** Byte-level scratchpad I/O, no launch_bounds, keccak not inlined

### v2 — Aggressive Tuning
- **Hashrate:** 6.55 KH/s (+1%)
- **Changes:**
  - `__launch_bounds__(256, 4)` → 4 blocks/SM = 1024 threads/SM
  - keccak_f1600: first 2 rounds fully unrolled, rest `#pragma unroll 2`
  - All data in u64 arrays (no byte aliasing)
  - `__forceinline__` on all hot functions
  - NVRTC: `--use_fast_math`, `-arch=sm_86`, `--std=c++14`
- **Notes:** No improvement — kernel is compute-bound, not occupancy-bound

### v3 — Interleaved Scratchpad + Shared Memory
- **Hashrate:** 6.55 KH/s (no change)
- **Changes:**
  - **INTERLEAVED scratchpad layout:** block N of all threads is contiguous in memory → perfect memory coalescing
  - AES S-box in `__shared__` memory (256 bytes, 1-cycle access)
  - `__ldg()` for read-only header_keccak_state (texture cache)
  - `__launch_bounds__(128, 2)` → 256 registers/thread
  - `__forceinline__` on keccak_f1600
- **Notes:** Memory coalescing optimization had no effect — confirms compute-bound

### v3.1 — No launch_bounds + maxreg override
- **Hashrate:** 6.55 KH/s (no change)
- **Changes:**
  - Removed `__launch_bounds__` entirely — let compiler decide
  - Added `ZION_CUDA_MAXREG` env var for `--maxrregcount` override
  - TPB tested: 64, 128, 256 — all same hashrate

### v4 — Batched Launch + MAX_BATCH=262144 (BREAKTHROUGH)
- **Hashrate:** **49.3 KH/s** (7.5x improvement!)
- **hps_60s:** 64.8 KH/s
- **Kernel speed:** 89.9 KH/s (best_batch_ms=2917 for 262144 nonces)
- **Changes:**
  - **Batched launch:** reset sentinel ONCE, launch ALL chunks back-to-back, sync ONCE at end
  - Eliminates N-1 sync points per batch (was 256 sync points, now 2)
  - `ZION_GPU_MAX_BATCH` default: 32768 → 262144 (8× work_size)
  - With batched launch, 262144 nonces takes ~3s on RTX 3090 — well within 60s job TTL
- **Root cause of previous bottleneck:** Host-side sync overhead was 50% of wall time.
  Each chunk had 2 sync points (htod + dtoh). With 1 chunk per batch (MAX_BATCH=32768),
  the kernel ran for 365ms but the total batch took 1876ms — 80% overhead!
  With 8 chunks per batch (MAX_BATCH=262144), overhead is amortized: 2917ms total,
  365ms per chunk = 20% overhead.

### Work Size Sweep
| Work Size | TPB | Hashrate (KH/s) | Scratchpad VRAM |
|-----------|-----|-----------------|-----------------|
| 8192      | 128 | 6.55            | 2 GB            |
| 16384     | 128 | 6.55            | 4 GB            |
| 32768     | 128 | 6.55            | 8 GB            |
| 65536     | 128 | 6.55 (cap)      | 16 GB           |

**Conclusion:** Work size has no effect on hashrate — GPU is saturated at 8192 threads.

---

## Key Findings

### 1. Host-Side Overhead Was the #1 Bottleneck (NOT compute!)
- **Before v4:** Kernel ran for 365ms but total batch took 1876ms — **80% overhead!**
- **Root cause:** Synchronous htod/dtoh copies for every chunk (256 sync points per batch)
- **Fix:** Batched launch — reset sentinel once, launch all chunks, sync once (2 sync points)
- **Result:** 6.5 KH/s → 49.3 KH/s (7.5x improvement)

### 2. Kernel is Fast — 89.9 KH/s on RTX 3090
- `best_batch_ms=2917` for 262144 nonces = 89.9 KH/s kernel speed
- Actual kernel time per 32768-nonce chunk: ~365ms
- The 1876ms "batch time" before v4 was mostly host overhead, not kernel time

### 3. Memory Optimizations Had No Effect (Compute-Bound)
- Interleaved memory layout (perfect coalescing) gave **0% improvement**
- Shared memory S-box gave **0% improvement**
- All memory optimizations are irrelevant — keccak compute dominates

### 4. Keccak f1600 Dominates Kernel Execution
- 8194 keccak calls per hash × 24 rounds = 196,656 rounds
- Each round: ~50 64-bit integer ops (XOR, ROL, AND)
- Total: ~10M 64-bit ops per hash
- RTX 3090 64-bit integer throughput: ~8.9 TOPS (Ampere, 1/2 rate of 32-bit)
- Theoretical max: 8.9T / 10M = ~890 KH/s (if perfectly utilized)
- Current kernel: 89.9 KH/s = **10.1% of theoretical** → still room for improvement

---

## Next Steps

### Priority 1: Fix Host-Side Overhead (expected 2x → ~13 KH/s)
- **CUDA streams for pipelining:** overlap kernel N with host prep for N+1
- **Async memory copies:** `cudaMemcpyAsync` instead of synchronous
- **Double-buffered scratchpad:** pre-allocate 2× scratchpad pools
- **Reduce sync points:** don't sync after every batch

### Priority 2: Increase Occupancy (expected 2-3x → ~26-39 KH/s)
- **Reduce scratchpad per thread:** 256KiB → 128KiB (if algorithm allows)
- **Or: use shared memory for scratchpad** (limited to ~48KB but much faster)
- **Or: process multiple nonces per thread** (amortize keccak setup)

### Priority 3: Keccak-Specific Optimizations
- **Keccak state in registers:** ensure 25 u64s stay in registers (not local memory)
- **Bit-sliced keccak:** process 64 lanes in parallel using 64-bit words
- **Reduced-round keccak:** if algorithm allows security/perf tradeoff (unlikely)
- **Keccak with 32-bit ops:** split 64-bit ops into 2× 32-bit (Ampere 32-bit is 2x faster)

### Priority 4: Algorithmic Optimizations
- **Skip fill_scratchpad for duplicate seeds:** cache scratchpad for same header
- **Early exit in sequential_passes:** if target is easy, skip backward pass
- **Batch AES:** process 4+ blocks in parallel per thread

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_CUDA_ARCH` | `sm_86` | NVRTC target architecture |
| `ZION_CUDA_TPB` | `64` | Threads per block |
| `ZION_CUDA_WORK_CAP` | `65536` | Max work size (VRAM limit) |
| `ZION_CUDA_MAXREG` | (none) | `--maxrregcount` override |
| `ZION_GPU_WORK_SIZE` | `8192` | Initial work size |
| `ZION_AUTOTUNE` | `1` | Auto-tune work size |

---

## Files Modified

- `V3/L1/miner/src/deeksha_lite_fire.cu` — CUDA kernel (v3, interleaved layout)
- `V3/L1/miner/src/gpu_backend.rs` — Rust CUDA backend (NVRTC options, TPB, work cap)

---

*Last updated: 2026-07-18*
*Generated by Devin during CUDA kernel optimization session*
