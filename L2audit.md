# ZION L2 Bridge — Production Readiness Audit

> **Date:** 2026-06-22  
> **Auditor:** Devin (automated source review)  
> **Scope:** `V3/L2/bridge/`, `V3/config/bridge-*.toml`, `APP&WEB/website-v2.9/src/lib/bridge-api.ts`, related docs  
> **Target:** Determine what is production-ready and what must be fixed before mainnet launch.

---

## 1. Executive Summary

The L2 bridge **codebase is structurally sound** and contains most of the security primitives expected for a production cross-chain bridge (multisig contracts, timelocks, rate limits, replay protection, fail-closed validator proofs). However, the **current configuration and deployment state is not consistent** and several code-level bugs would cause operational failures on mainnet.

**Verdict:** Not mainnet-ready without the fixes listed in §4. Safe to continue testnet operations once the testnet configs are reconciled.

---

## 2. What Is Good (Production-Capable Design)

| Area | Finding | Evidence |
|------|---------|----------|
| **Contract multisig** | `ZIONBridge.sol` supports N-of-M validators and on-chain confirmation counting. | `V3/L2/bridge/contracts/src/ZIONBridge.sol` |
| **Guardian multisig** | `BridgeValidator.sol` is a 3-of-5 guardian contract with add/remove controls. | `V3/L2/bridge/contracts/src/BridgeValidator.sol` |
| **Replay protection** | wZION tracks `processedL1Locks` and `processedBurnRequests`; SQLite uses `INSERT OR IGNORE`. | `wZION.sol:66-69`, `db.rs:93-118` |
| **Timelock / limits** | 24h timelock for >1M wZION, 10M daily limit, 5M single max. | `ZIONBridge.sol:80-86` |
| **Fail-closed proofs** | `build_validator_proofs_checked` refuses to emit synthetic proofs; aborts below threshold. | `relayer.rs:801-848` |
| **EIP-1559 signing** | `evm_tx.rs` builds and signs raw type-0x02 transactions. | `evm_tx.rs:304-385` |
| **Address validation** | EVM and L1 addresses are validated before mint/unlock. | `relayer.rs:867-908` |
| **Metrics** | Prometheus-style metrics endpoint for relay health. | `metrics.rs` |

---

## 3. Critical Issues (P0 — Mainnet Blockers)

### 3.1 Inconsistent and Conflicting Bridge Configurations ✅ PARTIALLY FIXED

There are **four different bridge configs** in the repo, each with different contract addresses, thresholds, and validator sets. This is a source-of-truth failure and a deployment risk.

**Fix applied:**
- `V3/config/bridge-testnet.toml` and `V3/L2/bridge/config/bridge-testnet.toml` are now synchronized to 2/2 with real validator addresses.
- `V3/config/bridge-mainnet.toml` and `V3/L2/bridge/config/bridge-mainnet.toml` are now synchronized to 5/5 placeholders with `enabled = false`.
- Duplicate `V3/L2/bridge/contracts/BridgeValidator.sol` removed; canonical source is now `src/BridgeValidator.sol`.

**Remaining:** Mainnet placeholders must be replaced with real addresses after deployment.

| File | Network | Threshold | Contract Address | wZION Address | Notes |
|------|---------|-----------|-------------------|---------------|-------|
| `V3/config/bridge-testnet.toml` | testnet | 2/2 | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Fixed — real validators, loads successfully |
| `V3/L2/bridge/config/bridge-testnet.toml` | testnet | 2/2 | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Fixed — mirrored canonical config |
| `scripts/bridge-testnet-fixed.toml` | testnet | 1/2 | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | Legacy helper config; still uses old Praha RPC |
| `V3/config/bridge-mainnet.toml` | mainnet | 5/5 | `0x0000...0000` | `0x0000...0000` | ✅ Template — placeholders, `enabled=false` |
| `V3/L2/bridge/config/bridge-mainnet.toml` | mainnet | 5/5 | `0x0000...0000` | `0x0000...0000` | ✅ Template — placeholders, `enabled=false` |
| `APP&WEB/website-v2.9/src/lib/bridge-api.ts` | testnet | — | `0xF4BF85443...Cedca1` | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Fixed — now points to Sepolia contracts |

**Impact:** Running any of these configs as-is will either fail to start, connect to the wrong contracts, or operate with unsafe single-sig / placeholder validators.

**Fix:**
1. Pick one canonical testnet config and one canonical mainnet config.
2. Delete or archive the duplicates.
3. Update `bridge-api.ts` to point to the live testnet or mainnet contract set explicitly.

### 3.2 Runtime Config Validation Rejects Testnet 1/2 Setup ✅ FIXED

Testnet configs were raised to 2/2, matching the two known validators, so the `threshold >= 2` validation now passes.

