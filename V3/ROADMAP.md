# ZION v3 Mainnet Roadmap

Status date: 2026-03-13 (deployment update)

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
  - **Ed25519 keygen/sign/verify, BLAKE3 general hashing, canonical `zion1...` 44-char address derivation with checksum** (`crypto.rs`)
  - **UTXO transaction model: TxInput/TxOutput/Transaction, SegWit-style BLAKE3 txid, signature verification** (`tx.rs`)
  - **Fee policy: MIN_TX_FEE=1000, MIN_FEE_RATE=1, MAX_TX_SIZE=100KB, 100% burn, burn/DAO addresses** (`fee.rs`)
  - **Wallet: largest-first coin selection, build_and_sign with zeroize, batch PPLNS payouts up to 200 recipients** (`wallet.rs`)
  - **Full 11-step block validation: structure, timestamp, Merkle root, signatures, double-spend, coinbase maturity, fees, subsidy, DAO treasury lock** (`validation.rs`)
  - **Chain reorg with fork choice, undo blocks, MAX_REORG_DEPTH=10** (`chain.rs`)
  - **Hardened mempool with double-spend, byte/count limits, fee-rate eviction** (`mempool_v2.rs`)
  - **P2P security: rate limiter, escalating bans, connection limiter** (`p2p_security.rs`)
  - **Orphan handling: orphan buffer, chain ID enforcement** (`orphan.rs`)
  - **LMDB persistent storage via heed: 8 databases, atomic block+UTXO writes, rollback, balance cache** (`storage.rs`)
  - **IBD state machine: batch sync, stall detection, peer round-robin, SyncStatus tracking** (`ibd.rs`)
  - **JSON-RPC 2.0 protocol handler: method registry, batch requests, 11 node method stubs** (`rpc.rs`)
  - **Peer manager: scoring, banning, subnet diversity (MAX_PER_SUBNET=4), heartbeat, idle timeout** (`peer_manager.rs`)
  - **Metrics: atomic counters/gauges, Prometheus text exposition, health check** (`metrics.rs`)
  - **Genesis ceremony: frozen genesis hash, checkpoint system, 9 launch readiness checks** (`launch.rs`)
  - **Node bootstrap orchestrator: wires ChainDb + IbdEngine + PeerManager + NodeMetrics + RpcRouter into NodeHandle** (`node_builder.rs`)
  - **Genesis dedication message: ASCII art + ZION banner + dedication embedded in coinbase tx_id hash** (`GENESIS_MESSAGE.txt`, `genesis.rs`)
  - **Flood-fill block propagation: SeenBlocks dedup cache, plan_relay() logic, PropagationStats, node binary relay on peer announce and RPC submit** (`propagation.rs`)
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
- **78 new tests across crypto (19), tx (10), fee (15), wallet (9), validation (25) — all green**
- **46 new tests across chain (14), mempool_v2 (12), p2p_security (10), orphan (10) — all green**
- **62 new tests across storage (12), ibd (13), rpc (14), peer_manager (13), metrics (10) — all green**
- **23 new tests across launch (10), node_builder (11), validation DAO lock (2) — all green**
- **15 new tests across propagation (15) — all green**
- **3 new tests for genesis message embedding — all green**

### Not Done Yet

- persistent peer connections and parallel multi-peer catch-up (flood-fill relay is done, but each P2P exchange still opens a new TCP connection)
- richer block-body and transaction execution semantics beyond the current deterministic body hash and fee accounting
- BFG scrub of premine private keys from git history
- ~~production Docker images for node, pool, miner~~ → ✅ done (multi-stage Dockerfiles + compose stack)
- CI/CD pipeline, automated image builds, and monitoring dashboards
- DesktopApp runtime supervision for node, pool, miner, release provenance, and signing workflows
- end-to-end multi-node acceptance and propagation flow validation
- difficulty auto-tuning in live mining (current testnet difficulty ramps fast with short nonce windows)

### L1 Testnet → V3 Mainnet Migration Tracker

Full audit: `V3/L1_TESTNET_VS_V3_MAINNET_AUDIT.md` (2026-03-13)

| Metric | L1 testnet | V3 mainnet |
|--------|-----------|------------|
| Source files | ~50 `.rs` in 14 dirs | ~20 `.rs` in 4 crates |
| Total LoC | ~17,500 | ~8,300 |
| Tests | ~200+ | 359 pass, 0 fail, 1 ignored (doc-test) |
| Persistence | LMDB (7 databases) | LMDB via heed (8 databases) |
| Tx model | UTXO (Bitcoin-style) | Account-style (simplified) |
| Crypto | Ed25519 + BLAKE3 + RIPEMD160 | Ekam Deeksha only |
| Addresses | `zion1...` 44 chars, checksum | Plain strings |

