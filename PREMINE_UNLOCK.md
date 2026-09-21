# Premine Unlock Path — On-Chain 3-of-3 Admin Authorization

> **Status:** IMPLEMENTED (code) · **PENDING** (deployment + first live unlock)
> **Created:** 2026-09-21
> **Scope:** V31 native chain (`V31/L1/core`), consensus-level premine locks
> **Context:** [`docs/3.1/REPORTS/REPORT_2026-08-22_PREMINE_LOCK_BYPASS.md`](docs/3.1/REPORTS/REPORT_2026-08-22_PREMINE_LOCK_BYPASS.md)

---

## Why this exists

Since the premine-lock soft fork activated on Edge
(`ZION_SOFT_FORK_ACTIVATION=13100`), **every** premine output — all 14 slots —
is frozen at consensus level. `Node::validate_premine_and_maturity_for_tx`
rejects any spend of a `PREMINE_OUTPUTS` address unless its admin-lock has
been released.

That is the correct security posture, but it left a gap: there was **no way
to legitimately unlock** a premine address (e.g. to fund OASIS payouts, DAO
treasury grants, or migration). `ValidationContext::admin_unlocked_addresses`
existed conceptually but nothing populated it.

This document describes the implemented unlock path: an **on-chain 3-of-3
admin multisig authorization** recorded in the UTXO state.

## Mechanism

An unlock authorization is an ordinary V31 native transaction with two
special properties:

1. **Inputs:** it spends at least one UTXO owned by **each** of the three
   canonical admin addresses
   (`v3_compat::ADMIN_L1_ADDRESSES` = Rama, Sita, Hanuman). Each input carries
   a normal `sig || pubkey` script, so the existing `verify_input` path
   cryptographically proves all three admins signed the same
   `Transaction::signing_hash` — the same hash binds inputs, outputs and
   memo, so the authorization cannot be tampered with.
2. **Memo:** `ZION:ADMIN_UNLOCK:v1:<premine_address>[:<reference>]`
   - `<premine_address>` must be one of the 14 canonical `PREMINE_OUTPUTS`
     addresses — anything else is ignored.
   - `<reference>` is an optional opaque audit tag (≤64 printable ASCII
     bytes). Convention: carry the executing `AdminProposal.proposal_id`
     (from `admin.rs` — e.g. a `TreasurySpend` proposal after its 7-day
     timelock and DAO vote) or the DAO proposal id, so the on-chain record
     links back to the off-chain governance decision.

When such a transaction is successfully applied, `UtxoSet::apply_transaction`
records the target address in `UtxoSet.admin_unlocked`. From that point in
the chain onward, spends of that premine address pass the admin-lock check.
(Any `unlock_height` time-lock still applies independently — the DAO treasury
slots 6–8 additionally require height ≥ 144 000.)

### Why a UTXO-spend design

- **Consensus-safe & deterministic:** the unlock is data in a block. Every
  node derives the identical `admin_unlocked` set by replaying the same
  blocks — no config drift, no node-local trust.
- **Restart-safe:** the set is rebuilt by the same
  `apply_block_unchecked` replay that reconstructs the UTXO set at startup.
- **Reuses real signatures:** no new key type or signature scheme — the
  multisig proof is three ordinary Ed25519 input signatures.
- **Atomic ordering:** validation and application are interleaved per
  transaction (`submit_block`, `block_template`), so an unlock tx followed
  by a premine spend in the *same* block works deterministically; an unlock
  also trivially covers all later blocks.

### Replay / edge semantics

- Unlocking an already-unlocked address is a no-op (idempotent set insert).
- The 3 admin inputs are consumed normally; a replay of the same transaction
  is impossible (double-spend).
- A tx that spends admin UTXOs but has a wrong/missing/malformed memo is just
  a normal spend — it records nothing.
- A tx with fewer than all three distinct admin addresses records nothing.
- Admin addresses with no spendable UTXO cannot participate — fund each
  admin address with a small amount first.

## Operational procedure (off-chain)

