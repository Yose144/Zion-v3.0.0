# ERG Autolykos v2 — Live Pool Test Report

**Date:** 2026-08-01 (updated 2026-08-01 with R table kernel)
**Pool:** 2Miners ERG (`erg.2miners.com:8888`) — 1% fee, PPLNS
**Wallet:** `9ftkEYmvkUBFikW1z2bijnsYGFjsV3Sy2CmHSn9D2i7CiXYELUe`
**Hardware:** NVIDIA GeForce GTX 1070 Ti (8 GB VRAM), AMD Ryzen 5 3600

---

## Summary

The Autolykos v2 CUDA kernel was tested against a live 2Miners ERG pool
through the ZION debug pool (`zion-edge-debug-pool@ERG` on Edge server
`62.171.141.136:8461`). The full stratum round-trip works:

```
zion-miner (CUDA) → ZION debug pool → 2miners ERG (stratum+tcp://erg.2miners.com:8888)
```

**No 2miners-accepted ERG shares were achieved** in the test window. The ERG
network target (~2^226) requires ~71 minutes at the observed hashrate (~250K
H/s with GPU shared with deeksha stream). All ERG shares submitted by the miner
were correctly filtered by the pool as `BelowTarget` — no invalid shares were
forwarded to 2miners.

## Kernel Evolution

| Version | Approach | Hashrate | Commit |
|---------|----------|----------|--------|
| v1 (tableless) | On-the-fly blake2b for all 33 index computations per nonce | 14.37 MH/s | `26d98de4f` |
| v2 (R table / DAG) | Precomputed R table (N×32B) + uint4 table lookups | 21 MH/s | `b7fc2a180` |
| v3 (R table optimized) | __ldg() + shared mem header + 4 nonces/thread + (64,4) launch bounds | **25.35 MH/s** | (this commit) |

The v2 kernel uses a two-kernel approach:
- `autolykos_precompute` — builds the R table: N elements × 32 bytes
  (`takeRight(31, H(j || height || M))` stored as 8 big-endian uint32_t)
- `autolykos_mine` — uses `uint4` 128-bit table lookups instead of on-the-fly
  blake2b for each of the 33 index computations per nonce

**Correctness verified:** GPU hash matches CPU reference exactly at height=0
(N=67M, 2.15 GB table). **Performance:** 21 MH/s on GTX 1070 Ti — a 1.5x
improvement over the tableless kernel. Further optimization toward 50+ MH/s
would require rewriting the mining kernel to use shared memory for cooperative
genIndexes computation (luminousmining reference approach).

---

## Bugs Found and Fixed

### Bug: ERG share target not filtered (commit `efe7ae980`)

**Root cause:** `AuXpow/src/multiplexer.rs` function `effective_share_target()`
did not include `autolykos` in the `uses_notify_target` match list. The pool
therefore used `client.share_target()` (default `[0xFF; 32]` = max target)
instead of the real ERG target from the 2miners `mining.notify` params.

**Symptom:** The miner submitted every nonce as a share. 2miners rejected all
with `[23, "Low difficulty share", null]`.

**Fix:** Added `"autolykos"` to the `uses_notify_target` match arm. The pool
now uses `job.target_bytes` (parsed from the decimal target string in `arr[6]`
of the ERG notify) for local share filtering before forwarding to 2miners.

**File:** `AuXpow/src/multiplexer.rs:200-204`

```rust
// Before:
"randomx" | "ghostrider" | "ethash" | "etchash" | "kawpow"
    | "evrprogpow" | "meowpow" | "progpow"

// After:
"randomx" | "ghostrider" | "ethash" | "etchash" | "kawpow"
    | "evrprogpow" | "meowpow" | "progpow" | "autolykos"
```

---

## Verification Results

### 1. CUDA kernel correctness (verified)
- `--test-cuda-kernel autolykos` → `AUTOLYKOS_CPU_GPU_MATCH nonce=2912 hash_prefix=950199631c008eeb`
- `cargo test -p zion-auxpow autolykos_hash_known_vector` → PASS
- `cargo test -p zion-miner --features gpu-cuda test_autolykos_gpu_vs_cpu` → PASS (R table kernel, height=0)
- Benchmark: ~21 MH/s (R table, dedicated, no deeksha sharing)

### 2. Stratum connectivity
- ZION debug pool connected to `erg.2miners.com:8888` ✓
- `mining.subscribe` → subscribed with extranonce1 ✓
- `mining.authorize` → authorized as `9ftkEY...ELUe.zion-erg-gpu-erg` ✓
- `mining.notify` received with real ERG jobs (height ~1842007, target `00000002`) ✓

