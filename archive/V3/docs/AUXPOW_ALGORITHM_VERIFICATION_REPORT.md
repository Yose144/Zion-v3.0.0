# AuXpow Algorithm Verification Report

**Date:** 2026-07-27  
**Scope:** Live pool share acceptance for every `ExternalCoin` supported by the Zion v3 AuxPoW profit router.  
**Goal ("full green all algos"):** Every listed coin can connect to its default pool and submit at least one `mining.submit` that the pool accepts.

## 1. RTM / GhostRider — VERIFIED

| Item | Detail |
|------|--------|
| Coin | RTM (Raptoreum) |
| Algorithm | GhostRider |
| Pool | `ghostrider.eu.mine.zpool.ca:5354` |
| Test binary | `AuXpow/src/bin/rtm_live_test.rs` |
| Feature flag | `--features native-ghostrider` |
| Fix summary | `V3/L1/native-ffi/csrc/ghostrider/real/gr.c` was using the buggy `yiimp-ghostrider` `getAlgoString` (reversed bytes, high-nibble-first, dropping the last algorithm) and was missing the post-CryptoNight `memset(&hash[8], 0, 32)`. Aligned with the Raptoreum daemon, `cpuminer-gr-avx2` and `xmrig`: low-nibble-first, forward byte order, last algorithm written, CN zeroing. |
| Submit format | `[worker, job_id, "00000000", ntime, nonce_be_8char]` |
| Result | `*** SHARE ACCEPTED! ***` after ~10 minutes of CPU mining on Edge. |
| Commits | `f30219e28` `fix(ghostrider): correct RTM gr_hash algorithm selection and CN zeroing`  <br>`bfbda0732` `docs(AGENTS): record RTM GhostRider fix and verification commands` |

## 2. Algorithm readiness matrix

Status legend:

* **Real / ready** — the CPU harness uses a correct implementation (pure-Rust or native C). May still need a live pool run to be marked *verified*.
* **Real / needs native feature** — correct code exists behind `native-hashers`, `native-randomx`, `native-verushash`, etc.
* **DAG missing** — the harness calls the hash function but does **not** build/provide the required DAG/light-cache, so the produced hash is invalid (KawPow returns zeroed mixes, Ethash falls back to a test-only light cache).
* **Placeholder / invalid** — the harness runs but computes a stand-in hash (usually BLAKE3) that no external pool will accept.
* **No CPU route** — `miner_harness.rs` has no `match` arm for this algorithm; it returns `Err` or falls into `other`.
* **GPU-only** — the CPU harness explicitly refuses and expects an OpenCL/CUDA/Metal kernel.

