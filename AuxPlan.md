# AuxPow Multi-Algorithm GPU Mining — Complete Report & Plan

> **Status:** 2026-07-13 | DCR Blake3 E2E verified (share accepted by WoolyPooly)
> **Author:** Devin + Yose | **Repo:** `Zion-v3.0.0`

---

## 1. Executive Summary

ZION AuxPow B2b bridge umožňuje pool-side merge mining external coinů
(DCR, KAS, ALPH, ERG, RVN, ETC, …) přes GPU kernely. Pool přijímá
joby z external poolů, přeposílá je minerům jako `external_job`,
miner hasheje GPU kernelem, a pool forwarduje share zpět do
external poolu.

**DCR Blake3 je plně funkční E2E** — share accepted WoolyPooly
(2026-07-13, nonce=388, hash=001f350a9fd731c9).

---

## 2. Current State — Co funguje, co chybí

### 2.1 Per-Coin Status Matrix

| Coin | Algo | GPU Kernel | CPU Hash | Pool Submit | E2E Test | Status |
|------|------|-----------|----------|-------------|----------|--------|
| **DCR** | Blake3 | `blake3_dcr_mine` | `hash_blake3` | 5-param Stratum v1 | **ACCEPTED** | **DONE** |
| **ALPH** | Blake3 (double) | `blake3_alph_mine` | `hash_blake3_alph` | JSON object | Unit test | **READY** |
| **KAS** | kHeavyHash | `kheavyhash_mine` | `hash_kheavyhash` | 3-param Stratum v1 | Unit test | **READY** |
| **ERG** | Autolykos v2 | `autolykos_mine` | `hash_autolykos` + FFI | `eth_submitWork` | Unit test | **PARTIAL** |
| **RVN** | KawPow | `kawpow_mine` | FFI w/ DAG | `eth_submitWork` | — | **PARTIAL** |
| **ETC** | Etchash | `ethash_mine` | FFI w/ DAG | `eth_submitWork` | — | **PARTIAL** |
| **EVR** | KawPow | `kawpow_mine` | FFI w/ DAG | `eth_submitWork` | — | **PARTIAL** |
| **MEWC** | KawPow | `kawpow_mine` | FFI w/ DAG | `eth_submitWork` | — | **PARTIAL** |
| **CLORE** | KawPow | `kawpow_mine` | FFI w/ DAG | `eth_submitWork` | — | **PARTIAL** |
| **FLUX** | ZelHash | **MISSING** | **MISSING** | Stratum v1 | — | **TODO** |
| **XMR** | RandomX | **MISSING** | **STUB** | Stratum v1 | — | **TODO** (CPU-only) |

### 2.2 Infrastructure Status

| Component | Status | Notes |
|-----------|--------|-------|
| Pool B2b bridge | **WORKING** | DCR jobs issued to miners, share routing active |
| AuxPow scheduler | **WORKING** | Profit switching + circuit breaker + hysteresis |
| Reconnect logic | **WORKING** | Inline read fix (no more deadlock) |
| Read timeout | **WORKING** | 300s (DCR 5-min blocks) |
| Multiplexer | **WORKING** | Single-coin active, multi-coin TODO |
| Dual stratum | **EXISTS** | ZION + external nonce split, untested E2E |
| Share forwarder | **WORKING** | Local target check → pool submit |
| GPU backend (OpenCL) | **WORKING** | All algo kernels compile + dispatch |
| GPU backend (CUDA) | **STUB** | Scaffold only |
| GPU backend (Metal) | **STUB** | Scaffold only |
| EthStratum protocol | **PARTIAL** | `eth_submitLogin` works, `eth_getWork`/`eth_submitWork` TODO |
| True AuxPow (Phase 3) | **POC** | DCR validation exists, not consensus-integrated |
| Parent chain parsing | **DCR DONE** | ALPH header stub |
| SMOS deploy | **BLOCKED** | API execute-command unreliable, binary replace problematic |

### 2.3 DCR Fixes Applied (2026-07-13)

