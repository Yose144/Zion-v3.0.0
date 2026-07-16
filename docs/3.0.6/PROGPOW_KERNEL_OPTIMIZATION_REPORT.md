# ProgPow Kernel Optimization Report

**Date:** 2026-07-16
**Hardware:** AMD RX 5600 XT (gfx1010 / RDNA1, 18 CUs, 6 GB VRAM)
**Target:** EPIC Cash ProgPow mining via OpenCL

## Problem

EPIC ProgPow hashrate was ~826 KH/s on the RX 5600 XT — 15-18x slower than
SRBMiner's 13-15 MH/s on the same GPU. The bottleneck was the kernel itself,
not batch dispatch (tested work_size 4M vs 256K — no improvement).

## Root Causes

1. **GROUP_SIZE=128** — too small for optimal wavefront occupancy on AMD
2. **Barriers in progPowLoop** — share[] + `barrier(CLK_LOCAL_MEM_FENCE)` for
   every lane broadcast (64 iterations × 16 hashes = 1024 barriers per work-item)
3. **Header in global memory** — `g_header` passed as `__global` instead of `__constant`
4. **`amd_bpermute` not available on RDNA1** — the GCN-only builtin from
   `cl_amd_media_ops2` fails to compile on gfx1010 (wave32 architecture)

## Optimizations Applied

### 1. `__builtin_amdgcn_ds_bpermute` (LLVM intrinsic) — barrier elimination

Replaced `amd_bpermute` (GCN-only, requires `cl_amd_media_ops2` extension)
with `__builtin_amdgcn_ds_bpermute` — an LLVM intrinsic for the `ds_bpermute`
instruction that works on **all AMD architectures**:

- GCN (Vega, Polaris) — wave64
- RDNA1 (RX 5600 XT, gfx1010) — wave32
- RDNA2/3 (RX 6000/7000 series) — wave32

Added a wrapper function in the kernel header:

```c
static inline uint amd_wave_shuffle(uint val, uint src_lane)
{
    return __builtin_amdgcn_ds_bpermute(src_lane * 4, val);
}
```

This eliminated barriers in three places:
- **Seed broadcast** in the main hash loop (16 barriers → 0)
- **mix_hash reduction** across lanes (1 barrier → 0)
- **Global load broadcast** in progPowLoop (64 barriers/iteration → 0)

### 2. `__builtin_amdgcn_wavefrontsize()` — correct wave32/wave64 handling

The `wave_group_base` calculation was hardcoded for wave64 (`lid & 48`),
which produces invalid lane indices on wave32 RDNA1 GPUs. Fixed to use
the runtime wavefront size query:

```c
const uint32_t wave_size = __builtin_amdgcn_wavefrontsize();
const uint32_t wave_lane = lid % wave_size;
const uint32_t wave_group_base = wave_lane & ~(uint32_t)(PROGPOW_LANES - 1);
```

### 3. GROUP_SIZE=256 for EPIC ProgPow

Changed from 128 to 256 to match the reference `epic-miner` implementation.
This gives `HASHES_PER_GROUP = 256 / 16 = 16` hashes per work-group, improving
latency hiding through more wavefronts per group.

KawPow variants remain at GROUP_SIZE=128 (different share[] layout).

### 4. `__constant` header

Changed `keccak_f800` and `ethash_search` kernel signatures to accept
`__constant hash32_t const* g_header` instead of `__global`, enabling
the GPU to cache the 32-byte header in constant cache.

## Files Changed

| File | Change |
|------|--------|
| `AuXpow/csrc/opencl/progpow_kernel.cl` | `amd_wave_shuffle()` wrapper, `__builtin_amdgcn_wavefrontsize()`, `__constant` header, barrier elimination |
| `AuXpow/src/progpow_codegen.rs` | Generated `progPowLoop` uses `amd_wave_shuffle()` instead of share+barrier |
| `AuXpow/src/gpu_miner.rs` | `ensure_proque_progpow()`: GROUP_SIZE=256 for EPIC, 128 for KawPow; `mine()`: wg_size=256 for progpow/progpow_epic |

## Benchmark Results

### Test Configuration
- **GPU:** AMD RX 5600 XT (gfx1010, 18 CUs, 6 GB VRAM)
- **Work size:** 262144 (default — 4M caused degradation)
- **Pool:** pool.epic.tech:3443 (EPIC ProgPow)
- **Epoch:** 120, DAG size: 1984 MB
- **Duration:** 3+ minutes sustained

### Hashrate Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| EPIC ProgPow hashrate | ~826 KH/s | **5.49 MH/s** | **6.6x** |
| vs SRBMiner (14 MH/s) | 5.9% | **39%** | — |
| GPU temperature | 54°C | 55°C | Stable |
| Share accept rate | 100% | 100% | No change |

### Work Size Finding

| Work Size | Peak HR | Sustained HR | Notes |
|-----------|---------|--------------|-------|
| 262144 (default) | 6.08 MH/s | 5.49 MH/s | Stable, no degradation |
| 4194304 (4M) | 5.58 MH/s | 870 KH/s | Degrades rapidly — scheduling issue |

**Conclusion:** Default work_size (262144) is optimal. The 4M work_size causes
the GPU to spend too much time on a single batch, leading to scheduling
starvation and hashrate collapse.

## Remaining Gap to SRBMiner (39% → 100%)

Further optimizations needed to close the gap to SRBMiner's 14 MH/s:

1. **DAG prefetch** — use `__builtin_amdgcn_buffer_load` for coalesced DAG access
2. **Register pressure** — PROGPOW_REGS=32 may cause register spilling on RDNA1
3. **Kernel unrolling** — tune `#pragma unroll` for progPowLoop math operations
4. **GPU clock boosting** — GPU runs at 793 MHz vs 1780 MHz boost clock
5. **Memory access patterns** — optimize c_dag cache access for wave32

## Verification

- All 167 unit tests pass: `cargo test --features native-verushash,native-randomx,gpu-opencl,native-hashers`
- Kernel compiles successfully on gfx1010 (RDNA1) with no errors
- 0 rejected shares, 100% accept rate in live testing
- Triple-stream mining (ZION + EPIC + VRSC) stable for 3+ minutes
