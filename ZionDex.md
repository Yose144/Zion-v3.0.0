# ZionDex — Cross-Chain DEX Implementation Plan

> **Status:** Live Beta — Active development
> **Created:** 2026-07-10
> **Last updated:** 2026-07-12 (Phase 4 Intent-Based Execution + Non-EVM contracts + Lightning LND + Cross-chain AMM routing)
> **Supersedes:** `docs/3.0.3/ZionDex.md` (concept/vision document)
> **Goal:** First universal cross-chain DEX powered by native L1 bridge on 13 chain families
> **Contract addresses:** [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md)

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
| **ZionDex Router** | `ZionDex/router/` | ✅ **Built** — 37/37 Rust tests (20 unit + 8 integration + 9 intent), real Uni V3 prices, EVM signing, **L3 WARP API integration** (port 8453), **cross-chain AMM routing** (`aggregator.rs`), **Phase 4 intent API** (`intent.rs` — POST /intent, bids, settle) |
| **ZionDex Intent Crate** | `ZionDex/intent/` | ✅ **Built** — 12/12 tests, SwapIntent, EIP-712 signing (EVM) + Ed25519 (Solana), Dutch auction engine, SimpleSolver |
| **ZionDex Solver Daemon** | `ZionDex/solver/` | ✅ **Built** — 19/19 tests, off-chain solver, FixedMargin + Competitive strategies, REST API (port 8455) |
| **ZionDex AMM Contracts** | `ZionDex/contracts/` | ✅ **Built** — 20/20 Foundry tests (7 PoolManager + 13 IntentSettlement), PoolManager + Hooks + Router + ZDX + Staking + SolverRegistry + IntentSettlement |
| **TypeScript SDK** | `ZionDex/sdk/` | ✅ **Built** — `@zion/dex-sdk`, full type defs, swap + liquidity managers |
| **Web Landing Page** | `APP&WEB/website-v2.9/src/app/ziondex/page.tsx` | ✅ **Live Beta** — marketing page, architecture, roadmap, CTA → `/dex` |
| **Web Swap UI** | `APP&WEB/website-v2.9/src/app/dex/page.tsx` | ✅ **Live Beta** — CrossChainSwapWidget, PriceChart, RecentSwaps, Quick Links |
| **Liquidity UI** | `APP&WEB/website-v2.9/src/app/dex/liquidity/page.tsx` | ✅ **Built** — PoolList + AddLiquidity + RemoveLiquidity |
| **Portfolio UI** | `APP&WEB/website-v2.9/src/app/dex/portfolio/page.tsx` | ✅ **Built** — LP positions + swap history + stats |
| **Mobile Swap** | `APP&WEB/mobile-app/src/screens/DexScreen.js` | ✅ **Built** — React Native, bottom nav tab |
| **Desktop Swap** | `APP&WEB/desktop-agent/src/ui/` | ✅ **Built** — Electron dex-view, sidebar nav |
| Swap Aggregator (legacy) | `V3/L2/swap-aggregator/` | ⚠️ Skeleton — superseded by ZionDex Router |
| LI.FI Widget | `APP&WEB/website-v2.9/src/app/defi/page.tsx` | ✅ Live, aggregates 30+ DEX + 20+ bridges |
| Atomic Swap UI | `APP&WEB/website-v2.9/src/app/swap/page.tsx` | ✅ Live, HTLC initiation/claim/refund |
| Bridge UI | `APP&WEB/website-v2.9/src/app/bridge/page.tsx` | ✅ Live, burn wZION → unlock ZION |

> **Implementation Status (2026-07-12):** ZionDex is **Live Beta** — backend (Router 37 tests, AMM 7 tests, SDK), frontend (`/dex` swap UI + `/dex/liquidity` + `/dex/portfolio`), mobile (React Native), desktop (Electron), L3 WARP integration, cross-chain AMM routing (aggregator.rs), and **Phase 4 Intent-Based Execution** (intent crate 12 tests, solver daemon 19 tests, IntentSettlement + SolverRegistry contracts 13 tests, Router intent API 9 tests — **88 tests total**) all complete. Landing page at `/ziondex`. Non-EVM ZION token contracts created for 9 chains. Lightning LND Docker stack deployed on Edge (testnet, syncing). ZionDex Router deployed on Edge (port 8454, health OK). Remaining: deploy IntentSettlement + SolverRegistry on Base (needs ETH), provision solver keys + start solver daemon (port 8455), deploy non-EVM contracts to mainnet, frontend intent UI, security audit. See `ZionDex/README.md` and [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md) for full details.

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

**Status (2026-07-12):** Core implementation complete — SwapIntent data structure, EIP-712 signing, Dutch auction engine, solver daemon, on-chain settlement contracts, and Router API integration all built and tested (88 tests passing). Pending: deploy contracts on Base, provision solver keys, frontend intent UI.

