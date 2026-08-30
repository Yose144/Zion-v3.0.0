# ZionDex — On-Chain Settlement Plan

> **Scope:** This document records the real on-chain state of Base contracts, the decision to move ZionDex from an in-memory AMM to a custodial-but-on-chain DEX, and the concrete next steps for implementation.

---

## 1. Decision

ZionDex will move from the current **in-memory `DexRouter` model** (database reserve tables only) to a **custodial, on-chain settled model**:

- Users deposit real tokens to per-user Base addresses.
- The L2 multichain hot wallet holds the real tokens.
- Swaps are executed **on-chain via a Uniswap V3 / PancakeSwap V3 router**.
- Internal ledger tracks ownership, but prices come from the actual on-chain DEX.
- Withdrawals send real tokens from the hot wallet to the user.

This is option **A)** from the 2026-08-29 discussion: *custodial with real on-chain swaps*.

---

## 2. Why the current in-memory model is not safe for real users

- `DexRouter` is a `Vec<Pool>` in memory, loaded from SQLite `pools`.
- `Pool` reserves are just `Amount` numbers in `V31/L2/multichain/src/swap/dex.rs`.
- `SwapExecutor::execute` in `V31/L2/multichain/src/swap/dex/swap_executor.rs` debits the user, updates these in-memory reserves, and only afterwards attempts an on-chain `transfer_token`.
- If the hot wallet is empty, the swap fails after the ledger was already updated; the user is left with an internal balance that may not be backed by real tokens.
- This is acceptable for mock tests but **not acceptable for a production service with 1000+ users** unless there is 1:1 backing and strict solvency controls.

---

## 3. On-chain reality on Base Mainnet

All data verified via public Base RPC (`https://mainnet.base.org`) on 2026-08-29.

### Hot wallet

- **Address:** `0x3903763b50F32A50E35e94FC63ecb291c30DcEaC`
- **ETH balance:** `0`
- **wZION balance:** `0`
- **USDC balance:** `0`
- **USDT balance:** `0`

### wZION contract (`0x0c493763…2bb6`)

- `totalSupply`: `216 671 771.73 wZION` (18 decimals)
- `bridgeStats()`:
  - `totalMinted`: `216 671 971.73`
  - `totalBurned`: `200`
  - `netSupply`: `216 671 771.73`
- `mintableSupply()`: `143 783 328 228.27 wZION` (still mintable by the bridge)

### Where the wZION actually lives

| Contract | Address | wZION balance | Notes |
|---|---:|---:|---|
| CCA Auction (wZION/USDC) | `0x4eD4…1f93` | 66 466 631.15 | Locked until block `55 959 126`; current Base block ~`50 651 090` |
| Farm | `0x167B…B08` | 500 000 | Reward pool |
| Staking | `0xbd5c…78B` | 100 000 | 12% APR reward pool |
| Bridge | `0x72c8…6467` | 0 | Mints directly to recipients |
| Treasury | `0x455f…EeD` | 0 | 3-of-3 multisig |

### Existing DEX pools on Base — not usable

| Pool | DEX | Pair | Fee | Token0 | Token1 | Liquidity | State |
|---|---|---|---|---|---:|---:|---|
| `0x46cc…6f47` | PancakeSwap V3 | wZION/USDT | 0.25% | wZION 4 328.7 | USDT 0.000004 | 6.1e14 | **Single-sided wZION, price ≈ 0** |
| `0x186b…fda2` | Uniswap V3 | wZION/USDT | 0.3% | wZION 0.24 | USDT 0.000005 | 0 | **Empty** |
| `0x18c0…0699` | Uniswap V3 | wZION/WETH | 1.0% | wZION 0.05 | WETH 0 | 0 | **Empty** |

### Bridge contract

- `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467`
- `paused()`: `false`
- `dailyLimit`: `1 000 000 000 wZION`
- `dailyMinted`: `12.5 wZION` (current day)

The bridge is functional but it does **not** hold wZION; it mints to the recipient address.

---

## 4. What was already fixed in this session

### Frontend (`APP&WEB/website-v2.9`)

- `MetaMaskWalletPanel.tsx` — `zion-l1` mapping, Base SIWE chain `8453`.
- `MultichainWalletContext.tsx` — `zion-l1` mapping, `BigInt(10) ** BigInt(decimals)`, derivation guard.
- `lib/metamask.ts` — `hexZeroPad` for `amountAtomic`.
- `lib/multichain-api.ts` — propagate `data.error`, non-auth wallet errors.
- `AuthContext.tsx` — EIP-55 checksummed address, dynamic SIWE `chainId`.

### Backend (`V31/L2/multichain`)

- `chain/adapters/evm.rs` — `token_registry` for any ERC-20 deposit, `receipt.status` check in `send_transaction`, recipient chain validation in `to_eth_address`.
- `contracts.rs` — `TokenInfo` registry with USDC / USDT / WETH / wZION, correct USDT address fixed.
- `server.rs`, `withdrawals.rs`, `swap/dex/executor.rs`, `swap/dex/intent_engine.rs` — use `token_decimals()` helper instead of `0` fallback.
- `service.rs` — `build_adapter` now uses the custodial `wallet_keyring`, so the Base hot wallet derives from `ZION_WALLET_MNEMONIC`.
- `contracts.rs` — added `V3Dex` struct and registered both Uniswap V3 and PancakeSwap V3 contracts for Base.

### Verification

- `npm run build` in `APP&WEB/website-v2.9` passed.
- `cargo test -p zion-multichain` passed (`583 passed, 1 ignored, 0 failed`).

---

## 5. Authoritative plan

The existing long-form plan in `ZionDexZis.md` still applies. This document is a focused addendum for the **on-chain DEX settlement** gap that `ZionDexZis.md` already identifies:

