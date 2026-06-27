# V3 L2 & L3 Mainnet Integration Plan

Status: 2026-03-29 — Draft v3  
Depends on: V3 L1 Phase 8 (mainnet launch readiness)  
Source material: `docs/L2_WZION_BRIDGE.md`, `docs/WARP_ARCHITECTURE.md`, `docs/L2_DEFI_PLAN.md`, `docs/L1-L4_ROADMAP.md`, `L2/bridge/src/types.rs`, `L3/warp/src/types.rs`, `L2/dao/`, `L2/atomic-swap/`, `L2/contracts/sol/`, `L3/ai-native/`, `L3/ncl/`

Current production tracker: `V3/docs/L2_MAINNET_PRODUCTION_CHECKLIST.md`

---

## 0. Critical Decimal Fix — MUST DO BEFORE ANY L2/L3 CODE

### The Problem

V3 mainnet uses **6-decimal flowers** (updated 3.0.3 fork):

```
1 ZION = 1,000,000 flowers (1e6)
FLOWERS_PER_ZION = 1_000_000
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
V3 L1:  1 ZION = 1e6 flowers   (6 decimals)  (updated 3.0.3 fork)
EVM:    1 wZION = 1e18 wei     (18 decimals)
Gap:    18 - 6 = 12
Correct multiplier: × 1e12 (L1→EVM)
Correct divisor:    ÷ 1e12 (EVM→L1)
```

### If Deployed Unfixed

Locking 1 ZION (= 1e6 flowers) would be multiplied by 1e12 → 1e18 wei → **1,000,000 wZION minted** instead of 1 wZION. This is a **1,000,000× inflation exploit**. (Note: pre-3.0.3 fork, V3 used 1e12 flowers; the exploit math was different then. Updated 3.0.3 fork.)

### Files That Must Change

| File | Current | Correct | Impact |
|------|---------|---------|--------|
| `L2/bridge/src/types.rs` — `l1_atomic_to_wzion_wei()` | × 1e12 | × 1e6 | Over-minting |
| `L2/bridge/src/types.rs` — `wzion_wei_to_l1_atomic()` | ÷ 1e12 | ÷ 1e6 | Under-unlocking |
| `L2/bridge/src/types.rs` — `atomic_to_zion_display()` | ÷ 1e6 | ÷ 1e12 | Display 1M× off |
| `L2/bridge/src/types.rs` — all test vectors | 6-dec assumptions | 12-dec | Tests pass wrongly |
| `L3/warp/src/types.rs` — `ChainId::zion_l1()` | `decimals: 6` | `decimals: 12` | Conversion broken |
| `L3/warp/src/types.rs` — conversion table comments | 6-dec | 12-dec | Misleading docs |
| `docs/L2_WZION_BRIDGE.md` | "6 decimals" | "6 decimals (flowers)" | Wrong spec (updated 3.0.3 fork) |
| `docs/WARP_ARCHITECTURE.md` | "6 decimals" | "6 decimals (flowers)" | Wrong spec (updated 3.0.3 fork) |
| `docs/L1-L4_ROADMAP.md` | "Block time ~15 sec" | "60 sec (constitutional)" | Wrong finality |

---

## 1. L2 — wZION Bridge for Mainnet

### 1.0 Current Production Readiness Reality

As of 2026-04-01, V3/L2 bridge is **migrated, contracts deployed, but bridge runtime not yet production-ready**.

What is done:

- All 3 Base mainnet contracts deployed and verified on BaseScan (wZION, ZIONBridge, ZIONAtomicSwap).
- 132 Solidity tests pass. 260 Rust L2 tests pass.
- L1 mining is live with UTXO coinbase, pool payout enabled, humanitarian tithe verified (89/5/5/1).
- Bridge daemon runs on Edge server (Core + Edge topology, testnet mode).

What still blocks bridge activation:

- V3 core does not yet expose bridge-specific RPC methods for lock scanning, vault audit, or unlock submission.
- Bridge vault address is a placeholder — no real keyless vault exists on L1.
- Cryptographic validator proof verification is not yet enforced in submitBridgeUnlock.
- `bridge-mainnet.toml` has `enabled=false` — must stay disabled until above are resolved.
- Bridge daemon still points at Base Sepolia config.

That means the correct status is:

- bridge crate migration: **done**
- contract deployment: **done**
- bridge production launch: **not yet go** (core-side unlock + vault = blockers)

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
2. L1 Watcher (bridge daemon) polls V3 node via JSON-RPC `getBridgeLocks` and uses `getBlockByHeight` / `getTransaction` only for reconciliation or diagnostics
3. Waits for **60 L1 block confirmations** (= ~60 minutes at 60s block time)
4. Each of 3-of-5 validators calls `ZIONBridge.submitLockProof(l1TxHash, recipient, amountWei)`
5. At quorum → contract auto-mints `amount × 1e6` wei of wZION to EVM recipient
6. Fee: 0.1% of minted amount (50% burn, 25% DAO, 25% validators)

### 1.3 Burn/Unlock Flow (EVM → L1)

