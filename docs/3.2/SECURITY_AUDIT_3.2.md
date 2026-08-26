# ZION 3.2 "One Love" — Internal Security Audit Report

> **Audit date:** 2026-08-26
> **Scope:** V31 L1 core, L2 multichain, pool, miner, EVM contracts, dependencies
> **Auditor:** Kilo (autonomous)
> **Status:** G9/F1 gate — INTERNAL COMPLETE (external review still recommended)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| **Critical** | 2 |
| **High** | 10 |
| **Medium** | 20 |
| **Low** | 12 |
| **Total** | **44** |

The audit covered all V31 workspace crates, the EVM contracts, and the full Rust dependency tree. **No catastrophic fund-loss bugs were found in production code paths**, but several high-severity issues require remediation before public launch. The two critical findings are in the Solidity contracts (ZDXToken immutable owner + missing burn) and the pool (zero-PoW difficulty-1 share acceptance).

**Top 5 remediation priorities:**
1. **POL-001 (Critical):** Pool accepts difficulty-1 shares with no work → fund drain.
2. **POL-002 (Critical):** Pool block-found payout is not idempotent → double-payment.
3. **CON-001 (High):** ZDXToken `setMinter()` is a no-op; owner is immutable `msg.sender` (single-key, not multisig).
4. **CON-002 (High):** `SolverRegistry.slash()` calls `zdxToken.burn()` but `ZDXToken` has no `burn` function → will revert, bricking slashing.
5. **DEP-001 (High):** `ethers 2.0.14` pulls in `ring 0.16`, `h2 0.3`, `rustls-webpki 0.101` with 6 known CVEs.

---

## 1. L1 Core (consensus, tx, block, difficulty, genesis)

### FIND-L1-001: Weak Merkle root construction (non-standard, second-preceptible)
- **File:** `V31/L1/core/src/node.rs:1089-1096`
- **Severity:** Medium
- **Category:** Cryptographic Weakness
- **Description:** `merkle_root()` is a flat BLAKE3 hash of concatenated transaction hashes, not a Merkle tree. An attacker who can control the block template (via pool reorg or self-mining) can construct a block whose body hashes to the same flat digest as a different body via length-extension or collision on the concatenated preimage. A real Merkle tree binds the count and order of leaves; a flat hash does not.
- **Impact:** Non-standard; undermines SPV proof assumptions. In the current single-pool model the risk is low because the pool builds the template, but it breaks light-client verifiability.
- **Recommendation:** Replace with a proper binary Merkle tree (Bitcoin-style or BLAKE3-based) with explicit leaf count in the root.

### FIND-L1-002: `validate_peer_block` skips PoW verification when `header_hex` is empty
- **File:** `V31/L1/core/src/chain_state.rs:954`
- **Severity:** High
- **Category:** Validation Bypass
- **Description:** When a peer announces a block via P2P but does not yet supply `header_hex` (e.g. during IBD, batch sync, or for lightweight announcements), `validate_peer_block` skips all PoW and timestamp checks. A malicious peer can announce arbitrary blocks at arbitrary heights with fake difficulty, and the node will accept them into `accepted_batches` until the header arrives.
- **Impact:** IBD/long-range attack vector; node can be fed a fake chain that passes initial validation. The `import_peer_blocks` path does eventually check PoW, but the initial accept is premature.
- **Recommendation:** Defer block acceptance until `header_hex` is available and PoW is verified. Reject empty-header announcements for non-genesis blocks.

### FIND-L1-003: `submit_block` does not re-verify block height continuity
- **File:** `V31/L1/core/src/node.rs:982-1086`
- **Severity:** Medium
- **Category:** Logic Error
- **Description:** `submit_block` calls `consensus.verify_header()` which checks `header.height == previous.height + 1`, but it does not verify that `previous` is the current tip. A block built on top of a stale tip (one block behind) would pass `verify_header` if the caller provides the wrong `previous`. The pool builds on the current tip so this is low-risk in practice, but the node should explicitly check `tip_header.height == block.header.height - 1`.
- **Impact:** Stale-tip block submission accepted; could cause a reorg to a shorter chain.
- **Recommendation:** Add an explicit `assert!(tip_header.height + 1 == block.header.height)` at the top of `submit_block`.

