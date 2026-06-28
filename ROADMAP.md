# ZION v3.0.3 Roadmap

> **From genesis to the stars.**
>
> This is the canonical roadmap for the v3.0.3 mainnet line (L1 Active, L2/L3 Ready, L4 Oasis in Prep).
> Engineering details live in [`V3/ROADMAP.md`](V3/ROADMAP.md).
> Current operational status: [`StatusV3.md`](StatusV3.md).
> 3.0.3 Decimal Fork Plan: [`ZION_3.0.3_DECIMAL_FORK_PLAN.md`](ZION_3.0.3_DECIMAL_FORK_PLAN.md).
> Web upgrade guide: [`WEB_V2.9_TO_V3.0.3_UPGRADE.md`](WEB_V2.9_TO_V3.0.3_UPGRADE.md).

---

## Launch Milestone

| Milestone | Target | Status |
|-----------|--------|--------|
| **3.0.3 Decimal Fork** | 27 June 2026 | ✅ **DEPLOYED** (Edge, MIGRATION_HEIGHT=18850) |
| **Pool Persistence + TX Index** | 28 June 2026 | ✅ **DEPLOYED** (Session 3, Edge) |
| **Mainnet Genesis #0** | 31 December 2026 | Ready for launch |
| **Summer Solstice rehearsal** | 20 June 2026 | Completed (internal) |

---

## Phase 1.5 — 3.0.3 Decimal Fork (2026-06-27) ✅ Complete

| Feature | Status |
|---------|--------|
| FLOWERS_PER_ZION 1e12→1e6 (12-decimal→6-decimal) | ✅ Deployed |
| migration.rs module (height-conditional consensus) | ✅ Active |
| RPC contract bump (_flowers canonical, _zion/_atomic aliases) | ✅ Active |
| protocol_version=zion-v3-node/3.0.3, protocol_version_numeric=2 | ✅ Active |
| L2 Bridge (FLOWERS_TO_WEI_FACTOR 1e6→1e12) | ✅ Active |
| L2 DAO (FLOWERS_PER_ZION, thresholds, treasury) | ✅ Active |
| L3 WARP (ChainId decimals, fees, router, xp_bridge) | ✅ Active |
| L3 NCL + AI-Native (pricing, orchestrator, transfer limits) | ✅ Active |
| ZION_OS Dashboard (app.py, dashboard.js, l3.html) | ✅ Active |
| Web v2.9 (constants.ts, zion-rpc.ts, 10 .tsx files) | ✅ Updated |
| Edge deployment (DB preserved, 13/13 services active) | ✅ Deployed |
| Documentation (27 files + StatusV3 + AGENTS.md) | ✅ Updated |
| Price decision: $0.0002/ZION (Doge legend) | ✅ Documented |

---

## Phase 1 — Foundation (2025–2026) ✅ Complete

### L1 TerraNova — Blockchain Core

| Feature | Status |
|---------|--------|
| Cosmic Harmony Ekam Deeksha v2 PoW (256 KiB scratchpad, ASIC-resistant) | ✅ Active |
| UTXO + Ed25519 signatures | ✅ Active |
| LMDB storage, P2P mesh, IBD sync | ✅ Active |
| Mempool with fee-rate eviction | ✅ Active |
| JSON-RPC 2.0 API | ✅ Active |
| Stratum pool (PPLNS, share validation) | ✅ Active |
| Decade Decay emission (100+ years) | ✅ Active |
| 100% fee burn (deflationary) | ✅ Active |
| Fee split 89/5/5/1 (miner/humanitarian/issobella/pool) | ✅ Active |
| TX hash v2 + BLAKE3 body root (BODY_ROOT_V2) | ✅ Active from genesis |

### Consensus & Security

| Feature | Status |
|---------|--------|
| LWMA difficulty adjustment (60-block window, ±25%) | ✅ Active |
| Genesis premine (16.78B ZION, 14 wallets, on-chain verifiable) | ✅ Active |
| F1 UTXO input validation | ✅ Active |
| Security cleanup (git filter-repo, credential rotation) | ✅ Complete |

### Infrastructure

| Feature | Status |
|---------|--------|
| Core node (Windows 11) | ✅ Running |
| Edge node (Hetzner VPS) | ✅ Running |
| Tailscale VPN tunnel (Core ↔ Edge) | ✅ Active |
| Edge pool relay (public 77.42.71.94:8444) | ✅ Active |
| Docker Compose (mainnet + monitoring profiles) | ✅ Ready |

