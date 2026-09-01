# ZionDEX — User Guide

> **Version:** v3.2.0 "One Love"  
> **Network:** Base Mainnet pilot + ZION L1 HTLC fallback  
> **Web:** [/swap](/swap) and [/dex](/dex)

---

## What is ZionDEX

ZionDEX is the native ZION decentralized exchange. It lets you swap tokens, add liquidity to on-chain AMM pools, and view your positions from a single interface.

The v3.2.0 release runs the swap engine against the **Base Mainnet AMM** (ZionDexRouter / ZionDexFactory). ZION L1 HTLC atomic swaps are also available for cross-chain trades that do not require a custodial bridge.

---

## Getting started

1. **Sign in with ZIS** at the top of the page (email, Google, MetaMask, or X).
2. **Connect a wallet** or use the generated multi-chain wallet to receive deposits.
3. **Deposit** the token you want to trade into your ZION wallet.
4. **Swap**, **add liquidity**, or **view your portfolio**.

You do not need to install anything for the web interface. The Desktop App and CLI offer the same functionality for power users.

---

## Swapping tokens

1. Go to [/swap](/swap) or the **DEX** tab.
2. Select the chain and the token you want to sell.
3. Select the token you want to buy.
4. Enter the amount.
5. Review the quote, slippage, and deadline.
6. Confirm the swap. The transaction is signed on your behalf by the multi-chain wallet and submitted on-chain.

The quote engine tries **single-hop, two-hop, and three-hop routes** across available liquidity pools. If no direct pool exists, the engine may route through an intermediate token such as WETH or a stablecoin.

---

## Liquidity pools

### Add liquidity

1. Go to [/dex/liquidity](/dex/liquidity).
2. Select the two tokens you want to deposit, for example `tZION` and `tUSDT` on Base.
3. Enter the amount of each token.
4. Optionally set a recipient address and a deadline.
5. Confirm. You receive **LP tokens** representing your share of the pool.

### Remove liquidity

1. Open the **Remove** tab on [/dex/liquidity](/dex/liquidity).
2. Select the pool and enter the amount of LP tokens you want to withdraw.
3. Review the expected amounts of each token.
4. Confirm. The LP tokens are burned and the underlying tokens are returned.

---

## Portfolio

The [/dex/portfolio](/dex/portfolio) page shows:

- Your recent swaps.
- Active AMM pools and their on-chain pair addresses.
- Pool status (active / pending).

It updates automatically when you add or remove liquidity.

---

## Beta test tokens

During the public beta the web interface uses test tokens on Base Mainnet (for example `tZION`, `tUSDT`, `tWETH`) so the AMM flow can be exercised with real on-chain calls without risking main wZION supply.

The pool list on [/dex/liquidity](/dex/liquidity) shows which pools are active and which are still pending deployment.

---

## Security notes

- Always check the token contract address before confirming a swap.
- Slippage and deadline settings protect you from front-running and stale quotes.
- Liquidity provision is non-custodial: your LP tokens are under your control.
- Cross-chain HTLC swaps require both sides to claim within the timelock window.

---

## Troubleshooting

| Problem | What to do |
|---------|------------|
| Quote fails | Try a smaller amount or a different token pair. Some pairs only have liquidity on Base. |
| Swap reverts with "insufficient balance" | Deposit the required token first or reduce the amount. |
| Add liquidity fails | Make sure you have both tokens and enough for the minimum dust threshold. |
| Portfolio empty | Sign in so the server can look up your history and pool positions. |