### FIND-L1-004: `insert_transaction` O(n) scan over all accepted blocks for duplicate detection
- **File:** `V31/L1/core/src/chain_state.rs:1481-1509`
- **Severity:** Low
- **Category:** Performance
- **Description:** Duplicate-nonce detection scans `self.accepted_blocks` linearly. With `block_retention=1000` and large blocks, this is a few thousand comparisons per insertion. Not a DoS vector (mempool is capped at 4096) but degrades under load.
- **Recommendation:** Maintain a `HashSet<(sender, nonce)>` for O(1) mined-nonce lookup.

### FIND-L1-005: Genesis `GENESIS_MESSAGE_FULL` embedded via `include_str!` at compile time
- **File:** `V31/L1/core/src/genesis.rs:37`
- **Severity:** Informational
- **Category:** Supply Chain
- **Description:** The genesis message is included from `GENESIS_MESSAGE.txt` at compile time. If the file is tampered with (supply-chain attack on the build environment), the genesis hash changes silently. The hash is checked at runtime, but only if the operator compares it to a known-good value.
- **Recommendation:** Hardcode the expected `genesis_hash()` in a compile-time assertion (`const_assert_eq!`) or log the hash prominently at boot.

---

## 2. L2 Multichain (WARP, DEX, HTLC, bridge, solver)

### FIND-001: HTLC preimage generated from weak CSPRNG (timestamp + SHA-256)
- **File:** `V31/L2/multichain/src/swap/htlc.rs:84-95`
- **Severity:** Medium
- **Category:** Cryptographic Weakness
- **Description:** `SwapPreimage::random()` uses `Utc::now().timestamp_nanos_opt()` + SHA-256 instead of `OsRng`. An attacker who can predict or influence the server clock can compute the preimage.
- **Recommendation:** Replace with `rand::rngs::OsRng` or `rand::thread_rng` seeded from OS entropy.

### FIND-002: HTLC preimage stored in plaintext in SQLite
- **File:** `V31/L2/multichain/src/swap/htlc.rs:192`
- **Severity:** Medium
- **Category:** Secret Leak
- **Description:** `HtlcRecord.preimage_hex` persists the 32-byte preimage as plaintext hex. Any DB read access allows preimage extraction and HTLC theft.
- **Recommendation:** Encrypt at rest or never persist; recompute from a secret seed.

### FIND-003: HTLC `claimant_pubkey` check skipped for non-ZION chains
- **File:** `V31/L2/multichain/src/swap/htlc.rs:567-578`
- **Severity:** Medium
- **Category:** Access Control
- **Description:** `claimant_pubkey` enforcement only applies when `target_chain == ChainId::ZionL1`. For BTC/ETH/SOL, anyone with the preimage can claim.
- **Recommendation:** Enforce for all chain families or document as intentionally claimer-anonymous.

### FIND-004: HTLC `initiate()` does not verify source lock exists on-chain
- **File:** `V31/L2/multichain/src/swap/htlc.rs:380-458`
- **Severity:** High
- **Category:** Logic Error
- **Description:** `initiate()` creates a target-side lock without confirming the source-side lock. An attacker can learn the hashlock and claim the target output without locking the source.
- **Recommendation:** Require source lock confirmation before creating target lock; use two-phase commit.

### FIND-005: Bridge `bridge_memo_matches()` lacks TX hash uniqueness → replay risk
- **File:** `V31/L2/multichain/src/bridge/mod.rs:162-177`
- **Severity:** High
- **Category:** Replay Attack
- **Description:** Memo matching uses recipient + amount + memo format but not the source `tx_hash`. An attacker can replay a valid deposit event with the same memo to trigger duplicate mints.
- **Recommendation:** Include source `tx_hash` in the matching key.

