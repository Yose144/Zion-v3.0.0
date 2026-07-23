# ZANO Vega 64 (GCN) SMOS Tuning Report

**Date:** 2026-07-23  
**Rig:** `vega-smos` (SMOS `ZionRig`, rig ID 518837)  
**GPU:** AMD Radeon Vega 64 8GB (`gfx900:xnack-`, 64 CU, 1630 MHz)  
**Deployed miner package:** `http://62.171.141.136/zion-miner/zion-miner-v3.1.9-vega-complete-70.zip`

## Objective

Get the ZION triple-stream miner (ZION GPU + ZANO GPU + VRSC CPU) running stably on a Vega 64 under SMOS, and push the ZANO / ProgPoWZ stream to the maximum stable hashrate without GPU kernel hangs (`amdgpu` context lost).

## Changes made

### Source code

1. `AuXpow/src/gpu_miner.rs`
   - Auto-detect GCN/Vega GPUs (`gfx8xx`, `gfx9xx`) and disable `ds_bpermute` by default for these architectures.
   - Cap `GROUP_SIZE` to 128 for GCN/Vega to reduce VGPR/register pressure.
   - Allow override via `ZION_AUXPOW_GPU_USE_BPERMUTE` and `ZION_AUXPOW_GPU_GROUP_SIZE`.

2. `V3/L1/native-ffi/build.rs`
   - Fixed duplicate `aesenc` linker symbols caused by `haraka_portable.c` being compiled twice.

3. `V3/L1/miner/src/main.rs`
   - Attempted to gate `ext_gpu_share_found` / `ext_share_submitted` logs under `QUIET` mode to keep the SMOS 19-line console dashboard visible.
   - Build `v3.1.9-vega-complete-71` with these changes crashed shortly after startup, so it was reverted.

### SMOS wrapper

`MinerP3.0.6/Smos/wrapper_complete.sh`

Final settings (deliver the best stable hashrate):

```bash
# ZANO / ProgPoWZ tuning for Vega 64 8GB (GCN/wave64)
# Group 128 keeps VGPR pressure low; bpermute enabled for speed.
# Fallback: if it hangs, set USE_BPERMUTE=0 and GROUP_SIZE=128.
export ZION_EXT_GPU_TIME_DUTY_PCT=100
# 1M work size: highest stable ProgPoWZ hashrate on Vega 64 (~9.5 MH/s with bpermute).
export ZION_SECONDARY_GPU_WORK_SIZE=1000000
export ZION_AUXPOW_GPU_WORK_SIZE=1000000
export ZION_AUXPOW_GPU_GROUP_SIZE=128
export ZION_AUXPOW_GPU_USE_BPERMUTE=1
export ZION_AUXPOW_GPU_VRAM_PCT=40
export ZION_AUXPOW_GPU_BYTES_PER_ITEM=64
export ZION_ZANO_STALE_SECS=30
```

## Work-size tuning results

| Work size | ZANO hashrate (TUI) | Stability | ZANO accepted (sample) | Notes |
|-----------|----------------------|-----------|------------------------|-------|
| 1M (`v70`) | ~9.0–9.5 MH/s | Stable, no kernel hangs | ~8 shares / 10 min | Best raw hashrate, occasional duplicate-share rejects |
| 2M (`v73`) | ~7.5–8.0 MH/s | Stable, no kernel hangs | ~7 shares / 8 min | Lower displayed hashrate, fewer duplicates |
| 4M (`v72`) | ~7.0–7.5 MH/s | Stable, no kernel hangs | ~4 shares / 10 min | Worse than 1M/2M |

The 1M work-size configuration gives the highest stable ProgPoWZ hashrate on this Vega 64. Larger work sizes did not improve performance and in the 4M case visibly reduced accepted share rate.

## Live metrics (final `v70` config)

Typical SMOS console read-out:

```text
  GPU: 12–14 kH/s  |  Total: 12–14 kH/s
  ACTIVE   ZION   deeksha_lite_v1  12–15 kH/s  A:200+  R:0
  ACTIVE   ZANO   progpow_zano      9.0–9.5 MH/s  A:2–4  R:0–1
  ACTIVE   VRSC   verushash         1.3–1.4 MH/s  A:0–5  R:0–1
```

- GPU temperature: ~66–70 °C
- Pool accept rate: > 99 %
- `kernel_hang` / `ext_gpu_batch_error` events: 0 during the test window

## Known issues / follow-ups

1. **Duplicate ZANO shares.** The pool occasionally reports `duplicate share — server-side dedup (nonce already forwarded)` for ZANO. This is a miner-side nonce-tracking issue, not GPU stability. It does not crash the rig, but it wastes a small percentage of submitted shares.
2. **Console flooding.** ZION `SHARE_ACCEPTED` and external share logs scroll the compact dashboard out of SMOS's 19-line ring buffer. A logging-suppression build was attempted (`v71`) but the miner crashed on startup, so it was reverted.
3. **TUI ZANO accepted counter.** The `A:R` counter for the ZANO stream in the dashboard is not always in sync with pool-side accepted shares; rely on pool metrics for revenue verification.

## Deployment checklist

- [x] `gpu_miner.rs` GCN/Vega safe defaults
- [x] `build.rs` duplicate-symbol fix
- [x] Docker release build on Edge server
- [x] `zion-miner-v3.1.9-vega-complete-70.zip` served from `62.171.141.136/zion-miner/`
- [x] SMOS rig group `minerOptions` updated to `v70` URL
- [x] Rig cache cleared and rebooted
- [x] Stable triple-stream operation verified

## Files changed in this session

- `AuXpow/src/gpu_miner.rs`
- `V3/L1/native-ffi/build.rs`
- `V3/L1/miner/src/main.rs` (attempted QUIET log gating, reverted in deployment)
- `MinerP3.0.6/Smos/wrapper_complete.sh`
- `VEGA64_ZANO_TUNING_REPORT.md` (this file)