### L2 Bridge & Contracts

| Feature | Status |
|---------|--------|
| wZION ERC-20 on Base Mainnet | ✅ Deployed |
| Bridge relay (L1 ↔ Base, 60-block finality) | ✅ Active |
| 3/5 multisig validator threshold | ✅ Configured |
| ZIONStaking (12% APR, 7-day cooldown) | ✅ Deployed |
| ZIONGovernance (stake-weighted voting) | ✅ Deployed |
| ZIONFarm (MasterChef yield farming) | ✅ Deployed |
| ZIONAtomicSwap (HTLC cross-chain) | ✅ Active |
| DAO governance daemon | ✅ Active (65 tests) |

---

## Phase 2 — Mainnet Launch (Q4 2026) 🔄 Active

### Pre-Launch Blockers

| Item | Status | Detail |
|------|--------|--------|
| PPLNS payout persistence | ✅ Done | File-based JSON snapshot, Edge deployed (commit `33a48151`) |
| Address TX index (O(1) history) | ✅ Done | In-memory HashMap, Edge deployed (commit `fe3beed9`) |
| Final payout verification | 🔄 In progress | Fee accumulator payout logic (tracked but not paid by pool) |
| Security audit | 🔄 Scheduled | External firm booked |
| Bridge mainnet validator keys | ⚠️ User task | Requires air-gapped machine + hardware wallet |
| Bridge relay mainnet activation | ⚠️ Pending | After validator key provisioning |
| Validator address top-up (≥0.01 ETH) | ⚠️ Pending | 5 validators need gas funding |
| Community preparation | 🔄 Ongoing | Documentation, tutorials |
| CI billing resolution | ⚠️ Pending | GitHub Actions infrastructure |

### Launch Day Checklist

See [`MAINNET_LAUNCH_SEQUENCE.md`](MAINNET_LAUNCH_SEQUENCE.md) for complete procedure.

Key steps:
1. Deploy 3 fresh mainnet nodes (clean datadir, no carry-over keys)
2. Start Core pool (master)
3. Start Edge pool (relay) — public mining on 77.42.71.94:8444
4. Activate monitoring (Prometheus + Grafana)
5. Verify genesis hash consistency across all nodes
6. Open public mining

---

## Phase 2.6 — Session 3 Engineering (2026-06-28) ✅ Complete

| Feature | Commit | Edge Deployed |
|---------|--------|---------------|
| PPLNS pool persistence (file-based JSON snapshot) | `33a48151` | ✅ Yes |
| Address TX index (O(1) getTransactionHistory) | `fe3beed9` | ✅ Yes |
| Mobile Universal Links + App Links + EAS config | `529456f5` | N/A (EAS build) |
| L4 daily streak system + daily XP reset | `58ac8294` | ✅ Yes |
| L4 territory contest 24h cooldowns | `58ac8294` | ✅ Yes |
| L4 daily_xp reset fix (json_set) | `3559d1a7` | ✅ Yes |

---

## Phase 2.5 — L2/L3 Kanonizace + L4 Oasis Prep (Q2 2026) ✅ Complete

### L2 — Bridge / DAO / Atomic Swap

|| Feature | Status |
|---------|--------|
|| Bridge relay (L1 ↔ Base, 60-block finality) | ✅ Active |
|| DAO governance daemon (65 tests) | ✅ Active |
|| Atomic Swap HTLC (E2E tests + /swap web) | ✅ Active |
|| 3/5 multisig validator threshold | ✅ Configured (5/5 for mainnet) |

### L3 — WARP + AI-Native + NCL

|| Feature | Status |
|---------|--------|
|| 21 chain adapters (BTC Lightning, Sui, Aptos, Near, Ton, EVM) | ✅ Active |
|| Swap agregátor (real EVM RPC quotes) | ✅ Active |
|| AI-Native layer (safety guards, kill switch, audit log) | ✅ Active |
|| NCL marketplace gateway | ✅ Active |

### L4 — ZION Oasis (Příprava)

|| Feature | Status | Target |
|---------|--------|--------|
|| UE5 základ (BP_Character, BP_HUD, territory) | ✅ Code ready | Q3 2026 |
|| L4 → L1 bridge (OASIS token) | 🔄 In design | Q3 2026 |
|| On-chain land registry | 🔵 Planned | Q4 2026 |

---

## Phase 2.7 — 3.1.0 Pre-Development (Q3 2026) 🔄 Planned