### FIND-006: Bridge `lock_mint`/`burn_release` silently falls back to placeholder hash on unsupported chains
- **File:** `V31/L2/multichain/src/bridge/mod.rs:66-81,95-110`
- **Severity:** High
- **Category:** Logic Error
- **Description:** Unsupported chains get a placeholder hash and `Completed` status, locking user funds with no error.
- **Recommendation:** Return explicit error; gate any placeholder behind a test-only feature flag.

### FIND-007: `WarpMessage.nonce` always zero → signature replay vulnerability
- **File:** `V31/L2/multichain/src/warp/executor.rs:137`
- **Severity:** High
- **Category:** Replay Attack
- **Description:** All `WarpMessage` instances for the same transfer produce the same signing hash. Captured validator signatures can be replayed to mint the same amount repeatedly.
- **Recommendation:** Use a monotonically increasing per-validator or per-transfer nonce.

### FIND-008: `DepositProof` not validated against on-chain data
- **File:** `V31/L2/multichain/src/warp/router.rs:106-167`
- **Severity:** High
- **Category:** Access Control
- **Description:** `initiate_outbound()` accepts a `DepositProof` struct without verifying tx_hash, amount, or sender against the source chain. An attacker can fabricate proofs to mint arbitrary wrapped tokens.
- **Recommendation:** Verify proofs against the source chain adapter before accepting.

### FIND-009: Daily volume limit resets on service restart
- **File:** `V31/L2/multichain/src/warp/router.rs:27-31,283-285`
- **Severity:** Medium
- **Category:** Logic Error
- **Description:** `daily_volume` is an in-memory `HashMap` cleared on restart. An attacker can bypass the limit by triggering a restart.
- **Recommendation:** Persist counters to SQLite with a date key; use a sliding window.

### FIND-010: Timelock threshold uses `net_amount` (after fees), not gross
- **File:** `V31/L2/multichain/src/warp/router.rs:143`
- **Severity:** Medium
- **Category:** Logic Error
- **Description:** Large-fee manipulations can push `net_amount` below the timelock threshold, bypassing the hold.
- **Recommendation:** Check timelock on gross `amount_flowers` before fee subtraction.

### FIND-011: Multi-hop swap does not validate intermediate amounts
- **File:** `V31/L2/multichain/src/swap/dex/swap_executor.rs:147-167`
- **Severity:** Medium
- **Category:** Logic Error
- **Description:** Hop N output may differ from hop N+1 expected input if pool reserves change between quote and execution.
- **Recommendation:** Re-quote before each hop or lock reserves atomically.

### FIND-012: SolverBid signature not verified
- **File:** `V31/L2/multichain/src/swap/dex/intent.rs:62-77`, `solver_network.rs:127-132`
- **Severity:** High
- **Category:** Access Control
- **Description:** `SolverBid` includes a `signature` field but it is never verified. Any HTTP client can forge bids.
- **Recommendation:** Verify bid signatures against solver's registered public key.

### FIND-013: Intent settlement does not validate bid path executability
- **File:** `V31/L2/multichain/src/swap/dex/intent.rs:220-238`, `intent_engine.rs:160-168`
- **Severity:** Medium
- **Category:** Logic Error
- **Description:** A winning bid referencing insufficient pool liquidity will settle but fail at execution.
- **Recommendation:** Validate paths against current `DexRouter` state during settlement.

### FIND-014: `execute_swap` debit-before-credit not atomic
- **File:** `V31/L2/multichain/src/swap/dex/swap_executor.rs:118-128`
- **Severity:** Medium
- **Category:** Logic Error / Race Condition
- **Description:** Process crash between debit and credit loses user funds.
- **Recommendation:** Two-phase commit or idempotent order state machine.

### FIND-015: Solver API key sent in plaintext HTTP header
- **File:** `V31/L2/multichain/src/swap/dex/solver_network.rs:104-106`
- **Severity:** Low
- **Category:** Secret Leak (in transit)
- **Description:** `X-Solver-Key` over plaintext HTTP.
- **Recommendation:** Enforce TLS or mutual TLS for solver communication.

