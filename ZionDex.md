# ZionDex — Cross-Chain DEX Implementation Plan

> **Status:** Active development plan
> **Created:** 2026-07-10
> **Supersedes:** `docs/3.0.3/ZionDex.md` (concept/vision document)
> **Goal:** First universal cross-chain DEX powered by native L1 bridge on 13 chain families

---

## 1. Executive Summary

**ZionDex** is the DEX layer of the ZION ecosystem. Combined with **WARP** (bridge layer), it enables cross-chain swaps between any token on any chain — using ZION as the native settlement asset.

### The Problem

Today, swapping USDC (Solana) → ETH (Base) requires:
1. Swap USDC → SOL on Raydium
2. Bridge SOL Solana → Ethereum (Wormhole/Portal)
3. Swap ETH → USDC on Uniswap
4. **3 transactions, 3x fees, 3x waiting, 3x risk**

### The Solution

With ZionDex + WARP:
1. **One transaction** — ZionDex Router finds the best path
2. WARP bridges ZION natively between chains (no wrapped synthetic)
3. AMM swaps locally on each chain
4. **Result: cross-chain swap in one TX**

**Nobody else does this.** THORChain does cross-chain swaps but only for 5-6 assets. Wormhole bridges but doesn't swap. LI.FI aggregates but doesn't transfer native L1 assets.

---

## 2. Current Infrastructure (As-Built)

### 2.1 Bridge (WARP) — LIVE

| Component | Status | Details |
|-----------|--------|---------|
| WARP adapters | ✅ 12/15 live | Base, Arbitrum, BSC, Polygon, Optimism, Avalanche, Solana, Tron, Stellar, Bitcoin, Cosmos (skeleton), Cardano (skeleton) |
| WARP tests | ✅ 499 passing | BCS, CBOR, TL-B/BOC serializers |
| Bridge validators | ✅ 5/5 threshold | TSS-based multisig |
| Bridge vault | ✅ ~100M ZION | Locked on L1, backs wZION on EVM |
| EVM wZION | ✅ 6 chains | Same address on all: `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| Reverse bridge | ✅ E2E verified | burn wZION → unlock ZION on L1 |

### 2.2 Smart Contracts (Deployed on Base Mainnet)

| Contract | Address | Status |
|----------|---------|--------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Verified, 6 chains |
| ZIONBridge (Base) | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | ✅ Verified, 5/5 validators |
| ZIONBridge (non-Base) | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | ✅ Deployed on Arb/BSC/Poly/Opt/Avax |
| ZIONAtomicSwap | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | ✅ Verified, HTLC escrow |
| ZIONGovernance | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` | ✅ Verified, 5 guardians |
| ZIONTreasury | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` | ✅ Verified, 3-of-3 multisig |
| ZIONStaking | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | ✅ Verified, 12% APR, 100K wZION |
| ZIONFarm | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` | ✅ Verified, 1 wZION/s, 500K wZION |
| Uniswap V4 Pool | `0xcCEaD51568E8d701f7db7e6699F3986031F07C7B` | ✅ Live, wZION/USDT + wZION/WETH |

### 2.3 Swap Infrastructure

| Component | Path | Status |
|-----------|------|--------|
| Atomic Swap daemon | `V3/L2/atomic-swap/` | ✅ Live, HTLC LOCK/CLAIM E2E passed |
| **ZionDex Router** | `ZionDex/router/` | ✅ **Built** — 14/14 Rust tests, real Uni V3 prices, EVM signing, **L3 WARP API integration** (port 8453) |
| **ZionDex AMM Contracts** | `ZionDex/contracts/` | ✅ **Built** — 7/7 Foundry tests, PoolManager + Hooks + Router + ZDX + Staking |
| **TypeScript SDK** | `ZionDex/sdk/` | ✅ **Built** — `@zion/dex-sdk`, full type defs, swap + liquidity managers |
| Swap Aggregator (legacy) | `V3/L2/swap-aggregator/` | ⚠️ Skeleton — superseded by ZionDex Router |
| LI.FI Widget | `APP&WEB/website-v2.9/src/app/defi/page.tsx` | ✅ Live, aggregates 30+ DEX + 20+ bridges |
| Atomic Swap UI | `APP&WEB/website-v2.9/src/app/swap/page.tsx` | ✅ Live, HTLC initiation/claim/refund |
| Bridge UI | `APP&WEB/website-v2.9/src/app/bridge/page.tsx` | ✅ Live, burn wZION → unlock ZION |

> **Implementation Status (2026-07-11):** ZionDex backend is **functionally complete** — Router (Rust, 14 tests), AMM contracts (Solidity, 7 tests), and TypeScript SDK all built and passing. Remaining: deploy contracts on Base, build `/dex` frontend page, Solana swap execution, security audit. See `ZionDex/README.md` for full details.

### 2.4 Token Model

| Token | Chain | Decimals | Supply | Backing |
|-------|-------|----------|--------|---------|
| ZION (native) | L1 blockchain | 6 (flowers) | 144B max, 16.78B circulating | PoW mining |
| wZION (ERC-20) | EVM (6 chains) | 18 | ~100M minted | 1:1 backed by L1 bridge vault |
| ZION (non-EVM) | Solana/Tron/Stellar/etc | varies | via WARP adapters | 1:1 backed by L1 bridge vault |

**Decimal conversion:** L1 (6 decimals) ↔ EVM (18 decimals) = factor 1e12

### 2.5 Liquidity Allocation (Pre-mine)

