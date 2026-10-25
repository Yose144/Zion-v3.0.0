# 3.2 Audit Recheck - Money-Path Follow-Up

Date: 2026-10-25. This is an internal source review, not the independent audit
required by G9. The source revision and measured boundaries are recorded in
`../AUDIT_PACKAGE.md`. No production deployment, live-chain transaction, key
rotation, or destination-contract change is part of this pass.

## Scope And Corrections

This pass revisits the earlier payout and WARP conclusions, rather than treating
passing tests or the presence of a `confirmations` method as proof of safety.
Review covers WARP router persistence, both execution directions, adapter
confirmation parsing, EVM burn ingestion, and custodial withdrawal creation and
submission. It is not a new whole-project or cryptographic/consensus audit.

Two earlier conclusions are withdrawn:

- "Confirmation/resume works on every chain" was not established. Transaction
  execution success and inclusion evidence were not consistently checked, and TON
  compared logical time with a masterchain sequence number.
- "Persist Executing before submission" did not guarantee durability while the
  router swallowed SQLite write failures. The guarantee requires a successful
  write, not just calling a persistence helper.

Mutating WARP API routes already require `WARP_API_KEY`; the burn-authorization
finding below is not an assertion of a currently unauthenticated endpoint.
Whether a production signer is configured, exposed, or has processed a bad proof
was not inspected in this pass.

## Findings And Required Remediation Behavior

| ID | Severity | Source finding | Remediation behavior |
|---|---|---|---|
| R6-01 | Critical, conditional on automated release keys and an accepted bad proof | Inbound release checked existence/finality of a supplied transaction but did not bind its burn event to the stored release parameters. | Verify an authoritative burn before signing. EVM binds configured contract, successful receipt, event identity, sender, gross amount, recipient and burn ID. Other adapters without a verifier hold; they do not silently pass. |
| R6-02 | High | EVM watcher used a three-argument event signature and a two-word ABI head, inconsistent with the five-argument `BridgeBurn` in `wZION.sol`; raw 18-decimal token amounts were treated as six-decimal flowers. Manual slicing could panic on truncated data. | Decode the repository contract's exact ABI with checked decoding; divide token atomic units by `1e12`, reject zero/overflow, and preserve canonical transaction/burn identities. Deployed ABI compatibility still needs independent verification. |
| R6-03 | High | Router initiation, status and destination-hash saves logged database failures and continued with newer in-memory state. | Persist candidate state first, propagate errors, and update memory/metrics/XP only after success. A failed pre-submit claim must produce no mint/unlock call. |
| R6-04 | High | Outbound execution selected inbound transfers too. Runtime construction also ignored configured adapter endpoints/contracts and enabled-chain boundaries. | Separate directions and construct runtime destination adapters from enabled configuration. Persistent API construction must preserve disabled-chain policy. |
| R6-05 | High | Several adapters counted failed or malformed transaction responses, or defaulted missing inclusion heights to zero; a zero configured threshold could complete without evidence. | Require explicit execution success and valid inclusion evidence, propagate lookup failures, reject future inclusion, and require at least one confirmation. TON holds until authoritative masterchain evidence exists. |
| R6-06 | High | Withdrawal creation debited before inserting the request. Its credit-back error branch awaited the same database mutex while holding it. Submission also preceded a durable claim and generic submit errors could trigger an unsafe refund. | Debit, request and journal entry commit atomically. Claim before submission; ambiguous outcomes and failed post-broadcast persistence remain `executing`, with neither automatic resend nor unproven refund. |
| R6-07 | Medium | Deferred/fee submit handling lacked response regression coverage and could accept incomplete success objects. Payout maturity fallback used the earning block instead of the transaction's actual inclusion block. | Share a strict submit parser; remove queued work only on a recognized success response. Compute maturity from actual transaction/UTXO inclusion height, never earning height. |

