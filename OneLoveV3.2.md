# ZION 3.2 "One Love" — Mainnet Stable Launch, Marketing & Listing Plan

> **Version:** 3.2.0 "One Love" — Mainnet Stable  
> **Date:** 2026-08-06  
> **Status:** canonical root plan for the 3.2.0 public-mainnet-ready push  
> **One source of truth:** this file  
> **Technical execution plan:** [`V31/PLAN_TO_3.2.md`](./V31/PLAN_TO_3.2.md)  
> **Live status:** [`StatusV3.md`](./StatusV3.md) · [`V31/STATUS.md`](./V31/STATUS.md)  
> **Agent rules:** [`AGENTS.md`](./AGENTS.md) · [`V31/AGENTS.md`](./V31/AGENTS.md)

---

## 1. Executive Summary

`3.1.0-alpha.2` is live on Edge. The V31 cut-over is complete and the code compiles, tests pass, and production services are running. **3.2.0 "One Love"** is the next stage: *production exercised*, not just *production started*. It is the track that closes the gap between "code complete" and "mainnet stable".

This document is the **single canonical root plan** for the 3.2.0 launch. It combines the technical hardening plan, marketing and onboarding narrative, exchange/tracker listing packets, and the Bitcointalk announcement into one public-facing source of truth.

One love, one chain, one road.

---

## 2. The "One Love" Vision

> *"One love, one chain, one road."*

The name "One Love" is the public launch brand for 3.2.0. It carries three meanings:

1. **Technical unity** — L1, L2, L3 and the public `github.com/Zion-TerraNova/v3-Mainnet` subtree are in sync and documented.
2. **Community unity** — mining, DeFi, Oasis, science and humanitarian flows are aligned under one transparent protocol.
3. **Narrative unity** — the four books (Genesis, Quantum Revolution, Ekam Deeksha, Terra Nova) and the six layers (L1–L6) are told as one coherent road.

The four books answer four questions:

| Book | Direction | Question |
|------|-----------|----------|
| **Genesis** | North | Why build at all? |
| **Quantum Revolution** | East | What is broken in the old world? |
| **Ekam Deeksha** | South | Who am I on this path? |
| **Terra Nova** | West | Where is all of this heading? |

And **Oasis** is the center of the compass. There you stand.

---

## 3. 3.2 Mainnet Stable Technical Roadmap (Summary)

The full engineering plan lives in [`V31/PLAN_TO_3.2.md`](./V31/PLAN_TO_3.2.md). This section is the public summary.

### 3.1 What is already verified

| Area | Evidence | Status |
|------|----------|--------|
| V31 workspace | `cargo test --workspace` 2079 pass, `cargo clippy --workspace` clean | verified 2026-08-06 |
| V31 node on Edge | `zion-v31-node` P2P 8335, RPC 9445, sync_lag 0 | verified 2026-08-05 |
| V31 pool on Edge | stratum 8444, HTTP API 8080, shares accepted | verified 2026-08-05 |
| V31 multichain | `/health` 200, DEX + HTLC endpoints wired | verified 2026-08-06 |
| V31 DAO | runtime, L1 scanner, HTTP API + metrics | verified 2026-08-05 |
| V31 dashboard | `/api/services`, `/api/readiness` 100 %, Grafana | verified 2026-08-05 |
| DEX solver network | `HttpSolverClient` + solver endpoints wired | GO 2026-08-06 |
| Desktop Agent V31 | `npm test` + `build:linux` pass | GO 2026-08-06 |

### 3.2 What "One Love" must close

The code-vs-docs audit from [`docs/3.1/PLAN_TO_3.1_RECONCILED.md`](./docs/3.1/PLAN_TO_3.1_RECONCILED.md) showed that many "complete" items meant *library modules ported*, not *production binaries exercised*. 3.2.0 closes the remaining gaps:

| ID | Gap | 3.2 Gate |
|----|-----|----------|
| G1 | Real GPU/rig E2E Go/No-Go | ≥90 % accept rate on reference rigs |
| G2 | Non-EVM WARP contracts | Deploy, wire, or explicitly `disabled_reason` |
| G3 | Solver network real E2E | Independent solver over the internet |
| G4 | Public subtree diff | `git subtree push` diff = 0 |
| G5 | XMR/RandomX path | Reachable pool or `disabled_reason` |
| G6 | PRL (Pearl PoUW) | Remains documented and excluded |
| G7 | Chaos/load tests | 1000+ miner sim, 24h fuzzing, bridge stress |
| G8 | 30-day continuous run | No critical incident for 30 days |
| G9 | External security audit | Reviewed, mitigated or accepted |
| G10 | L5/L6 activation decision | Defined run mode or post-3.2 deferral |
| G11 | V3→V31 migration incomplete | All V3 features in V31 (contracts, TUI, CLI, features) — see §10 of `V31/PLAN_TO_3.2.md` |

### 3.3 Definition of Done for 3.2.0

1. 30-day continuous run on Edge completed, uptime ≥99.9 %, no critical incidents.
2. Real GPU mining passes on at least two reference rigs with ≥90 % accept rate.
3. Bridge wZION round-trip verified on Base mainnet.
4. No undeclared placeholder addresses or mock clients in hot paths.
5. Public subtree fully in sync and clean.
6. Security audit and chaos tests complete with mitigations.
7. `v3.2.0` GitHub release with multi-platform binaries and SHA256SUMS.
8. Monitoring, alerting, backup/DR, and runbooks tested and current.
9. Public docs and community channels ready for public mainnet.
10. `cargo test --workspace` and `cargo clippy --workspace` remain clean.
11. V31 is a true superset of V3 — all crates, features, contracts, CLI commands, GPU kernels present.
12. Miner TUI works — interactive keyboard control, sticky header, setup menu.
13. All native algorithm features exposed — `cargo build --features full` produces unified binary.
14. All Solidity contracts ported — wZION, Bridge, AtomicSwap, Governance, Treasury, Staking, Farm, ZionDex.
15. Pool supports PPLNS + PPS + SOLO with stratum v1 + v2.

### 3.4 Phases

**Phase E — Real-World Verification & Hardening (weeks 1-4)**
- E1 GPU Go/No-Go on reference rigs
- E2 AuxPoW real-pool E2E
- E3 Profit switching live test
- E4 Bridge Base mainnet round-trip
- E5 Non-EVM WARP hardening
- E6 Solver network real E2E
- E7 Public subtree sync
- E8 XMR/RandomX decision
- E9 L5/L6 activation decision

**Phase F — Stability, Security & 30-Day Run (weeks 5-9)**
- F1 Security audit
- F2 24h transaction fuzzing
- F3 Chaos tests
- F4 1000+ miner simulation
- F5 Backup / DR drill
- F6 30-day continuous run

**Phase G — Release & Launch Readiness (weeks 9-10)**
- G1 Feature freeze
- G2 GitHub `v3.2.0` release
- G3 SMOS package
- G4 Desktop App bundle
- G5 Public docs update
- G6 Community + bug bounty
- G7 Monitoring & alerting

**Phase H — V3→V31 Migration Completion (parallel with E-F)**
- H1 Port Solidity contracts (9 V3 + 7 ZionDex)
- H2 Port miner TUI (ui, interactive, setup_menu, banner)
- H3 Complete miner Cargo features (native-all, gpu-all, full, public_build)
- H4 Port missing CLI commands (dao, warp, atomic_swap, auxpow, onboard, update, monitor, deploy, compose)
- H5 Port CLI infrastructure (auto_detect, config, rpc, ui)
- H6 Port ZionDex standalone services (router, solver, intent)
- H7 Port native-libs (ABI header, build scripts)
- H8 Port L4/L5 design docs
- H9 Port AuXpow E2E test script
- H10 Stratum v2 pool support
- H11 PPS + SOLO pool modes
- H12 Pool downstream/proxy mode
- H13 B2B revenue sharing
- H14 True AuxPoW consensus integration

