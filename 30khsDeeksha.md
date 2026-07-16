# ZION GPU 30 KH/s Deeksha Settings — RX 5700 XT

**Date:** 2026-07-16
**GPU:** AMD RX 5700 XT (gfx1010, 6 GB VRAM, 18 CUs, RDNA)
**Achieved:** 28-30 KH/s (baseline 11.24 KH/s → **+150-167%**)

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
./target/release/zion-miner --pool 62.171.141.136:8444 --wallet zion1l5q4q4s3s5r6p3f6a568z5f75787d8d7c5kq0g4
```

### Benchmark command
```bash
ZION_GPU_WORK_SIZE=8192 ZION_BENCH_SECS=10 ./target/release/zion-miner --ekam-bench
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