| Slot | Purpose | Amount |
|------|---------|--------|
| Slot 13 | Bridge Seed Fund (EVM liquidity) | 400,000,000 ZION |
| Slot 14 | Bridge Vault UTXO Seed | 100,000,000 ZION |
| Atomic Swap escrow | Funded | 100,000 ZION |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ZionDex Frontend                               │
│   Web (Next.js)  ·  Mobile (React Native)  ·  Desktop (Electron)     │
├─────────────────────────────────────────────────────────────────────┤
│                      ZionDex Router (Off-chain)                       │
│    Path finding · Price discovery · Slippage calc · Fee estimation   │
│    Intent-based execution · Solver competition · WebSocket streaming │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│  AMM Layer   │  L3 WARP     │  Liquidity   │  Aggregator Layer      │
│  (per-chain) │  Bridge      │  Layer       │  (3rd-party DEXs)     │
├──────────────┼──────────────┼──────────────┼────────────────────────┤
│ ZionDex AMM  │  WARP Router │  ZION/USDC   │  Uniswap V3 (EVM)     │
│ (custom)     │  (port 8453) │  ZION/ETH    │  Raydium (Solana)     │
│              │              │  ZION/SOL    │  SunSwap (Tron)       │
│ Uni V4 hooks │  13 chain    │  ZION/ADA    │  Minswap (Cardano)    │
│ Concentrated │  families   │  ZION/TON    │  STON.fi (TON)        │
│ liquidity    │  5/5 quorum  │  ...         │  Liquidswap (Aptos)   │
│              │  Ed25519 TSS │              │  Cetus (Sui)          │
│              │              │              │  Ref.Finance (NEAR)   │
│              │              │              │  Jupiter (Solana agg) │
└──────────────┴──────────────┴──────────────┴────────────────────────┘
```

### L3 WARP Integration

ZionDex Router se napojuje na **L3 WARP server** (`V3/L3/warp/`, port 8453) pro cross-chain přenosy:

| WARP Endpoint | ZionDex Usage |
|---------------|---------------|
| `POST /transfers/outbound` | L1 → external chain (lock ZION, mint wrapped) |
| `POST /transfers/inbound` | External chain → L1 (burn wrapped, unlock ZION) |
| `GET /transfers/:id` | Poll transfer status until "completed" |
| `GET /chains` | List enabled chains (13 chain families) |
| `GET /health` | WARP server liveness check |

**WARP status flow:** `Detected → AwaitingFinality → Validating → QuorumReached → Executing → Completed`

**Memo format:** `WARP:1:<dest_chain>:<recipient_address>`

**Decimal conversion:** ZION L1 (6 decimals, "flowers") ↔ EVM (18 decimals, wei) — factor 1e12

### 3.1 Cross-Chain Swap Flow

**Example: User swaps USDC (Solana) → wZION (Base)**

```
User submits swap intent
        │
        ▼
┌─ ZionDex Router ──────────────────────────────────┐
│  1. Quote: USDC/Solana → ZION/Solana (Raydium)    │
│  2. Quote: ZION/Solana → wZION/Base (WARP bridge) │
│  3. Calculate: total cost, slippage, fees         │
│  4. Select: best path                             │
└───────────────────────────────────────────────────┘
        │
        ▼
