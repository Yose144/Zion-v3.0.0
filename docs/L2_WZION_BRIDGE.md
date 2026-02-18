# 🌉 ZION L2 wZION Bridge — Architecture & Design

**Verze: 0.1.0 | Datum: 16. února 2026**  
**Status: 🏗️ PŘÍPRAVA (Sprint 3.4.5-3.4.6)**  
**Cíl: Wrapped ZION (wZION) na EVM chains → DEX likvidita → price discovery**

---

## 📐 Architektura

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZION BRIDGE ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ZION L1 (Native)              Bridge Relay (Rust)              │
│  ┌────────────────┐           ┌──────────────────┐              │
│  │ User wallet    │           │ L1 Watcher       │              │
│  │                │  lock TX  │ (polls /health,  │              │
│  │ Sends ZION to  │─────────▶│  /api/block/...)  │              │
│  │ bridge vault   │           │                  │              │
│  │ + memo:        │           │ EVM Watcher      │              │
│  │ BRIDGE:base:   │           │ (BridgeBurn      │              │
│  │ 0xRecipient    │           │  events)         │              │
│  └────────────────┘           └────────┬─────────┘              │
│                                        │                         │
│                                        ▼                         │
│  EVM Chain (Base/Arb/BSC)     ┌──────────────────┐              │
│  ┌────────────────┐           │ Relayer          │              │
│  │ wZION.sol      │◀──mint────│ submitLockProof()│              │
│  │ (ERC-20)       │           │                  │              │
│  │                │──burn────▶│ confirmBurn      │              │
│  │ ZIONBridge.sol │           │ Release()        │              │
│  │ (Multisig)     │           └──────────────────┘              │
│  └────────┬───────┘                                              │
│           │                                                      │
│           ▼                                                      │
│  ┌────────────────┐                                              │
│  │ Uniswap v3     │  wZION / ETH                                │
│  │ Liquidity Pool │  Price Discovery                             │
│  └────────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Komponenty

### 1. `contracts/wZION.sol` — Wrapped ZION ERC-20

| Vlastnost | Hodnota |
|-----------|---------|
| Name | Wrapped ZION |
| Symbol | wZION |
| Decimals | 18 |
| Max Supply | 144,000,000,000 (matches L1) |
| Mint/Burn | Only BRIDGE_ROLE |
| Pause | GUARDIAN_ROLE |
| Permit | EIP-2612 (gasless approvals) |

**Klíčové funkce:**
- `bridgeMint(recipient, amount, l1TxHash)` — mint wZION po potvrzení L1 locku
- `bridgeBurn(amount, l1Recipient, burnId)` — burn wZION → trigger L1 unlock
- `emergencyPause(reason)` — zastavit bridge v nouzovém stavu
- `bridgeStats()` — minted/burned/outstanding/supply

**Bezpečnost:**
- Replay protection: `processedL1Locks[l1TxHash]`, `processedBurnRequests[burnId]`
- Min amount: 100 wZION (anti-dust)
- Max supply cap: 144B wZION
- L1 address validation: prefix `zion1`, length 40-62 chars

### 2. `contracts/ZIONBridge.sol` — Bridge Controller (Multisig)

| Vlastnost | Hodnota |
|-----------|---------|
| Consensus | N-of-M multisig (default 3-of-5) |
| Timelock | 24h for amounts > 1M wZION |
| Daily Limit | 10M wZION/den |
| L1 Finality | 60 blocks (~1 hodina) |

**Flow L1→EVM (Lock → Mint):**
1. User pošle ZION na `zion1bridge...vault` s memo `BRIDGE:base:0xRecipient`
2. L1 Watcher detekuje TX, čeká 60 bloků (finality)
3. Každý validátor volá `submitLockProof(l1TxHash, recipient, amount, ...)`
4. Při dosažení threshold (3/5) → auto-mint wZION

**Flow EVM→L1 (Burn → Unlock):**
1. User volá `wZION.bridgeBurn(amount, "zion1q...", burnId)`
2. wZION je spáleno, emituje `BridgeBurn` event
3. EVM Watcher detekuje event
4. Validátoři potvrdí L1 unlock → ZION uvolněno z vault

### 3. `bridge/` — Rust Bridge Relay Crate

```
bridge/
├── Cargo.toml            # Dependencies (tokio, ethers, reqwest, rusqlite)
├── src/
│   ├── main.rs           # Entry point (tokio runtime)
│   ├── lib.rs            # Module exports
│   ├── config.rs         # Bridge configuration (TOML)
│   ├── types.rs          # Shared types + decimal conversion
│   ├── l1_watcher.rs     # Polls ZION L1 RPC for lock TXs
│   ├── evm_watcher.rs    # Subscribes to BridgeBurn events
│   ├── relayer.rs        # Submits cross-chain proofs
│   ├── validator.rs      # Multisig consensus tracker
│   ├── db.rs             # SQLite persistence
│   └── metrics.rs        # Monitoring counters
```

**Decimal konverze:**
- ZION L1: 6 decimals (1 ZION = 1,000,000 atomic)
- wZION EVM: 18 decimals (1 wZION = 1e18 wei)
- Konverze: × 1e12 (lock→mint), ÷ 1e12 (burn→unlock)

### 4. L1 Core Integration

**`core/src/blockchain/burn.rs`** — nová konstanta:
```rust
pub const BRIDGE_ADDRESS: &str = "zion1bridge000000000000000000000000000vault";
pub fn is_bridge_address(address: &str) -> bool { ... }
pub fn is_special_address(address: &str) -> bool { ... }
```

