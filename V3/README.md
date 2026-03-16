# ZION v3 Mainnet

Clean code workspace for ZION TerraNova v3.0 mainnet.

This directory is intentionally kept inside the 2.9.6 repository workspace so v3 work can
reuse audited source material during migration, while remaining isolated from the legacy root.

Active planning for `V3/` now lives in `V3/ROADMAP.md`.

Revenue system detail: `V3/docs/REVENUE_SYSTEM.md`.
Native libs gap audit: `V3/docs/NATIVE_LIBS_GAP_V3.md`.

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
- `L1/core` JSON-RPC 2.0 methods are now **live** (no longer stubs): 15 methods bind to real `NodeRuntime` state via `Arc<Mutex<NodeRuntime>>`, including explicit account-runtime aliases `getAccountBalance`, `getAccountTransaction`, and `submitAccountTransaction` alongside the compatibility names. Auto-detected on the existing RPC TCP port alongside the simple line-delimited protocol used by the pool/miner.
- `L1/core` JSON-RPC is still bound to the current account-style runtime path: `getBalance`, `getAccountBalance`, and transaction submission operate on wallet ids carried by `lib.rs` transactions, not on the separate UTXO wallet path in `tx.rs`/`wallet.rs`; `zion1...` lookups are rejected explicitly on that endpoint
- `L1/core` now carries a JSON-RPC 2.0 protocol handler: method registry, batch requests, standard error codes, 15 node methods via `build_node_router()` (`rpc.rs`)
- `L1/core` now carries the peer manager: scoring with ban threshold, subnet diversity (MAX_PER_SUBNET=4), heartbeat with idle timeout, inbound/outbound tracking, seed management (`peer_manager.rs`)
- `L1/core` now carries metrics: atomic counters/gauges (blocks, txs, mempool, peers, difficulty), Prometheus text exposition format with `zion_` prefix, health check JSON (`metrics.rs`)
- `L1/core` now carries genesis ceremony and launch readiness: frozen genesis hash, checkpoint system, 9 launch readiness checks (genesis integrity, emission, decay, tail, difficulty, DAO lock, premine addresses, checkpoints, zeroize) (`launch.rs`)
- `L1/core` now carries the node bootstrap orchestrator: `NodeHandle` wiring ChainDb + IbdEngine + PeerManager + NodeMetrics + RpcRouter, open-from-disk or genesis init, status/advance_tip/register_peer/heartbeat/prometheus/health_check (`node_builder.rs`)
- `L1/core` now carries DAO treasury lock enforcement as Step 11 in the 11-step `validate_block()` pipeline, blocking DAO Treasury spends before height 525,600 (`validation.rs`)
- `L1/core` now has 5 geographically distributed seed peers in `NodeConfig::mainnet()` (EU Prague, EU Frankfurt, US East, US West, APAC Singapore)
- `L1/core` now carries the genesis dedication message embedded in block 0 coinbase hash: ASCII art + ZION banner + dedication to Sarah Issobel, Maitreya Buddha, family, and humanity (`GENESIS_MESSAGE.txt`, `genesis.rs`)
- `L1/core` now carries flood-fill block propagation: `SeenBlocks` dedup cache, `plan_relay()` flood-fill logic, `PropagationStats` telemetry, and node binary relay on both peer announce and RPC submit (`propagation.rs`)
- `L1/core` now carries P2P hardening (Phase 10): persistent inbound connections (message loop per stream), outbound peer thread with periodic sync + heartbeat Ping/Pong, PeerManager wired into node (scoring, subnet diversity, idle disconnect), PeerSecurity wired into node (rate limiting, ban on accept, protocol violation punishment)
- `L1/core` now carries peer discovery & persistence (Phase 11): active GetPeers exchange in outbound loop (every ~5 min), discovered peers merged into known_peers + PeerManager seeds, known_peers persisted to `peers.json` alongside chain state, loaded on startup (`lib.rs`, `node.rs`)
- `L1/core` now carries block validation hardening (Phase 12): `validate_peer_block()` verifies PoW (hash recomputed from header+nonce meets difficulty target), timestamp sanity (±2 hr median-time-past), checkpoint enforcement, header-field consistency; `AcceptedBlock` now stores `header_hex` for PoW-verifiable blocks; backwards-compatible with legacy persisted chain state (`lib.rs`, `validation.rs`, `genesis.rs`)
- `L1/core` now carries chain linkage verification (Phase 13): `AcceptedBlock` stores `previous_hash_hex` for explicit parent-chain linkage; `import_peer_block()` and `import_peer_blocks()` verify that each block's previous_hash links to the expected parent (local tip or preceding batch block); `validate_peer_block()` cross-checks `previous_hash_hex` against `header.previous_hash`; backwards-compatible with legacy blocks via `#[serde(default)]` (`lib.rs`, `genesis.rs`)
- Docker images: multi-stage production builds for node, pool, miner (self-contained V3/ context, `rust:1.85-bookworm` builder → `debian:bookworm-slim` runtime)
- Deployed to Helsinki (157.180.41.213): 3-service Docker compose stack running live, chain height 110+
- `L1/pool` now provides clean share validation plus a session-oriented JSON line wire protocol for hello/welcome/job/submit/result/stale/cancel/bye
- `L1/pool` now also ships a shared-state TCP server binary for persistent multi-client remote mining sessions
- `L1/pool` now consumes node templates over RPC when `ZION_NODE_RPC_ADDR` is configured and only finalizes accepted shares after node-side `submit_candidate` confirmation
- `L1/pool` also expires stale jobs and distinguishes invalid, stale, mismatched, and upstream-rejected submissions
- `L1/pool` now also carries bridge-level integration tests for stale-template and upstream-rejection paths against node RPC
- `L1/pool` now classifies miner sessions into groups at connect time (default user sessions pinned to `zion`, backend sessions can be routed into weighted `auto` multistream lanes)
- `L1/cosmic-harmony` now carries the profit router with `ExternalCoin` enum (DCR, ALPH, KAS, ERG, RVN, ETC, EVR, MEWC, FLUX, CLORE, XMR), `CoinProfile` metadata, `ProfitEntry` snapshots, fallback estimates, and `select_best_coin()` with hysteresis — Decred (Blake3/DCP-0011) and Alephium (Blake3) are first-class Blake3-compatible revenue coins
- `L1/cosmic-harmony` revenue tracking now includes a `Blake3External` revenue source for Blake3-compatible external coins (DCR, ALPH) at the same 2% fee rate as profit-switch
- `L1/miner` now supports both local in-process mode and remote TCP pool mode, plus repeated mining loops, telemetry, and a persistent wire session transcript
- `L1/miner` now supports DCR Blake3 runtime backends (`auto` / `cpu` / `gpu`) with OpenCL kernel dispatch and CPU fallback integrated into the live DCR worker path when built with `--features gpu`
- `L1/native-libs` scaffold now exists for staged migration of native acceleration libraries (randomx, kawpow, autolykos) with platform build scripts and ABI header placeholders
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
- `ZION_DCR_ENABLED`
- `ZION_BTC_WALLET`
- `ZION_DCR_BACKEND` (`auto`, `cpu`, `gpu`)
- `ZION_DCR_POOL`
- `ZION_DCR_THREADS`
- `ZION_DCR_WORKER`
- `ZION_DCR_ONLY`
- `ZION_DCR_RUN_SECS`
- `ZION_GPU_WORK_SIZE`
- `ZION_GPU_AUTOTUNE`
- `ZION_GPU_AUTOTUNE_SECS`

