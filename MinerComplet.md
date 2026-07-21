# Miner Completion Report — ProgPoWZ Optimization + ZANO Stale Share Fix

**Date:** 2026-07-21
**Hardware:** AMD RX 5600 XT (gfx1010, RDNA1, wave32, 36 CUs, 6GB VRAM)
**Branch:** main
**Commits:** `83339d83b` (kernel opt), pending (stale fix)

---

## 1. ProgPoWZ OpenCL Kernel Optimization (+54% ZANO hashrate)

### Problem
ZANO (ProgPoWZ) hashrate was ~4.5 MH/s baseline. Reference miners (hyle-team/progminer)
achieve ~4-5 MH/s with the same kernel, but SRBMiner reaches 11-19 MH/s via proprietary
optimizations. Our kernel had three sub-optimal settings:

1. `USE_AMD_BPERMUTE` was disabled (`#if 0`) due to SMOS concerns — irrelevant on Linux/AMDPRO
2. `GROUP_SIZE=128` (ours) vs `GROUP_SIZE=256` (reference progminer default)
3. Hardcoded `wave_size=64` in bpermute path, but RX 5600 XT is RDNA1 wave32

### Fixes implemented

#### 1.1 Re-enabled `USE_AMD_BPERMUTE` (ds_bpermute lane shuffle)
**File:** `AuXpow/csrc/opencl/progpow_kernel.cl`

- Re-enabled `USE_AMD_BPERMUTE` — auto-enabled on AMD platforms
- Added WAVE_SIZE auto-detection via `__gfx1010__` macros (32 for RDNA1+, 64 for GCN)
- bpermute replaces share+barrier for seed broadcast (no barrier needed → faster)
- Note: bpermute is used ONLY for seed broadcast (outside DAG loop), NOT in the DAG
  loop itself (caused GPU hangs on RDNA1 with AMDPRO driver due to compiler scheduling
  issues with bpermute inside tight loop with global memory loads)

#### 1.2 GROUP_SIZE 128→256
**File:** `AuXpow/src/gpu_miner.rs` (line ~2504)

- Default GROUP_SIZE increased from 128 to 256 (matches reference progminer)
- Env-configurable via `ZION_AUXPOW_GPU_GROUP_SIZE` (defaults to 256 with bpermute, 128 without)
- 256 work-items per group = 8 hash groups × 32 lanes (RDNA1 wave32) or 4 × 64 (GCN)

#### 1.3 Wave32 fix in generated code
**File:** `AuXpow/src/progpow_codegen.rs` (line ~525)

- `get_local_id(0) % 64` → `get_local_id(0) % WAVE_SIZE`
- Fixed wavefront-relative lane index calculation for RDNA1 (wave32) vs GCN (wave64)

#### 1.4 Build defines + env overrides
**File:** `AuXpow/src/gpu_miner.rs`

- Added `PLATFORM=2` build define for AMD platform
- Added `ZION_AUXPOW_GPU_USE_BPERMUTE` env var (default=1)
- Wave size detection from device name (gfx1010 → 32, others → 64)

### Performance results
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| ZANO hashrate | 4.48 MH/s | 6.89-8.68 MH/s | **+54% to +94%** |
| VRSC hashrate | 4.09 MH/s | 7.40 MH/s | **+81%** |
| ZION hashrate | ~17 KH/s | ~18 KH/s | +6% |
| Efficiency | 98.5% | 98.5% | maintained |

---

## 2. ZANO Stale Share Fix (55% → 89% efficiency)

### Problem
After kernel optimization, ZANO shares had high reject rate: **6 accepted / 5 rejected = 55% efficiency**.
All rejections were `"Job expired"` from HeroMiners pool.

### Root cause
HeroMiners (ZANO) uses EthStratum protocol with `eth_getWork` polling:
- Pool sends the same `header_hash` (used as job_id) every 2-5s
- Pool internally expires the job after ~30-60s
- Miner was submitting shares 3-5 minutes after job receipt (long GPU batches)
- Pool rejected these as "Job expired"

The EthStratum submit path had **no stale job detection** (only VRSC had it).

### Fix implemented
**File:** `AuXpow/src/auxpow_client.rs`

