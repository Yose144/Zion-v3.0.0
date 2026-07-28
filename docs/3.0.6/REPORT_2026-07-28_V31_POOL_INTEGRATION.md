# V31 Node + Pool Integration Report

**Date:** 2026-07-28  
**Status:** Alpha build — `cargo test --workspace` green, `cargo clippy --workspace` clean  
**Scope:** `V31/` — Node core (P2P/IBD, migration), Pool/Miner integration (F6 block template push, F1.2 PPLNS persistence, F2.4 anonymous mining).

---

## 1. Summary

This batch wires the V31 `zion-node` and `zion-pool` together so the pool can:

1. Receive a real `BlockTemplate` from the node via JSON-RPC `getBlockTemplate`.
2. Broadcast a Stratum `mining.notify` with a valid `header_hex`, `target_hex` and `job_id`.
3. Accept `mining.submit`, validate the share, detect a found block, reconstruct the full `Block`, and submit it to `zion-node` `submitBlock`.
4. Persist the PPLNS window across restarts and support anonymous `WALLET.worker` authorization.

The V3 → V31 chain migration path remains intact and is documented in `V31/ALPHA_BUILD_PLAN.md` §7.

---

## 2. Build & Test Results

```text
cargo clippy --workspace  -> clean (0 warnings/errors)
cargo test --workspace    -> 94 tests PASS
```

Highlights:

- `zion-core`: 22 tests
- `zion-cosmic-harmony`: 27 tests
- `zion-miner`: 11 tests
- `zion-multichain`: 20 unit tests + 1 integration test
- `zion-pool`: 20 tests (including new save/restore and anonymous-miner tests)

---

## 3. Key Changes

### 3.1 Node core (`V31/L1/core/`)

- `node.rs`
  - `BlockTemplate` now carries `template_id`, `header_hex`, `target_hex` and `block_reward` (in flowers) alongside `header_json` and `transactions`.
  - Added an atomic `next_template_id` counter to the `Node`.
  - `block_subsidy(next_height)` is exposed as the block reward for pool payouts.

### 3.2 Pool (`V31/L1/pool/`)

- `stratum.rs`
  - Stores the full `zion_core::BlockTemplate` for each job.
  - `mining.notify` is broadcast with `header_hex`, `target_hex` and `clean_jobs`.
  - On a found block, `header.nonce` is set to the submitted nonce and a complete `Block` is POSTed to `submitBlock`.
- `pool.rs`
  - Added `worker_addresses` map for authorized payout addresses.
  - `register_worker("WALLET.worker")` extracts the wallet portion (when it starts with `zion1`) and uses it for PPLNS payouts.
  - Added `save()` / `restore()` methods for PPLNS state persistence.
- `pplns.rs`
  - `ShareRecord` and `PplnsState` derive `Serialize`/`Deserialize`.
  - `save_to(path)` writes a temp file and atomically renames it.
  - `restore(path)` loads the window from disk.
- `config.rs`
  - Added `state_path: Option<String>` for the PPLNS JSON snapshot.

### 3.3 Multi-Chain service (`V31/L2/multichain/`)

- `chain/adapter.rs`
  - `BlockTemplate` carries a `raw: serde_json::Value` field so the full node response can be forwarded to the pool.
- `chain/adapters/zion_l1.rs`
  - `ZionL1Adapter::block_template()` reads `template_id`, `header_hex`, `target_hex`, `block_reward` and stores the raw response.
- `server.rs`
  - Restores PPLNS state on startup.
  - Polls `getBlockTemplate` every 10 s and pushes jobs to `StratumServer`.
  - Saves PPLNS state every 30 s in a background task.
- `config.rs`
  - `PoolConfigFile` and `to_pool_config()` pass through `state_path`.

### 3.4 Planning docs

- `V31/ALPHA_BUILD_PLAN.md` updated with sections 7 (migration), 8 (F6 pool integration) and 9 (F1/F2 operability/stratum v1).

---

## 4. Deployment Notes

- `zion-node` start with `--no-genesis` over a migrated SQLite DB.
- `zion-multichain` config (`pool.state_path`) points to the PPLNS snapshot file, e.g. `/data/zion/pplns-state.json`.
- External Stratum v1 miners can now connect with `mining.authorize "WALLET.worker"` and receive real block templates.

---

## 5. Remaining Full-Pool Work

- F2.1–F2.3: Full Stratum v1 codec, per-session job tracking, multi-protocol listener.
- F2.6: Variable difficulty (`mining.set_difficulty`) / per-worker share-rate targeting.
- F3: Async I/O rewrite for 10 k+ concurrent miners.
- F4: Persistent queryable PPLNS DB (SQLite) instead of JSON snapshot.
- F5: TLS/TCP for Stratum listener.
- Orphan monitoring and pool luck tracking (F1.5 / F1.6).

---

## 6. Files Changed

```text
V31/L1/core/src/node.rs
V31/L1/pool/src/stratum.rs
V31/L1/pool/src/pool.rs
V31/L1/pool/src/pplns.rs
V31/L1/pool/src/config.rs
V31/L2/multichain/src/chain/adapter.rs
V31/L2/multichain/src/chain/adapters/zion_l1.rs
V31/L2/multichain/src/server.rs
V31/L2/multichain/src/config.rs
V31/ALPHA_BUILD_PLAN.md
docs/3.0.6/REPORT_2026-07-28_V31_POOL_INTEGRATION.md
```

(Additional V31 source files modified/created in earlier steps are part of the same `V31/` alpha branch and are included in this commit.)
