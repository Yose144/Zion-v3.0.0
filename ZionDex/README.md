# ZionDex — Cross-Chain DEX

> **Status:** Active development — Backend + Frontend + Mobile + Desktop complete
> **Created:** 2026-07-11
> **Goal:** First universal cross-chain DEX powered by native L1 bridge on 13 chain families

## Structure

```
ZionDex/
├── router/          # Rust — off-chain path finding + quote + execution
│   ├── src/
│   │   ├── lib.rs
│   │   ├── main.rs          # Server entry point (axum)
│   │   ├── types.rs         # ChainId, TokenId, DexId, SwapPath, etc.
│   │   ├── config.rs        # RouterConfig — chain registry, DEX registry
│   │   ├── router.rs        # Path finding algorithm (6 strategies)
│   │   ├── quote.rs         # Quote engine — price + slippage + fees
│   │   ├── price.rs         # Uniswap V3 price feed (slot0 + QuoterV2)
│   │   ├── executor.rs      # Swap execution (EVM + Solana + bridge)
│   │   ├── api.rs           # HTTP REST + WebSocket server (9 endpoints)
│   │   ├── db.rs            # SQLite swap state tracking
│   │   └── monitor.rs       # WebSocket real-time updates
│   └── tests/
│
├── contracts/       # Solidity — custom AMM (Uniswap V4 pattern)
│   ├── src/
│   │   ├── ZionDexPoolManager.sol   # Singleton pool manager
│   │   ├── ZionDexHooks.sol         # Custom hooks (ZION pair fee discount)
│   │   ├── ZionDexRouter.sol        # User-facing router
│   │   ├── ZDXToken.sol             # Governance token (ERC-20)
│   │   ├── ZionDexStaking.sol       # LP staking for ZDX rewards
│   │   └── interfaces/
│   ├── test/
│   │   └── PoolManager.t.sol        # 7 tests — all passing
│   ├── script/
│   │   └── DeployBase.s.sol         # Base mainnet deploy script
│   └── foundry.toml
│
├── sdk/             # TypeScript — @zion/dex-sdk
│   └── src/
│       ├── index.ts
│       ├── types.ts          # All TypeScript types
│       ├── router.ts         # HTTP client for Router API
│       ├── swap.ts           # Swap manager (quote + execute + monitor)
│       ├── liquidity.ts      # Pool browser + LP management
│       └── ziondex.ts        # Main SDK entry point
│
└── (frontend in APP&WEB/)
    ├── website-v2.9/src/app/dex/           # Next.js /dex page
    │   ├── page.tsx                        # Main swap page
    │   ├── layout.tsx
    │   ├── liquidity/page.tsx              # Add/remove liquidity
    │   └── portfolio/page.tsx              # User portfolio
    ├── website-v2.9/src/components/dex/    # React components
    │   ├── CrossChainSwapWidget.tsx        # Main swap UI
    │   ├── ChainSelector.tsx               # 16-chain dropdown
    │   ├── TokenSelector.tsx               # Chain-specific tokens
    │   ├── SwapPathVisual.tsx              # Multi-step path viz
    │   ├── PriceChart.tsx                  # SVG price chart
    │   ├── TransactionStatus.tsx           # Real-time swap tracker
    │   └── RecentSwaps.tsx                 # Live swap feed
    ├── mobile-app/src/screens/DexScreen.js # React Native swap screen
    └── desktop-agent/src/ui/               # Electron swap tab
```

## Frontend

### Website (Next.js)
```bash
cd APP&WEB/website-v2.9
npm install
# Set env: NEXT_PUBLIC_ZIONDEX_ROUTER_URL=http://localhost:8454
npm run dev
# Visit http://localhost:3000/dex
```

Pages:
- `/dex` — Cross-chain swap widget + price chart + recent swaps
- `/dex/liquidity` — Pool list + add/remove liquidity
- `/dex/portfolio` — LP positions + swap history

### Mobile App (React Native)
```bash
cd APP&WEB/mobile-app
npm install
npx react-native run-android  # or run-ios
# ZionDex tab in bottom navigation
```

