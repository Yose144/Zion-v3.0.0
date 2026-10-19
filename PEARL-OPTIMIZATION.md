# Pearl PoUW Kernel Optimization — Plan & Report

> Status: the Phase 5 result on the rented RTX 3060 (vast 56302165, SM86)
> was ~20.3–21.1 TH/s solo sustained (§10–11) — a historical measurement,
> not a statement of current instance or process liveness. The 2026-10-18
> SM75 (Turing) tensor continuation (§12) is **compile-/assembler-validated
> ONLY**: not GPU-validated, not deployed, no new performance measured.
> Last updated: 2026-10-18.

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

### 3.8 Shared-mem staging in mine kernel — tried, REVERTED (-26%)

Hypothesis: each tile touches only 4 A rows + 8 B cols, so cooperative-
staging 12 rows × rank into `__shared__` should cut global traffic ~2.5×.
**Reality: -26% (1578 vs 2147 GH/s), reverted.** The warp already dedupes
the loads — all 8 lanes of a u-group read the SAME `int4` (broadcast = 1
transaction) and the 8 distinct b-col int4s coalesce fine; there was no
redundant traffic to eliminate. Staging instead added 2 `__syncthreads`
per window (×16) and 8-way smem bank conflicts (128B row stride maps to
the same bank). Correctness was fine (A4 R0) — the lesson: **warp-level
broadcast was already the optimal access pattern; don't stage what the
hardware dedupes.**

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
restructures the whole attempt (matrixgen + merkle in registers/shared) —
inferred, not verified SRBMiner internals. Closing that fully is
hypothesized to be a research-grade kernel rewrite; Phase 1+2 targets
the low-hanging fruit (host roundtrips, launch storms, reduction
overhead) which already gave 3.4×.

## 7. Env knobs

| Env | Default | Meaning |
|---|---|---|
| `ZION_PEARL_BATCH` | 16 | attempts queued per spawn (1 = legacy) |
| `ZION_PEARL_K` | 2048 | consensus-required k (≥16·rank) |
| `PEARL_PROFILE` | off | (old per-step sync profiling — removed; batch path is sync-free by design) |

## 8. Kernel iterations v3→v6 (RTX 3060, stage timing `ZION_PEARL_STAGE_TIMING=1`)

Controlled A/B on one binary via `ZION_PEARL_MINE=v3|v4|v5|v6` (default v6,
auto-fallback sm<80 / rank≠128 → v4). Parity gates:
`pearl_cuda_parity_vs_cpu_reference` + `default_config_repeated_attempts`
(v6 path validated at production rank=128).

| Kernel | mine ms | total ms | PRL solo | Note |
|---|---|---|---|---|
| v3 (tile/warp) | 2.93 | 3.21 | ~2.04 TH/s | latency-bound, ~4.5% issue |
| v4 strip8 dp4a | 0.962 | 1.247 | ~4.97 TH/s | 8 A streams + shared B |
| v4 unroll4 | 1.021 | — | ~4.79 | reg pressure |
| v4 strip16 | 1.50 | — | ~3.60 | reg cliff |
| v4+B-reg prefetch | 1.727 | — | — | +32 regs kills occ |
| v5 smem A-stage | 1.496 | 1.781 | — | barrier serialization, reverted |
| **v6 mma quad-col** | **0.310** | **0.604** | **11.35 TH/s** | tensor cores, current |

v6 = `mma.sync.aligned.m16n8k32.row.col.s32.s8.s8.s32`: warp = 4 col-offsets
of one 8-tile band; A fragments shared ×4 cols; per-window C-zeroed mma →
`cum[e] += d[e]` reproduces `my_acc` bit-exact; per-tile fold = 16-lane ×
2 frag elems XOR (order-free → bit-identical); canonical row-major
output_tile preserved. Failed sub-experiments recorded: single-col
(0.534), dual-col (0.392), B-smem staging (0.351, reverted), u64 fold pack
(no change). Remaining gap vs SRBMiner ≈ 4.2× — needs cp.async/ldmatrix
pipelined staging; all non-tensor paths exhausted.

## 9. Test B — native triple ZION 4% / QTU 48% / PRL 48% (v6, live :8444)

| Coin | Rate | Shares |
|---|---|---|
| PRL | 2.2–4.4 TH/s (duty-cycled) | — |
| QTU | 113–126 MH/s | A0 R0 |
| ZION | 26–28 KH/s | A13 R0 |

GPU 90W / 59°C / ~58% util. vs pre-v6 triple: PRL ~0.85–1.0 TH/s,
QTU ~77–98 MH/s → both improved (~3–4× PRL, +30–60% QTU from freed duty).
SRBMiner reference (Test A): 47.0–48.4 TH/s @129.8W/78°C/1725MHz.