| Coin | Algorithm | CPU harness route | Implementation | Verified | Notes |
|------|-----------|-------------------|----------------|----------|-------|
| DCR | blake3 | `scan_dcr` | Real / ready | no | Pure-Rust BLAKE3, LE target comparison. |
| ALPH | blake3 | `scan_blake3_alph` | Real / ready | no | `blake3(blake3(nonce \|\| header_blob))` with 24-byte BE nonce. |
| KAS | kheavyhash | `scan_kheavyhash` | Real / ready | no | Pure-Rust cSHAKE256 + 64×64 nibble matrix. |
| ERG | autolykos | `scan_autolykos` | Real / needs `native-hashers` | no | C `autolykos_hash` regenerates the table per call; correct but slow. |
| RVN | kawpow | `scan_kawpow` | **DAG missing** | no | `hash_kawpow` → `hash_kawpow_native` returns **zeroed** mix/final without a DAG. |
| ETC | ethash | `scan_ethash` | **DAG missing** | no | `hash_ethash` uses no globally-registered DAG; falls back to a non-real light-cache evaluation. |
| EVR | evrprogpow | `scan_progpow` | Placeholder / invalid | no | `hash_progpow` pure-Rust fallback is simplified; native FFI stub returns `Err`. |
| MEWC | meowpow | `scan_progpow` | Placeholder / invalid | no | Same ProgPow fallback as EVR. |
| FLUX | zelhash | none | No CPU route | no | `external_hashers::hash_zelhash` exists, but `miner_harness.rs` does not route `zelhash`. |
| CLORE | kawpow | `scan_kawpow` | **DAG missing** | no | Same `hash_kawpow` zero-mix issue as RVN. |
| XMR | randomx | `scan_randomx` | Real / needs `native-randomx` | no | `zion_native_ffi::randomx` from tevador/RandomX C++. Slow on CPU but real. |
| VRSC | verushash | `scan_verushash` | Real / needs `native-verushash` | no | Two-stage Haraka+CLHash path in `zion_native_ffi::verushash`. |
| EPIC | progpow | `scan_progpow` | Placeholder / invalid | no | Simplified pure-Rust ProgPow; native FFI stub. |
| ZANO | progpow_zano | `scan_progpow` | Placeholder / invalid | no | Same as EPIC. |
| PRL | pearlhash | `scan_pearl` | Placeholder / invalid | no | BLAKE3 placeholder; real PoUW MatMul/noise proof not implemented. |
| QUAI | kawpow | `scan_kawpow` | **DAG missing** | no | Same DAG issue as RVN/CLORE. |
| BEAM | beamhash | none | No CPU route | no | `AuXpow/src/beamhash.rs` has a full BeamHash III solver, but it is not wired into `miner_harness.rs`. |
| KLS | karlsenhash | `scan(..., hash_blake3)` | Placeholder / invalid | no | Blake3 stand-in; needs real KarlsenHash (KHeavyHash variant with DAG). |
| ZCL | equihashzero | `scan(..., hash_blake3)` | Placeholder / invalid | no | Blake3 stand-in; needs Equihash 192,7 Wagner solver. |
| QTC | qhash | `scan_qhash` | Real / ready | no | Full Rust quantum-circuit simulation (16 qubits, 2 layers). Heavy but implemented. |
| VTC | verthash | none | No CPU route | no | No Rust or C implementation in `AuXpow/src`. |
| IRON | fishhash | none | No CPU route | no | No Rust or C implementation in `AuXpow/src`. |
| NEXA | nexapow | none | No CPU route | no | No Rust or C implementation in `AuXpow/src`. |
| RTM | ghostrider | `scan_ghostrider` | Real / needs `native-ghostrider` | **YES** | Verified live on zpool after `gr.c` fix. |
| DNX | dynexsolve | none | No CPU route | no | No Rust or C implementation in `AuXpow/src`. |
| CKB | eaglesong | GPU-only | No CPU route | no | `miner_harness` returns `Err("requires GPU mining")`. |
| CFX | octopus | GPU-only | No CPU route | no | `miner_harness` returns `Err("requires GPU mining")`. |
| ZEC | equihash | GPU-only | No CPU route | no | `miner_harness` returns `Err("requires GPU mining")`. |
| PHX | neoscrypt | GPU-only | No CPU route | no | `miner_harness` returns `Err("requires GPU mining")`. |
| KRX | keryxhash | none | No CPU route | no | `external_hashers::hash_keryxhash` is implemented, but `miner_harness.rs` has no `keryxhash` arm. Mainnet is PoM-only anyway. |

## 3. Gaps to "full green all algos"

### 3.1 Critical missing pieces (will never produce valid shares as-is)

1. **DAG management for KawPow / Ethash family**
   * RVN, CLORE, QUAI (`kawpow`) and ETC (`ethash`) need `generate_kawpow_dag` / `generate_ethash_dag` to be created once per epoch and passed into `hash_*_with_dag` inside `scan_kawpow` / `scan_ethash`.
   * Today `scan_kawpow` finds a "share" immediately because `hash_kawpow_native` returns all-zero hashes when no DAG is provided, which is invalid.

2. **Real ProgPow implementation**
   * EVR (`evrprogpow`), MEWC (`meowpow`), EPIC (`progpow`), ZANO (`progpow_zano`) need a real ProgPow/ProgPow variant implementation (or a working GPU kernel with mix-hash submission).
   * The current `hash_progpow` pure-Rust fallback and `hash_progpow_native` stub both produce invalid shares.

3. **Real Pearl PoUW**
   * PRL needs INT8 MatMul + noise + BLAKE3 proof extraction. Current CPU scan is a BLAKE3 placeholder.

4. **Real KarlsenHash / EquihashZero**
   * KLS and ZCL currently use `hash_blake3` as a placeholder.

### 3.2 Missing `miner_harness.rs` routes

The CPU harness does not dispatch these algorithms even though helper code (or partial implementations) exist elsewhere:

* `zelhash` (FLUX) — `hash_zelhash` + `mine_zelhash` are present in `external_hashers.rs`.
* `beamhash` (BEAM) — full `beamhash.rs` solver exists.
* `keryxhash` (KRX) — `hash_keryxhash` pure-Rust implementation exists.
* `verthash` (VTC), `fishhash` (IRON), `nexapow` (NEXA), `dynexsolve` (DNX) — no implementation at all.

### 3.3 GPU-only algorithms

These require OpenCL/CUDA/Metal kernels and are intentionally out of scope for the CPU harness:

* `eaglesong` (CKB)
* `octopus` (CFX)
* `equihash` (ZEC) — 200,9 parameters, different from the ZelHash 125,4 solver.
* `neoscrypt` (PHX)

### 3.4 Live verification still needed for "ready" algorithms

Even where the implementation is real, none of the following have been live pool-verified in this session:

* DCR, ALPH, KAS, QTC (pure-Rust CPU)
* ERG (Autolykos native, table-per-call)
* XMR (RandomX native)
* VRSC (VerusHash native)

## 4. Recommended next steps

