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

### 3.5 Warp-shuffle jackpot reduction (Phase 2.1 — DONE)

`pearl_pouw_mine_native_v3`: block = one warp (32 threads, TILE_H×TILE_W).
The old fold staged per-lane accumulators in `__shared__ jackpot_tile[32]`
and lane 0 serially XORed all 32 each rank-window — 2 `__syncthreads`
per window ×16 windows (k=2048/rank=128). Now each lane keeps `my_acc`
in a register and a 5-step `__shfl_xor_sync(0xffffffff)` butterfly gives
every lane the full XOR — XOR is order-free so jackpot output is
**bit-identical**. `__shared__` tile array and both loop syncs removed
(`jackpot[16]` touched by lane0 only); early-out made warp-uniform via
`__any_sync` so the full-mask shuffle can't see exited lanes.

Measured on the same vast RTX 3060 (build `7f7b37a6`):

| Config | Before | After shuffle | Δ |
|---|---|---|---|
| Solo (PRL only, batch 16) | ~1915 GH/s ≈ 277 att/s | **~2120–2134 GH/s ≈ 308 att/s** | **+11%** |
| Triple contended (35% duty) | ~650–675 GH/s | **~738–743 GH/s** | **+12%** |
| Correctness | — | **A2 R0 in ~80 s solo** (pool-verified proofs) | ✓ |

### 3.7 A/B grid fusion (Phase 2.3 — DONE)

Instead of CUDA multi-stream plumbing, the independent A and B pipeline
halves now ride the **same launch** — threads (or blocks) are routed by
index. GPU fills all SMs with both halves at once; bit-identical output:

| Kernel | Replaces | Routing |
|---|---|---|
| `pearl_gen_matrix_dual` | 2× `pearl_gen_matrix` | `gid < mk` → A, else B^T (`gen_int7(nonce+1)`) |
| `pearl_blake3_chunk_hash_dual` | 2× `pearl_blake3_chunk_hash` | gid split at `chunks_a`; per-side dst + single flags |
| `pearl_merkle_tree_dual` | 2× `pearl_merkle_tree` | `blockIdx.x` — block 0 folds A (`chunk_hashes`↔`merkle`), block 1 folds B (`merkle2`↔`merkle_b`) |
| `pearl_gen_uniform_dual` | 2× `pearl_gen_uniform_noise` | gid split at `m*rank` |
| `pearl_gen_permutation_dual` | 2× `pearl_gen_permutation` | gid split at `k` |
| `pearl_apply_noise_dual` | 2× `pearl_apply_noise_{a,b}` | gid split at `mk` |

New scratch `merkle_b` (B tree can't share `merkle` — blocks run
concurrently). Per-attempt launches: **14 → 8** (was ~33 pre-Phase-1).
Solo **~2147 GH/s ≈ 311 att/s**, validated **A5 R0 in ~85 s** on eased
native jobs (pool verifier recomputes both trees + noise chain).

Cumulative RTX 3060 solo: **82 → ~311 att/s ≈ 3.8×**.

QTU also rose ~86→94–100 MH/s — PRL now finishes its duty slice faster,
leaving the card to stream 4 sooner.

### 3.6 Fused whole-tree merkle (Phase 2.2 — DONE)

`pearl_merkle_tree` replaces ~11 per-level `pearl_blake3_merge` launches
per tree (2048→…→1, both trees = ~22 launches/attempt) with **one launch
per tree**. One block of 1024 threads grid-strides over each level's
parents; `__syncthreads` between levels; src/dst ping-pongs between the
leaf buffer and `merkle` scratch (a level's source is fully consumed by
the previous level, so writing back into it is safe). Identical layering,
odd-leaf passthrough and ROOT-flag-on-final-merge semantics — validated
by **A3 R0 accepted** on eased native jobs (pool verifier recomputes the
full proof incl. both roots). Solo ~2074 GH/s measured; the real win is
~20 fewer stream serialization points per attempt under timesharing.

## 5. Phase 2 — queued kernel micro-opts

Ordered by expected value:

1. ~~**Merkle fusion**~~ — **DONE (§3.6):** 22→2 launches, A3 R0 validated.
2. ~~**Mine kernel `__shfl_xor` reduce**~~ — **DONE (§3.5):** butterfly
   shuffle fold, solo 277→308 att/s (+11%). Still open: restructure to
   warp-per-tile blocks (8 tiles/block) for occupancy.
3. **`gen_matrix` inner loop** — PCG32 per element, `% 129` modulo is
   ~20-cycle; cheaper mapping (multiply-shift) must stay **bit-exact**
   (consensus) — needs parity proof first.
4. **Kernel fusion** — `apply_noise` into `gen_matrix` tail (one fewer
   4.2 M-element global roundtrip).
5. ~~**CUDA streams overlap**~~ — **DONE (§3.7) via grid fusion instead**
   (same overlap, no stream/event plumbing).

## 6. Honest gap vs SRBMiner

SRBMiner pearlhash ≈ **48 TH/s solo** on this card vs our ~2.15 TH/s-equiv
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
