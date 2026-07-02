# Code vs Docs Audit — V3 Mainnet Track

> **Date:** 2026-07-01
> **Scope:** `V3/**` only (L1 core, L2 bridge/DAO, L3/warp, Edge, DeFi, Pool/Miner/CLI, L4/L5/L6)
> **Method:** 4 parallel read-only subagents compared documented claims against actual code. Two HIGH-severity findings were manually re-verified against the source config files.
> **Verdict:** Code is generally correct and post-3.0.3 consistent. **Documentation is stale** in several places — mostly `MAINNET_CONSTANTS.md` (pre-3.0.3 values) and `V3/README.md` (undercounts). One genuine HIGH-severity operational issue: **bridge contract address 3-way inconsistency** across `bridge-mainnet.toml`, `BRIDGE_MAINNET_DEPLOY.md`, and `ROADMAP.md`.

---

## Summary table

| # | Area | Severity | One-liner |
|---|------|----------|-----------|
| 1 | L2 Bridge | **HIGH** | 3-way bridge address inconsistency; 5 non-Base chains point at revoked contract in repo config |
| 2 | L1 Constants doc | **HIGH** | `MAINNET_CONSTANTS.md` has wrong `DAO_TREASURY_LOCK_HEIGHT` (525_600 vs 144_000) |
| 3 | L1 Constants doc | **HIGH** | `MAINNET_CONSTANTS.md` has wrong `BRIDGE_VAULT_ADDRESS` (stale v2 reset addr) |
| 4 | L1 Constants doc | **HIGH** | `MAINNET_CONSTANTS.md` has placeholder `DAO_ADDRESS` not real treasury addr |
| 5 | WARP | **HIGH** | Test count claimed 465 (AGENTS/ROADMAP) / 252 (README); actual 488 |
| 6 | WARP | MEDIUM | "13 adapters" claimed; 12 registered in `adapter/mod.rs` |
| 7 | L2 DAO | MEDIUM | Repo `dao-mainnet.toml` has no guardians (Edge runtime has them — secrets) |
| 8 | L1 Constants doc | MEDIUM | `MIN_TX_FEE`, `BASE_REWARD`, `TAIL_REWARD` still in 12-decimal scale |
| 9 | Li.Fi-L2 | MEDIUM | Self-contradictory: "6 chains live" vs "Nedeployed" section |
| 10 | README | MEDIUM | Workspace layout omits L4/L5/L6 (active workspace members) |
| 11 | Miner | MEDIUM | `ZION_LOOP_COUNT` default is 1, not 1_000_000 (doc implies otherwise) |
| 12 | CLI | LOW | `import-secret-key` missing `--password-env` (inconsistent w/ sibling cmds) |
| 13 | 3.1.0 audit | LOW | `AUDIT_3.1.0_EXISTING_CODE.md` says L4 "needs audit" but it's already 1e6-correct |

**Totals:** 5 HIGH, 6 MEDIUM, 2 LOW

---

## HIGH severity

### H1 — Bridge contract address 3-way inconsistency ✅ RESOLVED 2026-07-02

On-chain `wZION.hasRole(BRIDGE_ROLE, bridge)` on all 6 chains confirmed the live configuration:

| Chain | Live bridge | `BRIDGE_ROLE` |
|-------|-------------|---------------|
| Base | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | ✅ |
| BSC | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ |
| Polygon | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ |
| Arbitrum | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ |
| Optimism | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ |
| Avalanche | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ |

`0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88` is a stale Base 5/5 deployment with no `BRIDGE_ROLE`. The repo relay config (`V3/L2/bridge/config/bridge-mainnet.toml`) was already correct; the stale `V3/config/bridge-mainnet.toml` and dashboard `app.py` have been synchronized, and docs (`BRIDGE_MAINNET_READINESS.md`, `wZION_PLAN.md`, `ZION_MAINNET_DEFI_ROADMAP.md`) updated to the live Base address.

### H2 — `DAO_TREASURY_LOCK_HEIGHT` stale in constants doc

- **Doc:** <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/docs/MAINNET_CONSTANTS.md" lines="39-39" /> claims `525_600` (~1 year)
- **Code:** <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/genesis.rs" lines="62-62" /> is `144_000` (~100 days)
- **Note:** `dao-mainnet.toml` line 39 correctly documents `144_000`. The 3.0.3 fork plan records this change. Only `MAINNET_CONSTANTS.md` is stale.

### H3 — `BRIDGE_VAULT_ADDRESS` stale in constants doc

- **Doc:** <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/docs/MAINNET_CONSTANTS.md" lines="85-85" /> has `zion106v7v0...` (the empty address from the accidental v2 genesis-reset seed)
- **Code:** <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/fee.rs" lines="135-135" /> has `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0` (correct, from `BRIDGE_VAULT_SEED = "ZION Bridge Vault V3 Mainnet"` in <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/crypto.rs" lines="176-176" />)
- **Note:** `bridge-mainnet.toml` line 24 also has the correct address. Only `MAINNET_CONSTANTS.md` is stale. The doc address is the **empty** vault — anyone following the doc would think ~100M ZION is at an address with no funds.

