# ZION v3 Mainnet Roadmap

Status date: 2026-03-12

This file is the active source-of-truth for the clean `V3/` mainnet line.
`V3/` is intentionally separated from the legacy root workspace. The legacy root remains migration source material and audit evidence, but new mainnet-track runtime work should land in `V3/`.

## Constitutional Reference (Mainnet Parameters)

Source of truth: `docs/mainnet/MAINNET_CONSTITUTION.md` (frozen SHA-256: c76aa002…)

### Supply & Emission

| Parameter | Value |
|-----------|-------|
| Total supply (max, immutable) | 144,000,000,000 ZION |
| Mining supply | 127,720,000,000 ZION (88.69%) |
| Genesis premine | 16,280,000,000 ZION (11.31%) |
| Atomic unit | 1 ZION = 1,000,000,000,000 flowers (u64) |
| Initial block reward | 5,400.067 ZION = 5,400,067,000,000,000 flowers |
| Emission model | Decade Decay: ×(4/5) every 5,256,000 blocks |
| Max decay decades | 10 |
| Tail emission (perpetual) | ~724.785 ZION/block |
| Blocks per year | 525,600 (60 s target) |
| Fee policy | 100% burn (deflationary, no treasury routing) |

### Consensus & Difficulty

| Parameter | Value |
|-----------|-------|
| Consensus | Cosmic Harmony v3 — Ekam Deeksha PoW |
| Chain ID | `zion-mainnet-1` |
| Block time target | 60 seconds |
| DAA | LWMA (Linearly Weighted Moving Average) |
| DAA window | 60 blocks |
| DAA max change per block | ±25% |
| Timestamp sanity | clamp ±2× target (±120 s) |
| Max reorg depth | 10 blocks |
| Soft finality | 60 blocks |
| Fork choice | Highest accumulated work |
| Coinbase maturity | 100 blocks |

### Genesis Premine Distribution

12 wallets defined in `PREMINE_ADDRESSES_PUBLIC.txt`:

| # | Category | Amount |
|---|----------|--------|
| 1–5 | OASIS + Winners Golden Egg/Xp (5 slots × 1.65B) | 8,250,000,000 ZION |
| 6–8 | DAO Treasury (main 2.5B + grants 1B + bootstrap 0.5B) | 4,000,000,000 ZION |
| 9–11 | Infrastructure (core dev 1B + seed nodes 1B + creator 0.59B) | 2,590,000,000 ZION |
| 12 | Humanitarian — Children Future Fund | 1,440,000,000 ZION |

Lock: DAO Treasury cliff at ~525,600 blocks (~1 year). All others: immediate unlock.

### Security Note

12 private keys exist in git history (`PREMINE_WALLETS_BACKUP.json`). **Must be scrubbed via BFG Repo-Cleaner before any public fork or mainnet launch.**

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

### Gap Inventory (V3 code vs constitutional requirements)

Audit date: 2026-03-12. Each item maps to the constitutional parameter table above.

#### CRITICAL — mainnet launch blockers

| ID | Missing module | What constitution requires | V3 current state | Migration source |
|----|----------------|---------------------------|------------------|------------------|
| G1 | **Emission / Decade Decay** | Decade Decay (×4/5 per 5,256,000 blocks), tail ~724.785 ZION | `DEFAULT_BLOCK_REWARD_ZION = 5_400` (constant, no decay, integer-only) | `L1/core/src/blockchain/reward.rs` |
| G2 | **Atomic units (flowers)** | 1 ZION = 1e12 flowers; reward = 5,400,067,000,000,000 flowers | V3 uses plain integer `5_400` | Same as G1 |
| G3 | **LWMA DAA** | 60-block window, ±25% max change, ±120 s timestamp clamp | Difficulty hardcoded (`0x1f00ffff`), no adjustment algorithm | `L1/core/src/blockchain/difficulty.rs` (verify) |
| G4 | **Genesis block + premine** | 16.28B ZION into 12 addresses as coinbase outputs in block 0 | No genesis builder, no premine module | `L1/core/src/blockchain/premine.rs` + `PREMINE_ADDRESSES_PUBLIC.txt` |
| G5 | **Block propagation** | Flood-fill relay to all connected peers on new block accept | Single request/response TCP; no outbound push | New code (extend P2P handle + NodeRuntime) |

