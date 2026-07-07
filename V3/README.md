# ZION v3 Mainnet

Clean code workspace for ZION TerraNova v3.0 mainnet.

This directory is intentionally kept inside the 2.9.6 repository workspace so v3 work can
reuse audited source material during migration, while remaining isolated from the legacy root.

Active planning for `V3/` now lives in `V3/ROADMAP.md`.

Comprehensive mainnet completion plan (L1 finish + L2/L3 migration): `V3/PLAN.md`.

Production upgrade plan (miner hardening, monitoring, infra, public release): `V3/docs/UPGRADE_PLAN.md`.
Security hardening (F1 exploit post-mortem + Edge server hardening): [`SecurityFirst.md`](../SecurityFirst.md).
Revenue system detail: `V3/docs/REVENUE_SYSTEM.md`.
Native libs gap audit: `V3/docs/NATIVE_LIBS_GAP_V3.md`.
Unified CLI operator guide: `V3/docs/CLI_GUIDE.md`.
Unified CLI FAQ: `V3/docs/CLI_FAQ.md`.
Unified CLI command reference: `V3/docs/CLI_REFERENCE.md`.
Unified CLI troubleshooting: `V3/docs/CLI_TROUBLESHOOTING.md`.
Unified CLI deploy playbook: `V3/docs/CLI_DEPLOY_PLAYBOOK.md`.

Hiranyagarbha / Hiran **v2.1** roadmap (ZION agent + širší kurátorované RAG korpusy mimo čistý SFT): [`HiranV2.1/Hiran_v2.1.md`](../HiranV2.1/Hiran_v2.1.md).

Pure-code scope for the bootstrap:

- `L1/cosmic-harmony` — canonical Ekam Deeksha PoW and GPU backends
- `L1/core` — blockchain, consensus, validation, node wire/runtime scaffolding
- `L1/pool` — stratum, template flow, payouts
- `L1/miner` — miner runtime and GPU dispatch
- `L2/bridge` — wZION bridge relay daemon (L1↔EVM, Base Sepolia), decimal-fixed for V3 6-decimal flowers (updated 3.0.3 fork)
- `L2/dao` — DAO governance daemon (proposal lifecycle, voting, treasury, humanitarian tithe), 6-decimal flowers (updated 3.0.3 fork)
- `L2/atomic-swap` — HTLC cross-chain atomic swaps, 6-decimal flowers (updated 3.0.3 fork)
- `L3/ncl` — Neural Consciousness Layer — decentralized AI compute marketplace
- `L3/warp` — Universal cross-chain bridge (12 chain adapters: EVM, Bitcoin, Solana, Tron, Stellar, Cardano, Cosmos, Sui, Aptos, NEAR, TON, Lightning), 6-decimal flowers (updated 3.0.3 fork)
- `L3/ai-native` — Autonomous AI agent framework (orchestrator, consciousness engine, pool optimizer, warp agent)
- `DesktopApp/` — clean operator desktop shell for wallets and future runtime control, added explicitly by request and kept separate from legacy desktop-agent orchestration

Out of scope for the bootstrap:

- website and legacy desktop-agent runtime reuse
- historical 2.9.x docs
- legacy scripts, packaging, and exploratory tools
- deployment and monitoring assets until the code baseline is migrated

## Current Status