The reviewed source is `4108a52d0b47702dd97fbd1d6f4919ceb1aca6a4`. These
remediations are source-only; this table is not deployment evidence.

## Verification

The affected library suites passed: multichain 802 tests (four ignored, one
external-RPC test deliberately filtered), pool 356 tests, both single-threaded.
Afterward, a claim-failure assertion was strengthened, the inbound test listener
was made runtime-scoped, and log whitespace was corrected; the affected claim
test (1/1), inbound tests (4/4) and workspace check passed again. The full suites
were not rerun for those test/log-only changes.

Workspace check exits 0. Targeted rustfmt on all 22 changed Rust files exits 0;
workspace formatting exits 1 on pre-existing drift outside the patch, with
`node.rs` independently reproduced from the original HEAD. No unrelated
formatting or L1 consensus change is included. `git diff --check` passes.

Raw local evidence lives in `/tmp/audit-batch1-evidence/`:
`final-gate.log`, `gate-evidence.log`, `test-batch2.log`, and
`scope-4108a52d0.json`. Logs include failed intermediate attempts; only the
identified final runs substantiate these results. This is not full-workspace
test, live-provider, dependency-advisory, release-build or deployment validation.

## Safety Holds And Recovery

- Non-EVM automatic inbound unlocks require chain-specific authoritative burn
  verifiers before re-enablement. A transaction's confirmations alone do not prove
  token destruction, token identity, amount or destination.
- TON automatic confirmation/completion remains unsupported until the adapter can
  bind a transaction to a masterchain inclusion reference. Logical time is not
  such a reference.
- Canonical EVM identities feed the L1 replay key. A legacy case-variant or
  malformed stored identity holds for reconciliation; it is not silently
  rewritten and re-signed.
- A WARP or withdrawal `executing` record without a destination hash may already
  have broadcast. Operators must reconcile on-chain outcome before any retry or
  refund. A timeout is not proof of rejection.
- Existing ambiguous records are not repaired or resubmitted by this source
  change. No operator recovery action is executed here.

## Remaining Source Risks

These are not reclassified as operator-only or declared fixed by this pass.

1. Pool payout sidecar I/O remains best-effort. `load_payout_ledger` starts with an
   empty guard on unreadable/corrupt state; `persist_payout_ledger` warns and
   continues on write failure. IA-14 therefore remains only partially remediated:
   a sidecar is an improvement, not an unconditional at-most-once guarantee.
   Durable claims, fail-closed recovery and broadcast reconciliation need a
   complete payout-path follow-up.
2. The deferred payout queue is in memory and eventually exhausts retries.
   Strict response parsing does not make it a durable outbox, nor resolve an
   accepted submission whose response is lost.
3. WARP transfer acceptance and `daily_volume` updates are separate writes.
   Volume-write failure can undercount after restart and bypass the daily cap.
   The in-memory counter's UTC-day rollover also needs explicit handling.
4. Non-EVM destination payloads do not establish transfer-specific
   `warp_message_hash` replay protection. The exact guarantees depend on the
   destination programs and their deployed interfaces; no contract-level fix or
   deployment is claimed.
5. Deposit credit atomicity does not by itself establish safety for concurrent
   observers or all journal operations. `record_deposit` still uses replacement
   writes; the separate `UNIQUE(reference_id)` proposal requires operation-scoped
   semantics, existing-data inspection and migration planning, not a blanket
   unique constraint.
6. Adapter tests use local fixtures/mocks. They do not establish RPC-provider
   compatibility, deployed contract identity, source-chain finality under reorgs,
   or current production key custody.

## Operator And Independent-Audit Items

IA-07/08/09/10/19, QTU/PRL external-address ownership proof, destination-program
review, production rollout/reconciliation, and G9 remain open. Historical
production observations in older reports are not refreshed by this local pass.
`WARP_BTC_SWAP_ENABLED=0` remains a safety hold; this pass does not enable it.
