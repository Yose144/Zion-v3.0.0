# ZION CLI Reference (practical)

This document is a "cheat sheet" with concrete commands.

If you are a beginner, use the `Guide` first, then this list.

## 1) Basic check

```bash
zion status
zion doctor
zion monitor
```

- `status` — overall state of the network and your node
- `doctor` — quick health check (config, endpoints, readiness)
- `monitor` — live dashboard with hashrate and balance

## 2) Wallet

```bash
zion wallet new --mnemonic --out my-wallet.json --print
zion wallet balance --address YOUR_ADDRESS
zion wallet send --to RECIPIENT --amount 1.5
zion wallet import --file my-wallet.json
zion wallet address
```

## 3) Node

```bash
zion node status
zion node peers
zion node sync
zion node start
zion node stop
```

## 4) Pool

```bash
zion pool stats
zion pool connect --pool stratum+tcp://pool.zionterranova.com:8444
```

## 5) Miner

```bash
zion mine status
zion mine bench
zion mine bench --ekam --backend opencl --work-size 8192
zion mine start --pool stratum+tcp://pool.zionterranova.com:8444 --wallet YOUR_ADDRESS
zion mine start --backend cuda
zion mine start --backend metal
zion mine stop
```

Backends:

- `cpu` — default, works everywhere
- `opencl` — Linux/Windows GPU (AMD, NVIDIA)
- `cuda` — NVIDIA GPU (Linux/Windows)
- `metal` — macOS Apple Silicon GPU

## 6) AI (optional)

```bash
zion ai ask "What is the current block height?"
zion ai chat
```

## 7) Interactive menu

```bash
zion
zion menu
```

The menu guides you through: wallet → node → pool → miner, step by step.

## 8) Version and help

```bash
zion --version
zion --help
zion wallet --help
zion mine --help
```

## 9) Build from source (ARM64, custom build)

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release -p zion-public
# Binary → target/release/zion
```

## 10) Platforms

| Platform | Status | File |
|----------|--------|------|
| Linux x86_64 | ✅ Pre-built | `zion-cli-linux-x86_64.tar.gz` |
| macOS Apple Silicon (M1–M4) | ✅ Pre-built | `zion-cli-macos-aarch64.tar.gz` |
| macOS Intel x86_64 | ✅ Pre-built | `zion-cli-macos-x86_64.tar.gz` |
| Windows x86_64 | ✅ Pre-built | `zion-cli-windows-x86_64.zip` |
| Linux ARM64 | 🔧 Build from source | `cargo build --release -p zion-public` |

Download: https://github.com/Zion-TerraNova/v3-Mainnet/releases
