# 🚀 ZION TerraNova v2.9.6 — Pre-Mainnet Fork

> **"On the Star" — where technology meets spirit, from blockchain to the stars.**

[![Build](https://github.com/Zion-TerraNova/2.9.6/actions/workflows/ci.yml/badge.svg)](https://github.com/Zion-TerraNova/2.9.6/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What is ZION v2.9.6?

ZION is a decentralized Layer 1 blockchain built from scratch in **Rust**. It uses Proof-of-Work consensus with the custom **Cosmic Harmony v3** mining algorithm — designed to be CPU-friendly while supporting GPU acceleration.

**v2.9.6 is a hard fork** extending v2.9.5 with a 6-Layer "On the Star" architecture, a new emission schedule designed for **100+ years**, and dedicated funding for planetary-scale projects.

### Key Properties

| Parameter | v2.9.5 | v2.9.6 |
|-----------|--------|--------|
| **Total Supply** | 144,000,000,000 ZION | 144,000,000,000 ZION (unchanged) |
| **Block Reward** | 5,400.067 ZION (constant) | 5,400.067 → Decade Decay (-20%/10y), tail 725 |
| **Block Time** | 60 seconds | 60 seconds (unchanged) |
| **Mining Horizon** | ~45 years (2026–2071) | **100+ years + tail emission (725 ZION/block)** |
| **Consensus** | Cosmic Harmony v3 | Cosmic Harmony v3 (unchanged) |
| **Transaction Model** | UTXO with Ed25519 | UTXO with Ed25519 (unchanged) |
| **Storage** | LMDB | LMDB (unchanged) |
| **DAA** | LWMA (60-block, ±25%) | LWMA (unchanged) |
| **Fee Policy** | 100% burn | 100% burn (unchanged) |
| **Presale** | ❌ None — Fair Launch | ❌ None (unchanged) |
| **Architecture** | L1 blockchain | **6-Layer "On the Star"** |

### Genesis Premine (unchanged from v2.9.5)

11.31% of total supply (16.28B ZION) is created in the genesis block:

| Category | Amount | Lock |
|----------|--------|------|
| ZION OASIS + Winners Golden Egg/Xp | 8.25B | Immediate |
| DAO Treasury | 4.0B | Immediate |
| Infrastructure | 2.59B | Immediate |
| Humanitarian | 1.44B | Immediate |

All premine is on-chain verifiable and fully unlocked from genesis. Governance managed by DAO.

---

## 6-Layer "On the Star" Architecture

v2.9.6 introduces a layered civilization infrastructure — from blockchain to Earth orbit.

```
                   ╭──────────────────────────╮
              L6   │  🔭  ZION Issobella        │  2040+
                   ╰────────────┬─────────────╯
                   ╭────────────┴─────────────╮
              L5   │  🌍  ZION Free World     │  2030
                   ╰────────────┬─────────────╯
                   ╭────────────┴─────────────╮
              L4   │  🎮  ZION Oasis          │  2029
                   ╰────────────┬─────────────╯
                   ╭────────────┴─────────────╮
              L3   │  🏛️  ZION DAO            │  2028
                   ╰────────────┬─────────────╯
                   ╭────────────┴─────────────╮
              L2   │  🧠  NCL                 │  2027
                   ╰────────────┬─────────────╯
              ╭─────────────────┴─────────────────╮
         L1   │  ⛏️  ZION TerraNova               │  2026
              ╰───────────────────────────────────╯
```

| Layer | Name | Year | Purpose |
|-------|------|------|---------|
| **L1** | **ZION TerraNova** | 2026 | PoW blockchain — Cosmic Harmony v3, UTXO, fee burn, LWMA DAA |
| **L2** | **NCL** (Neural Conscious Layer) | 2028 | AI-native protocol layer, on-chain model registry |
| **L3** | **ZION DAO** | 2027 | Decentralized governance, Treasury (4B ZION), community grants |
| **L4** | **ZION Oasis** | 2029 | Economic ecosystem — Golden Egg, Winners, NFT, Game layer |
| **L5** | **ZION Free World** 🌍 | 2030 | Quantum free energy engine, humanitarian missions, free communities |
| **L6** | **ZION Issobella** 🔭 | 2040+ | Earth orbital observatory & research station |

### What's new in v2.9.6 (L5 & L6)

**L5 — ZION Free World** (2030):
- Research & development of quantum free energy engine
- Decentralized clean energy production
- Humanitarian missions — clean water, education, healthcare
- Free communities — energy-independent, permaculture-based
- Funded by: Humanitarian Tithe (10%) + DAO grants + dedicated L5/L6 fund

**L6 — ZION Issobella** (2040+):
- Earth orbital observatory and research center
- Quantum engine testing in microgravity
- Climate monitoring supporting L5 missions
- Decentralized space program funded by community

> 🏗️ Full architecture spec: [layer-architecture.md](layer-architecture.md)

---

## Tokenomics — Under Discussion

The emission schedule is subject to DAO governance vote. Five proposals:

| Proposal | Principle | Reduction | Tail Emission |
|----------|-----------|-----------|---------------|
| A: Decade Decay | -20% every 10 years | -20% | 725 ZION/block |
| B: Golden Ratio | -25% every 8 years | -25% | 228 ZION/block |
| C: Century Constant | Lower reward, 100yr constant | 0% | 243 ZION/block |
| D: Dual Phase | 10yr bootstrap, then -30% | -30% | 311 ZION/block |
| E: Harmony Curve | Logarithmic decay | continuous | 1,000 ZION/block |

### Immutable Parameters (unchanged from v2.9.5)

| Parameter | Value |
|-----------|-------|
| Total Supply | 144,000,000,000 ZION |
| Genesis Premine | 16,280,000,000 ZION (11.31%) |
| Block Time | 60 seconds |
| Fee Policy | 100% burn (deflationary) |
| Humanitarian Tithe | 5% of block reward |
| L5/L6 Issobella Fund | 5% of block reward |

> 📋 Full tokenomics analysis: [tokenomics.md](tokenomics.md)

---

## Consensus — Cosmic Harmony v3

ZION uses a single PoW algorithm: **Cosmic Harmony v3** (CHv3).

| Parameter | Value |
|-----------|-------|
| Fork height (CHv3) | `0` (genesis) |
| Memory-hard fork | `50,000` (scratchpad aktivace) |
| Scratchpad | 256 KiB, 4 passy, 512 random reads |
| Difficulty adjustment | LWMA, window 60 bloků, ±25% clamp |
| Block time target | 60 sekund |

> 📋 Full specification: [consensus.md](consensus.md)

---

## Mining — Dual-Mining ZION + VRSC

v2.9.6 supports parallel dual-mining:

| Parametr | ZION | VRSC (VerusCoin) |
|----------|------|-------------------|
| Threads | 3T (default) | 1T |
| Algorithm | Cosmic Harmony v3 | VerusHash v2.2 |
| Pool group | `g=zion` | `g=vrsc` |

> 📋 Migration guide: [migration.md](migration.md)

---

## Network

| Node | IP | Role | Ports |
|------|----|------|-------|
| Zion2 (Primary) | 91.98.122.165 | Public host + Pool + Web | P2P 8334, RPC 8444 |
| Internal seeds | — | Seed containers (behind primary) | P2P 8334 |

> 📋 P2P protocol: [p2p.md](p2p.md)

---

## Quick Start

### Run a Full Node

```bash
# Using Docker (recommended)
docker-compose -f docker/docker-compose.mainnet.yml up -d

# From source
cargo build --release
./target/release/zion-core --config config/mainnet.toml
```

### Mine ZION (with dual-mining)

```bash
# CPU mining via pool
./target/release/zion-miner \
  --pool 91.98.122.165:3333 \
  --wallet YOUR_ZION_ADDRESS \
  --worker my-miner \
  --threads 3 \
  --group zion

# VRSC dual-mining (separate thread group)
./target/release/zion-miner \
  --pool 91.98.122.165:3333 \
  --wallet YOUR_VRSC_ADDRESS \
  --worker my-miner-vrsc \
  --threads 1 \
  --algo verushash \
  --group vrsc

# Solo mining
./target/release/zion-miner --solo --rpc localhost:8444
```

### Generate a Wallet

```bash
cargo run --bin wallet-generator
```

---

## Project Structure

```
2.9.6/
├── core/              # Blockchain node (consensus, P2P, storage, RPC)
├── pool/              # Mining pool (Stratum v2, PPLNS)
├── miner/             # Universal miner (CPU + GPU)
├── cosmic-harmony/    # PoW algorithm library (Cosmic Harmony Deeksha)
├── desktop-agent/     # Desktop AI agent
├── config/            # Configuration files (mainnet, testnet, devnet)
├── docker/            # Docker deployment
├── docs/              # Documentation & whitepaper
├── website-v2.9/      # Official website (Next.js)
├── tools/             # CLI utilities
├── legal/             # Legal disclaimers
├── tests/             # Integration & stress tests
└── scripts/           # Operational scripts
```

---

## Documentation

### v2.9.6 Specification

- [Consensus (CHv3)](consensus.md) — 5-fázový pipeline, fork logic, LWMA
- [P2P Protocol](p2p.md) — Peer discovery, block propagation, seed nodes
- [Tokenomics](tokenomics.md) — 5 emission schedule proposals
- [Layer Architecture](layer-architecture.md) — 6-Layer "On the Star" spec
- [Launch Plan](launch-plan.md) — 4-fázový mainnet timeline
- [Migration Guide](migration.md) — v2.9.5 → v2.9.6 přechod
- [Security Audit](audit.md) — Audit stav a plán
- [Changelog](changelog.md) — Kompletní seznam změn

### General

- [Whitepaper v2.9.5](../whitepaper/) — Full technical specification
- [MainNet Constitution](../MAINNET_CONSTITUTION.md) — Immutable protocol parameters
- [Run a Node](../RUN_NODE.md) — Node setup guide
- [Mining Guide](../MINING_GUIDE.md) — CPU/GPU/Pool/Solo mining
- [API Reference](../API_REFERENCE.md) — JSON-RPC endpoints

---

## v2.9.6 Status

> 🎯 **Historical target window: konec 2026**

### Hotovo ✅

- [x] CHv3 unifikace — single PoW algorithm (commit `1934d5d`)
- [x] Pool validator — unified CosmicHarmony = CHv3
- [x] Dual-mining ZION + VRSC (PerMiner groups)
- [x] 6-Layer architecture — dokumentace
- [x] Tokenomics — 5 proposals
- [x] Kompletní docs/v2.9.6 (consensus, p2p, audit, launch-plan, migration, changelog)

### V přípravě ⏳

- [x] Emission schedule selection → **Model A: Decade Decay (-20%/10y)** + 5% humanitarian + 5% L5/L6 Issobella
- [x] L6 space station naming → **ZION Issobella**
- [x] `reward.rs` implementation — Decade Decay + Issobella fund
- [ ] L5/L6 fund in coinbase distribution
- [ ] TestNet fork activation
- [ ] 3rd party security audit (Q3 2026)
- [ ] Tier 5 Exchange listing prep
- [ ] MainNet fork activation

---

## Links

- **Website**: https://zionterranova.com
- **Documentation**: https://zionterranova.com/docs
- **GitHub**: https://github.com/Zion-TerraNova/2.9.6
- **Current public line**: workspace 2.9.6 repo, live 2.9.9 Pure Code release, canonical 2.9.8 Deeksha runtime

---

## Legal

ZION is experimental open-source software. It is not an investment. See [legal/](legal/) for full disclaimers.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

🌟 *"On the Star — building for 100 years, not for a hype cycle."* ⭐
