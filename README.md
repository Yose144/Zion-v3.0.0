# ZION TerraNova v3.0.0 — Mainnet Ready

> **Proof of Work Layer 1 for the next 100 years.**
>
> From blockchain to the stars.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Status:** Mainnet Ready · Core+Edge topology operational · Genesis: 2026-06-05 · Launch: 31 December 2026

[StatusV3.md](StatusV3.md) · [ROOT_INDEX.md](ROOT_INDEX.md) · [AGENTS.md](AGENTS.md) · [docs/GENESIS_REGENERATION_RUNBOOK.md](docs/GENESIS_REGENERATION_RUNBOOK.md)

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
| **Transaction Model** | Hybrid: UTXO + Account Model |
| **Storage** | LMDB |
| **DAA** | LWMA (60-block window, ±25% per block) |
| **Fee Policy** | 100% burn (deflationary) |
| **Architecture** | **6-Layer** |
| **Genesis Hash** | `d28dc404abfd4e22b313d3a7e8b680453328a77ace68b47466a14d18aff6df5d` |
| **Presale** | None — Fair Launch only |

### Canonical Subsidy Addresses (Deterministic, 89/5/5/1)

| Recipient | Address | Share |
|-----------|---------|-------|
| Miner | `zion1w523a76830x2t5m7f3j023w265e8g5c400a4790` | 89% |
| Humanitarian | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` | 5% |
| Issobella | `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702` | 5% |
| Pool Fee | `zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342` | 1% (burned) |

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

**14 outputs** totalling **11.65%** of total supply (**16.78B ZION**) — on-chain verifiable, unlocked from genesis:

| Category | Amount |
|----------|--------|
| OASIS + Golden Egg | 8.25B |
| DAO Treasury | 4.0B |
| Infrastructure | 2.59B |
| Humanitarian | 1.44B |
| Bridge Seed Fund (account) | 0.4B |
| Bridge Vault UTXO Seed | 0.1B |

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

### Monitor

**Web dashboard:** `http://127.0.0.1:8766` (Python HTTP server)
**Tauri desktop dashboard:** `APP&WEB/desktop-dashboard/` (Rust + React)

```bash
cd APP&WEB/desktop-dashboard
npm install
cargo tauri dev        # dev mode
cargo tauri build      # production build
```

---

## Network Topology

```
Edge (Hetzner VPS)          Core (Windows 11)
77.42.71.94                 100.86.102.5 (Tailscale)
    |                           |
Node 1 (Primary)           Node (Backup — syncs from Edge)
Pool (Primary)             Miner (GPU/CPU → Edge pool)
Public P2P: 8333
Public Pool: 8444
Public RPC: 8443
```

| Role | Host | Public IP | VPN IP | Ports |
|------|------|-----------|--------|-------|
| **Edge** | Hetzner VPS | `77.42.71.94` | `100.76.16.108` | P2P: 8333, Pool: 8444, RPC: 8443, Metrics: 8455 |
| **Core** | Windows 11 | — | `100.86.102.5` | P2P: 8333, RPC: 8443 |

- **Edge**: Primary 24/7 node + pool. Source of truth for chain. Accepts public miner connections.
- **Core**: Local backup node (syncs from Edge) + GPU/CPU miner (connects to Edge pool). Runs dashboard + AI services.

> **Archive notice:** Any document or script referencing the old Prague server (`91.98.122.165`) or multi-server topology (Prague, SG, Helsinki, US) is historical. Current live topology is **Edge-as-Primary + Core-as-Backup only**.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [StatusV3.md](StatusV3.md) | Current status, blockers, audit results, dashboard v3, desktop Tauri |
| [ROOT_INDEX.md](ROOT_INDEX.md) | Complete repository map |
| [AGENTS.md](AGENTS.md) | AI agent operating rules |
| [MAINNET_LAUNCH_SEQUENCE.md](MAINNET_LAUNCH_SEQUENCE.md) | Launch plan |
| [V3/README.md](V3/README.md) | V3 architecture details |
| [V3/ROADMAP.md](V3/ROADMAP.md) | V3 roadmap |
| [docs/GENESIS_REGENERATION_RUNBOOK.md](docs/GENESIS_REGENERATION_RUNBOOK.md) | Genesis key rotation procedures |
| [docs/HIRAN_LOCAL_SETUP.md](docs/HIRAN_LOCAL_SETUP.md) | AI inference setup |
| [V3/docker/DOCKER.md](V3/docker/DOCKER.md) | Docker deployment guide |
| [V3/docker/HARDENING.md](V3/docker/HARDENING.md) | Production hardening |

---

## License

MIT — see [LICENSE](LICENSE).

---

*Last updated: 2026-06-05 · Genesis Hash: `1da02510...cd69f07c7`*
*Repository: `Yose144/Zion-v3.0.0` · Branch: `main` · Version: v3.0.1*