### 5. Konfigurace

**`config/bridge-testnet.toml`** — kompletní bridge relay config:
- L1 RPC (Helsinki + Germany backup)
- EVM chains (Base Sepolia, Arbitrum Sepolia, BSC Testnet)
- Validator threshold (3/5)
- Security limits (daily 10M, single 5M, min 100 wZION)
- SQLite persistence

---

## 🔒 Bezpečnostní Model

### Multisig (3-of-5)

```
Validator 1 (EU-1)  ──┐
Validator 2 (EU-2)  ──┤
Validator 3 (US-1)  ──┼──▶ 3/5 consensus required
Validator 4 (AS-1)  ──┤
Validator 5 (AS-2)  ──┘
```

### Ochranné mechanismy

| Mechanismus | Popis |
|-------------|-------|
| **Multisig** | 3-of-5 validátorů musí potvrdit každou operaci |
| **Finality** | L1: 60 bloků (~1h), EVM: 12-15 bloků |
| **Timelock** | Převody > 1M wZION mají 24h delay |
| **Daily limit** | Max 10M wZION/den |
| **Min amount** | 100 wZION (anti-dust) |
| **Replay protection** | L1 TX hash + burn ID unikátnost |
| **Emergency pause** | Guardian může okamžitě zastavit |
| **Auto-pause** | Při anomálii (např. L1 offline) |
| **Supply invariant** | `locked_L1 ≥ total_wZION_supply` vždy |

### Co se NIKDY nesmí stát

❌ Víc wZION v oběhu než ZION locked na L1  
❌ Mint bez L1 lock potvrzení  
❌ Unlock bez burn potvrzení na EVM  
❌ Single-point-of-failure (1 validátor nemůže nic sám)  
❌ Bridge operace během pause  

---

## 🎯 Deployment Plan

### Fáze A: TestNet (Aktuální)
1. ✅ Kontrakty napsány (wZION.sol + ZIONBridge.sol)
2. ✅ Bridge relay crate (Rust) napsán — 71 Rust testů ✅
3. ✅ L1 bridge address přidán do core
4. ✅ Hardhat testy pro kontrakty — 61 testů (wZION: 31, ZIONBridge: 43 cases) ✅
5. ⬜ Deploy na Base Sepolia (potřeba: .env s DEPLOYER_PRIVATE_KEY + Alchemy klíče)
6. ⬜ End-to-end test (lock → mint → burn → unlock) — blokováno bodem 5

### Fáze B: Audit
1. ⬜ Solidity audit (Trail of Bits / OtterSec)
2. ⬜ Rust bridge relay review
3. ⬜ Fix critical/high findings

### Fáze C: MainNet Deploy (Post-MainNet Launch)
1. ⬜ Deploy wZION + ZIONBridge na Base mainnet
2. ⬜ 5 validátorů v 3+ regionech
3. ⬜ Uniswap v3 pool: wZION/ETH
4. ⬜ Počáteční likvidita (kontrolovaná)
5. ⬜ Price discovery

---

## 💰 Bridge Fee Model

| Typ | Fee |
|-----|-----|
| Lock (L1→EVM) | 0.1% (pálen na L1 burn address) |
| Unlock (EVM→L1) | 0.1% (pálen na L1) |
| EVM gas | Uživatel platí EVM gas za burn TX |
| Validátor gas | Bridge operátor platí EVM gas za submitLockProof |

---

## 📊 Cílové EVM Chains

| Priorita | Chain | DEX | Chain ID | Status |
|----------|-------|-----|----------|--------|
| 🥇 | Base | Uniswap v3 | 8453 | 🏗️ Příprava |
| 🥈 | Arbitrum | Uniswap v3 | 42161 | 📋 Plán |
| 🥉 | BNB Chain | PancakeSwap | 56 | 📋 Plán |
| 4 | Polygon | QuickSwap | 137 | 📋 Plán |
| ❌ | ETH mainnet | Uniswap | 1 | Až po volume |
| ❌ | Solana | Jupiter | — | Jiný stack |

---

## 📁 Souborová Struktura

```
Zion-2.9.5/
├── contracts/                    # 📜 Solidity smart contracts
│   ├── wZION.sol                 # ERC-20 wrapped ZION
│   ├── ZIONBridge.sol            # Bridge controller (multisig)
│   ├── package.json              # Hardhat project
│   ├── hardhat.config.ts         # Network config
│   └── scripts/
│       └── deploy.ts             # Deployment script
│
├── bridge/                       # 🦀 Rust bridge relay crate
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs               # Entry point
│       ├── lib.rs                # Module exports
│       ├── config.rs             # Configuration
│       ├── types.rs              # Shared types + conversion
│       ├── l1_watcher.rs         # L1 chain watcher
│       ├── evm_watcher.rs        # EVM event listener
│       ├── relayer.rs            # Cross-chain proof submitter
│       ├── validator.rs          # Multisig consensus
│       ├── db.rs                 # SQLite persistence
│       └── metrics.rs            # Monitoring
│
├── config/
│   └── bridge-testnet.toml       # Bridge relay config
│
├── core/src/blockchain/
│   └── burn.rs                   # + BRIDGE_ADDRESS constant
│
└── docs/
    └── L2_WZION_BRIDGE.md        # This document
```

---

*Tento dokument je živý — aktualizuje se s postupem implementace.*  
*Poslední aktualizace: 16. únor 2026*
