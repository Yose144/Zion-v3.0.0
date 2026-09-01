# Zion Multichain Wallet + ZionDex Engine — Master Architecture

**Date:** 2026-08-31
**Status:** Active Design + Implementation
**Vision:** ZION L1 as settlement hub for cross-chain operations. Custodial multichain wallet in L2. On-chain ZionDex with real liquidity. ZIS as identity layer. Zion becomes a multichain platform for other chains.

---

## 1. Architecture Overview

```
                         ┌──────────────────────────┐
                         │     ZIS Identity Layer    │
                         │  (auth.zionterranova.com) │
                         │  - Google OAuth + SIWE    │
                         │  - API keys (zis_...)     │
                         │  - Linked addresses       │
                         │  - Session management     │
                         └───────────┬──────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
             ┌──────────┐    ┌──────────────┐  ┌─────────────┐
             │ Web UI   │    │ Desktop Agent│  │ Mobile App  │
             │ (Next.js)│    │ (Electron)   │  │ (React Nat.)│
             └────┬─────┘    └──────┬───────┘  └──────┬──────┘
                  │                 │                 │
                  └────────────────┼────────────────┘
                                   │
                          ┌────────┴────────┐
                          │  zion-wallet-sdk │
                          │  (TypeScript)    │
                          │  - L1 wallet     │
                          │  - Multichain    │
                          │  - DEX/swap      │
                          │  - Bridge/warp   │
                          └────────┬────────┘
                                   │
                          ┌────────┴────────┐
                          │  L2 Multichain   │
                          │  Wallet Engine   │
                          │  (Rust)          │
                          │                  │
                          │  ┌─────────────┐ │
                          │  │ WalletLedger│ │  (atomic, journaled)
                          │  ├─────────────┤ │
                          │  │ SwapExecutor│ │  (on-chain AMM)
                          │  ├─────────────┤ │
                          │  │ Bridge/WARP │ │  (cross-chain)
                          │  ├─────────────┤ │
                          │  │ DepositWatch│ │  (per-user)
                          │  ├─────────────┤ │
                          │  │ Withdrawal  │ │  (on-chain send)
                          │  └─────────────┘ │
                          └────────┬────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐
     │  ZION L1         │  │  EVM Chains  │  │  Other Chains   │
     │  (Settlement Hub)│  │  (Base, Arb, │  │  (Solana, Tron, │
     │                  │  │   OP, BSC)   │  │   Cosmos, ...)  │
     │  - Native ZION   │  │              │  │                 │
     │  - Bridge locks  │  │ ZIONDex AMM  │  │ WARP adapters   │
     │  - HTLC          │  │ (on-chain)   │  │ (unified)       │
     │  - Liquidity pool│  │              │  │                 │
     └─────────────────┘  └──────────────┘  └─────────────────┘
```

## 2. ZION L1 as Settlement Hub

### Concept
ZION L1 is the canonical settlement layer. All cross-chain operations ultimately settle on L1:

- **Deposits:** User deposits BTC/ETH/SOL → L2 credits internal balance → L1 records the liability
- **Swaps:** User swaps tZION→tUSDT → L2 executes on-chain AMM on Base → L1 records the settlement
- **Withdrawals:** User withdraws USDT → L2 sends from hot wallet → L1 records the discharge
- **Bridge:** User bridges ZION→Base → L1 locks ZION → Base mints wZION → L1 records the bridge

### Settlement Records on L1
Every L2 operation creates a settlement record on ZION L1:
```
SettlementRecord {
    id: Hash,
    operation_type: "deposit" | "swap" | "withdraw" | "bridge",
    user_id: String,          // ZIS user ID
    source_chain: ChainId,
    dest_chain: ChainId,
    asset_in: AssetId,
    asset_out: AssetId,
    amount_in: Amount,
    amount_out: Amount,
    tx_hash_source: Option<Hash>,
    tx_hash_dest: Option<Hash>,
    timestamp: u64,
    operator_signature: Signature,  // L2 operator signs
}
```

These records are submitted as L1 transactions (special memo format) and provide an audit trail on ZION L1.

## 3. Unified Adapter Registry

### Problem
Currently there are TWO adapter registries:
1. `chain/adapter.rs` — wallet adapters (Bitcoin, EVM, ZionL1 only)
2. `warp/adapter/mod.rs` — WARP bridge adapters (13+ chains)

They don't share code. The wallet can't deposit/withdraw on Solana/Tron/Cosmos.

### Solution
Create a **unified adapter registry** that wraps both:

