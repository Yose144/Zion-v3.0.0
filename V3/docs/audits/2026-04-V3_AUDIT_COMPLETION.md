# V3 Internal Audit — Completion & Activation Plan

**Companion to:** `2026-04-V3_INTERNAL_AUDIT.md`
**Date:** 2026-04-29
**Status of the six ranked findings** (Finding → PR → state):

| # | Finding | Severity | PR | State |
|---|---|---|---|---|
| **F1** | Validation pipeline `validate_block` not called + missing conservation-of-value | 🔴 Critical | [#20](https://github.com/Yose144/2.9.6/pull/20) | ✅ merged |
| **F2** | Block body "merkle root" is XOR aggregate, not tree | 🔴 High | — (this doc) | 🗓 deferred to hard fork |
| **F3** | `zion-wallet.json` committed with plaintext Ed25519 secret keys | 🔴 Critical | [#18](https://github.com/Yose144/2.9.6/pull/18) | ✅ merged |
| **F3b** | `docs/docs2.9/ZION_KEYS/` committed with live PAT + OpenAI key + SSH config | 🔴 Critical | *this PR* | HEAD cleaned; **rotation & history scrub still pending** |
| **F4** | Bridge unlock multisig not enforced at L1 | 🟡 Medium | [#22](https://github.com/Yose144/2.9.6/pull/22) | ✅ merged |
| **F5** | `.unwrap() / .expect()` density in hot paths | 🟡 Medium | [#23](https://github.com/Yose144/2.9.6/pull/23) + [#24](https://github.com/Yose144/2.9.6/pull/24) | ✅ merged |
| **F6** | V3 archives + plaintext backups committed in repo root | 🟡 Medium | [#18](https://github.com/Yose144/2.9.6/pull/18) + *this PR* | ✅ HEAD clean |

Plus the three **§15 small items** from the audit (`active_tip().expect`, `lib.rs::evict` dead code, `BURN_ADDRESS` regression test) — the latter two are handled in *this PR*, the first is a low-priority type-safety refactor kept as a known item.

And the **§3.2 tx-hash preimage malleability** (Medium): this PR lands the fix as the dormant `Transaction::calculate_hash_v2()` helper, gated by `TX_HASH_V2_VERSION = 2` so v1 txs (everything in the chain today) keep their current IDs untouched. Activation is a hard-fork step, covered below.

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

### What the PR does **not** do

- Does not emit `version = 2` from wallets or the RPC.
- Does not force peer validators to *reject* `version = 2` before the
  fork, nor to *accept* `version = 1` after the fork.
- Does not carry an activation height.

Those three are deliberately deferred to a coordinated consensus
change. The helper is shipped dormant so that activation is a single
code change (flip a height gate and update wallet emission), not a
reimplementation under time pressure.

### When to activate (hard-fork step)

1. **Add a height gate**, conventionally next to
   `CHV_EKAM_V2_FORK_HEIGHT` in `cosmic-harmony`:
   ```rust
   pub const TX_HASH_V2_ACTIVATION_HEIGHT: u64 = u64::MAX; // set at fork
   ```
2. **Tighten `validate_peer_block`** (L1/core/src/lib.rs): for every
   UTXO tx in a block at `height >= TX_HASH_V2_ACTIVATION_HEIGHT`,
   reject `tx.version < TX_HASH_V2_VERSION`. Keep accepting
   `version = 1` below the height so historical blocks continue to
   re-validate.
3. **Update the mempool admission path** (`insert_utxo_transaction`,
   RPC `submit_utxo_transaction_rpc`) to refuse `version = 1` once
   the chain tip crosses the activation height.
4. **Update wallet emission** (`V3/L1/core/src/bin/wallet.rs` and any
   CLI/RPC tools that build txs) to set `version = TX_HASH_V2_VERSION`
   once the activation height is known.
5. **Testnet first.** Pin a canonical test vector that nails the v2
   preimage for a known tx (`version = 2`, one input, two outputs,
   one `Some(memo)` + one `None`); freeze it in `tx.rs` like the
   Ekam v2 canonical vector.
6. **Mainnet activation** coordinated with the same release window as
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

Same pattern as §1: add a `BODY_ROOT_V2_ACTIVATION_HEIGHT`, keep XOR
for blocks below the gate, switch to BLAKE3 Merkle above. Can (and
should) be batched with §1 activation — they both need a
fork-window coordination.

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

### Current state

`V3/L2/bridge/src/relayer.rs:647` synthesizes placeholder proofs when
the configured validator set is below threshold, emitting
`"synthetic": true` in the submitted proof. **With F4 merged
(#22), L1 validation now rejects these** — which is the intended end
state, but it also means re-enabling the bridge (`bridge-mainnet.toml:
enabled = true`) while the relayer still emits synthetic proofs would
immediately produce a flood of "invalid proof" rejections and log
noise.

### Plan (separate PR, not in this audit-completion batch)

1. In the relayer loop, replace "fill missing signers with a
   synthetic proof" with "decline to submit and warn" once the
   configured threshold cannot be met from live signers.
2. Surface the validator-short condition as a Prometheus metric
   (`bridge_relayer_missing_signers`) so ops can wire an alert.
3. Add `--require-real-signers` CLI flag (default on; the only path
   that emits synthetic proofs is a very narrow dev-loop mode).
4. Re-enable `bridge-mainnet.toml: enabled = true` in a separate
   release, after the metric has been green on testnet for at least
   one week.

### Why not done here

Mid-size work (~300–500 LoC; touches relayer loop, config, telemetry,
docs), and orthogonal to the audit-completion delta.

---

## 4. §13 — native-ffi safety contracts

### Current state

`V3/L1/native-ffi/src/lib.rs` has 29 `unsafe` blocks wrapping C FFI
into legacy GPU PoW algorithms. None of them assert the minimum input
size expected by the C side. If Rust passes a short slice, the C
callee reads off the end of the buffer (classic UB).

### Fix (separate PR; low-hanging)

For every FFI wrapper, add one of:

```rust
assert!(header.len() >= MIN_HEADER_LEN, "FFI: header too short");
```

or

```rust
if header.len() < MIN_HEADER_LEN {
    return Err(FfiError::ShortBuffer);
}
```

and a `# Safety` doc comment above each `unsafe` block documenting the
C-side contract it relies on (min size, alignment, null-termination,
etc.).

### Scope

~30 locations, mechanical. Safe to do as one PR once the C header
files are re-read; no consensus risk, no hard fork. Deferred for ops
reasons (GPU mining is the primary consumer and currently `feature`-gated off on mainnet nodes anyway).

---

## 5. §11 — `lib.rs` monolith refactor

`V3/L1/core/src/lib.rs` is ~6500 lines. `validate_peer_block` alone is
300+ lines. This is an auditability problem, not a correctness
problem; deferred to a dedicated refactor PR that:

- Extracts `validate_peer_block` and each of its steps into a
  per-step function file under `V3/L1/core/src/validation/`.
- Merges with the existing `validation.rs` 11-step pipeline so there
  is **one** authoritative validation entry point (F1's follow-up).
- Extracts `insert_utxo_transaction` and `insert_transaction` into
  `mempool.rs`.
- Extracts RPC-related code into the existing `rpc.rs` (some of it
  already is).

No behavior change. Scope: medium; risk: line-ending churn in PR
review.

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
2. **F2 Merkle** + **§3.2 tx hash v2 activation** — hard fork,
   coordinated release window, both land together.
3. **Relayer synthetic-proof kill** — gate for re-enabling the bridge.
4. **native-ffi safety contracts** — gate for shipping GPU miner
   binaries to non-trusted builders.
5. **3rd-party security audit** (ROADMAP Q3 2026, Trail of Bits /
   Halborn / OtterSec). This document is *not* a substitute for that.
6. **Repo history scrub** (BFG / git-filter-repo) — must run after
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