> **Full gap analysis:** [`V31/PLAN_TO_3.2.md`](./V31/PLAN_TO_3.2.md) §10 (V3→V31 Migration Gap Analysis)

---

## 4. Marketing & Public Positioning

Full marketing kit: [`docs/WP-Mainet/marketing/MARKETING_PR_LITE_EN.md`](./docs/WP-Mainet/marketing/MARKETING_PR_LITE_EN.md).

### 4.1 Elevator Pitch (20 seconds)

ZION is an independent Layer 1 blockchain in Rust: Proof-of-Work, fair launch, no ICO, every block splits its reward 89/5/5/1 between the miner, humanitarian fund, and future. It has a miner, pool, bridge, DAO, and game world Oasis. Live Mainnet Beta, public launch Dec 31, 2026.

### 4.2 Taglines

- "One love, one chain, one road."
- "ZION is the salt of the earth — small, but without it nothing tastes right."
- "No VIP entry. Every block is fair."
- "Don't trust — verify. Code is MIT and public."
- "Mine, play, build. Three streams, one ship."

### 4.3 Key Facts for Press

| Field | Value |
|-------|-------|
| Name | ZION TerraNova |
| Type | Layer 1 Proof-of-Work blockchain (Rust) |
| Consensus | Ekam Deeksha, memory-hard PoW |
| Hard cap | 144 billion ZION |
| Block time | ~60 seconds |
| Reward split | 89 % miner / 5 % humanitarian / 5 % future / 1 % burn |
| Launch | testnet from Dec 4, 2025; Mainnet Beta live; public launch Dec 31, 2026 |
| License | MIT |
| Public pool | `62.171.141.136:8444` |
| Sites | https://zionterranova.com, https://app.zionterranova.com, https://oasis.zionterranova.com, https://market.zionterranova.com |
| GitHub | https://github.com/Zion-TerraNova/v3-Mainnet |
| Layers | L1–L6 blockchain, DeFi/DAO, WARP/AI, Oasis, Free World, Issobella |

### 4.4 What Not to Say

- "Invest and get rich."
- "ZION is the new Bitcoin."
- "Oasis is a finished game."
- "The team got a huge pre-mined allocation."

### 4.5 Social Post Templates

1. "ZION doesn't want to rule the world. It wants to be the salt you can verify. #ZION #PoW #FairLaunch"
2. "144 billion. No ICO. Every block splits its own reward. #ZION #MainnetBeta"
3. "Oasis isn't an escape from reality. It's a world you return from stronger. #OASIS #ZION"
4. "Three mining streams: ZION, GPU, CPU. A ship for every rig. #Mining #ZION"

---

## 5. Onboarding

Full onboarding guide: [`docs/WP-Mainet/SulZeme/ZION_ONBOARDING_EN.md`](./docs/WP-Mainet/SulZeme/ZION_ONBOARDING_EN.md).  
Czech version: [`docs/WP-Mainet/SulZeme/ZION_ONBOARDING.md`](./docs/WP-Mainet/SulZeme/ZION_ONBOARDING.md).  
Oasis onboarding: [`docs/WP-Mainet/SulZeme/OASIS_ONBOARDING.md`](./docs/WP-Mainet/SulZeme/OASIS_ONBOARDING.md).

### 5.1 What is ZION in 30 seconds

ZION is an independent Layer 1 blockchain in Rust. Proof-of-Work, ~60s blocks, 144 billion ZION hard cap, no ICO. Every block splits its reward 89/5/5/1 between the miner, humanitarian fund, future fund, and burn. It has its own miner, pool, wallet, bridge, DAO, and game world Oasis.

### 5.2 Three Quick Paths

**Observer — "First I want proof"**
1. Open https://zionterranova.com and watch a new block arrive every minute.
2. Browse the code at https://github.com/Zion-TerraNova/v3-Mainnet — MIT license.
3. Ask in the community channels and check the sources.

