# OpenCL vs CUDA Hashrate Parity Report

**Date:** 2026-07-27
**Status:** Fixed (commit `6b3561c23`)
**Affected:** All AMD/OpenCL GPUs mining Deeksha Lite v1 or Deeksha Lite Fire
**Symptom:** OpenCL (AMD) hashrate significantly lower than CUDA (NVIDIA) despite comparable hardware. GTX 1070 Ti (CUDA) reported ~78 kH/s while similar-tier AMD GPUs lagged well behind.

---

## Summary

The OpenCL Deeksha Lite kernels performed massive amounts of **unnecessary computation** after computing the PoW hash. This "stream byproduct work" — extra keccak, SHA3-512, and AES-128 iterations — did not affect the hash output but burned GPU cycles. The CUDA kernel did no byproduct work at all, creating a fundamental and unfair asymmetry between the two backends.

| Metric | OpenCL (before) | CUDA | OpenCL (after fix) |
|--------|-----------------|------|-------------------|
| Extra keccak_f1600 per hash | 807 | 0 | 0 |
| Extra AES rounds per hash | 6,336 | 0 | 0 |
| Extra SHA3-512 per hash | 86 | 0 | 0 |
| Total extra work | ~10% keccak + 79,000% AES | 0 | 0 |

---

## Root Cause: Stream Byproduct Work

### What It Was

After computing the PoW hash (Steps 1-4 of Deeksha Lite), the OpenCL kernel executed additional "stream byproduct" functions:

```opencl
/* Stream-profit byproduct work (does not affect PoW hash) */
if (stream_weights) {
    int keccak_iters = (int)(stream_weights[SW_KECCAK_BONUS] * STREAM_ITERS_SCALE);
    stream_byproduct_keccak(hash, keccak_iters, pad);

    int sha3_iters = (int)(stream_weights[SW_SHA3_BONUS] * STREAM_ITERS_SCALE);
    stream_byproduct_sha3(hash, sha3_iters, pad);

    float aes_weight = stream_weights[SW_NCL_AI] + stream_weights[SW_DEEKSHA_LITE] + stream_weights[SW_THERMAL];
    int aes_iters = (int)(aes_weight * STREAM_ITERS_SCALE);
    stream_byproduct_aes(hash, nonce, aes_iters, pad);

    int zion_iters = (int)(stream_weights[SW_ZION] * STREAM_ITERS_SCALE);
    stream_byproduct_keccak(hash, zion_iters, pad);
}
```

### How Much Extra Work

With typical pool stream weights (`zion:36.2, keccak_bonus:8.9, sha3_bonus:5.4, ncl_ai:17.3, deeksha_lite:27.3, thermal_bonus:4.9`) and `STREAM_ITERS_SCALE = 16.0`:

| Byproduct | Formula | Iterations | Work per iteration | Total extra work |
|-----------|---------|------------|-------------------|-----------------|
| keccak_bonus | 8.9 × 16 | 142 | 1 keccak_f1600 | 142 keccak_f1600 |
| sha3_bonus | 5.4 × 16 | 86 | 1 sha3_512 (= 1 keccak_f1600) | 86 keccak_f1600 |
| aes (ncl_ai + deeksha_lite + thermal) | (17.3 + 27.3 + 4.9) × 16 | 792 | 1 aes128_mix (= 8 AES rounds) | 6,336 AES rounds |
| zion | 36.2 × 16 | 579 | 1 keccak_f1600 | 579 keccak_f1600 |
| **Total** | | | | **807 keccak + 6,336 AES** |

### Comparison to Base Hash

The base Deeksha Lite hash requires:
- Step 1: 1 keccak_f1600
- Step 2 (Phase A): 8,192 sha3_512 = 8,192 keccak_f1600
- Step 3: 1 aes128_mix = 8 AES rounds
- Step 4: 1 keccak_f1600
- **Total base: ~8,194 keccak_f1600 + 8 AES rounds**

The byproduct work added:
- **+807 keccak_f1600** → ~10% more keccak work
- **+6,336 AES rounds** → 79,200% more AES work (6,336 vs 8)