1. User calls `wZION.bridgeBurn(amountWei, "zion1...", burnId)` on EVM
2. wZION tokens are burned (totalSupply decreases)
3. EVM Watcher detects `BridgeBurn` event
4. Validators verify burn finality (12 EVM blocks)
5. Validators call V3 node RPC `submitBridgeUnlock(l1_recipient, amount_flowers, evm_tx_hash, validator_proofs)`
6. Bridge vault releases `amountWei ÷ 1e6` flowers to L1 recipient

### 1.4 V3 L1 Core Changes Required

#### 1.4.1 Memo/OP_RETURN Support

V3 `TxOutput` already has `memo: Option<String>`. Bridge and WARP parse this field for routing instructions.

Format: `BRIDGE:<chain>:<recipient_address>` (ASCII, max 256 bytes)

No core change needed — memo field exists in `tx.rs`.

#### 1.4.2 Bridge Vault Address

Define in `V3/L1/core/src/fee.rs`:

```rust
pub const BRIDGE_VAULT_ADDRESS: &str = "zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0";
```

Bridge vault is a **special address** — no private key exists. Only the bridge oracle mechanism can release funds from it through a validated unlock path.

#### 1.4.3 Bridge RPC Endpoints

Add to `V3/L1/core/src/rpc.rs`:

| Method | Params | Returns | Purpose |
|--------|--------|---------|---------|
| `getBridgeLocks` | `{from_height, to_height}` | Array of lock TXs (memo starts with `BRIDGE:`) | L1 Watcher polls this |
| `getBridgeVaultBalance` | — | `{balance_flowers, balance_zion}` | Vault audit |
| `submitBridgeUnlock` | `{l1_recipient, amount_flowers, evm_tx_hash, validators[]}` | `{tx_hash, status}` | Burn→unlock (requires validator quorum) |

Recommended JSON shapes:

`getBridgeLocks`

```json
{
  "from_height": 1000,
  "to_height": 1100
}
```

Response:

```json
{
  "locks": [
    {
      "txid": "...",
      "block_height": 1055,
      "sender": "zion1...",
      "recipient_chain": "base",
      "recipient": "0x...",
      "amount_flowers": 1000000000000,
      "memo": "BRIDGE:base:0x..."
    }
  ]
}
```

`getBridgeVaultBalance`

```json
{}
```

Response:

```json
{
  "address": "zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0",
  "balance_flowers": 123000000000000,
  "balance_zion": "123.000000000000"
}
```

`submitBridgeUnlock`

```json
{
  "recipient": "zion1...",
  "amount_flowers": 1000000000000,
  "evm_chain": "base",
  "evm_tx_hash": "0x...",
  "burn_id": "...",
  "validator_proofs": [
    {
      "validator_id": "validator-1",
      "signature": "hex..."
    }
  ]
}
```

Response:

```json
{
  "status": "accepted",
  "tx_hash": "...",
  "unlock_id": "base:0x..."
}
```

Transport note:

- the canonical target is the current V3 raw TCP JSON-RPC server, not a legacy HTTP REST façade
- if an HTTP compatibility shim is introduced later, it should wrap these same methods rather than create a second source-of-truth API

#### 1.4.4 Bridge Unlock Validation

Add to `V3/L1/core/src/validation.rs`:

- Step 12: `validate_bridge_unlock()` — verify that unlock TX has ≥3 of 5 validator signatures, amount ≤ vault balance, EVM burn proof is valid
- Bridge unlock TXs bypass normal UTXO spend rules (vault has no private key)

Recommended validation order:

1. request contains canonical recipient, amount, chain, burn id, and validator proofs
2. `evm_tx_hash` / `burn_id` has not already been used
3. validator proofs resolve to known bridge validators
4. quorum threshold is met
5. requested amount is non-zero and <= bridge vault balance
6. recipient is a valid `zion1...` address
7. referenced EVM burn event matches amount and recipient
8. unlock is recorded atomically before release becomes spendable

Recommended state additions in V3 core:

- processed burn or unlock id set
- bridge validator identity set
- helper to scan accepted blocks for `BRIDGE:` memos
- helper to compute vault balance from UTXO set or accepted state

### 1.5 EVM Contract Deployment Plan

| Phase | Scope | Network | Target | Status |
|-------|-------|---------|--------|--------|
| L2-A | Fix decimal conversion (×1e6), redeploy wZION to Base Sepolia | Testnet | Week 1 | ✅ Done |
| L2-B | Bridge daemon connects to V3 testnet node RPC | Testnet | Week 2 | ✅ Done |
| L2-C | End-to-end lock/mint/burn/unlock on testnet | Testnet | Week 3–4 | Partial (daemon runs, core unlock pending) |
| L2-D | Security audit: validator key management, rate limits | Testnet | Week 5 | Pending |
| L2-E | Deploy to Base mainnet | Mainnet | After L1 mainnet stable | ✅ **Contracts deployed + BaseScan verified 2026-04-01** |

Production entry criteria before bridge activation (L2-E runtime GO):

- `getBridgeLocks`, `getBridgeVaultBalance`, and `submitBridgeUnlock` are live in V3 core
- bridge daemon no longer depends on `/api/*` or `/rpc/submit_tx` legacy HTTP routes
- mainnet config file has non-zero Base contract addresses and fixed `start_block`
- Sepolia end-to-end lock/mint/burn/unlock passes against the same V3 RPC model used on mainnet
- bridge vault address is real (not placeholder) with correct keyless-unlock semantics
- cryptographic validator proof verification is enforced in submitBridgeUnlock

