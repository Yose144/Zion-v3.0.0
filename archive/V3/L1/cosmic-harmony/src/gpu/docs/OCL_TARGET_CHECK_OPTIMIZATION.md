# OpenCL Target-Check Optimization Report

**Date:** 2026-08-04  
**Version:** v3.0.41-ocl-target-check  
**Goal:** Close the ~3.4x performance gap between AMD OpenCL and NVIDIA CUDA on ZION mining

---

## 1. Problem Statement

| GPU | Backend | Hashrate | Algorithm |
|-----|---------|----------|-----------|
| GTX 1070 (NVIDIA) | CUDA | ~150 kH/s | deeksha_lite_v1 |
| RX 5600 XT (AMD) | OpenCL | 43.90 kH/s | deeksha_lite_v1 |

**Gap:** 3.4x — AMD OpenCL was 3.4x slower than NVIDIA CUDA despite comparable hardware.

---

## 2. Root Cause Analysis

Detailed comparison of CUDA vs OpenCL kernels revealed **4 major differences**:

### 2.1 Missing On-Device Target Check (Biggest Gap — ~3x Impact)

**CUDA kernel** includes `target_u32`, `result_nonce`, `result_hash` parameters:
- Each thread checks its hash **on-device** against the target
- If hash meets target: atomically writes winning nonce + hash to global memory
- Other workgroups **early-exit** when `atomic_add(result_flag, 0) != 0`
- Only 40 bytes transferred back to host (nonce + hash)

**OpenCL kernel** had NO on-device target check:
- Every thread writes its full 32-byte hash to global memory (256KB+ per batch)
- Host reads ALL hashes back via PCIe (2MB+ transfer)
- CPU scans all hashes for solutions
- No early exit — all threads complete full work even after solution found

### 2.2 Data Types: `uchar[32]` vs `ulong[4]`

**CUDA:** Uses `uint64_t[4]` for s1/s2/s3 — natural 64-bit operations  
**OpenCL:** Used `uchar[32]` with casts to `ulong*` — causes:
- Aliasing violations (undefined behavior)
- Compiler unable to optimize 64-bit loads/stores
- Extra register pressure from byte-level operations

### 2.3 Final Keccak: Byte-by-Byte XOR vs u64 Assignments

**CUDA:** Direct `st[0]=s3[0]; st[1]=s3[1]; ...` — single 64-bit assignments  
**OpenCL:** Byte-by-byte XOR loop — 32 individual byte operations instead of 4 u64 ops

### 2.4 AES: Separate Functions vs Inline Block

**CUDA:** Single inline block with `#pragma unroll`  
**OpenCL:** Six separate `always_inline` functions — compiler may not inline across function boundaries on AMD

---

## 3. Fixes Applied

### 3.1 On-Device Target Check + Early Exit

**Files:** `deeksha_lite.cl`, `deeksha_lite_fire.cl`, `deeksha_chv3.cl`

Added 4 new kernel parameters:
```cl
uint target_u32,                        /* big-endian u32 target (0=benchmark) */
__global uint  * restrict result_flag,  /* 0=not found, 1=found (atomic) */
__global ulong * restrict result_nonce, /* winning nonce (written by winner) */
__global uchar * restrict result_hash)  /* winning hash (written by winner) */
```

Added early exit at kernel start:
```cl
if (target_u32 != 0 && atomic_add(result_flag, 0) != 0) return;
```

Added on-device target check at kernel end:
```cl
if (target_u32 != 0) {
    uint hash_low = (uint)(hash_u64[0] & 0xFFFFFFFFUL);
    uint hash_be = ((hash_low & 0xFFu) << 24) | ...;
    if (hash_be <= target_u32) {
        uint old = atomic_xchg(result_flag, 1u);
        if (old == 0u) {
            *result_nonce = nonce;
            __global ulong *rh = (__global ulong*)result_hash;
            rh[0] = hash_u64[0]; rh[1] = hash_u64[1];
            rh[2] = hash_u64[2]; rh[3] = hash_u64[3];
        }
    }
} else {
    /* Benchmark mode: write all hashes to output_hashes */
    __global ulong *slot = (__global ulong*)(output_hashes + tid * 32);
    slot[0] = hash_u64[0]; slot[1] = hash_u64[1];
    slot[2] = hash_u64[2]; slot[3] = hash_u64[3];
}
```

**Extensions enabled:**
```cl
#pragma OPENCL EXTENSION cl_khr_global_int32_base_atomics : enable
#pragma OPENCL EXTENSION cl_khr_global_int32_extended_atomics : enable
```

### 3.2 Data Types: ulong[4]

Changed `s1`, `s2`, `s3` from `uchar[32]` to `ulong[4]`:
- `fill_scratchpad`: `uchar seed[32]` → `ulong seed_u64[4]`
- `random_read_mix`: `uchar seed[32]` / `uchar out[32]` → `ulong seed_u64[4]` / `ulong out_u64[4]`
- `aes128_mix`: Same change, with `__private const uchar *seed = (__private const uchar*)seed_u64;` for AES byte ops
- `thermal_loop`: Same change (fire kernel only)