- workspace version: `3.0.4` (DeFi contracts deployed on Base Mainnet 2026-06-29; TX unification plan in [`../3.0.4.md`](../3.0.4.md))
- **Unified `zion` CLI operator baseline (2026-04-23):** top-level gateway now spans L1/L2/L3 plus deploy, explorer, monitor, guided workflows, and checksum-verified local CLI auto-update; canonical operator docs published in `V3/docs/CLI_GUIDE.md` and `V3/docs/CLI_FAQ.md`.
- **Phase 18 UTXO coinbase + pool payout E2E deployed (2026-04-01):** `getBalance` combines account+UTXO for zion1 addresses (previously returned 0). `build_template()` generates UTXO coinbase with 4 outputs (89/5/5/1 split). Pool payout pipeline deployed with Ed25519 UTXO signing. Chain height 6801, miner balance 14.12B ZION.
- **Humanitarian tithe verified on-chain (2026-04-01):** Per-block fee split is exact to the flower: 89% miner, 5% humanitarian ([12] zion1m4v5z...), 5% issobella ([13] zion170a37...), 1% pool_fee ([14] zion1y5u65...). Cumulative balances consistent across all tithe wallets.
- **BaseScan verification (2026-04-01 + 2026-07-02):** 6/7 Base mainnet contracts verified on BaseScan — wZION, ZIONAtomicSwap (2026-04-01), ZIONGovernance, ZIONTreasury, ZIONStaking, ZIONFarm (2026-07-02 via Etherscan V2 API). ZIONBridge ❌ — source changed post-deploy, bytecode mismatch. See [`BASESCAN_VERIFY_REPORT.md`](../BASESCAN_VERIFY_REPORT.md).
- **All bridge blockers resolved (2026-04-01):** Deterministic keyless vault address (`zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7`), crypto validator proof (secp256k1 ECDSA in `submitBridgeUnlock`), L1 wallet CLI (`wallet.rs`), bridge mainnet config enabled. Bridge relay deployed on Edge server (Hetzner VPS, Core + Edge topology) — 3/5 threshold, L1+EVM watchers active, scanning Base mainnet (chain 8453).
- **V3 mainnet fee-split rollout verified live (2026-03-28):** core now enforces deterministic on-chain reward split `89/5/5/1` to miner, humanitarian, issobella, and pool-fee wallets; first explicitly verified split-enabled block was height `465`, with subsequent confirmation on audited nodes at heights `471` and `472`
- **Historical cross-node rollout evidence (2026-03-28):** Prague, USA, and Singapore accepted the fee-split rollout during the original rehearsal; the current operational topology has since been consolidated to **Core + Edge**.
- canonical Ekam Deeksha consensus crate migrated into `L1/cosmic-harmony`
- `L1/core` now provides block headers, mining jobs, target validation, revenue snapshots, node config defaults, active block-template state, template-aware RPC submit flow, and a basic TCP `node` binary
- `L1/core` now also persists chain snapshots to disk, restores accepted-block state on restart, and exposes accepted-block indexes by height and template ID inside the node runtime
- `L1/core` now also carries a basic mempool RPC path, fee-prioritized template assembly, mined-transaction cleanup on block accept, and restore sanitization that removes duplicate or already-mined mempool entries
- `L1/core` now also applies stricter transaction validation, exposes explicit block-body and miner-reward metadata in template and accepted-block state, and uses a journal-assisted recovery path when snapshot state is missing or unusable
- `L1/core` now also supports contiguous peer block synchronization over P2P with `get_blocks_since`, `blocks`, and validated `announce_block` import
- `L1/core` now also supports bootstrap catch-up from `ZION_SEED_PEERS`, so a fresh node can import a contiguous accepted-block batch on startup without manual announce steps
- `L1/core` now carries the constitutional emission schedule: atomic units (flowers), decade decay, tail emission, and subsidy validation in peer block import
- `L1/core` now carries the LWMA difficulty adjustment algorithm: 60-block window, integer-only ±25% clamp, solve-time bounds 30–120 s, target ↔ difficulty conversion, compact nBits encoding, and difficulty validation in both template creation and peer block import
- `L1/core` now carries the canonical genesis block with all **13** constitutional premine outputs (incl. Bridge Seed Fund 0.5B ZION), frozen genesis hash, and ChainState initialization from genesis
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
- `L1/core` JSON-RPC 2.0 methods are now **live** (no longer stubs): 16 methods bind to real `NodeRuntime` state via `Arc<Mutex<NodeRuntime>>`, including `getSupplyInfo` (supply economics endpoint) and explicit account-runtime aliases `getAccountBalance`, `getAccountTransaction`, and `submitAccountTransaction` alongside the compatibility names. Auto-detected on the existing RPC TCP port alongside the simple line-delimited protocol used by the pool/miner.
- `L1/core` JSON-RPC now exposes a hybrid balance surface: account ids remain valid, and `zion1...` addresses return combined account+UTXO chain balance on the live runtime
- `L1/core` now carries a JSON-RPC 2.0 protocol handler: method registry, batch requests, standard error codes, 17 node methods via `build_node_router()` (`rpc.rs`)
- `L1/core` now carries the peer manager: scoring with ban threshold, subnet diversity (MAX_PER_SUBNET=4), heartbeat with idle timeout, inbound/outbound tracking, seed management (`peer_manager.rs`)
- `L1/core` now carries metrics: atomic counters/gauges (blocks, txs, mempool, peers, difficulty), Prometheus text exposition format with `zion_` prefix, health check JSON (`metrics.rs`)
- `L1/core` now carries genesis ceremony and launch readiness: frozen genesis hash, checkpoint system, 9 launch readiness checks (genesis integrity, emission, decay, tail, difficulty, DAO lock, premine addresses, checkpoints, zeroize) (`launch.rs`)
- `L1/core` now carries the node bootstrap orchestrator: `NodeHandle` wiring ChainDb + IbdEngine + PeerManager + NodeMetrics + RpcRouter, open-from-disk or genesis init, status/advance_tip/register_peer/heartbeat/prometheus/health_check (`node_builder.rs`)
- `L1/core` now carries DAO treasury lock enforcement as Step 11 in the 11-step `validate_block()` pipeline, blocking DAO Treasury spends before height 525,600 (`validation.rs`)
- `L1/core` mainnet defaults are configured for Core + Edge topology; stale DNS seed hostnames were retired until a new audited seed set exists
- `L1/core` now carries the genesis dedication message embedded in block 0 coinbase hash: ASCII art + ZION banner + dedication to Sarah Issobel, Maitreya Buddha, family, and humanity (`GENESIS_MESSAGE.txt`, `genesis.rs`)
- `L1/core` now carries flood-fill block propagation: `SeenBlocks` dedup cache, `plan_relay()` flood-fill logic, `PropagationStats` telemetry, and node binary relay on both peer announce and RPC submit (`propagation.rs`)
- `L1/core` now carries P2P hardening (Phase 10): persistent inbound connections (message loop per stream), outbound peer thread with periodic sync + heartbeat Ping/Pong, PeerManager wired into node (scoring, subnet diversity, idle disconnect), PeerSecurity wired into node (rate limiting, ban on accept, protocol violation punishment)
- `L1/core` now carries peer discovery & persistence (Phase 11): active GetPeers exchange in outbound loop (every ~5 min), discovered peers merged into known_peers + PeerManager seeds, known_peers persisted to `peers.json` alongside chain state, loaded on startup (`lib.rs`, `node.rs`)
- `L1/core` now carries block validation hardening (Phase 12): `validate_peer_block()` verifies PoW (hash recomputed from header+nonce meets difficulty target), timestamp sanity (±2 hr median-time-past), checkpoint enforcement, header-field consistency; `AcceptedBlock` now stores `header_hex` for PoW-verifiable blocks; backwards-compatible with legacy persisted chain state (`lib.rs`, `validation.rs`, `genesis.rs`)
- `L1/core` now carries chain linkage verification (Phase 13): `AcceptedBlock` stores `previous_hash_hex` for explicit parent-chain linkage; `import_peer_block()` and `import_peer_blocks()` verify that each block's previous_hash links to the expected parent (local tip or preceding batch block); `validate_peer_block()` cross-checks `previous_hash_hex` against `header.previous_hash`; backwards-compatible with legacy blocks via `#[serde(default)]` (`lib.rs`, `genesis.rs`)
- Docker images: multi-stage production builds for node, pool, miner (self-contained V3/ context, `rust:1.85-bookworm` builder → `debian:bookworm-slim` runtime)
- Deployed to Hetzner Edge (Core + Edge topology): 7-service Docker compose stack running live, chain height 40+ and growing (19. 3. 2026)
- **Testnet fixes (19. 3. 2026):** Docker compose rewritten for env-var config (`from_env()` only, CLI args ignored), raw TCP JSON-RPC health checks on port 8332, `netcat-openbsd` replacing curl in Dockerfiles, state path must be file (`chain_state.json`) not directory, pool/miner loop_count=4294967295 for continuous operation, nonce tuning (500K/180s TTL)
- **P2P bug fix (19. 3. 2026):** duplicate block check moved before `validate_peer_block()` in `import_peer_block()` — eliminates spurious LWMA difficulty mismatch errors when seeds re-announce already-accepted blocks (`f2ca370`)
- **Zero P2P errors** after fix deployment — chain growing continuously with 100% share acceptance rate
- **Node metrics HTTP server (Phase 23 partial):** `serve_node_metrics()` on `ZION_METRICS_BIND` (default `0.0.0.0:9115`) — Prometheus text exposition at `/metrics` (chain_height, mempool_size, peer_count, sync_status, blocks_accepted, blocks_rejected, template_height), JSON health at `/health`
- **Config profiles (Sprint 4 A4):** `ZION_PROFILE` env var — pre-set sensible defaults for `pool`, `solo`, `benchmark`/`bench`, `dual` profiles; explicit env vars always override profile defaults
- **V3 CI/CD (Sprint 4 E2-E3):** `.github/workflows/v3-ci.yml` (test, clippy, fmt, audit scoped to V3/**), `.github/workflows/v3-release.yml` (v3* tags → linux+macOS binaries + Docker images + GitHub release)
- **Sprint 5 pre-launch (B4+F1+G1-G2):** Pool test coverage expanded to 73 tests (wire protocol edge cases, hex parsing, share lifecycle, revenue routing, session groups, Prometheus output validation); security checklist completed (`V3/docs/SECURITY_CHECKLIST.md`); public mining guide (`V3/docs/MINING_GUIDE.md`) and node operator guide (`V3/docs/NODE_OPERATOR_GUIDE.md`) published
- **Sprint 6 hardening (F2+F3+C5):** Production unwrap() audit (zero unsafe unwrap in hot paths), cargo-fuzz harnesses for pool (`fuzz_decode_message`, `fuzz_parse_hex`) and core (`fuzz_merkle_root`, `fuzz_validate_header`), Phase 23/24/25 status sync (monitoring ✅, security ✅ except BFG, infra ✅ except seed expansion), D2 block explorer marked complete (live at zionterranova.com/explorer)
- **Sprint 7 post-launch (items 3+5+6):** Native FFI production hardening (`runtime_self_test()`, `AlgoTestResult`, `all_algorithms_healthy()` — validates determinism + non-zero for each compiled algorithm, 4 tests); difficulty auto-tuning (`DifficultyStats`, `difficulty_stats()`, `predict_difficulty()` — runtime hashrate estimation and N-block forward projection, 10 new tests, 31 total); CHv4.2 Merkabah Dual-Spin algorithm (`merkabah_forward_passes_ekam()`, `merkabah_dual_spin_ekam()`, `memory_hard_transform_ekam_v3()`, `cosmic_harmony_ekam_deeksha_v3()`, `ekam_v3_find_nonce()` — full forward+backward HIC pipeline, fork-gated at `CHV42_DUAL_SPIN_FORK_HEIGHT=u64::MAX`, 14 new cosmic-harmony tests, 95 total). **635 workspace tests pass.**
- **Sprint 8 stabilization (2026-03-26/27):** Miner test fix (`profile_does_not_override_explicit_env` — env var race condition between parallel tests, tolerant assertion). Comprehensive mainnet plan created (`V3/PLAN.md` — L1 finish, L2/L3 migration strategy, decimal audit, Go/No-Go checklist). **Complete L2/L3 migration:** L2/bridge migrated with critical decimal fix (6→12 decimals, reverted to 6 in 3.0.3 fork, `amount_atomic`→`amount_flowers`, `FLOWERS_PER_ZION=1e6`); L2/dao migrated with u128 treasury amounts and 6-decimal flowers; L2/atomic-swap migrated with `amount_flowers`/`min_lock_flowers` naming; L3/ncl migrated (`reward_atomic`→`reward_flowers`); L3/warp migrated (7 chain adapters, all fee/conversion values updated to 6 decimals); L3/ai-native migrated (agent framework, consciousness engine, pool optimizer). **~1,300 workspace tests pass, 0 failures.**
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
- `L1/miner` now supports DCR CPU hash implementation selection via `ZION_DCR_HASH_IMPL` (`rust` default, `native` when built with `--features native-blake3-algo`) for explicit native-ffi Blake3 runtime dispatch
- `L1/native-libs` scaffold now exists for staged migration of native acceleration libraries (randomx, kawpow, autolykos) with platform build scripts and ABI header placeholders
- `DesktopApp` now exists as a fresh Electron shell under `V3/`, reusing the testnet operator UX direction while keeping V3 runtime control, wallet roles, and process supervision isolated from legacy desktop-agent ballast
- live smoke coverage now includes two miner sessions against the same pool instance, mempool-seeded template rotation, node restart validation from a persisted chain snapshot, two-node P2P block export/import rehearsal, and startup catch-up from `ZION_SEED_PEERS`
- whole V3 workspace currently builds and tests green (~1,300+ tests: 432 core, 95 cosmic-harmony, 59 miner, 29 pool, 4 native-ffi, 157 bridge, 65 dao, 15 atomic-swap, 43 ncl, 488 warp, 89 ai-native, plus doctests)

Operational references:

- rollout report: `../docs/reports/REPORT_SESSION_2026-03-28_V3_MAINNET_FEE_SPLIT_ROLLOUT.md`
- go/no-go report: `../docs/reports/REPORT_SESSION_2026-03-28_V3_MAINNET_GO_NO_GO.md`
- post-deploy checklist: `../docs/mainnet/V3_ROLLOUT_VERIFICATION_CHECKLIST.md`
- shell-ready deploy runbook: `docs/MAINNET_DEPLOY_RUNBOOK.md`

## Workspace Layout

```text
V3/
  DesktopApp/
  L1/
    cosmic-harmony/       # Ekam Deeksha PoW, 95 tests
    core/                 # blockchain, consensus, P2P, RPC, 432 tests
    pool/                 # stratum, template flow, 29 tests
    miner/                # CPU/GPU mining, 59 tests
    native-ffi/           # native acceleration scaffold, 4 tests
  L2/
    bridge/               # wZION relay daemon (Base Sepolia), 157 tests
    dao/                  # DAO governance (proposals, voting, treasury), 65 tests
    atomic-swap/          # HTLC cross-chain swaps, 15 tests
  L3/
    ncl/                  # Neural Consciousness Layer, 43 tests
    warp/                 # Universal cross-chain bridge (12 adapters), 488 tests
    ai-native/            # AI agent framework, 89 tests
  L4/
    oasis/                # Metaverse game layer (player, guild, quests, prizes)
  L5/
    free-world/           # Community layer (DAO client, L1 scanner)
  L6/
    issobella/            # Art/NFT layer (DAO client, L1 scanner)
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
- `ZION_METRICS_REPORT_SECS` — periodic `session_status` cadence in seconds (default: 30, set `0` to disable intermediate status lines)
- `ZION_TIMESTAMP`
- `ZION_TARGET`
- `ZION_REVENUE_SOURCE`
- `ZION_REVENUE_USD`
- `ZION_DCR_ENABLED`
- `ZION_BTC_WALLET`
- `ZION_DCR_BACKEND` (`auto`, `cpu`, `gpu`)
- `ZION_DCR_HASH_IMPL` (`rust`, `native`)
- `ZION_DCR_POOL`
- `ZION_DCR_THREADS`
- `ZION_DCR_WORKER`
- `ZION_DCR_ONLY`
- `ZION_DCR_RUN_SECS`
- `ZION_GPU_WORK_SIZE`
- `ZION_CUDA_WORK_CAP` — CUDA-specific dispatch cap (default `32768`, validated on RTX 5090)
- `ZION_GPU_AUTOTUNE`
- `ZION_GPU_AUTOTUNE_SECS`
- `ZION_REMOTE_TTL_GUARD_PCT` — skip submit if scan took ≥N% of pool-advertised job TTL (default: 90, range: 10–100). Prevents `StaleJob` rejects when the scan runs over the TTL window.
- `ZION_PROFILE` — config profile preset: `pool` (long-run, autotune, reconnect), `solo` (large nonce window), `benchmark`/`bench` (short burst, no autotune), `dual` (pool + DCR). Explicit env vars always win.

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
- `ZION_METRICS_BIND` — HTTP metrics endpoint bind address (default: `0.0.0.0:9115`); serves Prometheus `/metrics` and JSON `/health`

JSON-RPC note:
`getAccountBalance`, `getAccountTransaction`, and `submitAccountTransaction` are the explicit account-runtime aliases. `sendRawTransaction` remains available for compatibility, and `getBalance` accepts both account ids and `zion1...` UTXO addresses on the live hybrid runtime.

## Docker Deployment

Production Docker images use multi-stage builds (`rust:1.85-bookworm` → `debian:bookworm-slim`). The build context is `V3/` itself — no repository root needed.

### Quick Start

```bash
cd V3
docker compose -f docker/docker-compose.v3-mainnet.yml build
docker compose -f docker/docker-compose.v3-mainnet.yml up -d
```

### Zion2 Canary

For parallel Zion2 testing beside the live 2.9.8 testnet stack, use:

```bash
cd V3
docker compose -f docker/docker-compose.v3-zion2-canary.yml build
docker compose -f docker/docker-compose.v3-zion2-canary.yml up -d
```

Canary host bindings on Zion2:

- node P2P: `127.0.0.1:18334`
- node RPC: `127.0.0.1:18332`
- pool stratum: `127.0.0.1:13333`
- routing metrics: `127.0.0.1:19550`

### Services

| Service | Image | Ports | Volume |
|---------|-------|-------|--------|
| `node` | `zion-v3-node` | 8333 (P2P), 127.0.0.1:8443 (RPC host-local only) | `zion-node-data:/data/zion` |
| `pool` | `zion-v3-pool` | 3333 (stratum) | — |
| `miner` | `zion-v3-miner` | — | — |

### Remote Deploy (rsync)

Only `V3/` is needed on target host:

```bash
rsync -avz --exclude target --exclude .git V3/ root@SERVER:/opt/zion/
ssh root@SERVER "cd /opt/zion && docker compose -f docker/docker-compose.v3-mainnet.yml build && docker compose -f docker/docker-compose.v3-mainnet.yml up -d"
```

### Live Topology (Core + Edge)

- **Core** (Windows 11, Tailscale `100.86.102.5`) — local node + pool master + GPU miner
- **Edge** (Hetzner VPS, Tailscale `100.76.16.108`) — public relay node + pool
  - Public P2P: `77.42.71.94:8333`
  - Public Pool: `77.42.71.94:8444`
- Website bridge status reaches the host-networked bridge via `host.docker.internal:9101`

> Archive notice: the old Prague server (`91.98.122.165`) and multi-server topology (Prague, USA, Singapore, Helsinki) are historical. Current live topology is **Core + Edge only**.

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
- JSON-RPC 2.0: `getChainInfo`, `getNodeInfo`, `getBlock`, `getBlockByHeight`, `getBalance`, `getAccountBalance`, `getTransaction`, `getAccountTransaction`, `getBlockTemplate`, `getMempoolInfo`, `getPeerInfo`, `sendRawTransaction`, `submitTransaction`, `submitAccountTransaction`, `submitBlock`, `getUtxos`, `getSupplyInfo`

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
