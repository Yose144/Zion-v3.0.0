# ZION v3 Mainnet

Clean code workspace for ZION TerraNova v3.0 mainnet.

This directory is intentionally kept inside the 2.9.6 repository workspace so v3 work can
reuse audited source material during migration, while remaining isolated from the legacy root.

Active planning for `V3/` now lives in `V3/ROADMAP.md`.

Pure-code scope for the bootstrap:

- `L1/cosmic-harmony` — canonical Ekam Deeksha PoW and GPU backends
- `L1/core` — blockchain, consensus, validation, node wire/runtime scaffolding
- `L1/pool` — stratum, template flow, payouts
- `L1/miner` — miner runtime and GPU dispatch
- `DesktopApp/` — clean operator desktop shell for wallets and future runtime control, added explicitly by request and kept separate from legacy desktop-agent orchestration

Out of scope for the bootstrap:

- website and legacy desktop-agent runtime reuse
- historical 2.9.x docs
- legacy scripts, packaging, and exploratory tools
- deployment and monitoring assets until the code baseline is migrated

## Current Status

- workspace version: `3.0.0`
- canonical Ekam Deeksha consensus crate migrated into `L1/cosmic-harmony`
- `L1/core` now provides block headers, mining jobs, target validation, revenue snapshots, node config defaults, active block-template state, template-aware RPC submit flow, and a basic TCP `node` binary
- `L1/core` now also persists chain snapshots to disk, restores accepted-block state on restart, and exposes accepted-block indexes by height and template ID inside the node runtime
- `L1/core` now also carries a basic mempool RPC path, fee-prioritized template assembly, mined-transaction cleanup on block accept, and restore sanitization that removes duplicate or already-mined mempool entries
- `L1/core` now also applies stricter transaction validation, exposes explicit block-body and miner-reward metadata in template and accepted-block state, and uses a journal-assisted recovery path when snapshot state is missing or unusable
- `L1/core` now also supports contiguous peer block synchronization over P2P with `get_blocks_since`, `blocks`, and validated `announce_block` import
- `L1/core` now also supports bootstrap catch-up from `ZION_SEED_PEERS`, so a fresh node can import a contiguous accepted-block batch on startup without manual announce steps
- `L1/core` now carries the constitutional emission schedule: atomic units (flowers), decade decay, tail emission, and subsidy validation in peer block import
- `L1/core` now carries the LWMA difficulty adjustment algorithm: 60-block window, integer-only ±25% clamp, solve-time bounds 30–120 s, target ↔ difficulty conversion, compact nBits encoding, and difficulty validation in both template creation and peer block import
- `L1/core` now carries the canonical genesis block with all 12 constitutional premine outputs, frozen genesis hash, and ChainState initialization from genesis
- `L1/core` now carries the full cryptographic foundation: Ed25519 keygen/sign/verify, BLAKE3 general hashing, and `zion1...` 44-character address derivation with checksum (`crypto.rs`)
- `L1/core` now carries the UTXO transaction model: `TxInput`/`TxOutput`/`Transaction` with SegWit-style BLAKE3 txid and Ed25519 signature verification (`tx.rs`)
- `L1/core` now carries fee policy enforcement: MIN_TX_FEE=1000, MIN_FEE_RATE=1, MAX_TX_SIZE=100KB, 100% fee burn, burn/DAO addresses (`fee.rs`)
- `L1/core` now carries the wallet module: largest-first UTXO coin selection, `build_and_sign()` with zeroize, batch PPLNS payouts up to 200 recipients (`wallet.rs`)
- `L1/core` now carries full 10-step block validation: structure, timestamp, Merkle root, signatures, double-spend, coinbase maturity, fees, subsidy (`validation.rs`)
- `L1/core` now carries chain safety: fork choice by total_work (strictly >), reorg planner with MAX_REORG_DEPTH=10, UTXO undo blocks, SOFT_FINALITY_DEPTH=60 (`chain.rs`)
- `L1/core` now carries a hardened mempool: double-spend outpoint tracking, byte/count limits (20 MB / 10K txs), fee-rate eviction, structured rejection (`mempool_v2.rs`)
- `L1/core` now carries P2P security: per-IP rate limiter, escalating bans (5 min → 30 min → 2 hr → permanent), connection limiter (128 max) (`p2p_security.rs`)
- `L1/core` now carries orphan block handling: orphan pool with FIFO eviction (200 max, 10 min expiry), chain ID enforcement (`zion-mainnet-1`) (`orphan.rs`)
- `L1/core` now carries LMDB persistent storage via heed: 8 databases (blocks, utxos, tx_index, balance_cache, undo_blocks, height_to_hash, hash_to_height, meta), atomic block+UTXO writes, rollback, balance cache, schema versioning (`storage.rs`)
- `L1/core` now carries the IBD state machine: batch sync (500 blocks/request), stall detection (120 s timeout, 3 retries), peer round-robin, SyncStatus tracking (Ibd/Syncing/Synced) (`ibd.rs`)
- `L1/core` now carries a JSON-RPC 2.0 protocol handler: method registry, batch requests, standard error codes, 11 node method stubs via `build_node_router()` (`rpc.rs`)
- `L1/core` now carries the peer manager: scoring with ban threshold, subnet diversity (MAX_PER_SUBNET=4), heartbeat with idle timeout, inbound/outbound tracking, seed management (`peer_manager.rs`)
- `L1/core` now carries metrics: atomic counters/gauges (blocks, txs, mempool, peers, difficulty), Prometheus text exposition format with `zion_` prefix, health check JSON (`metrics.rs`)
- `L1/core` now carries genesis ceremony and launch readiness: frozen genesis hash, checkpoint system, 9 launch readiness checks (genesis integrity, emission, decay, tail, difficulty, DAO lock, premine addresses, checkpoints, zeroize) (`launch.rs`)
- `L1/core` now carries the node bootstrap orchestrator: `NodeHandle` wiring ChainDb + IbdEngine + PeerManager + NodeMetrics + RpcRouter, open-from-disk or genesis init, status/advance_tip/register_peer/heartbeat/prometheus/health_check (`node_builder.rs`)
- `L1/core` now carries DAO treasury lock enforcement as Step 11 in the 11-step `validate_block()` pipeline, blocking DAO Treasury spends before height 525,600 (`validation.rs`)
- `L1/core` now has 5 geographically distributed seed peers in `NodeConfig::mainnet()` (EU Prague, EU Frankfurt, US East, US West, APAC Singapore)
- `L1/core` now carries the genesis dedication message embedded in block 0 coinbase hash: ASCII art + ZION banner + dedication to Sarah Issobel, Maitreya Buddha, family, and humanity (`GENESIS_MESSAGE.txt`, `genesis.rs`)
- `L1/core` now carries flood-fill block propagation: `SeenBlocks` dedup cache, `plan_relay()` flood-fill logic, `PropagationStats` telemetry, and node binary relay on both peer announce and RPC submit (`propagation.rs`)
- Docker images: multi-stage production builds for node, pool, miner (self-contained V3/ context, `rust:1.85-bookworm` builder → `debian:bookworm-slim` runtime)
- Deployed to Helsinki (157.180.41.213): 3-service Docker compose stack running live, chain height 30+
- `L1/pool` now provides clean share validation plus a session-oriented JSON line wire protocol for hello/welcome/job/submit/result/stale/cancel/bye
- `L1/pool` now also ships a shared-state TCP server binary for persistent multi-client remote mining sessions
- `L1/pool` now consumes node templates over RPC when `ZION_NODE_RPC_ADDR` is configured and only finalizes accepted shares after node-side `submit_candidate` confirmation
- `L1/pool` also expires stale jobs and distinguishes invalid, stale, mismatched, and upstream-rejected submissions
- `L1/pool` now also carries bridge-level integration tests for stale-template and upstream-rejection paths against node RPC
- `L1/miner` now supports both local in-process mode and remote TCP pool mode, plus repeated mining loops, telemetry, and a persistent wire session transcript
- `DesktopApp` now exists as a fresh Electron shell under `V3/`, reusing the testnet operator UX direction while keeping V3 runtime control, wallet roles, and process supervision isolated from legacy desktop-agent ballast
- live smoke coverage now includes two miner sessions against the same pool instance, mempool-seeded template rotation, node restart validation from a persisted chain snapshot, two-node P2P block export/import rehearsal, and startup catch-up from `ZION_SEED_PEERS`
- whole V3 workspace currently builds and tests green

