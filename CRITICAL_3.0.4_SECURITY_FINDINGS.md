# CRITICAL: 3.0.4 Security Findings — Account-Model Signature & Canonical Wallet Mismatch

**Date:** 2026-07-01  
**Status:** ✅ RESOLVED — F1 fix deployed to Edge (2026-07-02), exploit post-mortem in [`SecurityFirst.md`](./SecurityFirst.md)  
**Commit:** `9341344d` — F1 fix deployed (extends `verify_signature()` to `validate_peer_block()`)  
**Original fix commit:** `5cee33c4` — L1 signature fix (from-address verification in `verify_signature()`)  

> **UPDATE 2026-07-02:** F1 exploit occurred before this fix was deployed. Attacker from `109.81.30.165` injected forged account TX via P2P. Chain rolled back to height 22180. F1 fix deployed as commit `9341344d` (extends `verify_signature()` call to `validate_peer_block()` for non-coinbase account TX). Full post-mortem: [`SecurityFirst.md`](./SecurityFirst.md). Edge server hardened: UFW, bind addresses, AppArmor, monitoring. See [`SecurityBackup.md`](./SecurityBackup.md) for forensic timeline.

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

### ✅ Resolved (2026-07-02)

1. **Pool wallet strategy:** Pool wallet SK found and `edge-environment.sh` updated. Pool wallet `zion16825...` custody resolved.
2. **L1 signature fix deployed:** Commit `9341344d` — `validate_peer_block()` now calls `verify_signature()` for non-coinbase account TX. Regression test `validate_peer_block_rejects_forged_account_transaction` passes.
3. **Edge environment updated:** `edge-environment.sh` has correct pool wallet + SK hex.
4. **F1 exploit post-mortem:** Full forensic report in [`SecurityBackup.md`](./SecurityBackup.md). Edge server hardened (UFW, bind addresses, AppArmor, monitoring) — see [`SecurityFirst.md`](./SecurityFirst.md).

### ⚠️ Still pending

- **Finding 2 (canonical wallet mismatch in genesis.rs):** The hardcoded `MAINNET_CANONICAL_*_WALLET` constants still do not match `canonical_address_for_label()`. This is an L1 change requiring explicit approval per AGENTS.md. The debug assertions in `canonical-mainnet-operator-env.rs` were removed to allow production deployment, but the underlying mismatch remains.
- **Key rotation (F4.x):** Premine, pool, bridge, EVM keys need rotation on an air-gapped machine. See [`SecurityFirst.md`](./SecurityFirst.md) §F4.
- **BFG / git history scrub:** `PREMINE_WALLETS_BACKUP.json` still in git history. Required before public launch/fork.

---

## Audit trail

- `5cee33c4` — L1 signature fix (from-address verification in `verify_signature()`).
- `9341344d` — **F1 fix deployed to Edge** — extends `verify_signature()` call to `validate_peer_block()` for non-coinbase account TX.
- `a8b3821e` — L2 security patch (claimant guard, threshold 5/5, reorg safety, key hygiene).
- `ecba368f` — Activation monitor script.
- `4153270d` — E2E test script for account-model memo v1.
- `f64769ad` — Deploy status update.
- `5074bf35` — Account-model memo v1 hard-fork implementation.
- `e6f601ed` → `f5e126d4` — **Phase 2 security hardening** (UFW, bind addresses, AppArmor, monitoring, Tailscale ACL, RPC audit log). See [`SecurityFirst.md`](./SecurityFirst.md).

---

## Recommended next step

✅ **F1 fix deployed.** The immediate vulnerability (forged account TX via P2P) is closed.

**Remaining priorities:**
1. **Key rotation (F4.x)** — rotate premine, pool, bridge, EVM keys on an air-gapped machine.
2. **Tailscale ACL** — apply tag-based ACL via admin console (doc ready in [`SecurityFirst.md`](./SecurityFirst.md) §F2.3).
3. **BFG / git history scrub** — remove `PREMINE_WALLETS_BACKUP.json` from git history before public launch.
4. **Finding 2 (genesis.rs canonical wallets)** — requires L1 approval per AGENTS.md.
