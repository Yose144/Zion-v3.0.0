# ZION TerraNova v3.0.2 — Canonical Source of Truth

> **One vision. One source of truth. Six layers.**
>
> Version: **3.0.2** · Status: **Mainnet code line active** · Launch: **31 December 2026**
> Canonical code: [`V3/`](V3/) · Operational status: [`StatusV3.md`](StatusV3.md) · Plan: [`ZION_3.0.2_PLAN.md`](ZION_3.0.2_PLAN.md)

This document is the **canonical, code-grounded reference** for ZION v3.0.2. Where any other
document disagrees, the order of truth is:

1. `V3/` source code (consensus, emission, validation)
2. `StatusV3.md` (current operational reality)
3. This document and `README.md` / `ROADMAP.md`
4. `V3/docs/**` and archived whitepapers

It supersedes scattered v3.0.x notes for the purpose of a single canonical baseline. It is
**internal/technical** — the public-facing document is [`WHITEPAPER.md`](WHITEPAPER.md).

---

## 1. What v3.0.2 Is

v3.0.2 is the transition from a pure **L1 mainnet** to a **fully integrated L1–L6 ecosystem**:

- **L2 canonized** — Bridge, DAO, Atomic Swap are mainnet-ready and deployed.
- **L3 canonized** — WARP cross-chain, AI-Native layer, NCL marketplace.
- **L4 in preparation** — UE5 OASIS foundation, HUD/character blueprints, territory system.
- **One source of truth** — documents consolidated; root cleaned; archives moved to `docs/3.0.1Genesis/`.

The git tag `v3.0.2` is the official line; `main` runs ahead with continued 3.0.2 work. All
version strings (`V3/Cargo.toml`, bridge configs, READMEs, roadmap) are unified to **3.0.2**.

---

## 2. L1 — Core Chain (Active)

| Property | Value | Source |
|----------|-------|--------|
| Total supply (hard cap) | 144,000,000,000 ZION | `V3/L1/core/src/emission.rs` |
| Mining emission | 127,220,000,000 ZION (88.35 %) | `emission.rs` |
| Genesis premine | 16,780,000,000 ZION (11.65 %), 14 outputs | `genesis.rs` |
| Atomic unit | 1 ZION = 1,000,000 flowers (6 decimals) *(updated to 6-decimal in 3.0.3 fork)* | `emission.rs` |
| Block time | 60 seconds | `consensus.rs` |
| Initial block reward | 5,400.067 ZION | `emission.rs` |
| Emission model | Decade Decay (−20 % every 10 years = 5,256,000 blocks) | `emission.rs` |
| Tail emission | 724.784723787776 ZION/block from ~2126, forever | `emission.rs` |
| Difficulty (DAA) | LWMA, 60-block window, ±25 % per block | `consensus.rs` |
| Fee policy | 100 % burn (deflationary) | `fee.rs` |
| Fee/reward split | 89 % miner / 5 % humanitarian / 5 % Issobella / 1 % pool | `emission.rs` |
| Consensus | Proof-of-Work (Nakamoto) | `lib.rs` |
| Mining algorithm | `deeksha_lite_v1` (canonical) + `deeksha_lite_fire` (thermal, GPU) | `cosmic-harmony` |
| Signing | Ed25519 | `crypto.rs` |
| Hashing | BLAKE3 (general), Keccak-256/SHA3-512 (PoW pipeline) | `crypto.rs` |
| Address format | Bech32 (`zion1…`) | `crypto.rs` |
| Transaction model | Hybrid UTXO + account model | `tx.rs` |
| Storage | LMDB (via `heed`) | `core` |
| Genesis hash | `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728` | frozen 2026-06-07 |

### 2.1 Decade Decay Emission

| Decade | Years | Block reward (ZION) |
|--------|-------|---------------------|
| D1 | 2026–2036 | 5,400.067 |
| D2 | 2036–2046 | 4,320.054 |
| D3 | 2046–2056 | 3,456.043 |
| D4 | 2056–2066 | 2,764.834 |
| D5 | 2066–2076 | 2,211.868 |
| … | … | −20 % per decade |
| D11+ | 2126+ | 724.784723787776 (perpetual tail) |

### 2.2 Genesis Premine (14 outputs, 16.78B ZION, on-chain verifiable)

| Category | Amount | Lock |
|----------|--------|------|
| OASIS + Golden Egg/XP (slots 1–5) | 8.25B | None |
| DAO Treasury (governance + grants + bootstrap) | 4.0B | Height 525,600 (~1 yr) |
| Core Dev + Network Infrastructure | 2.0B | None |
| Genesis Projects (Dharma Temple, Piko de Ora + DAO) | 0.59B | None |
| Humanitarian — Children Future Fund | 1.44B | None |
| Bridge Seed Fund (account) | 0.4B | None |
| Bridge Vault UTXO Seed | 0.1B | None |

The DAO Treasury time-lock (4B until height 525,600) is enforced on-chain in
`V3/L1/core/src/validation.rs` Step 11. Public addresses are listed in
`PREMINE_ADDRESSES_PUBLIC.txt`.

### 2.3 Immutable Parameters (governance cannot change)

Total supply · genesis allocation · 60 s block time · Ekam Deeksha PoW · PoW consensus ·
89/5/5/1 reward split. These are enforced in code, not policy.

