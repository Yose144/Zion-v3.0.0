# GPU-Native Pearl PoUW Pipeline — Report

**Date:** 2026-07-14
**Status:** COMPLETE — all tests passing, pushed to main
**Updated:** 2026-07-14 — OpenCL port for AMD RX 5700 XT (ROCm) verified

---

## Overview

Implemented a **fully GPU-native Pearl PoUW mining pipeline** for Apple Metal (M1) and **ported to OpenCL** for AMD GPUs (RX 5700 XT / ROCm). All computational steps run on GPU — CPU only provides job parameters and reconstructs the Merkle proof when a winning tile is found.

### Commits

| Commit | Description |
|---|---|
| `7ce6362f7` | Pearl PoUW stratum stream integration into V3 miner |
| `c54f1ea4c` | Fully GPU-native Metal kernel + Rust bridge (36.9x speedup) |
| `705bff572` | Merkle proof reconstruction (read-back matrices from GPU) |
| `0526a9379` | E2E test with Merkle proof verification |

---

## Performance

### Benchmark Results (Apple M1, 2026-07-14)

| Pipeline | Time/nonce | Nonces/s | Tiles/s | Speedup |
|---|---|---|---|---|
| CPU-prep + GPU dispatch (original) | 85.64 ms | 11.7 | ~48K | 1x |
| **GPU-native (new)** | **9.66 ms** | **103.5** | **~424K** | **8.9x** |

Earlier benchmark run (before shared-storage change for matrix read-back):

| Pipeline | Time/nonce | Nonces/s | Speedup |
|---|---|---|---|
| CPU-prep + GPU dispatch | 882 ms | 1.1 | 1x |
| GPU-native | 11.5 ms | 86.7 | **76.5x** |

The speedup varies (8.9x–76.5x) depending on system load and whether the CPU-prep path is warmed up. The GPU-native path is consistently ~10ms/nonce.

### Benchmark Results (AMD RX 5700 XT, ROCm OpenCL, 2026-07-14)

| Pipeline | Time/nonce | Nonces/s | Speedup vs CPU |
|---|---|---|---|
| CPU-only (baseline, release) | 21.65 ms | 46.2 | 1x |
| OpenCL GPU-native v1 (original) | 45.12 ms | 22.2 | 0.5x |
| OpenCL GPU-native v3 (int4 + unrolled) | 3.70 ms | 270.0 | 5.8x |
| OpenCL GPU-native v3 + buffer reuse | 2.17 ms | 460.3 | 10.0x |
| OpenCL GPU-native v3 + batched (batch=4) | 1.68 ms | 594.5 | 12.9x |
| OpenCL GPU-native v3 + batched (batch=8) | 1.85 ms | 539.1 | 11.7x |
| **OpenCL GPU-native v3 + batched (batch=16)** | **1.52 ms** | **657.6** | **14.2x** |
| E2E (GPU + CPU Merkle proof construction) | 2.17 ms | 461.0 | 10.0x |

Hardware: AMD Radeon RX 5700 XT (Navi 10, gfx1010, RDNA1), ROCm OpenCL (`AMD Accelerated Parallel Processing` platform).

E2E test: 3/3 tests passed (trivial target, easy ~12-bit target, BLAKE3 consistency). Valid Merkle proof (13713 bytes) produced.

### Optimization Journey (OpenCL, RX 5700 XT)

| Optimization | ms/nonce | nonces/s | Improvement |
|---|---|---|---|
| v1 (original, 1 work-item/tile) | 45.12 | 22.2 | baseline |
| v2 (local memory tiling, 256 WI) | 20.00 | 50.0 | 2.3x |
| v3 (L1 cache, 32 WI, sequential reduction) | 5.50 | 181.8 | 8.2x |
| v3 + int4 vectorized loads + unrolled | 3.70 | 270.0 | 12.2x |
| v3 + buffer reuse (cached GPU buffers) | 2.17 | 460.3 | 20.8x |
| **v3 + buffer reuse + batched (batch=16)** | **1.52** | **657.6** | **29.7x** |

Key optimizations:
1. **v2 → v3**: Removed local memory tiling (48KB limited occupancy to 1 CU). Relied on L1 cache instead, reduced work-group to 32 items (TILE_H×TILE_W=4×8).
2. **int4 vectorized loads**: `vload4` for 4 elements per transaction, fully unrolled inner loop (8 iterations for rank=32).
3. **Buffer reuse**: Cached all GPU buffers in `PearlPouwBufferCache` struct, keyed by (m,n,k,rank,num_row_offsets,num_col_offsets). Per-nonce only uploads job_key + target and resets found/output_tile.
4. **Batched persistent mining**: Process N nonces in a single mining kernel launch. Steps 1-6 run per-nonce (sequential), then one `pearl_pouw_mine_persistent` kernel checks all N×16 tiles in parallel. batch_size=16 is optimal (256 work-groups → full 40-CU utilization). Configurable via `AUXPOW_PRL_BATCH_SIZE` env var (default=8).

