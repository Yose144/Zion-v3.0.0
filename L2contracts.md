# L2 Contracts — Canonical Registry

> **Single source of truth** for all L2 (EVM + non-EVM) contract addresses, token registries, and DEX deployments.
> **Last updated:** 2026-09-02
> **Maintained by:** ZION core team
>
> **Rule:** When a contract is deployed or updated, update this file FIRST, then propagate to code:
> - Frontend: `APP&WEB/website-v2.9/src/lib/defi-contracts.ts`
> - Rust L2: `V31/L2/multichain/src/contracts.rs`
> - Status: `StatusV3.md` §4
>
> **Do NOT** create new contract address files. This file supersedes:
> - `docs/3.0.5/CONTRACT_ADDRESSES.md` (deprecated, kept for history)
> - `V31/contracts/ZIONDex/README.md` (ZIONDex-specific details only)

---

## 1. EVM Chains — wZION ERC-20

wZION uses **deterministic deploy** — same address on all 6 EVM chains.

| Token | Address | Decimals | Chains |
|-------|---------|----------|--------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | 18 | Base, Arbitrum, BSC, Polygon, Optimism, Avalanche |

### Chain IDs

| Chain | Chain ID | RPC |
|-------|----------|-----|
| Base | 8453 | `https://mainnet.base.org` |
| Arbitrum | 42161 | `https://arb1.arbitrum.io/rpc` |
| BSC | 56 | `https://bsc-dataseed.binance.org` |
| Polygon | 137 | `https://polygon-rpc.com` |
| Optimism | 10 | `https://mainnet.optimism.io` |
| Avalanche | 43114 | `https://api.avax.network/ext/bc/C/rpc` |

---

## 2. ZION Core DeFi Contracts (Base Mainnet)

| Contract | Address | Decimals | Notes |
|----------|---------|----------|-------|
| ZIONBridge (5/5 multisig) | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | — | Lock/mint, burn/unlock, 24h timelock |
| BridgeValidator | `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627` | — | Validator registry |
| ZIONGovernance | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` | — | On-chain voting, timelock |
| ZIONTreasury (3/3 multisig) | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` | — | Ecosystem funds |
| ZIONStaking | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | — | 12% APR, cooldown |
| ZIONFarm | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` | — | 1 wZION/s, 90d halving |
| ZIONAtomicSwap | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | — | Escrow, 100K ZION funded |

### Bridge Validators (5/5 multisig)

| # | Address | Role |
|---|---------|------|
| 1 | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | validator-1 (deployer, EVM relay key) |
| 2 | `0x24d986841E56e5571489B25951eE8C1Ae761FA82` | validator-2 |
| 3 | `0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0` | validator-3 |
| 4 | `0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6` | validator-4 |
| 5 | `0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2` | validator-5 |

### Non-Base EVM Bridge Proxy

| Contract | Address | Chains |
|----------|---------|--------|
| Generic Bridge Proxy | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | Arbitrum, BSC, Polygon, Optimism, Avalanche |

> **Note:** Base uses the 5/5 multisig bridge (`0x72c8f0...`). Other EVM chains use the generic proxy (`0xa5a09b...`). Both share the same wZION address.

---

## 3. DEX Deployments (Base Mainnet)

### 3a. ZIONDex AMM (Uniswap V2 fork) — OWN DEX

| Contract | Address | Status |
|----------|---------|--------|
| ZIONDexFactory | `0x9F57998CC5Cb2a53426068c707Beac110966F351` | ✅ Verified |
| ZIONDexRouter | `0x7A2Ef5dDCD6278E2500F34a0cd1F241a6Da76662` | ✅ Verified |
| ZIONDexZISGate | `0x55160347B33Bb56F0ea99499072Ba5bf8D2862A5` | ✅ Configured |

#### ZIONDex AMM Pairs

| Pair | Address | Reserves | Status |
|------|---------|----------|--------|
| wZION/USDC | `0x86ac36B7A38DB42a96E2205AFc79415e58904D63` | 1000 wZION + 0.5487 USDC | ✅ Live |
| tZION/tUSDT | `0x1fE64df93226b8434877D5826aE2DCEda171e39E` | 100k tZION + 1k tUSDT | ✅ Live (test) |

#### ZISGate Configuration

| Parameter | Value |
|-----------|-------|
| Admin | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` |
| ZIS Relay | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` |
| ZIS Public Key | `0xf272298cc6ee0d48b42cfce87151a3a6e4ca1a9c7e23ed52c9ef4e6b2920f757` |
| Gate Enabled | `false` (open access) |

### 3b. Uniswap V3 (Base) — external DEX

| Contract | Address |
|----------|---------|
| UniV3Factory | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| UniV3Router (SwapRouter02) | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| QuoterV2 | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` |
| PositionManager | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` |

#### Uniswap V3 Pools

| Pair | Fee | Pool Address | Status |
|------|-----|--------------|--------|
| wZION/WETH | 1.0% | `0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699` | Active |
| wZION/USDC | 0.3% | `0x5eBdC6E1D516f42EEB54f14faCF8715AbD5B9d8d` | — |
| wZION/USDT | 0.3% | `0x186b46c2f04153999d44D25179cD623fD62Bfda2` | — |
| wZION/SOL | 0.01% | `0xF38c56bbBBBC6d9FA11E7DE84bF7Bb70e1e8D2b3` | — |

### 3c. PancakeSwap V3 (Base) — external DEX

| Contract | Address |
|----------|---------|
| PancakeV3Factory | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` |
| PancakeV3SwapRouter | `0x1b81D678ffb9C0263b24A97847620C99d213eB14` |
| PancakeV3SmartRouter | `0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86` |
| PancakeV3QuoterV2 | `0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997` |
| PancakeV3NFTPositionManager | `0x46A15B0b27311cedF172AB29E4f4766fbE7F4364` |