| Task | Owner | Priority | Status |
|------|-------|----------|--------|
| Design SwapIntent data structure | Backend | P0 | ✅ Done (`ZionDex/intent/src/types.rs` — SwapIntent, SolverBid, PathHop, IntentStatus) |
| EIP-712 signing + Ed25519 (Solana) | Backend | P0 | ✅ Done (`ZionDex/intent/src/signing.rs` — 12/12 tests) |
| Dutch auction engine | Backend | P0 | ✅ Done (`ZionDex/intent/src/auction.rs` — replay protection, best-bid selection, expiry) |
| Solver daemon (off-chain) | Backend | P0 | ✅ Done (`ZionDex/solver/` — 19/19 tests, Router API client, bidding strategies, REST API port 8455) |
| ZDX stake requirement for solvers | Backend | P0 | ✅ Done (`ZionDex/contracts/src/SolverRegistry.sol` — min 10K ZDX stake) |
| Slashing for failed solvers | Backend | P0 | ✅ Done (`SolverRegistry.sol` — 10% slash per failure, ban after 3) |
| On-chain intent settlement | Backend | P0 | ✅ Done (`ZionDex/contracts/src/IntentSettlement.sol` — EIP-712 verify, replay protection, nonce tracking — 13/13 Forge tests) |
| Router API: intent endpoints | Backend | P0 | ✅ Done (`ZionDex/router/src/intent.rs` — POST /intent, GET /intent/:id, POST /intent/:id/bid, GET /intent/:id/bids, POST /intent/:id/settle, POST /intent/:id/cancel, GET /intents — 9/9 tests) |
| MEV protection via off-chain competition | Backend | P0 | ✅ Done (off-chain Dutch auction = no mempool exposure) |
| Deploy SolverRegistry + IntentSettlement on Base | Backend | P0 | Pending (script ready in `DeployBase.s.sol`, needs ETH for gas) |
| Provision solver keys + start solver daemon | Backend | P1 | Pending (port 8455 on Edge) |
| Frontend: intent submission UI | Frontend | P1 | Pending |
| Aggregate all DEXs on all chains | Backend | P1 | Pending (Router already aggregates via `/quote/multi`) |
| Limit orders (on-chain) | Backend | P1 | Pending |
| Dynamic fee tiers (volume-based) | Backend | P2 | Pending |
| Cross-chain liquidity rebalancing | Backend | P2 | Pending |

**Architecture:**

```
User signs SwapIntent (EIP-712)
       │
       ▼
POST /intent ──→ Router API (port 8454)
       │                    │
       ▼                    ▼
  Auction Engine      Solver Daemon (port 8455)
  (in-memory)         ├── FixedMarginStrategy
       │              └── CompetitiveStrategy
       ▼                    │
  Solvers bid               │
  (POST /intent/:id/bid)    │
       │                    │
       ▼                    ▼
  Best bid wins ──→ Solver executes via POST /swap
       │                    │
       ▼                    ▼
  POST /intent/:id/settle ──→ IntentSettlement.sol (on-chain)
```

**Test summary:**
- `ZionDex/intent/` — 12/12 (3 signing + 9 integration)
- `ZionDex/solver/` — 19/19 (13 unit + 6 integration)
- `ZionDex/router/` intent module — 9/9
- `ZionDex/contracts/` IntentSettlement — 13/13 Forge tests
- **Total: 53 new tests + 37 existing Router = 88 tests passing**

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

| Chain | Family | Token Standard | Decimals | WARP Adapter | Contract | DEX Partner | ZionDex AMM |
|-------|--------|----------------|----------|-------------|----------|-------------|-------------|
| Base | EVM | ERC-20 | 18 | 🟢 Live | ✅ Deployed | Uniswap V4 | Phase 3 |
| Arbitrum | EVM | ERC-20 | 18 | 🟢 Live | ✅ Deployed | Uniswap V3 | Phase 5 |
| BSC | EVM | BEP-20 | 18 | 🟢 Live | ✅ Deployed | PancakeSwap | Phase 5 |
| Polygon | EVM | ERC-20 | 18 | 🟢 Live | ✅ Deployed | QuickSwap | Phase 5 |
| Optimism | EVM | ERC-20 | 18 | 🟢 Live | ✅ Deployed | Uniswap V3 | Phase 5 |
| Avalanche | EVM | ERC-20 | 18 | 🟢 Live | ✅ Deployed | TraderJoe | Phase 5 |
| Solana | Solana | SPL Token | 6 | 🟢 Live | 🟡 Created | Raydium/Orca | Phase 5 |
| Tron | Tron | TRC-20 | 6 | 🟢 Live | 🟡 Created | SunSwap | TBD |
| Stellar | Stellar | Stellar Asset | 6 | 🟢 Live | 🟡 Created | StellarX | TBD |
| Bitcoin | Bitcoin | HTLC | 8 | 🟢 Live | 🔴 HTLC placeholder | N/A (HTLC) | N/A |
| Cardano | Cardano | Native Token | 6 | 🟢 Live | 🟡 Created | Minswap | TBD |
| Cosmos | Cosmos | IBC/CW20 | 6 | 🟢 Live | 🟡 Created | Osmosis | TBD |
| Aptos | Aptos | Coin | 6 | 🟢 Live | 🟡 Created | Liquidswap | TBD |
| Sui | Sui | Coin | 6 | 🟢 Live | 🟡 Created | Cetus | TBD |
| NEAR | NEAR | FT | 6 | 🟢 Live | 🟡 Created | Ref.Finance | TBD |
| TON | TON | Jetton | 9 | 🟢 Live | 🟡 Created | STON.fi | TBD |
| Lightning | Lightning | BOLT11 | — | 🟡 Docker ready | N/A | N/A | N/A |

