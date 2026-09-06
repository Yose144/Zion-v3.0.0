# 🚀 ZION TerraNova v2.9.6 — "On the Star" repo /// dir V3 Mainet" 

> **From blockchain to the stars — where technology meets spirit.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Status (May 2026):** V3 mainnet READY FOR LAUNCH (31.12.2026). Genesis + fee split konfigurace dokončena. Core+Edge topologie aktivní a synchronizovaná. Dashboard s Launch Day automation běží lokálně. GPU mining ověřen (AMD RX 5600 XT ~5-10 KH/s). L2 wZION bridge to Base operational. DeFi/Explorer stack ready — see [DEFI_ROADMAP.md](DEFI_ROADMAP.md).
> Active development: [V3/](V3/) - clean-room mainnet code. Legacy root tree is reference/archive only.
> **Lost?** See the complete repository map: [`ROOT_INDEX.md`](ROOT_INDEX.md)
> **Mainnet Launch:** [MAINNET_LAUNCH_SEQUENCE.md](MAINNET_LAUNCH_SEQUENCE.md) | **Status:** [StatusV3.md](StatusV3.md) | **Dashboard:** [DASHBOARD_AUTOSTART.md](DASHBOARD_AUTOSTART.md)

---

## What is ZION?

ZION is a decentralized Layer 1 blockchain built from scratch in **Rust**. Live mainnet mining runs the single-track Deeksha canonical PoW path (`cosmic_harmony`) with CPU and GPU acceleration.

**v2.9.6** is a hard fork extending v2.9.5 with a **6-Layer "On the Star" architecture**, a **Decade Decay** emission schedule designed for **100+ years**, and dedicated funding for planetary-scale projects including L6 space station **ZION Issobella**.

**V3** is the active clean-room mainnet code line under `V3/`. See [V3/README.md](V3/README.md) and [V3/ROADMAP.md](V3/ROADMAP.md) for current implementation status.

---

## Key Properties

| Parameter | Value |
|-----------|-------|
| **Total Supply** | 144,000,000,000 ZION |
| **Block Reward** | 5,400.067 ZION → Decade Decay (-20%/10y), tail 725 ZION |
| **Block Time** | 60 seconds |
| **Mining Horizon** | **100+ years** + perpetual tail emission |
| **Consensus** | Proof of Work - Deeksha canonical (`cosmic_harmony`) |
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

11.65% of total supply (16.78B ZION) — on-chain verifiable, fully unlocked from genesis:

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
| **L1** | **ZION TerraNova** ⛏️ | 2026 | PoW blockchain - Deeksha canonical (`cosmic_harmony`), UTXO, fee burn, LWMA DAA |
| **L2** | **ZION DAO & Bridge** 🏛️ | 2027 | Governance (proposals, treasury, Co-Admins, consent), cross-chain bridge, HTLC swaps |
| **L3** | **ZION NCL & WARP** 🧠 | 2028 | Neural Conscious Layer, universal cross-chain bridge (7 adapters), AI-native agents |
| **L4** | **ZION Oasis** 🎮 | 2029 | Economic ecosystem — Golden Egg, Winners, NFT, Game layer |
| **L5** | **ZION Free World** 🌍 | 2030 | Humanitarian grants, projects, free energy research (daemon: zion-free-world) |
| **L6** | **ZION Issobella** 🔭 | 2040+ | Earth orbital observatory & research station (daemon: zion-issobella) |

> 🏗️ Full architecture spec: [docs/v2.9.6/layer-architecture.md](docs/v2.9.6/layer-architecture.md)

---

## Consensus - Live Canonical Path

| Parameter | Value |
|-----------|-------|
| PoW path | Deeksha canonical (`cosmic_harmony`) |
| Activation | Genesis (`height 0`) |
| Difficulty adjustment | LWMA, window 60 blocks, +/-25% clamp |
| Block time target | 60 seconds |
| Transaction model | UTXO + Ed25519 signatures |