> **Audit:** [`AUDIT_3.1.0_EXISTING_CODE.md`](AUDIT_3.1.0_EXISTING_CODE.md) — všechny komponenty už existují, potřebují 3.0.3 fix + completion.

### Fáze 1 — 3.0.3 Compatibility Fix

| Feature | Status | Target |
|---------|--------|--------|
| Wallet SDK 3.0.3 fix (1e12→1e6, 6 souborů) | ✅ Done (commit `61ddc587`) | Q3 2026 |
| Mobile App 3.0.3 fix (1e12→1e6, 3 soubory) | ✅ Done (commit `61ddc587`) | Q3 2026 |
| Desktop Agent 3.0.3 fix (1e12→1e6, 6 souborů) | ✅ Done (commit `61ddc587`) | Q3 2026 |
| Fee constants aligned (MIN_TX_FEE=1) | ✅ Done (commit `61ddc587`) | Q3 2026 |

### Fáze 2 — TX History RPC

| Feature | Status | Target |
|---------|--------|--------|
| getTransactionHistory UTXO + coinbase scan | ✅ Done (commit `77776e48`, Edge deployed) | Q3 2026 |
| Address-based tx index (O(1) lookup) | ✅ Done (commit `fe3beed9`, Edge deployed) | Q3 2026 |

### Fáze 3 — L4 Oasis Backend Completion

| Feature | Status | Target |
|---------|--------|--------|
| WebSocket event wiring | ✅ Done (axum WS + tokio-tungstenite, 13 event types, 2 endpoints) | Q3 2026 |
| Data files (avatars.json, golden_egg.json) | ✅ Done (51 avatars, 255 quests, 108 clues) | Q3 2026 |
| L1 blockchain listener (real-time XP) | ✅ Done (blockchain_listener.rs, polls L1 RPC) | Q3 2026 |
| Daily streak system | ✅ Done (commit `58ac8294`, touch() + daily XP reset) | Q3 2026 |
| Territory contest cooldowns | ✅ Done (commit `58ac8294`, 24h cooldown) | Q3 2026 |
| Achievement system | ✅ Done (5 types, auto-checking, milestones) | Q3 2026 |
| Wallet signature auth | 🔵 Planned | Q4 2026 |
| Guild wars (declaration + resolution) | 🔵 Needs design | Q4 2026 |
| Raid boss combat (HP, abilities, 108 pillars) | 🔵 Needs design | Q4 2026 |
| OASIS token bridge (L4→L1) | 🔵 In design | Q4 2026 |
| E2E test (UE5 → Rust → L1) | 🔵 Planned | Q4 2026 |

### Fáze 4 — Mobile App Polish

| Feature | Status | Target |
|---------|--------|--------|
| QR code scan/generate | ✅ Done | Q4 2026 |
| Biometric auth (FaceID/TouchID) | ✅ Done | Q4 2026 |
| Send/receive/balance/tx history | ✅ Done | Q4 2026 |
| 3.0.3 decimal fix | ✅ Done (commit `61ddc587`) | Q3 2026 |
| Deep linking (Universal Links / App Links) | ✅ Done (commit `529456f5`) | Q3 2026 |
| EAS build config (eas.json) | ✅ Done (commit `529456f5`) | Q3 2026 |
| apple-app-site-association + assetlinks.json | ✅ Done (placeholders, need real TEAMID/SHA256) | Q3 2026 |
| `npx expo prebuild` (android/ + ios/ folders) | 🔵 Planned | Q4 2026 |
| First device build (EAS Build) | 🔵 Planned (needs Apple Team ID + Android SHA256) | Q4 2026 |
| App Store / Play Store submission | 🔵 Planned | Q4 2026 |

---

## Phase 3 — Ecosystem Growth (2027)

### DeFi Expansion

| Feature | Status | Target |
|---------|--------|--------|
| wZION/WETH liquidity deeping | 🔵 Planned | Q1 2027 |
| Cross-chain bridges (additional EVM chains) | 🔵 Planned | Q2 2027 |
| ZION DEX (on-chain order book) | 🔵 Planned | Q3 2027 |
| Options & derivatives (primitive) | 🔵 Planned | Q4 2027 |

### L3 WARP — Cross-Chain

| Feature | Status | Target |
|---------|--------|--------|
| Additional relay chains (Solana, Cosmos) | 🔵 Planned | 2027 |
| WARP aggregator (multi-hop routing) | 🔵 Planned | 2027 |
| Bridge insurance pool | 🔵 Planned | 2028 |

