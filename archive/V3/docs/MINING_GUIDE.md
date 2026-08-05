# ZION V3 Mining Guide

> **Version:** 3.0.0 (v2.9.8 Deeksha canonical)  
> **Algorithm:** Cosmic Harmony Ekam Deeksha v2  
> **Network:** ZION Mainnet

---

## Quick Start

For rig OS deployment (SimpleMining OS custom miner package), see [SMOS_INTEGRATION.md](SMOS_INTEGRATION.md).

### 1. Download the miner

Download the latest `zion-miner` binary from the
[GitHub Releases](https://github.com/Yose144/2.9.6/releases) page or build
from source:

```bash
cd V3
cargo build --release -p zion-miner
# binary at target/release/zion-miner
```

### 2. Connect to a pool

```bash
export ZION_POOL_ADDR="pool.zionchain.io:3333"
export ZION_MINER_ID="zion1YourAddressHere"
export ZION_WORKER_NAME="rig-01"
export ZION_PROFILE=pool
./zion-miner
```

### 3. Solo mining (local node required)

```bash
export ZION_MINER_ID="zion1YourAddressHere"
export ZION_PROFILE=solo
./zion-miner
```

---

## Configuration Profiles

Set `ZION_PROFILE` to apply sensible defaults for your use case.
Individual env vars still override profile defaults.

| Profile | Use Case | Key Behavior |
|---------|----------|--------------|
| `pool` | Long-running pool mining | Autotune ON, reconnect ON, loop=1M |
| `solo` | Solo mining with local node | Large nonce window (5M), no reconnect |
| `benchmark` | Performance measurement | Short burst (10 iterations), no autotune |
| `dual` | Pool + DCR stealth worker | Pool profile + DCR sidecar enabled |

---

## Environment Variables Reference

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_MINER_ID` | `local-miner` | Your ZION wallet address (payout destination) |
| `ZION_WORKER_NAME` | `cpu-rig-0` | Rig/worker name shown in pool stats |
| `ZION_POOL_ADDR` | *(none)* | Pool stratum address (e.g. `pool.zionchain.io:3333`) |
| `ZION_PROFILE` | *(none)* | Config profile: `pool`, `solo`, `benchmark`, `dual` |
| `ZION_LOOP_COUNT` | `1` | Mining iterations before exit |
| `ZION_START_NONCE` | `42` | Starting nonce value |
| `ZION_NONCE_COUNT` | `1024` | Nonce search range per job |
| `ZION_NONCE_STRIDE` | `1024` | Nonce window advancement per iteration |
| `ZION_JOB_TTL_MS` | `15000` | Maximum time (ms) to work a single job |
| `ZION_SLEEP_MS` | `0` | Delay between hashing iterations (throttle) |
| `ZION_TARGET` | *(max)* | Difficulty target override (64 hex chars) |
| `ZION_REVENUE_SOURCE` | `zion` | Revenue attribution: `zion`, `blake3`, `ncl` |
| `ZION_REVENUE_USD` | `1.25` | Revenue value per share (for accounting) |

### Autotune

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_NONCE_AUTOTUNE` | `true` | Adaptive nonce window sizing |
| `ZION_NONCE_COUNT_MIN` | `10000` | Minimum nonce window |
| `ZION_NONCE_COUNT_MAX` | `5000000` | Maximum nonce window |
| `ZION_NONCE_ADJUST_PCT` | `50` | Window resize step (%) |
| `ZION_REMOTE_TTL_GUARD_PCT` | `90` | Skip submit if scan exceeds N% of pool TTL |

### Reconnection

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_RECONNECT` | `true` | Auto-reconnect to pool on disconnect |
| `ZION_MAX_RECONNECT` | `0` | Max reconnect attempts (0 = infinite) |

### Telemetry

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_METRICS_REPORT_SECS` | `30` | Status report interval (0 to disable) |

### GPU (when available)

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_GPU_WORK_SIZE` | `1048576` | GPU work-items per dispatch |
| `ZION_CUDA_WORK_CAP` | `32768` | Hard cap for CUDA work size; validated sweet spot for RTX 5090 release benchmark |
| `ZION_GPU_AUTOTUNE` | *(off)* | Enable GPU workload auto-tuning |
| `ZION_GPU_AUTOTUNE_SECS` | *(gpu-specific)* | Autotune interval in seconds |
| `ZION_BENCH_SECS` | `5.0` | Benchmark duration (`--bench` / `--gpu-bench`) |

Current validated NVIDIA result:
- RTX 5090, release build, canonical CUDA backend: `30.37 kH/s` at effective `work_size=32768`
- Nearby sweep: `24576 -> 25.00 kH/s`, `40960 -> 30.04 kH/s`, `49152 -> 21.06 kH/s`

### DCR Dual-Mining

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_DCR_ENABLED` | `false` | Enable Decred CPU stealth worker |
| `ZION_DCR_POOL` | *(required)* | Decred pool address |
| `ZION_DCR_WORKER` | *(required)* | DCR worker name |
| `ZION_DCR_THREADS` | *(auto)* | CPU threads for DCR |
| `ZION_DCR_BACKEND` | `auto` | Backend: `auto`, `cpu`, `gpu` |
| `ZION_DCR_HASH_IMPL` | `rust` | Hash impl: `rust`, `native` (FFI) |
| `ZION_DCR_ONLY` | `false` | Run DCR exclusively (no ZION mining) |
| `ZION_DCR_RUN_SECS` | `120` | DCR-only run duration |

---

## Example Configurations

### Headless pool miner (systemd)

```ini
# /etc/systemd/system/zion-miner.service
[Unit]
Description=ZION V3 Pool Miner
After=network.target

[Service]
Environment=ZION_PROFILE=pool
Environment=ZION_POOL_ADDR=pool.zionchain.io:3333
Environment=ZION_MINER_ID=zion1YourAddressHere
Environment=ZION_WORKER_NAME=server-01
ExecStart=/usr/local/bin/zion-miner
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Docker pool miner

```bash
docker run --rm \
  -e ZION_PROFILE=pool \
  -e ZION_POOL_ADDR=pool.zionchain.io:3333 \
  -e ZION_MINER_ID=zion1YourAddressHere \
  -e ZION_WORKER_NAME=docker-01 \
  ghcr.io/yose144/zion-v3-miner:latest
```

### Benchmark (quick performance test)

```bash
export ZION_PROFILE=benchmark
./zion-miner --bench
```

### Dual mining (ZION + DCR)

```bash
export ZION_PROFILE=dual
export ZION_POOL_ADDR=pool.zionchain.io:3333
export ZION_MINER_ID=zion1YourAddressHere
export ZION_DCR_POOL=stratum+tcp://dcr.pool.example:3333
export ZION_DCR_WORKER=myDcrWorker
./zion-miner
```

---

## Pool List

| Pool | Address | Region | Fee |
|------|---------|--------|-----|
| ZION Official Pool | `pool.zionchain.io:3333` | EU (Helsinki) | 0% |

> More pools will be listed as they come online. Pool operators: see the
> [Node Operator Guide](NODE_OPERATOR_GUIDE.md) for running your own pool.

---

## FAQ

**Q: What algorithm does ZION use?**  
A: ZION supports three algorithms, chosen per-miner session:
- `deeksha_lite_v1` (default) — lightweight memory-hard PoW with SHA3-512 + AES-256,
  256 KiB scratchpad, best for general CPU/GPU mining.
- `deeksha_lite_fire` (thermal-intensive) — same core but 512 KiB scratchpad,
  higher power draw, for dedicated rigs.
- `cosmic_harmony_ekam_deeksha_v2` ("full") — multi-phase hash combining SHA-256,
  SHA3-256, Keccak-256, and BLAKE3, the original CPU-friendly algorithm.
Set your algorithm via `zion config set miner.algorithm <algo>` or pass
`--algorithm <algo>` to `zion mine start`.

**Q: Can I mine with a GPU?**  
A: GPU support is available via OpenCL. Use `--gpu-bench` to verify your GPU
is detected, then mine normally. CPU mining is the primary and best-tested
path.

**Q: How do payouts work?**  
A: The pool uses PPLNS (Pay Per Last N Shares) with a sliding window of 1000
shares. Payouts are proportional to your share contribution. Minimum payout
threshold applies to prevent dust transactions.

**Q: What is the block reward?**  
A: 5,400 ZION per block. Revenue is distributed through the pool's PPLNS
engine.

**Q: How do I check my mining stats?**  
A: The pool exposes metrics at the `/stats` endpoint (JSON) and `/metrics`
endpoint (Prometheus format) on the routing metrics port.

**Q: What does "stale job" mean?**  
A: A new block was found before your share was submitted. The pool
automatically cancels stale jobs and issues fresh ones. This is normal
behavior — stale rates below 5% are healthy.

**Q: Can I run multiple miners with the same wallet?**  
A: Yes. Use different `ZION_WORKER_NAME` values to distinguish rigs in pool
statistics. All shares are credited to the same `ZION_MINER_ID` address.

**Q: What is DCR dual-mining?**  
A: When `ZION_PROFILE=dual`, the miner runs a secondary Decred (DCR) CPU
worker in the background, earning DCR alongside ZION with minimal performance
impact.