> *„Cíl: převést ZionDex z in-memory AMM quote engine na skutečně E2E fungující multichain DEX“*

The current `ZionDexZis.md` phases 0–7 are implemented in code, but phase 3 (same-chain EVM swap) still uses `DexRouter` reserves rather than an on-chain AMM. This addendum covers the changes required to fix that.

---

## 6. Architecture for real on-chain swaps (option A)

### 6.1 Components

- **Per-user deposit address** (BIP44 derivation from `ZION_WALLET_MNEMONIC`).
- **Custodial hot wallet** (`0x390…EaC`) — signs on-chain swaps and withdrawals.
- **Internal ledger** (`MultichainWallet` / `wallet_balances` table) — tracks user claims.
- **On-chain AMM** — Uniswap V3 or PancakeSwap V3 on Base for price and execution.
- **Reconciliation / solvency guard** — on-chain hot wallet balance must be ≥ sum of internal claims.

### 6.2 Same-chain EVM swap flow (e.g. wZION → USDT)

1. User has `wZION` in internal ledger (backed by real wZION in hot wallet).
2. Frontend calls `/v1/swap/execute-v2` with `from`, `to`, `amount`, `min_amount_out`, optional `recipient`.
3. Backend:
   - Verifies user balance ≥ `amount`.
   - Verifies hot wallet holds ≥ `amount` of input token (solvency).
   - Approves `wZION` for the V3 `SwapRouter`.
   - Calls `QuoterV2.quoteExactInputSingle` to get expected `USDT` output.
   - If output ≥ `min_amount_out`, calls `SwapRouter.exactInputSingle` on-chain.
   - On success: debit `wZION` from user ledger, credit `USDT` to user ledger.
   - If `recipient` is set, the swap already sends `USDT` directly to that address.
   - If on-chain swap fails: **do not** update ledger; return error.

### 6.3 Key properties

- Prices are discovered on-chain, not by internal tables.
- The operator still custody tokens, but the swap is a real on-chain transaction.
- Slippage, deadline, and `receipt.status` checks protect the user.
- A reconciliation pass enforces 1:1 backing.

---

## 7. Open blockers and decisions

| # | Item | Status | What is needed |
|---|---|---|---|
| 1 | wZION source for hot wallet | **OPEN** | 200M wZION is mentioned as available. Bridge contract holds `0` wZION but can mint. Need confirmation: can bridge mint directly to `0x390…EaC`? Or move from farm/treasury/auction? |
| 2 | USDT / USDC seed capital | **OPEN** | A V3 pool requires both tokens. For a test pool at `$0.0002/wZION`, e.g. `100 USDT + 500 000 wZION` or `100 USDC + 500 000 wZION`. |
| 3 | DEX choice | **OPEN** | Both Uniswap V3 and PancakeSwap V3 are registered in `contracts.rs`. Existing Pancake pool is broken; new pool likely on PancakeSwap or Uniswap, whichever the operator prefers. Fee tier tentatively `0.25%` (2500). |
| 4 | Pool creation vs existing | **OPEN** | Existing pools are single-sided or empty. **Recommended: create a new V3 pool** with correct `sqrtPriceX96` for `$0.0002/wZION`. |
| 5 | Hot wallet ETH | **OPEN** | Hot wallet has `0 ETH`. Needs Base ETH for gas before any on-chain swap or pool creation. |

---

## 8. Implementation todo

- [x] Resume review, identify in-memory DEX risk.
- [x] Verify on-chain state (hot wallet, wZION, bridge, pools).
- [x] Fix frontend token mapping / SIWE / BigInt / error handling.
- [x] Fix Rust EVM deposit detection, receipt status, chain validation, token decimals.
- [x] Add Uniswap V3 and PancakeSwap V3 contract addresses to `ZionContracts`.
- [ ] Implement `EvmAdapter::quote_exact_input_single` (QuoterV2).
- [ ] Implement `EvmAdapter::swap_exact_input_single` (SwapRouter / SmartRouter).
- [ ] Refactor `SwapExecutor` to use on-chain V3 quotes and swaps for Base pairs.
- [ ] Add solvency guard: block swaps/withdrawals if on-chain balance < internal ledger claims.
- [ ] Create and seed a new real `wZION/USDT` or `wZION/USDC` V3 pool at `$0.0002`.
- [ ] Update frontend to display on-chain `tx_hash` and real swap status.
- [ ] End-to-end test on Base Mainnet with real tokens.

---

## 9. Known risks

- **Custodial risk:** the hot wallet holds user funds. For production, replace single EOA with a multisig / Gnosis Safe.
- **Solvency risk:** internal ledger must be 1:1 backed. `Reconciler` must run and **block** operations when `diff > 0`.
- **Liquidity risk:** a small V3 pool will have high slippage for large trades. Seed size must match expected volume.
- **Bridge risk:** minting 200M wZION to hot wallet must be authorized and audited.
- **Re-entrancy / failed on-chain swaps:** `SwapExecutor` must never update ledger before on-chain success is confirmed.

---

## 10. Reference files

- Plan: `ZionDexZis.md`
- Rust contracts: `V31/L2/multichain/src/contracts.rs`
- In-memory AMM: `V31/L2/multichain/src/swap/dex.rs`
- Swap executor: `V31/L2/multichain/src/swap/dex/swap_executor.rs`
- EVM adapter: `V31/L2/multichain/src/chain/adapters/evm.rs`
- Frontend swap widget: `APP&WEB/website-v2.9/src/components/dex/CrossChainSwapWidget.tsx`
- Contract addresses (TS source): `APP&WEB/website-v2.9/src/lib/defi-contracts.ts`

---

*Last updated: 2026-08-29*  
*Next action pending: source of wZION and USDT/USDC for hot wallet + pool seed.*
