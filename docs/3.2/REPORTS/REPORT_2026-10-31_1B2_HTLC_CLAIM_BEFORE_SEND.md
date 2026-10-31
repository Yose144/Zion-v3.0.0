# 1.B2 — HTLC refund/claim claim-before-send + failure-mode release evidence

**Date:** 2026-10-31 · **Scope:** `V31/L2/multichain/src/swap/htlc.rs` · **Status:** code + tests done, deploy pending next warpd release

## Finding (pre-fix)

`HtlcSwap::refund` and `HtlcSwap::do_claim` both performed:

```
records lock → state checks → adapter.execute_outbound() → state = Refunded|Claimed → persist
```

Crash between `execute_outbound` returning and the state write+persist left the
record `Pending`. On restart (or a later call) the record looked un-settled, so a
retry would **re-broadcast the refund/release transaction** — the same ambiguous-
outbound double-send window class fixed for withdrawals (`executing`) and pool
payouts (4.B3/IA-14). For refunds this is the direct path to a double-refund of
the locked funds.

## Fix — claim-before-send, same discipline as withdrawal `executing`

New non-terminal states:

- `SwapState::Refunding` — set **and persisted** before `execute_outbound` in `refund()`
- `SwapState::Claiming` — set **and persisted** before `execute_outbound` in `do_claim()`

Semantics:

| Event | Result |
|---|---|
| outbound send **succeeds** | state → `Claimed`/`Refunded` + persist (unchanged happy path) |
| outbound send **errors** | record stays `Refunding`/`Claiming` in memory **and on disk** — outcome ambiguous, **never auto-resend** |
| crash mid-flight | on reload the record is `Refunding`/`Claiming` → retry is rejected (`Validation`), parks for **manual reconciliation** |
| `pending_records` / `expired_pending` | filter `== Pending` → in-flight records are **excluded from auto-refund sweeps** by construction |

Guard matrix added:

- `refund()` rejects `Refunding` ("already in flight — reconcile on-chain before retry")
- `refund()` rejects `Claiming` (a valid preimage was revealed; refund must not race the in-flight claim)
- `do_claim()` rejects `Claiming` (at-most-once on the release broadcast)
- `do_claim()` on a `Refunding` record stays **allowed**: refund and claim race on the
  same lock; the chain arbitrates and the preimage-carrying claim is legitimate
  until the refund confirms.
- `is_terminal()` unchanged — only `Claimed`/`Refunded` are terminal;
  `Error(String)` keeps its existing "manual intervention, retry allowed" semantics
  (it is also the operator's reset path back to retryable states).

Operator reconciliation (documented semantics, no new API needed): after checking
the chain, mark the record `Refunded`/`Claimed` if the broadcast landed, or reset
it to `Pending`/`Error` to re-enable the retry path.

**Rollback note:** rows persisted as `refunding`/`claiming` fail to deserialize in
older binaries — same forward-only schema step as any enum addition; only written
by new code and only for in-flight settles.

## Release evidence — regression tests (all new, in `swap::htlc::tests`)

| Test | Proves |
|---|---|
| `htlc_refund_in_flight_blocks_refire` | `Refunding` record: `refund()` → `Validation`, marker stays |
| `htlc_claim_in_flight_blocks_reclaim_and_refund` | `Claiming` blocks second claim **and** refund |
| `htlc_in_flight_states_excluded_from_pending_and_expired` | `Refunding`+`Claiming` never re-picked by `pending_records`/`expired_pending` sweeps |
| `htlc_refunding_survives_restart_and_blocks_refire` | `Refunding` persisted → `load_from_db` on a fresh swap → `refund()` still refused (crash-recovery hold end-to-end) |
| `htlc_refund_after_terminal_claim_rejected` | `Claimed` terminal → refund rejected |

Pre-existing coverage kept green (the full matrix of record states is now exercised):

- `htlc_refund_fails_before_timelock` — refund before expiry rejected
- `htlc_refund_succeeds_after_timelock` — happy path + deterministic offline tx hash
- `htlc_claim_fails_after_refund` — terminal `Refunded` blocks claim
- `htlc_refund_persists_to_db` — `Refunded` row durable
- `htlc_expired_pending_returns_expired_only` — sweep selects only `Pending`+expired
- `htlc_claim_fails_with_invalid_secret`, `htlc_claimant_pubkey_enforced`,
  `htlc_claim_fails_without_source_confirmation`, `htlc_persists_and_reloads_from_db`

## Test results

- `cargo test -p zion-multichain --lib swap::htlc` → **29/29 passed**
- `cargo test -p zion-multichain --lib` → **810 passed, 0 failed, 4 ignored**
  (ignored = network-gated `QUANTUS_LIVE` integration tests)

## Deployment note

Source-level fix; deployed with the next `warpd` release — `WARP_BTC_SWAP_ENABLED=0`
hold stays active on prod, so no HTLC refund path is reachable in production until
then (same exposure window as before; the fix removes it for the enable event).