| Fix | Problem | Solution |
|-----|---------|----------|
| Read timeout 90s→300s | DCR 5-min blocks → spurious reconnects | `auxpow_client.rs:375` |
| Reconnect deadlock | `send_request` waits on dead poll loop | `send_request_inline()` |
| Notify parsing | Used arr[1] (prevhash 32B) as header | Use arr[2] (coinbase1 = 144B header) |
| Blake3 hash | `header \|\| nonce_le` (wrong) | Full 180B header, nonce@offset 140, 4B LE |
| Share target | Used nbits (network target) | Use difficulty-based target (like KAS) |
| Submit format | 3-param `[worker, job_id, nonce_hex]` | 5-param `[worker, job_id, "", ntime, nonce_le_hex]` |

---

## 3. Architecture

### 3.1 B2b Flow (Phase 1 — Current)

```
External Pool (WoolyPooly/2miners)
    ↕ Stratum v1
ZION Pool (62.171.141.136:8444)
    ├── AuxPowClient → subscribe + authorize + receive jobs
    ├── JobMultiplexer → queue external jobs
    ├── Session thread → issue external_job to miner
    ├── Share routing → validate + forward to external pool
    └── RoutingStats → track per-algorithm shares
    ↕ Wire protocol
ZION Miner (GPU rig)
    ├── gpu_backend → OpenCL kernel dispatch
    ├── blake3_dcr_mine / kheavyhash_mine / autolykos_mine / ...
    └── Submit share → pool validates → forwards
```

### 3.2 GPU Kernel Inventory

| Kernel File | Entry Point | Algorithm | Coins |
|-------------|-------------|-----------|-------|
| `blake3_kernel.cl` | `blake3_alph_mine` | Double-Blake3 | ALPH |
| `blake3_kernel.cl` | `blake3_dcr_mine` | Single-Blake3 | DCR |
| `kheavyhash_kernel.cl` | `kheavyhash_mine` | cSHAKE256 + matrix | KAS |
| `autolykos_kernel.cl` | `autolykos_mine` | BLAKE2b + memory-hard | ERG |
| `kawpow_kernel.cl` | `kawpow_mine` | Keccak + DAG + FNV | RVN, CLORE, EVR, MEWC |
| `ethash_kernel.cl` | `ethash_mine` | Keccak + DAG + FNV | ETC |

### 3.3 CPU Hasher Inventory

| Function | File | Algorithm | Status |
|----------|------|-----------|--------|
| `hash_blake3()` | `external_hashers.rs:83` | DCR Blake3 (180B header) | **WORKING** |
| `hash_blake3_alph()` | `external_hashers.rs:99` | ALPH double-Blake3 | **WORKING** |
| `hash_kheavyhash()` | `external_hashers.rs` | KAS kHeavyHash | **WORKING** |
| `hash_autolykos()` | `external_hashers.rs` | ERG Autolykos v2 | **WORKING** |
| `hash_kawpow()` | `external_hashers.rs` | KawPow (no DAG) | **STUB** |
| `hash_ethash()` | `external_hashers.rs` | Ethash (no DAG) | **STUB** |
| `hash_autolykos_native()` | `native_ffi.rs` | ERG (C FFI) | **WORKING** |
| `hash_kawpow_native_with_dag()` | `native_ffi.rs` | KawPow (C FFI + DAG) | **EXISTS** |
| `hash_ethash_native_with_dag()` | `native_ffi.rs` | Ethash (C FFI + DAG) | **EXISTS** |
| RandomX | `randomx_stub.c` | XMR | **STUB** |

### 3.4 Coin Profiles (11 coins)

