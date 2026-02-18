# 🌀 WARP — Wormhole Architecture for Rainbow Protocol

**ZION TerraNova L3 — Universal Cross-Chain Interoperability**

> *WARP connects ZION to every major blockchain, enabling seamless asset
> teleportation across the multi-chain universe.*

---

## 🏗️ Architecture Overview

```
                    ┌──────────────────────────────────────────────────┐
                    │              🌀 WARP ROUTER                      │
                    │  ┌──────────┬──────────┬──────────┬───────────┐ │
                    │  │ Transfer │ Validator│   Fee    │  State    │ │
                    │  │ Routing  │ Quorum   │  Engine  │  Machine  │ │
                    │  └────┬─────┴────┬─────┴────┬─────┴────┬──────┘ │
                    └───────┼──────────┼──────────┼──────────┼────────┘
                            │          │          │          │
              ┌─────────────┼──────────┼──────────┼──────────┼────────────┐
              │             │    CHAIN ADAPTER LAYER         │            │
              │ ┌───────┐ ┌┴──────┐ ┌┴──────┐ ┌┴───────┐ ┌┴────────┐  │
              │ │  EVM  │ │Solana │ │ Tron  │ │Stellar │ │ Cardano │  │
              │ │       │ │       │ │       │ │        │ │         │  │
              │ │Base   │ │SPL    │ │TRC-20 │ │Soroban │ │Plutus   │  │
              │ │Arb    │ │Anchor │ │TVM    │ │Classic │ │Native   │  │
              │ │BSC    │ │       │ │       │ │Asset   │ │Token    │  │
              │ │Polygon│ │       │ │       │ │        │ │         │  │
              │ └───┬───┘ └───┬───┘ └───┬───┘ └───┬────┘ └────┬────┘  │
              │     │         │         │         │            │        │
              │ ┌───┴───┐ ┌──┴────┐                                    │
              │ │Cosmos │ │Bitcoin│  ← Also available                   │
              │ │IBC    │ │HTLC   │                                    │
              │ └───────┘ └───────┘                                    │
              └────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │   ZION L1 (6 decimals)    │
              │   Bridge Vault Address    │
              │   WARP:1:chain:address    │
              └───────────────────────────┘
```

---

## 🔗 Supported Chains

| Chain     | Family   | Token Standard | Decimals | Finality     | Status      |
|-----------|----------|----------------|----------|--------------|-------------|
| **Base**      | EVM      | ERC-20         | 18       | ~2 min       | 🟡 Skeleton |
| **Arbitrum**  | EVM      | ERC-20         | 18       | ~15 min      | 🟡 Skeleton |
| **BSC**       | EVM      | BEP-20         | 18       | ~15 sec      | 🟡 Skeleton |
| **Polygon**   | EVM      | ERC-20         | 18       | ~5 min       | 🟡 Skeleton |
| **Solana**    | Solana   | SPL Token      | 9        | ~12 sec      | 🟡 Skeleton |
| **Tron**      | Tron     | TRC-20         | 18       | ~57 sec      | 🟡 Skeleton |
| **Stellar**   | Stellar  | Stellar Asset  | 7        | ~5 sec       | 🟡 Skeleton |
| **Cardano**   | Cardano  | Native Token   | 6        | ~7 min       | 🟡 Skeleton |
| **Cosmos**    | Cosmos   | IBC / CW20     | 6        | ~6 sec       | 🟡 Skeleton |
| **Bitcoin**   | Bitcoin  | HTLC           | 8        | ~60 min      | 🟡 Skeleton |

---

## 🔄 Transfer Flow

### Outbound: ZION L1 → External Chain