#### 2.1 Job age tracking for EthStratum
Added job age tracking in `parse_eth_getwork_params()`:
- Records `Instant` when a new `header_hash` is first seen
- Only inserts on first sighting (doesn't update on re-sends)
- Evicts entries older than 5 minutes (bounds memory to 64 entries)

#### 2.2 Stale pre-rejection in EthStratum submit
Added stale check in `submit_share()` for EthStratum protocol:
- Default threshold: **30s** (configurable via `ZION_ZANO_STALE_SECS`)
- Pre-rejects shares for jobs older than threshold
- Returns `ShareResult::Rejected("stale job — pre-rejected (ZANO job expired)")`
- Avoids wasting round-trip to pool and inflating reject rate

### Results
| Metric | Before fix | After fix |
|--------|-----------|----------|
| ZANO A/R | 6/5 (55%) | 8/1 (89%) |
| Reject reason | "Job expired" (pool) | "stale_job" (local pre-reject) |
| ZANO hashrate | 7-8 MH/s | 7-8 MH/s (maintained) |

---

## 3. Other fixes in this batch

### 3.1 Ghostrider CPU nonce batch fix
**File:** `AuXpow/src/miner_harness.rs`, `V3/L1/miner/src/main.rs`

- Removed yiimp "error 25" check (`hash[30]|hash[31]==0`) for share mining — it was
  more restrictive than the share target (1/65536 probability) and prevented share finding
- Removed double-threading for Ghostrider (`scan_ghostrider()` already does its own
  multi-threading internally — 12×12=144 threads on 12 cores caused oversubscription)
- Increased ghostrider_nonce_count default 100→600 for ~50s wall time

### 3.2 GPU batch size env override
**File:** `V3/L1/miner/src/main.rs`, `V3/L1/miner/src/gpu_backend.rs`

- `ZION_EXT_GPU_BATCH_SIZE` env var (default 16M for ProgPoWZ)
- `mine_batch_raw` now uses AuxPowGpuMiner's internal work_size for larger batches

### 3.3 Start.sh duty-cycle config
**File:** `scripts/start-local-miner.sh`, `Desktop/Start.sh`

- `ZION_EXT_GPU_TIME_DUTY_PCT=100` (ZANO runs continuously, no sleep)
- `ZION_AUXPOW_GPU_WORK_SIZE=3137536` (3M work-items, sweet spot for RX 5600 XT)
- `ZION_NONCE_AUTOTUNE=1` (dynamic batch sizing based on share frequency)

---

## 4. Files modified

| File | Changes |
|------|---------|
| `AuXpow/csrc/opencl/progpow_kernel.cl` | Re-enabled bpermute, WAVE_SIZE auto-detection |
| `AuXpow/src/progpow_codegen.rs` | Wave32 fix in generated code |
| `AuXpow/src/gpu_miner.rs` | GROUP_SIZE=256, build defines, env overrides |
| `AuXpow/src/auxpow_client.rs` | ZANO stale share detection + pre-rejection |
| `AuXpow/src/miner_harness.rs` | Ghostrider error 25 check removal |
| `V3/L1/miner/src/gpu_backend.rs` | Internal work_size for larger batches |
| `V3/L1/miner/src/main.rs` | Batch size env override, ghostrider fix |
| `scripts/start-local-miner.sh` | Duty-cycle config updates |
| `Desktop/Start.sh` | Triple-stream tuning defaults |

---

## 5. Build & run

```bash
# Build (from V3/ directory)
cd V3 && cargo build --release -p zion-miner \
  --features gpu-opencl,native-hashers,native-verushash,native-randomx

# Run (triple-stream: ZION GPU + ZANO GPU + VRSC CPU)
bash ~/Desktop/Start.sh

# Attach to screen
screen -r zion-miner
```

---

## 6. Current performance (live, 2026-07-21 16:25)

```
STREAMS
 #  STREAM    ALGORITHM                 RATE      A/R    EFF
 1  ZION      Deeksha Lite v1     17.99 KH/s  338/1   100%
 2  GPU       ZANO / progpow_zan   7.01 MH/s    8/1    89%
 3  CPU       VRSC / VerusHash     7.82 MH/s   54/4    93%

ACCEPT 400   REJECT 6   EFF 98.5%   UP 00:12:55
```

---

## 7. Pending: DAG prefetch optimization

Next optimization targets for further ZANO hashrate improvement:
1. **DAG prefetch** — async/global prefetch of next DAG element while computing current
2. **Keccak loop unroll** — `#pragma unroll` on keccak rounds
3. **`#pragma unroll 2` on DAG loop** — unroll the inner DAG load loop by 2
4. **Reduce VGPR pressure** — register spilling analysis
