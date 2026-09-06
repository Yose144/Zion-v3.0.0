# ZION TerraNova v2.9.5 — Complete Commit History

> **Repository:** [Yose144/Zion-2.9.5](https://github.com/Yose144/Zion-2.9.5)
> **Branch:** `main`
> **Total commits:** 299
> **Generated:** 2026-02-18 12:13

---

## 2026-02-08

### 1. `c1d8e34` — ­čÜÇ Initial Zion-2.9.5 ÔÇö Clean L1 MainNet codebase

| | |
|---|---|
| **Hash** | `c1d8e34fba43d9f751c8ef33e3f1aa7c08a09e29` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 09:14:29 +0100 |

<details><summary>Details</summary>

```
Sprint 0.0 complete:
- 4 Rust crates: core (49 files), pool (28 files), miner (22 files), cosmic-harmony (31 files)
- Pool cleaned of ALL non-L1 modules: consciousness/XP, NCL, buyback,
  profit_switcher, revenue_proxy, stream_scheduler, pool_external_miner
- 3 config environments: mainnet.toml, testnet.toml, devnet.toml
- Docker: 3 Dockerfiles + mainnet/testnet compose
- CI/CD: GitHub Actions (ci, audit, release)
- Docs: Full whitepaper suite + MAINNET_CONSTITUTION
- Legal: MIT license + compliance docs
- cargo check PASSES cleanly (warnings only)

Emission: 5,400.067 ZION/block constant (127.72B over 45 years)
Genesis premine: 16.78B ZION (11.65% of supply)
Distribution: 89% miner, 10% humanitarian, 1% pool fee

Next: Sprint 0.1 ÔÇö Rewrite reward.rs + genesis.rs
```
</details>

---

### 2. `cad8a62` — ÔÜí Sprint 0.1 ÔÇö Constant emission + clean genesis premine

| | |
|---|---|
| **Hash** | `cad8a62c6f1ad429cef8af73bedfeef238a41380` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 09:37:27 +0100 |

<details><summary>Details</summary>

```
reward.rs ÔÇö COMPLETE REWRITE:
  - Removed Bitcoin-style halving (50 ZION + 2.1M interval)
  - Constant emission: 5,400.067 ZION/block (5,400,067,000 atomic)
  - Genesis block (height 0) returns 0 (premine only)
  - Emission ends at block 23,652,000 (45 years ├Ś 525,600 blocks/year)
  - Total mining supply: 127.22B ZION
  - Distribution helpers: miner_reward (89%), tithe_reward (10%), pool_fee (1%)
  - 15 comprehensive tests ÔÇö all passing

premine.rs ÔÇö CLEAN L1 REWRITE:
  - Total premine: 16,780,000,000 ZION (was 16,282,857,143 ÔÇö rounded)
  - Removed: Presale (500M) ÔÇö cancelled January 2026
  - Removed: DAO Winners (1.75B) ÔÇö merged into DAO Treasury
  - Removed: OASIS game allocation ÔÇö renamed to Humanitarian
  - Removed: Consciousness bonus constants & multipliers
  - Removed: PresalePhase struct
  - New structure: 4 categories (mining_operators 8.25B, dao_treasury 4B,
    infrastructure 2.59B, humanitarian 1.44B)
  - Block-height-based unlock (not date-based)
  - 8 tests ÔÇö all passing

Pool cleanup:
  - reward_calculator.rs: Removed ConsciousnessLevel dependency, constant 5,400.067
  - consciousness.rs: DELETED (271 lines)
  - blockchain/mod.rs: Removed consciousness module
  - payout/scheduler.rs: Removed consciousness_multiplier from DB schema & logic
  - rpc/methods.rs: Updated premine list endpoint (unlock_height, no voting_weight)

Verification: cargo check PASSES, 92 core tests PASS
```
</details>

---

### 3. `be0beb0` — ­čÄ» Sprint 0.2 ÔÇö LWMA Difficulty Adjustment Algorithm

| | |
|---|---|
| **Hash** | `be0beb0b35af8750d361a4938f3ac92fc320d90c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 09:49:37 +0100 |

<details><summary>Details</summary>

```
consensus.rs ÔÇö COMPLETE REWRITE:
  - Replaced simple single-block ratio DAA (max 4├Ś change)
  - Implemented LWMA (Linearly Weighted Moving Average) per MAINNET_CONSTITUTION
  - Window: 60 blocks (linearly weighted, recent = heavier)
  - Target: 60 seconds per block
  - Max change: ┬▒25% per block (was ┬▒4├Ś)
  - Solve time clamp: 30ÔÇô120s (prevents timestamp manipulation)
  - Min difficulty: 1,000 / Max: u64::MAX / 1,000
  - Graceful degradation for short chains (< 60 blocks)

New public API:
  - lwma_next_difficulty(window: &[BlockInfo]) Ôćĺ u64
  - BlockInfo { timestamp, difficulty } struct
  - Constants: TARGET_BLOCK_TIME, LWMA_WINDOW, MAX/MIN_ADJUSTMENT

Backward compatibility:
  - calculate_next_difficulty() retained with ┬▒25% clamp (was ┬▒4├Ś)
  - validation.rs still works via single-block fallback

18 consensus tests ÔÇö all passing
104 total core tests ÔÇö all passing
```
</details>

---

### 4. `4ed3a04` — ­čöą Sprint 0.3 ÔÇö Fee Market & Fee Burning

| | |
|---|---|
| **Hash** | `4ed3a042f4ecd84dd3555a407162a6653142ad9e` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 10:00:13 +0100 |

<details><summary>Details</summary>

```
NEW: core/src/blockchain/fee.rs
  - Fee burning: ALL tx fees are destroyed, NOT paid to miner
  - Coinbase output capped at block reward only (no fee component)
  - MIN_TX_FEE = 1,000 atomic (0.001 ZION) ÔÇö absolute floor
  - MIN_FEE_RATE = 1 atomic/byte ÔÇö rate-based minimum
  - MAX_TX_SIZE = 100 KB ÔÇö prevents oversized transactions
  - MAX_OUTPUT_AMOUNT = total supply (144B ZION) ÔÇö overflow protection
  - validate_fee() + validate_output_amounts() public API
  - estimate_tx_size() for fee rate calculations
  - total_fees_burned() for deflationary tracking
  - 17 comprehensive tests

REWRITE: core/src/mempool/pool.rs
  - MempoolError enum (Duplicate, FeeTooLow, TxTooLarge, DoubleSpend, InvalidOutputAmount)
  - add_transaction_validated() ÔÇö full validation before pool entry
  - Double-spend detection via O(1) spent_outpoints HashSet
  - get_sorted_by_fee_rate() ÔÇö highest fee rate first for block templates
  - is_outpoint_spent() ÔÇö public API for UTXO conflict checks
  - MAX_MEMPOOL_SIZE = 10,000 with auto-eviction
  - Outpoint cleanup on remove_transaction()
  - 8 mempool tests

REWRITE: core/src/mempool/eviction.rs
  - Eviction now by fee RATE (atomic/byte), not absolute fee
  - Freed outpoints properly cleaned from tracking set
  - 4 eviction tests including outpoint cleanup verification

UPDATE: core/src/blockchain/validation.rs
  - validate_transaction() now checks: fee minimum, fee rate, output bounds, tx size
  - Coinbase validation uses fee::max_coinbase_output() (fee burning enforced)
  - Removed legacy 30% consciousness bonus from calculate_block_reward()
  - Removed hardcoded 21M ZION per-output limit (now uses total supply)

130 total core tests ÔÇö all passing (26 new)
```
</details>

---

### 5. `b8112eb` — ­čĺŞ Sprint 0.4 ÔÇö Wallet Send & TX Broadcasting

| | |
|---|---|
| **Hash** | `b8112eb0562fe260a7412dd6bcc66dddf652e681` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 10:14:10 +0100 |

<details><summary>Details</summary>

```
New modules:
- wallet/mod.rs: UTXO coin selection (largest-first greedy),
  tx build & Ed25519 sign pipeline, auto change address,
  iterative fee estimation, 13 unit tests

Updated:
- zion-wallet.rs: Send + Balance CLI commands via reqwest HTTP
  (fetch UTXOs Ôćĺ build_and_sign Ôćĺ broadcast to /rpc/submit_tx)
- state/mod.rs: process_transaction() uses add_transaction_validated()
  (fee + double-spend checks enforced at mempool entry)
- rpc/methods.rs: UTXO endpoint includes 'amount' field
- Cargo.toml: reqwest blocking feature

Phase 0 sprints complete: 0.0ÔÇô0.4
Tests: 143 passed, 0 failed
```
</details>

---

### 6. `19787a7` — ­čŤí´ŞĆ Sprint 0.5 ÔÇö Consensus Hardening

| | |
|---|---|
| **Hash** | `19787a7e2a95fae35e285cf40c47b29fb670a31c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 10:20:52 +0100 |

<details><summary>Details</summary>

```
Coinbase maturity:
- COINBASE_MATURITY = 100 blocks enforced in state/mod.rs
- Spending coinbase UTXO before 100 confirmations is rejected
- Lookup via tx_to_block + hash_to_height indexes (no DB schema change)

Timestamp sanity:
- MAX_TIMESTAMP_DRIFT = 120 s (┬▒2├Ś target)
- Block timestamp > prev + 120s rejected (limits LWMA manipulation)
- Existing future-drift (2h) and backward checks preserved

Reorg & finality (chain.rs rewrite):
- MAX_REORG_DEPTH = 10 blocks ÔÇö deeper reorgs rejected outright
- SOFT_FINALITY_DEPTH = 60 blocks ÔÇö is_finalized() / finalized_height()
- try_reorg() enforces depth limit + finality + work comparison
- Fork-choice: highest accumulated work wins (total_work tracking)
- work_at_height map for per-height accumulated work

Tests: 155 passed, 0 failed (+12 new)
- 8 chain tests (reorg depth, finality, fork-choice, work tracking)
- 4 validation tests (maturity const, timestamp drift, sanity limits)

Phase 0 Exit Criteria: ALL SATISFIED Ôťů
```
</details>

---

### 7. `98cc1b6` — ­čÜÇ Phase 1 ÔÇö TestNet deploy script

| | |
|---|---|
| **Hash** | `98cc1b6c21603da2d9e586a44c5682c5b596236a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 10:37:17 +0100 |

<details><summary>Details</summary>

```
scripts/deploy-testnet.sh:
- Deploys to Helsinki (SEED), USA (PEER1), Singapore (PEER2)
- git clone Ôćĺ docker compose build Ôćĺ up
- Per-server: ./deploy-testnet.sh helsinki|usa|singapore
- Full deploy: ./deploy-testnet.sh all
- Verify: ./deploy-testnet.sh verify
- Cleanup: ./deploy-testnet.sh clean
```
</details>

---

### 8. `6f3cdcd` — ­čöž Fix Dockerfiles: rust:1.84, rsync deploy (private repo)

| | |
|---|---|
| **Hash** | `6f3cdcd023cb86ab1c492ed2731896ce2df0447a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 10:39:49 +0100 |

---

### 9. `c86051c` — ­čöž Dockerfiles: rust:1.85-bookworm (fix edition2024 requirement)

| | |
|---|---|
| **Hash** | `c86051cf1649646fafe5261f20c8e12a4b1208bb` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 11:34:28 +0100 |

---

### 10. `77d7b54` — ­čöž Dockerfiles: add cmake, g++, libssl-dev build deps (fix randomx-rs build)

| | |
|---|---|
| **Hash** | `77d7b5423723cf19552a6040196516878dc670b5` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 11:35:26 +0100 |

---

### 11. `6d34c28` — ­čÜÇ Phase 1 Deploy ÔÇö 3 nodes online, fix Dockerfile CMD, docker-compose peers

| | |
|---|---|
| **Hash** | `6d34c28c43bd55ff0367274a9b46c4a7e53a0d2f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 11:47:37 +0100 |

<details><summary>Details</summary>

```
Helsinki (77.42.31.72) SEED ÔÇö zion-core:2.9.5-testnet Ôťů
USA (5.78.145.234) PEER1 ÔÇö zion-core:2.9.5-testnet Ôťů
Singapore (5.223.56.124) PEER2 ÔÇö zion-core:2.9.5-testnet Ôťů
All nodes synced at height=1, same tip hash, consensus OK
```
</details>

---

### 12. `6e07b3f` — Sprint 1.0: Network identity ÔÇö testnet/mainnet separation

| | |
|---|---|
| **Hash** | `6e07b3f2968c5104dc4ff66ecd19ab92faaa99fc` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 12:22:18 +0100 |

<details><summary>Details</summary>

```
- Add network module (NetworkType enum, magic bytes, global singleton)
- Add --network CLI flag (default: testnet)
- P2P handshake includes network magic ÔÇö cross-network peers rejected
- /health and /stats endpoints include network field
- Docker compose updated: --network testnet/mainnet in command
- Backward compatible: peers without network field accepted (legacy)
- 159 tests pass (4 new network tests)
```
</details>

---

### 13. `229daab` — Fix: genesis timestamp uses current time on testnet

| | |
|---|---|
| **Hash** | `229daabeb383dc3b0d01f4f7c416535041e079cf` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 12:46:35 +0100 |

<details><summary>Details</summary>

```
- NetworkType::genesis_timestamp() returns now() for testnet, fixed for mainnet
- Fixes 'Block timestamp drift exceeds max 120s' when mining after fresh start
- Genesis block timestamp was hardcoded to Jan 1, 2024 causing 2-year gap
- 159 tests pass
```
</details>

---

### 14. `858bf50` — Fix: use fixed testnet genesis timestamp for deterministic genesis hash

| | |
|---|---|
| **Hash** | `858bf505a638b55d67007800f14a2f6f4112f132` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 13:27:25 +0100 |

<details><summary>Details</summary>

```
- Testnet genesis: Feb 8, 2026 12:00:00 UTC (1770552000)
- Mainnet genesis: Jan 1, 2024 00:00:00 UTC (1704067200)
- Dynamic timestamp caused different genesis hashes per node = sync failure
- All nodes must produce identical genesis block
```
</details>

---

### 15. `0edf8ba` — Fix: skip timestamp drift check for block #1 after genesis

| | |
|---|---|
| **Hash** | `0edf8bad4a8383c1f79a4a1c61b79cc9d699b107` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 13:43:56 +0100 |

<details><summary>Details</summary>

```
- Genesis has fixed historical timestamp, first mined block has natural gap
- Block height=1 exempt from MAX_TIMESTAMP_DRIFT=120s validation
- Same pattern as Bitcoin (genesis Jan 3, 2009 Ôćĺ first block Jan 9, 2009)
- 159 tests pass
```
</details>

---

### 16. `826b978` — Fix: CHv3 fork height default 0 (active from genesis)

| | |
|---|---|
| **Hash** | `826b97884295fe827c6ac3fac42033e0abc23d06` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 14:01:43 +0100 |

<details><summary>Details</summary>

```
- Old default was height=10, causing CHv1 validation for blocks 0-9
- Python CHv3 miner hash rejected as 'Insufficient PoW' because
  node validated with CHv1 algorithm instead of CHv3
- Fresh testnet has no legacy history, CHv3 from block 0
- Env var ZION_CH_V3_FORK_HEIGHT still available for overrides
- 159 tests pass
```
</details>

---

### 17. `2a08411` — Fix: increase MAX_TIMESTAMP_DRIFT from 120s to 7200s (2 hours)

| | |
|---|---|
| **Hash** | `2a08411a973cadd9c648c3365d445d3878a12a1b` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 14:20:30 +0100 |

<details><summary>Details</summary>

```
- 120s was too aggressive ÔÇö blocks taking >2 min to mine were rejected
- Bitcoin uses 7200s (2 hours) for the same purpose
- LWMA still clamps solve times to MAX_SOLVE_TIME=120s internally
- Separate concerns: LWMA clamping vs block acceptance policy
- Updated timestamp sanity tests accordingly
- 159 tests pass
```
</details>

---

### 18. `93b8cfc` — Fix: state.difficulty stores NEXT block difficulty (LWMA retarget)

| | |
|---|---|
| **Hash** | `93b8cfcd9e910aaf731c3e299e4388e2a99c4d26` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 15:07:18 +0100 |

<details><summary>Details</summary>

```
- Was storing current block's difficulty, causing template to return stale diff
- Now calculates next_difficulty via LWMA after accepting each block
- Template/getBlockTemplate returns correct difficulty for next block
- Fixes 'Invalid difficulty: 1000 (expected around 1250)' rejection
- 159 tests pass
```
</details>

---

### 19. `07f37f8` — fix(consensus): difficulty validation uses range check instead of recalculation

| | |
|---|---|
| **Hash** | `07f37f8618be1fd6ba9935311069d971a3d23bb4` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 15:52:04 +0100 |

<details><summary>Details</summary>

```
The previous approach recalculated expected difficulty using the current
block's timestamp, but miners cannot know their solve-time in advance.
This created a mismatch: template served difficulty X, but validation
expected Y (recalculated with actual time_diff).

New approach (standard in Bitcoin/Monero):
- Validate difficulty is within [MIN_DIFFICULTY, MAX_DIFFICULTY]
- Validate difficulty is within ┬▒25% of previous block
- PoW must meet the declared difficulty target (unchanged)
- Actual LWMA retarget happens in state.process_block() after acceptance

This fixes the 'Invalid difficulty: 1000 (expected around 1250)' error
that blocked mining after the first few blocks.

All 159 core tests pass.
```
</details>

---

### 20. `5437998` — fix(pool): fix 2 test compilation errors in processor.rs and scheduler.rs

| | |
|---|---|
| **Hash** | `543799880ec3ca03bbbc1b5a5e941b45bf24d6a6` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 16:19:17 +0100 |

<details><summary>Details</summary>

```
- ShareProcessor::new() test had extra None argument (6 instead of 5)
- PayoutScheduler::add_pending_payout() test had extra 1.1 arg (4 instead of 3)

Both were leftovers from earlier refactors. Pool now compiles cleanly.
Core: 159 tests pass | Pool: 24 tests pass + 1 ignored (PostgreSQL)
```
</details>

---

### 21. `16438a7` — Sprint 1.1: TestNet config validation ÔÇö 70 integration tests

| | |
|---|---|
| **Hash** | `16438a793a26a5f738ceaf61392acdb9de18e856` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 16:52:50 +0100 |

<details><summary>Details</summary>

```
Config fixes:
- mainnet.toml: ports 8333/8443 (match network.rs), premine 2.59B/1.44B
- testnet.toml: premine 2.59B/1.44B (match premine.rs), genesis timestamp
- Both TOMLs now fully consistent with hardcoded Rust constants

New integration test suites (3 files, 70 tests):
- config_validation.rs (27 tests): emission, consensus, network identity
- genesis_verification.rs (18 tests): premine totals, addresses, timelocks
- chain_consensus.rs (25 tests): LWMA, difficulty bounds, PoW validation

Total test count: 229 core + 24 pool = 253 ALL GREEN
```
</details>

---

### 22. `7e85e84` — Sprint 1.2: Security & Edge-Case Test Suite (29 tests + 3 production fixes)

| | |
|---|---|
| **Hash** | `7e85e84e931ebde898a350e5d386e70bfa7a4238` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 17:12:13 +0100 |

<details><summary>Details</summary>

```
Production fixes:
- [FIX] Strict UTXO validation in process_transaction() ÔÇö no longer warns,
  now rejects TX with missing UTXOs + verifies address ownership
- [FIX] Intra-block double-spend detection in process_block() ÔÇö prevents
  two transactions in the same block from spending the same outpoint
- [FIX] Mempool restore on reorg rollback ÔÇö transactions from rolled-back
  blocks are returned to mempool (excluding coinbase), with conflict detection
- [NEW] reorg_to_fork() method on Inner state ÔÇö full storage-level reorg
  with UTXO rollback, block deletion, mempool restore, and new fork application

Chain module additions:
- [NEW] insert_block_unchecked() ÔÇö test helper for building synthetic chains
- [NEW] try_reorg_unchecked() ÔÇö reorg with consensus checks but without PoW validation

Integration tests (core/tests/sprint_1_2_test_suite.rs):
  1.2.1 Reorg suite (5 tests): short/max/rejected depth, work update, block replacement
  1.2.2 Double-spend (4 tests): mempool rejection, block-clear, reorg restore, coinbase skip
  1.2.3 Fork-choice (3 tests): higher work wins, equal keeps incumbent, lower rejected
  1.2.4 Timestamp drift (4 tests): future reject, within-limit, before-parent, boundary
  1.2.5 Mempool edge cases (5 tests): oversized TX, invalid sig, dust, eviction, low fee
  1.2.6 Coinbase maturity (5 tests): constants, immature/mature/post-mature, non-coinbase
  Cross-cutting (3 tests): MAX_REORG_DEPTH, SOFT_FINALITY_DEPTH, chain verify

Total: 282 tests passing (258 core + 24 pool)
```
</details>

---

### 23. `9bd901b` — Sprint 1.3: IBD Hardening ÔÇö stall detection, peer tracking, sync RPC (42 tests)

| | |
|---|---|
| **Hash** | `9bd901b562532eeba24c95c544b5c21e97530a0c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 17:59:23 +0100 |

<details><summary>Details</summary>

```
P2P Sync hardening (core/src/p2p/sync.rs):
- [NEW] IBD stall detection: timeout after 120s of no batch progress
- [NEW] Peer tracking: records which peer IBD is syncing from
- [NEW] Stall retry counter: 3 retries before aborting IBD from peer
- [NEW] abort_ibd(): clean exit from IBD with reason logging
- [NEW] is_stalled(), record_stall(), is_ibd_peer() methods
- [NEW] SyncSnapshot struct: serializable IBD status for RPC/metrics
- [NEW] to_json(): produces SyncSnapshot for API consumption
- [MOD] enter_ibd() now accepts peer address parameter
- [MOD] update_progress() refreshes last_batch_time for stall detection

P2P Heartbeat (core/src/p2p/heartbeat.rs):
- [NEW] IBD stall check in heartbeat loop: detects stalled IBD every tick
- [MOD] On stall: retries up to 3x, then aborts IBD back to Steady

P2P Message handling (core/src/p2p/mod.rs):
- [NEW] HandshakeAck handler: processes peer acknowledgments
- [MOD] Tip handler: passes peer address to enter_ibd()
- [MOD] BlocksIBD handler: updates last_batch_time on receive

RPC (core/src/rpc/):
- [NEW] GET /api/sync/status ÔÇö returns IBD progress, ETA, speed, peer info
- [NEW] sync_status included in /stats response (syncing + sync_state fields)

Integration tests (core/tests/sprint_1_3_ibd_suite.rs ÔÇö 42 tests):
  IBD threshold & constants (5): threshold=50, batch=500, stall=120s, retries=3
  SyncStatus state machine (8): transitions, enter/exit/abort IBD, flags
  IBD stall detection (5): not-stalled, timeout, retry count, abort
  Peer tracking (5): set/check/clear peer, non-peer detection
  Progress tracking (6): height updates, counter, batch time refresh
  SyncSnapshot/to_json (6): steady/IBD snapshots, speed, ETA, percent
  should_enter_ibd logic (4): below/above threshold, already in IBD
  Progress report format (3): format string, speed calc, ETA

Total: 324 tests passing (300 core + 24 pool)
```
</details>

---

### 24. `967a36b` — Sprint 1.4: Pool Payout Integration (M5)

| | |
|---|---|
| **Hash** | `967a36b396c28c31065be1185afbb87fa0e0cf6f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 18:22:05 +0100 |

<details><summary>Details</summary>

```
Core:
- wallet/batch.rs: Batch TX builder ÔÇö single TX with N recipients
  - UTXO selection (largest-first), auto fee, Ed25519 signing
  - MAX_BATCH_RECIPIENTS=200, MIN_PAYOUT_AMOUNT=10 ZION
  - 14 unit tests (happy path + error cases + sig verification)
- jsonrpc: submitTransaction RPC ÔÇö accepts fully signed TX objects
  - Validates signatures, UTXO existence, ownership
  - Adds to mempool via unified pipeline

Pool:
- payout/wallet.rs: PoolWallet ÔÇö local Ed25519 signing
  - Dedicated pool keypair (ZION_POOL_WALLET_SECRET env var)
  - Fetches UTXOs via getUtxos RPC, builds batch TX locally
  - Submits signed TX via submitTransaction RPC
  - send_batch_payout() + send_single_payout()
- payout/maturity.rs: Coinbase maturity tracker
  - Tracks found blocks in Redis (sorted set by height)
  - check_maturity() ÔÇö verifies 100 confirmations + main chain
  - Handles orphaned blocks (removes from pending)
- blockchain/rpc_client.rs: get_utxos() + submit_signed_transaction()
- Cargo.toml: Added ed25519-dalek dependency

Tests: 23 integration tests (sprint_1_4_payout_suite.rs)
- Batch mechanics: 1/10/50 recipients, multiple UTXOs
- UTXO consumption: largest-first, exact-no-change
- Signatures: Ed25519 valid, tamper detection
- Fee: scales with outputs, minimum enforced
- Errors: empty/insufficient/invalid/zero/max
- Efficiency: batch < sum(singles)
- Economics: 89/10/1 reward split

Total: 365 tests (337 core + 28 pool), all passing
```
</details>

---

### 25. `f5554a9` — Sprint 1.5/M6: Buyback + Deflace ÔÇö 50% burn + 50% creators rent

| | |
|---|---|
| **Hash** | `f5554a97992a040f4db3f7976f1a96755a286e90` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 19:14:40 +0100 |

<details><summary>Details</summary>

```
Revenue Split Model:
- BURN_ADDRESS: zion1burn0000000000000000000000000000000dead
- CREATORS_ADDRESS: zion1creators000000000000000000000000000rent
- BURN_SHARE_PERCENT = 50, CREATORS_SHARE_PERCENT = 50
- calculate_revenue_split() + calculate_btc_revenue_split()
- BuybackEvent tracks both burn & creators portions
- BuybackStats includes 50/50 breakdown + creators_address
- Burn address spending protection in process_block/process_transaction
- 26 unit tests passing

Files: core/src/blockchain/burn.rs (new), mod.rs, state/mod.rs
```
</details>

---

### 26. `9af7162` — Sprint 1.6: Supply + Buyback + Network + Peer RPC API

| | |
|---|---|
| **Hash** | `9af716211dc2a2c99f67d887dee3af3d472fd952` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 19:29:12 +0100 |

<details><summary>Details</summary>

```
4 new JSON-RPC endpoints:
- getSupplyInfo: total/premine/mining/mined/burned/circulating supply
- getBuybackStats: 50/50 burn+creators split stats, recent events
- getNetworkInfo: version, network, peers, uptime, hashrate, algorithm
- getPeerInfo: connected/total peers, messages sent/received

15 new unit tests (all pass):
- test_get_supply_info_basic
- test_get_supply_info_aliases
- test_supply_mining_emission
- test_supply_circulating_no_burns
- test_get_buyback_stats_empty
- test_buyback_stats_with_limit
- test_buyback_stats_aliases
- test_get_network_info
- test_network_info_version
- test_network_info_aliases
- test_get_peer_info
- test_peer_info_aliases
- test_peer_info_initial_zeros
- test_unknown_method
- test_get_info (regression)

Total: 214 lib + 23 integration = 237 tests passing
```
</details>

---

### 27. `aa1b7df` — Sprint 1.7: P2P Message Rate-Limiting & Security Hardening

| | |
|---|---|
| **Hash** | `aa1b7df67a8737840a3d417e71b50ec1f71b1808` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 19:34:22 +0100 |

<details><summary>Details</summary>

```
New: MessageRateLimiter (per-peer message flood protection)
- 200 msgs/peer/60s sliding window
- Escalating bans: 60s Ôćĺ 300s Ôćĺ 3600s based on misbehavior score
- Auto-ban after 3 violations
- Integrated into handle_connection message loop
- Integrated into heartbeat reconnection path
- Periodic cleanup every 60s

13 new security tests:
- test_msg_rate_limiter_allows_under_limit
- test_msg_rate_limiter_blocks_over_limit
- test_msg_rate_limiter_misbehavior_score_accumulates
- test_msg_rate_limiter_should_ban_threshold
- test_msg_rate_limiter_ban_duration_escalation
- test_msg_rate_limiter_reset_score
- test_msg_rate_limiter_multiple_peers_independent
- test_msg_rate_limiter_stats
- test_msg_rate_limiter_unknown_peer_not_banned
- test_blacklist_stats
- test_permanent_ban_survives_cleanup
- test_rate_limiter_different_ips_independent
- test_connection_limiter_boundary

Total: 227 lib + 23 integration = 250 tests passing
```
</details>

---

### 28. `9cfa58f` — Sprint 1.8: Health Check & Metrics RPC Endpoints

| | |
|---|---|
| **Hash** | `9cfa58f893c9d699295260e3729050c585ccf525` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 19:36:16 +0100 |

<details><summary>Details</summary>

```
2 new JSON-RPC endpoints:
- getHealthCheck/health: status (healthy/degraded/unhealthy), network,
  uptime, height, difficulty, peers, mempool, time_since_last_block
- getMetrics: structured metrics ÔÇö blocks{processed,rejected,height},
  transactions{submitted,accepted,rejected,mempool}, p2p{peers,msgs},
  performance{validation_us,pow_us,storage_writes/reads}

8 new tests:
- test_health_check_basic
- test_health_check_aliases (4 aliases)
- test_health_check_has_network
- test_metrics_basic
- test_metrics_aliases (4 aliases)
- test_metrics_blocks_section
- test_metrics_p2p_section
- test_metrics_performance_section

Total: 235 lib + 23 integration = 258 tests passing
```
</details>

---

### 29. `5b1c1ea` — Sprint 1.9: Stress Test Suite & Network Partition Tests (21 tests)

| | |
|---|---|
| **Hash** | `5b1c1ea74a3b32378ba79b0c47ab2c3a936171bd` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 20:27:36 +0100 |

<details><summary>Details</summary>

```
- 1.9.1: High-throughput TX processing (1000 + 5000 TXs)
- 1.9.2: Rapid block production (100 + 500 blocks)
- 1.9.3: Mempool capacity, duplicate rejection, fill & eviction
- 1.9.4: Concurrent chain + TX processing (50 blocks ├Ś 10 TXs)
- 1.9.5: Network partition simulation (diverge/reconverge, short reorg, deep rejection)
- 1.9.6: Chain consistency (hash links, sequential heights, monotonic timestamps)
- 1.9.7: Buyback stress (100 events), supply invariant (circ + burned = total)
- 1.9.8: Orphan rate measurement (target <2%)
- 1.9.9: Security under stress (100 IPs rate-limiter, flood detection, mass ban/unban)
- 1.9.10: Stability summary + DAA consistency over 100 iterations

Total test count: 235 lib + 185 integration = 420 tests passing
```
</details>

---

### 30. `5a73448` — Sprint 2.0: Fix stream scheduler ÔÇö ZION-only mode for testnet

| | |
|---|---|
| **Hash** | `5a73448e07a74778a69ef6ee9c1247cda8b317e3` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 21:33:56 +0100 |

<details><summary>Details</summary>

```
Critical fixes:
- Pool config defaults: all external streams disabled by default (safe defaults)
- ZION target_share default: 1.0 (100% ZION mining when no external config)
- StreamScheduler: detect ZION-only mode, skip all revenue subsystems
- main.rs: conditionally start revenue_proxy/profit_switcher/buyback only when external streams enabled
- docker-compose: mount ch3_revenue_settings_testnet.json into pool container
- docker-compose: set proper miner wallet + explicit algo flag

Root cause: Pool stream scheduler switched miners to ethash jobs after ~2min,
but miner doesn't support ethash Ôćĺ mining stopped Ôćĺ blocks stuck at height 244.

All 420 tests passing (235 lib + 185 integration).
```
</details>

---

### 31. `45c676c` — fix(ch3): correct 50/25/25 allocation model in config defaults + add revenue settings JSON

| | |
|---|---|
| **Hash** | `45c676c7b0828f7a7b52d3719c470d8515c396ae` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 22:05:16 +0100 |

<details><summary>Details</summary>

```
PROBLEM:
- Config defaults had ZION at 100%, all external streams disabled (0%)
- ch3_revenue_settings.json missing from Zion-2.9.5/config/
- Docker compose referenced non-existent testnet-specific config file
- Result: 100% ZION, 0% external revenue, 0% NCL = no BTC income

FIX (matches CH v3 spec documentation):
- config.rs: StreamConfig default target_share 1.0 Ôćĺ 0.50 (50% ZION)
- config.rs: StreamEtcConfig default enabled=true, target_share=0.05 (FREE byproduct)
- config.rs: StreamDynamicGpuConfig default enabled=true, mode=auto, target_share=0.20
- config.rs: StreamNclConfig default enabled=true, npu_allocation=0.30, target_share=0.25
- Added config/ch3_revenue_settings.json with full 50/25/25 model
- docker-compose.testnet.yml: mount ch3_revenue_settings.json (not _testnet variant)

ALLOCATION MODEL (50/25/25):
  50% Ôćĺ ZION CosmicHarmony mining
  25% Ôćĺ Multi-Algo external pools (ERG/RVN/XMR via 2miners/MoneroOcean Ôćĺ BTC)
  25% Ôćĺ NCL AI inference tasks
  FREE Ôćĺ ETC/Keccak + NXS/SHA3 as CosmicHarmony pipeline byproducts

All 258 tests pass (235 lib + 23 jsonrpc single-threaded + 28 pool).
```
</details>

---

### 32. `2f3d9fc` — refactor(revenue): remove BTC burn, 100% DAO treasury model

| | |
|---|---|
| **Hash** | `2f3d9fcfa39fa1f42703d6f8d7b8d28cbc593063` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-08 23:02:24 +0100 |

<details><summary>Details</summary>

```
BREAKING CHANGE: BTC revenue from external mining no longer burns.
All BTC revenue (100%) now goes to DAO Treasury address.
L1 fee burning (transaction fees destroyed) remains unchanged.

Changes:
- burn.rs: BURN_SHARE_PERCENT 50Ôćĺ0, new DAO_SHARE_PERCENT=100
- New DAO_ADDRESS: zion1dao...treasury
- calculate_revenue_split() returns (0, total) ÔÇö zero burn
- record_buyback() enforces btc_burn_sats=0, zion_burned_atomic=0
- BuybackStats: burn=0, creatorsÔćĺDAO aliases
- JSONRPC getBuybackStats: added dao_address, dao_share_percent fields
- 28 burn tests + stress tests updated for 100% DAO assertions
- CH3_REVENUE_ARCHITECTURE.md: new comprehensive doc
- ch3_revenue_settings.json: burn_pct=0, dao_pct=100
- pool/main.rs: comments updated
- miner/ncl: fixed pre-existing NCL allocation test (0.3Ôćĺ0.4)

534 tests pass, 0 failures.
```
</details>

---

## 2026-02-09

### 33. `0484e83` — fix(docker): correct --algoÔćĺ--algorithm flag and add /jsonrpc path to pool RPC URL

| | |
|---|---|
| **Hash** | `0484e8306c3cdd6747f44c72a04f6e5b6b63f767` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 00:31:17 +0100 |

<details><summary>Details</summary>

```
- Miner binary uses --algorithm, not --algo
- Pool needs full /jsonrpc path for JSON-RPC endpoint
- Both fixes verified on Helsinki and Singapore testnets
```
</details>

---

### 34. `a33e650` — feat(ch3): GPU auto-detect + CPU-only mode for Revenue stream

| | |
|---|---|
| **Hash** | `a33e6509dea6e1379fa5ec43849a7aee5242effd` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 01:17:14 +0100 |

<details><summary>Details</summary>

```
- profit_switcher: detect_gpu_available() checks nvidia-smi/rocm-smi/ZION_HAS_GPU
- CPU-only mode: Revenue 25% locked to XMR/RandomX, skip WhatToMine API
- main.rs: skip xmrig subprocess in cpu_only_mode (saves server resources)
- Miner handles RandomX natively via zion_core::algorithms::randomx
- Updated CH3_REVENUE_ARCHITECTURE.md with GPU/CPU mode diagrams
- Pool tests: 28/28 passed
```
</details>

---

### 35. `7da6b21` — feat(miner): GPU auto-detect + CPU-only mode for Revenue stream

| | |
|---|---|
| **Hash** | `7da6b2157dab56c1830e23919011f272c4580675` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 01:26:57 +0100 |

<details><summary>Details</summary>

```
- mod.rs: detect_gpu_available() checks Metal/CUDA/OpenCL/nvidia-smi/rocm-smi/ZION_HAS_GPU
- mod.rs: UniversalMiner.cpu_only_mode ÔÇö auto-set when no GPU found
- cpu.rs: mining loop replaces GPU-only algos (ethash/kawpow/autolykos) with RandomX
- stream_aware.rs: StreamState.cpu_only_mode + is_gpu_only_algo() filter
- main.rs: auto-detect GPU, updated banner with CH3 CPU/GPU info
- All GPU algos auto-redirected to XMR/RandomX on CPU-only servers
- Tests: 24/24 passed
```
</details>

---

### 36. `20da6f2` — fix: mining.notify format mismatch - Revenue XMR jobs now reach miner

| | |
|---|---|
| **Hash** | `20da6f2be04845b7462845dcaaadaffc1f385f56` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 02:34:04 +0100 |

<details><summary>Details</summary>

```
ROOT CAUSE: Two bugs prevented Revenue stream switching to RandomX:

1. Pool mining.notify params format mismatch:
   Pool sent: [job_id, blob, seed_hash, '', HEIGHT, difficulty, clean]
   Miner expected: [job_id, blob, target, height, ALGO, seed_hash, clean]
   params[4] was a number (height) but miner read it as algo string
   Ôćĺ as_str() failed on number Ôćĺ fallback to cosmic_harmony_v3

2. XMR config had algorithm='auto' which wasn't resolved:
   revenue_proxy passed 'auto' as algorithm instead of 'randomx'
   Ôćĺ miner Algorithm::from_str('auto') = None Ôćĺ fallback again

FIXES:
- pool/server_v2.rs: All 3 broadcast methods now send aligned format:
  [job_id, blob, TARGET, height, ALGO_STRING, seed_hash, clean]
- pool/revenue_proxy.rs: Filter 'auto'/'empty' Ôćĺ detect_algorithm()
  XMR Ôćĺ 'randomx', ERG Ôćĺ 'autolykos', etc.
- miner/stratum/mod.rs: Added info logging for incoming job algo
```
</details>

---

### 37. `313e357` — docs: GPU auto-detect & CPU-only mode deployment report (2026-02-09)

| | |
|---|---|
| **Hash** | `313e3579aa7c0e404761e4d723a2004342c94d32` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 03:06:28 +0100 |

<details><summary>Details</summary>

```
- 12 files changed across pool + miner (+392/-69 lines)
- Auto GPU detection: Metal/CUDA/OpenCL/nvidia-smi/rocm-smi
- CPU-only mode: skip xmrig, lock XMR/RandomX, native hashing
- Fixed mining.notify format mismatch (commit 20da6f2)
- Deployed & verified on 3 Hetzner servers (Helsinki/USA/Singapore)
- All servers confirmed XMR Revenue switching via RandomX
- 47 GB Docker images cleaned across servers
```
</details>

---

### 38. `d6a0265` — docs: add QUICK_START.md ÔÇö run a ZION node in 10 minutes

| | |
|---|---|
| **Hash** | `d6a026591af0e81bcd787d311477346ee249846a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 03:33:13 +0100 |

<details><summary>Details</summary>

```
- Docker option: 5 min setup with docker-compose
- Source build option: 15 min with cargo
- Network info, seed nodes, chain parameters
- Troubleshooting section
- Sprint 1.10 deliverable
```
</details>

---

### 39. `12efed5` — fix(miner): critical reconnect + stale share bugs

| | |
|---|---|
| **Hash** | `12efed552a4ad6b7f9f4e715a73df4ddf2d2ce74` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 11:03:31 +0100 |

<details><summary>Details</summary>

```
Bug 1: Connection monitor now checks cpu/gpu alive flags.
Previously, when submit loop died (3 consecutive errors), it set
connection_alive=false but the connection monitor only checked
stratum.is_connected() ÔÇö causing 7h+ dead mining with no reconnect.

Bug 2: Submit loop now drops stale shares from old jobs.
After job switch, pending shares from the old job_id were submitted
and rejected ('Does not meet target difficulty'), triggering the
3-strike rule and killing the submit loop again after reconnect.

Combined effect: miners had ~5 min effective mining in 8 hours.
```
</details>

---

### 40. `e27a65e` — Add full project: website, desktop-agent, docs, history, mobile-app, scripts, pool changes

| | |
|---|---|
| **Hash** | `e27a65e3e30f70c95fc58762042c337cf11fa895` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 13:17:47 +0100 |

<details><summary>Details</summary>

```
Includes:
- website-v2.9/ (Next.js explorer & presale site)
- desktop-agent/ (Electron mining app - source only, no node_modules/dist)
- 2.9-History/ (project history & external libs)
- 2.9.5OLD/ (v2.9.5 backup)
- public_html/ (static web files)
- mobile-app/ (React Native app)
- docs/ (whitepaper, technical docs)
- scripts/ (deployment scripts)
- pool/ source updates (main.rs, server_v2.rs)

Excluded (rebuildable):
- node_modules/ (npm install)
- .next/ (npm run build)
- desktop-agent/dist/ (npm run dist)
- website-v2.9/public/downloads/ (release binaries -> GitHub Releases)
```
</details>

---

### 41. `829fb33` — chore: sync new root workspace ÔÇö cleanup secrets, locks & build artifacts

| | |
|---|---|
| **Hash** | `829fb3339360e4ce6c5844f459b01eed342a4cc6` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 13:52:42 +0100 |

<details><summary>Details</summary>

```
- Updated .gitignore with comprehensive rules (keys, caches, build artifacts)
- Removed tracked Cargo.lock files (should be gitignored for workspace)
- Removed accidentally committed secrets (ai.key, git.key)
- Removed .coverage and .tmp files
- Removed git submodule references (external/blake3, randomx, etc.)

Contributor: JahRasta145
```
</details>

---

### 42. `e5c4af4` — docs: add comprehensive status report + premine & economic model updates

| | |
|---|---|
| **Hash** | `e5c4af4ee5020ca47300e3a399f474598b08cc16` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 14:40:44 +0100 |

<details><summary>Details</summary>

```
Status Report (2026-02-09):
- Full deep analysis: 46.7k LOC Rust, 36k LOC JS/TS, 5718 files
- 512 tests passing, 0 failures across all 4 crates
- Live testnet: 3 nodes synced at height 983 (Helsinki/USA/Singapore)
- Overall mainnet readiness: 83%
- Identified 5 critical blockers, 12 medium, 7 low priority issues

Economic model updates:
- Revenue model: 100% DAO treasury (no BTC burn)
- Updated burn.rs, premine.rs, genesis verification tests
- Constitution & whitepaper alignment with current model
- Premine wallet generator utility added
- Config alignment across mainnet/testnet/devnet
```
</details>

---

### 43. `0b4d2d7` — docs: add unified ROADMAP.md ÔÇö master plan L1ÔćĺL4, mainnet 31.12.2026

| | |
|---|---|
| **Hash** | `0b4d2d73dc0fbd31175de8de5ef6b5e8b32ab9b6` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 14:51:18 +0100 |

<details><summary>Details</summary>

```
Synthesized from 5+ planning documents into single authoritative roadmap:
- Current status: 512 tests, 83% mainnet-ready, 3 servers live
- Phase 0 (Spec Freeze): DONE ÔÇö 155 tests, genesis+reward+DAA+wallet
- Phase 1 (Hardened TestNet): 90% done ÔÇö 420 tests, sprints 1.0-1.9
- Phase 2-4: Node UX, Infrastructure, Dress Rehearsal (Jun-Nov 2026)
- Phase 5: MainNet Launch 31.12.2026
- Phase 6: Post-launch exchange strategy (2027)
- L2 DEX/DeFi, L3 AI/Warp, L4 Oasis (2027-2028)
- Constitution parameters locked, premine allocation documented
- Priority todo list and security checklist included
```
</details>

---

### 44. `072360b` — feat: BTC+XMR revenue tracker (buyback.rs), miner native libs, desktop-agent bundling, explorer Pro UI

| | |
|---|---|
| **Hash** | `072360b6c5e2efdede6b1a4f5c6008cebb9921b5` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 15:25:06 +0100 |

<details><summary>Details</summary>

```
- buyback.rs: unified BTC+XMR tracking (2miners + MoneroOcean), ERG pool added
- miner/Cargo.toml: added [features] section (12 native algos + gpu/metal/cuda)
- native_algos.rs: fixed mutability bug (let -> let mut)
- desktop-agent: native-libs bundling + DYLD/LD_LIBRARY_PATH for miner spawn
- native-libs symlink -> 2.9.5OLD/native-libs/
- explorer: Pro UI (NetworkTicker, ProSearchBar, ProRecentBlocks/Txs, ProExplorerStats)
- BlockDetailClient: redesigned with modern dark glassmorphism theme
- reports moved to docs/reports/
- ncl_integration: consciousness levels disabled (all multipliers = 1.0)
- deleted duplicate external.rs (merged into buyback.rs)
- all 512 tests passing, 0 failures
```
</details>

---

### 45. `cdfdd19` — feat: stratum subscribe validation + keepalive + mock server + explorer redesign

| | |
|---|---|
| **Hash** | `cdfdd193b84da8e777c364fb694bdb7ac200a100` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 16:00:13 +0100 |

---

### 46. `567a464` — fix: useRef initial value for React 19 compatibility (TransactionsPageClient)

| | |
|---|---|
| **Hash** | `567a4640ce755609d4dfb3f5dfa8f12091fcc26e` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 16:01:45 +0100 |

---

### 47. `451fc51` — fix(critical): LWMA DAA, deterministic golden_matrix, GPU alignment, Docker hardening

| | |
|---|---|
| **Hash** | `451fc512712fa1e7c0ab417a1952bd750d8aab4e` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-09 16:35:27 +0100 |

<details><summary>Details</summary>

```
BUG1 - LWMA now active: state/mod.rs uses 60-block window via lwma_next_difficulty()
  instead of single-block calculate_next_difficulty() fallback

BUG2 - Deterministic mining: engine.rs switched from f64 golden_matrix() to
  fixed-point u128 golden_matrix_opt() + cosmic_fusion_opt() for cross-platform
  hash consistency (critical for consensus)

BUG3 - GPU/CPU alignment: OpenCL PHI_POWERS constants replaced with exact
  decimal values matching Rust PHI_POWERS_FP. golden_matrix kernel rewritten
  to match algorithms_opt.rs fixed-point arithmetic

Docker mainnet: ports fixed 8333/8443 (was 8334/8444), health checks added,
  Redis auth enabled, revenue config mounted
Docker testnet: ZION_DEV_MODE=1 removed (bypassed difficulty validation),
  health checks + Redis auth added, service dependency ordering

All 273 tests passing (211 core lib + 21 integration + 41 cosmic-harmony)
```
</details>

---

### 48. `dcbd45b` — fix(security+consensus): 8 kritickych oprav pro MainNet v2.9.5

| | |
|---|---|
| **Hash** | `dcbd45b1143f3f9b5c1a39928b30b22c619b83bf` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-09 17:17:50 +0100 |

<details><summary>Details</summary>

```
Opravy #1-#9 z bezpecnostniho auditu (Fix #5 UTXO undo log odlozen):

[Fix #1] CHv3: sjednoceni hashovani ÔÇö algorithms.rs deleguje na algorithms_opt
  - golden_matrix() a cosmic_fusion() ted pouzivaji fixed-point verze
  - engine.rs pouziva vyhradne _opt funkce (keccak256_opt, sha3_512_opt, ...)
  - Eliminovany nedeterministicke f64 operace

[Fix #2] DEV_MODE: zabezpeceni proti obejiti konsenzu
  - ZION_DEV_MODE chraneny #[cfg(debug_assertions)]
  - V release buildech je dev_mode VZDY false
  - Zahrnuto: validation.rs, jsonrpc/mod.rs (dev.set_difficulty, dev.credit_balance)

[Fix #4] Premine: validacni testy
  - test_all_premine_addresses_valid_format (vsechny adresy 44 znaku, zion1 prefix)
  - test_no_duplicate_premine_addresses

[Fix #6] Pool: oprava kompilace na Windows
  - tokio::signal::unix zabaleny v #[cfg(unix)] / #[cfg(not(unix))]
  - Windows pouziva pouze ctrl_c()

[Fix #7] Adresy: 4-znakovy SHA-256 checksum
  - Format: zion1 (5) + body (35) + checksum (4) = 44 znaku
  - compute_address_checksum() z SHA-256('zion1' + body)
  - is_valid_zion1_address() overuje checksum
  - is_valid_zion1_address_format() pro zpetnou kompatibilitu
  - Testy v wallet/mod.rs a wallet/batch.rs aktualizovany

[Fix #8] RPC: Bearer token autentizace
  - Novy core/src/rpc/auth.rs ÔÇö middleware pro Axum
  - ZION_RPC_TOKEN env var; bez tokenu = otevreny pristup
  - Constant-time porovnani proti timing utokum
  - Chranene: submit_block, submit_tx, jsonrpc
  - Verejne: stats, bloky, health, premine, sync

[Fix #9] Kriticke testy (+25 novych testu)
  - cosmic-harmony: 4 cross-impl testy (golden_matrix, cosmic_fusion, pipeline, determinismus)
  - core/crypto/keys: 12 testu (checksum round-trip 256 klicu, mutace, truncation, hex)
  - pool/pplns: 9 testu + compute_pplns_payouts() pure funkce (bez Redis)

[Docker] Dockerfile.core a Dockerfile.pool: pridany curl pro healthcheck

Celkem testu: 352 (45 cosmic-harmony, 248 core, 35 pool, 24 miner)
Vsechny prochazi (jsonrpc vyzaduje --test-threads=1 kvuli LMDB, pre-existing)
```
</details>

---

### 49. `c9621d6` — feat(storage): UTXO undo log pro bezpecne reorgy blockchainu (Fix #5)

| | |
|---|---|
| **Hash** | `c9621d6ca638f1b3496fcb7ef07d4cf8d8ed2cf5` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-09 17:29:37 +0100 |

<details><summary>Details</summary>

```
- Nova LMDB databaze 'undo_blocks': vyska bloku -> BlockUndoData
- BlockUndoData uklada vsechny UTXO spotrebovane pri aplikaci bloku
- apply_block_utxos() nyni atomicky uklada undo data spolu s UTXO zmenami
- rollback_block_utxos() pouziva undo log pro okamzite obnoveni UTXO
  (zadne traversovani blockchainu, zadne rekonstrukce z tx_to_block)
- Fallback na legacy metodu pro bloky aplikovane pred undo logem
- get_undo_data() a prune_undo_data() pro spravne cisteni starych zaznamu
- delete_block_at_height() cisti i undo zaznamy
- 10 novych testu: apply/rollback/multi-block-chain/prune/idempotence
```
</details>

---

### 50. `d1bbb52` — docs: denni report 9.2.2026 ÔÇö 9 kritickych oprav, 363 testu, UTXO undo log

| | |
|---|---|
| **Hash** | `d1bbb525122e78c1be98a851387e224ac551fa12` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-09 17:35:24 +0100 |

---

### 51. `61244ef` — docs: session report 9.2.2026 ÔÇö 10 bug fixes, deploy status, roadmap tracking

| | |
|---|---|
| **Hash** | `61244ef51c0a29809cb3853d96e2d8ab42b38539` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-09 17:35:30 +0100 |

---

### 52. `8ceef1f` — feat(explorer): upgrade Charts & Emission to Pro design, remove legacy components

| | |
|---|---|
| **Hash** | `8ceef1f4481145d048b093675b4021e99b8e869a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 18:02:12 +0100 |

<details><summary>Details</summary>

```
- ExplorerCharts: rounded-[28px] card, cleaner pill selectors, gradient SVG fill, summary bar with Min/Avg/Max
- EmissionMonitor: Pro card layout, icon headers, consciousness level styling with individual icons
- Removed unused legacy: ExplorerStats, RecentBlocks, RecentTransactions, SearchBar (replaced by Pro versions)
```
</details>

---

### 53. `74f9b91` — desktop-agent: plug-and-play onboarding + security hardening

| | |
|---|---|
| **Hash** | `74f9b9105bb4b6050a4e628259aeb5b73de761d5` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 18:16:59 +0100 |

<details><summary>Details</summary>

```
- First-run wizard: 3-step overlay (welcome Ôćĺ password Ôćĺ wallet created)
  - Auto wallet generation via quick-setup IPC
  - Recovery phrase shown once, then encrypted
  - One-click Start Mining after setup
- Mnemonic encryption: save-wallet + import-wallet now encrypt
  mnemonic with password (was plaintext, version bumped to 2.9.1)
- TX confirmation: dialog.showMessageBox before sendtransaction
- Block-found OS notifications: Electron Notification API
- Fixed CSS nesting bug: .web29-chip missing closing brace
- Removed duplicate uncaughtException handler (line 515)
- Removed unused rotateFileIfLarge (superseded by rotateFileIfTooLarge)
- Added preload bridge: isFirstRun(), quickSetup()
```
</details>

---

### 54. `733f92c` — fix: dashboard hashrate display + GPU stats tracking

| | |
|---|---|
| **Hash** | `733f92ce01c4acf054115b486bba241b748caeef` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 19:00:02 +0100 |

<details><summary>Details</summary>

```
- parseMinerOutput: fix regex for combined status line (Hashrate: | X kH/s)
- parseMinerOutput: add GPU hashrate parser ([GPU]: X MH/s)
- parseMinerOutput: add CPU batch parser (Batch done: X kH/s)
- parseMinerOutput: add GPU share ACCEPTED/REJECTED parser
- parseMinerOutput: composite hashrate from GPU+CPU when no combined line
- stderr: call parseMinerOutput on stderr too (GPU logs go to stderr)
- stats.rs: track GPU hashes separately (add_gpu_hashes, hashrate_gpu/cpu)
- mod.rs: stats_file now reports real hashrate_gpu instead of hardcoded 0.0
- mod.rs: GPU uses add_gpu_hashes instead of add_hashes
- metal_miner: increase threads_per_threadgroup to pipeline max (was capped 384)
- mod.rs: increase GPU batch_size to 1M (from 500k) for better throughput
```
</details>

---

### 55. `d3be15e` — fix: GPU share flooding ÔÇö VarDiff + difficulty pipeline

| | |
|---|---|
| **Hash** | `d3be15e34e7d08472dee18a3bcaf5f33c8763c7c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 19:07:25 +0100 |

<details><summary>Details</summary>

```
Root cause: GPU at 2.55 MH/s with pool diff=1000 finds ~2500 shares/s,
flooding the pool and causing submit timeouts (half shares lost).

Pool fixes:
- Raise default difficulty 1000 Ôćĺ 500000 (GPU finds ~5 shares/s initially)
- VarDiff retarget window 90s Ôćĺ 30s for faster adaptation
- VarDiff min_difficulty 1 Ôćĺ 1000 (sanity floor)
- VarDiff variance 0.30 Ôćĺ 0.25 (tighter targeting)
- After VarDiff retarget, push mining.notify with updated target
  immediately (both Stratum and XMRig handlers)

Miner fixes:
- mining.set_difficulty: apply new target to current job immediately
  instead of just logging it (was debug-only, completely ignored)
- Converts pool difficulty to u32 target hex and updates job via watch

VarDiff convergence: at 2.55 MH/s, pool will retarget from 500k Ôćĺ ~2.5M
Ôćĺ ~12M Ôćĺ ~38M over ~90s, settling at ~1 share/15s (target_share_time).
```
</details>

---

### 56. `36fd224` — docs: update REPORT.md ÔÇö DE server, website v2.9 explorer, dashboard, 72h stability run

| | |
|---|---|
| **Hash** | `36fd2246079e7b6e9729e7fafe884d617dd06e7e` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 20:23:25 +0100 |

<details><summary>Details</summary>

```
- Server topology: Singapore+USA removed (2GB OOM), Germany (195.201.31.201) added
- Website v2.9 deployed: Next.js 16, block explorer, all routes 200 OK
- zion-rpc.ts rewritten: Monero-style Ôćĺ ZION REST/JSON-RPC API
- Mission Control Dashboard: 8 tabs, live pool metrics, auto-refresh
- Sprint 1.10: 72h stability run started (2 nodes synced at height 1221)
- Updated infrastructure table, TODO priorities, exit criteria
```
</details>

---

### 57. `1dbc79d` — feat(web): complete website v2.9 update ÔÇö remove SG/USA, add Germany, fix all links

| | |
|---|---|
| **Hash** | `1dbc79d2abdb84798c4e27dc39dae2c4afc42c0a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 20:30:35 +0100 |

<details><summary>Details</summary>

```
- network/page.tsx: remove Singapore/USA IPs, update to Helsinki+Frankfurt (2 nodes)
- Hero.tsx: update validator count (2/2), MainNet date Q4 2026
- Footer.tsx: fix GitHub URL, /genesisÔćĺ/explorer
- WarpCorridors.tsx: realistic values (Planned/Research status, phase targets)
- Features.tsx: timeline Phase 8 Ôćĺ Q4 2026
- Navigation.tsx: remove dead links (/genesis, /ai-native, /roadmap-295, /api-reference)
- DocsRail.tsx: /sdkÔćĺ/download, /daoÔćĺ/explorer
- RoadmapPulse.tsx: /reportsÔćĺ/explorer, MainNet Q4 2026
- SystemHealth.tsx: fallback version v2.8.9Ôćĺv2.9.5
- MiningClient.tsx: update git clone URL to Zion-2.9.5
- DashboardClient.tsx: 3 continentsÔćĺ2 EU regions
- Mining metadata: Quantum LeapÔćĺNative Awakening
- Docs + API-reference: GitHub URL fix
```
</details>

---

### 58. `b7a79a7` — website deep audit: fix fake data, unify MainNetÔćĺ2026, v2.9.1Ôćĺv2.9.5

| | |
|---|---|
| **Hash** | `b7a79a7947081cd401450d7760c15196e4aa2eb0` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 20:47:07 +0100 |

<details><summary>Details</summary>

```
- warp/page.tsx: replace fake liquidity/uptime/bridge stats with honest planned status
- download/page.tsx: 14├Ś v2.9.1 Ôćĺ v2.9.5 (builds + desktopAgentBuilds)
- api-reference/page.tsx: fake 99.95% uptime/52ms/1.8M Ôćĺ real TestNet stats
- DashboardClient.tsx: 3 global pools EU/US/ASIA Ôćĺ 2 EU pools Helsinki/Frankfurt
- RoadmapPulse.tsx: MainNet 2027 Ôćĺ 2026
- dao/page.tsx: Phase 3 Full DAO 2027+ Ôćĺ 2026+
- roadmap/page.tsx: timeline text 2027 Ôćĺ 2026
- Zero '2027' references remaining in src/
```
</details>

---

### 59. `cde03ff` — roadmap: complete rewrite matching ROADMAP.md

| | |
|---|---|
| **Hash** | `cde03ffed6f8bba7e1154bdc2517d0596bd4ae7c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 21:03:35 +0100 |

<details><summary>Details</summary>

```
- Layer Architecture (L1ÔÇôL4) with visual cards
- Component Status table (7 crates, LOC, tests, readiness bars)
- All 6 L1 Phases (0ÔÇô5) with sprints, progress, exit criteria
- MainNet Constitution (14 locked parameters)
- Genesis Premine allocation (4 categories with progress bars)
- Post-Launch strategy (6AÔÇô6D: SilentÔćĺDEXÔćĺCMCÔćĺCEX)
- Security Checklist (8/12 done)
- Master Timeline visualization (2026ÔÇô2028)
- Tailwind v4 class names (bg-linear, rounded-4xl)
```
</details>

---

### 60. `57509ef` — homepage: fix fake data across all 5 components

| | |
|---|---|
| **Hash** | `57509ef377f22359a36f8004f4348e921a81543a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 21:13:21 +0100 |

<details><summary>Details</summary>

```
- Hero: ML+WARP 100% Ôćĺ real L1 Core 80%, 46690 LOC, 512 tests
- Features: remove AI Warp Engine, 548k H/s, 11 lanes, Sacred 7
  Ôćĺ real Cosmic Harmony PoW, P2P Network, Block Explorer
- Features: Phase 6-8 Ôćĺ F├íze 1-5 matching ROADMAP.md
- LiveDashboard: remove Sacred/Matrix/Cyber lattice text
- DocsRail: Roadmap v3 Ôćĺ MainNet 2026, remove ritual language
- RoadmapPulse: Trail of Bits Ôćĺ external firm TBD
```
</details>

---

### 61. `5b9e903` — nav: restore Genesis + API Reference to Knowledge menu

| | |
|---|---|
| **Hash** | `5b9e90318cd9312d85d927bdd08f719a8e7aaa6c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 21:16:27 +0100 |

---

### 62. `63d0a0b` — explorer: fix double .json() bug in 4 components

| | |
|---|---|
| **Hash** | `63d0a0b3a9822aa3428b1a0c3d5edd1f9b578b5b` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 21:21:21 +0100 |

<details><summary>Details</summary>

```
apiClient() already returns parsed JSON, but ProExplorerStats,
NetworkTicker, ProRecentBlocks, ProRecentTransactions all called
res.json() again Ôćĺ TypeError Ôćĺ 'Unable to connect to ZION network'.

Also fix ExplorerDashboard: stats.connections Ôćĺ stats.total_connections
to match API response field name.
```
</details>

---

### 63. `1b4a318` — fix: wrap leaflet dynamic imports in try/catch on /network page

| | |
|---|---|
| **Hash** | `1b4a318bc94d0bd0c44e24eeba23e279c79f8557` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 21:28:25 +0100 |

<details><summary>Details</summary>

```
Leaflet's dynamic import() could throw in Docker standalone builds,
crashing the entire /network page with 'client-side exception'.
Now gracefully falls back with console.warn instead of killing the page.
```
</details>

---

### 64. `3fca91a` — ­čÄĘ Explorer & Network redesign (Roadmap style) + PoolFinder crash fix

| | |
|---|---|
| **Hash** | `3fca91ad06287cf8006151b3c04d26fc17b2afef` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 21:53:46 +0100 |

<details><summary>Details</summary>

```
- Explorer page: complete visual overhaul matching Roadmap design language
  - Removed CyberGrid/FloatingBubbles backgrounds
  - Added subtle gradient glows, badge pills, section headers
  - motion.section animations with staggered delays
  - Consistent rounded-4xl, bg-black/60 backdrop-blur-xl cards
  - CTA section with gradient border + footer

- Network page: complete visual overhaul matching Roadmap design language
  - Removed InteractiveEarthBackground (leaflet crash fix)
  - Infrastructure seed node cards, connection guides
  - Network readiness checklist with progress bar
  - New layout.tsx for metadata (page.tsx is client)

- PoolFinder: null safety for recommended pool
  - Made recommended optional in BestPoolResponse
  - Added conditional rendering + pools length guard
  - Fixed Tailwind v4: rounded-4xl, bg-linear-to-r

- best-pool API: fixed POOLS[2] index out of bounds
  - Changed to allPools[0] with null fallback

- ExplorerDashboard: replaced fake Consciousness Rewards
  with real Block Reward data (5400 ZION, no halving)
```
</details>

---

### 65. `9efd95f` — ­čôŐ 72h Stability Run: dashboard, monitor, report

| | |
|---|---|
| **Hash** | `9efd95fc6f0251dad8d970f62eb3079f1f702ac8` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 22:00:27 +0100 |

<details><summary>Details</summary>

```
- scripts/stability_monitor.sh: 72h stability monitor (5min interval)
- scripts/collect_stats.sh: JSON stats collector for dashboard
- scripts/dashboard.html: Live monitoring dashboard v1
- scripts/dashboard_v2.html: Mission Control dashboard v2 (8 tabs)
- docs/2.9.5/REPORT_2026-02-09.md: Daily report update (premine + DAA fix)
```
</details>

---

### 66. `16b420c` — ÔÜí Mission Control Dashboard: 8-tab live dashboard (Roadmap, Layers, Constitution, Economy, Security, Timeline, Priority) integrated into Next.js ÔÇö fetches from /api/dashboard/data proxy Ôćĺ data.json

| | |
|---|---|
| **Hash** | `16b420c53888e7a869c2ed11f15a09690ef7e38e` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 22:18:49 +0100 |

---

### 67. `6b1fdc8` — ­čöž Fix: rename API route /api/dashboard/data Ôćĺ /api/mission-data/data (nginx /api/dashboard/ conflict)

| | |
|---|---|
| **Hash** | `6b1fdc8d2ec5a0083e3ad7925eaab4b18d0b12ec` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 22:23:46 +0100 |

---

### 68. `a01f2f3` — ­čÄĘ Mission Control: redesign to Roadmap style + fix nav overlap

| | |
|---|---|
| **Hash** | `a01f2f311d5c0e1a630732a4ffbfc6862bd82377` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 22:43:20 +0100 |

<details><summary>Details</summary>

```
- Removed sticky tab bar hidden behind main navigation
- Added hero section with glassmorphism cards (matching roadmap/page.tsx)
- pt-32 page padding so content sits below main nav
- Tab navigation as inline rounded card (not sticky)
- All sections use rounded-4xl, border-white/10, bg-black/40
- Section headers with subtitle tracking + lucide icons
- motion.section with staggered delays
- Server cards, pool cards use rounded-3xl with backdrop-blur
- Phase accordions match roadmap phase design language
- Constitution tab uses gold gradient border (same as roadmap)
- Timeline tab with Gantt-style chart
- All 8 tabs fully preserved with live data
```
</details>

---

### 69. `cda398b` — fix: rename Singapore Ôćĺ Germany (DE) in Mission Control dashboard

| | |
|---|---|
| **Hash** | `cda398be48d5ffb218cb68f22ad5039608c37342` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 23:02:10 +0100 |

<details><summary>Details</summary>

```
- Updated DashData interface: singapore Ôćĺ germany
- Changed ServerCard: ­čçŞ­čçČ Singapore (5.223.56.124/2GB) Ôćĺ ­čçę­čç¬ Germany (195.201.31.201/8GB)
- Changed PoolSection props: singapore Ôćĺ germany
- Fixed collect_stats.sh on Helsinki server (cron was still using old script)
- DE node healthy: height 1420, 2 peers, testnet
```
</details>

---

### 70. `08c252d` — style: replace all emoji with Lucide icons in Mission Control

| | |
|---|---|
| **Hash** | `08c252d0f6832315bca710adc9daa2ebe458c99f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 23:14:43 +0100 |

<details><summary>Details</summary>

```
- Tabs: emoji labels Ôćĺ Lucide icon + text (Monitor, Target, Layers, etc.)
- ServerCard/PoolNodeCard: ÔŚĆ/ÔÜá/Ôťľ Ôćĺ CircleDot/AlertTriangle/XCircle components
- PhaseAccordion: emoji icons Ôćĺ Lucide (CheckCircle2, RefreshCw, Monitor, Globe, Target, Rocket)
- SprintRow: Ôťů/ÔĆ│/ÔČť Ôćĺ CheckCircle2/Timer/Square icons
- Layers: ­čÄ«­čžá­čĺ▒ÔŤô´ŞĆ Ôćĺ Gamepad2/Brain/ArrowLeftRight/Link + ­čôů Ôćĺ CalendarDays
- Constitution premine: ÔŤĆ´ŞĆ´┐Ż´┐Ż´ŞĆ­čöž­čĺÜ Ôćĺ Pickaxe/Database/Wrench/Heart
- Economy: revenue flow + fund boxes Ôćĺ inline icon components
- Burn section: ­čöą emoji Ôćĺ Flame icon
- Timeline: headers + phase names cleaned
- Priority: ÔĆ│/ÔČť Ôćĺ text-based status
- Kept flag emoji (­čçź­čç«/­čçę­čç¬) as they represent country flags
- Added 13 new Lucide imports
```
</details>

---

### 71. `5be2921` — fix: pool accept loop deadlock + NCL stubs + agent server list

| | |
|---|---|
| **Hash** | `5be29219cdaceeae2742514f9f30afec414e34b8` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 23:15:05 +0100 |

<details><summary>Details</summary>

```
Pool:
- Add NCL stub handlers (ncl.register, ncl.get_task, ncl.submit, ncl.status)
  that return graceful 'not available' response instead of Unknown method error.
  This prevents ERROR log spam every 10s from internal miner, which was
  contributing to Tokio thread starvation and accept loop deadlock.
- Root cause: 54 connections stuck in CLOSE_WAIT, accept queue full (0x36),
  pool stopped accepting new TCP connections entirely.

Desktop-agent:
- Update TESTNET_SERVERS: remove offline USA/Singapore, add Germany (DE)
```
</details>

---

### 72. `ca22358` — nav: Network/Explorer/Dashboard icon-only buttons, integrate Tree of Life into DAO page, remove dead files

| | |
|---|---|
| **Hash** | `ca22358aae9de6a27614bd54f1a5bdbc20df9f27` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 23:38:11 +0100 |

---

### 73. `4941769` — fix: eliminate RwLock deadlock in pool accept loop

| | |
|---|---|
| **Hash** | `4941769c227b720d6b04966dbdaee2c5bc9bd4c9` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 23:39:57 +0100 |

<details><summary>Details</summary>

```
Root cause: broadcast_new_job, connection_cleaner, and broadcast_scheduled_job
held connections read lock across async iteration. When connection_cleaner
requested write lock, Tokio's write-preferring RwLock starved all new read
lock attempts, including the accept loop's connection count check.

Fix:
- Add AtomicUsize connection_count for lock-free accept loop
- Clone connections Vec outside read lock scope in all broadcast fns
- Release read lock before iterating in connection_cleaner
- Use atomic inc/dec in handle_connection register/cleanup
```
</details>

---

### 74. `1871174` — SEO: sitemap, robots, OG image, per-page metadata, custom 404, loading, expanded footer

| | |
|---|---|
| **Hash** | `18711745acff40773593735a5d4c000ea4362793` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 23:46:26 +0100 |

---

### 75. `6356f31` — fix: explorer NetworkTicker no longer hidden behind navigation

| | |
|---|---|
| **Hash** | `6356f31af91612111ce3d255ef16b6d2ea9d2383` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-09 23:52:21 +0100 |

---

## 2026-02-10

### 76. `4688b6e` — fix: VarDiff deadlock - drop write lock before send_json read lock

| | |
|---|---|
| **Hash** | `4688b6e7a65094d937f25fe80463e12e40392528` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 00:00:29 +0100 |

<details><summary>Details</summary>

```
send_json() acquires connection.read() but was being called inside
a block holding connection.write(). Tokio RwLock does not support
re-entrancy so this caused a deadlock whenever VarDiff triggered
a retarget (typically after ~90s of mining).

Fix: extract new_diff and protocol from the write lock scope,
drop the lock, THEN send VarDiff notifications via send_json().
This eliminates the writeÔćĺread deadlock.
```
</details>

---

### 77. `91ef7e7` — responsive: mobile-friendly ticker grid, hero padding/titles, dashboard tabs, footer grid

| | |
|---|---|
| **Hash** | `91ef7e7cae039cf36c714a3b6859a7c2fa0ea1a1` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 00:07:01 +0100 |

<details><summary>Details</summary>

```
- NetworkTicker: horizontal scroll replaced with 2-col/4-col stat card grid
- All pages: hero sections p-6 md:p-10, rounded-3xl md:rounded-4xl
- Titles: text-3xl sm:text-5xl md:text-6xl responsive scaling
- Explorer/Network: overflow-x-hidden to prevent glow horizontal scroll
- Genesis: title text-4xl sm:text-6xl md:text-7xl
- AI-Native/Philosophy: responsive icons w-8 sm:w-12, flex-wrap
- MissionControlDashboard: grid-cols-2 sm:grid-cols-3, icon-only tabs on mobile
- Footer: sm:grid-cols-2 lg:grid-cols-5 breakpoints
- Download: responsive title text-3xl sm:text-5xl
```
</details>

---

### 78. `ff8cc96` — docs: session report 10.2.2026 ÔÇö 3 pool deadlock fixes, fork resolution, infra cleanup

| | |
|---|---|
| **Hash** | `ff8cc96a72e44b8d1a70dc85b3b8a30bccc602b6` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 00:37:59 +0100 |

<details><summary>Details</summary>

```
- 13 commits today: 3 critical pool fixes, website/SEO, Mission Control
- Pool BUG 1: NCL stubs + accept loop fix
- Pool BUG 2: RwLock deadlock in broadcasts/cleaner
- Pool BUG 3: VarDiff deadlock (writeÔćĺread lock)
- Germany fork resolved (chain reset + IBD resync)
- Pool RPC port fix (8334Ôćĺ8444), Redis auth added
- Docker images pruned (9.6 GB reclaimed)
- Both servers synced at height ~1500, mining stable
```
</details>

---

### 79. `f59e649` — docs: update REPORT.md ÔÇö SEO, responsive, UI, Tree of Life, stability run ~39%

| | |
|---|---|
| **Hash** | `f59e64958d37bc55491f0050b27b73d6d122454c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 00:40:22 +0100 |

---

### 80. `0614770` — fix: P0/P1 ÔÇö hashrate calc, dev-tools feature flag, balance cache, batch block headers, Germany stats

| | |
|---|---|
| **Hash** | `0614770868ce16487e74fcb45dd2740f1b8ab91c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 00:56:40 +0100 |

<details><summary>Details</summary>

```
P0.2: Remove 2^32 multiplier from pool difficulty_to_hashrate()
P0.3: Gate credit_balance/set_difficulty behind #[cfg(feature = "dev-tools")]
P1.4: Add balance_cache LMDB database for O(1) balance lookups
P1.5: Add get_block_headers_range JSON-RPC + REST /api/blocks/range/:start/:end
P1.6: Replace Singapore with Germany (195.201.31.201) in collect_stats.sh + dashboard
      Add STATUS field (RUN/ISSUE/DOWN/COMPLETE) to data.json
```
</details>

---

### 81. `80710b1` — fix(desktop-agent): 17 bugs - RPC 8545->8444, pool defaults, version sync, auto-select

| | |
|---|---|
| **Hash** | `80710b1317d66aa8981c601cce25ca0551e6e8f1` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 00:59:32 +0100 |

<details><summary>Details</summary>

```
Critical fixes:
- RPC port 8545 (Ethereum) to 8444 (ZION) in getAllServersStatus
- Default pool.host: pool.zionterranova.com to 77.42.31.72 (Helsinki)
- Default rpcUrl: localhost:8444 to 77.42.31.72:8444 (testnet server)
- Config migration: auto-fix stale pool.zionterranova.com hosts

Version sync:
- Window title, tray label, tray tooltip: v2.9 to v2.9.5
- main.js, preload.js, renderer.js header comments: v2.9 to v2.9.5
- Wallet format version: 2.9.1 to 2.9.5 (all 3 creation paths)

New feature:
- autoSelectBestPool: measures latency to all TESTNET_SERVERS,
  picks lowest-latency online pool, updates config automatically
- IPC handler auto-select-pool exposed via preload
- Renderer listens for config-updated to refresh UI after auto-select
- Respects custom pools (only auto-switches between known servers)
```
</details>

---

### 82. `3588be5` — ÔÜí XMRig-style professional miner metrics engine

| | |
|---|---|
| **Hash** | `3588be5ddcf1a9523897ac24fb2b7bed6c3d1456` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 01:11:38 +0100 |

<details><summary>Details</summary>

```
stats.rs: Complete rewrite with rolling hashrate windows (10s/60s/15m),
per-thread snapshots, difficulty/pool metadata tracking, and colorful
XMRig-style terminal output:
  - speed line every 5s: 'speed 10s/60s/15m X.XX Y.YY Z.ZZ kH/s max W.WW'
  - accepted/rejected share notifications with diff + latency
  - new job notifications with height + diff + algo
  - block found celebration box
  - full status panel every 60s (hashrate/shares/diff/uptime/threads)
  - enriched JSON payload for Desktop Agent (20+ fields)

mod.rs: Write lock for mutable print(), inject config/GPU metadata,
new job notifications, connection tracking, stats.to_json() for file.

cpu.rs: XMRig-style share accept/reject notifications.

desktop-agent: New parsers for XMRig-style stdout format + enriched
stats file reader (hashrate_10s/60s/15m, difficulty, blocks, threads,
pool_latency, best_share_diff, thread_snapshots). Legacy backward compat.
```
</details>

---

### 83. `930e698` — ­čÄĘ XMRig-style professional dashboard UI

| | |
|---|---|
| **Hash** | `930e6981b3d680506d34c64bc3717d117f9e4a29` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 01:19:06 +0100 |

<details><summary>Details</summary>

```
Stats panel: 3 cards Ôćĺ 6 cards with full XMRig-style metrics:
  - Hashrate: primary + rolling 10s/60s/15m/max sub-stats
  - Shares: accepted/rejected + accept rate + best diff + latency
  - Uptime: days support + total hashes + connection count
  - Difficulty: pool diff + height + active algorithm
  - Blocks Found: count with celebration styling when blocks > 0
  - Hardware: CPU threads + CPU/GPU hashrates + GPU device name

CSS: 3-column grid, sub-stat rows with color-coded accent values,
     .has-blocks gold gradient for block celebration.

renderer.js: Full updateStats() rewrite with human-friendly number
formatting (K/M/G/T) for hashrate, difficulty, hashes.
```
</details>

---

### 84. `c5f07a4` — ­čľą´ŞĆ Live Mining Console ÔÇö XMRig/SRBMiner-style terminal in dashboard

| | |
|---|---|
| **Hash** | `c5f07a4554e3f74f79a3e966f387f0ef2d29c60f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 01:26:47 +0100 |

<details><summary>Details</summary>

```
Added professional live mining console directly on the dashboard:
  - Dark terminal panel with monospace font (JetBrains Mono)
  - Real-time colorized miner output with XMRig-style highlighting:
    ÔÇó Speed lines: cyan hashrate values with max in green
    ÔÇó Accepted shares: green highlight bar with diff + latency
    ÔÇó Rejected shares: red with reason
    ÔÇó New jobs: blue with height + diff + algo in cyan
    ÔÇó Block found: gold celebration bar
    ÔÇó GPU/CPU hashrate: color-coded by device type
    ÔÇó Status panels: colorized HASHRATE/SHARES/DIFF/UPTIME/THREADS
    ÔÇó Errors in red, warnings in amber, connections in green
  - Pulsing green dot when mining active, gray when idle
  - Clear and scroll-to-bottom controls
  - 500-line buffer with auto-scroll at bottom
  - Start/stop banners with separator lines
  - All output from miner stdout/stderr flows through console
```
</details>

---

### 85. `a24f1a0` — XMRig-style professional terminal output ÔÇö Rust miner

| | |
|---|---|
| **Hash** | `a24f1a0ff3933bd95e65f7ad7b6b846da2a5fdcd` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 01:41:06 +0100 |

<details><summary>Details</summary>

```
Replaced log::info/warn with colored println across miner:
- main.rs: compact ASCII banner, CONFIG/COMMANDS/ABOUT sections
- mod.rs: [HH:MM:SS] net/cpu/gpu colored status lines
- cpu.rs: colored batch/switch/submit output
- Internal debug moved to log::debug
- Stats panel already XMRig-style (unchanged)
```
</details>

---

### 86. `0f74fdb` — Metal GPU + XMRig-style static output ÔÇö stratum/GPU logs silenced to debug, backgroundColor fix, Metal build

| | |
|---|---|
| **Hash** | `0f74fdbe572c85dfa6f639cb1fa2011408b84cf8` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 02:02:39 +0100 |

---

### 87. `1b9f266` — fix: P2P fork resolution ÔÇö detect Invalid prev_hash and trigger reorg

| | |
|---|---|
| **Hash** | `1b9f266abf785ad5ad5a043d02ed3498a5654121` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 02:04:21 +0100 |

<details><summary>Details</summary>

```
When receiving blocks with mismatched prev_hash, instead of banning
the peer, the node now:
1. Detects the fork via reorg::find_fork_point()
2. Compares cumulative difficulty (is_stronger_chain)
3. If competing chain is stronger, executes reorg_to_fork()
4. Broadcasts new tip after successful reorg

This prevents permanent chain splits when two miners find blocks
at similar times.
```
</details>

---

### 88. `26803a3` — docs: update REPORT.md + ROADMAP.md ÔÇö P0/P1 fixes, fork resolution, full redeploy status

| | |
|---|---|
| **Hash** | `26803a3c9d0d5213fad4de65e4f60bd94404a283` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 02:16:54 +0100 |

---

### 89. `3d44de0` — Static ANSI panel ÔÇö SRBMiner-style in-place overwrite, zero scrolling

| | |
|---|---|
| **Hash** | `3d44de0afa51c255967fc3e5a89cb08ab65c9aba` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 02:18:14 +0100 |

<details><summary>Details</summary>

```
- stats.rs: Replaced all print methods with single static panel using ANSI
  escape codes (cursor up + line clear). 9-line fixed panel shows:
  SPEED (10s/60s/15m), SHARES (A/R/rate), DIFF, UPTIME, HW, NET, EVENT
- mod.rs: Silenced ALL runtime println! (GPU SHARE, gpu:status, gpu:switch,
  batch, reconnect, net connected, cpu threads) Ôćĺ log::debug!
- cpu.rs: Silenced ALL runtime println! (batch, submit errors, cpu:switch,
  connection lost) Ôćĺ log::debug!
- Event system: share accepted/rejected/new job Ôćĺ stats.set_event() displayed
  in EVENT line of static panel
- No more scrolling. Panel overwrites itself every stats_interval seconds.
- Metal GPU build included.
```
</details>

---

### 90. `8f33c6f` — docs: FIX.md ÔÇö Explorer emission bugs, 1e9Ôćĺ1e6, block reward 50Ôćĺ5400.067, RPC key mismatch

| | |
|---|---|
| **Hash** | `8f33c6f4e5b0980bb70234cf7afc6031e9e79312` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 02:28:42 +0100 |

---

### 91. `71e026a` — desktop-agent: static panel in UI ÔÇö panel lines overwrite fixed element, no scrolling

| | |
|---|---|
| **Hash** | `71e026aec8ec27e84fc2b6e65df44c0032911140` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 02:35:53 +0100 |

<details><summary>Details</summary>

```
- renderer: detect ÔöîÔöéÔöö panel lines Ôćĺ updateStaticPanel() overwrites fixed div
- renderer: filter out [STATUS] lines and panel lines from scrolling console
- renderer: strip ANSI escape sequences before processing
- main.js: stop sending [STATUS] lines to renderer (file log only)
- main.js: add parsers for new panel format (SPEED/HW/A:/R: vs old HASHRATE/THREADS)
- main.js: strip ANSI escapes in parseMinerOutput()
- index.html: add miner-static-panel element with sticky positioning + CSS
```
</details>

---

### 92. `f6f96ed` — dashboard: move Mining Console to Logs tab, keep Dashboard clean + static

| | |
|---|---|
| **Hash** | `f6f96edb488ae77f3ffc70107d7b3b77a94adbda` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 02:44:53 +0100 |

<details><summary>Details</summary>

```
- Dashboard now shows only stat cards + control panel (no scrolling console)
- Logs tab: Mining Console (static panel + scrolling log) + App Diagnostics
- Perf: defer DOM updates when Logs tab is hidden (lazy rendering)
- Perf: cache panel lines, flush deferred queue on tab switch
- Perf: MC_MAX_LINES 500Ôćĺ200, log entries 100Ôćĺ80
- Mining console height 280pxÔćĺ400px in Logs tab (more space)
```
</details>

---

### 93. `ebfd65f` — ­čÜÇ Mainnet cleanup: Remove AI/Chat sections, rename to Native Awakening

| | |
|---|---|
| **Hash** | `ebfd65f5a53a5533a13cd26be1a646afce38b8c4` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 03:11:35 +0100 |

<details><summary>Details</summary>

```
- Remove AI view (Afterburner + AI Native) from sidebar nav and HTML
- Remove Chat view (AI Native chat) from sidebar nav and HTML
- Remove AI Native Orchestrator section from Settings
- Remove setupAiControls(), setupChatControls(), setupAiNativeControls() from renderer
- Remove Afterburner stats metrics block from updateStats()
- Clean up buildStatsSignature() ÔÇö remove afterburner fields
- Clean up orphaned CSS (.ai-native-card, .ai-native-help)
- Remove aiAfterburner/chatEndpoint/chatModel from config save
- Rename branding: 'ZION Native Awakening v2.9.5' throughout
  - Page title, sidebar, dashboard, console splash, network, about, window title
- Total: -937 lines removed, lean mainnet agent
```
</details>

---

### 94. `f2d4bcd` — fix(explorer): correct emission data ÔÇö 1e9Ôćĺ1e6, reward 50Ôćĺ5400.067, RPC keys, get_info extended

| | |
|---|---|
| **Hash** | `f2d4bcdcf0b92dcbf808defc24852e6997b5ec69` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 11:51:47 +0100 |

<details><summary>Details</summary>

```
P0 Fixes:
- Replace all 1e9 divisors with ATOMIC_UNITS_PER_ZION (1_000_000) across 4 web files
- Fix block reward from hardcoded 50 to 5_400.067 ZION (matching reward.rs)
- Fix getCoinbaseTxSum() to read correct RPC keys (mined_so_far_atomic, burned_atomic)
- Add constants.ts as single source of truth for ZION economics
- Add reward_distribution (89% miner / 10% humanitarian / 1% pool) to emission API
- Extend get_info RPC with: target, tx_pool_size, peers, version, start_time, top_block_hash

Files changed:
- NEW: website-v2.9/src/lib/constants.ts
- MOD: website-v2.9/src/lib/zion-rpc.ts
- MOD: website-v2.9/src/app/api/blockchain/emission/route.ts
- MOD: website-v2.9/src/app/api/blockchain/stats/route.ts
- MOD: website-v2.9/src/app/api/blockchain/block/route.ts
- MOD: core/src/jsonrpc/mod.rs
```
</details>

---

### 95. `32c30e0` — ­čž╣ Remove Stream Allocation bar + CH3 Stream Scheduler from agent UI

| | |
|---|---|
| **Hash** | `32c30e05edc3ce39effa24bf37614b0f96097bf7` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 11:56:43 +0100 |

<details><summary>Details</summary>

```
- Dashboard: remove Stream Allocation bar (Z:50% R:25% N:25%) and Revenue indicator
- Network: remove entire CH3 Stream Scheduler section (allocation, Active Stream, Revenue Coin/Hashrate)
- Remove alloc-bar CSS styles (seg-zion, seg-revenue, seg-ncl)
- Clean up renderer.js: remove updateAllocationBar(), revenue refs from updateCH3Dashboard/updateStreamIndicator
- Total: -118 lines
```
</details>

---

### 96. `c84509f` — feat(network): add lite Network Telemetry panel to desktop agent

| | |
|---|---|
| **Hash** | `c84509f4a2f0249f520f31c1ff8728168d0c4887` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 12:02:56 +0100 |

<details><summary>Details</summary>

```
- New IPC handler 'get-network-metrics' in main.js
  Ôćĺ RPC get_info for block height per node
  Ôćĺ Pool API /stats for hashrate, miners, blocks per node
  Ôćĺ Summary: nodes online, max height, total hashrate, miners, sync status
- Preload bridge: getNetworkMetrics() exposed
- index.html: Network Telemetry panel with 4 summary cards
  (Nodes Online, Block Height, Network Hashrate, Active Miners)
  + sync status bar + per-node detail rows
- renderer.js: refreshNetworkMetrics() with formatHashrateLite()
  hooked into 30s server polling cycle

Mirrors website-v2.9 /api/network approach (same RPC + Pool API)
but in a lightweight desktop-native style.
```
</details>

---

### 97. `d8e4f70` — feat(logs): full-width mining console + debug drawer redesign

| | |
|---|---|
| **Hash** | `d8e4f7072c1230db98bdb7fa92c62bce10be1578` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 12:10:22 +0100 |

<details><summary>Details</summary>

```
- Mining Console now spans full view height (calc(100vh - 260px))
- Static miner panel: bigger font (14-15px), bolder colors, text-shadow glow
  for SPEED/SHARES/HASHRATE values ÔÇö better visual hierarchy
- App Diagnostics moved into collapsible debug drawer
  Ôćĺ hidden by default, toggled via Debug button in header
  Ôćĺ purple accent when active, smooth fadeSlideIn animation
- Header simplified: 'Mining Console' kicker, Debug + Open Log File buttons
- Console body: slightly larger font (13px) for readability
```
</details>

---

### 98. `db470fb` — fix(network): await initCH3Features + add debug logging

| | |
|---|---|
| **Hash** | `db470fbe74f74eb4c5b202e0cf4c004ea2b94b62` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 12:21:31 +0100 |

<details><summary>Details</summary>

```
- initCH3Features() was called without await ÔÇö unhandled promise rejection
  could silently break server/metrics polling
- Added [NET-METRICS] console.log in both main.js IPC handler and
  renderer.js refreshNetworkMetrics for easier debugging
- Confirmed: backend returns correct data (both nodes online,
  height, hashrate, miners from RPC + Pool API)
```
</details>

---

### 99. `e9417e5` — UI: Unify Wallet, Settings, About ÔÇö match Dashboard/Network design

| | |
|---|---|
| **Hash** | `e9417e565d4cb1103172dda5c65a294b85f65a30` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 12:39:16 +0100 |

<details><summary>Details</summary>

```
- Wallet: Split into 5 control-panel sections (Active Wallet, Send,
  Create, My Wallets, Import) with stat-card-style Balance/QR cards,
  colored borders (green balance, purple QR), compact form grids
- Settings: Move Save button into page header, update subtitle copy
- About: Redesign with 4 info cards (Version/Algorithm/Network/Engine)
  with colored borders, Links & Resources list rows, Philosophy footer
- All sections now share unified design language: web29-page-header,
  control-panel panels, consistent 24px top margins, 12px border-radius
  cards with rgba borders, 11px uppercase kickers
```
</details>

---

### 100. `6638e50` — fix(explorer): remove Consciousness Bonus section from Emission Monitor

| | |
|---|---|
| **Hash** | `6638e50c65e33e5a1483e6e33fedaf3df4c10214` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 13:03:07 +0100 |

<details><summary>Details</summary>

```
- Remove consciousness_bonus from emission API response
- Remove consciousness_bonus interface + levelStyles from EmissionMonitor.tsx
- Remove unused Cpu/Sparkles/Star imports
- Update DashboardClient roadmap text to mention humanitarian tithe instead
```
</details>

---

### 101. `7e5eb41` — UI: Dashboard compact layout + global button redesign + performance tuning

| | |
|---|---|
| **Hash** | `7e5eb4151a33c2822f3ea278905b55e6c0c90a37` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 13:15:48 +0100 |

<details><summary>Details</summary>

```
Dashboard:
- Fits viewport without scrolling (flex column + overflow hidden)
- Quick Controls moved to compact inline bar above stats grid
- Removed bottom Control Panel, Start/Stop in top bar
- Reduced all spacing, padding, font sizes for density

Buttons (global):
- Smaller: 8px 16px padding, 12px font, 10px radius
- Removed expensive backdrop-filter, ::before overlays
- Simplified hover to filter:brightness instead of transform

Performance:
- Starfield: density 240Ôćĺ100, FPS capped 24, DPR capped 1.5
- Starfield pauses on document.hidden (visibilitychange)
- Starfield resize debounced 150ms, gradient cached
- Log DOM: max entries 80Ôćĺ40, queue 200Ôćĺ100
- Stream throttle: 20Ôćĺ8 lines/sec window
- Mining console: 200Ôćĺ120 lines, deferred queue 50Ôćĺ30
- Removed backdrop-filter blur from stat-cards
- Removed transform hover animations from cards
```
</details>

---

### 102. `ce52e56` — docs: update REPORT.md with Desktop Agent UI optimization session

| | |
|---|---|
| **Hash** | `ce52e5674bd28568c80773021820d6d5a644ee17` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 13:50:11 +0100 |

---

### 103. `fe47b78` — feat: P2P fork fix + pool fee distribution (89/10/1)

| | |
|---|---|
| **Hash** | `fe47b78834b7f54234673b1972c78a107fa5541f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 13:52:49 +0100 |

<details><summary>Details</summary>

```
P2P Fork Fix:
- Fix fork detection comparing incomplete chain (1 block vs 1920 blocks)
- When peer has longer chain, request full fork chain via GetBlocksIBD
- Add fork-aware processing in BlocksIBD handler
- IBD blocks hitting Invalid prev_hash now trigger proper reorg

Pool Fee Distribution:
- Add humanitarian_wallet + humanitarian_tithe_percent to pool config
- Env vars: ZION_HUMANITARIAN_WALLET, ZION_HUMANITARIAN_TITHE_PERCENT
- ShareProcessor now splits reward: 89% miners, 10% humanitarian, 1% pool
- Automatic tithe transfer on block found (if wallet configured)
- Pool API /pool endpoint shows full reward_distribution breakdown
- Detailed logging of fee split per block
```
</details>

---

### 104. `afc1160` — UI: restore dashboard control panel + unified premium button design

| | |
|---|---|
| **Hash** | `afc116019f9a1436e886f3460bb57bf5e29547e5` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 14:20:16 +0100 |

<details><summary>Details</summary>

```
Dashboard:
- Control panel restored as proper block above stats grid
- GPU badge, stream indicator, algo display in left group
- Start Mining / Stop buttons in right group with proper spacing
- No longer squished into single inline bar

Buttons (unified across entire agent):
- New glass style: rgba bg + subtle backdrop-filter blur
- btn-primary: goldÔćĺpurple gradient glow border (not solid fill)
- btn-danger: translucent red with red border glow
- btn-ghost + btn-sm utility classes for secondary actions
- All buttons same 9px 20px padding, 12px font, 10px radius
- Removed all inline style overrides from 12 buttons
- Wallet, Settings, Logs, Network buttons now use shared classes
```
</details>

---

### 105. `4d93bc2` — fix: allow deep reorg during IBD (initial block download)

| | |
|---|---|
| **Hash** | `4d93bc2386a8ea685535e879c472cdf9fa9a1be5` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 14:30:52 +0100 |

<details><summary>Details</summary>

```
During IBD, overlapping block batches can create temporary forks.
The MAX_REORG_DEPTH=10 limit prevents syncing when this happens.
Now reorg depth limit is effectively disabled during IBD mode,
allowing nodes to sync from scratch without getting stuck.
```
</details>

---

### 106. `2694e80` — fix: skip normal blocks during IBD to prevent conflicts

| | |
|---|---|
| **Hash** | `2694e800721299a5ee9b75fde3b82c57f72aad6f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 14:34:57 +0100 |

<details><summary>Details</summary>

```
Normal Message::Blocks arriving during IBD create conflicts with the
IBD pipeline, causing fork detection at height 1920 while IBD is only
at 1500. Now Message::Blocks are ignored during IBD mode.
```
</details>

---

### 107. `82697cc` — fix: prevent parallel sync during IBD (race condition)

| | |
|---|---|
| **Hash** | `82697cc6977e82677ef43170bed38c23ffddf6b9` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 14:39:50 +0100 |

<details><summary>Details</summary>

```
During IBD, inbound peer connections were triggering GetBlocks
sync in parallel with the IBD pipeline. This caused blocks to be
written out-of-order, creating spurious fork detection.

Now Handshake handler skips sync if IBD is already active.
```
</details>

---

### 108. `c11f763` — fix: IBD skip already-have blocks, detailed prev_hash diagnostics, find_fork_point hex fix

| | |
|---|---|
| **Hash** | `c11f763682379b70d41c5807fb41a0d70740004c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 14:57:58 +0100 |

<details><summary>Details</summary>

```
- IBD BlocksIBD handler: skip blocks below current tip height (overlapping batch protection)
- IBD: skip Invalid prev_hash blocks instead of attempting complex reorg during sync
- IBD: re-request from current tip when no blocks processed but more remain
- validation.rs: detailed prev_hash mismatch logging (block/prev hash, nonce, algo, merkle, timestamp)
- reorg.rs: use hex::encode(header.calculate_hash()) for explicit hex comparison
```
</details>

---

### 109. `1c93838` — docs: update REPORT.md with Pool Fee + IBD fix session (10.2. afternoon)

| | |
|---|---|
| **Hash** | `1c938385be9a7f9643113308a3431c4d5cb49471` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 15:07:55 +0100 |

---

### 110. `0f74741` — chore: remove premine time-locks, unify naming to Golden Egg/Xp, remove Revenue section from dashboard

| | |
|---|---|
| **Hash** | `0f7474184930b47ca246cca049d8e94946a82ec2` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 16:33:02 +0100 |

<details><summary>Details</summary>

```
- All premine categories now 'Immediately unlocked' (no vesting/time-lock)
- Renamed 'Mining Operators (OASIS)' Ôćĺ 'ZION OASIS + Winners Golden Egg/Xp' everywhere
- generate-premine-wallets.rs: unlock_height changed from Some(5_256_000) to None
- Removed 'Revenue Model ÔÇö 100% DAO Treasury' section from Economy tab
- validation.rs: MAX_TIMESTAMP_DRIFT 7200 Ôćĺ 86400 (TestNet 24h)
- pool: fix algo extraction from job_id to prevent ethash contamination
- Updated: README, ROADMAP, Constitution, whitepapers, configs, dashboard, website
```
</details>

---

### 111. `8cdc859` — mobile-app: Rust 2.9.5 core integration ÔÇö UTXO TX builder, emission constants, network tab

| | |
|---|---|
| **Hash** | `8cdc859a19810ac47e85da83c04310c55c601918` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 22:20:05 +0100 |

<details><summary>Details</summary>

```
NEW FILES:
- blockchain.js: All emission/supply/fee constants mirroring Rust core (emission.rs, premine.rs)
- TransactionBuilder.js: UTXO selection, Ed25519 signing, hex serialization
- NetworkScreen.js: Chain overview, mining progress, node health, pool stats

UPDATED:
- BlockchainRPC.js: Fixed ports 8545Ôćĺ8444, server IPs, atomicÔćĺZION balance, hex broadcast, emission info
- PoolAPI.js: Fixed endpoints to /api/pool/stats, /api/miner/, multi-node failover
- config.js: v2.9.5, real RPC/Pool nodes, stratum IP, P2P port
- package.json: Version bump to 2.9.5
- WalletContext.js: Added balance/UTXO state, refreshBalance(), sendZion() via TransactionBuilder
- SendScreen.js: UTXO-based sends, dynamic fee estimation, fee-burn notice
- DashboardScreen.js: Emission & tokenomics section with live supply/reward info
- MiningScreen.js: Pool connection status, reward structure, stratum info
- App.js: Added Network tab (5th tab) with lan icon
```
</details>

---

### 112. `2f68b84` — docs: update REPORT.md with Tokenomics Cleanup + Mobile App Rust 2.9.5 Integration session

| | |
|---|---|
| **Hash** | `2f68b84feae7ba94f119a866265e01714f6301f8` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 22:25:11 +0100 |

---

### 113. `4ecef84` — feat(mobile-app): Expo web preview + Galactic Warp Background design sync

| | |
|---|---|
| **Hash** | `4ecef843cf402927770df2fdfee9b9f22bd42b56` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-10 23:41:14 +0100 |

<details><summary>Details</summary>

```
- Expo web preview running at localhost:8083 (493 modules)
- 14 native module mocks for web platform (keychain, biometrics, camera, etc.)
- GalacticBackground.js: canvas warp starfield + nebula bubbles + HUD grid
- Design synchronized with website-v2.9 and desktop-agent:
  - Star color rgb(200,118,255), galactic-core gradient, 24 FPS
  - Glass styling: blur(20px), rgba(10,12,28,0.72) bg
  - Colors: gold #FFD700, purple #9333EA, cyan #06B6D4
- NavigationContainer transparent theme (key fix for background visibility)
- 8 screens with transparent backgrounds
- GlassCard: backdrop-filter blur, glass tokens
- GradientButton: web boxShadow glow effects
- theme.js: full color sync with website/desktop
- REPORT.md updated
```
</details>

---

## 2026-02-11

### 114. `b63cb4b` — fix(p2p): is_fork_chain checks ALL blocks in batch, not just first

| | |
|---|---|
| **Hash** | `b63cb4b1b1f9e9db9356a5488b9981ce6619ca39` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 00:07:21 +0100 |

<details><summary>Details</summary>

```
Previously, is_fork_chain only compared the first block in the IBD
batch against our local chain. Since the fork_point block (identical
to ours) is now included in the request, the first block always
matched Ôćĺ is_fork_chain=false Ôćĺ fork blocks went to normal IBD path
Ôćĺ process_block rejected diverged blocks with prev_hash mismatch.

Now iterates ALL blocks up to our tip height and if ANY block has a
different hash than our stored block, it correctly identifies the
batch as a fork chain and routes to the reorg handler.

This was the third and final iteration fixing fork chain resolution:
- Fix #1: Derived fork_point from first_block_height - 1 (unreliable)
- Fix #2: Reverted to find_fork_point() in BlocksIBD, request from
  fork_point inclusive
- Fix #3: Check ALL blocks for fork detection (this commit)

Verified: Both nodes (Helsinki + Germany) synced at identical tip
with zero Reorg FAIL, multiple successful reorgs, working payouts.
```
</details>

---

### 115. `8947845` — docs: update REPORT.md with P2P Master Fix session (11.2.)

| | |
|---|---|
| **Hash** | `894784579f81155b271e777907c5ef4838f2ed53` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 00:09:10 +0100 |

<details><summary>Details</summary>

```
- Documented reorg_lock + reorging AtomicBool fix
- 3 iterations of fork chain resolution bugs
- Pool RPC env var mismatch fix (ZION_RPC_URL alias)
- Seeds cleanup (removed dead USA/Singapore nodes)
- Verified: both nodes synced at identical tip, 0 fork failures
- Payouts verified: 89/10/1 split with TX IDs
- Updated TODO priorities
```
</details>

---

### 116. `c719995` — fix(reorg): is_stronger_chain ÔÇö height tiebreaker + anti-fork heuristic (3+ blocks ahead, 90% work threshold)

| | |
|---|---|
| **Hash** | `c719995615c32f5d54fcb7acdd759a6883125a8c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 01:09:42 +0100 |

<details><summary>Details</summary>

```
- Equal work tiebreaker: if total_new_work == current_work and new chain is taller Ôćĺ accept
- Significantly longer chain: if height_advantage >= 3 && new_work >= 90% current_work Ôćĺ accept
- Prevents permanent 2-node fork when miners produce blocks with different difficulty
- Added debug logging for fork_point, tip heights, work comparison
- Verified: both nodes converge within seconds after deployment
```
</details>

---

### 117. `ad10771` — docs: update REPORT.md ÔÇö Dashboard Monitor Fix + is_stronger_chain Anti-Fork session (11.2.)

| | |
|---|---|
| **Hash** | `ad1077182ae3786d4367a6e819b3c794d0f6aa11` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 01:41:50 +0100 |

---

### 118. `53fd993` — docs: sync ROADMAP.md to 11.2. ÔÇö resolved items, sprint 1.10 running, security checklist, explorer live, fix REPORT.md corrupted emoji

| | |
|---|---|
| **Hash** | `53fd993bdfa3e0459ec10652e412388a6d1839fe` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 01:48:07 +0100 |

---

### 119. `b8e94a3` — feat: P2P peer discovery system ÔÇö getPeerList RPC + explorer + desktop agent

| | |
|---|---|
| **Hash** | `b8e94a3cdf177c78daf97c708ecf2709b7761ae8` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 02:06:45 +0100 |

<details><summary>Details</summary>

```
Rust daemon:
- Add PeerManager to State (peer_manager: Mutex<Option<Arc<PeerManager>>>)
- Register PeerManager in p2p::start() into State
- New getPeerList/getConnections JSON-RPC handler returning full peer list
  (address, host, port, height, connected, idle_seconds, sub_version, state)

Website:
- zion-rpc.ts: getConnections() rewired from getPeerInfo to getPeerList
- /api/blockchain/peers: route rewritten for new data format
- NetworkPeers.tsx: full rewrite with rich peer cards (connected/known status,
  IN/OUT direction, height sync, idle time, failures, version)

Desktop Agent:
- main.js: get-peer-list IPC handler (fetches from all seed nodes, deduplicates)
- preload.js: exposed getPeerList() API
- index.html: P2P Peers panel with summary cards + peer directory
- renderer.js: refreshPeerList() with 15s auto-refresh

10 files, +448/-91 lines
```
</details>

---

### 120. `6d28e8a` — feat: Professional Mining Pool page at /pool

| | |
|---|---|
| **Hash** | `6d28e8a8b9c53c8f089d54892b40a6303e7a3c97` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 08:08:21 +0100 |

<details><summary>Details</summary>

```
- New /pool page with full mining pool dashboard (inspired by F2Pool, 2Miners, WoolyPooly)
- 4 tabs: Overview, Miners, Blocks, Start Mining guide
- Real-time pool stats with 15s auto-refresh from both Helsinki + Germany servers
- Server cards with status, hashrate, shares, uptime
- Fee structure visualization (89% miner / 10% humanitarian / 1% pool)
- Miner directory with active/inactive status
- Recent blocks table with links to explorer
- Step-by-step mining setup guide with server selection
- Supported algorithms (Cosmic Harmony, RandomX)
- Stratum endpoint copy buttons
- New /api/pool/stats aggregation API route
- Added Pool link to navigation
```
</details>

---

### 121. `64e31a1` — fix: TypeScript error in MissionControlDashboard sync type

| | |
|---|---|
| **Hash** | `64e31a15d02ddb0c8b3c79b7a70cbca936f61ec0` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 08:25:43 +0100 |

---

### 122. `adc98b0` — feat(pool): redesign Pool page to match Explorer visual language

| | |
|---|---|
| **Hash** | `adc98b03a7cedf6234500dbfda7b999ba0bd975f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 08:43:00 +0100 |

<details><summary>Details</summary>

```
- Removed tab navigation, replaced with vertical sections like Explorer
- Same background glows, rounded-3xl/4xl cards, motion.section animations
- Explorer-style section headers (subtitle + h2 + description)
- StatCard grid matching ProExplorerStats layout
- CTA footer matching Explorer pattern
- Consistent border-white/10, bg-black/60, backdrop-blur-xl styling
```
</details>

---

### 123. `2a7480c` — fix: replace React.cloneElement with CSS child selector for React 19 compat

| | |
|---|---|
| **Hash** | `2a7480c586a90d628b68c0d5b32f1ae796f506ac` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 09:01:45 +0100 |

---

### 124. `a223e32` — docs: update REPORT.md ÔÇö Pool Page + Explorer Design Sync session (12.2.)

| | |
|---|---|
| **Hash** | `a223e3258df434a0efc8ac34a875022e2b07b2d1` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 09:11:11 +0100 |

---

### 125. `5a04dec` — feat: Pool nav button, miner search, miner detail page, per-miner Prometheus metrics

| | |
|---|---|
| **Hash** | `5a04decaae77d5c08742c6130d5b5847a10b1d2d` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 09:27:23 +0100 |

<details><summary>Details</summary>

```
- Navigation: Pool icon button (Pickaxe) on desktop + mobile (3-col grid)
- PoolDashboard: Miner search bar with zion1 address validation
- /pool/miner/[address]: Full miner detail page with Explorer design language
  - Stats grid (hashrate, shares, efficiency, blocks, balance)
  - SVG sparkline hashrate chart (live 15s samples)
  - Blocks found table, Payouts table
  - Prometheus metrics reference section
- /api/pool/miner/[address]: Aggregation API (fetches from all pool servers)
- pool/src/metrics/prometheus.rs: Per-miner labeled metrics
  - miner_hashrate, miner_shares_total, miner_blocks_found_total
  - miner_pending_balance_atomic, miner_paid_total_atomic
  - miner_connections_active + remove_miner() for cardinality control
- pool/src/shares/processor.rs: inc_miner_share/inc_miner_blocks calls
- pool/src/stratum/server_v2.rs: inc/dec_miner_connections on auth/disconnect
- pool/src/main.rs: Background task updates miner hashrate/balance every 30s
```
</details>

---

### 126. `086fb00` — feat(monitoring): Prometheus + Grafana full stack, 2 dashboards, 15 alert rules, Docker Compose, deploy script

| | |
|---|---|
| **Hash** | `086fb007304922340b415abdfed4bc3c4da898d5` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 09:44:01 +0100 |

<details><summary>Details</summary>

```
Sprint 3.1.2 + 3.1.3 (Early Start ÔÇö Phase 3):

Prometheus:
- prometheus.yml with 8 scrape jobs (pool├Ś2, core├Ś2, node-exporter├Ś2, redis├Ś2)
- 15s/30s scrape intervals, 90d retention, 10GB max storage
- 15 alert rules in 4 groups: Pool (7), Core (2), Infra (5), Redis (1)

Grafana:
- Pool Overview dashboard: 16 panels (status, hashrate, shares, blocks,
  per-miner top 10, NCL algo, all miners table)
- Infrastructure dashboard: 14 panels (CPU, RAM, disk, network, TCP, uptime)
- Auto-provisioned datasources + dashboards
- Anonymous viewer access, sub-path /grafana/

Docker:
- docker-compose.monitoring.yml: 4 services
  prometheus:v2.53, grafana:v11.1, node-exporter:v1.8.1, redis-exporter:v1.61
- Joins existing zion-net network
- Health checks on all services

Nginx: grafana-proxy.conf with WebSocket support for Grafana Live
Deploy: scripts/deploy-monitoring.sh (helsinki|germany|all)
ROADMAP: Sprint 3.1.2 ÔČťÔćĺÔťů, Sprint 3.1.3 ÔČťÔćĺÔťů
```
</details>

---

### 127. `6eb6c72` — docs: update server infra docs, miner stratum improvements, pool fix

| | |
|---|---|
| **Hash** | `6eb6c727c7484c032b0f4cb7ec4bde2acc091f79` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 09:58:34 +0100 |

<details><summary>Details</summary>

```
- SERVERS_SSH.md: update to current 2-node topology (Helsinki+Germany),
  decommissioned servers list, add zion-web/zion-miner services
- miner/src/stratum/mod.rs: stratum improvements (+53 lines)
- pool/src/stratum/server_v2.rs: minor fix (+1 line)
```
</details>

---

### 128. `a67861a` — feat: ROADMAP audit + legal/infra-funding + runbook + footer disclaimer

| | |
|---|---|
| **Hash** | `a67861a13863c7d65d300066d964f1a40faf5980` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 10:14:52 +0100 |

<details><summary>Details</summary>

```
ROADMAP audit ÔÇö 9 items ÔČťÔćĺÔťů (were already done but unmarked):
- Sprint 2.3: Explorer (2.3.1-2.3.3, 2.3.5) ÔÇö live at /explorer
- Sprint 3.2.1: docker-compose.mainnet.yml ÔÇö already existed
- Sprint 3.4.6: Supply API ÔÇö exists at /api/blockchain/stats

New items completed:
- 3.3.6: legal/INFRASTRUCTURE_FUNDING.md ÔÇö funding sources, costs, transparency
- 3.3.7: Footer disclaimer ÔÇö short legal text with link to /legal
- 3.2.2: ops/runbook.md ÔÇö full operations guide (SSH, Docker, monitoring,
  incident response, backup/recovery, deployment, troubleshooting)

Priority To-Do section updated:
- Prometheus+Grafana ÔČťÔćĺÔťů
- Legal docs, Runbook, Supply API marked as completed
- Phase 2+3 exit criteria updated

Build verified: npx next build clean
```
</details>

---

### 129. `ddb1f7d` — feat: Rich List + Node Setup + Mining Guides ÔÇö ROADMAP Sprint 2.1, 2.2, 2.3.4 Ôťů

| | |
|---|---|
| **Hash** | `ddb1f7dc6af864487343a2e311e74097fd3da2ba` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 10:34:29 +0100 |

<details><summary>Details</summary>

```
Rich List (Sprint 2.3.4):
- API: /api/blockchain/richlist ÔÇö RPC + pool aggregation, Gini coefficient
- Page: /explorer/richlist ÔÇö top holders, distribution bar, type badges
- Premine/miner/unknown classification, supply % bars

Node Setup (Sprint 2.1):
- Page: /node-setup ÔÇö 'Run full node in 10 min'
- Source build, Docker, Docker Compose install methods
- Interactive config (mainnet/testnet/devnet) with TOML reference
- Ports & firewall table, CLI reference, verify commands
- Troubleshooting FAQ accordion

Mining Guides (Sprint 2.2):
- Page: /mining/guides ÔÇö CPU/GPU/Pool/Solo tabbed guides
- CPU: native miner + XMRig, huge pages tips, ARM64 notes
- GPU: Metal (Apple Silicon), CUDA (NVIDIA), OpenCL (AMD)
- Pool: all 4 algo endpoints, PPLNS features, pool dashboard link
- Solo: getBlockTemplate RPC, pros/cons comparison
- Hardware comparison table (RPi5 Ôćĺ RTX 4090)

Navigation: Rich List, Mining Guides, Node Setup added to nav groups
ROADMAP: Sprint 2.1 Ôťů, Sprint 2.2 Ôťů, Sprint 2.3.4 Ôťů, exit criteria updated
```
</details>

---

### 130. `101b19f` — docs: REPORT.md + ROADMAP.md ÔÇö Rich List, Node Setup, Mining Guides session

| | |
|---|---|
| **Hash** | `101b19f54aa35f28f9d6a56f6890a12391818b0a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 10:45:34 +0100 |

<details><summary>Details</summary>

```
REPORT.md: New section '11. ├║nora 2026 ÔÇö Rich List + Node Setup + Mining Guides'
- Detailed breakdown of all 9 changed files
- Rich List API + UI documentation (routes, features, Gini coefficient)
- Node Setup guide documentation (6 sections, 3 install methods)
- Mining Guides documentation (4 tabs, algorithms table, hardware comparison)
- Navigation updates summary
- ROADMAP sprint status table (2.1 Ôťů, 2.2 Ôťů, 2.3.4 Ôťů)
- Website route map update (37 pages)

ROADMAP.md: Priority To-Do ÔÇö Node UX + Mining guides Ôćĺ Ôťů
```
</details>

---

### 131. `aa1ca56` — ­čôő Mainnet Pre-Flight Checklist ÔÇö critical reminder before launch

| | |
|---|---|
| **Hash** | `aa1ca5629037b54864d584e7420b0e62381f5a40` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 12:57:32 +0100 |

<details><summary>Details</summary>

```
- All premine wallet addresses must be replaced with cold-storage production keys
- PREMINE_WALLETS_BACKUP.json MUST be removed from repo before mainnet
- Pool wallets (ZION_POOL_WALLET, ZION_HUMANITARIAN_WALLET) must be set
- DAO_ADDRESS in burn.rs must be real multisig address
- Seed nodes DNS must be registered and deployed
- Fee structure (1% pool / 10% humanitarian / 89% miners) confirmed
- L1 fee burning (MIN_TX_FEE=0.001 ZION) confirmed
- Genesis block assembly procedure documented
- Launch sequence T-7 to T+72h defined
- 36 critical checkpoints across 11 categories
```
</details>

---

### 132. `69e8e04` — MAINNET CHECKLIST expanded - 80+ audit findings added

| | |
|---|---|
| **Hash** | `69e8e0446a24dba579fa6e5c109080d4044a09a5` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 13:26:47 +0100 |

---

### 133. `8711050` — AUDIT.md - deep security audit report, 14 P0 + 39 P1 + 24 P2 findings

| | |
|---|---|
| **Hash** | `871105006aa26347f021d60f016694968daa9c99` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 13:41:05 +0100 |

---

### 134. `ec0dea5` — fix: align miner algo naming with pool (cosmic_harmony vs cosmic_harmony_v3)

| | |
|---|---|
| **Hash** | `ec0dea57e7f41b86db25f857a3ca65711123d3fe` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 16:58:20 +0100 |

<details><summary>Details</summary>

```
- Algorithm::name() now returns 'cosmic_harmony' to match pool job cache
- Removed stratum override that replaced pool's 'cosmic_harmony' with 'cosmic_harmony_v3'
- Fixes share rejection due to job_id suffix mismatch (pool caches -cosmic_harmony, miner submitted -cosmic_harmony_v3)
```
</details>

---

### 135. `f7ce224` — ­čöĺ AUDIT: Apply P0/P1 critical fixes (7 findings resolved)

| | |
|---|---|
| **Hash** | `f7ce22493d53bf404a90c2e46f7b5d4d0b7a39cd` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 17:43:42 +0100 |

<details><summary>Details</summary>

```
P0-05: Hardcode CH_V3_FORK_HEIGHT as const (was env var ÔÇö consensus bypass risk)
P0-06: MAX_REORG_DEPTH 50Ôćĺ10 (mainnet-safe: 10 blocks Ôëł 10 min)
P0-07: Remove tertiary fork-choice rule (accepted 90% work chains ÔÇö violated Nakamoto consensus)
P0-08: Add block_processing_lock mutex (prevent concurrent UTXO corruption)
P0-09: Atomic save_block+apply_utxos in single LMDB write txn (crash safety)
P0-14: Mainnet guard ÔÇö panic if pool wallet is test placeholder on mainnet
P1-01: Fix fork-choice >= to > (prevent tip-thrashing on equal work)
P1-02: Remove dead consensus::check() that always returned true

False positives confirmed (NO FIX NEEDED):
- P0-12: Pool profit_switcher uses safe tokio::sync::RwLock (no unsafe code)
- P1-03: MIN_DIFFICULTY already 1,000 (audit incorrectly claimed 1)
- P1-05: TX recycling after reorg already implemented in reorg_to_fork()

Compile: Ôťů cargo check passes
Tests: 256 passed, 3 failed (pre-existing, unrelated to these changes)
```
</details>

---

### 136. `5d0e2b8` — ­čöĺ AUDIT Wave 2: P0-10, P0-13 + 6├Ś P1 fixes (8 findings resolved)

| | |
|---|---|
| **Hash** | `5d0e2b8af75e1ac11f53c79c7b6ea1a4a2203acf` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 18:13:04 +0100 |

<details><summary>Details</summary>

```
P0-10: Fix rollback deadlock ÔÇö legacy rollback now reads through write txn
       instead of opening nested read txns (LMDB deadlock)
P0-13: Per-IP connection limit (max 10/IP) on Stratum server ÔÇö prevents
       single-IP DDoS flooding the pool with 10K connections
P1-06: Gate test-only methods (insert_block_unchecked, try_reorg_unchecked)
       behind #[cfg(any(test, feature="dev-tools"))]
P1-10: Harden ban durations: 60/300/3600 Ôćĺ 300/1800/7200 seconds
P1-13: Balance cache auto-invalidation in save_block_and_apply_utxos()
P1-15: Mempool byte-level cap (20 MB) alongside existing 10K count cap
P1-16: Legacy add_transaction() marked #[deprecated] ÔÇö callers should
       use add_transaction_validated() for production
P1-17: Add zeroize crate ÔÇö private key bytes zeroed after signing

Tests: 258 passed (unit), 50 passed (integration), 1 pre-existing failure
Compile: Ôťů cargo check passes
```
</details>

---

### 137. `6a9b308` — fix(audit-wave3): P1-09 reject empty network magic, P1-12 configurable LMDB map_size, P1-18 share cache pruning, P1-22/23 BTC/XMR wallets from env vars, P2-01 remove empty index.rs, P2-03 heartbeat exponential backoff + docs update (REPORT, AUDIT, ROADMAP, CHECKLIST)

| | |
|---|---|
| **Hash** | `6a9b3086da6b91d6539ff265b6a5a20d2d0ec946` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 18:33:48 +0100 |

---

### 138. `40c20d2` — audit: Wave 4 ÔÇö 6 fixes (P1-04, P1-11, P1-19, P1-20, P1-33, P1-38) + 1 mitigated (P1-14)

| | |
|---|---|
| **Hash** | `40c20d215bd6282fd4c6225c4f281800cf921aaa` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 18:50:17 +0100 |

<details><summary>Details</summary>

```
P1-04: Genesis block timestamp uses NetworkType::genesis_timestamp() instead of 0
P1-11: Self-connection detection via random nonce in Handshake/HandshakeAck (OnceLock)
P1-14: UTXO O(n) scan mitigated by balance_cache (Wave 2) ÔÇö secondary index deferred
P1-19: Bech32 charset validation for miner wallet addresses (reject uppercase/_/-)
P1-20: Humanitarian tithe retry with exponential backoff (3 attempts, 1s/2s/4s)
P1-33: Website CSP security headers (CSP, X-Frame-Options, HSTS, nosniff, Permissions-Policy)
P1-38: Mainnet RPC bind changed from 0.0.0.0:8443 to 127.0.0.1:8443

Tests: core 258 pass (1 pre-existing fail), pool 35 pass, integration 42 pass
Total audit fixes: 32 fixed | 3 false positives | 1 mitigated | Score: ~7/10

Files changed: block.rs, messages.rs, p2p/mod.rs, server_v2.rs, processor.rs,
               mainnet.toml, next.config.ts, sprint_1_3_ibd_suite.rs,
               AUDIT.md, REPORT.md, ROADMAP.md, MAINNET_PREFLIGHT_CHECKLIST.md
```
</details>

---

### 139. `b8fe0e6` — audit wave 5: P1-07 eclipse prevention, P1-25 extranonce1 per-session, P1-35 admin auth guard, P1-37 devnet alignment, P2-05 stripe failover

| | |
|---|---|
| **Hash** | `b8fe0e63f34df453bfc7e2f69c4192d760720c16` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 19:09:25 +0100 |

<details><summary>Details</summary>

```
- P1-07: PeerDirection enum (Inbound/Outbound) in PeerManager, 8 outbound slots reserved against eclipse attack
- P1-25: Unique 4-byte extranonce1 per session derived from session_id hash
- P1-35: Admin panel returns 403 when ADMIN_PASSWORD not set (was open access)
- P1-37: Devnet genesis timestamp=1704067200, premine infra/humanitarian aligned with mainnet
- P2-05: Stripe uses os.environ[] (no mock fallback), explicit mock key rejection
- Tests: 258 passed (1 pre-existing fail)
- Score: 5/10 -> ~7.5/10 (37 of 77 findings fixed)
```
</details>

---

### 140. `e73a0f1` — audit wave 6: secrets cleanup, docker hardening, DevSecOps, CORS restriction (11 findings)

| | |
|---|---|
| **Hash** | `e73a0f11fc69711283d823b2975b5837d9e6d09a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 19:38:09 +0100 |

<details><summary>Details</summary>

```
P1-29: StrictHostKeyChecking=no Ôćĺ accept-new (all deploy scripts)
P1-31: Hardcoded SMTP password x3nityOne144 Ôćĺ env var SMTP_PASSWORD
P1-32: Docker default passwords removed (Redis, Grafana) Ôćĺ requires .env
P1-34: CORS wildcard * Ôćĺ domain-restricted (zionterranova.com)
P2-06: GPU algo stubs documented (Keccak fallback behavior)
P2-08: Docker read_only: true on all mainnet services
P2-09: Docker no-new-privileges on all services
P2-15: Dependabot config (Cargo, Actions, npm weekly)
P2-17: CI --no-default-features build check
P2-23: Node-exporter pid:host removed, security hardened
P2-24: Docker resource limits (CPU/memory caps)

New: docker/.env.example template for required env vars
Total fixed: 48/77 findings (score ~8/10, from 5/10)
```
</details>

---

### 141. `468447f` — chore(deps): bump actions/download-artifact from 4 to 7

| | |
|---|---|
| **Hash** | `468447fd50bc8f78030a749e0cc4e5d865f497da` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:39:06 +0000 |

<details><summary>Details</summary>

```
Bumps [actions/download-artifact](https://github.com/actions/download-artifact) from 4 to 7.
- [Release notes](https://github.com/actions/download-artifact/releases)
- [Commits](https://github.com/actions/download-artifact/compare/v4...v7)

---
updated-dependencies:
- dependency-name: actions/download-artifact
  dependency-version: '7'
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 142. `2171b05` — chore(deps): bump actions/upload-artifact from 4 to 6

| | |
|---|---|
| **Hash** | `2171b05a1ffd6668778f91e29d4477fa4348bb3f` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:39:10 +0000 |

<details><summary>Details</summary>

```
Bumps [actions/upload-artifact](https://github.com/actions/upload-artifact) from 4 to 6.
- [Release notes](https://github.com/actions/upload-artifact/releases)
- [Commits](https://github.com/actions/upload-artifact/compare/v4...v6)

---
updated-dependencies:
- dependency-name: actions/upload-artifact
  dependency-version: '6'
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 143. `1656fbf` — chore(deps): bump softprops/action-gh-release from 1 to 2

| | |
|---|---|
| **Hash** | `1656fbf0254fdecfa4c27fece1808eb83b98b404` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:39:14 +0000 |

<details><summary>Details</summary>

```
Bumps [softprops/action-gh-release](https://github.com/softprops/action-gh-release) from 1 to 2.
- [Release notes](https://github.com/softprops/action-gh-release/releases)
- [Changelog](https://github.com/softprops/action-gh-release/blob/master/CHANGELOG.md)
- [Commits](https://github.com/softprops/action-gh-release/compare/v1...v2)

---
updated-dependencies:
- dependency-name: softprops/action-gh-release
  dependency-version: '2'
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 144. `497d1c1` — chore(deps): bump actions/checkout from 4 to 6

| | |
|---|---|
| **Hash** | `497d1c19cf45072df963e0aea4ecbfe220d826de` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:39:20 +0000 |

<details><summary>Details</summary>

```
Bumps [actions/checkout](https://github.com/actions/checkout) from 4 to 6.
- [Release notes](https://github.com/actions/checkout/releases)
- [Changelog](https://github.com/actions/checkout/blob/main/CHANGELOG.md)
- [Commits](https://github.com/actions/checkout/compare/v4...v6)

---
updated-dependencies:
- dependency-name: actions/checkout
  dependency-version: '6'
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 145. `64fed06` — chore(deps): update metal requirement from 0.27 to 0.33

| | |
|---|---|
| **Hash** | `64fed06998f94be4db4cd5d1171e722ff98068f9` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:39:32 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [metal](https://github.com/gfx-rs/metal-rs) to permit the latest version.
- [Release notes](https://github.com/gfx-rs/metal-rs/releases)
- [Commits](https://github.com/gfx-rs/metal-rs/compare/v0.27.0...v0.33.0)

---
updated-dependencies:
- dependency-name: metal
  dependency-version: 0.33.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 146. `b0916e7` — chore(deps): update reqwest requirement from 0.12 to 0.13

| | |
|---|---|
| **Hash** | `b0916e702ba210600e97dd1049e6083592f451c7` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:39:48 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [reqwest](https://github.com/seanmonstar/reqwest) to permit the latest version.
- [Release notes](https://github.com/seanmonstar/reqwest/releases)
- [Changelog](https://github.com/seanmonstar/reqwest/blob/master/CHANGELOG.md)
- [Commits](https://github.com/seanmonstar/reqwest/commits/v0.13.2)

---
updated-dependencies:
- dependency-name: reqwest
  dependency-version: 0.13.2
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 147. `cd31e7b` — chore(deps-dev): bump @types/node in /website-v2.9

| | |
|---|---|
| **Hash** | `cd31e7bf3f38124a4d4bcf7c71bcdf027b0fdc69` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:40:12 +0000 |

<details><summary>Details</summary>

```
Bumps [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/node) from 20.19.24 to 25.2.3.
- [Release notes](https://github.com/DefinitelyTyped/DefinitelyTyped/releases)
- [Commits](https://github.com/DefinitelyTyped/DefinitelyTyped/commits/HEAD/types/node)

---
updated-dependencies:
- dependency-name: "@types/node"
  dependency-version: 25.2.3
  dependency-type: direct:development
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 148. `9e11413` — chore(deps): update socket2 requirement from 0.5 to 0.6

| | |
|---|---|
| **Hash** | `9e11413e3d1e4d49f4789190a5ae518b4aefad6a` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:40:25 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [socket2](https://github.com/rust-lang/socket2) to permit the latest version.
- [Release notes](https://github.com/rust-lang/socket2/releases)
- [Changelog](https://github.com/rust-lang/socket2/blob/master/CHANGELOG.md)
- [Commits](https://github.com/rust-lang/socket2/compare/v0.5...v0.6.2)

---
updated-dependencies:
- dependency-name: socket2
  dependency-version: 0.6.2
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 149. `e786b8b` — chore(deps): update toml requirement from 0.8 to 1.0

| | |
|---|---|
| **Hash** | `e786b8b1da34ea34cfdfe2780a06991e56828ea2` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:40:50 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [toml](https://github.com/toml-rs/toml) to permit the latest version.
- [Commits](https://github.com/toml-rs/toml/compare/toml-v0.8.0...toml-v1.0.0)

---
updated-dependencies:
- dependency-name: toml
  dependency-version: 1.0.0+spec-1.1.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 150. `b87b2cf` — chore(deps): update redis requirement from 0.24 to 1.0

| | |
|---|---|
| **Hash** | `b87b2cf89068c9d5534faba54e71798034f15ffb` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:41:28 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [redis](https://github.com/redis-rs/redis-rs) to permit the latest version.
- [Release notes](https://github.com/redis-rs/redis-rs/releases)
- [Commits](https://github.com/redis-rs/redis-rs/commits)

---
updated-dependencies:
- dependency-name: redis
  dependency-version: 1.0.3
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 151. `bb763bf` — chore(deps): update colored requirement from 2.1 to 3.1

| | |
|---|---|
| **Hash** | `bb763bfd65995c5594a3ccab92be988a032a1bae` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:41:46 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [colored](https://github.com/mackwic/colored) to permit the latest version.
- [Release notes](https://github.com/mackwic/colored/releases)
- [Changelog](https://github.com/colored-rs/colored/blob/master/CHANGELOG.md)
- [Commits](https://github.com/mackwic/colored/compare/v2.1.0...v3.1.1)

---
updated-dependencies:
- dependency-name: colored
  dependency-version: 3.1.1
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 152. `c325e91` — chore(deps): update hostname requirement from 0.3 to 0.4

| | |
|---|---|
| **Hash** | `c325e91f62476d94de3309db718d556d88217b04` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:41:50 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [hostname](https://github.com/djc/hostname) to permit the latest version.
- [Release notes](https://github.com/djc/hostname/releases)
- [Commits](https://github.com/djc/hostname/compare/v0.3.0...v0.4.2)

---
updated-dependencies:
- dependency-name: hostname
  dependency-version: 0.4.2
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 153. `4f83658` — chore(deps): update rand_chacha requirement from 0.3 to 0.10

| | |
|---|---|
| **Hash** | `4f836588bf4c108137d632d283639e96aff9bde1` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-11 18:42:09 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [rand_chacha](https://github.com/rust-random/rand) to permit the latest version.
- [Release notes](https://github.com/rust-random/rand/releases)
- [Changelog](https://github.com/rust-random/rand/blob/master/CHANGELOG.md)
- [Commits](https://github.com/rust-random/rand/compare/rand_chacha-0.3.0...0.10.0)

---
updated-dependencies:
- dependency-name: rand_chacha
  dependency-version: 0.10.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 154. `2577d65` — feat: move Quantum Revolution book to free Amenti Library download

| | |
|---|---|
| **Hash** | `2577d65db29985450379bf9661aab887b8dcedca` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 19:48:10 +0100 |

<details><summary>Details</summary>

```
- Removed book section from mining-start.html (CZ + EN)
- Removed book-001 from products.js eShop catalog
- Added Quantum Revolution as first row in Amenti Library table (halls.html + halls-en.html)
  - Available in CZ, EN, ES, FR, PT (+ DE, JP, HIND, LA, SANS, HAWAI in books/ dir)
  - Highlighted row with rasta gradient background
- Updated books/.htaccess to allow PDF/ZIP downloads (was blocking all)
- Added *.backup to root .gitignore
```
</details>

---

### 155. `07a7de1` — audit wave 7: Docker non-root, API rate limiting, backup script, deploy user (6 findings)

| | |
|---|---|
| **Hash** | `07a7de1ef07b81ec279949078b0091e7c018bff3` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 19:53:42 +0100 |

<details><summary>Details</summary>

```
P1-26: Docker USER zion ÔÇö non-root runtime for core, pool, miner containers
P1-30: DEPLOY_USER env var in all deploy scripts (switchable from root to zion)
P1-36: API rate limiting ÔÇö 120 req/min per IP, 429 Too Many Requests
P1-39: Backup script ÔÇö Redis BGSAVE + LMDB copy, 7d/4w retention, cron-ready
P2-11: Node.js unified to node:22-alpine LTS (was 24 dev, 20 prod)
P2-22: Guardians API returns 501 Not Implemented (was 200 with fake data)

Total fixed: 54/77 findings (score ~8.5/10, from 5/10)
```
</details>

---

### 156. `fbc0323` — feat: add featured Quantum Revolution ZIP download card to Amenti Library

| | |
|---|---|
| **Hash** | `fbc03232af552bd296c0ceaccc975b3ff38841eb` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 20:08:00 +0100 |

<details><summary>Details</summary>

```
- Added prominent download card above library table (CZ + EN)
- ZIP download (all 11 languages) + bonus materials button
- Book cover image, rasta gradient border, responsive flex layout
- Deployed to newearth.cz
```
</details>

---

### 157. `db99aa2` — chore: remove bonus materials button from Amenti Library

| | |
|---|---|
| **Hash** | `db99aa2e1a3705e3e90911a33f8891a7fd25e6cb` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 20:19:33 +0100 |

---

### 158. `69b308a` — fix: correct Vzestup portal link to vzestup.webpark.cz mirror

| | |
|---|---|
| **Hash** | `69b308ab027d0122c2cda9b317fdeb76346a7c32` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 20:23:11 +0100 |

---

### 159. `5487b75` — feat: redesign Vzestup portal - modern V2 violet theme with full content catalog

| | |
|---|---|
| **Hash** | `5487b75c4b4a944e413f527ca3bb375709c20773` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 20:59:36 +0100 |

<details><summary>Details</summary>

```
- Replace HTTrack stub index.html with modern responsive design
- Violet/gold color scheme matching V2 aesthetics
- 6 main portal cards: Fialov├Ż plamen, Duchovn├ş ┼íkola, Moudrosti, Knihy, Reconnection, WingMakers
- Expandable article lists for Karen Danrich and Moudrosti sections
- Dedicated sections: Lyara (48 articles), Sheldan Nidle (10), V┼»le Bo┼ż├ş (12), Metatron (15)
- ASEA, Language of Light, and Links cards
- All original content preserved with working links
- Fixed floating back button to Amenti
- Mobile responsive design
- Updated halls.html + halls-en.html links to new index
```
</details>

---

### 160. `085b0f0` — fix: add pointer-events:none to rasta-card::before overlay blocking clicks

| | |
|---|---|
| **Hash** | `085b0f0aa6b4122fb3926c5450aac0e47810dc83` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 21:35:04 +0100 |

---

### 161. `8dc52f8` — feat: redesign Vzestup card in Amenti - portal image banner with violet gradient

| | |
|---|---|
| **Hash** | `8dc52f84281e10239fb2dc167c28c6da743ccf9c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 21:38:01 +0100 |

---

### 162. `0080fb2` — V2 responsive: fix globals, clamp fonts, slider responsive, inline->CSS classes, footer HTML fix (18 files)

| | |
|---|---|
| **Hash** | `0080fb21f9850503916901924edcdbcb89dafc91` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 21:53:02 +0100 |

---

### 163. `eec3c24` — Responsive menu: overlay backdrop, scroll lock, dvh sidebar, Escape close, 480px fix, touch feedback

| | |
|---|---|
| **Hash** | `eec3c247a4454f776a22a13c2d5198c915e8e2f8` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 21:55:58 +0100 |

---

### 164. `efde491` — Amenti Library: add Quantum Revolution Claude Edition to book table (CZ+EN)

| | |
|---|---|
| **Hash** | `efde491eeeff74e10d9399698e04d8fc706dda34` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 22:07:06 +0100 |

---

### 165. `d7a1824` — fix: skip P2P rate limiter during IBD + Docker ZION_DATA_DIR + compose hardening

| | |
|---|---|
| **Hash** | `d7a1824e78b814bfe2a7183b68a94a4b5100f2f5` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 23:08:26 +0100 |

<details><summary>Details</summary>

```
- P2P: Wrap message rate limiter in is_ibd guard to prevent
  false-positive flood bans during Initial Block Download.
  Peers legitimately exchange hundreds of block msgs/min during IBD.
- Dockerfile.core: Add ENV ZION_DATA_DIR=/data/zion and WORKDIR so
  peers.json is saved inside mounted volume (fixes Permission denied).
- docker-compose.testnet.yml: Add ZION_DATA_DIR env, increase healthcheck
  start_period 30s to 60s, retries 3 to 5, declare volumes external.

Deployed and verified on Helsinki and Germany - both H=1316, healthy.
```
</details>

---

### 166. `8a65b3a` — website-v2.9: comprehensive responsive + speed optimization

| | |
|---|---|
| **Hash** | `8a65b3a34a4d727eddf8950612ddc1041e3b2380` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 23:16:00 +0100 |

<details><summary>Details</summary>

```
SPEED OPTIMIZATIONS:
- Dynamic import BackgroundOrchestrator + BackgroundToggle (no SSR, lazy load)
- New ClientBackgrounds wrapper for Next.js 16 Server Component compat
- Fix memory leaks: MatrixRain + CyberGrid now properly cancelAnimationFrame
- Add prefers-reduced-motion support to all canvas animations
- Add loading.tsx skeleton for /dashboard route
- Add GPU acceleration hints for fixed canvas elements
- Add body.menu-open scroll lock class

RESPONSIVE FIXES (19 issues fixed):
Navigation:
- Full mobile menu overhaul: slide-in panel + backdrop overlay
- Scroll lock when menu open, Escape key closes, resize resets
- Min 44px touch targets on all interactive elements
- Route change auto-closes menu
- WARP STATUS hidden on mobile to save space

MissionControlDashboard:
- All 12+ sections: responsive padding (p-4 sm:p-6 lg:p-8)
- All section headings: text-xl sm:text-2xl lg:text-3xl
- Hero h1: text-3xl sm:text-4xl md:text-5xl lg:text-6xl
- Stat grid values: responsive text sizing
- Tab bar: show labels at all sizes (was hidden on mobile)
- PhaseAccordion: flex-wrap on mobile, hide progress bar on small
- SprintRow: compact padding + font sizes on mobile
- BigProgress: stack dates vertically on mobile
- ServerCard: responsive padding, text, badge sizes
- MiniMetric: smaller padding + text on mobile
- PoolNodeCard: responsive layout
- Gantt chart: scrollable on mobile with min-width
- Constitution tab: responsive padding + text sizing
- Economy burn card: responsive sizing
- Timeline panels: responsive padding + spacing
- LogConsole: horizontal overflow scroll on mobile
- Timeline dots: adjusted position for mobile pl-6

CSS:
- prefers-reduced-motion: disable all animations
- slideIn keyframe for mobile menu
- body.menu-open scroll lock
- GPU hints for fixed canvases
```
</details>

---

### 167. `cf62f3d` — docs: update REPORT.md ÔÇö 11.2. full audit deploy, P2P IBD fix, website v2.9 responsive, 72h stability run

| | |
|---|---|
| **Hash** | `cf62f3d5c39b76d1846c2eda2f943479753a391f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-11 23:57:43 +0100 |

---

## 2026-02-12

### 168. `b3731bc` — fix(explorer): block reward divisor 1e6 instead of 1e12 ÔÇö shows 5400 ZION not 5.4

| | |
|---|---|
| **Hash** | `b3731bcb7e40b9ea6ef013d7b4125ba36b1eef2b` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 00:20:44 +0100 |

---

### 169. `ebf9e1e` — genesis: inscribe message in coinbase ÔÇö "For Sarah Issobel, Maitreya Buddha, Sita, and all the children of this world: Zion is yours. Build a better world where you reach for the stars. The Golden Age begins. Peace & One Love 4ever. ÔÇö Dad | Hooray to the Egg! Hiranyagarbha"

| | |
|---|---|
| **Hash** | `ebf9e1e69a05a643133b2d70ab31c3f1e0e855f4` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 00:37:51 +0100 |

---

### 170. `3c1f392` — genesis: update message ÔÇö add Radha, Friends, Family, Freedom Humanity; sign as Yose/Zion Creator

| | |
|---|---|
| **Hash** | `3c1f392c2af35422905a1c6b22913dc3b0357a5a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 00:41:56 +0100 |

---

### 171. `75bba1f` — genesis: full ASCII art Tree of Life + ZION logo + dedication inscribed in block 0 coinbase (4.5 KB)

| | |
|---|---|
| **Hash** | `75bba1f5dfd1fca976f1c516c523b01faefd56b4` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 00:50:38 +0100 |

---

### 172. `5330149` — fix: reward display 1e9Ôćĺ1e6 across all API routes and components (ZION has 6 decimal places, not 9)

| | |
|---|---|
| **Hash** | `53301495588b7cf140550c9d2525e47170f583f9` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 01:04:53 +0100 |

---

### 173. `e58d11c` — feat: interactive Tree of Life on homepage ÔÇö SVG organic tree + canvas energy particles + genesis message

| | |
|---|---|
| **Hash** | `e58d11c50cb7632ad83f80dfb55b34bd6174962a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 02:41:39 +0100 |

---

### 174. `3517a1f` — ­čî│ Tree of Life v2: fireflies, falling leaves, aurora, parallax, bioluminescent roots, fog, live block height

| | |
|---|---|
| **Hash** | `3517a1f352f9827035c48c695d0adb0f774317d3` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 02:59:35 +0100 |

<details><summary>Details</summary>

```
- 3 particle types: energy (80), fireflies (20), falling leaves (8)
- Aurora borealis background glow (emerald + cyan + gold)
- Parallax tilt on mouse movement via framer-motion springs
- Bioluminescent pulsing root overlays with SVG animations
- Ground fog layer with subtle breathing animation
- Bark texture: dual edge paths + bark line details
- 90+ procedural leaves across 22 organic cluster centers
- Rare golden leaves (8% chance)
- Crown glow with pulsing star
- Live block height display in root zone (auto-refreshes every 15s)
- Falling leaf particles with bezier shape, spin, wobble
- Firefly particles with lazy wander + pulse brightness
- Canvas particle system: radial gradients, mouse attraction
- Genesis overlay with cinematic motion reveal
- Grass tufts with wind sway animation
```
</details>

---

### 175. `5d2386d` — ­čÄČ Tree of Life v3 ÔÇö The Fountain (2006) cinematic edition

| | |
|---|---|
| **Hash** | `5d2386dc488ee53f1d64e024e1dde6ff64c8eadc` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 03:12:12 +0100 |

<details><summary>Details</summary>

```
Inspired by Darren Aronofsky's The Fountain:
ÔÇó Deep space starfield background with 200+ SVG stars
ÔÇó Golden nebula cloud particles (12 large soft drifters)
ÔÇó Translucent cosmic bubble/sphere enclosing the tree
ÔÇó Intense golden energy pulsing through trunk & roots
ÔÇó 90 stardust particles rising from tree into cosmos
ÔÇó 25 golden tendrils spiraling upward from canopy
ÔÇó Falling golden seed/petals drifting through nebula
ÔÇó Crown star with cross flare at apex
ÔÇó Golden canopy with 90+ leaves (amber + emerald mix)
ÔÇó Mouse interaction attracts stardust, parallax tilt
ÔÇó Genesis message overlay on trunk click
ÔÇó Live block height display at root zone
ÔÇó 880 lines of cosmic consciousness
```
</details>

---

### 176. `a74ff4b` — ­čĽë´ŞĆ Tree of Life v4 ÔÇö Ancient Bodhi / Mount Kailash Edition

| | |
|---|---|
| **Hash** | `a74ff4b2015debf25c05079977795db3ba1165a7` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 03:27:31 +0100 |

<details><summary>Details</summary>

```
Massive transformation into ancient mystical scene:
ÔÇó Ancient gnarled trunk (30px wide) with bark texture, knots & hollow
ÔÇó Two secondary split trunks creating massive canopy spread
ÔÇó 65+ branches including drooping ancient hanging branches
ÔÇó 140+ leaves in dense golden-emerald canopy (46 cluster centers)
ÔÇó 18 massive roots spreading across the earth
ÔÇó 6 bark texture lines + 7 knots on trunk
ÔÇó Mount Kailash silhouette with snow cap (right background)
ÔÇó Secondary mountain ridge (left background)
ÔÇó Sacred campfire with 3 animated flame layers + 10 stones
ÔÇó Circle of 8 meditating masters around the fire
ÔÇó Fire sparks (30 canvas particles) rising from flames
ÔÇó Fire glow illuminating ground, masters & trunk base
ÔÇó Night sky gradient with 180 stars (upper half)
ÔÇó Ground plane with earth texture
ÔÇó 1199 lines of ancient wisdom ÔÇö ÓĄÁÓąâÓĄĽÓąŹÓĄĚ ÓĄťÓąÇÓĄÁÓĄĘ
```
</details>

---

### 177. `65e136a` — ÔÜí Tree of Life v4.1 ÔÇö perf + design polish

| | |
|---|---|
| **Hash** | `65e136ad97a702be3436e6afb9bf6b148328e52a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 03:37:08 +0100 |

<details><summary>Details</summary>

```
- Added adaptive performance budget () for mobile/reduced-motion
- Reduced particle load dynamically by device preference
- Replaced 5x per-frame filter counts with single-pass counting
- Lowered expensive glow work on low-performance profiles
- Tuned section spacing for smoother page flow
- Styled component container with subtle glass/border shadow integration
- Improved typography contrast for better visual consistency
- Switched  to  to satisfy lint hint
```
</details>

---

### 178. `28e7172` — ÔťĘ Switch homepage Tree section to Spline

| | |
|---|---|
| **Hash** | `28e7172251cb748fa0d4dd64752b65f4a589e1fe` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 03:45:08 +0100 |

<details><summary>Details</summary>

```
- Added @splinetool/react-spline dependency
- New SplineTreeOfLife component with premium 3D embed container
- Homepage now uses SplineTreeOfLife instead of custom SVG scene
- Added NEXT_PUBLIC_SPLINE_TREE_SCENE support for custom scene URL
- Tailwind utility cleanup for lint consistency
```
</details>

---

### 179. `05618bc` — chore(deps-dev): bump tailwindcss from 4.1.17 to 4.1.18 in /website-v2.9

| | |
|---|---|
| **Hash** | `05618bc34dba1b5decbd482872874580c48c2925` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-12 02:46:47 +0000 |

<details><summary>Details</summary>

```
Bumps [tailwindcss](https://github.com/tailwindlabs/tailwindcss/tree/HEAD/packages/tailwindcss) from 4.1.17 to 4.1.18.
- [Release notes](https://github.com/tailwindlabs/tailwindcss/releases)
- [Changelog](https://github.com/tailwindlabs/tailwindcss/blob/main/CHANGELOG.md)
- [Commits](https://github.com/tailwindlabs/tailwindcss/commits/v4.1.18/packages/tailwindcss)

---
updated-dependencies:
- dependency-name: tailwindcss
  dependency-version: 4.1.18
  dependency-type: direct:development
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 180. `8905d57` — chore(deps): bump @react-three/drei in /website-v2.9

| | |
|---|---|
| **Hash** | `8905d572e154cba0815aff9d208e58b4b171a8c0` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-12 02:46:47 +0000 |

<details><summary>Details</summary>

```
Bumps [@react-three/drei](https://github.com/pmndrs/drei) from 10.7.6 to 10.7.7.
- [Release notes](https://github.com/pmndrs/drei/releases)
- [Changelog](https://github.com/pmndrs/drei/blob/master/release.config.js)
- [Commits](https://github.com/pmndrs/drei/compare/v10.7.6...v10.7.7)

---
updated-dependencies:
- dependency-name: "@react-three/drei"
  dependency-version: 10.7.7
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 181. `6a3959e` — chore(deps): bump react-dom and @types/react-dom in /website-v2.9

| | |
|---|---|
| **Hash** | `6a3959e0c332c7c7ede8006dc1d00e2c8c554b7f` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-12 02:46:52 +0000 |

<details><summary>Details</summary>

```
Bumps [react-dom](https://github.com/facebook/react/tree/HEAD/packages/react-dom) and [@types/react-dom](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/react-dom). These dependencies needed to be updated together.

Updates `react-dom` from 19.2.0 to 19.2.4
- [Release notes](https://github.com/facebook/react/releases)
- [Changelog](https://github.com/facebook/react/blob/main/CHANGELOG.md)
- [Commits](https://github.com/facebook/react/commits/v19.2.4/packages/react-dom)

Updates `@types/react-dom` from 19.2.2 to 19.2.3
- [Release notes](https://github.com/DefinitelyTyped/DefinitelyTyped/releases)
- [Commits](https://github.com/DefinitelyTyped/DefinitelyTyped/commits/HEAD/types/react-dom)

---
updated-dependencies:
- dependency-name: react-dom
  dependency-version: 19.2.4
  dependency-type: direct:production
  update-type: version-update:semver-patch
- dependency-name: "@types/react-dom"
  dependency-version: 19.2.3
  dependency-type: direct:development
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 182. `b9ed65c` — chore(deps): bump @react-three/fiber in /website-v2.9

| | |
|---|---|
| **Hash** | `b9ed65cbfff435326cf4695347c8ef8186178fa1` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-12 02:46:54 +0000 |

<details><summary>Details</summary>

```
Bumps [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) from 9.4.0 to 9.5.0.
- [Release notes](https://github.com/pmndrs/react-three-fiber/releases)
- [Commits](https://github.com/pmndrs/react-three-fiber/compare/v9.4.0...v9.5.0)

---
updated-dependencies:
- dependency-name: "@react-three/fiber"
  dependency-version: 9.5.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 183. `e9ce187` — chore(deps-dev): bump eslint from 9.39.1 to 10.0.0 in /website-v2.9

| | |
|---|---|
| **Hash** | `e9ce187434a7156415055ae1230d26eca926dee7` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-12 02:47:05 +0000 |

<details><summary>Details</summary>

```
Bumps [eslint](https://github.com/eslint/eslint) from 9.39.1 to 10.0.0.
- [Release notes](https://github.com/eslint/eslint/releases)
- [Commits](https://github.com/eslint/eslint/compare/v9.39.1...v10.0.0)

---
updated-dependencies:
- dependency-name: eslint
  dependency-version: 10.0.0
  dependency-type: direct:development
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 184. `4de0a67` — ­čÜĹ Hotfix: rollback homepage Tree from Spline to stable component

| | |
|---|---|
| **Hash** | `4de0a67c1684509266617649b717df736cafc302` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 12:46:44 +0100 |

---

### 185. `83d9c60` — ­čŤí´ŞĆ Safe Tree switch: stable by default, Spline on ?tree=spline with fallback

| | |
|---|---|
| **Hash** | `83d9c60b4f7ecb86db3549e0d7871c499ffb97fe` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 12:54:07 +0100 |

---

### 186. `898436b` — ­čÄ» Make Spline Tree default with safe classic override (?tree=classic|old)

| | |
|---|---|
| **Hash** | `898436bcc9ee06e806e7a4517a47ba8ca4adc9a5` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 13:00:05 +0100 |

---

### 187. `f35e436` — ­čĺä Spline default UX: replace old-tree loading fallback with neutral skeleton

| | |
|---|---|
| **Hash** | `f35e436de2e1103660e2f2e397bec6cf745d6ac9` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 13:09:37 +0100 |

---

### 188. `05ba7ef` — ­čÄČ Tree switch UX fix: no classic fallback on Spline errors (keep modern default)

| | |
|---|---|
| **Hash** | `05ba7efeee1b87164fe947529863fc689ff83f2a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 13:21:09 +0100 |

---

### 189. `25c6732` — ­čöÉ Fix Spline CSP: allow prod.spline.design in connect-src

| | |
|---|---|
| **Hash** | `25c67329c5b3addc917867701d6c305d142c181b` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 13:26:47 +0100 |

---

### 190. `f743a00` — ­čî│ Replace Spline cube with built-in cinematic 3D Tree scene

| | |
|---|---|
| **Hash** | `f743a00cae26a9f4066a540a43399cc372561f67` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 13:37:16 +0100 |

---

### 191. `a4b9195` — ­čÜÇ Fix deploy blocker + replace cube with real 3D tree scene

| | |
|---|---|
| **Hash** | `a4b9195eb9789c4db9f150d0c4de400007efa296` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 13:51:13 +0100 |

<details><summary>Details</summary>

```
- Replaced Spline demo/cube with built-in cinematic 3D tree (R3F)
- Fixed TS type blockers that prevented Docker build on server:
  - NetworkStatus ( typing)
  - ProExplorerStats ( typing)
  - ProSearchBar ( typing)
- Local Next production build now passes
```
</details>

---

### 192. `7cf1dd5` — ÔťĘ Enhance Tree scene: stronger fire, detailed Kailash, moon-planets, sacred figures, Oasis invite

| | |
|---|---|
| **Hash** | `7cf1dd5124fa89d4dca23e20fcd6dccfb4c86bcf` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 14:04:14 +0100 |

---

### 193. `84d8900` — fix(P2P): MAX_REORG_DEPTH 10Ôćĺ50 + force_allow IBD reorg bypass\n\n- chain.rs: MAX_REORG_DEPTH increased from 10 to 50 for testnet\n- state/mod.rs: reorg_to_fork() takes force_allow: bool param\n  - When true, bypasses MAX_REORG_DEPTH check regardless of is_ibd()\n  - Fixes timing bug: exit_ibd() called before reorg_to_fork()\n- p2p/mod.rs: IBD handler passes force_allow=true\n- Tests updated: constant assertion 10Ôćĺ50, depth test uses 55>50\n- REPORT.md: Added 12.2.2026 session (fork diagnosis + fix + deploy)\n\nRoot cause: Germany forked at block 1798, built 11 blocks on wrong\nfork. MAX_REORG_DEPTH=10 prevented resync (11>10). IBD bypass failed\nbecause exit_ibd() runs before reorg_to_fork() ÔÇö is_ibd() was false.\n\nDeployed to both Helsinki (ARM64) and Germany (x86_64).\nBoth nodes synced at height 1978, P2P healthy."}

| | |
|---|---|
| **Hash** | `84d8900c471c90bd8c7db6852df83d5e2c9f0663` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 14:06:39 +0100 |

---

### 194. `9dc9a2f` — ­čÉŤ Fix JSX closing tag in enhanced Tree scene

| | |
|---|---|
| **Hash** | `9dc9a2f9a7c53b216fbd18ae0a63a97b0cc57983` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 14:12:46 +0100 |

---

### 195. `9c15145` — fix: increase health check threshold from 300s to 900s for testnet

| | |
|---|---|
| **Hash** | `9c15145334f7ccc06fd91cad984547b8a83fae00` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 21:20:14 +0100 |

<details><summary>Details</summary>

```
On testnet with low hashrate, blocks can take 15+ minutes between
each other. The previous 5-minute threshold caused false NODE_UNHEALTHY
status on both Helsinki and Germany servers.

Changes:
- core_metrics.rs: health threshold 300s -> 900s (15 min)
- endpoints.rs: readiness threshold 300s -> 900s (15 min)

Also fixed Germany Docker network mismatch (core on zion-net,
pool on docker_zion-net) - same issue as Helsinki had before.
Recreated core container with --network-alias core on docker_zion-net.
```
</details>

---

### 196. `bbe7c01` — fix(miner+pool): stabilize hashrate parsing and pool miner metrics aggregation

| | |
|---|---|
| **Hash** | `bbe7c01567230c35d0b74b7aa379c2f225edd266` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 21:49:21 +0100 |

---

### 197. `ae2cb24` — web: show live Prometheus miner metrics via API proxy

| | |
|---|---|
| **Hash** | `ae2cb245ae0528c1d770c0027db04c2d95488e97` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 22:01:33 +0100 |

---

### 198. `38e4443` — miner: pin CHv3 by default and stabilize hashrate parsing

| | |
|---|---|
| **Hash** | `38e44434075bb231968bd08a9abf02bad829f249` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-12 22:16:30 +0100 |

---

## 2026-02-13

### 199. `7f1ec2c` — v2.9.5: reorg-fix deploy, dashboard fix, Docker cleanup

| | |
|---|---|
| **Hash** | `7f1ec2c21d877e4afe6d4521cfb72705fc283a4d` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 00:58:48 +0100 |

<details><summary>Details</summary>

```
- Core: 2 reorg bugs fixed (cumulative_difficulty, contiguity check)
- Pool: stream_scheduler, shares validator/processor improvements
- Miner: stratum + CPU mining optimizations
- Dashboard: collect_stats port 8334, Sprint v3 epoch, Redis auth fix
- MissionControlDashboard: Sprint v3 (Reorg Fix) label
- Monitoring: Prometheus configs for Helsinki + Germany
- Docker: testnet compose updated (RPC 8334, P2P 8444)
- Cleanup: removed old public_html/V2 presale files
- REPORT.md: full 9-13.2.2026 session documentation
```
</details>

---

### 200. `156f695` — chore(deps): update rand requirement from 0.8 to 0.10

| | |
|---|---|
| **Hash** | `156f6956e78e0c39736dcbb02c7a8cc91fbc2026` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-13 00:00:34 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [rand](https://github.com/rust-random/rand) to permit the latest version.
- [Release notes](https://github.com/rust-random/rand/releases)
- [Changelog](https://github.com/rust-random/rand/blob/master/CHANGELOG.md)
- [Commits](https://github.com/rust-random/rand/compare/0.8.0...0.10.0)

---
updated-dependencies:
- dependency-name: rand
  dependency-version: 0.10.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 201. `fb9ac29` — chore(deps): update criterion requirement from 0.5 to 0.8

| | |
|---|---|
| **Hash** | `fb9ac2962c6bfde21937da689b43b1fcc8bbca6d` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-13 00:00:38 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [criterion](https://github.com/criterion-rs/criterion.rs) to permit the latest version.
- [Release notes](https://github.com/criterion-rs/criterion.rs/releases)
- [Changelog](https://github.com/criterion-rs/criterion.rs/blob/master/CHANGELOG.md)
- [Commits](https://github.com/criterion-rs/criterion.rs/compare/0.5.0...criterion-v0.8.2)

---
updated-dependencies:
- dependency-name: criterion
  dependency-version: 0.8.2
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 202. `85e7b4b` — fix(explorer): swap RPC/P2P ports in network-config.ts (8444Ôćĺ8334)

| | |
|---|---|
| **Hash** | `85e7b4b3ab5df095dff0746f32e805dbc88d1d0e` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 01:09:31 +0100 |

<details><summary>Details</summary>

```
Explorer was showing all zeros because network-config.ts had
rpc: 8444 (P2P port) instead of rpc: 8334 (actual RPC port).
Same port swap issue that hit collect_stats.sh earlier.
```
</details>

---

### 203. `ab8762d` — fix(explorer): merge RPC+REST sources in getInfo() for tx_count, connections

| | |
|---|---|
| **Hash** | `ab8762d223dd6628360cb126155b026cada64249` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 01:15:29 +0100 |

<details><summary>Details</summary>

```
getInfo() used 'src = stats || rpcInfo' which always preferred /stats REST.
/stats doesn't have tx_count, incoming/outgoing connections, block_size, etc.
Now properly merges both sources: /stats for peers/mempool, get_info for tx/connections.
```
</details>

---

### 204. `3a7f38a` — fix(explorer): use blockchain balance instead of pool-only balance

| | |
|---|---|
| **Hash** | `3a7f38a954d2f803747ab7fc530e682e692759b1` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 01:27:36 +0100 |

<details><summary>Details</summary>

```
Address page was showing 0 balance because it only checked pool's
/miner/{addr} endpoint (which returns 404). Now fetches real balance
from core daemon /api/address/{addr}/balance endpoint.

Mining address zion1q893... now correctly shows 5,724,071 ZION.
```
</details>

---

### 205. `56d78fe` — refactor(nav): move Mining Guides + Node Setup under /mining

| | |
|---|---|
| **Hash** | `56d78fea596a210bf8e0577efa9f133a8b6d9f0f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 07:52:06 +0100 |

<details><summary>Details</summary>

```
- /mining/guides ÔÇö Mining Guides (CPU, GPU, pool, solo)
- /mining/node-setup ÔÇö Node Setup (was /node-setup)
- /node-setup now redirects to /mining/node-setup
- Navigation reorganized: both pages under Stacks > Mining group
- Updated internal links in MiningGuidesClient, NodeSetupClient, Dashboard
```
</details>

---

### 206. `0a41771` — fix(nav): nest Mining Guides + Node Setup as children under Mining

| | |
|---|---|
| **Hash** | `0a4177186a983ae35b1aaaa1b169eb4db22b8201` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 08:05:27 +0100 |

<details><summary>Details</summary>

```
Desktop dropdown + mobile menu now show:
  Mining
    Ôöö Mining Guides
    Ôöö Node Setup
Instead of flat list at same level.
```
</details>

---

### 207. `3cb9446` — fix(links): replace all Yose144 GitHub refs with Zion-TerraNova org

| | |
|---|---|
| **Hash** | `3cb9446cd2e0e8faeddcd294420fab0e86c5d490` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 08:16:37 +0100 |

<details><summary>Details</summary>

```
Fixed 14 occurrences across 12 files:
- GitHub links: Yose144/Zion-2.9.5 Ôćĺ Zion-TerraNova
- git clone URLs: github.com/Yose144/... Ôćĺ github.com/Zion-TerraNova/...
- Docker images: ghcr.io/yose144/... Ôćĺ ghcr.io/zion-terranova/...
- Discord: discord.gg/zion Ôćĺ discord.gg/zion-terranova

Files: Footer, Hero, NodeSetup, PoolDashboard, MiningClient,
MiningGuidesClient, Explorer, Docs, API Reference, Network,
Roadmap, Download, Warp, DAO (already correct)
```
</details>

---

### 208. `5d58972` — docs: add PUBLIC_REPO_PLAN.md ÔÇö publication plan for Zion-TerraNova/2.9.5-NativeAwakening

| | |
|---|---|
| **Hash** | `5d58972ecb3f7cb2c3ea41bffe6e27af3812ab59` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 08:31:33 +0100 |

<details><summary>Details</summary>

```
Comprehensive audit of all files:
- 55 items marked SAFE to publish (core, miner, pool, cosmic-harmony, legal, whitepaper, guides)
- 30+ items marked DO NOT PUBLISH (private keys, passwords, server IPs, SSH, deploy scripts)
- 12 items need scrubbing before publication (IPÔćĺDNS, URL fixes)
- Security checklist included
```
</details>

---

### 209. `9812063` — ­čôő PUBLIC_REPO_PLAN.md: aktualizace bezp. auditu Rust k├│du (C1-C3, H1-H5, M1) + roz┼í├ş┼Öen├Ż checklist

| | |
|---|---|
| **Hash** | `9812063ed6560903aa9f347ec76adae26843a435` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 08:58:59 +0100 |

---

### 210. `57bc706` — Add wallet + miner binaries + public docs

| | |
|---|---|
| **Hash** | `57bc706696766eabca3e45c3bfa4653afa805252` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 16:54:05 +0100 |

<details><summary>Details</summary>

```
Wallet CLI v2.9.5:
- zion-wallet-linux-x86_64 (5.5 MB)
- zion-wallet-linux-arm64 (5.3 MB)
- zion-wallet-macos-arm64 (4.7 MB)

Miner CLI v2.9.5:
- zion-miner-linux-x86_64 (5.5 MB)
- zion-miner-linux-arm64 (4.9 MB)
- zion-miner-macos-arm64 (4.4 MB)

Documentation:
- MINING_GUIDE.md (CZ/EN)
- Whitepaper v2.9.5 (10 chapters)
- Mainnet Constitution
- ROADMAP
```
</details>

---

### 211. `fc81a18` — fix(revenue): stabilize ext-share routing and document VRSC pivot

| | |
|---|---|
| **Hash** | `fc81a18823a27ee78512256b23a0d0a189078a32` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 16:59:27 +0100 |

---

### 212. `c9dbb33` — Add ZION node binaries v2.9.5 (3 platforms)

| | |
|---|---|
| **Hash** | `c9dbb33e3e93e329881a5e09f4bb7b5596cc2bc2` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 17:00:25 +0100 |

<details><summary>Details</summary>

```
- zion-node-linux-x86_64
- zion-node-linux-arm64
- zion-node-macos-arm64
```
</details>

---

### 213. `029ee74` — Docs: complete beginner + pro runbook (miner, wallet, node)

| | |
|---|---|
| **Hash** | `029ee74836c56de866e0c8d47e37fc5f6600ca8f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-13 17:10:33 +0100 |

---

### 214. `b009ca7` — index on main: 61244ef docs: session report 9.2.2026 ÔÇö 10 bug fixes, deploy status, roadmap tracking

| | |
|---|---|
| **Hash** | `b009ca79f8ae40139d633997f714f3a815e93642` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-13 17:47:53 +0100 |

---

### 215. `a6bfe49` — On main: temp-before-pull-2026-02-13

| | |
|---|---|
| **Hash** | `a6bfe49ae646e6f010e80ea37890044fb5a96bfe` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-13 17:47:53 +0100 |

---

### 216. `8fd6928` — fix(consensus): make timestamp drift network-specific (testnet/mainnet)

| | |
|---|---|
| **Hash** | `8fd6928d01a619092d805515f66d019b30d0452c` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-13 17:55:04 +0100 |

---

### 217. `560c71b` — release(public): add Windows 11 x64 binaries for node/wallet/miner

| | |
|---|---|
| **Hash** | `560c71bade4ff4e1e08a81c31f06f8dccb05ec7c` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-13 18:00:36 +0100 |

---

### 218. `74081e9` — fix(desktop-agent): resolve miner path lookup on Win11 and harden prestart discovery

| | |
|---|---|
| **Hash** | `74081e99c17c3fe9b1536069fe493beea9f724fa` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-13 18:15:06 +0100 |

---

### 219. `8b990fc` — fix(gpu): complete OpenCL kernel rewrite ÔÇö GPU mining 53 MH/s, shares accepted

| | |
|---|---|
| **Hash** | `8b990fce087ba67f30e6acb53f785d09ac346d47` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-13 19:55:31 +0100 |

<details><summary>Details</summary>

```
- Regenerate OpenCL.lib from system DLL (123 symbols)
- Fix build.rs: add gpu/cuda features to native-libs search path
- Fix CL_INVALID_WORK_GROUP_SIZE: local=64, global rounded up
- Add is_algo_supported() + ethash job filtering
- Add CPU hash recomputation for GPU-found nonces
- CRITICAL: Complete kernel rewrite (cosmic_harmony_v3.cl):
  - golden_matrix: fixed-point PHI_POWERS_FP matrix multiply
  - cosmic_fusion: 4x Keccak256 + COSMIC_XOR_MASK + SHA3-512
  - Difficulty check: u32_le(hash[0..4]) <= target_u32
- opencl.rs: pass u32 target instead of u64
- GPU: 53 MH/s on AMD gfx1010, 16+ shares accepted (94%)
- CPU: ~500 kH/s, 185+ shares accepted
- Update REPORT.md with GPU mining session details
```
</details>

---

## 2026-02-14

### 220. `f536c9d` — Docs: complete wallet+node+miner guide (beginner+pro, W11 support)

| | |
|---|---|
| **Hash** | `f536c9d1fa0946527787ef27709fba49c7242f57` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 01:39:49 +0100 |

---

### 221. `37ba182` — fix(chv3): tune miner cadence and stabilize pool reconnect handling

| | |
|---|---|
| **Hash** | `37ba1828c00a59c0b2abb535e9bb0f171106bef2` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 01:44:48 +0100 |

---

### 222. `6f755e0` — feat(vrsc): add VerusHash + Zcash revenue path (cpu coin switch)

| | |
|---|---|
| **Hash** | `6f755e0e76746f538d5ebb02cb8eb52dedba94c4` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 02:40:46 +0100 |

---

### 223. `5ea9a47` — website: consolidate Mining, Knowledge & Download sections\n\n- Unified /mining, /mining/guides, /mining/node-setup into single page\n- Embedded Rich List into Explorer page (bottom section with #richlist anchor)\n- Moved Philosophy into Docs as special TSX category\n- Added Download page with all v2.9.5 binary links\n- Simplified Knowledge nav: Explorer, Genesis, API, Docs\n- Created redirects for all old URLs\n- RichListClient refactored with embedded prop\n- PhilosophyContent extracted as reusable component

| | |
|---|---|
| **Hash** | `5ea9a47746f14032bf7360220d49dd331ebdb0ec` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 02:53:38 +0100 |

---

### 224. `b556d4f` — docs(chv3): update VRSC progress and runtime status

| | |
|---|---|
| **Hash** | `b556d4fb10f643e44417a0e6a5b5507d61739c4a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 03:02:08 +0100 |

---

### 225. `91f9e5c` — feat(chv3): add memory-hard scratchpad layer for ASIC resistance

| | |
|---|---|
| **Hash** | `91f9e5c96649b97230f3893e997171f6c43927af` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 03:24:30 +0100 |

---

### 226. `2802b87` — docs: kompletn├ş overhaul dokumentace ÔÇö re├íln├í data v2.9.5, bez placeholder┼»

| | |
|---|---|
| **Hash** | `2802b873767dca754f2cdd1fe736bb955d56a6c0` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 03:35:54 +0100 |

<details><summary>Details</summary>

```
- page.tsx: reorganizace kategori├ş (8 sekc├ş), CZ n├ízvy, opraven├Ż GitHub URL
- index.md: kompletn├ş rozcestn├şk s chain parametry a seed nody
- getting-started.md: Quick Start s Docker + build ze zdroj├ík┼» + download
- setup.md: produk─Źn├ş konfigurace (systemd, kernel tuning, monitoring)
- mining-guide.md: kompletn├ş pr┼»vodce m├şsto 30-┼Ö├ídkov├ęho stubu
- pool-setup.md: kompletn├ş pool setup (Docker, nativn├ş, systemd)
- api.md: re├íln├ę JSON-RPC endpointy (get_info, get_supply, get_block, atd.)
- faq.md: FAQ s re├íln├Żmi parametry z mainnet.toml/testnet.toml
- community.md: ekosyst├ęm p┼Öehled, seed nody, roadmap
- architecture/*.md: re├íln├í architektura z konfigurace
- whitepaper/(governance|security|roadmap).md: roz┼í├ş┼Öeno ze stub┼»
- whitepaper-lite.md: p┼Öeform├ítov├íno s re├íln├Żmi ─Ź├şsly
- tutorials/*: p┼Öeps├íno s re├íln├Żmi RPC p┼Ö├şklady
- Smaz├íny: COSMIC_MAP README (bezpe─Źnostn├ş riziko - absolutn├ş cesty)
- Smaz├íny: orphaned stuby (consciousness-levels, integration-web33, legacy/*)
- Smaz├íny: whitepaper/index.md (nefunk─Źn├ş odkazy)
- Deployed na Helsinki: build OK, HTTP 200
```
</details>

---

### 227. `ed9fcf8` — feat(chv3): add height-aware memory-hard rollout selector

| | |
|---|---|
| **Hash** | `ed9fcf8dad8c29b958b8507bb62900e62c1f3773` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 03:44:21 +0100 |

---

### 228. `4c56e4c` — fix(chv3): guard GPU CH stream when memory-hard is active

| | |
|---|---|
| **Hash** | `4c56e4cd91276d0855172f68be88fc619e805c8f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 03:51:42 +0100 |

---

### 229. `13f8673` — chore(chv3): stage memory-hard activation at fork height 50000

| | |
|---|---|
| **Hash** | `13f8673a44d30fbb7d8888f7b556df592e8a3c55` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 03:58:44 +0100 |

---

### 230. `d20e77f` — feat(gpu): add Metal CHv3 legacy parity checker

| | |
|---|---|
| **Hash** | `d20e77f2b4f5fa76f6a7acb64a7de19f9c1f88e2` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:03:12 +0100 |

---

### 231. `a59abde` — docs: kompletn├ş p┼Öepis dokumentace ÔÇö ve┼Öejn├ę repo Zion-TerraNova, re├íln├í data v2.9.5

| | |
|---|---|
| **Hash** | `a59abde3273b6035d72dbc0e5cbe67f496ecf09d` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:07:26 +0100 |

<details><summary>Details</summary>

```
- P┼Öeps├íno 14 markdown soubor┼» s konzistentn├şmi daty z config/mainnet.toml
- V┼íechny GitHub odkazy: Zion-TerraNova (ve┼Öejn├í org), ne Yose144 (priv├ítn├ş)
- genesis.html: 16 odkaz┼» opraveno na 2.9-QuantumLeap
- page.tsx: hero GitHub odkaz opraven na Zion-TerraNova
- DEPLOYMENT.md, README.md: repo URL opraveny
- Konzistentn├ş cross-linking mezi v┼íemi str├ínkami dokumentace
- Re├íln├í ─Ź├şsla: 144B supply, 5400.067 reward, LWMA DAA, porty 8333-8444
```
</details>

---

### 232. `051290c` — feat(gpu): add OpenCL CHv3 legacy parity checker

| | |
|---|---|
| **Hash** | `051290c8c57b0a74fda5bb244d0d11cc2a61542b` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:12:56 +0100 |

---

### 233. `2cd3412` — docs: p┼Öid├ín kompletn├ş Whitepaper v2.9.5 (4508 ┼Ö├ídk┼», 12 kapitol)

| | |
|---|---|
| **Hash** | `2cd34127996b71229265142f19a5ffa583c18ec8` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:16:41 +0100 |

---

### 234. `1603ff1` — fix(miner): fork-aware CHv3 GPU dispatch with CPU fallback

| | |
|---|---|
| **Hash** | `1603ff1bfb08a5cb203c51084655c384978fdd93` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:19:47 +0100 |

---

### 235. `e9c4136` — test(miner): add CHv3 fork-aware GPU routing guard tests

| | |
|---|---|
| **Hash** | `e9c4136ccfc0cb8d7da1dd64503f8cc267e5a7da` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:26:18 +0100 |

---

### 236. `1e2c592` — feat(gpu): add height-aware parity checks for CHv3 transition

| | |
|---|---|
| **Hash** | `1e2c592c077ecb55be28a15a84acf22960a2442e` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:28:48 +0100 |

---

### 237. `4e6860f` — docs: kompletn├ş redesign typografie dokumentace

| | |
|---|---|
| **Hash** | `4e6860f22488ff92c2c75a0db6dc637bb122cf2f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:30:42 +0100 |

<details><summary>Details</summary>

```
- Text zarovn├ín doleva (─Źitelnost), nadpisy centrovan├ę
- Tabulky: glass-dark design s gold headers, rounded borders
- JetBrains Mono font pro code bloky a inline code
- V─Ťt┼í├ş mezery mezi sekcemi (h2: 4rem top, hr: 3.5rem)
- Blockquoty: gold border + subtle background
- Code bloky: cyan gradient top-border, dark bg
- Responsivn├ş ├║pravy pro mobil
- Inline code: cyan border + bg styling
- Links: cyan s gold hover efektem
```
</details>

---

### 238. `c3a44fd` — feat(vrsc): configure wallet and compose env for VRSC revenue

| | |
|---|---|
| **Hash** | `c3a44fd643f1165acd3f6c478167452fb32d3120` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:34:34 +0100 |

---

### 239. `5cfa00d` — docs(vrsc): mark server runtime activation and next validation step

| | |
|---|---|
| **Hash** | `5cfa00da18cfbb15dd065fbea77b0943d1c279fb` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:37:00 +0100 |

---

### 240. `9655fe1` — docs(vrsc): confirm external share routing and reject reason

| | |
|---|---|
| **Hash** | `9655fe1353aaee275686c7b466e988032330f89a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:41:22 +0100 |

---

### 241. `8875585` — fix(vrsc): normalize zcash solution length for verushash submits

| | |
|---|---|
| **Hash** | `8875585ac7155bda6a1824568274408465258f4e` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:45:05 +0100 |

---

### 242. `083f9f2` — docs: version tree navigace + gradient nadpisy + v2.9.6 Pre-Mainnet placeholdery

| | |
|---|---|
| **Hash** | `083f9f29e49b1332702ef0443961ef0c1c9a2d1b` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:46:15 +0100 |

<details><summary>Details</summary>

```
- Sidebar: verzovan├Ż strom (v2.9.5 CURRENT / v2.9.6 PRE-MAINNET)
- Headings: gradient goldÔćĺpurpleÔćĺcyan jako hlavn├ş ZION DOKUMENTACE nadpis
- Hero: version switcher tla─Ź├ştka s GitBranch ikonkou
- Doc header: breadcrumb s verz├ş + text-gradient titulek
- v2.9.6 placeholdery (7 soubor┼»):
  changelog, migration, consensus, p2p, launch-plan, audit, tokenomics
- Sidebar roz┼í├ş┼Öen na w-72, scrollovateln├Ż, collapsible verze
- Mobiln├ş navigace s version tree
```
</details>

---

### 243. `3981ee9` — report: docs overhaul, version tree, gradient nadpisy, v2.9.6 Pre-Mainnet placeholdery

| | |
|---|---|
| **Hash** | `3981ee9cd324d98c13167884b703b6763dbd0a27` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:50:43 +0100 |

---

### 244. `c431a43` — fix(pool): make xmr fallback wallet API-compatible across branches

| | |
|---|---|
| **Hash** | `c431a43b8ba7863e9d81b5953dbee55b31b0da17` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 04:53:01 +0100 |

---

### 245. `a11efc1` — docs(v2.9.6): 6-Layer Architecture 'On the Star' + 5 tokenomics n├ívrh┼» pro 100letou vizi

| | |
|---|---|
| **Hash** | `a11efc1a99104dc43182d9e12498be6ad7222304` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 05:15:17 +0100 |

<details><summary>Details</summary>

```
- layer-architecture.md: L1 TerraNova Ôćĺ L2 NCL Ôćĺ L3 DAO Ôćĺ L4 Oasis Ôćĺ L5 Free World Ôćĺ L6 Vesm├şrn├í stanice
- 12 kandid├ít┼» na n├ízev L6 (Zenith, Aether, Celestia, Apex, Sentinel, Horizon, Stargate, Aurora, Solaris, Elysium, Pinnacle, Astria)
- tokenomics.md: 5 emission schedule n├ívrh┼» (Decade Decay, Golden Ratio, Century Constant, Dual Phase, Harmony Curve)
- N├ívrhy distribuce block reward s L5/L6 fondem (3-5%)
- Srovn├ívac├ş tabulka v┼íech variant
- page.tsx: nov├ę kategorie v navigaci (Layers, Coins ikony)
```
</details>

---

### 246. `b3c2fac` — feat(vrsc): allow zcash auth pass/difficulty hint via env

| | |
|---|---|
| **Hash** | `b3c2fac197affd45feeb54cf638216334e55d241` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 05:16:27 +0100 |

---

### 247. `1adb832` — docs(v2.9.6): z├íkladn├ş README ÔÇö 6-Layer, tokenomics status, checklist

| | |
|---|---|
| **Hash** | `1adb832c13cc2e486c082aec31f3efcb0107fcc3` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 05:22:20 +0100 |

---

### 248. `76797dc` — docs(v2.9.6): README sjednocen se strukturou v2.9.5 ÔÇö L1-L4 zachov├íno, L5/L6 p┼Öid├íno

| | |
|---|---|
| **Hash** | `76797dc4b5b53cddbdafffd146b3a19fa3f92264` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 05:47:06 +0100 |

---

### 249. `1f455c0` — blog: kompletn├ş import 26 ─Źl├ínk┼» z Blogspotu ÔÇö dynamick├Ż blog syst├ęm

| | |
|---|---|
| **Hash** | `1f455c031ee31831c81ca699ab95471781635aab` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 06:37:52 +0100 |

<details><summary>Details</summary>

```
- blog-posts.js: v┼íech 26 ─Źl├ínk┼» s inline content (CZ+EN), obr├ízky, kategorie
- blog-post.html: ─Źtec├ş ┼íablona s docs-like designem, CZ/EN toggle, prev/next navigace
- blog.html + blog-en.html: thumbnail obr├ízky v kart├ích, smart linking na blog-post.html
- admin.html: generuje content/contentEn m├şsto file, n├ívod aktualizov├ín
- img/blog/: 23 sta┼żen├Żch obr├ízk┼» z Blogspotu CDN (lok├íln├ş fallbacks)
- Blogspot zcela nahrazen. Nov├ę ─Źl├ínky se p├ş┼í├ş p┼Öes admin.html.
```
</details>

---

### 250. `60ff5e0` — blog: zachovat p┼»vodn├ş Blogspot ─Źl├ínky (full import 26x)

| | |
|---|---|
| **Hash** | `60ff5e02a778f82682dd85a83dd08b55d2a0fb7f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 07:07:47 +0100 |

<details><summary>Details</summary>

```
- generuje a hostuje pln├ę HTML kopie ─Źl├ínk┼» do public_html/V2/blog/full/
- blog-posts.js: dopln─Ťny 2 chyb─Ťj├şc├ş posty (2025/04, 2025/07) + mapov├ín├ş slugÔćĺfull file
- blog.html + blog-en.html: timeline preferuje post.file (full) a fallback na blog-post.html
- import skript: tools/import_blogspot_full.sh
```
</details>

---

### 251. `64458c9` — blog: zarovn├ín├ş na st┼Öed, ─Źist┼í├ş typografie, odstran─Ťn inline ┼íum

| | |
|---|---|
| **Hash** | `64458c9de0562835377b91b893a0631c0e273beb` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 07:19:31 +0100 |

---

### 252. `38937cf` — blog: odstran─Ťn├ş admin linku, vylep┼íen├Ż rasta design timeline

| | |
|---|---|
| **Hash** | `38937cf8859173a62b7d77b5bec6ac1755130e71` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 07:25:53 +0100 |

---

### 253. `2735f8b` — feat: unified admin panel - eShop + Blog merged into one admin.html

| | |
|---|---|
| **Hash** | `2735f8ba3917d4314885092bad2def0da449f5f5` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 08:09:01 +0100 |

---

### 254. `eb88849` — ­čĺÜ Valentine's Day 2026 ÔÇö Love is the Algorithm ÔÇö nov├Ż blog post

| | |
|---|---|
| **Hash** | `eb888492b511dc631b65d1a2add5406ad3f5fc83` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 08:34:29 +0100 |

---

### 255. `4fbedcc` — report+pool: VRSC revenue debug + scheduler race fix

| | |
|---|---|
| **Hash** | `4fbedcca2055add1d5a542f91ada465314061980` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 08:50:22 +0100 |

---

### 256. `93114cd` — report: blog system, unified admin panel, Valentine's Day 2026 post

| | |
|---|---|
| **Hash** | `93114cd83a62092f109b9c117e9bae4cae2d5ef3` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 08:53:10 +0100 |

---

### 257. `28925e2` — docs: NextSteps.md ÔÇö deep scan + prioritizovan├Ż pl├ín k mainnetu (5 tier┼»)

| | |
|---|---|
| **Hash** | `28925e27cf0a5597ac265b59814041dc0a790338` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 13:51:34 +0100 |

---

### 258. `b4dabce` — feat(vrsc): nativn├ş VerusHash C/C++ knihovna pro ARM64 + end-to-end VRSC mining flow

| | |
|---|---|
| **Hash** | `b4dabceeeac375fc18bdcd6c2f2a2a3118ade917` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 19:04:23 +0100 |

<details><summary>Details</summary>

```
- Nov├Ż crate native-libs/verushash-native/ s C FFI (haraka + verus_hash + sse2neon)
- 9/9 test┼» PASS na ARM64 serveru
- Integrace do zion-core (nahrazuje verushash-rs)
- Pool: ZcashStratum proxy s solution padding, PBaaS v7+ support
- Miner: VerusJobCtx (1487B block), nonce LE, PBaaS zeroing
- CH3 config: VRSC s 1 vl├íknem, CPU-only revenue lock
- Docker: zion-pool:2.9.5-vrscfix7 + zion-miner:2.9.5-vrscfix7
- REPORT.md aktualizov├ín s kompletn├şm VRSC progress
- docs/v2.9.6: Pre-Mainnet placeholdery (tokenomics, layer-architecture, audit...)
- Stav: shares nalezeny (342 kH/s), LuckPool rejectuje 'pool nonce missing'
```
</details>

---

### 259. `af87452` — fix(vrsc): PBaaS v7+ nonceSpace - embed extranonce1 in solution

| | |
|---|---|
| **Hash** | `af87452ff855126635c6619e159eb0589475d2ca` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 19:20:47 +0100 |

<details><summary>Details</summary>

```
ROOT CAUSE of "pool nonce missing" error found:
- LuckPool checks soln.substr(-30) for extraNonce1 presence
- For PBaaS v7+ (solution_ver > 6), pool nonce must be in
  the last 15 bytes of the solution, NOT in header nonce
- Header nonce is from daemon (rpcData.nonce), miner can't change it

FIX in cpu.rs (miner):
- PBaaS v7+ mode: iterate counting nonce in solution nonceSpace
  (last 15B: extranonce1 + padding + counting_nonce_LE)
- Header nonce zeroed for hashing (ClearNonCanonicalData)
- nonce_off now points to solution nonceSpace offset (1472)

FIX in revenue_proxy.rs (pool proxy submit):
- Embed nonceSpace into last 30 hex chars of solution before submit
- Restore hashPrevMMRRoot + hashBlockMMRRoot from original job solution
  (these were zeroed for hashing but pool expects originals)

Reference: veruscoin/node-stratum-pool processShare() line 278-286
Reference: monkins1010/ccminer verusscan.cpp line 177-223
```
</details>

---

### 260. `7abc0a4` — fix(vrsc): endianness fix meets_target() LEÔćĺBE + ARM64 hash verification + deep debug docs

| | |
|---|---|
| **Hash** | `7abc0a4993c01397d5d0df1dd2c4b186cf7ec69a` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 22:54:48 +0100 |

<details><summary>Details</summary>

```
ROOT CAUSE #5: meets_target() compared LE hash directly against BE target
- Finalize2b() returns hash in LE (byte[0]=LSB)
- Pool target is BE hex string (e.g. 0000004000...)
- Fix: reverse hash bytes LEÔćĺBE before lexicographic comparison
- Eliminates all false-positive share submissions

Verified:
- ARM64 VerusHash v2b MATCH reference, v2b1 MATCH reference
- ClearNonCanonicalData IDENTICAL to pool (node-stratum-pool)
- Buffer layout IDENTICAL (1487B = 140B header + 3B varint + 1344B sol)
- Pool share diff: bignum.fromBuffer(hash, {endian:'little'})

Files:
- miner/src/miner/cpu.rs: endianness fix + diagnostic hex dumps
- pool/src/revenue_proxy.rs: submit diagnostic logging
- native-libs: ffi_wrapper.cpp (v2b2 streaming), test_hash.cpp (new)
- REPORT.md: full vrscfix8-12 debug session documentation
- ChV3.md: updated status, progress log, GPT 5.3 handoff section
```
</details>

---

### 261. `2fcf930` — chore(vrsc): add near-hit telemetry for target sanity

| | |
|---|---|
| **Hash** | `2fcf930777768713644895f3a68ab54e9b9d7c4f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 23:02:00 +0100 |

---

### 262. `34090ca` — debug(vrsc): pool-side rehash diag to compare miner vs pool buffer

| | |
|---|---|
| **Hash** | `34090cab52f92276d99c006d8d316cd268966b79` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-14 23:36:26 +0100 |

---

## 2026-02-15

### 263. `9eafde4` — docs+pool: VRSC accepted confirmed; guard stale job submits

| | |
|---|---|
| **Hash** | `9eafde4c2d7373b71dcaf66a8586e1cb7b1b3d77` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 00:35:31 +0100 |

---

### 264. `a1d1d6a` — miner: speed up VerusHash 1-thread loop (cache target/blob)

| | |
|---|---|
| **Hash** | `a1d1d6a0c9e29b0898f660fe8c862d362bfa66c7` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 00:43:26 +0100 |

---

### 265. `ee88167` — miner: reduce VRSC share logging overhead (optional dump)

| | |
|---|---|
| **Hash** | `ee88167c233c02013ec5edb66b2569cf7d702626` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 00:46:37 +0100 |

---

### 266. `4508082` — pool: allow ZION_ZC_PASS for VRSC vardiff (default d=0.01)

| | |
|---|---|
| **Hash** | `45080829923fdfdf46abfb7fd7b8255fa971c47c` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 00:57:30 +0100 |

---

### 267. `4ed9e97` — docs: aktualizace VRSC status (vrscfix14/15)

| | |
|---|---|
| **Hash** | `4ed9e97870bdb26667fbe78eb64b1ec087a0925e` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 01:21:46 +0100 |

---

### 268. `4876653` — miner: multi-thread CPU + VerusHash 1-thread default

| | |
|---|---|
| **Hash** | `4876653110dcb73375e9dcb7de7f50c8522bfa13` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 01:30:46 +0100 |

---

### 269. `f95c9c0` — chv3: safe memory-hard override + intermediates API

| | |
|---|---|
| **Hash** | `f95c9c0a61578053e2b4bfe2b3528940c34c8a8f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 01:47:26 +0100 |

---

### 270. `82299fe` — pool: CHv3 byproduct export scaffolding (4-layer streams)

| | |
|---|---|
| **Hash** | `82299fe8689cb1f505765a47893623f6f202a280` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 01:53:32 +0100 |

---

### 271. `341145e` — parallel multi-mining: per-miner groups + miner group hint

| | |
|---|---|
| **Hash** | `341145e1757ce32d2d98e98ae7ddddfda5cdb888` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 02:12:55 +0100 |

---

### 272. `9602c1e` — docs: parallel multi-mining (per-miner groups, g= hint, --group)

| | |
|---|---|
| **Hash** | `9602c1ef7d2a284ddbdf60da1d0f29e30b16a238` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 02:19:05 +0100 |

---

### 273. `1934d5d` — core+pool+miner: CHv3 unification ÔÇö single PoW algorithm\n\n- Remove CH v1/v2 from compilation (archived to archive/legacy-algorithms/)\n- core/algorithms: cosmic_harmony.rs is now thin wrapper over zion-cosmic-harmony-v3 crate\n- core/algorithms/mod.rs: remove CosmicHarmonyV2 enum variant\n- core/blockchain/block.rs: remove dead fork-gate else branch (CH_V3_FORK_HEIGHT=0)\n- core/miner: update to cosmic_harmony::hash() API (was cosmic_hash())\n- pool/validator: merge 3 algo variants (v1/v2/v3) into single CosmicHarmony=CHv3\n- miner: remove CosmicHarmonyV2 from Algorithm + NativeAlgorithm enums\n- miner: remove CHV2_HASHER thread-local cache + compute branch\n\nBuild: 0 errors. Tests: core 233/233 ok, pool 35/35 ok, chv3 47/47 ok\n(18 jsonrpc test failures are pre-existing, unrelated to this change)"

| | |
|---|---|
| **Hash** | `1934d5dc38f32a7b54eb7e748063b07531c768a2` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 02:39:20 +0100 |

---

### 274. `2191754` — docs: complete v2.9.6 documentation (consensus, changelog, p2p, launch-plan, migration, audit, README update)

| | |
|---|---|
| **Hash** | `2191754df26ca9d70b42dedc31740a6e661ccfe1` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 02:51:35 +0100 |

---

### 275. `176bd1e` — core+pool+docs: Decade Decay emission (Model A), L6ÔćĺZION Issbbel, 5/5/89/1 distribution

| | |
|---|---|
| **Hash** | `176bd1eccb14b0b0c8fd6ae6607d713cf8099c4f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 03:15:40 +0100 |

<details><summary>Details</summary>

```
Emission: -20% per decade, tail 724.785 ZION/block forever (from 2126)
Distribution: 89% miner, 5% humanitarian, 5% L5/L6 Issbbel fund, 1% pool fee
Additional funding: ZION Oasis (L4) off-chain revenue share Ôćĺ L5/L6
L6 space station named: ZION Issbbel

Files changed:
- core/src/blockchain/reward.rs ÔÇö Decade Decay calculate(), 22 unit tests
- core/src/blockchain/fee.rs ÔÇö updated coinbase tests for perpetual emission
- core/src/jsonrpc/mod.rs ÔÇö getSupplyInfo uses decade-aware mined supply
- pool/src/blockchain/reward_calculator.rs ÔÇö height-aware decay + Issbbel fund
- pool/src/shares/processor.rs ÔÇö 4-way fee split (miner/humanitarian/issbbel/pool)
- pool/src/main.rs ÔÇö API responses include issbbel_fund_percent
- docs/v2.9.6/ ÔÇö tokenomics, changelog, README, layer-architecture updated
- website-v2.9/ ÔÇö synced L6 naming across all docs
```
</details>

---

### 276. `aaf1cb1` — fix: L6 typo Issbbel Ôćĺ ISSOBELLA (all code + docs)

| | |
|---|---|
| **Hash** | `aaf1cb111dbc3248527079c07f9ebb87a5511c33` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 03:21:14 +0100 |

---

### 277. `951bbf4` — docs: unify root README ÔÇö v2.9.6 with 6-Layer, Decade Decay, ZION Issobella

| | |
|---|---|
| **Hash** | `951bbf4dd2aa766bf8d2d75f1a7d0734b6de929b` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 03:24:28 +0100 |

---

### 278. `e6480d3` — website: upgrade docs to v2.9.6 ÔÇö Decade Decay, 6-Layer, ZION Issobella, dual-mining

| | |
|---|---|
| **Hash** | `e6480d3e808c773534e00ae8cbc9947413161b34` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 03:31:29 +0100 |

<details><summary>Details</summary>

```
- Sync all docs/v2.9.6/*.md Ôćĺ website mirror (9 files)
- Update index.md ÔÇö v2.9.6 params, 6-Layer table, reward distribution
- Update getting-started.md ÔÇö dual-mining commands
- Update mining-guide.md ÔÇö Decade Decay, distribution table, dual-mining
- Update api.md ÔÇö version 2.9.6
- Update setup.md ÔÇö version 2.9.6
- Update faq.md ÔÇö Decade Decay emission, Issobella fund
- Update community.md ÔÇö roadmap milestones, Issobella fund
- Update page.tsx ÔÇö v2.9.6 as default, CURRENT tag, navigation
```
</details>

---

### 279. `3390566` — website: full v2.9.6 upgrade ÔÇö 35 files

| | |
|---|---|
| **Hash** | `33905664729fcc0046732ced322ca0ce373471ee` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 03:49:28 +0100 |

<details><summary>Details</summary>

```
- constants.ts: Decade Decay params, 5/5/89/1 distribution, Issobella fund,
  tail emission 724.785, blockRewardAtHeight(), MINING_HORIZON_LABEL
- MissionControlDashboard: L5 Free World + L6 ZION Issobella layers,
  Decade Decay constitution, 100+ year horizon, updated economy tab,
  6-layer footer & Gantt chart
- roadmap/page.tsx: L5+L6 in layer stack & timeline, Decade Decay
  constitution, updated CTA tags, 3-col grid for 6 layers
- All 35 files: v2.9.5Ôćĺv2.9.6, Native AwakeningÔćĺOn the Star,
  10% humanitarianÔćĺ5% humanitarian + 5% Issobella fund,
  ~45 letÔćĺ100+ let + tail Ôł×, old emissionÔćĺDecade Decay
```
</details>

---

### 280. `213d993` — chore: bump version to 2.9.6 in Cargo.toml + Docker compose files

| | |
|---|---|
| **Hash** | `213d9930577f16ef544f55bcb9ed662c1a5fe066` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 04:22:08 +0100 |

<details><summary>Details</summary>

```
- Cargo.toml workspace version: 2.9.5 Ôćĺ 2.9.6
- docker-compose.testnet.yml: image tags 2.9.5-testnet Ôćĺ 2.9.6-testnet
- docker-compose.monitoring.yml: labels com.zion.version 2.9.5 Ôćĺ 2.9.6
- Both servers (Helsinki + Germany) cleaned, rebuilt, and redeployed
```
</details>

---

### 281. `f6219ac` — feat: add docker-compose.website.yml for containerized Next.js deployment

| | |
|---|---|
| **Hash** | `f6219ac8060aa282e55386d532f22ca5ca1e1a60` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 07:49:14 +0100 |

<details><summary>Details</summary>

```
- Dockerfile.production: standalone Next.js build on port 3000
- Replaces PM2-managed bare process with Docker container
- Image tag: zion-website:2.9.6
- Deployed on Helsinki behind nginx reverse proxy (HTTPS)
```
</details>

---

### 282. `c9f3f2b` — fix: API endpoints - swap p2p/rpc ports in network-config, rewrite mission-data route for live data

| | |
|---|---|
| **Hash** | `c9f3f2b649e47eb714ee8050b191fde76eeb5d70` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 08:08:33 +0100 |

<details><summary>Details</summary>

```
- network-config.ts: fix swapped ports (p2p: 8334, rpc: 8444) ÔÇö was reversed
- mission-data/data/route.ts: replace broken /dash/data.json dependency with
  live RPC+pool data fetching from both Helsinki and Germany nodes
- richlist/route.ts: fix RPC URL to include /jsonrpc path
- Fix file permissions on public/docs/legacy (was 700, broke Docker container)

All API endpoints now return live blockchain data:
  /api/mission-data/data ÔÇö height, peers, pool, stability metrics
  /api/blockchain/stats ÔÇö block height, difficulty, hashrate, peers
  /api/health ÔÇö rpc_node + mining_pool healthy
  /api/pool/stats ÔÇö miners, hashrate, blocks found
  /api/blockchain/blocks ÔÇö block headers with hashes
  /api/network ÔÇö both nodes online, synchronized
```
</details>

---

### 283. `708312b` — docs: fix ZION Oasis timeline ÔÇö planned for 2029+, not 2026/2028

| | |
|---|---|
| **Hash** | `708312b76b971510f12e326a15632cd9de8bfdc1` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 08:29:33 +0100 |

<details><summary>Details</summary>

```
ZION Oasis (L4) is planned for 2029+, not 2026 or 2028 as
previously stated in multiple docs. Fixed across:
- ROADMAP.md (TOC, layer stack, milestones L4-M1..M9, summary)
- NextSteps.md
- docs/v2.9.6/README.md
- docs/v2.9.6/layer-architecture.md (ASCII diagram)
- docs/MAINNET_ROADMAP_2026.md
- docs/MAINNET_LAUNCH_PLAN_v2.9.5.md
- website-v2.9/public/docs/index.md
- website-v2.9/public/docs/v2.9.6/layer-architecture.md
- website-v2.9/src/app/roadmap/page.tsx (layer card)
```
</details>

---

### 284. `0dddd70` — feat: aktualizace pool Dockerfile, testnet compose a miner k├│du

| | |
|---|---|
| **Hash** | `0dddd707ebcf7fd240b50c4d2c041c79713eca4f` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 09:43:17 +0100 |

---

### 285. `b87d9af` — miner: stabilize parallel XMR RandomX (seed_hash, nonce, reconnect backoff)

| | |
|---|---|
| **Hash** | `b87d9afb3df226254f58069d48147aa994287508` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 11:21:32 +0100 |

---

### 286. `bf61917` — docs: record parallel XMR (RandomX) variant B rollout

| | |
|---|---|
| **Hash** | `bf619172fc2f87ced143126e4c29cb13bb7f0471` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 13:47:30 +0100 |

---

### 287. `cd3979c` — feat(desktop-agent): dual mining ZION (N-1)T + XMR 1T DAO revenue

| | |
|---|---|
| **Hash** | `cd3979c950b51cdff5a1d205caf13af0329991d0` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 13:59:52 +0100 |

<details><summary>Details</summary>

```
- Desktop agent now spawns Rust miner with --group zion and parallel
  XMR mining via --xmr-pool (MoneroOcean) + --xmr-threads 1
- Thread split: ZION gets (effectiveThreads - 1), XMR revenue gets 1
  (requires minimum 3 threads total, otherwise ZION-only)
- DAO revenue: 1 CPU thread mines XMR on MoneroOcean, auto-converts
  to BTC for DAO treasury
- No UI changes ÔÇö revenue stream is transparent/default
- Disable with ZION_DISABLE_REVENUE=1 env var
- GPU dual stream model documented in ch3_revenue_settings.json
  (pool forwards GPU hashpower to 2 streams with BTC payouts)
- Added dual_mining, zion_threads, xmr_threads, xmr_pool stats fields
- All pool + miner tests passing
```
</details>

---

### 288. `d54ac57` — fix(desktop-agent): route ALL mining through own pool, not directly to external pools\n\nArchitecture fix: desktop agent now spawns TWO miner processes both\nconnecting to the SAME ZION pool:\n  - Process 1: (N-1) threads, --group zion Ôćĺ CosmicHarmony jobs\n  - Process 2: 1 thread, --group revenue Ôćĺ pool RevenueProxy Ôćĺ XMR/BTC\n\nRemoved: --xmr-pool, --xmr-wallet, --xmr-threads (direct MoneroOcean)\nAdded: revenueProcess lifecycle (spawn, stdout/stderr log, stop/kill)\nUpdated: ch3_revenue_settings.json documents pool-first architecture\n\nAll hashpower goes through our pool first. Pool StreamScheduler\nroutes groups internally via RevenueProxy to external pools."

| | |
|---|---|
| **Hash** | `d54ac57282119f117ba033b16293e00418d0f266` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 14:11:45 +0100 |

---

### 289. `87efb2b` — fix(python-miner): prevent CHv3 worker crashes on long stratum blobs

| | |
|---|---|
| **Hash** | `87efb2b0556967ed9120c636aa9ca9dc30d5f752` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 14:20:16 +0100 |

<details><summary>Details</summary>

```
- CHv3 FFI rejects input_len > 1024, while the algorithm hashes only first 80 bytes.
  Trim CHv3 input to 80 bytes in cosmic_harmony_native.py (hash/batch_hash/find_nonce)
  so ext/merged blobs cannot trigger error -2.
- Add per-worker exception handling in _cpu_worker to log hash errors (rate-limited)
  instead of killing mining threads and leaving 0 H/s.
```
</details>

---

### 290. `fe686f9` — fix(desktop-agent): prefer Rust miner on macOS/Linux when available

| | |
|---|---|
| **Hash** | `fe686f94ca31d8c8f1ee78f00dd985dde56f4727` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 14:23:18 +0100 |

<details><summary>Details</summary>

```
If Rust miner exists, migrate configs with missing/auto `minerBackend` to `rust`.
This prevents silently running Python miner (and numpy-related warnings) when the
Rust universal miner is present and is the intended default backend.
```
</details>

---

### 291. `e810c6c` — build(miner): ship updated macOS Rust miner with --group and Metal GPU

| | |
|---|---|
| **Hash** | `e810c6c7580d3ef0931f7163e6bb9d27f0eb5157` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 14:40:34 +0100 |

<details><summary>Details</summary>

```
- Fix native_algos.rs compile errors when building with features
- Rebuild and update bundled desktop-agent/resources/zion-universal-miner
  so Desktop Agent no longer fails with unknown --group and can use Metal GPU on M1
```
</details>

---

### 292. `bbfc1c5` — fix(desktop-agent): robust Rust miner bundling on macOS

| | |
|---|---|
| **Hash** | `bbfc1c55d884e803182c5ae1347c9cf369db52f1` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 15:01:01 +0100 |

<details><summary>Details</summary>

```
- prepare-rust-miner: detect cargo output zion-miner and copy/rename to zion-universal-miner
- keep zion-miner alias in resources updated
- ignore generated desktop-agent/resources/native-libs and *.dylib to avoid git noise
```
</details>

---

### 293. `c0b6ab5` — Fix: CHv3 target parsing matches pool validator (first 8 hex chars); desktop-agent now always bundles up-to-date Rust miner from workspace/miner (Metal GPU, correct CLI). Clean unreachable match arms in batch_size_for_algo().

| | |
|---|---|
| **Hash** | `c0b6ab5aeb7236a6b44f0aba5b503a58198186b2` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 15:32:08 +0100 |

---

### 294. `7050154` — fix: GPU mining (DeviceType::ALL + CPU filter), wallet balance (balance_zion + pool stats), send tx, tx lookup, pool metrics dedup

| | |
|---|---|
| **Hash** | `7050154be67d457a8de89bc842fc32f00446ff8e` |
| **Author** | Yose144k <yosef.hubalek@gmail.com> |
| **Date** | 2026-02-15 16:34:18 +0100 |

<details><summary>Details</summary>

```
Desktop Agent:
- wallet-get-balance: read balance_zion from RPC, fetch pool pending/paid/shares/blocks from TESTNET_SERVERS
- wallet-send-transaction: fix response parsing (tx_id/txid/hash)
- wallet-get-transaction: new IPC handler for tx lookup by ID
- preload.js: add walletGetTransaction bridge
- index.html: expanded balance card (on-chain + pool pending + pool paid + shares + blocks), tx lookup section
- renderer.js: populate pool stats elements, tx lookup handler

GPU Mining:
- 2.9.5OLD opencl.rs: DeviceType::ALL with CPU filtering + diagnostic output
- miner/opencl.rs: same DeviceType::ALL patch
- miner/Cargo.toml: add ocl dependency to gpu feature
- compat.h: MSVC intrin.h fix

Pool Metrics:
- route.ts: fix payouts key (pending_payouts), block deduplication by height
```
</details>

---

### 295. `ecbbea4` — feat(ch3): GPU revenue mining + ETC priority; fix(desktop-agent): bounded logs + STATUS + CPU info

| | |
|---|---|
| **Hash** | `ecbbea481475c041c8940dd89edc8fd459c9a0c7` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-15 20:38:51 +0100 |

---

## 2026-02-16

### 296. `41d9343` — build(deps): update thiserror requirement from 1 to 2

| | |
|---|---|
| **Hash** | `41d9343f391f7b996a141cf101e194f7b70b41d7` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-16 09:02:41 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [thiserror](https://github.com/dtolnay/thiserror) to permit the latest version.
- [Release notes](https://github.com/dtolnay/thiserror/releases)
- [Commits](https://github.com/dtolnay/thiserror/compare/1.0.0...2.0.18)

---
updated-dependencies:
- dependency-name: thiserror
  dependency-version: 2.0.18
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 297. `632424b` — build(deps): update dirs requirement from 5.0 to 6.0

| | |
|---|---|
| **Hash** | `632424b08eb3072f99a75b07540a92b4230efcb2` |
| **Author** | dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com> |
| **Date** | 2026-02-16 09:03:13 +0000 |

<details><summary>Details</summary>

```
Updates the requirements on [dirs](https://github.com/soc/dirs-rs) to permit the latest version.
- [Commits](https://github.com/soc/dirs-rs/commits)

---
updated-dependencies:
- dependency-name: dirs
  dependency-version: 6.0.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <support@github.com>
```
</details>

---

### 298. `08e02db` — audit: fix 10 P0 findings ÔÇö consensus, pool, desktop agent security

| | |
|---|---|
| **Hash** | `08e02db7cfeaa61ba587bd7296134f5f8a640bb3` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-16 14:01:36 +0100 |

<details><summary>Details</summary>

```
AUDIT-FIX C-01: Fix meets_difficulty() byte-order (MSBÔćĺLSB, not reversed)
AUDIT-FIX C-02: Replace broken SIMD signed-byte comparison with scalar
AUDIT-FIX C-04: Fix FFI hash_with_height nonce truncation u32Ôćĺu64
AUDIT-FIX C-10: Replace static mut with AtomicBool in native_ffi.rs
AUDIT-FIX P-06: Rewrite PPLNS calculator f64Ôćĺu128 integer arithmetic
AUDIT-FIX E-02: Sanitize all innerHTML injections (wallet/node/peer/server)
AUDIT-FIX E-03: Add escapeHtml() global sanitizer to renderer.js
AUDIT-FIX E-04: Add Content-Security-Policy meta tag to index.html
AUDIT-FIX E-05: Add will-navigate guard + setWindowOpenHandler + sandbox:true

New: AUDIT_2026_02_16.md ÔÇö full audit report (23 P0, 28 P1, 28 P2)
```
</details>

---

## 2026-02-17

### 299. `2ecfd0b` — Add gitignore

| | |
|---|---|
| **Hash** | `2ecfd0b22be5c3f44dae20cf64d971ad04b9ce01` |
| **Author** | estrelaisabellazion3 <estrelaisabellazion3@gmail.com> |
| **Date** | 2026-02-17 23:06:39 +0100 |

---