```rust
// src/chain/unified_registry.rs
pub struct UnifiedAdapterRegistry {
    wallet_adapters: HashMap<ChainId, Box<dyn ChainAdapter>>,
    warp_adapters: HashMap<ChainId, Box<dyn warp::adapter::ChainAdapter>>,
}

impl UnifiedAdapterRegistry {
    /// Deposit: use wallet adapter if available, else WARP adapter
    pub async fn watch_deposits(&self, addresses: &[Address]) -> Vec<DepositEvent>;
    
    /// Withdraw: use wallet adapter if available, else WARP adapter
    pub async fn send_withdrawal(&self, asset: &Asset, to: &Address, amount: Amount) -> Hash;
    
    /// Swap: use EVM adapter for on-chain AMM
    pub async fn amm_swap(&self, pair: &str, token_in: &Asset, token_out: &Asset, amount: Amount, recipient: &Address) -> (Hash, Amount);
    
    /// Bridge: use WARP adapter for cross-chain
    pub async fn bridge_transfer(&self, transfer: &Transfer) -> Hash;
}
```

### Chain Support Matrix

| Chain | Wallet Adapter | WARP Adapter | Deposit | Withdraw | Swap | Bridge |
|-------|---------------|-------------|---------|----------|------|--------|
| ZION L1 | ✅ | ✅ | ✅ | ✅ | N/A | ✅ |
| Bitcoin | ✅ | ✅ | ✅ | ✅ | N/A | ✅ |
| Base | ✅ (EVM) | ✅ | ✅ | ✅ | ✅ AMM | ✅ |
| Arbitrum | ✅ (EVM) | ✅ | ✅ | ✅ | ✅ AMM | ✅ |
| Optimism | ✅ (EVM) | ✅ | ✅ | ✅ | ✅ AMM | ✅ |
| BSC | ✅ (EVM) | ✅ | ✅ | ✅ | ✅ AMM | ✅ |
| Solana | ❌ | ✅ | via WARP | via WARP | N/A | ✅ |
| Tron | ❌ | ✅ | via WARP | via WARP | N/A | ✅ |
| Cosmos | ❌ | ✅ | via WARP | via WARP | N/A | ✅ |
| Sui | ❌ | ✅ | via WARP | via WARP | N/A | ✅ |
| Aptos | ❌ | ✅ | via WARP | via WARP | N/A | ✅ |
| Near | ❌ | ✅ | via WARP | via WARP | N/A | ✅ |
| Stellar | ❌ | ✅ | via WARP | via WARP | N/A | ✅ |
| Cardano | ❌ | ✅ | via WARP | via WARP | N/A | ✅ |
| TON | ❌ | ✅ | via WARP | via WARP | N/A | ✅ |
| Lightning | ❌ | ✅ | via WARP | via WARP | N/A | ✅ |

## 4. Wallet Engine Improvements

### 4.1 Atomic Ledger with Journal

Replace the current `WalletLedger` (single balance row) with an **append-only journal**:

```sql
CREATE TABLE ledger_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    asset_key TEXT NOT NULL,
    entry_type TEXT NOT NULL,    -- "credit" | "debit"
    amount TEXT NOT NULL,
    reason TEXT NOT NULL,        -- "deposit" | "swap" | "withdraw" | "bridge" | "adjustment"
    reference_id TEXT,           -- deposit_id, order_id, withdrawal_id
    created_at TEXT NOT NULL,
    block_height INTEGER,        -- L1 settlement block
    signature TEXT               -- operator signature
);

CREATE TABLE ledger_balances (
    user_id TEXT NOT NULL,
    asset_key TEXT NOT NULL,
    balance TEXT NOT NULL,
    last_entry_id TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, asset_key)
);
```

**Atomic debit+send:**
```rust
async fn atomic_debit_and_send(&self, user_id, asset, amount, recipient) -> Result<Hash> {
    let tx = self.db.begin_transaction().await?;
    // 1. Insert debit journal entry
    tx.execute("INSERT INTO ledger_entries ...")?;
    // 2. Update balance
    tx.execute("UPDATE ledger_balances SET balance = balance - ? ...")?;
    // 3. Mark withdrawal as pending
    tx.execute("INSERT INTO withdrawals ... (status='pending')")?;
    tx.commit().await?;
    
    // 4. Now send on-chain (outside DB transaction)
    match adapter.send(recipient, amount).await {
        Ok(hash) => {
            self.db.execute("UPDATE withdrawals SET status='sent', tx_hash=?")?;
            Ok(hash)
        }
        Err(e) => {
            // Credit back
            self.ledger.credit(user_id, asset, amount).await?;
            self.db.execute("UPDATE withdrawals SET status='failed'")?;
            Err(e)
        }
    }
}
```

### 4.2 Proper Keyring Management

