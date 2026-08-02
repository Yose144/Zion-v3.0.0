# ZION Public Desktop Miner v3.1.0 — Release Notes

**Release:** `v3.1.0`  
**Date:** 2026-08-01  
**Status:** Public preview / prerelease

## Overview

This release restructures the ZION desktop client around a simpler v3.1 layout: a single **Multichain** page groups Bridge, ZionDex, DeFi and DAO; Network and Node controls live under **Settings**; and two new embedded pages bring the **MarketPlace** and **OASIS** web apps directly into the app.

## What changed from v3.0.6

- **Simplified dock** — `Home`, `Wallet`, `Multichain`, `Market`, `Oasis`, `CLI`, `Settings`, `Logs`, `About`.
- **Multichain page** — Bridge, ZionDex, DeFi and DAO are now tabs inside one view.
- **Settings** — now contains `Identity`, `Pools`, `Performance`, `Engine`, `Network` and `Node` tabs.
- **MarketPlace** — embedded `https://market.zionterranova.com` in a sandboxed iframe.
- **OASIS** — embedded `https://oasis.zionterranova.com` in a sandboxed iframe.
- **Public build — Boost Stream 1 (GPU) and Boost Stream 2 (CPU) run in the background; UI shows Boost branding.
- **GPU sandbox workaround** — Linux re-exec logic adds `--ozone-platform=x11` and `--disable-gpu-sandbox`.

## Downloads

Multi-OS builds are produced by the `.github/workflows/desktop-release.yml` GitHub Actions workflow.

| File | Platform | Format |
|------|----------|--------|
| `zion-public-miner-v3.1.0-linux-x86_64.AppImage` | Linux x86_64 | AppImage |
| `zion-public-miner-v3.1.0-linux-amd64.deb` | Linux x86_64 | DEB package |
| `zion-public-miner-v3.1.0-windows-x64.exe` | Windows x64 | NSIS installer |
| `zion-public-miner-v3.1.0-windows-x64.zip` | Windows x64 | Portable ZIP |
| `zion-public-miner-v3.1.0-mac-arm64.dmg` | macOS Apple Silicon | DMG |
| `SHA256SUMS.txt` | — | Checksums |

## Installation

### AppImage

```bash
chmod +x zion-public-miner-v3.1.0-linux-x86_64.AppImage
./zion-public-miner-v3.1.0-linux-x86_64.AppImage
```

### Debian/Ubuntu

```bash
sudo dpkg -i zion-public-miner-v3.1.0-linux-amd64.deb
sudo apt-get -f install   # if dependencies are missing
zion-public-miner
```

### Windows

Run the NSIS installer and follow the setup wizard:

```powershell
zion-public-miner-v3.1.0-windows-x64.exe
```

A portable `.zip` is also available. Extract it and run `ZION Public Miner.exe`.

### macOS

Open the DMG and drag **ZION Public Miner** into **Applications**:

```bash
open zion-public-miner-v3.1.0-mac-arm64.dmg
```

On Apple Silicon Macs you may need to allow the app in **System Settings → Privacy & Security** the first time it is launched.

## First run

1. Enter your ZION wallet address (`ZION_...`).
2. Set pool to `62.171.141.136:8444` (default).
3. Choose a worker name.
4. Adjust CPU threads and enable GPU if available.
5. Click **Start Mining**.

## Known issues

- The AppImage may not start on some Wayland/NVIDIA desktops. If the window does not appear, launch from a terminal and the built-in re-exec should add the required `--ozone-platform=x11 --disable-gpu-sandbox` flags. As a fallback, run:
  ```bash
  ./zion-public-miner-v3.1.0-linux-x86_64.AppImage --no-sandbox --ozone-platform=x11 --disable-gpu-sandbox
  ```
- AppImage requires `libfuse2` on Ubuntu 22.04+. Install with `sudo apt install libfuse2` if you see a FUSE error.
- The MarketPlace and OASIS pages are served inside a sandboxed iframe. Some site features (e.g., external pop-ups or service workers) may be restricted.

## Network

- **Mainnet pool:** `62.171.141.136:8444`
- **Public RPC:** `rpc.zionterranova.com:8443`
- **Status page:** `https://status.zionterranova.com`

## Verification

Verify downloaded artifacts with SHA256:

```bash
sha256sum -c SHA256SUMS.txt
```

## License

MIT — see the top-level `LICENSE` file.