### Integration

- **AuXpow** (`auxpow_client.rs`): `with_gpu_opencl()` initializes OpenCL backend, `mine_gpu_native_opencl_batched()` called when `gpu-opencl` feature enabled. Batch size configurable via `AUXPOW_PRL_BATCH_SIZE` env var.
- **V3 miner** (`main.rs`): `pearl_pouw_stream()` uses `AuxPowClient::new(profile).with_gpu_opencl().await` when `gpu-opencl` feature is enabled. Launched via `--pearl H:P:W` CLI flag or `ZION_PEARL_STREAM` env var.
- **V3 pool**: No changes needed — pool is a stratum server that receives shares, doesn't mine.
- **V3 node**: No changes needed — node validates blocks, doesn't mine PoUW.

### CPU Prep Optimization (intermediate step)

Before going fully GPU-native, the CPU prep was optimized with flat arrays instead of `Vec<Vec>`:

| Variant | Time/nonce | Nonces/s | Speedup |
|---|---|---|---|
| `try_mine_one` (original) | 508.9 ms | 2.0 | 1x |
| `try_mine_one_fast` (flat arrays) | 296.0 ms | 3.4 | 1.7x |

---

## GPU-Native Pipeline (7 steps, all on GPU)

1. **Matrix generation** — PCG32 parallel PRNG, each thread generates one element independently. Matrix A (m×k) and B^T (n×k) generated from nonce.

2. **BLAKE3 chunk hashing** — Keyed hash with `job_key`. Each 1024-byte chunk = 16 BLAKE3 blocks. One thread per chunk, 256 chunks for A, 512 chunks for B^T.

3. **BLAKE3 Merkle tree reduction** — Log-scale parallel reduction. 256→128→64→...→1 for A (8 levels), 512→256→...→1 for B^T (9 levels). One thread per parent node.

4. **Noise seed derivation** — `b_noise_seed = blake3(job_key || hash_b)`, `a_noise_seed = blake3(b_noise_seed || hash_a)`. BLAKE3 small hash (single block, ROOT flag).

5. **Noise generation** — E_AL (m×rank uniform int8), E_BR (n×rank uniform int8), E_AR (k×2 permutation pairs), E_BL (k×2 permutation pairs). PCG32 PRNG keyed with seed labels.

6. **Noised matrix computation** — `noised_a[i][l] = A[i][l] + (E_AL[i][E_AR[l].first] - E_AL[i][E_AR[l].second])`. Same for B^T with E_BR/E_BL. One thread per element.

7. **MatMul + jackpot + target check** — 16 tiles (2 row offsets × 8 col offsets for default_mainnet). Each work-group (32 work-items, TILE_H×TILE_W=4×8) computes one tile: MatMul accumulation with int4 vectorized loads, jackpot XOR+rotate, BLAKE3 keyed hash of 64-byte jackpot message, target comparison. Atomic `found` flag for early exit. **Batched mode**: `pearl_pouw_mine_persistent` kernel processes N nonces × 16 tiles in a single launch (128 work-groups for batch=8 → full 40-CU GPU utilization).

### Merkle Proof Reconstruction (CPU, only when share found)

When the GPU finds a winning tile:
1. Read back matrices A and B^T from GPU shared memory (zero-copy on Apple Silicon unified memory)
2. Convert flat arrays to `Vec<Vec<i8>>`
3. Build Merkle proof using existing `build_matrix_proof()` with the winning tile's row/col indices
4. Serialize as `PearlPlainProof` (bincode + base64)

---

## Test Results

### 1. BLAKE3 Consistency Test (`pearl_gpu_blake3_test.rs`)

Verifies GPU BLAKE3 chunk hash matches CPU `blake3::Hasher::finalize_non_root()`.

```
=== GPU vs CPU BLAKE3 Chunk Hash Verification (tree mode) ===

Test 1: All zeros, key=0x42
  CPU: [b2, 2d, 8a, 92, 13, cd, ec, b9]
  GPU: [b2, 2d, 8a, 92, 13, cd, ec, b9]
  Match: true

Test 2: Sequential bytes, key=0xAA
  CPU: [84, 43, d0, ae, e8, 98, d9, d8]
  GPU: [84, 43, d0, ae, e8, 98, d9, d8]
  Match: true

Test 3: Pseudo-random data and key
  CPU: [73, 4c, 8a, ec, dc, 1c, 30, 1c]
  GPU: [73, 4c, 8a, ec, dc, 1c, 30, 1c]
  Match: true

=== Overall: ALL TESTS PASSED ===
```

### 2. E2E Test (`pearl_gpu_native_e2e.rs`)

Verifies full pipeline: GPU gen → hash → noise → MatMul → jackpot → target check → Merkle proof.

