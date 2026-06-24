# ZION Public CLI

Community edition of the ZION CLI — wallet, node, miner, AI, status & doctor.
No deploy, no DAO, no bridge, no internal services. Just what a public user needs.

## Structure

```
PUBLIC/
  cli/              Rust crate (zion-public)
    Cargo.toml
    src/
      main.rs       Entry point + interactive menu
      lib.rs        CLI definition (clap)
      config.rs     ~/.zion/zion.toml loader
      ui.rs         Colored terminal output
      process.rs    Generic process manager (PID, start/stop/status)
      menu.rs       Interactive arrow-key menu
      commands/
        wallet.rs   new, import, balance, send, address, info, reveal
        node.rs     start, stop, status, info, chain, peers, supply, mempool
        mine.rs     start, stop, status (auto-starts node/pool if needed)
        pool.rs     start, stop, status (local solo mining pool)
        monitor.rs  Live stack monitor: node + pool + miner + chain height
        ai.rs       chat, ask, status (Hiran OpenAI-compatible endpoint)
        doctor.rs   preflight diagnostics
        status.rs   network health check
```

## Build

From the repo root (the root `Cargo.toml` workspace includes `PUBLIC/cli`):

```bash
# Debug check
cargo check -p zion-public

# Release binary → target/release/zion.exe (Windows) or target/release/zion (Unix)
cargo build --release -p zion-public
```

The binary is named `zion` — same as the operator CLI. It links the same
`zion-core` and `zion-sdk` crates, so wallet files and crypto are byte-exact
compatible with the operator CLI.

## Commands

```
zion                        Interactive arrow-key menu

zion wallet new             Generate a new wallet (Ed25519 + optional BIP39 mnemonic)
zion wallet balance         Check balance (account + UTXO)
zion wallet send --to ...   Send ZION to an address
zion wallet address         Show configured wallet address

zion node start             Start a local ZION node (uses zion-node binary)
zion node stop              Stop the local node
zion node status            Show local node process status
zion node info              Node info (version, network, peers)
zion node chain             Chain info (height, tip hash, mempool)
zion node peers             Connected peers
zion node supply            Supply info (total, mined, remaining, reward)

zion pool start             Start a local mining pool
zion pool stop              Stop the local pool
zion pool status            Show local pool process status

zion mine start             Start mining (auto-starts node if miner.auto_start_node is true)
zion mine start --auto-node Start node first, then start miner
zion mine start --auto-pool Start node + pool first, then miner
zion mine stop              Stop running miner
zion mine status            Check if miner is running

zion monitor                Live stack monitor: node + pool + miner + chain height

zion ai chat                Interactive chat with Hiran AI
zion ai ask "question"      Single question to Hiran
zion ai status              Check Hiran AI endpoint health
zion status                 Network health check (node, pool, AI, website, explorer)
zion doctor                 Preflight diagnostics (config, connectivity, wallet, miner)
zion version                Print version
zion completions <shell>  Print shell completion script
```

## Configuration

Config file: `~/.zion/zion.toml`

```toml
[node]
rpc_host = "127.0.0.1"      # RPC address for queries
rpc_port = 8443
p2p_bind = "0.0.0.0:8333"     # only used when starting a local node
node_id = "zion-public-node"  # only used when starting a local node
seed_peers = "77.42.71.94:8333" # bootstrap for local node

[pool]
host = "77.42.71.94"        # public Edge pool
port = 8444
bind = "0.0.0.0:8444"         # local pool bind

[miner]
wallet = ""                  # your zion1... address
algorithm = "deeksha_lite_v1"
backend = "cpu"              # cpu | opencl | cuda | metal
worker_name = "worker-1"
auto_start_node = true       # if true, `zion mine start` auto-starts a local node
auto_start_pool = false      # if true, `zion mine start` auto-starts a local pool

[ai]
url = "http://77.42.71.94:8080"   # Hiran inference endpoint
model = "hiran-v2.2"

[binaries]
node = "zion-node-windows-x86_64.exe"   # optional: explicit paths
pool = "zion-pool-windows-x86_64.exe"
miner = "zion-miner-windows-x86_64.exe"
```

Set values from CLI:
```bash
zion config set miner.wallet zion1youraddress...
zion config set node.rpc_host 127.0.0.1
zion config set miner.auto_start_node true
```

## E2E autonomous workflow

The public CLI can run the whole ZION stack locally:

```bash
# 1. Create wallet
zion wallet new --mnemonic --set-default

# 2. Start node
zion node start

# 3. Start miner (will auto-start the node first if miner.auto_start_node=true)
zion mine start --auto-node

# 4. Monitor everything
zion monitor

# 5. Stop
zion mine stop
zion node stop
```

Binaries are discovered automatically in this order:
1. Explicit paths in `~/.zion/zion.toml` `[binaries]` section
2. Same folder as the `zion` executable
3. `~/.zion/`
4. `PATH` (for non-generic names like `zion-miner`, `zion-node`)
5. `../../target/release` (development)

The CLI never picks a generic name like `node` from PATH — this avoids accidentally starting Node.js.

## Download bundle

For a fully standalone setup, download all four Windows binaries into the same folder:

- `zion-windows-x86_64.exe` — the CLI
- `zion-node-windows-x86_64.exe` — local node
- `zion-pool-windows-x86_64.exe` — local pool
- `zion-miner-windows-x86_64.exe` — miner

## What's NOT in the public CLI

The following commands from the operator CLI are **excluded** from the public build:

- `deploy` — server deployment, SSH, Docker orchestration
- `bridge` — L2 bridge gateway
- `dao` — L2 DAO governance
- `swap` — L2 DeFi swap aggregator
- `atomic-swap` — L2 HTLC cross-chain
- `warp` — L3 cross-chain relay
- `ncl` — L3 Neural Compute Layer
- `topology` — core+edge topology operations
- `free-world` — L5 humanitarian layer
- `issobella` — L6 space layer
- `compose` — Docker Compose integration
- `explorer` — block explorer TUI
- `onboard` — first-time setup wizard
- `update` — auto-update mechanism

## Distribution

The release binary is a standalone `.exe` (Windows) or ELF binary (Linux/macOS).
No runtime dependencies needed — all crypto is compiled in via `zion-core`.

Build artifacts for distribution:
- `zion-windows-x86_64.exe`
- `zion-node-windows-x86_64.exe`
- `zion-pool-windows-x86_64.exe`
- `zion-miner-windows-x86_64.exe`
- `zion-linux-x86_64`
- `zion-linux-arm64`
- `zion-macos-arm64`

Each binary should be accompanied by a `.sha256` checksum file.