1. **Fix DAG-based CPU mining in `miner_harness.rs` first** — it is the biggest blocker for four coins (RVN, CLORE, QUAI, ETC). Add per-epoch `KawpowDag` / `EthashDag` caches and call `hash_kawpow_with_dag` / `hash_ethash_with_dag`.
2. **Add missing `miner_harness.rs` match arms** for `zelhash`, `beamhash`, and `keryxhash` (where implementations already exist).
3. **Replace ProgPow and Pearl placeholders** with real algorithms or GPU-only dispatch.
4. **Implement or port** KarlsenHash, Equihash 192,7, Verthash, FishHash, NexaPow, DynexSolve, Eaglesong, Octopus, NeoScrypt.
5. **Run `examples/e2e_pool_test.rs` per coin** with the recommended feature set:
   ```bash
   cargo run --example e2e_pool_test --features \
     "native-hashers native-randomx native-verushash native-ghostrider gpu-opencl" \
     -- AUXPOW_E2E_RUN=1 AUXPOW_E2E_COIN=<coin> AUXPOW_E2E_SUBMIT=1 AUXPOW_E2E_USE_BEST=1
   ```
6. **For GPU coins**, enable `AUXPOW_E2E_GPU_OPENCL=1` and ensure the matching OpenCL kernel exists in `AuXpow/csrc/opencl/`.

## 5. Quick status

* **Verified live:** 1 / 30 (RTM)
* **Real implementation, not yet live:** 6+ (DCR, ALPH, KAS, ERG, XMR, VRSC, QTC)
* **Broken / needs DAG or native work:** 9+ (RVN, CLORE, QUAI, ETC, EVR, MEWC, EPIC, ZANO, PRL, KLS, ZCL)
* **No CPU support / not routed:** 11+ (FLUX, BEAM, VTC, IRON, NEXA, DNX, KRX, CKB, CFX, ZEC, PHX)

## 6. GPU CUDA debug-pool verification session (2026-07-27)

Hardware: local Windows rig, NVIDIA GeForce GTX 1070 Ti 8 GB (compute 6.1), driver 581.57.

### 6.1 Setup performed

1. Installed NVRTC redistributable (`nvidia-cuda-nvrtc-cu12`) to `C:\Zion\nvrtc_tmp` and added it to `PATH`.
2. Built `zion-miner` with CUDA external kernels:
   ```powershell
   cd V3
   cargo build --release -p zion-miner --features gpu-cuda
   ```
3. Generated test wallets and saved to the desktop:
   * `C:\Users\anaha\Desktop\zion_test_wallet.json` (ZION payout address for the miner `hello`)
   * `C:\Users\anaha\Desktop\etc_test_wallet.json` (ETC/EVM test wallet, not used because 2miners/zpool accept BTC payout)
4. Switched the Edge debug pool from `RTM` to `ETC`, then to `KAS`:
   ```bash
   ssh zion-new
   # /etc/systemd/system/zion-edge-debug-pool@<COIN>.service.d/coin.conf
   systemctl start zion-edge-debug-pool@<COIN>
   ```

### 6.2 `zion-miner --gpu-benchmark-all` results (CUDA, 5 s/algo)

| Algorithm | Nonces tested | Time | H/s (labelled KH/s) | Notes |
|-----------|--------------|------|---------------------|-------|
| `deeksha_chv3` | 282,624 | 5.03 s | 56,168 | ZION primary |
| `deeksha_lite_v1` | 167,936 | 5.19 s | 32,358 | ZION primary |
| `cosmic_harmony_ekam_deeksha_v2` | 8,192 | 141.04 s | 58 | very slow; likely initialization heavy |
| `deeksha_lite_fire` | 20,480 | 5.30 s | 3,864 | ZION primary |
| `blake3` | 11,075,584 | 5.00 s | 2,215,117 | ALPH/DCR |
| `kheavyhash` | 35,078,144 | 5.00 s | 7,014,610 | KAS |
| `autolykos` | 16,384 | 5.29 s | 3,097 | ERG |
| `zelhash` | 48,054,272 | 5.00 s | 9,610,559 | FLUX |
| `kawpow` | 39,911,424 | 5.00 s | 7,981,643 | RVN/CLORE/QUAI |
| `ethash` | 41,902,080 | 5.00 s | 8,333,090 | ETC |
| `progpow` | 11,812,864 | 5.00 s | 2,362,551 | EPIC/ZANO |

All CUDA kernels compiled and ran against the synthetic easy target (`00000000ffff...`). The numbers are raw nonces/sec, not actual accepted shares.

### 6.3 Live debug-pool runs

#### ETC (`ethash`) — DAG generation fixed, kernel updated, live share pending