| Coin | Ticker | Algo | Default Pool | Protocol | Wallet |
|------|--------|------|-------------|----------|-------|
| Decred | DCR | blake3 | pool.woolypooly.com:3152 | Stratum v1 | DCR wallet |
| Alephium | ALPH | blake3 | alph.2miners.com:4545 | Stratum v1 | BTC wallet |
| Kaspa | KAS | kheavyhash | kas.2miners.com:2020 | Stratum v1 | BTC wallet |
| Ergo | ERG | autolykos | erg.2miners.com:8888 | EthStratum | BTC wallet |
| Ravencoin | RVN | kawpow | rvn.2miners.com:6060 | EthStratum | BTC wallet |
| Eth Classic | ETC | etchash | etc.2miners.com:1010 | EthStratum | BTC wallet |
| Evrmore | EVR | kawpow | zpool.ca:1330 | EthStratum | BTC wallet |
| MeowCoin | MEWC | kawpow | zpool.ca:1327 | EthStratum | BTC wallet |
| Flux | FLUX | zelhash | flux.woolypooly.com:3000 | Stratum v1 | BTC wallet |
| Clore.ai | CLORE | kawpow | clore.woolypooly.com:3090 | EthStratum | BTC wallet |
| Monero | XMR | randomx | moneroocean.stream:10001 | Stratum v1 | XMR wallet |

### 3.5 Pool Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ZION_POOL_AUXPOW_ENABLED` | false | Enable B2b bridge |
| `ZION_POOL_AUXPOW_COIN` | auto | Force specific coin |
| `ZION_POOL_AUXPOW_POOL_PREFERENCE` | Default | Pool endpoint preference |
| `ZION_POOL_AUXPOW_REGION` | eu | Geographic region |
| `ZION_POOL_AUXPOW_WALLET` | BTC wallet | Default payout wallet |
| `ZION_POOL_AUXPOW_WORKER_NAME` | zion_auxpow | Worker name suffix |
| `ZION_POOL_AUXPOW_WALLET_{TICKER}` | — | Per-coin wallet override |

### 3.6 Test Coverage

**78 unit tests** — all passing:
- `auxpow_client.rs`: 4 tests (connect, subscribe, authorize, submit)
- `auxpow_scheduler.rs`: 5 tests (circuit breaker, stats)
- `dual_stratum.rs`: 7 tests (nonce split, scan)
- `external_hashers.rs`: 21 tests (blake3, kheavyhash, autolykos, targets)
- `miner_harness.rs`: 5 tests (blake3 share finding)
- `multiplexer.rs`: 2 tests (DCR job, switch)
- `parent_chains.rs`: 7 tests (DCR header, commitment)
- `share_forwarder.rs`: 3 tests (target check, accept, reject)
- `true_auxpow.rs`: 7 tests (validation, proof builder)
- `types.rs`: 15 tests (coin profiles, config, selection)

**1 E2E test** — DCR share accepted by WoolyPooly.

---

## 4. Plan — Dokončení všech multi-algo AuxPow s GPU kernely

### Phase 1: DCR Blake3 — COMPLETE

- [x] GPU kernel `blake3_dcr_mine`
- [x] CPU hasher `hash_blake3` (180B header, nonce@140)
- [x] Pool notify parsing (coinbase1 = 144B header)
- [x] Submit format (5-param Stratum v1)
- [x] Read timeout 300s
- [x] Reconnect deadlock fix
- [x] E2E test — share ACCEPTED

### Phase 2: ALPH + KAS — READY (E2E test needed)

#### 2a. ALPH (Alephium, double-Blake3)

**Status:** GPU kernel + CPU hasher + submit format exist. Unit tests pass.

- [ ] E2E test s `AUXPOW_E2E_COIN=alph` na 2miners pool
- [ ] Verify share accepted
- [ ] Pool config `ZION_POOL_AUXPOW_COIN=ALPH`
- [ ] Per-coin wallet (ALPH uses BTC payout)

**Key files:**
- `blake3_kernel.cl` → `blake3_alph_mine` entry point
- `external_hashers.rs:99` → `hash_blake3_alph` (double-Blake3 with extranonce1)
- `auxpow_client.rs:937-965` → JSON object submit `{jobId, fromGroup, toGroup, nonce, worker}`

**Estimated effort:** 1-2h (E2E test + verify)

#### 2b. KAS (Kaspa, kHeavyHash)

**Status:** GPU kernel + CPU hasher + submit format exist. Unit tests pass.

- [ ] E2E test s `AUXPOW_E2E_COIN=kas` na 2miners pool
- [ ] Verify share accepted
- [ ] Pool config `ZION_POOL_AUXPOW_COIN=KAS`
- [ ] Verify extranonce1 handling (KAS uses 4-byte extranonce1 prefix)

