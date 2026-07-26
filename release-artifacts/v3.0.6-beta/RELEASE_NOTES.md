# ZION v3.0.6-beta — Trinity

**Date:** 2026-07-26

**Mine ZION. Earn ZION. Grow ZION.**

> **⚠️ Mainnet Beta — mine and transact at your own risk**
> The network is live and producing blocks. Genesis chain is permanent. Official public launch: **31 December 2026**.

---

## What's new in v3.0.6 — Trinity?

### Trinity Mining Engine

The ZION v3.0.6 miner introduces our proprietary **Trinity** mining
engine — your GPU and CPU work together to maximize your ZION earnings.

- **No exchanges, no selling, no price dumps**
- **Every hash you compute grows your ZION position**
- **Every hash deepens the ZION liquidity pool**

### Zion Liquidity

Traditional mining: mine a coin → sell on exchange → dump price → exit.

**Zion Liquidity inverts this:** mine → earn ZION → hold ZION → liquidity
grows. The pool handles all conversions internally — you never touch an
exchange, and there is zero sell pressure on ZION.

### Zion Grow

The longer you mine, the more ZION you hold. Every hash compounds your
position. No trading, no timing the market — just mine and grow.

### SMOS / HiveOS / SimpleMining Support

This release adds support for mining OS distributions. The miner runs
headless on SMOS and HiveOS with machine-parseable dashboard output.

See the [SMOS/HiveOS Guide](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/SMOS_HIVEOS_GUIDE.md) for setup
instructions.

---

## Download

| Your system | File | Size | SHA256 |
|-------------|------|------|--------|
| **Linux x86_64** (Ubuntu, Debian, SMOS, HiveOS) | `zion-miner-linux-x86_64.tar.gz` | 3.5 MB | `9466755d2b9835cef43aef0e55a9088d7576ccacddf85951b888f373b45beb65` |
| **Linux ARM64** (Raspberry Pi 4/5, Ampere, Jetson) | `zion-miner-linux-aarch64.tar.gz` | 2.7 MB | `a416e9cb3183193a4040de668099e6391089c0ef4c9b1d3a2271dd7a616c7f85` |
| **macOS Apple Silicon** (M1/M2/M3/M4) | `zion-miner-macos-aarch64.tar.gz` | 3.2 MB | `ea9993c4a3978e6e5ea10b37d14b44dc343bba5efbb7b0788a9275e7ad992d74` |
| **macOS Intel** (pre-2020 Macs) | `zion-miner-macos-x86_64.tar.gz` | 3.3 MB | `a4677f005baf539aaf6c02a538c9dbcaf117ac288a4c51c39901d477889af86a` |
| **Windows x86_64** (10/11) | `zion-miner-windows-x86_64.zip` | 2.9 MB | `9a7454ebabbf2346bdd8e034e1af4d6473dc1939fcd159fe8170563922105e36` |

> **All 5 platforms are now available!** Full SHA256 checksums are in
> `SHA256SUMS.txt` (download alongside the binary).
>
> **GPU support:**
> - **Linux x86_64:** OpenCL (AMD/Intel) + CUDA (NVIDIA).
> - **macOS:** Metal (Apple Silicon) + OpenCL (Intel/AMD where available).
> - **Windows x86_64:** CUDA (NVIDIA); OpenCL/AMD support is coming in a future release.
> - **Linux ARM64:** CUDA (NVIDIA Jetson); OpenCL support is coming in a future release.

---

## Quick Start

```bash
# Download (Linux x86_64 example — choose the right file for your platform)
wget https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz

# Verify SHA256
sha256sum zion-miner-linux-x86_64.tar.gz
# Should match SHA256SUMS.txt

# Extract
tar xzf zion-miner-linux-x86_64.tar.gz
chmod +x zion-miner start.sh
```

### Interactive setup (recommended for desktop)

```bash
./zion-miner
```

When run without arguments, the binary opens a simple interactive menu that
asks for your pool, wallet, worker name, GPU backend, thread count, algorithm
and profile.

### Advanced wrapper script

```bash
./start.sh
```

`start.sh` (Linux/macOS) or `start.bat` (Windows) is the same easy wrapper
with extra options and full argument pass-through. Set `ZION_EASY_MENU=0`
to skip the prompts and pass arguments directly.

### Manual start

```bash
./zion-miner \
    --pool 62.171.141.136:8444 \
    --wallet zion1YOUR_WALLET_ADDRESS \
    --worker my-rig \
    --gpu auto \
    --algorithm deeksha_lite_v1 \
    --profile pool
```

> **Pool vs Solo:** By default, the miner connects to the official pool
> (`62.171.141.136:8444`). In pool mode, you earn a share of every block.
> Solo mode only pays when *you* find a block — which is rare. **Pool mode
> is recommended.**

---

## Documentation & Support

- **Desktop quick start & FAQ:** [README.md](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/README.md) and [docs/FAQ.md](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/FAQ.md)
- **SMOS / HiveOS guide:** [docs/SMOS_HIVEOS_GUIDE.md](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/docs/SMOS_HIVEOS_GUIDE.md)
- **Website:** [zionterranova.com](https://zionterranova.com)
- **Pool:** `62.171.141.136:8444`
- **RPC:** `rpc.zionterranova.com:8443`

---

## License

MIT — see [LICENSE](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/LICENSE)

> **Note:** The miner binary is released under MIT license. The Trinity
> engine and AuxPow source code are proprietary and not included in the
> public repository. The ZION blockchain core, pool, and community CLI remain
> fully open-source.
