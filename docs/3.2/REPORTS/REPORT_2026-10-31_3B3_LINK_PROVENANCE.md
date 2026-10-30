# 3.B3 — QTU/PRL link provenance gating (address-squatting mitigation)

**Date:** 2026-10-31 · **Status:** shipped (gate) — real external-key proof remains follow-up
**Scope:** `apps/identity` (ZIS), `V31/L1/pool` (zis identity)

## Vulnerability (restated)

`POST /api/auth/link` for `chainType ∈ {quantus, pearl}` verifies an
*attestation*: a signature over `challenge + "\n" + chain + ":" + address`
produced by an account-bound **ZION** key — not by the external QTU/PRL
key (no browser ML-DSA/XMSS implementation exists; see
`verifyQuantusAttestation`/`verifyPearlAttestation` in
`apps/identity/src/lib/challenge.ts`). Partial mitigation `1efc5d37c`
requires the attesting `zionAddress` to already be linked to the account.

Residual attack (audit `docs/3.2/AUDIT_PACKAGE.md`): an attacker links a
**victim's** `qz…`/`prl1…` address to the attacker's own ZIS account.
`linkedAddresses.address` is unique → the real owner is blocked by
`409 CONFLICT`, and — worse — every consumer that treats a link as
ownership honored the squatter:

| Consumer | Impact before fix |
|---|---|
| Pool `ZisIdentity.quantus_address`/`pearl_address` → `zis_register_linked_payout` (`stratum.rs:584`) | Linked qz/prl auto-registered as the session payout address — unverified. |
| Pool `ZisIdentity.owns()` → `/public/v1/account/*` (`api.rs` ×3) | Squatted address satisfied `owns()` → attacker could read/write min-payout & alert settings for the victim's wallet. **Live today.** |

## Fix — provenance flag + conservative gating

No schema migration; the flag is derived in ZIS responses and enforced
pool-side.

**ZIS** (`apps/identity`):
- New `src/lib/provenance.ts` — `linkProven(chainType)`: `false` for
  `quantus`/`pearl` (attestation-only), `true` for self-signed chains
  (`zion-l1`, `evm`, `bitcoin`, `solana`, `google`).
- `proven` annotated on `linkedAddresses` in `/api/keys/verify`,
  `GET /me`, `PATCH /me`, `POST /link`, `POST /primary`. Additive field —
  old consumers unaffected; admin endpoints keep raw rows.

**Pool** (`V31/L1/pool/src/zis.rs`):
- `LinkedAddress.proven: Option<bool>`; `is_proven()` treats a **missing**
  flag as unproven for `quantus`/`pearl` (old-ZIS shape → conservative)
  and proven for self-signed chains — safe under mixed-version deploys
  in either order.
- `identity_from_user` gates payout fallbacks (`zion_address`,
  `quantus_address`, `pearl_address`) and the `addresses`/`owns()` set on
  `is_proven()`. Squatted links become inert for ownership purposes.

## Tests

- `apps/identity`: `test/provenance.test.ts` (+3 tests) — 49/49 pass,
  `tsc --noEmit` clean.
- `zion-pool`: `verify_blocking_binds_identity_and_owns` rewritten as the
  squatting regression (unproven qz/prl excluded from fallbacks and
  `owns()`), new `verify_blocking_proven_attestation_links_apply`
  (`proven:true` restores the link). 24/24 zis-related tests pass.

## Residual risk (honest)

- **Link-409 squatting persists** — a squatter can still occupy the
  unique `linkedAddresses` row, blocking the victim's *linking* (DoS on
  linking, no longer on ownership/funds). Remedy: a dispute/admin
  unlink flow or proof-gated linking — recommend adding `POST /link`
  challenge-response **by the external key** before any QTU/PRL row is
  treated as occupied-vs-victim; until then, operator unlink on verified
  support request.
- **No real QTU/PRL ownership proof yet.** Paths (choose one when
  external-wallet support lands):
  1. External-key signature: desktop agent signs the ZIS challenge with
     the QTU/PRL key; verification needs a Rust/native verifier endpoint
     (no JS ML-DSA/XMSS) — e.g. `POST /api/auth/link/prove` proxying to a
     pool-side or dedicated verifier.
  2. On-chain marker: small self-transfer/memo from the claimed address,
     confirmed via the QTU watchtower (QTC plan F3) before flipping
     `proven`.
- `proven` is currently chainType-derived, not per-row — when a real
  proof flow lands, add a `LinkedAddress.proven` column and flip it only
  on external proof (attestation rows stay `false`).

## Deploy notes

- ZIS deploy: additive response field — `deploy-zis.sh` standard path.
- Pool deploy: rebuild required; safe before or after ZIS deploy
  (conservative default already gates qz/prl under old ZIS).
- Effect on live users: attestation-linked qz/prl addresses stop feeding
  payout fallbacks and `owns()` — intended; PRL payout remains DRY_RUN,
  no funds move.