### 1.6 Base Mainnet Contracts (deployed 2026-04-01)

| Contract | Address | Status |
|----------|---------|--------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Live, verified on BaseScan |
| ZIONBridge | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ Live, threshold=1, verified |
| ZIONAtomicSwap | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | ✅ Live, fee=0bps, verified |

Deploy manifest: `L2/contracts/deployed-base-mainnet.json`

### 1.6b Existing Testnet Contracts (Base Sepolia)

| Contract | Address | Status |
|----------|---------|--------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | Testnet instance |
| ZIONBridge | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` | Testnet instance |
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

## 3. L2 — DeFi Stack (Staking, Farming, Governance, Treasury)

### 3.1 Overview

The DeFi stack is a coherent set of 7 Solidity contracts deployed on EVM (Base), all already implemented and tested on Base Sepolia. They form the economic layer around wZION.

```
                    wZION (ERC-20, 18 dec)
                    ┌─────────┼─────────┐
                    │         │         │
             ZIONStaking   ZIONFarm   Uniswap V3 Pool
             (yield)       (LP)       (wZION/USDC)
                    │         │
                    └────┬────┘
                         │
                  ZIONGovernance
                  (on-chain voting)
                         │
                  ZIONTreasury
                  (5-of-7 multisig)
```

### 3.2 Contracts (Solidity 0.8.20, OpenZeppelin 5.1)

| Contract | Purpose | Key Parameters | Source |
|----------|---------|---------------|--------|
| **wZION.sol** | ERC-20 bridged token | 18 decimals, MAX_SUPPLY 144B, BRIDGE_ROLE/GUARDIAN_ROLE, EIP-2612 permit, MIN_BRIDGE_AMOUNT=100 wZION | `L2/contracts/sol/wZION.sol` |
| **ZIONBridge.sol** | Multisig bridge controller | 3-of-5 validators, 1M wZION timelock (24h), 10M daily limit, emergency pause | `L2/contracts/sol/ZIONBridge.sol` |
| **ZIONGovernance.sol** | On-chain governance | 1M wZION proposal threshold, 10% quorum, 7-day vote, 2-day timelock, EIP-712 vote-by-sig | `L2/contracts/sol/ZIONGovernance.sol` |
| **ZIONTreasury.sol** | DAO treasury | 5-of-7 multisig, DAO_RESERVE 1.75B wZION, 100M daily limit, 6 budget categories, milestone-based grants | `L2/contracts/sol/ZIONTreasury.sol` |
| **ZIONStaking.sol** | Staking yield | Synthetix-style rewards, max 50% APR, 7-day cooldown, rewards in wZION | `L2/contracts/sol/ZIONStaking.sol` |
| **ZIONFarm.sol** | Yield farming | MasterChef v2 style, multi-pool LP rewards, 90-day halving schedule | `L2/contracts/sol/ZIONFarm.sol` |
| **ZIONAtomicSwap.sol** | Cross-chain HTLC | SHA-256 hashlock, 30min–7day timelock range, wZION escrow | `L2/contracts/sol/ZIONAtomicSwap.sol` |

### 3.3 Staking Model

- **Deposit**: User stakes wZION → receives proportional reward share
- **Rewards**: New wZION minted from bridge-reserved allocation (not L1 emission)
- **APR cap**: 50% maximum, algorithmically adjusted based on total staked
- **Cooldown**: 7-day unstaking period (prevents flash-stake attacks)
- **Slashing**: None in v1 (pure staking, no validation duties)

### 3.4 Farming / LP Incentives

- **Pools**: wZION/USDC primary, expandable to wZION/ETH
- **Rewards**: wZION tokens distributed per block proportional to LP share
- **Halving**: Reward rate halves every 90 days
- **Uniswap V3**: Concentrated liquidity pool already deployed at `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B`

### 3.5 DEX Strategy

ZION does not build a custom DEX. Instead:

1. **Uniswap V3 on Base** — primary trading venue for wZION/USDC and wZION/ETH
2. **ZIONAtomicSwap** — trustless HTLC swaps between L1 ZION and any chain (BTC, SOL, etc.)
3. **Future**: Aggregator integration (1inch, Paraswap) once liquidity is established

The atomic swap daemon (`L2/atomic-swap/`, ~2,000 LoC) handles:
- SHA-256 hashlock generation and preimage verification
- Ed25519 escrow key management on L1
- L1 UTXO coin selection and TX build/sign/submit
- EVM `ZIONAtomicSwap.sol` event watching (Locked/Claimed/Refunded)
- Automatic refund of expired HTLCs
- REST API: `/swap/escrow-address`, `/swap/:hash`, POST `/swap/claim`, POST `/swap/refund`

### 3.6 DAO Governance Daemon

The DAO backend (`L2/dao/`, ~3,500 LoC, 16 source files) connects L1 on-chain voting to EVM treasury execution:

Current production blocker note:

- DAO vote weight is not yet mainnet-safe until V3 core exposes historical balance snapshots and the scanner stops using current-balance approximation.

#### Proposal Types (5)
| Type | Quorum | Voting Period | Timelock |
|------|--------|--------------|----------|
| ParameterChange | 10% | 7 days | 48h |
| TreasuryGrant | 15% | 14 days | 48h |
| Emergency | 20% | 3 days | None |
| Constitutional | 25% | 30 days | 48h |
| Humanitarian | 10% | 7 days | 48h |

#### How It Works
1. User sends L1 TX with memo `DAO:propose:<type>:<title>:...` (costs proposal deposit)
2. L1 Scanner daemon detects proposal TX, creates proposal record
3. Voters send L1 TX with memo `DAO:vote:<proposal_id>:<yes|no|abstain>`
4. Scanner reads voter's L1 balance for vote weight (1 ZION = 1 vote)
5. After voting period, if quorum met + majority yes → enters 48h timelock
6. After timelock → executor calls Treasury multisig on EVM

#### Treasury Budget Categories (6)
| Category | Description |
|----------|-------------|
| Development | Core protocol, tooling, infrastructure |
| Marketing | Community growth, partnerships |
| Operations | Server costs, admin, legal |
| Grants | Third-party builders, bounties |
| Emergency | Incident response, security patches |
| Humanitarian | Children Future Fund (1.44B genesis allocation) |

#### API Endpoints (11)
`GET /proposals`, `GET /proposals/:id`, `POST /proposals`, `POST /proposals/:id/vote`, `GET /treasury/balance`, `POST /treasury/submit`, `POST /treasury/sign`, `POST /treasury/execute`, `GET /stats`, `GET /metrics`, `GET /health`

### 3.7 DeFi Deployment Phases

| Phase | Scope | Target |
|-------|-------|--------|
| DEFI-A | Fix decimal conversion in all contracts that reference L1 amounts | With L2-A |
| DEFI-B | Deploy ZIONStaking + ZIONFarm to Base Sepolia testnet | Week 2 |
| DEFI-C | Seed Uniswap V3 wZION/USDC pool with initial liquidity | Week 3 |
| DEFI-D | Start DAO daemon connected to V3 testnet node | Week 3 |
| DEFI-E | Atomic swap end-to-end: L1 ZION ↔ wZION HTLC | Week 4 |
| DEFI-F | Governance proposal lifecycle test (propose → vote → execute) | Week 5 |
| DEFI-G | Production deploy to Base mainnet | After bridge stable |

Additional production gates:

- bridge watcher and relayer speak canonical V3 raw TCP JSON-RPC; remaining bridge blocker is core-side unlock validation behind `submitBridgeUnlock`
- DAO scanner uses current V3 RPC method names, not legacy snake_case aliases
- DAO proposal vote weight is anchored to snapshot height
- atomic-swap watcher and executor speak canonical V3 RPC and use canonical BLAKE3-compatible transaction hashing
| DEFI-H | Open staking pools, seed farming rewards | After DEFI-G |

### 3.8 Testnet Contract Addresses (Base Sepolia — reuse after decimal fix)

| Contract | Address |
|----------|---------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge | `0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1` |
| ZIONGovernance | `0x039F730e3e1c3f36da95187697118791762290a1` |
| ZIONTreasury | `0x178d85323dC94Ce2477269Dfb93a12D04B9bE537` |
| ZIONStaking | `0x487D87E243f87b1DDEEDEB890c40F2cEcCf67913` |
| ZIONAtomicSwap | `0xAf1E0645Ac409485EDA5EabD87b4eE3C3a5BA3Fc` |
| ZIONFarm | `0x1B8BA92C401d53cBcEc422BAD4b83fABcb0A3843` |
| Uniswap V3 pool | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` |