The `server` binary in `L1/pool` supports:

- `ZION_POOL_BIND`
- `ZION_NODE_RPC_ADDR`
- `ZION_ACCEPT_LIMIT`
- `ZION_POOL_LOOP_COUNT`
- the same job timing and revenue knobs used by `zion-miner`
- `ZION_REVENUE_MULTISTREAM` (`true`/`false`) — pool-side weighted revenue attribution
- `ZION_STREAM_ZION_PCT` / `ZION_STREAM_ZION_USD` (default 50%)
- `ZION_STREAM_BLAKE3_PCT` / `ZION_STREAM_BLAKE3_USD` (default 25%)
- `ZION_STREAM_NCL_PCT` / `ZION_STREAM_NCL_USD` (default 25%)
- `ZION_USER_DEFAULT_GROUP` (`zion`/`revenue`/`ncl`/`auto`, default `zion`)
- `ZION_BACKEND_MINER_IDS` (comma-separated miner IDs that should use `auto` weighted lane routing)
- `ZION_BACKEND_WORKER_HINTS` (comma-separated worker-name substrings treated as backend sessions; default `backend,revenue,ncl`)
- `ZION_BACKEND_AUTO_INCLUDE_ZION` (`true`/`false`, default `false`) — zda backend auto session smi byt pinuta i do `zion` lane
- `ZION_ROUTING_LOG_EVERY` (default `25`, `0` disables periodic routing snapshots)
- `ZION_ROUTING_METRICS_BIND` (optional TCP bind, example `127.0.0.1:9550`) — line-delimited JSON snapshot endpoint for routing stats