* Pool: `etc.2miners.com:1010` via Edge debug pool, authorized with the repo `DEFAULT_BTC_WALLET` (`bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh`) + `c=BTC`.
* `cuda_external.rs` `ensure_dag()` now launches `ethash_calculate_dag` in 524,288-node batches and synchronizes every 4 batches instead of after each 8,192-node batch. Epoch-0 DAG generation (~1 GB) completes in ~7 s on a GTX 1070 Ti, so real epochs should finish in minutes rather than hours.
* The `ethash_mine` CUDA kernel in `AuXpow/csrc/cuda/ethash_kernel.cu` was corrected to use Ethash's original FNV-1 (`(a * PRIME) ^ b`) and the proper index formula `fnv(i ^ seed0, mix[i % 32])`; it previously used FNV-1a and `mix[0]` for both arguments, which does not match the Ethash spec.
* `gpu_backend.rs` now routes the 32-byte `header_hash` directly to `mine_batch_raw` for DAG-based algorithms (`ethash`, `kawpow`, `progpow`, `evrprogpow`, `meowpow`) instead of reparsing it into an 80-byte `MiningHeader`.
* Local `--profile benchmark --algorithm ethash` reaches `ext_gpu_dag_ready` and finds a nonce. CPU reference is still a stub, so `GPU_CPU_MISMATCH` is expected; a live debug-pool share is the next validation step.

#### KAS (`kheavyhash`) — benchmark fixed, live share still pending

* Pool: `kas.2miners.com:2020` via Edge debug pool, BTC wallet.
* The benchmark vector (`version=3`, `previous_hash=[0x11;32]`, `timestamp=1_762_000_200`, nonce `4682`) now matches between the CUDA kernel and the CPU reference (`1cff8de2...914a93e`).
* A 120 s debug-pool run connected and submitted external `kheavyhash` jobs, but the `GPU PROFIT` row remained `0/0`; only primary ZION shares were accepted. The slow throughput (~3.3 MH/s on a GTX 1070 Ti) and the debug pool's use of the real upstream target make a 120 s window inconclusive.
* Next: a longer debug-pool run or a lower-difficulty test target to confirm an accepted KAS share.

#### ERG (`autolykos`) — table cache fixed, share format fixed, but upstream rejects hashes

* Pool: `erg.2miners.com:8888` via Edge debug pool, BTC wallet.
* `cuda_external.rs` now caches the Autolykos table per `(header, height)` and uses the 32-byte pre-pow hash and the block height for table generation (previously it used the full 80-byte `MiningHeader` and `header.timestamp` as a height).
* `auxpow_client.rs` now sends the correct 2miners `mining.submit` `[worker, job_id, nonce2]` where `nonce2` is the lower 6 bytes of the full 64-bit nonce in big-endian hex (previously it sent the upper 6 bytes, duplicating `en1`).
* The Edge `zion-pool` (`server`) binary and `pool/Cargo.toml` were rebuilt to add the `tracing-subscriber/env-filter` feature, and the debug pool service was restarted.
* After the fixes, the debug pool forwards ERG `mining.submit` calls to `erg.2miners.com` successfully; the pool now returns `[23,"Low difficulty share"]` or `[21,"Job not found"]` rather than rejecting the message format.
* Root cause of the remaining rejection: the `autolykos_mine` CUDA kernel in `AuXpow/csrc/cuda/autolykos_kernel.cu` is a simplified placeholder. It does a 9-iteration table walk and a single BLAKE2b-256 of `header || r || nonce`, which is **not** the real Autolykos v2 algorithm used by Ergo (permutation indices derived from `f31`, 32 table lookups summed, final BLAKE2b over the 32-byte sum). All computed hashes therefore fail upstream validation.

### 6.4 Additional blockers discovered

1. **Autolykos table cache fixed, but kernel invalid:** `cuda_external.rs` `ensure_autolykos_table()` now caches the table per `(header, height)` and uses the 32-byte pre-pow hash and the real block height. The remaining ERG blocker is that the `autolykos_mine` CUDA kernel is a simplified placeholder and does not implement the real Autolykos v2 algorithm.
2. **ProgPow variants not routed in CUDA external miner:** `CudaExtAlgo::from_name()` now matches `evrprogpow` / `meowpow` and routes them to the ProgPow kernel with a 12000-block epoch. Live GPU test still pending.
3. **Wallet generation:** For coins not on 2miners/zpool BTC payout (e.g. `DCR`, `ALPH`, `FLUX`, `VTC`, `IRON`, `NEXA`, `DNX`, `KRX`, `CKB`, `CFX`, `ZEC`, `PHX`) a coin-specific payout address is required. The repo already contains `DEFAULT_BTC_WALLET` for the BTC-payout coins.

### 6.5 GPU algorithm status — what works / what does not

