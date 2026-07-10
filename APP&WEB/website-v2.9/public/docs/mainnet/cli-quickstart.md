# ZION CLI Quickstart (10 minutes for newcomers)

This is the shortest path to get a feel for ZION CLI without chaos.

## Goal

Within 10 minutes:

1. verify that the CLI runs,
2. see the network state,
3. create a wallet,
4. start mining.

---

## Step 1: Download the binary from GitHub Releases

One `zion` binary for all platforms:

- **Linux x86_64** — `zion-cli-linux-x86_64.tar.gz`
- **macOS Apple Silicon (M1–M4)** — `zion-cli-macos-aarch64.tar.gz`
- **macOS Intel** — `zion-cli-macos-x86_64.tar.gz`
- **Windows x86_64** — `zion-cli-windows-x86_64.zip` (node + pool + miner embedded)

Download from: https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.5-beta

---

## Step 2: Extract and run

### Linux / macOS

```bash
tar xzf zion-cli-linux-x86_64.tar.gz
chmod +x zion
./zion
```

### Windows

Extract `zion-cli-windows-x86_64.zip` and double-click `zion.exe`,
or run it in PowerShell:

```powershell
.\zion.exe
```

---

## Step 3: Interactive menu

Running `zion` without arguments opens the interactive menu:

- arrow keys ↑↓ = move,
- Enter = confirm,
- Esc = back.

The menu guides you step by step: wallet → node → pool → miner.

---

## Step 4: Create a wallet

```bash
zion wallet new --mnemonic --out my-wallet.json --print
```

You will get 24 words (BIP39 mnemonic). **Write them down on paper!**
That is your backup — without it the wallet cannot be restored.

---

## Step 5: Start mining

```bash
zion mine start --pool stratum+tcp://pool.zionterranova.com:8444 --wallet YOUR_ADDRESS
```

Watch hashrate and accepted shares in the console.

---

## Step 6: Check your balance

```bash
zion wallet balance --address YOUR_ADDRESS
```

Or visit the Explorer at https://zionterranova.com/explorer

---

## What next

1. [ZION CLI Guide](cli-guide.md) — complete guide
2. [ZION CLI Reference](cli-reference.md) — all commands
3. [ZION CLI Troubleshooting](cli-troubleshooting.md) — problem solving
4. [ZION CLI FAQ](cli-faq.md) — frequently asked questions