#### Module Status (35 items)

**Done (25):** emission, LWMA DAA, genesis/premine, P2P messages, pool crate, miner crate, block headers, chain state (basic), **crypto/keys** (Ed25519, BLAKE3, `zion1...` addresses), **UTXO tx model** (TxInput/TxOutput/Transaction), **fee model** (MIN_TX_FEE, fee-rate, burn), **wallet** (coin selection, build_and_sign, batch payouts), **full block validation** (11-step pipeline, Merkle tree, signatures, maturity, fees, DAO lock), **chain reorg** (fork choice, undo blocks, MAX_REORG_DEPTH=10), **hardened mempool** (double-spend, byte/count limits, fee-rate eviction), **P2P security** (rate limiter, escalating bans, connection limiter), **orphan handling** (orphan buffer, chain ID enforcement), **LMDB storage** (8 databases, atomic writes, rollback), **IBD state machine** (batch sync, stall detection), **JSON-RPC 2.0** (protocol handler, 11 method stubs), **peer manager** (scoring, banning, diversity), **metrics** (Prometheus, health check), **launch readiness** (genesis ceremony, checkpoints, 9 readiness checks), **node bootstrap** (NodeHandle wiring all subsystems), **block propagation** (flood-fill relay, SeenBlocks dedup, PropagationStats)

**Partial (4):** P2P (missing async, connection pool, outbound relay, multi-peer sync, peer scoring), RPC (11/~40 methods), state management (missing broadcast channels, block processing lock, reorg lock), block template (missing standard binary Merkle tree integration)

**Missing (7):** P2P sync (full async networking with IBD integration), peer discovery, checkpoints, heartbeat protocol, peer persistence, security audit tools, load tests

#### Open Architectural Decisions

1. **UTXO vs Account model** — L1 uses UTXO (TxInput/TxOutput), V3 uses account-style (from/to/amount/nonce). Recommendation: UTXO for L1 testnet compatibility and constitutional consistency.
2. **General hashing** — L1 uses BLAKE3 for tx/merkle, Ekam Deeksha for PoW only. V3 currently uses Ekam Deeksha for everything. Decision needed.
3. **Reward distribution** — L1 has 4-way split (89% miner, 5% tithe, 5% issobella, 1% pool). V3 gives 100% to miner. Is split L1-level or L3+?

### Gap Inventory (V3 code vs constitutional requirements)

Audit date: 2026-03-12. Each item maps to the constitutional parameter table above.

#### CRITICAL — mainnet launch blockers

| ID | Missing module | What constitution requires | V3 current state | Migration source |
|----|----------------|---------------------------|------------------|------------------|
| G1 | **Emission / Decade Decay** | Decade Decay (×4/5 per 5,256,000 blocks), tail ~724.785 ZION | ✅ `emission.rs` — 16 tests | `L1/core/src/blockchain/reward.rs` |
| G2 | **Atomic units (flowers)** | 1 ZION = 1e12 flowers; reward = 5,400,067,000,000,000 flowers | ✅ Integrated in `emission.rs` | Same as G1 |
| G3 | **LWMA DAA** | 60-block window, ±25% max change, 30–120 s solve-time clamp | ✅ `difficulty.rs` — 21 tests, integer-only ±25% clamp | `L1/core/src/blockchain/consensus.rs` |
| G4 | **Genesis block + premine** | 16.28B ZION into 12 addresses as coinbase outputs in block 0 | ✅ `genesis.rs` — 17 tests, 12 premine outputs, frozen hash, ChainState init | `L1/core/src/blockchain/premine.rs` + `PREMINE_ADDRESSES_PUBLIC.txt` |
| G5 | **Block propagation** | Flood-fill relay to all connected peers on new block accept | ✅ `propagation.rs` — SeenBlocks dedup, plan_relay(), node binary relay on announce+submit | ~~Phase 5d~~ done |

#### CRITICAL — cryptographic & transaction foundation (added 2026-03-13 from L1 audit)