| Coin | CUDA path | Status | Blocker / next step |
|------|-----------|--------|---------------------|
| KAS | `kheavyhash` | **benchmark fixed** | Live share pending (long debug-pool run needed; ~3.3 MH/s on GTX 1070 Ti). GPU and CPU hashes now match for the benchmark header. |
| ERG | `autolykos` | **not working** | `autolykos_mine` CUDA kernel and `native-ffi` C implementation are simplified 9-iteration placeholders. Real Autolykos v2 requires 32 permutation indices, 32 table lookups summed, and a final BLAKE2b over the 32-byte sum. |
| ETC | `ethash` | **DAG generation fixed, kernel updated** | Epoch-0 benchmark reaches `ext_gpu_dag_ready` and finds a nonce in ~7 s. FNV-1 and index formula fixed. Live share pending; CPU `hash_ethash` reference is still a stub. |
| RVN/CLORE/QUAI | `kawpow` | **not tested** | DAG-generation bottleneck fixed; header routing fixed. Kernel correctness still unverified. |
| EVR/MEWC | `evrprogpow`/`meowpow` | **routed, not tested** | `CudaExtAlgo` recognises names and uses 12000-block epochs/periods; header routing fixed. Real DAG size formula may differ and DAG build is pending. |
| FLUX | `zelhash` | **not tested** | Equihash solver; no known test vector; no live test. |
| EPIC/ZANO | `progpow` | **not tested** | DAG + per-period kernel recompilation; no live test. |
| BEAM/VTC/IRON/NEXA/DNX/KRX/CKB/CFX/ZEC/PHX | various | **not tested** | Missing CUDA kernel, missing coin-specific wallet, or missing stratum support. |

### 6.6 Next-step options

**Option A — Fix/optimize the CUDA kernels and re-test**
* Speed up `ethash_calculate_dag` (larger batches, streams, kernel tuning) and possibly generate the DAG once per epoch on the host.
* Cache the Autolykos table per header. **Done.**
* Replace the `autolykos_mine` CUDA kernel with a real Autolykos v2 implementation.
* Add `evrprogpow` / `meowpow` to `CudaExtAlgo::from_name()`.
* Add known-answer tests for `kheavyhash`, `kawpow`, `ethash`, `autolykos` against reference implementations.

**Option B — Use reference miners through the debug pool for quick verification**
* Download/install a multi-algo reference miner (e.g. `gminer`, `nbminer`, `lolMiner`, `t-rex`) that the `2miners` batch files expect.
* Point the reference miner at `62.171.141.136:8461` for each debug-pool coin.
* This validates the debug pool / share-forwarder side independently of the `zion-miner` kernels.

**Option C — Parallel path**
* Do Option B now to get first live accepted GPU shares and confirm the end-to-end pipeline.
* Do Option A in a follow-up to replace reference miners with the native `zion-miner` CUDA path.

## 7. Current session updates (2026-07-27)

### 7.1 EVR/MEWC CUDA routing fixed

* `CudaExtAlgo::from_name()` in `V3/L1/miner/src/cuda_external.rs` now maps `evrprogpow` / `evrprogpow_evr` / `meowpow` / `meowpow_mewc` to `CudaExtAlgo::Progpow`.
* Added `progpow_params()`, `dag_epoch_length()`, and `progpow_period()` helpers to `CudaExternalMiner` so ProgPow variants use coin-specific epoch/period parameters instead of the `Progpow` defaults.
* `CoinProfile::epoch_length()` in `AuXpow/src/auxpow_client.rs` now returns `12000` for `EVR`/`MEWC` instead of the KawPow `7500` default.

### 7.2 KAS `kheavyhash` long test

* Restarted `zion-miner` with the new binary, pointed at the KAS debug pool (`62.171.141.136:8461`), using the corrected `kheavyhash` CUDA kernel and the timestamp-in-`MiningHeader` fix from the previous session.
* Current rate: ~3.3 MH/s on `NVIDIA GeForce GTX 1070 Ti`. At KAS diff 1, expected share time ~20 min; a 20-minute test is running.
* The `ext_gpu_batch_done` stdout logs are suppressed because the process is not on a TTY; `session_status` is written to stderr.

### 7.3 Reference miner (GMiner) attempt

* GMiner v3.44 (`miner.exe --algo kheavyhash`) connects to the KAS debug pool but the session must use a valid `zion1...` wallet (the local ZION pool validates the Stratum `mining.authorize` username as a ZION address).
* GMiner terminates after 6 seconds, most likely because it expects a different `mining.notify` format than the one the debug pool forwards from 2miners (`[job_id, [4xu64], timestamp]`). Therefore GMiner is not a usable reference for KAS through this debug pool.

### 7.5 KAS `kheavyhash` GPU/CPU mismatch fixed (2026-07-27)

