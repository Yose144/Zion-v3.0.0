# VRSC Share Rejection Debug Report — 2026-07-16

## Summary

VRSC (VerusCoin) shares submitted to LuckPool are consistently rejected with
`[23,"low difficulty share"]` (hash mismatch) or `[21,"job not found"]` (stale
shares).  This report documents the root-cause analysis, fixes attempted, and
current state.

## Environment

- **Edge Server:** `62.171.141.136` (Ubuntu 24.04.4 LTS, x86_64)
- **Pool Service:** `zion-edge-pool.service` → `/opt/zion/V3/target/release/server`
- **Build Target:** `/opt/zion/target/release/server` (cargo workspace root = `/opt/zion`)
- **Rust:** 1.97.0
- **Upstream Pool:** LuckPool VRSC (`luckpool.com:3350`)
- **Local Miners:** 5070Ti (GPU), vega-smos (GPU), local-miner (CPU)

## Issues Identified

### 1. RandomX (XMR) Single-Threaded Mining — FIXED

**Problem:** `scan_randomx` in `miner_harness.rs` was single-threaded on the
miner_harness side, limiting XMR hashrate to 1 core.

**Fix:** Enabled multi-threaded scanning for RandomX (same pattern as
VerusHash).  Each thread uses its own `work_blob` and thread-local VM, making
it thread-safe.

**Commit:** `1bee1e6c7` — pushed to origin.

**Result:** 4x more shares expected.  Live testing blocked by missing
`ZION_POOL_AUXPOW_WALLET_XMR` env var on Edge server.

### 2. VRSC Share Rejection — "low difficulty share" — ONGOING

**Symptom:** All VRSC shares forwarded to LuckPool are rejected with:
```
[23,"low difficulty share"]
```

This means the hash we compute differs from the hash LuckPool computes.

## Root Cause Analysis

### LuckPool's Share Validation Flow (from verushash-node source code)

LuckPool uses `verushash-node` (Node.js binding to C++ VerusHash v2.2).  The
`verusHashV2b2()` function does **conditional clearing** of non-canonical
PBaaS v7+ header data:

1. **Check solution version** — if `sol_ver > 6` (PBaaS v7+):
2. **Read `numPBaaSHeaders`** from solution byte 5
3. **If `numPBaaSHeaders > 0`:**
   - Build `preHeader` from header's non-canonical fields:
     - `hashPrevBlock` (header bytes 4..36)
     - `hashMerkleRoot` (header bytes 36..68)
     - `hashFinalSaplingRoot` (header bytes 68..100)
     - `nNonce` (header bytes 108..140)
     - `nBits` (header bytes 104..108)
     - `hashPrevMMRRoot` + `hashBlockMMRRoot` (solution bytes 8..72)
   - Compute `preHeaderHash = blake2b(preHeader)` (with personalization
     `"VerusDefaultHash"`)
   - Compare `preHeaderHash` with solution bytes at offset 92 (after
     descriptor + chainID)
   - **If match → clear non-canonical data → hash normally**
   - **If no match → return 0xFF (invalid) → "low difficulty share"**

4. **Hash with `CVerusHashV2(SOLUTION_VERUSHHASH_V2_2=4).Finalize2b()`**

### node-stratum-pool-verus Share Validation (from jobManager.js)

For PBaaS v7+ (`solution_ver > 6`):
```javascript
nonce = undefined;  // Pool ignores miner's nonce2!
let solExtraData = soln.substr(-30);  // Last 30 hex chars of solution
if (solExtraData.indexOf(extraNonce1) < 0) {
    return shareError([20, 'invalid solution, pool nonce missing']);
}
```

The pool:
- Sets `nonce = undefined` → `serializeHeader` uses `this.rpcData.nonce`
  (daemon's block header nonce, NOT the miner's nonce2)
- Checks that `extraNonce1` appears in the last 30 hex chars of the solution
- Concatenates `headerBuffer(140 bytes) + soln(submitted solution)` and
  hashes with `vh.hash2b2()`

### Key Insight: preHeaderHash Check

The `preHeaderHash` stored in the solution was computed by the VerusCoin
daemon using the **daemon's nonce** (not en1+zeros).  The pool reconstructs
the header with the daemon nonce, so the preHeaderHash matches → clearing
proceeds → hash is computed correctly.

Our miner hashes a header with `en1+zeros` in the nonce field (because the
daemon nonce is NOT sent in `mining.notify` params — it's commented out in
`blockTemplate.js:getJobParams()`).  After `clear_verushash_pbaas()`, the
nonce field is zeroed, so our hash should match the pool's hash (which also
zeros the nonce field after the preHeaderHash check succeeds).

## Fixes Attempted

### Fix 1: Disable `clear_verushash_pbaas` — FAILED

**Hypothesis:** Pool hashes header as-is (no clearing).
**Result:** Still `[23,"low difficulty share"]`.
**Conclusion:** Pool DOES clear non-canonical data (confirmed by verushash-node
source).