┌─ Execution (atomic or intent-based) ──────────────┐
│  Step 1: Swap USDC → ZION on Raydium (Solana)     │
│  Step 2: WARP bridge ZION Solana → Base            │
│          (burn ZION on Solana, mint wZION on Base) │
│  Step 3: Deliver wZION to user on Base             │
└───────────────────────────────────────────────────┘
        │
        ▼
  User receives wZION on Base
  (one transaction from user's perspective)
```

### 3.2 Same-Chain Swap Flow

```
User: Swap wZION → USDC on Base
        │
        ▼
ZionDex Router checks:
  1. ZionDex AMM pool (if deployed)
  2. Uniswap V4 pool
  3. Aerodrome / SushiSwap / 1inch
        │
        ▼
Best price selected → execute single TX
```

---

## 4. Backend Plan

### 4.1 ZionDex Router (Off-chain)

**Location:** `V3/L2/ziondex-router/` (new crate)

**Responsibilities:**
- Accept swap requests: `(src_chain, src_token, dest_chain, dest_token, amount)`
- Find best path across AMMs + bridges
- Calculate slippage, fees, estimated output
- Execute swaps (direct or via intent-based solver)
- Stream status updates via WebSocket

**API Endpoints:**

```rust
// POST /quote — get price quote (no execution)
POST /quote
{
  "src_chain": "solana",
  "src_token": "USDC",
  "dest_chain": "base",
  "dest_token": "wZION",
  "amount": "1000"
}
→ 200 OK
{
  "path": [
    { "type": "swap", "chain": "solana", "dex": "raydium", "from": "USDC", "to": "ZION" },
    { "type": "bridge", "from_chain": "solana", "to_chain": "base", "asset": "ZION" }
  ],
  "expected_output": "985.42",
  "min_output": "970.00",
  "slippage_bps": 150,
  "fees": { "swap": "0.25%", "bridge": "0.5%" },
  "estimated_time_seconds": 45,
  "expires_at": "2026-07-10T12:05:00Z"
}

// POST /swap — execute swap
POST /swap
{
  "quote_id": "q_abc123",
  "sender": "zion1...",
  "recipient": "0x...",
  "max_slippage_bps": 200
}
→ 200 OK
{
  "swap_id": "s_xyz789",
  "status": "pending",
  "steps": [...],
  "monitor_url": "/swaps/s_xyz789"
}

// GET /swaps/:id — track swap status
// GET /health — router health
// WS /stream — WebSocket for real-time updates
```

**Path Finding Algorithm:**

```rust
pub struct SwapPath {
    steps: Vec<SwapStep>,
    expected_output: f64,
    min_output: f64,
    total_fee_bps: u32,
    estimated_time_secs: u64,
}

pub enum SwapStep {
    SameChainSwap {
        chain: ChainId,
        dex: DexId,
        from_token: TokenId,
        to_token: TokenId,
        amount_in: f64,
        expected_amount_out: f64,
    },
    Bridge {
        from_chain: ChainId,
        to_chain: ChainId,
        asset: TokenId,
        amount: f64,
        fee_bps: u32,
        estimated_time_secs: u64,
    },
}

pub fn find_best_path(
    src_chain: ChainId,
    src_token: TokenId,
    dest_chain: ChainId,
    dest_token: TokenId,
    amount: f64,
) -> Vec<SwapPath> {
    // 1. Direct same-chain swap (if src_chain == dest_chain)
    // 2. Single bridge (if src_token == dest_token, just bridge)
    // 3. Swap → Bridge → Swap (cross-chain)
    // 4. Bridge → Swap (if dest_token exists on src_chain)
    // 5. Swap → Bridge (if src_token exists on dest_chain)
    // Return top 3 paths sorted by output amount
}
```

**Files to create:**

```
V3/L2/ziondex-router/
├── Cargo.toml
├── src/
│   ├── lib.rs              # Public API
│   ├── router.rs           # Path finding + price discovery
│   ├── quote.rs            # Quote calculation (slippage, fees)
│   ├── executor.rs         # Swap execution (direct + intent-based)
│   ├── solver.rs           # Intent-based solver competition
│   ├── monitor.rs          # WebSocket status streaming
│   ├── db.rs               # SQLite for swap state tracking
│   ├── config.rs           # Chain configs, DEX registry
│   └── api.rs              # HTTP/WS server (axum)
└── tests/
    ├── test_router.rs      # Path finding tests
    ├── test_quote.rs       # Quote accuracy tests
    └── test_e2e.rs         # End-to-end swap tests
```

### 4.2 ZionDex AMM (Custom Smart Contracts)

**Location:** `V3/L2/ziondex-contracts/` (new)

**Design decisions:**
- **Uniswap V4 hooks pattern** — custom fee tiers for ZION pairs
- **Singleton architecture** — all pools in one contract (gas-efficient)
- **Concentrated liquidity** — LPs choose price ranges
- **Golden Ratio AMM** — `x^φ * y^φ = k` formula (30% less slippage)
- **ZION pair discounts** — 0.15% fee for ZION/* pairs vs 0.30% standard

**Solidity contracts:**

```solidity
// ZionDexPoolManager.sol — singleton pool manager (Uni V4 pattern)
contract ZionDexPoolManager {
    mapping(PoolId => Pool) pools;
    
    function initialize(PoolKey key, uint160 sqrtPriceX96) external;
    function swap(PoolId id, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) external;
    function addLiquidity(PoolId id, int24 tickLower, int24 tickUpper, uint256 amount) external;
    function removeLiquidity(PoolId id, int24 tickLower, int24 tickUpper, uint256 amount) external;
    
    // Flash accounting (net balance tracking)
    function unlock(bytes data) external;
}

// ZionDexHooks.sol — custom hooks for ZION pairs
contract ZionDexHooks is IHooks {
    // Lower fees for ZION pairs
    function beforeSwap(address sender, PoolKey key, SwapParams params) external override {
        if (key.currency0 == ZION || key.currency1 == ZION) {
            // Apply 0.15% fee instead of 0.30%
        }
    }
    
    // Dynamic fee tiers based on volume
    function afterSwap(address sender, PoolKey key, SwapParams params, BalanceDelta delta) external override {
        // Volume-based fee adjustment
    }
}

// ZionDexRouter.sol — user-facing router
contract ZionDexRouter {
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external returns (uint256 amountOut);
    
    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 maxAmountIn,
        uint256 deadline
    ) external returns (uint256 amountIn);
    
    function addLiquidity(
        address tokenA,
        address tokenB,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountA,
        uint256 amountB,
        uint256 minAmountA,
        uint256 minAmountB,
        uint256 deadline
    ) external returns (uint256 liquidity);
    
    function removeLiquidity(
        PoolId id,
        int24 tickLower,
        int24 tickUpper,
        uint256 liquidity,
        uint256 minAmountA,
        uint256 minAmountB,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}

// ZionDexStaking.sol — LP staking for ZDX rewards
contract ZionDexStaking {
    mapping(address => uint256) public stakedLiquidity;
    mapping(address => uint256) public rewardDebt;
    
    function stake(uint256 liquidityTokenId) external;
    function unstake(uint256 liquidityTokenId) external;
    function claimRewards() external returns (uint256 zdxReward);
}

// ZDXToken.sol — governance token
contract ZDXToken is ERC20 {
    // Minted as rewards for LPs and stakers
    // Used for governance voting on fee tiers, new pools
    // Staking ZDX → share of DEX revenue
}
```

**Files to create:**

```
V3/L2/ziondex-contracts/
├── foundry.toml
├── src/
│   ├── ZionDexPoolManager.sol
│   ├── ZionDexHooks.sol
│   ├── ZionDexRouter.sol
│   ├── ZionDexStaking.sol
│   ├── ZDXToken.sol
│   └── interfaces/
│       ├── IZionDexPoolManager.sol
│       ├── IZionDexHooks.sol
│       └── IZionDexRouter.sol
├── test/
│   ├── PoolManager.t.sol
│   ├── Hooks.t.sol
│   ├── Router.t.sol
│   └── E2E.t.sol
├── script/
│   ├── DeployBase.s.sol
│   └── DeployMultiChain.s.sol
└── deployments/
    └── base.json
```

### 4.3 Liquidity Bootstrapping

**Phase 1 — Deploy on existing DEXs (fastest):**

| Chain | DEX | Pool | Fee | Seed Amount |
|-------|-----|------|-----|-------------|
| Base | Uniswap V4 | wZION/USDT | 0.3% | ✅ Live |
| Base | Uniswap V4 | wZION/WETH | 1% | ✅ Live |
| Arbitrum | Uniswap V3 | wZION/USDC | 0.3% | 50K wZION |
| BSC | PancakeSwap | wZION/USDT | 0.25% | 50K wZION |
| Polygon | QuickSwap | wZION/USDC | 0.3% | 50K wZION |
| Optimism | Uniswap V3 | wZION/USDC | 0.3% | 50K wZION |
| Avalanche | TraderJoe | wZION/USDC | 0.3% | 50K wZION |
| Solana | Raydium | ZION/USDC | 0.25% | 100K ZION |
| Solana | Orca | ZION/USDC | 0.01% | 50K ZION |
| Tron | SunSwap | ZION/USDT | 0.3% | 50K ZION |
| Cardano | Minswap | ZION/ADA | 0.3% | 50K ZION |
| TON | STON.fi | ZION/USDT | 0.3% | 50K ZION |
| Aptos | Liquidswap | ZION/USDC | 0.3% | 50K ZION |
| Sui | Cetus | ZION/USDC | 0.3% | 50K ZION |
| NEAR | Ref.Finance | ZION/USDC | 0.3% | 50K ZION |
| Stellar | StellarX | ZION/USDC | 0.3% | 50K ZION |

**Liquidity mining incentives:** ZIONFarm rewards LPs on all chains (extend from Base-only to all 13).

### 4.4 Swap Aggregator Completion

**Current state:** `V3/L2/swap-aggregator/` is a skeleton with placeholder APIs.

**Tasks to complete:**

```rust
// orchestrator.rs — ✅ DONE: Integrated real L3 WARP API
- [x] Integrate real WARP bridge API (POST /transfers/outbound, /transfers/inbound, polling /transfers/:id)
- [ ] Integrate Uniswap V4 QuoterV2 for accurate price quotes
- [ ] EVM transaction signing and submission (ethers-rs)
- [ ] Background worker with retry logic (3 retries, exponential backoff)
- [ ] WebSocket status streaming to frontend
- [ ] Fee estimation (gas + bridge + swap)
- [ ] Slippage protection (min_output enforcement)

// New: multi-chain support (not just Base)
- [ ] Solana swap integration (Raydium/Orca SDK)
- [ ] Tron swap integration (SunSwap API)
- [ ] Cardano swap integration (Minswap API)
- [ ] TON swap integration (STON.fi API)
```

### 4.5 Intent-Based Execution (Phase 2+)

**Model:** Users declare desired outcome, solvers compete to execute.

```rust
pub struct SwapIntent {
    id: Uuid,
    sender: String,
    src_chain: ChainId,
    src_token: TokenId,
    dest_chain: ChainId,
    dest_token: TokenId,
    amount_in: f64,
    min_amount_out: f64,
    deadline: u64,  // unix timestamp
    nonce: u64,
    signature: Vec<u8>,  // user signs the intent
}

pub struct Solver {
    id: String,
    pubkey: String,
    staked_zdx: u64,  // must stake ZDX to participate
    success_rate: f64,
}

// Solvers compete to fill intents
// Best price wins (Dutch auction model)
// Failed solvers slashed on stake
```

---

## 5. UI Plan

### 5.1 Web (Next.js) — `APP&WEB/website-v2.9/`

#### Page: `/dex` — Main ZionDex Interface

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ZION Logo    [Swap] [Liquidity] [Bridge] [Portfolio]    [Wallet]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    SWAP WIDGET                            │    │
│  │                                                           │    │
│  │  ┌─────────────┐  [↓]  ┌─────────────┐                  │    │
│  │  │ 1000 USDC   │       │ 985.42 ZION │                  │    │
│  │  │ [Solana ▼]  │       │ [Base ▼]    │                  │    │
│  │  └─────────────┘       └─────────────┘                  │    │
│  │                                                           │    │
│  │  Path: USDC → ZION (Raydium) → wZION (WARP bridge)      │    │
│  │  Slippage: 1.5%  ·  Fee: 0.75%  ·  Time: ~45s           │    │
│  │  Min received: 970.00 wZION                              │    │
│  │                                                           │    │
│  │  [        Swap        ]                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──── Price Chart ────┐  ┌──── Recent Swaps ────────────┐     │
│  │  ZION/USDC          │  │  0xabc...  500 USDC → 492 ZION │     │
│  │  [candlestick]      │  │  zion1...  1000 ZION → 995 wZION│     │
│  │  24h: +2.3%         │  │  0xdef...  200 USDC → 197 ZION │     │
│  └─────────────────────┘  └────────────────────────────────┘     │
│                                                                 │
│  ┌──── Pool Liquidity ─────────────────────────────────────┐    │
│  │  wZION/USDC (Base):    $2.4M TVL  ·  0.3% fee          │    │
│  │  ZION/USDC (Solana):   $890K TVL  ·  0.25% fee         │    │
│  │  wZION/USDT (BSC):     $1.2M TVL  ·  0.25% fee         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Components to build:**

```
APP&WEB/website-v2.9/src/app/dex/
├── page.tsx                      # Main DEX page
├── swap/
│   ├── page.tsx                  # Swap tab
│   └── SwapWidget.tsx            # Main swap widget
├── liquidity/
│   ├── page.tsx                  # Liquidity tab
│   ├── AddLiquidity.tsx          # Add liquidity form
│   ├── RemoveLiquidity.tsx       # Remove liquidity
│   └── PoolList.tsx              # Pool browser
├── bridge/
│   ├── page.tsx                  # Bridge tab (WARP)
│   └── BridgeWidget.tsx          # Bridge widget
├── portfolio/
│   ├── page.tsx                  # Portfolio tab
│   └── Positions.tsx             # LP positions + staking
└── components/
    ├── ChainSelector.tsx         # Chain dropdown
    ├── TokenSelector.tsx         # Token dropdown
    ├── PriceChart.tsx            # Candlestick chart
    ├── SwapPath.tsx              # Visual path display
    ├── SlippageSettings.tsx      # Slippage tolerance
    ├── TransactionStatus.tsx     # Real-time TX status
    ├── PoolStats.tsx             # Pool TVL + volume
    └── RecentSwaps.tsx           # Recent swaps feed
```

#### Page: `/dex/liquidity` — Liquidity Provider

```
┌─────────────────────────────────────────────────────────────────┐
│  [Add Liquidity]  [My Positions]  [All Pools]                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─── Add Liquidity ───────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Pool: [wZION / USDC ▼]  Chain: [Base ▼]               │   │
│  │  Fee tier: [0.3% ▼]                                     │   │
│  │                                                          │   │
│  │  Price range:                                            │   │
│  │  [────●──────────────────────]  current: 1 ZION = 0.42 │   │
│  │  Min: 0.38   Max: 0.48                                  │   │
│  │                                                          │   │
│  │  ┌─────────────┐    ┌─────────────┐                     │   │
│  │  │ 1000 wZION  │    │ 420 USDC    │                     │   │
│  │  └─────────────┘    └─────────────┘                     │   │
│  │                                                          │   │
│  │  Estimated APR: 24.5%                                   │   │
│  │  ZIONFarm rewards: +12.5 ZDX/week                       │   │
│  │                                                          │   │
│  │  [    Add Liquidity    ]                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── My Positions ────────────────────────────────────────┐   │
│  │  wZION/USDC (Base)   $4,200   in-range   +$85 fees     │   │
│  │  ZION/USDC (Solana)  $1,800   out-of-range              │   │
│  │  wZION/WETH (Base)   $3,100   in-range   +$142 fees    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Page: `/dex/portfolio` — Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  Total Balance: $48,350  ·  LP Positions: $9,100  ·  P&L: +12% │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─── Cross-Chain Balances ────────────────────────────────┐   │
│  │  ZION (L1):       125,000 ZION    $52,500              │   │
│  │  wZION (Base):    12,000 wZION    $5,040               │   │
│  │  ZION (Solana):   3,500 ZION      $1,470               │   │
│  │  wZION (BSC):     800 wZION       $336                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── LP Positions ────────────────────────────────────────┐   │
│  │  wZION/USDC (Base)     $4,200   APR 24.5%   in-range   │   │
│  │  ZION/USDC (Solana)    $1,800   APR 18.2%   out-range  │   │
│  │  wZION/WETH (Base)     $3,100   APR 31.0%   in-range   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── Staking ─────────────────────────────────────────────┐   │
│  │  ZIONStaking:  50,000 wZION staked   12% APR            │   │
│  │  ZIONFarm:     LP tokens staked      +12.5 ZDX/week     │   │
│  │  ZionDex Staking: 2,000 ZDX staked   18% APR            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── Recent Activity ─────────────────────────────────────┐   │
│  │  Swap:  500 USDC → 492 ZION (Base → Solana)  2 min ago  │   │
│  │  LP:    Added 1000 wZION + 420 USDC          1 hour ago │   │
│  │  Bridge: 5000 ZION L1 → wZION Base           3 hours ago│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Mobile (React Native) — `APP&WEB/mobile-app/`

```
┌─────────────────────────────┐
│  ≡  ZionDex         [Wallet] │
├─────────────────────────────┤
│                              │
│  ┌───────────────────────┐  │
│  │  From: 1000 USDC      │  │
│  │  Chain: [Solana ▼]    │  │
│  │         [↓]           │  │
│  │  To: 985.42 ZION      │  │
│  │  Chain: [Base ▼]      │  │
│  │                       │  │
│  │  Path: 2 hops         │  │
│  │  Fee: 0.75%           │  │
│  │  Time: ~45s           │  │
│  │                       │  │
│  │  [   Swap Now   ]     │  │
│  └───────────────────────┘  │
│                              │
│  [Swap] [Pool] [Bridge] [⚡] │
│                              │
└─────────────────────────────┘
```

**Mobile-specific features:**
- QR code wallet sharing
- Biometric authentication (FaceID/TouchID)
- Push notifications for swap completion
- WalletConnect v2 for EVM chains
- Phantom wallet for Solana

### 5.3 Desktop Agent (Electron) — `APP&WEB/desktop-agent/`

**Features:**
- GPU-accelerated mining + DEX in one app
- System tray integration
- Auto-launch on startup
- Built-in wallet (no browser extension needed)
- Direct L1 node connection (no RPC dependency)

### 5.4 Design System

**Colors:**
```css
--zion-bg: #0a0a0f;          /* Deep space black */
--zion-surface: #14141f;     /* Card background */
--zion-primary: #6c5ce7;     /* Purple — ZION brand */
--zion-accent: #00cec9;      /* Teal — WARP/bridge */
--zion-success: #00b894;     /* Green — confirmed */
--zion-warning: #fdcb6e;     /* Yellow — pending */
--zion-error: #e17055;       /* Red — failed */
--zion-text: #f5f5f7;        /* White text */
--zion-muted: #636e72;       /* Gray — secondary */
```

**Typography:**
- Headings: Inter / SF Pro Display
- Body: Inter / SF Pro Text
- Mono: JetBrains Mono (addresses, amounts)

---

## 6. Implementation Phases

### Phase 1: Liquidity Bootstrapping (Q3 2026)

**Goal:** ZION tradable on all 13 chains via existing DEXs.

| Task | Owner | Priority | Status |
|------|-------|----------|--------|
| Deploy wZION/USDC on Uniswap V3 (Arbitrum) | Backend | P0 | Pending |
| Deploy wZION/USDT on PancakeSwap (BSC) | Backend | P0 | Pending |
| Deploy wZION/USDC on QuickSwap (Polygon) | Backend | P0 | Pending |
| Deploy wZION/USDC on Uniswap V3 (Optimism) | Backend | P0 | Pending |
| Deploy wZION/USDC on TraderJoe (Avalanche) | Backend | P0 | Pending |
| Deploy ZION/USDC on Raydium (Solana) | Backend | P0 | Pending |
| Deploy ZION/USDT on SunSwap (Tron) | Backend | P1 | Pending |
| Deploy ZION/ADA on Minswap (Cardano) | Backend | P1 | Pending |
| Deploy ZION/USDT on STON.fi (TON) | Backend | P1 | Pending |
| Deploy ZION/USDC on Liquidswap (Aptos) | Backend | P2 | Pending |
| Deploy ZION/USDC on Cetus (Sui) | Backend | P2 | Pending |
| Deploy ZION/USDC on Ref.Finance (NEAR) | Backend | P2 | Pending |
| Deploy ZION/USDC on StellarX (Stellar) | Backend | P2 | Pending |
| Extend ZIONFarm rewards to all chains | Backend | P0 | Pending |
| Update LI.FI widget to show all ZION pairs | Frontend | P0 | Pending |
| CoinMarketCap + CoinGecko listing | Business | P0 | Pending |

**Deliverable:** ZION is buyable on 13 chains. Users can swap via LI.FI widget on `/defi`.

### Phase 2: ZionDex Router + Cross-Chain Swap (Q4 2026)

**Goal:** One-click cross-chain swaps via ZionDex Router.

| Task | Owner | Priority | Status |
|------|-------|----------|--------|
| Build ZionDex Router crate (`ZionDex/router/`) | Backend | P0 | ✅ Done |
| Implement path finding algorithm | Backend | P0 | ✅ Done (6 strategies) |
| Integrate WARP bridge API into router | Backend | P0 | ✅ Done (L3 WARP REST API — /transfers/outbound, /transfers/inbound, polling /transfers/:id) |
| Integrate Uniswap V3 QuoterV2 | Backend | P0 | ✅ Done (slot0 + liquidity + quote) |
| Integrate Raydium/Orca SDK (Solana) | Backend | P1 | ✅ Done (Jupiter API aggregator) |
| Implement swap execution (direct mode) | Backend | P0 | ✅ Done (EVM signing via ethers-rs) |
| Implement WebSocket status streaming | Backend | P0 | ✅ Done (axum /stream) |
| Build `/dex` page with SwapWidget | Frontend | P0 | ✅ Done |
| Build ChainSelector + TokenSelector | Frontend | P0 | ✅ Done (16 chains) |
| Build SwapPath visual component | Frontend | P0 | ✅ Done |
| Build TransactionStatus component | Frontend | P0 | ✅ Done (real-time polling) |
| Build PriceChart component | Frontend | P1 | ✅ Done (SVG-based, 1h/24h/7d) |
| Build RecentSwaps feed | Frontend | P1 | ✅ Done (auto-refresh) |
| API: `/quote`, `/swap`, `/swaps/:id`, `/health` | Backend | P0 | ✅ Done (9 endpoints) |
| Slippage protection + min_output enforcement | Backend | P0 | ✅ Done |
| Fee estimation (gas + bridge + swap) | Backend | P0 | ✅ Done |
| E2E test: USDC(Solana) → wZION(Base) | Backend | P0 | ✅ Unit test (14/14 passing) |
| E2E test: wZION(Base) → ZION(Solana) | Backend | P0 | ✅ Unit test (14/14 passing) |
| Mobile app: swap screen | Mobile | P1 | ✅ Done (DexScreen.js) |
| Desktop agent: swap tab | Desktop | P1 | ✅ Done (Electron dex-view) |
| TypeScript SDK (`@zion/dex-sdk`) | Backend | P0 | ✅ Done |

**Deliverable:** Users can swap any token on any chain to any token on any chain — one click. *(Backend + frontend + mobile + desktop complete)*

### Phase 3: Custom AMM + ZDX Token (Q1 2027)

**Goal:** ZionDex AMM with lower fees, concentrated liquidity, ZDX governance.

| Task | Owner | Priority | Status |
|------|-------|----------|--------|
| Write ZionDexPoolManager.sol (Uni V4 pattern) | Backend | P0 | ✅ Done |
| Write ZionDexHooks.sol (ZION pair discounts) | Backend | P0 | ✅ Done (0.15% vs 0.30%) |
| Write ZionDexRouter.sol | Backend | P0 | ✅ Done |
| Write ZDXToken.sol (ERC-20 governance) | Backend | P0 | ✅ Done (100M max, 10M initial) |
| Write ZionDexStaking.sol (LP staking) | Backend | P0 | ✅ Done |
| Foundry tests (unit + integration) | Backend | P0 | ✅ Done (7/7 passing) |
| Deploy on Base mainnet | Backend | P0 | Pending (script ready) |
| Basescan verification | Backend | P0 | Pending |
| Integrate ZionDex AMM into Router | Backend | P0 | ✅ Done (config + DEX registry) |
| Build `/dex/liquidity` page | Frontend | P0 | ✅ Done (PoolList + AddLiquidity + RemoveLiquidity) |
| Build AddLiquidity component | Frontend | P0 | ✅ Done (tick range, amount inputs) |
| Build RemoveLiquidity component | Frontend | P0 | ✅ Done (wallet connect placeholder) |
| Build PoolList component | Frontend | P0 | ✅ Done (table with chain/dex/pair/fee/status) |
| Build Portfolio page | Frontend | P0 | ✅ Done (stats + LP positions + swap history) |
| ZDX token launch + airdrop to LPs | Business | P0 | Pending |
| ZDX staking → share of DEX revenue | Backend | P1 | Pending |
| Golden Ratio AMM research + prototyping | Research | P2 | Pending |
| Security audit (internal + external) | Security | P0 | Pending |

**Deliverable:** ZionDex AMM live on Base with ZION pair fee discounts, LP staking, ZDX governance. *(Contracts + frontend complete — deploy + ZDX launch pending)*

### Phase 4: Intent-Based Execution + Aggregator (Q2 2027)

**Goal:** Solver competition for best prices, full aggregator mode.

| Task | Owner | Priority | Status |
|------|-------|----------|--------|
| Design SwapIntent data structure | Backend | P0 | Pending |
| Build Solver network (off-chain) | Backend | P0 | Pending |
| Implement Dutch auction matching | Backend | P0 | Pending |
| ZDX stake requirement for solvers | Backend | P0 | Pending |
| Slashing for failed solvers | Backend | P0 | Pending |
| MEV protection via off-chain competition | Backend | P0 | Pending |
| Aggregate all DEXs on all chains | Backend | P1 | Pending |
| Limit orders (on-chain) | Backend | P1 | Pending |
| Dynamic fee tiers (volume-based) | Backend | P2 | Pending |
| Cross-chain liquidity rebalancing | Backend | P2 | Pending |

**Deliverable:** ZionDex is a full cross-chain DEX aggregator with intent-based execution.

### Phase 5: Multi-Chain AMM Deployment (Q3 2027)

**Goal:** ZionDex AMM on every chain, not just Base.

| Task | Owner | Priority | Status |
|------|-------|----------|--------|
| Deploy ZionDex AMM on Arbitrum | Backend | P0 | Pending |
| Deploy ZionDex AMM on BSC | Backend | P0 | Pending |
| Deploy ZionDex AMM on Polygon | Backend | P0 | Pending |
| Deploy ZionDex AMM on Optimism | Backend | P0 | Pending |
| Deploy ZionDex AMM on Avalanche | Backend | P0 | Pending |
| Solana AMM (custom program) | Backend | P1 | Pending |
| TON AMM (custom contract) | Backend | P1 | Pending |
| Cardano AMM (Plutus script) | Backend | P2 | Pending |
| Aptos AMM (Move module) | Backend | P2 | Pending |
| Sui AMM (Move module) | Backend | P2 | Pending |

**Deliverable:** ZionDex AMM native on every chain — no dependency on 3rd-party DEXs.

---

## 7. Security

### 7.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Bridge validator compromise | 5/5 threshold multisig, key rotation, air-gapped key storage |
| Smart contract bug | Foundry tests, external audit, bug bounty |
| MEV extraction | Intent-based execution, off-chain solver competition |
| Front-running | Commit-reveal for large swaps, slippage protection |
| Oracle manipulation | TWAP (time-weighted average price) from Uni V4 pools |
| Cross-chain reorg | WARP confirms L1 finality before minting wZION |
| Liquidity drain | Per-chain rate limits, circuit breakers, timelocked withdrawals |
| Solver collusion | Multiple solvers, random selection, slashing |

### 7.2 Audit Checklist

- [ ] ZionDexPoolManager.sol — external audit (Trail of Bits / OpenZeppelin)
- [ ] ZionDexHooks.sol — external audit
- [ ] ZionDexRouter.sol — external audit
- [ ] ZDXToken.sol — OpenZeppelin ERC-20 standard audit
- [ ] ZionDexStaking.sol — external audit
- [ ] ZionDex Router (off-chain) — internal security review
- [ ] Intent-based solver — economic security analysis
- [ ] WARP bridge integration — penetration testing
- [ ] Bug bounty program (Immunefi)
- [ ] Formal verification of AMM math (Certora)

### 7.3 Rate Limits

```rust
pub struct RateLimits {
    // Per-chain, per-asset limits
    max_swap_per_tx: HashMap<(ChainId, TokenId), f64>,
    max_swap_per_hour: HashMap<(ChainId, TokenId), f64>,
    max_bridge_per_tx: HashMap<(ChainId, ChainId), f64>,
    max_bridge_per_hour: HashMap<(ChainId, ChainId), f64>,
    
    // Circuit breakers
    daily_volume_limit: f64,
    pause_threshold: f64,  // auto-pause if volume > X in 1 hour
}
```

---

## 8. Tokenomics

### 8.1 Fee Model

| Fee | Amount | Destination |
|-----|--------|-------------|
| Same-chain swap (ZION pair) | 0.15% | 80% LPs, 20% ZDX stakers |
| Same-chain swap (non-ZION pair) | 0.30% | 80% LPs, 20% ZDX stakers |
| Cross-chain swap (ZionDex Router) | 0.05% | ZDX stakers |
| WARP bridge fee | 0.50% | ZION stakers (L1) |
| ZDX early withdrawal | 0.50% | ZDX burn |

### 8.2 ZDX Token

| Property | Value |
|----------|-------|
| Name | ZionDex Token |
| Ticker | ZDX |
| Chain | Base (ERC-20) |
| Max supply | 100,000,000 ZDX |
| Initial supply | 10,000,000 ZDX |
| Distribution | 40% LP rewards, 30% team (2y vest), 20% community, 10% treasury |
| Governance | Vote on fee tiers, new pools, parameter changes |
| Staking | Share of DEX revenue (proportional to stake) |

### 8.3 Revenue Flow

```
User pays swap fee (0.15-0.30%)
        │
        ├── 80% → Liquidity Providers (LPs)
        │
        ├── 15% → ZDX Stakers (proportional to stake)
        │
        └── 5% → ZION Treasury (DAO-governed)
                │
                ├── Buyback & burn ZION
                ├── Fund liquidity mining
                └── Fund development
```

---

## 9. Competitive Analysis

| Project | What it does | What it doesn't do | ZION advantage |
|---------|-------------|-------------------|----------------|
| THORChain (RUNE) | Cross-chain swap BTC/ETH | Only 5-6 assets, no Solana/TON/Cardano | WARP = 13 chain families |
| Wormhole | Token bridge | EVM+SOL only, no swap | WARP = native L1 + ZionDex swap |
| LayerZero | Omnichain messaging | EVM only, no native asset | WARP = native L1 ZION |
| LI.FI | DEX aggregator | Aggregates others' bridges | ZionDex = own bridge + AMM |
| Uniswap | AMM DEX | EVM only, no cross-chain | ZionDex = 13 chains cross-chain |
| Chainlink CCIP | Cross-chain | EVM only, messaging only | WARP = native asset transfer |
| 1inch | DEX aggregator | EVM only, no own bridge | ZionDex = own bridge + 13 chains |
| Maya Protocol | THORChain fork | Same limitations | WARP = broader chain support |

**ZION's unique position:** Only project with native L1 blockchain + cross-chain bridge (13 chains) + DEX layer — all integrated, all owned.

---

## 10. WARP Chain Support Matrix

| Chain | Family | Token Standard | Decimals | WARP Status | DEX Partner | ZionDex AMM |
|-------|--------|----------------|----------|-------------|-------------|-------------|
| Base | EVM | ERC-20 | 18 | 🟢 Live | Uniswap V4 | Phase 3 |
| Arbitrum | EVM | ERC-20 | 18 | 🟢 Live | Uniswap V3 | Phase 5 |
| BSC | EVM | BEP-20 | 18 | 🟢 Live | PancakeSwap | Phase 5 |
| Polygon | EVM | ERC-20 | 18 | 🟢 Live | QuickSwap | Phase 5 |
| Optimism | EVM | ERC-20 | 18 | 🟢 Live | Uniswap V3 | Phase 5 |
| Avalanche | EVM | ERC-20 | 18 | 🟢 Live | TraderJoe | Phase 5 |
| Solana | Solana | SPL Token | 9 | 🟢 Live | Raydium/Orca | Phase 5 |
| Tron | Tron | TRC-20 | 18 | 🟢 Live | SunSwap | TBD |
| Stellar | Stellar | Stellar Asset | 7 | 🟡 Signing | StellarX | TBD |
| Bitcoin | Bitcoin | HTLC | 8 | 🟢 Live | N/A (HTLC) | N/A |
| Cardano | Cardano | Native Token | 6 | 🟡 Skeleton | Minswap | TBD |
| Cosmos | Cosmos | IBC/CW20 | 6 | 🟡 Skeleton | Osmosis | TBD |
| Aptos | Aptos | Coin | 8 | 🔴 Stub | Liquidswap | TBD |
| Sui | Sui | Coin | 9 | 🔴 Stub | Cetus | TBD |
| NEAR | NEAR | FT | 24 | 🔴 Stub | Ref.Finance | TBD |
| TON | TON | Jetton | 9 | 🔴 Stub | STON.fi | TBD |
| Lightning | Lightning | BOLT11 | 8 | 🟡 Stub | N/A | N/A |

---

## 11. API Reference (Planned)

### ZionDex Router API

```typescript
// TypeScript SDK (@zion/dex-sdk)
import { ZionDex } from '@zion/dex-sdk';

const dex = new ZionDex({
  routerUrl: 'https://dex.zionterranova.com',
  warpUrl: 'https://warp.zionterranova.com',
});

// Get quote (no execution)
const quote = await dex.quote({
  srcChain: 'solana',
  srcToken: 'USDC',
  destChain: 'base',
  destToken: 'wZION',
  amount: '1000',
});

// Execute swap
const swap = await dex.swap({
  quoteId: quote.id,
  sender: 'zion1...',
  recipient: '0x...',
  maxSlippageBps: 200,
});

// Track status
swap.on('status', (status) => {
  console.log(status.step, status.progress);
});

// Add liquidity
const position = await dex.addLiquidity({
  chain: 'base',
  tokenA: 'wZION',
  tokenB: 'USDC',
  feeTier: 3000,
  tickLower: -100,
  tickUpper: 100,
  amountA: '1000',
  amountB: '420',
});

// Remove liquidity
await dex.removeLiquidity({
  positionId: position.id,
  liquidity: '50%',
});
```

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/quote` | Get price quote (no execution) |
| POST | `/swap` | Execute swap |
| GET | `/swaps/:id` | Get swap status |
| GET | `/swaps` | List user's swaps |
| GET | `/pools` | List all pools with TVL |
| GET | `/pools/:id` | Get pool details |
| GET | `/prices/:token` | Get token price across chains |
| GET | `/health` | Router health check |
| WS | `/stream` | WebSocket for real-time updates |

---

## 12. File Structure (Planned)

```
ZionDex/                        # ✅ BUILT — standalone directory (not under V3/)
├── router/                     # ✅ Rust off-chain router (14/14 tests)
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   ├── main.rs             # Server entry point (axum)
│   │   ├── types.rs            # ChainId, TokenId, DexId, SwapPath
│   │   ├── config.rs           # RouterConfig — chain/DEX registry
│   │   ├── router.rs           # Path finding (6 strategies)
│   │   ├── quote.rs            # Quote engine
│   │   ├── price.rs            # ✅ Real Uni V3 price feed (slot0 + QuoterV2)
│   │   ├── executor.rs         # ✅ EVM signing + L3 WARP API (port 8453)
│   │   ├── api.rs              # HTTP REST + WebSocket (8 endpoints)
│   │   ├── db.rs               # SQLite swap state tracking
│   │   └── monitor.rs          # WebSocket real-time updates
│   └── tests/                  # 14 tests passing
├── contracts/                  # ✅ Solidity AMM (7/7 Foundry tests)
│   ├── foundry.toml
│   ├── src/
│   │   ├── ZionDexPoolManager.sol   # Singleton pool manager (Uni V4)
│   │   ├── ZionDexHooks.sol         # ZION pair fee discount (0.15%)
│   │   ├── ZionDexRouter.sol        # User-facing router
│   │   ├── ZDXToken.sol             # Governance token (100M max)
│   │   ├── ZionDexStaking.sol       # LP staking for ZDX rewards
│   │   └── interfaces/
│   ├── test/                        # 7 tests passing
│   ├── script/DeployBase.s.sol      # Base mainnet deploy script
│   └── lib/forge-std/
├── sdk/                        # ✅ TypeScript SDK (@zion/dex-sdk)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── types.ts            # All TypeScript types
│       ├── router.ts           # HTTP client for Router API
│       ├── swap.ts             # Swap manager (quote + execute + monitor)
│       ├── liquidity.ts        # Pool browser + LP management
│       └── ziondex.ts          # Main SDK entry point
└── README.md                   # Full documentation

APP&WEB/website-v2.9/src/app/dex/   # 🔲 Pending — frontend
├── page.tsx                        # Main DEX page
├── swap/
├── liquidity/
├── bridge/
├── portfolio/
└── components/

APP&WEB/mobile-app/src/screens/dex/ # 🔲 Pending — mobile
├── SwapScreen.tsx
├── LiquidityScreen.tsx
├── BridgeScreen.tsx
└── PortfolioScreen.tsx
```

---

## 13. Glossary

| Term | Meaning |
|------|---------|
| **ZionDex** | DEX layer — swap, liquidity, trading |
| **WARP** | Bridge layer — cross-chain ZION transfer |
| **ZION** | Native L1 coin (PoW blockchain) |
| **wZION** | ERC-20 wrapped ZION on EVM chains |
| **ZDX** | ZionDex governance token (future) |
| **AMM** | Automated Market Maker — algorithmic price discovery |
| **LP** | Liquidity Provider — deposits tokens to a pool |
| **TVL** | Total Value Locked — total liquidity in pools |
| **HTLC** | Hash Time-Locked Contract — trustless cross-chain swap |
| **Concentrated liquidity** | LP provides liquidity within a price range (Uni V3/V4) |
| **Golden Ratio AMM** | Custom formula `x^φ * y^φ = k` — 30% less slippage |
| **Intent-based** | User declares desired outcome, solvers compete to execute |
| **Solver** | Off-chain agent that executes swap intents for a fee |
| **Slippage** | Difference between expected and actual swap price |
| **MEV** | Maximal Extractable Value — profit from transaction ordering |

---

## 14. Success Metrics

| Metric | Phase 1 Target | Phase 3 Target | Phase 5 Target |
|--------|---------------|---------------|---------------|
| Chains with ZION liquidity | 13 | 13 | 13 |
| Total TVL | $500K | $5M | $50M |
| Daily swap volume | $10K | $100K | $1M |
| Monthly active users | 100 | 1,000 | 10,000 |
| ZION market cap rank | Top 500 | Top 200 | Top 100 |
| Cross-chain swaps/day | 10 | 100 | 1,000 |
| ZDX stakers | — | 500 | 5,000 |
| Liquidity providers | 50 | 500 | 5,000 |

---

## 15. References

- **Existing concept doc:** `docs/3.0.3/ZionDex.md`
- **WARP architecture:** `docs/WARP_ARCHITECTURE.md`
- **Bridge config:** `V3/L2/bridge/config/bridge-mainnet.toml`
- **Swap aggregator:** `V3/L2/swap-aggregator/src/orchestrator.rs`
- **Atomic swap:** `V3/L2/atomic-swap/src/types.rs`
- **DeFi UI:** `APP&WEB/website-v2.9/src/app/defi/page.tsx`
- **Swap UI:** `APP&WEB/website-v2.9/src/app/swap/page.tsx`
- **Bridge UI:** `APP&WEB/website-v2.9/src/app/bridge/page.tsx`
- **Mainnet constants:** `V3/docs/MAINNET_CONSTANTS.md`
- **Uniswap V4 docs:** https://docs.uniswap.org/contracts/v4/
- **THORChain docs:** https://docs.thorchain.org/
- **LI.FI docs:** https://docs.li.fi/

---

<div align="center">

**ZION L1 + WARP Bridge + ZionDex + Hiran AI**

*Built with care, secured by consensus.*

*Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.*

*Peace & One Love 4ever.*

</div>
