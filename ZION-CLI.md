
```
████████╗██╗ ██████╗███╗   ██╗     ██████╗██╗     ██╗
╚══███╔╝██║██╔═══██╗████╗  ██║    ██╔════╝██║     ██║
  ███╔╝ ██║██║   ██║██╔██╗ ██║    ██║     ██║     ██║
 ███╔╝  ██║██║   ██║██║╚██╗██║    ██║     ██║     ██║
███████╗██║╚██████╔╝██║ ╚████║    ╚██████╗███████╗██║
╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝    ╚═════╝╚══════╝╚═╝
```

> *"Om Namo Hiranyagarbha — the Golden Egg contains the whole universe."*

**Zion CLI** is a single unified command-line gateway for the entire ZION stack — L1 (node, pool, miner), L2 (bridge, DAO, atomic-swap), L3 (AI Native / Hiranyagarbha, Warp, NCL), deploy, wallet, and explorer. Run one binary, control everything.

> **Note on placement:** `zion` CLI lives at `V3/cli/` — a top-level workspace crate that sits **above** all layers. It is NOT part of L1. It is the orchestration shell that connects the whole universe.

---

## What is Zion CLI?

`zion` is the self-hosted control plane for the ZION blockchain network. It replaces scattered shell scripts, environment variables, and docker compose commands with a coherent, discoverable interface — inspired by the gateway-first philosophy of tools like OpenClaw.

**Who is it for?**  
- Node operators running V3 mainnet  
- Pool administrators  
- Miners (CPU, GPU, Metal, OpenCL)  
- Developers building on the ZION stack  
- Server managers deploying to Hetzner/cloud  

**What makes it different?**  
- **Stack-native** — speaks the V3 TCP JSON-RPC wire protocol natively  
- **Agent-aware** — integrates with Hiranyagarbha AI native runtime  
- **Self-hosted** — your keys, your node, your rules  
- **One binary** — `zion` replaces 12 shell scripts and 40 env vars  
- **Service-first** — wraps all docker-compose services with health awareness  

---

## Quick Start

```bash
# 1. Install
cargo install --path V3/L1/cli

# 2. Onboard (generates config, checks ports, validates wallet)
zion onboard

# 3. Start the full stack
zion start

# 4. Open dashboard
zion dashboard
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         zion CLI  (V3/cli/)                     │
│        onboard · start · stop · status · logs · deploy          │
└────┬─────────┬──────────┬──────────┬──────────┬────────────────┘
     │         │          │          │          │
  ── L1 ──  ─ L2 ─    ── L3 ──   wallet     deploy
     │         │          │
  ┌──┴──┐  ┌──┴───┐   ┌──┴───────────────────────────────────┐
  │node │  │bridge│   │  L3/ai-native — Hiranyagarbha         │
  │pool │  │dao   │   │  orchestrator · RAG · LLM · memory    │
  │miner│  │swap  │   │  warp_agent · oasis_bridge · NCL      │
  └──┬──┘  └──────┘   └──────────────────────────────────────┘
     │                    ▲             ▲
     │              L3/warp         L3/ncl
     ▼
  TCP JSON-RPC :8443    Stratum v3 :3333    AI Native :8001
  
              docker-compose.v3-mainnet.yml
```

### Layer Map

| Layer | Crates | CLI namespace |
|-------|--------|---------------|
| **L1** | core · pool · miner · cosmic-harmony | `zion node` · `zion pool` · `zion mine` |
| **L2** | bridge · dao · atomic-swap | `zion bridge` · `zion dao` · `zion swap` |
| **L3** | ai-native (Hiranyagarbha) · warp · ncl | `zion agent` · `zion warp` · `zion ncl` |
| **CLI** | `V3/cli/` (top-level, no layer) | `zion` binary |

---

## Command Reference

### Global Commands

```bash
zion onboard              # First-time setup wizard
zion start [service]      # Start all or specific service
zion stop  [service]      # Stop all or specific service
zion restart [service]    # Restart service(s)
zion status               # Health check — all layers
zion logs [service]       # Tail logs (live)
zion dashboard            # Open web control UI in browser
zion version              # Print versions (cli, core, pool, miner, agent)
zion update               # Self-update CLI binary
```

