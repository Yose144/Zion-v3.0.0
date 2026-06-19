# ZION v3.0.2 Roadmap

> **From genesis to the stars.**
>
> This is the canonical roadmap for the v3.0.2 mainnet line (L1 Active, L2/L3 Ready, L4 Oasis in Prep).
> Engineering details live in [`V3/ROADMAP.md`](V3/ROADMAP.md).
> Current operational status: [`StatusV3.md`](StatusV3.md).
> 3.0.2 Plan: [`ZION_3.0.2_PLAN.md`](ZION_3.0.2_PLAN.md).

---

## Launch Milestone

| Milestone | Target | Status |
|-----------|--------|--------|
| **Mainnet Genesis #0** | 31 December 2026 | Ready for launch |
| **Summer Solstice rehearsal** | 20 June 2026 | Completed (internal) |

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
| Final payout verification | 🔄 In progress | PPLNS window validation |
| Security audit | 🔄 Scheduled | External firm booked |
| Bridge validator key provisioning | 🔄 In progress | 3/5 threshold production |
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

## Phase 2.5 — L2/L3 Kanonizace + L4 Oasis Prep (Q2 2026) ✅ Complete

### L2 — Bridge / DAO / Atomic Swap

|| Feature | Status |
|---------|--------|
|| Bridge relay (L1 ↔ Base, 60-block finality) | ✅ Active |
|| DAO governance daemon (65 tests) | ✅ Active |
|| Atomic Swap HTLC (E2E tests + /swap web) | ✅ Active |
|| 3/5 multisig validator threshold | ✅ Configured |

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
| Golden Egg treasure hunt (108 clues, 8.25B ZION prize) | 🔵 Planned | 2027 |
| Guild system & territories | 🔵 Planned | 2028 |
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
| V3 workspace tests | ~1,470+ |
| Test pass rate | 100% (last clean gate) |
| Lines of code (V3) | 50,000+ (Rust) |
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

*Last updated: 2026-06-19*
*Version: v3.0.2 · Status: Mainnet Ready (L1 Active, L2/L3 Ready, L4 Oasis in Prep)*