**Key files:**
- `kheavyhash_kernel.cl` → `kheavyhash_mine` entry point
- `external_hashers.rs` → `hash_kheavyhash` (cSHAKE256 + 64×64 matrix)
- `auxpow_client.rs:966-984` → 3-param Stratum v1 submit `[worker, job_id, nonce_hex]`

**Estimated effort:** 1-2h (E2E test + verify)

### Phase 3: ERG (Autolykos) — PARTIAL

**Status:** GPU kernel + CPU hasher + FFI exist. EthStratum `eth_submitWork` TODO.

- [ ] Implement `eth_getWork` notification handler in `auxpow_client.rs`
- [ ] Implement `eth_submitWork` submit in `auxpow_client.rs`
- [ ] Autolykos table precomputation on GPU host side
- [ ] E2E test s `AUXPOW_E2E_COIN=erg` na 2miners pool
- [ ] Verify share accepted

**Key files:**
- `autolykos_kernel.cl` → `autolykos_mine` entry point
- `external_hashers.rs` → `hash_autolykos` (BLAKE2b-256 + memory-hard table)
- `native_ffi.rs` → `hash_autolykos_native` (C FFI)
- `gpu_miner.rs:411-422` → `build_autolykos_kernel` (table buffer)

**Blocker:** EthStratum protocol support (`eth_getWork` / `eth_submitWork`)

**Estimated effort:** 4-6h

### Phase 4: KawPow coins (RVN, CLORE, EVR, MEWC) — PARTIAL

**Status:** GPU kernel + FFI with DAG exist. EthStratum TODO. DAG management needed.

- [ ] EthStratum protocol (shared with ERG)
- [ ] DAG generation + epoch management for GPU
- [ ] Mix hash support in submit (eth_submitWork needs mix_hash)
- [ ] E2E test s `AUXPOW_E2E_COIN=rvn` na 2miners pool
- [ ] E2E test s `AUXPOW_E2E_COIN=clore` na woolypooly pool
- [ ] Verify shares accepted

**Key files:**
- `kawpow_kernel.cl` → `kawpow_mine` entry point
- `native_ffi.rs` → `hash_kawpow_native_with_dag` (C FFI + DAG)
- `gpu_miner.rs:780-848` → `build_kawpow_kernel` (DAG buffer)
- `gpu_backend.rs:3396-3466` → DAG management (epoch-based)

**Estimated effort:** 6-8h (DAG + EthStratum + 4 coin E2E tests)

### Phase 5: ETC (Etchash) — PARTIAL

**Status:** GPU kernel + FFI with DAG exist. Same EthStratum blocker as KawPow.

- [ ] EthStratum protocol (shared with Phase 3/4)
- [ ] DAG generation (Etchash DAG differs slightly from Ethash)
- [ ] E2E test s `AUXPOW_E2E_COIN=etc` na 2miners pool
- [ ] Verify share accepted

**Key files:**
- `ethash_kernel.cl` → `ethash_mine` entry point
- `native_ffi.rs` → `hash_ethash_native_with_dag` (C FFI + DAG)
- `gpu_miner.rs:432-444` → `build_ethash_kernel` (DAG buffer)

**Estimated effort:** 3-4h (after EthStratum is done)

### Phase 6: FLUX (ZelHash) — TODO

**Status:** Coin profile exists. No GPU kernel, no CPU hasher.

- [ ] Research ZelHash algorithm (ZelHash = double SHA-256 variant for Flux)
- [ ] Implement CPU hasher in `external_hashers.rs`
- [ ] Write OpenCL kernel `zelhash_kernel.cl`
- [ ] Add kernel_info mapping in `gpu_miner.rs`
- [ ] Implement Stratum v1 notify parsing for FLUX
- [ ] E2E test s `AUXPOW_E2E_COIN=flux` na woolypooly pool

**Estimated effort:** 8-12h (new algorithm implementation)

### Phase 7: XMR (RandomX) — TODO (CPU-only)

**Status:** Coin profile exists. RandomX stub only. RandomX is CPU-only (no GPU).

