# ZION v3-Mainnet Public Release — How to Use

> **Repository:** https://github.com/Zion-TerraNova/v3-Mainnet
> **License:** MIT
> **Current release:** v3.0.5-beta
> **Status:** Mainnet Beta — use at your own risk

This guide explains how to download the public ZION CLI, verify it, and start mining on the live mainnet.

---

## 1. What is in the public repo?

The [`v3-Mainnet`](https://github.com/Zion-TerraNova/v3-Mainnet) repository is the curated, open-source release of ZION V3. It contains:

- **L1 core** — Rust blockchain node, consensus, P2P, wallet, pool and miner code.
- **L2 contracts** — DeFi, DAO, bridge and atomic-swap Solidity contracts.
- **L3 WARP** — cross-chain bridge adapters.
- **CLI / SDK** — simplified `zion` binary and wallet SDK.
- **Docs** — whitepaper, legal disclaimers, security disclosures and runbooks.

> **What is NOT published:** website source, dashboard source, operational server configs, private keys, mnemonics and internal runbooks. These stay in the private repository.

---

## 2. Download the latest release

1. Open https://github.com/Zion-TerraNova/v3-Mainnet/releases.
2. Choose the latest **v3.0.5-beta** release.
3. Download the archive for your platform:

| Platform | File |
|----------|------|
| Linux x86_64 | `zion-cli-linux-x86_64.tar.gz` |
| macOS Apple Silicon | `zion-cli-macos-aarch64.tar.gz` |
| macOS Intel | `zion-cli-macos-x86_64.tar.gz` |
| Windows x86_64 | `zion-cli-windows-x86_64.zip` |

Also download `SHA256SUMS.txt` to verify the archive.

---

## 3. Verify the archive (recommended)

### Linux / macOS

```bash
tar -xzf zion-cli-linux-x86_64.tar.gz
sha256sum -c SHA256SUMS.txt
```

You should see `OK` next to the file you downloaded.

### Windows (PowerShell)

```powershell
Get-FileHash zion-cli-windows-x86_64.zip -Algorithm SHA256
```

Compare the printed hash with the one in `SHA256SUMS.txt`.

---

## 4. First run — interactive setup

The CLI has an interactive menu. Just run:

```bash
./zion
```

The menu guides you through:

1. **Wallet** — create or load a `zion1...` address.
2. **Node** — sync with the mainnet seed nodes.
3. **Pool** — optional local pool setup (most users connect to the public pool).
4. **Miner** — start CPU or GPU mining.

---

## 5. Quick mining to the public pool

If you already have a wallet, the fastest way to mine is:

```bash
./zion miner --pool stratum+tcp://pool.zionterranova.com:8444 \
  --payout zion1YOUR_ADDRESS_HERE \
  --algo deeksha_lite_v1
```

Replace `zion1YOUR_ADDRESS_HERE` with your real ZION address.

### GPU mining

Use `--backend opencl` for AMD/NVIDIA on Linux/Windows, or `--backend metal` on Apple Silicon:

```bash
./zion miner --pool stratum+tcp://pool.zionterranova.com:8444 \
  --payout zion1YOUR_ADDRESS_HERE \
  --algo deeksha_lite_fire \
  --backend opencl
```

Run `./zion miner --help` for all options.

---

## 6. Run your own node

```bash
./zion node --network mainnet --data-dir ~/.zion
```

The node will connect to the default seed peers and sync from genesis. Once synced, you can run the miner against your local node:

```bash
./zion miner --node http://127.0.0.1:8443 --payout zion1YOUR_ADDRESS_HERE
```

---

## 7. Monitor everything

Open a second terminal and run:

```bash
./zion monitor
```

It shows:

- Current block height and sync status
- Miner hashrate and accepted shares
- Wallet balance
- Service health

---

## 8. Important notes for Mainnet Beta

- **Mine at your own risk.** The network is live but still in Beta. Bugs are possible.
- **Do not invest funds you cannot afford to lose.** There is no guarantee the current chain will not be reset again, although the July 2026 hard reset was explicitly the last planned reset and genesis is now declared permanent.
- **Keep your wallet seed phrase safe.** Lost keys cannot be recovered.
- **Watch for updates.** New CLI releases will appear at the same GitHub releases page.
- **Read the legal disclaimer:** [`LEGAL_DISCLAIMER.md`](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/LEGAL_DISCLAIMER.md)

---

## 9. Build from source (advanced)

If you prefer to compile yourself:

```bash
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3
cargo build --release
```

Binaries will be in `V3/target/release/`. You need Rust ≥ 1.78 and standard build tools.

---

## 10. Getting help

- Public repo: https://github.com/Zion-TerraNova/v3-Mainnet
- Mainnet status: https://zionterranova.com/network
- Explorer: https://zionterranova.com/explorer
- Pool: https://zionterranova.com/pool

---

*ZION TerraNova v3-Mainnet Public Release • updated 10 Jul 2026*
