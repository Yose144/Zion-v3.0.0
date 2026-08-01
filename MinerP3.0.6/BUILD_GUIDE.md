# MinerP3.0.6 — Build Guide (All Platforms)

Complete build instructions for the ZION v3.0.6-beta Trinity Miner on all 5 supported platforms.

> **Repository:** `github.com/Zion-TerraNova/v3-Mainnet` (public)
> **Tag:** `v3.0.6-beta`
> **License:** MIT (binary) — Trinity/AuxPoW source is proprietary

---

## Table of Contents

1. [Prerequisites (all platforms)](#1-prerequisites-all-platforms)
2. [Linux x86_64 (Ubuntu/Debian/SMOS/HiveOS)](#2-linux-x86_64)
3. [Linux ARM64 (Raspberry Pi/Jetson/Graviton)](#3-linux-arm64)
4. [macOS Apple Silicon (M1/M2/M3/M4)](#4-macos-apple-silicon)
5. [macOS Intel (pre-2020)](#5-macos-intel)
6. [Windows x86_64 (10/11)](#6-windows-x86_64)
7. [Feature Flags Reference](#7-feature-flags-reference)
8. [Packaging & SHA256](#8-packaging--sha256)
9. [GitHub Release Upload](#9-github-release-upload)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites (all platforms)

### Rust toolchain

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Verify
rustc --version   # 1.75+ recommended
cargo --version
```

### Repo layout

```
2.9.6-main/               ← repo root
├── V3/                   ← Rust workspace (where cargo build runs)
│   ├── Cargo.toml        ← workspace manifest
│   └── L1/miner/         ← zion-miner crate
├── AuXpow/               ← GPU backend crate (CUDA/OpenCL/Metal)
├── MinerP3.0.6/          ← standalone build scripts + dist/
│   ├── build.sh          ← Linux x86_64
│   ├── build-macos.sh    ← macOS (aarch64 + x86_64)
│   ├── build-windows.sh  ← Windows cross-compile
│   └── dist/             ← output binaries
└── public/               ← public subtree (github.com/Zion-TerraNova/v3-Mainnet)
```

### Build features

| Feature | Description |
|---------|-------------|
| `public_build` | Hides Trinity/AuxPoW coin names from TUI; locks to ZION/Deeksha in UI |
| `full` | Enables **all** GPU backends (CUDA + Metal + OpenCL) + native algorithms |
| `gpu-cuda` | NVIDIA CUDA backend (runtime compilation via libnvrtc) |
| `gpu-opencl` | OpenCL backend (AMD / Intel / NVIDIA) |
| `gpu-metal` | Apple Metal backend (macOS only — platform-gated) |
| `gpu-all` | Alias for `gpu-cuda + gpu-opencl + gpu-metal` |
| `native-all` | Native C/C++ algorithm implementations |
| `native-hashers` | Native hashers (VerusHash, RandomX, BLAKE3) |

> **`full` = `gpu-all + native-all + native-hashers`** — recommended for release builds.

---

## 2. Linux x86_64

**Target:** `x86_64-unknown-linux-gnu`
**Tested on:** Ubuntu 22.04 LTS, Debian 12, SMOS, HiveOS

### System dependencies

```bash
sudo apt update
sudo apt install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    clang \
    llvm-dev \
    lld \
    opencl-headers \
    ocl-icd-opencl-dev

# NVIDIA CUDA (optional — runtime compilation, no full toolkit needed)
# The cudarc crate uses libnvrtc for runtime PTX compilation.
# If you have the CUDA toolkit installed, cudarc will find it automatically.
# If not, install just the NVRTC runtime:
sudo apt install -y nvidia-cuda-toolkit   # full toolkit (optional)
# OR: just libnvrtc is enough for runtime compilation
```

### GPU drivers

```bash
# AMD/Intel: install OpenCL runtime
sudo apt install -y mesa-opencl-icd vulkan-radeon
# Verify:
clinfo -l   # should list your GPU

# NVIDIA: driver 525+ required
nvidia-smi  # verify driver
# The miner uses libnvrtc (bundled with driver) for CUDA runtime compilation
```

### Build

```bash
# Option A: Use the build script (recommended)
cd /home/zionserver/2.9.6-main/MinerP3.0.6
./build.sh
# Output: MinerP3.0.6/dist/zion-miner-linux-x86_64.tar.gz

# Option B: Manual build
cd /home/zionserver/2.9.6-main/V3
cargo build --release --target x86_64-unknown-linux-gnu -p zion-miner \
    --bin zion-miner \
    --features public_build,full
# Binary: V3/target/x86_64-unknown-linux-gnu/release/zion-miner
```

### Verify

```bash
./zion-miner --version
./zion-miner --help
./zion-miner --detect-hardware
./zion-miner --bench
./zion-miner --verus-bench
./zion-miner --randomx-bench
./zion-miner --gpu-benchmark-all
```

### Expected benchmark (GTX 1070 Ti / Ryzen 5 3600)

```
deeksha_lite_v1 (GPU/OpenCL):  ~28 KH/s
deeksha_chv3 (GPU/OpenCL):     ~28 KH/s
deeksha_fire (GPU/OpenCL):    ~29 KH/s
VerusHash v2.2 (CPU/C++):      ~2.15 MH/s
RandomX (CPU/JIT+AES):        ~2.81 KH/s
```

---

## 3. Linux ARM64

**Target:** `aarch64-unknown-linux-gnu`
**Tested on:** Raspberry Pi 5 (8GB), NVIDIA Jetson Orin

### System dependencies

```bash
sudo apt update
sudo apt install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    clang \
    llvm-dev \
    lld \
    opencl-headers \
    ocl-icd-opencl-dev
```

### Add Rust target

```bash
# If building on x86_64 (cross-compile):
rustup target add aarch64-unknown-linux-gnu

# If building on ARM64 natively (Raspberry Pi):
# No extra target needed — just build directly
```

### Cross-compile (from x86_64 host)

```bash
# Install cross-linker
sudo apt install -y gcc-aarch64-linux-gnu

# Set linker
export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc

cd /home/zionserver/2.9.6-main/V3
cargo build --release --target aarch64-unknown-linux-gnu -p zion-miner \
    --bin zion-miner \
    --features public_build,full
# Binary: V3/target/aarch64-unknown-linux-gnu/release/zion-miner
```

### Native build (on Raspberry Pi 5)

```bash
cd /home/zionserver/2.9.6-main/V3
cargo build --release -p zion-miner \
    --bin zion-miner \
    --features public_build,full
# Binary: V3/target/release/zion-miner
```

### Package

```bash
mkdir -p dist/linux-aarch64
cp V3/target/aarch64-unknown-linux-gnu/release/zion-miner dist/linux-aarch64/
cd dist/linux-aarch64
tar czf zion-miner-linux-aarch64.tar.gz zion-miner
sha256sum zion-miner-linux-aarch64.tar.gz > SHA256SUMS.txt
```

> **GPU on ARM64:** OpenCL works on Mali/Adreno GPUs. CUDA works on NVIDIA Jetson.
> `cosmic_harmony_ekam_v2` requires 5+ GB VRAM — may fail on 4GB Pi 5.

---

## 4. macOS Apple Silicon

**Target:** `aarch64-apple-darwin`
**Tested on:** M1, M2, M3, M4

### System dependencies

```bash
# Xcode command line tools
xcode-select --install

# OpenMP (for native algorithms)
brew install libomp

# Set OpenMP paths
export LDFLAGS="-L/opt/homebrew/opt/libomp/lib"
export CPPFLAGS="-I/opt/homebrew/opt/libomp/include"
export LIBRARY_PATH="/opt/homebrew/opt/libomp/lib:$LIBRARY_PATH"
```

### Build (native)

```bash
cd /path/to/2.9.6-main/V3
cargo build --release -p zion-miner \
    --bin zion-miner \
    --features public_build,full
# Binary: V3/target/release/zion-miner
```

> **Metal:** The `gpu-metal` feature is automatically compiled on macOS.
> On non-macOS platforms, Metal code is a no-op (platform-gated with
> `#[cfg(all(feature = "gpu-metal", target_os = "macos"))]`).

### Package

```bash
mkdir -p dist/macos-aarch64
cp V3/target/release/zion-miner dist/macos-aarch64/
cd dist/macos-aarch64
tar czf zion-miner-macos-aarch64.tar.gz zion-miner
shasum -a 256 zion-miner-macos-aarch64.tar.gz > SHA256SUMS.txt
```

### Verify

```bash
./zion-miner --detect-hardware
# Should show: Metal GPU (Apple Silicon), CPU cores
./zion-miner --gpu-benchmark-all
```

---

## 5. macOS Intel

**Target:** `x86_64-apple-darwin`
**Tested on:** Intel Mac (pre-2020)

### Build (cross-compile from Apple Silicon)

```bash
# Add target
rustup target add x86_64-apple-darwin

cd /path/to/2.9.6-main/V3
cargo build --release --target x86_64-apple-darwin -p zion-miner \
    --bin zion-miner \
    --features public_build,full
# Binary: V3/target/x86_64-apple-darwin/release/zion-miner
```

### Build (native on Intel Mac)

```bash
cd /path/to/2.9.6-main/V3
cargo build --release -p zion-miner \
    --bin zion-miner \
    --features public_build,full
# Binary: V3/target/release/zion-miner
```

### Package

```bash
mkdir -p dist/macos-x86_64
cp V3/target/x86_64-apple-darwin/release/zion-miner dist/macos-x86_64/
cd dist/macos-x86_64
tar czf zion-miner-macos-x86_64.tar.gz zion-miner
shasum -a 256 zion-miner-macos-x86_64.tar.gz > SHA256SUMS.txt
```

> **macOS Intel GPU:** Uses OpenCL (Intel Iris/AMD). Metal is available but
> optimized for Apple Silicon.

---

## 6. Windows x86_64

**Target:** `x86_64-pc-windows-gnu`
**Tested on:** Windows 10, Windows 11

### Cross-compile from Linux

```bash
# Install prerequisites
rustup target add x86_64-pc-windows-gnu
sudo apt install -y mingw-w64

# Build
cd /home/zionserver/2.9.6-main/MinerP3.0.6
./build-windows.sh
# Output: MinerP3.0.6/dist/zion-miner-windows-x86_64.zip
```

### Manual cross-compile

```bash
cd /home/zionserver/2.9.6-main/V3
cargo build --release --target x86_64-pc-windows-gnu -p zion-miner \
    --bin zion-miner \
    --features public_build,full
# Binary: V3/target/x86_64-pc-windows-gnu/release/zion-miner.exe
```

### Package

```bash
mkdir -p dist/zion-miner-windows-x86_64
cp V3/target/x86_64-pc-windows-gnu/release/zion-miner.exe dist/zion-miner-windows-x86_64/
cp MinerP3.0.6/dist/start.bat dist/zion-miner-windows-x86_64/
cd dist
zip -r zion-miner-windows-x86_64.zip zion-miner-windows-x86_64/
sha256sum zion-miner-windows-x86_64.zip > SHA256SUMS-windows.txt
```

### Windows GPU support

| Backend | Status |
|---------|--------|
| **CUDA** | ✅ NVIDIA GPUs (libnvrtc runtime compilation) |
| **OpenCL** | ⚠️ Coming in future release |
| **Metal** | N/A (macOS only) |

> **Known issue:** The `ring` / `aws-lc-sys` C dependencies may fail to
> cross-compile with `x86_64-pc-windows-gnu`. If you hit this, try the
> `x86_64-pc-windows-msvc` target instead (requires Visual Studio on
> a Windows machine or CI runner).

### Native build on Windows

```powershell
# Install Rust
# Download from https://rustup.rs

# Install Visual Studio Build Tools (for MSVC linker)
# https://visualstudio.microsoft.com/visual-cpp-build-tools/

cd C:\path\to\2.9.6-main\V3
cargo build --release --target x86_64-pc-windows-msvc -p zion-miner `
    --bin zion-miner `
    --features public_build,full
# Binary: V3\target\x86_64-pc-windows-msvc\release\zion-miner.exe
```

---

## 7. Feature Flags Reference

### Minimal build (CPU only, no GPU)

```bash
cargo build --release -p zion-miner --features public_build
```

### OpenCL only (AMD/Intel)

```bash
cargo build --release -p zion-miner --features public_build,gpu-opencl,native-all,native-hashers
```

### CUDA only (NVIDIA)

```bash
cargo build --release -p zion-miner --features public_build,gpu-cuda,native-all,native-hashers
```

### Metal only (macOS)

```bash
cargo build --release -p zion-miner --features public_build,gpu-metal,native-all,native-hashers
```

### Full build (all GPU backends + all native algorithms)

```bash
cargo build --release -p zion-miner --features public_build,full
```

### Feature matrix

| Feature combo | Linux x86_64 | Linux ARM64 | macOS aarch64 | macOS x86_64 | Windows x86_64 |
|---------------|:---:|:---:|:---:|:---:|:---:|
| `public_build` (CPU only) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `+gpu-opencl` | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| `+gpu-cuda` | ✅ | ✅ (Jetson) | ❌ | ❌ | ✅ |
| `+gpu-metal` | no-op | no-op | ✅ | ✅ | no-op |
| `+full` (all) | ✅ | ✅ | ✅ | ✅ | ✅ |

> Metal is platform-gated: on non-macOS it compiles as a no-op.
> On macOS, all three backends (CUDA/OpenCL/Metal) are compiled in.

---

## 8. Packaging & SHA256

### Linux/macOS tar.gz

```bash
# Single binary
tar czf zion-miner-{platform}-{arch}.tar.gz zion-miner
sha256sum zion-miner-{platform}-{arch}.tar.gz
# macOS: shasum -a 256
```

### Windows zip

```bash
# Include start.bat wrapper
mkdir zion-miner-windows-x86_64
cp zion-miner.exe zion-miner-windows-x86_64/
cp start.bat zion-miner-windows-x86_64/
zip -r zion-miner-windows-x86_64.zip zion-miner-windows-x86_64/
sha256sum zion-miner-windows-x86_64.zip
```

### Combined SHA256SUMS.txt

```bash
sha256sum \
    zion-miner-linux-x86_64.tar.gz \
    zion-miner-linux-aarch64.tar.gz \
    zion-miner-macos-aarch64.tar.gz \
    zion-miner-macos-x86_64.tar.gz \
    zion-miner-windows-x86_64.zip \
    > SHA256SUMS.txt
```

### Current release checksums (v3.0.6-beta, updated 2026-08-01)

```
f381ed321f759c663a252f8af11e514f7a99ae0d64ed7e9bdd00652c89c33d48  zion-miner-linux-x86_64.tar.gz
946c4c82df381c344a5df522a1a415e23e0df9038d9669723e3f9979a4caa22d  zion-miner-linux-aarch64.tar.gz
ed39b49cd5edaef3025b0f847903fe62dcd0ea33be5c550ec403091ef6660360  zion-miner-macos-aarch64.tar.gz
dbf45cf246c21ac96120987e290f23101eb25cf4dfc8731e3704dc7e45dbeb42  zion-miner-macos-x86_64.tar.gz
c85dd3831c6b77f6f4542dd31281449e0878dbcb7b29734a1daf44585c15f21b  zion-miner-windows-x86_64.zip
```

---

## 9. GitHub Release Upload

```bash
# Upload a single asset to existing release
gh release upload v3.0.6-beta \
    dist/zion-miner-linux-x86_64.tar.gz \
    --repo Zion-TerraNova/v3-Mainnet

# Replace an existing asset
gh release delete-asset v3.0.6-beta zion-miner-linux-x86_64.tar.gz \
    --repo Zion-TerraNova/v3-Mainnet
gh release upload v3.0.6-beta \
    dist/zion-miner-linux-x86_64.tar.gz \
    --repo Zion-TerraNova/v3-Mainnet

# Update SHA256SUMS.txt
gh release delete-asset v3.0.6-beta SHA256SUMS.txt \
    --repo Zion-TerraNova/v3-Mainnet
gh release upload v3.0.6-beta SHA256SUMS.txt \
    --repo Zion-TerraNova/v3-Mainnet

# Update release notes
gh release edit v3.0.6-beta \
    --repo Zion-TerraNova/v3-Mainnet \
    --notes-file RELEASE_NOTES.md \
    --title "ZION v3.0.6-beta — Trinity (Updated 2026-08-01)"

# Create a new release (all assets at once)
gh release create v3.0.6-beta \
    --repo Zion-TerraNova/v3-Mainnet \
    --title "ZION v3.0.6-beta — Trinity" \
    --notes-file RELEASE_NOTES.md \
    --prerelease \
    dist/zion-miner-linux-x86_64.tar.gz \
    dist/zion-miner-linux-aarch64.tar.gz \
    dist/zion-miner-macos-aarch64.tar.gz \
    dist/zion-miner-macos-x86_64.tar.gz \
    dist/zion-miner-windows-x86_64.zip \
    SHA256SUMS.txt
```

---

## 10. Troubleshooting

### Build fails: `ring` / `aws-lc-sys` (Windows cross-compile)

```
error: failed to run custom build command for `aws-lc-sys`
```

**Cause:** The `ring` and `aws-lc-sys` C dependencies don't cross-compile
cleanly with `x86_64-pc-windows-gnu`.

**Fix options:**
1. Use `x86_64-pc-windows-msvc` target (requires Windows + Visual Studio)
2. Build on a Windows machine natively
3. Use a CI runner (GitHub Actions `windows-latest`)

### Build fails: `linker 'aarch64-linux-gnu-gcc' not found`

```bash
sudo apt install -y gcc-aarch64-linux-gnu
export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc
```

### Build fails: `OpenCL headers not found`

```bash
sudo apt install -y opencl-headers ocl-icd-opencl-dev
# Verify:
ls /usr/include/CL/cl.h
```

### Build fails: `libomp not found` (macOS)

```bash
brew install libomp
export LDFLAGS="-L/opt/homebrew/opt/libomp/lib"
export CPPFLAGS="-I/opt/homebrew/opt/libomp/include"
export LIBRARY_PATH="/opt/homebrew/opt/libomp/lib:$LIBRARY_PATH"
```

### `cosmic_harmony_ekam_v2` fails with `CL_MEM_OBJECT_ALLOCATION_FAILURE`

**Cause:** The algorithm requires ~5.3 GB VRAM scratchpad. On 8 GB GPUs
this can fail if other processes use VRAM.

**Fix:** Close other GPU applications, or use a GPU with 6+ GB VRAM.
This is expected behavior — the algorithm is designed for high-VRAM cards.

### CUDA not detected (Linux)

```bash
# Check NVIDIA driver
nvidia-smi

# Check libnvrtc
ldconfig -p | grep nvrtc
# Should show: libnvrtc.so.12 or similar

# If missing, install CUDA runtime:
sudo apt install -y nvidia-cuda-toolkit
# OR just the NVRTC library:
sudo apt install -y libnvrtc12
```

### OpenCL not detected (Linux AMD)

```bash
# Install OpenCL runtime
sudo apt install -y mesa-opencl-icd
# OR for ROCm:
sudo apt install -y rocm-opencl

# Verify
clinfo -l
```

### Metal not detected (macOS)

```bash
# Metal is built-in on all Apple Silicon and Intel Macs with integrated GPU
# Verify:
ioreg -l | grep -i metal
# The miner should auto-detect Metal on macOS
```

### Binary crashes on startup (SMOS/HiveOS)

```bash
# SMOS uses an older glibc — build with Docker for compatibility:
docker run --rm -v $(pwd):/work -w /work ubuntu:20.04 bash -c '
    apt update && apt install -y build-essential pkg-config libssl-dev clang llvm-dev lld opencl-headers ocl-icd-opencl-dev curl
    curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
    cd V3 && cargo build --release -p zion-miner --features public_build,full
'
```

### Low hashrate on GPU

```bash
# Check GPU is actually being used
./zion-miner --detect-hardware

# Force GPU backend
./zion-miner --gpu opencl    # AMD/Intel
./zion-miner --gpu cuda     # NVIDIA
./zion-miner --gpu metal    # macOS

# Tune work size
export ZION_GPU_WORK_SIZE=8192
export ZION_NONCE_COUNT=32768
```

---

## Quick reference

| Platform | Target | Build script | Output |
|----------|--------|-------------|--------|
| Linux x86_64 | `x86_64-unknown-linux-gnu` | `./build.sh` | `dist/zion-miner-linux-x86_64.tar.gz` |
| Linux ARM64 | `aarch64-unknown-linux-gnu` | manual | `dist/zion-miner-linux-aarch64.tar.gz` |
| macOS aarch64 | `aarch64-apple-darwin` | `./build-macos.sh` | `dist/zion-miner-macos-aarch64.tar.gz` |
| macOS x86_64 | `x86_64-apple-darwin` | `./build-macos.sh` | `dist/zion-miner-macos-x86_64.tar.gz` |
| Windows x86_64 | `x86_64-pc-windows-gnu` | `./build-windows.sh` | `dist/zion-miner-windows-x86_64.zip` |

---

## Support

- **Website:** [zionterranova.com](https://zionterranova.com)
- **Explorer:** [app.zionterranova.com](https://app.zionterranova.com)
- **OASIS:** [oasis.zionterranova.com](https://oasis.zionterranova.com)
- **Pool:** `62.171.141.136:8444`
- **RPC:** `rpc.zionterranova.com:8443`
- **GitHub:** [Zion-TerraNova/v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet)
- **Release:** [v3.0.6-beta](https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.6-beta)

---

*Last updated: 2026-08-01*
