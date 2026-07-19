# GhostRider CN Hash Debug Report — M1 OpenCL Private Memory Clobber Fix

**Date:** 2026-07-21
**Status:** FIXED — GPU and CPU CNDarklite hashes match exactly
**Files changed:** 5

---

## Summary

The GhostRider OpenCL kernel on Apple M1 produced incorrect CryptoNight DarkLite hashes due to an OpenCL compiler optimization that reorders reads from private arrays, causing `input[35..42]` (needed for `tweak1_2` in VARIANT1_INIT) to be read **after** other private arrays clobbered the same memory region.

The fix saves `input[35..42]` to **global memory** (scratchpad) before calling `cn_hash_full`, bypassing the private memory reuse issue entirely.

---

## Verification

```
GPU cn_hash_full(CNDarklite): 34ef29701dffa8d743432c5abf6088d2c6926d4b76aa27c799fd617fe5008511
CPU cn_darklite:              34ef29701dffa8d743432c5abf6088d2c6926d4b76aa27c799fd617fe5008511

PASS: GPU and CPU CNDarklite hashes match!
```

The Groestl extra-hash also matches:
```
GPU groestl(CPU_state): 34ef29701dffa8d743432c5abf6088d2c6926d4b76aa27c799fd617fe5008511
CPU expected:           34ef29701dffa8d743432c5abf6088d2c6926d4b76aa27c799fd617fe5008511
```

---

## Root Cause

### The Bug

CryptoNight variant 1 algorithms (CNDark, CNDarklite, CNLite, CNTurtle, CNTurtlelite) compute `tweak1_2` during initialization:

```c
// VARIANT1_INIT
tweak1_2 = *(uint64_t*)(input + 35) ^ state.hs.w[24];
```

In the OpenCL kernel (`cn_hash_full`), `input` is passed as a `__private const uchar*` pointer. The function then declares several large private arrays:

| Array            | Size (bytes) | Purpose                     |
|------------------|-------------|-----------------------------|
| `state[200]`     | 200         | Keccak-1600 output state    |
| `text[128]`      | 128         | CN_INIT_SIZE_BYTE scratch   |
| `aes_key[32]`    | 32          | AES-256 key                 |
| `expanded_key[40]` | 160       | Expanded AES key (40 × u32) |

**The Apple M1 OpenCL compiler reorders the read of `input[35..42]` to after these arrays are declared and initialized**, at which point the private memory previously holding `input[35..42]` has been overwritten.

### Evidence

Debug output showed that reading `input[35]` at the **very beginning** of `cn_hash_full` (before any private arrays) returned the correct value (`0x42`), but reading it **after** declaring `state[200]` returned a wrong value (`0xfa`):

```
GPU dbg[0..47]:  ca7a536a9e1ef913108ce12efbc9714077562e8877dfa90d0391cab10751fcf4  ← input saved to debug_state at function entry (correct)
GPU inp35 priv:  8152a958fc0ef6b3 (expected 422c85e3d2a313d7)                     ← read after state[] declared (clobbered)
```

Attempts to fix this with `volatile ulong` scalars and private byte arrays **also failed** — the compiler clobbered those too.

### Impact

The incorrect `tweak1_2` value caused the `VARIANT1_2` operation (which XORs `tweak1_2` into `scratchpad[j][1]` each iteration) to corrupt the scratchpad. The first visible divergence appeared at **iteration 164** (0-indexed: 163) of the main loop, where the scratchpad at index `j=13106` had mismatched bytes 8–15.

---

## The Fix

### Strategy

Save `input[35..42]` to **global memory** (the scratchpad buffer, beyond the used region) **before** calling `cn_hash_full`. Global memory is not subject to private memory reuse.

### Implementation

#### 1. `cn_full_test` kernel (`ghostrider_kernel.cl`)

Before calling `cn_hash_full`, copy `input[35..42]` to `scratchpad[memory..memory+7]`:

```c
__global uchar *tweak_src = scratchpad + memory;
for (int i = 0; i < 8; i++) tweak_src[i] = input[35 + i];

cn_hash_full(in_buf, input_len, out_buf, scratchpad, memory, iter_div, cn_aes_init,
             AES0, AES1, AES2, AES3, debug_state, input);
```

#### 2. `cn_dispatch` (`ghostrider_cn.cl`)

For all variant-1 algorithms (cases 0, 2, 7, 10, 12), save `input[35..42]` to the scratchpad before calling `cn_hash_full`:

```c
case 2:  { __global uchar *t = scratchpad + 524288;
           for (int i = 0; i < 8; i++) t[i] = input[35+i];
           cn_hash_full(input, len, output, scratchpad, 524288, 131072, 16384,
                        AES0, AES1, AES2, AES3, 0, 0); break; } // CNDarklite
```

Variant-2 algorithms (case 4: CNFast) do not use `tweak1_2`, so no save is needed.

#### 3. `cn_hash_full` (`ghostrider_cn.cl`)

