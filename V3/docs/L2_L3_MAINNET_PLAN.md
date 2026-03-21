# V3 L2 & L3 Mainnet Integration Plan

Status: 2026-03-22 — Draft  
Depends on: V3 L1 Phase 8 (mainnet launch readiness)  
Source material: `docs/L2_WZION_BRIDGE.md`, `docs/WARP_ARCHITECTURE.md`, `docs/L2_DEFI_PLAN.md`, `docs/L1-L4_ROADMAP.md`, `L2/bridge/src/types.rs`, `L3/warp/src/types.rs`

---

## 0. Critical Decimal Fix — MUST DO BEFORE ANY L2/L3 CODE

### The Problem

V3 mainnet uses **12-decimal flowers**:

```
1 ZION = 1,000,000,000,000 flowers (1e12)
FLOWERS_PER_ZION = 1_000_000_000_000
```

Source: `V3/L1/core/src/emission.rs`, V3 ROADMAP constitutional table.

Root L2/L3 code assumes **6-decimal atomic units**:

```
1 ZION = 1,000,000 atomic (1e6)       ← WRONG for V3
L1→EVM multiplier: × 1e12 (18-6=12)   ← WRONG for V3
```

Source: `L2/bridge/src/types.rs`, `L3/warp/src/types.rs`.

### Correct V3 Conversion

```
V3 L1:  1 ZION = 1e12 flowers  (12 decimals)
EVM:    1 wZION = 1e18 wei     (18 decimals)
Gap:    18 - 12 = 6
Correct multiplier: × 1e6 (L1→EVM)
Correct divisor:    ÷ 1e6 (EVM→L1)
```

### If Deployed Unfixed

Locking 1 ZION (= 1e12 flowers) would be multiplied by 1e12 → 1e24 wei → **1,000,000 wZION minted** instead of 1 wZION. This is a **1,000,000× inflation exploit**.

### Files That Must Change

| File | Current | Correct | Impact |
|------|---------|---------|--------|
| `L2/bridge/src/types.rs` — `l1_atomic_to_wzion_wei()` | × 1e12 | × 1e6 | Over-minting |
| `L2/bridge/src/types.rs` — `wzion_wei_to_l1_atomic()` | ÷ 1e12 | ÷ 1e6 | Under-unlocking |
| `L2/bridge/src/types.rs` — `atomic_to_zion_display()` | ÷ 1e6 | ÷ 1e12 | Display 1M× off |
| `L2/bridge/src/types.rs` — all test vectors | 6-dec assumptions | 12-dec | Tests pass wrongly |
| `L3/warp/src/types.rs` — `ChainId::zion_l1()` | `decimals: 6` | `decimals: 12` | Conversion broken |
| `L3/warp/src/types.rs` — conversion table comments | 6-dec | 12-dec | Misleading docs |
| `docs/L2_WZION_BRIDGE.md` | "6 decimals" | "12 decimals (flowers)" | Wrong spec |
| `docs/WARP_ARCHITECTURE.md` | "6 decimals" | "12 decimals (flowers)" | Wrong spec |
| `docs/L1-L4_ROADMAP.md` | "Block time ~15 sec" | "60 sec (constitutional)" | Wrong finality |

---

## 1. L2 — wZION Bridge for Mainnet

### 1.1 Architecture (from root testnet, adapted for V3)