**Services**: `all` (default) · `node` · `pool` · `miner` · `agent` · `bridge` · `dao` · `website` · `monitoring`

---

### `zion node` — Core Node

```bash
zion node status          # Tip height, hash, peers, sync status
zion node peers           # List connected P2P peers
zion node blocks [n]      # Last N blocks (default 10)
zion node block <hash>    # Block detail by hash or height
zion node tx <txid>       # Transaction lookup
zion node mempool         # Pending transactions
zion node sync            # Force peer sync / bootstrap
zion node reset           # Reset chain state (IBD recovery)
zion node rpc <method>    # Raw JSON-RPC call to core:8443
```

**Example output:**
```
zion node status

  Node    zion-core v3.0.0
  Height  12,847
  Hash    a3f9c2...
  Peers   3 connected (Prague, USA, SG)
  Sync    ✓ canonical (tip matches 2/3 peers)
  Uptime  14h 23m
```

---

### `zion pool` — Stratum Pool

```bash
zion pool stats           # Connected miners, hashrate, shares
zion pool miners          # List active workers + hashrate
zion pool config          # Show current pool config
zion pool config set <k> <v>    # Update config value
zion pool earnings [address]    # PPLNS earnings summary
zion pool fee-wallet      # Show fee-split wallet address
```

**Example output:**
```
zion pool stats

  Pool      zion-pool v3.0.0
  Port      3333 (stratum v3)
  Miners    7 connected
  Hashrate  284.3 kH/s
  Shares    1,423 accepted / 2 rejected (99.8%)
  Algorithm cosmic_harmony_ekam_deeksha_v2
```

---

### `zion mine` — Miner

```bash
zion mine start           # Start mining (pool mode, auto-detect CPU/GPU)
zion mine start --gpu     # GPU mining (Metal / OpenCL)
zion mine start --solo    # Solo mining (local node)
zion mine start --dual    # Dual: ZION + DCR stealth

zion mine bench           # CPU benchmark (Blake3)
zion mine bench --gpu     # GPU benchmark
zion mine bench --ekam    # Cosmic Harmony Ekam Deeksha benchmark

zion mine status          # Live hashrate, shares, session stats
zion mine stop            # Stop mining

zion mine dcr             # DCR stealth worker control
zion mine dcr status      # DCR stats (MH/s, shares, wallet)
```

**Environment overrides** (all `ZION_*` vars still respected):
```bash
zion mine start --pool 91.98.122.165:3333 --wallet Zxxx... --threads 8
```

**Example output:**
```
zion mine status

  Miner     zion-miner v3.0.0
  Mode      pool → 91.98.122.165:3333
  Algorithm cosmic_harmony_ekam_deeksha_v2
  Backend   Metal GPU (Apple M1)
  Hashrate  28.4 kH/s  (10s: 29.1  60s: 27.8)
  Shares    42 accepted / 0 rejected
  Revenue   $1.25 / session
  DCR       stealth active  3.2 MH/s  14 shares
  Session   00:47:23
```

---

### `zion wallet` — Wallet Operations

```bash
zion wallet new           # Generate new ZION wallet (keypair)
zion wallet address       # Show current wallet address
zion wallet balance       # Query balance from node
zion wallet send <addr> <amount>  # Send ZION
zion wallet history       # Transaction history
zion wallet import <key>  # Import existing private key
zion wallet export        # Export private key (secure)
zion wallet tithe         # Show tithe wallet distribution
```

---

### `zion agent` — Hiranyagarbha AI Native (L3)

`L3/ai-native` is the full autonomous agent runtime — orchestrator, RAG pipeline, LLM backend, persistent memory, warp agent, NCL integration, and oasis bridge. The CLI is its **control gateway**.