```rust
// src/multichain_wallet/keyring.rs
pub struct WalletKeyring {
    master_seed: Zeroizing<[u8; 64]>,  // BIP39 seed
    account_counter: AtomicU32,        // persisted in DB
}

impl WalletKeyring {
    /// Derive EVM address for user: m/44'/60'/{account}'/0/0
    pub fn derive_evm(&self, account_index: u32) -> (Address, PrivateKey);
    
    /// Derive Bitcoin address for user: m/84'/0'/{account}'/0/0
    pub fn derive_bitcoin(&self, account_index: u32) -> (Address, PrivateKey);
    
    /// Derive ZION L1 address for user: m/44'/9999'/{account}'/0/0
    pub fn derive_zion(&self, account_index: u32) -> (Address, PrivateKey);
    
    /// Get or create account index for user
    pub async fn account_index(&self, user_id: &str, db: &Db) -> u32;
}
```

**Startup guard:** Refuse to start if `ZION_WALLET_MNEMONIC` is not set. No ephemeral keys.

### 4.3 Deposit Address Resolution

When user calls `/v1/wallet/derive?chain=base`:
1. ZIS resolves user identity
2. Wallet keyring derives (or loads) per-user EVM address
3. Address stored in `wallet_addresses` table
4. DepositWatcher monitors this address
5. On deposit + confirmations → `ledger.credit(user, asset, amount)`