#### HIGH — network security before production

| ID | Missing rule | Constitutional value | V3 current state |
|----|-------------|---------------------|------------------|
| G6 | Max reorg depth | 10 blocks | Not enforced in ChainState |
| G7 | Coinbase maturity | 100 blocks | Not enforced |
| G8 | Fee burn | 100% of fees burned | Implicit (fees collected in template but not routed); no explicit burn |
| G9 | Seed peers | 5+ required for eclipse resistance | 1 hardcoded (`91.98.122.165:8334`) |
| G10 | Premine unlock_height | DAO Treasury cliff at ~525,600 | No unlock enforcement in V3 |

#### MEDIUM — required before production launch, not for testnet

| ID | Item |
|----|------|
| G11 | Fork choice rule: highest accumulated work (chain selection) |
| G12 | Orphan block handling and relay |
| G13 | Eclipse protection (peer diversity, connection limits) |
| G14 | Timestamp validation on incoming P2P blocks |
| G15 | Chain ID enforcement in wire messages |

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

Status: in progress — single-host path works; propagation and multi-peer catch-up remain

### Phase 5a: Emission & Atomic Units (G1, G2)

Goal: introduce flowers as the canonical unit and implement decade decay so block rewards match the constitution.

Required work:

- define `ATOMIC_UNITS_PER_ZION = 1_000_000_000_000_u64` (flowers)
- define `INITIAL_REWARD_FLOWERS = 5_400_067_000_000_000_u64`
- define `BLOCKS_PER_DECADE = 5_256_000`, `DECAY_NUM = 4`, `DECAY_DEN = 5`, `MAX_DECAY_DECADES = 10`
- implement `block_reward(height: u64) -> u64` returning flowers with decade decay and perpetual tail
- define `TAIL_REWARD_FLOWERS` for post-decade-10 emission
- define `TOTAL_SUPPLY_FLOWERS` as hard cap for validation
- migrate all internal accounting from integer ZION to flowers (u64)
- add unit tests: reward at height 0, decade boundary, decade 10+, cumulative supply check

Exit criteria:

- `block_reward(0)` returns `5_400_067_000_000_000`
- `block_reward(5_256_000)` returns 80% of initial
- `block_reward(52_560_000)` returns tail emission
- cumulative emission across all decades stays within 127.72B ZION mining supply
- all existing tests remain green

Migration source: `L1/core/src/blockchain/reward.rs` (audit, extract logic, rewrite clean)

Status: done

### Phase 5b: LWMA Difficulty Adjustment (G3)

Goal: implement the constitutional DAA so the network self-regulates to 60 s block times.

Required work:

- implement LWMA with 60-block window over `(timestamp, cumulative_work)` pairs
- enforce ±25% max adjustment per block
- add ±120 s timestamp sanity clamp on incoming blocks
- integrate DAA into template creation (next_target from chain tip)
- integrate DAA into block validation (verify target matches DAA output)
- remove hardcoded `difficulty_bits: 0x1f00ffff` default for non-genesis blocks

Exit criteria:

- DAA produces correct targets for synthetic 60-block histories
- fast blocks → difficulty rises; slow blocks → difficulty falls
- ±25% clamp holds under adversarial input
- all existing tests remain green

Migration source: `L1/core/src/blockchain/difficulty.rs` (verify existence, audit, extract)

Status: pending

### Phase 5c: Genesis Block & Premine (G4)

Goal: construct the canonical genesis block with all 12 premine outputs.

Required work:

- define genesis block structure: header (height 0, prev_hash 0x00…, timestamp TBD, nonce TBD) + coinbase with 12 outputs
- embed 12 addresses and amounts from `PREMINE_ADDRESSES_PUBLIC.txt` (total 16,280,000,000 ZION = 16,280,000,000,000,000,000,000 flowers)
- set DAO Treasury outputs with `unlock_height = 525_600`
- compute and freeze genesis block hash
- add genesis block as chain initialization default in ChainState
- add validation: block at height 0 must equal frozen genesis hash

Exit criteria:

- `ChainState::new()` starts with genesis block containing 12 premine outputs
- genesis hash is deterministic and matches frozen constant
- node starts from genesis when no chain snapshot exists
- total premine amount sums to exactly 16,280,000,000 ZION in flowers

