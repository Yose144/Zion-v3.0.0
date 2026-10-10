# ZionSMR — QPoW Metal Kernel + SRBMiner Commercial Track

**Created:** 2026-10-10 · **Status:** Phase A done, Phase B in progress

## Context

- **QPoW (Quantus / QTU-QTC)** = Poseidon2 sponge (12×u64 Goldilocks state) squeezed
  twice → 64-byte hash compared `<=` a 64-byte target. Pure-ALU algorithm — no DAG,
  no scratchpad, tiny buffers. Ideal fit for Apple Metal (unified memory is a
  non-issue here, unlike the memory-hard Ekam Deeksha).
- Existing implementations in `V31/L1/miner`:
  - CPU reference `src/auxpow/qpow.rs` — bit-exact vs upstream `pow-core` (KAT-verified).
  - OpenCL `src/gpu/qpow_opencl.rs` + `csrc/opencl/poseidon2_kernel.cl` — ~43 MH/s on
    gfx1010 (RX 5600 XT).
  - CUDA `src/gpu/qpow_cuda.rs` + `csrc/cuda/poseidon2_kernel.cu`.
- **SRBMiner-MULTI** (doktor83): closed-source, **Win64 + Linux only — no macOS
  build exists**. Supports `--algorithm quantus`, reaches ~73 MH/s on gfx1010
  (≈1.7× our OpenCL kernel). Already integrated in the desktop agent as an
  opt-in sidecar (`qtcEngine: "srbminer"`, pool `eu.lproute.com:5660`).
- Therefore on macOS / Apple Silicon the **Metal kernel is the only GPU path**
  for QTC — and it is also the missing third backend for feature parity
  (CUDA + OpenCL already wired through `QpowGpuMiner`).

## Phase A — SRBMiner original download ✅

- `SRBMiner-MULTI 3.7.4` (release 2026-10-09) staged at
  `APP&WEB/desktop-agent/resources/srbminer/SRBMiner-MULTI`
  (archive + `VERSION.txt` alongside; binary is git-ignored).
- MD5 of the tarball verified against the official release page:
  `c000bcaaa10a7a82a4456ae4b7617ccd`.
- Linux x86-64 ELF — runs on Edge/SMOS rigs (sidecar path already implemented),
  used locally only as a **hashrate/correctness reference**.

## Phase B — Metal QPoW kernel ✅ (2026-10-10)

**Done:** `src/gpu/kernels/metal/poseidon2_kernel.metal` (line-level MSL port,
`mulhi`/`atomic_uint`, same lazy-reduce semantics) + `src/gpu/qpow_metal.rs`
host + `QpowGpuMiner::Metal` wiring (Metal tried first under `auto` on macOS,
graceful fallback). Verified on-device: golden test
`metal_kernel_matches_cpu_golden_and_boundaries` **PASS** (KAT `hash±1`
boundaries, extranonce + low64-carry vectors). Bench on this Mac's integrated
GPU: **~6.9 MH/s** (tpg 256 / npt 1 default is optimal; tpg 128/npt 4 and 512
tested slower/equal). Gap vs SRBMiner tracks the hardware ratio (integrated
GPU vs RX 5600 XT). Lane-parallel variant implemented and measured — see §6.

**Live E2E (qelvhash pool, `qpow_probe`):** connect → quantusstratum login →
job stream → Metal scan → CPU re-verify → `submit_qpow_share` — **10-min soak:
22 shares Accepted / 0 Rejected / 0 Unknown, 4.2 G nonces, sustained
6.93 MH/s** under continuous job rotation (~1-2 s cadence, per-job en1).

Work items delivered:

Same Trinity buffer ABI as OpenCL/CUDA so the host-side flow is identical:

| Buffer (u32) | Contents |
|---|---|
| `results[9]` | `[0]` atomic hit count, `[1..9]` logical candidate indices (≤8) |
| `prestate[24]` | 12 Goldilocks limbs as LE u32 pairs (`mining_prestate_low64`, CPU) |
| `start_nonce[16]` | U512 LE limbs — only low 64 bits advance per batch |
| `difficulty_target[16]` | U512 LE limbs |
| `dispatch_config[3]` | `{total_threads, nonces_per_thread, total_nonces}` |

Work items:

1. **Kernel `csrc/metal/poseidon2_kernel.metal`** — line-level port of
   `poseidon2_kernel.cl` (itself a port of upstream `mining_u64.wgsl`/CUDA G2):
   - `__constant` → `constant`, `__global` → `device`, `static inline` → `inline`.
   - `mul_hi(a,b)` → `metal::mulhi(a,b)` (MSL supports 64-bit `ulong`; if a
     target toolchain lacks it, fall back to manual 32×32 limb product — must
     be decided by compile test, not assumed).
   - `atomic_add(&results[0],1)` → `atomic_fetch_add_explicit` on
     `device atomic_uint`.
   - `#pragma unroll` → `#pragma clang loop unroll_count(n)` / `[[unroll]]`.
   - Keep the same `reduce128` lazy-fold semantics (~2⁻³³ slip — host CPU
     re-verifies every recorded candidate anyway, unchanged contract).
   - Keep `QPOW_IUNROLL`/`QPOW_EUNROLL` tunables via Metal compile-time
     function constants or `-D` defines through `MTLCompileOptions` preprocessor.
