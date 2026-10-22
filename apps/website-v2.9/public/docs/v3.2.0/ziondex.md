# ZionDEX — User Guide

> **Version:** v3.2.0 "One Love"  
> **Web:** [Multichain → DEX](/multichain#dex) · [Swap](/multichain#swap) · [Earn](/multichain#earn) · [Bridge](/multichain#bridge)

---

## What is ZionDEX

ZionDEX is the native ZION decentralized-exchange interface. It combines two things in one place:

- a **cross-chain swap engine** powered by the L3 WARP bridge — move value across 13+ chains without synthetic wrapped tokens,
- a **Uniswap V3 market** for `wZION/USDT` on Base Mainnet, traded with your own EVM wallet.

Everything lives on the [Multichain](/multichain) page — the tabs are DEX, Swap, Earn, Bridge, Governance and Auction.

---

## Cross-chain swap — the DEX tab

The **DEX** tab ([/multichain#dex](/multichain#dex)) contains the cross-chain swap widget, a live `wZION/USDT` price chart and the list of pools with on-chain reserves.

1. Open [/multichain#dex](/multichain#dex).
2. Choose the **source chain and token** you want to sell and the **destination chain and token** you want to receive — supported chains include Base, Arbitrum, BSC, Polygon, Optimism, Avalanche, Solana, Tron, Stellar, Cardano, Cosmos, Aptos, Sui, Near, TON, ZION L1 and Bitcoin/Lightning.
3. Enter the amount and the **destination address**.
4. Review the quote and the route the engine picked.
5. Execute — settlement is non-custodial through the WARP bridge.

## Swap wZION on Base — the Swap tab

The **Swap** tab ([/multichain#swap](/multichain#swap)) trades `wZION/USDT` on **Uniswap V3** (Base Mainnet) directly from your own wallet — nothing is held by ZION.

1. Open [/multichain#swap](/multichain#swap) and click **Connect Wallet** (MetaMask).
2. If prompted, switch the wallet network to **Base Mainnet**.
3. Pick the direction (`wZION → USDT` or back), enter the amount, review the quote and slippage.
4. Confirm — the transaction is signed in your wallet and settles on-chain.

The tab also shows your wZION/USDT balances and a LiFi-powered widget aggregating 30+ DEXes and 20+ bridges for longer routes.

## Earn and Bridge tabs

- **Earn** ([/multichain#earn](/multichain#earn)) — stake or farm wZION for regular rewards.
- **Bridge** ([/multichain#bridge](/multichain#bridge)) — move ZION L1 ↔ wZION on Base Mainnet with tracked confirmations and recent transfer history.

---

## Liquidity

Pool reserves shown in the DEX tab are live on-chain data. Providing liquidity to the `wZION/USDT` pair is done on **Uniswap V3** itself — the Swap tab links the pool. There is no separate in-app LP management page; your LP position lives in your own wallet.

---

## Pilot test tokens

On Base the ZionDex AMM also lists pilot pairs (`tZION`, `tUSDT`, `tWETH`) used to exercise the cross-chain AMM end-to-end. They are pilot assets — not the canonical wZION supply.

---

## Security notes

- Always check the token contract address before confirming a swap.
- Slippage and deadline settings protect you from front-running and stale quotes.
- Swaps on the Swap tab are signed by **your** wallet — ZION never takes custody of your EVM funds.
- Cross-chain transfers are non-custodial; double-check the destination address before executing.

---

## Troubleshooting

| Problem | What to do |
|---------|------------|
| Quote fails | Try a smaller amount or a different token pair — some pairs only have liquidity on Base. |
| Wallet won't connect | Make sure MetaMask is unlocked and set to **Base Mainnet**; the Swap tab offers a one-click network switch. |
| Swap reverts with "insufficient balance" | Check you hold the input token and enough ETH on Base for gas. |
| No pools shown | The pool list reads live on-chain reserves — refresh the page or try again in a moment. |
