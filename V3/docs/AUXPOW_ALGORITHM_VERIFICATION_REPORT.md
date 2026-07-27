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
