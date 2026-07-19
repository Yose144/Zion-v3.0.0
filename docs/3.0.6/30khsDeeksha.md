# ZION GPU 30 KH/s Deeksha Settings — RX 5700 XT

**Date:** 2026-07-16 (updated 2026-07-16 with nonce_count fix + batch processing fix)
**GPU:** AMD RX 5700 XT (gfx1010, 6 GB VRAM, 18 CUs, RDNA)
**Achieved:** 28-32 KH/s peak, 17-20 KH/s sustained (baseline 11.24 KH/s → **+50-185%**)

---

## ⚠️ Critical fix #1 (2026-07-16): nonce_count default

**Root cause of "only 10 KH/s" in production:**

The default `nonce_count` was 1024 — far too small for GPU mining.
With `work_size=8192`, the double-buffered async readback path
(the +50% optimization) only activates when `nonce_count > work_size`.
With `nonce_count=1024`, double-buffering was **never activated**,
resulting in ~10 KH/s instead of 28-30 KH/s.

**Fix:** `nonce_count` default is now `4 × gpu_work_size` (32768 for
RX 5700 XT) when GPU is available. Also `nonce_count_min` is now
`max(work_size, 10000)` to prevent the nonce autotune from shrinking
below the GPU work_size.

```bash
# In start-local-miner.sh:
export ZION_NONCE_COUNT=32768       # 4× work_size (8192)
export ZION_NONCE_COUNT_MIN=10000   # don't shrink below GPU work_size
```

The miner binary also auto-sets these defaults if env vars are not
specified, so the fix works even without the start script.

---

## ⚠️ Critical fix #2 (2026-07-16): full batch processing + batch cap

**Root cause of "only 6-12 KH/s" in live mining despite fix #1:**

Two issues were found in the double-buffered `mine_batch` path:

1. **Early break on solution found:** When the GPU found a solution
   in the first chunk (8192 nonces), the code would `break` and return
   immediately, skipping the remaining 31/32 of the batch. With pool
   difficulty=1 (vardiff start), every nonce is a valid solution, so
   only 8192 nonces were tested per batch instead of 262144. This
   meant the double-buffering pipeline never filled, and most time was
   spent on submit/new-job overhead (~600ms per 8192 nonces = ~13 KH/s).

2. **Stale jobs with large batches:** When processing the full 262144
   nonces, each batch took 11-15 seconds. By the time the batch finished,
   the pool had moved to a new block height, making the share stale
   (42% reject rate).

**Fix:**

- **Removed early break** in both double-buffer and single-buffer
  `mine_batch` paths (OpenClDeekshaLiteMiner + OpenClDeekshaLiteFireMiner).
  The GPU now processes ALL chunks in the batch, collecting solutions
  from each. This keeps the double-buffering pipeline full and the
  GPU never idle.

- **Added `ZION_GPU_MAX_BATCH` cap** (default 32768 = 4x work_size)
  in `gpu_scan_job()`. Even if the pool sends `nonce_count=262144`,
  the miner processes only 32768 nonces per batch (~1-2 seconds),
  then loops back for a fresh job. This eliminates stale shares while
  keeping the double-buffering pipeline full.

```bash
# In start-local-miner.sh:
export ZION_GPU_MAX_BATCH=32768    # cap batch to 4x work_size
```

**Results (live mining, pool difficulty=1):**
- Before fix: 6-12 KH/s, 42% reject rate (stale jobs)
- After fix:  17-20 KH/s sustained, 31.6 KH/s peak, 100% accept rate
- Peak batch: 32768 nonces in 1036ms = 31.6 KH/s

---

## Optimizations applied (3 commits)

### 1. SHA3-512 specialization for 65-byte input (commit `e54950dfb`)
- `sha3_512_65()` in `deeksha_lite.cl` — eliminates 65 conditional branches per call
- Unrolled byte absorption, vectorized state zero + output copy
- `fill_scratchpad` updated to use `sha3_512_65()` with vectorized 64-byte state copy
- **Gain:** 11.24 → 19.42 KH/s (+73%)

### 2. Sequential passes register caching + inline keccak (commit `7ba4d5ea8`)
- Cache prev/next block in register (`ulong4 prev_v/next_v`) — halves global memory reads
- `keccak_f1600` marked `__attribute__((always_inline))`
- **Gain:** 19.42 → 20-22 KH/s (+82-96%)

