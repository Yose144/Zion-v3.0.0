# ZION TerraNova v3.0.6 — Bridge Vault UTXO Scale Fix Report

## TL;DR

Fixed the bridge-unlock UTXO scaling bug that caused inflated change outputs and wrong bridge-vault balance displays. The builder and validator now scale legacy 1e12 bridge-vault UTXO amounts to post-migration 1e6 flowers, and the `getBridgeVaultBalance` / `getUtxos` RPCs report the scaled balance consistently.

## Root cause

- `V3/L1/core/src/lib.rs` `build_bridge_unlock_transaction` selected bridge-vault UTXOs via `spendable_utxos(fee::BRIDGE_VAULT_ADDRESS)` and summed `utxo.amount` raw, then wrote `change = total_input - amount_flowers - fee` directly into a `TxOutput` without converting legacy-scale amounts.
- Genesis bridge-vault UTXOs in `V3/L1/core/src/genesis.rs` are in legacy 1e12 scale: `100_000_000` ZION → `100_000_000_000_000_000_000` flowers, split into six outputs of `16_666_666_666_666_666_666` / `...670`.
- `ZION_MIGRATION_HEIGHT=1` in deployment configs means genesis (height 0) is pre-migration, so the raw UTXO value is `1e6`× too large when used with current `amount_flowers`.
- `getBridgeVaultBalance` called `rt.utxo_balance()` (raw sum), while `getBalance` used `scaled_utxo_balance()` which divides by `MIGRATION_DIVISOR=1_000_000` for pre-migration outputs.

## Fix implemented

### `V3/L1/core/src/bridge.rs`

- Added `BRIDGE_UNLOCK_SCALE_FIX_HEIGHT` atomic (default 0 = active from genesis) plus `set_bridge_unlock_scale_fix_height` and `bridge_unlock_scale_fix_active`.
- Added `bridge_vault_utxo_scaled_amount(amount, height)` which divides pre-migration UTXOs by `MIGRATION_DIVISOR` and also normalizes anomalous post-migration outputs whose amount exceeds `TOTAL_SUPPLY`.
- `validate_bridge_unlock_transaction_shape_with_utxos` now takes a `block_height` parameter and, when the fix is active, sums scaled input values for the `total_input == outputs + fee` check.

### `V3/L1/core/src/lib.rs`

- `build_bridge_unlock_transaction` now scales each selected UTXO before accumulating `total_input` and computing change.
- Updated all call sites of `validate_bridge_unlock_transaction_shape_with_utxos` to pass the correct height (pending height for mempool/builder, `block.height` for peer validation, `0` for the test case).

### `V3/L1/core/src/bin/node.rs`

- Reads `ZION_BRIDGE_UNLOCK_SCALE_FIX_HEIGHT` and calls `zion_core::bridge::set_bridge_unlock_scale_fix_height`, allowing a coordinated hard-fork height on existing mainnet.

### `V3/L1/core/src/peer_block_validation.rs`

- Passes `block.height` to the bridge-unlock shape validator.

### `V3/L1/core/src/rpc.rs`

- `scaled_utxo_balance` now uses `bridge_vault_utxo_scaled_amount` for the bridge vault address.
- `getBridgeVaultBalance` now returns the scaled vault balance.
- `getUtxos` now scales each vault UTXO via `bridge_vault_utxo_scaled_amount` before returning it and before summing `total_amount`.
- Updated `live_get_bridge_vault_balance_has_genesis_seed` to expect the correct scaled genesis balance (`99999999999996` flowers).

### `AuXpow/src/auxpow_client.rs`

- Added missing `ExternalCoin::KRX` arm to `protocol()` so `cargo test -p zion-core` can compile the dependency tree.

## Test results

- `cargo test -p zion-core bridge_unlock` — 6 passed, 1 ignored.
- `cargo test -p zion-core rpc::` — 46 passed, 0 failed, 1 ignored.
- Full `cargo test -p zion-core` was running; a number of slow PoW/integration tests are ignored in debug builds and several long-running tests had exceeded 60 s when the session was interrupted for restart.

## Live state caveat

The already-accepted anomalous UTXO from block `10899` (tx `ef2777c7b6723309e95eb3382cc5b91fa48349e7ea217e6c29d57cea1fa25fe0`, change output `16666666666566666362` flowers) remains in the UTXO set. The new code prevents creation of such outputs and can normalize them when spent, but does not remove or undo the existing invalid output; that likely needs a genesis/config-level remediation or a hard-fork spend rule.

## Open questions

- What is the intended remediation for the already-accepted, over-scaled bridge-vault UTXO?
- Are downstream wallet/relayer callers of `getBridgeVaultBalance` / `getUtxos` expecting scaled or raw flower values?
- Is the default `BRIDGE_UNLOCK_SCALE_FIX_HEIGHT=0` safe for current mainnet, or does it need to be set to a future coordinated fork height because the invalid UTXO is already accepted?

## Changed files

- `V3/L1/core/src/bin/node.rs`
- `V3/L1/core/src/bridge.rs`
- `V3/L1/core/src/lib.rs`
- `V3/L1/core/src/peer_block_validation.rs`
- `V3/L1/core/src/rpc.rs`
- `AuXpow/src/auxpow_client.rs`
- `bridgebug.md` (this report)
