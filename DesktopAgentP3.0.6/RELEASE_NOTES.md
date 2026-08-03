# ZION Public Desktop Miner v3.1.0

**Release:** `v3.1.0`  
**Date:** 2026-08-03  
**Status:** Public preview / prerelease

## Overview

The v3.1.0 desktop miner bundles the public ZION mining client (`zion-miner`), the L1 full node (`node`) and the unified CLI (`zion`) in a single Electron app. It is built with the `public_build` feature, so the TUI, logs and status screens show only the **ZION / Boost** stream — internal Trinity/AuxPoW coin names (VRSC, ZANO, etc.) are hidden.

## What's new in v3.1.0

### One-click GPU auto-detect

The embedded miner binary now auto-detects the best available GPU backend on the user's machine:

| Platform | NVIDIA | AMD / Intel | Apple Silicon |
|----------|--------|-------------|---------------|
| Linux x86_64 | CUDA | OpenCL | — |
| Windows x86_64 | CUDA | OpenCL | — |
| macOS arm64 | — | OpenCL (legacy) | Metal |

No flags needed — the app picks CUDA → OpenCL → Metal → CPU automatically.

### Full native algorithm support

All builds include `native-all` + `native-hashers`: VerusHash, RandomX, GhostRider, Etchash, KawPow, Autolykos, kHeavyHash, BLAKE3, Cosmic Harmony — for all supported coins.

### Included binaries

- `zion-miner` / `zion-universal-miner` — one-click mining client with CPU/GPU auto-detect
- `node` — ZION L1 full node (P2P + RPC)
- `zion` — unified CLI (wallet, send, balance, mine status, etc.)

## Downloads

| File | Platform | Format | SHA256 |
|------|----------|--------|--------|
| `zion-public-miner-v3.1.0-mac-arm64.dmg` | macOS Apple Silicon | DMG | `1ec9d37f27d6b760256f23d911f825e1d11cdc6af4a21b9f581eda3d4e6a0e7c` |
| `zion-public-miner-v3.1.0-linux-x86_64.AppImage` | Linux x86_64 | AppImage | `c4bdb1b77409e2e00289c13f48f76b3a41c71b8867b11981de7b95c631c33767` |
| `zion-public-miner-v3.1.0-linux-amd64.deb` | Linux x86_64 | DEB | `42d3b02a6080b452600913bc3b48652bf5863ba0419a2102d4651d39e2ae8f15` |
| `zion-public-miner-v3.1.0-windows-x64.exe` | Windows x64 | NSIS installer | `fba2fc1ffa7e557a158bfe072c79740f70d4838a92b883762ed8f243f2cb5beb` |
| `zion-public-miner-v3.1.0-windows-x64.zip` | Windows x64 | Portable ZIP | `e1db933c2b8ddd900b10d29d1e895aab3edd94bc44bd879deed11cf10b1107c2` |

> Verify with `SHA256SUMS-desktop.txt` included in this release.

## Installation

### macOS

Open the `.dmg` and drag **ZION Public Miner** into **Applications**. On Apple Silicon you may need to allow the app in **System Settings → Privacy & Security** the first time.

### Linux AppImage

```bash
chmod +x zion-public-miner-v3.1.0-linux-x86_64.AppImage
./zion-public-miner-v3.1.0-linux-x86_64.AppImage
```

> If the window does not appear on Wayland/NVIDIA, run with `--no-sandbox --ozone-platform=x11 --disable-gpu-sandbox`.

### Linux DEB

```bash
sudo dpkg -i zion-public-miner-v3.1.0-linux-amd64.deb
sudo apt-get -f install   # if dependencies are missing
zion-public-miner
```

### Windows

Run the `.exe` installer and follow the wizard, or extract the portable `.zip` and run `ZION Public Miner.exe`.

## First run

1. Enter your ZION wallet address (`ZION_...`).
2. Set pool to `62.171.141.136:8444` (default).
3. Choose a worker name.
4. Adjust CPU threads and enable GPU if available.
5. Click **Start Mining**.

## Build information

All packages were cross-compiled from an Apple Silicon Mac using:

- `public_build` — public Boost branding, no internal Trinity coin names in UI
- `full` — OpenCL + all native algorithms
- `gpu-cuda` — added for Linux/Windows (NVIDIA support)
- `gpu-metal` — added for macOS (Apple Silicon/Intel Metal support)
- `ZION_DISABLE_OPENMP=1` — packages do not depend on Homebrew libomp

## Network

- **Mainnet pool:** `62.171.141.136:8444`
- **Public RPC:** `rpc.zionterranova.com:8443`
- **Status:** `https://status.zionterranova.com`

## License

MIT — see the top-level `LICENSE` file.