> **Contract status legend:** ✅ Deployed on mainnet · 🟡 Created (source file ready, pending deploy) · 🔴 Placeholder (needs generation)

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
| GET | `/quote/multi` | Get top 3 cross-chain paths (multi-path quote) |
| POST | `/swap` | Execute swap |
| GET | `/swaps/:id` | Get swap status |
| GET | `/swaps` | List user's swaps |
| GET | `/pools` | List all pools with TVL |
| GET | `/pools/:id` | Get pool details |
| GET | `/prices/:token` | Get token price across chains |
| GET | `/health` | Router health check |
| WS | `/stream` | WebSocket for real-time updates |
| **POST** | **`/intent`** | **Phase 4 — Submit SwapIntent (user signs EIP-712)** |
| **GET** | **`/intent/:id`** | **Get intent status + winning bid** |
| **GET** | **`/intents`** | **List all intents** |
| **POST** | **`/intent/:id/bid`** | **Solver submits a bid (amount_out + path)** |
| **GET** | **`/intent/:id/bids`** | **List all bids for an intent (best first)** |
| **POST** | **`/intent/:id/settle`** | **Mark intent as executed (solver reports tx hash)** |
| **POST** | **`/intent/:id/cancel`** | **Cancel pending intent (owner only)** |

### Solver Daemon API (port 8455)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Solver health + stats |
| GET | `/stats` | Solver statistics (bids, wins, losses, profit) |
| GET | `/bids/:intent_id` | Get solver's bid for an intent |
| POST | `/intent` | Receive new intent from auction broadcaster |

---

## 12. File Structure (Planned)

