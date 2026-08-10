# ZION TerraNova — Mainnet Alpha (V31)

> **Proof of Work Layer 1 for the next 100 years.**
> From blockchain to the stars.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Status

> **Last updated: 2026-08-10 (ZANO duplicate-share fix + CUDA DAG disk cache)**

- **Active mainnet track:** `V31/` workspace — version `3.1.0-beta` (V31 Mainnet Alpha), protocol string `zion-v3-node/3.1.0-alpha`, clean `cargo test --workspace`.
- **V3 production line has been archived** to `archive/V3/` after the 2026-08-04 V31 cutover.
- **Hard genesis reset (2026-08-06):** Complete key rotation — new premine, canonical, admin, DAO guardian, and EVM validator keys. All addresses updated across codebase + Edge server. See [`HARD_RESET_PLAYBOOK.md`](HARD_RESET_PLAYBOOK.md) for the full procedure.
- **Edge production is V31 (2026-08-10):**
  - Public RPC: `rpc.zionterranova.com:8443` (nginx TCP proxy → `127.0.0.1:9445`)
  - Public pool stratum: `62.171.141.136:8444`
  - Pool HTTP API: `62.171.141.136:8080`
  - Chain height: 1000+ (2026-08-10)
  - Protocol: `zion-v3-node/3.1.0-alpha` (workspace version `3.1.0-beta`)
  - 2026-08-10: Stale Edge `zion-pool` binary rebuilt/redeployed with latest `pop_job()`/`touch_job_timestamp` fixes; VRSC/ZANO shares now accepted upstream. AuxPoW worker simplified to `zion-pool` (commit `a5b3aa2c6`).
  - 2026-08-10: Local `zion-miner` duplicate-share fix: Stream 2 (GPU external, ZANO ProgPoW) nonce cursor now starts from a unique 64-bit base per new job (`V31/L1/miner/src/runtime.rs`).
  - 2026-08-10: CUDA ProgPoW DAG disk cache: first run generates the DAG on GPU and saves it to `~/.zion/dag-cache/progpow_epoch{N}.bin` (~2 GB, 2.7 s); subsequent starts load the cache and skip the ~10 s GPU generation.
  - Genesis hash (V3 compat): `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71`
  - Genesis hash (V31 native): `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`
  - Active V31 services: `zion-v31-node`, `zion-v31-pool`, `zion-v31-miner`, `zion-v31-multichain`, `zion-v31-dao`, `zion-v31-oasis`, `zion-edge-python-dashboard`, `zion-website`, `zion-oasis-web`, `zion-marketplace`
  - Legacy/expected failed: `zion-node` (V3), `zion-pool` (V3), `zion-dashboard-web` (superseded), `logrotate.service`
- **Latest wins:** 2026-08-10 ZANO ProgPoW duplicate-share root-cause fixed in `V31/L1/miner/src/runtime.rs` (unique 64-bit nonce base per new job) and CUDA DAG disk cache added to `V31/L1/miner/src/gpu/cuda_external.rs`; local miner rebuilt, restarted, and validated: `progpow_epoch126.bin` (2.0 GB) generated/saved in 2.7 s, subsequent start loaded from disk and ZANO share accepted with no duplicate rejects. 2026-08-10 stale Edge `zion-pool` binary rebuild/redeploy with `pop_job()` + `touch_job_timestamp` fixes and AuxPoW worker-name simplification (commit `a5b3aa2c6`) — VRSC/ZANO shares now accepted upstream. V31 pool reaches full V3 parity with payout confirmation sweep + UTXO fallback, DAO governance runtime with treasury/humanitarian/L1 scanner, GPU backend port (CUDA/OpenCL/Metal/native) with Ekam Deeksha v3.2 (512 KiB scratchpad, 128 random reads, 2 AES passes), cross-chain DEX multi-path routing + HTTP solver network, CLI with 21 subcommands (DAO/WARP/HTLC/monitor/topology/explorer/onboard), Rasta/One Love desktop and web UI theme, OASIS RPC fixed (raw TCP JSON-RPC).
- **Test gate:** `cargo test --workspace` passes, `cargo clippy --workspace` is clean (pre-existing warnings only).
- **Public launch target:** 31 December 2026.

---

## Quick links