The on-chain tx proves the admin multisig; the *decision* process stays in
`admin.rs` (`AdminProposal`, quorum, timelocks, `requires_dao_vote`) and the
zion-dao service:

1. **Governance:** create an `AdminProposal` (`TreasurySpend` / appropriate
   `AdminOpType`), collect 3-of-3 signatures, wait the timelock, record the
   DAO vote. Note the `proposal_id`.
2. **Fund admins:** send a small dust amount (e.g. 0.01 ZION each) to the
   three `ADMIN_*_L1_ADDRESS` addresses so each has a spendable UTXO.
3. **Build the tx:** `v31_wallet::build_admin_unlock_tx(admin_inputs,
   refund_address, target, Some(proposal_id), fee)` — each admin signs the
   shared `signing_hash` offline; keys never co-locate. Returns dust minus
   fee to `refund_address`.
4. **Broadcast** via `submitUtxoTransaction` / `submitTransaction` RPC.
5. **Verify** on every node: `getAdminUnlocks` RPC returns the unlocked set.
   Only then submit the actual premine spend.

## Deployment / consensus notes

- **Upgrade all validators first.** Nodes running the previous binary accept
  an unlock tx as an ordinary spend but still reject the subsequent premine
  spend — a mixed network would stall. Deploy to all three Edge nodes
  (and any future validators) before broadcasting the first unlock.
- The mechanism takes effect only while the premine soft fork is active
  (`ZION_SOFT_FORK_ACTIVATION`, currently `13100` on Edge); the recording
  itself is unconditional and replay-derived.
- **Unlock is permanent and address-scoped.** There is no re-lock. After a
  legitimate spend, sweep remaining funds to a fresh controlled address —
  governance should treat each unlock as a one-way door for that slot.
- `getAdminUnlocks` reports `{unlocked: [...], admin_addresses, memo_prefix}`
  for operator verification.

## Files

| File | Change |
|---|---|
| `V31/L1/core/src/v3_compat.rs` | `ADMIN_L1_ADDRESSES`, `ADMIN_UNLOCK_MEMO_PREFIX`, `parse_admin_unlock_memo`, `admin_unlock_target` + parser/quorum tests |
| `V31/L1/core/src/utxo.rs` | `UtxoSet.admin_unlocked` + `admin_addresses`, recording in `apply_transaction`, `is_admin_unlocked`, test admin override hook |
| `V31/L1/core/src/node.rs` | `validate_premine_and_maturity_for_tx` / `validate_premine_for_mempool` now consult the on-chain unlock set; E2E tests |
| `V31/L1/core/src/v31_wallet.rs` | `build_admin_unlock_tx` — canonical 3-of-3 unlock builder |
| `V31/L1/core/src/rpc.rs` | `getAdminUnlocks` JSON-RPC method |

## Tests

`cargo test -p zion-core --lib` — new coverage:

- `v3_compat::tests::admin_unlock_memo_*` — memo parsing, ref bounds,
  malformed/non-premine rejection.
- `v3_compat::tests::admin_unlock_target_requires_all_admins` — 2-of-3
  rejected, unrelated inputs ignored, duplicates handled.
- `node::tests::premine_spend_allowed_after_admin_unlock_tx` — full path:
  locked → 2-of-3 tx records nothing → 3-of-3 unlock applied → gate passes;
  other slots stay locked.
- `node::tests::unlock_survives_utxo_set_rebuild` — unlock survives the
  `apply_block_unchecked` startup replay.
- `v31_wallet::tests::build_admin_unlock_*` — builder rejects non-admin
  inputs, unknown targets, and keys that don't derive to admin addresses.

## Non-goals / notes

- The DAO vote itself is not verified on-chain (zion-dao is an L2 service);
  the memo `reference` is the audit link. L1 enforces the 3-of-3 admin
  multisig — which per `admin.rs` policy must not execute `TreasurySpend`
  without DAO approval.
- No expiry or revocation: permanent by design; rotate funds out after use.
- Premine secret keys stay offline regardless — the unlock tx only needs the
  three *admin* keys.