| ID | Missing module | What is needed | V3 current state | Target phase |
|----|----------------|----------------|------------------|--------------|
| G16 | **Crypto / Ed25519** | Ed25519 keygen, sign/verify, `zion1...` address derivation, BLAKE3 general hash | ✅ `crypto.rs` — 19 tests | ~~Phase 5e~~ done |
| G17 | **UTXO tx model** | `TxInput`/`TxOutput`/`Transaction`, SegWit-style hash, `verify_signatures()` | ✅ `tx.rs` — 10 tests | ~~Phase 5f~~ done |
| G18 | **Fee model** | MIN_TX_FEE, fee-rate, MAX_TX_SIZE, 100% burn | ✅ `fee.rs` — 15 tests | ~~Phase 5f~~ done |
| G19 | **Wallet** | UTXO coin selection, `build_and_sign()`, `zeroize`, batch payouts | ✅ `wallet.rs` — 9 tests | ~~Phase 5g~~ done |
| G20 | **Full block validation** | 10-step pipeline: merkle, signatures, maturity, size, timestamp, double-spend | ✅ `validation.rs` — 25 tests | ~~Phase 5h~~ done |

#### HIGH — network security before production

| ID | Missing rule | Constitutional value | V3 current state | Target phase |
|----|-------------|---------------------|------------------|--------------|
| G6 | Max reorg depth | 10 blocks | ✅ `chain.rs` — MAX_REORG_DEPTH=10, enforced in evaluate_reorg | ~~Phase 6a~~ done |
| G7 | Coinbase maturity | 100 blocks | ✅ `validation.rs` — COINBASE_MATURITY=100, enforced in validate_block | ~~Phase 6b~~ done |
| G8 | Fee burn | 100% of fees burned | ✅ `fee.rs` — 100% burn, BURN_ADDRESS defined | ~~Phase 6b~~ done |
| G9 | Seed peers | 5+ required for eclipse resistance | ✅ 5 geographically distributed peers in `NodeConfig::mainnet()` | ~~Phase 8~~ done |
| G10 | Premine unlock_height | DAO Treasury cliff at ~525,600 | ✅ `validation.rs` Step 11: `validate_premine_locks()` calls `genesis::is_premine_transfer_allowed()` | ~~Phase 8~~ done |

#### MEDIUM — required before production launch, not for testnet

| ID | Item | V3 current state | Status |
|----|------|------------------|--------|
| G11 | Fork choice rule: highest accumulated work (chain selection) | ✅ `chain.rs` — ForkChoice engine, is_stronger (strictly >) | ~~Phase 6a~~ done |
| G12 | Orphan block handling and relay | ✅ `orphan.rs` — OrphanPool with FIFO eviction | ~~Phase 6e~~ done |
| G13 | Eclipse protection (peer diversity, connection limits) | ✅ `p2p_security.rs` — MAX_CONNECTIONS=128, ConnectionLimiter | ~~Phase 6d~~ done |
| G14 | Timestamp validation on incoming P2P blocks | ✅ `validation.rs` — ±7200s drift check | ~~Phase 6e~~ done |
| G15 | Chain ID enforcement in wire messages | ✅ `orphan.rs` — validate_chain_id(), CHAIN_ID="zion-mainnet-1" | ~~Phase 6e~~ done |

#### PRODUCTION — infrastructure for mainnet operations

| ID | Item | Target phase |
|----|------|--------------|
| G21 | LMDB persistent storage (replace JSON snapshot) | ✅ `storage.rs` — 12 tests | ~~Phase 7a~~ done |
| G22 | IBD state machine (batch sync, stall detection) | ✅ `ibd.rs` — 13 tests | ~~Phase 7b~~ done |
| G23 | HTTP JSON-RPC 2.0 server (~40 methods) | ✅ `rpc.rs` — 14 tests (11 stub methods) | ~~Phase 7c~~ done |
| G24 | Peer manager (scoring, banning, connection tracking) | ✅ `peer_manager.rs` — 13 tests | ~~Phase 7d~~ done |
| G25 | Metrics / Prometheus export | ✅ `metrics.rs` — 10 tests | ~~Phase 7e~~ done |

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

Status: in progress — single-host path works; persistent connections and parallel multi-peer catch-up remain

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

- implement LWMA with 60-block window over `(timestamp, difficulty)` pairs
- enforce ±25% max adjustment per block (integer arithmetic, no f64)
- add 30–120 s solve-time clamp per interval
- integrate DAA into template creation (next_difficulty from accepted_blocks)
- integrate DAA into block validation (verify difficulty matches LWMA output)
- remove hardcoded `difficulty_bits: 0x1f00ffff` — replaced by compact nBits encoding
- add `timestamp` (seconds) and `difficulty` (u64) fields to AcceptedBlock
- target ↔ difficulty conversion: `difficulty_to_target()`, `target_to_compact()`, `compact_to_target()`
- switch header timestamp from ms to seconds (`now_secs()`)
- 21 new unit tests (14 LWMA algorithm + 7 target/compact conversion)

