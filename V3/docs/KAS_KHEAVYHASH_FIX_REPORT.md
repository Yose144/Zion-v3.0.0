# KAS kHeavyHash GPU/CPU Mismatch Fix Report

**Date:** 2026-07-27  
**Scope:** `kheavyhash` CUDA kernel in `zion-miner` vs. Rust CPU reference (`zion_auxpow::hash_kheavyhash`)  
**Status:** Fixed in local benchmark; live pool confirmation pending

---

## 1. Problem

The CUDA benchmark for KAS `kheavyhash` consistently reported `GPU_CPU_MISMATCH`, e.g.:

```text
GPU_CPU_MISMATCH #1 nonce=3530 h=0 algo=kheavyhash \
  gpu_hash=bdff718dd7d5e694 cpu_hash=e411f39c3a2de184 \
  gpu_meets_target=false cpu_meets_target=true
```

Found nonces validated against the CPU reference, so any share submitted by the GPU would be rejected by the upstream pool.

---

## 2. Reproduction

Command used for local reproduction:

```powershell
$env:PATH = "C:\Zion\nvrtc_tmp\nvidia\cuda_nvrtc\bin;" + $env:PATH
$env:ZION_AUTOTUNE = "0"
$env:ZION_GPU_WORK_SIZE = "8192"
$env:ZION_EXT_GPU_BACKEND = "cuda"
.\target\release\zion-miner.exe --profile benchmark --algorithm kheavyhash --gpu cuda --no-tui --loops 1
```

The benchmark uses a synthetic `MiningHeader`:

| Field | Value |
|-------|-------|
| `version` | `3` |
| `previous_hash` | `[0x11; 32]` |
| `merkle_root` | `[0x22; 32]` |
| `timestamp` | `1_762_000_200` |
| `difficulty_bits` | `0x1f00ffff` |

The GPU kernel uses the first 32 bytes of the serialized header as the `pre_pow_hash` and `header.timestamp` as the KAS timestamp.

---

## 3. Investigation

### 3.1 CPU reference values

A new test, `kheavyhash_benchmark_vector`, was added to `AuXpow/src/external_hashers.rs` to print CPU intermediate values for the benchmark header.

For nonce `3530` with the correct timestamp `1_762_000_200`:

```text
cpu_kheavyhash nonce=3530 vector: e411f39c3a2de184...
```

For the same nonce but with timestamp `0`:

```text
cpu_kheavyhash_timestamp0 nonce=3530 vector: bdff718dd7d5e694...
```

The GPU-reported hash `bdff718dd7d5e694` matched the CPU reference **with timestamp = 0**. This proved the CUDA kernel itself was computing the same `kHeavyHash` as the Rust reference, but it was being given `timestamp = 0`.

### 3.2 Why the GPU saw `timestamp = 0`

`V3/L1/miner/src/gpu_backend.rs` had this logic in `gpu_scan_job` and `gpu_scan_async`:

```rust
let mut effective_header = job.header;
if is_external_algorithm(algorithm) {
    effective_header.timestamp = job.height;
}
```

For the benchmark `MiningJob`, `job.height` is `0` (`MiningPool::issue_job` sets `height: 0`). The correct timestamp was in `job.header.timestamp`, but it was being overwritten with `0`.

For pool-mode KAS jobs, the correct timestamp is in `job.height` because the KAS `header_hex` sent by the pool is only the 32-byte `pre_pow_hash`; the 80-byte `MiningHeader` that the miner reconstructs has `timestamp = 0`.

So the timestamp source depends on the job origin:

| Mode | `header.timestamp` | `job.height` | Correct source |
|------|-------------------|--------------|----------------|
| Benchmark | `1_762_000_200` | `0` | `header.timestamp` |
| Pool | `0` | KAS timestamp | `job.height` |

### 3.3 Why the CPU audit disagreed

`zion_core::BlockCandidate::hash_with_algorithm` was using `self.height` as the KAS timestamp:

```rust
"kheavyhash" | "kheavy" => {
    zion_auxpow::hash_kheavyhash(&header_bytes, self.height, self.nonce)
}
```

For benchmark jobs this happened to work because `header_bytes` contained `timestamp` and `self.height` was `0`... but `hash_kheavyhash` only reads `pre_pow_hash` (first 32 bytes) plus the explicit timestamp argument, so `self.height = 0` was wrong. The CPU audit therefore produced `e411...` while the GPU produced `bdff...`.

### 3.4 Matrix check

The CUDA code generated its own kHeavyHash matrix using a duplicated XoShiRo256++ PRNG and rank check. To eliminate any possibility of matrix divergence, `generate_kheavy_matrix_cuda()` was changed to delegate to `zion_auxpow::kheavyhash_matrix_flat()`, which returns the exact same matrix used by the CPU reference.

---

## 4. Fixes

### 4.1 `V3/L1/core/src/lib.rs` — CPU reference uses `header.timestamp`

```rust
"kheavyhash" | "kheavy" => {
    let pre_pow_hash = &header_bytes[..32];
    let timestamp = if self.header.timestamp != 0 {
        self.header.timestamp
    } else {
        self.height
    };
    zion_auxpow::hash_kheavyhash(pre_pow_hash, timestamp, self.nonce)
}
```

### 4.2 `V3/L1/miner/src/gpu_backend.rs` — GPU timestamp source

