# Pool persistence hardening — 2026-10-21

## Scope

The first robustness increment hardens PPLNS snapshot and configured SQLite
share-store startup behavior in `V31/L1/pool`. It does not change share
validation, payout calculations, consensus, or database schema.

## Changes

- A missing PPLNS snapshot remains a valid first-run state. An unreadable or
  malformed configured snapshot now returns an error and prevents pool startup
  instead of silently starting with empty accounting state.
- Snapshot writes keep the PPLNS dirty flag until the atomic write succeeds.
  The temp file is fsynced before rename, and the parent directory is fsynced
  on Unix. Write failures are counted and the next save cycle can retry.
- The production pool constructor is fallible (`Pool::try_new`); the legacy
  `Pool::new` wrapper remains for existing callers and tests.
- If a SQLite share-store path is explicitly configured but the store cannot
  be opened, startup fails instead of disabling block/payout persistence.
- Prometheus output exposes whether PPLNS persistence and the SQLite share
  store are configured, the last successful PPLNS save timestamp, and the
  process-lifetime save-failure count.
- Tests cover malformed snapshots, failed-write retry and counters, and the
  persistence metrics payload.

## Validation

- `cargo test --manifest-path V31/Cargo.toml -p zion-pool --lib` —
  **338 passed, 0 failed**.
- `cargo clippy --manifest-path V31/Cargo.toml -p zion-pool --all-targets` —
  completed successfully. Existing warnings remain in the wider pool/miner
  code; no warning remains for the removed unused import.
- `rustfmt --edition 2021 --check` on the four changed Rust files — passed.
- `git diff --check` — passed.

## Accounting limitation

The native-revenue request, its SQLite audit row, PPLNS unpaid balances, and
external payout queue are still not one crash-safe transaction. This change
does not claim to solve that gap. An idempotent journal/reconciliation design
is still required before payout-audit durability can be considered complete.
Host-level HA is also a separate follow-up and remains gated on a reliable
standby host and split-brain-safe operator procedure.

## Deployment

Deployed to the production Edge pool on 2026-10-21 from commit `a3d02aa47`.
The original `/opt/zion/V31` checkout was inconsistent with its pool crate
dependencies, so its direct build failed with compile errors; the service was
left running and was not restarted. The exact committed `V31/` source was
then extracted into an isolated build directory and built successfully.
Only the resulting pool binary was installed; the four temporary source-file
copies in the inconsistent checkout were restored from their pre-deploy
backups.

- Pre-deploy binary backup:
  `/opt/zion/backups/pool-hardening-before-a3d02aa47/zion-pool`.
- Deployed binary SHA-256:
  `1cfdca0c0e61978cb80e3d7ea5f2358f181394c5e79e455a0a88a5e939a50793`.
- `zion-v31-pool`: active after restart.
- Local pool health endpoint: HTTP 200, `{"status":"ok"}`.
- PPLNS snapshot and SQLite share-store files were present at the configured
  service paths before deployment.
- Prometheus confirmed PPLNS persistence and share store configured, last
  successful save timestamp populated, and `0` save failures.
- Stratum ports 8444 and 8445 were listening.
- Public `https://pool.zionterranova.com/public/v1/coins`: HTTP 200, 12 coins.

## Follow-up — native-revenue journal and payout outbox (2026-10-21)

### Scope and implementation

This follow-up closes the native-revenue accounting gap described above. It
is a code change only: **it has not been deployed to Edge**.

- SQLite schema v5 adds a pending/committed revenue journal and a durable
  payout outbox. Existing v3/v4 revenue rows migrate as `committed`, because
  they may already have been distributed. The migration also handles
  re-entry if the schema change was interrupted before `user_version` moved.
- Each revenue event gets an idempotency marker in the durable PPLNS snapshot.
  The pool persists outbox entries first, then the PPLNS state, then commits
  the journal row. Startup replays pending rows before opening listeners and
  fails closed if recovery cannot be made durable.
- External payout POSTs return pending outbox records repeatedly, with
  `outbox_id` values. A new admin-authenticated ACK endpoint marks them
  delivered only after the QTC or PRL sweeper has written its own payout
  ledger. Dust payouts are explicitly ledgered as `dust`; unsupported
  entries remain unacknowledged for operator review.
- Revenue intake now returns 5xx on missing durability configuration or
  persistence errors rather than reporting success after an audit-write
  failure.

### Validation

- `cargo test --manifest-path V31/Cargo.toml -p zion-pool --lib` —
  **342 passed, 0 failed**. Includes v4 migration behavior, prepared-event
  crash recovery, idempotent outbox ACK, and API delivery/retry coverage.
- `cargo test --manifest-path V31/Cargo.toml -p zion-multichain --lib` —
  **738 passed, 0 failed, 4 ignored**. Includes QTC and PRL sweeper tests
  against a local HTTP double; each test checks that the payout ledger row
  exists before the pool accepts its outbox ACK.
- `cargo check --manifest-path V31/Cargo.toml -p zion-pool --bin zion-pool` —
  passed.
- Targeted Clippy for `zion-pool` and `zion-multichain` all-targets completed
  successfully; existing warnings remain in unrelated code.
- `rustfmt --edition 2021 --check` for the touched Rust files and
  `git diff --check` — passed.
- No production deploy or live payout was performed as part of this follow-up.

### Remaining pre-deploy checks

- Exercise startup replay against a copied production database and PPLNS
  snapshot, including the crash boundaries around outbox, snapshot, and
  journal commit.
- After the migration rehearsal passes, plan a separately approved deployment
  window. No production deployment or live payout is authorized by these
  local tests.
