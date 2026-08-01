# ZION Miner — SMOS / HiveOS / SimpleMining Guide

**Version:** v3.0.6-beta
**Pool:** `62.171.141.136:8444`
**Website:** [zionterranova.com](https://zionterranova.com)
**FAQ:** [docs/FAQ.md](./FAQ.md) — common questions for beginners and rig operators

---

## Quick Start — SMOS (SimpleMining OS)

### 1. What you need

- A SMOS rig with **x86_64** CPU (most AMD/Intel rigs).
- A ZION wallet address (`zion1...`).
- Internet access from the rig.

### 2. Create the SMOS wrapper script

Create a file named `miner` (SMOS will run this file). Replace `zion1YOUR_WALLET_ADDRESS` and `my-rig` with your real wallet and worker name.

```bash
#!/bin/bash
set -euo pipefail

# ── Your ZION wallet address ──
WALLET="zion1YOUR_WALLET_ADDRESS"
WORKER="my-rig"

# ── Paths ──
RELEASE="https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz"
MINER_DIR="/tmp/zion-miner-smos"
MINER_BIN="${MINER_DIR}/zion-miner"

# ── Download and extract miner if missing ──
if [ ! -f "${MINER_BIN}" ]; then
    echo "[zion] downloading release ${RELEASE} ..."
    mkdir -p "${MINER_DIR}"
    curl -fsSL -o "${MINER_DIR}/zion-miner.tar.gz" "${RELEASE}"
    tar xzf "${MINER_DIR}/zion-miner.tar.gz" -C "${MINER_DIR}"
    chmod +x "${MINER_BIN}"
fi

# ── Run miner (non-interactive SMOS mode) ──
exec "${MINER_BIN}" \
    --pool 62.171.141.136:8444 \
    --wallet "${WALLET}" \
    --worker "${WORKER}" \
    --gpu auto \
    --algorithm deeksha_lite_v1 \
    --profile pool
```

> **GPU backend:** `--gpu auto` will pick CUDA for NVIDIA, OpenCL for AMD/Intel, and CPU if no GPU is detected. You can also set it explicitly to `cuda` or `opencl`.

### 3. Package as SMOS custom miner

```bash
mkdir -p zion-smos/zion-miner-smos
cp miner zion-smos/zion-miner-smos/
chmod +x zion-smos/zion-miner-smos/miner
cd zion-smos
zip -r zion-miner-smos.zip zion-miner-smos/
```

### 4. Upload to SMOS

1. Go to **SMOS Dashboard** → **Rig Groups** → **Create Group**
2. Set **Miner Program** → **Custom**
3. Upload `zion-miner-smos.zip`
4. Set **Miner Path**: `zion-miner-smos/miner`
5. Assign your rig(s) to this group
6. **Save & Reboot** the rig

---

## Quick Start — HiveOS

### 1. Create a custom miner

In HiveOS dashboard:

1. Go to **Miners** → **Custom Miners** → **Add New**
2. Name: `zion-miner`
3. Installation URL: `https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz`
4. Binary: `zion-miner`
5. Save

### 2. Create a flight sheet

| Field | Value |
|-------|-------|
| Miner | zion-miner (custom) |
| Pool | `62.171.141.136:8444` |
| Wallet | `zion1YOUR_WALLET_ADDRESS` |
| Worker | `my-rig` |
| Extra config | See below |

**Extra config arguments:**

```
--profile pool --gpu auto --algorithm deeksha_lite_v1
```

> `--gpu auto` selects CUDA for NVIDIA, OpenCL for AMD/Intel, and CPU if no GPU is found. Set `--gpu cuda` or `--gpu opencl` explicitly if you have a mixed rig and want to force one backend.

### 3. Apply and reboot

Apply the flight sheet to your rig and reboot. The miner will start
automatically.

---

## Quick Start — Linux (any distro)

```bash
# Download and extract
wget https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz
tar xzf zion-miner-linux-x86_64.tar.gz
chmod +x zion-miner start.sh

# Easy interactive menu (recommended for beginners)
./start.sh

# Or start directly from the command line
./zion-miner \
    --pool 62.171.141.136:8444 \
    --wallet zion1YOUR_WALLET_ADDRESS \
    --worker my-rig \
    --gpu auto \
    --algorithm deeksha_lite_v1 \
    --profile pool
```

---

## Environment Variables Reference

### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_POOL_ADDR` | `62.171.141.136:8444` | Pool address |
| `ZION_MINER_ID` | (wallet) | Miner identifier (your wallet address) |
| `ZION_PROFILE` | `pool` | Mining profile: `pool`, `solo`, `benchmark` |
| `ZION_INTERACTIVE` | `1` | `0` = no TUI (for SMOS/HiveOS headless) |
| `ZION_NO_STICKY` | `0` | `1` = disable sticky header (SMOS mode) |

### GPU Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_GPU_BACKEND` | `auto` | `opencl`, `cuda`, `metal`, `cpu` |
| `ZION_GPU_WORK_SIZE` | auto | Global work size (auto-tuned per GPU) |
| `ZION_NONCE_COUNT` | auto | Nonces per batch (4× work_size) |
| `ZION_GPU_MAX_BATCH` | auto | Max batch size cap |
| `ZION_GPU_EARLY_BREAK` | `0` | `0` = full batch + double-buffering (recommended) |
| `ZION_AUTOTUNE` | `1` | Auto-tune GPU parameters |
| `ZION_OCL_VRAM_PCT` | `65` | VRAM usage percentage |
| `ZION_IGNORE_GPU_SELF_TEST_FAIL` | `0` | `1` = skip GPU self-test failure (Vega compat) |
| `ZION_MULTI_GPU` | `1` | Auto-enable multi-GPU when 2+ GPUs detected |

### CPU Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_THREADS` | auto | CPU thread count (auto-detect) |

---

## GPU Compatibility

### AMD (OpenCL)

| GPU | Architecture | ZION Hashrate | Notes |
|-----|-------------|---------------|-------|
| Vega 64 8GB | GCN (gfx900) | 24-40 kH/s | `local_ws=64`, `work_size=16384` |
| RX 5700 XT 8GB | RDNA1 (gfx1010) | 28-30 kH/s | `local_ws=128`, `work_size=8192` |
| RX 5600 XT 6GB | RDNA1 (gfx1010) | 15-20 kH/s | `local_ws=128` |
| RX 580 8GB | GCN (gfx803) | 8-12 kH/s | Conservative tuning |

### NVIDIA (CUDA)

| GPU | ZION Hashrate | Notes |
|-----|---------------|-------|
| RTX 3090 24GB | 300+ kH/s | Async htod + batched launch |
| RTX 4090 24GB | 400+ kH/s | Latest Ampere optimizations |

> **Note:** The v3.0.6-beta prebuilt Linux x86_64 binary includes both **CUDA** and **OpenCL**. NVIDIA users on Linux x86_64 can use `--gpu cuda` or `--gpu auto` directly. For other platforms or custom builds, compile from source:
> ```bash
> cargo build --release -p zion-miner --features "gpu-cuda,native-all,public_build"
> ```

---

## Monitoring

### Machine-parseable output

The miner prints `session_status` lines to stdout/stderr for external
parsers (SMOS dashboard, monitoring scripts):

```
session_status iter=42/1000000 uptime_s=125.3 accepted=15 rejected=0 accept_pct=100.00 ...
```

### JSON stats file

```bash
cat /tmp/zion-miner-stats.json | python3 -m json.tool
```

### HTTP stats endpoint

```bash
curl http://127.0.0.1:8080/stats | python3 -m json.tool
```

---

## Troubleshooting

### GPU not detected

```bash
# Check OpenCL devices
clinfo | grep "Device Name"

# If clinfo is missing:
apt install clinfo ocl-icd-opencl-dev
```

### Vega 64 kernel hang

```bash
export ZION_IGNORE_GPU_SELF_TEST_FAIL=1
export ZION_OCL_VRAM_PCT=50
```

### Low hashrate on SMOS

```bash
# Ensure double-buffering is enabled (default):
export ZION_GPU_EARLY_BREAK=0

# Increase batch size:
export ZION_GPU_MAX_BATCH=65536
export ZION_NONCE_COUNT=65536
```

### Pool connection issues

1. Check pool address: `ZION_POOL_ADDR=62.171.141.136:8444`
2. Use pool profile: `ZION_PROFILE=pool`
3. Check firewall allows outbound to port 8444

---

## Build from Source

```bash
# Prerequisites: Rust 1.75+, OpenCL headers
apt install ocl-icd-opencl-dev opencl-headers

# Clone
git clone https://github.com/Zion-TerraNova/v3-Mainnet.git
cd v3-Mainnet/V3

# Build with OpenCL + all native algorithms + public_build
cargo build --release -p zion-miner --features "gpu-opencl,native-all,public_build"

# Binary: target/release/zion-miner
```

---

## Support

- **Website:** [zionterranova.com](https://zionterranova.com)
- **Pool:** `62.171.141.136:8444`
- **RPC:** `rpc.zionterranova.com:8443`
- **GitHub:** [Zion-TerraNova/v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet)

---

## License

MIT — see [LICENSE](https://github.com/Zion-TerraNova/v3-Mainnet/blob/main/LICENSE)

> The official miner binary includes the Trinity engine — a bonus layer
> that activates automatically when mining with the official pool. ZION's
> blockchain core, pool, and community CLI remain fully open-source under
> the MIT license.
