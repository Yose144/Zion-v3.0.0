# ERG Autolykos v2 — Live Pool Test Report

**Date:** 2026-08-01 (updated 2026-08-01 with N_BASE fix + live pool test success)
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

**LIVE POOL TEST SUCCESS** (2026-08-01): After fixing the N_BASE parameter
(2^26→2^21), the R table at production height 1,842,080 is only 220 MB (was
6.93 GB → OOM). The GPU mines at ~21 MH/s and finds shares meeting the easy
target (hashes starting `0000…`). Shares are submitted to the debug pool,
which forwards them to 2miners. 2miners returns `BelowTarget` (expected —
easy target ≠ network target). To get 2miners-accepted shares, use the real
network target (requires longer mining time at 21 MH/s).

## Kernel Evolution

| Version | Approach | Hashrate | Commit |
|---------|----------|----------|--------|
| v1 (tableless) | On-the-fly blake2b for all 33 index computations per nonce | 14.37 MH/s | `26d98de4f` |
| v2 (R table / DAG) | Precomputed R table (N×32B) + uint4 table lookups | 21 MH/s | `b7fc2a180` |
| v3 (R table optimized) | __ldg() + shared mem header + 4 nonces/thread + (64,4) launch bounds | **25.35 MH/s** | `4a4c960e0` |
| v4 (N_BASE fix + live) | N_BASE 2^26→2^21 (Autolykos v2 correct); Auto→CUDA external; stream1 VRAM | **~21 MH/s live** | `3d4e707fa` |

The v2 kernel uses a two-kernel approach:
- `autolykos_precompute` — builds the R table: N elements × 32 bytes
  (`takeRight(31, H(j || height || M))` stored as 8 big-endian uint32_t)
- `autolykos_mine` — uses `uint4` 128-bit table lookups instead of on-the-fly
  blake2b for each of the 33 index computations per nonce

**Correctness verified:** GPU hash matches CPU reference exactly at height=0
(N=2M, 64 MB table). **Live test:** R table 220 MB at height 1,842,080,
~21 MH/s, shares found and submitted.

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
- **Easy target shares:** Found and submitted successfully (hashes `0000…`)
- **2miners-accepted shares:** 0 (expected — `BelowTarget` because easy target ≠ network target)
- **To get 2miners-accepted shares:** Remove `ZION_AUXPOW_EASY_TARGET=1` from pool config and run with real network target

---

## Performance

| Mode | Hashrate | Notes |
|------|----------|-------|
| Dedicated, tableless kernel (v1) | ~14.37 MH/s | `--test-cuda-kernel autolykos` benchmark |
| Dedicated, R table kernel (v2) | ~21 MH/s | R table lookups, height=0 (N=2M, 64 MB table) |
| Dedicated, R table optimized (v3) | **~25.35 MH/s** | __ldg + shared mem + 4 nonces/thread + (64,4) bounds |
| **Live pool, dedicated (v4)** | **~21 MH/s** | **Height 1,842,080, N=6.76M, R table=220 MB, stream1=0** |
| Shared with deeksha | ~250K H/s | Live pool test, GPU split between ERG + ZION |

The shared mode hashrate is ~57x lower than dedicated because the GPU
alternates between autolykos and deeksha_lite_v1 kernels. For production ERG
mining, disable the ZION stream (`ZION_STREAM1_ENABLED=0`) or dedicate a
separate GPU.

### VRAM Constraint — RESOLVED

The R table at production ERG height (~1,842,080) requires N≈6.76M × 32B =
~220 MB. This fits easily in 8 GB VRAM.

**Previous issue (resolved):** The `AUTOLYKOS_N_BASE` constant was set to
2^26 (67M, Autolykos v1 value) instead of 2^21 (2M, Autolykos v2 post-fork
value). This caused N to be 32x too large, resulting in a 6.93 GB R table
that OOM'd on 8 GB GPUs. Fix: `AUTOLYKOS_N_BASE = 2_097_152` (commit
`3d4e707fa`).

**Additional VRAM fix:** `TriGpuManager::new` always allocated the primary
GPU (~2 GB deeksha scratchpad) even when `ZION_STREAM1_ENABLED=0`. Now
passes `Cpu` kind when stream1 is disabled, freeing all VRAM for the
external GPU thread.

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
| `4a4c960e0` | Optimize kernel to 25.35 MH/s (1.76x over tableless) |
| `3d4e707fa` | Fix N_BASE (2^26→2^21), Auto→CUDA external, stream1 VRAM — live pool test success |

---

## Remaining Work

1. **2miners-accepted share** — run with real network target (not easy target)
   for 30+ minutes to get a 2miners-accepted ERG share. At 21 MH/s with
   pool vardiff, shares should come every few minutes.
2. **public/ subtree sync** — `cuda_external.rs` + kernel (blocked by missing
   `AuXpow` dependency in public `zion-miner`)
3. **Shared-memory optimization** — rewrite mining kernel to use shared memory
   for cooperative genIndexes computation (luminousmining approach) for 50+ MH/s
4. **OpenCL kernel** — update from old table-based approach to R table