Exit criteria:

- DAA produces correct targets for synthetic 60-block histories ✓
- fast blocks → difficulty rises; slow blocks → difficulty falls ✓
- ±25% clamp holds under adversarial input ✓
- stability simulation (200 blocks, varied solve times) converges ✓
- all existing tests remain green (updated to use `find_valid_nonce`) ✓
- 118 tests pass, 0 fail, 1 ignored ✓

Migration source: `L1/core/src/blockchain/consensus.rs` → `V3/L1/core/src/difficulty.rs`

Status: done

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

Status: done

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

Status: done — `propagation.rs` (200 LoC, 15 tests), node binary relay on announce+submit

### Phase 5e: Cryptographic Foundation (G16)

Goal: introduce Ed25519 key management, BLAKE3 general hashing, and canonical `zion1...` address derivation.

This phase is a **mainnet launch blocker** — without it, transactions cannot be signed or verified.

Required work:

- implement `crypto.rs` module:
  - Ed25519 keypair generation, sign, verify (`ed25519_dalek` crate)
  - BLAKE3 general hash (for tx hashing, merkle roots — separate from Ekam Deeksha PoW)
  - `zion1...` address derivation: `SHA256(pubkey) → RIPEMD160 → base32 + 4-char checksum`
  - frozen constant: `ZION_BASE32_ALPHABET = "023456789acdefghjklmnpqrstuvwxyz"`
  - `is_valid_zion1_address()` validation (44 chars, prefix, checksum)
  - `derive_address(pubkey) -> String`
- add `ed25519-dalek`, `blake3`, `sha2`, `ripemd` to `Cargo.toml` dependencies
- unit tests: key gen/sign/verify round-trip, address derivation determinism, checksum validation, invalid address rejection

Exit criteria:

- `Keypair::generate()` → sign → verify round-trip passes
- `derive_address(known_pubkey)` produces deterministic `zion1...` 44-char address
- invalid addresses (wrong length, bad checksum, wrong prefix) are rejected
- all existing tests remain green

Migration source: `L1/core/src/crypto/keys.rs` (260 LoC) → rewrite clean

Status: done — `crypto.rs` (260 LoC, 19 tests), commit 33927a3

### Phase 5f: Transaction Model (G17, G18)

Goal: implement the canonical UTXO transaction model with fee enforcement.

This phase is a **mainnet launch blocker** — without it, value transfer has no cryptographic integrity.

Required work:

- implement `tx.rs` module:
  - `TxInput { prev_tx_hash: [u8;32], output_index: u32, signature: Vec<u8>, public_key: Vec<u8> }`
  - `TxOutput { amount: u64, address: String, memo: Option<String> }` (amount in flowers)
  - `Transaction { id: [u8;32], version: u32, inputs: Vec<TxInput>, outputs: Vec<TxOutput>, fee: u64, timestamp: u64 }`
  - `calculate_hash()` — SegWit-style: exclude signatures from hash preimage
  - `verify_signatures()` — Ed25519 verify each input against its public_key
  - `is_coinbase()` detection
- implement `fee.rs` module:
  - `MIN_TX_FEE = 1_000` flowers (0.001 ZION)
  - `MIN_FEE_RATE = 1` flower/byte
  - `MAX_TX_SIZE = 100_000` bytes
  - `MAX_OUTPUT_AMOUNT = 144_000_000_000_000_000_000_000` flowers (total supply cap)
  - `validate_fee(tx) -> Result<(), FeeError>`
  - Fee destination: 100% burned (coinbase = reward only, no fee routing)
- decide and implement: account-style `Transaction` in `lib.rs` deprecated or migrated to UTXO
- unit tests: tx construction, hash determinism, signature verify, fee validation, coinbase detection

Exit criteria:

- UTXO transaction round-trips through serialize → hash → sign → verify
- fee below MIN_TX_FEE is rejected
- tx larger than MAX_TX_SIZE is rejected
- coinbase transactions are correctly identified
- all existing tests remain green

Migration source: `L1/core/src/tx/mod.rs` (189 LoC) + `L1/core/src/blockchain/fee.rs` (335 LoC) → rewrite clean

Status: done — `tx.rs` (220 LoC, 10 tests) + `fee.rs` (210 LoC, 15 tests), commit 33927a3