## 10. Session 2 — fused stages + B-fragment sharing → 17.6 TH/s (2026-10-17)

Continuation of §8 on the same RTX 3060 (vast.ai 56302165, SM86, 98% util,
130W/78°C, no contention). All changes parity-gated by the same two KATs.

**Accepted (in order of impact):**

| Change | Effect | Evidence |
|---|---|---|
| v6 kc-outer/rg-inner (B frags feed both row-groups) | B gather loads −33%/window; mine 0.33→0.28 ms | A/B same binary |
| `pearl_merkle_derive_dual` — fused merkle+derive via `atomicAdd` epilogue on last-finishing block; `derive_ctr` zeroed per job | derive stage 0.15→0.001 ms (launch+serial latency gone) | stage timing |
| `pearl_gen_noise_fused` — uniform+perm one launch, gid-partitioned | one launch fewer; noise ~0.06 ms | stage timing |
| `ZION_PEARL_STREAMS` default 2→3 (clamp 4); pipes allocated per stream | 16.8→17.5 TH/s; 4 streams → 18.1 TH/s measured | env A/B |
| `__launch_bounds__(1024)` on fused merkle kernel | fixes NVRTC launch OUT_OF_RESOURCES (derive path reg bloat → spills in cold path only) | parity |

**Rejected / reverted (measured, kept for reference):**

| Experiment | Result | Why it lost |
|---|---|---|
| v6 B-window reg prefetch (+8 regs) | 15.9 vs 16.8 TH/s | occupancy loss |
| v6 2-window mma interleave (cC[64] regs) | ~16.0 TH/s | +32 regs; dots weren't the limiter |
| chunk blake3 4-way/2-way thread interleave | chunk 0.17→0.27 ms / ~same | reg pressure; 4096 chunks already saturate TLP |
| v9 ldmatrix / v9 cp.async fill | 0.343 / 0.351 ms | staging serialization + 3 blocks/SM |
| v10 A-smem + B-global (contig + strided cols) | 0.99 ms | barrier waits on worst-case L2 gather; L2-conflict hypothesis for contiguous cols disproved |

**Current stage profile (3 streams, contended per-stream):**
`gen=0.09 chunk=0.23 merkle=0.13 derive=0.001 noise=0.05 apply=0.08 mine=0.26 | total≈0.84 ms/attempt-stream → ~17.6 TH/s`

**Honest remaining gap vs SRBMiner (~48 TH/s): ~2.7×.** All incremental
latency tricks tried so far are exhausted (hypothesis — a broader redesign
could change this); the gap appears to require a production-grade
multi-stage smem GEMM pipeline (cp.async ring + ldmatrix + wide CTA tiles)
plus faster BLAKE3 (chunk+merkle ≈ 0.36 ms/att ≈ 43% of stream time).
Attempts so far suggest naive smem staging loses to `__ldg` gathers
on this access pattern (measured on the tried variants — not a proven
architectural limit); profiling tools (ncu) unavailable on the box.

## 11. Session 3 — deep fusion + regen-apply + streams=4 → 21.0 TH/s (2026-10-17)

Same RTX 3060, parity-gated by both KATs after each step.

**Accepted:**

| Change | Effect |
|---|---|
| `pearl_gen_chunk_merkle_fused` — ONE launch does gen + chunk-hash + in-block subtree Merkle. Each block of `PEARL_SUBTREE=128` threads covers a power-of-two-aligned ≤128-leaf subtree (16 blocks/tree, 32 total → all SMs busy); leaves live only in smem, pairwise reduce in-block (read→barrier→write), block subtree root → `subtree_{a,b}`; `merkle_derive_dual` then folds 16+16 subtree roots (canonical BLAKE3 subtree merge = bit-identical) + derive epilogue | chunk 0.23→0.002 ms; gen+chunk+merkle fused 0.44→~0.27 ms/att |
| `pearl_apply_noise_regen` — apply computes `gen_int7(nonce,idx)` inline instead of reading the matrix (element-wise, same index ⇒ identical) | −4MB matrix read/att |
| Matrix store removed from the fused gen path — matrices materialize only on-hit via `f_gen_dual` in `mine_native` before proof readback | −4MB matrix write/att (≈8MB/att less DRAM traffic total) |
| `ZION_PEARL_STREAMS` default 3→4 (clamp 6) | 19.8→20.9 TH/s; 6 streams ≈ flat |