### Desktop Agent (Electron)
```bash
cd APP&WEB/desktop-agent
npm install
npm start
# ZionDex tab in left sidebar
```

## Router (Rust)

### Build & Run

```bash
cd ZionDex/router
cargo build --release
./target/release/ziondex-router
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/quote` | Get price quote (no execution) |
| POST | `/swap` | Execute swap |
| GET | `/swaps/:id` | Get swap status |
| GET | `/swaps` | List recent swaps |
| GET | `/health` | Health check |
| GET | `/pools` | List all known pools |
| GET | `/prices/:token` | Get token price across chains |
| WS | `/stream` | WebSocket for real-time updates |

### Configuration

Config is loaded from `ziondex-router.toml` (optional — defaults are built-in).

```toml
bind_address = "0.0.0.0:8454"
db_path = "ziondex-router.db"
bridge_api_url = "http://127.0.0.1:8443"
default_slippage_bps = 150
bridge_fee_bps = 50
quote_expiry_secs = 300
```

### Path Finding

The router finds the best path using 6 strategies:

1. **Same-chain swap** — direct DEX swap if src and dest are on the same chain
2. **Bridge-only** — if tokens are bridge-equivalent (ZION ↔ wZION)
3. **Swap → Bridge → Swap** — general cross-chain (e.g., USDC/Solana → wZION/Base)
4. **Bridge → Swap** — ZION L1 → bridge → wZION → swap to dest token
5. **Swap → Bridge** — swap to ZION → bridge to dest chain
6. **Same-token noop** — if src and dest are identical

Returns top 3 paths sorted by expected output.

### Tests

```bash
cd ZionDex/router
cargo test
# 10 passed; 0 failed
```

## Contracts (Solidity / Foundry)

### Build & Test

```bash
cd ZionDex/contracts
forge build
forge test
# 7 passed; 0 failed
```

### Deploy

```bash
# Set private key
export PRIVATE_KEY=0x...

# Deploy on Base mainnet
forge script script/DeployBase.s.sol --rpc-url https://mainnet.base.org --broadcast --verify
```

### Contracts

| Contract | Purpose |
|----------|---------|
| `ZionDexPoolManager` | Singleton pool manager (Uni V4 pattern) — all pools in one contract |
| `ZionDexHooks` | Custom hooks — 0.15% fee for ZION pairs (vs 0.30% standard) |
| `ZionDexRouter` | User-facing router — swapExactIn, swapExactOut, addLiquidity, removeLiquidity |
| `ZDXToken` | Governance token — 100M max supply, 10M initial, minted as LP rewards |
| `ZionDexStaking` | LP staking — stake LP tokens, earn ZDX rewards |

### Key Features

