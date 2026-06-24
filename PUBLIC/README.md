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
      commands/
        wallet.rs   new, import, balance, send, address, info, reveal
        node.rs     info, chain, peers, supply, mempool (read-only)
        mine.rs     start, stop, status (manages zion-miner subprocess)
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
zion node info              Node info (version, network, peers)
zion node chain             Chain info (height, tip hash, mempool)
zion node peers             Connected peers
zion node supply            Supply info (total, mined, remaining, reward)
zion mine start             Start mining (spawns zion-miner subprocess)
zion mine stop              Stop running miner
zion mine status            Check if miner is running
zion ai chat                Interactive chat with Hiran AI
zion ai ask "question"      Single question to Hiran
zion ai status              Check Hiran AI endpoint health
zion status                 Network health check (node, pool, AI, website, explorer)
zion doctor                 Preflight diagnostics (config, connectivity, wallet, miner)
zion version                Print version
zion completions <shell>    Print shell completion script
```

## Configuration

Config file: `~/.zion/zion.toml`

```toml
[node]
rpc_host = "77.42.71.94"    # public Edge node
rpc_port = 8443

[pool]
host = "77.42.71.94"        # public Edge pool
port = 8444

[miner]
wallet = ""                  # your zion1... address
algorithm = "deeksha_lite_v1"
backend = "cpu"              # cpu | opencl | cuda | metal
worker_name = "worker-1"

[ai]
url = "http://77.42.71.94:8080"   # Hiran inference endpoint
model = "hiran-v2.2"
```

Set values from CLI:
```bash
zion config set miner.wallet zion1youraddress...
zion config set node.rpc_host 77.42.71.94
```

## What's NOT in the public CLI

The following commands from the operator CLI are **excluded** from the public build:

- `deploy` — server deployment, SSH, Docker orchestration
- `start` / `stop` / `restart` / `logs` — service management
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
- `monitor` — live stack monitor TUI
- `explorer` — block explorer TUI
- `onboard` — first-time setup wizard
- `update` — auto-update mechanism

## Distribution

The release binary is a standalone `.exe` (Windows) or ELF binary (Linux/macOS).
No runtime dependencies needed — all crypto is compiled in via `zion-core`.

Build artifacts for distribution:
- `zion-windows-x86_64.exe`
- `zion-linux-x86_64`
- `zion-linux-arm64`
- `zion-macos-arm64`

Each binary should be accompanied by a `.sha256` checksum file.