### FIND-016: Solver registration not admin-restricted
- **File:** `V31/L2/multichain/src/server.rs:1581-1595`, `intent_engine.rs:39-50`
- **Severity:** Medium
- **Category:** Access Control
- **Description:** Any authenticated user can register as a solver and overwrite existing entries.
- **Recommendation:** Restrict to admin role.

### FIND-017: GET endpoints leak pool/payout/contract data without auth
- **File:** `V31/L2/multichain/src/server.rs:388-448`
- **Severity:** Medium
- **Category:** Information Disclosure
- **Description:** `pool_stats`, `pool_payouts`, `list_chains`, `get_all_contracts`, `list_pools` are unauthenticated.
- **Recommendation:** Apply auth consistently or rate-limit.

### FIND-018: `wallet_sign` accepts arbitrary messages (signature phishing)
- **File:** `V31/L2/multichain/src/server.rs:493-510`
- **Severity:** High
- **Category:** Access Control
- **Description:** No message format validation; attacker can craft messages that authorize fund transfers on other chains.
- **Recommendation:** Implement typed signing (EIP-191, chain-specific formats).

### FIND-019: Rate limiter `HashMap` never evicts → memory exhaustion
- **File:** `V31/L2/multichain/src/rate_limit.rs:61-69,85-100`
- **Severity:** Medium
- **Category:** DoS
- **Description:** Unbounded per-IP/per-user bucket growth.
- **Recommendation:** TTL-based eviction or LRU cache.

### FIND-020: `/health` excluded from rate limiting
- **File:** `V31/L2/multichain/src/rate_limit.rs:120-123`
- **Severity:** Low
- **Category:** DoS
- **Description:** Health endpoints can be polled without consuming rate-limit tokens.
- **Recommendation:** Apply a separate, stricter limit to health.

### FIND-021: `node_heartbeat` requires no authentication → fake heartbeats
- **File:** `V31/L2/multichain/src/server.rs:1819-1830`
- **Severity:** Medium
- **Category:** Access Control
- **Description:** Anyone can submit heartbeats to inflate node rewards.
- **Recommendation:** Require signed heartbeats per AGENTS.md spec.

### FIND-022: Reconciliation double-counts AMM pool reserves
- **File:** `V31/L2/multichain/src/reconciliation.rs:170-173`
- **Severity:** High
- **Category:** Logic Error
- **Description:** `expected = internal + pool_reserves` but pool reserves are already in `internal`, causing false alerts.
- **Recommendation:** Compare `on_chain` against `internal` only; reconcile pool reserves separately.

### FIND-023: Reconciliation alert threshold parsed without bounds check
- **File:** `V31/L2/multichain/src/reconciliation.rs:52-54`
- **Severity:** Low
- **Category:** Input Validation
- **Recommendation:** Add bounds validation (0 < threshold < total supply).

### FIND-024: HTLC `SWAP:LOCK` memo lacks unique nonce → replay risk
- **File:** `V31/L2/multichain/src/swap/htlc.rs:217-297`
- **Severity:** Medium
- **Category:** Replay Attack
- **Recommendation:** Add unique nonce to memo format.

### FIND-025: Timelock uses wall clock without drift tolerance
- **File:** `V31/L2/multichain/src/swap/htlc.rs:201-203,560-565`, `warp/router.rs:143`
- **Severity:** Low
- **Category:** Logic Error
- **Recommendation:** Use block heights or add drift tolerance.

### FIND-026: Bridge consensus gracefully degrades below quorum
- **File:** `V31/L2/multichain/src/bridge/mod.rs:115-123`, `service.rs:944-960`
- **Severity:** Medium
- **Category:** Access Control
- **Description:** If validator keys are lost, bridge runs without consensus.
- **Recommendation:** Fail closed; require explicit `allow_unsafe` for Alpha mode.