---

## 3. L2 — Bridge, DAO, Atomic Swap (Active)

| Component | State | Notes |
|-----------|-------|-------|
| wZION (ERC-20, Base Mainnet) | Deployed | Contract `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge (5/5 multisig) | Deployed | Lock/mint + burn/unlock, fail-closed relayer |
| BridgeValidator (5/5) | Deployed | Quorum attestation |
| Bridge relay (L1 ↔ Base) | Running | L1 node + EVM watcher, 60-block finality |
| ZIONStaking | Deployed | 12 % APR, 7-day cooldown |
| ZIONGovernance | Deployed | Stake-weighted voting (L2 mirror) |
| ZIONFarm | Deployed | MasterChef-style yield farming |
| ZIONAtomicSwap (HTLC) | Active | Cross-chain trustless swaps |
| DAO governance daemon | Active | Axum API, SQLite, 65 tests |
| UniV3Pool (wZION) | Live | Concentrated liquidity on Uniswap V3 (Base) |

**Security posture:** the relayer is fail-closed — if the validator quorum is not met,
`build_validator_proofs` returns an error **before** any L1 RPC call. No synthetic proofs.

> Operational provisioning details (validator key provisioning, ETH top-ups, liquidity seeding)
> are tracked in `StatusV3.md` and `BRIDGE_MAINNET_READINESS.md` — out of scope for this canon.

---

## 4. L3 — WARP, AI-Native, NCL (Active)

- **WARP cross-chain:** 21 chain adapters across 7 families (EVM, Bitcoin Lightning, Solana,
  NEAR, Polkadot, TON, Cosmos IBC); Axum API + background watcher; swap aggregator with real
  EVM RPC quotes. 251 lib tests.
- **AI-Native layer:** AI safety guards + kill switch, audit log, agent-compatible endpoints,
  Hiran v2.3 inference (llama-server / LM Studio / Ollama). 195 tests.
- **NCL (Neural Compute Layer):** distributed AI-inference marketplace; gateway + dashboard API
  proxy; orchestrator unit tests. Miners earn additional rewards for AI tasks alongside mining.

---

## 5. L4 — ZION OASIS (Preparation)

- UE5 project under `V3/L4/oasis/ue5/`: `BP_GoldenEggManager`, `BP_TerritoryManager`,
  `BP_ZionOasisGameMode`, `BP_ZionCharacter`, `BP_ZionPlayerController`, `BP_ZionHUD`,
  `LV_MainMenu`, `LV_World`.
- REST API (9 endpoints): health, player, XP award, leaderboard, guild CRUD, territory map,
  reward pools. XP is off-chain (SQLite `oasis.db`); **L1 remains pure PoW**.
- Pending: L4→L1 bridge (OASIS token standard), on-chain land registry, HUD live-data
  integration, mobile companion, OASIS economy.

---

## 6. L5 / L6 — Free World & Issobella (Planned)

- **L5 Free World** (target 2030): humanitarian + scientific foundation funded by the 5 % block
  reward allocation — clean water, education, healthcare, free-energy research, free communities.
- **L6 Issobella** (target 2040+): decentralized scientific research station / LEO observatory,
  funded by the 5 % Issobella allocation and perpetual tail emission.

Daemons exist at `V3/L5/` and `V3/L6/` (scanner/fund APIs); full programs are roadmap items.

---

## 7. Test Coverage & Gates

- **~1,470 automated tests**, 0 failing (release run, `--test-threads=1`).
- Clean gate targets: `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `cargo audit`.
- Current source-tree audit (`V3_AUDIT_SUMMARY.md`): `cargo check` passes; `fmt`/`clippy`
  cleanup is open work outside consensus-critical L1 (which is unchanged).
- External security audit scheduled **Q3 2026**.

---

## 8. Versioning

| Version | Date | Highlights |
|---------|------|-----------|
| 3.0.0 | 2026-05 | Genesis reset, L1 mainnet, core pool/miner |
| 3.0.1 | 2026-06-10 | Fire fork, KAT vectors, dashboard 2.0, L2/L3 foundation |
| **3.0.2** | **2026-06-18** | **L2/L3 canonization, L4 OASIS prep, root cleanup** |
| 3.0.3 | 2026-07 | L4 OASIS alpha, mobile app, L2/L3 mainnet deploy |
| 3.1.0 | 2026-Q4 | Full L2–L6 integration, satellite test |

---

## 9. Canonical Document Map

```
Root (canonical):
├── README.md                  — Project overview (v3.0.2)
├── ROADMAP.md                 — Public roadmap
├── ZION_3.0.2_CANONICAL.md    — This file (technical source of truth)
├── ZION_3.0.2_PLAN.md         — L2/L3/L4 working plan (CZ)
├── WHITEPAPER.md              — Public whitepaper (sanitized)
├── StatusV3.md                — Live operational status
├── AGENTS.md                  — Automated-agent operating rules
└── LICENSE                    — MIT

Listings:
└── docs/listings/             — COINGECKO.md, COINMARKETCAP.md

Archive:
└── docs/3.0.1Genesis/         — v3.0.0–3.0.1 documents
```

---

*In code we trust. 144 billion ZION. Not one satoshi more.*