- [ ] Integrate `randomx-rs` crate or native RandomX library
- [ ] Replace `randomx_stub.c` with real implementation
- [ ] Implement CPU miner thread (not GPU)
- [ ] E2E test s `AUXPOW_E2E_COIN=xmr` na moneroocean pool

**Note:** RandomX is intentionally CPU-only (anti-ASIC, anti-GPU). No GPU kernel needed.

**Estimated effort:** 4-8h (library integration + CPU thread)

### Phase 8: EthStratum Protocol — BLOCKER for ERG/RVN/ETC/EVR/MEWC/CLORE

**Status:** `eth_submitLogin` works. `eth_getWork` / `eth_submitWork` TODO.

- [ ] Implement `eth_getWork` notification handler in `poll_messages()`
  - Parse `[seed_hash, header_hash, boundary]`
  - Build ExternalJob from eth_getWork params
- [ ] Implement `eth_submitWork` in `submit_share()`
  - Format: `[nonce_hex, header_hash, mix_hash]`
  - Mix hash from GPU kernel (KawPow/Ethash) or final hash (Autolykos)
- [ ] Test with ERG pool (Autolykos, no mix hash needed)
- [ ] Test with RVN pool (KawPow, mix hash from DAG)

**Key file:** `auxpow_client.rs` — `poll_messages()` + `submit_share()`

**Estimated effort:** 4-6h (unblocks Phase 3, 4, 5)

### Phase 9: SMOS Miner Deploy — BLOCKED

**Status:** Pool vydává blake3_dcr joby, ale SMOS rig běží se starou binárkou.

- [ ] Build new miner binary with all algorithm support
- [ ] Package as SMOS custom miner zip
- [ ] Upload to `zionterranova.com/zion-miner/`
- [ ] Update SMOS group config via API to point to new zip
- [ ] Reload rig via SMOS API
- [ ] Verify miner connects + mines blake3_dcr
- [ ] Verify share accepted by WoolyPooly through pool

**Alternative:** SSH na rig (pokud dostupný) + ruční binary replace

**Estimated effort:** 2-4h (po vyřešení SMOS API přístupu)

### Phase 10: Multi-Coin Profit Switching — ENHANCEMENT

**Status:** Scheduler exists with static fallback estimates. Single-coin active.

- [ ] Connect to multiple external pools simultaneously
- [ ] Real-time revenue estimation from pool APIs
- [ ] Dynamic coin switching based on live profitability
- [ ] Per-miner algorithm assignment (not all miners on same coin)
- [ ] Multi-pool per coin support (preference/region mapping)

**Estimated effort:** 8-12h

### Phase 11: True AuxPow (Phase 3) — FUTURE

**Status:** POC validation exists for DCR. Not consensus-integrated.

- [ ] ALPH header parsing (research exact layout)
- [ ] Integrate `true_auxpow.rs` into `V3/L1/core` consensus
- [ ] Height-gated fork logic for AuxPoW blocks
- [ ] New ZION header fields for AuxPoW data
- [ ] Coinbase commitment scanning in ZION blocks
- [ ] Aux Merkle tree validation

**Estimated effort:** 20-40h (consensus-level work)

---

## 5. Priority Order

| Priority | Phase | Effort | Impact |
|----------|-------|--------|--------|
| **P0** | Phase 9: SMOS deploy | 2-4h | Unblocks real GPU mining |
| **P1** | Phase 2a: ALPH E2E | 1-2h | 2nd coin live |
| **P1** | Phase 2b: KAS E2E | 1-2h | 3rd coin live |
| **P2** | Phase 8: EthStratum | 4-6h | Unblocks 6 coins |
| **P2** | Phase 3: ERG E2E | 4-6h | 4th coin live |
| **P3** | Phase 4: KawPow E2E | 6-8h | 4 coins live |
| **P3** | Phase 5: ETC E2E | 3-4h | 5th coin live |
| **P4** | Phase 6: FLUX | 8-12h | New algorithm |
| **P4** | Phase 7: XMR | 4-8h | CPU-only coin |
| **P5** | Phase 10: Multi-coin | 8-12h | Profit optimization |
| **P6** | Phase 11: True AuxPow | 20-40h | Consensus integration |

