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

### 3.1 Inconsistent and Conflicting Bridge Configurations

There are **four different bridge configs** in the repo, each with different contract addresses, thresholds, and validator sets. This is a source-of-truth failure and a deployment risk.

| File | Network | Threshold | Contract Address | wZION Address | Notes |
|------|---------|-----------|-------------------|---------------|-------|
| `V3/L2/bridge/config/bridge-testnet.toml` | testnet | 3/5 | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | Placeholder validator addresses; contract address mismatches website |
| `V3/config/bridge-testnet.toml` | testnet | 1/1 | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | Matches website, but threshold 1 is unsafe and runtime validation fails (threshold < 2) |
| `scripts/bridge-testnet-fixed.toml` | testnet | 1/2 | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | Uses real validator addresses `0xdde17506...` and `0x8cc6...`; but hardcodes old Praha RPC |
| `V3/L2/bridge/config/bridge-mainnet.toml` | mainnet | 3/5 | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | **Enabled=true** with placeholder validators; claims mainnet deployed 2026-04-01 |
| `V3/config/bridge-mainnet.toml` | mainnet | 3/5 | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | `enabled=false`, `start_block=0` |
| `APP&WEB/website-v2.9/src/lib/bridge-api.ts` | mainnet | — | `0x0000...0000` | `0x0000...0000` | `BRIDGE_CONTRACTS = BRIDGE_CONTRACTS_MAINNET` (zero addresses) — burn widget is broken |

**Impact:** Running any of these configs as-is will either fail to start, connect to the wrong contracts, or operate with unsafe single-sig / placeholder validators.

**Fix:**
1. Pick one canonical testnet config and one canonical mainnet config.
2. Delete or archive the duplicates.
3. Update `bridge-api.ts` to point to the live testnet or mainnet contract set explicitly.

### 3.2 Runtime Config Validation Rejects Testnet 1/2 Setup

`config.rs:245-246` enforces `validator.threshold >= 2`. The `bridge-testnet-fixed.toml` (1/2) and `V3/config/bridge-testnet.toml` (1/1) will fail to load.

**Fix:** Either raise testnet threshold to 2/2 (recommended for the current two known validators) or make the minimum threshold configurable per network with explicit testnet exception.

### 3.3 EVM Watcher Block-Range Bug

`evm_watcher.rs:192`:
```rust
let to_block = finalized_block.min(from_block + MAX_BLOCK_RANGE * 10 - 1);
```
With `MAX_BLOCK_RANGE = 3_000`, this computes a 30,000-block range. The Ankr free-tier limit is 3,500 blocks per `eth_getLogs` call (`evm_watcher.rs:37`). Direct RPCs may also reject this.

**Impact:** On first sync or after a long outage, the watcher will fail with `query returned more than 3500 results` or similar, then retry with the same oversized range.

**Fix:** Cap `to_block` at `from_block + MAX_BLOCK_RANGE - 1` and loop internally until `finalized_block` is reached.

### 3.4 Burn Handler Uses Hardcoded Testnet RPC

`relayer.rs:564-568`:
```rust
let rpc_url = chain_config
    .rpc_url
    .as_deref()
    .unwrap_or("https://base-sepolia.publicnode.com");
```
The fallback is a Base Sepolia URL, even for mainnet burns.

**Impact:** If `chain_config.rpc_url` is omitted (e.g., relying on Ankr fallback), mainnet burns will be submitted to Sepolia.

**Fix:** Use `chain_config.effective_rpc_url(&self.config.ankr)` consistently (already done for the lock handler).

### 3.5 `confirmBurnRelease` Missing `nonReentrant` Guard

`ZIONBridge.sol:275`:
```solidity
function confirmBurnRelease(...) external onlyRole(VALIDATOR_ROLE) whenNotPaused {
```
`submitLockProof` uses `nonReentrant` (`ZIONBridge.sol:202`), but `confirmBurnRelease` does not.

**Impact:** Low direct reentrancy risk because the function does not call external contracts or transfer value, but consistency of reentrancy protection is a production best practice.

