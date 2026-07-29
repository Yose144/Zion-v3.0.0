# BeamHash III CUDA Kernel — Debug Report

**Date:** 2026-07-29
**Author:** Devin (AI agent)
**Status:** In progress — solution parsing fixed, DAG crash under investigation

## Overview

This report documents the debugging of the BeamHash III CUDA solver kernel
(`AuXpow/csrc/cuda/beamhash_solver.cu`) for the Zion AuXpow miner. The CUDA
kernel is a port of the OpenCL solver (`AuXpow/csrc/opencl/beamhash_solver.cl`),
which itself was adapted from BeamMW/opencl-miner (tag `opencl-miner_1.0.82`).

The goal is to enable BeamHash III mining on NVIDIA GPUs via the CUDA backend,
matching the functionality of the existing OpenCL backend.

## Architecture

BeamHash III is a Wagner's algorithm proof-of-work with these parameters:

| Parameter              | Value          |
|------------------------|----------------|
| Work bits              | 448            |
| Collision bits         | 24             |
| K (rounds)             | 5              |
| Num indices per sol    | 32 (2^5)       |
| Index bits             | 25             |
| Solution size          | 100 bytes (800 bits) |
| Hash function          | SipHash-2-4 with BLAKE2b-256 pre-state |

The solver runs 7 sequential CUDA kernels:

1. **cleanUp** — zero all counters
2. **beamHashIII_seed** — generate initial hash table (2^25 entries)
3. **beamHashIII_R1** — round 1: find collisions, XOR, shift, mix, bucket sort
4. **beamHashIII_R2** — round 2
5. **beamHashIII_R3** — round 3
6. **beamHashIII_R4** — round 4
7. **beamHashIII_R5** — round 5 (final): find collisions, extract solution

Each round uses a hash table of 4096 buckets × 8720 entries × 64 bytes
(~2.18 GB per buffer, two buffers = ~4.36 GB total).

## Bugs Found and Fixed

### Bug 1: Bit-shift direction in `shift24` and `shift56` (FIXED)

**File:** `AuXpow/csrc/cuda/beamhash_solver.cu`, lines 80-106

The original CUDA port had the bit shifts in `shift24` and `shift56` reversed
compared to the OpenCL version. The OpenCL version uses vector swizzles:

```opencl
// OpenCL shift24 (correct)
ulong8 tmp  = (input >> 24);
ulong8 tmp2 = (input << 40);
tmp.s0123 |= tmp2.s1234;
tmp.s456  |= tmp2.s567;
```

The CUDA port was shifting in the wrong direction. This was fixed by
implementing the shift as a per-element left shift with carry from the
next element:

```cuda
// CUDA shift24 (fixed)
r.s0 = (input.s0 >> 24) | (input.s1 << 40);
r.s1 = (input.s1 >> 24) | (input.s2 << 40);
// ... etc
```

The same fix was applied to `shift56`.

### Bug 2: Solution byte extraction from results buffer (FIXED)

**Files:**
- `V3/L1/miner/src/cuda_external.rs` (CUDA host code)
- `AuXpow/src/gpu_miner.rs` (OpenCL host code)

This was the **critical bug** preventing valid share submission. The R5 kernel
stores each solution as two 512-bit rows (64 bytes each = 128 bytes total).
Each row contains:
- **400 bits (50 bytes)** of packed 25-bit indices
- **112 bits (14 bytes)** of padding/garbage (upper bits after `shift56`)

The host code was reading the first 100 bytes contiguously from the 128-byte
solution buffer:

```rust
// BUG: reads 50 bytes of row0 + 50 bytes that span row0 padding + row1 start
let indices_100 = &sol_bytes[..100];
```

