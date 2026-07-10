# ZION CLI Guide (for absolute beginners)

## What is ZION CLI

`zion` is a single binary that does everything:

- **Wallet** — create, manage, send ZION
- **Node** — run a full L1 node, sync with the network
- **Miner** — mine on CPU or GPU (Ekam Deeksha BLAKE3 + RandomNPU)
- **Pool** — connect to a pool, watch statistics
- **Status** — overall state of the network and your node
- **Doctor** — quick health check
- **Monitor** — live dashboard with hashrate and balance

If you are a complete beginner: think of it as a "control panel in the terminal".

---

## What you need before the first run

Minimum:

1. Open Terminal (macOS) / PowerShell (Windows) / shell (Linux).
2. Download the `zion` binary from [GitHub Releases](https://github.com/Zion-TerraNova/v3-Mainnet/releases).
3. No Rust compiler is needed — the binary is ready.

For ARM64 (Raspberry Pi, AWS Graviton) you need to build from source:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release -p zion-public
# Binary → target/release/zion
```

---

## Easiest first run

After extracting the archive:

```bash
./zion
```

Without arguments, an interactive menu with arrow keys opens.

---

## Interactive menu

Running `zion` without arguments opens the menu:

```bash
zion
```

Or explicitly:

```bash
zion menu
```

Controls:

- arrow keys ↑↓ = move,
- Enter = confirm,
- Esc = back,
- the menu returns you back after completion.

The menu guides you through: wallet → node → pool → miner, step by step.

---

## Absolute first workflow (copy and paste)

If you don't know where to start, follow this order:

```bash
zion doctor
zion status
zion wallet new --mnemonic --out my-wallet.json --print
zion node status
zion pool stats
zion mine start --pool stratum+tcp://pool.zionterranova.com:8444 --wallet YOUR_ADDRESS
```

What to expect:

- `doctor` does a quick preflight (config, endpoints, readiness),
- `status` shows the overall network state,
- `wallet new` creates a wallet with 24 words,
- `node status` shows the state of your node,
- `pool stats` shows the pool state,
- `mine start` starts mining.

---

## Most common commands for a regular user

### State and health

```bash
zion status
zion doctor
zion monitor
```

### Node / chain

```bash
zion node status
zion node peers
zion node sync
```

### Pool / mining

```bash
zion pool stats
zion mine status
zion mine bench
zion mine start --pool stratum+tcp://pool.zionterranova.com:8444 --wallet YOUR_ADDRESS
zion mine stop
```

### Wallet

```bash
zion wallet new --mnemonic --out my-wallet.json
zion wallet balance --address YOUR_ADDRESS
zion wallet send --to RECIPIENT --amount 1.5
zion wallet import --file my-wallet.json
```

---

## Important reality for 2026

ZION is in **Mainnet Beta** — the network is running and producing blocks, but it may contain bugs.
Mine and transact at your own risk. Official public launch: **31 December 2026**.

The genesis chain is **permanent** — it will not be reset.

---

## Safe procedure when something is wrong

Use exactly this order:

1. `zion status`
2. `zion doctor`
3. `zion node status`
4. `zion pool stats`
5. `zion mine status`

Never start with a random restart of everything without diagnosis.

---

## What to read next

- [ZION CLI Reference](cli-reference.md) — all commands
- [ZION CLI Troubleshooting](cli-troubleshooting.md) — problem solving
- [ZION CLI FAQ](cli-faq.md) — frequently asked questions
