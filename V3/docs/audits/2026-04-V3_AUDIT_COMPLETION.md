# V3 Internal Audit — Completion & Activation Plan

**Companion to:** `2026-04-V3_INTERNAL_AUDIT.md`
**Date:** 2026-04-29
**Last verification update:** 2026-05-02
**Status of the six ranked findings** (Finding → PR → state):

| # | Finding | Severity | PR | State |
|---|---|---|---|---|
| **F1** | Validation pipeline `validate_block` not called + missing conservation-of-value | 🔴 Critical | [#20](https://github.com/Yose144/2.9.6/pull/20) | ✅ merged |
| **F2** | Block body "merkle root" is XOR aggregate, not tree | 🔴 High | Cursor WIP E.1–E.5 | ✅ code landed dormant; activation height + rehearsal pending |
| **F3** | `zion-wallet.json` committed with plaintext Ed25519 secret keys | 🔴 Critical | [#18](https://github.com/Yose144/2.9.6/pull/18) | ✅ merged |
| **F3b** | `docs/docs2.9/ZION_KEYS/` committed with live PAT + OpenAI key + SSH config | 🔴 Critical | *this PR* | HEAD cleaned; **rotation & history scrub still pending** |
| **F4** | Bridge unlock multisig not enforced at L1 | 🟡 Medium | [#22](https://github.com/Yose144/2.9.6/pull/22) | ✅ merged |
| **F5** | `.unwrap() / .expect()` density in hot paths | 🟡 Medium | [#23](https://github.com/Yose144/2.9.6/pull/23) + [#24](https://github.com/Yose144/2.9.6/pull/24) | ✅ merged |
| **F6** | V3 archives + plaintext backups committed in repo root | 🟡 Medium | [#18](https://github.com/Yose144/2.9.6/pull/18) + *this PR* | ✅ HEAD clean |

Plus the three **§15 small items** from the audit (`active_tip().expect`, `lib.rs::evict` dead code, `BURN_ADDRESS` regression test) — the latter two are handled in *this PR*, the first is a low-priority type-safety refactor kept as a known item.

And the **§3.2 tx-hash preimage malleability** (Medium): the repository now
carries the dormant `Transaction::calculate_hash_v2()` helper, activation
constants, peer-block / mempool rejection gates, and wallet/pool emission
switches. v1 txs (everything in the chain today) keep their current IDs
untouched until the coordinated hard-fork height is flipped.

---

## 1. Activation plan for `calculate_hash_v2` (audit §3.2)

### What the PR adds

- `Transaction::calculate_hash()` now dispatches on `self.version`:
  - `version < 2` → `calculate_hash_v1()` (the original raw-concat preimage)
  - `version >= TX_HASH_V2_VERSION (= 2)` → `calculate_hash_v2()`
- `calculate_hash_v2` is length-prefixed and domain-separated under the
  tag `"ZION_TX_V2\0"`. Every variable-length field (`public_key`,
  `address`, `memo`) carries a `u32` length prefix; every vector
  (`inputs`, `outputs`) carries a `u32` count; `Option<memo>` is
  encoded with a 1-byte `0`/`1` tag so `None` and `Some("")` are
  distinct.
- New regression tests:
  - `tx_hash_v1_is_malleable_across_address_and_memo_boundary` — pins
    the known v1 collision so anyone tempted to "fix" v1 in place is
    forced to see it would retroactively invalidate historical UTXO
    IDs.
  - `tx_hash_v2_rejects_address_memo_boundary_collision` — paired
    fix proof.
  - `tx_hash_v2_distinguishes_none_memo_from_empty_string_memo`.
  - `tx_hash_v1_and_v2_are_domain_separated` — cross-fork collision
    resistance.
  - `tx_hash_v1_activation_is_backward_compatible` — landing v2 must
    not change v1 hashes.

### 2026-05-02 implementation update

Cursor WIP has completed the previously deferred code hooks:

- `TX_HASH_V2_ACTIVATION_HEIGHT` lives in
  `V3/L1/cosmic-harmony/src/deeksha.rs` and defaults to `u64::MAX`.
- `peer_block_validation::validate_accepted_peer_block` rejects UTXO
  `tx.version < TX_HASH_V2_VERSION` at/above the activation height.
- `insert_utxo_transaction` rejects legacy UTXO txs for pending block
  height `tip + 1` once the gate is active; RPC submit paths reuse this.
- `wallet::pending_utxo_tx_version`, wallet CLI, bridge-lock builder,
  bridge unlock builder, coinbase template builder, and pool payouts all
  emit `version = 2` once the pending block height is active.

What is still deliberately **not** done: choosing the real mainnet
activation height. Both activation constants remain `u64::MAX` until
testnet rehearsal and operator coordination are complete.

### When to activate (hard-fork step)

1. **Choose the height gate** next to `CHV_EKAM_V2_FORK_HEIGHT` in
   `cosmic-harmony`:
   ```rust
   pub const TX_HASH_V2_ACTIVATION_HEIGHT: u64 = u64::MAX; // set at fork
   ```
2. **Keep the code hooks dormant until that height:** peer-block,
   mempool/RPC, wallet, pool, coinbase, and bridge-unlock builders are
   already wired to the `tx_hash_v2_active(height)` predicate.
3. **Testnet first.** Pin a canonical test vector that nails the v2
   preimage for a known tx (`version = 2`, one input, two outputs,
   one `Some(memo)` + one `None`); freeze it in `tx.rs` like the
   Ekam v2 canonical vector.
4. **Mainnet activation** coordinated with the same release window as
   F2 (Merkle rebuild) and any other consensus changes — they both
   break consensus, so batching them minimizes user-facing fork
   churn.

### Risk if never activated

- The v1 malleability is a **Medium** finding, not Critical. It is
  hard to exploit in practice because:
  - `is_valid_address` pins the address length to 44 and the base32
    alphabet, so `"zion1foo" + "bar"` cannot become a valid address
    alone.
  - `public_key` is a fixed 32 bytes, so the input side is not
    malleable.
  - The only remaining knob is the `address` / `memo` adjacency in
    outputs, and the collision has to produce another valid
    `zion1…` address.
- But it still lets an attacker with sufficient grinding budget
  produce two distinct-looking txs that spend the same UTXO with
  the same hash — an unnecessary foot-gun to ship to mainnet.

---

## 2. F2 — Block body commitment: XOR → BLAKE3 Merkle (hard fork)

### Current state (audit §5)

`derive_template_merkle_root` in `V3/L1/core/src/lib.rs` XORs per-tx
hashes into an 80-byte seed. Problems:

- **Birthday-resistant only at 2^64** (XOR aggregate, not a tree).
- **Per-tx hash is computed with Cosmic Harmony Ekam Deeksha** (256 KiB
  scratchpad, designed for PoW), misused as a data-structure hash. This
  is O(expensive) per tx — a pathological block can DoS full-node
  validation just by being large.
- **Does not commit to `outputs.amount`/`address` directly**, only
  `tx.id` — which, combined with §3.2, means the body root can be
  malleated by reshuffling adjacent string fields.

### Fix

Replace with `crypto::merkle_root(...)` (already implemented in
`V3/L1/core/src/crypto.rs`), with BLAKE3 as the per-leaf hash and the
standard pair-duplicate-on-odd-count Merkle rule.

```rust
fn derive_template_merkle_root(txs: &[Transaction]) -> [u8; 32] {
    let leaves: Vec<[u8; 32]> = txs.iter().map(|t| t.calculate_hash()).collect();
    crypto::merkle_root(&leaves)
}
```

Per-tx hash here is `Transaction::calculate_hash()` (fast BLAKE3), not
Ekam. Per-leaf cost drops from O(scratchpad-fill) to O(field-count).

### Activation

`BODY_ROOT_V2_ACTIVATION_HEIGHT` now exists beside
`TX_HASH_V2_ACTIVATION_HEIGHT` and defaults to `u64::MAX`. The template
root dispatcher keeps legacy XOR below the gate and switches to BLAKE3
Merkle above it. Activation should still be batched with §1 — they both
need a fork-window coordination.

### Open design question

Whether to include **the entire serialized `Transaction`** (not just
`tx.id`) in the leaf hash. Including the serialized tx makes the body
root commit to every field the peer actually sent — which is the
Bitcoin-style invariant. Using `tx.id` alone inherits §3.2's
weaknesses until v2 txs are mandatory (once the gate in §1 is up,
they become equivalent).

Recommendation: land §1 and §2 activation heights *together*; use
`calculate_hash()` (which already dispatches to v2) as the leaf hash.
Then the body root is automatically malleability-safe for post-fork
blocks.

---

## 3. Relayer follow-up — `synthetic: true` proof emission

### 2026-05-02 state

Resolved by PR #27. Relayer proof building is fail-closed: below-threshold
or duplicate signer sets return `Err` before any L1 RPC submit, synthetic
proof placeholders are not emitted, and errors surface through logs/metrics.
Remaining work is operational: provision a real 3/5 validator set before
enabling the production bridge path.

---

## 4. §13 — native-ffi safety contracts

### 2026-05-02 state

Resolved by PR #28. `native-ffi` now has typed safety guards and `try_*`
wrappers for input size, boolean return-code parsing, version string
handling, and C-side safety contracts. Remaining note: legacy C GPU smoke
tests with `native-all` still require serial execution because upstream
global caches are not thread-safe.

---

## 5. §11 — `lib.rs` monolith refactor

`validate_peer_block` was extracted into
`V3/L1/core/src/peer_block_validation.rs` as
`validate_accepted_peer_block`. `ChainState::validate_peer_block` now keeps
only the genesis special case and passes immutable snapshots
(`accepted_blocks`, `utxo_set`, bridge replay keys) into the validator.

Still optional future cleanup: split the extracted module into smaller
per-step functions and move mempool/RPC code out of `lib.rs`. That is
auditability polish, not a correctness blocker.

---

## 6. §15 remaining items

| # | Item | Status |
|---|---|---|
| §15.1 | `active_tip().expect("active tip must exist")` is a legit invariant (no public API removes entries, `new()` seeds with genesis). Could be prettier as `NonEmpty<ChainEntry>` newtype. | Known; low priority; not a bug. |
| §15.2 | `lib.rs::evict()` dead code + `RuntimeTransaction::into_utxo` dead code + `checkpoint.rs::hex_encode` was compiled in prod but only used in tests. | ✅ *this PR*: all three cleaned up. |
| §15.3 | `BURN_ADDRESS` checksum isn't valid under `derive_address`, so sending via `is_valid_address`-gated paths is already impossible. No code path currently validates `BURN_ADDRESS` through `is_valid_address` — risk is "someone accidentally adds such a path in the future". | ✅ *this PR*: added `burn_address_is_rejected_by_is_valid_address` regression test to prevent that drift. |
| §15.4 | Genesis timestamp hardcoded `1_767_225_600`. Design decision, not a bug. | Known. |
| §15.5 | `MAX_REORG_DEPTH = 10` is conservative. Design decision. | Known. |
| §15.6 | Coinbase ID deterministically derived — good, pinned. | Known. |
| §15.7 | L3/warp signer code has `private_key` mentions. Shallow grep showed no unencrypted-key-on-disk path. Deeper per-adapter review deferred with the rest of the L3/warp audit-coverage gap. | Deferred. |

---

## 7. What still blocks mainnet launch

Ordered by criticality:

1. **ZION_KEYS rotation.** Not a code change. User must:
   - Revoke `ghp_7gxI3Y…` PAT at https://github.com/settings/tokens.
   - Rotate `sk-proj-CsUPFBafi12A3…` at https://platform.openai.com/api-keys.
   - Rotate the SSH deployment key on `91.98.122.165`.
   - See `SECURITY_NOTICE_2026-04-28.md` addendum for the full checklist.
   Merging this PR cleans HEAD but does **not** invalidate the leaked
   values — they are live until manually rotated.
2. **F2 Merkle** + **§3.2 tx hash v2 activation** — code hooks are
   present and dormant; choosing/flipping the real height is still a
   coordinated hard-fork release step.
3. **Bridge validator provisioning** — relayer is fail-closed, but the
   production bridge still needs the real 3/5 validator key set and config.
4. **3rd-party security audit** (ROADMAP Q3 2026, Trail of Bits /
   Halborn / OtterSec). This document is *not* a substitute for that.
5. **Repo history scrub** (BFG / git-filter-repo) — must run after
   (1) and before the repo is ever made public. ROADMAP Q3 2026 has
   this as a todo; bringing it forward is advisable.

---

## 8. What's out of scope of this audit (unchanged)

- Dynamic analysis / fuzzing of `validate_peer_block` and
  `insert_utxo_transaction`.
- Cryptanalysis of Cosmic Harmony Ekam Deeksha v2.
- Per-adapter L3/warp signer review (Stellar, BTC, Tron).
- DAO governance Solidity contracts deployed on Base.
- Live network behavior (DDoS, eclipse, sync-withholding).
- APP&WEB Electron / RN / website.
- Benchmark / performance characterization.

These remain on the list for the external audit engagement.