- **ZION pair fee discount**: 0.15% for wZION/* pairs vs 0.30% standard
- **Concentrated liquidity**: LPs choose price ranges (tick-based)
- **Singleton architecture**: All pools in one contract (gas-efficient)
- **Hook system**: Custom before/after callbacks for swaps and liquidity events
- **Volume-based dynamic fees**: High-volume pools get reduced fees

## SDK (TypeScript)

### Install

```bash
npm install @zion/dex-sdk
```

### Usage

```typescript
import { ZionDex } from '@zion/dex-sdk';

const dex = new ZionDex({
  routerUrl: 'https://dex.zionterranova.com',
});

// Get a quote
const quote = await dex.quote({
  srcChain: 'solana',
  srcToken: 'USDC',
  destChain: 'base',
  destToken: 'wZION',
  amount: '1000',
});

console.log('Path:', quote.path.steps);
console.log('Expected output:', quote.path.expected_output);

// Execute swap
const swap = await dex.swap({
  quoteId: quote.quote_id,
  sender: 'zion1...',
  recipient: '0x...',
  maxSlippageBps: 200,
});

// Wait for completion
const final = await dex.waitForCompletion(swap.swap_id);
console.log('Swap completed:', final.amount_out);

// Or subscribe to real-time updates
dex.subscribe(swap.swap_id, (updated) => {
  console.log('Status:', updated.status);
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ZionDex Frontend                               │
│   Web (Next.js)  ·  Mobile (React Native)  ·  Desktop (Electron)     │
├─────────────────────────────────────────────────────────────────────┤
│                      ZionDex Router (Off-chain)                       │
│    Path finding · Price discovery · Slippage calc · Fee estimation   │
│    Intent-based execution · Solver competition · WebSocket streaming │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│  AMM Layer   │  WARP Bridge │  Liquidity   │  Aggregator Layer      │
│  (per-chain) │  (cross-chain)│  Layer       │  (3rd-party DEXs)     │
├──────────────┼──────────────┼──────────────┼────────────────────────┤
│ ZionDex AMM  │  ZION L1     │  ZION/USDC   │  Uniswap V3/V4 (EVM)  │
│ (custom)     │  vault       │  ZION/ETH    │  Raydium (Solana)     │
│              │  12 adapters │  ZION/BTC    │  SunSwap (Tron)       │
│ Uni V4 hooks │  5/5 quorum  │  ZION/SOL    │  Minswap (Cardano)    │
│ Concentrated │  TSS multisig│  ZION/ADA    │  STON.fi (TON)        │
│ liquidity    │              │  ZION/TON    │  Liquidswap (Aptos)   │
│              │              │  ...         │  Cetus (Sui)          │
│              │              │              │  Ref.Finance (NEAR)   │
│              │              │              │  LI.FI (aggregator)   │
└──────────────┴──────────────┴──────────────┴────────────────────────┘
```

## Implementation Status

| Component | Status | Tests |
|-----------|--------|-------|
| Router crate (Rust) | ✅ Compiles, 14/14 tests | `cargo test` |
| Path finding | ✅ 6 strategies implemented | 3 tests |
| Quote engine | ✅ Working with real pool prices | 3 tests |
| Price feed | ✅ Uniswap V3 slot0 + QuoterV2 | 4 tests |
| API server (axum) | ✅ 8 endpoints + WebSocket | — |
| SQLite DB | ✅ Swap state tracking | 3 tests |
| Executor | ✅ EVM signing + WARP bridge API | 1 test |
| AMM contracts (Solidity) | ✅ Compiles, 7/7 tests | `forge test` |
| PoolManager | ✅ Singleton, concentrated liquidity | 3 tests |
| Hooks | ✅ ZION pair fee discount | 1 test |
| ZDXToken | ✅ ERC-20, 100M max supply | 2 tests |
| Staking | ✅ LP staking for ZDX | 1 test |
| TypeScript SDK | ✅ Types + client + swap manager | — |
| Deploy script | ✅ Base mainnet ready | — |

### Real Price Integration

The router now fetches **real prices** from Uniswap V3 pools via:
- `slot0()` call → sqrtPriceX96 + tick
- `liquidity()` call → pool liquidity for price impact estimation
- `quoteExactInputSingle()` on QuoterV2 → exact output amount

If on-chain fetch fails, falls back to conservative placeholder pricing.

### EVM Swap Execution

The executor supports real EVM swap execution via ethers-rs:
- Builds `exactInputSingle()` calldata for Uniswap V3 SwapRouter
- Signs transactions with LocalWallet
- Submits + waits for confirmation
- Parses receipt for success/failure

Requires `Executor::with_wallet(config, db, wallet)` — wallet loaded from private key.

### WARP Bridge Integration

The executor calls WARP bridge API for cross-chain transfers:
- L1 → EVM: `POST /bridge/lock` (lock ZION, mint wZION)
- EVM → L1: `POST /bridge/burn` (burn wZION, unlock ZION)
- Polls `GET /bridge/transfer/:id` for confirmation (up to 10 min)

## Next Steps

- [x] Integrate real Uniswap V3 QuoterV2 for accurate price quotes
- [x] Implement EVM swap execution with ethers-rs signing
- [x] Integrate WARP bridge API for real cross-chain transfers
- [ ] Add Solana swap execution (Raydium/Orca SDK)
- [ ] Deploy AMM contracts on Base mainnet
- [ ] Build `/dex` frontend page (Next.js)
- [ ] Add intent-based solver competition (Phase 4)
- [ ] External security audit

## License

MIT