**Result: ~20.3–21.1 TH/s solo sustained** (stage profile contended: gen 0.18 / chunk 0.002 / merkle 0.16 / derive 0.001 / noise 0.11 / apply 0.10 / mine 0.27 → ~0.83 ms/stream). 10.3× over the v3 baseline; **gap vs SRBMiner ~48 TH/s ≈ 2.3×.**

**Verdict:** the architecture is now a 5-kernel pipeline per attempt
(gcm_fused → merkle_derive → noise_fused → apply_regen → mine = 5 launches
down from ~33 at Phase-2 start) with all stages fused as far as data
dependencies allow. Remaining gap is concentrated in the v6 mma kernel's
L2-gather latency exposure and BLAKE3 serial chains inside gcm — closing
it appears to require the production GEMM pipeline described in §10, i.e.
a multi-day kernel rewrite rather than another measured iteration
(hypothesis, not a proven limit).

## 12. SM75 (Turing) tensor path + direct probes — compile-validated only (2026-10-18)

Status: **NOT GPU-validated, not deployed, no performance measured.** The
changes below are NVRTC/assembler-accepted on every target arch but have
not run on any GPU — the local host is AMD-only and remote access
approval is pending. Everything in this section is settled code state or
offline compiler evidence, not measurements; no current accepted-share or
process state is asserted.

### 12.1 What changed

- `mma_s8_m16n8k32` (`csrc/cuda/pearl_pouw_native.cu`): guard widened
  `__CUDA_ARCH__ >= 800` → `>= 750`. sm_80+ keeps the native
  `mma.m16n8k32.s8` instruction bit-for-bit; on sm_75 the same fragment
  contract is emulated by FOUR
  `mma.sync.aligned.m8n8k16.row.col.s32.s8.s8.s32` ops — `{d0,d1} +=
  a0·b0` then `a2·b1`; `{d2,d3} += a1·b0` then `a3·b1` (each m8 op:
  two `+r` accumulators, one `r` A, one `r` B).
- The v6/v7 compute `#if`s widened to `>= 750` only — same fragment
  mapping, `cum`/fold/jackpot semantics, and B-fragment sharing are
  unchanged. v8–v10 stay sm_80-only (cp.async/ldmatrix); the ldmatrix
  helper guard is untouched.
- New pure `select_mine_version` (`src/gpu/pearl_cuda.rs`) replaces the
  inline selector; the physical `(major, minor)` compute capability is
  cached once on `PearlCudaMiner` at init (no per-attempt attribute
  calls):
  - env unset → v6 **iff** `cc_major>=8 && rank==128 && k%128==0`, else
    v4 — the canonical-window guard applies to the default too, and SM75
    is **never promoted by default** (default SM75 = v4, unchanged);
  - explicit `ZION_PEARL_MINE=v6|v7` additionally accepted on sm_75 —
    opt-in only;
  - `v8|v9|v10` still require sm_80+; `v5` requires rank ≤ 128;
    unknown/unmet → v4.

### 12.2 Validation performed (2026-10-18)

- `python3 V31/scripts/check-native-cuda.py --output /tmp/NEW_EMPTY_CHILD_DIR`
  (run from the repo root; the output path must NOT exist, its parent
  must). Emits per-case `.cubin`/`.ptx`/`.log` plus `manifest.json` —
  NVRTC 12.4, 9/9 cases `compiled_only`: pearl sm61/sm75/sm86 (sm75 and
  sm86 include the direct MMA probe) and qpow sm61/75/86 ×
  `QPOW_FUSED_MDS=0|1`. Evidence:
  `/tmp/zion-cuda-check.t5SMCU/compile/manifest.json` — an ephemeral
  operator `/tmp` artifact; regenerate with the command above.
- `cargo test --offline --locked -p zion-miner --features gpu-cuda --lib
  pearl_selector -- --nocapture` →
  `pearl_selector_keeps_unverified_turing_opt_in` PASSED (pure CPU
  selector matrix).
- Final local gate `cargo test --offline --locked -p zion-miner
  --features gpu-cuda --lib -- --test-threads=1` → **exit 101:
  `163 passed; 11 failed; 11 ignored`**. All 11 failures are
  `runtime::tests::*` integration tests panicking in cudarc's loader —
  `Unable to dynamically load the "cuda" shared library` — because this
  host has no `libcuda` (AMD-only; device init precedes every code path
  changed here). The `#[ignore]`d hardware/bench tests were
  intentionally not run. Log:
  `/tmp/zion-cuda-check.t5SMCU/cargo-test-lib-final-gate.log`. **The
  suite is NOT green on this host** — and no baseline run of the old
  tree was performed, so whether the failures pre-existed is
  unverified; GPU validation remains pending.
