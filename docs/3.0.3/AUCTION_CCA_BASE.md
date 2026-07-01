# Uniswap CCA Auction — wZION on Base

> **Status:** ⚠️ ACTIVE — end block immutable, ~184 days duration (intended: 30 days)
> **Created:** 2026-06-30
> **Owner:** Zion Protocol Team

---

## Contract

| Field | Value |
|-------|-------|
| **Auction contract** | `0x4eD4EbBaa975d20cEA746E3569802D51768e1f93` |
| **Chain** | Base Mainnet (8453) |
| **URL** | https://app.uniswap.org/explore/auctions/base/0x4eD4EbBaa975d20cEA746E3569802D51768e1f93 |
| **Basescan** | https://basescan.org/address/0x4eD4EbBaa975d20cEA746E3569802D51768e1f93 |
| **Type** | Uniswap Continuous Clearing Auction (CCA) — V4 liquidity bootstrap |

## Parameters

| Param | Value | Note |
|-------|-------|------|
| **Token (auctioned)** | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | wZION |
| **Currency (payment)** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | USDC (Base) |
| **Total supply** | 66,466,631.15 wZION | ~66.5M wZION deposited |
| **Tokens recipient** | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | Our deployer wallet |
| **Funds recipient** | `0x5bb4bafafec57bED50d864Aaa9d1ef992611e000` | — |
| **Start block** | 48,013,356 | ~2026-06-30 |
| **End block** | 55,959,126 | **~184 days** (intended: 30 days) |
| **Claim block** | 55,959,126 | Same as end block |
| **Floor price** | 15,053,350,877,700 (raw Q96) | — |
| **Required currency raised** | TBD (in contract storage) | Min USDC to graduate |

## Problem

**End block = 55,959,126 = ~184 days (6 months).** Intended duration was ~30 days.

### Why it can't be fixed

- `END_BLOCK` is **`immutable`** in `StepStorage` contract (set in constructor, cannot be changed)
- `CLAIM_BLOCK` is also **`immutable`**
- Contract has **NO admin functions**: no `cancel()`, no `setEndBlock()`, no `extend()`, no `owner()`, no `pause()`
- 66.47M wZION is **locked in the auction contract** until END_BLOCK
- No upgradeability pattern (no proxy, no UUPS, no transparent proxy)

### What happens at end block (~184 days)

| Scenario | Outcome |
|----------|---------|
| **Auction graduates** (raises ≥ `requiredCurrencyRaised` USDC) | LBP auto-created on Uniswap V4 at discovered price + funds recipient receives USDC |
| **Auction does NOT graduate** | `sweepUnsoldTokens()` returns unsold wZION to `0xdde17506...` (our wallet) |
| **Bidders want exit** | `exitBid()` available only after END_BLOCK — full refund if not graduated |

## Lessons for next auction

1. **Double-check `endBlock` before deploying** — calculate: `currentBlock + (days * 43200)` (Base = 2s/block → 43200 blocks/day)
2. **30 days = ~1,296,000 blocks** from start
3. **7 days = ~302,400 blocks** from start
4. **Use a test deploy first** — verify params on Base Sepolia before mainnet
5. **Consider factory CREATE2** — same params + different salt = same address, but immutable once deployed

## Next auction plan (after this one ends or if we deploy a new one)

- Duration: **30 days** (~1,296,000 blocks)
- Token: wZION
- Currency: USDC (Base)
- Total supply: TBD (depends on remaining wZION after this auction)
- Start block: `currentBlock + 100` (small buffer for tx confirmation)
- End block: `startBlock + 1,296,000`
- Claim block: `endBlock + 100` (small buffer for checkpoint finalization)

---

*Source: [Uniswap CCA docs](https://developers.uniswap.org/docs/liquidity/liquidity-launchpad/overview) · [GitHub](https://github.com/Uniswap/continuous-clearing-auction) · [Blog](https://blog.uniswap.org/continuous-clearing-auctions)*