* Root cause was **not** the CUDA kernel itself. The `kheavyhash` CUDA kernel produced the same hashes as `zion_auxpow::hash_kheavyhash` once it was given the same inputs.
* Two input-divergence bugs were fixed:
  1. `BlockCandidate::hash_with_algorithm()` in `V3/L1/core/src/lib.rs` was using `self.height` as the KAS timestamp instead of the `MiningHeader.timestamp` slot. It now uses `header.timestamp`, with a fallback to `self.height` when `header.timestamp` is 0 (pool-mode KAS jobs encode the timestamp in `job.height` because the header_hex is only the 32-byte pre_pow_hash).
  2. `gpu_scan_job()` / `gpu_scan_async()` in `V3/L1/miner/src/gpu_backend.rs` was unconditionally overwriting `effective_header.timestamp` with `job.height` for all external algorithms. This broke benchmark mode, where `job.height` is 0 and the correct timestamp lives in `job.header.timestamp`. The overwrite is now conditional: for `kheavyhash` the timestamp is taken from `job.header.timestamp` if it is non-zero, otherwise from `job.height`.
* `assignment_to_candidate()` in `V3/L1/pool/src/bin/server.rs` now copies the external KAS timestamp into `MiningHeader.timestamp` so pool-side CPU validation hashes the same inputs as the GPU.
* `generate_kheavy_matrix_cuda()` in `V3/L1/miner/src/cuda_external.rs` now delegates to `zion_auxpow::kheavyhash_matrix_flat()` so the GPU matrix is identical to the CPU matrix.
* Added a known-answer test `kheavyhash_benchmark_vector` in `AuXpow/src/external_hashers.rs` for nonce `4682` with the benchmark header:
  * `version=3`, `previous_hash=[0x11;32]`, `timestamp=1_762_000_200` → `1cff8de2f856c9a5c7970f35cb2642496bff0b5be2a42c61e3ca4a657914a93e`
* Local CUDA benchmark (`--profile benchmark --algorithm kheavyhash`) now runs without `GPU_CPU_MISMATCH` and the found nonce/hash matches the CPU reference.

### 7.4 Remaining blockers

* **KAS:** CUDA benchmark is fixed, but a live pool share still needs to be accepted to confirm end-to-end correctness.
* **EVR/MEWC:** code routing and epoch length are fixed, but the ProgPow DAG for a real EVR/MEWC epoch will likely take too long on this GTX 1070 Ti (8 GB) and may also use a coin-specific DAG-size formula not yet implemented.
* **ETC/RVN/CLORE/QUAI:** CUDA DAG generation is now parallel and fast enough for real epochs; `ethash` kernel FNV/index corrected and header routing fixed. Live shares and CPU reference verification still pending.
* **ERG:** blocked by the placeholder `autolykos_mine` CUDA kernel.
* **zion-pool default build:** `zion-native-ffi` `ghostrider/real/gr.c` currently fails to compile on MSVC due to a variable-length array (`bool selectedAlgo[algoCount]`), unrelated to this session's changes.

### 7.5 Ethash/CUDA fixes (this session)

* `V3/L1/miner/src/cuda_external.rs`: `ensure_dag()` now launches `ethash_calculate_dag` in 524,288-node batches and synchronizes every 4 batches, reducing epoch-0 DAG build time from an extrapolated ~3 h to ~7 s.
* `AuXpow/csrc/cuda/ethash_kernel.cu`: corrected FNV to FNV-1 (`(a * PRIME) ^ b`) and index formula to `fnv(i ^ seed0, mix[i % 32])` (was FNV-1a with `mix[0]` for both arguments).
* `V3/L1/miner/src/gpu_backend.rs`: DAG-based external algorithms (`ethash`, `kawpow`, `progpow`, `evrprogpow`, `meowpow`) now pass the 32-byte `header_hash` directly to `mine_batch_raw` instead of reparsing it into an 80-byte `MiningHeader`.

## 8. CUDA kernel verification sweep (2026-07-27)

Hardware: local Windows rig, NVIDIA GeForce GTX 1070 Ti 8 GB (compute 6.1), driver 581.57.
Command:
```powershell
$env:ZION_GPU_WORK_SIZE = '8192'
$env:ZION_BENCH_SECS    = '3'
V3\target\release\zion-miner.exe --test-cuda-kernel <algo>
```
For `ethash` a longer run with the default `work_size=262144` and `bench_secs=5` was also performed to obtain a representative hashrate and confirm the CPU/GPU match.

### 8.1 Verification matrix

