# V31 Mainnet Premine Lock Bypass — 2026-08-22

## Summary

While executing the planned task "test send from premine wallet to a target address (with confirmation)", a 1 ZION test transaction from **premine_01** (`zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5`) to the local personal miner wallet (`zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3`) was broadcast and **confirmed in V31 native block 12837** (`8ed3dcfb09f5288fa6c153008fe212a2f8da9998a4d1dcd3d460de37b9f6b3e4`).

This confirms that the V31 consensus path is **not enforcing the premine/admin locks** defined in `v3_compat.rs` (`PREMINE_OUTPUTS` with `admin_locked: true` and DAO Treasury `unlock_height: 144_000`). The `v3_validation::validate_block`/`validate_premine_locks` logic exists but is not wired into `Node::submit_block` or `UtxoSet` for the V31 native chain.

## Transaction details

- TxID: `e7b21e3ffaa067edfce330959ed7a20fa80d1f1346a375804c8a1ea972224d4c`
- Block: **12837** on V31 mainnet
- Input: premine_01 UTXO `a4cc10217dd37169b35ecc55f73ffd0a8a519c9658d1168d47f2dc71aab02cf8:0` (1,650,000,000 ZION)
- Output 0: 1 ZION to `zion1f0t4x372x2x2k3c02704j4t3g7g300j4e0j27m3`
- Output 1: change 1,649,999,998.999 ZION back to `zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5`
- Fee: 1,000 flowers

The original genesis premine UTXO for slot 1 is now spent; the remaining balance lives in the change output of tx `e7b21e3f...:1`.

## Root cause

- `V31/L1/core/src/v3_validation.rs` contains the intended premine/timelock enforcement (`validate_premine_locks`, `validate_block`), but it is currently only exercised by unit tests.
- `Node::submit_block` (`V31/L1/core/src/node.rs:620`) validates the header, merkle root, coinbase subsidy, and then calls `UtxoSet::apply_block`. It never invokes `validate_block` or `validate_premine_locks`.
- `UtxoSet::apply_transaction`/`apply_block` validate signatures and value conservation, but do not check whether an input is a locked premine output.

As a result, any party with the premine private keys can spend them on the live V31 chain today, bypassing the documented 3-of-3 admin multisig and DAO governance requirements.

## Impact

- All 14 premine outputs (16.78 B ZION) are currently spendable without admin/timelock enforcement.
- The test transaction moved 1 ZION from premine_01 to the local personal miner wallet. No funds were lost to an external party, but the spend proves the lock is ineffective.
- Until fixed, a compromised premine key or malicious insider could move any premine balance immediately.

## Recommended actions

1. **Immediate operational hardening**
   - Keep premine keys offline and restrict access.
   - Consider rotating funds that must remain locked into new, non-premine multisig addresses as soon as a safe governance path exists.

2. **Consensus fix (soft-fork)**
   - Wire `validate_premine_locks` into `Node::submit_block` and `Node::submit_utxo_transaction`.
   - Guard the new rule behind an activation height (e.g. a future mainnet height or a `--premine-lock-activation` CLI flag) to avoid splitting the chain on the already-accepted block 12837.
   - Update all Edge/mainnet nodes and miners to the patched binary before the activation height.

3. **Governance/DAO integration**
   - Populate `ValidationContext::admin_unlocked_addresses` from executed admin/DAO proposals so that legitimate premine unlocks can still occur after the fix.

4. **Verification**
   - Add a mainnet test that attempts a second premine spend after the activation height and confirms it is rejected.
   - Confirm that the wallet/Explorer shows the premine_01 UTXO as spent and the change output as the new balance.

## Files touched during this session

- `V31/L1/pool/src/payout.rs` — V31-native UTXO payout + logging
- `V31/L1/pool/src/deferred_payout.rs` — V31-native deferred/fee payout
- `V31/L1/core/src/bin/wallet.rs` — V31-native wallet CLI with HTTPS RPC support and confirmation prompt
- `V31/STATUS.md` — payout status update
- This report

## References

- `V31/L1/core/src/v3_compat.rs` — `PREMINE_OUTPUTS` definitions
- `V31/L1/core/src/v3_validation.rs` — existing but unused `validate_premine_locks`
- `V31/L1/core/src/node.rs` — `submit_block`, `submit_utxo_transaction`
- `V31/L1/core/src/utxo.rs` — `UtxoSet::apply_block`