## Workspace Layout

```text
V3/
  DesktopApp/
  L1/
    cosmic-harmony/
    core/
    pool/
    miner/
  docker/
    Dockerfile.node
    Dockerfile.pool
    Dockerfile.miner
    docker-compose.v3-mainnet.yml
```

## Runtime Knobs

The `zion-miner` binary already supports basic configuration via environment variables:

- `ZION_MINER_ID`
- `ZION_WORKER_NAME`
- `ZION_POOL_ADDR`
- `ZION_START_NONCE`
- `ZION_NONCE_COUNT`
- `ZION_LOOP_COUNT`
- `ZION_JOB_TTL_MS`
- `ZION_NONCE_STRIDE`
- `ZION_SLEEP_MS`
- `ZION_TIMESTAMP`
- `ZION_TARGET`
- `ZION_REVENUE_SOURCE`
- `ZION_REVENUE_USD`

The `server` binary in `L1/pool` supports:

- `ZION_POOL_BIND`
- `ZION_NODE_RPC_ADDR`
- `ZION_ACCEPT_LIMIT`
- `ZION_POOL_LOOP_COUNT`
- the same job timing and revenue knobs used by `zion-miner`

The `node` binary in `L1/core` supports:

- `ZION_NODE_ID`
- `ZION_P2P_BIND`
- `ZION_RPC_BIND`
- `ZION_POOL_BIND`
- `ZION_ACCEPT_LIMIT`
- `ZION_P2P_ACCEPT_LIMIT`
- `ZION_RPC_ACCEPT_LIMIT`
- `ZION_NODE_STATE_PATH`
- `ZION_SEED_PEERS`