The `node` binary in `L1/core` supports:

- `ZION_NODE_ID`
- `ZION_MINER_ADDRESS`
- `ZION_P2P_BIND`
- `ZION_RPC_BIND`
- `ZION_POOL_BIND`
- `ZION_ACCEPT_LIMIT`
- `ZION_P2P_ACCEPT_LIMIT`
- `ZION_RPC_ACCEPT_LIMIT`
- `ZION_NODE_STATE_PATH`
- `ZION_SEED_PEERS`

JSON-RPC note:
`getAccountBalance`, `getAccountTransaction`, and `submitAccountTransaction` are the explicit account-runtime aliases. `sendRawTransaction` remains available for compatibility, but it does not accept raw hex payloads, and `getBalance` rejects `zion1...` UTXO addresses until the runtime is unified.

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
| `node` | `zion-v3-node` | 8334 (P2P), 127.0.0.1:8332 (RPC host-local only) | `zion-node-data:/data/zion` |
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
- Chain height: 110+ (first deploy 2026-03-13, JSON-RPC 2.0 live since Phase 9, peer discovery since Phase 11)
- Node P2P: `157.180.41.213:8334`
- Node RPC: host-local only on `127.0.0.1:8332` via SSH tunnel or local shell on the server
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
- JSON-RPC 2.0: `getChainInfo`, `getNodeInfo`, `getBlock`, `getBlockByHeight`, `getBalance`, `getAccountBalance`, `getTransaction`, `getAccountTransaction`, `getBlockTemplate`, `getMempoolInfo`, `getPeerInfo`, `sendRawTransaction`, `submitTransaction`, `submitAccountTransaction`, `submitBlock`

Current template and accepted-block metadata now includes:

- transaction ids and transaction count
- total fee sum and estimated miner reward
- deterministic block-body hash for the current transaction selection

## Next Steps

1. ~~**Phase 6: Chain Safety**~~ ✅ done — reorg, fork choice, mempool hardening, P2P security, orphan handling.
2. ~~**Phase 7: Production Infrastructure**~~ ✅ done — LMDB storage, IBD, RPC, peer manager, metrics.
3. ~~**Phase 8: Docker & Deployment**~~ ✅ done — multi-stage Docker images, compose stack, deployed to Helsinki.
4. ~~**Phase 9: JSON-RPC 2.0 Live Methods**~~ ✅ done — 15 methods bound to NodeRuntime, auto-detected on RPC port, 371 tests.
5. ~~**Phase 10: P2P Hardening**~~ ✅ done — persistent inbound connections, outbound peer thread with heartbeat, PeerManager scoring + PeerSecurity rate-limiting wired into node binary.
6. ~~**Phase 11: Peer Discovery & Persistence**~~ ✅ done — active GetPeers exchange in outbound loop, discovered peers merged + persisted to `peers.json`, loaded on startup, 376 tests.
7. ~~**Phase 12: Block Validation Hardening**~~ ✅ done — PoW verification via header_hex, timestamp sanity, checkpoint enforcement, header consistency checks, 385 tests.
8. ~~**Phase 13: Chain Linkage Verification**~~ ✅ done — `previous_hash_hex` in AcceptedBlock, chain linkage enforcement in single/batch import, header consistency cross-check, 393 tests.
9. **Phase 14: Full Async P2P** — parallel multi-peer IBD, async multiplexed connections.
10. Extend `DesktopApp` from local process supervision into richer runtime health, release provenance, and operator-safe signing flows.
11. BFG scrub of premine private keys from git history before public launch.
12. CI/CD pipeline with automated image builds.