- The small older rank=32 parity fixture exercises the **fallback** path,
  not the tensor path — it is not evidence for v6/v7 correctness.

### 12.3 Direct validation tests (compiled, NOT yet executed — no NVIDIA host)

- `pearl_cuda_tensor_fragment_matches_cpu` — 32 fragment matrices × 128
  outputs each vs a straight CPU dot-product reference (boundary ±127
  patterns + random inputs, non-zero initial accumulators).
- `pearl_cuda_tensor_batch_slots_match_cpu` — production rank=128,
  batch=16: every slot's found flag asserted and every jackpot checked
  against the CPU reference, then a zero-target batch verifies the
  found-flag reset. Requires `ZION_PEARL_MINE=v6` (the test asserts the
  selector did not silently fall back).
- `pearl_cuda_bench_sustained_windows` — 16 consecutive ≥1 s windows,
  first 4 warm-up, 12 steady; reports raw attempts + wall_ns only (no
  TH/s number, no SRBMiner parity claim).

### 12.4 On-device runbook (execute later on an SM75+/SM86 box — NOT locally)

Correctness gates first, from `V31` (explicit v6 on all host paths so
the default-config test cannot silently use v4 on SM75):

```bash
for gate in \
  gpu::pearl_cuda::direct_tests::pearl_cuda_tensor_fragment_matches_cpu \
  gpu::pearl_cuda::direct_tests::pearl_cuda_tensor_batch_slots_match_cpu \
  gpu::pearl_cuda::pearl_cuda_kat::pearl_cuda_parity_vs_cpu_reference \
  gpu::pearl_cuda::pearl_cuda_kat::pearl_cuda_default_config_repeated_attempts
do
  ZION_PEARL_MINE=v6 ZION_PEARL_K=2048 ZION_PEARL_RANK=128 \
    cargo test --release --offline --locked -p zion-miner --features gpu-cuda \
    --lib "$gate" -- --exact --ignored --nocapture --test-threads=1 || exit 1
done
```

Hardware benchmarks ONLY after all gates pass — exclusive same GPU,
unchanged clocks/power limits, no concurrent miners; interleave
v4,v6,v4,v6 (no best-of-N); streams=4 / batch=16; `ZION_PEARL_STAGE_TIMING`
unset; 16 windows / first 4 warm-up; preserve raw attempts + wall_ns:

```bash
for kernel in v4 v6 v4 v6; do
  env -u ZION_PEARL_STAGE_TIMING ZION_PEARL_STREAMS=4 ZION_PEARL_MINE="$kernel" \
    ZION_PEARL_K=2048 ZION_PEARL_RANK=128 \
    cargo test --release --offline --locked -p zion-miner --features gpu-cuda \
    --lib gpu::pearl_cuda::direct_tests::pearl_cuda_bench_sustained_windows \
    -- --exact --ignored --nocapture --test-threads=1 || exit 1
done
```

Any SRBMiner comparison must be contemporaneous on the same GPU/config —
the old RTX 3060 results and the calibrated GH/s display do not prove
parity.

## 13. Session 4 — cumulative-MMA v6 + on-card SRBMiner reference (2026-10-18, RTX 3060 SM86)

Instance `56527570`, driver 580.159.03, NVRTC 12.4, GPU isolated (0%
util before every run), 16 windows/run first 4 warm-up, interleaved
c0,c1,c0,c1 — same binary `zion_miner-…259833da` (sha
`3d92527d…855fe3`), batch 16, streams 4, `ZION_PEARL_MINE=v6`.

### 13.1 Opt-in `ZION_PEARL_CUMULATIVE_MMA=1`

v6 keeps a per-window `cC` fragment and merges it into `cum` each window.
The cumulative variant carries the MMA C registers directly across all
k=2048 rank windows — `cC` becomes the running accumulator and the scalar
`cum[e]+=d[e]` merge disappears. Exactness: s32 MMA accumulation mod 2^32;
canonical inputs bound each dot to |a|,|b| <= 127, k=2048 → 33,032,192
(< 2^31). Enabled ONLY by literal `ZION_PEARL_CUMULATIVE_MMA=1`; separate
NVRTC module `pearl_pouw_native_cumulative` prevents function aliasing on
a shared device; `-DPEARL_CUMULATIVE_MMA=0|1` compiled in.

**Gates (all PASS, same binary):** c0 batch16, c1 batch16, c1 small CPU
reference, c1 repeated default attempts — `PASS` in
`cumulative-gates-20261018-1/results.txt`.

**A/B result (24 steady samples each):**

| variant | median att/s | aggregate |
|---|---|---|
| c0 (merge) | 3013.33 | 3013.75 |
| c1 (cumulative) | 3057.32 | 3057.75 |

