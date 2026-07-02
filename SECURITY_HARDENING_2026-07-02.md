# ZION Security Hardening — Complete Report (2026-07-02)

> **Incident:** SEC-2026-07-02 (F1 forged peer-block transactions)
> **Scope of this document:** consolidated security status after the F1 exploit,
> live Edge verification, a full consensus-path re-audit, and the L1/L2 code
> fixes landed in this change.
> **Status:** ✅ L1 hardening code complete + tested · L2 patch in tree · Edge deploy pending (owner)
> **Cross-refs:** [`SecurityFirst.md`](./SecurityFirst.md) · [`SecurityBackup.md`](./SecurityBackup.md) · [`CRITICAL_3.0.4_SECURITY_FINDINGS.md`](./CRITICAL_3.0.4_SECURITY_FINDINGS.md) · [`PATCH_L2_SECURITY_2026-07-02.md`](./PATCH_L2_SECURITY_2026-07-02.md)

---

## 1. Executive summary

The F1 exploit (a forged account-model transaction mined via the P2P/peer-block
path without a valid signature) was patched, and the chain was rolled back to
height 22180. This report captures the **follow-up hardening**: a full re-audit
of every consensus validation path for F1-class gaps, three new L1 fixes that
close the residual risks the audit found, and confirmation that the L2 security
patch is present.

**What was verified live on Edge (`77.42.71.94`, 2026-07-02):**

| Check | Result |
|-------|--------|
| Chain height | 22212 (mining continued from rollback point 22180) |
| Genesis Creator (Slot 11) balance | **590,000,000 ZION** ✅ restored |
| Attacker address (589M) | **0 ZION** ✅ |
| P2P peers | 1 only — `100.86.16.108`/`100.86.102.5` backup node via Tailscale ✅ no public peer |
| F1 fix in live `zion-node` binary | ✅ present (2 markers, build 2026-07-02 13:38) |
| UFW | default deny incoming; P2P/RPC restricted to Tailscale/localhost |

---

## 2. Consensus re-audit (peer-block vs RPC parity)

The F1 root cause was that the **peer-block path validated transactions less
strictly than the RPC path**. The re-audit systematically compared both paths.

| ID | Class | Severity | Verdict |
|----|-------|----------|---------|
| A1 | Account-TX signature height-gate residual (reorg below gate) | HIGH | **Fixed (this change)** |
| A2 | Account nonce replay across blocks in `validate_peer_block` | MEDIUM | **Fixed (this change)** |
| A3 | P2P block-import allowlist not enforced in code | MEDIUM | **Fixed (this change)** |
| F2 | UTXO conservation-of-value in peer-block path | CRITICAL | ✅ already covered |
| F3 | Coinbase subsidy / fee-split inflation | CRITICAL | ✅ already covered |
| F4 | Bridge validator multisig bypass (threshold floor, synthetic-proof reject) | CRITICAL | ✅ already covered |
| F6/F7 | Genesis special-case, memo activation gating | LOW | ✅ safe |

**Conclusion:** No CRITICAL exploitable gap remained on the current chain tip.
A1–A3 were the residual defense-in-depth items; all three are now closed in code.

---

## 3. L1 fixes landed in this change

### A1 — Finality checkpoint at height 22180

**File:** [`V3/L1/core/src/launch.rs`](./V3/L1/core/src/launch.rs)

The account-TX signature gate on Edge is set to height 22181
(`ZION_ACCOUNT_TX_MEMO_V1_HEIGHT=22181`) because block **21959 still contains a
forged probe transaction** (invalid signature) below the rollback point. That
means blocks **below 22181 do not enforce account signature verification**, so a
deep reorg below the gate could replay unsigned/forged account transactions.

The fix pins the canonical block 22180 hash as a hardcoded, append-only
checkpoint:

```rust
Checkpoint {
    height: 22_180,
    hash: "00000d094ab56366402ce89440efb12011a8ddf8544162422214423ea1541ba8".into(),
},
```

`validate_peer_block()` already calls `launch::verify_checkpoint(height, hash)`,
so any block presented at height 22180 with a non-canonical hash is now rejected.
Because a reorg below 22181 must replace block 22180, such a reorg is now
impossible — the signature-gate residual risk is closed.

### A2 — Cross-block account nonce replay guard

**File:** [`V3/L1/core/src/lib.rs`](./V3/L1/core/src/lib.rs) — `validate_peer_block()`

Previously the peer-block path only checked account-nonce uniqueness **within a
single block** (`seen_sender_nonces`), while the RPC path (`insert_transaction`)
also rejected nonces **already mined on-chain**. This restores parity:

```rust
// Cross-block replay guard: reject an account nonce already mined in a prior
// accepted block. Mirrors the RPC "already mined" check (F1-class parity).
if self.accepted_blocks.iter().any(|prior| {
    prior.transactions.iter().any(|known| {
        known.from == transaction.from && known.nonce == transaction.nonce
    })
}) {
    return Err(format!(
        "peer block reuses already-mined sender nonce {} for {}",
        transaction.nonce, transaction.from
    ));
}
```

Blocks are accepted one at a time in `accept_peer_blocks`, so `accepted_blocks`
reflects every prior block in the same sync batch as well as the persisted chain.

### A3 — Transport-layer P2P block-import allowlist

**File:** [`V3/L1/core/src/bin/node.rs`](./V3/L1/core/src/bin/node.rs) — `handle_p2p_stream()`