### 3.3 Final Keccak: u64 Assignments

Changed from byte-by-byte XOR to direct u64 assignments:
```cl
// Before: byte-by-byte XOR loop
// After:
st[0]=s3[0]; st[1]=s3[1]; st[2]=s3[2]; st[3]=s3[3];
st[4]=0; st[5]=0; ... st[24]=0;
st[4] ^= 0x01UL;
st[16] ^= (0x80UL << 56);
keccak_f1600(st);
```

### 3.4 Host Code Updates (`gpu_backend.rs`)

**OpenClDeekshaLiteMiner** and **OpenClDeekshaLiteFireMiner** structs:
- Added `result_flag_buf: Buffer<u32>`
- Added `result_nonce_buf: Buffer<u64>`
- Added `result_hash_buf: Buffer<u8>`

**Kernel builder:** Added 4 new args (target_u32, result_flag, result_nonce, result_hash)

**`mine_batch` function:**
- Computes `target_u32 = u32::from_be_bytes(target.bytes[0..4])`
- **Fast path** (target_u32 != 0): Resets result_flag, launches kernel with target_u32, reads only result_flag/nonce/hash (40 bytes vs 2MB)
- **Benchmark path** (target_u32 == 0): Writes all hashes to output_hashes (existing behavior)

**`launch_batch` function:**
- If target_u32 != 0: Falls back to sync `mine_batch` (on-device check is faster than async write-all-hashes)
- If target_u32 == 0: Uses existing async double-buffered path

**`collect_batch` function:**
- If `sync_fallback == true`: Returns pre-computed solutions from `mine_batch`
- Otherwise: Existing async read event scanning

**`PendingAsyncBatch` struct:**
- Added `nonce_base`, `sync_fallback`, `solutions` fields

---

## 4. Build & Deploy

### 4.1 Build

```bash
# Docker build for SMOS (Debian bullseye, glibc 2.31)
docker run --name zion-miner-build-v41 \
  -v /opt/zion:/src:ro \
  rust:1.97.0-bullseye bash -c '
    apt-get install -y build-essential pkg-config libssl-dev ocl-icd-opencl-dev libdrm-dev libdrm-amdgpu1 mesa-opencl-icd kmod
    rsync -a /src/ /build/  # with excludes
    cd /build/V3
    cargo build --release -p zion-miner --features full --bin zion-miner
    cp target/release/zion-miner /out/
  '

# Result: 8.7MB stripped ELF binary
```

### 4.2 Deploy

```bash
# Copy binary to edge server web root
cp /tmp/zion-miner-v3.0.41-ocl-target-check /var/www/zion-miner/zion-miner
chmod +x /var/www/zion-miner/zion-miner

# Package SMOS wrapper
bash scripts/edge-package-smos.sh v3.0.41-ocl-target-check /var/www/zion-miner

# Result: http://62.171.141.136/zion-miner/zion-miner-v3.0.41-ocl-target-check.zip
```

### 4.3 Rig Update

SMOS rig downloads the new binary automatically on reboot via the wrapper script.
The wrapper script at `/var/www/zion-miner/zion-miner-v3.0.41-ocl-target-check.zip` contains:
- `miner` — SMOS entry point script (downloads real binary, starts miner)
- `smos.env.example` — env overrides

---

## 5. Files Modified

| File | Change |
|------|--------|
| `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl` | All 4 fixes |
| `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite_fire.cl` | All 4 fixes |
| `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_chv3.cl` | All 4 fixes |
| `V3/L1/miner/src/gpu_backend.rs` | Host code for new kernel args |
| `V3/L1/miner/src/main.rs` | Synced to edge (private_print macro) |
| `AuXpow/src/external_hashers.rs` | Synced to edge (hash_etchash) |
| `AuXpow/src/lib.rs` | Synced to edge |

---

## 6. Expected Performance

| Metric | Before | Expected After | Improvement |
|--------|--------|----------------|-------------|
| Hashrate | 43.90 kH/s | ~100-150 kH/s | 2.3-3.4x |
| PCIe transfer per batch | 2MB+ | 40 bytes | 50000x reduction |
| CPU scan time | ~5ms/batch | 0ms | Eliminated |
| Early exit | No | Yes | Full batch skip after solution |

**Target:** Match CUDA GTX 1070 hashrate (~150 kH/s) on RX 5600 XT.

---

## 7. Known Issues

1. **Edge CPU miner reconnect storm:** `zion-edge-miner.service` on the edge server generates rapid reconnect attempts to the V31 pool (127.0.0.1:8444), triggering rate limiting. Must be disabled when not needed.

2. **V3 vs V31 pool port conflict:** Both V3 and V31 pools try to bind port 8444. V31 pool wins (started first). V3 pool (`zion-edge-pool.service`) enters restart loop. Disabled V3 pool to resolve.

3. **Fail2ban IPv4 bans:** Rapid SSH reconnects from operator IP can trigger fail2ban. Use IPv6 fallback (`ssh -6 root@2a02:c207:2342:5821::1`) when IPv4 is banned.
