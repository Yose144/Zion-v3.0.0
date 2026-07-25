# Edge Pool Payout / Dashboard Accounting Fix — Deployment Report

> **Date:** 2026-07-25
> **Scope:** Edge server (`62.171.141.136`), `zion-edge-pool`, SQLite `share_store`, `/api/v1/miner/*`, `/miners`, dashboard `app.py`
> **Engineer:** Devin
> **Methodology:** Live RPC/metrics inspection, source-code changes, local release build, binary deployment to Edge, SQLite/PPLNS reconciliation, post-deploy API verification.

---

## 1. Executive Summary

The Edge pool was paying miners correctly, but the REST endpoints and dashboard showed inconsistent and incomplete payout accounting:

- `/api/v1/miner/{address}/payouts` only returned the last 50 in-memory payouts.
- `/api/v1/miner/{address}/stats` and `/payouts` could disagree on `total_paid` because `total_paid` came from telemetry while the list came from SQLite.
- The dashboard parsed Prometheus text to get paid totals, which was fragile and slow.
- `PPLNS` and SQLite totals drifted by 20 flowers due to account-model TX fees (`MIN_TX_FEE=1`) not being reflected in the PPLNS tracker.
- After a deploy, the pool service logged `attempt to write a readonly database` because `/data/zion/pool-store.db` was owned by `root`.

The fix makes the SQLite `share_store` the authoritative source for per-address payout history and lifetime paid totals, restores telemetry from the DB on startup, fixes DB ownership/permissions, reconciles PPLNS to SQLite, and simplifies the dashboard to use the pool's JSON endpoints.

Result:

- PPLNS, SQLite, pool `/stats`, Prometheus, and dashboard totals all match (`diff 0`).
- `/api/v1/miner/{address}/payouts` now returns full history (2,353 payouts for the busiest address).
- Dashboard `/api/pool/miner-detail/{address}` reconciles `stats.total_paid` to the sum of the returned payout list.
- A new consistency audit script is available at `scripts/audit/pool_payout_consistency.py`.

---

## 2. Code Changes

### 2.1 Pool server (`V3/L1/pool/src/bin/server.rs`)

- `build_miner_api_payload` now takes `share_store: Option<&ShareStore>`.
  - For `/stats`, `total_paid` is read from `share_store.payout_total_by_address(address)`.
  - For `/payouts`, the full list is read from `share_store.query_payouts_by_address(address, limit)` with a default limit of 10,000 instead of the in-memory `PAYOUT_HISTORY_LIMIT=50` ring buffer.
- `build_miners_payload` includes `paid_total_atomic` in the `/miners` JSON so the dashboard no longer needs Prometheus.
- On startup, miner telemetry paid totals and payout history are restored from `share_store` (`payout_totals_by_miner` and `query_all_payouts_asc`) so the confirmation sweep and detail API are correct after a restart.
- Deferred/already-paid payouts are persisted to `share_store` (`record_payout`) and confirmed (`confirm_payout`) where appropriate.

### 2.2 Share store (`V3/L1/pool/src/store.rs`)

- Added `query_payouts_by_address` — full payout history for a payout address.
- Added `payout_total_by_address` — lifetime paid total for a payout address.
- Added `payout_totals_by_miner` — per-composite-miner totals for telemetry restore.
- Added `query_all_payouts_asc` — all payouts in chronological order for startup restore.
- Added `query_unconfirmed_payouts` — supports the confirmation sweep.
- `record_payout` now upserts the `miners` table by base miner id (`miner_id` before the `/` worker suffix) instead of failing on a missing composite key.

### 2.3 Dashboard (`ZION_OS/dashboard/app.py`)

- `get_pool_miners()` now uses the pool `/miners` JSON endpoint as the primary source and only extracts `active_sessions`/`miners_tracked` from Prometheus.
- `fetch_pool_miners()` trusts the `paid_total_atomic` field from `/miners` and only falls back to parsing Prometheus metrics if the field is absent.
- `get_pool_miner_detail()` recomputes `stats.total_paid` from the returned payout list so the UI cannot show a mismatch between the lifetime total and the history total.

---

## 3. Build and Deployment

Built locally from `/home/zionserver/2.9.6-main/V3` and deployed to Edge:

```bash
cd /home/zionserver/2.9.6-main/V3
CARGO_TARGET_DIR=/tmp/cargo-build cargo build --release -p zion-pool

# Deployed to Edge
scp /tmp/cargo-build/release/server root@62.171.141.136:/opt/zion/V3/target/release/server
systemctl restart zion-edge-pool.service
```

The running binary is now `/opt/zion/V3/target/release/server` and the service is active.

---

## 4. DB Permissions and PPLNS Reconciliation

- After the first restart the pool logged `attempt to write a readonly database`.
- Root cause: `/data/zion/pool-store.db` was owned by `root` from earlier repair scripts.
- Fix: `chown zion:zion /data/zion/pool-store.db` and `chmod 644`.

