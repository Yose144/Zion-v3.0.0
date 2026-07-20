# RTM (Raptoreum) GhostRider Share Debugging Report

**Date:** 2026-07-20
**Status:** All identified bugs fixed. Binary rebuilt. Pending Edge deployment + live verification.
**Pool:** zpool.ca (ghostrider.eu.mine.zpool.ca:5354)
**Algo:** GhostRider (gr) — 15 core hashes + 6 CryptoNight variants, dynamically selected from prevblock hash

---

## Executive Summary

RTM (Raptoreum) shares submitted to zpool were being rejected with **error 25 ("Invalid share")**. Through systematic debugging comparing our GhostRider hash implementation against three independent reference sources — **yiimp-ghostrider** (the pool validator), **cpuminer-gr-avx2** (the official miner), and the **Raptoreum daemon** itself — we identified and fixed **7 distinct bugs** in the hashing and share validation pipeline.

The most critical lesson: **the validator (yiimp) is the source of truth, not the miner (cpuminer-gr-avx2)**. yiimp has subtle bugs (reversed byte order, missing last algo in output string) that we must replicate exactly. Matching the "cleaner" miner implementation produces different hashes that yiimp rejects.

---

## Reference Implementations Analyzed

| Source | Repo | Role | Byte Order | CN Count |
|--------|------|------|------------|----------|
| **yiimp-ghostrider** | `Raptor3um/yiimp-ghostrider` | **Pool validator** (zpool runs this) | **Reversed** (`b = (63-j)>>1`) | 6 |
| cpuminer-gr-avx2 | `WyvernTKC/cpuminer-gr-avx2` | Official miner | Forward (`selectAlgo`) | 6 (3 from rotation table) |
| npq7721/gr_hash | `npq7721/gr_hash` | Python reference | Forward (`selectAlgo`) | 14 |
| Raptoreum daemon | `Raptor3um/raptoreum` | Chain consensus | **Reversed** (`GetNibble: index = 63 - index`) | 6 |

**Key insight:** yiimp and the Raptoreum daemon both use **reversed** byte order. cpuminer-gr-avx2 and npq7721 use **forward** byte order. Since zpool validates with yiimp, we MUST match yiimp's reversed byte order — even though it differs from the official miner.

---

## Bugs Found and Fixed

### Bug 1: `getAlgoString` Byte Order — REVERTED to yiimp's reversed order

**File:** `V3/L1/native-ffi/csrc/ghostrider/real/gr.c`

**History:** The original code used yiimp's reversed byte order (`b = (63 - j) >> 1`, high nibble first). This was CORRECT. During debugging, it was incorrectly changed to forward byte order (matching cpuminer-gr-avx2/npq7721) under the assumption that the miner was the reference. This caused error 25 to persist. It has now been **reverted back to yiimp's exact implementation**, including yiimp's subtle bug.

**yiimp's `getAlgoString` (the validator's code):**
```c
for (j = 0; j < 64; j++) {
    char b = (63 - j) >> 1;  // REVERSED byte index
    uint8_t algoDigit = ((j & 1) ? prevblock[b] & 0xF : prevblock[b] >> 4) % algoCount;
    // j even → HIGH nibble (>> 4), j odd → LOW nibble (& 0xF)
    if(!selectedAlgo[algoDigit]) {
        selectedAlgo[algoDigit] = true;
        selectedCount++;
    } else {
        continue;
    }
    if(selectedCount == algoCount) {
        break;  // BUG: breaks BEFORE writing last algo to output
    }
    // write algo to output string...
}
```

**yiimp's bug (replicated):** When `selectedCount == algoCount`, the loop breaks **before** `sprintf` writes the last-selected algo to the output string. The fill-remaining loop only adds *unselected* algos, so the last selected algo is **lost**. Accessing `output[algoCount-1]` reads `'\0'` which equals `0` (BLAKE). We replicate this bug exactly.

**Raptoreum daemon confirmation** (`uint256.h`):
```cpp
int GetNibble(int index) const {
    index = 63 - index;           // REVERSED — matches yiimp
    if (index % 2 == 1)
        return (m_data[index / 2] >> 4);  // HIGH nibble — matches yiimp j even
    return (m_data[index / 2] & 0x0F);    // LOW nibble — matches yiimp j odd
}
```

### Bug 2: `ghostrider_wrapper.c` — Hash output byte reversal removed

**File:** `V3/L1/native-ffi/csrc/ghostrider/ghostrider_wrapper.c` (line ~82)