### Fix 2: Re-enable `clear_verushash_pbaas` + nonce2=zeros — FAILED

**Hypothesis:** Pool's preHeaderHash check fails because nonce2 changes the
nonce field.  Sending nonce2=zeros keeps the nonce field = en1+zeros (same as
original job).
**Result:** Still `[23,"low difficulty share"]`.
**Conclusion:** preHeaderHash check might not be the issue, OR the header
construction is wrong in another way.

### Fix 3: Write miner_nonce into BOTH nonce field and nonceSpace — FAILED

**Hypothesis:** Pool reconstructs nonce field as `en1 + nonce2` (standard
Zcash Stratum).  We need to hash with the same nonce field.
**Result:** Still `[23,"low difficulty share"]`.
**Conclusion:** Pool sets `nonce = undefined` for PBaaS v7+ and uses daemon
nonce, not en1+nonce2.

## Current State

### Deployed Code (Edge Server)

- `miner_harness.rs`: `clear_verushash_pbaas` **ENABLED**, miner_nonce written
  only to solution nonceSpace (not nonce field), debug logging added
- `auxpow_client.rs`: nonce2 = all zeros (to preserve preHeaderHash match)
- Binary: `/opt/zion/V3/target/release/server` (MD5: `3896a5bf...`)
- Pool service: running (PID 1161766)

### Live Test Results

- VRSC shares: ALL rejected with `[23,"low difficulty share"]` or
  `[21,"job not found"]` (stale)
- XMR shares: Not testable (missing `ZION_POOL_AUXPOW_WALLET_XMR`)
- ZION internal shares: Accepted (job=7606, share_diff=10000)
- EPIC shares: Active in parallel stream

### Debug Logging

Added `VRSC_DEBUG` println output to `scan_verushash` to dump:
- header_len, version, ntime, nbits, nonce_field, varint
- sol_ver, sol_numPBAAS, mmr_first8, ns_full (nonceSpace)
- target, hash_le_reversed

**Note:** Debug output not yet captured because shares are found by GPU
miners (5070Ti, vega-smos), not the CPU harness.  The GPU backend may use a
different code path that doesn't call `scan_verushash`.

## Remaining Hypotheses

### H1: GPU backend doesn't do `clear_verushash_pbaas`

The GPU miners (5070Ti, vega-smos) are finding shares that pass our local
target check but fail LuckPool's validation.  If the GPU backend hashes
without clearing non-canonical data, the hash will differ from the pool's.

**Action:** Check `gpu_backend.rs` and `gpu_miner.rs` for VerusHash hashing
path.  Ensure `clear_verushash_pbaas` is called before hashing.

### H2: Header construction mismatch

Our header has `en1+zeros` in the nonce field.  The pool's `serializeHeader`
uses `this.rpcData.nonce` (daemon nonce).  After clearing, both are zeroed,
but if the clearing is not applied correctly in the GPU path, the hashes
differ.

**Action:** Add debug logging to the share forwarding path to dump the exact
header bytes being hashed vs submitted.

### H3: Solution varint inclusion

Our submit code prepends `fd4005` (varint for 1344 bytes) to the solution.
The pool concatenates `header(140) + soln` and hashes.  If soln includes the
varint, the hash input is 1487 bytes (correct).  If not, it's 1484 bytes
(wrong).  Need to verify what the pool actually expects.

**Action:** Check if LuckPool expects solution with or without varint prefix.

### H4: MMR roots restoration in submit path

Our submit code restores MMR roots from the original job solution
(bytes 8..72 = hex 16..144).  This is correct — the submitted solution
should have the original MMR roots for the preHeaderHash check to pass.

**Action:** Verify MMR roots in submitted solution match the original job.

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `AuXpow/src/miner_harness.rs` | Multi-thread RandomX, clear_verushash_pbaas toggle, debug logging | Local (uncommitted) |
| `AuXpow/src/auxpow_client.rs` | nonce2=zeros for PBaaS v7+ | Committed (`ae0a745d4`) |
| `V3/L1/miner/src/main.rs` | Multi-thread RandomX dispatch | Committed (`1bee1e6c7`) |

## Next Steps

1. **Check GPU VerusHash path** — verify `clear_verushash_pbaas` is called
   in GPU backend before hashing
2. **Add debug logging to share forwarding** — dump exact header bytes
   being hashed vs submitted to compare with pool's expected values
3. **Test with CPU-only mining** — disable GPU miners and use only
   `scan_verushash` to get `VRSC_DEBUG` output
4. **Verify preHeaderHash** — compute blake2b of header's non-canonical
   fields and compare with solution's preHeaderHash at offset 92
5. **Configure XMR wallet** — set `ZION_POOL_AUXPOW_WALLET_XMR` to enable
   XMR live testing
6. **Compare with ccminer/nheqminer** — capture a valid share submission
   from a working miner and compare byte-by-byte with ours
