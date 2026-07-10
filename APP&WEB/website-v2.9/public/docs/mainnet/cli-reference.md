# ZION CLI Reference (praktická)

Tento dokument je "tahák" s konkrétními příkazy.

Pokud jsi začátečník, používej nejdřív `Guide`, potom tento seznam.

## 1) Základní kontrola

```bash
zion status
zion doctor
zion monitor
```

- `status` — celkový stav sítě a tvého uzlu
- `doctor` — rychlá zdravotní kontrola (config, endpointy, připravenost)
- `monitor` — live dashboard s hashrate a zůstatkem

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

Backendy:

- `cpu` — výchozí, funguje všude
- `opencl` — Linux/Windows GPU (AMD, NVIDIA)
- `cuda` — NVIDIA GPU (Linux/Windows)
- `metal` — macOS Apple Silicon GPU

## 6) AI (volitelné)

```bash
zion ai ask "What is the current block height?"
zion ai chat
```

## 7) Interaktivní menu

```bash
zion
zion menu
```

Menu tě provede: wallet → node → pool → miner, krok za krokem.

## 8) Verze a pomoc

```bash
zion --version
zion --help
zion wallet --help
zion mine --help
```

## 9) Build ze zdrojů (ARM64, vlastní build)

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release -p zion-public
# Binary → target/release/zion
```

## 10) Platformy

| Platforma | Stav | Soubor |
|-----------|------|--------|
| Linux x86_64 | ✅ Pre-built | `zion-cli-linux-x86_64.tar.gz` |
| macOS Apple Silicon (M1–M4) | ✅ Pre-built | `zion-cli-macos-aarch64.tar.gz` |
| macOS Intel x86_64 | ✅ Pre-built | `zion-cli-macos-x86_64.tar.gz` |
| Windows x86_64 | ✅ Pre-built | `zion-cli-windows-x86_64.zip` |
| Linux ARM64 | 🔧 Build ze zdrojů | `cargo build --release -p zion-public` |

Stažení: https://github.com/Zion-TerraNova/v3-Mainnet/releases