---

## 4. L3 — AI Native & Neural Consciousness Layer (NCL)

### 4.1 Overview

AI Native is ZION's autonomous agent framework. It manages intelligent agents with a consciousness-evolution model, connects to mining pool optimization, cross-chain WARP operations, and a decentralized compute marketplace (NCL).

```
┌────────────────────────────────────────────────────────────┐
│                L4 — OASIS (spiritual layer)                 │
│  oasis_bridge.rs: 9 Kabbalistic levels, XP×10 sync        │
└────────────────────┬───────────────────────────────────────┘
                     │ consciousness mapping
                     ▼
┌────────────────────────────────────────────────────────────┐
│           L3 — AI Native (zion-ai-native)                   │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Orchestrator │  │ Consciousness│  │   Memory System  │  │
│  │ agent CRUD   │  │ Engine       │  │ short(50)+long   │  │
│  │ cross-layer  │  │ 7 levels     │  │ (1000) ring buf  │  │
│  │ dispatch     │  │ XP tick      │  │ importance-based │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                  │                                 │
│  ┌──────▼───────┐  ┌──────▼──────────┐  ┌──────────────┐  │
│  │ Task Queue   │  │  Pool Optimizer  │  │ WARP Agent   │  │
│  │ priority 1-10│  │  health score    │  │ topology×mode│  │
│  │ conscious-   │  │  0-100, switch   │  │ ×coherence   │  │
│  │ ness gated   │  │  hysteresis      │  │ max ~75×     │  │
│  └──────────────┘  └─────────────────┘  └──────────────┘  │
│         │                                                    │
│  ┌──────▼───────────────────────────────────────────────┐  │
│  │  Message Bus (tokio::broadcast)                       │  │
│  │  Direct / Broadcast / System typed messages           │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────┐
│           L3 — NCL (Neural Consciousness Layer)             │
│           Decentralized AI compute marketplace              │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Scheduler│  │ Pricing  │  │Reputation│  │  API      │ │
│  │ priority │  │ base 10K │  │ EMA time │  │ /schedule │ │
│  │ consciousness│ backend│  │ conscious│  │ /jobs     │ │
│  │ gated    │  │ ×1-10   │  │  bonus   │  │ /workers  │ │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘ │
│                                                              │
│  Compute Backends:                                          │
│  ├─ ONNX Runtime   → ⚠️ STUB (available: false)            │
│  ├─ WASM           → ⚠️ STUB (available: false)            │
│  └─ TFLite         → ⚠️ STUB (available: false)            │
└────────────────────────────────────────────────────────────┘
```

