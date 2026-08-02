# ERG Autolykos v2 — Live Pool Test Report

**Date:** 2026-08-01 (updated 2026-08-02 with genIndexes fix + R table rebuild fix)
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

**Status (2026-08-02):** GPU mining at ~30 MH/s with R table rebuilding
successfully across block height changes. The genIndexes algorithm was fixed
in all 3 implementations (Rust, C, CUDA) and GPU=CPU hash match verified at
real mainnet height. The R table rebuild bug (VRAM not freed due to
stream-ordered `cuMemFreeAsync`) was fixed with a stream synchronize call.
No 2miners-accepted shares yet — needs longer mining run at network difficulty.

## Kernel Evolution

| Version | Approach | Hashrate | Commit |
|---------|----------|----------|--------|
| v1 (tableless) | On-the-fly blake2b for all 33 index computations per nonce | 14.37 MH/s | `26d98de4f` |
| v2 (R table / DAG) | Precomputed R table (N×32B) + uint4 table lookups | 21 MH/s | `b7fc2a180` |
| v3 (R table optimized) | __ldg() + shared mem header + 4 nonces/thread + (64,4) launch bounds | **25.35 MH/s** | `4a4c960e0` |
| v4 (N_BASE + live) | N_BASE 2^26 (correct Ergo spec); Auto→CUDA external; stream1 VRAM | ~21 MH/s | `3d4e707fa` |
| v5 (genIndexes + rebuild fix) | Fix genIndexes in all 3 impls; stream sync for R table VRAM free; 4M work_size | **~30 MH/s** | `37f660386` |

The v2 kernel uses a two-kernel approach:
- `autolykos_precompute` — builds the R table: N elements × 32 bytes
  (`takeRight(31, H(j || height || M))` stored as 8 big-endian uint32_t)
- `autolykos_mine` — uses `uint4` 128-bit table lookups instead of on-the-fly
  blake2b for each of the 33 index computations per nonce

**Correctness verified:** GPU hash matches CPU reference exactly at:
- Height=0 (N=2^26=67M, table=2GB)
- Height=1,842,101 (N=216,430,305, table=6.93 GB) — real mainnet height

---

## Bugs Found and Fixed

### Bug 1: ERG share target not filtered (commit `efe7ae980`)

**Root cause:** `AuXpow/src/multiplexer.rs` function `effective_share_target()`
did not include `autolykos` in the `uses_notify_target` match list. The pool
therefore used `client.share_target()` (default `[0xFF; 32]` = max target)
instead of the real ERG target from the 2miners `mining.notify` params.

**Symptom:** The miner submitted every nonce as a share. 2miners rejected all
with `[23, "Low difficulty share", null]`.

**Fix:** Added `"autolykos"` to the `uses_notify_target` match arm.

### Bug 2: genIndexes algorithm incorrect (commit `37f660386`)

**Root cause:** The genIndexes function (which generates the indices j used to
build the R table) had an incorrect implementation in all 3 code paths (Rust
`external_hashers.rs`, C `autolykos_native.c`, CUDA `autolykos_kernel.cu`).
The index generation didn't match the Ergo reference implementation.

**Fix:** Rewrote genIndexes in all 3 implementations to match the Ergo
reference. GPU vs CPU hash match verified at real mainnet height (1,842,101).

### Bug 3: R table VRAM not freed on rebuild (commit `37f660386`)

**Root cause:** When CUDA memory pools are enabled (`is_async=true` on
Pascal+), `CudaSlice::drop` calls `cuMemFreeAsync` which is stream-ordered —
the VRAM is not actually returned to the pool until the stream synchronizes.
When a new block height arrived, the old R table was dropped
(`self.autolykos_r_table = None;`) but `mem_get_info()` still saw the old
allocation, causing "R table too large for VRAM" on every new block.

**Symptom:** GPU mined 5 batches successfully, then stopped mining for the
rest of the session (1,116 consecutive batch errors).