Read `input[35..42]` and `state[192..199]` from global memory instead of private:

```c
__global uchar *tweak_tmp = scratchpad + memory;

// After Keccak, save state[192..199] to global memory immediately
// (before text/aes_key/expanded_key clobber the private state array)
for (int i = 0; i < 8; i++) tweak_tmp[8 + i] = state[192 + i];

// ... later, after declaring text/aes_key/expanded_key ...

// Read both parts from global memory (byte-by-byte to avoid alignment issues)
ulong input_part = 0, state_part = 0;
for (int i = 0; i < 8; i++) input_part |= ((ulong)tweak_tmp[i]) << (i * 8);
for (int i = 0; i < 8; i++) state_part |= ((ulong)tweak_tmp[8 + i]) << (i * 8);
ulong tweak1_2 = input_part ^ state_part;
```

### Why Global Memory?

| Approach                  | Result         | Reason                                    |
|---------------------------|----------------|-------------------------------------------|
| Read `input[35]` directly | Clobbered      | Private memory reused by other arrays     |
| `volatile ulong` scalar   | Clobbered      | Compiler still reuses the stack slot      |
| `__private uchar[8]` copy | Clobbered      | Same private memory reuse issue           |
| `__global` memory save    | **Works**      | Global memory is not subject to reuse     |

### Scratchpad Space Safety

The temporary storage uses `scratchpad[memory..memory+15]` (16 bytes beyond the scratchpad's used region). All variant-1 algorithms use less than 2MB scratchpad:

| Algorithm     | Memory (bytes) | Scratchpad buffer size |
|---------------|---------------|----------------------|
| CNDark        | 524,288       | 2,097,152            |
| CNDarklite    | 524,288       | 2,097,152            |
| CNLite        | 1,048,576     | 2,097,152            |
| CNTurtle      | 262,144       | 2,097,152            |
| CNTurtlelite  | 262,144       | 2,097,152            |

The 16-byte temporary area at `scratchpad + memory` is always within the 2MB buffer.

---

## Debugging Process

### Phase 1: Isolating the Divergence

1. Confirmed Keccak-1600 output matches between CPU and GPU
2. Confirmed AES key expansion matches
3. Confirmed scratchpad initialization (first 64 bytes) matches
4. Confirmed `a` and `b` array initialization matches
5. Incrementally increased main loop iterations to find the first divergence
6. **Found:** First divergence at iteration 164 (0-indexed: 163)

### Phase 2: Identifying the Root Cause

At iteration 163:
- `a` array: **match** ✓
- `j1` (scratchpad index): **match** ✓
- `scratchpad[j1]` bytes 0–7: **match** ✓
- `scratchpad[j1]` bytes 8–15: **MISMATCH** ✗

The second 8 bytes of the scratchpad block are modified by `VARIANT1_2`, which XORs `tweak1_2` into `scratchpad[j][1]`. Checking `tweak1_2`:

```
GPU tweak1_2:    55f04e9ecfc496c1  ← WRONG
CPU tweak1_2:    161b0b38f02035e8  ← CORRECT
```

Both components of `tweak1_2` were wrong on the GPU:
```
GPU input_part:  8c87f56b996deb0d  ← WRONG (should be d713a3d2e3852c42)
GPU state_part:  b387d230446faf67  ← WRONG (should be c108a8ea13a519aa)
```

### Phase 3: Confirming Private Memory Clobber

Reading `input[35]` at the very start of `cn_hash_full` (before any private arrays) and saving to `debug_state` (global) showed the **correct** value. Reading it after declaring `state[200]` showed a **wrong** value. This confirmed the OpenCL compiler reorders the read to after private memory is reused.

### Phase 4: Testing Fix Approaches

Tested multiple approaches (see table above). Only saving to global memory worked reliably.

---

## Files Changed

| File | Change |
|------|--------|
| `AuXpow/csrc/opencl/ghostrider_cn.cl` | Read `tweak1_2` components from global memory; save `state[192..199]` to scratchpad after Keccak; removed all debug output; updated `cn_dispatch` to save `input[35..42]` for variant-1 algos |
| `AuXpow/csrc/opencl/ghostrider_kernel.cl` | `cn_full_test` saves `input[35..42]` to scratchpad before calling `cn_hash_full`; removed debug markers |
| `AuXpow/src/bin/simd_cmp.rs` | Simplified to clean GPU vs CPU comparison test |
| `AuXpow/src/gpu_miner.rs` | Removed debug source-check println |
| `V3/L1/native-ffi/csrc/ghostrider/real/cryptonote/cryptonight_dark_lite.c` | Removed all debug printf statements; restored full iteration count |

---

## Test Command

```bash
cd AuXpow && cargo run --bin simd_cmp --features "gpu-opencl native-ghostrider"
```

---

## Platform

- **Device:** Apple M1
- **OpenCL platform:** Apple
- **OpenCL version:** CL 1.2
- **Hash rate:** ~380 H/s (GhostRider full mining kernel)