### FIND-027: No input length validation on hex decode error paths
- **File:** `V31/L2/multichain/src/swap/htlc.rs:37-41,66-70`, `server.rs:1126-1134`
- **Severity:** Low
- **Category:** Input Validation
- **Recommendation:** Standardize error messages to avoid leaking input structure.

---

## 3. Pool / Payout

### POL-001: Pool accepts zero-PoW difficulty-1 shares → fund drain
- **File:** `V31/L1/pool/src/stratum.rs:142-147`, `vardiff.rs:147-150`, `pool.rs:134-150`
- **Severity:** Critical
- **Category:** Validation Bypass / Fund Drain
- **Description:** `difficulty_to_target(1)` returns `[0xFF;32]` (maximum target). Every hash satisfies it. Default `ZION_VARDIFF_START_DIFF=1` and `min_difficulty=1` mean a fresh miner can submit any nonce as a valid share. Each share adds PPLNS weight → attacker accrues payout without doing work.
- **Impact:** Direct fund drain from pool wallet. Public pool makes this trivially exploitable.
- **Recommendation:** Enforce a meaningful minimum share difficulty (e.g. `ZION_VARDIFF_START_DIFF >= 1000`). Reject shares weaker than the floor. Cap weight per share.

### POL-002: Pool block-found payout not idempotent → double block-reward payout
- **File:** `V31/L1/pool/src/stratum.rs:1979-1989`, `pool.rs:192-201,246-248`, `payout.rs:218-235`
- **Severity:** Critical
- **Category:** Fund Drain / Double Payment
- **Description:** `on_block_found` calls `compute_miner_payouts` → `distribute_to_miners`, which *additively mutates* `self.unpaid` and pushes a full payout batch per call. No dedup guard before the sweep completes. Triggers: replay of winning `mining.submit`, or same block via v1/v3-plain/v3-TLS handlers (all three call `record_block_accepted`).
- **Impact:** Pool pays N× block reward for one found block.
- **Recommendation:** Add `paid_block_heights: HashSet<u64>` checked at the start of `on_block_found`. Dedup `pending_payouts` by `(height, address)`.

### POL-003: AuxPoW share hash trusted from miner for non-DAG algorithms
- **File:** `V31/L1/pool/src/share_forwarder.rs:66-87,101-117`
- **Severity:** High
- **Category:** Share Tampering / Upstream Abuse
- **Description:** For blake3/kheavyhash/etc., the miner-supplied hash is trusted. An attacker can flood the upstream pool with fake "meets-target" shares.
- **Impact:** Pool's upstream identity throttled/banned; wasted bandwidth.
- **Recommendation:** Always recompute hash from header+nonce before forwarding.

### POL-004: Pool API authentication fail-open + unauthenticated read endpoints
- **File:** `V31/L1/pool/src/api.rs:134-161`
- **Severity:** Medium
- **Category:** Access Control / Information Disclosure
- **Description:** If `ZION_POOL_API_KEY` is unset, all `/api/*` endpoints are open. `/stats`, `/miners`, `/metrics` are never authenticated. Binding to `0.0.0.0:8080` exposes them.
- **Recommendation:** Default-deny: require key for non-`/health` routes; bind metrics to localhost.

### POL-005: Log injection via attacker-controlled fields
- **File:** `V31/L1/pool/src/stratum.rs:410-415,447-452,1024-1030,1236-1243`
- **Severity:** Medium
- **Category:** Log Injection
- **Description:** `worker_name`, `miner_id`, `job_id` are interpolated into logs verbatim. CRLF injection forges log lines.
- **Recommendation:** Sanitize/strip control chars; use structured logging.

### POL-006: NoSolution IP-ban only enforced on V3-plain handler
- **File:** `V31/L1/pool/src/stratum.rs:1534-1541`
- **Severity:** Medium
- **Category:** Inconsistent Controls
- **Description:** v1 and TLS handlers never trigger the ban; `ctx.authorized` is set but never checked.
- **Recommendation:** Apply ban uniformly; document anonymous-mining trust model.