```
┌─────────────────────────────────────────────────────┐
│                   L1 — ZION Mainnet                  │
│                                                       │
│  User TX → zion1bridge...vault                        │
│  memo: "BRIDGE:base:0xRecipient"                      │
│                                                       │
│  ← Bridge Vault unlock → L1 recipient                │
└──────────────┬────────────────────────┬──────────────┘
               │ L1 Watcher             │ Unlock Oracle
               ▼                        ▲
┌──────────────────────────────────────────────────────┐
│              Bridge Validators (3-of-5)               │
│  - Poll L1 node RPC for lock TXs                      │
│  - Wait 60 block confirmations (60 min @ 60s blocks)  │
│  - Submit quorum proofs to EVM                        │
│  - Monitor EVM burn events → trigger L1 unlock        │
└──────────────┬────────────────────────┬──────────────┘
               │ submitLockProof()      │ BridgeBurn event
               ▼                        ▲
┌──────────────────────────────────────────────────────┐
│              L2 — EVM Chain (Base)                     │
│                                                       │
│  wZION ERC-20 (18 decimals)                           │
│  ZIONBridge contract                                  │
│  ZIONGovernance → DAO proposals                       │
│  ZIONTreasury → grant disbursement                    │
│  ZIONStaking → delegation rewards                     │
│  ZIONFarm → LP incentives                             │
│  Uniswap V3 pool → wZION/USDC liquidity              │
└──────────────────────────────────────────────────────┘
```

### 1.2 Lock/Mint Flow (L1 → EVM)

1. User sends ZION TX to `zion1bridge000...vault` with memo `BRIDGE:base:0xRecipient`
2. L1 Watcher (bridge daemon) polls V3 node via JSON-RPC `getBlockByHeight` / `getTransaction`
3. Waits for **60 L1 block confirmations** (= ~60 minutes at 60s block time)
4. Each of 3-of-5 validators calls `ZIONBridge.submitLockProof(l1TxHash, recipient, amountWei)`
5. At quorum → contract auto-mints `amount × 1e6` wei of wZION to EVM recipient
6. Fee: 0.1% of minted amount (50% burn, 25% DAO, 25% validators)

### 1.3 Burn/Unlock Flow (EVM → L1)

1. User calls `wZION.bridgeBurn(amountWei, "zion1...", burnId)` on EVM
2. wZION tokens are burned (totalSupply decreases)
3. EVM Watcher detects `BridgeBurn` event
4. Validators verify burn finality (12 EVM blocks)
5. Validators call V3 node RPC `bridge_unlock(l1_recipient, amount_flowers)`
6. Bridge vault releases `amountWei ÷ 1e6` flowers to L1 recipient

### 1.4 V3 L1 Core Changes Required

#### 1.4.1 Memo/OP_RETURN Support

V3 `TxOutput` already has `memo: Option<String>`. Bridge and WARP parse this field for routing instructions.

Format: `BRIDGE:<chain>:<recipient_address>` (ASCII, max 256 bytes)

No core change needed — memo field exists in `tx.rs`.

#### 1.4.2 Bridge Vault Address

Define in `V3/L1/core/src/fee.rs`:

```rust
pub const BRIDGE_VAULT_ADDRESS: &str = "zion1bridge000000000000000000000000000vault";
```

Bridge vault is a **special address** — no private key exists. Only the bridge oracle mechanism can release funds from it (via a multisig-authorized coinbase-style output).

#### 1.4.3 Bridge RPC Endpoints

Add to `V3/L1/core/src/rpc.rs`:

| Method | Params | Returns | Purpose |
|--------|--------|---------|---------|
| `getBridgeLocks` | `{from_height, to_height}` | Array of lock TXs (memo starts with `BRIDGE:`) | L1 Watcher polls this |
| `getBridgeVaultBalance` | — | `{balance_flowers, balance_zion}` | Vault audit |
| `submitBridgeUnlock` | `{l1_recipient, amount_flowers, evm_tx_hash, validators[]}` | `{tx_hash, status}` | Burn→unlock (requires validator quorum) |

#### 1.4.4 Bridge Unlock Validation

Add to `V3/L1/core/src/validation.rs`:

- Step 12: `validate_bridge_unlock()` — verify that unlock TX has ≥3 of 5 validator signatures, amount ≤ vault balance, EVM burn proof is valid
- Bridge unlock TXs bypass normal UTXO spend rules (vault has no private key)

### 1.5 EVM Contract Deployment Plan

