# ZION v3.0.6-beta — Trinity + SMOS/HiveOS

**Date:** 2026-07-25
**Tag:** `v3.0.6-beta`

**Mine ZION. Earn ZION. Grow ZION.**

> **⚠️ Mainnet Beta — mine and transact at your own risk**
> The network is live and producing blocks. Genesis chain is permanent.
> Official public launch: **31 December 2026**.

---

## What's new in v3.0.6 — Trinity + SMOS/HiveOS

### Trinity Mining Engine

The ZION v3.0.6 miner features our proprietary **Trinity** mining
engine — your GPU and CPU work together to maximize your ZION earnings.

- **Stream 1 (GPU):** ZION (Deeksha Lite v1) — always on
- **Stream 2 (GPU):** ZANO (ProgPoWZ) — auto-selected bonus coin
- **Stream 3 (CPU):** VRSC (VerusHash) — auto-selected bonus coin

**No exchanges, no selling, no price dumps.** The pool handles all
conversions internally — you mine ZION and earn ZION. Trinity adds
ZANO + VRSC as bonus income on top.

### SMOS / HiveOS / SimpleMining Support

This release adds full support for mining OS distributions:

- **SMOS (SimpleMining OS):** Custom miner package with wrapper script
- **HiveOS:** Custom miner integration with flight sheet
- **Any Linux:** Direct binary execution with `--profile pool`

The miner automatically detects headless mode (no TTY) and switches
to machine-parseable output for SMOS/HiveOS dashboards.

### Multi-GPU (Claymore Dual)

Multiple GPUs are automatically detected and used in parallel:

- **MultiGpuMiner:** Wraps multiple OpenCL devices, distributes nonce
  ranges proportionally to each GPU's hashrate
- **Dynamic workload balancing:** EMA-based per-GPU hashrate tracking
  ensures both cards finish batches simultaneously (no idle waiting)
- **Double-buffered async readback:** Two output buffers + dedicated
  read queue keep the GPU pipeline 100% full (+50% hashrate)

### Comprehensive Build

This release binary includes:

- **OpenCL GPU backend** (AMD, Intel, any OpenCL-compatible GPU)
- **All native algorithm accelerators** (VerusHash, RandomX, KawPow,
  Ethash, Autolykos, kHeavyHash, Blake3, Cosmic Harmony, GhostRider)
- **Trinity engine** (triple-stream parallel mining)
- **Multi-GPU support** (Claymore Dual mode)
- **`public_build` mode** (clean ZION-only TUI, Trinity in backend)

> **NVIDIA CUDA:** Not included in prebuilt binary. Build from source
> with `--features "gpu-cuda,native-all,public_build"` (requires CUDA
> 12.4 toolkit).

---

## Download

| Platform | File | Features |
|----------|------|----------|
| **Linux x86_64** (SMOS, HiveOS, Ubuntu, Debian) | `zion-miner-linux-x86_64.tar.gz` | OpenCL + native-all + Trinity |
| **Linux ARM64** (Raspberry Pi) | `zion-miner-linux-aarch64.tar.gz` | CPU-only |
| **macOS Apple Silicon** (M1/M2/M3/M4) | `zion-miner-macos-aarch64.tar.gz` | Metal + native-all |
| **macOS Intel** | `zion-miner-macos-x86_64.tar.gz` | CPU-only |
| **Windows x86_64** | `zion-miner-windows-x86_64.tar.gz` | CPU-only |

> Full SHA256 checksums in `SHA256SUMS.txt`.

---

## Quick Start

### SMOS / HiveOS

See the comprehensive guide: **[SMOS/HiveOS Guide](docs/SMOS_HIVEOS_GUIDE.md)**

### Linux (any distro)

```bash
# Download
wget https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz
tar xzf zion-miner-linux-x86_64.tar.gz
chmod +x zion-miner

# Start mining (Trinity auto-enabled with --profile pool)
./zion-miner \
    --pool 62.171.141.136:8444 \
    --wallet zion1YOUR_WALLET_ADDRESS \
    --worker my-rig \
    --gpu opencl \
    --algorithm deeksha_lite_v1 \
    --profile pool
```

### Create a wallet

```bash
# If you have the ZION CLI:
zion wallet new

# Or use the web wallet at zionterranova.com
```

---

## Trinity Configuration

Trinity is **auto-enabled** with `--profile pool`. No extra config needed.

### Force specific coins (optional)

```bash
export ZION_MINER_GPU_COIN=ZANO    # Stream 2: ZANO
export ZION_MINER_CPU_COIN=VRSC    # Stream 3: VRSC
```

### Disable streams (optional)

```bash
export ZION_STREAM2_ENABLED=0      # Disable GPU external (ZION only)
export ZION_STREAM3_ENABLED=0      # Disable CPU external
```

### Multi-GPU (2+ GPUs)

```bash
# Auto-detected — all GPUs mine ZION in parallel
# ZANO shares the best ProgPoW GPU via time-slicing
export ZION_MULTI_GPU=1            # default: auto
export ZION_ZANO_RESERVE=0         # all GPUs → ZION, ZANO time-shared
```

---

## GPU Performance

| GPU | ZION (kH/s) | ZANO (MH/s) | Notes |
|-----|-------------|-------------|-------|
| Vega 64 8GB | 24-40 | 9-14 | GCN, local_ws=64, work_size=16384 |
| RX 5700 XT | 28-30 | 7 | RDNA1, local_ws=128, work_size=8192 |
| RX 5600 XT | 15-20 | 5.5 | RDNA1, bpermute enabled |
| RTX 3090 | 300+ | — | CUDA (build from source) |

---

## Build from Source

```bash
# Prerequisites
apt install ocl-icd-opencl-dev opencl-headers

# Clone
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3

# Build (OpenCL + all native + public_build)
cargo build --release -p zion-miner --features "gpu-opencl,native-all,public_build"

# For NVIDIA CUDA (requires CUDA 12.4 toolkit):
cargo build --release -p zion-miner --features "gpu-cuda,native-all,public_build"
```

---

## Support

- **Website:** [zionterranova.com](https://zionterranova.com)
- **Pool:** `62.171.141.136:8444`
- **RPC:** `rpc.zionterranova.com:8443`
- **SMOS/HiveOS Guide:** [docs/SMOS_HIVEOS_GUIDE.md](docs/SMOS_HIVEOS_GUIDE.md)
- **GitHub:** [Zion-TerraNova/v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet)

---

## License

MIT — see [LICENSE](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/LICENSE)

> The miner binary includes the proprietary Trinity engine and AuxPow
> code. Source code for Trinity/AuxPow is not included in the public
> repository. The ZION blockchain core, pool, and community CLI remain
> fully open-source under MIT.
