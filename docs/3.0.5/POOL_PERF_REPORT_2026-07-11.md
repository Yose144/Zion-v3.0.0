# Pool Performance Optimization Report — F1-F6

**Date:** 2026-07-11
**Commit:** `673632525`
**Binary:** `zion-pool-server` 2.35 MB (release, LTO fat)
**Server:** Edge `62.171.141.136` — deployed and verified

---

## 1. Root Cause: Watchdog Restart Loop

The pool was being restarted every 2 minutes by a buggy watchdog script, causing a reconnect loop that collapsed effective hashrate.

### Bugs Found

1. **`/dev/tcp` separator bug:** The watchdog used `/dev/tcp/127.0.0.1:8444` (colon separator), but bash's `/dev/tcp` builtin uses `/` as separator: `/dev/tcp/127.0.0.1/8444`. The TCP check always failed, triggering pool restarts every 2 minutes via systemd timer.

2. **Non-existent RPC method:** The watchdog called `getHeight` JSON-RPC method, which doesn't exist. The correct method is `getChainInfo`, which returns `.result.chain_height`.

### Fix

- Replaced `/dev/tcp` with `nc -z -w3` (netcat) for robust TCP health check
- Fixed RPC method to `getChainInfo` with `.result.chain_height` parsing
- Fixed watchdog deployed to `/usr/local/bin/zion-watchdog.sh` on server
- Saved in repo at `V3/deploy/new-server/zion-watchdog.sh`

### Verification

Two consecutive watchdog runs (00:48, 00:50) with no pool restarts. Pool stable for 5+ minutes, shares being accepted, blocks being found.

---

## 2. F1 — Thread Handle Reaping

**Problem:** Each miner connection spawns a thread (`thread::spawn`), and the `JoinHandle` is pushed to a `Vec`. When miners disconnect, the thread finishes but the handle remains in the Vec forever. With 1000+ miners connecting and disconnecting over days, this causes unbounded memory growth.

**Fix:** In the accept loop, when `handles.len() > 128`, reap finished handles:
```rust
handles.retain(|h: &thread::JoinHandle<Result<(), anyhow::Error>>| !h.is_finished());
```

**File:** `V3/L1/pool/src/bin/server.rs` — accept loop

---

## 3. F2 — Atomic Share Counters

**Problem:** `MiningPool` share counters (`accepted_shares`, `rejected_shares`, `stale_shares`) were `u64` fields updated via `&mut self` methods. This required locking the entire `MiningPool` mutex for every share submission, creating contention with 1000+ miners.

**Fix:** Changed counters to `AtomicU64`. New methods take `&self` instead of `&mut self`:
- `record_accepted_share(&self)` — `self.accepted_shares.fetch_add(1, Ordering::Relaxed)`
- `record_rejected_share(&self)` — `self.rejected_shares.fetch_add(1, Ordering::Relaxed)`
- `record_stale_share(&self)` — `self.stale_shares.fetch_add(1, Ordering::Relaxed)`

**Files:** `V3/L1/pool/src/lib.rs`, `V3/L1/pool/src/bin/server.rs`

---

## 4. F4 — Batched Logging Channel (LogChannel)

**Problem:** With 1000+ miners each generating 5-10 `println!` calls per share submission, synchronous stdout writes (each a syscall + kernel buffer flush) become a major bottleneck. `println!` acquires a global stdout lock on every call.

**Fix:** Created `LogChannel` struct with:
- `mpsc::sync_channel::<String>(4096)` — bounded channel, non-blocking send
- Background thread that batches log lines into 4KB chunks
- Flushes every 100ms via `recv_timeout`
- On channel full, lines are dropped (prefer dropping logs over blocking miner threads)

Replaced hot-path `println!` calls in the submit loop:
- `iteration`, `issued_job_id`, `wire_job`, `wire_submit`, `iteration_elapsed_ms`
- `hash_mismatch_info`, `share_stale`, `share_below_target`, `valid_share`
- `vardiff_retarget`, `share_status`, `wire_result`, `NoSolution`

Low-frequency `println!` calls (startup, shutdown, session start/end, payout, routing snapshot) were left as-is — they don't impact hot-path performance.

**File:** `V3/L1/pool/src/bin/server.rs` — `LogChannel` struct + `handle_client` submit loop

---

## 5. F5 — Async Payout Execution

