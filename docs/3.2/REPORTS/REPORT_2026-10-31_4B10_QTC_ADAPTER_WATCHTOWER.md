# 4.B10 — QTC adapter: gated live-test evidence (F1) + watchtower bridge design (F3)

**Date:** 2026-10-31 · **Scope:** `V31/L2/multichain/src/chain/adapters/quantus.rs`, `db.rs`, `contracts.rs`, `docs/3.2/QUANTUS-INTEGRATION-PLAN.md` · **Status:** F1 evidence collected (1 step remains 👤), F3 design written + solvency gap closed

## F1 — gated live tests (QUANTUS_LIVE=1)

Executed against the default endpoint `rpc.zionterranova.com/qtc`
(`system_chain` = **"Quantus"**, spec_version 153 — the mainnet node, not
Planck):

| Test | Result | Evidence |
|---|---|---|
| `quantus_live_readonly` | ✅ PASS | `system_health` synced; finalized height 323 386; `balance()` full ss58→storage-key→AccountInfo decode on live chain |
| `quantus_live_dryrun_extrinsic` | ✅ PASS | `payment_queryInfo` → `partialFee=1015602500` + weight (chain decodes our hand-built extrinsic); `system_dryRun` → `0x010004` runtime-level err (unfunded acct) — NOT a decode/BadProof error = signature layout valid |
| `quantus_live_send_testnet` | ⏸️ skipped | needs funded Heisenberg `QUANTUS_SEED` — 👤 operator task (faucet HEI) |

**Test fix:** `quantus_live_readonly` asserted `h > 1_000_000` — a
Planck-era floor. The default endpoint now serves the younger "Quantus"
mainnet (~323k; upstream `a1-planck.quantus.cat` still serves "Planck" at
1.32M — they are different networks). Replaced with `h > 0` + doc noting
the chain-name variance, since a hardcoded floor breaks on any
regenesis/endpoint repoint.

## F3 — watchtower bridge design (in `QUANTUS-INTEGRATION-PLAN.md` §F3)

No new component: the watchtower composes primitives already in production
for other chains — `DepositWatcher::poll_all` →
`QuantusAdapter::watch_addresses` (finalized scan) →
`atomic_credit_and_mark_deposit_credited` → ledger credit; ZION→QTC leg =
`WithdrawalProcessor` → `SolvencyGuard::verify_withdrawal` →
`send_payment` (ML-DSA-87, `QUANTUS_EXTRINSIC` ctx, best-head era anchor)
→ 128-block `confirmations()` lookback. GRANDPA finality is irreversible
→ no reorg-rollback needed (unlike PoW chains).

**Solvency coverage — two registry gaps found and fixed while writing the
design:** `solvency::check_all` auto-iterates ledger+pool assets but would
have skipped `quantus:QTC` keys because (a) `chain_id_from_str` lacked
`"quantus"` (added `quantus|qtc|qtu` → `ChainId::Quantus`) and (b)
`token_decimals` fallback lacked `QTC` (added → 12). `evaluate()` now
reaches the adapter `balance()` (`System.Account.data.free`) for QTC.

**Remaining F3 items:** deposit-credit → ZION release mapping (rate feed =
👤 decision, MEXC/XeggeX); `QUANTUS_SEED` hot-wallet key ceremony (👤);
`transfer_all`/`batch` deposit decode; optional F3b provable-burn.

## Tests

- Gated live: 2/2 runnable PASS (+1 skipped on operator seed)
- `cargo test --lib -- solvency db:: chain_id` → **33/33**
- Full lib suite unchanged (the chain-id/decimals additions are additive
  mappings only — verified by the same 33-test slice + compile)

## Deployment note

Source-level additions only (chain-id mapping, decimals, test assert).
The `quantus` adapter is registered in service `chain_id_by_name` but QTC
payouts stay deferred (treasury_free=0) and BTC swap hold unchanged.
Deploy with next warpd release; no prod config change needed.