### H4 — `DAO_ADDRESS` placeholder in constants doc

- **Doc:** <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/docs/MAINNET_CONSTANTS.md" lines="84-84" /> has `zion1dao00000000000000000000000000000treasury` (placeholder pattern)
- **Code:** <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/fee.rs" lines="121-121" /> has `zion1t4l2f5j737989828v295n7z4r3v5j8k895m56n4` (real treasury, matches genesis.rs and `dao-mainnet.toml` line 42)

### H5 — WARP test count wrong in 3 places

- **AGENTS.md** line 30: "465 WARP tests pass"
- **V3/ROADMAP.md** line 134: "465 WARP tests pass"
- **V3/README.md** line 116: "252 warp"
- **Actual:** 488 test functions in `V3/L3/warp/src` (452 `#[test]` + 36 `#[tokio::test]`, no `#[ignore]`)
- **Note:** The recent commit `7948bcb4` says "408 tests pass" — yet another number. The codebase has grown; docs cite three different stale counts. Recommend running `cargo test --manifest-path V3/Cargo.toml -p zion-warp` and recording the authoritative number.

---

## MEDIUM severity

### M1 — WARP "13 adapters" vs 12 registered

- **AGENTS.md** line 30: "13 adapters fully functional"
- **Code:** <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L3/warp/src/adapter/mod.rs" lines="46-62" /> registers **12** adapters (EVM, Solana, Tron, Stellar, Cardano, Cosmos, Bitcoin, Sui, Aptos, NEAR, TON, Lightning). EVM subsumes 8 EVM chains.
- **V3/README.md** line 33 is even staler: "7 chain adapters".
- **Note:** TON's `execute_mint()` returns an error (needs TL-B SDK) — so "fully functional" is also slightly overstated for TON. 11 of 12 are fully functional; TON is watch-only.

### M2 — DAO guardians absent from repo config

- **AGENTS.md** line 20: "5 DAO guardians provisioned"
- **StatusV3.md** §2026-06-29: guardians generated, mnemonics at `C:\Users\yosef\Desktop\ZION_DAO_GUARDIAN_KEYS.txt`, `dao-mainnet.toml` on Edge updated
- **Repo code:** <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L2/dao/config/dao-mainnet.toml" lines="50-55" /> has only commented-out placeholders
- **Verdict:** This is **expected** — guardian keys are secrets and must not live in the repo. The provisioning happened on the Edge server's runtime config. Downgraded from HIGH to MEDIUM. Recommend adding a non-secret pointer in the repo config (e.g. `# guardians provisioned on Edge — see StatusV3.md §2026-06-29`) so the repo doesn't look unprovisioned to a new reader.

### M3 — `MAINNET_CONSTANTS.md` still on 12-decimal scale

Three constants in <ref_file file="/Users/yeshuae/Projects/2.9.6/V3/docs/MAINNET_CONSTANTS.md" /> are pre-3.0.3 (12-decimal) while code is post-3.0.3 (6-decimal):

| Constant | Doc (line) | Code (line) | ZION-equiv |
|----------|-----------|-------------|------------|
| `MIN_TX_FEE` | 79: `1_000` | <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/fee.rs" lines="17-17" />: `1` | both = 0.001 ZION ✓ |
| `BASE_REWARD` | 22: `5_400_067_000_000_000` | <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/emission.rs" lines="52-52" />: `5_400_067_000` | both = 5400.067 ZION ✓ |
| `TAIL_REWARD` | 24: `724_784_723_787_776` | <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/emission.rs" lines="56-56" />: `724_784_723` | both ≈ 724.785 ZION ✓ |

The ZION-equivalent amounts are correct; only the flower representation is stale. Code is right.

### M4 — `Li.Fi-L2.md` self-contradiction

<ref_file file="/Users/yeshuae/Projects/2.9.6/Li.Fi-L2.md" /> says both:
- Line 3 / 143-150: "Phase 2: 6 chains live — wZION deployed on Base, BSC, Polygon, Arbitrum, Optimism, Avalanche"
- Line 244-252: "wZION na dalších chainech (⚠️ Nedeployed)" with all chains marked "TBD / Nedeployed"

The repo `bridge-mainnet.toml` has all 6 chains `enabled = true` with the same wZION address, supporting the "live" claim. The "Nedeployed" section appears to be a stale earlier draft. Recommend deleting the contradictory section.

### M5 — `V3/README.md` omits L4/L5/L6