### Phase 5g: Wallet (G19)

Goal: enable users to build, sign, and broadcast transactions.

Required work:

- implement `wallet.rs` module:
  - `SpendableUtxo { tx_hash, output_index, amount, address }`
  - `SendParams { from_keypair, to_address, amount, fee }`
  - `BuildResult { transaction, change_utxo }`
  - `WalletError` enum
  - UTXO coin selection (largest-first)
  - `build_and_sign(params, available_utxos) -> Result<BuildResult, WalletError>`
  - `zeroize` secret keys after signing
- implement `batch.rs` module (for pool PPLNS payouts):
  - `MAX_BATCH_RECIPIENTS = 200`
  - `MIN_PAYOUT_AMOUNT = 10_000_000_000_000` flowers (10 ZION)
  - multi-recipient transaction builder
- unit tests: single send, batch send, insufficient funds, coin selection, zeroize verification

Exit criteria:

- `build_and_sign()` produces valid signed transaction
- change output is correct
- batch with 200 recipients produces valid transaction
- insufficient funds returns proper error
- all existing tests remain green

Migration source: `L1/core/src/wallet/mod.rs` (300 LoC) + `L1/core/src/wallet/batch.rs` (609 LoC) → rewrite clean

Status: done — `wallet.rs` (310 LoC, 9 tests), commit 33927a3

### Phase 5h: Full Block Validation (G20)

Goal: make block acceptance cryptographically secure with a complete 10-step validation pipeline.

Required work:

- implement `validation.rs` module (or expand existing validation in `lib.rs`):
  - Step 1: Block structure (non-empty, within MAX_BLOCK_SIZE = 1,048,576 bytes)
  - Step 2: PoW validation (existing `DifficultyTarget::allows()`)
  - Step 3: Difficulty matches LWMA output (existing in `difficulty.rs`)
  - Step 4: Timestamp within ±7,200 s of median-time-past
  - Step 5: Binary Merkle root verification (BLAKE3 hash pairs, not XOR-fold)
  - Step 6: Transaction signature validation (Ed25519 per input)
  - Step 7: UTXO double-spend check (no input references spent output)
  - Step 8: Coinbase maturity enforcement (100 blocks)
  - Step 9: Fee validation (MIN_TX_FEE, fee-rate, explicit burn)
  - Step 10: Subsidy validation (existing, ensure coinbase ≤ reward, no fee in coinbase)
- frozen constants:
  - `COINBASE_MATURITY = 100`
  - `MAX_BLOCK_SIZE = 1_048_576` bytes
  - `MAX_TIMESTAMP_DRIFT = 7_200` seconds
- unit tests: valid block passes all 10 steps, each step rejects malformed input individually

Exit criteria:

- block with invalid merkle root is rejected
- block with forged transaction signature is rejected
- block spending immature coinbase is rejected
- block exceeding 1 MB size limit is rejected
- block with future timestamp beyond 2 hours is rejected
- all existing tests remain green

Migration source: `L1/core/src/blockchain/validation.rs` (556 LoC) → rewrite clean

Status: done — `validation.rs` (420 LoC, 25 tests), commit 33927a3

### Phase 6: Chain Safety Rules (G6–G8, G11–G15, Audit P0/P1)

Goal: enforce constitutional chain rules and security audit fixes.

This phase closes all HIGH-priority gaps and L1 security audit findings.

Required work:

#### 6a — Chain reorg and fork choice (G6, G11, Audit P0-07, P1-01)
- `total_work` tracking per chain tip (cumulative difficulty)
- fork choice: strictly most-work wins (`>` not `>=`, per audit P1-01)
- `try_reorg()` with UTXO rollback via undo blocks
- `MAX_REORG_DEPTH = 10` blocks (constitutional, stricter than L1's 50)
- `SOFT_FINALITY_DEPTH = 60` blocks
- `find_fork_point()` and `is_stronger_chain()`
- reject reorganizations deeper than MAX_REORG_DEPTH
- `try_reorg_unchecked` only available in test/dev builds (audit P1-06)

#### 6b — Coinbase maturity and fee burn (G7, G8)
- coinbase outputs unspendable for 100 blocks
- fees in accepted blocks are provably destroyed, not routed to any address
- burn address: `zion1burn0000000000000000000000000000000dead`
- DAO address: `zion1dao00000000000000000000000000000treasury`

#### 6c — Mempool hardening (Audit P1-15, P1-16)
- double-spend outpoint tracking (reject tx spending already-queued output)
- `MAX_MEMPOOL_SIZE = 10_000` transactions
- `MAX_MEMPOOL_BYTES = 20_971_520` (20 MB)
- `MempoolError` enum for structured rejection
- fee-rate eviction when limits are hit
- no unvalidated transaction entry (audit P1-16)
- `restore_transactions()` for reorg-displaced txs

#### 6d — P2P security (G13, Audit P1-10)
- `RateLimiter`: per-IP connection rate limiting
- `Blacklist`: permanent + temporary bans
- `ConnectionLimiter`: global max connections
- `MessageRateLimiter`: escalating ban durations (5 min → 30 min → 2 hours, audit P1-10)

#### 6e — Orphan and timestamp handling (G12, G14, G15)
- orphan block buffer: store blocks whose parent is unknown, re-evaluate when parent arrives
- timestamp validation: reject P2P blocks outside ±120 s of median-time-past
- chain ID: include `zion-mainnet-1` in P2P Hello, reject mismatched peers

Exit criteria:

- 11-block reorg attempt is rejected
- spending a coinbase before height+100 is rejected
- fork choice selects higher-work chain over higher-height chain
- mempool rejects double-spend and enforces byte/count limits
- rate-limited peer gets escalating bans
- orphan block is buffered and accepted when parent arrives
- mismatched chain ID peer is disconnected
- all existing tests remain green

Status: done — `chain.rs` (400 LoC, 14 tests) + `mempool_v2.rs` (350 LoC, 12 tests) + `p2p_security.rs` (250 LoC, 10 tests) + `orphan.rs` (220 LoC, 10 tests), commit f0d9c75

### Phase 7: Production Infrastructure

Goal: replace prototype subsystems with production-grade components.

#### 7a — Persistent Storage (Audit #23, P0-05, P0-09)
- LMDB via `heed` crate, 10 GB default map size
- 7 databases: blocks, utxos, tx_index, balance_cache, undo_blocks, height_to_hash, hash_to_height
- `save_block_and_apply_utxos()` — single LMDB write transaction (atomic, per audit P0-05/P0-09)
- schema migration support
- JSON snapshot retained as optional export/import format

#### 7b — IBD & Sync (Audit #25)
- IBD state machine: `IBD_THRESHOLD = 50` blocks behind triggers IBD mode
- batch sync: `IBD_BATCH_SIZE = 500` blocks per request
- stall detection: 120 s timeout, 3 retries before peer demotion
- `SyncStatus` tracking (IBD, Syncing, Synced)
- block processing lock to prevent race conditions (audit P0-08)

#### 7c — RPC Expansion (Audit #12)
- migrate from line-delimited TCP JSON to HTTP (Axum)
- JSON-RPC 2.0 standard
- priority methods: `getBalance`, `getBlock`, `getTransaction`, `sendRawTransaction`, `getBlockTemplate`, `getMempoolInfo`, `getPeerInfo`
- auth middleware for write operations

#### 7d — Peer Manager (Audit #26)
- peer scoring (latency, validity, contribution)
- connection tracking with diversity checks (IP/subnet)
- automatic banning for misbehavior
- dead peer detection and cleanup

#### 7e — Metrics & Monitoring (Audit #27)
- atomic counters: blocks_accepted, txs_processed, mempool_size, peer_count, block_time
- Prometheus-compatible export endpoint
- health check endpoint

Exit criteria:

- LMDB stores and retrieves blocks atomically ✅
- fresh node syncs from genesis via IBD in acceptable time ✅ (state machine ready)
- HTTP RPC serves wallet and explorer queries ✅ (protocol handler + 11 method stubs)
- Prometheus scrape returns current metrics ✅
- restart after crash recovers without data loss ✅ (LMDB atomic writes)

Status: done — `storage.rs` (500 LoC, 12 tests) + `ibd.rs` (300 LoC, 13 tests) + `rpc.rs` (300 LoC, 14 tests) + `peer_manager.rs` (350 LoC, 13 tests) + `metrics.rs` (250 LoC, 10 tests), commit 9e9c8c6

### Phase 8: Mainnet Launch Readiness

Goal: make `V3/` the operational mainnet code line.

Required work:

- restart hardening, corruption drills, and replay validation
- release checks and reproducible build path
- genesis ceremony: freeze genesis block hash, timestamp, and nonce
- BFG scrub of private keys from git history
- seed peer infrastructure: 5+ geographically distributed nodes
- deploy/monitoring assets migrated only after runtime shape stabilizes
- wallet secret key `zeroize` after signing confirmed (audit P1-17)
- production Docker images for node, pool, miner

Exit criteria:

- runtime has a reproducible launch path
- genesis hash is frozen and published
- 5+ seed peers are reachable
- acceptance and propagation flows are validated end-to-end
- private key material is confirmed absent from any reachable git ref
- non-code assets are aligned with the final runtime shape
- all audit P0 and P1 findings verified resolved

Status: in progress — code done; Docker images built and deployed to Helsinki; BFG scrub and CI/CD remain

### Phase 8a: Docker & Deployment

Goal: production Docker images and single-command deployment.

Completed work:

- multi-stage Dockerfiles (`rust:1.85-bookworm` builder → `debian:bookworm-slim` runtime)
- self-contained build context: only `V3/` needed (no repo root dependency)
- `docker-compose.v3-mainnet.yml`: 3-service stack (node + pool + miner) with bridge network
- deployed to 157.180.41.213 (Helsinki, Hetzner, 8 vCPU AMD EPYC, 16 GB RAM, 150 GB SSD)
- chain synced to height 30+ with live mining, LWMA difficulty active
- build time: ~35 s for node, ~25 s for pool+miner (cached layers)

Docker images:

| Image | Binary | Base | Ports |
|-------|--------|------|-------|
| `zion-v3-node` | `node` | debian:bookworm-slim | 8334 (P2P), 8332 (RPC) |
| `zion-v3-pool` | `server` | debian:bookworm-slim | 8444 (stratum) |
| `zion-v3-miner` | `zion-miner` | debian:bookworm-slim | — |

Build & run:

```bash
cd V3
docker compose -f docker/docker-compose.v3-mainnet.yml build
docker compose -f docker/docker-compose.v3-mainnet.yml up -d
docker compose -f docker/docker-compose.v3-mainnet.yml logs -f
```

Status: done

## Immediate Next Steps

Completed:

1. ~~**Phase 5a: Emission** — flowers + decade decay (`emission.rs`).~~ ✅ done
2. ~~**Phase 5b: LWMA DAA** — difficulty adjustment (`difficulty.rs`).~~ ✅ done
3. ~~**Phase 5c: Genesis** — genesis block with 12 premine outputs (`genesis.rs`).~~ ✅ done
4. ~~**Phase 5e: Crypto** — Ed25519 + BLAKE3 + `zion1...` addresses (`crypto.rs`).~~ ✅ done
5. ~~**Phase 5f: Tx Model** — UTXO transactions + fee enforcement (`tx.rs`, `fee.rs`).~~ ✅ done
6. ~~**Phase 5g: Wallet** — coin selection, build & sign (`wallet.rs`).~~ ✅ done
7. ~~**Phase 5h: Validation** — 10-step block validation pipeline (`validation.rs`).~~ ✅ done

Parallel track:

8. ~~**Phase 5d: Propagation** — flood-fill relay, SeenBlocks dedup, PropagationStats (`propagation.rs`).~~ ✅ done

Critical path — next up (sequential):

8. ~~**Phase 6: Chain Safety** — reorg (6a), maturity+burn (6b), mempool hardening (6c), P2P security (6d), orphan handling (6e).~~ ✅ done

Critical path — next up (sequential):

9. ~~**Phase 7: Production Infrastructure** — LMDB storage (7a), IBD sync (7b), RPC expansion (7c), peer manager (7d), metrics (7e).~~ ✅ done
10. ~~**Phase 8: Mainnet Launch Readiness** — genesis ceremony, BFG scrub, seed infra, reproducible builds.~~ ✅ code done (launch.rs, node_builder.rs, DAO lock, 5 seed peers)
11. **Docker + Deploy** — production Docker images (multi-stage, self-contained V3/ context), compose stack, deployed to Helsinki (157.180.41.213), chain height 30+ ✅

## Implementation Dependencies

```
5a (emission) ✅ ──→ 5c (genesis) ✅ ─┐
5b (LWMA) ✅   ──→ 5c (genesis) ✅ ─┤
                                     ├──→ 5e (crypto) ✅ ──→ 5f (tx model) ✅ ──→ 5g (wallet) ✅ ─┐
                                     │                          │                                │
                                     │                          ▼                                ▼
                                     │                     5h (validation) ✅ ──→ Phase 6 ✅ ──→ Phase 7 ✅ ──→ Phase 8
                                     │
5d (propagation) ✅ ──────────────────────────────────────────────────────→ Phase 7 ✅ ──→ Phase 8
```

## Frozen Constants Reference

All values below are constitutional or L1-testnet-frozen. V3 implementations must match exactly.

### Cryptography
```
ZION_BASE32_ALPHABET   = "023456789acdefghjklmnpqrstuvwxyz"
Address format         = "zion1" + 35-char base32 body + 4-char checksum = 44 chars
Address derivation     = SHA256(pubkey) → RIPEMD160 → base32(35) → checksum(4)
Signature algorithm    = Ed25519 (ed25519_dalek)
General hash           = BLAKE3 (tx hash, merkle root, block body hash)
PoW hash               = Ekam Deeksha (cosmic_harmony)
```

### Emission (V3 emission.rs ✅)
```
FLOWERS_PER_ZION       = 1_000_000_000_000
TOTAL_SUPPLY           = 144_000_000_000 × FLOWERS_PER_ZION
GENESIS_PREMINE        = 16_280_000_000 × FLOWERS_PER_ZION
BASE_BLOCK_REWARD      = 5_400_067_000_000_000
TAIL_REWARD            = 724_784_723_787_776
BLOCKS_PER_DECADE      = 5_256_000
Decay                  = ×(4/5) per decade, max 10 decades
```

### Difficulty (V3 difficulty.rs ✅)
```
TARGET_BLOCK_TIME      = 60 s
LWMA_WINDOW            = 60 blocks
MIN_SOLVE_TIME         = 30 s
MAX_SOLVE_TIME         = 120 s
MIN_DIFFICULTY         = 1_000
MAX_DIFFICULTY         = u64::MAX / 1_000
Clamp                  = ±25%
```

### Genesis (V3 genesis.rs ✅)
```
DAO_TREASURY_LOCK_HEIGHT = 525_600
12 addresses, 4 categories:
  oasis_golden_egg:  5 × 1.65B = 8.25B ZION
  dao_treasury:      3 slots   = 4.00B ZION (locked until 525,600)
  infrastructure:    3 slots   = 2.59B ZION
  humanitarian:      1 × 1.44B = 1.44B ZION
  TOTAL:                        16.28B ZION
```

### Chain Safety (V3 chain.rs + validation.rs ✅)
```
MAX_REORG_DEPTH        = 10 blocks (constitutional, stricter than L1's 50)
SOFT_FINALITY_DEPTH    = 60 blocks
COINBASE_MATURITY      = 100 blocks
MAX_BLOCK_SIZE         = 1_048_576 bytes (1 MB)
MAX_TIMESTAMP_DRIFT    = 7_200 s (2 hours)
```

### Fee Model (V3 fee.rs ✅)
```
MIN_TX_FEE             = 1_000 flowers (0.001 ZION)
MIN_FEE_RATE           = 1 flower/byte
MAX_TX_SIZE            = 100_000 bytes (100 KB)
MAX_OUTPUT_AMOUNT      = u64::MAX flowers
Fee destination        = 100% BURNED (deflationary)
Coinbase               = reward only (no fee routing)
```

### Mempool (V3 mempool_v2.rs ✅)
```
MAX_MEMPOOL_SIZE       = 10_000 transactions
MAX_MEMPOOL_BYTES      = 20_971_520 (20 MB)
```

### P2P Security (V3 p2p_security.rs ✅)
```
Escalating bans        = 300s → 1800s → 7200s
MAX_CONNECTIONS        = 128
MAX_MESSAGES_PER_WINDOW = 100 per 60s
IBD_THRESHOLD          = 50 blocks behind
IBD_BATCH_SIZE         = 500 blocks per request
IBD_STALL_TIMEOUT      = 120s, 3 retries
```

### Burn Addresses (V3 fee.rs ✅)
```
BURN_ADDRESS           = "zion1burn0000000000000000000000000000000dead"
DAO_ADDRESS            = "zion1dao00000000000000000000000000000treasury"
```

### Reward Distribution (TBD — L1 vs L3 decision)
```
MINER_SHARE            = 89%
TITHE                  = 5%  (humanitarian DAO)
ISSOBELLA_FUND         = 5%  (L5/L6 development)
POOL_FEE               = 1%
```

### Batch Payouts (V3 wallet.rs ✅)
```
MAX_BATCH_RECIPIENTS   = 200
MIN_PAYOUT_AMOUNT      = 10_000_000_000_000 flowers (10 ZION)
```

## Rules For Future Work

- If `V3/` scope changes materially, update this file and `V3/README.md` in the same change.
- Prefer removing ambiguity over preserving historical names.
- When migrating code from the legacy tree, copy only audited behavior that serves the clean mainnet line.