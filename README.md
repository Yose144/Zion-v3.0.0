# ZION TerraNova v3.0.0 — Mainnet Ready

> **Proof of Work Layer 1 for the next 100 years.**
>
> From blockchain to the stars.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Status:** Mainnet Ready · Core+Edge topology operational · Launch: 31 December 2026

[StatusV3.md](StatusV3.md) · [ROOT_INDEX.md](ROOT_INDEX.md) · [MAINNET_LAUNCH_SEQUENCE.md](MAINNET_LAUNCH_SEQUENCE.md) · [AGENTS.md](AGENTS.md)

---

## What is ZION?

ZION is a decentralized **Layer 1 blockchain** built from scratch in **Rust**, running a canonical Proof-of-Work consensus with CPU and GPU acceleration.

**v3.0.0** is the clean-room mainnet code line under [`V3/`](V3/). It features a 6-layer architecture, a **Decade Decay** emission schedule designed for **100+ years**, and dedicated funding for planetary-scale humanitarian and space projects.

---

## Key Properties

| Parameter | Value |
|-----------|-------|
| **Total Supply** | 144,000,000,000 ZION |
| **Block Reward** | 5,400.067 ZION → Decade Decay (-20%/10y), tail 725 ZION |
| **Block Time** | 60 seconds |
| **Mining Horizon** | **100+ years** + perpetual tail emission |
| **Consensus** | Proof of Work — Deeksha canonical (`cosmic_harmony`) |
| **Transaction Model** | UTXO with Ed25519 signatures |
| **Storage** | LMDB |
| **DAA** | LWMA (60-block window, ±25% per block) |
| **Fee Policy** | 100% burn (deflationary) |
| **Architecture** | **6-Layer** |
| **Presale** | None — Fair Launch only |

### Block Reward Distribution

| Recipient | Share |
|-----------|-------|
| Miners | 89% |
| Humanitarian Tithe | 5% |
| L5/L6 Issobella Fund | 5% |
| Pool Fee | 1% |

### Emission Schedule — Decade Decay

| Decade | Years | Block Reward |
|--------|-------|-------------|
| D1 | 2026–2036 | 5,400.067 ZION |
| D2 | 2036–2046 | 4,320.054 ZION |
| D3 | 2046–2056 | 3,456.043 ZION |
| D4 | 2056–2066 | 2,764.834 ZION |
| D5 | 2066–2076 | 2,211.868 ZION |
| D11+ | 2126+ | **724.785 ZION** (perpetual tail) |

Each decade = 5,256,000 blocks.

### Genesis Premine

11.31% of total supply (16.28B ZION) — on-chain verifiable, unlocked from genesis:

| Category | Amount |
|----------|--------|
| OASIS + Golden Egg | 8.25B |
| DAO Treasury | 4.0B |
| Infrastructure | 2.59B |
| Humanitarian | 1.44B |

---

## 6-Layer Architecture

```
    ╭──────────────────────────╮
L6  │  ZION Issobella        │  Space station, research
    ╰────────────┬─────────────╯
    ╭────────────┴─────────────╮
L5  │  ZION Free World       │  Humanitarian communities
    ╰────────────┬─────────────╯
    ╭────────────┴─────────────╮
L4  │  ZION OASIS            │  Digital avatars, quests
    ╰────────────┬─────────────╯
    ╭────────────┴─────────────╮
L3  │  ZION WARP             │  Cross-chain relay
    ╰────────────┬─────────────╯
    ╭────────────┴─────────────╮
L2  │  ZION DAO + Bridge     │  Governance, EVM bridge
    ╰────────────┬─────────────╯
╭─────────────────┴─────────────────╮
L1  │  ZION TerraNova          │  Blockchain, mining
    ╰───────────────────────────────────╯
```

| Layer | Path | Status |
|-------|------|--------|
| L1 | [`V3/L1/`](V3/L1/) | Active — Node, pool, miner, cosmic-harmony |
| L2 | [`V3/L2/`](V3/L2/) | Active — DAO, bridge, atomic-swap |
| L3 | [`V3/L3/`](V3/L3/) | Active — WARP cross-chain relay |
| L4 | [`V3/L4/`](V3/L4/) | Active — OASIS avatars, quests, REST API |
| L5 | [`V3/L5/`](V3/L5/) | Active — free-world daemon |
| L6 | [`V3/L6/`](V3/L6/) | Active — issobella daemon |

---

## Quick Start

### Run with Docker

```bash
# Mainnet stack (node + pool + monitoring)
docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d

# With monitoring dashboard
docker compose -f V3/docker/docker-compose.yml --profile mainnet --profile monitoring up -d
```

### Run from Source

```bash
# Build workspace
cargo check --manifest-path V3/Cargo.toml --workspace

# Run node
ZION_NODE_ID=local-node ZION_P2P_BIND=0.0.0.0:8333 ZION_RPC_BIND=0.0.0.0:8443 \
  cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node

# Run pool
ZION_POOL_BIND=0.0.0.0:8444 ZION_NODE_RPC_ADDR=127.0.0.1:8443 \
  cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server

# Unified CLI
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help
```

### Mine

**Pool:** `77.42.71.94:8444` (Edge — public)
**RPC:** `77.42.71.94:8443`

Desktop agent with one-click miner:
```bash
cd APP&WEB/desktop-agent
npm install
npm run build:win    # or :mac, :linux
```

---

## Network Topology

```
Core (Windows 11)          Edge (Hetzner VPS)
100.86.102.5              100.66.162.125
    | Tailscale VPN            |
Node + Pool (Master)    Node + Pool (Relay)
Miner (GPU)               Public P2P: 8333
                          Public Pool: 8444
```

- **Core**: Local node + pool + GPU mining
- **Edge**: Public-facing relay (Prague) — accepts miner connections, relays shares to Core

---

## Documentation

| Document | Purpose |
|----------|---------|
| [StatusV3.md](StatusV3.md) | Current status, blockers, audit results |
| [ROOT_INDEX.md](ROOT_INDEX.md) | Complete repository map |
| [AGENTS.md](AGENTS.md) | AI agent operating rules |
| [MAINNET_LAUNCH_SEQUENCE.md](MAINNET_LAUNCH_SEQUENCE.md) | Launch plan |
| [V3/README.md](V3/README.md) | V3 architecture details |
| [V3/ROADMAP.md](V3/ROADMAP.md) | V3 roadmap |
| [V3/docker/DOCKER.md](V3/docker/DOCKER.md) | Docker deployment guide |
| [V3/docker/HARDENING.md](V3/docker/HARDENING.md) | Production hardening |

---

## License

MIT — see [LICENSE](LICENSE).

---

*Last updated: 2026-05-23*
*Repository: `Yose144/2.9.6` · Branch: `main` · Version: v3.0.0*