### 3. Double-buffered async readback (commit `a6d8ad35d`)
- Two output buffers (A/B) + dedicated read queue
- While GPU computes chunk N+1, CPU processes chunk N's results from async read event
- Hides DMA readback latency + AMD driver `clFinish()` overhead behind GPU compute
- **Gain:** 20-22 → 28-30 KH/s (+50%)

---

## Key settings

### Environment variables
```bash
# GPU work size — optimal for 18 CUs (nearest pow2 of 18×512=9216)
export ZION_GPU_WORK_SIZE=8192

# Local work size — 128 is optimal (64→10.19, 256→9.01 KH/s)
# Auto-tuned, no override needed

# Double-buffering (enabled by default, disable for debugging)
# export ZION_GPU_NO_DOUBLE_BUFFER=1   # uncomment to disable

# Benchmark batch size (default 4× work_size to exercise double-buffering)
# export ZION_GPU_BENCH_BATCH=4

# VRAM percentage (default auto-tuned)
# export ZION_OCL_VRAM_PCT=60
```

### Build command
```bash
cd V3
cargo build --release --bin zion-miner --features full,native-hashers
```

### Run command
```bash
../../target/release/zion-miner --pool 62.171.141.136:8444 --wallet zion1l5q4q4s3s5r6p3f6a568z5f75787d8d7c5kq0g4
```

### Benchmark command
```bash
ZION_GPU_WORK_SIZE=8192 ZION_BENCH_SECS=10 ../../target/release/zion-miner --ekam-bench
```

---

## Work size benchmarks

| Work Size | KH/s | Notes |
|-----------|------|-------|
| 4096 | 5.28 | Too few wavefronts |
| **8192** | **28-30** | **Optimal** (18 CUs × 512 = 9216 → nearest pow2) |
| 16384 | 8.81 | VRAM pressure (4 GB scratchpad), worse occupancy |

**Formula:** `nearest_pow2(CUs × 512)` — auto-tuned by `GpuTuning::auto_tune()`

---

## Files modified

| File | Changes |
|------|---------|
| `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl` | `sha3_512_65()`, `fill_scratchpad`, `sequential_passes` cache, `keccak_f1600` inline |
| `V3/L1/miner/src/gpu_backend.rs` | `OpenClDeekshaLiteMiner` struct (added `output_hashes_buf_b`, `read_queue`), `new()` (2nd buffer + read queue), `mine_batch()` (double-buffered async path with OpenCL events), `benchmark()` (4× batch) |
| `AuXpow/src/gpu_miner.rs` | `#[derive(Clone)]` on `FishhashDag` (build fix) |

---

## Double-buffered async readback — how it works

```
Time →
GPU:  [== kernel N ==][== kernel N+1 ==][== kernel N+2 ==]
DMA:                   [== read N ==][== read N+1 ==]
CPU:                                 [scan N][scan N+1]
```

1. Enqueue kernel N on compute queue → get kernel event
2. Enqueue async read on read queue (depends on kernel event, `block(false)`) → get read event
3. Flush compute queue (GPU starts immediately)
4. Wait for PREVIOUS read event → process results (GPU computing current chunk in parallel)
5. Swap buffer index (A↔B), repeat

**OpenCL API used:**
- `kernel.cmd().enew(&mut k_event).enq()` — non-blocking kernel with event
- `buffer.read().queue(&read_queue).ewait(&k_event).enew(&mut r_event).block(false).enq()` — async read on separate queue
- `event.wait_for()` — block only when processing previous chunk

---

## Why the gain is larger than expected (+50% vs predicted +15-25%)

1. AMD OpenCL driver's `clFinish()` has ~50-100 µs overhead per call beyond actual DMA time
2. Blocking readback was causing GPU pipeline to drain completely between chunks
3. With async readback, GPU pipeline stays full — no bubble between chunks
4. Separate read queue allows driver to overlap DMA with compute without contention

---

## Correctness verification

- 3/3 pool shares accepted, 0 rejected on live pool (62.171.141.136:8444)
- GPU self-test passes at epoch 83
- Hash output matches CPU reference implementation
- SEH guards preserved on all OpenCL operations
- Solution found early correctly drains read queue to avoid stale events

---

## Full optimization history

| Step | KH/s | vs baseline |
|------|------|-------------|
| Baseline (original) | 11.24 | — |
| + sha3_512_65 specialization | 19.42 | +73% |
| + sequential_passes cache + inline | 20-22 | +78-96% |
| **+ double-buffered async readback** | **28-30** | **+150-167%** |
