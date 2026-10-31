# 4.B1 — Bridge smoke round-trip + validator/bridge-state monitoring

**Date:** 2026-10-31 · **Scope:** `V31/L2/multichain/src/warp/{router,server,validator,metrics}.rs` · **Status:** code + tests done, deploy pending next warpd release

## Deliverables

**(a) Round-trip smoke — `test_round_trip_outbound_then_inbound_completes`:**
a small ZION↔chain loop exercised end-to-end in-process: outbound
`initiate_outbound` → `AwaitingFinality → Validating → QuorumReached →
Executing → Completed`, then the matching inbound `initiate_inbound`
(distinct `tx_hash`+`burn_id`) driven to `Completed`; pending set drains to 0.
This is the pre-RC smoke shape; a live-chain smoke remains gated on real
destination contracts (the audit's disabled-chain holds apply).

**(b) Validator/bridge-state monitoring:**

- `GET /validators` (warpd, read-only like `/chains`):
  `{quorum, validators_total, validators_active, local_signers_active,
    can_sign_quorum_locally}` — counts only, no identities/keys.
  `can_sign_quorum_locally=false` = the bridge **cannot** produce signatures
  and transfers stall at `quorum_reached` → the operator alert condition.
- Prometheus gauges in `/metrics` (sampled live at scrape):
  `warp_validators_total`, `warp_validators_active`,
  `warp_validator_quorum`, `warp_validator_local_signers_active`,
  `warp_validator_can_sign_quorum` (0/1) — scrape-alertable without JSON.

New accessor `WarpValidatorSet::local_signer_count()` (same active-validator
filter `sign_locally`/`can_sign_quorum_locally` use); `can_sign_quorum_locally`
now delegates to it — one definition site.

## Tests

- `test_round_trip_outbound_then_inbound_completes` — full-loop lifecycle
- `test_prometheus_output_with_validator_gauges` — gauge rendering
- `test_prometheus_output` extended: no validator section when unset

`cargo test -p zion-multichain --lib warp::` → **656 passed, 0 failed, 1 ignored**

## Deployment note

Read-only additive endpoints; safe with the next warpd release. Prod config
keeps `WARP_BTC_SWAP_ENABLED=0` + 17 disabled chains with reasons — the
`/chains` + `/validators` surfaces now expose both sides of that state for
the pre-RC monitoring requirement.