**Fix:** Add `nonReentrant` to `confirmBurnRelease` for defense in depth.

### 3.6 `BridgeValidator.resetSignatures` Does Not Clear `hasSigned`

`BridgeValidator.sol:93-96`:
```solidity
function resetSignatures(bytes32 opHash) external onlyGuardian {
    signatureCount[opHash] = 0;
}
```
The `hasSigned[opHash][guardian]` mapping is not reset.

**Impact:** After a reset, a guardian cannot sign the same operation again because `signOperation` checks `hasSigned`. This can deadlock legitimate operations.

**Fix:** Track signers per operation and clear `hasSigned[opHash][signer]` for each signer during reset.

### 3.7 Mainnet Config Claims Deployment That Is Not Verified

`V3/L2/bridge/config/bridge-mainnet.toml` claims:
- Base mainnet deployed 2026-04-01
- `enabled = true`
- Uses the same contract address `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` as one testnet config

Meanwhile `V3/docs/BRIDGE_MAINNET_DEPLOY.md` says: **“Not yet deployed.”**

**Impact:** Risk of starting a mainnet relay against a testnet or non-existent contract.

**Fix:** Keep `enabled = false` on mainnet until contracts are deployed and verified. Update docs with a single source of truth.

### 3.8 Website Points to Zero-Address Mainnet Contracts

`bridge-api.ts:52`:
```typescript
export const BRIDGE_CONTRACTS = BRIDGE_CONTRACTS_MAINNET;
```
`BRIDGE_CONTRACTS_MAINNET` contains zero addresses. The burn widget will attempt to call `0x0000...0000`.

**Impact:** Website bridge functionality is non-functional for both testnet and mainnet users.

**Fix:** Set `BRIDGE_CONTRACTS = BRIDGE_CONTRACTS_SEPOLIA` for testnet phase, or add an environment-based switch.

---

## 4. High Issues (P1 — Should Fix Before Launch)

### 4.1 `BridgeValidator` Is Not Integrated With `ZIONBridge`

The `BridgeValidator.sol` contract is a standalone guardian signer registry. `ZIONBridge.sol` does not call it or require guardian signatures for mint/unlock. The bridge uses its own `VALIDATOR_ROLE` and `threshold`.

**Impact:** The 3/5 guardian multisig exists on-chain but is not enforced by the bridge flow. The current bridge security is only as strong as the validator set configured in `ZIONBridge.sol`.

**Fix:** Either:
- A) Make `ZIONBridge` delegate validator management to `BridgeValidator` (e.g., `addValidator`/`removeValidator` callable only by guardian multisig), or
- B) Clearly document that `BridgeValidator` is the emergency guardian/governance multisig and `ZIONBridge` uses a separate validator set, and ensure both are provisioned.

### 4.2 Relayer Hardcodes `threshold.max(3)`

`relayer.rs:680`:
```rust
let threshold = usize::from(self.config.validator.threshold.max(3));
```
This ignores the configured threshold if it is below 3. Testnet 2/2 will require 3 signatures, which cannot be satisfied.

**Fix:** Remove `.max(3)` and trust the config value. Enforce minimum threshold only in `config.rs` validation.

### 4.3 Hardcoded Gas Cap `MAX_GAS_GWEI = 10`

`relayer.rs:34`:
```rust
const MAX_GAS_GWEI: u64 = 10;
```
This is used for both testnet and mainnet. During mainnet congestion 10 gwei may be too low.

**Fix:** Move the gas cap to per-chain config (`max_gas_gwei`) and remove the hardcoded constant.

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
| Mainnet config enabled and consistent | ❌ Conflicting configs | P0 |
| Website points to live contracts | ❌ Zero addresses | P0 |
| EVM watcher block-range bug fixed | ❌ 30k range vs 3.5k limit | P0 |
| Relayer uses effective RPC URL for burns | ❌ Hardcoded Sepolia fallback | P0 |
| `confirmBurnRelease` reentrancy guard | ❌ Missing | P0 |
| `resetSignatures` clears `hasSigned` | ❌ Partial reset | P0 |
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