**+1.46 %** (ratio 1.0146). SASS metadata: v6 REG 118→86, STACK 32 and
SHARED 8192 unchanged — the freed registers are real but occupancy was
already not the binding constraint at this tile size. **Decision: stays
opt-in** — small measured gain, parity-clean, but not large enough to
justify flipping the default without production soak.

**First-AB v4/v6 cross-check (same session, earlier binary):** v4 998.17
vs v6 3014.29 att/s aggregate → **3.02×** (median ratio 3.022) —
consistent with previous v6 numbers.

### 13.2 Contemporaneous SRBMiner reference — same GPU

SRBMiner-MULTI 3.7.6 (sha `0c3353a7…25a15`, verified) on THIS RTX 3060,
90 s capture per algo against the project pool through a transparent
relay (unmodified wire data retained; CPU/MSR/OC tweaks disabled):

| algo | SRBMiner-reported | ours (native, sustained) | gap |
|---|---|---|---|
| pearlhash | **46.55 TH/s** | ~20.3–21.1 TH/s solo | **≈ 2.2×** |
| quantus | **212.72 MH/s** | ~141 MH/s | **≈ 1.50×** |

Raw evidence `/tmp/…/srb-reference-20261018-1/` (api.jsonl, console.log,
wire .bin, telemetry.csv). These are SRB self-reported numbers against
real `prlu:`/`qtu` jobs — the reference target, not a kernel benchmark.
Earlier "48 TH/s" readings came from a different card/session; **46.55
TH/s is the number for this exact GPU.**

### 13.3 What remains

v6 mine is still the dominant stage (~0.27 ms of ~0.83 ms/attempt
contended); the gap to 46.55 TH/s is a kernel-architecture problem
(multi-stage smem GEMM pipeline + faster BLAKE3), not a tuning one —
documented in §10–§11. The cumulative path is a marginal step; no
production flip recommended yet.

## 14. Session 5 — v7 octo-col + v11 cp.async ring: both REJECTED (2026-10-18)

Same RTX 3060 / binary `269e2201` / batch 16 / streams 4 / interleaved
v6c1→v7→v11×2, 24 steady samples each. Gates first: v7-batch, v11-batch,
v6c1-batch, v11-fragment all PASS (parity clean for all three kernels).

| kernel | median att/s | vs v6c1 |
|---|---|---|
| v6 + cumulative MMA (baseline) | **3071.0** | — |
| v7 (8 cols/warp, B shared ×8) | 2637.9 | **−14.1 %** |
| v11 (v6 + per-lane cp.async B ring) | 2626.9 | **−14.5 %** |

### v11 design (kept opt-in)

`pearl_pouw_mine_native_v11`: each lane cp.asyncs its OWN next-step B
fragments into a private 4-slot shared ring (4 warps × 4 slots × 32
lanes × 8 words = 16 KiB/block), continuous across window boundaries,
`wait_group 3` pacing, dead lanes via src-size=0 zero-fill — **no
__syncthreads anywhere** (smem = prefetch buffer, not shared staging).
Same mma/cum/fold/jackpot semantics as v6.

### Why both lost

- v7 halves B loads per output but `cum[8][8]` = 64 accumulators → reg
  cliff; net loss.
- v11 converts blocking `__ldg` gathers into async smem copies but pays
  LDS+STS issue overhead per fragment plus 16 KiB/block occupancy cost —
  the latency it hides was apparently already covered by warp-level
  parallelism at 5-6 resident blocks/SM.

**Takeaway:** the remaining ~2.2× gap to SRBMiner's 46.55 TH/s is not a
gather-latency fix — v6's memory pattern is already well-hidden by
occupancy. The bottleneck is more likely issue-rate/dependency-chained
inner work (mma dependency chains + scalar fold serialization per
window). Next candidate: interleave two INDEPENDENT windows' mma chains
per warp (2× ILP, reg cost ~32) — tried before at accumulator level and
lost to reg pressure; a leaner formulation may exist but is unproven.

## 15. Session 6 — `__launch_bounds__` occupancy experiment: REJECTED (2026-10-18)

`ZION_PEARL_MAXBLK=N` (new opt-in) compiles the v6 kernel with
`__launch_bounds__(128, N)`. Motivation: v6 uses ~86 regs → only ~5
blocks/SM resident (~31% occupancy). Same RTX 3060 / binary
`7f462319` / interleaved mb0→mb6→mb8 ×2, parity gates mb6/mb8 PASS.

