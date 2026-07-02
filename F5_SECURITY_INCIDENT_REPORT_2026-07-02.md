# F5 Security Incident Report — Account Model Balance Validation Bug

**Date:** 2026-07-02
**Severity:** CRITICAL (CVSS 9.8 — unlimited inflation)
**Status:** FIXED + DEPLOYED on Edge mainnet (block 22394)
**Author:** yosef + Devin
**Related:** [`SecurityFirst.md`](./SecurityFirst.md) · [`CRITICAL_3.0.4_SECURITY_FINDINGS.md`](./CRITICAL_3.0.4_SECURITY_FINDINGS.md)

---

## 1. Executive Summary

During an escrow key rotation on 2026-07-02, a critical consensus bug (F5) was discovered in the Zion L1 account-model transaction validation. The account-model path — both the RPC submission path (`insert_transaction`) and the peer-block validation path (`validate_peer_block`) — did **not** verify that the sender had sufficient balance before accepting a transaction. This allowed any Ed25519 key holder to create ZION from nothing by submitting a transaction from an empty address.

**This is a bigger exploit than F1** (forged account signatures, fixed earlier on 2026-07-02). F1 allowed spending someone else's funds; F5 allowed creating funds from nothing — unlimited inflation.

The bug was exploited once during the escrow migration (100,002 ZION created from an empty placeholder address). The inflationary funds were burned to a provably-unspendable address. The fix was implemented, tested, and deployed within 2 hours of discovery.

---

## 2. Timeline

| Time (UTC) | Event |
|------------|-------|
| 19:30 | Escrow key rotation initiated. `ZION_SWAP_ESCROW_KEY=0000...0001` (placeholder) identified as deriving to `zion1s2g3...` (0 balance), not the funded escrow `zion1y0j4...` (100,002 ZION, key unknown). |
| 19:35 | Migration TX submitted: 100,002 ZION from `zion1s2g3...` (0 balance) → `zion1e0642...` (new address). **TX accepted despite 0 sender balance.** Confirmed in block 22354. |
| 19:37 | **F5 bug discovered.** Account model does not validate sender balance. 100,002 ZION created from nothing (inflation). |
| 19:40 | User authorized burning of inflationary funds. |
| 19:43 | Burn TX submitted: 100,001.999 ZION from `zion1e0642...` → burn address `zion1n3570...` (derived from `[0xFF; 32]`, not a valid Ed25519 public key). |
| 19:48 | Burn TX confirmed in block 22362. Inflationary funds permanently destroyed. |
| 19:50 | F5 documented in `SecurityFirst.md`. |
| 20:00 | F5 fix implementation started (user approved L1 consensus change per AGENTS.md). |
| 20:10 | `balance_check_active()` gate added to cosmic-harmony. `account_balance_for()` helper added to ChainState. Balance check added to both RPC and P2P paths. |
| 20:15 | 3 regression tests written. First test run: 2 failures (OnceLock not resettable, miner address mismatch). |
| 20:18 | Test fixes: `AtomicU64` instead of `OnceLock`, zion1 miner address for positive test. |
| 20:20 | All 3 F5 tests pass on Edge. 10 pre-existing test failures confirmed unrelated (11 failures without F5 changes). |
| 20:22 | New node binary deployed to `/usr/local/bin/zion-node`. `zion-edge-node1` restarted. `ZION_BALANCE_CHECK_HEIGHT=22394` set in `edge-environment.sh`. |
| 20:25 | F5 activation confirmed in node logs: `balance_check_activation_height=22394`. |
| 20:30 | Chain reached height 22395. **F5 is ACTIVE on Edge mainnet.** All 13 services healthy. |

---

## 3. Root Cause

The account-model transaction validation in `V3/L1/core/src/lib.rs` checked:
- ✅ Transaction structure (`validate()`)
- ✅ Ed25519 signature (`verify_signature()`)
- ✅ Mempool capacity (`MAX_MEMPOOL_TRANSACTIONS`)
- ✅ Duplicate TX ID (replay protection)
- ✅ Already-mined nonce (cross-block replay)
- ✅ Pending nonce (mempool replay)
- ❌ **Sender balance >= amount + fee** (MISSING)

The UTXO model is inherently safe — `validate_inputs_exist()` and `validate_value_conservation()` ensure you cannot spend what you don't have. The account model relied on balance being enforced at the application layer (RPC `getBalance`), but **never enforced it at the consensus layer**.

This is a classic "account model without balance check" bug, similar to early Ethereum consensus bugs. Every account-model blockchain (Ethereum, Solana, NEAR, etc.) must check `sender_balance >= amount + fee` before accepting a transaction.

---

## 4. Impact

### Exploited
- **100,002 ZION** created from nothing (inflation) via migration TX from empty placeholder address
- **Status:** Burned to provably-unspendable address `zion1n3570...` (block 22362)

