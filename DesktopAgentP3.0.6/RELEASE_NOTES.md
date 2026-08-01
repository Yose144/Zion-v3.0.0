# ZION Public Desktop Miner v3.0.6 — Release Notes

**Release:** `v3.0.6`  
**Date:** 2026-08-01  
**Status:** Public preview / prerelease

## Overview

This is the first public-facing desktop build of the ZION v3.0.6 miner. It packages the Electron GUI with a `zion-miner` compiled with the `public_build` feature. The UI shows only the ZION/Deeksha work stream and hides all Trinity/AuxPoW external coin names, while the miner continues to run the external GPU and CPU streams in the background for revenue.

## What changed from the private desktop agent

- **Public build flag** — `public_build` is enabled in `prepare-rust-miner.js` and propagated to both the Rust miner and the Electron UI.
- **UI-only single stream** — stream 2/3 cards and coin selectors are removed from `index.html` and `renderer.js`. The public miner still runs Trinity streams 2/3 in the background for revenue.
- **Branding** — product and window title changed to `ZION Public Miner v3.0.6` and binary/package names changed to `zion-public-miner`.
- **GPU sandbox workaround** — Linux re-exec logic adds `--ozone-platform=x11` and `--disable-gpu-sandbox` before Electron creates the GPU process.

## Downloads

Multi-OS builds are produced by the `.github/workflows/desktop-release.yml` GitHub Actions workflow.

| File | Platform | Format |
|------|----------|--------|
| `zion-public-miner-v3.0.6-linux-x86_64.AppImage` | Linux x86_64 | AppImage |
| `zion-public-miner-v3.0.6-linux-amd64.deb` | Linux x86_64 | DEB package |
| `zion-public-miner-v3.0.6-windows-x64.exe` | Windows x64 | NSIS installer |
| `zion-public-miner-v3.0.6-windows-x64.zip` | Windows x64 | Portable ZIP |
| `zion-public-miner-v3.0.6-mac-arm64.dmg` | macOS Apple Silicon | DMG |
| `SHA256SUMS.txt` | — | Checksums |

## Installation

### AppImage

```bash
chmod +x zion-public-miner-v3.0.6-linux-x86_64.AppImage
./zion-public-miner-v3.0.6-linux-x86_64.AppImage
```

### Debian/Ubuntu

```bash
sudo dpkg -i zion-public-miner-v3.0.6-linux-amd64.deb
sudo apt-get -f install   # if dependencies are missing
zion-public-miner
```

### Windows

Run the NSIS installer and follow the setup wizard:

```powershell
zion-public-miner-v3.0.6-windows-x64.exe
```

A portable `.zip` is also available. Extract it and run `ZION Public Miner.exe`.

### macOS

Open the DMG and drag **ZION Public Miner** into **Applications**:

```bash
open zion-public-miner-v3.0.6-mac-arm64.dmg
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
  ./zion-public-miner-v3.0.6-linux-x86_64.AppImage --no-sandbox --ozone-platform=x11 --disable-gpu-sandbox
  ```
- AppImage requires `libfuse2` on Ubuntu 22.04+. Install with `sudo apt install libfuse2` if you see a FUSE error.

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
