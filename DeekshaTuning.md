# Deeksha GPU/CUDA Tuning Report

**Date:** 2026-08-06
**Hardware:** GTX 1070 Ti (Pascal SM6.1, 19 SMs, 8GB GDDR5, 256-bit bus)
**Kernel:** `deeksha_lite_mine` (`V31/L1/miner/src/gpu/kernels/cuda/deeksha_lite.cu`)
**Algorithm:** Ekam Deeksha v2 — memory-hard PoW (128 KiB scratchpad/thread)

---

## Summary

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| GPU hashrate | 1.28 MH/s | 2.52 MH/s | **+97%** |
| TPB (threads/block) | 64 | 128 | 2× |
| work_size | 8192 | 4096 | 0.5× |
| output_hashes writes | 32 B/thread | 0 (eliminated) | — |
| VRAM (scratchpad) | 1 GB | 512 MB | 0.5× |
| `__launch_bounds__` | none | `(128, 8)` | — |

---

## Optimizations

### 1. `__launch_bounds__(128, 8)` on kernel

Added to `deeksha_lite_mine` kernel signature:

```cuda
extern "C" __launch_bounds__(128, 8) __global__ void deeksha_lite_mine(...)
```

Hints the compiler to optimize register allocation for 128 threads/block
with 8 blocks/SM. On GTX 1070 Ti (19 SMs) this allows up to 152 concurrent
blocks, improving occupancy and instruction-level parallelism.

### 2. TPB 64→128 (host code)

Host launch code was using `threads_per_block=64` while the kernel was
compiled with `TPB=128` internally. Mismatched TPB causes suboptimal block
configuration.

Added `OPTIMAL_TPB: u32 = 128` constant in `CudaDeekshaLiteMiner` module.
Both `mine_batch` and `mine_batch_raw` now default to 128 (overridable via
`ZION_CUDA_TPB` env var).

### 3. Eliminated `output_hashes` global memory writes

The kernel was writing 32 bytes per thread to `output_hashes` global memory
(4096 threads × 32 B = 128 KB per batch). The host **never reads this buffer** —
it only checks `result_nonce` and `result_hash`.

Removed the write loop from the kernel. The `output_hashes_buf` allocation was
reduced from `work_size * 32` bytes to 1 byte (kept for kernel ABI compatibility).

This eliminates ~128 KB of useless global memory writes per batch, reducing
memory bandwidth pressure on an already memory-bound kernel.

### 4. work_size tuned: 16384→4096

The deeksha_lite kernel is **memory-bound** (128 KiB scratchpad per thread).
Benchmarked 4 configurations:

| work_size | Scratchpad VRAM | Hashrate (MH/s) | vs baseline |
|-----------|-----------------|------------------|-------------|
| 2048      | 256 MB          | 2.43             | +90%        |
| **4096**  | **512 MB**      | **2.52**         | **+97%**    |
| 8192      | 1 GB            | 1.72             | +34%        |
| 16384     | 2 GB            | 1.01             | -21%        |
| 8192 (old, TPB=64) | 1 GB   | 1.28 (baseline)  | 0%          |

**Key insight:** Smaller work_size = less VRAM traffic per batch = better
L2 cache hit rate. The 16384 config saturates the 256-bit GDDR5 memory bus
(256 GB/s theoretical), causing a 2.5× slowdown vs 4096.

The optimal work_size=4096 uses only 512 MB VRAM (6.25% of 8 GB), leaving
plenty of headroom for display + other GPU tasks.

---

## Files Modified

| File | Change |
|------|--------|
| `V31/L1/miner/src/gpu/kernels/cuda/deeksha_lite.cu` | `__launch_bounds__(128, 8)`, removed output_hashes writes |
| `V31/L1/miner/src/gpu/mod.rs` | `OPTIMAL_TPB=128`, TPB defaults to 128, output_hashes_buf → 1 byte |
| `Start.sh` | `ZION_CUDA_WORK_CAP=4096`, `ZION_GPU_WORK_SIZE=4096` |

---

## Commits

- `bd8ccad7d` — Optimize CUDA deeksha_lite kernel + bump work_size to 16384
- `2452dedc6` — Fix GPU work_size: 16384→4096 (benchmark-proven 2.5x faster)

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_CUDA_WORK_CAP` | 4096 | Max GPU threads per kernel launch |
| `ZION_GPU_WORK_SIZE` | 4096 | Requested GPU threads per launch |
| `ZION_CUDA_TPB` | 128 | Threads per block (override) |
| `ZION_CUDA_MAXREG` | (unset) | `--maxrregcount` override for tuning |

---

## Tuning Guide for Other GPUs

| GPU | VRAM | Recommended work_size | Notes |
|-----|------|-----------------------|-------|
| GTX 1070 Ti | 8 GB | 4096 | Benchmark-proven optimal |
| GTX 1060 6GB | 6 GB | 4096 | Same SM architecture |
| GTX 1660 Ti | 6 GB | 4096 | Turing, try 8192 if bandwidth allows |
| RTX 3060 | 12 GB | 4096–8192 | Test both, GDDR6 has more bandwidth |
| RTX 4090 | 24 GB | 8192 | High bandwidth may allow larger batches |
| RX 5700 XT | 8 GB | 4096 | RDNA1, similar memory characteristics |

**Rule of thumb:** Start with 4096. If hashrate is stable and GPU util <90%,
try 8192. If hashrate drops, revert. The kernel is memory-bound, so more
threads ≠ more hashrate.

---

## Methodology

Benchmarks run against live Edge pool (`62.171.141.136:8444`) with trivial
target (every nonce passes). This measures raw kernel throughput, not
share-finding speed. Each configuration ran for 40 seconds with 5-second
log intervals, averaging 7+ hashrate samples.

```bash
RUST_LOG=info ZION_CUDA_WORK_CAP=4096 ZION_GPU_WORK_SIZE=4096 \
  zion-miner --pool 62.171.141.136:8444 --wallet <wallet> \
  --worker gpu-bench --gpu cuda --no-tui --log-interval 5
```