```
1. User sends ZION to L1 vault with memo:
   WARP:1:solana:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU

2. L1 Watcher detects lock TX → creates DepositProof

3. Router:
   a. Validates chains, address, amount
   b. Converts decimals (L1 6 dec → Solana 9 dec: ×10³)
   c. Calculates fee (0.15%)
   d. Creates WarpMessage

4. Validators sign WarpMessage (3-of-5 quorum)

5. Destination adapter executes mint:
   - EVM: bridgeMint() on wZION contract
   - Solana: SPL token mint via Anchor program
   - Tron: TRC-20 mint via TriggerSmartContract
   - Stellar: Payment from issuer / Soroban mint
   - Cardano: Native token mint via Plutus script
   - Cosmos: IBC transfer / CW20 mint

6. Transfer marked as Completed ✅
```

### Inbound: External Chain → ZION L1

```
1. User burns wZION on external chain
   (calls bridgeBurn / SPL burn / etc.)

2. Chain Watcher detects burn event → creates DepositProof

3. Router validates + creates WarpMessage

4. Validators reach quorum (3-of-5)

5. ZION L1 releases locked ZION to recipient

6. Transfer marked as Completed ✅
```

---

## 💰 Fee Model

| Route            | Fee   | Min Fee   | Max Fee     |
|------------------|-------|-----------|-------------|
| ZION ↔ EVM       | 0.1%  | 0.1 ZION  | 10,000 ZION |
| ZION ↔ Solana    | 0.15% | 0.1 ZION  | 15,000 ZION |
| ZION ↔ Tron      | 0.1%  | 0.1 ZION  | 10,000 ZION |
| ZION ↔ Stellar   | 0.1%  | 0.1 ZION  | 10,000 ZION |
| ZION ↔ Cardano   | 0.2%  | 0.2 ZION  | 20,000 ZION |
| ZION ↔ Cosmos    | 0.15% | 0.1 ZION  | 15,000 ZION |
| ZION ↔ Bitcoin   | 0.25% | 0.5 ZION  | 25,000 ZION |

### Fee Distribution
- 🔥 **50% BURN** — permanent deflation
- 🏛️ **25% DAO Treasury** — governance fund
- 💰 **25% Validators** — incentive for bridge operators

---

## 🔒 Security Model

### 1. Validator Multisig (3-of-5)
Every cross-chain operation requires 3 of 5 validators to sign.
Validators run independent nodes and verify proofs independently.

### 2. Source Chain Finality
Each chain has specific finality requirements:
- Bitcoin: 6 blocks (~60 min)
- ZION L1: 60 blocks (~15 min)
- EVM: 12-20 blocks (varies)
- Solana: 31 confirmations (~12 sec)
- Stellar/Cosmos: 1 block (instant BFT finality)

### 3. Timelock for Large Amounts
Transfers >1M ZION get a 24-hour delay, allowing guardians to review.

### 4. Daily Limits
10M ZION maximum throughput per chain per day.

### 5. Replay Protection
Each transfer has a unique UUID + source TX hash.
Processed transfers tracked in both DB and on-chain mappings.

### 6. Emergency Pause
Guardian role can pause any chain adapter independently.

---

## 🔢 Decimal Conversion Table

ZION L1 uses **6 decimals** (1 ZION = 1,000,000 atomic units).

| Destination | Decimals | Multiplier | 1 ZION =              |
|-------------|----------|------------|-----------------------|
| EVM         | 18       | × 10¹²    | 1,000,000,000,000,000,000 wei |
| Solana      | 9        | × 10³     | 1,000,000,000 lamports |
| Tron        | 18       | × 10¹²    | 1,000,000,000,000,000,000 sun |
| Stellar     | 7        | × 10¹     | 10,000,000 stroops    |
| Cardano     | 6        | × 1       | 1,000,000 lovelace    |
| Cosmos      | 6        | × 1       | 1,000,000 uatom-equiv |
| Bitcoin     | 8        | × 10²     | 100,000,000 satoshis  |

---

## 📁 Crate Structure