| Algorithm | Coin(s) | CUDA status | H/s (GTX 1070 Ti) | CPU/GPU match | Notes |
|-----------|---------|-------------|-------------------|---------------|-------|
| `kheavyhash` | KAS | PASS | 22,013,777 | ⚠️ not checked in this sweep | Kernel compiles, benchmarks, produces nonces against easy target. Correctness already verified for benchmark vector (`1cff8de2...914a93e`) in §7.5. |
| `blake3_alph` | ALPH | PASS | 55,795,375 | ⚠️ not checked | BLAKE3 variant for Alephium. Kernel compiles and runs. |
| `blake3_dcr` | DCR | PASS | 52,513,398 | ⚠️ not checked | BLAKE3 variant for Decred. Kernel compiles and runs. |
| `autolykos` | ERG | PASS | 30,675,272 | ⚠️ not checked | Kernel compiles and runs against easy target. **Kernel still needs full Autolykos v2 correctness validation** (see §6.3/6.4). |
| `zelhash` | FLUX | PASS | 50,772,519 | ⚠️ not checked | Equihash 125,4 solver compiles and runs. No CPU reference. |
| `ethash` | ETC | PASS | **117,585,952** (default work_size) | ✅ `ETHASH_CPU_GPU_MATCH` | CPU reference switched to canonical `ethash` 0.4 crate; CUDA kernel hash matches CPU byte-for-byte. |
| `kawpow` | RVN/CLORE/QUAI | PASS | 45,073,110 | ⚠️ not checked | Kernel compiles and runs. DAG generation parallel. Live share / CPU reference still pending. |
| `progpow` | EPIC/ZANO | PASS | 6,004,499 | ⚠️ not checked | Kernel compiles, period-0 DAG + recompilation OK. No CPU comparison. |
| `evrprogpow` | EVR | PASS | 6,157,093 | ⚠️ not checked | 12000-block epoch routed correctly. No CPU comparison. |
| `meowpow` | MEWC | PASS | 5,960,545 | ⚠️ not checked | 12000-block epoch routed correctly. No CPU comparison. |
| `verushash` | VRSC | PASS (with `native-verushash`) | 484,539 | ⚠️ not checked | Builds and runs with `--features "gpu-cuda,native-verushash"` on GTX 1070 Ti. The `verus_mine` CUDA kernel requires `verushash_get_gpu_keydata()` key precomputation; CPU/GPU hash match is non-trivial (15-byte nonceSpace vs 8-byte appended nonce) and not yet verified. VRSC remains CPU-only for normal mining. |

### 8.2 Canonical overview: what is verified / what is not

* ✅ **CUDA compile/run** — 10 of 10 GPU-relevant algorithms compile with NVRTC (arch `compute_61`) and complete a 3 s benchmark against the synthetic easy target. `verushash` is intentionally CPU-only for VRSC in normal mode, but also compiles/runs with `--features native-verushash`.
* ✅ **ETC/Ethash CPU/GPU match** — fixed by removing the `native-hashers` shortcut in `AuXpow/src/external_hashers.rs::hash_ethash` and `hash_ethash_with_dag`; both now use the canonical `ethash` 0.4 crate (`hashimoto_light` / `hashimoto_full`). `zion-miner --test-cuda-kernel ethash` reports `ETHASH_CPU_GPU_MATCH` and ~117 MH/s on the test rig.
* ⚠️ **Live accepted upstream shares** — still pending for all CUDA algorithms except the ETC CPU/GPU correctness check. The benchmark only proves the kernel compiles and hashes against an easy target.
* ⚠️ **CPU reference for DAG-based non-Ethash algorithms** — KawPow, ProgPow variants and Autolykos still need CPU/GPU hash comparison or a known-answer test.
* ✅ **VerusHash/VRSC** — CPU-only path is live and accepted; CUDA `verushash` kernel is not required for 3.0.7.
* ⚠️ **FLUX/ZelHash** — deprecated (FLUX moved to PoUW v2), but the `zelhash` CUDA kernel compiles and runs.

### 8.3 Code changes this sweep

* `AuXpow/src/external_hashers.rs`
  * `hash_ethash()` and `hash_ethash_with_dag()` now always use the `ethash` 0.4 reference crate instead of `zion-native-ffi` C paths when `native-hashers` is enabled. This removes a CPU/GPU mismatch source for ETC.
* `V3/L1/miner/src/main.rs` (no change required)
  * Existing `--test-cuda-kernel ethash` CPU/GGPU comparison path now produces `ETHASH_CPU_GPU_MATCH` after the `hash_ethash` fix.

### 8.4 Remaining next steps

1. Add CPU/GPU comparison to `--test-cuda-kernel` for `kawpow` (use `ethash_final_hash` with GPU `mix_hash`) and `progpow`/`evrprogpow`/`meowpow` (use `progpow_final_hash` with GPU `mix_hash`).
2. ✅ Build and test `verushash` CUDA with `--features "gpu-cuda native-verushash"` — kernel compiles/runs at ~484 kH/s on GTX 1070 Ti. CPU/GPU hash match remains non-trivial and is not required for 3.0.7.
3. Replace the placeholder `autolykos_mine` CUDA kernel with real Autolykos v2 and run a CPU/GPU comparison.
4. Run live upstream debug-pool tests for at least one coin per algorithm to confirm `mining.submit` acceptance.

## 9. GPU share verification commands (this session, 2026-07-27)

Added CPU/GPU share verification to the existing `--test-cuda-kernel` and new `--test-opencl-kernel` commands in `zion-miner`.

### 9.1 Commands used

