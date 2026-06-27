# V3 L2 Mainnet Production Checklist

Status: 2026-04-01  
Scope: V3 L2 production readiness for Bridge, DAO, and Atomic Swap  
Depends on: [L2_L3_MAINNET_PLAN.md](L2_L3_MAINNET_PLAN.md), [MAINNET_DEPLOY_RUNBOOK.md](MAINNET_DEPLOY_RUNBOOK.md)

---

## 0. Reality Check

V3/L2 is **migrated**, but it is **not yet production-ready**.

What is already true:

- `V3/L2/bridge` exists and tests pass (161 tests).
- `V3/L2/dao` exists and tests pass (65 tests).
- `V3/L2/atomic-swap` exists and tests pass (34 tests).
- Decimal migration to V3 6-decimal flowers is already done in the Rust crates (updated 3.0.3 fork).
- **Base mainnet contracts are deployed and verified on BaseScan** (2026-04-01):
  - wZION: `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`
  - ZIONBridge: `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721`
  - ZIONAtomicSwap: `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb`
- **Solidity test suite passes** (132 tests: 48 wZION + 34 Bridge + 18 Swap + 18 Farm + 14 E2E).
- **L1 mining and pool payout are live** — Phase 18 UTXO coinbase + pool payout E2E deployed, chain height 6800+.
- **Humanitarian tithe verified on-chain**: 89% miner / 5% humanitarian / 5% issobella / 1% pool_fee — exact per block.

What is still false:

- Core bridge unlock path exists, but validator proof cryptographic verification is not yet enforced end-to-end.
- Bridge relayer still sends placeholder validator proofs pending final validator-signature integration.
- ~~Mainnet contracts/addresses are not deployed and wired~~ → **RESOLVED** (deployed + verified 2026-04-01).
- Solidity contracts are not yet brought under the V3 source-of-truth workflow (still at `L2/contracts/`, not `V3/L2/contracts/`).
- L2 production rollout manifest is present, but still testnet-oriented by default and needs final mainnet ops hardening.
- Bridge vault is a placeholder address — no real keyless vault exists on L1 yet.

Launch implication:

- L1 mainnet can run without L2.
- L2 mainnet launch must stay **NO-GO** until the blockers below are closed.

---

## 1. Hard Blockers

### 1.1 Bridge-specific unlock authorization is only partially complete

Files to implement:

- `V3/L1/core/src/rpc.rs`
- `V3/L1/core/src/validation.rs`
- `V3/L1/core/src/fee.rs`
- `V3/L1/core/src/lib.rs`

Current state:

- keep canonical `BRIDGE_VAULT_ADDRESS`
- keep `getBridgeLocks`, `getBridgeVaultBalance`, and `submitBridgeUnlock` live in core
- replay protection exists in runtime/mempool flow
- submit RPC enforces threshold count + duplicate validator_id guard

Still required before launch:

- enforce cryptographic validator proof verification in core unlock authorization path
- bind validator identities/signatures to a configured validator set
- return accepted unlock TX metadata with finalized proof provenance fields

Why this blocks launch:

- without cryptographic proof validation, unlock authorization is not production-safe.

### 1.2 Bridge daemon transport is aligned, but unlock execution is not complete

Files to migrate:

- `V3/L2/bridge/src/l1_watcher.rs`
- `V3/L2/bridge/src/relayer.rs`
- `V3/L2/bridge/src/config.rs`

Legacy dependencies removed:

- `/api/block/height/:height`
- `/api/address/:address/utxos`
- `/api/bridge/unlock`

Current state:

- raw TCP JSON-RPC on the live V3 node RPC port
- watcher scans canonical block data via `getChainInfo` and `getBlockByHeight`
- relayer submits unlock requests via `submitBridgeUnlock`
- remaining blocker is core-side unlock acceptance, not bridge-side transport

### 1.3 DAO vote-weight correctness is migrated, but production manifests are still missing

Files to fix:

- `V3/L2/dao/src/l1_scanner.rs`
- `V3/L2/dao/src/config.rs`

Completed:

- scanner uses canonical V3 RPC names
- scanner uses `getBalanceAtHeight` for proposal snapshot correctness

Mainnet requirement:

- proposal voting weight must be anchored to a deterministic historical snapshot
- no current-balance approximation is acceptable for production governance
- checked-in audited mainnet config still remains required before launch

### 1.4 Atomic swap transport and hashing are aligned with V3

Files to fix:

- `V3/L2/atomic-swap/src/watcher.rs`
- `V3/L2/atomic-swap/src/executor.rs`
- `V3/L2/atomic-swap/src/config.rs`

Completed:

- watcher consumes canonical V3 RPC via `getChainInfo` and `getBlockByHeight`
- executor uses `getUtxos` and `sendRawTransaction`
- off-chain TX hash builder is aligned with canonical BLAKE3-compatible serialization

### 1.5 Solidity contracts are deployed but outside the V3 source-of-truth

Source currently still living outside V3:

- `L2/contracts/`

Current state:

- All 3 contracts (wZION, ZIONBridge, ZIONAtomicSwap) are **deployed and verified on Base mainnet** (2026-04-01).
- Deploy manifest: `L2/contracts/deployed-base-mainnet.json`.
- Verification script: `L2/contracts/scripts/verify-base-mainnet-basescan.ts`.
- Live contract check script: `L2/contracts/scripts/check-live-contracts.js`.

Production requirement:

- contracts, deploy scripts, addresses, and environment selection must be versioned from V3 context
- the current workflow works but is not yet canonically under `V3/L2/contracts/`

### 1.6 Production config and deploy manifests are partially complete

Current audited artifacts in repo:

- `V3/L2/bridge/config/bridge-mainnet.toml`
- `V3/L2/bridge/config/bridge-testnet.toml`
- `V3/L2/atomic-swap/config/swap-mainnet.toml`
- `V3/L2/atomic-swap/config/swap-testnet.toml`
- `V3/L2/dao/config/dao-mainnet.toml`
- `V3/L2/dao/config/dao-testnet.toml`
- `V3/docker/docker-compose.v3-l2.yml`

Still missing for production closure:

- ~~deployed Base mainnet addresses in bridge/swap configs~~ → **RESOLVED** (deployed 2026-04-01, see `deployed-base-mainnet.json`)
- production secret-injection runbook for validator keys, API keys, bearer tokens
- final ops profile for compose (mainnet config paths + health checks + alert routing)

Progress on compose profile workflow:

- `V3/docker/docker-compose.v3-l2.yml` now supports env-driven config profile switching:
	- `ZION_BRIDGE_CONFIG`
	- `ZION_SWAP_CONFIG`
	- `ZION_DAO_CONFIG`
- `V3/docker/.env.l2.example` added as a template for testnet/mainnet profile and secret injection.

Without these closure items:

- production rollout is not reproducible
- secrets and endpoints are not auditable
- validator topology is not pinned in repo

---

## 2. Recommended Build Order

Do not run L2 work in parallel randomly. The dependency order matters.

### Phase A — V3 core bridge support

1. Add `BRIDGE_VAULT_ADDRESS` and bridge validator set constants.
2. Add `getBridgeLocks`.
3. Add `getBridgeVaultBalance`.
4. Add `submitBridgeUnlock`.
5. Finish unlock validation, replay protection, and vault accounting tests.

### Phase B — RPC surface alignment

1. Finish bridge core unlock acceptance path behind `submitBridgeUnlock`.
2. Keep bridge daemon on canonical V3 JSON-RPC and add end-to-end unlock reconciliation once core accepts writes.
3. Keep DAO on current V3 RPC method names and historical snapshots.
4. Keep atomic-swap on canonical V3 JSON-RPC and canonical hashing.
5. Add focused end-to-end acceptance coverage for the migrated transport paths.

### Phase C — Contracts and deploy source-of-truth

1. ~~Bring `L2/contracts` under `V3/L2/contracts` or explicitly declare a V3-owned deploy entrypoint.~~ → workflow exists at `L2/contracts/`, functional
2. ~~Prepare Base Sepolia redeploy from V3 context.~~ → Base Sepolia contracts exist
3. ~~Capture deployed addresses in versioned V3 docs.~~ → **DONE** (`L2/contracts/deployed-base-mainnet.json`)
4. ~~Prepare Base mainnet deploy.~~ → **DONE** (all 3 contracts deployed + verified on BaseScan 2026-04-01)

### Phase D — Production configs and ops

1. Check in non-secret mainnet config templates.
2. Add root-level compose or deploy script for bridge, DAO, and atomic-swap.
3. Define secret injection model for validator keys and RPC tokens.
4. Add health checks, metrics, and runbook steps.

### Phase E — End-to-end acceptance

1. Lock on L1 -> mint on Base Sepolia.
2. Burn on Base Sepolia -> unlock on L1.
3. DAO propose -> vote -> timelock -> execute with snapshot-correct vote weight.
4. Atomic swap lock -> claim -> refund path.
5. Failure-path tests: duplicate unlock, replayed burn, stale validator quorum, insufficient vault balance.

---

## 3. File-Level Implementation Checklist

### 3.1 V3 core

#### `V3/L1/core/src/fee.rs`

- add `BRIDGE_VAULT_ADDRESS`
- add bridge validator identifiers or load-from-config model
- document that the vault is keyless and only bridge-authorized unlocks may spend from it

#### `V3/L1/core/src/rpc.rs`

- add `getBridgeLocks`
- add `getBridgeVaultBalance`
- add `submitBridgeUnlock`
- add `getBalanceAtHeight` for DAO snapshot correctness
- keep method naming camelCase to match current V3 RPC style

#### `V3/L1/core/src/lib.rs`

- add runtime helpers to scan accepted blocks for `BRIDGE:` memos
- add vault balance lookup helpers
- add unlock replay tracking keyed by EVM tx hash or burn id
- add historical balance snapshot helper for DAO

#### `V3/L1/core/src/validation.rs`