```
ZionDex/                        # ✅ BUILT — standalone directory (not under V3/)
├── router/                     # ✅ Rust off-chain router (37/37 tests)
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   ├── main.rs             # Server entry point (axum)
│   │   ├── types.rs            # ChainId, TokenId, DexId, SwapPath
│   │   ├── config.rs           # RouterConfig — chain/DEX registry, WARP URL
│   │   ├── router.rs           # Path finding (6 strategies + aggregator)
│   │   ├── aggregator.rs       # ✅ NEW — LiquidityAggregator (Dijkstra, top 3 paths)
│   │   ├── quote.rs            # Quote engine + MultiPathQuote
│   │   ├── price.rs            # Real Uni V3 price feed (slot0 + QuoterV2)
│   │   ├── executor.rs         # EVM signing + L3 WARP API (port 8453)
│   │   ├── intent.rs           # ✅ NEW (Phase 4) — Intent API (POST /intent, bids, settle)
│   │   ├── api.rs              # HTTP REST + WebSocket (9 endpoints + /quote/multi + 7 intent endpoints)
│   │   ├── db.rs               # SQLite swap state tracking
│   │   └── monitor.rs          # WebSocket real-time updates
│   └── tests/
│       └── aggregator.rs       # 8 integration tests (graph, path finding, fees)
├── intent/                     # ✅ NEW (Phase 4) — SwapIntent crate (12/12 tests)
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   ├── types.rs            # SwapIntent, SolverBid, PathHop, IntentStatus, ChainId (17 chains)
│   │   ├── signing.rs          # EIP-712 (EVM) + Ed25519 (Solana) signing + verification
│   │   ├── auction.rs          # Dutch auction engine (replay protection, best-bid, expiry)
│   │   ├── solver.rs           # Solver trait + SimpleSolver (Router API client)
│   │   └── errors.rs
│   └── tests/intent_tests.rs   # 9 integration tests
├── solver/                     # ✅ NEW (Phase 4) — Solver daemon (19/19 tests, port 8455)
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs
│   │   ├── main.rs             # CLI entry point (--solver-key, --router-url, --bind)
│   │   ├── config.rs           # SolverConfig (clap + ZION_SOLVER_* env)
│   │   ├── types.rs            # MultiPathQuote, SwapRequest, SwapResult (local)
│   │   ├── router_client.rs    # Router API HTTP client (GET /quote/multi, POST /swap)
│   │   ├── strategy.rs         # FixedMarginStrategy + CompetitiveStrategy
│   │   ├── node.rs             # SolverNode (on_new_intent, on_auction_won)
│   │   ├── api.rs              # REST API (GET /health, /stats, /bids/:id, POST /intent)
│   │   └── errors.rs
│   └── tests/solver_tests.rs   # 6 integration tests
├── contracts/                  # ✅ Solidity AMM + Intent (20/20 Foundry tests)
│   ├── foundry.toml
│   ├── src/
│   │   ├── ZionDexPoolManager.sol   # Singleton pool manager (Uni V4)
│   │   ├── ZionDexHooks.sol         # ZION pair fee discount (0.15%)
│   │   ├── ZionDexRouter.sol        # User-facing router
│   │   ├── ZDXToken.sol             # Governance token (100M max)
│   │   ├── ZionDexStaking.sol       # LP staking for ZDX rewards
│   │   ├── SolverRegistry.sol       # ✅ NEW (Phase 4) — Solver staking + slashing
│   │   ├── IntentSettlement.sol     # ✅ NEW (Phase 4) — EIP-712 intent settlement
│   │   └── interfaces/
│   │       └── IZDXToken.sol        # ✅ NEW (Phase 4)
│   ├── test/                        # 20 tests passing (7 PoolManager + 13 IntentSettlement)
│   ├── script/DeployBase.s.sol      # Base mainnet deploy script (7 contracts)
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

V3/L2/bridge/contracts/non-evm/     # ✅ CREATED — 9 non-EVM ZION token contracts
├── solana/
│   ├── zion_spl_token.rs            # SPL Token (Anchor, 6 decimals)
│   └── README.md
├── tron/
│   ├── ZionToken.sol                # TRC-20 (Solidity, 6 decimals)
│   └── README.md
├── stellar/
│   ├── zion_asset.toml              # Native asset config
│   ├── setup_zion_asset.py          # Asset issuance script
│   └── README.md
├── cardano/
│   ├── mint_zion_token.hs           # Plutus minting policy (6 decimals)
│   └── README.md
├── cosmos/
│   ├── zion_cw20.rs                 # CosmWasm CW20 (6 decimals)
│   └── README.md
├── aptos/
│   ├── sources/zion_coin.move       # Aptos Move Coin (6 decimals)
│   └── README.md
├── sui/
│   ├── sources/zion_coin.move       # Sui Move Coin (6 decimals)
│   └── README.md
├── near/
│   ├── zion_token.rs                # NEP-141 fungible token (6 decimals)
│   └── README.md
└── ton/
    ├── zion_jetton.fc               # TEP-74 jetton (FunC, 9 decimals)
    └── README.md

V3/L3/warp/docker/lightning/         # ✅ CREATED — LND Docker setup
├── docker-compose.yml               # bitcoind testnet + LND v0.18.2 + Redis
├── lnd.conf                         # REST 8080, gRPC 10009, keysend
├── bitcoin.conf                     # testnet, ZMQ, pruned 2GB
└── README.md                        # Full deployment guide

V3/L3/warp/scripts/lightning/        # ✅ CREATED — Channel management
├── open_channel.sh
├── list_channels.sh
├── get_macaroon.sh
├── create_invoice.sh
└── pay_invoice.sh

edge-deploy/systemd/
└── zion-edge-lnd.service            # ✅ CREATED — LND systemd service

APP&WEB/website-v2.9/src/app/dex/   # ✅ Live Beta — swap UI + liquidity + portfolio
APP&WEB/website-v2.9/src/app/ziondex/ # ✅ Live Beta — landing page
APP&WEB/mobile-app/src/screens/DexScreen.js # ✅ Built — React Native swap screen
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

## 16. Deployment Plan (2026-07-12)

> **Goal:** Nasadit ZionDex Router + LND na Edge server, připravit kontrakty pro deploy na všechny chainy.
> **Edge server:** `62.171.141.136` (SSH: `ssh zion-new`)
> **Port map:** [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md) §7 — žádné konflikty ověřeny

### Phase A: Edge Server Deploy (LND + ZionDex Router)

#### A.1 — Lightning Network (LND) na Edge

**Cíl:** Rozchodit LND node na testnet, otevřít kanály, napojit WARP adapter.

**Krok 1: Sync repa na Edge**
```bash
ssh zion-new
cd /root/Zion-v3.0.0  # nebo git pull
git pull origin main
```

**Krok 2: Spustit Docker compose (bitcoind + LND)**
```bash
cd /root/Zion-v3.0.0/V3/L3/warp/docker/lightning
docker compose up -d