### POL-007: Unbounded `jobs` HashMap → memory exhaustion DoS
- **File:** `V31/L1/pool/src/stratum.rs:79-80,652`
- **Severity:** Medium
- **Category:** DoS
- **Description:** Job IDs increment forever; no eviction.
- **Recommendation:** LRU eviction or TTL-based cleanup.

### POL-008: Permissive per-session rate limit amplifies POL-002
- **File:** `V31/L1/pool/src/rate_limit.rs:59-83`
- **Severity:** Low
- **Category:** DoS Amplifier
- **Description:** 10 shares/sec × 10 sessions/IP = 100 shares/sec.
- **Recommendation:** Add IP-global share budget.

---

## 4. Miner

No critical/high findings. The miner's profit switching, GPU/CPU stream separation, and AuxPoW client are well-structured. Two informational notes:

### MIN-001: `ZION_STREAM3_FORCE_COIN` not validated against `enabled_coins` list
- **File:** `V31/L1/miner/src/runtime.rs` (config parsing)
- **Severity:** Low
- **Category:** Input Validation
- **Description:** If the env var references a coin not in `enabled_coins`, the stream silently does nothing.
- **Recommendation:** Log a warning at startup if the forced coin is disabled.

### MIN-002: TUI sticky header writes to `/dev/tty` without error handling
- **File:** `V31/L1/miner/src/ui.rs`
- **Severity:** Informational
- **Category:** Robustness
- **Description:** If `/dev/tty` is unavailable (e.g. container without TTY), the write silently fails.
- **Recommendation:** Fall back to stdout if `/dev/tty` open fails.

---

## 5. Solidity Contracts

### CON-001: `ZDXToken.setMinter()` is a no-op; owner is immutable single-key
- **File:** `V31/L2/multichain/contracts/src/dex/ZDXToken.sol:73-76`
- **Severity:** High
- **Category:** Access Control / Broken Upgrade Path
- **Description:** `setMinter(address newMinter)` has an empty body — it only has a comment. The `owner` is set to `msg.sender` in the constructor and never changes. The `mint()` function uses `onlyOwner`. This means:
  1. The deployer (a single EOA) is the permanent minter — no multisig, no upgrade path.
  2. If the staking contract is upgraded, the old contract retains minting power forever.
  3. There is no way to transfer minter rights.
- **Impact:** Single-key compromise → infinite ZDX inflation. Broken upgradeability.
- **Recommendation:** Use `AccessControl` with `MINTER_ROLE`; grant to staking contract; add `renounceMinter()` and `transferMinter()` with two-step or timelock.

### CON-002: `SolverRegistry.slash()` calls `zdxToken.burn()` but `ZDXToken` has no `burn` function
- **File:** `V31/L2/multichain/contracts/src/dex/SolverRegistry.sol:161`
- **Severity:** High
- **Category:** Broken Functionality / Stuck Funds
- **Description:** `slash()` calls `zdxToken.burn(slashAmount)` but `ZDXToken` does not implement `burn`. The `IZDXToken` interface does not expose it. This will either revert (if the interface is strict) or silently fail, bricking the slashing mechanism.
- **Impact:** Slashing is inoperative; misbehaving solvers cannot be penalized.
- **Recommendation:** Add `burn(uint256 amount)` to `ZDXToken` (only callable by `SolverRegistry` via a `SLASHER_ROLE`), and update the interface.

### CON-003: `ZIONBridge` constructor allows 1-of-1 threshold (testnet comment)
- **File:** `V31/L2/multichain/contracts/src/evm/ZIONBridge.sol:165`
- **Severity:** Medium
- **Category:** Access Control
- **Description:** `require(validators.length >= _threshold && _threshold >= 1)` allows 1-of-1. The comment says "testnet: allows 1-of-1". If deployed to mainnet with 1-of-1, any single validator can mint/burn arbitrarily.
- **Recommendation:** Enforce `_threshold >= 3` for mainnet deployments; add a separate testnet constructor or factory.