| Phase | Scope | Network | Target |
|-------|-------|---------|--------|
| L2-A | Fix decimal conversion (×1e6), redeploy wZION to Base Sepolia | Testnet | Week 1 |
| L2-B | Bridge daemon connects to V3 testnet node RPC | Testnet | Week 2 |
| L2-C | End-to-end lock/mint/burn/unlock on testnet | Testnet | Week 3–4 |
| L2-D | Security audit: validator key management, rate limits | Testnet | Week 5 |
| L2-E | Deploy to Base mainnet | Mainnet | After L1 mainnet stable |

### 1.6 Existing Testnet Contracts (Base Sepolia — reuse after decimal fix)

| Contract | Address | Status |
|----------|---------|--------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | Redeploy with fixed decimals |
| ZIONBridge | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | Redeploy with fixed conversion |
| ZIONGovernance | `0x039F730e3e1c3f36da95187697118791762290a1` | Keep |
| ZIONTreasury | `0x178d85323dC94Ce2477269Dfb93a12D04B9bE537` | Keep |
| ZIONStaking | `0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913` | Keep |
| ZIONAtomicSwap | `0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc` | Keep |
| ZIONFarm | `0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843` | Keep |
| Uniswap V3 pool | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` | Keep |

### 1.7 Fee Model

| Parameter | Value | Note |
|-----------|-------|------|
| Lock fee (L1→EVM) | 0.1% | Deducted from minted wZION |
| Unlock fee (EVM→L1) | 0.1% | Deducted from released ZION |
| Fee distribution | 50% burn, 25% DAO, 25% validators | Deflationary pressure |
| Minimum transfer | 100 ZION (= 100e12 flowers) | Anti-dust |
| Daily limit | 10,000,000 wZION | Safety cap |
| Timelock | 24h hold for >1,000,000 wZION | Guardian review window |

### 1.8 Security Considerations

- **Validator keys**: 5 Ed25519 keys, 3-of-5 quorum. Keys stored in HSM or ephemeral Docker secrets.
- **Finality**: 60 L1 blocks (~60 min) before lock is confirmed. 12 EVM blocks (~24 sec on Base) before burn is confirmed.
- **Vault cap**: Maximum vault balance enforced on-chain. If vault holds >X ZION, new locks are rejected until withdrawals reduce balance.
- **Emergency pause**: Bridge contract has `pause()` function callable by 3-of-5 validators.
- **Rate limiting**: Max 100 lock/unlock operations per hour globally.

---

## 2. L3 — WARP Cross-Chain Interoperability

### 2.1 Architecture (from root testnet, adapted for V3)

WARP extends L2 bridge from EVM-only to 7+ chain families.

```
┌─────────────────────────────────────────────────────┐
│                   L1 — ZION Mainnet                  │
│                                                       │
│  User TX → zion1bridge...vault                        │
│  memo: "WARP:1:solana:SolRecipient"                  │
│                                                       │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│              WARP Router (L3)                          │
│                                                       │
│  Route by memo prefix:                                │
│  BRIDGE:* → L2 bridge (EVM only)                      │
│  WARP:1:* → L3 WARP (any supported chain)             │
│                                                       │
│  Chain adapters:                                      │
│  ├─ EVM (Base, Arbitrum, BSC, Polygon) → EIP-155      │
│  ├─ Solana → SPL token mint, ed25519                  │
│  ├─ Tron → TRC-20, secp256k1                         │
│  ├─ Stellar → Asset, ed25519 XDR                     │
│  ├─ Bitcoin → P2WPKH HTLC                            │
│  ├─ Cardano → Native asset (skeleton)                │
│  └─ Cosmos → IBC transfer (skeleton)                 │
│                                                       │
│  Validator quorum: same 3-of-5 as L2                  │
│  Fee: 0.1%–0.25% per route                           │
└──────────────────────────────────────────────────────┘
```

### 2.2 Chain Support Matrix

| Chain | Family | Token Decimals | L1→Chain Multiplier | Chain→L1 Divisor | Signing | Status |
|-------|--------|---------------|---------------------|-----------------|---------|--------|
| Base / Arbitrum / BSC / Polygon | EVM | 18 | × 1e6 | ÷ 1e6 | EIP-155 | Live (via L2 bridge) |
| Solana | SPL | 9 | ÷ 1e3 | × 1e3 | ed25519 | Adapter ready |
| Tron | TRC-20 | 18 | × 1e6 | ÷ 1e6 | secp256k1 | Adapter ready |
| Stellar | Asset | 7 | ÷ 1e5 | × 1e5 | ed25519 XDR | Adapter ready |
| Bitcoin | HTLC | 8 | ÷ 1e4 | × 1e4 | P2WPKH | Adapter ready |
| Cardano | Native | 6 | ÷ 1e6 | × 1e6 | Skeleton | Needs work |
| Cosmos | IBC | 6 | ÷ 1e6 | × 1e6 | Skeleton | Needs work |

**All multipliers/divisors are computed from:**
```
conversion_factor = 10^(target_decimals - 12)
```

Where 12 = ZION L1 flower decimals.

### 2.3 Memo Format

```
WARP:<version>:<chain>:<recipient_address>[:<options>]
```

Examples:
- `WARP:1:solana:7xKXtg2CW87d97Te...` — send wZION-SPL to Solana
- `WARP:1:bitcoin:bc1q...` — HTLC swap to Bitcoin
- `WARP:1:stellar:GCFP2...` — send ZION-Asset to Stellar

### 2.4 V3 L1 Core Changes for WARP

Minimal — WARP builds on top of the same bridge vault mechanism:

1. **Memo parsing**: recognize `WARP:` prefix in addition to `BRIDGE:` prefix
2. **RPC extension**: `getWarpLocks` — same as `getBridgeLocks` but filters for `WARP:*` memos
3. **Routing**: WARP router (separate daemon) reads both `BRIDGE:*` and `WARP:*` lock events

No consensus changes needed — WARP is purely an off-chain routing layer that reads L1 blocks and dispatches to target chains.

### 2.5 WARP Fee Model

| Route | Fee | Reason |
|-------|-----|--------|
| L1 → EVM | 0.10% | Fast, cheap destination |
| L1 → Solana | 0.15% | SPL mint + rent account cost |
| L1 → Bitcoin | 0.25% | HTLC gas + timelock cost |
| L1 → Stellar | 0.10% | Cheap destination |
| L1 → Tron | 0.15% | TRC-20 energy cost |
| L1 → Cardano | 0.15% | Min UTXO deposit |
| L1 → Cosmos | 0.10% | IBC relay cost |

Fee distribution: same as L2 bridge (50% burn, 25% DAO, 25% validators).

### 2.6 Deployment Phases

| Phase | Scope | Target |
|-------|-------|--------|
| L3-A | Fix `ChainId::zion_l1()` decimals (6→12), update all conversion math | Week 1 (with L2-A) |
| L3-B | WARP router daemon: reads V3 node RPC, routes to chain adapters | Week 3–4 (with L2-B/C) |
| L3-C | Testnet: L1 → Solana, L1 → Bitcoin HTLC end-to-end | Week 5–6 |
| L3-D | Security audit: chain adapter signers, timelock verification | Week 7 |
| L3-E | Production: EVM chains first, then Solana/Stellar/Bitcoin | After L2-E stable |
| L3-F | Cardano and Cosmos adapters (skeleton → production) | Deferred |

---

## 3. Dependency Order

```
L1 (mainnet stable, producing blocks)
 └─► L2 (bridge vault defined, RPC endpoints, decimal fix)
      └─► L3 (WARP router, chain adapters, unified fee model)