2. **Host `src/gpu/qpow_metal.rs`** — mirror `QpowOpenclMiner` using the
   `metal` crate (v0.30, already a `gpu-metal` dep):
   - `Device::system_default`, `new_library_with_source` of the embedded
     `.metal` source (env override `ZION_QPOW_METAL_SRC` for bench iterations,
     same pattern as `ZION_QPOW_OCL_SRC`).
   - `mine_batch(header, nonce_be, target, total)`: CPU `mining_prestate_low64`
     → upload 5 small shared-mode buffers → `qpow_mine` dispatch
     (`threads_per_grid` = `ceil(total/npt)`, `ZION_METAL_TPG`-style env for
     threadgroup size) → readback → CPU `get_nonce_hash` re-verify →
     `QpowGpuResult`.
3. **Wiring** — `QpowGpuMiner::Metal` enum variant + `#[cfg]` gates extended
   (`any(gpu-cuda, gpu-opencl, gpu-metal)`); `create_qpow_gpu_miner` gains a
   `GpuBackendKind::Metal` branch and `Auto` on macOS tries Metal after
   OpenCL/CUDA (same order as the ZION stream).
4. **Correctness gate first** — golden test: GPU batch vs CPU
   `scan_low64`/`get_nonce_hash` on ≥3 header/nonce/target sets (incl. the
   KAT `0→8e64e3d8…` and a near-target case exercising the second squeeze).
   Must pass before any perf tuning.
5. **Bench** — hashrate vs CPU and vs SRBMiner parity target; iterate
   `nonces_per_thread`, threadgroup size, `-D` unrolls.
6. **Stretch — DONE, measured:** lane-parallel `qpow_lane` in the same
   `.metal` file — 3 lanes × 4 felts per nonce (10 nonces/simdgroup32, mat4
   chunk-aligned per lane; `simd_shuffle` exchange via u32 pairs — u64 is not
   a valid simdgroup type). Golden test PASS (bit-exact vs CPU ref), but
   **4.35 vs 7.07 MH/s on M1 — scalar stays default**; lane kept as opt-in
   experiment `ZION_QPOW_METAL_IMPL=lane` (may still win on silicon with
   faster simdgroup exchange; the scalar kernel on M1 already has good
   occupancy so the ILP gain didn't materialize).

## Phase C — "Zion in SRBMiner" commercial track

Reality check: **SRBMiner is closed-source — we cannot integrate code into it.**
Commercial options, in order of feasibility:

1. **Sidecar bundle (shipped)** — desktop agent already runs SRBMiner-MULTI as
   the QTC engine with pool/wallet config + API telemetry merge. For commercial
   distribution: verify archive MD5 at install time, document the upstream
   devfee pass-through, ship `VERSION.txt`.
2. **Upstream algorithm deal** — doktor83 commercially integrates new
   algorithms on request. Candidates to offer: **Ekam Deeksha v3.2** (ZION
   native PoW — we own the spec + CPU ref + all three GPU kernels) and/or our
   **lane-parallel QPoW kernel IP** if it beats their 73 MH/s. Requires:
   frozen algorithm spec, test vectors, reference implementation, live pool.
3. **ZionSMR as our own commercial miner** — brand `zion-miner` with an
   SRBMiner-style feature set. **Shipped:** `--api-enable`/`--api-port`/
   `--api-rig-name` → SRBMiner-compatible HTTP JSON stats (`GET /` — same
   schema monitoring tools parse: rig_name, miner_version, gpu_devices,
   algorithms[] with pool/shares/hashrate per stream incl. per-GPU hashrates);
   `--list-algorithms` (30 algos incl. `qpow-poseidon2`); plus the existing
   sgminer/TRM TCP API (`ZION_API_ADDR`) for SMOS custom-miner slots.
   Remaining decisions: devfee plumbing + licensing model.

## Definition of done (Phase B)

1. `gpu-metal` build compiles the kernel; golden test passes on-device. ✅
2. `QpowGpuMiner::Metal` reachable via `ZION_GPU_BACKEND=metal` and `auto` on macOS. ✅
3. Sustained hashrate logged vs CPU baseline; no `MTLCommandBuffer` errors in
   a 10-min soak. ✅ — 22/0/0 Accepted shares live on qelvhash, 6.93 MH/s avg
4. Plan updated with measured numbers; SRBMiner sidecar remains the production
   default on Linux rigs. ✅