> 📋 Historical baseline spec (v2.9.6): [docs/v2.9.6/consensus.md](docs/v2.9.6/consensus.md)
>  
> 📋 Active implementation status: [V3/README.md](V3/README.md), [V3/ROADMAP.md](V3/ROADMAP.md)

---

## Mining — Current Live Path

ZION mainnet runs the single-track Deeksha canonical PoW path (`cosmic_harmony`).

**Local GPU mining (verified):**
- **AMD RX 5600 XT** via OpenCL — **~5–10 KH/s** sustained (Windows 11)
- Backend: `opencl`, device `gfx1010:xnack-`
- Pool: local `127.0.0.1:8444` (master) + Edge relay `100.66.162.125:8444`

**Remote pool-mining servers:**
- **Edge** (77.42.71.94) — Hetzner VPS, pool relay + public P2P

> ✅ Core + Edge topologie: Core PC (lokální, source of truth) + Edge VPS (Hetzner, public relay). Všechny starší servery (Praha, USA, Singapore, Helsinki) byly vyřazeny.

Desktop-agent Ekam Deeksha native GPU path is verified on Apple Silicon Metal (~5575.5 H/s benchmark).

---

## Network — Live Mainnet Topology (May 2026)

| Node | Location | IP / Tailscale | Role |
|------|----------|----------------|------|
| Core (Windows 11) | Local | 100.86.102.5 | Node1 + Node2 + Pool Master + GPU Miner + Dashboard + Zálohy |
| Edge | Hetzner EU | 100.66.162.125 | Node (relay) + Pool (relay) + Public P2P |

**Ports:**
- P2P: `8333` (node1), `8334` (node2)
- RPC: `8443` (node1), `8446` (node2)
- Stratum: `8444` (pool)
- Dashboard: `8766` (local operator UI)
- WebSocket: `8445`

---

## Quick Start

### Run a Full Node

```bash
# Using Docker (recommended, V3 mainnet)
docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d

# From source (V3 workspace)
cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node -- --config config/mainnet.toml

# Windows local stack (PowerShell)
.\scripts\launch-stack.ps1
```

### Mine ZION

```bash
# Pool mining (V3 canonical path)
cargo run --release --manifest-path V3/Cargo.toml -p zion-miner -- \
     --pool 127.0.0.1:8444 \
  --wallet YOUR_ZION_ADDRESS \
  --worker my-miner \
  --threads 3 \
     --algo cosmic_harmony

# Solo mining
cargo run --release --manifest-path V3/Cargo.toml -p zion-miner -- --solo --rpc 127.0.0.1:8443
```

### Dashboard (Operator UI)

```bash
# Windows — spusť a otevři v prohlížeči:
start-dashboard.bat
# http://127.0.0.1:8766
```

### Generate a Wallet

```bash
cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin wallet
```

---

## Project Structure

```
2.9.6/
├── V3/                # 🚀 Active mainnet code (clean-room)
│   ├── L1/            #    Blockchain core, pool, miner, hashing
│   ├── L2/            #    Bridge relay, smart contracts
│   └── ROADMAP.md     #    Source of truth for V3 progress
├── L1/                # ⛏️ Legacy Blockchain Core (reference)
├── L2/                # 💱 Legacy DeFi & Governance (reference)
├── L3/                # 🧠 AI-Native / Warp / NCL
├── L4/                # 🎮 OASIS
├── L5/                # 🌍 ZION Free World (vision 2030)
├── L6/                # 🔭 ZION Issobella (vision 2040+)
├── APP&WEB/               # Frontend applications
│   ├── zion-wallet-sdk/ #    Unified TypeScript Wallet SDK (address, keypair, crypto, tx, RPC)
│   ├── desktop-agent/   #    Electron desktop agent + mining GUI
│   ├── mobile-app/      #    React Native + Expo mobile app
│   └── website-v2.9/    #    Next.js 16 website + explorer + wallet
├── config/            # Configuration files (mainnet, testnet, devnet)
├── docker/            # Docker deployment (compose files, Dockerfiles)
├── docs/              # Documentation, whitepapers, roadmaps
├── scripts/           # Operational & deployment scripts
├── legal/             # Legal disclaimers
└── tests/             # Integration & stress tests
```