# Sleduj sync (testnet ~30 min)
docker compose logs -f lnd
```

**Krok 3: Vytvořit LND wallet**
```bash
docker exec -it lnd lncli create
# → Vygeneruje seed, password, ulož bezpečně
```

**Krok 4: Počkat na sync + otevřít kanál**
```bash
# Zkontroluj sync status
docker exec -it lnd lncli getinfo

# Otevři kanál (testnet, ACINQ node, 500k sats)
/root/Zion-v3.0.0/V3/L3/warp/scripts/lightning/open_channel.sh

# Zkontroluj kanály
/root/Zion-v3.0.0/V3/L3/warp/scripts/lightning/list_channels.sh
```

**Krok 5: Extrahovat macaroon + nastavit env vars**
```bash
MACAROON=$(/root/Zion-v3.0.0/V3/L3/warp/scripts/lightning/get_macaroon.sh)

# Přidat do /root/.env.warp
cat >> /root/.env.warp << EOF
WARP_LN_NODE_URL=https://127.0.0.1:8080
WARP_LN_MACAROON=$MACAROON
WARP_LN_TLS_CERT=/root/.lnd/tls.cert
EOF

# Restart WARP
systemctl restart zion-warp
```

**Krok 6: Aktivovat systemd service**
```bash
cp /root/Zion-v3.0.0/edge-deploy/systemd/zion-edge-lnd.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable zion-edge-lnd
systemctl start zion-edge-lnd
systemctl status zion-edge-lnd
```

**Krok 7: Ověřit health check**
```bash
curl http://127.0.0.1:8453/health | jq '.adapters.lightning'
# → { "status": "ok", "alias": "...", "channels": 1, "outbound_msat": 500000000 }
```

**Odhad:** 1-2 hodiny (sync je bottleneck)

---

#### A.2 — ZionDex Router na Edge (port 8454)

**Cíl:** Běžící Router service na Edge, napojená na WARP (8453) + L1 node (9443).

**Krok 1: Build Rust binárky na Edge**
```bash
ssh zion-new
cd /root/Zion-v3.0.0/ZionDex/router
cargo build --release --bin ziondex-router
# → target/release/ziondex-router
```

**Krok 2: Vytvořit konfiguraci**
```bash
cat > /root/.env.ziondex << 'EOF'
ZIONDEX_ROUTER_PORT=8454
ZIONDEX_WARP_API_URL=http://127.0.0.1:8453
ZIONDEX_L1_RPC_URL=http://127.0.0.1:9443
ZIONDEX_BASE_RPC=https://mainnet.base.com
ZIONDEX_ARB_RPC=https://arb1.arbitrum.io/rpc
ZIONDEX_BSC_RPC=https://bsc-dataseed.binance.org
ZIONDEX_POLY_RPC=https://polygon-rpc.com
ZIONDEX_OP_RPC=https://mainnet.optimism.io
ZIONDEX_AVAX_RPC=https://api.avax.network/ext/bc/C/rpc
ZIONDEX_SOL_RPC=https://api.mainnet-beta.solana.com
RUST_LOG=info
EOF
```

**Krok 3: Vytvořit systemd service**
```bash
cat > /etc/systemd/system/zion-ziondex-router.service << 'EOF'
[Unit]
Description=ZionDex Router — Cross-chain DEX router
After=network-online.target zion-warp.service
Wants=network-online.target
Requires=zion-warp.service

[Service]
Type=simple
User=root
EnvironmentFile=/root/.env.ziondex
ExecStart=/root/Zion-v3.0.0/ZionDex/router/target/release/ziondex-router
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable zion-ziondex-router
systemctl start zion-ziondex-router
```

**Krok 4: Ověřit**
```bash
# Health check
curl http://127.0.0.1:8454/health
# → { "status": "ok", "warp": "connected", "chains": [...] }

// Multi-path quote test
curl "http://127.0.0.1:8454/quote/multi?from_chain=base&from_token=wZION&to_chain=solana&to_token=USDC&amount=100"
# → { "paths": [...3 paths...], "recommended_path_index": 0 }

