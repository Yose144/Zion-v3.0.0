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

Deployment and post-restart checks are pending at report creation. Record the
deployed commit, service health, persistence artifacts, and observed
Prometheus metrics here only after verifying them on the production pool host.