```
warp/
├── Cargo.toml                  # Dependencies: tokio, ethers, bs58, ed25519-dalek, etc.
└── src/
    ├── lib.rs                  # Module exports + architecture diagram
    ├── main.rs                 # WARP node entry point
    ├── error.rs                # WarpError enum (chain, transfer, validation errors)
    ├── types.rs                # ChainId, Asset, WarpTransfer, WarpStatus, conversion
    ├── protocol.rs             # WarpMessage, DepositProof, MintInstruction, memo format
    ├── registry.rs             # ChainRegistry: register, lookup, enable/disable chains
    ├── router.rs               # WarpRouter: orchestrate transfers end-to-end
    ├── state.rs                # TransferStateMachine: lifecycle + valid transitions
    ├── fees.rs                 # FeeEngine: per-route fees, distribution (burn/DAO/validators)
    ├── validator.rs            # WarpValidatorSet + ConsensusTracker
    ├── config.rs               # WarpConfig: load from TOML
    ├── metrics.rs              # Atomic counters + MetricsSnapshot
    └── adapter/
        ├── mod.rs              # ChainAdapter trait + create_adapter factory
        ├── evm.rs              # EVM adapter (Base, Arbitrum, BSC, Polygon)
        ├── solana.rs           # Solana adapter (SPL Token, Anchor)
        ├── tron.rs             # Tron adapter (TRC-20, TVM)
        ├── stellar.rs          # Stellar adapter (Stellar Asset, Soroban)
        ├── cardano.rs          # Cardano adapter (Native Token, Plutus)
        ├── cosmos.rs           # Cosmos adapter (IBC, CW20)
        └── bitcoin.rs          # Bitcoin adapter (HTLC atomic swaps)
```

---

## 🆚 WARP vs L2 Bridge

| Aspect          | L2 Bridge (`bridge/`)    | L3 WARP (`warp/`)              |
|-----------------|--------------------------|----------------------------------|
| Scope           | EVM chains only          | All chain families               |
| Protocol        | Lock/Mint/Burn           | Universal + HTLC                 |
| Memo Format     | `BRIDGE:chain:addr`      | `WARP:1:chain:addr`             |
| Adapter         | Fixed EVM                | Pluggable per-chain              |
| Fees            | 0.1% flat                | Per-route (0.1%–0.25%)          |
| State Machine   | Simple (6 states)        | Full lifecycle (9 states)        |
| Router          | Direct relay             | Multi-chain orchestrator         |
| Cross-Chain     | ❌ Only L1↔EVM           | ✅ Any↔Any via L1 hub           |

The L2 Bridge remains operational for fast EVM bridging.
WARP extends it to the full multi-chain universe.

---

## 📅 Implementation Roadmap

| Phase | Scope | Target |
|-------|-------|--------|
| **Phase 1** ✅ | L2 wZION Bridge (EVM) | Done (Sprint 3.4) |
| **Phase 2** 🟡 | WARP Skeleton (all adapters) | Done (Sprint 3.4.15-3.4.20) |
| **Phase 3** ⬜ | Solana SPL + Anchor program | 2026 Q3 |
| **Phase 4** ⬜ | Tron TRC-20 + bridge | 2026 Q3 |
| **Phase 5** ⬜ | Stellar asset + Soroban | 2026 Q4 |
| **Phase 6** ⬜ | Cardano native token + Plutus | 2026 Q4 |
| **Phase 7** ⬜ | Cosmos IBC integration | 2027 Q1 |
| **Phase 8** ⬜ | Bitcoin HTLC atomic swaps | 2027 Q1 |
| **Phase 9** ⬜ | Full E2E testing + audit | 2027 Q2 |
| **Phase 10** ⬜ | MainNet launch | 2027 Q3 |

---

## 🧪 Testing Strategy

```
Unit Tests (per module):
  cargo test -p zion-warp

Integration Tests (per chain):
  cargo test -p zion-warp --test solana_integration
  cargo test -p zion-warp --test tron_integration

E2E Test (full flow):
  ZION L1 → lock → WARP → mint on Solana Devnet → burn → WARP → unlock on L1
```

---

*Built with 🌀 for the ZION multi-chain universe.*
*Peace and One Love.* ☮️❤️