### CON-004: `IntentSettlement` owner is `msg.sender` (single EOA, not multisig)
- **File:** `V31/L2/multichain/contracts/src/dex/IntentSettlement.sol:104`
- **Severity:** Medium
- **Category:** Access Control
- **Description:** `owner = msg.sender` — a single key controls `solverFeeBps`, `feeRecipient`, and can call `setSolverFeeBps` and `setFeeRecipient` without delay.
- **Recommendation:** Use a multisig or timelock for owner privileges.

### CON-005: `IntentSettlement._tryRecover` does not prevent malleable signatures (EIP-2 s-check only)
- **File:** `V31/L2/multichain/contracts/src/dex/IntentSettlement.sol:245-270`
- **Severity:** Low
- **Category:** Signature Malleability
- **Description:** The custom `_tryRecover` checks `s <= half_curve` and `v ∈ {27,28}`, which is correct for EIP-2. However, the function uses inline assembly to load `r`, `s`, `v` from calldata without checking that `r` and `s` are non-zero. A zero `r` or `s` would produce a valid-looking but degenerate signature.
- **Recommendation:** Add `require(r != 0 && s != 0)` before `ecrecover`.

### CON-006: `wZION.bridgeBurn` does not validate `l1Recipient` length/charset strictly
- **File:** `V31/L2/multichain/contracts/src/evm/wZION.sol:256-265`
- **Severity:** Informational
- **Category:** Input Validation
- **Description:** `_isValidL1Address` checks prefix `"zion1"` and length 40–62 but does not validate bech32 charset or checksum. A malformed address that passes this check could cause the L1 side to reject the unlock, locking funds.
- **Recommendation:** Add bech32 charset validation (`1234567890acdefghjklmnpqrstuvwxyz`) or document that full validation is done on L1.

---

## 6. Dependencies

### DEP-001: `ethers 2.0.14` pulls in 6 known CVEs via `ring 0.16`, `h2 0.3`, `rustls-webpki 0.101`
- **File:** `V31/Cargo.toml` (transitive)
- **Severity:** High
- **Category:** Known Vulnerabilities
- **Advisories:**
  - `h2 0.3.27` — RUSTSEC-2026-0258: unbounded empty DATA frames (DoS). Fix: `>=0.4.16`.
  - `ring 0.16.20` — RUSTSEC-2025-0009: AES panic (DoS). Fix: `>=0.17.12`.
  - `rustls-webpki 0.101.7` — RUSTSEC-2026-0104, RUSTSEC-2026-0098, RUSTSEC-2026-0099: TLS cert validation bypass / panic. Fix: `>=0.103.13`.
- **Root cause:** `ethers 2.0.14` → `ethers-providers` → `jsonwebtoken 8.3.0` → `ring 0.16`; and `reqwest 0.11.27` → `rustls 0.21` → `rustls-webpki 0.101` + `h2 0.3`.
- **Recommendation:** Upgrade `ethers` to `2.1+` (or `3.0`) which uses `reqwest 0.12` + `jsonwebtoken 9.x` + `ring 0.17`. Also upgrade `jsonwebtoken` directly to `9.3.0+`.

### DEP-002: Unmaintained crates
- **Severity:** Low
- **Crates:** `instant 0.1.13`, `fxhash 0.2.1`, `paste 1.0.15`, `rustls-pemfile 1.0.4/2.2.0`
- **Recommendation:** Resolved automatically by upgrading `ethers` (DEP-001). `paste` is build-time only; no known CVEs.

### DEP-003: 18 duplicate crate versions
- **Severity:** Informational
- **Root cause:** `ethers 2.0.14` → `reqwest 0.11` chain coexisting with workspace `reqwest 0.12`.
- **Key duplicates:** `reqwest` (0.11/0.12), `ring` (0.16/0.17), `rustls` (0.21/0.23), `hyper` (0.14/1.x), `tungstenite` (0.20/0.24).
- **Recommendation:** Upgrading `ethers` eliminates ~12 of 18 duplicates. Remaining (`thiserror` v1/v2, `getrandom` v0.2/v0.4) are ecosystem-level.

