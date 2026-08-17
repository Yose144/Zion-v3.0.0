# RIG DEBUG REPORT — Vega 64 SMOS OpenCL Optimization & Recovery
**Date:** 2026-08-08
**Rig:** ZionRig / vega-smos (AMD Vega 64 8GB gfx900, Intel Pentium G4560)
**Pool:** 62.171.141.136:8444
**Wallet:** zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6

---

## 1. Starting State

- Rig (vega-smos) was mining EkamDeeksha v3.2 via OpenCL on Vega 64
- Shares accepted (~6 shares / 5 min), block 249 found and accepted by node
- Hashrate was very low: ~0.3 H/s on pool (1 share per 33-60 seconds)
- Mac M1 Metal GPU: 2.43 KH/s (work_size=8192)

## 2. Root Cause Analysis

### 2.1 gpu_guard.rs scratchpad size mismatch
**File:** `V31/L1/miner/src/gpu_guard.rs`

`GpuTuning::auto_tune()` had `scratchpad_bytes = 256 * 1024` (256 KiB) for `DeekshaLiteV1`,
but the actual OpenCL kernel (`deeksha_lite.cl`) uses `SCRATCHPAD_SIZE = 524288` (512 KiB, v3.2).

This meant VRAM allocation was calculated with the wrong per-thread footprint:
- `per_thread = 256 KiB + 128 = ~256 KiB` (gpu_guard estimate)
- `actual per_thread = 512 KiB + 64 = ~512 KiB` (real allocation in mod.rs)

Result: `work_size` was capped at 16384 (using 256 KiB estimate = ~4 GiB),
but actual allocation was 16384 × 512 KiB = **8 GiB** — the entire Vega 64 HBM2.
This caused VRAM exhaustion, kernel crashes, and extremely slow performance.

### 2.2 Metal kernel using byte-by-byte SHA3-512
**File:** `V31/L1/miner/src/gpu/kernels/metal/deeksha_lite.metal`

The Metal kernel used a generic byte-by-byte `sha3_512()` function for scratchpad fill,
while the OpenCL kernel had an optimized `sha3_512_65_u64()` that operates on `ulong` state
directly (8 u64s input → 8 u64s output, no byte-level XOR loop).

This caused Metal M1 hashrate to be 2.43 KH/s instead of the potential 3.88 KH/s.

## 3. Fixes Applied

### 3.1 gpu_guard.rs — correct scratchpad size
```rust
// BEFORE:
GpuAlgorithm::DeekshaLiteV1 => 256 * 1024, // 256 KiB per thread

// AFTER:
GpuAlgorithm::DeekshaLiteV1 => 512 * 1024, // 512 KiB per thread (v3.2 ASIC-hardened)
GpuAlgorithm::DeekshaLiteFire => 512 * 1024, // 512 KiB per thread (v3.2 + thermal loop)
```

### 3.2 gpu_guard.rs — reduce Vega 64 work_size
```rust
// BEFORE:
let ws = (max_by_vram.min(16384).max(256)).next_power_of_two();
let opts = "-cl-std=CL1.2".to_string();
(ws, 64, opts, 85, false)

// AFTER:
let ws = (max_by_vram.min(4096).max(256)).next_power_of_two();
let opts = "-cl-std=CL1.2 -cl-mad-enable".to_string();
(ws, 64, opts, 50, false)
```

4096 threads × 512 KiB = 2 GiB scratchpad (safe for 8GB HBM2 with driver/desktop reserve).

### 3.3 Metal kernel — u64-optimized SHA3-512
Added `sha3_512_65_u64()` function to Metal kernel (ported from OpenCL):
- Takes 8 u64 state + 1 block byte → 8 u64 output
- No byte-by-byte XOR loop (65 byte XOR ops eliminated per block)
- Updated `fill_scratchpad()` to use u64 API
- Updated `random_read_mix()` to use u64 API
- Updated main kernel to use u64 throughout (Keccak256, final hash)

**Result:** M1 Metal hashrate improved from 2.43 KH/s → **3.88 KH/s (+45%)**

### 3.4 Metal backend — batch_size cap
**File:** `V31/L1/miner/src/gpu/metal_deeksha_lite.rs`

Added `.min(8192)` cap to batch_size to keep batch latency reasonable on M1.

## 4. Build & Deployment

### 4.1 Mac M1 build
```
cargo build --release -p zion-miner --features gpu-metal,auxpow,native-etchash,native-verushhash
```
- Hash verified: Metal GPU hash matches CPU hash (metal_hash_test PASS)
- Benchmark: 3.88 KH/s (work_size=4096)

### 4.2 Linux build (Edge server)
Initial build on Edge (Ubuntu 24.04, GLIBC 2.39):
```
cargo build --release -p zion-miner --no-default-features --features auxpow,native-etchash,native-verushhash
```
**Problem:** Binary required GLIBC 2.34, but SMOS rig runs Ubuntu 18.04 (GLIBC 2.27).

