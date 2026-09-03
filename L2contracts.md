# L2 Contracts — Canonical Registry

> **Single source of truth** for all L2 contract addresses, token registries, and DEX integrations.
> **Last updated:** 2026-09-03
> **Philosophy:** Minimal contracts. Use existing DEX/bridge infra, don't reinvent it.
>
> **Rule:** When a contract is deployed or updated, update this file FIRST, then propagate to:
> - Frontend: `APP&WEB/website-v2.9/src/lib/defi-contracts.ts`
> - Rust L2: `V31/L2/multichain/src/contracts.rs`
> - Status: `StatusV3.md` §4

---

## 1. Active Contracts (3 total)

These are the only contracts we maintain. Everything else is external or deprecated.

| # | Contract | Address | Chain | Purpose |
|---|----------|---------|-------|---------|
| 1 | **wZION** (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | All EVM (deterministic deploy) | Wrapped ZION token — 1:1 peg with L1 ZION |
| 2 | **ZIONBridge** (5/5 multisig) | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | Base | Lock ZION on L1 → mint wZION; burn wZION → unlock L1 |
| 3 | **ZIONStaking** | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | Base | 12% APR staking, cooldown-based unstake |

### Bridge Validators (5/5 multisig)

| # | Address |
|---|---------|
| 1 | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` (deployer, EVM relay key) |
| 2 | `0x24d986841E56e5571489B25951eE8C1Ae761FA82` |
| 3 | `0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0` |
| 4 | `0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6` |
| 5 | `0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2` |

### Non-Base EVM Bridge Proxy

| Contract | Address | Chains |
|----------|---------|--------|
| Generic Bridge Proxy | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | Arbitrum, BSC, Polygon, Optimism, Avalanche |

---

## 2. External DEX (Uniswap V3 on Base)

We do NOT run our own AMM. We use Uniswap V3 — it already has wZION liquidity.

| Component | Address |
|-----------|---------|
| UniV3Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| SwapRouter02 | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` |
| PositionManager | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` |

### Uniswap V3 Pools (wZION)

| Pair | Fee | Pool Address | Status |
|------|-----|--------------|--------|
| wZION/WETH | 1.0% | `0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699` | ✅ Active |
| wZION/USDC | 0.3% | `0x5eBdC6E1D516f42EEB54f14faCF8715AbD5B9d8d` | — |
| wZION/USDT | 0.3% | `0x186b46c2f04153999d44D25179cD623fD62Bfda2` | — |

---

## 3. Token Registry

### Real Tokens (Base Mainnet)

| Token | Address | Decimals |
|-------|---------|----------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | 18 |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| USDT | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` | 6 |
| WETH | `0x4200000000000000000000000000000000000006` | 18 |

### Non-EVM Tokens (deployed, use native standards)

| Chain | Token ID | Decimals |
|-------|----------|----------|
| Solana | `HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H` (SPL) | 6 |
| Stellar | `ZION:GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT` | 6 |

### EVM Chain IDs

| Chain | ID | RPC |
|-------|----|-----|
| Base | 8453 | `https://mainnet.base.org` |
| Arbitrum | 42161 | `https://arb1.arbitrum.io/rpc` |
| BSC | 56 | `https://bsc-dataseed.binance.org` |
| Polygon | 137 | `https://polygon-rpc.com` |
| Optimism | 10 | `https://mainnet.optimism.io` |
| Avalanche | 43114 | `https://api.avax.network/ext/bc/C/rpc` |

---

## 4. L1 Bridge Vault

| Parameter | Value |
|-----------|-------|
| Address | `zion1j3w3h7k8m635h734y786j5804305m822t5uk546` |
| Balance | ~100M ZION |
| Memo (outbound) | `BRIDGE:<chain>:<recipient>` |
| Validator quorum | 3/5 (configurable to 5/5) |
| Timelock | 24h |

---

## 5. Deployer Wallet

| Parameter | Value |
|-----------|-------|
| Address | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` |
| Key location | `/etc/zion/keys/validator.key` on Edge |
| wZION balance | ~99.68M |
| ETH balance | ~0.000016 (needs top-up for more deploys) |

---

## 6. Deprecated Contracts (DO NOT USE)

These contracts are deployed on Base but are **no longer maintained**. Kept for reference only.

| Contract | Address | Reason deprecated |
|----------|---------|-------------------|
| ZIONDexFactory | `0x9F57998CC5Cb2a53426068c707Beac110966F351` | Redundant — use Uniswap V3 |
| ZIONDexRouter | `0x7A2Ef5dDCD6278E2500F34a0cd1F241a6Da76662` | Redundant — use Uniswap V3 |
| ZIONDexZISGate | `0x55160347B33Bb56F0ea99499072Ba5bf8D2862A5` | No need — ZIS auth is off-chain |
| ZIONDexPair: tZION/tUSDT | `0x1fE64df93226b8434877D5826aE2DCEda171e39E` | Test pair, no real liquidity |
| ZIONDexPair: wZION/USDC | `0x86ac36B7A38DB42a96E2205AFc79415e58904D63` | Tiny liquidity, use Uni V3 |
| ZIONFarm | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` | Redundant with Staking |
| ZIONGovernance | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` | Not needed for wallet |
| ZIONTreasury | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` | Manage via multisig directly |
| ZIONAtomicSwap | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | HTLC in L2 code instead |
| CCA Auction | `0x4eD4EbBaa975d20cEA746E3569802D51768e1f93` | One-time, completed |
| PancakeSwap V3 pool | `0x46cc98dec9d2a60f2850225c942d6017b82b6f47` | Redundant with Uniswap V3 |
| Uniswap V4 (all) | various | Positions burned, abandoned |

### Test Tokens (Base Mainnet, faucets)

| Token | Address | Decimals | Status |
|-------|---------|----------|--------|
| tZION | `0xC5E79b8C6475137aC3a982651097a219B63b0c33` | 18 | Deprecated — use wZION |
| tUSDT | `0x677693fbFDe6a9EeA655033fffF93054B559552C` | 6 | Deprecated — use USDC |
| tWETH | `0xcE5Df8e83B87f462835b51Ac6B2A4c53fafA620F` | 18 | Deprecated — use WETH |

---

## 7. Non-EVM Pending (use existing standards, no custom contracts)

For new chain integrations, use **existing token standards** — do NOT deploy custom bridge contracts.

| Chain | Standard | Status | Approach |
|-------|----------|--------|----------|
| Solana | SPL Token | ✅ Deployed | Use existing SPL, relay via L2 |
| Stellar | Native Asset | ✅ Deployed | Use existing asset, relay via L2 |
| Tron | TRC-20 | ⏳ | Deploy simple TRC-20, no custom bridge |
| Bitcoin | UTXO watch | ⏳ | HTLC watch address, no contract |

> **No custom bridge contracts per chain.** The L2 multichain service handles bridge logic off-chain via chain adapters. On-chain, we only need the token itself (ERC-20 / SPL / native asset).

---

## 8. Wallet Infrastructure (off-chain, no contracts)

These are software components, not contracts. They make ZIS work as a multichain wallet.

| Component | Location | Purpose |
|-----------|----------|---------|
| ZIS (Identity Service) | `APP&WEB/identity/` | Auth (Google/Ed25519/SIWE), session JWT, wallet API proxy |
| L2 Multichain Service | `V31/L2/multichain/` | Address derivation, deposit watching, ledger, swaps, withdrawals |
| Wallet SDK | `APP&WEB/zion-wallet-sdk/` | TypeScript SDK for desktop/mobile apps |
| Web Wallet UI | `APP&WEB/website-v2.9/src/contexts/MultichainWalletContext.tsx` | React state for `/wallet/multichain` |
| DEX integration | Uniswap V3 (external) | Swap execution via SwapRouter02 |

See [`ZIS_WALLET_PLAN.md`](./ZIS_WALLET_PLAN.md) for the full wallet architecture.

---

## 9. Propagation Checklist

When updating addresses in this file, propagate to:

- [ ] `APP&WEB/website-v2.9/src/lib/defi-contracts.ts` — frontend contract registry
- [ ] `V31/L2/multichain/src/contracts.rs` — Rust L2 token registry
- [ ] `StatusV3.md` §4 — canonical status doc

### Files superseded by this document

| File | Status |
|------|--------|
| `docs/3.0.5/CONTRACT_ADDRESSES.md` | **Deprecated** — historical only |
| `docs/3.2/ZionDexZis.md` | **Superseded** by `ZIS_WALLET_PLAN.md` |
| `V31/contracts/ZIONDex/README.md` | **Deprecated** — ZIONDex AMM no longer maintained |
| `docs/3.1/REPORTS/ZIONDEX_OPERATOR_RUNBOOK.md` | **Deprecated** — ZIONDex AMM no longer maintained |
