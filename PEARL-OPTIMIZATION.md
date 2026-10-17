# Pearl PoUW Kernel Optimization — Plan & Report

> Status: **Phase 1 deployed & validated on-device** (RTX 3060, vast 56302165).
> Phase 2 (kernel micro-opts) queued. Last updated: 2026-10-17.

---

## 1. Baseline → Current (RTX 3060, SM86)

| Metric | Before | After Phase 1 | Factor |
|---|---|---|---|
| Native PRL, solo (`zion-miner` stream2) | ~82 att/s (~570 GH/s) | **~277 att/s (~1915 GH/s)** | **3.4×** |
| Native PRL, contended triple (ZION+PRL+QTU) | ~45–66 att/s | **~224 att/s (~1550 GH/s)** | **~3.4×** |
| Probe single-attempt, contended | ~45 att/s | ~122–127 att/s | ~2.8× |
| Sync points per attempt | 4+ pipeline drains | **1 per batch (default 16)** | ~64× fewer syncs |
| Shares accepted (validation, native job) | — | **2/2 `accepted=true`** | verifier-passed |

Conversion for dashboards: `display_hps("PRL") = att/s × 6.9 × 1e9`
(SRMiner-calibrated; `stream::PEARL_GH_PER_ATTEMPT`).

## 2. Root cause of the old slowness

Per-attempt pipeline had **4+ host synchronizations** mid-flight:

1. `dtoh` root_a + root_b after Merkle (2 syncs)
2. `htod` seed_msg → `small_hash` → `dtoh` b_seed (sync) → `htod` → `small_hash`
3. `dtoh` found flag at end (sync)

Under GPU timesharing (3 streams / SRB sidecars) **every sync pays a
timeslice quantum ≈ 2.3 ms** — the GPU idles while the host roundtrips.
`PEARL_PROFILE` on the vast instance measured step times quantized to
~2.3 ms multiples: pure launch+work is ~0.5–0.8 ms, each sync added ~2.3 ms.

## 3. Phase 1 — implemented (this change)

### 3.1 `pearl_derive_seeds` — on-device seed derivation
New single-thread kernel in `csrc/cuda/pearl_pouw_native.cu` performing the
whole Step-4 chain on-device:

```
salted (cert≥3): hash_eff = blake3_keyed(SALT_{A,B}, root || dim_u32le || 28×00)
legacy:          hash_eff = root
b_noise_seed = blake3(job_key || hash_b_eff)
a_noise_seed = blake3(b_noise_seed || hash_a_eff)
```

Uses the existing `blake3_compress` device fn (`blake3_hash64` helper).
Salts uploaded once as constant buffers (`PearlCudaBufs.salt_{a,b}`).
Removes **all** Step-4 host roundtrips: 3 `dtoh_sync` + 2 `htod` +
2 `small_hash` launches → 1 async launch.

### 3.2 `mine_native_batch` — async attempt batching
`gpu/pearl_cuda.rs`:

- `found`, `output_tile`, `output_jackpot` buffers sized `MAX_BATCH=64`
  slots; attempt `i` writes slot `i` via `CudaSlice::slice_mut` views —
  **no kernel signature changes**.
- `prep_job()` uploads job_key/target/mine_params **once per batch** and
  `memset_zeros` the `found`/`tile` slots.
- `queue_attempt()` issues all ~33 launches of one attempt with **zero
  host sync** (kernels serialize on the single CUDA stream — attempt i
  finishes before i+1 starts, so buffers are safely reused).
- After the batch: **one** `dtoh` of `found[0..batch]`; on a hit the
  winning nonce's pipeline is re-run once through `mine_native` to
  materialize the matrices for the CPU proof build (attempts share
  buffers → the winner's matrices are overwritten by later queued
  attempts; re-run cost ≈ one attempt, hits are ~1/4700).

### 3.3 Trait + runtime
- `GpuMiner::mine_pearl_batch(input, batch)` — default impl loops
  `mine_pearl` (OpenCL and other backends unchanged); `PearlCudaMiner`
  overrides with `mine_native_batch`.
- `runtime.rs`: `ZION_PEARL_BATCH` (default **16**, clamp 1–64) —
  `fetch_add(batch)` on the nonce cursor, `update_hashrate` counts
  `attempts_executed`.

### 3.4 GH/s metrics everywhere
`stream::display_hps` (non-gated) converts PRL attempts/s →
SRBMiner-equivalent hash/s for: `[metrics]` console line, TUI, runtime
logs, `ZION_STATS_FILE` (`hashrate_display_hps` alongside raw
`hashrate_hps`), SRBMiner-compat API (total + per-GPU).

## 4. Validation performed

| Check | Result |
|---|---|
| `cargo check` (lib, `gpu-cuda,auxpow,tui`) | clean, 0 warnings |
| Probe vs pool, native eased job | **2/2 submitted shares `accepted=true`** — on-device seed derivation is bit-identical to the host chain (pool verifier recomputes the full proof incl. noise seeds) |
| Upstream `prlu:` jobs served | probe receives LP jobs continuously (pool fix live) |
| Triple run | ZION ~65-74 KH/s, PRL ~1550 GH/s, QTU ramping — one process |

## 5. Phase 2 — queued kernel micro-opts

Ordered by expected value:

1. **Merkle fusion** — ~22 tiny launches per attempt (halving layers
   2048→…→1 per tree). One block of 1024 threads can fold a whole tree
   in a single launch (`__syncthreads` between levels): ~22→2 launches.
2. **Mine kernel `__shfl_xor` reduce** — replace tid0's serial 32-iter
   XOR + 2 `__syncthreads` per rank-window (16 windows) with warp
   shuffles; or restructure to warp-per-tile blocks (8 tiles/block) for
   occupancy.
3. **`gen_matrix` inner loop** — PCG32 per element, `% 129` modulo is
   ~20-cycle; cheaper mapping (multiply-shift) must stay **bit-exact**
   (consensus) — needs parity proof first.
4. **Kernel fusion** — `apply_noise` into `gen_matrix` tail (one fewer
   4.2 M-element global roundtrip).
5. **CUDA streams overlap** — A and B^T pipelines are independent until
   `derive_seeds`; two streams halve serial blake3/merkle latency
   (~2 ms/att saving possible).

## 6. Honest gap vs SRBMiner

SRBMiner pearlhash ≈ **48 TH/s solo** on this card vs our ~1.9 TH/s-equiv
display — still ~25×. Their kernel fuses far more aggressively and likely
restructures the whole attempt (matrixgen + merkle in registers/shared).
Closing that fully is a research-grade kernel rewrite; Phase 1+2 targets
the low-hanging fruit (host roundtrips, launch storms, reduction
overhead) which already gave 3.4×.

## 7. Env knobs

| Env | Default | Meaning |
|---|---|---|
| `ZION_PEARL_BATCH` | 16 | attempts queued per spawn (1 = legacy) |
| `ZION_PEARL_K` | 2048 | consensus-required k (≥16·rank) |
| `PEARL_PROFILE` | off | (old per-step sync profiling — removed; batch path is sync-free by design) |