**Fix:** Added `cuda_stream::synchronize(*self.dev.cu_stream())` after dropping
the old R table, before checking `mem_get_info()` and allocating the new table.

**File:** `V3/L1/miner/src/cuda_external.rs:525-530`

### Bug 4: CUDA device sharing SIGSEGV (commit `37f660386`)

**Root cause:** When `ZION_STREAM1_ENABLED=0`, `tri_gpu` is created as CPU
dummy → `shared_cuda_device()` returns `None`. The old code passed `None` to
the external GPU thread, which called `CudaDevice::new_with_stream(0)` →
SIGSEGV from different thread (CUDA context thread-affinity issue with
non-blocking streams).

**Fix:** When `shared_cuda_device()` returns `None`, create standalone
`CudaDevice::new(0)` (default stream, not non-blocking) in the main thread.

**File:** `V3/L1/miner/src/main.rs:3116-3140`

### Bug 5: work_size=256 (commit `37f660386`)

**Root cause:** Autolykos CUDA external miner was initialized with
`work_size=256` → only 1 block per kernel launch on 19-SM GPU.

**Fix:** Set `ZION_SECONDARY_GPU_WORK_SIZE=4194304` (4M) env var.

### Bug 6: epoch_for_algorithm wrong for autolykos (commit `37f660386`)

**Root cause:** `epoch_for_algorithm` used `height/45000` for autolykos, but
the R table depends on exact height (each element = `H(j || height || M)`),
so it must rebuild every block, not every 45000 blocks.

**Fix:** Changed to `Some(height as u32)` so R table rebuilds every block.

---

## Verification Results

### 1. CUDA kernel correctness (verified)
- `cargo test -p zion-miner --features gpu-cuda test_autolykos_gpu_vs_cpu` → PASS (height=0)
- `cargo test -p zion-miner --features gpu-cuda test_autolykos_gpu_vs_cpu_at_real_height` → PASS (height=1,842,101)
- Both GPU and CPU produce `d873f6b70b7d28bff48d9d035a71ad8d233e9e37ebbf18451d728a0ed89c48df`

### 2. Stratum connectivity
- ZION debug pool connected to `erg.2miners.com:8888` ✓
- `mining.subscribe` → subscribed with extranonce1 ✓
- `mining.authorize` → authorized as `9ftkEY...ELUe.zion-erg-gpu-erg` ✓
- `mining.notify` received with real ERG jobs (height ~1,842,148, target `00000002`) ✓

### 3. ERG notify parsing
2miners ERG stratum format:
```
params: [job_id, height, msg_blob, "", "", version_hex, target_decimal, "", clean_jobs]
```
- `arr[0]` = job_id (e.g. `"13a4"`)
- `arr[1]` = block height (e.g. `1842148`)
- `arr[2]` = 32-byte header blob (hex)
- `arr[5]` = version compact hex (e.g. `"00000002"`) — NOT the target
- `arr[6]` = target as decimal string (e.g. `"66346743..."`) — the real target

### 4. R table rebuild across blocks (verified 2026-08-02)
- R table builds successfully at height 1,842,150 ✓
- R table rebuilds successfully at height 1,842,151 (new block) ✓
- Batches continue without errors after rebuild ✓
- 100 batches × 8M nonces / 28s = ~30 MH/s ✓

---

## Performance

| Mode | Hashrate | Notes |
|------|----------|-------|
| Dedicated, tableless kernel (v1) | ~14.37 MH/s | `--test-cuda-kernel autolykos` benchmark |
| Dedicated, R table kernel (v2) | ~21 MH/s | R table lookups, height=0 (N=2M, 64 MB table) |
| Dedicated, R table optimized (v3) | ~25.35 MH/s | __ldg + shared mem + 4 nonces/thread + (64,4) bounds |
| **Live pool, dedicated (v5)** | **~30 MH/s** | **Height 1,842,150, N=216M, R table=6.93 GB, stream1=0, work_size=4M** |
| Shared with deeksha | ~250K H/s | GPU split between ERG + ZION |

### VRAM Constraint

