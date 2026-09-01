# On-Chain Internal ZionDex with ZIS — Design Document

**Date:** 2026-08-31
**Author:** Devin + Operator
**Status:** Design Proposal

## Vision

Build an on-chain internal DEX (ZionDex) that works like Uniswap V2 but is deeply integrated with ZIS (ZION Identity Service) for user identity, access control, and fee management. The DEX lives on-chain (Base + other EVM L2s), is non-custodial, and uses ZIS for user-facing auth while keeping the AMM logic fully on-chain.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User (Browser/CLI)                        │
│                    Auth via ZIS (Cookie/Bearer)                   │
└──────────────┬──────────────────────────────────────┬────────────┘
               │                                       │
               ▼                                       ▼
┌──────────────────────┐                  ┌─────────────────────────┐
│   ZIS Identity Svc   │                  │  ZionDex Frontend/API   │
│  (auth.zionterra..)  │                  │  (dex.zionterra..)      │
│  - Google OAuth      │                  │  - Quote API            │
│  - API keys (zis_)   │                  │  - Swap routing         │
│  - Session cookies   │                  │  - Liquidity dashboard  │
└──────────┬───────────┘                  └────────┬────────────────┘
           │                                       │
           │ ZIS verifies user                     │ Routes via on-chain
           │ → returns userId + linked addresses   │ AMM + optional solver
           ▼                                       ▼
┌──────────────────────┐                  ┌─────────────────────────┐
│  ZIS Linked Addresses│                  │  On-Chain ZionDex       │
│  (PostgreSQL)        │                  │  (Base / Arbitrum / ...)│
│  - EVM addresses     │                  │                         │
│  - Solana addresses  │                  │  ZIONDexFactory         │
│  - ZION L1 addresses │                  │  ├── ZIONDexPair (tZION │
└──────────────────────┘                  │  │   / tUSDT)           │
                                          │  ├── ZIONDexPair (tZION │
                                          │  │   / tWETH)           │
                                          │  ├── ZIONDexRouter      │
                                          │  │   (swap + LP)        │
                                          │  └── ZIONDexZISGate     │
                                          │      (ZIS-gated access) │
                                          └─────────────────────────┘
```

## Key Differences from Uniswap

| Feature | Uniswap V2 | ZionDex |
|---------|-----------|---------|
| Access | Permissionless | ZIS-gated (optional) |
| Fee | 0.3% to LPs | 0.3% (configurable: LPs + protocol cut) |
| Identity | Anonymous | ZIS-linked addresses |
| Router | Universal router | ZionDexRouter (ZIS-aware) |
| Fee recipient | LPs only | LPs + ZION protocol treasury |
| Cross-chain | No | Native via WARP bridge edges |
| User experience | Wallet connect | ZIS SSO + linked wallet |

## Smart Contract Architecture

### 1. ZIONDexFactory

```solidity
contract ZIONDexFactory {
    mapping(bytes32 => address) public getPair;  // keccak(token0, token1) → pair
    address[] public allPairs;
    address public feeTo;          // Protocol fee recipient (ZION treasury)
    address public feeToSetter;    // Governance / multisig
    uint256 public protocolFeeBps; // e.g. 5 = 0.05% of the 0.3% fee

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);

    function createPair(address tokenA, address tokenB) external returns (address pair);
    function setFeeTo(address) external;
    function setProtocolFeeBps(uint256) external;
}
```

### 2. ZIONDexPair (Uniswap V2 clone with protocol fee)

```solidity
contract ZIONDexPair {
    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    // Standard Uniswap V2 swap + LP
    function swap(uint amount0Out, uint amount1Out, address to) external;
    function addLiquidity(uint amount0, uint amount1) external;
    function removeLiquidity(uint lpAmount) external returns (uint, uint);

    // Protocol fee: mint k-share to feeTo during swap
    function _mintFee() internal;
}
```

### 3. ZIONDexRouter (ZIS-aware)

```solidity
contract ZIONDexRouter {
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
        address recipient;
        uint256 deadline;
    }

    // Standard swap (anyone can call)
    function swapExactTokensForTokens(SwapParams calldata params)
        external returns (uint[] memory amounts);

    // ZIS-gated swap (only ZIS-verified users)
    function swapWithZISProof(
        SwapParams calldata params,
        bytes calldata zisProof  // Ed25519 signature from ZIS
    ) external returns (uint[] memory amounts);

    // Liquidity provision
    function addLiquidity(
        address tokenA, address tokenB,
        uint256 amountADesired, uint256 amountBDesired,
        uint256 amountAMin, uint256 amountBMin
    ) external returns (uint liquidity);

    function removeLiquidity(
        address tokenA, address tokenB,
        uint256 liquidity
    ) external returns (uint amountA, uint amountB);
}
```

### 4. ZIONDexZISGate (optional access control)

```solidity
contract ZIONDexZISGate {
    // ZIS public key (Ed25519) for verifying user proofs
    bytes32 public zisPublicKey;

    // Mapping: userAddress → zisUserId (optional)
    mapping(address => bytes32) public linkedUsers;

    // ZIS signs: keccak256(userId, userAddress, deadline)
    function verifyZISProof(
        address user,
        bytes32 userId,
        uint256 deadline,
        bytes calldata signature
    ) external view returns (bool);

    // Gate functions
    function canSwap(address user) external view returns (bool);
    function canProvideLiquidity(address user) external view returns (bool);
}
```

## ZIS Integration Flow

### User Swap Flow (ZIS-authenticated)

```
1. User logs in via ZIS (Google OAuth → zion_session cookie)
2. User links EVM wallet to ZIS account (LinkedAddress table)
3. User requests swap via ZionDex API:
   GET /v1/dex/quote?from=tZION&to=tUSDT&amount=1
