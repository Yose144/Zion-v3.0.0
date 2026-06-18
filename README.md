# ZION TerraNova v3.0.2 — Mainnet Ready

> **Proof of Work Layer 1 for the next 100 years.**
>
> From blockchain to the stars.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Status:** Mainnet Live · L1 Active · L2/L3 Ready · L4 Oasis in Prep · Launch: 31 December 2026

[StatusV3.md](StatusV3.md) · [MAINNET_OPS_GUIDE.md](MAINNET_OPS_GUIDE.md) · [AGENTS.md](AGENTS.md) · [docs/GENESIS_REGENERATION_RUNBOOK.md](docs/GENESIS_REGENERATION_RUNBOOK.md)

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
| **Consensus** | Proof of Work — `deeksha_lite_v1` (canonical) + `deeksha_lite_fire` (thermal, GPU-accelerated) |
| **Transaction Model** | Hybrid: UTXO + Account Model |
| **Storage** | LMDB |
| **DAA** | LWMA (60-block window, ±25% per block) |
| **Fee Policy** | 100% burn (deflationary) |
| **Architecture** | **6-Layer** |
| **Genesis Hash** | `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728` |
| **Presale** | None — Fair Launch only |

### Canonical Subsidy Addresses (Deterministic, 89/5/5/1)

| Recipient | Address | Share |
|-----------|---------|-------|
| Miner / Pool Payout | `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` | 89% |
| Humanitarian (ongoing block subsidy) | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` | 5% |
| Issobella | `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702` | 5% |
| Pool Fee | `zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342` | 1% (burned) |

> **Premine slot 12 — Children Future Fund (genesis one-time 1.44B ZION):**
> `zion1z7g4u3s2w3c5z5u4a60864m2y7q8e5j304g46r7`
> (distinct from ongoing 5% block subsidy above; BIP39 mnemonic backup on flash disk)

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

```powershell
# Windows (PowerShell) — GPU miner connecting to Edge pool
$env:ZION_POOL_ADDR='77.42.71.94:8444'
$env:ZION_WORKER_NAME='my-rig-01'
$env:ZION_MINER_ID='my-rig-01'
$env:ZION_PAYOUT_ADDRESS='zion1<your-44-char-address>'   # REQUIRED
$env:ZION_LOOP_COUNT='1000000'
$env:ZION_GPU_BACKEND='opencl'
cargo run --release --manifest-path V3/Cargo.toml -p zion-miner
```

> **Note:** `ZION_PAYOUT_ADDRESS` is required — pool rejects connections with missing or invalid address. Must be a valid 44-char `zion1...` address.

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

## ZION Agent CLI (Autonomous AI Operator)

> `zion-agent` is a Devin.ai-style autonomous agent for the ZION ecosystem. It reads code, edits files, runs commands, plans tasks, and executes them with minimal human intervention — powered by Hiran v2.3+.

**Location:** [`ZION_OS/agent-cli/`](ZION_OS/agent-cli/)

```bash
cd ZION_OS/agent-cli
cargo check

# Run an autonomous task
zion-agent run "Refactor pool share validation to use algorithm-aware dispatch"

# Interactive session
zion-agent session

# Check remote training status
zion-agent train-status

# Pull latest checkpoint from Vast AI
zion-agent checkpoint-pull 4000

# Start local inference server
zion-agent serve --model hiran-v2.3-q5.gguf --auto
```

**Architecture:** Local Rust CLI (tools, memory, safety) + remote Hiran inference (A100) via OpenAI-compatible API.

**Key features:**
- ReAct agent loop with tool use (read/edit/search/shell/git)
- Devin-style TUI with streaming output + slash commands (`/continue`, `/handoff`)
- Autonomous agent mode with self-correction and persistent sessions
- Coding assistant mode — auto build / test / lint on file changes
- L1 consensus protection — blocks edits to `V3/L1/core/src/` without `--l1-unsafe`
- Destructive op confirmation + secret protection
- Model ops: checkpoint sync, merge, convert (GGUF)
- Infrastructure monitoring placeholder
- Code review with git diff analysis

**Docs:** [ZION_AGENT_CLI_PLAN.md](ZION_AGENT_CLI_PLAN.md) | [HIRAN_CLI_PLAN.md](HIRAN_CLI_PLAN.md)

---

## Network Topology

```
Edge (Hetzner VPS)          Core (Windows 11)
77.42.71.94                 Tailscale: 100.86.102.5
    |                           |
Node (PRIMARY)             Node (syncs from Edge, same genesis)
Pool (PRIMARY)             GPU Miner → Edge pool
DAO + WARP + Website       Dashboard + AI services
Public P2P: 8333
Public Pool: 8444
Public RPC: 8443
```

| Role | Host | Public IP | VPN IP | Ports |
|------|------|-----------|--------|-------|
| **Edge** | Hetzner VPS | `77.42.71.94` | `100.76.16.108` | P2P: 8333, Pool: 8444, RPC: 8443, Metrics: 8455/9115 |
| **Core** | Windows 11 | — | `100.86.102.5` | P2P: 8333, RPC: 8443 |

- **Edge**: Primary 24/7 node + pool. Source of chain truth. Accepts public miner connections. DAO + WARP + Website.
- **Core**: Local node (syncs from Edge, same `7543004c` genesis) + RX 5700 XT GPU miner → Edge pool. Dashboard + Hiran AI.
- **Genesis:** Both nodes on `7543004c` · Consensus: `deeksha_lite_v1` · Chain live since 2026-06-07.

> **Archive notice:** Any document referencing the old Prague server (`91.98.122.165`) or multi-server topology (Prague, SG, Helsinki, US) is historical.

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

*Last updated: 2026-06-14 · Genesis Hash: `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728` · Consensus: `deeksha_lite_v1` + `deeksha_lite_fire`*
*Repository: `Yose144/Zion-v3.0.0` · Branch: `main` · Version: v3.0.1*