```

**Phase 1: L1 prep** (code changes in V3/L1/core)
  - Define `BRIDGE_VAULT_ADDRESS` in fee.rs
  - Add `getBridgeLocks`, `getBridgeVaultBalance`, `submitBridgeUnlock` to rpc.rs
  - Add `validate_bridge_unlock()` to validation.rs
  - Add memo prefix parsing utility

**Phase 2: Decimal fix** (code changes in root L2/L3 crates)
  - Fix `L2/bridge/src/types.rs` conversion functions (×1e12 → ×1e6)
  - Fix `L3/warp/src/types.rs` ChainId decimals (6 → 12)
  - Update all test vectors
  - Update `docs/L2_WZION_BRIDGE.md` and `docs/WARP_ARCHITECTURE.md`

**Phase 3: Bridge daemon** (new service connecting V3 node to EVM)
  - L1 Watcher: poll V3 node `getBridgeLocks` every block
  - EVM Watcher: listen for `BridgeBurn` events
  - Validator quorum logic: 3-of-5 multisig
  - Docker service: `zion-bridge` added to compose stack

**Phase 4: WARP router** (extends bridge daemon to multi-chain)
  - Chain adapter registry
  - Memo routing (BRIDGE:* → L2, WARP:* → L3)
  - Per-chain fee calculation

**Phase 5: DeFi stack** (L2 contracts already deployed on testnet)
  - Governance proposals connected to DAO Treasury
  - Staking delegation live
  - Uniswap V3 wZION/USDC pool seeded

---

## 4. Known Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Decimal conversion error deployed to mainnet | **Critical** | Fix and test BEFORE any bridge operation; fuzz test with boundary values |
| Bridge vault key compromise | **Critical** | Vault is keyless (special address); unlocks require 3-of-5 validator quorum |
| Validator collusion (3 malicious of 5) | **High** | Timelock for large amounts; vault balance cap; emergency pause |
| L1 reorg after lock confirmation | **Medium** | 60-block wait (60 min) makes deep reorg extremely unlikely (MAX_REORG_DEPTH=10) |
| EVM chain downtime | **Low** | Lock TXs queue on L1; minting resumes when EVM recovers |
| Block time constitutional change | **Low** | If block time changes, finality wait must be recalculated (currently 60 blocks × 60s) |

---

## 5. L2/L3 File Structure (proposed for V3)

```
V3/
  L2/
    bridge/
      src/
        types.rs          ← conversion functions (fixed for 12 decimals)
        watcher.rs        ← L1 block watcher daemon
        evm_watcher.rs    ← EVM event listener
        validator.rs      ← multisig quorum logic
        config.rs         ← bridge configuration
      Cargo.toml
    contracts/
      wZION.sol           ← ERC-20 token (18 decimals)
      ZIONBridge.sol      ← lock proof / burn logic
  L3/
    warp/
      src/
        types.rs          ← chain definitions (fixed for 12 decimals)
        router.rs         ← WARP memo routing
        adapters/
          evm.rs          ← EIP-155 adapter
          solana.rs       ← SPL adapter
          bitcoin.rs      ← HTLC adapter
          stellar.rs      ← XDR adapter
          tron.rs         ← TRC-20 adapter
      Cargo.toml
