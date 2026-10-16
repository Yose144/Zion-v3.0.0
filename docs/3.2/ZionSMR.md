# ZionSMR — QPoW Metal Kernel + SRBMiner Commercial Track

**Created:** 2026-10-10 · **Status:** Phase A+B done ✅ (live-validated), Phase C in progress

## Context

- **QPoW (Quantus / QTU-QTC)** = Poseidon2 sponge (12×u64 Goldilocks state) squeezed
  twice → 64-byte hash compared strictly `<` a 64-byte target. Pure-ALU algorithm — no DAG,
  no scratchpad, tiny buffers. Ideal fit for Apple Metal (unified memory is a
  non-issue here, unlike the memory-hard Ekam Deeksha).
- Existing implementations in `V31/L1/miner`:
  - CPU reference `src/auxpow/qpow.rs` — bit-exact vs upstream `pow-core` (KAT-verified).
  - OpenCL `src/gpu/qpow_opencl.rs` + `csrc/opencl/poseidon2_kernel.cl` — verified
    AMD ISA path (`QPOW_GCN_NATIVE`, auto-gated): **82.07 MH/s on gfx1010
    (RX 5600 XT), 103.125 MH/s on gfx900 (RX Vega 64)** — frozen local
    benchmark 2026-10-11 (batch 4 194 304, local 64, NPT 1, 128 iters,
    16 discarded, 112 steady samples/device); not deployed, parity pending —
    see the AMD ISA section below.
  - CUDA `src/gpu/qpow_cuda.rs` + `csrc/cuda/poseidon2_kernel.cu`.
- **SRBMiner-MULTI** (doktor83): closed-source, **Win64 + Linux only — no macOS
  build exists**. Supports `--algorithm quantus`. Historical ~73 MH/s on
  gfx1010 (2026-10-10); current measured reference on matched hardware is
  ~105 MH/s (gfx1010) / ~137 MH/s (gfx900) — a comparison reference, not a
  current pool measurement of our rigs. Already integrated in the desktop
  agent as an opt-in sidecar (`qtcEngine: "srbminer"`, pool `eu.lproute.com:5660`).
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
   **lane-parallel QPoW kernel IP** if it beats their measured current
   reference on matched hardware. Requires:
   frozen algorithm spec, test vectors, reference implementation, live pool.
3. **ZionSMR as our own commercial miner** — brand `zion-miner` with an
   SRBMiner-style feature set. **Shipped:** `--api-enable`/`--api-port`/
   `--api-rig-name` → SRBMiner-compatible HTTP JSON stats (`GET /` — same
   schema monitoring tools parse: rig_name, miner_version, gpu_devices,
   algorithms[] with pool/shares/hashrate per stream incl. per-GPU hashrates);
   `--list-algorithms` (30 algos incl. `qpow-poseidon2`); plus the existing
   sgminer/TRM TCP API (`ZION_API_ADDR`) for SMOS custom-miner slots.
   Agent-side hardening: bundled SRBMiner binary SHA-256 is verified against
   `VERSION.txt` before every spawn (bundled mismatch → refuse, custom
   operator path → warn only). Unit coverage: `srbminer_json` schema test
   (all SRBMiner fields asserted per-stream), `srbminer_api_http_roundtrip`
   (GET / + /stats → 200 JSON, unknown → 404), `srb_vendor` mapping —
   `cargo test --bin zion-miner` 3/3.
   **Devfee plumbing shipped** (user decided: SRBMiner-style reconnect,
   QTU stream only, 1%): `src/devfee.rs` — every `ZION_DEVFEE_PERIOD_SEC`
   (default 7200) the QTU auxpow stream reconnects under
   `ZION_DEVFEE_WALLET` for pct% of the period (72 s @ 1%), window at
   period end; wallet baked at build time via `option_env!` for commercial
   dist, runtime env overrides. `StratumClient::shutdown()` added —
   swapping the client now kills the old reconnect loop (also fixes a
   pre-existing zombie-session leak on url change). Applies to
   `ExternalCoin::Quantus` on `StreamId::GpuExternal` in direct-auxpow
   mode only — V3-Trinity QTU comes through our pool bridge where
   miner-side devfee can't reach upstream attribution.
   **Dual mining shipped** (SRBMiner-style CLI): `--algorithm/--pool/
   --wallet/--password` bind to the primary algo (GPU-class → Stream 2,
   CPU-class → Stream 3); `--dual-algorithm/--dual-pool/--dual-wallet/
   --dual-password` bind the second algo (GPU → **Stream 4, now wired in
   direct-auxpow mode** with its own `gpu_client2` StratumClient +
   `ZION_STREAM4_{URL,FORCE_COIN,WALLET,PASSWORD}` config/env surface);
   `--gpu-dual-intensity` → stream4 GPU-time share;
   `--disable-cpu/--disable-gpu/--cpu-threads` aliases; `--zion` +
   `--zion-wallet` to keep stream1 alive in SRBMiner mode (off by
   default). Per-stream wallets/passwords via
   `ZION_STREAM{2,3,4}_{WALLET,PASSWORD}`; the SRBMiner API reports each
   algo's own wallet and resolves forced coins to algo/ticker before the
   first job. Verified: `kaspa+quantus` → 2 GPU workers each with own
   pool+wallet; `quantus+verushash` → GPU+CPU split.
   **Public-build surface** (`public_build` feature):
   - HW autotune runs in every build (`auto_tune_work_sizes` feeds
     work sizes/threads; plan banner prints a Multi-GPU line when
     >1 card detected, `AutoTuneResult.gpu_count`).
   - Multi-GPU: `ZION_ZANO_RESERVE` default flips to 0 — every card
     mines by default. QPoW CUDA fans out to `QpowGpuMiner::multi`
     (one miner per `CudaDevice::new(i)`, only when no shared
     Stream-1 context exists); QPoW OpenCL already had multi via
     `ZION_QPOW_OCL_DEVICES`; ext algos use `MultiGpuMiner`.
   - `--gpu-id` (SRBMiner-compatible) / `ZION_GPU_DEVICES` = GLOBAL
     device cap honored by ZION, QPoW (Metal too — system default =
     index 0) and ext streams. Numeric items match indices only;
     non-numeric items match name/class substrings (`vega`,
     `gfx1010`, `5600xt`).
   - CPU external stream (VRSC/BOOST) hidden by default —
     `stream3_enabled=false` in `derive_auto_config`; opt back in
     via `ZION_STREAM3_ENABLED=1` or `--enable-cpu-stream`.
   Remaining decision: licensing model.