#### PancakeSwap V3 Pools

| Pair | Fee | Pool Address | NFT ID |
|------|-----|--------------|--------|
| wZION/USDT | 0.25% | `0x46cc98dec9d2a60f2850225c942d6017b82b6f47` | #2054747 |

### 3d. Uniswap V4 (Base) — deprecated

| Contract | Address | Notes |
|----------|---------|-------|
| V4PoolManager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` | Positions burned, reference only |
| V4PositionManager | `0x7C5f5A4bBd8fD63184577525326123B519429BdC` | — |
| V4StateView | `0xa3c0c9b65bad0b08107aa264b0f3db444b867a71` | — |
| V4Quoter | `0x0d5e0f971ed27fbff6c2837bf31316121532048d` | — |
| V4UniversalRouter | `0xFdf682F51fe81aa4898f0ae2163d8a55c127fbc7` | — |

### 3e. CCA Auction (Base)

| Contract | Address | Notes |
|----------|---------|-------|
| CCAAuction | `0x4eD4EbBaa975d20cEA746E3569802D51768e1f93` | 66.47M wZION for USDC, 184-day lock |

---

## 4. Token Registry (Base Mainnet)

### Real Tokens

| Token | Address | Decimals | Source |
|-------|---------|----------|--------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | 18 | ZION bridge |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 | Coinbase |
| USDT | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` | 6 | Tether |
| WETH | `0x4200000000000000000000000000000000000006` | 18 | Base native wrap |
| SOL | `0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82` | 18 | Wrapped SOL |

### Test Tokens (Base Mainnet, ERC-20 faucets)

| Token | Address | Decimals | Purpose |
|-------|---------|----------|---------|
| tZION | `0xC5E79b8C6475137aC3a982651097a219B63b0c33` | 18 | DEX testing |
| tUSDT | `0x677693fbFDe6a9EeA655033fffF93054B559552C` | 6 | DEX testing |
| tWETH | `0xcE5Df8e83B87f462835b51Ac6B2A4c53fafA620F` | 18 | DEX testing |

---

## 5. Non-EVM Chains

### Deployed (2/9)