// Service status
systemctl status zion-ziondex-router
```

**Krok 5: nginx proxy (optional — veřejný přístup)**
```nginx
# /etc/nginx/sites-available/ziondex.conf
server {
    listen 443 ssl http2;
    server_name dex.zionterranova.com;

    ssl_certificate /etc/letsencrypt/live/zionterranova.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zionterranova.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8454;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Odhad:** 30-45 min (build je bottleneck)

---

### Phase B: Non-EVM Contract Deployment

> **Předpoklad:** Každý chain potřebuje nativní token na gas fees.
> **Adresy po deploy:** Vyplň v [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md)
> **Po každém deploy:** `systemctl restart zion-warp` + `curl http://127.0.0.1:8453/health`

#### B.1 — Bitcoin WARP HTLC (PRIORITY 1)

**Co:** BTC je watch-only chain. User pošle BTC na HTLC address, WARP mintne ZION na L1.

**Potřebné:**
- 5 veřejných klíčů WARP validátorů (Ed25519 → secp256k1 konverze)
- Vygenerovat 5-of-5 P2WSH multisig address

**Steps:**
```bash
# 1. Získej 5 validator pubkeys (secp256k1)
# Každý validator: openssl ecparam -genkey -name secp256k1 | openssl ec -pubout

# 2. Vytvoř multisig address
bitcoin-cli -mainnet createmultisig 5 '["pub1","pub2","pub3","pub4","pub5"]' bech32
# → { "address": "bc1q...", "redeemScript": "..." }

# 3. Nastav env vars na Edge
echo "WARP_BTC_HTLC_ADDRESS=bc1q..." >> /root/.env.warp
echo "WARP_BTC_RELAY_KEY=<WIF private key>" >> /root/.env.warp

# 4. Restart WARP
systemctl restart zion-warp

# 5. Ověř
curl http://127.0.0.1:8453/health | jq '.adapters.bitcoin'
```

**HTLC flow:**
```
User → BTC to HTLC address + OP_RETURN: WARP_INBOUND:bitcoin:<zion1_recipient>
     → 6 confirmations
     → WARP validators detect + sign
     → submitBridgeUnlock on L1
     → ZION minted to recipient
```

**Gas cost:** 0 (Bitcoin — jen TX fee pro relay)

---

#### B.2 — Solana SPL Token (PRIORITY 2)

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/solana/zion_spl_token.rs`
**Potřebné:** ~2 SOL na deploy (mainnet)

**Steps:**
```bash
# 1. Nainstaluj Anchor CLI
npm install -g @coral-xyz/anchor-cli

# 2. Build + deploy
cd V3/L2/bridge/contracts/non-evm/solana
anchor build
anchor deploy --provider.cluster mainnet
# → Program ID: <base58>

# 3. Vytvoř ZION mint
# (program automaticky vytvoří mint při první bridgeMint)

# 4. Nastav env vars
echo "WARP_SOL_ZION_MINT=<mint_pubkey>" >> /root/.env.warp
echo "WARP_SOL_BRIDGE_PROGRAM=<program_id>" >> /root/.env.warp
echo "WARP_SOL_RELAY_KEY=<base58_keypair>" >> /root/.env.warp

# 5. Restart WARP
systemctl restart zion-warp
```

**Gas cost:** ~2 SOL (~$300)

---

#### B.3 — Tron TRC-20 (PRIORITY 3)

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/tron/ZionToken.sol`
**Potřebné:** ~500-1000 TRX na deploy + energy

**Steps:**
```bash
# 1. Nainstaluj TronBox
npm install -g tronbox

# 2. Build + deploy
cd V3/L2/bridge/contracts/non-evm/tron
tronbox compile
tronbox migrate --network mainnet
# → Contract address: T...

# 3. Nastav env vars
echo "WARP_TRON_ZION_CONTRACT=<T_address>" >> /root/.env.warp
echo "WARP_TRON_RELAY_KEY=<hex_private_key>" >> /root/.env.warp

# 4. Restart WARP
systemctl restart zion-warp
```

**Gas cost:** ~500-1000 TRX (~$50-100)

---

#### B.4 — Stellar Asset (PRIORITY 4)

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/stellar/zion_asset.toml` + `setup_zion_asset.py`
**Potřebné:** ~10 XLM na account reserve

**Steps:**
```bash
# 1. Nainstaluj Stellar CLI + Python SDK
pip install stellar-sdk

# 2. Vytvoř issuer account
stellar keys generate issuer
# → G... (public), S... (secret)

# 3. Spusť setup script
cd V3/L2/bridge/contracts/non-evm/stellar
python3 setup_zion_asset.py --network mainnet --issuer-seed S...

# 4. Nastav env vars
echo "WARP_STELLAR_ZION_ISSUER=<G_pubkey>" >> /root/.env.warp
echo "WARP_STELLAR_BRIDGE_ACCOUNT=<G_pubkey>" >> /root/.env.warp
echo "WARP_STELLAR_RELAY_KEY=<base64_seed>" >> /root/.env.warp

# 5. Restart WARP
systemctl restart zion-warp
```

**Gas cost:** ~10 XLM (~$1)

---

#### B.5 — Cardano Native Token (PRIORITY 5)

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/cardano/mint_zion_token.hs`
**Potřebné:** ~2 ADA na TX fee + UTxO

**Steps:**
```bash
# 1. Nainstaluj cardano-cli
# 2. Vygeneruj payment + policy keys
cardano-cli address key-gen --verification-key-file pay.vkey --signing-key-file pay.skey
cardano-cli address key-gen --verification-key-file policy.vkey --signing-key-file policy.skey

# 3. Vytvoř policy script
cat > policy.script << 'EOF'
{ "type": "sig", "keyHash": "<policy_key_hash>" }
EOF

# 4. Mint ZION token
cardano-cli transaction mint \
  --mint "100000000000 ZION" \
  --mint-script-file policy.script \
  --tx-in <tx_hash>#0 \
  --tx-out <payment_addr> + 100000000000 ZION \
  --out-file mint.txbody \
  --testnet-magic 1  # nebo --mainnet

# 5. Nastav env vars
echo "WARP_CARDANO_POLICY_ID=<policy_hash>" >> /root/.env.warp
echo "WARP_CARDANO_PAYMENT_KEY=<hex_skey>" >> /root/.env.warp
echo "WARP_CARDANO_POLICY_KEY=<hex_skey>" >> /root/.env.warp
echo "BLOCKFROST_PROJECT_ID=<project_id>" >> /root/.env.warp

# 6. Restart WARP
systemctl restart zion-warp
```

**Gas cost:** ~2 ADA (~$0.70)

---

#### B.6 — Cosmos CW20 (PRIORITY 6)

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/cosmos/zion_cw20.rs`
**Potřebné:** chain token na deploy (cosmoshub ~100 ATOM)

**Steps:**
```bash
# 1. Build wasm
cd V3/L2/bridge/contracts/non-evm/cosmos
cargo build --release --target wasm32-unknown-unknown
# → zion_cw20.wasm

# 2. Upload code
wasmd tx wasm store zion_cw20.wasm --from relay --chain-id cosmoshub-4 --gas auto
# → Code ID: <N>

# 3. Instantiate contract
wasmd tx wasm instantiate <N> '{"name":"ZION","symbol":"ZION","decimals":6,"initial_balances":[]}' --from relay
# → Contract address: cosmos1...

# 4. Nastav env vars
echo "WARP_COSMOS_ZION_CONTRACT=<cosmos1_addr>" >> /root/.env.warp
echo "WARP_COSMOS_RELAY_KEY=<base64_key>" >> /root/.env.warp

# 5. Restart WARP
systemctl restart zion-warp
```

**Gas cost:** ~100 ATOM (~$500) — nebo použij cheaper chain (Archway/Nibiru)

---

#### B.7 — Aptos Move Coin (PRIORITY 7)

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/aptos/sources/zion_coin.move`
**Potřebné:** ~1 APT na deploy

**Steps:**
```bash
# 1. Nainstaluj Aptos CLI
curl -fsSL https://aptos.dev/scripts/install_cli.py | python3

# 2. Build + publish
cd V3/L2/bridge/contracts/non-evm/aptos
aptos move publish --named-addresses zion_coin=<bridge_account> --profile mainnet
# → Package object ID: 0x...

# 3. Nastav env vars
echo "WARP_APTOS_BRIDGE_ACCOUNT=<0x_addr>" >> /root/.env.warp
echo "WARP_APTOS_EVENT_HANDLE=<0x...::zion_coin::BridgeBurnEvent>" >> /root/.env.warp
echo "WARP_APTOS_RELAY_KEY=<hex_ed25519_seed>" >> /root/.env.warp

# 4. Restart WARP
systemctl restart zion-warp
```

**Gas cost:** ~1 APT (~$8)

---

#### B.8 — Sui Move Coin (PRIORITY 8)

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/sui/sources/zion_coin.move`
**Potřebné:** ~50 SUI na deploy

**Steps:**
```bash
# 1. Nainstaluj Sui CLI
cargo install --git https://github.com/MystenLabs/sui sui

# 2. Build + publish
cd V3/L2/bridge/contracts/non-evm/sui
sui client publish --gas-budget 100000000
# → Package ID: 0x...

# 3. Nastav env vars
echo "WARP_SUI_PACKAGE=<0x_package_id>" >> /root/.env.warp
echo "WARP_SUI_RELAY_KEY=<hex_ed25519_seed>" >> /root/.env.warp

# 4. Restart WARP
systemctl restart zion-warp
```

**Gas cost:** ~50 SUI (~$100)

---

#### B.9 — NEAR NEP-141 (PRIORITY 9)

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/near/zion_token.rs`
**Potřebné:** ~10 NEAR na account + storage

**Steps:**
```bash
# 1. Build wasm
cd V3/L2/bridge/contracts/non-evm/near
cargo build --release --target wasm32-unknown-unknown
# → zion_token.wasm

# 2. Vytvoř account + deploy
near create-account zion.near --masterAccount relay.near --initialBalance 10
near deploy --accountId zion.near --wasmFile zion_token.wasm

# 3. Nastav env vars
echo "WARP_NEAR_ZION_CONTRACT=zion.near" >> /root/.env.warp
echo "WARP_NEAR_SIGNER_ACCOUNT=relay.near" >> /root/.env.warp
echo "WARP_NEAR_RELAY_KEY=<base64_ed25519>" >> /root/.env.warp

# 4. Restart WARP
systemctl restart zion-warp
```

**Gas cost:** ~10 NEAR (~$15)

---

#### B.10 — TON Jetton (PRIORITY 10)

**Kontrakt:** `V3/L2/bridge/contracts/non-evm/ton/zion_jetton.fc`
**Potřebné:** ~5 TON na deploy

**Steps:**
```bash
# 1. Nainstaluj toncli nebo blueprint
npm install -g @ton/blueprint

# 2. Build + deploy
cd V3/L2/bridge/contracts/non-evm/ton
toncli deploy -n mainnet
# → Jetton master: EQ...
# → Bridge wallet: EQ...

# 3. Nastav env vars
echo "WARP_TON_JETTON_MASTER=<EQ_addr>" >> /root/.env.warp
echo "WARP_TON_BRIDGE_WALLET=<EQ_addr>" >> /root/.env.warp
echo "WARP_TON_RELAY_KEY=<hex_ed25519>" >> /root/.env.warp

# 4. Restart WARP
systemctl restart zion-warp
```

**Gas cost:** ~5 TON (~$12)

---

### Phase C: ZionDex AMM Contracts on Base (Q1 2027)

**Cíl:** Deploy ZionDexPoolManager + Hooks + Router + ZDX + Staking na Base mainnet.

**Kontrakty:** `ZionDex/contracts/`
**Deploy script:** `ZionDex/contracts/script/DeployBase.s.sol`

**Steps:**
```bash
cd ZionDex/contracts
forge script script/DeployBase.s.sol --rpc-url $BASE_RPC --broadcast --verify
# → PoolManager: 0x...
# → Hooks: 0x...
# → Router: 0x...
# → ZDX: 0x...
# → Staking: 0x...
```

**Po deploy:** Vyplň adresy v CONTRACT_ADDRESSES.md, restart ZionDex Router.

---

### Deployment Summary

| Phase | Task | Est. Time | Est. Cost | Priority |
|-------|------|-----------|-----------|----------|
| A.1 | LND na Edge (testnet) | 1-2h | 0 (testnet) | P0 |
| A.2 | ZionDex Router na Edge | 30-45min | 0 | P0 |
| B.1 | BTC WARP HTLC | 30min | 0 (jen TX fee) | P1 |
| B.2 | Solana SPL | 1h | ~$300 (2 SOL) | P2 |
| B.3 | Tron TRC-20 | 1h | ~$50-100 | P2 |
| B.4 | Stellar Asset | 30min | ~$1 (10 XLM) | P3 |
| B.5 | Cardano Native | 1h | ~$0.70 (2 ADA) | P3 |
| B.6 | Cosmos CW20 | 1h | ~$500 (100 ATOM) | P4 |
| B.7 | Aptos Move | 1h | ~$8 (1 APT) | P4 |
| B.8 | Sui Move | 1h | ~$100 (50 SUI) | P4 |
| B.9 | NEAR NEP-141 | 1h | ~$15 (10 NEAR) | P4 |
| B.10 | TON Jetton | 1h | ~$12 (5 TON) | P4 |
| C | ZionDex AMM on Base | 1h | ~$50 (gas) | Q1 2027 |

**Celkový odhad:** Phase A = 2-3h (hned), Phase B = 8-10h (postupně), Phase C = Q1 2027

---

## 17. References

- **Contract addresses template:** [`docs/3.0.5/CONTRACT_ADDRESSES.md`](./docs/3.0.5/CONTRACT_ADDRESSES.md) — all chain addresses, env vars, deploy steps
- **Existing concept doc:** `docs/3.0.3/ZionDex.md`
- **WARP architecture:** `docs/WARP_ARCHITECTURE.md`
- **WARP Lightning plan:** `docs/WARP_LIGHTNING_PLAN.md`
- **Non-EVM contracts:** `V3/L2/bridge/contracts/non-evm/` — 9 chains, 19 files
- **LND Docker setup:** `V3/L3/warp/docker/lightning/` — docker-compose, lnd.conf, bitcoin.conf
- **LND scripts:** `V3/L3/warp/scripts/lightning/` — channel management
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