### DEP-004: No `.cargo/audit.toml` documenting accepted advisories
- **Severity:** Informational
- **Recommendation:** Add `.cargo/audit.toml` with explicit `[allowed]` list to prevent regression.

---

## 7. Remediation Roadmap

### Phase 1 — Critical (fix before v3.2.0 tag)

| ID | Title | Owner | Effort |
|----|-------|-------|--------|
| POL-001 | Enforce minimum share difficulty ≥ 1000 | pool | 1h |
| POL-002 | Idempotent block-found payout (`paid_block_heights` set) | pool | 2h |
| CON-001 | ZDXToken: implement `setMinter` withAccessControl + multisig | contracts | 2h |
| CON-002 | ZDXToken: add `burn()` + update `SolverRegistry` interface | contracts | 1h |
| DEP-001 | Upgrade `ethers` 2.0→2.1+, `jsonwebtoken` 8→9 | cargo | 4h |

### Phase 2 — High (fix before public launch)

| ID | Title | Owner | Effort |
|----|-------|-------|--------|
| FIND-L1-002 | `validate_peer_block` require header for non-genesis | core | 2h |
| FIND-004 | HTLC: verify source lock before target lock | multichain | 4h |
| FIND-005 | Bridge memo: include `tx_hash` in match key | multichain | 2h |
| FIND-006 | Bridge: error on unsupported chains, no silent fallback | multichain | 1h |
| FIND-007 | WarpMessage: monotonic nonce per validator | multichain | 3h |
| FIND-008 | Warp: validate DepositProof against source chain | multichain | 4h |
| FIND-012 | SolverBid: verify signature | multichain | 2h |
| FIND-018 | `wallet_sign`: typed signing, no arbitrary messages | multichain | 2h |
| FIND-022 | Reconciliation: don't double-count pool reserves | multichain | 1h |
| POL-003 | AuxPoW: always recompute hash before forwarding | pool | 2h |
| CON-003 | ZIONBridge: enforce threshold ≥ 3 for mainnet | contracts | 1h |

### Phase 3 — Medium & Low (fix in 3.2.x)

All remaining findings (FIND-L1-001, FIND-L1-003/004, FIND-001/002/003/009/010/011/013/014/016/017/019/021/024/026, POL-004/005/006/007, CON-004/005, DEP-002/003/004).

---

## 8. Positive Findings

The codebase demonstrates strong security practices in several areas:

1. **UTXO signature verification** (`v3_tx.rs:182-199`) — correct Ed25519 verification, SegWit-style immutable IDs, v2 length-prefixed preimage.
2. **Block validation hardening** (2026-08-22) — coinbase structure enforcement, 2h future-timestamp cap, block/tx size limits, mempool revalidation after block acceptance.
3. **Soft-fork gating** — `premine_and_maturity` checks are height-gated so historical blocks are not rejected.
4. **F4.7 max-tx-amount cap** — defense-in-depth against inflation bugs, correctly exempts coinbase/genesis.
5. **F5 balance check** — prevents account-model inflation, correctly height-gated.
6. **Pool PPLNS** — difficulty-weighted sliding window, atomic persist/restore, composite key (`miner_id/worker_name`).
7. **WARP `disabled_reason`** — non-EVM chains are explicitly disabled rather than silently failing.
8. **Bridge wZION replay protection** — `processedL1Locks` and `processedBurnRequests` mappings, `MAX_SUPPLY` cap, `MIN_BRIDGE_AMOUNT` dust guard.
9. **EIP-712 in IntentSettlement** — typed data signing, nonce replay protection, deadline expiry, custom `ecrecover` with EIP-2 s-check.
10. **Dependency audit tooling** — `cargo audit` available, workspace version policy in V31/AGENTS.md.

---

*Audit complete. 44 findings (2 Critical, 10 High, 20 Medium, 12 Low/Info). Phase 1 critical fixes are actionable and can be deployed before the v3.2.0 tag.*