| What | Where |
|------|-------|
| **V31 workspace entry** | [`V31/README.md`](V31/README.md) |
| **V31 build / cutover plan** | [`V31/ALPHA_BUILD_PLAN.md`](V31/ALPHA_BUILD_PLAN.md) |
| **V31 operational rules** | [`V31/AGENTS.md`](V31/AGENTS.md) |
| **Live status + topology** | [`StatusV3.md`](StatusV3.md) |
| **Post-cutover execution plan** | [`PLAN_TO_3.1_RECONCILED.md`](./docs/3.1/PLAN_TO_3.1_RECONCILED.md) |
| **V31 detailed status** | [`V31/STATUS.md`](V31/STATUS.md) |
| **V3 archive (read-only)** | [`archive/V3/`](archive/V3/) |
| **Historical incidents + public-subtree rules** | [`AGENTS.md`](AGENTS.md) |
| **Hard reset procedure (genesis + keys)** | [`HARD_RESET_PLAYBOOK.md`](HARD_RESET_PLAYBOOK.md) |
| **Public (MIT) subtree** | [`public/`](public/) |

---

## What is ZION?

ZION is a decentralized **Layer 1 blockchain** built from scratch in **Rust**, running a canonical Proof-of-Work consensus with CPU and GPU acceleration. The current mainnet-track development happens in the clean `V31/` workspace; the previous V3 tree is archived in `archive/V3/`.

V31 features a height-aware PoW fork gate, triple-stream mining (ZION + AuxPoW GPU + CPU fallback), a unified Multi-Chain crate (bridge/DAO/WARP/HTLC/DEX), and a `zion` operator CLI.

---

## Quick start

### Run from source (V31)

```bash
cd V31
cargo check
cargo test
cargo build --release
```

### Run a local V31 node

```bash
RUST_LOG=info ./target/release/zion-node --config config/node.toml
```

### Run the pool

```bash
./target/release/zion-pool --config config/pool.toml
```

### Run the miner

Triple-stream mining (ZION + ZANO GPU + VRSC CPU) with CUDA backend:

```bash
./target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --wallet <your-44-char-zion1-address> \
  --worker my-rig \
  --gpu cuda \
  --v3-trinity \
  --threads 10
```

Use `~/Desktop/Start.sh` for automatic wallet backup discovery, build checks, and screen-based background mode:

```bash
~/Desktop/Start.sh --bg
```

CUDA DAG disk cache (enabled by default): the first run generates and saves the ProgPoW/Ethash/Kawpow DAG to `~/.zion/dag-cache/{algo}_epoch{N}.bin` (~2 GB for epoch 126). Set `ZION_DAG_CACHE_DISABLE=1` to disable, or `ZION_DAG_CACHE_DIR=/path` to use a custom cache directory.

Force a specific coin on stream 3:

```bash
ZION_STREAM3_FORCE_COIN=MONERO ./target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --wallet <your-44-char-zion1-address> \
  --worker my-rig \
  --gpu cuda \
  --v3-trinity \
  --threads 10
```

---

## Network topology

See [`StatusV3.md`](StatusV3.md) for the authoritative live topology. In brief:

- **Edge** (`62.171.141.136`, Contabo VPS): V31 primary node (`zion-v31-node`), follower node, V31 pool (`zion-v31-pool`), multichain, DAO, bridge, WARP, web, dashboard.
- **Local backup** (`zionserver-144`, `109.81.27.87`): backup node + dashboard.
- Public RPC is served by nginx TCP stream `8443 → 127.0.0.1:9445` (V31 node RPC).

---

## Documentation hierarchy

This repository has one source of truth per topic:

| Topic | Canonical doc |
|-------|---------------|
| **Live operational status** | [`StatusV3.md`](StatusV3.md) |
| **V31 workspace + build notes** | [`V31/README.md`](V31/README.md) |
| **V31 security / ops rules** | [`V31/AGENTS.md`](V31/AGENTS.md) |
| **Post-cutover execution plan** | [`PLAN_TO_3.1_RECONCILED.md`](./docs/3.1/PLAN_TO_3.1_RECONCILED.md) |
| **V3 archive** | [`archive/V3/README.md`](archive/V3/README.md) |
| **MarketPlace ZION L1 bonus payout** | [`APP&WEB/MarketPlace/PAYOUT.md`](APP&WEB/MarketPlace/PAYOUT.md) |
| **Historical incidents + backup rules** | [`AGENTS.md`](AGENTS.md) |

---

## License

MIT — see [LICENSE](LICENSE).

---

*Last updated: 2026-08-10 · Version: 3.1.0-beta (V31 Mainnet Alpha, protocol 3.1.0-alpha) · Live status: [`StatusV3.md`](StatusV3.md) · [`V31/STATUS.md`](V31/STATUS.md)*