## Definition of done (Phase B)

1. `gpu-metal` build compiles the kernel; golden test passes on-device. ✅
2. `QpowGpuMiner::Metal` reachable via `ZION_GPU_BACKEND=metal` and `auto` on macOS. ✅
3. Sustained hashrate logged vs CPU baseline; no `MTLCommandBuffer` errors in
   a 10-min soak. ✅ — 22/0/0 Accepted shares live on qelvhash, 6.93 MH/s avg
4. Plan updated with measured numbers; SRBMiner sidecar remains the production
   default on Linux rigs. ✅

## AMD ISA OpenCL status (2026-10-11)

The OpenCL kernel source now includes a verified `QPOW_GCN_NATIVE` branch — 8 native
arithmetic helpers (schoolbook partial products + carry trees), a
7-instruction carry-only `reduce128`, and fused `mul128_add_wide` inside
`int_round_p`. Lazy reduction semantics, round constants, nonce/target/result
ABI and CPU candidate re-verification are unchanged; portable multiplication
stays `a*b` + `mul_hi`. Host auto-selection is limited to the
`AMD Accelerated Parallel Processing` platform with `gfx1010` (wave32) or
`gfx900` (wave64); `ZION_QPOW_OCL_NATIVE=0` forces portable; a native compile
failure retries portable, a portable failure propagates; a successful
`ZION_QPOW_OCL_SRC` override suppresses the automatic injection.

Frozen final local benchmark: **82.07 MH/s (gfx1010), 103.125 MH/s (gfx900)** —
batch 4 194 304, local 64, NPT 1, 128 iterations, first 16 discarded, 112
steady samples per device. Not pool-share sustained throughput; earlier
SRBMiner references ~105/137 MH/s remain unmet — parity pending. The code is
**verified but not deployed** into production binaries or agent/engine/OC
configuration.

Verification: `cargo test --release --locked -p zion-miner --features
gpu-opencl --lib -- --test-threads=1` → 157 passed / 0 failed / 11 ignored;
on-device gates on both cards (native + forced-portable): 68 162
edge/random pairs × 14 arithmetic outputs, 4 096 first-squeeze nonces vs CPU,
golden ±1 + nonce-boundary. Strict clippy `-D warnings` is blocked by 87
pre-existing diagnostics outside `qpow_opencl.rs`. Reproduction commands are
in `QPOW.md` § AMD ISA.