The AES overhead was the dominant factor. Each `aes128_mix` call involves S-box lookups (256-byte table), ShiftRows, MixColumns (GF(2^8) multiplication), and AddRoundKey — all computationally expensive. 792 extra calls per hash was an enormous penalty.

### Why It Was Unfair

The CUDA kernel (`deeksha_lite.cu`, `deeksha_lite_fire.cu`) **never implemented** the stream byproduct work. It computed the PoW hash and immediately wrote the result. This meant:

- **NVIDIA/CUDA**: computed only the base hash → fast
- **AMD/OpenCL**: computed base hash + 807 extra keccak + 792 extra AES → slow

Two GPUs with identical raw compute capability would show very different hashrates purely because of this software asymmetry. This was not a hardware limitation — it was a kernel implementation difference.

### Why The Byproduct Work Existed

The code comments suggest it was intended for a "stream profit" system — the idea was to compute byproduct hashes alongside mining for some secondary revenue stream. However:

1. The byproduct results were written to `pad[0..16]` (the scratchpad), which was **already consumed** by `random_read_mix` in Step 2C.
2. The results were **never read back** by the host or used in any way.
3. On the next hash iteration, the scratchpad was overwritten by `fill_scratchpad`.
4. The comment explicitly stated "does not affect PoW hash" — confirming the work was purely overhead.

In practice, the byproduct work was **dead computation** that the compiler could not eliminate (because it wrote to global memory), but that served no purpose.

### Existing Workaround

An environment variable `ZION_GPU_NO_STREAM_BYPRODUCT=1` already existed to disable the byproduct work by zeroing the stream weights. The code comment stated:

> "This can improve hashrate by 20-30% on GPUs where the byproduct work is a significant overhead relative to the base hash."

However, it was **not enabled by default**, so most users were affected without knowing.

---

## The Fix

Removed the stream byproduct work entirely from both OpenCL kernels:

- `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl`
- `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite_fire.cl`

The `stream_weights` buffer is still passed to the kernel to maintain signature compatibility, but is now ignored (`(void)stream_weights;`).

### Files Changed

| File | Change |
|------|--------|
| `deeksha_lite.cl` | Removed 15 lines of byproduct calls, replaced with `(void)stream_weights;` |
| `deeksha_lite_fire.cl` | Same removal |

### Expected Impact

- **20-30% hashrate improvement** on AMD/OpenCL GPUs (matching the existing `ZION_GPU_NO_STREAM_BYPRODUCT` estimate)
- Fair hashrate comparison between CUDA and OpenCL backends
- No change to PoW hash output — the byproduct work never affected the hash
- No change to CUDA kernel — it already had no byproduct work

---

## Other Differences (Legitimate, Not Bugs)

The CUDA and OpenCL kernels have some structural differences that are **legitimate optimizations** and do not affect fairness:

### 1. Scratchpad Memory Layout

- **CUDA**: INTERLEAVED layout — block `blk` of thread `tid` is at `pad[(blk * total_threads + tid) * 4]`. This gives coalesced 128-byte memory transactions across warps.
- **OpenCL**: CONTIGUOUS layout — each thread gets a 256 KiB block at `pad[tid * SCRATCHPAD_SIZE]`. Simpler but less coalesced.

This is a hardware-specific optimization. NVIDIA GPUs benefit more from coalesced access due to warp-based memory transactions, while AMD GCN/RDNA has wider memory paths. Both layouts produce identical hashes.

### 2. AES S-box Storage

- **CUDA**: `__shared__` memory (loaded cooperatively at kernel start)
- **OpenCL**: `__constant` memory (compiled into the binary)

Both are fast lookups. `__constant` is cached in hardware on AMD, `__shared__` is explicitly managed on NVIDIA.

### 3. Work Size and Thread Count

- **CUDA**: default `threads_per_block = 64`, `work_size` up to 65,536
- **OpenCL**: auto-tuned `local_work_size` (64-256 depending on GPU family), `work_size` VRAM-aware

These are tuned per-platform for optimal occupancy. The total nonces tested per batch is what matters, not the thread configuration.

---

## Commit

| Commit | Description |
|--------|-------------|
| `6b3561c23` | Remove stream byproduct work from OpenCL kernels for hashrate parity with CUDA |