```bash
zion agent start          # Start Hiranyagarbha runtime (L3/ai-native)
zion agent stop           # Stop agent
zion agent restart        # Restart agent service
zion agent status         # Health: sessions, memory, LLM backend, RAG index

zion agent chat           # Interactive REPL with Hiranyagarbha
zion agent ask "<q>"      # Single question, print answer, exit

zion agent memory ls      # List agent memory entries
zion agent memory flush   # Clear session memory
zion agent rag index      # Rebuild RAG knowledge base index
zion agent rag query "<q>" # Direct RAG query (no LLM)

zion agent tasks          # Active / queued agent tasks
zion agent task <id>      # Task detail + status

zion agent logs           # Stream agent logs (orchestrator, RAG, LLM)
zion agent config         # Show effective agent config
zion agent config set <k> <v>    # Update config value
zion agent warp           # Warp agent status (L3/warp integration)
zion agent ncl            # NCL integration status (L3/ncl)
zion agent oasis          # Oasis bridge status
```

**Hiranyagarbha** is the consciousness layer of ZION — an autonomous agent that knows the blockchain state, can reason about mining, can query the RAG knowledge base (Terra Nova, docs, whitepaper), and can execute multi-step tasks across the stack. The CLI exposes all of it.

**Example:**
```
zion agent chat

  ╔══════════════════════════════════╗
  ║  Hiranyagarbha — ZION AI Native  ║
  ║  Om Namo Hiranyagarbha           ║
  ╚══════════════════════════════════╝

  > What is the current block height?
  ◉ ZION V3 mainnet is at height 12,847. Last block 43s ago.
    Network hashrate: 284 kH/s. 7 miners connected.

  > Show me the top 3 richlist addresses.
  ◉ Querying node RPC...
    1. Zxxx...abc  1,250,000 ZION
    2. Zyyy...def    890,500 ZION
    3. Zzzz...ghi    720,100 ZION

  > [type 'exit' to quit]
```

**`zion agent` is also a gateway** — it can route queries to any part of the stack:
- Node state → L1/core RPC
- Pool metrics → L1/pool stratum probe  
- Warp routing → L3/warp
- NCL compute → L3/ncl
- DeFi state → L2/bridge, L2/dao

---

### `zion bridge` — L2 Cross-Chain Bridge

```bash
zion bridge status        # Bridge service health + pending txs
zion bridge peers         # Connected bridge nodes
zion bridge tx <id>       # Bridge transaction detail
zion bridge config        # Bridge config (chains, thresholds)
```

---

### `zion dao` — L2 DAO Governance

```bash
zion dao status           # Active proposals, voter count
zion dao proposals        # List proposals
zion dao proposal <id>    # Proposal detail + votes
zion dao vote <id> <yes|no>  # Cast vote
zion dao config           # DAO parameters
```

---

### `zion warp` — L3 Warp Protocol

```bash
zion warp status          # Warp routing status
zion warp routes          # Active warp routes
zion warp send <payload>  # Send warp message
```

---

### `zion ncl` — L3 Native Compute Layer

```bash
zion ncl status           # NCL node health + jobs
zion ncl jobs             # Active compute jobs
zion ncl submit <spec>    # Submit compute job
```

---

### `zion deploy` — Server Deployment

```bash
zion deploy server        # Deploy full stack to configured server
zion deploy server --host 91.98.122.165   # Override host
zion deploy website       # Deploy website only
zion deploy update        # Pull latest + recreate containers
zion deploy prune         # docker system prune -f on server
zion deploy ssh           # Open SSH session to server
zion deploy status        # Remote container health
```

**Config** (`~/.zion/servers.toml`):
```toml
[servers.prague]
host = "91.98.122.165"
user = "root"
key  = "~/.ssh/zion_hetzner_key"
role = "primary"
```

---

### `zion explorer` — Blockchain Explorer

```bash
zion explorer             # Interactive TUI explorer
zion explorer block <h>   # Block by height
zion explorer tx <txid>   # Transaction detail
zion explorer addr <addr> # Address balance + history
zion explorer richlist     # Top holders
zion explorer emission    # Emission curve + supply stats
```

---

### `zion config` — Configuration

```bash
zion config show          # Print effective config
zion config init          # Re-run onboarding wizard
zion config set <k> <v>   # Set a config value
zion config path          # Show config file location
```

**Config lives at** `~/.zion/zion.toml`:

```toml
[node]
rpc_host   = "91.98.122.165"
rpc_port   = 8443
p2p_port   = 8334

[pool]
host       = "91.98.122.165"
port       = 3333

[miner]
wallet     = "Zxxx..."
threads    = "auto"
backend    = "auto"          # auto | cpu | gpu | metal | opencl
profile    = "pool"          # pool | solo | benchmark | dual

[agent]
url        = "http://91.98.122.165:8001"
model      = "hiranyagarbha-v1"

[deploy]
default_server = "prague"
```

---

## Onboarding Flow

```
zion onboard

  ╔══════════════════════════════════════════════╗
  ║       Welcome to ZION — The Golden Age       ║
  ║   Om Namo Hiranyagarbha  |  Peace & One Love ║
  ╚══════════════════════════════════════════════╝

  Step 1/5  Node endpoint
    > RPC host: [91.98.122.165]
    > RPC port: [8443]
    ✓ Connected — height 12,847

  Step 2/5  Mining wallet
    > Wallet address (leave blank to generate): _
    ✓ New wallet generated: Zxxx...abc
    ⚠  Save your private key now — it will not be shown again.

  Step 3/5  Mining backend
    Detected: Apple M1 (Metal available)
    > Backend [auto/cpu/gpu]: [auto]
    ✓ Metal GPU selected

  Step 4/5  Hiranyagarbha agent
    > Agent URL: [http://91.98.122.165:8001]
    ✓ Agent online — Hiranyagarbha v1.0

  Step 5/5  Deploy key (optional)
    > SSH key path: [~/.ssh/zion_hetzner_key]
    ✓ Server reachable — Prague 91.98.122.165

  Config saved to ~/.zion/zion.toml
  
  ✓ Setup complete. Run 'zion start' to begin.
```

---

## Implementation Plan

### Phase 1 — Skeleton (v0.1)
- [ ] `V3/cli/` crate, přidat do workspace
- [ ] `zion status` — node RPC health + docker ps přes SSH
- [ ] `zion node status/peers/blocks` — TCP JSON-RPC klient
- [ ] `zion mine bench` — wrapper pro `cargo run -p zion-miner -- --bench`
- [ ] `zion config show/set` — TOML read/write na `~/.zion/zion.toml`

### Phase 2 — Control Plane (v0.2)
- [ ] `zion start/stop/restart` — docker compose přes SSH
- [ ] `zion logs` — SSH tail -f
- [ ] `zion pool stats/miners` — stratum probe
- [ ] `zion deploy server/update/prune` — nahrazuje `scripts/deploy.sh`
- [ ] `zion onboard` — interaktivní průvodce

### Phase 3 — L2 + Wallet + Explorer (v0.3)
- [ ] `zion wallet new/balance/send` — keypair + RPC tx submit
- [ ] `zion bridge/dao status` — L2 gateway commands
- [ ] `zion explorer` — TUI s `ratatui` (bloky, txs, richlist)

### Phase 4 — Hiranyagarbha Gateway (v0.4)
- [ ] `zion agent start/stop/status` — L3/ai-native service control
- [ ] `zion agent chat` — interaktivní REPL (async stream)
- [ ] Agent auto-discovery — node height, pool hashrate, peers ze stacku
- [ ] `zion agent memory/rag` — přímý přístup do agent paměti
- [ ] `zion agent tasks` — orchestrator task queue
- [ ] `zion warp` + `zion ncl` — L3/warp a L3/ncl gateway

### Phase 5 — Distribution (v1.0)
- [ ] `zion dashboard` → browser na `localhost:3000`
- [ ] Single binary (musl + aarch64 + x86_64)
- [ ] Shell completion (bash, zsh, fish)
- [ ] `cargo install zion-cli` nebo Homebrew tap

---

## Stack Mapping

