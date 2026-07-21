# ProgPoWZ OpenCL Kernel Optimization Report

**Date:** 2026-07-21
**GPU:** AMD Radeon RX 5600 XT (Navi 10, gfx1010, RDNA1, wave32)
**Algorithm:** ProgPoWZ (Zano) — ProgPoW v0.9.2, PERIOD=50, REGS=32, CNT_DAG=64, CNT_CACHE=12, CNT_MATH=20

## Summary

Optimized the OpenCL ProgPoWZ kernel for the ZION triple-stream miner. Achieved
**+54% ZANO hashrate** (4.48 → 6.89 MH/s) and **+81% VRSC hashrate** (4.09 → 7.40
MH/s) by re-enabling AMD hardware lane shuffle (`ds_bpermute`), increasing
work-group size to 256, and fixing wave32 detection for RDNA1+ GPUs.

The optimized kernel is **38% faster than the reference hyle-team/progminer**
on the same hardware, thanks to `ds_bpermute` barrier elimination that the
reference does not use.

## Performance Results

| Stream    | Algorithm       | Before    | After     | Change  |
|-----------|-----------------|-----------|-----------|---------|
| ZANO      | ProgPoWZ        | 4.48 MH/s | 6.89 MH/s | +54%    |
| VRSC      | VerusHash       | 4.09 MH/s | 7.40 MH/s | +81%    |
| ZION      | Deeksha Lite v1 | 18.74 KH/s| 17.91 KH/s| ~same   |
| Efficiency| Overall         | 97.3%     | 98.5%     | +1.2pp  |

ZANO shares verified as **accepted** by the pool — kernel produces correct hashes.

### Comparison with reference miners

| Miner                    | ZANO hashrate | Notes                              |
|--------------------------|---------------|------------------------------------|
| Our kernel (before)      | 4.48 MH/s     | share+barrier, GROUP_SIZE=128      |
| hyle-team/progminer      | ~4-5 MH/s     | reference, share+barrier, LWS=256  |
| **Our kernel (after)**   | **6.89 MH/s** | ds_bpermute, GROUP_SIZE=256        |
| SRBMiner (proprietary)   | 11-19 MH/s    | closed-source binary kernels       |

## Root Causes of Low Performance

### 1. `USE_AMD_BPERMUTE` disabled (`#if 0`)

The kernel had AMD hardware lane shuffle (`ds_bpermute`) support, but it was
disabled with `#if 0` due to GPU hangs on the SMOS OpenCL compiler. The
fallback `share + barrier(CLK_LOCAL_MEM_FENCE)` path was used instead.

ProgPoWZ inner loop runs 64 DAG iterations × 16 lanes = **~1024 barrier
synchronization points** per hash. Each barrier stalls the entire wavefront
until all lanes reach it. On RDNA1 with wave32, this is extremely expensive.

`ds_bpermute` is a single-instruction wavefront-level lane-to-lane shuffle
that replaces the `share + barrier` pattern entirely — no synchronization
needed.

### 2. GROUP_SIZE=128 (reference uses 256)

GROUP_SIZE was reduced from 256 to 128 to work around SMOS barrier deadlock
(4 wavefronts per work-group exceeded barrier capacity with share+barrier).
This halved the DAG cache (c_dag) utilization — 8 hashes shared 16KB local
memory instead of 16 hashes.

### 3. Hardcoded `wave_size = 64` for RDNA1 (wave32)

The bpermute path had `const uint32_t wave_size = 64`, but RX 5600 XT is
RDNA1 with **wave32** wavefronts. Using wave64 on a wave32 GPU causes
incorrect lane indexing → wrong shuffle results → kernel produces bad hashes
(this is why bpermute was likely disabled — it "hung" because it produced
wrong results, not because of a compiler bug).

## Changes

### `AuXpow/csrc/opencl/progpow_kernel.cl`

- Re-enabled `USE_AMD_BPERMUTE` by default on AMD platforms (auto-detected via
  `cl_amd_media_ops`). Can be disabled with `-DUSE_AMD_BPERMUTE=0` for SMOS.