| N | blocks/SM cap | median att/s | vs mb0 |
|---|---|---|---|
| 0 (default, 86 regs) | ~5 | **3069.8** | — |
| 6 (≤ ~72 regs) | 6 | 3056.1 | −0.45 % (noise) |
| 8 (≤ 64 regs) | 8 | 2841.5 | **−7.44 %** |

Verdict: v6 is NOT occupancy-bound. Spilling to reach 8 blocks/SM costs
far more than the extra warps earn; 6 blocks is neutral. Combined with
the v11 result (gather latency already hidden at 5 blocks), the inner
loop's serialization point is the per-window fold + the mma dependency
chain itself, not memory. Keeping `ZION_PEARL_MAXBLK` as an opt-in knob
for future variants; default build unchanged.

### QPoW launch/reg sweep (same session, same card)
`QPOW_TPB` {128,192,256,384,512} × `QPOW_NPT` {1,2,4} and
`QPOW_NVRTC_OPTS=-maxrregcount={48..96}`: all medians in a 143–146 MH/s
band → launch config and occupancy are saturated; the sponge chain's
issue rate is the ceiling. No env promotion; defaults stay.

## 16. Session 7 — full-miner V3 sweep on vast.ai RTX 3060 (2026-10-19)

Instance `56680673` ($0.068/h), RTX 3060 SM86, driver 580.173.02, ubuntu
22.04 container. Fresh HEAD binary built on-instance (rsync source +
`cargo build --release -p zion-miner --features gpu-cuda,gpu-opencl`,
incremental ~3 min). All numbers below are the **full-miner path**
(`--v3-trinity` against live `pool.zionterranova.com:8444`), not the
isolated kernel gate — expect ~10–15 % below the `pearl_cuda` test
harness numbers (tokio/V3 IO + serialize overhead).

### 16.1 PRL solo (ZION/CPU streams off, duty=100, k=2048)

| config | att/s | Δ |
|---|---|---|
| v6 default (streams=4, batch=16, cum=0) | 2646.8 | — |
| v6 + `ZION_PEARL_CUMULATIVE_MMA=1` | 2708.7 | +2.3 % |
| v6 + `ZION_PEARL_BATCH=64` | 2706.6 | +2.3 % |
| v6 + `ZION_PEARL_BATCH=32` | 2692.2 | +1.7 % |
| v6 + `ZION_PEARL_STREAMS=6` | 2687.0 | +1.5 % |
| v6 + `ZION_PEARL_STREAMS=2` | 2579.1 | −2.6 % |
| **v6 + cum + batch=64 + streams=4** | **2762.0** | **+4.4 %** |
| v11 (cp.async ring) | 2285.5 | −13.6 % |
| v4 (scalar strip8) | 913.6 | −65 % |

cum+batch stacking is additive in the full miner (prior gate showed cum
alone +1.46 %). Best env set: `ZION_PEARL_CUMULATIVE_MMA=1
ZION_PEARL_BATCH=64` (streams stay at default 4 — s6 adds nothing once
batch is large).

### 16.2 QTU solo via V3 qtun/native leg

`ZION_STREAM2_FORCE_COIN=QTU`: all launch knobs land in a **127–129
MH/s band** (default 128.38, tpb384/npt4 127.75, tpb128/npt1 127.53,
tpb256/npt2 127.69, single-nonce 127.36, `-maxrregcount=64` 129.12) —
confirms §15's plateau verdict on the live path. QTU submits accept
through the V3 bridge fine (up to A10 per 100 s window).

### 16.3 Trinity duty curve (ZION deeksha + PRL pearl on shared card)

`ZION_EXT_GPU_TIME_DUTY_PCT` sweep, both GPU streams V3-served:

| duty | PRL att/s | ZION KH/s |
|---|---|---|
| 30 | 977 | 1065 |
| 50 | 1633 | 1026 |
| 70 | 2127 | 957 |
| 100 | **2885** | **935** |

Duty<100 partitions time at batch granularity and costs PRL heavily for
single-digit-% ZION gains; **free contention (100) wins on combined
throughput** — PRL at 2885 even exceeds its solo run (other stream's
gaps fill pipeline bubbles). If a deployment wants deterministic ZION
floor, ~50 is the knee.

### 16.4 Quad mode live (STREAM4 opt-in)

`ZION_STREAM4_ENABLED=1 ZION_STREAM4_FORCE_COIN=QTU` with PRL on
stream2 + VRSC CPU + ZION: all four streams active over ONE V3
connection — steady ~860 KH/s ZION (A395, 99.5 %), ~1100–1380 att/s PRL,
~85–100 MH/s QTU (V3 `qtun:`/native leg), VRSC CPU ~56–120 (displayed
unit is an H/s-eq artefact, stream itself healthy). Pool served
`external_stream` (PRL) and `external_stream_2` (QTU) correctly per
coin preference.