The wrapper was reversing the hash output bytes (`output[i] = hash_be[31 - i]`). yiimp's `gr_hash` does `memcpy(output, hash, 32)` — no reversal. Removed the reversal.

### Bug 3: `meets_target_little_endian` — Wrong comparison logic

**File:** `AuXpow/src/external_hashers.rs` (line ~755)

**Was:** `hash.iter().rev().cmp(target.iter().rev()).is_le()` — reverses BOTH hash and target, which compares LE hash against LE target (wrong, since target is BE).

**Fixed:** `hash.iter().rev().cmp(target.iter()).is_le()` — reverses ONLY hash (LE→BE), compares against BE target.

Also added yiimp error 25 sanity check (`hash[30] | hash[31] == 0`) in:
- `share_forwarder.rs` (line ~146, RTM path)
- `miner_harness.rs` (line ~658, `scan_ghostrider_single`)
- `auxpow_scheduler.rs` (line ~461, RTM path)
- `auxpow_client.rs` (line ~6696, e2e test)

### Bug 4: Missing `native-ghostrider` feature in pool build

**File:** `V3/L1/pool/Cargo.toml` (line ~35)

**Was:** `default = ["native-verushash"]`
**Fixed:** `default = ["native-verushash", "native-ghostrider"]`

Without this, the pool used blake3 fallback for RTM hashing instead of the native GhostRider implementation — producing completely wrong hashes.

### Bug 5: Per-coin target overwrite in `server.rs`

**File:** `V3/L1/pool/src/bin/server.rs` (lines ~2812-2852)

`external_stream_cpu_job` was a single variable that got overwritten when the scheduler switched between RTM/XMR/VRSC. RTM shares were being validated against XMR's target (`cb10c7ba...` instead of `00031fff...`).

**Fix:** Added `latest_job_for_coin()` method to `MultiAuxPowBridge` (line ~4250) that looks up the correct per-coin target from the bridge queue. Share processing now uses per-coin lookup instead of the single overwritten variable.

### Bug 6: Wrong merkle_root per-word reversal (reverted)

A previous attempt to fix merkle_root by reversing bytes within each 4-byte word was incorrect. yiimp's `ser_string_be` does per-word reversal on the **whole 80-byte header**, not just merkle_root. This was reverted — the header is passed through `ser_string_be` as a unit.

### Bug 7: `rtm_live_test.rs` — batch size + nonce_base preservation

**File:** `AuXpow/src/bin/rtm_live_test.rs`

- Reduced `batch_per_round` from 50,000 to 500 to allow faster job switching
- Nonce_base is preserved when only ntime changes (same prevhash), reset on new prevhash
- Added pfx=0x00 sanity check before submission

---

## yiimp Share Validation Flow (for reference)

yiimp validates shares as follows (`client_submit.cpp`):