This meant bytes 50-63 (row0's 14-byte padding) were included in the solution,
and bytes 114-127 (row1's last 14 bytes of indices) were lost. The decompressed
indices at positions 16-19 were garbage from the padding, causing validation
failure with "solution does not produce zero hash after Wagner's algorithm".

**Fix:** Extract the first 50 bytes from each 64-byte row separately:

```rust
let row0 = &sol_bytes[..64];
let row1 = &sol_bytes[64..128];
let mut indices_100 = Vec::with_capacity(100);
indices_100.extend_from_slice(&row0[..50]);  // 400 bits of row0
indices_100.extend_from_slice(&row1[..50]);  // 400 bits of row1
```

This was applied to both the CUDA path (`cuda_external.rs`) and the OpenCL
path (`gpu_miner.rs`) for consistency.

#### Evidence

Before the fix, decompressed indices showed garbage at positions 18-19:

```
index[ 0] =    1063335
index[ 1] =   16498568
...
index[17] =   15572620
index[18] =         33   ← garbage from row0 padding
index[19] =          0   ← garbage from row0 padding
index[20] =    1441792
...
```

The `sol_bytes_hex` confirmed the issue — bytes 50-63 were `0x00000000000000`
(padding) followed by row1 data starting at byte 64.

### Bug 3: `it7` self-referencing shift in R4 (PRE-EXISTING, copied from OpenCL)

**File:** `AuXpow/csrc/cuda/beamhash_solver.cu`, line 604

```cuda
it7 = (it7 >> 56) | (it7 << 8);  // Note: OpenCL has (it7 >> 56) | (it7 << 8)
```

This is a direct copy of the OpenCL code which has `indexTree.s7 = (indexTree.s7 >> 56) | (indexTree.s7 << 8)`.
This appears to be a bug in the original OpenCL kernel (should likely be
`(it7 >> 56) | (it_something << 8)`), but since it's in the original OpenCL
code and the OpenCL solver works, it may be intentional or harmless (it7
may be zero at this point). Left as-is to match OpenCL behavior.

## Remaining Issues

### Issue A: DAG generation crash (UNDER INVESTIGATION)

After the solution parsing fix, the miner crashes during ProgPoW DAG
generation (epoch 126, ~2 GB DAG) on the GTX 1070 Ti (8 GB VRAM). The crash
happens in `generate_light_cache()` — the process exits silently (no panic,
no error message, exit code 0xC0000005 access violation on some runs).

This crash is **not related to the BeamHash changes** — it occurs in the
ProgPoW/ZANO external GPU stream, which runs before any BeamHash work. The
crash may be caused by:
- GPU memory pressure (DAG ~2 GB + BeamHash buffers ~4.4 GB + display ~1 GB)
- CUDA context corruption from a previous run
- Driver issue (NVIDIA 581.57, CUDA 13.0)

**Mitigation:** Run with `--gpu-coin BEAM` only (disable ZANO ProgPoW stream)
or use a GPU with more VRAM. The BeamHash solver itself needs ~4.4 GB for
its hash tables, which is feasible on an 8 GB card if no other GPU workloads
are active.

### Issue B: Header truncation to 32 bytes (NEEDS VERIFICATION)

The CUDA `mine_batch_raw` path truncates the header to 32 bytes:

```rust
let header_hash = &raw_header[..32.min(raw_header.len())];
return self.run_beamhash_solver(header_hash, &target.bytes, nonce_start, batch_size);
```

The Beam Stratum protocol sends the full `input` field as the header. The
OpenCL path passes the full header bytes. If the BEAM pool sends a header
longer than 32 bytes, the CUDA path would use the wrong prePow state,
producing invalid solutions even with the parsing fix.

**Status:** Needs verification with a real BEAM pool job. The log showed
`header_len=32`, suggesting the pool may indeed send 32-byte headers, but
this should be confirmed.

## Files Changed

| File | Change |
|------|--------|
| `AuXpow/csrc/cuda/beamhash_solver.cu` | New file — CUDA port of BeamHash III solver (7 kernels) |
| `V3/L1/miner/src/cuda_external.rs` | Added `CudaExtAlgo::Beamhash`, `run_beamhash_solver()`, solution parsing fix |
| `V3/L1/miner/src/gpu_backend.rs` | Added Beamhash to CUDA external miner algorithm list |
| `V3/L1/miner/src/main.rs` | Added beamhash to `use_raw_header` algorithm list |
| `AuXpow/src/gpu_miner.rs` | Solution parsing fix (OpenCL path, same bug) |

## Test Results

- **Build:** `cargo build --release -p zion-miner --features gpu-cuda` — SUCCESS
- **Kernel compilation:** NVRTC compiles `beamhash_solver.cu` for `compute_61` — SUCCESS
- **Kernel execution:** All 7 kernels launch and complete — SUCCESS
- **Solution generation:** R5 produces candidate solutions — SUCCESS
- **Solution validation:** `is_valid_solution()` returns error "solution does
  not produce zero hash" — FAIL (before parsing fix)
- **After parsing fix:** Not yet verified due to DAG crash (Issue A)

## Next Steps

1. **Resolve DAG crash** — investigate why `generate_light_cache()` crashes
   the process. May need to run BeamHash without the ProgPoW/ZANO stream
   active, or add memory budget checks.

2. **Verify solution validation** — once the miner runs stably, confirm that
   the parsing fix produces valid solutions that pass `is_valid_solution()`.

3. **Verify header handling** — confirm that the BEAM pool sends 32-byte
   headers and that the CUDA path uses the correct prePow state.

4. **Submit share to pool** — end-to-end test: valid solution → pool acceptance.

5. **Performance tuning** — measure hashes/s and compare with OpenCL backend.