### 16.5 Deploy caveat found

In this binary the V3 external-stream consumer task is gated on
`stream2_enabled` — `ZION_STREAM2_ENABLED=0` leaves `gpu-external`
permanently idle even though the pool serves the job. The SMOS group
for rig 518837 currently carries `ZION_STREAM2_ENABLED=0` yet PRL
flowed on vega-smos — env path on the rig needs verification before
the next binary roll (wrapper default `${ZION_STREAM2_ENABLED:-0}`
forces 0 unless minerOptions override). Recommended: set
`ZION_STREAM2_ENABLED=1` in the group options (harmless — direct
stream2 URL is unset so only the V3 consumer is affected).

### 16.6 Share acceptance note

PRL submissions through V3 were rare in solo tests (A0 mostly, one
`prlu:` upstream accept on v11 run) because the pool currently serves
hybrid jobs — upstream `prlu:` targets are LuckyPool-issued and far
harder than the eased native share target. Native-leg share acceptance
was already proven in §12/§14 live runs.

## 17. Session 8 — ZION deeksha metric forensics + real tuning levers (2026-10-19, RTX 3060)

Investigation started from an apparent binary regression: HEAD build reported
~368 KH/s vs ~995 KH/s on the Oct-16 Edge binary. Controlled A/B proved the
binaries identical under the same env — the delta was entirely **configuration
+ a synthetic hashrate metric**. What follows is the decomposed truth.

### 17.1 The metric is synthetic

`mine_v3_zion_share` runs `gpu.mine_batch(header, target, start, batch=1M)`.
The ekam_deeksha CUDA kernel chunks the batch by `work_size`, launches all
chunks back-to-back, and uses an in-kernel sentinel for early-exit once any
thread finds a top-32-bit target candidate. `GpuBatchResult.nonces_tested`
counts **launched** nonces — always the full 1M — while the device only scans
up to the first candidate chunk. Reported rate = `1M / iter_time`, an
artifact of job difficulty and per-chunk latency, **not** scan throughput.
The same synthetic counting applies to the V1 `mine_zion_pool_share` path.

### 17.2 Ground-truth rates (measured)

| path | rate | notes |
|---|---|---|
| CUDA kernel, ws=8192 | **24.8 KH/s** | `gpu_bench`, 10 s raw |
| CUDA kernel, ws=2048 | 16.6 KH/s | scratchpad 1 GB vs 4 GB |
| CPU-only, 4 cores | **255 H/s** | `--gpu cpu --threads 4` |
| CPU verify (`local_ok`) | ~15 ms | single hash per candidate |

ekam_deeksha is memory-hard (512 KiB scratchpad per nonce, fill + 2 passes +
128 random reads) — designed to be slow everywhere. The GPU contributes a
fast pre-filter (top-32-bit check, exact — no false negatives); candidates
are `local_ok`-verified on CPU before submit.

### 17.3 Every knob measured against SHARE RATE (accepted/s), not the metric

90 s windows, V3 solo ZION, same wallet/worker pattern:

| config | reported | accepted/s | verdict |
|---|---|---|---|
| ws8192, thr1/2 | 369–737 KH/s | **~1.31** | baseline |
| ws2048, thr2 | 1952 | **~1.60** | **+22–25 % shares** |
| ws1024, thr2/4 | 1945–3707 | ~1.66 | ≈ ws2048 |
| ws512, thr2 | 1725 | ~1.44 | worse (launch overhead) |
| ws16384 | 217 | ~1.0 | worse |
| thr4 vs thr2 @ ws2048 | 3882 vs 1952 | **1.58 vs 1.59** | **no share gain** |
| SKIP_CPU_RESCAN=1 | ≈same metric | ≈same shares | neutral @ easy diff |

Confirmed at 180 s windows, interleaved a/b/a/b: ws8192 → A239+A248
(1.35/s avg), ws2048 → A315+A321 (1.77/s avg) = **+31 % accepted shares**,
0–1 rejects throughout.

Quad-mode validation (ws2048 + skip-rescan + PRL cum/b64 + QTU + VRSC on
one V3 session): ZION **~2.9 accepted/s** (vs ~1.1/s in the §16.4 quad
baseline), QTU ~90–98 MH/s, PRL ~770–970 att/s under 3-way contention,
GPU 100 % util at only **3.25 GB VRAM** (ws2048 freed ~3 GB vs the 4 GB
default pool), 0–1 rejects.

