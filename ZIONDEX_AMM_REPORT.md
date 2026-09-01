# ZionDex On-Chain AMM Integration Report

**Date:** 2026-08-31
**Status:** Phase 1 + Phase 2 Complete (Base chain)

## Summary

This report documents the deployment of test tokens, an on-chain AMM (Uniswap V2 fork), and the integration of on-chain AMM swaps into the ZionDex multichain wallet. The work enables real on-chain swaps and withdrawals on Base, moving from a purely custodial DEX to a hybrid architecture.

## Phase 1: Test Token Deployment + Withdrawals

### Deployed Contracts (Base Mainnet)

| Contract | Address | Decimals |
|----------|---------|----------|
| tZION (Test ZION) | `0xC5E79b8C6475137aC3a982651097a219B63b0c33` | 18 |
| tUSDT (Test USDT) | `0x677693fbFDe6a9EeA655033fffF93054B559552C` | 6 |
| tWETH (Test WETH) | `0xcE5Df8e83B87f462835b51Ac6B2A4c53fafA620F` | 18 |
| tSOL (Test SOL) | `0xcD30a4f1657f6378c9b2F337785B93505Cd81cC8` | 9 |

All tokens are ERC-20 with a `mint(address,uint256)` function (owner-gated).

### Withdrawal Test Results

All 4 test tokens were successfully withdrawn from the custodial wallet to an on-chain recipient:

| Token | Amount | TX Hash | Status |
|-------|--------|---------|--------|
| tUSDT | 100.0 | `0x8db5c345084bd7a52b9300e1acacc28e08f723c08fb5c8432fe896bf2543a053` | ✅ Verified |
| tWETH | 0.001 | `0x8da8d2b66cdfc2dcc6147e87a6ff86d8b9f3998427961761955bb70e5dbdbc29` | ✅ Verified |
| tSOL | 1.0 | `0x4961638f9fd2b30444882413b0d7e11784429d92911aec779b07c36ad2b8430c` | ✅ Verified |
| tZION | 0.1 | `0xf9a50488c034c872deebf3cd97f919f5ec84177094e1d64bcf36e6b7b59e6f79` | ✅ Verified |

Recipient `0xC8174C30C5b56Bc9a93AFcD071E7c40Ac51Bc7f9` on-chain balances verified.

## Phase 2: On-Chain AMM Deployment + Integration

### ZIONAMM Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| ZIONAMMFactory (v2, fixed K) | `0x40F712eB1C5b05f897c58451Cb280d2E97f77060` |
| Pair tZION/tUSDT | `0x0628Ae0D23e3332Fd1507802d17dc9fF7a705C55` |
| Pair tZION/tWETH | `0xDFf829D987174E7fcc1DD98B8e4316536E18DfB2` |
| Pair tUSDT/tWETH | `0x8E8543308b80b66F01674e39F95D9B75728a9E08` |

### Liquidity

| Pair | Reserve A | Reserve B |
|------|-----------|-----------|
| tZION/tUSDT | 10,000 tZION | 200,000 tUSDT |
| tZION/tWETH | 10,000 tZION | 10 tWETH |
| tUSDT/tWETH | 200,000 tUSDT | 10 tWETH |

### K Invariant Fix

The initial AMM contract had a bug in the constant product (K) check:
- **Bug:** Used `FEE_NUMERATOR` (997) instead of `FEE_DENOMINATOR` (1000) for balance adjustment
- **Fix:** Corrected to Uniswap V2 formula: `balanceAdjusted = balance * 1000 - amountIn * 3`
- **Result:** On-chain swap verified: 1 tZION → 19.938 tUSDT (TX `0xe5db0fcc...`)

### On-Chain AMM Swap Test

Direct on-chain swap through the AMM pair contract:
- Input: 1 tZION
- Output: 19.938012 tUSDT
- TX: `0xe5db0fccfb3ac57a95dbbb91a6c1502055fbb0a6c59971344cd03648ba9d9aa9`
- Status: ✅ Success (status=1)

## Rust Code Changes

### New: `amm_swap` on ChainAdapter trait

Added `amm_swap()` method to the `ChainAdapter` trait with a default "not supported" implementation. The EVM adapter implements it by:
1. Querying `token0()` to determine swap direction
2. Querying `getReserves()` and `getAmountOut()` for pricing
3. Transferring input tokens to the pair contract
4. Calling `swap(amount0Out, amount1Out, recipient)` on the pair

### Modified: Pool struct

Added `amm_pair: Option<String>` and `amm_factory: Option<String>` fields to the `Pool` struct. When `amm_pair` is set and the swap is same-chain, the `SwapExecutor` executes the swap on-chain instead of in-memory.

### Modified: SwapExecutor

The `execute_swap` method now checks if the matching pool has an `amm_pair` contract. If so:
- **With recipient:** Executes on-chain AMM swap, output sent directly to recipient
- **Without recipient (custodial):** Executes on-chain AMM swap, output sent to hot wallet, internal ledger credited

### Files Changed

- `src/chain/adapter.rs` — Added `amm_swap` to trait + `MultichainError` import
- `src/chain/adapters/evm.rs` — Implemented `amm_swap` for EVM chains
- `src/swap/dex.rs` — Added `amm_pair`/`amm_factory` to `Pool` struct
- `src/swap/dex/swap_executor.rs` — On-chain AMM swap integration
- `src/swap/dex/intent.rs` — Fixed `u8` AsRef<[u8]> issue
- `src/warp/error.rs` — Added `Validation` variant to `WarpError`
- `src/warp/runtime.rs` — Fixed `with_db` call signature
- `src/db.rs`, `src/reconciliation.rs`, `src/swap/dex/aggregator.rs`, `src/swap/dex/intent_engine.rs` — Updated Pool constructions

### Test Results

```
585 passed; 1 failed; 1 ignored
```

The 1 failure (`htlc_persists_and_reloads_from_db`) is a pre-existing issue unrelated to AMM changes (HTLC source lock confirmation requires on-chain adapter).

## DEX Configuration

The `warp_multichain.db` pools table was updated with AMM pair addresses:

```sql
-- Pool 1: tZION/tUSDT
amm_pair = '0x0628Ae0D23e3332Fd1507802d17dc9fF7a705C55'
amm_factory = '0x40F712eB1C5b05f897c58451Cb280d2E97f77060'

-- Pool 2: tZION/tWETH
amm_pair = '0xDFf829D987174E7fcc1DD98B8e4316536E18DfB2'

-- Pool 3: tUSDT/tWETH
amm_pair = '0x8E8543308b80b66F01674e39F95D9B75728a9E08'
```

## ZIS Authentication

Created ZIS API key for the test user (`cmt5tjxu6000550iut2freqah`):
- Key: `zis_devin_test_1788220697_f0bf507e63e5484f`
- Stored in PostgreSQL `ApiKey` table (SHA-256 hashed)
- Used via `Authorization: Bearer zis_...` header

## Next Steps

### Phase 3: Multi-Chain Expansion
- Deploy test tokens + AMM on Arbitrum, Optimism, BSC
- Enable chains in `warp.toml`
- Test cross-chain swaps via bridge edges

### On-Chain Internal ZionDex with ZIS (Design Below)
See `ZIONDEX_ONCHAIN_DESIGN.md` for the full design of a Uniswap-like on-chain DEX with ZIS integration.