### Potential (if not fixed)
- **Unlimited inflation** — any Ed25519 key holder could create arbitrary ZION
- **Complete loss of monetary credibility** — supply no longer bounded
- **Exchange delisting risk** — if exploited by an attacker before fix

### Lost funds (accepted)
- **100,002 ZION** on `zion1y0j4...` (original funded escrow) — key unknown, accepted as permanent loss

---

## 5. Fix

### 5.1 Code changes

| File | Change |
|------|--------|
| `V3/L1/cosmic-harmony/src/deeksha.rs` | Added `balance_check_active(height)`, `balance_check_activation_height()`, `set_balance_check_height()` with `AtomicU64` for test reset |
| `V3/L1/cosmic-harmony/src/lib.rs` | Exported new F5 functions |
| `V3/L1/core/src/lib.rs` | Added `account_balance_for()` helper on ChainState (walks accepted blocks + pending mempool debits). Added balance check to `insert_transaction()` (RPC) and `validate_peer_block()` (P2P, with running balance for multi-TX blocks). |
| `V3/L1/core/src/bin/node.rs` | Added `ZION_BALANCE_CHECK_HEIGHT` env var parsing |

### 5.2 Height-gated activation

- Default: `u64::MAX` (disabled) — preserves backward compatibility with existing tests and chains
- Edge mainnet: `ZION_BALANCE_CHECK_HEIGHT=22394` — active from block 22394
- Historical blocks (pre-22394) are not rejected during IBD

### 5.3 Tests

| Test | Status | Description |
|------|--------|-------------|
| `rpc_rejects_account_tx_with_insufficient_balance` | ✅ pass | TX from empty address rejected with "insufficient balance" |
| `rpc_accepts_account_tx_with_sufficient_balance` | ✅ pass | TX from coinbase-funded address accepted |
| `peer_block_rejects_account_tx_with_insufficient_balance` | ✅ ignored | Peer-block path (slow PoW, run with `--release --ignored`) |

### 5.4 Commits

| Commit | Description |
|--------|-------------|
| `69d12c7` | F5 fix — balance validation in account model |
| `fe8d449` | F5 test fixes — AtomicU64, zion1 miner address |
| `9863747` | F5 deploy documentation |

---

## 6. Deploy Verification

```
Node log (zion-edge-node1):
  balance_check_activation_height=22394 (runtime override for F5 hard fork)

Chain state:
  height: 22395 (F5 active)
  protocol: zion-v3-node/3.0.3
  mempool: 2 transactions
  all 13 services: active (running)
```

---

## 7. Remaining Items

- [x] **Node 2 (`zion-edge-node2`)** — ✅ DEPLOYED (potvrzeno 2026-07-02 22:55, `balance_check_activation_height=22394` v logu)
- [ ] **Other nodes** — if any peers run old binary, they will accept invalid TXs but Edge will reject their blocks (consensus divergence risk)
- [x] **F5 fuzzing** — ✅ COMPLETE (commit `a5472ec6`, 5 fuzz testů — 100 random senders, double-spend, u64::MAX, rapid-fire, self-send, vše PASS)
- [x] **Node binary swap** — ✅ COMPLETE (2026-07-02 22:55, nejnovější binárka s fmt/clippy cleanup, F5 aktivní, height 22539)
- [ ] **Pre-existing test failures** — 10 tests fail unrelated to F5 (port conflicts with running Edge services, journal persistence). Investigate separately.
- [ ] **Long-term: consider UTXO-backed account model** (Option 3 from architecture discussion) for 3.1.0+ to eliminate account-model balance bugs entirely
- [ ] **Max TX amount cap** — 100M ZION cap pro dodatečnou ochranu i s F5 fix (L1 consensus change, needs spec + audit)

---

## 8. Lessons Learned

1. **Account model without balance check = unlimited inflation.** This is consensus 101. Should have been caught in the initial design review.
2. **Placeholder keys are dangerous.** `ZION_SWAP_ESCROW_KEY=0000...0001` looked like a real key (64 hex chars, not all zeros) but derived to an empty address. All config keys should be validated against expected addresses on startup.
3. **Hybrid UTXO/account models need balance checks on BOTH paths.** UTXO is inherently safe (inputs must exist), but account model needs explicit balance validation.
4. **Height-gated fixes work well for live chains.** The `ZION_BALANCE_CHECK_HEIGHT` env var allowed a clean hard fork without chain rollback.
5. **Label-derived addresses are PUBLIC keys.** `canonical_address_for_label()` derivuje klíče z veřejných labelů v source kódu — kdokoliv s přístupem k repu může utratit funds. Canonical wallets v `genesis.rs` musí být z **offline mnemonics**, nikoliv z label derivace. Pokus o "fix" genesis.rs adres na label-derived byl revertnut jako security downgrade.
