# ZION Public Desktop Miner — Build Guide

**Version:** `v3.1.0`
**Directory:** `DesktopAgentP3.0.6/`
**Purpose:** Electron GUI for ZION mining with Boost Streams.

> This build compiles the miner with the `public_build` Rust feature. Boost Stream 1 (GPU) and Boost Stream 2 (CPU) run in the background..

---

## Output files

`build.sh` (and `npm run build:linux`) produce:

- `dist/zion-public-miner-v3.1.0-linux-x86_64.AppImage`
- `dist/zion-public-miner-v3.1.0-linux-amd64.deb`
- `dist/SHA256SUMS.txt`

Windows and macOS packaging scripts are also available:

- `npm run build:win` — `dist/zion-public-miner-v3.1.0-windows-x64.exe` (NSIS installer) + `.zip`
- `npm run build:mac` — `dist/zion-public-miner-v3.1.0-mac-arm64.dmg`

---

## Build environment

### Required

- Node.js `>= 18.x` and `npm` / `npx`
- Rust toolchain `>= 1.85` with `cargo`
- Linux build: `build-essential`, `libssl-dev`, `pkg-config`
- CUDA toolkit `>= 11.8` (optional; required for NVIDIA GPU builds)
- `gh` CLI (optional, for GitHub release upload)

### Optional environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `ZION_CPU_TARGET` | `x86-64` | Target x86-64 microarchitecture. Set to `x86-64-v3` for AVX2/BMI2 optimizations. |
| `PUBLIC_BUILD` | `true` (hard-coded in source) | Compile Rust miner with the `public_build` feature. |

---

## Linux build

### One-shot build

```bash
cd DesktopAgentP3.0.6
./build.sh
```

### Manual step-by-step

```bash
cd DesktopAgentP3.0.6

# Install Node dependencies
npm ci

# Build Rust binaries and package
ZION_CPU_TARGET=x86-64 npm run build:linux

# Compute checksums
cd dist
sha256sum zion-public-miner-v3.1.0-linux-x86_64.AppImage \
          zion-public-miner-v3.1.0-linux-amd64.deb > SHA256SUMS.txt
```

### Build with AVX2/BMI2 optimizations

```bash
ZION_CPU_TARGET=x86-64-v3 ./build.sh
```

---

## Windows build (cross-compile from Linux)

```bash
cd DesktopAgentP3.0.6
npm ci

# Install Windows Rust target once
rustup target add x86_64-pc-windows-gnu

# Prepare the miner for Windows
cargo build --release -p zion-miner \
  --target x86_64-pc-windows-gnu \
  --features public_build,gpu-cuda,native-all

# Package with electron-builder
npm run build:win
```

> Note: Cross-compiling the Rust miner for Windows requires a working MinGW-w64 linker. On Debian/Ubuntu install `mingw-w64`.

---

## macOS build (requires a Mac)

```bash
cd DesktopAgentP3.0.6
npm ci

# macOS target uses Metal GPU feature
npm run build:mac
```

---

## GPU sandbox / Wayland troubleshooting

On some Linux systems (especially NVIDIA + Wayland) Electron can fail to start the GPU process. The build contains two mitigations:

1. In `src/main.js`: sets `ELECTRON_OZONE_PLATFORM_HINT=x11` and appends `--ozone-platform=x11` and `--disable-gpu-sandbox` before `app.whenReady()`.
2. In the packaged AppImage `main.js`: a self-re-exec block re-launches the binary with the required flags before Electron initializes the GPU process.

If the AppImage still fails, extract and run it directly:

```bash
./zion-public-miner-v3.1.0-linux-x86_64.AppImage --appimage-extract
cd squashfs-root
./AppRun --no-sandbox --ozone-platform=x11 --disable-gpu-sandbox
```

For missing `libfuse2` on modern Ubuntu, install:

```bash
sudo apt install libfuse2
```

---

## What is hidden in the public build

- GPU/CPU coin selectors are removed from the UI.
- Coin selectors are hidden.
- The left panel header shows "Mining".
- Coin names are not shown in the desktop logs.
- The compiled `zion-miner` binary is built with `public_build`, which runs ZION with Boost Stream 1 (GPU) and Boost Stream 2 (CPU).

---

## Releasing

### Manual release (Linux only from this machine)

```bash
cd dist
gh release create v3.1.0-desktop --repo Zion-TerraNova/v3-Mainnet \
  --title "ZION Public Desktop Miner v3.1.0" \
  --notes-file ../RELEASE_NOTES.md \
  --prerelease \
  zion-public-miner-v3.1.0-linux-x86_64.AppImage \
  zion-public-miner-v3.1.0-linux-amd64.deb \
  SHA256SUMS.txt
```

### Automated multi-OS release via GitHub Actions

Use the repository workflow `.github/workflows/desktop-release.yml`:

1. Set the `PUBLIC_RELEASE_TOKEN` repository secret (GitHub PAT with `repo` or `public_repo` scope).
2. Run the workflow manually (`workflow_dispatch`) and enter the desired tag, e.g. `v3.1.0-desktop`.
3. The workflow builds Linux (AppImage + DEB), Windows (NSIS + ZIP) and macOS (DMG) packages.
4. After all builds pass, it creates a draft release on `Zion-TerraNova/v3-Mainnet` with all artifacts and SHA256 checksums.
5. Review the draft and click **Publish release** when ready.
