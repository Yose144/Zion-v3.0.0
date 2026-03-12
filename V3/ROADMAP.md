# ZION v3 Mainnet Roadmap

Status date: 2026-03-12

This file is the active source-of-truth for the clean `V3/` mainnet line.
`V3/` is intentionally separated from the legacy root workspace. The legacy root remains migration source material and audit evidence, but new mainnet-track runtime work should land in `V3/`.

## Document Lineage

This roadmap follows the release progression already defined in the repository documentation:

- `docs/2.9.7/` supplies the production-base discipline: build gates, runtime flags, and go/no-go thinking.
- `docs/2.9.8/` supplies the canonical runtime target: Deeksha/Ekam as the single active consensus path, single-host simplification, and runtime unification.
- `docs/2.9.9/` supplies the migration constraint: pure code only, no historical ballast, and one canonical implementation path per feature.

## V3 Invariants

- One active consensus profile: `cosmic_harmony_ekam_deeksha`
- One clean L1 code line: `V3/L1/*`
- One separate desktop control shell: `V3/DesktopApp/*`, only when explicitly requested and kept thin over V3 runtime contracts
- No new work in the legacy root unless the user explicitly asks for migration sync or archival backport
- Runtime first, non-code assets later
- Tests and smoke checks must stay green as the code line grows

## Current State

### Completed

- `L1/cosmic-harmony`
  - Ekam Deeksha canonical PoW migrated
  - revenue and NCL support retained in narrowed form
  - OpenCL kernel source included
- `L1/core`
  - mining headers, jobs, solutions, targets, revenue snapshots
  - node config defaults for mainnet-track runtime
  - first P2P and RPC wire contracts
  - first `node` TCP scaffold binary
  - active block-template state and accepted-block rotation
  - template-aware `get_template` / `submit_candidate` RPC lifecycle
  - accepted-block indexes by height and template ID
  - file-backed chain snapshot persistence and restart restore path
  - basic mempool RPC intake and inspection
  - fee-prioritized template assembly with mined-transaction eviction
  - restore sanitization for duplicate and already-mined mempool entries
  - stricter transaction validation and sender-nonce conflict checks
  - explicit block-body hash plus subsidy/fee/miner-reward metadata in template and accepted-block state
  - journal-assisted recovery when snapshot state is missing or unusable
  - contiguous peer block synchronization over P2P with block export and validated import
- `L1/pool`
  - share validation and revenue tracking
  - session-oriented wire protocol
  - stale job lifecycle
  - node-backed template consumption and solved-candidate submission over RPC
  - bridge-level stale-template and upstream-rejection integration coverage
  - shared-state multi-client TCP pool server binary
- `L1/miner`
  - local in-process mining flow
  - remote TCP mining flow against `zion-pool`
  - repeated loop, telemetry, and environment-driven runtime controls
- `DesktopApp`
  - fresh Electron shell created under `V3/`
  - L1-L6 operator navigation scaffold
  - wallet manager foundation with local encrypted-at-rest storage when platform encryption is available
  - wallet role tagging for operator, treasury, bridge, and validator roots
  - clean auto-update hook isolation
  - thin supervision of prebuilt V3 node, pool, and miner binaries with live logs and persisted runtime env overrides

### Verified

- `cargo test --manifest-path V3/Cargo.toml` passes
- pool/miner remote TCP smoke test passes
- repeated miner sessions against one shared pool instance pass
- core node scaffold responds over both P2P and RPC TCP endpoints
- core node RPC returns active templates and accepts template-bound candidates
- core node RPC accepts mempool transactions and exposes template transaction metadata
- single-host node + pool + miner smoke path passes with pool-issued jobs backed by node `get_template` / `submit_candidate`
- pool server tests cover stale-template and upstream-rejection bridge behavior against node RPC
- node chain snapshot persists accepted state and restores it after restart
- extended rehearsal confirms mempool-seeded template rotation, mined-transaction cleanup, and restored status after restart
- targeted tests cover journal replay recovery and stricter transaction rejection paths
- live two-node rehearsal confirms block export from one node and validated `announce_block` import into another node
- live bootstrap rehearsal confirms a fresh node can catch up from `ZION_SEED_PEERS` without manual block announce steps
- canonical Ekam vector remains stable

### Not Done Yet

- fuller propagation and multi-peer catch-up beyond the current one-block contiguous sync path
- richer block-body and transaction execution semantics beyond the current deterministic body hash and fee accounting
- mainnet genesis ceremony assets and deploy pipeline for `V3/`
- production CI/CD, docker, monitoring, and ops assets for the new tree
- DesktopApp runtime supervision for node, pool, miner, release provenance, and signing workflows

## Build Order

### Phase 1: Consensus Baseline

Goal: keep Ekam Deeksha bit-stable and make runtime types auditable.

Exit criteria:

- canonical vector stable
- core/pool/miner tests green
- no duplicate consensus path introduced into `V3/`

Status: done

### Phase 2: Mining Runtime

Goal: establish one clear miner <-> pool flow with explicit wire lifecycle.

Exit criteria:

- miner loop works locally
- pool validates shares and stale jobs
- remote TCP smoke path works end-to-end

Status: done

### Phase 3: Node Scaffold

Goal: introduce the clean mainnet node surface without dragging in legacy networking complexity.

Exit criteria:

- P2P and RPC wire messages exist
- node binary binds and answers over TCP
- peer registration and status reporting work

Status: done

### Phase 4: Node Submit Flow

Goal: connect RPC and internal runtime state to actual candidate intake and block-template handling.

Required work:

- add block template state to `L1/core`
- distinguish template creation, candidate validation, and sealed-block acceptance
- expose template/status updates through RPC
- prepare the contract that pool will use to request fresh templates and submit solved candidates

Exit criteria:

- `submit_candidate` is backed by node runtime state instead of bare validation only
- node can track at least one active template
- pool-to-node integration path is defined in code

Status: done

### Phase 5: Testnet Integration

Goal: move from isolated runtime pieces to a coherent single-host testnet path.

Required work:

- connect pool to node template flow
- connect miner accepted shares to node-side candidate submission
- run single-node + pool + miner local integration
- run multi-process testnet rehearsal with explicit logs and acceptance checks

Exit criteria:

- node/pool/miner can run together on one host as a coherent testnet path
- template rotation and accepted candidate flow are visible and auditable
- pool and node services can hold state across repeated client sessions
- node can carry a basic mempool into templates and recover the resulting chain snapshot after restart

Status: in progress

### Phase 6: Mainnet Readiness

Goal: make `V3/` the operational mainnet code line rather than just a clean prototype.

Required work:

- restart hardening, corruption drills, and replay validation around the current snapshot plus journal persistence
- release checks and reproducible build path
- genesis ceremony preparation for the new tree
- deploy/monitoring assets migrated only after runtime shape stabilizes

Exit criteria:

- runtime has a reproducible launch path
- acceptance and propagation flows are validated
- non-code assets are aligned with the final runtime shape

Status: pending

## Immediate Next Steps

1. Extend the current peer block sync path into fuller propagation and multi-peer catch-up flows.
2. Extend the current body-hash and fee-accounting model into richer block-body and transaction execution semantics.
3. Harden restart safety further with explicit corruption drills and wider replay validation on top of the current journal-assisted persistence.
4. Grow `DesktopApp` beyond local supervision into richer runtime health, release provenance, and operator-safe signing flow.

## Rules For Future Work

- If `V3/` scope changes materially, update this file and `V3/README.md` in the same change.
- Prefer removing ambiguity over preserving historical names.
- When migrating code from the legacy tree, copy only audited behavior that serves the clean mainnet line.