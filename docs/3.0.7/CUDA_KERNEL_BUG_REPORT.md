# CUDA Kernel Bug Report — Deeksha Lite v1 / Fire / Cosmic Harmony

**Date:** 2026-07-27
**Status:** Fixed (commits `4c9cdc0e`, `44084d8a`, `f729613f`)
**Affected hardware:** NVIDIA GTX 1070 Ti (and all CUDA GPUs with `threads_per_block < 256`)
**Symptom:** GPU miner reported high hashrate but could never find a block. Pool accepted shares (submitted hash met target) but logged `hash_mismatch` on every share — the GPU-produced hash did not match the CPU reference hash. No block was ever mined via CUDA.

---

## Summary

Three distinct bugs were found in the CUDA mining kernels. All three contributed to the GPU producing incorrect hashes. The combination made diagnosis difficult: the byte-order bug masked the S-box bug, and the S-box bug was the actual root cause of the hash mismatch.

| # | Bug | File(s) | Severity | Commit |
|---|-----|---------|----------|--------|
| 1 | AES S-box shared memory loading incomplete | `deeksha_lite.cu`, `deeksha_lite_fire.cu` | **Critical** — root cause | `f729613f` |
| 2 | `__byte_perm` selector `0x3210` is identity (no-op), not byte-swap | `deeksha_lite.cu`, `deeksha_lite_fire.cu`, `cosmic_harmony_deeksha.cu` | High — target check broken | `44084d8a` |
| 3 | Target passed to GPU in little-endian, GPU compared in little-endian, but host uses big-endian lexicographic comparison | `gpu_backend.rs` | High — target check broken | `4c9cdc0e` |

---

## Bug #1: AES S-box Shared Memory Loading (Root Cause)

### The Bug

The CUDA kernels load the 256-byte AES S-box into `__shared__` memory at kernel start. The original code used a single-entry-per-thread pattern:

```cuda
__shared__ uint8_t sbox[256];
{
    uint32_t tid_local = threadIdx.x;
    if (tid_local < 256) {
        sbox[tid_local] = AES_SBOX_DATA[tid_local];
    }
    __syncthreads();
}
```

The default `threads_per_block` is **64** (configurable via `ZION_CUDA_TPB`). With only 64 threads per block, the condition `tid_local < 256` is always true, but only `sbox[0..63]` get loaded. The remaining **192 entries stay zero** (shared memory is zero-initialized).

### Impact

Every `aes128_mix()` call uses the corrupt S-box for SubBytes:
```cuda
for (int i = 0; i < 16; i++) { b0[i] = sbox[b0[i]]; b1[i] = sbox[b1[i]]; }
```

For any input byte value ≥ 64, `sbox[value]` returns `0` instead of the correct AES substitution value. This completely corrupts the AES-128 CTR mix step (Step 3 of Deeksha Lite), producing wrong `s3[32]` and therefore a wrong final hash.

The GPU hash was **completely different** from the CPU reference hash. Pool logs showed:
```
hash_mismatch_info miner=desktop-agent@g=zion job=7266
  computed=359be9a9747c013536be3233b18aeeabfb31ff5ce212f24546b083c59a41480f
  submitted=0005594729bce672fe341449057d4616cc7d6ffdae8f10d3d3dea7f16cdeea63
```

The submitted (GPU) hash happened to meet the share target (`0005...` < `05b0...`), so the pool accepted the share for PPLNS accounting. But the real block hash (computed by the pool/node via CPU) was `359be9a9...`, which did **not** meet the block target. No block was ever found.

### Why It Was Hard to Find

- The GPU hashrate looked normal (kernels ran, produced hashes, submitted shares).
- Shares were **accepted** by the pool (the corrupt hash still met the easy share target).
- The `hash_mismatch_info` log line was present but easy to overlook among the flood of `share_status=Accepted` messages.
- The bug only manifests when `threads_per_block < 256`. If someone ran with `ZION_CUDA_TPB=256`, the S-box would load correctly and hashes would match — making the bug configuration-dependent and hard to reproduce.

### The Fix

Use a strided loop so each thread loads multiple entries:

```cuda
__shared__ uint8_t sbox[256];
{
    uint32_t tid_local = threadIdx.x;
    uint32_t blockDim_x = blockDim.x;
    for (uint32_t i = tid_local; i < 256; i += blockDim_x) {
        sbox[i] = AES_SBOX_DATA[i];
    }
    __syncthreads();
}
```

This works correctly for any `blockDim.x` (32, 64, 128, 256, etc.).

### Files Fixed

- `V3/L1/miner/src/deeksha_lite.cu` — mine kernel (line ~431) + debug kernel (line ~565)
- `V3/L1/miner/src/deeksha_lite_fire.cu` — mine kernel (line ~484) + debug kernel (line ~621)

**4 sites total** (both the production mine kernel and the debug/KAT kernel in each file).

### Note on `cosmic_harmony_deeksha.cu`

The Cosmic Harmony Deeksha kernel (`cosmic_harmony_deeksha.cu`) was **not affected** by this bug. It uses `__constant__` memory for the AES S-box directly (no shared memory copy), so the S-box is always fully populated by the compiler.

---

## Bug #2: `__byte_perm` Selector Was Identity, Not Byte-Swap

### The Bug

