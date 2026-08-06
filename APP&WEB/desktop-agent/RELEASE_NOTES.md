# ZION Desktop Agent v3.1.0

**Release:** `v3.1.0`  
**Date:** 2026-08-06  
**Status:** Mainnet Alpha

## Overview

The v3.1.0 desktop agent bundles the public ZION V31 mining client (`zion-miner`), the L1 full node (`node`) and the unified CLI (`zion`) in a single Electron app. This is the first release built from the unified `V31/` workspace and the `APP&WEB/desktop-agent/` source tree.

## What is new in v3.1.0

### V31 workspace

All binaries are built from the canonical `V31/` workspace (`V31/Cargo.toml`). The legacy `DesktopAgentP3.0.6/` and `MinerP3.0.6/` V3 source trees have been archived.

### One-click GPU auto-detect

The embedded miner binary automatically picks the best available GPU backend:

| Platform | NVIDIA | AMD / Intel | Apple Silicon |
|----------|--------|-------------|---------------|
| Linux x86_64 | OpenCL / CUDA (when built with `gpu-cuda`) | OpenCL | — |
| Windows x86_64 | OpenCL | OpenCL | — |
| macOS arm64 | — | OpenCL (legacy) | Metal |

No flags are required for basic operation — the app falls back through CUDA → OpenCL → Metal → CPU as available.

### Pure ZION / no external pools

The default mining mode in the desktop app connects directly to the ZION Mainnet pool and mines the ZION stream only. External Trinity/AuxPoW coin support is still available in the standalone terminal miner.

### Included binaries

- `zion-miner` — V31 mining client
- `node` — ZION L1 full node (P2P + RPC)
- `zion` — unified CLI (wallet, send, balance, status, etc.)

## Downloads

| File | Platform | Format |
|------|----------|--------|
| `zion-desktop-agent-v3.1.0-mac-arm64.dmg` | macOS Apple Silicon | DMG |
| `zion-desktop-agent-v3.1.0-linux-x86_64.AppImage` | Linux x86_64 | AppImage |
| `zion-desktop-agent-v3.1.0-linux-amd64.deb` | Linux x86_64 | DEB |
| `zion-desktop-agent-v3.1.0-windows-x64.exe` | Windows x64 | NSIS installer |
| `zion-desktop-agent-v3.1.0-windows-x64.zip` | Windows x64 | Portable ZIP |

> Verify SHA-256 checksums with `SHA256SUMS.txt` included in this release.

## Installation

### macOS

Open the `.dmg` and drag **ZION Miner** into **Applications**. On Apple Silicon you may need to allow the app in **System Settings → Privacy & Security** the first time.

### Linux AppImage

```bash
chmod +x zion-desktop-agent-v3.1.0-linux-x86_64.AppImage
./zion-desktop-agent-v3.1.0-linux-x86_64.AppImage
```

> If the window does not appear on Wayland/NVIDIA, run with `--no-sandbox --ozone-platform=x11 --disable-gpu-sandbox`.

### Windows

Run the installer and follow the prompts, or extract the portable ZIP and run `ZION Miner.exe`.
