# Vega 64 SMOS Reflash + Deeksha GPU Mining — E2E Success Report

**Date:** 2026-07-17
**Rig:** SMOS 518837 (ZionRig) — AMD RX Vega 64 (gfx900, 8GB HBM2, 56 CUs)
**Status:** ✅ **WORKING — 19.55 KH/s deeksha, 31 shares accepted, 0 rejected**

---

## 1. Executive Summary

Vega 64 rig was stuck at 0 KH/s (GPU idle at 31°C) despite multiple kernel
and host-code fixes. Root cause was identified from historical debug reports:
**SMOS image i088 (driver amd22.40.6, ROCm 6.x) has a fundamental OpenCL bug
on gfx900** where any `clEnqueueNDRangeKernel` or `clEnqueueWriteBuffer` call
hangs after `clBuildProgram`. Reflashing to **SMOS image i066d (driver
amd21.50.2, ROCm 5.x)** immediately fixed the issue.

---

## 2. Root Cause: SMOS Image i088 vs i066d

| SMOS Image | Kernel | AMD Driver | ROCm | Vega 64 OpenCL | Mining |
|------------|--------|------------|------|----------------|--------|
| **i088** (was) | 6.9.12-sm6#088 | amd22.40.6r6.10.8 | 6.x | **BROKEN** — kernel hangs after compile | 0 KH/s |
| **i066d** (now) | 5.15.80-sm#066d | amd21.50.2r5.16.16 | 5.x | **WORKING** — 19.55 KH/s | ✅ |

**Bug description (from VEGA_GPU_MINING_DEBUG_REPORT_2026-04-09.md):**
> The AMD gfx900 OpenCL driver (ROCm 6.x) has a fundamental bug where any
> `clEnqueueWriteBuffer` or `clEnqueueNDRangeKernel` call hangs after
> `clBuildProgram` has been invoked. The program compilation corrupts the
> device-level dispatch state.

**Fix:** SMOS API reflash command `commandId=40` (image i066d).

---

## 3. Kernel Fixes Applied (this session)

Even though the root cause was the driver, several kernel hardening fixes
were applied that improve GCN compatibility:

### 3.1 local_ws=256 → 64 for GCN (`gpu_guard.rs`)
- **File:** `V3/L1/miner/src/gpu_guard.rs`
- GCN wave64 architecture requires `local_ws=64` for optimal performance.
- `local_ws=256` was the previous default for `DeekshaLiteV1` and
  `DeekshaLiteFire` on GCN — changed to 64.

### 3.2 Removed unused `cl_khr_int64_base_atomics` extension
- **Files:** `deeksha_lite.cl`, `deeksha_chv3.cl`, `deeksha_lite_fire.cl`
- The extension was enabled but never used (no `atom_*` calls).
- On SMOS AMD OpenCL compiler, enabling unused extensions can generate
  broken code. Removed from all 3 deeksha kernels.
- (`cosmic_harmony_deeksha.cl` retains it — that kernel uses `atom_cmpxchg`.)

### 3.3 Replaced `rotate(long,long)` with manual bit-shift
- **Files:** `deeksha_lite.cl`, `deeksha_chv3.cl`, `deeksha_lite_fire.cl`
- AMD OpenCL compiler has a known bug with `rotate()` on gfx900.
- Replaced: `rotate((long)((ulong)(x)), (long)((ulong)(n)))`
  → `((ulong)(x) << (n)) | ((ulong)(x) >> (64 - (n)))`

### 3.4 Replaced `vload4`/`vstore4` with `__private*` → scalar loops
- **File:** `deeksha_lite.cl`
- Vectorized load/store from private memory (registers) can hang on GCN.
- All `vload4(0, (__private ulong*)...)` and `vstore4(..., (__private ulong*)...)`
  replaced with scalar `for` loops.
- `__global` vload4/vstore4 retained (safe for GCN global memory).

---

## 4. 30khs Optimization Applied

Adapted from `30khsDeeksha.md` (originally for RX 5700 XT RDNA) for Vega 64 GCN:

| Parameter | RX 5700 XT (RDNA) | Vega 64 (GCN) |
|-----------|-------------------|---------------|
| work_size | 8192 (18 CUs) | 16384 (56 CUs, gcn_cap) |
| local_ws | 128 | 64 (wave64) |
| nonce_count | 32768 (4× ws) | 65536 (4× ws) |
| ZION_GPU_MAX_BATCH | 32768 | 65536 |
| double-buffering | enabled | enabled |
| build_opts | `-cl-std=CL1.2 -cl-mad-enable` | `-cl-std=CL1.2` |

**SMOS wrapper:** `zion-miner-v3.1.9-vega-30khs-23.zip`

---

## 5. Current Performance

