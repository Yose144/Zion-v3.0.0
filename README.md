# ZION TerraNova v3.0.6

> **Proof of Work Layer 1 for the next 100 years.**
> From blockchain to the stars.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Status:** Mainnet Beta · 3.0.6 "Triple Parallel" Live · 14/14 Services Active · Chain Height 5800+ · Web Image 377 MB (85% smaller) · Public Launch: 31 December 2026

**DeekshaChv3 Parallel Streaming:** ZION Deeksha on GPU + external coins (VRSC, KAS, ALPH, DCR, ERG, ETC, RVN, FLUX) on CPU — all algorithms run **simultaneously**, not alternating. Deployed to Edge pool 2026-07-13.

**CUDA Backend (NEW 2026-07-18):** Native CUDA kernel for `deeksha_lite_fire` achieving **303.8 KH/s on RTX 3090** (46.7x faster than OpenCL port). Async host-device copies + pool I/O pipelining + PTXAS O3. See [`CUDA_TUNING_RTX.md`](CUDA_TUNING_RTX.md) for full optimization report.

**Canonical documentation for 3.0.5:** [`docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md`](docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md) — full Czech report.  
**Runbook:** [`docs/3.0.5/ZION_3.0.5_ALL_GREEN_RUNBOOK.md`](docs/3.0.5/ZION_3.0.5_ALL_GREEN_RUNBOOK.md) — canonical 7-phase runbook.  
**3.0.4 release overview:** [`3.0.4.md`](3.0.4.md) — DeFi deploy + TX unification.

**Operational status:** [`StatusV3.md`](StatusV3.md)  
**Agent rules:** [`AGENTS.md`](AGENTS.md)  
**V3 architecture + code:** [`V3/README.md`](V3/README.md) · [`V3/ROADMAP.md`](V3/ROADMAP.md)  
**Historical docs:** [`docs/3.0.3/`](docs/3.0.3/) — 3.0.3 and older archived material

---

## Quick Links

| What | Where |
|------|-------|
| **3.0.5 All Green report (CZ)** | [`docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md`](docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md) |
| **3.0.5 runbook** | [`docs/3.0.5/ZION_3.0.5_ALL_GREEN_RUNBOOK.md`](docs/3.0.5/ZION_3.0.5_ALL_GREEN_RUNBOOK.md) |
| **3.0.4 release overview** | [`3.0.4.md`](3.0.4.md) |
| **Live status + blockers** | [`StatusV3.md`](StatusV3.md) |
| **V3 workspace code** | [`V3/`](V3/) |
| **Forward roadmap** | [`ROADMAP.md`](ROADMAP.md) |
| **Engineering detail** | [`V3/ROADMAP.md`](V3/ROADMAP.md) |
| **Mainnet constants** | [`V3/docs/MAINNET_CONSTANTS.md`](V3/docs/MAINNET_CONSTANTS.md) |
| **CLI guide** | [`V3/docs/CLI_GUIDE.md`](V3/docs/CLI_GUIDE.md) |
| **Deploy runbook** | [`V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md`](V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md) |
| **W11 / Ubuntu launchers** | [`ZionStart/README.md`](ZionStart/README.md) |
| **Agent rules** | [`AGENTS.md`](AGENTS.md) |
| **Genesis regeneration** | [`docs/GENESIS_REGENERATION_RUNBOOK.md`](docs/GENESIS_REGENERATION_RUNBOOK.md) |
| **CUDA tuning report** | [`CUDA_TUNING_RTX.md`](CUDA_TUNING_RTX.md) |
| **Historical 3.0.3 docs** | [`docs/3.0.3/`](docs/3.0.3/) |

---

## What is ZION?

ZION is a decentralized **Layer 1 blockchain** built from scratch in **Rust**, running a canonical Proof-of-Work consensus with CPU and GPU acceleration.

v3.0.5 is the current mainnet line under [`V3/`](V3/). It features a 6-layer architecture, a **Decade Decay** emission schedule designed for **100+ years**, and dedicated funding for planetary-scale humanitarian and space projects. The 3.0.5 "All Green" upgrade completed on 2026-07-09 — all 11 services active, protocol bumped to 3.0.5, E2E memo tests verified on live chain, web deploy optimized (Docker image 2.57 GB → 377 MB).

---

## Quick Start

### Run with Docker

```bash
# Mainnet stack (node + pool + monitoring)
docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d

# With monitoring dashboard
docker compose -f V3/docker/docker-compose.yml --profile mainnet --profile monitoring up -d
```

### Run from Source

```bash
# Build workspace
cargo check --manifest-path V3/Cargo.toml --workspace

# Run node
ZION_NODE_ID=local-node ZION_P2P_BIND=0.0.0.0:8333 ZION_RPC_BIND=0.0.0.0:8443 \
  cargo run --release --manifest-path V3/Cargo.toml -p zion-core --bin node

# Run pool
ZION_POOL_BIND=0.0.0.0:8444 ZION_NODE_RPC_ADDR=127.0.0.1:8443 \
  cargo run --release --manifest-path V3/Cargo.toml -p zion-pool --bin server

# Unified CLI
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help
```

### Mine

**Pool:** `62.171.141.136:8444` (Edge — public)  
**RPC:** `rpc.zionterranova.com:8443` (public via nginx TCP proxy)

**DeekshaChv3 Parallel Streaming** — the pool sends ZION Deeksha jobs with embedded external coin jobs (VRSC, KAS, ALPH, etc.). The miner runs ZION on GPU and the external coin on CPU **simultaneously**. Both streams submit shares independently.