- <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/README.md" lines="127-149" /> workspace layout lists L1, L2, L3, DesktopApp, docker — no L4/L5/L6
- <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/Cargo.toml" lines="15-17" /> lists `L4/oasis`, `L5/free-world`, `L6/issobella` as workspace members
- All three dirs have real code (L4: 25 modules, L5: 9, L6: 9)

### M6 — Miner `ZION_LOOP_COUNT` default

- **AGENTS.md** line 134 tells users to set `ZION_LOOP_COUNT=1000000` and notes "pool default was historically 1"
- **Code:** <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/miner/src/main.rs" lines="2308-2308" /> — miner default is also `1`, not `1_000_000`
- The doc is technically correct (it tells users to set it), but the phrasing implies the miner default is already 1M. Worth clarifying that **both** pool and miner default to 1 and both must be raised for sustained GPU mining.

---

## LOW severity

### L1 — `wallet import-secret-key` missing `--password-env`

<ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/cli/src/commands/wallet.rs" lines="86-109" /> (`ImportSecretKey`) lacks the `password_env` field that `New` (lines 52-53) and `ImportMnemonic` (lines 82-83) have. Inconsistent with sibling wallet commands. <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/docs/CLI_REFERENCE.md" lines="173-173" /> doesn't document the option either, so this is internal inconsistency rather than a doc-vs-code mismatch.

### L2 — `AUDIT_3.1.0_EXISTING_CODE.md` says L4 "needs audit" but it's already 3.0.3-correct

<ref_snippet file="/Users/yeshuae/Projects/2.9.6/AUDIT_3.1.0_EXISTING_CODE.md" lines="16-16" /> marks L4 Oasis as "⚠️ Needs audit" for 3.0.3. In fact `V3/L4/oasis/` uses `zion_core::emission::FLOWERS_PER_ZION` (now 1e6), so it inherited the 3.0.3 fix automatically. The audit doc is stale.

---

## Verified correct (no discrepancy)

These claims were checked and match the code — listed so the audit is auditable:

- Emission split 89/5/5/1 — <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/emission.rs" lines="73-85" />
- `FLOWERS_PER_ZION = 1_000_000` — <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/emission.rs" lines="13-13" />
- `BRIDGE_VAULT_SEED = "ZION Bridge Vault V3 Mainnet"` — <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/crypto.rs" lines="176-176" />
- `MAINNET_CANONICAL_*` addresses — match between genesis.rs and MAINNET_CONSTANTS.md
- Protocol 3.0.3 — <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/lib.rs" lines="46-49" />
- `MIGRATION_HEIGHT = 18_850` — <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L2/bridge/src/types.rs" lines="32-32" /> (hardcoded) + runtime-overridable via `ZION_MIGRATION_HEIGHT` env in <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/bin/node.rs" lines="59-59" />
- `scaled_amount()` RPC helper — <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L1/core/src/rpc.rs" lines="51-57" />
- L2 watchers scan only `utxo_transactions` — confirmed in bridge/dao/atomic-swap watchers
- 6 EVM chain watchers enabled — <ref_snippet file="/Users/yeshuae/Projects/2.9.6/V3/L2/bridge/config/bridge-mainnet.toml" lines="33-120" />
- 13 Edge services — 10 in docker-compose.yml + 3 in docker-compose.v3-l2.yml
- BCS/CBOR encoders pure-Rust — `V3/L3/warp/src/bcs.rs`, `cbor.rs`, no C deps in Cargo.toml
- Lightning adapter (BOLT11 + LND REST + adapter) — all three files implemented
- Dual-algo pool, `ZION_NONCE_COUNT_GPU=262144`, `ZION_POOL_LOOP_COUNT=1000000` — pool code matches
- Miner algorithms (`deeksha_lite_v1`, `cosmic_harmony_ekam_deeksha_v2`, `deeksha_lite_fire`), `--algorithm`, `--ekam-bench` — all present
- `zion-cli` crate exists with documented subcommands
- Wallet SDK uses 1e6 scale via `FLOWERS_PER_ZION`

---

## Recommended fix order

1. ✅ **H1 (bridge addresses)** — resolved 2026-07-02. Live addresses verified on-chain; config and docs reconciled.
2. **H2–H4 + M3 (MAINNET_CONSTANTS.md)** — one pass to update the whole file to post-3.0.3 values. Pure doc edit, no code risk.
3. **H5 + M1 (WARP counts/adapters)** — run `cargo test -p zion-warp`, record authoritative test count; change "13 adapters" → "12 adapters (11 fully functional + TON watch-only)".
4. **M4 (Li.Fi-L2)** — delete the stale "Nedeployed" section.
5. **M5 (README)** — add L4/L5/L6 to workspace layout.
6. **M2 (DAO guardians)** — add a non-secret comment in repo config pointing to Edge runtime provisioning.
7. **M6, L1, L2** — cosmetic doc clarifications.

No L1 consensus code needs to change. All fixes are documentation or L2 config reconciliation.
