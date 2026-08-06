# ZION TerraNova — Mainnet Alpha (V31)

> **Proof of Work Layer 1 for the next 100 years.**
> From blockchain to the stars.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Status

> **Last updated: 2026-08-05**

- **Active mainnet track:** `V31/` workspace — version `3.1.0-alpha.2`, clean `cargo test --workspace`.
- **V3 production line has been archived** to `archive/V3/` after the 2026-08-04 V31 cutover.
- **Edge production is V31:**
  - Public RPC: `rpc.zionterranova.com:8443` (V31, nginx TCP proxy → `127.0.0.1:9445`)
  - Public pool stratum: `62.171.141.136:8444`
  - Chain height: ~11270+ (live in [`StatusV3.md`](StatusV3.md))
  - Protocol: `zion-v3-node/3.1.0-alpha.2`
  - Genesis hash: `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`
- **Latest wins:** V31 pool reaches full V3 parity (160 pool tests), DAO governance runtime with treasury/humanitarian/L1 scanner, GPU backend port (CUDA/OpenCL/Metal/native), cross-chain DEX multi-path routing, CLI wallet + service lifecycle.
- **Test gate:** 2069 workspace tests pass, `cargo clippy --workspace` is clean.
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

Triple-stream mining with optional AuxPoW fallback:

```bash
./target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --worker my-rig \
  --address <your-44-char-zion1-address>
```

Force a specific coin on stream 3:

```bash
ZION_STREAM3_FORCE_COIN=MONERO ./target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --worker my-rig \
  --address <your-44-char-zion1-address>
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
| **Historical incidents + backup rules** | [`AGENTS.md`](AGENTS.md) |

---

## License

MIT — see [LICENSE](LICENSE).

---

*Last updated: 2026-08-05 · Version: v3.1.0-alpha.2 (V31 Mainnet Alpha) · Live status: [`StatusV3.md`](StatusV3.md)*