| Chain | Type | Address/ID | Decimals | Status |
|-------|------|------------|----------|--------|
| Solana | SPL Token | `HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H` | 6 | ✅ Live |
| Stellar | Native Asset | `ZION:GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT` | 6 | ✅ Live |

### Pending (7/9)

| Chain | Type | Status |
|-------|------|--------|
| Tron | TRC-20 | ⏳ Contract ready, not deployed |
| Cardano | Native Token | ⏳ Contract ready, not deployed |
| Cosmos | CW20 | ⏳ Contract ready, not deployed |
| Aptos | Move Coin | ⏳ Contract ready, not deployed |
| Sui | Move Coin | ⏳ Contract ready, not deployed |
| NEAR | NEP-141 | ⏳ Contract ready, not deployed |
| TON | TEP-74 Jetton | ⏳ Contract ready, not deployed |

> Contract source code for all pending chains: `V31/L2/multichain/contracts/non-evm/<chain>/`

---

## 6. Bitcoin / Lightning

| Component | Status | Notes |
|-----------|--------|-------|
| BTC HTLC address | ⏳ Placeholder | Needs 5/5 multisig P2WSH |
| LND node | ✅ Testnet | Docker on Edge, syncing |
| LND REST | `127.0.0.1:8080` | — |
| LND gRPC | `127.0.0.1:10009` | — |

---

## 7. L1 Bridge Vault

| Parameter | Value |
|-----------|-------|
| Address | `zion1j3w3h7k8m635h734y786j5804305m822t5uk546` |
| Balance | ~100M ZION |
| Memo format (outbound) | `BRIDGE:<chain>:<recipient>` |
| Memo format (WARP) | `WARP:1:<dest_chain>:<recipient>` |
| Validator quorum | 3/5 (configurable to 5/5) |
| Timelock | 24h |

---

## 8. Deployer / Operator Wallets

| Wallet | Address | Role | Balance |
|--------|---------|------|---------|
| Deployer (validator-1) | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | Deploys, ZISGate admin, bridge validator | ~99.68M wZION, ~0.000016 ETH |
| Validator-2 | `0x8cc6F931edDAf5F14D0071727Ed1640752B5c787` | Bridge validator | — |
| CCA tokensRecipient | `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` | Same as deployer | — |
| CCA fundsRecipient | `0x5bb4bafafec57bED50d864Aaa9d1ef992611e000` | USDC recipient | — |

> **Deployer key:** `/etc/zion/keys/validator.key` on Edge (EVM relay key, same as `WARP_EVM_RELAY_KEY`).
> **ETH top-up needed:** ~0.001 ETH sufficient for ~50 deploys.

---

## 9. Seed Price Constants

| Parameter | Value |
|-----------|-------|
| Seed price USD | $0.0002 / ZION |
| ETH/USD reference | $2000 |
| Seed price ETH | 1e-7 ETH/wZION |
| sqrtPriceX96 (wZION/WETH 1%) | `25054144837504793613172736` |
| Tick (wZION/WETH 1%) | -161190 |

---

## 10. Propagation Checklist

When updating addresses in this file, propagate to:

- [ ] `APP&WEB/website-v2.9/src/lib/defi-contracts.ts` — frontend contract registry
- [ ] `V31/L2/multichain/src/contracts.rs` — Rust L2 token registry (`base_mainnet()`)
- [ ] `StatusV3.md` §4 — canonical status doc
- [ ] `V31/contracts/ZIONDex/README.md` — ZIONDex-specific (if ZIONDex changed)
- [ ] Edge server: rebuild + restart affected services

### Files superseded by this document

| File | Status | Notes |
|------|--------|-------|
| `docs/3.0.5/CONTRACT_ADDRESSES.md` | **Deprecated** | Kept for history, do not update |
| `V31/contracts/ZIONDex/README.md` | **Supplement** | ZIONDex-specific deploy/usage details only |
| `docs/3.1/REPORTS/ZIONDEX_OPERATOR_RUNBOOK.md` | **Supplement** | Operational procedures only |
