# REPORT: VRSC Share Rejection Fix + Performance Tuning

**Date:** 2026-08-10
**Commits:** `9cbaa6302` (VRSC fix), `4f6f8dd89` (perf tuning)
**Hardware:** AMD Ryzen 5 3600 (6c/12t) + NVIDIA GTX 1070 Ti (8GB, 19 CUs)
**Pool:** `62.171.141.136:8444` (V31 Edge pool, V3 protocol)

## Summary

Two bugs caused VRSC share rejections (~86-97% accept rate). After fixing both
and applying performance tuning, all three Trinity streams now run at **100%
accept rate** with **22-24 MH/s total hashrate** (up from 21 MH/s, +14%).

## Bug 1: Race Condition on `ext_result_rx`

### Root Cause

`V3PoolClient` used a single `ext_result_rx` mpsc channel for ALL external
(AuxPoW) share results — both VRSC (CpuExternal) and ZANO (GpuExternal).
VRSC shares are submitted as background `tokio::spawn` tasks (to avoid blocking
the fast CPU scan loop), while ZANO shares are submitted synchronously.

When multiple VRSC submissions were in-flight, results could be mismatched:
- VRSC submission A times out (30s) → its result arrives late
- VRSC submission B starts → picks up A's stale result from the channel
- B's actual result then arrives and gets picked up by submission C
- This "result shifting" caused false rejections and incorrect accept/reject
  counting

Additionally, ZANO and VRSC results could be mixed if both were pending
simultaneously on the same channel.

### Fix

Split the single `ext_result_rx` into per-coin channels:
- `vrsc_result_rx` — for VRSC (CpuExternal) results
- `zano_result_rx` — for ZANO (GpuExternal) results

The read loop in `v3_pool_client.rs` dispatches `ExternalResult` messages by
coin name (case-insensitive match on "VRSC").

Added stale result draining before each `recv()` — any leftover results from
previous timed-out submissions are logged and discarded, preventing the
"result shifting" cascade.

**File:** `V31/L1/miner/src/v3_pool_client.rs`

## Bug 2: `skip_stale` Check Too Aggressive

### Root Cause

The `mine_v3_external_share()` function in `runtime.rs` checked
`job_rx.has_changed()` to skip stale VRSC shares. However, `job_rx` is the
V3 job bundle watch channel — it fires on ANY new bundle, including ZION-only
job updates where the VRSC `cpu_external` job hasn't changed at all.

This caused valid VRSC shares to be silently skipped whenever a ZION job
update arrived between mining and submission, reducing effective VRSC share
submission rate.

### Fix

Changed the check to only skip when the new bundle's `cpu_external.job_id`
actually differs from the current job's `job_id`:

```rust
let skip_stale = if matches!(stream, StreamId::CpuExternal) {
    if job_rx.has_changed().unwrap_or(false) {
        let new_vrsc_id = job_rx
            .borrow()
            .as_ref()
            .and_then(|b| b.cpu_external.as_ref())
            .map(|e| e.job_id.clone());
        new_vrsc_id.is_some() && new_vrsc_id.as_deref() != Some(&ext.job_id)
    } else {
        false
    }
} else {
    false
};
```

**File:** `V31/L1/miner/src/runtime.rs`

## Performance Tuning

### `ZION_EXT_GPU_GAP_MS`: 50ms → 0 (biggest win)

The duty-cycle gap between ZANO (Stream 2) GPU batches was 50ms — a sleep
to "yield" GPU to ZION (Stream 1). Setting this to 0 replaces the sleep with
`tokio::task::yield_now()`, letting the CUDA driver handle GPU scheduling
between ZION and ZANO kernels entirely.

This was the single biggest improvement:
- ZION: 2.0 → 3.14 MH/s (+57%)
- ZANO: 8.1 → 9.13 MH/s (+13%)

### `ZION_NONCE_COUNT`: 5M → 10M

Larger ZION GPU nonce batch = fewer kernel launches = more GPU time mining.

### `ZION_EXT_CPU_NONCE_COUNT`: 5M → 10M

Larger VRSC CPU nonce batch = fewer job polls = more CPU time mining.
- VRSC: 10.5 → 11.77 MH/s (+12%)

### `ZION_GPU_WORK_SIZE`: 4096 (kept, 8192 tested and rejected)

Tested `work_size=8192` (4GB scratchpad) but it was worse (18-20 MH/s) due to
VRAM bandwidth pressure when sharing the GPU with ZANO's ProgPoW DAG. The 1070
Ti's 8GB VRAM can fit 4GB ZION + 2GB ZANO DAG, but the memory bandwidth becomes
the bottleneck. `work_size=4096` (2GB scratchpad) is optimal for GPU sharing.

## Final Results

| Stream | Before | After | Change |
|--------|--------|-------|--------|
| ZION (GPU CUDA deeksha_lite) | 2.0 MH/s | 3.14 MH/s | +57% |
| ZANO (GPU CUDA ProgPoW) | 8.1 MH/s | 9.13 MH/s | +13% |
| VRSC (CPU VerusHash v2.2) | 10.5 MH/s | 11.77 MH/s | +12% |
| **Total** | **21 MH/s** | **22-24 MH/s** | **+14%** |
| Accept rate | ~97% | **100%** | ✅ |
| Rejected shares | frequent | **0** | ✅ |

Verified over 5+ minutes of stable operation: 375+ accepted, 0 rejected.

## What Was NOT Changed

- `work_size=4096` — optimal for 1070 Ti GPU sharing (8192 tested, worse)
- GPU power limit 140W — would benefit from increase to 170W (needs sudo)
  - GPU throttles to 1493 MHz instead of 1683 MHz boost clock
  - Fan at 97%, temp 88°C — thermal headroom is limited
  - Estimated additional +10-15% hashrate if power limit unlocked

## Files Modified

1. `V31/L1/miner/src/v3_pool_client.rs` — per-coin result channels + stale drain
2. `V31/L1/miner/src/runtime.rs` — `skip_stale` fix + `is_vrsc` parameter
3. `Start.sh` — env var tuning (gap=0, nonce_batch=10M)
4. `~/Desktop/Start.sh` — same (kept in sync)

## Build & Deploy

```bash
cd /home/zionserver/2.9.6-main/V31
ZION_CPU_TARGET=native cargo build --release -p zion-miner --bin zion-miner \
    --features gpu-cuda,native-all,tui
cp target/release/zion-miner ~/Desktop/zion-miner
~/Desktop/Start.sh --stop
~/Desktop/Start.sh --bg
```

## Future Optimization Opportunities

1. **GPU power limit** — `sudo nvidia-smi -pl 170` would unlock ~10-15% more
   hashrate (GPU is thermal-throttling at 140W)
2. **GPU memory overclock** — VRAM at 3802 MHz, could push to 4100+ for more
   ProgPoW throughput
3. **TPB tuning** — CUDA kernel uses TPB=128, could test 256 for better
   occupancy on Pascal architecture
4. **VRSC CPU thread allocation** — currently 12 threads, could test 10 (leave
   2 for ZION CPU fallback and system overhead)
