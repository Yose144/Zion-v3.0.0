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

1. Extend the new peer block sync path into fuller propagation and multi-peer catch-up instead of one-block contiguous import only.
2. Add richer block-body and transaction execution semantics beyond the current deterministic body hash and fee accounting.
3. Extend restart hardening beyond journal-assisted replay into stronger crash-window and corruption drills.
4. Extend `DesktopApp` from local process supervision into richer runtime health, release provenance, and operator-safe signing flows, without reintroducing legacy desktop-agent orchestration.