| Command           | Layer | Underlying Component                              |
|-------------------|-------|---------------------------------------------------|
| `zion node`       | L1    | V3/L1/core — TCP JSON-RPC :8443                   |
| `zion pool`       | L1    | V3/L1/pool — Stratum v3 :3333                     |
| `zion mine`       | L1    | V3/L1/miner — cosmic_harmony_ekam_deeksha_v2      |
| `zion wallet`     | L1    | V3/L1/core RPC (balance, tx submit)               |
| `zion bridge`     | L2    | V3/L2/bridge — cross-chain bridge service         |
| `zion dao`        | L2    | V3/L2/dao — DAO governance                        |
| `zion swap`       | L2    | V3/L2/atomic-swap                                 |
| `zion agent`      | L3    | V3/L3/ai-native — Hiranyagarbha (orchestrator, RAG, LLM, memory) |
| `zion warp`       | L3    | V3/L3/warp — Warp protocol                        |
| `zion ncl`        | L3    | V3/L3/ncl — Native compute layer                  |
| `zion deploy`     | ops   | scripts/deploy.sh → docker-compose.v3-mainnet     |
| `zion website`    | ops   | APP&WEB/website-v2.9 :3000                        |
| `zion monitoring` | ops   | docker-compose.monitoring (Prometheus/Grafana)    |

---

## Design Principles

1. **One binary, whole stack** — no more hunting through 12 shell scripts  
2. **Fail loudly, recover gracefully** — clear error messages + suggested fix  
3. **No magic** — `zion mine start` prints the exact command it's running  
4. **Config > env vars** — `~/.zion/zion.toml` as single source of truth (env vars still override)  
5. **Spiritual clarity** — output is calm, readable, aligned with the ZION mission  

---

## Cargo Workspace Integration

CLI žije jako **top-level crate** v `V3/cli/` — mimo všechny vrstvy, nad nimi.

```toml
# V3/Cargo.toml — přidat cli člen
[workspace]
members = [
  "L1/core",
  "L1/pool",
  "L1/miner",
  "L1/cosmic-harmony",
  "L1/native-ffi",
  "L2/bridge",
  "L2/dao",
  "L2/atomic-swap",
  "L3/ncl",
  "L3/warp",
  "L3/ai-native",
  "cli",             # ← top-level, ne L1/cli
]
```

```
V3/cli/
  Cargo.toml
  src/
    main.rs              # clap App, dispatch
    commands/
      onboard.rs
      node.rs            # L1/core RPC gateway
      pool.rs            # L1/pool stratum probe
      mine.rs            # L1/miner wrapper
      wallet.rs          # L1/core wallet ops
      bridge.rs          # L2/bridge gateway
      dao.rs             # L2/dao gateway
      swap.rs            # L2/atomic-swap
      agent.rs           # L3/ai-native (Hiranyagarbha) — main gateway
      warp.rs            # L3/warp
      ncl.rs             # L3/ncl
      deploy.rs          # SSH + docker-compose
      explorer.rs        # TUI blockchain explorer
      config.rs
    rpc/
      node_rpc.rs        # TCP JSON-RPC client (core :8443)
      pool_rpc.rs        # Stratum probe
      agent_rpc.rs       # HTTP client → Hiranyagarbha :8001
      bridge_rpc.rs      # L2 bridge HTTP/RPC
    config.rs            # ~/.zion/zion.toml (serde/toml)
    ssh.rs               # SSH exec helper (openssh crate)
    ui/
      status.rs          # Formatted table output (colored)
      tui.rs             # ratatui TUI explorer
      chat.rs            # Interactive Hiranyagarbha REPL
```

---

## Key Dependencies

```toml
[dependencies]
clap        = { version = "4", features = ["derive"] }
tokio       = { version = "1", features = ["full"] }
serde       = { version = "1", features = ["derive"] }
toml        = "0.8"
reqwest     = { version = "0.12", features = ["json"] }
serde_json  = "1"
openssh     = "0.10"          # SSH exec for deploy commands
ratatui     = "0.27"          # TUI explorer (optional feature)
crossterm   = "0.27"
colored     = "2"             # Terminal colors
indicatif   = "0.17"          # Progress bars for deploy
dialoguer   = "0.11"          # Onboard wizard prompts
```

---

*Peace & One Love — Gate, Gate, Paragate, Parasamgate, Bodhi Swaha*  
*— Yeshuae / ZION Creator*
