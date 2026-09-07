# V3 Pure Code Audit — Ekam Deeksha Mainnet Line

Status: 2026-03-12  
Scope: `V3/` clean-room codebase vs constitutional mainnet requirements  
Authoritative constitution: `docs/mainnet/MAINNET_CONSTITUTION.md` (frozen SHA-256: c76aa002…)

---

## 1. V3 Workspace Inventory

```
V3/                         workspace root, version 3.0.0, Rust 2021
├── Cargo.toml              workspace manifest (4 members)
├── rust-toolchain.toml     stable + clippy + rustfmt
├── ROADMAP.md              active source-of-truth
├── README.md               scope & status
├── L1/
│   ├── cosmic-harmony/     Ekam Deeksha PoW algorithm
│   │   ├── src/lib.rs                    11 modules exported
│   │   ├── src/deeksha.rs               canonical pipeline entry, EKAM_FUSION_ROUNDS=8
│   │   ├── src/algorithms_opt.rs        Keccak/SHA3/GoldenMatrix/Fusion CPU paths
│   │   ├── src/algorithms_npu.rs        INT8 MLP CHv4 mixing, circuit breaker
│   │   ├── src/sha3_fast.rs             SHA3-512 optimizations
│   │   ├── src/scratchpad_ekam.rs       Blake3 XOF 64 KiB memory-hard
│   │   ├── src/hugepages.rs             2 MiB HugePages allocator (Linux/macOS)
│   │   ├── src/revenue.rs               5 revenue streams + fee rates
│   │   ├── src/ncl_integration.rs       AI consciousness levels (disabled for L1)
│   │   ├── src/hic.rs                   22 Hiranyagarbha constants (φ-based)
│   │   └── src/gpu/                     OpenCL kernel source loader
│   ├── core/               Node runtime, consensus, chain state
│   │   ├── src/lib.rs                   ~2,426 lines: NodeRuntime, ChainState, P2P, RPC
│   │   └── src/bin/node.rs              ~363 lines: TCP server, bootstrap sync
│   ├── pool/               Stratum pool
│   │   ├── src/lib.rs                   ~730 lines: share validation, wire protocol
│   │   └── src/bin/server.rs            ~500 lines: multi-client TCP server
│   └── miner/              Mining client
│       └── src/main.rs                  ~550 lines: local + remote TCP, telemetry
└── DesktopApp/             Electron operator shell
    ├── main.js             runtime supervisor, wallet manager
    ├── renderer.js         UI
    └── package.json        v3.0.0
```

### Build & Test Status

```
cargo test --manifest-path V3/Cargo.toml
  81 tests passed, 0 failed, 1 ignored (hugepages doctest)
  Canonical Ekam vector: 6339f2fb178fe2957a10d9e2a84cf9d5e340064f0d165e845b6a54eaf7924fbd ✅
```

---

## 2. What V3 HAS (Pure Code — Implemented & Verified)

### 2.1 Consensus: Ekam Deeksha PoW ✅

Pipeline: `header+nonce → Keccak-256 → SHA3-512 → GoldenMatrix → Blake3 XOF 64 KiB (2 passes, 64 random reads) → NPU MLP INT8 → CosmicFusion (8 rounds) → SHA3-512 → Hash32`

| Parameter | Value | Status |
|-----------|-------|--------|
| `CHV_EKAM_FORK_HEIGHT` | 0 (active from genesis) | ✅ |
| `EKAM_FUSION_ROUNDS` | 8 | ✅ |
| Scratchpad size | 64 KiB | ✅ |
| NPU mixing | Deterministic INT8 MLP 64→128→64 | ✅ |
| HugePages | 2 MiB (Linux/macOS x86_64), fallback on arm64 | ✅ |
| Canonical test vector | `6339f2fb...` | ✅ bit-perfect |
| GPU backends (source) | OpenCL kernel source included | ✅ |

### 2.2 Node Runtime ✅

| Feature | Status |
|---------|--------|
| P2P wire protocol (11 message types) | ✅ |
| RPC wire protocol (get_template, submit_candidate, mempool) | ✅ |
| Block template state + rotation | ✅ |
| Accepted-block indexes (by height, by template ID) | ✅ |
| Chain snapshot persistence (file-backed JSON) | ✅ |
| Journal-assisted recovery | ✅ |
| Mempool with fee-prioritized assembly | ✅ |
| Mined-transaction eviction on block accept | ✅ |
| Restore sanitization (duplicate/already-mined removal) | ✅ |
| Stricter transaction validation + sender-nonce checks | ✅ |
| Block-body hash + subsidy/fee/miner-reward metadata | ✅ |
| Contiguous peer block sync (get_blocks_since → import) | ✅ |
| Bootstrap catch-up from ZION_SEED_PEERS | ✅ |