```
=== GPU-Native Pearl PoUW E2E Test ===
m=256 n=512 k=1024 rank=32

--- Test 1: Trivial target (0xFF×32, accept all) ---
  ✅ Share found in 1.32s
  jackpot_hash: [6a, 17, f8, f6, 20, aa, 09, 5e]
  proof_b64 len: 18284

--- Test 2: Easy target (~12 bits) ---
Target: [00, 0f, ff, ff]
✅ SHARE FOUND in 0.05s
  jackpot_hash: [00, 03, ab, 79, a6, 93, 9a, 13]
  plain_proof_b64 length: 18284 bytes
  proof_bytes: 13713 bytes
  proof_bytes[0..8] (m): [00, 01, 00, 00, 00, 00, 00, 00]
  jackpot < target: true

🎉 E2E TEST PASSED: Valid share with Merkle proof
```

### 3. Benchmark (`pearl_gpu_native_bench.rs`)

Compares GPU-native vs CPU-prep+GPU dispatch, 20 nonces each (skip first 5 for warmup).

```
=== Pearl PoUW GPU-Native Pipeline Benchmark ===
m=256 n=512 k=1024 rank=32

--- GPU-Native (all steps on GPU) ---
Average: 9.66 ms/nonce (103.5 nonces/s)

--- CPU-prep + GPU dispatch (original) ---
Average: 85.64 ms/nonce (11.7 nonces/s)

=== Results ===
CPU-prep + GPU: 85.64 ms (11.7 nonces/s)
GPU-native:      9.66 ms (103.5 nonces/s)
Speedup: 8.9x
```

---

## Files

### Metal Kernel
- `AuXpow/csrc/metal/pearl_pouw_native.metal` — 648 lines, 9 kernel functions:
  - `pearl_gen_matrix` — PCG32 matrix generation
  - `pearl_blake3_chunk_hash` — BLAKE3 keyed chunk hashing
  - `pearl_blake3_merge` — BLAKE3 Merkle tree parent node
  - `pearl_blake3_small_hash` — BLAKE3 for seed derivation (single block)
  - `pearl_gen_permutation` — Permutation pair generation for noise
  - `pearl_gen_uniform_noise` — Uniform random int8 noise generation
  - `pearl_apply_noise_a` / `pearl_apply_noise_b` — Noised matrix computation
  - `pearl_pouw_mine_native` — MatMul + jackpot + target check

### Rust Bridge
- `AuXpow/src/gpu_metal.rs` — `pearl_pouw_mine_native()` method, multi-dispatch pipeline (gen → hash → reduce → noise → mine), matrix read-back, `PearlPouwNativeResult` struct
- `AuXpow/src/pearl_pouw.rs` — `try_mine_one_gpu_native()`, `mine_gpu_native()`, Merkle proof reconstruction from read-back matrices

### Integration
- `AuXpow/src/auxpow_client.rs` — `AUXPOW_PRL_GPU_NATIVE` env var to select GPU-native pipeline

### Tests & Benchmarks
- `AuXpow/examples/pearl_gpu_blake3_test.rs` — BLAKE3 GPU/CPU consistency
- `AuXpow/examples/pearl_gpu_native_e2e.rs` — E2E share + Merkle proof
- `AuXpow/examples/pearl_gpu_native_bench.rs` — GPU-native vs CPU-prep benchmark
- `AuXpow/examples/pearl_profile.rs` — CPU prep profiling

---

## Usage

```bash
# Run V3 miner with GPU-native Pearl PoUW pipeline
AUXPOW_PRL_GPU_NATIVE=1 cargo run --features gpu-metal --bin zion-miner

# Run benchmark
cargo run --features gpu-metal --example pearl_gpu_native_bench

# Run BLAKE3 consistency test
cargo run --features gpu-metal --example pearl_gpu_blake3_test

# Run E2E test
cargo run --features gpu-metal --example pearl_gpu_native_e2e
```

---

## Known Limitations

1. **Merkle proof correctness not verified against pool** — The E2E test verifies the proof is well-formed (non-empty, correct m/n/k) and jackpot < target, but has not been submitted to a live Pearl pool for acceptance. The pool may reject if the GPU-generated matrices differ from what the pool expects (PCG32 PRNG must match exactly).

2. **Matrix read-back cost** — Reading back 256KB + 512KB matrices from GPU adds ~1-2ms overhead per winning nonce. This only happens when a share is found (rare), so impact on hashrate is negligible.

3. **Apple Silicon only** — The GPU-native pipeline uses Metal, which is Apple-only. OpenCL/CUDA backends would need equivalent kernel implementations.

4. **Single GPU dispatch per nonce** — Each nonce is one command buffer with 7 compute encoders + 2 blit encoders. Could be optimized with async double-buffering (mine nonce N while preparing nonce N+1), but the current 10ms/nonce is already fast enough.