Migration source: `L1/core/src/blockchain/premine.rs` + `PREMINE_ADDRESSES_PUBLIC.txt` (data only; genesis builder is new V3 code)

Status: pending

### Phase 5d: Block Propagation & Multi-Peer Sync (G5)

Goal: extend P2P from request/response into active relay and parallel catch-up.

Required work:

- maintain a connected-peers set in NodeRuntime (not just known_peers list)
- on `accept_block`, broadcast `AnnounceBlock` to all connected peers except source
- implement persistent peer connections (or connection pool) instead of per-message TCP
- implement multi-peer catch-up: try N peers in parallel, accept first valid chain
- add flood-fill protocol: peer receiving `AnnounceBlock` validates, accepts, and relays further

Exit criteria:

- block mined on node A appears on node B and node C within seconds
- fresh node catches up from multiple seeds in parallel
- no duplicate block relay loops (seen-set or similar)
- two-node and three-node rehearsals pass

Status: pending

### Phase 6: Chain Safety Rules (G6–G8, G11–G14)

Goal: enforce constitutional chain rules that protect against attacks.

Required work:

- max reorg depth: reject chain reorganizations deeper than 10 blocks (G6)
- coinbase maturity: coinbase outputs unspendable for 100 blocks (G7)
- fee burn: fees in accepted blocks are provably destroyed, not routed (G8)
- fork choice: select chain tip by highest accumulated work, not just height (G11)
- orphan handling: buffer orphan blocks, re-evaluate when parent arrives (G12)
- eclipse protection: max connections per IP/subnet, peer diversity checks (G13)
- timestamp validation: reject P2P blocks with timestamps outside ±120 s of median (G14)
- chain ID: include `zion-mainnet-1` in P2P Hello and reject mismatched peers (G15)

Exit criteria:

- 11-block reorg attempt is rejected
- spending a coinbase before height+100 is rejected
- fork choice selects higher-work chain over higher-height chain
- all existing tests remain green

Status: pending

### Phase 7: Mainnet Readiness

Goal: make `V3/` the operational mainnet code line rather than just a clean prototype.

Required work:

- restart hardening, corruption drills, and replay validation around the current snapshot plus journal persistence
- release checks and reproducible build path
- genesis ceremony: freeze genesis block hash, timestamp, and nonce
- BFG scrub of private keys from git history
- seed peer infrastructure: 5+ geographically distributed nodes
- deploy/monitoring assets migrated only after runtime shape stabilizes

Exit criteria:

- runtime has a reproducible launch path
- genesis hash is frozen and published
- 5+ seed peers are reachable
- acceptance and propagation flows are validated end-to-end
- private key material is confirmed absent from any reachable git ref
- non-code assets are aligned with the final runtime shape

Status: pending

## Immediate Next Steps

Critical path (sequential — each depends on the previous):

1. **Phase 5a: Emission** — flowers + decade decay (`emission.rs`). Foundation for everything else.
2. **Phase 5b: LWMA DAA** — difficulty adjustment (`difficulty.rs`). Required for valid block production.
3. **Phase 5c: Genesis** — genesis block with 12 premine outputs (`genesis.rs`). Required for chain initialization.

Parallel track (can proceed alongside 5a–5c):

4. **Phase 5d: Propagation** — outbound block push + multi-peer catch-up. Required for multi-node testnet.

After 5a–5d are complete:

5. **Phase 6: Chain Safety** — reorg limits, maturity, fork choice, eclipse protection.
6. **Phase 7: Mainnet Readiness** — genesis ceremony, BFG scrub, seed infra, reproducible builds.

## Implementation Dependencies

```
5a (emission) ──→ 5c (genesis) ──→ Phase 6 (chain rules) ──→ Phase 7 (mainnet)
5b (LWMA)    ──→ 5c (genesis) ──↗
5d (propagation) ─────────────────────────────────────────→ Phase 7 (mainnet)
```

## Rules For Future Work

- If `V3/` scope changes materially, update this file and `V3/README.md` in the same change.
- Prefer removing ambiguity over preserving historical names.
- When migrating code from the legacy tree, copy only audited behavior that serves the clean mainnet line.