### 2.3 Pool ✅

| Feature | Status |
|---------|--------|
| Share validation (Ekam Deeksha target check) | ✅ |
| Session wire protocol (hello/welcome/job/submit/result/stale/cancel/bye) | ✅ |
| Stale job lifecycle | ✅ |
| Node RPC integration (template consumption + candidate submission) | ✅ |
| Upstream rejection + stale-template bridge coverage | ✅ |
| Multi-client TCP server binary | ✅ |

### 2.4 Miner ✅

| Feature | Status |
|---------|--------|
| Local in-process mining | ✅ |
| Remote TCP pool mode | ✅ |
| Repeated loop + telemetry | ✅ |
| Environment-driven configuration (13 env vars) | ✅ |

### 2.5 DesktopApp ✅

| Feature | Status |
|---------|--------|
| Electron shell (thin, supervision-only) | ✅ |
| Wallet manager (bip39 + ethers + safeStorage) | ✅ |
| Wallet roles (operator, treasury, bridge, validator) | ✅ |
| Runtime supervision for V3 node/pool/miner binaries | ✅ |
| All localhost-only networking | ✅ |

---

## 3. What V3 DOES NOT HAVE (Gaps vs Constitution)

### 3.1 CRITICAL — Mainnet launch blockers

| ID | Missing | Constitution requires | V3 current state | Migration source |
|----|---------|-----------------------|------------------|------------------|
| **G1** | Emission / Decade Decay | ×(4/5) every 5,256,000 blocks, 10 decades, tail ~724.785 ZION | `DEFAULT_BLOCK_REWARD_ZION = 5_400` — constant, no decay | Legacy `L1/core/src/blockchain/reward.rs` |
| **G2** | Atomic units (flowers) | 1 ZION = 1,000,000,000,000 flowers; precise reward = 5,400,067,000,000,000 flowers | Integer `5_400` only — no sub-ZION precision | Same as G1 |
| **G3** | LWMA DAA | 60-block window, ±25% max change, ±120 s timestamp clamp | Hardcoded `difficulty_bits: 0x1f00ffff`, no adjustment algorithm | Legacy `L1/core/src/blockchain/difficulty.rs` |
| **G4** | Genesis block + premine | Block 0 with 12 coinbase outputs totaling 16,780,000,000 ZION | No genesis builder, no premine module | Legacy `L1/core/src/blockchain/premine.rs` + `PREMINE_ADDRESSES_PUBLIC.txt` |
| **G5** | Block propagation | Flood-fill relay to all connected peers on new block | Single request/response TCP, no outbound push | New code |

### 3.2 HIGH — Network security before production

| ID | Missing | Constitution value | V3 state |
|----|---------|--------------------|----------|
| **G6** | Max reorg depth | 10 blocks | Not enforced |
| **G7** | Coinbase maturity | 100 blocks | Not enforced |
| **G8** | Fee burn | 100% burned | Implicit only — no explicit mechanism |
| **G9** | Seed peers | 5+ for eclipse resistance | 1 hardcoded (91.98.122.165:8334) |
| **G10** | Premine unlock_height | DAO Treasury cliff at ~525,600 | No unlock enforcement |

### 3.3 MEDIUM — Required before production, not for testnet

| ID | Missing |
|----|---------|
| **G11** | Fork choice: highest accumulated work |
| **G12** | Orphan block handling + relay |
| **G13** | Eclipse protection (peer diversity, connection limits) |
| **G14** | Timestamp validation on P2P blocks (±120 s of median) |
| **G15** | Chain ID enforcement in wire messages (`zion-mainnet-1`) |

---

## 4. Constitutional Parameters — Quick Reference

### Supply

| Parameter | Value |
|-----------|-------|
| Total supply (max, immutable) | 144,000,000,000 ZION |
| Mining supply | 127,220,000,000 ZION (88.35%) |
| Genesis premine | 16,780,000,000 ZION (11.65%) |
| Atomic unit | 1 ZION = 1,000,000,000,000 flowers |
| Chain ID | `zion-mainnet-1` |

### Emission

| Parameter | Value |
|-----------|-------|
| Initial block reward | 5,400.067 ZION (5,400,067,000,000,000 flowers) |
| Block interval | 60 seconds |
| Blocks per year | 525,600 |
| Blocks per decade | 5,256,000 |
| Decay factor | ×(4/5) per decade |
| Max decay decades | 10 |
| Tail emission | ~724.785 ZION/block (perpetual) |
| Fee policy | 100% burn |

### Difficulty

| Parameter | Value |
|-----------|-------|
| DAA type | LWMA |
| Window | 60 blocks |
| Max change per block | ±25% |
| Timestamp sanity | ±120 s |

