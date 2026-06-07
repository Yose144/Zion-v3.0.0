# Fire GPU Backend Fix Report

**Date:** 2026-06-07  
**Issue:** Hash mismatch between GPU (OpenCL) and CPU reference for `deeksha_lite_fire` algorithm on AMD Vega 64 GPU rig (SMOS)

## Root Cause

The Fire GPU backend in `V3/L1/miner/src/gpu_backend.rs` was passing raw header bytes (80-byte buffer) to the OpenCL kernel, but the kernel expected a precomputed Keccak state (25-word u64 buffer) like the v1 algorithm uses. This caused hash mismatches between GPU and CPU implementations.

## Fix Applied

### Changes to `V3/L1/miner/src/gpu_backend.rs`

1. **Changed scratchpad size:** `DLF_SCRATCHPAD_BYTES` from 128 KiB to 256 KiB to match kernel requirements
2. **Renamed buffer:** `header80_buf: Buffer<u8>` → `header_state_buf: Buffer<u64>` (25 u64s = 200 bytes)
3. **Added precomputation:** `precompute_header_keccak_state()` function (identical to v1 implementation)
4. **Updated mining logic:** `mine_batch()` now precomputes Keccak state and writes 25 u64s to the buffer before kernel execution

### Changes to `V3/L1/pool/src/lib.rs`

No changes needed - `hash_with_algorithm()` already had `deeksha_lite_fire` case support.

## Deployment

### Binary Version
- **v3.0.37-fire.zip** - Contains GPU backend fix
- **URL:** `https://zionterranova.com/zion-miner/zion-miner-v3.0.37-fire.zip`

### Pool Server
- Rebuilt on Edge (77.42.71.94) with Docker container
- Binary synced from Windows build
- Service restarted successfully
- Now correctly validates `deeksha_lite_fire` shares

### Verification
- **Test GPU miner (fire-gpu-test):** Running on Edge, accepting shares successfully
- **Rig (vega-smos):** Still running v3.0.36-fire, needs SMOS config update

## Current Status

### Working
- ✅ Pool server with `deeksha_lite_fire` support
- ✅ GPU backend fix applied and tested
- ✅ Test GPU miner (fire-gpu-test) accepting shares
- ✅ Binary deployed to Edge web server

### Pending
- ⏳ SMOS group config update (manual action required via web panel)
- ⏳ Rig (vega-smos) to download and run v3.0.37-fire.zip

## Next Steps

1. User must update SMOS group config via web panel to:
   ```
   https://zionterranova.com/zion-miner/zion-miner-v3.0.37-fire.zip
   ```
2. Rig will automatically download and restart with new binary
3. Monitor pool logs for `vega-smos` Accepted shares
4. Verify no `hash_mismatch_info` for rig shares

## Technical Details

### Precomputed Keccak State
The Fire algorithm (like v1) requires the header to be preprocessed through Keccak before GPU mining:
- Input: 80-byte raw header
- Output: 25 u64 Keccak state (200 bytes)
- GPU kernel receives precomputed state, not raw bytes

### GPU Backend Configuration
- **Algorithm:** `deeksha_lite_fire`
- **Scratchpad:** 512 MiB (256 KiB per thread × 2048 work_size)
- **Work size:** 2048 (global), 256 (local)
- **Backend:** OpenCL (AMD GCN)

## Files Modified

- `V3/L1/miner/src/gpu_backend.rs` - GPU backend fix
- `V3/L1/pool/src/lib.rs` - Already had `deeksha_lite_fire` support (no changes needed)
- `AGENTS.md` - Updated with deployment notes

## Commit

Commit hash: `4595d4f1` - "fix(fire): align GPU backend with v1 pre-state pattern"
