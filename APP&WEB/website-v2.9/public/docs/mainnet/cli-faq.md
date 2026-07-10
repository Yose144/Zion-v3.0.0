# ZION CLI FAQ (simple)

## What is ZION CLI?

`zion` is a single binary that does everything: wallet, node, miner, pool, status, doctor, monitor.
No eight separate binaries — one file, interactive menu, done.

## Where do I download the binary?

On GitHub Releases:

https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.5-beta

Four platforms: Linux x86_64, macOS Apple Silicon, macOS Intel, Windows x86_64.
For ARM64 (Raspberry Pi), build from source.

## Do I need a GPU for the CLI to work?

No.

Basic operations (`status`, `doctor`, `wallet`, `node`) work without a GPU.
Mining runs on the CPU backend by default.

## What is the very first command after opening a terminal?

```bash
zion
```

Without arguments, the interactive menu opens.
Or the classic way:

```bash
zion doctor
zion status
```

## Can I use the CLI without the interactive menu?

Yes.

The menu is convenient for beginners, but all commands can also be run classically:

```bash
zion wallet new --mnemonic --out my-wallet.json
zion node status
zion mine start --pool stratum+tcp://pool.zionterranova.com:8444 --wallet YOUR_ADDRESS
```

## What layers apply in the documentation?

- L1 = blockchain, pool, miner
- L2 = bridge, DAO, DeFi
- L3 = AI Native, WARP, NCL
- L4 = OASIS
- L5 = Free World
- L6 = Issobella

The community CLI (`zion`) covers L1 (wallet, node, mine, pool).
L2/L3 services are operator-level — they run on the server.

## How do I know whether the problem is in the node or on the web?

Use a quick test:

```bash
zion node status
```

If the node is not running or is crashing, the explorer/web usually has no source from which to read data.

## Which mining algorithms are available?

**Ekam Deeksha** — dual-algo PoW: BLAKE3 + RandomNPU.

Backends:

- `cpu` — default, works everywhere
- `opencl` — Linux/Windows GPU (AMD, NVIDIA)
- `cuda` — NVIDIA GPU (Linux/Windows)
- `metal` — macOS Apple Silicon GPU

## What is the safest routine for a beginner?

Before every bigger action:

1. `zion doctor`
2. `zion status`
3. `zion wallet balance --address YOUR_ADDRESS`

## Is ZION in production?

ZION is in **Mainnet Beta** — the network is running and producing blocks, but it may contain bugs.
Mine and transact at your own risk. Official public launch: **31 December 2026**.

The genesis chain is **permanent** — it will not be reset.

## How do I verify the SHA256 checksum?

```bash
# Linux / macOS
shasum -a 256 zion-cli-linux-x86_64.tar.gz
# Compare with SHA256SUMS.txt

# Windows
Get-FileHash zion-cli-windows-x86_64.zip -Algorithm SHA256
```