```powershell
# Windows (PowerShell) — GPU miner connecting to Edge pool
$env:ZION_POOL_ADDR='62.171.141.136:8444'
$env:ZION_WORKER_NAME='my-rig-01'
$env:ZION_MINER_ID='my-rig-01'
$env:ZION_PAYOUT_ADDRESS='zion1<your-44-char-address>'   # REQUIRED
$env:ZION_LOOP_COUNT='1000000'
$env:ZION_GPU_BACKEND='opencl'
cargo run --release --manifest-path V3/Cargo.toml -p zion-miner --features full
```

```bash
# Linux — unified miner with all algorithms (GPU + CPU native)
cargo run --release --manifest-path V3/Cargo.toml -p zion-miner --features full -- \
  --pool 62.171.141.136:8444 \
  --wallet zion1<your-address> \
  --worker my-rig \
  --gpu opencl \
  --algorithm deeksha_lite_v1 \
  --threads 4
```

**Supported algorithms:**
- **ZION:** `deeksha_lite_v1`, `cosmic_harmony_ekam_deeksha_v2`, `deeksha_lite_fire`
- **External GPU:** blake3 (ALPH/DCR), kheavyhash (KAS), autolykos (ERG), kawpow (RVN/CLORE), ethash (ETC), zelhash (FLUX)
- **External CPU:** verushash (VRSC), randomx (XMR)
- **Special:** `auto` (autotune — benchmark all and pick best)

### CUDA Backend (NVIDIA RTX 3090+)

Native CUDA kernel for `deeksha_lite_fire` — **45.6x faster** than OpenCL port.

```bash
# Linux — CUDA miner (RTX 3090, 295.6 KH/s)
cargo run --release --manifest-path V3/Cargo.toml -p zion-miner \
  --features "gpu-cuda,native-randomx,native-kheavyhash,native-verushash,native-hashers" -- \
  --pool 62.171.141.136:8444 \
  --wallet zion1<your-address> \
  --worker rtx3090 \
  --gpu cuda \
  --algorithm deeksha_lite_fire
```

**Optimal CUDA config (RTX 3090):**
```bash
export ZION_GPU_WORK_SIZE=32768
export ZION_CUDA_TPB=128
export ZION_CUDA_ARCH=sm_86
export ZION_GPU_MAX_BATCH=262144
```

| Optimization | Hashrate | Improvement |
|--------------|----------|-------------|
| v1 (OpenCL port) | 6.5 KH/s | baseline |
| v4 (batched launch) | 49.3 KH/s | 7.5x |
| v5 (async htod copies) | 245.8 KH/s | 37.9x |
| v6 (pipelining + PTXAS O3) | **303.8 KH/s** | **46.7x** |

Full optimization report: [`CUDA_TUNING_RTX.md`](CUDA_TUNING_RTX.md)

> **Note:** `ZION_PAYOUT_ADDRESS` is required — pool rejects connections with missing or invalid address. Must be a valid 44-char `zion1...` address.

---

## Documentation Hierarchy

This repository has exactly one source of truth per topic:

| Topic | Canonical Doc |
|-------|---------------|
| **3.0.5 All Green report (CZ)** | [`docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md`](docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md) |
| **3.0.4 release overview** | [`3.0.4.md`](3.0.4.md) |
| **Live operational status** | [`StatusV3.md`](StatusV3.md) |
| **Agent operating rules** | [`AGENTS.md`](AGENTS.md) |
| **V3 code + architecture** | [`V3/README.md`](V3/README.md) |
| **Engineering roadmap** | [`V3/ROADMAP.md`](V3/ROADMAP.md) |
| **CUDA tuning report** | [`CUDA_TUNING_RTX.md`](CUDA_TUNING_RTX.md) |
| **Historical 3.0.3 docs** | [`docs/3.0.3/`](docs/3.0.3/) |

All other root `.md` files were archived to [`docs/3.0.3/`](docs/3.0.3/) as part of the 3.0.4 documentation cleanup. If you need a 3.0.3-era document, look there first.

---

## Network Topology

```
Edge Server (Hetzner Cloud)     Core (Local machine)
62.171.141.136                  zionserver-144 (109.81.27.87)
    |                               |
Node 1 (PRIMARY, mining)        Backup Node (P2P peer)
Node 2 (Follower, P2P sync)     Dashboard + AI services
Pool (PRIMARY, Stratum)
Bridge + DAO + WARP + Atomic Swap
Oasis + Free World + Issobella
Dashboard + Watchdog
Web (Docker: zion-web)
Public P2P: 8333
Public Pool: 8444
RPC: 127.0.0.1:8443 (localhost only)
```

| Role | Host | Public IP | Ports |
|------|------|-----------|-------|
| **Edge** | Hetzner Cloud | `62.171.141.136` | P2P: 8333, Pool: 8444, RPC: 8443 (localhost), Web: 80/443 |
| **Core** | Local machine | `109.81.27.87` | P2P: 8333, RPC: 8446 |

- **Edge**: Primary 24/7 node + pool. Source of chain truth. Accepts public miner connections. 14 services + watchdog timer + web Docker container.
- **Core**: Local backup node (P2P peer, same genesis) + Dashboard + AI services.
- **Chain live since:** 2026-07-07 (hard genesis reset) · **Current protocol:** `zion-v3-node/3.0.6` · **Chain height:** 5800+ · **Genesis hash:** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`

---

## License

MIT — see [LICENSE](LICENSE).

---

*Last updated: 2026-07-18 · Version: v3.0.6 "Triple Parallel" + CUDA Backend (303.8 KH/s RTX 3090) · Report: [`CUDA_TUNING_RTX.md`](CUDA_TUNING_RTX.md)*