### 3.3 EVM Watcher Block-Range Bug ✅ FIXED

`evm_watcher.rs` now scans in chunks of `MAX_BLOCK_RANGE` (3,000 blocks) instead of 30,000, respecting RPC limits.

### 3.4 Burn Handler Uses Hardcoded Testnet RPC ✅ FIXED

`relayer.rs` now uses `chain_config.effective_rpc_url(&self.config.ankr)` for burn confirmation, removing the hardcoded Sepolia fallback.

### 3.5 `confirmBurnRelease` Missing `nonReentrant` Guard ✅ FIXED

`ZIONBridge.sol:confirmBurnRelease` now uses `nonReentrant`.

### 3.6 `BridgeValidator.resetSignatures` Does Not Clear `hasSigned` ✅ FIXED

`BridgeValidator.sol` now tracks an enumerable guardian list and `resetSignatures` clears `hasSigned[opHash][guardian]` for all guardians.

### 3.7 Mainnet Config Claims Deployment That Is Not Verified ✅ FIXED

Both mainnet configs now use zero placeholders and `enabled = false`, and `BRIDGE_MAINNET_DEPLOY.md` is marked as pre-deployment.

### 3.8 Website Points to Zero-Address Mainnet Contracts ✅ FIXED

`bridge-api.ts` now points to `BRIDGE_CONTRACTS_SEPOLIA` for the testnet phase.

### 3.9 `V3/config/bridge-testnet.toml` Is Missing `validator_addresses` ✅ FIXED

`validator_addresses` added and threshold raised to 2/2. The daemon loads successfully.

---

## 4. High Issues (P1 — Should Fix Before Launch)

### 4.1 `BridgeValidator` Is Not Integrated With `ZIONBridge`

The `BridgeValidator.sol` contract is a standalone guardian signer registry. `ZIONBridge.sol` does not call it or require guardian signatures for mint/unlock. The bridge uses its own `VALIDATOR_ROLE` and `threshold`.

**Impact:** The 3/5 guardian multisig exists on-chain but is not enforced by the bridge flow. The current bridge security is only as strong as the validator set configured in `ZIONBridge.sol`.

**Fix:** Either:
- A) Make `ZIONBridge` delegate validator management to `BridgeValidator` (e.g., `addValidator`/`removeValidator` callable only by guardian multisig), or
- B) Clearly document that `BridgeValidator` is the emergency guardian/governance multisig and `ZIONBridge` uses a separate validator set, and ensure both are provisioned.

### 4.2 Relayer Hardcodes `threshold.max(3)` ✅ FIXED

`.max(3)` removed; relayer now trusts the configured threshold.

### 4.3 Hardcoded Gas Cap `MAX_GAS_GWEI = 10` ✅ FIXED

The constant was removed. Both lock and burn handlers now use `chain_config.max_gas_gwei`.

### 4.4 Validator Key Aggregation via Environment Variable

`relayer.rs:708` reads `ZION_VALIDATOR_EXTRA_KEYS` to sign multiple validator proofs in one process.

**Impact:** This is acceptable for testnet, but for mainnet it concentrates multiple guardian keys in a single process, defeating the purpose of geographic/HSM distribution.

**Fix:** Document that this is testnet-only. For mainnet, run one relay per validator with only its own key.

### 4.5 L1 `bridge_address` Is Keyless Derivation Without Documented Proof

`V3/L2/bridge/config/bridge-mainnet.toml` comments state the bridge address is “keyless derivation from `ZION Bridge Vault V3 Mainnet` seed.” No derivation script or verification is present in the audited scope.

**Fix:** Add the derivation script and a verification test to the repo.

### 4.6 `db.rs::count_by_status` Uses String Interpolation for SQL

`db.rs:287-289`:
```rust
let query = format!("SELECT COUNT(*) FROM {} WHERE status = ?1", table);
```
While the `table` parameter is internally controlled, this pattern is fragile and should be replaced with an enum.

**Fix:** Use a match on an enum or constants instead of `format!`.

### 4.7 `evm_watcher.rs` Default `start_block` Is 0

`evm_watcher.rs:58` defaults to scanning from block 0 if `start_block` is not set. For mainnet this will cause massive delays and RPC failures.

**Fix:** Make `start_block` mandatory for mainnet (already validated in `config.rs`) and add a default for testnet only.

---

## 5. Medium Issues (P2 — Polish Before External Audit)