### 3. ERG notify parsing
2miners ERG stratum format:
```
params: [job_id, height, msg_blob, "", "", version_hex, target_decimal, "", clean_jobs]
```
- `arr[0]` = job_id (e.g. `"13a4"`)
- `arr[1]` = block height (e.g. `1842007`)
- `arr[2]` = 32-byte header blob (hex)
- `arr[5]` = version compact hex (e.g. `"00000002"`) — NOT the target
- `arr[6]` = target as decimal string (e.g. `"66346743..."`) — the real target

The pool correctly parses `arr[6]` as a big-endian 256-bit target via
`BigUint::parse_bytes` and pads to 32 bytes.

### 4. Share target filtering (after fix)
- Pool receives ERG shares from miner ✓
- Pool verifies hash against real ERG target (~2^226) ✓
- Shares below target → `BelowTarget` (not forwarded to 2miners) ✓
- No "Low difficulty share" rejections from 2miners after fix ✓

### 5. Nonce format
- 2miners ERG: `en1` = 2 bytes, `nonce2` = 6 bytes (big-endian)
- Submit format: `[worker, job_id, nonce2_hex]` ✓
- Full 8-byte nonce = `en1 || nonce2` (big-endian) ✓

### 6. Accepted shares
- **0 accepted** ERG shares from 2miners
- Reason: ERG target ~2^226 requires ~71 min at 250K H/s; test ran 3 min
- ZION (deeksha) shares: 24 accepted / 1 rejected (96% accept rate)

---

## Performance

| Mode | Hashrate | Notes |
|------|----------|-------|
| Dedicated, tableless kernel (v1) | ~14.37 MH/s | `--test-cuda-kernel autolykos` benchmark |
| Dedicated, R table kernel (v2) | ~21 MH/s | R table lookups, height=0 (N=67M, 2.15 GB table) |
| Dedicated, R table optimized (v3) | **~25.35 MH/s** | __ldg + shared mem + 4 nonces/thread + (64,4) bounds |
| Shared with deeksha | ~250K H/s | Live pool test, GPU split between ERG + ZION |

The shared mode hashrate is ~57x lower than dedicated because the GPU
alternates between autolykos and deeksha_lite_v1 kernels. For production ERG
mining, consider disabling the ZION stream or dedicating a separate GPU.

### VRAM Constraint

The R table at production ERG height (~1842000) requires N≈216M × 32B = ~6.93 GB.
On a GTX 1070 Ti with 8 GB total VRAM (~6.1 GB free with GUI processes), the
production-height table does NOT fit. Options:
1. Kill GUI processes (free ~1.8 GB) → headless mode
2. Use a GPU with ≥12 GB VRAM
3. Mine at reduced height (test only — not valid for pool shares)

The host code (`cuda_external.rs`) includes a pre-allocation VRAM check via
`cuMemGetInfo_v2` that bails with a clear error if the table + 512 MB headroom
exceeds free VRAM.

---

## ERG Target Analysis

```
Target (decimal): 6634674375215649981044791689095340972727658017446627184440307089471
Target (hex):      000000003f00000003f00000003f00000003f00000003f00000003f00000003f
Target (bits):     ~226 bits
Expected time:     2^226 / 14.37e6 ≈ 4.96e61 seconds (dedicated, per nonce)
                   At pool difficulty (vardiff), shares come faster
```

The 2miners pool uses variable difficulty (`mining.set_difficulty`). At the
default pool difficulty, a share is expected every ~15-30 seconds for a
~300 MH/s rig. At our 250K H/s (shared), expected time is much longer.

---

## Commits

| Commit | Description |
|--------|-------------|
| `26d98de4f` | Integrate tableless real Autolykos v2 CUDA kernel + fix CPU/GPU mismatch |
| `efe7ae980` | Fix ERG share target: use notify target for autolykos in effective_share_target |
| `b7fc2a180` | Rewrite CUDA kernel to use precomputed R table (DAG) — 21 MH/s, 1.5x improvement |

---

## Remaining Work

1. **Long-duration ERG test** — run miner for 30+ minutes with dedicated GPU
   (no deeksha, headless mode for VRAM) to get a 2miners-accepted share
2. **VRAM for production height** — kill GUI processes or use headless mode to
   free ~1.8 GB VRAM for the production-height R table (~6.93 GB at height ~1842000)
3. **public/ subtree sync** — `cuda_external.rs` + kernel (blocked by missing
   `AuXpow` dependency in public `zion-miner`)
4. **Shared-memory optimization** — rewrite mining kernel to use shared memory
   for cooperative genIndexes computation (luminousmining approach) for 50+ MH/s
5. **OpenCL kernel** — update from old table-based approach to R table
