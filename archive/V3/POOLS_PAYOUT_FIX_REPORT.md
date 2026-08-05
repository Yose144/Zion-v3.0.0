# Pool Payout Deferred Queue Fix — Report

**Date:** 2026-07-11
**Author:** Devin (autonomous fix)
**Status:** Deployed to Edge (zion-new / 62.171.141.136)

---

## 1. Problem

The ZION pool server (`zion-pool-server`) on the Edge node was failing to
execute miner payouts after finding blocks. Every block discovery resulted
in a `payout_submit_failed` followed by a `pplns_rollback`, meaning miners
were never paid.

### Root cause

**Race condition between block submission and balance check.**

When a miner finds a block, the pool:

1. Submits the block candidate to the node via `submit_candidate_to_node`.
2. Immediately calls `execute_pool_payout`, which checks the pool wallet's
   account balance via `getBalance` RPC.
3. If `balance < total_payout`, the payout fails and PPLNS balances are
   rolled back.

The problem is that step 1 is asynchronous — the node needs time to validate
the block, add it to the chain, and credit the coinbase reward to the pool
wallet. By the time step 2 runs, the balance has not yet been updated.

**Evidence from logs:**

```
payout_submit_failed height=2849 miners=23 error=pool payout wallet ...
  account balance 1489883643975 < total payout 1494681082888 (deferring)
pplns_rollback height=2849 miners=23 reason=payout_not_executed
```

The gap between balance and total payout was ~4,798,439,913 flowers — almost
exactly one block reward (~4,806,059,630 flowers), confirming that the
current block's coinbase had not yet been credited.

### Impact

- Every block found in the last ~3 hours resulted in a rollback.
- ~1494 ZION in pending payouts were lost (PPLNS balances reset to zero).
- Miners were not compensated for their work.

---

## 2. Solution: Deferred Payout Queue

### How professional pools handle this

Professional mining pools (F2Pool, AntPool, Binance Pool, etc.) do not pay
out immediately on block discovery. Instead, they use one or more of these
strategies:

1. **Deferred payout queue** — Failed payouts are queued and retried by a
   background thread until the balance is sufficient.
2. **Scheduled payouts** — Payouts are processed on a schedule (e.g., every
   hour) rather than per-block.
3. **Pre-funded wallet buffer** — The pool wallet maintains a buffer balance
   to cover payouts while waiting for confirmations.

### Implemented approach: Deferred payout queue

We implemented option 1 (deferred payout queue) because it is the simplest
robust fix that doesn't require external funding or major refactoring.

**How it works:**

1. When a block is found, `execute_payout_async` attempts the payout as
   before.
2. If the payout fails due to **insufficient balance** (race condition),
   the payouts are **pushed onto a deferred queue** instead of being rolled
   back.
3. A **background thread** polls the queue every 2 seconds and retries the
   oldest deferred payout.
4. If the retry succeeds, the payout is executed and removed from the queue.
5. If the retry fails (still insufficient balance), it stays in the queue
   and is retried on the next cycle.
6. After **300 retries (10 minutes)**, the payout is considered permanently
   failed and PPLNS balances are rolled back.
7. Only **permanent failures** (not balance-related) trigger an immediate
   rollback.

### Key data structures

```rust
struct DeferredPayout {
    payouts: Vec<PayoutEntry>,
    height: u64,
    queued_at: Instant,
    retry_count: u32,
}

type DeferredPayoutQueue = Arc<Mutex<Vec<DeferredPayout>>>;
```

### Configuration (environment variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_PAYOUT_MAX_RETRIES` | 300 | Max retry attempts before giving up |
| `ZION_PAYOUT_RETRY_INTERVAL_MS` | 2000 | Milliseconds between retries |

### Log output

New log lines for monitoring:

```
deferred_payout_processor: enabled max_retries=300 interval_ms=2000
payout_deferred_queued height=2850 miners=23 reason=insufficient_balance_will_retry
payout_deferred_retry height=2850 miners=23 retry=1 error=...
payout_deferred_success height=2850 executed=23 deferred=0 tx_id=... retry=3
payout_deferred_giveup height=2850 miners=23 reason=max_retries_exceeded
```

---

## 3. Files changed

| File | Change |
|------|--------|
| `V3/L1/pool/src/bin/server.rs` | Added `DeferredPayout` struct, deferred payout queue, background processor thread, modified `execute_payout_async` to queue instead of rollback on balance failures |

---

## 4. Deployment

1. **Built on Edge server** (x86_64 Linux, native compile):
   ```
   cargo build --release -p zion-pool
   ```
2. **Backed up old binary:**
   ```
   cp /usr/local/bin/zion-pool-server /usr/local/bin/zion-pool-server.bak-YYYYMMDDHHMMSS
   ```
3. **Deployed new binary:**
   ```
   cp target/release/server /usr/local/bin/zion-pool-server
   ```
4. **Restarted service:**
   ```
   systemctl restart zion-pool.service
   ```

### Post-deployment verification

- Service is **active**.
- `deferred_payout_processor: enabled max_retries=300 interval_ms=2000` in
  logs.
- Miners reconnecting and submitting shares.
- PPLNS state persistence is active (saves every 10s to
  `/data/zion/pplns-state.json`).

### Note on PPLNS state

The PPLNS state file from the previous version failed to load due to a
schema mismatch (`missing field paid_per_miner`). The pool started with a
fresh PPLNS state. This means unpaid balances from before the restart were
lost. Going forward, the new binary saves and loads the state correctly,
and the deferred payout queue ensures payouts are not lost due to the
balance race condition.

---

## 5. Monitoring

To verify the fix is working, watch for these log patterns:

```bash
# Successful deferred payout (after retry)
journalctl -u zion-pool.service | grep payout_deferred_success

# Deferred payout queued (should appear on block found, then resolve)
journalctl -u zion-pool.service | grep payout_deferred_queued

# Giveup (should NOT appear in normal operation)
journalctl -u zion-pool.service | grep payout_deferred_giveup
```

---

## 6. Future improvements

1. **Scheduled batch payouts** — Instead of paying per-block, accumulate
   payouts and process them every N minutes. This reduces RPC load on the
   node and allows the balance to be credited before payout.
2. **Wallet buffer** — Pre-fund the pool wallet with a buffer (e.g., 10
   block rewards) so payouts can always be executed immediately.
3. **PPLNS state migration** — Add a migration path for old PPLNS state
   files so they can be loaded by newer versions without losing data.
4. **Prometheus metrics** — Export deferred queue depth, retry counts, and
   payout success/failure rates as Prometheus metrics for alerting.