**Player — "I want to experience it"**
- Enter **Oasis** at https://oasis.zionterranova.com
- Explore the 3D galaxy, avatar codex, quest log, territory map and leaderboard.
- Log in with a wallet and sync XP.

**Builder — "I want to carry a piece of the bridge"**
```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V31
cargo build --release
./target/release/zion --help
```

Public pool: `62.171.141.136:8444`

### 5.3 Key Numbers

| Field | Value |
|-------|-------|
| Hard cap | 144,000,000,000 ZION |
| Block time | ~60 s |
| Split | 89 % miner, 5 % humanitarian, 5 % future, 1 % burn |
| Public RPC | `rpc.zionterranova.com:8443` |
| Pool | `62.171.141.136:8444` |
| License | MIT |
| Status | Mainnet Beta |

### 5.4 What ZION Does Not Promise

- Not investment advice.
- Not a religious claim.
- Not a finished AAA game — Oasis is a live preview.
- Lost key = lost ZION.

---

## 6. Exchange & Tracker Listings

### 6.1 CoinGecko

Full packet: [`docs/listings/COINGECKO.md`](./docs/listings/COINGECKO.md).

| Field | Value |
|-------|-------|
| Project name | ZION TerraNova |
| Ticker | **ZION** |
| Type | Layer-1 native coin |
| Wrapped token | wZION (ERC-20 on Base) |
| Max supply | 144,000,000,000 ZION |
| Block time | 60 seconds |
| Reward split | 89/5/5/1 |
| Website | https://zionterranova.com |
| GitHub | https://github.com/Zion-TerraNova/v3-Mainnet |
| wZION (Base) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |

### 6.2 CoinMarketCap

Full packet: [`docs/listings/COINMARKETCAP.md`](./docs/listings/COINMARKETCAP.md).

CMC submission: https://support.coinmarketcap.com/hc/en-us/requests/new (select "Add an Asset / Update an Asset").

| Field | Value |
|-------|-------|
| Cryptocurrency name | ZION TerraNova |
| Symbol | **ZION** |
| Asset type | Coin (own Layer-1 blockchain) |
| Consensus | Proof-of-Work (Nakamoto-style) |
| Mining algorithm | Ekam Deeksha / CosmicHarmony |
| Mainnet genesis | 2026-07-06; public launch 2026-12-31 |
| Max supply | 144,000,000,000 ZION |
| Block explorer | https://zionterranova.com/explorer |
| Whitepaper (EN) | https://raw.githubusercontent.com/Zion-TerraNova/v3-Mainnet/main/docs/WP-Mainet/ZION_Mainnet_Whitepaper_v3.0.5_CZ.md |
| GitHub | https://github.com/Zion-TerraNova/v3-Mainnet |

### 6.3 Pre-Submission Checklist

- [ ] 3.2.0 released with multi-platform binaries.
- [ ] Public explorer live and stable.
- [ ] wZION/USDT + wZION/WETH Uniswap V4 pool on Base has meaningful volume/liquidity.
- [ ] Bitcointalk ANN thread live.
- [ ] Twitter / X, Discord, Telegram links active.
- [ ] Whitepaper and GitHub README updated to 3.2.0 status.
- [ ] Circulating supply endpoint verified and documented.

---

## 7. Bitcointalk ANN

Full announcement: [`docs/3.0.5/archive-root-md/BITCOINTALK_ANNOUNCEMENT.md`](./docs/3.0.5/archive-root-md/BITCOINTALK_ANNOUNCEMENT.md).

### 7.1 Recommended Title

`[ANN] ZION TerraNova — Rust PoW Layer-1 | 100-Year Emission | 10% Block Reward for Good`

### 7.2 Post Body (ready to copy)