For ZIS-linked addresses (user's own wallet):
1. User links `0xABC...` via ZIS SIWE flow
2. Linked address stored in ZIS `LinkedAddress` table
3. User can withdraw to linked address without re-verification
4. Optional: watch linked address for deposits too

## 5. On-Chain ZionDex (Smart Contracts)

### 5.1 Contract Architecture (Base + other EVM L2s)

```
ZIONDexFactory
├── createPair(tokenA, tokenB) → ZIONDexPair
├── setProtocolFee(bps)
├── feeTo (ZION treasury)
└── pairs[]

ZIONDexPair (per token pair)
├── swap(amount0Out, amount1Out, to)
├── addLiquidity(amount0, amount1) → LP tokens
├── removeLiquidity(lpAmount) → (amount0, amount1)
├── getReserves() → (reserve0, reserve1)
├── getAmountOut(amountIn, reserveIn, reserveOut) → amountOut
└── sync() — update reserves from balances

ZIONDexRouter
├── swapExactTokensForTokens(tokenIn, tokenOut, amountIn, amountOutMin, recipient, deadline)
├── swapTokensForExactTokens(tokenOut, amountOutMax, tokenIn, recipient, deadline)
├── addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, ...)
├── removeLiquidity(tokenA, tokenB, liquidity, ...)
└── multi-hop swap support

ZIONDexZISGate (optional access control)
├── verifyZISProof(user, userId, deadline, signature)
├── canSwap(user) → bool
├── canProvideLiquidity(user) → bool
└── zisPublicKey (Ed25519)
```

### 5.2 Fee Structure

```
Total swap fee: 0.3% (30 bps)
├── LP fee:       0.25% (25 bps) → LP token holders
└── Protocol fee: 0.05% (5 bps)  → ZION treasury (feeTo)
```

### 5.3 Liquidity Bootstrapping

Initial liquidity provided by:
1. **ZION treasury** — seeds major pairs (tZION/tUSDT, tZION/tWETH)
2. **Community LPs** — anyone can add liquidity via Router
3. **Liquidity mining** — LPs earn ZION rewards (optional, via staking contract)

## 6. zion-wallet-sdk Extension

### 6.1 New Modules

```
APP&WEB/zion-wallet-sdk/src/
├── core/                    # existing L1 wallet
│   ├── address.ts
│   ├── keypair.ts
│   ├── transaction.ts
│   └── crypto.ts
├── multichain/              # NEW
│   ├── wallet-client.ts     # L2 wallet API client
│   ├── deposit.ts           # deposit address + monitoring
│   ├── withdraw.ts          # withdrawal requests
│   ├── swap.ts              # DEX swap (quote + execute)
│   ├── bridge.ts            # cross-chain bridge
│   └── types.ts             # shared types
├── evm/                     # NEW
│   ├── evm-wallet.ts        # EVM wallet (ethers.js wrapper)
│   ├── siwe.ts              # Sign-In with Ethereum
│   └── amm.ts               # on-chain AMM interaction
├── zis/                     # NEW
│   ├── zis-client.ts        # ZIS auth client
│   ├── session.ts           # session management
│   └── linked-addresses.ts  # address linking
└── index.ts                 # unified export
```

### 6.2 Key API

```typescript
// Multichain wallet client
export class MultichainWalletClient {
  constructor(config: { apiUrl: string; zisUrl: string });
  
  // Auth
  async loginWithMnemonic(mnemonic: string): Promise<Session>;
  async loginWithSiwe(privateKey: string): Promise<Session>;
  async loginWithGoogle(idToken: string): Promise<Session>;
  async loginWithApiKey(key: string): Promise<Session>;
  
  // Wallet
  async getBalance(asset?: string): Promise<Balance[]>;
  async getDepositAddress(chain: string): Promise<DepositAddress>;
  async getMyWallet(): Promise<WalletSnapshot>;
  
  // DEX
  async getQuote(from: string, to: string, amount: string): Promise<Quote>;
  async executeSwap(params: SwapParams): Promise<SwapResult>;
  async getOrder(orderId: string): Promise<Order>;
  
  // Bridge
  async bridgeAsset(from: string, to: string, amount: string, recipient: string): Promise<BridgeResult>;
  
  // Withdraw
  async withdraw(asset: string, amount: string, recipient: string): Promise<WithdrawResult>;
  
  // Liquidity (on-chain AMM)
  async addLiquidity(tokenA: string, tokenB: string, amountA: string, amountB: string): Promise<LiquidityResult>;
  async removeLiquidity(tokenA: string, tokenB: string, lpAmount: string): Promise<RemoveLiquidityResult>;
  async getPools(): Promise<PoolInfo[]>;
}
```

## 7. ZIS Deep Integration

### 7.1 ZIS Wallet Routes (new)

```
GET  /api/wallet/me              → full wallet snapshot (balances, addresses, orders)
POST /api/wallet/derive          → derive deposit address for chain
POST /api/wallet/link            → link external address (SIWE/Ed25519)
GET  /api/wallet/balances        → all balances
POST /api/wallet/swap            → execute swap (proxies to L2)
POST /api/wallet/withdraw        → execute withdrawal (proxies to L2)
GET  /api/wallet/orders          → swap order history
GET  /api/wallet/deposits        → deposit history
GET  /api/wallet/withdrawals     → withdrawal history
```

### 7.2 Linked Address → Deposit Address Flow

```
1. User logs in via ZIS (Google/SIWE/Ed25519)
2. ZIS calls L2: POST /v1/wallet/derive { chain: "base" }
3. L2 derives per-user EVM address from wallet keyring
4. L2 returns address to ZIS
5. ZIS stores in LinkedAddress table
6. User sees deposit address in UI
7. User sends tokens to deposit address
8. L2 DepositWatcher detects deposit
9. L2 credits internal balance
10. User sees balance in UI
```

## 8. Implementation Plan (Parallel Tracks)

### Track A: Rust Backend (L2 Engine)
**Files:** `V31/L2/multichain/src/`
- Unified adapter registry (`chain/unified_registry.rs`)
- Atomic journal ledger (`multichain_wallet/journal.rs`)
- Proper keyring with startup guard (`multichain_wallet/keyring.rs`)
- Settlement records on L1 (`multichain_wallet/settlement.rs`)
- Improved SwapExecutor with on-chain AMM
- New API endpoints

### Track B: Smart Contracts (Solidity)
**Files:** `/tmp/contracts/` → deploy on Base
- `ZIONDexFactory.sol` — with protocol fee
- `ZIONDexPair.sol` — Uniswap V2 clone + protocol fee
- `ZIONDexRouter.sol` — swap + LP + multi-hop
- `ZIONDexZISGate.sol` — ZIS proof verification
- Deploy + verify on Basescan
- Add initial liquidity

### Track C: TypeScript SDK
**Files:** `APP&WEB/zion-wallet-sdk/src/`
- `multichain/wallet-client.ts` — L2 API client
- `multichain/swap.ts` — DEX swap
- `multichain/bridge.ts` — cross-chain bridge
- `evm/evm-wallet.ts` — EVM wallet wrapper
- `zis/zis-client.ts` — ZIS auth client
- Update `index.ts` with unified exports
- Tests

### Track D: ZIS Integration
**Files:** `APP&WEB/identity/src/routes/wallet.ts` + `APP&WEB/shared/`
- New wallet routes in ZIS
- Linked address → deposit address flow
- ZIS proxy to L2 wallet API
- Prisma schema updates
- Bitcoin address linking (BIP-322)

## 9. Acceptance Criteria

1. **Unified adapters:** Wallet can deposit/withdraw on Solana, Tron, Cosmos via WARP adapters
2. **Atomic ledger:** Restart between debit and send doesn't leave inconsistent balances
3. **On-chain ZionDex:** Anyone can add liquidity and swap on Base via ZIONDexRouter
4. **SDK:** `npm install zion-wallet-sdk` gives full multichain wallet + DEX + bridge API
5. **ZIS integration:** User logs in via Google, gets deposit address, deposits, swaps, withdraws — all via SDK
6. **Settlement:** Every L2 operation has a settlement record on ZION L1
7. **Build:** `cargo build --release` + `npm run build` both pass
8. **Tests:** `cargo test --release` + `npm test` both pass

---

*This document is the master plan. Track-specific details are in the implementation files.*
