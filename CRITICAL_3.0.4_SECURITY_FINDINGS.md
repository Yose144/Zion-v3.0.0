# CRITICAL: 3.0.4 Security Findings — Account-Model Signature & Canonical Wallet Mismatch

**Date:** 2026-07-01  
**Status:** ACTIVE — fixes prepared, deployment paused pending owner decision  
**Commit:** `5cee33c4` contains the L1 signature fix (deployed to repo only, not to Edge yet)

---

## Finding 1 — Account-model transactions do not verify the sender address

### Severity

**CRITICAL** — any account balance can be spent by anyone with a valid Ed25519 key.

### Location

`V3/L1/core/src/lib.rs` — `Transaction::verify_signature()` (lines 1951–1967 before fix).

### Issue

The signature verification checked only that the provided Ed25519 signature was valid for the provided public key and the transaction ID. It did **not** check that the public key derived to the `from` address in the transaction.

Because the transaction ID includes the `from` address, an attacker can:

1. Create a transaction with `from = any funded account address` (e.g., the pool wallet or bridge vault).
2. Sign it with their own unrelated key.
3. Submit it to the node.
4. The node accepts it because the signature is valid, even though the key does not belong to the `from` address.

### Evidence

Pool wallet on Edge was configured with a signing key that does **not** derive to the configured pool wallet address, yet pool payouts were being accepted:

- Configured pool wallet: `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604`
- Derived address from the configured SK hex (`edee1b29...049f`): `zion1a6z5a4m830w6s6k7r508n300n6z30022q6qt0n7`
- Pool logs showed `payout_account_model wallet=zion16825... tx_id=...` being accepted.

### Fix

Commit `5cee33c4` adds a `derive_address` check in `Transaction::verify_signature()` before `crypto::verify()`:

```rust
let derived_from = crypto::derive_address(&pk_bytes);
if derived_from != self.from {
    return false;
}
```

Coinbase transactions (`from == "coinbase"`) remain exempt.

### Impact of deploying the fix

- All legitimate account transactions will continue to work.
- The current Edge pool payouts will **stop passing validation** because the pool wallet address and signing key are mismatched.
- **Edge deployment of this fix is paused** until the pool wallet configuration is corrected.

---

## Finding 2 — Canonical wallet addresses in `genesis.rs` do not match their labels

### Severity

**CRITICAL** — all canonical subsidy/payout addresses used by the pool, block fee recipients, and operator defaults are wrong.

### Location

`V3/L1/core/src/genesis.rs` — `MAINNET_CANONICAL_*_WALLET` constants.

### Issue

The canonical wallet constants are hardcoded values that do not match the output of `crypto::canonical_address_for_label()` for the corresponding labels. The debug assertions in `canonical-mainnet-operator-env.rs` (which only run in debug builds) fail.

### Evidence

Running the canonical operator env binary in debug mode panics:

```text
assertion `left == right` failed
  left:  "zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702"
  right: "zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702"
```

The first mismatch is `MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET`. The same problem applies to all canonical subsidy wallets, including the pool payout signer.

### Correct derived addresses

The following addresses are produced by the current `crypto::canonical_address_for_label()` implementation:

| Label | Current constant (wrong) | Derived from label (correct) |
|---|---|---|
| `ZION_V3_MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_RECIPIENT_v1` | `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702` | `zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702` |
| `ZION_V3_MAINNET_CANONICAL_POOL_PAYOUT_SIGNER_v1` | `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` | `zion1l56685k280p364g686j88644g3j4r375755e8p7` |

The correct SK hex for the pool payout signer is `a3bc7452beb612e2f3a59f85d31905cc2e8e28f3450e4892c9c0ea445e913ee9` (this is the value printed by the current `canonical-mainnet-operator-env` release binary; it matches the corrected address).

### Current Edge balances

- `zion16825...` (wrong pool wallet constant, currently configured on Edge): `904,235.652039 ZION`
- `zion1l566...` (correct pool wallet derived from label): `0.000000 ZION`

### Impact

- The pool wallet currently used on Edge has funds, but we do not have the private key that legitimately controls it.
- Changing the Edge configuration to the correct pool wallet (`zion1l566...`) and the correct SK hex will fix pool payout signing, but the pool will start with a zero balance.
- The `904,235.652039 ZION` in `zion16825...` will become inaccessible unless the private key for that address is found.

---

## Immediate actions required

### Before deploying the L1 signature fix to Edge

1. **Decide on the pool wallet strategy**:
   - Option A: Find the private key for `zion16825...` and migrate funds to the correct canonical pool wallet.
   - Option B: Accept that `zion16825...` is locked and configure the pool to use the correct canonical wallet `zion1l566...` (funded from another source or from future block rewards).
   - Option C: Create a new pool wallet with known custody and fund it.

2. **Fix `V3/L1/core/src/genesis.rs`**:
   - Replace the hardcoded canonical wallet constants with the output of `canonical_address_for_label()` for each label.
   - This is an L1 change and must be reviewed, but the values are pure constants — they do not affect the genesis block hash.

3. **Fix Edge environment**:
   - Update `/root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh` with the correct pool wallet and SK hex.
   - Update any other canonical wallet references (e.g., humanitarian, Issobella, pool fee) as needed.

### After the above decisions

1. Deploy the L1 signature fix (`5cee33c4` plus any genesis.rs constant fixes) to Edge.
2. Restart `zion-edge-node1`, `zion-edge-node2`, `zion-edge-pool`.
3. Verify pool payouts are accepted again.
4. Resume the account-model memo v1 E2E tests.

---

## Audit trail

- `5cee33c4` — L1 signature fix (from-address verification).
- `ecba368f` — Activation monitor script.
- `4153270d` — E2E test script for account-model memo v1.
- `f64769ad` — Deploy status update.
- `5074bf35` — Account-model memo v1 hard-fork implementation.

---

## Recommended next step

Do **not** deploy `5cee33c4` to Edge until the pool wallet mismatch is resolved. Once resolved, the signature fix should be deployed immediately because the current mainnet is vulnerable to the described attack.