| Issue | Location | Fix |
|-------|----------|-----|
| Missing `README.md` in `V3/L2/bridge/` | `V3/L2/bridge/` | Add a README describing build, config, and operation. |
| Duplicate `BridgeValidator.sol` | `contracts/` and `contracts/src/` | Remove the duplicate; keep only `contracts/src/`. |
| `ZION_3.0.2_PLAN.md` still says `3.0.2-alpha` | `ZION_3.0.2_PLAN.md:5` | Bump to `3.0.2-beta` or current. |
| `config.rs` default `version = "0.1.0"` | `config.rs:328` | Update to `3.0.2`. |
| `BRIDGE_MAINNET_DEPLOY.md` and `BRIDGE_MAINNET_LAUNCH_CHECKLIST.md` disagree on deployment status | `V3/docs/` | Reconcile and mark mainnet as “pending deployment.” |
| `l1_watcher.rs` derives sender from single input public key only | `l1_watcher.rs:183-186` | Document that multi-input locks are not supported. |
| `wZION.sol` comment says conversion factor is 1e12, but relay uses 1e6 | `wZION.sol:270`, `types.rs:22` | Correct the comment in `wZION.sol`. |
| `BridgeValidator` constructor requires `_maxGuardians == 5` | `BridgeValidator.sol:31` | Hardcoded limit; acceptable but should be documented. |

---

## 6. Production Readiness Checklist

| Requirement | Status | Blocker |
|-------------|--------|---------|
| Contracts deployed and verified on Base Mainnet | ❌ Not done | P0 |
| 5 real validator/guardian addresses provisioned | ❌ Placeholders only | P0 |
| Mainnet config enabled and consistent | ✅ 5/5 template, enabled=false | P0 |
| Website points to live contracts | ✅ Sepolia contracts active | P0 |
| EVM watcher block-range bug fixed | ✅ Chunked 3k scan | P0 |
| Relayer uses effective RPC URL for burns | ✅ Uses Ankr/config override | P0 |
| `confirmBurnRelease` reentrancy guard | ✅ Added | P0 |
| `resetSignatures` clears `hasSigned` | ✅ Full reset | P0 |
| External security audit | ❌ Not started | P1 |
| Testnet 3/5 or 2/2 signed flow green for ≥1 week | ⚠️ Partial | P1 |
| Mainnet validator keys on HSMs | ❌ Not done | P1 |
| L1 bridge vault funded and derivation verified | ❌ Not verified | P1 |
| CI passes (`cargo test`, `clippy`, `fmt`) | ❌ Fails per `StatusV3.md` | P2 |

---

## 7. Recommended Action Plan

### Immediate (this week)
1. Reconcile configs: choose `V3/config/bridge-testnet.toml` and `V3/config/bridge-mainnet.toml` as canonical; archive/delete duplicates.
2. Fix `evm_watcher.rs` block-range cap (§3.3).
3. Fix `relayer.rs` burn RPC fallback (§3.4).
4. Fix `BridgeValidator.resetSignatures` (§3.6).
5. Fix website `BRIDGE_CONTRACTS` to point to live Sepolia contracts (§3.8).

### Short term (before mainnet)
6. Deploy `BridgeValidator` and `ZIONBridge` to Base Mainnet with 5 real validators.
7. Update `bridge-mainnet.toml` and all UI constants with real addresses.
8. Remove `threshold.max(3)` hardcode (§4.2).
9. Add `nonReentrant` to `confirmBurnRelease` (§3.5).
10. Verify L1 bridge vault derivation and funding.
11. Run at least 1 week of green testnet metrics with 3/5 real signatures.
12. Commission external audit of `ZIONBridge.sol`, `wZION.sol`, and `BridgeValidator.sol`.

### Long term
13. Integrate `BridgeValidator` guardian signatures into `ZIONBridge` operations (§4.1).
14. Move validator keys to separate HSM-hosted relays (§4.4).
15. Achieve passing CI (`cargo test`, `clippy`, `fmt`) for the L2 workspace.

---

## 8. Correct Canonical Addresses

Based on the audited files, the **live Base Sepolia testnet contracts** are:

| Contract | Address | Source |
|----------|---------|--------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | `bridge-api.ts`, `bridge-testnet-fixed.toml`, `V3/config/bridge-testnet.toml` |
| ZIONBridge | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | `bridge-api.ts`, `bridge-testnet-fixed.toml`, `V3/config/bridge-testnet.toml` |
| Deployer / Validator 1 | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | `BRIDGE_MULTISIG.md`, `bridge-testnet-fixed.toml`, `defi-contracts.ts` |
| Validator 2 | `0x8cc6F931edDAf5F14D0071727Ed1640752B5c787` | `bridge-testnet-fixed.toml` |

> The `BridgeValidator` multisig contract address for Base Sepolia is **not present in the audited files**. It must be deployed and recorded before the guardian flow can be activated.

**Base Mainnet contracts are NOT deployed yet.** All mainnet addresses in the repo are either placeholders or unverified.

---

*Generated with [Devin](https://devin.ai)*