## Docker Deployment

Production Docker images use multi-stage builds (`rust:1.85-bookworm` → `debian:bookworm-slim`). The build context is `V3/` itself — no repository root needed.

### Quick Start

```bash
cd V3
docker compose -f docker/docker-compose.v3-mainnet.yml build
docker compose -f docker/docker-compose.v3-mainnet.yml up -d
```

### Services

| Service | Image | Ports | Volume |
|---------|-------|-------|--------|
| `node` | `zion-v3-node` | 8334 (P2P), 8332 (RPC) | `zion-node-data:/data/zion` |
| `pool` | `zion-v3-pool` | 8444 (stratum) | — |
| `miner` | `zion-v3-miner` | — | — |

### Remote Deploy (rsync)

Only `V3/` is needed on target host:

```bash
rsync -avz --exclude target --exclude .git V3/ root@SERVER:/opt/zion/
ssh root@SERVER "cd /opt/zion && docker compose -f docker/docker-compose.v3-mainnet.yml build && docker compose -f docker/docker-compose.v3-mainnet.yml up -d"
```

### Live Server

- **157.180.41.213** (Helsinki, Hetzner) — 8 vCPU AMD EPYC, 16 GB RAM, 150 GB SSD, Ubuntu 24.04
- Chain height: 30+ (first deploy 2026-03-13)
- Node P2P: `157.180.41.213:8334`
- Node RPC: `157.180.41.213:8332`
- Pool stratum: `157.180.41.213:8444`

## Wire Protocol

Current `zion-pool` / `zion-miner` session messages:

- `hello`
- `welcome`
- `job`
- `submit`
- `result`
- `stale`
- `cancel`
- `bye`

Current `zion-core` node scaffolding supports:

- P2P: `hello`, `welcome`, `ping`, `pong`, `get_peers`, `peers`, `get_status`, `status`, `get_blocks_since`, `blocks`, `announce_block`
- RPC: `get_status`, `get_peers`, `get_revenue`, `get_mempool`, `get_template`, `submit_transaction`, `submit_candidate`

Current template and accepted-block metadata now includes:

- transaction ids and transaction count
- total fee sum and estimated miner reward
- deterministic block-body hash for the current transaction selection

## Next Steps

1. ~~**Phase 6: Chain Safety**~~ ✅ done — reorg, fork choice, mempool hardening, P2P security, orphan handling.
2. ~~**Phase 7: Production Infrastructure**~~ ✅ done — LMDB storage, IBD, RPC, peer manager, metrics.
3. ~~**Phase 8: Docker & Deployment**~~ ✅ done — multi-stage Docker images, compose stack, deployed to Helsinki.
4. Extend persistent P2P connections and parallel multi-peer catch-up.
5. Extend `DesktopApp` from local process supervision into richer runtime health, release provenance, and operator-safe signing flows.
6. BFG scrub of premine private keys from git history before public launch.
7. CI/CD pipeline with automated image builds.