The R table at production ERG height (~1,842,150) requires N=216,430,305 × 32B =
**6.93 GB**. On an 8 GB GTX 1070 Ti, this leaves only ~1 GB for the CUDA context,
display server, and other processes.

**Requirements:**
- Kill Firefox (~580 MiB VRAM) before mining: `pkill -9 -f firefox`
- Kill tracker-store and other unnecessary GPU processes
- Set `ZION_STREAM1_ENABLED=0` to free the deeksha scratchpad (~2 GB)
- VRAM headroom reduced from 512 MB to 32 MB (M/output/header are <1 MB total)
- R table build takes ~13 seconds on GTX 1070 Ti (occurs every new block ~2 min)

**Note:** Firefox auto-respawns on this system and consumes ~580 MiB VRAM. If
the R table build fails with "too large for VRAM", kill Firefox and the next
attempt will succeed.

---

## Live Test Command

```bash
# Kill Firefox to free VRAM
pkill -9 -f firefox

# Run miner with standalone CUDA device (stream1 disabled)
ZION_LOOP_COUNT=1000000 \
ZION_STREAM1_ENABLED=0 \
ZION_STREAM2_ENABLED=1 \
ZION_MINER_GPU_COIN=ERG \
ZION_EXT_GPU_BACKEND=cuda \
ZION_SECONDARY_GPU_WORK_SIZE=4194304 \
ZION_EXT_GPU_BATCH_SIZE=8388608 \
./V3/target/release/zion-miner --pool 62.171.141.136:8461 \
  --wallet zion17285k3966560j5e4s4h3f2x3x5l0x8z8y4s84k5 \
  --worker erg-gpu-test --no-tui
```

**Build command:** `cargo build --release -p zion-miner --features gpu-cuda`

---

## ERG Target Analysis

```
Target (decimal): 6634674375215649981044791689095340972727658017446627184440307089471
Target (hex):      000000003f00000003f00000003f00000003f00000003f00000003f00000003f
Target (bits):     ~226 bits
Expected time:     2^226 / 30e6 ≈ 2.38e61 seconds (dedicated, per nonce)
                   At pool difficulty (vardiff), shares come faster
```

The 2miners pool uses variable difficulty (`mining.set_difficulty`). At the
default pool difficulty, a share is expected every ~15-30 seconds for a
~300 MH/s rig. At our 30 MH/s, expected time is longer but feasible.

---

## Commits

| Commit | Description |
|--------|-------------|
| `26d98de4f` | Integrate tableless real Autolykos v2 CUDA kernel + fix CPU/GPU mismatch |
| `efe7ae980` | Fix ERG share target: use notify target for autolykos in effective_share_target |
| `b7fc2a180` | Rewrite CUDA kernel to use precomputed R table (DAG) — 21 MH/s, 1.5x improvement |
| `4a4c960e0` | Optimize kernel to 25.35 MH/s (1.76x over tableless) |
| `3d4e707fa` | Fix N_BASE (2^26→2^21), Auto→CUDA external, stream1 VRAM — live pool test |
| `37f660386` | Fix genIndexes + R table VRAM rebuild + CUDA device sharing + work_size + epoch |

---

## Remaining Work

1. **2miners-accepted share** — run with real network target (not easy target)
   for 30+ minutes to get a 2miners-accepted ERG share. At 30 MH/s with
   pool vardiff, shares should come every few minutes.
2. **public/ subtree sync** — `cuda_external.rs` + kernel (blocked by missing
   `AuXpow` dependency in public `zion-miner`)
3. **Firefox auto-respawn** — consider disabling Firefox auto-start or creating
   a systemd service that kills Firefox before mining starts
4. **gpu_hps display bug** — `session_status` shows `gpu_hps=0.00` even when
   GPU is actively mining (the `attempted_hashes` only counts ZION deeksha
   hashes, not ERG GPU hashes)
5. **Shared-memory optimization** — rewrite mining kernel to use shared memory
   for cooperative genIndexes computation for 50+ MH/s