### L4 OASIS — Digital Realm

| Feature | Status | Target |
|---------|--------|--------|
| Avatar system (51 core + 151 extended) | ✅ Active | Now |
| Quest engine (5 quests per avatar) | ✅ Active | Now |
| REST API (`/avatars`, `/quests`) | ✅ Active | Now |
| WebSocket real-time events (13 types, 2 endpoints) | ✅ Active | Now |
| L1 blockchain listener (real-time XP) | ✅ Active | Now |
| Daily streak + achievements | ✅ Active | Now |
| Territory system (8 regions, claim/contest/cooldown) | ✅ Active | Now |
| Raid teams (108 pillars, roles, leaderboard) | ✅ Active | Now |
| Consciousness levels (9 tiers, Physical→OnTheStar) | ✅ Active | Now |
| Tithe system (humanitarian contributions) | ✅ Active | Now |
| Golden Egg treasure hunt (108 clues, 8.25B ZION prize) | ✅ Active | Now |
| Guild wars (declaration + resolution) | 🔵 Needs design | Q4 2026 |
| Raid boss combat (HP, abilities, 108 pillars) | 🔵 Needs design | Q4 2026 |
| OASIS token bridge (L4→L1) | 🔵 In design | Q4 2026 |
| Wallet signature auth | 🔵 Planned | Q4 2026 |
| UE5 integration | 🔵 Planned | 2028–2029 |

### L5 Free World — Physical Communities

| Feature | Status | Target |
|---------|--------|--------|
| Genesis Garden (Portugal) | 🔵 Planned | 2027 |
| Dharma Temple (La Palma) | 🔵 Planned | 2027–2028 |
| Te Piko Ora (French Polynesia) | 🔵 Planned | 2028–2029 |
| Community blueprint template | 🔵 Planned | 2027 |
| LoRa/Meshtastic off-grid mesh | 🔵 Planned | 2028 |

### L6 Issobella — Space

| Feature | Status | Target |
|---------|--------|--------|
| Research proposal system | ✅ Active | Now |
| Funding allocation (5% fee split) | ✅ Active | Now |
| Station concept & roadmap | 🔵 Planned | 2030+ |
| Orbital mechanics research | 🔵 Planned | 2030+ |

---

## Phase 4 — Maturation (2028–2030)

| Initiative | Description |
|------------|-------------|
| **Governance decentralization** | Transition from Co-Admin to fully on-chain DAO |
| **Hardware wallets** | Ledger/Trezor integration |
| **Mobile payments** | ZION Pay merchant integration |
| **Light clients** | SPV verification for mobile/resource-constrained devices |
| **Privacy layer** | Optional zk-SNARK shielded transactions (research) |
| **Quantum resistance** | Post-quantum signature scheme migration path |

---

## Phase 5 — Legacy (2030+)

| Vision | Description |
|--------|-------------|
| **Interplanetary payments** | L6 Issobella station operational funding |
| **Global mesh network** | L5 communities with autonomous LoRa backbone |
| **Consciousness mining** | L4 OASIS as digital civilization simulation |
| **Century chain** | 100+ years of continuous operation, perpetual tail emission |

---

## Development Metrics

| Metric | Value |
|--------|-------|
| V3 workspace tests | ~1,650+ (514 zion-core, 31 zion-pool, 124 zion-oasis, +others) |
| Test pass rate | 100% (last clean gate) |
| Lines of code (V3) | 55,000+ (Rust) |
| Edge services active | 12/12 |
| Documentation pages | 200+ |
| Contributors | Core team + community |

---

## References

| Document | Purpose |
|----------|---------|
| [`StatusV3.md`](StatusV3.md) | Current operational status |
| [`V3/ROADMAP.md`](V3/ROADMAP.md) | Detailed engineering plan |
| [`V3/README.md`](V3/README.md) | V3 architecture |
| [`MAINNET_LAUNCH_SEQUENCE.md`](MAINNET_LAUNCH_SEQUENCE.md) | Launch procedure |
| [`AGENTS.md`](AGENTS.md) | Agent operating rules |

---

*Last updated: 2026-06-28 (Session 3)*
*Version: v3.0.3 · Status: Mainnet Ready (L1 Active, L2/L3 Ready, L4 Oasis Backend Complete, 3.0.3 Decimal Fork Deployed, Pool Persistence + TX Index Deployed)*
