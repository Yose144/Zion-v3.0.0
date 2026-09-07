# ZION TerraNova — Public Docs Hub

> *"In code we trust. 144B ZION. Not one satoshi more."*
> **Operational note (2026-03-31):** This public documentation entrypoint tracks the controlled V3 test-mainnet rehearsal on the public 2.9.9 Pure Code line over the canonical 2.9.8 Deeksha runtime.

---

## Public line overview

ZION is a decentralized Layer 1 blockchain written in **Rust**. The public launch path is currently operated as a controlled V3 test-mainnet rehearsal with emphasis on verifiability, auditability, and the gradual closure of launch-gate conditions.

Historical 2.9.x materials remain archived. For public reading, the canonical references are currently:

- Live Index at `/docs#live-index`
- V3 Mainnet Whitepaper at `/docs#wp-v3-mainnet`
- Public Launch Path at `/docs#mainnet-plan`

---

## Release lineage (2.9.7 -> 2.9.9)

For the main source line, it is important to read the 2026 progression as a linked trio of release steps:

| Version | Role | What it delivered |
|---------|------|-------------------|
| **v2.9.7** | Pre-MainNet Gate | Stability work, documentation gate, and operational closure without changing the economics baseline |
| **v2.9.8** | Ekam canonical runtime | Runtime unification under the canonical profile |
| **v2.9.9** | Pure Code | Cleanup and migration bridge into the clean V3 mainnet track |

Public docs references:

- `/docs#v297-gate`
- `/docs#v298-canonical`
- `/docs#v299-purecode`

---

## Canonical chain parameters

| Parameter | Mainnet | Testnet |
|-----------|---------|---------|
| **Chain ID** | `zion-mainnet-1` | `zion-testnet-1` |
| **P2P bind** | runtime-configurable | runtime-configurable |
| **RPC bind** | runtime-configurable | runtime-configurable |
| **Algorithm** | Ekam Deeksha v2 | Ekam Deeksha v2 |
| **Block time** | 60 s | 60 s |
| **Block reward** | 5,400.067 -> Decade Decay (-20% / 10 years) | Decade Decay |
| **Tail emission** | 724.784723787776 ZION/block (from ~2126) | 724.784723787776 ZION |
| **DAA** | LWMA (60 blocks, +-25%) | LWMA (60 blocks) |
| **Total emission** | 144B ZION | 144B ZION |
| **Mining horizon** | 100+ years + infinite tail | 100+ years |
| **Fees** | Burned | Burned |
| **Architecture** | 6-layer stack | 6-layer stack |

---

## Block reward distribution

| Recipient | Share |
|-----------|-------|
| ⛏️ Miners | 89% |
| 🕊️ Humanitarian Tithe | 5% |
| 🔭 L5/L6 Issobella Fund | 5% |
| 🏊 Pool Fee | 1% |

---

## 6-layer stack

| Layer | Name | Year | Purpose |
|-------|------|------|---------|
| **L1** | ZION TerraNova ⛓️ | 2026 | PoW blockchain, Ekam Deeksha, UTXO, fee burn |
| **L2** | DeFi + DAO 💱 | 2026–27 | WARP bridge, wZION, governance, treasury |
| **L3** | NCL + WARP + AI-native 🧠 | 2027 | Compute orchestration, cross-chain adapters, agent tooling |
| **L4** | ZION Oasis 🎮 | 2028+ target | XP, game economy, Golden Egg, NFT, non-consensus layer |
| **L5** | ZION Free World 🌍 | 2030 | Quantum energy, humanitarian missions |
| **L6** | ZION Issobella 🔭 | 2040+ | Orbital observatory and research station |

---

## Public genesis reserve summary

ZION uses a **16.78B ZION genesis reserve** to bootstrap the ecosystem. Public docs intentionally avoid wallet-level operational detail in the main entry document.

**Primary strategic envelope:** **5.2B ZION** is reserved for L4 OASIS and game-development bootstrap (4.95B direct OASIS slots + 0.25B ecosystem allocation). An additional **3.3B ZION** (2 slots × 1.65B, repurposed from Slots 4 & 5) is allocated to L5 Free World Projects.

| Bucket | ZION | Purpose |
|--------|------|---------|
| OASIS Golden Egg | 4.95B | L4 reward pool and game-economy reserve |
| Ecosystem bootstrap | 0.25B | Game-dev execution envelope |
| DAO Treasury total | 4.00B | Governance, grants, ecosystem coordination |
| Core development + infrastructure | 2.59B | Runtime, operations, delivery |
| Humanitarian seed | 1.44B | Immediate humanitarian deployment |

XP and consciousness mechanics belong to **L4 OASIS** and do **not** change L1 consensus or mining rewards.

---

## Active public host

| Role | IP | P2P | RPC |
|------|----|-----|-----|
| Zion2 public host | seed.zionterranova.com | :8334 | :8444 |

Internal containers `zion-seed-1` and `zion-seed-2` run behind that host and are not separate public bootstrap entrypoints.

---

## Quick links

- [Live Index →](#live-index)
- [V3 Mainnet Whitepaper →](#wp-v3-mainnet)
- [Public Launch Path →](#mainnet-plan)
- [Release Lineage v2.9.7 →](#v297-gate)
- [Release Lineage v2.9.8 →](#v298-canonical)
- [Release Lineage v2.9.9 →](#v299-purecode)
- [CoinGecko Checklist →](#coingecko-checklist)
- [GitHub — Zion-TerraNova](https://github.com/Zion-TerraNova)
- [Web — zionterranova.com](https://www.zionterranova.com)

---

## Repository map

| Repo | Description |
|------|-------------|
| [2.9.6](https://github.com/Zion-TerraNova/2.9.6) | Main workspace, public line, website, docs, deployment |
| [v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet) | Clean mainnet-track code line |
| [2.9-QuantumLeap](https://github.com/Zion-TerraNova/2.9-QuantumLeap) | Historical Python-era archive |
| [Zion-TestNet2.8.5](https://github.com/Zion-TerraNova/Zion-TestNet2.8.5) | Historical legacy testnet |

---

*ZION TerraNova public docs hub • public release line 2.9.9 Pure Code • canonical runtime 2.9.8 Deeksha/Ekam • updated 31 Mar 2026*