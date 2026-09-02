# Report 2026-09-02 — ZIONDex Mainnet Live + Miner Hashrate Fix + Token Icons + ZIS Auth

> **Session:** 2026-09-02
> **Scope:** ZIONDex AMM deploy + E2E swap on Base Mainnet, miner hashrate reporting fix, token icon integration, dashboard/marketplace ZIS auth, Edge deployment

---

## 1. ZIONDex AMM — LIVE on Base Mainnet

### Contracts Deployed

| Contract | Address | Tx |
|----------|---------|----|
| ZIONDexFactory | `0x9F57998CC5Cb2a53426068c707Beac110966F351` | (2026-08-31) |
| ZIONDexRouter | `0x7A2Ef5dDCD6278E2500F34a0cd1F241a6Da76662` | (2026-08-31) |
| ZIONDexZISGate | `0x55160347B33Bb56F0ea99499072Ba5bf8D2862A5` | `0x0cff45...` (2026-09-02) |
| Pair: tZION/tUSDT | `0x1fE64df93226b8434877D5826aE2DCEda171e39E` | `0x942257...` (2026-09-02) |

### Test Tokens (Base Mainnet)

| Token | Address | Decimals | Deployer Balance |
|-------|---------|----------|-----------------|
| tZION | `0xC5E79b8C6475137aC3a982651097a219B63b0c33` | 18 | 839,997.9 |
| tUSDT | `0x677693fbFDe6a9EeA655033fffF93054B559552C` | 6 | 198,909.87 |
| tWETH | `0xcE5Df8e83B87f462835b51Ac6B2A4c53fafA620F` | 18 | 9,949.999 |

### Liquidity Added

- **Pair:** tZION/tUSDT
- **Reserves:** 100,000 tZION + 1,000 tUSDT (initial price: 1 tZION = 0.01 tUSDT)
- **LP total supply:** 0.01 (sqrt(100k × 1k) - 1000 MINIMUM_LIQUIDITY)
- **Method:** Direct transfer to pair + `pair.addLiquidity()` (router `transferFrom` failed on non-standard test tokens)

### E2E Swap Verified

- **Input:** 1,000 tZION
- **Output:** 9.87 tUSDT (0.3% swap fee + price impact)
- **Tx:** `0x69eda76bfd2790304b050dbe198b35b37d041bb38db59b4407f187c4b120034f`
- **Gas:** 149,005
- **Reserves after:** 990.13 tUSDT + 101,000 tZION

### Deployer Wallet

- **Address:** `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` (bridge validator-1)
- **Key:** `/etc/zion/keys/validator.key` on Edge
- **ETH balance:** 0.000028 ETH (sufficient for ~4 more deploys at current gas)

### Files Updated

- `APP&WEB/website-v2.9/src/lib/defi-contracts.ts` — ZIONDex addresses + pair address
- `V31/contracts/ZIONDex/README.md` — contract address table
- `V31/contracts/ZIONDex/deploy-zisgate.js` — gas estimate + deploy script
- `V31/contracts/ZIONDex/add-liquidity.js` — router-based liquidity script
- `V31/contracts/ZIONDex/add-liquidity-direct.js` — direct pair liquidity script

---

## 2. Miner Hashrate Reporting Fix

### Root Cause

`parallel_zion_find_nonce` in `V31/L1/miner/src/runtime.rs` calculated `nonces_searched = found_nonce + 1` instead of `batch_size` when a nonce was found. This underreported hashrate in parallel CPU mining scenarios because only the nonces up to the found nonce were counted, not the full batch that was searched.

### Fix

Changed `nonces_searched` from `found_nonce + 1` to `batch_size` in both:
- Pool mining path (share submission)
- Solo mining path (block submission)

### Verification

- `cargo check` for miner passed
- Miner rebuilt on Edge (9m 08s)
- After restart: **84.45 kH/s** reported (previously significantly underreported)
- 100% accept rate, 5 shares in 30s

### File Changed

- `V31/L1/miner/src/runtime.rs` — 2 lines changed (pool + solo paths)

---

## 3. Token Icon Integration

### Assets Created

- `public/tokens/zion.png` — 128×128 PNG, 35KB (resized from `LOGO/ZionLogo.png`)
- `public/tokens/zion-64.png` — 64×64 PNG, 10KB
- Copied to both `website-v2.9/public/tokens/` and `MarketPlace/public/tokens/`

### Shared Infrastructure

- `src/lib/token-icons.ts` — maps token symbols (ZION, wZION, tZION, USDT, WETH, etc.) to icon paths
- `src/components/dex/TokenIcon.tsx` — reusable React component with fallback

### Components Updated

- `TokenSelector.tsx` — token dropdown shows icons
- `SwapWidget.tsx` — swap UI shows token icons
- `CrossChainSwapWidget.tsx` — cross-chain swap UI
- `SwapPathVisual.tsx` — swap path visualization
- `MetaMaskWalletPanel.tsx` — wallet panel
- `ZionDexDashboard.tsx` — DEX dashboard

### Token List

- `wzion.tokenlist.json` `logoURI` updated to local `/tokens/zion.png`

