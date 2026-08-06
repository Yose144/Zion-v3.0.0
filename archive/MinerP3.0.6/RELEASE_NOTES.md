# ZION v3.1.0 — Boost Miner

**Mine ZION. Earn ZION. Grow ZION.**

> **⚠️ Mainnet Beta — mine and transact at your own risk**
> The network is live and producing blocks. Genesis chain is permanent. Official public launch: **31 December 2026**.

---

## What's new in v3.1.0?

### One-click GPU auto-detect

The v3.1.0 public miner now auto-detects the best available GPU backend on your machine:

| Platform | NVIDIA | AMD / Intel | Apple Silicon |
|----------|--------|-------------|---------------|
| Linux x86_64 | CUDA | OpenCL | — |
| Windows x86_64 | CUDA | OpenCL | — |
| macOS aarch64 | — | OpenCL (legacy) | Metal |
| macOS x86_64 | — | OpenCL (legacy) | Metal |

No flags needed — just run `zion-miner` and it picks CUDA → OpenCL → Metal → CPU automatically.

### Public build (Boost branding)

This is the **public-facing** miner. TUI, logs and status screens show only the **ZION / Boost** stream. Internal Trinity/AuxPoW streams still run in the background to optimize revenue, but their coin names (VRSC, ZANO, etc.) are hidden from the user.

### Unified native algorithms

All builds include `native-all` + `native-hashers`: VerusHash, RandomX, GhostRider, Etchash, KawPow, Autolykos, kHeavyHash, BLAKE3, Cosmic Harmony.

---

## Download

### Which file should I download?

| Your system | File | SHA256 |
|-------------|------|--------|
| **Linux x86_64** (Ubuntu, Debian, SMOS, HiveOS) | `zion-miner-linux-x86_64.tar.gz` | `38aeb552b3297bd55351670f9c3e96e6c7b5989bd33d9e5e1db3ef81d32f452f` |
| **macOS Apple Silicon** (M1/M2/M3/M4) | `zion-miner-macos-aarch64.tar.gz` | `798e01b7247377478fa36818052ccf79706093f72f065e5f8b6845a22eb58fde` |
| **macOS Intel** (pre-2020 Macs) | `zion-miner-macos-x86_64.tar.gz` | `401de01e8917c3e5d0b8b05ecd2ea0f3c1fbb7b956f9fe5c58f35502c6a0ab50` |
| **Windows x86_64** (10/11) | `zion-miner-windows-x86_64.zip` | `c9e233c7294f9f7e7dfee05006f28f6dd2b7a531216490653541c3051c2b7ecc` |

> Verify against `SHA256SUMS.txt` included in this release.

---

## Quick Start

### Linux / macOS

```bash
# download the file for your platform, then:
tar xzf zion-miner-<platform>-<arch>.tar.gz
chmod +x zion-miner
./zion-miner
```

### Windows

```powershell
# extract the zip, then run:
zion-miner-windows-x86_64\zion-miner.exe
# or double-click start.bat
```

---

## GPU support

- **NVIDIA (Linux/Windows):** CUDA runtime is loaded dynamically via `libnvrtc` / `nvcuda.dll`. Install the latest NVIDIA driver; a full CUDA Toolkit is **not** required.
- **AMD/Intel (Linux/Windows):** OpenCL runtime required (`mesa-opencl-icd`, `rocm-opencl`, or Intel/OpenCL runtime).
- **Apple Silicon / Intel Mac:** Metal is built-in. OpenCL is deprecated by Apple but still used as a fallback.

---

## Build information

All binaries in this release were cross-compiled from an Apple Silicon Mac using:

- `public_build` — public Boost branding
- `full` — OpenCL + all native algorithms
- `gpu-cuda` — added for Linux/Windows (NVIDIA support)
- `gpu-metal` — added for macOS (Apple Silicon/Intel Metal support)
- `ZION_DISABLE_OPENMP=1` — binaries do not depend on Homebrew `libomp`

---

## Support

- Website: [zionterranova.com](https://zionterranova.com)
- Explorer: [app.zionterranova.com](https://app.zionterranova.com)
- Pool: `62.171.141.136:8444`
- RPC: `rpc.zionterranova.com:8443`
