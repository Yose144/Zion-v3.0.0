# ZION Desktop Miner v3.2.0

**Release:** `v3.2.0`  
**Date:** 2026-08-21  
**Status:** Mainnet Alpha

## Overview

The ZION Desktop Miner bundles the public ZION mining client, the L1 full node and the unified `zion` CLI into a single Electron app. This release is built from the canonical ZION V31 workspace.

## What's new in v3.2.0

### Ekam Deeksha v3.2

The embedded miner uses the canonical **Ekam Deeksha v3.2** PoW: 512 KiB scratchpad, 2 passes, 128 random reads per pass, Keccak-256 final hash. This replaces the earlier 128 KiB Deeksha Lite algorithm used in v3.0.x / v3.1.x public builds.

### One-click GPU auto-detect

The app picks the best available GPU backend automatically per platform:

| Platform | NVIDIA | AMD / Intel | Apple Silicon |
|----------|--------|-------------|---------------|
| Linux x86_64 | OpenCL / CUDA | OpenCL | — |
| Windows x86_64 | OpenCL / CUDA | OpenCL | — |
| macOS arm64 | — | OpenCL (legacy) | Metal |
| macOS x86_64 | — | OpenCL (legacy) | Metal |

On Apple Silicon M1–M5 the Ekam Deeksha workload is routed to CPU by default, because the integrated GPU is slower for this memory-hard algorithm.

### Public Boost branding

The embedded miner is built in **public** mode. The TUI, banner, setup menu and logs show only:

- **ZION** — the main ZION stream
- **BOOST 1** — GPU auxiliary revenue stream
- **BOOST 2** — CPU auxiliary revenue stream

No external coin tickers, job ids or stratum pool URLs are printed to the UI or logs. The auxiliary revenue streams still run in the background exactly as before.

### Included binaries

- `zion-miner` — mining client (CPU/GPU backends, ZION + Boost streams)
- `node` — ZION L1 full node (P2P + RPC)
- `zion` — unified CLI (wallet, send, balance, status, etc.)

## Downloads

| File | Platform | Format |
|------|----------|--------|
| `zion-desktop-agent-v3.2.0-mac-arm64.dmg` | macOS Apple Silicon | DMG |
| `zion-desktop-agent-v3.2.0-linux-x86_64.AppImage` | Linux x86_64 | AppImage |
| `zion-desktop-agent-v3.2.0-linux-amd64.deb` | Linux x86_64 | DEB |
| `zion-desktop-agent-v3.2.0-windows-x64.exe` | Windows x64 | NSIS installer |
| `zion-desktop-agent-v3.2.0-windows-x64.zip` | Windows x64 | Portable ZIP |

> Verify SHA-256 checksums with `SHA256SUMS.txt` included in this release.

## Installation

### macOS

Open the `.dmg` and drag **ZION Miner** into **Applications**. On Apple Silicon you may need to allow the app in **System Settings → Privacy & Security** the first time.

### Linux AppImage

```bash
chmod +x zion-desktop-agent-v3.2.0-linux-x86_64.AppImage
./zion-desktop-agent-v3.2.0-linux-x86_64.AppImage
```

> If the window does not appear on Wayland/NVIDIA, run with `--no-sandbox --ozone-platform=x11 --disable-gpu-sandbox`.

### Windows

Run the installer and follow the prompts, or extract the portable ZIP and run `ZION Miner.exe`.

## Support

- Website: [zionterranova.com](https://zionterranova.com)
- Explorer: [app.zionterranova.com](https://app.zionterranova.com)
- Pool: `stratum.zionterranova.com:8444`
- RPC: `rpc.zionterranova.com:8443`
