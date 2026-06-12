# Metal GPU Miner Optimization Plan — Apple Silicon M1–M5

## Current State (Baseline)

| Metric | Value |
|--------|-------|
| Device | Apple M1 (8-core GPU) |
| Algorithm | `deeksha_lite_v1` |
| Pool | 77.42.71.94:8444 (diff=1) |
| Current hashrate (pool) | ~0.9 KH/s |
| Benchmark hashrate | ~3.8 KH/s |
| Gap | **4.2×** |

## Root Causes Identified

### 1. Synchronous Command Buffer (`cb.wait_until_completed()`)

In `gpu_backend.rs:2633`, `dispatch_batch()` calls `cb.wait_until_completed()` — CPU blocks until GPU finishes. With diff=1, GPU finds a share after ~200–500 nonces and stops. CPU then waits for pool response, encodes next batch, and waits again. Massive idle time.

### 2. Tiny `batch_size` (12,670 threads)

Metal `batch_size` is capped by memory heuristic (`max_scratch_bytes / 262_144`). For M1 with 8GB shared RAM at 58% utilization: ~23,000 max. But actual is 12,670 due to `work_size` clamping. GPU has 8 cores × many ALUs — it can handle much more concurrent work.

### 3. No CPU/GPU Overlap

While GPU runs one chunk, CPU is idle. While CPU waits for pool, GPU is idle. No pipelining.

### 4. Pool diff=1 Early Termination

Pool sends diff=1 jobs. GPU finds share quickly, miner breaks out of `mine_batch` loop, submits share, waits for new job. Round-trip latency ~100–200ms dominates total time.

### 5. Missing Metal-Specific Tuning

- `gpu-tuning-config.json` has NO Metal section (only CUDA/OpenCL)
- `threads_per_tg` is fixed: M1=64, M2+=128, Pro/Max=256
- No use of `MTLCommandBuffer` pipelining or `MTLFence`
- No async result reading with `addCompletedHandler`

---

## Optimization Plan

### Phase 1: Increase `batch_size` & Memory Budget (Quick Win)

- **Increase M1 memory budget** from 58% → 75–80% (M1 has unified memory, "GPU memory pressure" is less relevant than on discrete GPUs)
- **Remove `work_size` clamp** — let Metal use full available threads
- **Expected gain**: batch_size 12,670 → ~25,000 (2×)
- **Expected hashrate**: ~0.9 → ~1.5 KH/s

### Phase 2: Asynchronous Command Buffers (Big Win)

- **Remove `cb.wait_until_completed()`** from `dispatch_batch`
- **Use `addCompletedHandler`** or `MTLFence` for result notification
- **Double-buffer**: prepare next batch while GPU runs current
- **CPU prep overlaps GPU execution**
- **Expected gain**: eliminates ~5–10ms per-batch CPU idle
- **Expected hashrate**: ~1.5 → ~2.2 KH/s

### Phase 3: Pipeline Multiple Batches (Major Win)

- **Submit N command buffers** (e.g. 3–4) to GPU queue before waiting
- **Each CB gets different nonce range**
- **GPU never idle** — as soon as one batch finishes, next starts
- **CPU collects results asynchronously**
- **Expected gain**: masks pool latency, keeps GPU saturated
- **Expected hashrate**: ~2.2 → ~3.0+ KH/s

### Phase 4: Algorithm Tuning for Metal / ARM

- **Keccak-f1600**: ARM NEON has dedicated SHA3 instructions — Metal kernel uses generic `ulong` ops. Could vectorize with SIMD groups.
- **AES rounds**: M1 has AES hardware acceleration. Metal `uchar` S-box lookup is slow. Could use `aesenc` via inline assembly or MPS.
- **Scratchpad access pattern**: 256 random reads × 256 KiB — optimize for Metal tile memory (shared threadgroup memory) to cache hot scratchpad regions.
- **Expected gain**: 10–20% kernel speedup
- **Expected hashrate**: ~3.0 → ~3.5 KH/s

### Phase 5: Pool Protocol Optimization

- **Request higher difficulty** from pool (if supported) — reduces early termination frequency
- **Local batching**: accumulate multiple solutions before sending (if pool supports)
- **Keep-alive connection**: reduce TCP reconnect overhead
- **Expected gain**: less protocol overhead
- **Expected hashrate**: ~3.5 → ~3.8 KH/s (benchmark parity)

---

## Implementation Order

1. Phase 1 — memory budget + batch_size (30 min)
2. Phase 2 — async command buffers (1–2 h)
3. Phase 3 — pipelining (2–3 h)
4. Phase 4 — kernel tuning (4–6 h)
5. Phase 5 — pool protocol (1 h)

Total estimate: **1–2 days** for full 4× speedup.

## Files to Modify

| File | Change |
|------|--------|
| `V3/L1/miner/src/gpu_backend.rs` | Async dispatch, pipelining, batch_size |
| `V3/L1/miner/src/ekam_deeksha.metal` | Kernel optimizations (SIMD, tile memory) |
| `APP&WEB/desktop-agent/gpu-tuning-config.json` | Add Metal section |
| `APP&WEB/desktop-agent/src/main.js` | Remove `--threads` CLI arg (DONE) |
| `V3/L1/miner/src/main.rs` | Pool batching, difficulty negotiation |

---

## Success Metrics

| Phase | Target Hashrate |
|-------|-----------------|
| Baseline | 0.9 KH/s |
| After Phase 1 | 1.5 KH/s |
| After Phase 2 | 2.2 KH/s |
| After Phase 3 | 3.0 KH/s |
| After Phase 4 | 3.5 KH/s |
| After Phase 5 | 3.8 KH/s |

---

Plan created: 2026-06-12
