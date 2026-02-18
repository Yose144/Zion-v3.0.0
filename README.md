# 🚀 ZION TerraNova v2.9.6 — "On the Star"

> **From blockchain to the stars — where technology meets spirit.**

[![Build](https://github.com/Zion-TerraNova/2.9.5-NativeAwakening/actions/workflows/ci.yml/badge.svg)](https://github.com/Zion-TerraNova/2.9.5-NativeAwakening/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What is ZION?

ZION is a decentralized Layer 1 blockchain built from scratch in **Rust**. It uses Proof-of-Work consensus with the custom **Cosmic Harmony v3** (CHv3) mining algorithm — CPU-friendly with GPU acceleration support.

**v2.9.6** is a hard fork extending v2.9.5 with a **6-Layer "On the Star" architecture**, a **Decade Decay** emission schedule designed for **100+ years**, and dedicated funding for planetary-scale projects including L6 space station **ZION Issobella**.

---

## Key Properties

| Parameter | Value |
|-----------|-------|
| **Total Supply** | 144,000,000,000 ZION |
| **Block Reward** | 5,400.067 ZION → Decade Decay (-20%/10y), tail 725 ZION |
| **Block Time** | 60 seconds |
| **Mining Horizon** | **100+ years** + perpetual tail emission |
| **Consensus** | Proof of Work — Cosmic Harmony v3 |
| **Transaction Model** | UTXO with Ed25519 signatures |
| **Storage** | LMDB |
| **DAA** | LWMA (60-block window, ±25% per block) |
| **Fee Policy** | 100% burn (deflationary) |
| **Architecture** | **6-Layer "On the Star"** |
| **Presale** | ❌ None — Fair Launch only |

### Block Reward Distribution

| Recipient | Share |
|-----------|-------|
| ⛏️ Miners | 89% |
| 🕊️ Humanitarian Tithe | 5% |
| 🔭 L5/L6 Issobella Fund | 5% |
| 🏊 Pool Fee | 1% |

### Emission Schedule — Decade Decay (Model A)

| Decade | Years | Block Reward | Reduction |
|--------|-------|-------------|-----------|
| D1 | 2026–2036 | 5,400.067 ZION | — |
| D2 | 2036–2046 | 4,320.054 ZION | -20% |
| D3 | 2046–2056 | 3,456.043 ZION | -20% |
| D4 | 2056–2066 | 2,764.834 ZION | -20% |
| D5 | 2066–2076 | 2,211.868 ZION | -20% |
| ... | ... | ... | -20% |
| D11+ | 2126+ | **724.785 ZION** | **tail ∞** |

> Each decade = 5,256,000 blocks. After 10 decades, perpetual tail emission ensures mining never stops.

### Genesis Premine

11.31% of total supply (16.28B ZION) — on-chain verifiable, fully unlocked from genesis:

| Category | Amount |
|----------|--------|
| ZION OASIS + Winners Golden Egg/Xp | 8.25B |
| DAO Treasury | 4.0B |
| Infrastructure | 2.59B |
| Humanitarian | 1.44B |

---

## 6-Layer "On the Star" Architecture

```
                   ╭──────────────────────────╮
              L6   │  🔭  ZION Issobella      │  2040+
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
| **L1** | **ZION TerraNova** ⛏️ | 2026 | PoW blockchain — CHv3, UTXO, fee burn, LWMA DAA |
| **L2** | **NCL** 🧠 | 2027 | Neural Conscious Layer — AI-native protocol, on-chain model registry |
| **L3** | **ZION DAO** 🏛️ | 2028 | Decentralized governance, Treasury (4B ZION), community grants |
| **L4** | **ZION Oasis** 🎮 | 2029 | Economic ecosystem — Golden Egg, Winners, NFT, Game layer |
| **L5** | **ZION Free World** 🌍 | 2030 | Quantum free energy, humanitarian missions, free communities |
| **L6** | **ZION Issobella** 🔭 | 2040+ | Earth orbital observatory & research station |

> 🏗️ Full architecture spec: [docs/v2.9.6/layer-architecture.md](docs/v2.9.6/layer-architecture.md)

---

## Consensus — Cosmic Harmony v3

| Parameter | Value |
|-----------|-------|
| Fork height (CHv3) | `0` (genesis) |
| Memory-hard fork | `50,000` (scratchpad activation) |
| Scratchpad | 256 KiB, 4 passes, 512 random reads |
| Difficulty adjustment | LWMA, window 60 blocks, ±25% clamp |
| Block time target | 60 seconds |

> 📋 Full specification: [docs/v2.9.6/consensus.md](docs/v2.9.6/consensus.md)

---

## Mining — Dual-Mining ZION + VRSC

v2.9.6 supports parallel dual-mining with PerMiner thread groups:

| Parameter | ZION | VRSC (VerusCoin) |
|-----------|------|-------------------|
| Threads | 3T (default) | 1T |
| Algorithm | Cosmic Harmony v3 | VerusHash v2.2 |
| Pool group | `g=zion` | `g=vrsc` |

---

## Network — 🏅 Olympic Coverage (5 Continents, 5 Nodes)

```
           🔵               ⚫               🔴
        ╭──────╮         ╭──────╮         ╭──────╮
       ( EUROPE )───────(AMERICA)───────(  ASIA  )
       ( Helsin)       ( L.A.  )       ( Delhi )
        ╰──┬───╯         ╰──┬───╯         ╰──┬───╯
           │    🟡           │          🟢    │
           │ ╭──────╮        │      ╭──────╮  │
           └─( S.AM. )───────┴──────(OCEANIA)─┘
             (Santia)               (Sydney)
              ╰──────╯               ╰──────╯
```

| Node | Location | IP | Role | Ports |
|------|----------|----|------|-------|
| Helsinki | 🇫🇮 Europe | 77.42.31.72 | Seed + Pool + Web | P2P 8333, RPC 8443 |
| Los Angeles | 🇺🇸 N. America | 149.248.8.4 | Seed | P2P 8333 |
| Santiago | 🇨🇱 S. America | 64.176.13.76 | Seed | P2P 8333 |
| Delhi | 🇮🇳 Asia | 139.84.170.133 | Seed | P2P 8333 |
| Sydney | 🇦🇺 Oceania | 108.61.184.118 | Seed | P2P 8333 |
| TestNet | — | — | — | P2P 8334, RPC 8444 |

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
# CPU mining via pool (3T ZION + 1T VRSC)
./target/release/zion-miner \
  --pool pool.zionterranova.com:3333 \
  --wallet YOUR_ZION_ADDRESS \
  --worker my-miner \
  --threads 3 \
  --group zion

# VRSC dual-mining (separate thread group)
./target/release/zion-miner \
  --pool pool.zionterranova.com:3333 \
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
Zion-2.9.5/
├── L1/                # ⛏️ Blockchain Core (LOCKED for MainNet)
│   ├── core/          #    Blockchain node (consensus, P2P, storage, RPC)
│   ├── pool/          #    Mining pool (Stratum v2, PPLNS)
│   ├── miner/         #    Universal miner (CPU + GPU)
│   ├── cosmic-harmony/#    PoW algorithm library (CHv3)
│   └── native-libs/   #    Native C/Metal/CUDA algorithm libs
├── L2/                # 💱 DeFi & Governance
│   ├── bridge/        #    wZION EVM bridge relay (Rust)
│   ├── contracts/     #    Solidity: wZION ERC-20 + ZIONBridge
│   └── dao/           #    DAO governance (treasury, voting, humanitarian)
├── L3/                # 🧠 Warp & AI
│   ├── warp/          #    Cross-chain bridge (7 chain families)
│   ├── ncl/           #    Neural Compute Layer (AI marketplace)
│   └── ai-native/     #    AI Agent framework (SDK, consciousness)
├── L4/                # 🎮 OASIS
│   └── oasis/         #    Game world (XP, guilds, territories)
├── L5/                # 🌍 ZION Free World (vision 2030)
│   └── README.md      #    Quantum energy, humanitarian missions
├── L6/                # 🔭 ZION Issobella (vision 2040+)
│   └── README.md      #    Earth orbital station
├── config/            # Configuration files (mainnet, testnet, devnet)
├── desktop-agent/     # Desktop AI agent (Electron)
├── docker/            # Docker deployment
├── docs/              # Documentation & whitepaper
├── website-v2.9/      # Official website (Next.js)
├── scripts/           # Operational scripts
├── legal/             # Legal disclaimers
└── tests/             # Integration & stress tests
```

---

## Documentation

### v2.9.6 Specification

- [Consensus (CHv3)](docs/v2.9.6/consensus.md) — 5-phase pipeline, fork logic, LWMA
- [P2P Protocol](docs/v2.9.6/p2p.md) — Peer discovery, block propagation, seed nodes
- [Tokenomics](docs/v2.9.6/tokenomics.md) — Decade Decay emission + 5 proposals
- [Layer Architecture](docs/v2.9.6/layer-architecture.md) — 6-Layer "On the Star" spec
- [Launch Plan](docs/v2.9.6/launch-plan.md) — 4-phase mainnet timeline
- [Migration Guide](docs/v2.9.6/migration.md) — v2.9.5 → v2.9.6 transition
- [Security Audit](docs/v2.9.6/audit.md) — Audit status & plan
- [Changelog](docs/v2.9.6/changelog.md) — Complete list of changes

### General

- [Whitepaper v2.9.5](docs/whitepaper/) — Full technical specification
- [MainNet Constitution](docs/MAINNET_CONSTITUTION.md) — Immutable protocol parameters
- [Run a Node](docs/RUN_NODE.md) — Node setup guide
- [Mining Guide](docs/MINING_GUIDE.md) — CPU/GPU/Pool/Solo mining
- [API Reference](docs/API_REFERENCE.md) — JSON-RPC endpoints

---

## v2.9.6 Status

> 🎯 **MainNet target: December 31, 2026**

### Done ✅

- [x] CHv3 unification — single PoW algorithm
- [x] Pool validator — unified CosmicHarmony = CHv3
- [x] Dual-mining ZION + VRSC (PerMiner groups)
- [x] 6-Layer "On the Star" architecture
- [x] Tokenomics — 5 proposals + Model A selected
- [x] Decade Decay emission — `reward.rs` implementation
- [x] Block reward distribution — 89/5/5/1 (miner/humanitarian/Issobella/pool)
- [x] L6 naming → **ZION Issobella** ✅
- [x] Complete docs/v2.9.6
- [x] Repo reorganized into L1–L6 layer folders
- [x] L5/L6 vision folders with README.md

### In Progress ⏳

- [ ] L5/L6 fund in coinbase distribution
- [ ] TestNet fork activation
- [ ] Tier 5 Exchange listing prep
- [ ] 3rd party security audit (Q3 2026)
- [ ] MainNet fork activation

---

## Links

- **Website**: https://zionterranova.com
- **Documentation**: https://zionterranova.com/docs
- **GitHub**: https://github.com/Zion-TerraNova/2.9.5-NativeAwakening
- **Archive** (v2.9.5): https://github.com/Yose144/Zion-2.9.5

---

## Legal

ZION is experimental open-source software. It is not an investment. See [legal/](legal/) for full disclaimers.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

🌟 *"On the Star — building for 100 years, not for a hype cycle."* ⭐