CUDA:
```powershell
$env:PATH = "C:\Users\anaha\AppData\Local\Temp\cuda_nvrtc_x\cuda_nvrtc-windows-x86_64-12.4.127-archive\bin;" + $env:PATH
$env:ZION_GPU_WORK_SIZE = "65536"
cargo run --manifest-path V3/Cargo.toml -p zion-miner --bin zion-miner --features gpu-cuda -- --test-cuda-kernel <algo>
```

OpenCL:
```powershell
$env:ZION_GPU_WORK_SIZE = "65536"
cargo run --manifest-path V3/Cargo.toml -p zion-miner --bin zion-miner --features gpu-opencl -- --test-opencl-kernel <algo>
```

### 9.2 Results

| Backend | Algorithm | Status | CPU/GPU match | Notes |
|---------|-----------|--------|---------------|-------|
| CUDA | `ethash` | PASS | ✅ `ETHASH_CPU_GPU_MATCH` | Already verified in §8; full 32-byte GPU hash matches canonical `ethash` 0.4 crate. |
| CUDA | `kheavyhash` | PASS | ✅ `KHEAVYHASH_CPU_GPU_MATCH` | GPU share matches pure-Rust `hash_kheavyhash` reference. |
| CUDA | `blake3` | PASS | ✅ `BLAKE3_ALPH_CPU_GPU_MATCH` | Maps to `blake3_alph` (`hash_blake3_alph` CPU reference). |
| CUDA | `blake3_dcr` | PASS | ✅ `BLAKE3_DCR_CPU_GPU_MATCH` | Matches `hash_blake3_dcr` CPU reference. |
| CUDA | `kawpow` | PASS (benchmark) | ❌ `KAWPOW_CPU_GPU_MISMATCH` | Kernel runs (~442 MH/s) but the GPU `output_hash` does not equal `ethash_final_hash(header, nonce, output_mix)`. The Keccak domain separator in `kawpow_kernel.cu` was corrected from SHA3 `0x06` to original Keccak `0x01` (matching `ethash_kernel.cu` and `kawpow_native.c`); mismatch persists, indicating a deeper kernel/output consistency issue. |
| CUDA | `progpow` | PASS (benchmark) | ❌ `PROGPOW_CPU_GPU_MISMATCH` | `progpow_kernel.cu` does **not** write `output_hash`; it only writes `output_mix` and the 64-bit pre-check `g_output`. `cuda_verify_share` therefore compares a stale/zeroed `output_hash` against `progpow_final_hash`. |
| OpenCL | `blake3` | PASS | ✅ `BLAKE3_ALPH_OPENCL_CPU_GPU_MATCH` | NVIDIA OpenCL on GTX 1070 Ti; share matches `hash_blake3_alph`. |
| OpenCL | `kheavyhash` | PASS | ✅ `KHEAVYHASH_OPENCL_CPU_GPU_MATCH` | Share matches `hash_kheavyhash`. |

### 9.3 Code changes

* `V3/L1/miner/src/main.rs` — added `--test-opencl-kernel <algo>` CLI path and `opencl_verify_setup` CPU reference map (blake3/blake3_dcr/kheavyhash/zelhash/ethash/kawpow/progpow variants).
* `V3/L1/miner/src/cuda_external.rs` `cuda_verify_share` — returns the CPU/GPU verification label together with the benchmark result.
* `AuXpow/csrc/cuda/kawpow_kernel.cu` — changed Keccak domain separator from `0x06` (SHA3) to `0x01` (original Keccak/Ethereum) in both `keccak512` and `keccak256` to match `ethash_kernel.cu` and the C `kawpow_native.c` reference.
* `AuXpow/src/external_hashers.rs` — added `ethash_final_hash_agrees_with_hash_ethash` test confirming the `ethash_final_hash` helper used for KawPow/ProgPow verification produces the same final hash as the canonical `ethash` 0.4 crate.

### 9.4 Blockers / next steps

1. **KawPow CUDA CPU/GPU mismatch** — `ethash_final_hash` is correct (verified against `ethash` crate), but the `kawpow_mine` kernel's `output_hash` is not `keccak256(seed || output_mix)` for the reported nonce. Needs kernel audit (possible race in `output_mix`/`output_hash` write, or the kernel is using a different `seed`/`mix` path than expected).
2. **ProgPow CUDA `output_hash` missing** — `progpow_kernel.cu` only writes `output_mix` and the 64-bit target pre-check. For share verification the kernel must either (a) write the 64-bit `final_hash` into `output_hash` and compare against `progpow_final_hash`'s top 64 bits, or (b) the Rust side must read the `g_output` debug value and compare it to the CPU reference.
3. **OpenCL** — only `blake3` and `kheavyhash` verified so far. Extend to `zelhash`, `ethash`, `kawpow`, and ProgPow variants once the CUDA-side CPU references are stable.
4. **Live pool acceptance** remains the ultimate verification step for all GPU algorithms.