**Total estimated effort:** ~70-120h pro všechny phases

---

## 6. Key File Locations

| Purpose | File |
|---------|------|
| GPU kernels (OpenCL) | `AuXpow/csrc/opencl/*.cl` |
| CPU hashers | `AuXpow/src/external_hashers.rs` |
| Native FFI hashers | `AuXpow/src/native_ffi.rs` |
| Coin profiles | `AuXpow/src/types.rs` |
| AuxPow Stratum client | `AuXpow/src/auxpow_client.rs` |
| GPU miner (kernel builder) | `AuXpow/src/gpu_miner.rs` |
| Scheduler (profit switching) | `AuXpow/src/auxpow_scheduler.rs` |
| Job multiplexer | `AuXpow/src/multiplexer.rs` |
| Dual stratum | `AuXpow/src/dual_stratum.rs` |
| Share forwarder | `AuXpow/src/share_forwarder.rs` |
| True AuxPow validation | `AuXpow/src/true_auxpow.rs` |
| Parent chain parsing | `AuXpow/src/parent_chains.rs` |
| Pool server | `V3/L1/pool/src/bin/server.rs` |
| Miner main | `V3/L1/miner/src/main.rs` |
| GPU backend | `V3/L1/miner/src/gpu_backend.rs` |
| E2E test | `AuXpow/examples/e2e_pool_test.rs` |
| SMOS deploy script | `scripts/deploy_zion_smos.py` |
| Systemd service | `edge-deploy/systemd/zion-edge-pool.service` |
| Docker pool | `V3/docker/Dockerfile.pool` |

---

## 7. Revenue Estimates (Static Fallback)

| Coin | Revenue /100MH/s/day | Power | Profit |
|------|---------------------|-------|--------|
| KAS | $0.85 | $0.10 | $0.75 |
| ETC | $0.60 | $0.12 | $0.48 |
| ALPH | $0.55 | $0.08 | $0.47 |
| FLUX | $0.50 | $0.10 | $0.40 |
| DCR | $0.45 | $0.08 | $0.37 |
| ERG | $0.40 | $0.10 | $0.30 |
| RVN | $0.35 | $0.12 | $0.23 |
| CLORE | $0.30 | $0.10 | $0.20 |
| EVR | $0.20 | $0.08 | $0.12 |
| MEWC | $0.15 | $0.06 | $0.09 |
| XMR | $0.12 | $0.03 | $0.09 |

---

## 8. DCR E2E Test Log (2026-07-13)

```
coin:      DCR
algorithm: blake3
pool:      pool.woolypooly.com:3152
wallet:    DsdVsPZpXTCtNFNnHN68L6ajYTabxDcEmMp

[1/4] Connected and authorized.
[2/4] Received job: id=00000f57 algorithm=blake3 header_len=144 difficulty=128
[3/4] Found potential share: job_id=00000f57 nonce=388 hash=001f350a9fd731c9
[4/4] Submitting share...
auxpow: submitting share request {"id":100,"method":"mining.submit",
  "params":["DsdVsPZpXTCtNFNnHN68L6ajYTabxDcEmMp.zion_e2e","00000f57","","ddc8546a","84010000"]}
[4/4] Submit result: Accepted
=== E2E test finished ===
```

**Submit format:** 5-param Stratum v1
- `[worker, job_id, extranonce2="", ntime, nonce_le_hex]`
- nonce=388 → `0x84010000` (4-byte LE)

---

## 9. Next Actions

1. **SMOS deploy** (P0) — get new miner binary on rig
2. **ALPH E2E test** (P1) — verify 2nd coin
3. **KAS E2E test** (P1) — verify 3rd coin
4. **EthStratum protocol** (P2) — unblocks ERG/RVN/ETC/EVR/MEWC/CLORE
5. **KawPow DAG + E2E** (P3) — 4 more coins live
6. **FLUX ZelHash** (P4) — new algorithm
7. **XMR RandomX** (P4) — CPU-only
8. **Multi-coin profit switching** (P5) — optimization
9. **True AuxPow consensus** (P6) — Phase 3 merge mining