4. API returns quote (from on-chain reserves)
5. User signs swap transaction with their wallet
6. Transaction submitted to ZIONDexRouter on-chain
7. On-chain: AMM executes, output sent to user's wallet
8. API polls tx receipt, updates order status
```

### Custodial Swap Flow (ZIS-authenticated, hot wallet)

```
1. User logs in via ZIS (API key or cookie)
2. User has custodial balance in warp_multichain.db
3. User requests swap via API:
   POST /v1/swap/execute-v2
   Authorization: Bearer zis_...
4. SwapExecutor checks pool.amm_pair
5. If amm_pair set:
   a. Debit input from user's internal ledger
   b. Hot wallet executes on-chain AMM swap
   c. Output sent to hot wallet (custodial) or user's linked address
   d. Credit output to user's internal ledger
6. If no amm_pair: fall back to in-memory AMM (current behavior)
```

### Liquidity Provider Flow

```
1. LP deposits tokens into ZIONDexPair via Router.addLiquidity()
2. LP receives LP tokens (ERC-20)
3. LP earns 0.25% fee on every swap (0.3% - 0.05% protocol)
4. LP can withdraw anytime via Router.removeLiquidity()
5. LP position tracked on-chain (no ZIS needed for LP)
```

## Fee Structure

```
Total swap fee: 0.3% (30 bps)
├── LP fee:       0.25% (25 bps) → to LP token holders
└── Protocol fee: 0.05% (5 bps)  → to ZION treasury (feeTo)
```

Protocol fee is configurable via `factory.setProtocolFeeBps()`. Default 5 bps.

## Cross-Chain Integration

ZionDex pairs exist per-chain. Cross-chain swaps use the existing WARP bridge:

```
User wants: tZION (Base) → tUSDT (Arbitrum)

1. Quote: tZION(Base) → bridge → tZION(Arbitrum) → AMM → tUSDT(Arbitrum)
2. Step 1: On-chain swap tZION(Base) → tZION(Base) [if needed]
3. Step 2: Bridge tZION(Base) → tZION(Arbitrum) via WARP
4. Step 3: On-chain swap tZION(Arbitrum) → tUSDT(Arbitrum) via AMM
5. Output delivered to user's Arbitrum address
```

## Implementation Plan

### Phase A: On-Chain Contracts (1-2 days)
1. Write `ZIONDexFactory.sol` (with protocol fee)
2. Write `ZIONDexPair.sol` (Uniswap V2 clone + protocol fee mint)
3. Write `ZIONDexRouter.sol` (swap + LP + multi-hop)
4. Write `ZIONDexZISGate.sol` (optional ZIS proof verification)
5. Deploy on Base, verify on Basescan
6. Add liquidity to initial pairs

### Phase B: API Integration (1-2 days)
1. Add `/v1/dex/quote` endpoint (reads on-chain reserves)
2. Add `/v1/dex/pools` endpoint (lists all pairs + reserves)
3. Modify `/v1/swap/execute-v2` to use on-chain AMM when available
4. Add `/v1/dex/liquidity/add` and `/v1/dex/liquidity/remove` endpoints
5. Integrate ZIS linked addresses for recipient resolution

### Phase C: Frontend (2-3 days)
1. Swap UI (like Uniswap interface)
2. Liquidity dashboard (add/remove LP)
3. Pool stats (TVL, volume, fees)
4. ZIS login integration
5. Wallet connection (MetaMask / WalletConnect)

### Phase D: Multi-Chain (1-2 days)
1. Deploy contracts on Arbitrum, Optimism, BSC
2. Configure bridge edges in DEX config
3. Test cross-chain swap routing
4. Update `warp.toml` with new chain configs

## Security Considerations

1. **Reentrancy:** All swap functions use checks-effects-interactions pattern
2. **Front-running:** Use `amountOutMin` + deadline in all swaps
3. **ZIS proof replay:** Include deadline + nonce in ZIS signatures
4. **Protocol fee governance:** `feeToSetter` should be a multisig or DAO
5. **LP token safety:** Standard ERC20 LP tokens, no special transfer restrictions
6. **Integer overflow:** Use Solidity 0.8.x checked arithmetic

## Comparison: Current State vs Target

| Aspect | Current (Phase 1+2) | Target (On-Chain ZionDex) |
|--------|--------------------|--------------------------|
| AMM | In-memory + on-chain swap | Fully on-chain |
| Liquidity | Hot wallet provides | Community LPs + hot wallet |
| User funds | Custodial (internal ledger) | Non-custodial (user wallet) |
| Fees | In-memory (no real fee) | On-chain (0.3% split LP/protocol) |
| Identity | ZIS API key | ZIS SSO + linked wallets |
| Cross-chain | Not yet | WARP bridge integration |
| Frontend | API only | Full swap UI |

## Conclusion

The current Phase 1+2 work proves the concept: on-chain AMM swaps work, withdrawals work, and the Rust integration is functional. The next step is to build the full Uniswap-like experience with ZIS integration, community liquidity, and a proper frontend. The architecture above provides a clear path from the current hybrid model to a fully on-chain, non-custodial DEX.