### 4.3 Linux build (Ubuntu 18.04 Docker)
Created Docker image `zion-rust-1804` (Ubuntu 18.04 + Rust stable):
```dockerfile
FROM ubuntu:18.04
RUN apt-get update && apt-get install -y curl build-essential pkg-config libssl-dev libclang-dev
RUN curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
```

Full clean build in container:
```
docker run --rm -v /opt/zion/V31-build:/work -w /work zion-rust-1804 \
  bash -c "cargo clean && cargo build --release -p zion-miner --no-default-features --features auxpow,native-etchash,native-verushhash"
```
- Build time: 9m 47s
- GLIBC requirement: **2.25** (compatible with SMOS Ubuntu 18.04 GLIBC 2.27)
- Binary size: 5,686,136 bytes

### 4.4 Deployment to Edge
```
cp /opt/zion/V31-build/target/release/zion-miner /var/www/zion-miner/zion-miner-v31
```
- Wallet updated in wrapper: `zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6`
- Trinity ZIP rebuilt: `/var/www/zion-miner/zion-trinity-smos.zip`

## 5. Rig Recovery Issue

### 5.1 What happened
1. First deployment used GLIBC 2.34 binary → miner crashed immediately on rig (GLIBC too new)
2. SMOS detected miner crash → rebooted rig
3. Rig rebooted → downloaded new binary → crashed again → reboot (loop)
4. StartCount reached 52 (52 reboot cycles)
5. SMOS agent service crashed and could not recover
6. After power cycle and additional reboots, SMOS agent still not starting (Status=None, LastActivity=None)

### 5.2 Current rig state
- **IP:** 109.81.87.8 (online — web browser traffic visible in nginx logs)
- **SMOS API:** Status=None, StartCount=1-2, LastActivity=None
- **SMOS agent:** NOT RUNNING (cannot execute commands via API)
- **Miner:** NOT RUNNING (no pool connections from rig IP)
- **SSH:** Port 22 not accessible (rig behind NAT/firewall, only SMOS API works)

### 5.3 Root cause
The GLIBC 2.34 binary caused miner crashes on SMOS (Ubuntu 18.04, GLIBC 2.27).
The repeated crash-reboot cycles (52x) corrupted the SMOS agent service.
Even after deploying the correct GLIBC 2.25 binary, the SMOS agent cannot start.

### 5.4 Recovery steps needed (manual)
1. **Physical power cycle** — turn off rig power, wait 10 seconds, turn on
2. If SMOS agent still doesn't start: **SMOS reinstall** via USB bootable flash
3. Once SMOS agent is back: rig will auto-download `zion-trinity-smos.zip` and start miner
4. Verify miner connects to pool with new GLIBC 2.25 binary

### 5.5 Prevention for future deployments
**ALWAYS build in Ubuntu 18.04 Docker container** before deploying to SMOS rig:
```bash
docker run --rm -v /opt/zion/V31-build:/work -w /work zion-rust-1804 \
  bash -c "cargo clean && cargo build --release -p zion-miner --no-default-features --features auxpow,native-etchash,native-verushhash"
```
Verify GLIBC requirement: `objdump -T target/release/zion-miner | grep GLIBC | sort -u -V | tail -1`
Must be ≤ 2.27 for SMOS compatibility.

## 6. Mac M1 Results (Verified)

| Metric | Value |
|--------|-------|
| Backend | Metal |
| Algorithm | deeksha_lite_v1 (Ekam v3.2) |
| Hash match | ✅ Bit-identical to CPU |
| Hashrate | 3.88 KH/s (work_size=4096) |
| Improvement | +45% (2.43 → 3.88 KH/s) |
| Shares | ✅ Accepted by pool |
| Blocks | ✅ Found and accepted |

## 7. Files Changed

| File | Change |
|------|--------|
| `V31/L1/miner/src/gpu_guard.rs` | scratchpad_bytes 256→512 KiB, Vega work_size 16384→4096, added -cl-mad-enable |
| `V31/L1/miner/src/gpu/kernels/metal/deeksha_lite.metal` | Added sha3_512_65_u64(), u64 fill_scratchpad, u64 random_read_mix, u64 main kernel |
| `V31/L1/miner/src/gpu/metal_deeksha_lite.rs` | batch_size cap at 8192 |

## 8. Edge Server Artifacts

| Artifact | Path |
|----------|------|
| Linux binary (GLIBC 2.25) | `/var/www/zion-miner/zion-miner-v31` |
| Trinity wrapper | `/var/www/zion-miner/wrapper_v31_trinity.sh` |
| Trinity ZIP | `/var/www/zion-miner/zion-trinity-smos.zip` |
| Docker build image | `zion-rust-1804:latest` (Ubuntu 18.04 + Rust) |
| Build source | `/opt/zion/V31-build/` |

## 9. Next Steps

1. **Rig recovery:** Physical power cycle or SMOS reinstall
2. **Rig verification:** Once SMOS agent is back, verify miner connects with GLIBC 2.25 binary
3. **Rig hashrate:** Verify Vega 64 hashrate improvement (expected: 2-3x faster than before)
4. **Trinity engine:** After both GPUs are stable, proceed with Stream 2/3 (ZANO + VRSC)

---

Generated with [Devin](https://devin.ai)