`ZION_P2P_ALLOWED_PEERS` was set on Edge as part of Phase 2 hardening but **was
never actually read by the code** (a no-op). The core allowlist (`is_allowed_peer`)
matched full `host:port`, which cannot match inbound ephemeral ports.

The fix enforces a **host-based** allowlist at the transport layer for
`AnnounceBlock` messages, before consensus validation:

```rust
let block_import_allowlist: Vec<IpAddr> = std::env::var("ZION_P2P_ALLOWED_PEERS")
    .ok()
    .map(|raw| raw.split(',').filter_map(|e| e.trim().parse::<IpAddr>().ok()).collect())
    .unwrap_or_default();
// ...
if is_announce
    && !block_import_allowlist.is_empty()
    && !block_import_allowlist.contains(&source_ip)
{
    // reject + penalize, do not reach consensus validation
}
```

- **Opt-in / non-consensus:** empty/unset = open (any peer may announce blocks;
  consensus rules still apply), so this does not change behavior for nodes that
  do not configure it and cannot cause a fork.
- **Defense-in-depth:** if the firewall (UFW/Tailscale) is ever misconfigured,
  an unauthorized source still cannot inject blocks.
- On Edge, `ZION_P2P_ALLOWED_PEERS` already lists the backup node, which connects
  from a Tailscale IP, so legitimate sync is unaffected.

---

## 4. L2 security patch status

The L2 patch (commit `a8b3821e`, see [`PATCH_L2_SECURITY_2026-07-02.md`](./PATCH_L2_SECURITY_2026-07-02.md))
is **present in `main` and in the working tree**:

- atomic-swap: pre-committed `claimant_address` guard, mainnet bearer-token
  requirement, checked `u128→u64` cast, escrow key zeroed on `Drop`.
- bridge: composite dedup key `(type, tx_id)`, mainnet threshold `5-of-5`
  enforced in `validate_runtime()`, EVM reorg pause, gas-price retry.
- dao: memo length cap (256 B) before parse.

Verification (per patch doc): `cargo test -p zion-atomic-swap -p zion-bridge -p zion-dao` → **324 passed**.

**Not yet deployed to Edge** — the running L2 binaries (built 2026-07-01) predate
`a8b3821e`. A rebuild + service swap is required to pick up the L2 changes and the
bind-address fixes (bridge metrics `9101` and DAO `8450` still listen on `0.0.0.0`,
currently protected by UFW only).

---

## 5. Validation performed

| Check | Result |
|-------|--------|
| `cargo check -p zion-core` | ✅ compiles |
| `cargo test -p zion-core --lib checkpoint` | ✅ 19/19 pass (incl. new `finality_checkpoint_enforced`) |
| Full `cargo test -p zion-core --lib` | 3 failures, **all pre-existing** (see §6) |

### 6. Pre-existing test debt (not introduced by this change)

Three tests fail at `HEAD` **independently of this change**:

- `rpc::tests::live_submit_transaction_alias_accepts_object_payload`
- `rpc::tests::live_submit_account_transaction_alias_accepts_object_payload`
- `tests::e2e_transaction_relay_between_nodes`

**Root cause:** these fixtures use `from: "wallet.alpha"` with random test keypairs.
The earlier F1 fix (`5cee33c4`) makes `verify_signature()` require
`derive_address(public_key) == from`, which a label like `"wallet.alpha"` can never
satisfy. The fixtures were not regenerated with real derived addresses. This is
test debt from the F1 fix and is **orthogonal** to A1/A2/A3 (which do not touch the
RPC submit path or `verify_signature`). Recommended follow-up: regenerate these
fixtures with keypair-derived `zion1...` addresses.

---

## 7. Remaining operational hardening (owner)

These require Edge SSH, Tailscale admin, or an air-gapped machine and are tracked
in [`SecurityFirst.md`](./SecurityFirst.md):

1. **Deploy A1–A3 + L2 patch to Edge** — rebuild `zion-node`, `zion-bridge`,
   `zion-atomic-swap`, `zion-dao`; swap binaries; restart. Coordinate the
   `zion-node` restart with the backup node to avoid a transient fork.
2. **Bind fixes** — bridge `9101` + DAO `8450` → `127.0.0.1` (ships with L2 rebuild).
3. **Tailscale ACL** — apply tag-based ACL via admin console (doc ready in `SecurityFirst.md` §F2.3).
4. **Key rotation (air-gapped)** — pool payout SK, bridge validator keys (2/5 pending),
   EVM deploy keys, atomic-swap escrow key (still placeholder).
5. **Git history scrub** — remove `PREMINE_WALLETS_BACKUP.json` from history (BFG).
6. **systemd `User=zion`** — services still run as root.
7. **Finding 2** — `MAINNET_CANONICAL_*_WALLET` constants in `genesis.rs` still
   mismatch `canonical_address_for_label()` (L1 change, requires runbook).

---

## 8. Changed files (this change)

| File | Fix |
|------|-----|
| `V3/L1/core/src/launch.rs` | A1 — checkpoint at 22180 + updated tests |
| `V3/L1/core/src/lib.rs` | A2 — cross-block nonce replay guard in `validate_peer_block` |
| `V3/L1/core/src/bin/node.rs` | A3 — `ZION_P2P_ALLOWED_PEERS` block-import allowlist |
| `SECURITY_HARDENING_2026-07-02.md` | this report |

---

*Prepared 2026-07-02. L1 code hardening complete and tested; production deploy is an owner-gated step.*