1. **`build_submit_values`**: Constructs the 80-byte header from job template + nonce
   - `ser_string_be(merkleroot, ..., 8)` — per-word reversal on merkleroot
   - `ser_string_be(header, ..., 20)` — per-word reversal on whole 80-byte header (80+64 / sizeof(u32) = 36, but for gr it's 20 = 80/4)
   - `binlify(header_bin, header_be)` — hex to binary
   - `g_current_algo->hash_function(header_bin, hash_bin, header_len)` — calls `gr_hash`

2. **`get_hash_difficulty`**: Reads `hash_bin[22..30]` as LE uint64 (bits 192-255 of the hash)

3. **Error 25 check**: `hash_bin[30] | hash_bin[31] != 0` → "Invalid share"
   - This means the hash must have `hash[30] == 0` AND `hash[31] == 0` (top 2 bytes zero)
   - This is equivalent to `pfx == 0x00` (our sanity check)

4. **Target check**: `hash_int <= coin_target` (decoded from nbits)

---

## Files Modified

| # | File | Change |
|---|------|--------|
| 1 | `V3/L1/native-ffi/csrc/ghostrider/real/gr.c` | getAlgoString reverted to yiimp reversed byte order + bug replication |
| 2 | `V3/L1/native-ffi/csrc/ghostrider/ghostrider_wrapper.c` | Removed hash output byte reversal |
| 3 | `AuXpow/src/external_hashers.rs` | Fixed meets_target_little_endian comparison |
| 4 | `AuXpow/src/share_forwarder.rs` | Added pfx check for RTM |
| 5 | `AuXpow/src/miner_harness.rs` | Added pfx check for ghostrider scan |
| 6 | `AuXpow/src/auxpow_scheduler.rs` | Added pfx check for RTM |
| 7 | `AuXpow/src/auxpow_client.rs` | Added pfx check in e2e test |
| 8 | `AuXpow/src/bin/rtm_live_test.rs` | pfx check + batch size + nonce_base preservation |
| 9 | `V3/L1/pool/Cargo.toml` | Added native-ghostrider to default features |
| 10 | `V3/L1/pool/src/bin/server.rs` | Per-coin target lookup via latest_job_for_coin() |
| 11 | `V3/L1/native-ffi/csrc/ghostrider/real/gr.h` | Header updates |
| 12 | `V3/L1/native-ffi/src/lib.rs` | FFI binding updates |

---

## Live Test Results

### Test 1 (original code, before fixes)
- **Result:** Error 25 (Invalid share)
- **Cause:** Multiple bugs (wrong target, missing native-ghostrider, hash reversal, etc.)

### Test 2 (after fixes 2-5, before getAlgoString revert)
- **Hash:** `f4a1bd...0000` (pfx=0x00 ✓)
- **Result:** Error 21 (Stale job) — NOT error 25
- **Time to find share:** ~739s at ~85 H/s
- **Note:** Error 25 was eliminated; only stale job due to slow mining

### Test 3 (after getAlgoString "fix" to forward byte order — WRONG)
- **Hash:** `e12e3a...0000` (pfx=0x00 ✓ — but wrong algo sequence)
- **Result:** Error 25 (Invalid share) — RETURNED
- **Time to find share:** ~475s
- **Root cause:** Forward byte order produced different algo sequence than yiimp's reversed order

### Test 4 (after reverting getAlgoString back to yiimp reversed order)
- **Status:** Pending — binary rebuilt, needs live test
- **Expected:** Error 25 eliminated, possibly error 21 (stale) due to slow hashrate

---

## Key Lessons

1. **Match the validator, not the miner.** yiimp (pool) is the validator. cpuminer-gr-avx2 (miner) can have different implementations and still work because it only needs to find shares that yiimp accepts. But if you're implementing the hash yourself, you must match yiimp exactly.

2. **Replicate bugs, don't fix them.** yiimp's `getAlgoString` has a bug where the last-selected algo is not written to the output string. If we "fix" this, our hashes differ from yiimp's and shares get rejected.

3. **Byte order matters.** The Raptoreum daemon uses reversed nibble iteration (`GetNibble: index = 63 - index`). yiimp matches this. cpuminer-gr-avx2 uses forward iteration. They produce different algorithm sequences.

4. **Test with real shares, not just hash correctness.** A hash ending in `0000` (pfx=0x00) is necessary but not sufficient — the full 32-byte hash must match what yiimp computes.

5. **Per-coin state isolation is critical.** When running multiple merge-mined coins (RTM/XMR/VRSC), each coin's job/target must be tracked independently. A single shared variable gets overwritten on scheduler switches.

---

## Pending Actions

1. **Deploy fixed binary to Edge server** — SSH `zion-new`, rebuild pool, restart `zion-edge-pool` service
2. **Verify RTM shares accepted by zpool** — run `rtm_live_test` or wait for scheduler to submit
3. **ZION-edge-agent inactive** — redeploy per `agentdeskupdate.md`
4. **VRSC scheduler** — wait for first accepted share
5. **XMR RandomX** — datacenter IP blocking workaround

---

## Architecture: How RTM Merge Mining Works in ZION

```
zpool.ca (yiimp)  ←──stratum──→  ZION Edge Pool (server.rs)
                                      │
                                      ├── AuxPow Scheduler (auxpow_scheduler.rs)
                                      │       │
                                      │       ├── RTM: GhostRider hash (gr.c via native-ffi)
                                      │       ├── XMR: RandomX hash
                                      │       └── VRSC: VerusHash
                                      │
                                      ├── Share Forwarder (share_forwarder.rs)
                                      │       └── validates pfx, target, submits to zpool
                                      │
                                      └── MultiAuxPow Bridge
                                              └── per-coin job/target tracking
```

The miner (AuXpow) connects to zpool's stratum, receives RTM jobs, hashes with the native GhostRider implementation (C FFI), and submits shares back. The pool server (`server.rs`) coordinates multiple merge-mined coins and forwards shares to the upstream pool.