```text
[ANN] ZION TerraNova — Rust PoW Layer-1 | 100-Year Emission | 10% Block Reward for Good

═══════════════════════════════════════════════════════════════

What is ZION?

ZION TerraNova is a community-built, ASIC-resistant Proof-of-Work Layer-1 blockchain written in Rust.
It replaces Bitcoin-style halvings with a smooth 100-year "Decade Decay" emission and automatically
routes 10% of every block reward to humanitarian and science funds — hardcoded in consensus, not policy.

Key numbers
• Ticker: ZION
• Max supply: 144,000,000,000 ZION (hard cap)
• Premine: 16.78B ZION (transparent on-chain outputs)
• Mining emission: ~127.22B ZION
• Block time: 60 seconds
• Initial reward: 5,400.067 ZION
• Tail emission: ~724.78 ZION/block, perpetual from ~2126
• Consensus: Proof-of-Work, Ekam Deeksha / CosmicHarmony (memory-hard, ASIC-resistant)
• Launch: Fair launch — no ICO, no pre-sale, no private round

Every block reward is split 89/5/5/1:
• 89% to miners (PPLNS)
• 5% to the Humanitarian Fund
• 5% to the Issobella Science & Space Fund
• 1% pool fee, burned by the protocol

═══════════════════════════════════════════════════════════════

Live Mainnet Beta

Network:        ZION TerraNova Mainnet Beta
Public launch:  31 December 2026

Services:
• Website:      https://zionterranova.com
• Explorer:     https://zionterranova.com/explorer
• Dashboard:    https://dashboard.zionterranova.com
• Public RPC:   https://api.zionterranova.com
• Public pool:  pool.zionterranova.com:8444
• Mining:       Stratum, pool.zionterranova.com:8444

═══════════════════════════════════════════════════════════════

Wrapped ZION (wZION) & DeFi

wZION is the bridged ERC-20 representation of native ZION, live on Base:
• wZION: 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
• Uniswap V4 pool (Base): 0xcCEaD51568E8d701f7db7e6699F3986031F07C7B

═══════════════════════════════════════════════════════════════

Why mine or hold ZION?

1. Fair launch — no ICO, no premine for insiders, no VC allocation.
2. ASIC-resistant — consumer CPUs and GPUs stay competitive.
3. 100-year economics — no brutal halving shocks, perpetual tail emission.
4. Built-in impact — 10% of every block reward funds humanitarian and science missions.
5. Open source — MIT licensed, full stack at https://github.com/Zion-TerraNova/v3-Mainnet.

═══════════════════════════════════════════════════════════════

Links

Website:    https://zionterranova.com
Explorer:   https://zionterranova.com/explorer
Whitepaper: https://raw.githubusercontent.com/Zion-TerraNova/v3-Mainnet/main/docs/WP-Mainet/ZION_Mainnet_Whitepaper_v3.0.5_CZ.md
GitHub:     https://github.com/Zion-TerraNova/v3-Mainnet
Discord:    https://discord.gg/zion-terranova
Telegram:   https://t.me/zionterranova

═══════════════════════════════════════════════════════════════

Disclaimer

ZION is experimental, open-source technology released under the MIT license. Mining is active at your own risk.
The network is in Mainnet Beta and may contain bugs. This is not financial advice. Value is not guaranteed.

═══════════════════════════════════════════════════════════════
```

### 7.3 Posting Checklist

- [ ] Register or use an established Bitcointalk account (new accounts cannot post images/links until Jr. Member rank).
- [ ] Create thread in **Announcements (Altcoins)** board: https://bitcointalk.org/index.php?board=159.0
- [ ] Upload project logo or hot-link to `https://zionterranova.com/zion_logo.png`.
- [ ] Enable self-moderation to manage spam.
- [ ] Pin the explorer + whitepaper links in the first post.
- [ ] Add a reply with mining quick-start and pool configuration.

### 7.4 Recommended Tags

`ZION`, `TerraNova`, `PoW`, `mineable`, `ASIC-resistant`, `Layer-1`, `humanitarian`, `DeFi`, `wZION`, `fair launch`, `no ICO`.

---

## 8. Public Links & Resources