**Problem:** When a miner finds a block, the pool executes on-chain payouts via N sequential RPC calls to the node (one per miner with a balance above the payout threshold). With 12 miners this takes ~600ms; with 1000 miners it could take 50+ seconds. During this time, the miner thread that found the block is blocked and cannot process new shares.

**Fix:** Extracted payout execution into `execute_payout_async()` function that runs in a background thread:
- Miner thread: records block found, computes payouts, records pending in telemetry, spawns payout thread
- Payout thread: executes `execute_pool_payout()`, records submitted/failed payouts in telemetry, rolls back PPLNS on failure

The `Arc<Mutex<PplnsEngine>>` and `Arc<Mutex<MinerTelemetryRegistry>>` are cloned into the spawned thread, so telemetry and PPLNS state are updated correctly.

**File:** `V3/L1/pool/src/bin/server.rs` — `execute_payout_async()` function + block-found handler

---

## 6. F6 — PPLNS Persistence Optimization

**Problem:** The PPLNS persistence thread ran every 10 seconds and called `save_to_path()`, which held the PPLNS mutex during:
1. Snapshot clone (clones all HashMaps — `window`, `addresses`, `unpaid`, `paid_per_miner`, `shares_per_miner`, `last_share_time_per_miner`)
2. JSON serialization (`serde_json::to_vec`)
3. File write (`std::fs::write` to temp file)
4. Atomic rename (`std::fs::rename`)

With 1000 miners, the HashMaps are large and serialization + file I/O takes significant time, blocking share submissions that need the PPLNS lock.

**Fix — Two-part optimization:**

### Part A: Lock-split (snapshot under lock, write outside)
- Hold the PPLNS mutex only for `snapshot()` clone + dirty-flag check
- Release the lock, then serialize + write file outside the lock
- New method: `PplnsEngine::write_snapshot_to_path(&snap, path)` — standalone function

### Part B: Dirty flag
- Added `dirty: bool` field to `PplnsEngine`
- Set to `true` in all mutating methods: `record_share_with_diff`, `record_share_at_diff`, `record_block_found`, `record_invalid_share`, `register_address`, `distribute_to_miners`, `rollback_payouts`, `restore_fees`
- `take_dirty()` method returns `true` if state changed since last save, and clears the flag
- Persistence thread skips save entirely when `!take_dirty()` — no JSON serialize, no file I/O

**Files:** `V3/L1/pool/src/pplns.rs` (dirty flag + `write_snapshot_to_path` + `take_dirty`), `V3/L1/pool/src/bin/server.rs` (persistence thread)

---

## 7. F3 — Per-Session Job Tracking (Deferred)

**Status:** Skipped — too large a refactor for this pass. Would require restructuring the job issuance flow to track per-session job IDs for stale detection and vardiff management.

---

## 8. Additional Fixes

### Workspace Cargo.toml
- Added missing `bip39`, `hmac`, `pbkdf2` to `[workspace.dependencies]` (were referenced by `V3/L1/core/Cargo.toml` but not declared in root workspace)
- Removed stale `DeekshaDebug` and `PUBLIC/cli` workspace members (directories don't exist)

---

## 9. Build & Test Results

```
cargo build --release -p zion-pool   →  SUCCESS (1 dead-code warning)
cargo test -p zion-pool              →  106/106 PASS
  - 73 lib tests (pplns, ncl_gateway, pool protocol)
  - 33 bin tests (server: routing, revenue, bridge, protocol)
```

## 10. Deployment Verification

- Binary copied to `zion-new:/usr/local/bin/zion-pool-server`
- `systemctl restart zion-pool.service` → active
- 1000+ shares accepted in 30 seconds
- PPLNS state restored from `/data/zion/pplns-state.json` (20 miners, 50 shares, 307B flowers total paid)
- Pool stable, no reconnect loops
- Watchdog running clean (no false-positive restarts)

---

## 11. Files Changed

| File | Changes |
|------|---------|
| `V3/L1/pool/src/bin/server.rs` | F1 (thread reaping), F4 (LogChannel + hot-path log replacements), F5 (execute_payout_async + block-found handler), F6 (persistence thread lock-split), test fix (handle_client args) |
| `V3/L1/pool/src/lib.rs` | F2 (AtomicU64 counters, &self methods) |
| `V3/L1/pool/src/pplns.rs` | F6 (dirty flag, take_dirty, write_snapshot_to_path) |
| `V3/deploy/new-server/zion-watchdog.sh` | Watchdog fix (nc + getChainInfo) |
| `Cargo.toml` | Workspace deps fix (bip39/hmac/pbkdf2), stale members removed |