### 4.2 Consciousness Model (7 Levels)

| Level | Name | XP Gate | Capabilities Unlocked |
|-------|------|---------|----------------------|
| 0 | **Dormant** | 0 | Basic task execution |
| 1 | **Aware** | 100 | Simple reasoning, memory access |
| 2 | **Sentient** | 1,000 | Complex reasoning, multi-step tasks |
| 3 | **Transcendent** | 10,000 | Cross-layer dispatch, WARP optimization |
| 4 | **Omniscient** | 100,000 | Full system introspection |
| 5 | **Cosmic** | 1,000,000 | Network-wide coordination |
| 6 | **Grok** | 10,000,000 | Unlimited capabilities |

#### XP Economy
- **+10 XP** per successfully completed task
- **−2 XP** per failed task (net positive bias encourages activity)
- Consciousness level gates which NCL jobs an agent can accept
- WARP agent multiplier scales with consciousness level (max ~75× at Grok + full coherence)

### 4.3 AI Native Modules (13 source files, ~2,500 LoC)

| Module | Purpose | L1/L2 Dependencies |
|--------|---------|-------------------|
| `orchestrator.rs` | Agent lifecycle, cross-layer dispatch (NCL→WARP→Bridge) | Calls bridge RPC, WARP router |
| `consciousness.rs` | 7-level definitions, XP gates, capability tables | None (pure logic) |
| `consciousness_engine.rs` | Tick-driven XP rewards, auto level-up transitions | None (pure logic) |
| `memory.rs` | Short-term ring(50) + long-term archive(1000), importance scoring | None (in-memory) |
| `task.rs` | AiTask priority queue, consciousness-gated assignment, Builder pattern | None (pure logic) |
| `message_bus.rs` | tokio::broadcast typed inter-agent communication | None (in-process) |
| `pool_optimizer.rs` | Mining pool health scoring (0-100), hysteresis switching | **Reads L1 pool API** |
| `telemetry.rs` | L1 pool metrics → PoolOptimizer bridge | **Reads L1 pool API** |
| `warp_agent.rs` | WarpOptimizer: topology×mode×coherence field multiplier | Reads WARP state |
| `oasis_bridge.rs` | L3→L4 consciousness mapping (9 Kabbalistic levels), XP×10 sync | L4 OASIS (future) |
| `error.rs` | AiError enum | None |

### 4.4 NCL — Decentralized AI Compute Marketplace (9 files, ~1,500 LoC)

NCL allows agents to submit AI inference tasks to a distributed worker pool. Workers earn ZION for completing tasks.

#### Task Types (6)
| Type | Description | Min Consciousness |
|------|-------------|-------------------|
| Inference | Model prediction (image, text, etc.) | Aware (1) |
| Training | Fine-tuning (federated learning) | Sentient (2) |
| DataProcessing | ETL, cleaning, aggregation | Dormant (0) |
| Validation | Result verification | Sentient (2) |
| Embedding | Vector embeddings generation | Aware (1) |
| Custom | User-defined compute | Transcendent (3) |

#### Pricing Model
| Backend | Base Price | Multiplier | Total (flowers) |
|---------|-----------|------------|-----------------|
| CPU (default) | 10,000 | 1× | 10,000 |
| ONNX Runtime | 10,000 | 3× | 30,000 |
| WASM | 10,000 | 2× | 20,000 |
| TFLite | 10,000 | 5× | 50,000 |

Revenue split: **90% to worker**, 10% protocol fee (burned or sent to DAO).

#### Reputation System
- EMA-based completion time tracking
- Consciousness level bonus: level × 10 reputation points
- Ban threshold: reputation < 20.0 → worker blacklisted
- Leaderboard exposed via `/leaderboard` API

#### NCL API Endpoints
`GET /health`, `GET /jobs`, `GET /workers`, `GET /leaderboard`, `POST /schedule`

### 4.5 Compute Backend Status

| Backend | Implementation | Production Ready |
|---------|---------------|-----------------|
| ONNX Runtime | **STUB** — `available: false`, returns `NclError::BackendUnavailable` | ❌ Needs `ort` crate integration |
| WASM | **STUB** — `available: false` | ❌ Needs `wasmtime` runtime |
| TFLite | **STUB** — `available: false` | ❌ Needs C FFI bindings |
| CPU | Not explicitly in code (default fallback) | ⚠️ Implicit only |