| Resource | URL |
|----------|-----|
| Website | https://zionterranova.com |
| Web app | https://app.zionterranova.com |
| Oasis | https://oasis.zionterranova.com |
| Marketplace | https://market.zionterranova.com |
| Explorer | https://zionterranova.com/explorer |
| Dashboard | https://dashboard.zionterranova.com |
| Public RPC | `rpc.zionterranova.com:8443` |
| Public pool | `62.171.141.136:8444` |
| GitHub (public) | https://github.com/Zion-TerraNova/v3-Mainnet |
| Discord | https://discord.gg/zion-terranova |
| Telegram | https://t.me/zionterranova |
| Twitter / X | https://x.com/ZionTerraNova |
| Email | support@zion-blockchain.org |

### Whitepapers

- [`docs/WP-Mainet/ZION_Technical_Whitepaper_v3.1_EN.md`](./docs/WP-Mainet/ZION_Technical_Whitepaper_v3.1_EN.md)
- [`docs/WP-Mainet/ZION_MASTER_WHITEPAPER_3.1_EN.md`](./docs/WP-Mainet/ZION_MASTER_WHITEPAPER_3.1_EN.md)
- [`docs/WP-Mainet/ZION_Mainnet_Whitepaper_v3.0.5_CZ.md`](./docs/WP-Mainet/ZION_Mainnet_Whitepaper_v3.0.5_CZ.md)

---

## 9. Launch Readiness Checklist

### Technical gates

- [ ] 30-day continuous run completed with no critical incident.
- [ ] Real GPU E2E ≥90 % accept rate on at least two reference rigs.
- [ ] Bridge wZION round-trip on Base mainnet verified.
- [ ] No undeclared placeholder addresses in hot paths.
- [ ] Public subtree in sync and clean.
- [ ] Security audit and chaos tests complete.
- [ ] `v3.2.0` GitHub release with multi-platform binaries and SHA256SUMS.

### Marketing gates

- [ ] Press kit and taglines approved.
- [ ] Website, whitepaper and README updated to 3.2.0 / "One Love".
- [ ] Social channels active with launch copy.
- [ ] Oasis onboarding flow tested end-to-end.

### Listing gates

- [ ] CoinGecko submission complete.
- [ ] CoinMarketCap submission complete.
- [ ] Bitcointalk ANN thread live.
- [ ] wZION liquidity pools on Base have meaningful volume.

---

## 10. Canonical References

- Technical plan: [`V31/PLAN_TO_3.2.md`](./V31/PLAN_TO_3.2.md)
- Live status: [`StatusV3.md`](./StatusV3.md) · [`V31/STATUS.md`](./V31/STATUS.md)
- 3.1 plan archive: [`docs/3.1/PLAN_TO_3.1_RECONCILED.md`](./docs/3.1/PLAN_TO_3.1_RECONCILED.md)
- Marketing kit: [`docs/WP-Mainet/marketing/MARKETING_PR_LITE_EN.md`](./docs/WP-Mainet/marketing/MARKETING_PR_LITE_EN.md)
- Onboarding: [`docs/WP-Mainet/SulZeme/ZION_ONBOARDING_EN.md`](./docs/WP-Mainet/SulZeme/ZION_ONBOARDING_EN.md)
- Oasis onboarding: [`docs/WP-Mainet/SulZeme/OASIS_ONBOARDING.md`](./docs/WP-Mainet/SulZeme/OASIS_ONBOARDING.md)
- CoinGecko: [`docs/listings/COINGECKO.md`](./docs/listings/COINGECKO.md)
- CoinMarketCap: [`docs/listings/COINMARKETCAP.md`](./docs/listings/COINMARKETCAP.md)
- Bitcointalk ANN: [`docs/3.0.5/archive-root-md/BITCOINTALK_ANNOUNCEMENT.md`](./docs/3.0.5/archive-root-md/BITCOINTALK_ANNOUNCEMENT.md)
- Agent rules: [`AGENTS.md`](./AGENTS.md) · [`V31/AGENTS.md`](./V31/AGENTS.md)

---

*Generated with [Devin](https://devin.ai) — 2026-08-06*  
*Dedicated to the vision of unity — 3.2.0 "One Love".*