```rust
let mut effective_header = job.header;
if algorithm.starts_with("kheavyhash") {
    if effective_header.timestamp == 0 && job.height != 0 {
        effective_header.timestamp = job.height;
    }
} else if is_external_algorithm(algorithm) {
    effective_header.timestamp = job.height;
}
```

Applied in both `gpu_scan_job` and `gpu_scan_async`.

### 4.3 `V3/L1/pool/src/bin/server.rs` — pool-side candidate reconstruction

```rust
let mut header = MiningHeader::from_bytes(header_bytes);
if j.algorithm == "kheavyhash" || j.algorithm == "kheavyhash_kas" {
    header.timestamp = j.timestamp;
}
let height = j.block_number.unwrap_or(j.timestamp);
```

This ensures pool-side CPU validation and the GPU kernel hash the same inputs.

### 4.4 `V3/L1/miner/src/cuda_external.rs` — shared matrix

```rust
fn generate_kheavy_matrix_cuda() -> [u16; 4096] {
    use std::sync::OnceLock;
    static MATRIX: OnceLock<[u16; 4096]> = OnceLock::new();
    *MATRIX.get_or_init(zion_auxpow::kheavyhash_matrix_flat)
}
```

The duplicated `XoShiRo256PlusPlus`, `compute_rank_64`, and `mod_inv_15` helpers were removed.

### 4.5 `AuXpow/src/external_hashers.rs` — exported matrix helper + known-answer test

- Added `pub fn kheavyhash_matrix_flat() -> [u16; 4096]` and re-exported it in `AuXpow/src/lib.rs`.
- Added `kheavyhash_benchmark_vector` test with the benchmark header for nonce `4682`:

```text
pre_pow  : version=3, previous_hash=[0x11;32] (first 28 bytes follow version)
timestamp: 1_762_000_200
nonce    : 4682
hash     : 1cff8de2f856c9a5c7970f35cb2642496bff0b5be2a42c61e3ca4a657914a93e
```

---

## 5. Verification

### 5.1 Unit tests

```powershell
cd AuXpow
cargo test --lib external_hashers
# test result: ok. 66 passed; 0 failed

cd ..\V3
cargo test --release -p zion-core
# all tests passed
```

### 5.2 CUDA benchmark

```powershell
cd V3
$env:PATH = "C:\Zion\nvrtc_tmp\nvidia\cuda_nvrtc\bin;" + $env:PATH
cargo build --release -p zion-miner --features gpu-cuda
.\target\release\zion-miner.exe --profile benchmark --algorithm kheavyhash --gpu cuda --no-tui --loops 1
```

Output after fix:

```text
found_nonce=3626
hash=206d2cb0d1cdc02faeb1ef8920c2a748b7e814f7b4da81cf8d54f29c64088e5a
```

No `GPU_CPU_MISMATCH` was logged, and the found hash matches the CPU reference.

### 5.3 Independent CPU verification

Using `zion_auxpow::hash_kheavyhash` with the benchmark header and the found nonce:

```rust
let mut pre_pow = [0x11u8; 32];
pre_pow[0..4].copy_from_slice(&3u32.to_le_bytes());
let h = hash_kheavyhash(&pre_pow, 1_762_000_200u64, 3626u64);
```

Result matches the GPU-reported `206d2cb0...64088e5a`.

---

## 6. Files changed

| File | Change |
|------|--------|
| `V3/L1/core/src/lib.rs` | KAS `hash_with_algorithm` uses `header.timestamp` with `height` fallback |
| `V3/L1/miner/src/gpu_backend.rs` | Conditional timestamp selection for `kheavyhash` in `gpu_scan_job` / `gpu_scan_async` |
| `V3/L1/pool/src/bin/server.rs` | `assignment_to_candidate` sets `MiningHeader.timestamp` for KAS external jobs |
| `V3/L1/miner/src/cuda_external.rs` | `generate_kheavy_matrix_cuda` uses CPU matrix; removed duplicated PRNG/rank code |
| `AuXpow/src/external_hashers.rs` | Added `kheavyhash_matrix_flat` and `kheavyhash_benchmark_vector` test |
| `AuXpow/src/lib.rs` | Re-exported `kheavyhash_matrix_flat` |
| `V3/docs/AUXPOW_ALGORITHM_VERIFICATION_REPORT.md` | Updated with KAS fix summary and status |
| `V3/docs/KAS_KHEAVYHASH_FIX_REPORT.md` | This report |

---

## 7. Remaining work

- **Live pool share:** The local benchmark now matches the CPU reference, but a share must still be accepted by the upstream KAS pool (`kas.2miners.com` via the debug pool) to confirm full end-to-end behavior.
- **Hashrate:** The current CUDA `kheavyhash` kernel achieves ~3.3 MH/s on a GTX 1070 Ti, which is far below reference miners. Performance optimization is out of scope for this correctness fix but remains a future improvement.
- **`zion-pool` default build:** `zion-native-ffi` currently fails to compile on MSVC because of a variable-length array in `ghostrider/real/gr.c` (`bool selectedAlgo[algoCount]`). This is pre-existing and unrelated to KAS.

---

## 8. Commit

Commit `ca82ec34d` on branch `main`:

```text
Fix KAS kheavyhash GPU/CPU hash mismatch.
```

Also includes the previously uncommitted EVR/MEWC CUDA routing and 12000-block epoch fixes.