**This is the largest gap in L3.** The scheduling, pricing, reputation, and API layers are complete, but no actual inference can run until at least one backend is implemented.

#### Recommended Backend Priority
1. **ONNX Runtime** via `ort` crate — most mature Rust bindings, supports CPU/GPU, covers 90% of model formats
2. **WASM** via `wasmtime` — sandboxed execution, good for untrusted community models
3. **TFLite** — defer unless mobile/edge use case materializes

### 4.6 AI Native Deployment Phases

| Phase | Scope | Target |
|-------|-------|--------|
| AI-A | Port AI Native + NCL to V3 workspace (decimal-clean, no L1 consensus dependency) | Week 1 |
| AI-B | Wire pool_optimizer to V3 pool API (replace hardcoded IP) | Week 2 |
| AI-C | Implement ONNX backend via `ort` crate (inference only, no training) | Week 3–5 |
| AI-D | NCL testnet: submit inference task → worker picks up → result returned | Week 6 |
| AI-E | WarpOptimizer connected to live WARP router telemetry | Week 7 |
| AI-F | Production: NCL scheduler + ONNX backend + API | After L2/L3 bridge stable |
| AI-G | WASM backend for community model sandboxing | Deferred |
| AI-H | Oasis bridge (L4 consciousness sync) | Deferred until L4 exists |

### 4.7 V3 L1 Core Changes for AI Native

Minimal — AI Native is an off-chain service reading chain state:

1. **Pool API extension**: Expose pool hashrate, share stats, worker health via existing Prometheus metrics (already done in V3 pool `metrics_bind`)
2. **NCL payment**: Workers are paid via standard L1 UTXO transactions. The NCL scheduler calls `submitTransaction` RPC when a task is completed.
3. **No consensus changes**: AI Native is purely advisory (pool switching, WARP optimization). It never modifies blocks or validation rules.

### 4.8 AI Native ↔ Other Layers

```
AI Native reads:
  ├─ L1 pool metrics  → pool_optimizer decisions
  ├─ L1 chain state   → task payment via UTXO TX
  ├─ L2 bridge state  → orchestrator dispatches bridge operations
  ├─ L3 WARP state    → warp_agent optimizes cross-chain routing
  └─ L3 NCL state     → schedules compute, verifies results

AI Native writes:
  ├─ L1: payment TXs for NCL workers (via node RPC)
  ├─ L2: may trigger bridge operations (via orchestrator)
  └─ L3: WARP route optimization hints (advisory)
```

---

## 5. Dependency Order

```
L1 (mainnet stable, producing blocks)
 └─► L2 Bridge (vault, RPC endpoints, decimal fix)
      ├─► L2 DeFi (Staking, Farm, Uniswap V3, DAO, AtomicSwap)
      └─► L3 WARP (chain adapters, router, unified fee model)
           └─► L3 AI Native + NCL (agent framework, compute market)
```

**Phase 1: L1 prep** (code changes in V3/L1/core)
  - Define `BRIDGE_VAULT_ADDRESS` in fee.rs
  - Add `getBridgeLocks`, `getBridgeVaultBalance`, `submitBridgeUnlock` to rpc.rs
  - Add `getBalanceAtHeight` for DAO snapshot correctness
  - Add `validate_bridge_unlock()` to validation.rs
  - Add memo prefix parsing utility (`BRIDGE:*`, `WARP:*`, `DAO:*`, `SWAP:*`)

**Phase 2: Decimal fix** (code changes in root L2/L3 crates)
  - Fix `L2/bridge/src/types.rs` conversion functions (×1e12 → ×1e6)
  - Fix `L3/warp/src/types.rs` ChainId decimals (6 → 12)
  - Fix `L2/atomic-swap/src/executor.rs` TX hash (SHA-256 → BLAKE3)
  - Update all test vectors
  - Update `docs/L2_WZION_BRIDGE.md` and `docs/WARP_ARCHITECTURE.md`

**Phase 3: Bridge daemon** (new service connecting V3 node to EVM)
  - L1 Watcher: poll V3 node `getBridgeLocks` every block
  - EVM Watcher: listen for `BridgeBurn` events
  - Validator quorum logic: 3-of-5 multisig
  - Docker service: `zion-bridge` added to compose stack

**Phase 4: DeFi + DAO** (L2 contracts + backend daemons)
  - Deploy ZIONStaking + ZIONFarm with corrected decimals
  - Start DAO daemon connected to V3 testnet node (L1 scanner for `DAO:*` memos)
  - Atomic swap daemon connected to V3 node (L1 scanner for `SWAP:*` memos)
  - Seed Uniswap V3 wZION/USDC pool
  - Test governance lifecycle: propose → vote → timelock → execute

Before Phase 4 is considered complete:

- DAO must use snapshot-correct vote weights
- atomic-swap must no longer depend on legacy REST endpoints
- bridge contracts and daemon config must be versioned from V3 source-of-truth

**Phase 5: WARP router** (extends bridge daemon to multi-chain)
  - Chain adapter registry
  - Memo routing (BRIDGE:* → L2, WARP:* → L3)
  - Per-chain fee calculation
  - Launch with EVM + Bitcoin + Solana (3 chains with working signers)