---

## Documentation

- [V3/ROADMAP.md](V3/ROADMAP.md) — Active V3 mainnet progress
- [docs/DEFI_FULL_ROADMAP.md](docs/DEFI_FULL_ROADMAP.md) — DeFi ecosystem roadmap
- [docs/MAINNET_CONSTITUTION.md](docs/MAINNET_CONSTITUTION.md) — Immutable protocol parameters
- [docs/v2.9.6/](docs/v2.9.6/) — v2.9.6 specification (consensus, P2P, tokenomics, layers)
- [docs/whitepaper/](docs/whitepaper/) — Full technical whitepaper
- [docs/2.9.7/](docs/2.9.7/) — Pre-MainNet gate documentation
- [docs/2.9.8/](docs/2.9.8/) — Deeksha canonical release documentation
- [docs/2.9.9/](docs/2.9.9/) — Pure-code cleanup and migration

---

## Current Status (May 2026)

> 🎯 **MainNet target: December 31, 2026**

### Live ✅

- [x] V3 clean-room mainnet running on Core + Edge topology
- [x] CHv3 PoW consensus — single Deeksha canonical path (TX_HASH_V2 + BODY_ROOT_V2 from genesis)
- [x] Mining pool with PPLNS, fee-split (89/5/5/1), LWMA DAA
- [x] Decade Decay emission — `reward.rs` implementation
- [x] L2 wZION bridge to Base — lock→relay→mint + burn→unlock both operational
- [x] Bridge validator 3/5 multisig config (production-ready, HSM placeholders)
- [x] Smart contracts deployed on Base (wZION, ZIONBridge, ZIONStaking, ZIONGovernance, ZIONFarm)
- [x] Website with block explorer (blocks, TX, addresses, richlist, search)
- [x] **Explorer Pro** — Bridge tracker, Mempool viewer, Network stats, Supply dashboard, UTXO view
- [x] **DeFi Hub** — Swap widget, Bridge burn widget, Staking/DAO/Farming pages, live price feed
- [x] Swap Aggregator backend (Rust/Axum — quote/swap/status API + SQLite pipeline orchestration)
- [x] Desktop agent (Electron) — mining GUI + wallet
- [x] Mobile app (React Native + Expo) — 9 screens
- [x] ZION Wallet SDK (TypeScript) — unified address/keypair/crypto/tx/RPC across web, desktop, mobile
- [x] 6-Layer "On the Star" architecture
- [x] 1,470+ tests passing, 157+ bridge tests, E2E burn→unlock coverage

### In Progress ⏳

- [ ] Bridge monitoring dashboard (Grafana)
- [ ] Uniswap V3 seed liquidity (wZION/WETH)
- [ ] Desktop/Mobile bridge + swap UX
- [ ] 3rd party security audit (Q3 2026)
- [ ] Best-route calculation (multi-hop swap aggregator)

### Roadmaps

- [V3/ROADMAP.md](V3/ROADMAP.md) — V3 mainnet implementation progress
- [docs/DEFI_FULL_ROADMAP.md](docs/DEFI_FULL_ROADMAP.md) — Full DeFi ecosystem roadmap (6 waves)
- [docs/MAINNET_CONSTITUTION.md](docs/MAINNET_CONSTITUTION.md) — Immutable protocol parameters

---

## Links

- **Website**: https://zionterranova.com
- **Explorer**: https://zionterranova.com/explorer
- **GitHub**: https://github.com/Yose144/2.9.6

---

## Legal

ZION is experimental open-source software. It is not an investment. See [legal/](legal/) for full disclaimers.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

🌟 *"On the Star — building for 100 years, not for a hype cycle."* ⭐