```
ZION       ZION / deeksha_lite_v1    19.55 KH/s    31/0
GPU PROFIT  /                     IDLE (no job from pool)
CPU PROFIT VRSC / verushash           1.72 MH/s    0/2
TOTAL         1.74 MH/s    31 accepted / 2 rejected  (93.9%)
GPU#0 gfx900:xnack-  64CU  8.0GiB  1630MHz  n/a  n/a
```

- **Deeksha GPU:** 19.55 KH/s, 31 accepted, 0 rejected
- **VRSC CPU:** 1.72 MH/s (VerusHash, Pentium G4560 2C/4T)
- **GPU temp:** 50°C (was 31°C on i088 — GPU was idle)
- **GPU clock:** 1630 MHz

---

## 6. SMOS Configuration

| Setting | Value |
|---------|-------|
| SMOS Image | i066d (SM-i066d-5.15.80-a21.50.2-rf22.20.3-5.16.16) |
| AMD Driver | amd21.50.2r5.16.16 (ROCm 5.x) |
| Kernel | 5.15.80-sm#066d |
| SMOS Group | ZionLiteFire (1773590) |
| Miner Package | zion-miner-v3.1.9-vega-30khs-23.zip |
| Pool | stratum+tcp://62.171.141.136:8444 |
| Wallet | zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5 |
| Worker | vega-smos |
| OC Core | 1350 |
| OC Memory | 950 |
| OC PowerLimit | 3 |
| OC Fan | 40% |
| OC Temp Target | 65°C |
| OC VDDC | 950mV |

---

## 7. Build & Deploy Pipeline

### Build (edge server, Docker)
```bash
ssh zion-new 'cd /home/zionserver/zion-build/V3 && \
  docker run --rm -v /home/zionserver/zion-build:/work -w /work/V3 \
  rust:1.97-bullseye bash -c "
    apt-get update -qq && apt-get install -y -qq ocl-icd-opencl-dev 2>/dev/null | tail -1
    ZION_CPU_TARGET=x86-64 RUSTFLAGS=-C\ target-cpu=x86-64 \
    cargo build --release --bin zion-miner --features full,native-hashers 2>&1 | tail -5
  "'
```

### Deploy binary to edge server
```bash
ssh zion-new 'cp /home/zionserver/zion-build/V3/target/release/zion-miner \
  /var/www/zion-miner/zion-miner && chmod +x /var/www/zion-miner/zion-miner'
```

### SMOS group update + reload
```bash
curl -s -X PUT "https://api.simplemining.net/rig-groups/1773590" \
  -H "X-AUTH-TOKEN: $SMOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"ZionLiteFire","miner":"custom",
       "minerOptions":"http://62.171.141.136/zion-miner/zion-miner-v3.1.9-vega-30khs-23.zip",
       ...}'

curl -s -X PATCH "https://api.simplemining.net/rigs/execute-reload" \
  -H "X-AUTH-TOKEN: $SMOS_API_KEY" \
  -H "Content-Type: application/merge-patch+json" \
  -d '{"rigIds":[518837]}'
```

### SMOS reflash (if needed)
```bash
curl -s -X PATCH "https://api.simplemining.net/rigs/execute-command" \
  -H "X-AUTH-TOKEN: $SMOS_API_KEY" \
  -H "Content-Type: application/merge-patch+json" \
  -d '{"rigIds":[518837],"commandId":40}'  # 40 = i066d
```

---

## 8. Files Modified This Session

| File | Changes |
|------|---------|
| `V3/L1/miner/src/gpu_guard.rs` | `local_ws=256→64` for GCN DeekshaLiteV1 + Fire |
| `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl` | Removed `cl_khr_int64_base_atomics`, `rotate→bit-shift`, `vload4/vstore4 __private→scalar` |
| `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_chv3.cl` | Removed `cl_khr_int64_base_atomics`, `rotate→bit-shift` |
| `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite_fire.cl` | Removed `cl_khr_int64_base_atomics`, `rotate→bit-shift` |
| `VegaRig.md` | Comprehensive Vega 64 settings document (committed earlier) |
| `VEGA_64_I066D_REFLASH_REPORT_2026-07-17.md` | This report |

---

## 9. Key Lesson

**Always check SMOS image/driver version first when debugging Vega GPU hangs.**
The `amd22.40.6` driver family (ROCm 6.x, images i073/i085/i088) is fundamentally
broken for Vega 64 OpenCL kernel execution. The `amd21.50.2` driver (ROCm 5.x,
image i066d) is the only working option. This was documented in
`docs/VEGA_GPU_MINING_DEBUG_REPORT_2026-04-09.md` from April 2026 but was
forgotten during the current session — 3+ hours were spent on kernel fixes
before checking the historical reports.

---

*Generated with [Devin](https://cli.devin.ai/docs)*
*Session: 2026-07-16/17 — Vega 64 i066d reflash + deeksha E2E success*