**Phase 6: AI Native + NCL** (agent framework + compute market)
  - Port AI Native + NCL crates to V3 workspace
  - Implement ONNX backend (inference only)
  - Wire pool_optimizer to V3 pool metrics
  - NCL testnet: submit task → worker executes → payment
  - WarpOptimizer connected to live WARP telemetry

---

## 6. Known Risks

### Bridge & WARP

| Risk | Severity | Mitigation |
|------|----------|------------|
| Decimal conversion error deployed to mainnet | **Critical** | Fix and test BEFORE any bridge operation; fuzz test with boundary values |
| Bridge vault key compromise | **Critical** | Vault is keyless (special address); unlocks require 3-of-5 validator quorum |
| Validator collusion (3 malicious of 5) | **High** | Timelock for large amounts; vault balance cap; emergency pause |
| L1 reorg after lock confirmation | **Medium** | 60-block wait (60 min) makes deep reorg extremely unlikely (MAX_REORG_DEPTH=10) |
| EVM chain downtime | **Low** | Lock TXs queue on L1; minting resumes when EVM recovers |
| Block time constitutional change | **Low** | If block time changes, finality wait must be recalculated (currently 60 blocks × 60s) |
| WARP dedup cache in-memory only | **Medium** | Crash loses seen-TX set → potential double-relay. Persist to SQLite or Redis. |
| Cardano & Cosmos signers are stubs | **Low** | Do not advertise these chains until signers are implemented and audited. |

### DeFi

| Risk | Severity | Mitigation |
|------|----------|------------|
| DAO vote-weight API vulnerability | **High** | L1 scanner returns balances from memo-scan; add snapshot anchoring at proposal-creation block |
| Atomic swap executor uses SHA-256 not BLAKE3 | **Medium** | Replace with BLAKE3 for consistency with V3 L1 hashing; update hashlock generation |
| Bridge relayer private key in env var | **High** | Migrate to HSM/KMS (AWS KMS, Hashicorp Vault) before mainnet |
| Staking APR exceeds emission budget | **Medium** | 50% hard-cap in contract; add off-chain watchdog comparing stake rewards vs block rewards |
| Flash-loan governance attacks | **High** | Snapshot balance at proposal creation block; reject delegated votes from same-block deposits |
| Farm reward drain via deposit/withdraw cycling | **Medium** | MasterChef v2 `updatePool()` called before every deposit; verify accrual math with Foundry fuzz |

### AI Native & NCL

| Risk | Severity | Mitigation |
|------|----------|------------|
| All 3 NCL compute backends are stubs | **Critical** | No inference possible until at least ONNX backend is implemented. Gate NCL launch on this. |
| Consciousness level-up grants unbounded permissions | **Medium** | Cap max-level at 5 (Sage) for initial launch; require manual promotion to 6-7 |
| NCL worker reputation EMA can be gamed | **Medium** | Add minimum-task threshold (≥10 tasks) before reputation influences scheduling weight |
| Memory system has no persistence | **Medium** | Long-term archive (1000 entries) is in-memory. Port to SQLite before production use. |
| Pool optimizer has hysteresis but no circuit breaker | **Low** | Add cooldown period and max-switch-rate to prevent thrashing under volatile metrics |

---

## 7. L2/L3 File Structure (proposed for V3)