### Chain rules

| Parameter | Value |
|-----------|-------|
| Max reorg depth | 10 blocks |
| Soft finality | 60 blocks |
| Fork choice | Highest accumulated work |
| Coinbase maturity | 100 blocks |

### Premine Distribution

| # | Category | Wallets | Amount | Lock |
|---|----------|---------|--------|------|
| 1–5 | OASIS + Winners Golden Egg/Xp | 5 × 1.65B | 8,250,000,000 ZION | Immediate |
| 6–8 | DAO Treasury | main 2.5B + grants 1B + bootstrap 0.5B | 4,000,000,000 ZION | Cliff ~525,600 blocks |
| 9–11 | Infrastructure | core dev 1B + seeds 1B + creator 0.59B | 2,590,000,000 ZION | Immediate |
| 12 | Humanitarian | Children Future Fund | 1,440,000,000 ZION | Immediate |

All 12 public addresses listed in `PREMINE_ADDRESSES_PUBLIC.txt`.

---

## 5. Implementation Plan (V3 Build Order)

```
Phase 5a (emission.rs)  ──→  Phase 5c (genesis.rs)  ──→  Phase 6 (chain rules)  ──→  Phase 7 (mainnet)
Phase 5b (difficulty.rs) ──→  Phase 5c (genesis.rs)  ──↗
Phase 5d (propagation)   ────────────────────────────────────────────────────────→  Phase 7 (mainnet)
```

| Phase | Module | Gaps addressed | Dependency |
|-------|--------|----------------|------------|
| **5a** | `emission.rs` — flowers, decade decay, tail emission | G1, G2 | None |
| **5b** | `difficulty.rs` — LWMA DAA | G3 | None |
| **5c** | `genesis.rs` — genesis block + 12 premine outputs | G4, G10 | 5a, 5b |
| **5d** | Propagation — outbound push + multi-peer sync | G5 | None (parallel track) |
| **6** | Chain rules — reorg, maturity, fork choice, eclipse | G6–G8, G11–G15 | 5a |
| **7** | Mainnet readiness — ceremony, BFG scrub, seed infra | All | All above |

Full details in `V3/ROADMAP.md`.

---

## 6. Security Notes

| Issue | Severity | Action |
|-------|----------|--------|
| 12 private keys in git history (`PREMINE_WALLETS_BACKUP.json`) | **CRITICAL** | BFG Repo-Cleaner before any public fork or mainnet |
| Single seed peer (centralization risk) | HIGH | Deploy 5+ geographically distributed seeds |
| No eclipse protection | MEDIUM | Implement peer diversity + connection limits |
| No timestamp validation on P2P blocks | MEDIUM | Implement ±120 s median check |

---

## 7. What Migrates from 2.9.9 Archive to V3

| Source (legacy 2.9.6 tree) | Target (V3) | Status |
|----------------------------|-------------|--------|
| `L1/cosmic-harmony/` — Ekam Deeksha PoW | `V3/L1/cosmic-harmony/` | ✅ Done (clean migration) |
| `L1/core/src/blockchain/reward.rs` — emission calculator | `V3/L1/core/` — new `emission.rs` | ⏳ Phase 5a |
| `L1/core/src/blockchain/difficulty.rs` — LWMA DAA | `V3/L1/core/` — new `difficulty.rs` | ⏳ Phase 5b |
| `L1/core/src/blockchain/premine.rs` — genesis builder | `V3/L1/core/` — new `genesis.rs` | ⏳ Phase 5c |
| `PREMINE_ADDRESSES_PUBLIC.txt` — 12 wallet addresses | Embedded in `genesis.rs` | ⏳ Phase 5c |
| Revenue system (5 streams) | Already in cosmic-harmony | ✅ Done |
| Pool E2E protocol | `V3/L1/pool/` | ✅ Done |
| Docker / monitoring / CI | `V3/` ops layer | ⏳ Phase 7 |

---

## 8. Version Lineage

```
v2.9.6    Original workspace (historical archive)
v2.9.7    Production base: build gates, runtime flags, GO/NO-GO discipline
v2.9.8    Deeksha canonical: Ekam as single PoW, single-host unification
v2.9.9    Pure Code: zero bugs/zero features, cleanup for v3.0 migration
  └── V3/ Clean-room mainnet line (THIS DOCUMENT)
      Phase 1–4: done (consensus + mining + node + submit)
      Phase 5:   in progress (testnet integration + emission/DAA/genesis)
      Phase 6:   pending (chain safety rules)
      Phase 7:   pending (mainnet readiness)
```

---

*Document generated: 2026-03-12*  
*Next review: after Phase 5a (emission) implementation*