The target check in the CUDA kernel compares the first 4 bytes of the hash against a `target_u32`. The hash is stored in little-endian (native GPU memory order), but the target is passed as big-endian (to match the host's lexicographic `DifficultyTarget::allows()` comparison).

The original "fix" attempt used:
```cuda
uint32_t hash_be = __byte_perm(hash_low, 0u, 0x3210u);
```

**`__byte_perm(x, 0, 0x3210)` is the identity operation** — it returns `x` unchanged. The selector `0x3210` means:
- output byte 0 = source byte 0
- output byte 1 = source byte 1
- output byte 2 = source byte 2
- output byte 3 = source byte 3

No byte-swap occurs. The hash remained in little-endian while the target was big-endian, so the comparison was still wrong.

### The Fix

The correct selector for LE→BE byte-swap is `0x0123`:
```cuda
uint32_t hash_be = __byte_perm(hash_low, 0u, 0x0123u);
```

`0x0123` means:
- output byte 0 = source byte 3 (MSB)
- output byte 1 = source byte 2
- output byte 2 = source byte 1
- output byte 3 = source byte 0 (LSB)

This reverses the byte order, converting little-endian to big-endian.

### Files Fixed

- `V3/L1/miner/src/deeksha_lite.cu`
- `V3/L1/miner/src/deeksha_lite_fire.cu`
- `V3/L1/miner/src/cosmic_harmony_deeksha.cu`

---

## Bug #3: Target Byte Order Mismatch (Host ↔ GPU)

### The Bug

The host-side `DifficultyTarget::allows()` performs a **big-endian lexicographic** comparison:
```rust
fn allows(&self, hash: &[u8; 32]) -> bool {
    hash <= &self.bytes  // lexicographic = big-endian comparison
}
```

The original GPU code passed the target as a **little-endian** u32:
```rust
let target_u32 = u32::from_le_bytes([
    target.bytes[0], target.bytes[1], target.bytes[2], target.bytes[3],
]);
```

And the GPU kernel compared the hash (also little-endian) directly:
```cuda
if (hash_low <= target_u32) { /* solution found */ }
```

This `<=` comparison on little-endian u32 values does **not** correspond to the lexicographic big-endian comparison the host uses. For example:
- Hash `0x0005...` and target `0x05b0...`
- LE u32 comparison: `0x...0500 <= 0x...b005` → may be true or false depending on lower bytes
- BE lexicographic: `00 05 ...` <= `05 b0 ...` → true (correct)

### The Fix

Pass the target as **big-endian** u32 to the GPU:
```rust
let target_u32 = u32::from_be_bytes([
    target.bytes[0], target.bytes[1], target.bytes[2], target.bytes[3],
]);
```

And byte-swap the hash to big-endian in the kernel (Bug #2 fix):
```cuda
uint32_t hash_be = __byte_perm(hash_low, 0u, 0x0123u);
if (hash_be <= target_u32) { /* solution found */ }
```

Now `hash_be <= target_u32` as u32 values corresponds exactly to `hash[0..4] <= target[0..4]` lexicographically, matching the host's `DifficultyTarget::allows()`.

### Files Fixed

- `V3/L1/miner/src/gpu_backend.rs` — all CUDA backend `mine_batch` / `launch_batch` functions (deeksha_lite, deeksha_lite_fire, cosmic_harmony_deeksha)

---

## OpenCL Reference (Not Affected)

The OpenCL kernel (`V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl`) was not affected by any of these bugs:

1. **S-box**: OpenCL uses `__constant` memory for the AES S-box directly — no shared memory copy, no loading bug.
2. **Target check**: The OpenCL kernel does **no target check in-kernel**. It writes all hashes to the output buffer and the host scans them with `DifficultyTarget::allows()`. There is no byte-order mismatch.
3. **Hash correctness**: OpenCL produces bit-identical hashes to the CPU reference (verified by KAT tests).

This is why the AMD OpenCL reference miner was finding blocks while the CUDA miner was not, despite both reporting similar hashrates.

---

## Diagnosis Timeline

1. **Initial symptom**: GPU shares rejected by pool as `no_solution` / wrong hash.
2. **First hypothesis**: Byte order mismatch between GPU target check and host verification.
3. **First fix attempt** (commit `4c9cdc0e`): Changed `from_le_bytes` → `from_be_bytes` for target, added `__byte_perm` for hash byte-swap. **But `__byte_perm` selector was wrong** (`0x3210` = identity).
4. **Second fix** (commit `44084d8a`): Corrected `__byte_perm` selector to `0x0123`. Shares now accepted by pool, but `hash_mismatch` still logged on every share — GPU hash ≠ CPU hash.
5. **Root cause discovery**: Pool log `hash_mismatch_info` revealed GPU produces completely wrong hashes. Traced to AES S-box shared memory loading bug.
6. **Final fix** (commit `f729613f`): Strided S-box loading loop. GPU hashes now match CPU reference.

## Verification

After the final fix, the pool should no longer log `hash_mismatch_info` for CUDA-mined shares. The GPU-produced hash will match the CPU reference hash exactly, and blocks will be found when the hash meets the block target.

**KAT (Known Answer Test) recommendation**: A CUDA KAT test that compares the GPU hash against the CPU reference for a fixed (header, nonce) pair should be added to catch regressions. The debug kernel (`deeksha_lite_debug`) already exists for this purpose — it just needs to be called from a test harness with the corrected S-box loading.

---

## Commits

| Commit | Description |
|--------|-------------|
| `4c9cdc0e` | Fix CUDA target byte order (LE→BE) — first attempt (had wrong `__byte_perm` selector) |
| `44084d8a` | Fix `__byte_perm` selector: `0x3210` (identity) → `0x0123` (byte-swap) |
| `f729613f` | **Fix AES S-box shared memory loading (root cause of hash mismatch)** |