```

This structure mirrors the root `L2/` and `L3/` layout but will be clean-ported into V3 with corrected decimal math.

---

## 6. Acceptance Criteria

### L2 Done When

- [ ] `l1_atomic_to_wzion_wei(1_000_000_000_000)` returns `"1000000000000000000"` (1 ZION → 1 wZION)
- [ ] `wzion_wei_to_l1_atomic("1000000000000000000")` returns `1_000_000_000_000` (1 wZION → 1 ZION)
- [ ] Lock 100 ZION on V3 testnet → 100 wZION minted on Base Sepolia
- [ ] Burn 50 wZION on Base Sepolia → 50 ZION unlocked on V3 testnet
- [ ] Fee deduction correct (0.1%)
- [ ] Daily limit enforced (10M wZION)
- [ ] Timelock triggers for >1M wZION
- [ ] 60-block finality wait verified

### L3 Done When

- [ ] `ChainId::zion_l1().decimals` == 12
- [ ] WARP:1:solana lock on V3 testnet → wZION-SPL minted on Solana devnet
- [ ] WARP:1:bitcoin lock on V3 testnet → HTLC created on Bitcoin testnet
- [ ] Fee per route matches fee table
- [ ] Router correctly dispatches BRIDGE:* vs WARP:* memos

---

*This plan follows the V3 "one canonical path per operation" principle: one bridge vault, one conversion formula, one fee model, one validator quorum shared between L2 and L3.*