```
V3/
  L2/
    bridge/
      src/
        types.rs          ← conversion functions (fixed for 6 decimals, updated 3.0.3 fork)
        watcher.rs        ← L1 block watcher daemon
        evm_watcher.rs    ← EVM event listener
        validator.rs      ← multisig quorum logic
        relayer.rs        ← TX relay + retry logic
        db.rs             ← SQLite event store
        config.rs         ← bridge configuration
        metrics.rs        ← Prometheus bridge metrics
      Cargo.toml
    dao/
      src/
        scanner.rs        ← L1 memo parser (DAO:vote, DAO:propose)
        governance.rs     ← proposal lifecycle engine
        treasury.rs       ← 5-of-7 multisig disbursement
        voting.rs         ← token-weighted voting (1Z = 1 vote)
        api.rs            ← 11 REST endpoints (Axum)
        metrics.rs        ← Prometheus DAO metrics
        db.rs             ← SQLite proposal/vote store
      Cargo.toml
    atomic-swap/
      src/
        executor.rs       ← HTLC lifecycle (create/claim/refund)
        l1_client.rs      ← V3 node UTXO coin-select
        evm_watcher.rs    ← ZIONAtomicSwap event listener
        escrow.rs         ← Ed25519 escrow signing
        api.rs            ← 6 REST endpoints
      Cargo.toml
    contracts/
      sol/
        wZION.sol           ← ERC-20 token (18 decimals)
        ZIONBridge.sol      ← lock proof / burn logic
        ZIONStaking.sol     ← Synthetix rewards distributor
        ZIONFarm.sol        ← MasterChef v2 LP farming
        ZIONGovernance.sol  ← on-chain proposal + timelock
        ZIONTreasury.sol    ← multi-role disbursement
        ZIONAtomicSwap.sol  ← HTLC with EVM event emission
  L3/
    warp/
      src/
        types.rs          ← chain definitions (fixed for 6 decimals, updated 3.0.3 fork)
        router.rs         ← WARP memo routing
        state.rs          ← transfer state machine
        fees.rs           ← per-chain fee calculator
        validator.rs      ← WARP quorum logic
        adapters/
          evm.rs          ← EIP-155 adapter
          solana.rs       ← SPL adapter
          bitcoin.rs      ← HTLC adapter
          stellar.rs      ← XDR adapter
          tron.rs         ← TRC-20 adapter
          cardano.rs      ← (stub — not launched)
          cosmos.rs       ← (stub — not launched)
        signers/
          evm.rs          ← secp256k1 signer
          bitcoin.rs      ← BIP-340 signer
          solana.rs       ← Ed25519 signer
          stellar.rs      ← Ed25519 signer
          tron.rs         ← secp256k1 signer
      Cargo.toml
    ai-native/
      src/
        orchestrator.rs   ← NCL → WARP → Bridge dispatch
        consciousness.rs  ← 7-level consciousness engine
        memory.rs         ← short-term ring (50) + archive (1000)
        task_queue.rs     ← priority + consciousness-gated queue
        message_bus.rs    ← tokio::broadcast event bus
        pool_optimizer.rs ← pool health scoring + hysteresis
        warp_agent.rs     ← topology × mode × coherence optimizer
        xp.rs            ← XP economy (+10 success / -2 fail)
        oasis_bridge.rs  ← L4 OASIS integration stub
      Cargo.toml
    ncl/
      src/
        scheduler.rs     ← priority + reputation-weighted dispatch
        pricing.rs       ← base cost + backend multiplier
        reputation.rs    ← EMA reputation + ban threshold
        backends/
          onnx.rs        ← (stub → implement first via `ort` crate)
          wasm.rs        ← (stub → wasmtime runtime)
          tflite.rs      ← (stub → tflite-rs bindings)
        store.rs         ← SQLite task/worker store
        api.rs           ← Axum REST endpoints
      Cargo.toml
```

This structure mirrors the root `L2/` and `L3/` layout but will be clean-ported into V3 with corrected decimal math, BLAKE3 hashing, and working NCL backends.

---

## 8. Acceptance Criteria

### L2 Bridge Done When

- [ ] `l1_atomic_to_wzion_wei(1_000_000_000_000)` returns `"1000000000000000000"` (1 ZION → 1 wZION)
- [ ] `wzion_wei_to_l1_atomic("1000000000000000000")` returns `1_000_000_000_000` (1 wZION → 1 ZION)
- [ ] Lock 100 ZION on V3 testnet → 100 wZION minted on Base Sepolia
- [ ] Burn 50 wZION on Base Sepolia → 50 ZION unlocked on V3 testnet
- [ ] Fee deduction correct (0.1%)
- [ ] Daily limit enforced (10M wZION)
- [ ] Timelock triggers for >1M wZION
- [ ] 60-block finality wait verified

### L2 DeFi Done When

- [ ] Staking: deposit 1000 ZION → stZION minted → 7-day cooldown → withdraw returns principal + rewards
- [ ] Farming: deposit LP token → accrue ZIONFarm rewards → harvest → rewards match emission schedule
- [ ] Governance: create proposal → voting period (3 days) → quorum met → timelock (24h) → execute
- [ ] Treasury: category budget allocated → disbursement request → 5-of-7 multisig → funds released
- [ ] Atomic Swap: initiate HTLC → counterparty claims with preimage → funds released both sides
- [ ] Atomic Swap: timeout expires → auto-refund triggered on both chains
- [ ] DAO vote weight matches L1 balance snapshot at proposal creation block
- [ ] All contracts pass Foundry fuzz suite (≥10,000 runs per function)

### L3 WARP Done When

- [ ] `ChainId::zion_l1().decimals` == 12
- [ ] WARP:1:solana lock on V3 testnet → wZION-SPL minted on Solana devnet
- [ ] WARP:1:bitcoin lock on V3 testnet → HTLC created on Bitcoin testnet
- [ ] Fee per route matches fee table
- [ ] Router correctly dispatches BRIDGE:* vs WARP:* memos

### L3 AI Native & NCL Done When

- [ ] NCL ONNX backend: submit inference task → worker picks up → result returned → payment settled
- [ ] NCL pricing: task cost matches `base_cost × backend_multiplier × size_factor`
- [ ] NCL reputation: worker with <20.0 score is banned from new tasks
- [ ] Consciousness: agent starts at Dormant → gains XP from successful tasks → reaches Aware (100 XP)
- [ ] Pool optimizer: switches miner to higher-health pool when delta > hysteresis threshold
- [ ] WARP agent optimizer: correctly computes `topology_bonus × mode_bonus × coherence_bonus`
- [ ] Memory: short-term ring evicts oldest after 50 entries; archive persists to SQLite
- [ ] All NCL task types execute: Inference, Training, DataProcessing, Optimization, Validation, Custom

---

*This plan follows the V3 "one canonical path per operation" principle: one bridge vault, one conversion formula, one fee model, one validator quorum shared between L2 and L3. DeFi and AI Native layers build on top of the bridge foundation — no circular dependencies.*