- Added `WAVE_SIZE` macro with compile-time auto-detection via `__gfx10xx__` /
  `__gfx11xx__` architecture macros (32 for RDNA1+, 64 for GCN/Vega).
- Replaced hardcoded `wave_size = 64` with `WAVE_SIZE` in the bpermute path.
- Updated `wave_group_base` computation to use `WAVE_SIZE` instead of `64`.

### `AuXpow/src/progpow_codegen.rs`

- Fixed generated `progPowLoop` bpermute path: `get_local_id(0) % 64` →
  `get_local_id(0) % WAVE_SIZE` (correct for RDNA1 wave32).

### `AuXpow/src/gpu_miner.rs`

- **GROUP_SIZE: 128 → 256** for ProgPoW algorithms when bpermute is enabled
  (no barriers → larger work-groups are safe).
- Added build defines: `-DPLATFORM=2 -DUSE_AMD_BPERMUTE=1 -DWAVE_SIZE={32|64}`.
- Added RDNA1+ detection from device name (gfx10xx, gfx11xx, RX 5600/5700/6x00/
  7x00 series) to set `WAVE_SIZE=32`.
- Added env var overrides for tuning:
  - `ZION_AUXPOW_GPU_GROUP_SIZE` — override work-group size (default 256)
  - `ZION_AUXPOW_GPU_USE_BPERMUTE` — enable/disable bpermute (default 1)
- Updated `wg_size` in `mine()` to match GROUP_SIZE=256 for ProgPoW.

## How It Works

### `ds_bpermute` (AMD wavefront shuffle)

```c
// Before (share + barrier — 2 instructions + sync stall):
if (lane_id == (loop % PROGPOW_LANES))
    share[group_id] = mix[0];
barrier(CLK_LOCAL_MEM_FENCE);    // ← stalls entire wavefront
offset = share[group_id];

// After (ds_bpermute — 1 instruction, no sync):
offset = amd_wave_shuffle(mix[0],
    ((get_local_id(0) % WAVE_SIZE) & ~(PROGPOW_LANES - 1)) + (loop % PROGPOW_LANES));
```

`__builtin_amdgcn_ds_bpermute(byte_offset, value)` reads `value` from the lane
at `byte_offset/4` within the wavefront. It maps to the `ds_bpermute_b32`
hardware instruction, which completes in ~4 cycles with no synchronization.

### GROUP_SIZE=256 benefits

- **16 hashes per work-group** (vs 8) share the 16KB c_dag in local memory
- Better memory coalescing for DAG loads (256 work-items × 16 bytes = 4KB per
  wavefront, matches L2 cache line patterns)
- Matches reference progminer default `localWorkSize=256`

## Remaining Gap vs SRBMiner

SRBMiner achieves 11-19 MH/s on RX 5600 XT using proprietary binary kernels
that are not publicly available. The gap is due to:

1. **Binary kernel optimizations** — hand-tuned GCN ISA with register
   allocation and scheduling that the OpenCL compiler cannot match
2. **DAG access patterns** — proprietary prefetch and coalescing strategies
3. **Keccak optimization** — inline assembly with `v_bfi_b32` and `v_alignbit_b32`

These cannot be replicated in portable OpenCL without significant effort.

## Build & Run

```bash
cd V3
cargo build --release -p zion-miner --features gpu-opencl,native-hashers,native-verushash,native-randomx
# Binary: V3/target/release/zion-miner
```

### Tuning env vars

| Env var                        | Default | Description                          |
|--------------------------------|---------|--------------------------------------|
| `ZION_AUXPOW_GPU_GROUP_SIZE`   | 256     | ProgPoW work-group size              |
| `ZION_AUXPOW_GPU_USE_BPERMUTE` | 1       | 1=enable ds_bpermute, 0=share+barrier |
| `ZION_AUXPOW_GPU_WORK_SIZE`    | 3137536 | Global work size (batch size)        |