- add bridge unlock validation step
- require quorum proof
- reject unlock replay
- reject amount above vault balance
- reject malformed recipient or validator set

### 3.2 Bridge

#### `V3/L2/bridge/src/l1_watcher.rs`

- replace direct REST block scanning with `getBridgeLocks`
- use `getBlockByHeight` and `getTransaction` only as fallback or diagnostic paths if needed
- remove coupling to `/api/address/:address/utxos`

#### `V3/L2/bridge/src/relayer.rs`

- replace `/api/bridge/unlock` with `submitBridgeUnlock`
- carry validator proofs in a canonical JSON-RPC request body
- store returned unlock tx hash for reconciliation

#### `V3/L2/bridge/src/config.rs`

- rename comments and defaults away from legacy HTTP expectations
- pin mainnet chain enablement only after contracts and start block are set

#### `V3/L2/bridge/tests/mainnet_readiness.rs`

- keep current readiness checks
- extend checklist to fail if bridge config still points to legacy HTTP routes
- extend checklist to require non-zero Base mainnet addresses before enabling chain

### 3.3 DAO

#### `V3/L2/dao/src/l1_scanner.rs`

- switch to `getChainInfo`, `getBlockByHeight`, `getTransaction`, `getBalance`, `getBalanceAtHeight`
- remove current-balance approximation for vote weight
- pin proposal snapshot block in persisted proposal state

#### `V3/L2/dao/src/config.rs`

- stop defaulting to legacy `/jsonrpc` HTTP path naming
- document current V3 RPC transport expectations clearly

### 3.4 Atomic swap

#### `V3/L2/atomic-swap/src/watcher.rs`

- replace `/stats` with `getChainInfo`
- replace `/api/block/height/:height` with `getBlockByHeight`
- replace `/api/tx/:txid` with `getTransaction`

#### `V3/L2/atomic-swap/src/executor.rs`

- replace `/rpc/submit_tx` with the canonical V3 transaction submit method
- replace `/api/address/:address/utxos` with `getUtxos`
- switch fallback hash builder from SHA-256 to BLAKE3-compatible implementation

#### `V3/L2/atomic-swap/src/config.rs`

- fix naming and comments that still describe the old HTTP node API
- add explicit production note for raw TCP JSON-RPC connectivity expectations

### 3.5 Contracts and deploy

#### `L2/contracts/`

- either migrate into `V3/L2/contracts/`
- or document a single V3-owned deploy entrypoint that consumes legacy contract sources intentionally

Completed artifacts:

- ✅ Base mainnet deploy script (`scripts/deploy-base-mainnet.ts`)
- ✅ Checked-in deployed-address manifest (`deployed-base-mainnet.json`)
- ✅ BaseScan verification script (`scripts/verify-base-mainnet-basescan.ts`)
- ✅ Live contract check script (`scripts/check-live-contracts.js`)
- Validator and multisig ceremony notes (still needed)

---

## 4. Commit Plan

Recommended commit order:

1. `docs(V3/L2): add production blocker checklist and implementation order`
2. `feat(V3/L1): add bridge vault constants and bridge RPC scaffolding`
3. `feat(V3/L1): add bridge unlock validation and replay protection`
4. `refactor(V3/L2/bridge): migrate L1 integration to V3 JSON-RPC`
5. `refactor(V3/L2/dao): align scanner with V3 RPC and snapshot voting`
6. `refactor(V3/L2/atomic-swap): align watcher and executor with V3 RPC`
7. `build(V3/L2): add production config templates and deploy manifests`
8. `test(V3/L2): add end-to-end bridge, dao, and swap acceptance coverage`
9. `ops(V3/L2): publish runbook and deployed contract manifests`

Do not squash all of this into one commit. The bridge/core boundary needs audit-friendly history.

---

## 5. Production Go/No-Go Gates

L2 mainnet remains **NO-GO** until all items below are true.

- bridge lock scan works against live V3 JSON-RPC
- bridge unlock works against live V3 JSON-RPC with cryptographic validator proof verification
- ✅ ~~Base mainnet wZION and ZIONBridge are deployed and documented~~ (deployed + BaseScan verified 2026-04-01)
- mainnet chain in bridge config is enabled with non-zero contract addresses and fixed `start_block`
- DAO voting weight uses historical snapshot balance, not current balance
- atomic-swap uses canonical V3 RPC and canonical hashing
- L2 config templates are checked in and non-secret values are audited
- end-to-end lock/mint/burn/unlock test has passed on Sepolia against the same V3 RPC model used on mainnet
- replay and over-withdrawal protections are tested
- bridge vault address is real (not placeholder) with correct keyless-unlock semantics

---

## 6. Immediate Next Task

If work starts now, the first code change should be:

1. implement bridge unlock validation, replay protection, and accepted-write flow behind `submitBridgeUnlock` in V3 core

Reason:

- bridge and atomic-swap now speak the correct transport already
- the highest remaining runtime blocker is core-side unlock acceptance, not daemon-side RPC migration
