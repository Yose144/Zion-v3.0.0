# QPoW Lane-Parallel Kernel — Implementation Plan

**Goal:** close the ~1.7× gap vs SRBMiner on RDNA (our OpenCL kernel ~43 MH/s vs SRB ~73 MH/s on RX 5600 XT / gfx1010, measured 2026-10-10).

## Why the current kernel is stuck at ~43 MH/s

Current architecture: **one lane = one nonce**. Each work-item computes a full
Poseidon2-64×12 permutation serially:

- 12-element `u64` state in registers (~50–70 VGPR live)
- Per round: 12 sbox (`x^7` = 4 chained muls each), 12×12 MDS matvec on 64-bit
  limbs, RC adds
- All field ops are `mul_hi`/`mul_lo` + carry chains → long serial dependency
  chains inside every lane

Measured diagnostics (gfx1010): `PrivateMemSize=0`, `LocalMemSize=0`,
preferred WG multiple 32, max WG 256. **No spills — the kernel is ALU +
latency saturated.** All runtime knobs (lws, npt, unrolls, ILP variants,
`mad_hi` fusion) land in a 41–43 MH/s noise band: the instruction stream per
nonce is fixed and the GPU is already issuing near peak rate.

The only way forward is to **change the amount of instruction-level work per
hash**, i.e. spread one permutation across multiple lanes.

## Target architecture: lane-parallel Poseidon2 ("warp-per-nonce")

Idea used by fast implementations (supranational / Ingonyama-style, and almost
certainly SRB's RDNA backend):

- One **subgroup (wavefront, 32/64 lanes)** cooperates on **one nonce**
- The 12-element state is sharded across lanes: `lane i` holds `state[i]` —
  with 12 lanes active per nonce, or pack 2 nonces × 12 lanes into a wave32,
  or 5 nonces on wave64.
- Each lane keeps only **1 u64** in registers → register pressure collapses
  (~8–12 VGPR), occupancy maxes out, and each lane's instruction stream is
  ~1/12 of today's.

Per-round mapping:

| Phase | Today (per lane) | Lane-parallel |
|---|---|---|
| S-box `x^7` | 12 elems × 4 muls serial | 1 elem × 4 muls per lane |
| Internal rounds RC | full-width add | 1 add (lane 0) or scattered |
| MDS matvec | 12×12 serial loop | each lane: 1 broadcast-read of all 12 elems via `sub_group_broadcast` + 12 fma-equivalent muls → all lanes compute their own output element in parallel |
| External rounds | same MDS | same |

MDS cost per lane: 12 reads via `sub_group_broadcast(state_j, j)` (compiler
lowers to `v_permlane`/`ds_read` on RDNA — ~1 cycle issue each) + 12 muls +
adds. Total per round ≈ 12 mul + shuffles per lane vs 144 mul today per lane —
but 12× more lanes are busy. Net: same mul count, **~12× shorter critical
path**, full ALU utilization, minimal registers.

### Field arithmetic notes

- Keep the existing `gf64` limbs: `mul128(a,b)` = `mul_lo`/`mul_hi` + carry
  fold — unchanged, just executed once per element per lane.
- Modular reduce stays `reduce128`-equivalent (branchless).
- Constant adds (`rc0`): only lane owning `state[0]` (or broadcast-add) —
  minor divergence, fine.
- Boundary: `sub_group_broadcast` requires `cl_khr_subgroups` (AMD APP
  supports it; verify `gfx1010` reports `cl_khr_subgroup_shuffle`).

## Work plan

1. **Skeleton kernel `qpow_lane.cl`** (new file beside `poseidon2_kernel.cl`):
   - `kernel void qpow_lane(...)` — 12 lanes per nonce
   - Work-item ↔ nonce mapping: `nonce = base + get_group_id(0) * NONCES_PER_WG + (get_local_id(0) / 12)`; `lane12 = get_local_id(0) % 12` — keep 12-lane groups contiguous in one wave
   - Port `permute64_after_initial` / `initial` to lane-sharded form
2. **Host path**: env flag `ZION_QPOW_OCL_IMPL=lane` (fallback `scalar`) in
   `qpow_opencl.rs`; global size = `nonces × 12`, local = multiple of 12 (e.g.
   96/192); output buffer indexed by nonce.
3. **Correctness gate first**: reuse `qpow_opencl_matches_cpu_golden` style
   test — run both kernels on same headers/nonce ranges, byte-compare results.
   Must pass before any perf work.
4. **Bench loop**: `qpow_bench_effective_throughput` with `ZION_QPOW_OCL_IMPL`.
   Iterate: nonces-per-wave packing (wave32: 2 nonces × 12 lanes + 8 lanes idle
   vs wave64: 5 nonces × 12 + 4 idle — measure both; AMD wave32 native).
   Variant: 6-lane split (2 elems per lane) halves broadcast count.
5. **Shuffle-cost tuning**: try `sub_group_broadcast` vs `__local` scratch
   staging (LDS on gfx1010 is fast; may beat shuffles if compiler
   doesn't fold broadcasts into `v_readlane`). Variant C: hold MDS as
   `__constant` floats? No — field math, keep ints.
6. **Deployment decision**: if ≥ ~60 MH/s clean bench → switch desktop miner
   `ZION_QPOW_OCL_IMPL=lane` default; keep scalar as fallback for
   devices without subgroup support (runtime check + auto fallback).
7. **Port to CUDA later** (`__shfl_sync`, warp-per-nonce, 8 lanes × 4? ) —
   same structure maps to warp32: 12 lanes → pad to 16 or use 12 with mask
   `0xFFF`.

## Risks / unknowns

- **Broadcast throughput**: 12 broadcasts × ~40 rounds × 2 permutations per
  nonce — if shuffle unit is the bottleneck, LDS variant or 6-lane packing.
- **Packing waste**: wave32 = 2.67 nonces/wave → 20% idle lanes unless we pack
  2 nonces + reuse. Options: `LANES=12`, `LANES=6` (2 elems/lane), or 12-lane
  groups inside wave64.
- **Atomic counter**: keep existing `found_count` atomic + early-exit flag.
- **SRB target check**: verify ~73 MH/s is actually lane-parallel and not e.g.
  a cheaper field representation (Goldilocks has known speedups: lazy
  reduction, `mul` without full reduce between rounds — worth testing first:
  keep values in `<2^65` "lazy" form through whole rounds, reduce once at the
  end → could cut ~30% of muls and might be a *smaller* change than full
  lane-parallel).

## Interim / already done

- `ZION_QPOW_OCL_SRC` runtime kernel override — iterate without rebuilds.
- `qpow_kernel_info` test — occupancy diagnostics.
- Parametric unroll `-D` macros (`QPOW_IUNROLL`/`QPOW_EUNROLL`).
- SRBMiner sidecar integrated in desktop agent (`qtcEngine: "srbminer"`) —
  production gets ~73 MH/s on the mining card while we build v2.
- Stable display-card profile: batch 4M + 10ms launch gap (~42 MH/s, no
  ring timeouts in tested window).

## Definition of done

1. Lane kernel passes golden-test vs CPU reference on ≥3 header/nonce sets.
2. Clean bench ≥ 60 MH/s on gfx1010 (target: match/beat SRB 73).
3. No `amdgpu` ring timeout during 10-min soak on the display-attached card
   at the stable launch profile.
4. Runtime fallback: non-subgroup devices automatically keep scalar kernel.
EOF