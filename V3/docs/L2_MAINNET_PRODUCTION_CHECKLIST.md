# V3 L2 Mainnet Production Checklist

Status: 2026-03-29  
Scope: V3 L2 production readiness for Bridge, DAO, and Atomic Swap  
Depends on: [L2_L3_MAINNET_PLAN.md](L2_L3_MAINNET_PLAN.md), [MAINNET_DEPLOY_RUNBOOK.md](MAINNET_DEPLOY_RUNBOOK.md)

---

## 0. Reality Check

V3/L2 is **migrated**, but it is **not yet production-ready**.

What is already true:

- `V3/L2/bridge` exists and tests pass.
- `V3/L2/dao` exists and tests pass.
- `V3/L2/atomic-swap` exists and tests pass.
- Decimal migration to V3 12-decimal flowers is already done in the Rust crates.

What is still false:

- V3 core does not yet expose bridge-specific RPC methods.
- Bridge and atomic-swap still depend on legacy-style HTTP endpoints instead of the live V3 raw TCP JSON-RPC surface.
- DAO still depends on old RPC method names and lacks historical-balance snapshots for mainnet voting correctness.
- Solidity contracts are not yet brought under the V3 source-of-truth workflow.
- No audited V3 production config files are checked in for bridge, DAO, or atomic-swap.

Launch implication:

- L1 mainnet can run without L2.
- L2 mainnet launch must stay **NO-GO** until the blockers below are closed.

---

## 1. Hard Blockers

### 1.1 Bridge-specific V3 core surface is missing

Files to implement:

- `V3/L1/core/src/rpc.rs`
- `V3/L1/core/src/validation.rs`
- `V3/L1/core/src/fee.rs`
- `V3/L1/core/src/lib.rs`

Required outcomes:

- define canonical `BRIDGE_VAULT_ADDRESS`
- expose bridge lock scan RPC
- expose bridge vault balance RPC
- expose bridge unlock submit RPC
- validate unlock authorization and replay protection

Why this blocks launch:

- the bridge daemon currently has no canonical V3 mainnet RPC to scan bridge locks or release funds back from L1.

### 1.2 Bridge daemon still speaks legacy HTTP API

Files to migrate:

- `V3/L2/bridge/src/l1_watcher.rs`
- `V3/L2/bridge/src/relayer.rs`
- `V3/L2/bridge/src/config.rs`

Current legacy dependencies to remove:

- `/api/block/height/:height`
- `/api/address/:address/utxos`
- `/api/bridge/unlock`

Target V3 contract:

- raw TCP JSON-RPC on the live V3 node RPC port
- methods aligned with `getBlockByHeight`, `getTransaction`, `getUtxos`, plus new bridge methods

### 1.3 DAO vote-weight correctness is not mainnet-safe yet

Files to fix:

- `V3/L2/dao/src/l1_scanner.rs`
- `V3/L2/dao/src/config.rs`

Blockers:

- scanner still calls old snake_case RPC names (`get_info`, `get_block`, `get_transaction`, `get_balance`)
- scanner uses current balance as an approximation instead of balance at proposal snapshot height

Mainnet requirement:

- proposal voting weight must be anchored to a deterministic historical snapshot
- no current-balance approximation is acceptable for production governance

### 1.4 Atomic swap still speaks legacy HTTP API and hashes off-chain TXs incorrectly

Files to fix:

- `V3/L2/atomic-swap/src/watcher.rs`
- `V3/L2/atomic-swap/src/executor.rs`
- `V3/L2/atomic-swap/src/config.rs`

Blockers:

- watcher still consumes `/stats`, `/api/block/height/:height`, `/api/tx/:txid`
- executor still posts to `/rpc/submit_tx`
- executor still fetches UTXOs via `/api/address/:address/utxos`
- off-chain TX hash builder still uses SHA-256 fallback instead of BLAKE3

### 1.5 Solidity contracts are still outside the V3 source-of-truth

Source currently still living outside V3:

- `L2/contracts/`

Production requirement:

- contracts, deploy scripts, addresses, and environment selection must be versioned from V3 context
- Base Sepolia redeploy and Base mainnet deploy cannot stay coupled to legacy root-only workflow

### 1.6 Production config and deploy manifests are missing

Missing audited artifacts:

- `V3/L2/bridge/config/bridge-mainnet.toml`
- `V3/L2/bridge/config/bridge-testnet.toml`
- `V3/L2/dao/config/dao-mainnet.toml`
- `V3/L2/atomic-swap/config/atomic-swap-mainnet.toml`
- root-level compose or deploy manifest for L2 services

Without these files:

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
5. Add unlock validation, replay protection, and vault accounting tests.

### Phase B — RPC surface alignment

1. Migrate bridge daemon from legacy REST to V3 JSON-RPC.
2. Migrate DAO scanner to current V3 RPC method names.
3. Add DAO historical snapshot endpoint support in core and consume it in DAO.
4. Migrate atomic-swap watcher and executor to V3 JSON-RPC.
5. Replace atomic-swap off-chain SHA-256 TX hash fallback with BLAKE3-compatible hashing.

### Phase C — Contracts and deploy source-of-truth

1. Bring `L2/contracts` under `V3/L2/contracts` or explicitly declare a V3-owned deploy entrypoint.
2. Prepare Base Sepolia redeploy from V3 context.
3. Capture deployed addresses in versioned V3 docs.
4. Prepare Base mainnet deploy only after end-to-end Sepolia flow passes.

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

Required artifacts:

- Base Sepolia deploy script
- Base mainnet deploy script
- checked-in deployed-address manifests
- validator and multisig ceremony notes

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
- bridge unlock works against live V3 JSON-RPC
- Base mainnet wZION and ZIONBridge are deployed and documented
- mainnet chain in bridge config is enabled with non-zero contract addresses and fixed `start_block`
- DAO voting weight uses historical snapshot balance, not current balance
- atomic-swap uses canonical V3 RPC and canonical hashing
- L2 config templates are checked in and non-secret values are audited
- end-to-end lock/mint/burn/unlock test has passed on Sepolia against the same V3 RPC model used on mainnet
- replay and over-withdrawal protections are tested

---

## 6. Immediate Next Task

If work starts now, the first code change should be:

1. implement bridge vault support and bridge RPC methods in V3 core

Reason:

- bridge, DAO, and atomic-swap all depend on the L1 integration contract being stable
- without that, the rest of the L2 daemons keep coding against the wrong transport and model