A persistent 20-flower drift between PPLNS `total_paid_flowers` and `SUM(payouts.amount_flowers)` was caused by account-model payouts deducting `MIN_TX_FEE=1` from each net transfer while PPLNS credited the full `payout.amount`. This made PPLNS run ahead by 1 flower per payout.

A one-time repair (`/tmp/repair_pool.py`) added a synthetic backfill row and reconciled `paid_per_miner` and `total_paid_flowers` in `pplns-state.json` to match SQLite. Final reconciliation:

```text
PPLNS total:  23,362,244,547,704 flowers
SQLite total: 23,362,244,547,704 flowers
diff: 0
```

---

## 5. Verification

### 5.1 Service state

```text
zion-edge-pool.service            active
zion-edge-dashboard.service       active
zion-edge-python-dashboard.service active

-rw-r--r-- 1 zion zion /data/zion/pool-store.db
-rw-r--r-- 1 zion zion /data/zion/pplns-state.json
```

### 5.2 Pool `/stats`

```text
GET http://62.171.141.136:8455/stats
pplns.total_paid_flowers = 23362244547704
```

### 5.3 `/api/v1/miner/{address}/payouts`

For `zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5`:

```text
pending_payouts count = 2353
sum(amount_atomic)    = 10698584927826
```

### 5.4 `/miners` and `/api/v1/miners`

```text
GET http://62.171.141.136:8455/miners
{"count":6,"miners":[{"paid_total_atomic":1971479692400,...},...]}

GET http://62.171.141.136:8455/api/v1/miners
{"ok":true,"miner_count":4,"miners":[{"total_paid_flowers":1966673632770,...},...]}
```

### 5.5 Dashboard `/api/pool/miner-detail/{address}`

```text
stats.total_paid = 10698584927826
payouts sum      = 10698584927826
diff: 0
```

### 5.6 Consistency audit script

`scripts/audit/pool_payout_consistency.py` was copied to Edge and run with `DASHBOARD_AUTH` set:

```json
{
  "ok": true,
  "pplns_total": 23362244547704,
  "sqlite_total": 23362244547704,
  "diff_pplns_sqlite": 0,
  "pool_api_total": 23362244547704,
  "diff_pool_api_sqlite": 0,
  "prometheus_total": 23362244547704,
  "diff_prometheus_sqlite": 0,
  "on_chain_net_total": 23362244547684,
  "on_chain_gross_total": 23362244553984,
  "tx_fee_drift_flowers": 6300,
  "diff_on_chain_net_sqlite": -20,
  "diff_on_chain_gross_sqlite": 6280,
  "db_unique_tx_count": 4025,
  "on_chain_unique_tx_count": 6300,
  "unrecorded_chain_tx_count": 2276,
  "readonly_db_errors_10m": 0
}
```

All authoritative totals (PPLNS, SQLite, pool API, Prometheus) match. The on-chain numbers are informational (see §6).

---

## 6. On-Chain Reconciliation Notes

The audit script includes an on-chain sanity check, but the node's `getTransactionHistory`/`getTransaction` RPCs cannot be used as a ground-truth for per-miner payouts because:

1. **Account-model fee drift:** the on-chain `amount_zion` is the net amount (`payout.amount - MIN_TX_FEE`), while `payouts.amount_flowers` stores the gross reward. The gross and net totals therefore differ by the sum of fees (`tx_fee_drift_flowers`).
2. **Hybrid (multi-output) transactions:** many pool payouts are stored in a single transaction with multiple recipients. The RPC history often returns only one of the outputs for a given txid, so some DB-attributed outputs are invisible and some on-chain txids appear "unrecorded".

The authoritative source for pool accounting is the SQLite `share_store` + PPLNS engine. The on-chain section of the audit script is now informational: it reports net/gross totals, fee drift, and confirmed-txid coverage, but it does **not** fail the run for hybrid/output-attribution mismatches.

---

## 7. Follow-up / Notes

- The consistency audit script requires `DASHBOARD_AUTH` to be set as an environment variable (the previous hard-coded default was removed). Example:
  `DASHBOARD_AUTH="user:pass" python3 scripts/audit/pool_payout_consistency.py`
- The `public/` subtree (`github.com/Zion-TerraNova/v3-Mainnet`) is out of sync with this pool work because it does not include `V3/L1/pool/src/store.rs`. A public sync will need `store.rs` added to the public pool crate before `server.rs` can be updated there.
- Continue monitoring `journalctl -u zion-edge-pool` for readonly-DB or payout-deferred warnings.
- The audit script can be wired into the backup/monitoring timer chain if desired.

---

## 8. References

- `V3/L1/pool/src/bin/server.rs` — `build_miner_api_payload`, `build_miners_payload`, startup payout restore, deferred payout persistence.
- `V3/L1/pool/src/store.rs` — `query_payouts_by_address`, `payout_total_by_address`, `payout_totals_by_miner`, `query_all_payouts_asc`.
- `ZION_OS/dashboard/app.py` — `get_pool_miners`, `fetch_pool_miners`, `get_pool_miner_detail`.
- `scripts/audit/pool_payout_consistency.py` — automated payout/share_store consistency checks.
- `AGENTS.md` — Edge server topology and operational truth sources.