Threads scale only the synthetic EWMA (iteration overhead mix); accepted
shares are flat (A142–143 both). `ZION_NONCE_COUNT`, `ZION_CUDA_TPB`
(64/128; 256 crashed the run), `ZION_GPU_TIME_DUTY_PCT` — all flat/no-op.

### 17.4 `ZION_GPU_SKIP_CPU_RESCAN=1` — new opt-in (miner)

On GPU miss the legacy paths re-scan the whole 1M batch on CPU
(`parallel_zion_find_nonce`, `miner_threads`). At ~64–255 H/s/thread a full
rescan takes **minutes-to-hours** and propagates `NoAuxPoWSolution` + 100 ms
backoff per iteration — a latency landmine whenever a job's prefilter hit
rate drops below ~1/1M (hard targets, cold job). The GPU pre-filter is
exact (top-32-bit necessary condition + full `local_ok` verify on every
candidate), so the rescan can only ever find shares lost to kernel false
negatives — which the KAT suite already guards against. Opt-in env skips it
on both V1 (`mine_zion_pool_share`) and V3 paths; default off, production
unchanged. `ZION_ITER_DEBUG=1` logs per-iteration `gpu_ms`/`iter_ms` for
future forensics.

### 17.5 Actionable ZION conclusions

- **`ZION_GPU_WORK_SIZE=2048` (or 1024) is the single real ZION lever found:
  +31 % accepted shares on SM86, replicated** — smaller scratchpad pool
  (1 GB vs 4 GB) cuts per-chunk latency, so u32-prefilter candidates surface
  ~2× faster.
  Also halves ZION's VRAM claim in shared-GPU deployments. Needs a
  per-device sanity check before rolling to the 1070 Ti rig (different
  memory subsystem; wrapper default is 4096 under `sharing_gpu`).
- Reported ZION "hashrate" should never be compared across configs —
  compare **accepted shares/s** (or pool-side worker stats) instead.
- `--threads` beyond 2: no share-rate benefit on this path (CPU rescan is
  dormant at current difficulties); leave at wrapper default.
- The GPU kernel's ~20 KH/s raw scan is the ceiling that matters only for
  rare hard-target windows; the real work per share is a few thousand
  nonces at current pool diff — no kernel rewrite justified by these data.


## 18. Session 9 — 4/48/48 max-performance allocation (2026-10-19, RTX 3060)

User target: **ZION ~4 % / QTC ~48 % / PRL ~48 %** of GPU time at max
throughput. Three configs measured (quad V3 session, ~100 s each):

| config | ZION | QTU | PRL | GPU util |
|---|---|---|---|---|
| duty 4/48/48 hard-partitioned | ~0.44/s | ~100 MH/s | ~770–1120 att/s | **47 %** — sleeps don't interleave |
| ZION=4, PRL=100, QTU=100 free | ~0.3/s | ~98 MH/s | ~740–910 att/s | 100 % — but QTU over-grabs |
| **ZION=4, PRL=100, QTU=48** | **~0.4/s** | **~80–87 MH/s** | **~2510–2815 att/s** | **100 %** ✅ |

### Winning env set

```bash
ZION_GPU_TIME_DUTY_PCT=4        # ZION ~4% of card — keeps pool session warm
ZION_EXT_GPU_TIME_DUTY_PCT=100  # PRL (stream2) free-runs the gaps
ZION_EXT_GPU2_TIME_DUTY_PCT=48  # QTU (stream4) self-caps ~48%
ZION_GPU_WORK_SIZE=2048         # +31% ZION candidates/s, frees ~3GB VRAM
ZION_PEARL_CUMULATIVE_MMA=1 ZION_PEARL_BATCH=64  # PRL winner from §16
ZION_GPU_SKIP_CPU_RESCAN=1      # optional: removes rescan stall landmine
```

Mechanism: duty sleep = `batch_ms × (100−d)/d` after each stream's own
batch. Hard-partitioned 4/48/48 leaves ~53 % of the card idle — sleeps
align instead of interleaving. The winning scheme caps only QTU and lets
PRL fill all remaining gaps: effective split ≈ 4 / ~50 / ~46.

### Production mapping

- **Trinity native-quad** (one zion-miner does ZION+PRL+QTU): envs above
  as-is.
- **SMOS rig** (SRBMiner runs QTU as a separate process): zion-miner side
  gets `ZION_GPU_TIME_DUTY_PCT=4` + `ZION_EXT_GPU_TIME_DUTY_PCT=100`
  (ZION@4%, PRL grabs what SRBMiner leaves — driver-level contention, no
  duty control across processes). Per-device check on the 1070 Ti before
  rolling `ZION_GPU_WORK_SIZE=2048`.