### Edge Deployment

- `https://app.zionterranova.com/tokens/zion.png` → 200, image/png, 35KB ✓
- `https://market.zionterranova.com/tokens/zion.png` → 200, image/png, 35KB ✓
- Token icons copied to `/var/www/zion-maintenance/tokens/` (intro hub static serving)
- Marketplace standalone public dir: `.next/standalone/public/tokens/`

---

## 4. Dashboard ZIS Auth (J4)

### Changes

- `ZION_OS/dashboard/app.py` `_check_auth()` — prioritizes ZIS SSO cookie, falls back to HTTP Basic Auth
- New `/api/me` endpoint — returns current authenticated user

### API Response

```json
// Without auth → 401
// With Basic Auth:
{"authenticated": true, "source": "basic", "displayName": null, "role": "operator"}
// With ZIS SSO cookie:
{"authenticated": true, "source": "zis", "displayName": "Yose", "role": "operator"}
```

### Edge Verification

- `curl http://127.0.0.1:8766/api/me` → 401 ✓
- `curl -u "Yose:..." http://127.0.0.1:8766/api/me` → 200 with `source: "basic"` ✓

---

## 5. Marketplace ZIS Auth (J2)

### Changes

- `src/lib/zis-client.ts` — ZIS client for browser
- `src/contexts/AuthContext.tsx` — auth context provider
- `src/components/ConnectButton.tsx` — ZIS-aware connect button
- `src/app/providers.tsx` — AuthProvider wrapping app

---

## 6. L2 Token Registry

- `V31/L2/multichain/src/contracts.rs` — added tZION, tUSDT, tWETH with correct decimals
- `zion-v31-multichain` rebuilt on Edge (6m 23s) with new test token registry

---

## 7. Edge Deployment Summary

| Service | Status | Notes |
|---------|--------|-------|
| zion-v31-multichain | ✅ active | Rebuilt with test token registry |
| zion-v31-miner | ✅ active | 84.45 kH/s post-hashrate-fix |
| zion-website | ✅ active | Token icons + ZIONDex addresses |
| zion-marketplace | ✅ active | ZIS auth + token icons |
| zion-edge-python-dashboard | ✅ active | ZIS auth + /api/me |

### Nginx Issues Fixed

- Token images on intro hub (`zionterranova.com/tokens/zion.png`) — copied to `/var/www/zion-maintenance/tokens/`
- Marketplace standalone public dir — copied to `.next/standalone/public/tokens/`
- Content-Type verified: `image/png` (not `text/html`)

---

## 8. Skipped / Pending

- **npm publish wallet SDK** — npm auth token in `~/.npmrc` is expired (401 Unauthorized). User chose to skip. Package name `zion-wallet-sdk` is available on npm.
- **wZION/USDT AMM pair** — needs real wZION tokens (currently only test tokens have liquidity)
- **ZISGate configuration** — `setZisRelay()` and `setZisPublicKey()` not yet called (needs ZIS relay address + Ed25519 public key)

---

## 9. Files Changed (50 total)

### Rust (V31)
- `V31/L1/miner/src/runtime.rs` — hashrate fix
- `V31/L2/multichain/src/contracts.rs` — test token registry
- `V31/L1/core/src/v3_rpc.rs` — (from prior session)
- `V31/L2/multichain/src/chain/adapter.rs`, `adapters/evm.rs`, `adapters/zion_l1.rs`, `config.rs`, `db.rs`, `service.rs`, `swap/dex.rs` — (from prior session)

### Solidity / JS (ZIONDex)
- `V31/contracts/ZIONDex/deploy-zisgate.js` — existing, used for deploy
- `V31/contracts/ZIONDex/add-liquidity.js` — new, router-based
- `V31/contracts/ZIONDex/add-liquidity-direct.js` — new, direct pair
- `V31/contracts/ZIONDex/README.md` — updated addresses

### Website (website-v2.9)
- `src/lib/defi-contracts.ts` — ZIONDex addresses
- `src/lib/token-icons.ts` — new, token icon registry
- `src/components/dex/TokenIcon.tsx` — new, reusable component
- `src/components/dex/TokenSelector.tsx`, `SwapWidget.tsx`, `CrossChainSwapWidget.tsx`, `SwapPathVisual.tsx`, `ZionDexDashboard.tsx` — token icon integration
- `src/components/SwapWidget.tsx`, `MetaMaskWalletPanel.tsx` — token icon integration
- `public/tokens/zion.png`, `zion-64.png` — new assets
- `public/tokenlists/wzion.tokenlist.json` — logoURI updated

### Marketplace
- `src/app/providers.tsx`, `src/contexts/AuthContext.tsx`, `src/components/ConnectButton.tsx`, `src/lib/zis-client.ts` — ZIS auth
- `public/tokens/zion.png`, `zion-64.png` — new assets

### Dashboard
- `ZION_OS/dashboard/app.py` — ZIS auth + /api/me

### Documentation
- `AGENTS.md` — new LATEST banner
- `StatusV3.md` — update banner + ZIONDex contracts + miner hashrate
- `Multichain-Report.md` — (from prior session)
