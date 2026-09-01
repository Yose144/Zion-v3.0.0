# ZionDex On-Chain AMM Integration Report

**Date:** 2026-08-31 (updated 2026-09-01)
**Status:** Deployed on Base + E2E workflow live

---

## Summary

ZionDex is a Uniswap V2–style AMM deployed on Base mainnet, integrated into the
ZION multichain wallet (L2 `warpd`), the ZIS identity service, and the public
web UI at `app.zionterranova.com/ziondex`. Users can get quotes and execute
swaps through a custodial wallet model with an atomic journal ledger.

---

## Deployed Contracts (Base Mainnet)

### ZIONDex AMM Contracts

| Contract | Address | TX |
|----------|---------|----|
| `ZIONDexFactory` | `0x9F57998CC5Cb2a53426068c707Beac110966F351` | [0xe3e49f...](https://basescan.org/tx/0xe3e49f614693bc4b058ec6f10dac6d70e8e1c57422c9232db29c399597631fbf) |
| `ZIONDexRouter` | `0x7A2Ef5dDCD6278E2500F34a0cd1F241a6Da76662` | [0xf1c04c...](https://basescan.org/tx/0xf1c04c05bcc0dfcefdcbfb67bae6c2197d8fdca1531c818c6cfdc650bbd4a1b8) |
| `ZIONDexZISGate` | _(not deployed — optional, deploy when needed)_ | — |

### Test Tokens (ERC-20, owner-gated mint)

| Token | Address | Decimals |
|-------|---------|----------|
| tZION (Test ZION) | `0xC5E79b8C6475137aC3a982651097a219B63b0c33` | 18 |
| tUSDT (Test USDT) | `0x677693fbFDe6a9EeA655033fffF93054B559552C` | 6 |
| tWETH (Test WETH) | `0xcE5Df8e83B87f462835b51Ac6B2A4c53fafA620F` | 18 |
| tSOL (Test SOL) | `0xcD30a4f1657f6378c9b2F337785B93505Cd81cC8` | 9 |

### AMM Pools (in-memory DEX router, seeded with liquidity)

| Pool | Pair | Reserve A | Reserve B | Fee | AMM Pair Contract |
|------|------|-----------|-----------|-----|-------------------|
| 1 | tZION/tUSDT | 10,000 tZION | 200,000 tUSDT | 0.30% | `0x0628Ae0D...` |
| 2 | tZION/tWETH | 10,000 tZION | 10 tWETH | 0.30% | `0xDFf829D9...` |
| 3 | tUSDT/tWETH | 200,000 tUSDT | 10 tWETH | 0.30% | `0x8E854330...` |
| 4 | ZION/BTC (bridge) | 10,000,000 ZION | 0.02 BTC | 1.00% | — (custodial) |

---

## Architecture Layers

### Layer 1: Smart Contracts (Solidity 0.8.20)

- **ZIONDexFactory** — pair creation, protocol fee config (`feeTo`, `feeBps`)
- **ZIONDexPair** — Uniswap V2 clone with K-invariant, LP token minting, protocol fee
- **ZIONDexRouter** — multi-hop swap, add/remove liquidity, quotes
- **ZIONDexZISGate** — optional ZIS-based access control (whitelist / open mode)
- Compiled with `solc 0.8.20`, `viaIR` + optimizer
- Source: `V31/contracts/ZIONDex/`

### Layer 2: Rust Backend (`zion-multichain` / `warpd`)

- **Unified adapter registry** (`chain/unified_registry.rs`) — wallet + WARP adapters
- **Atomic journal ledger** (`multichain_wallet/journal.rs`) — append-only audit trail,
  atomic credit/debit within a single SQL transaction
- **SwapExecutor** — wires DEX router quotes → journal debit/credit → on-chain settlement
  - `with_journal()` builder: uses `JournalLedger` when available, falls back to `WalletLedger`
  - Each swap records `reason="swap"` / `"swap_refund"` / `"swap_output"` + `reference_id=order_id`
- **Keyring startup guard** — refuses to start with ephemeral keys in production
- **Path amount validation** — `amount_in` / `amount_out` continuity across swap hops
- Build: 597 tests passed, 0 failed, 1 ignored (pre-existing HTLC)
- Deployed on Edge: `warpd` on `127.0.0.1:8453` (WARP) + `8454` (DEX API)

### Layer 3: ZIS Identity Service (`identity/`)

- **9 new wallet endpoints** in `routes/wallet.ts`:
  - `GET /api/wallet/me` — full wallet snapshot (auth)
  - `POST /api/wallet/derive` — derive deposit address (auth)
  - `GET /api/wallet/balances` — list balances (auth)
  - `POST /api/wallet/swap` — execute DEX swap (auth)
  - `GET /api/wallet/orders` — swap order history (auth)
  - `POST /api/wallet/withdraw` — on-chain withdrawal (auth)
  - `GET /api/wallet/deposits` — deposit history (auth)
  - `GET /api/wallet/withdrawals` — withdrawal history (auth)
  - `GET /api/wallet/quote` — DEX quote (public, no auth)
- **Per-route auth** — `preHandler: [requireAuth]` on each protected route,
  `/quote` is public
- **Asset struct translation** — `parseAssetId()` converts asset ID strings
  (`"chain:ticker:contract"`) to full `Asset` structs expected by L2
- **4 new Prisma models**: `MultichainWalletAccount`, `MultichainWalletAddress`,
  `MultichainBalance`, `MultichainOrder`
- **Bitcoin address linking** — Bech32/Base58 validation in `auth.ts`
- Deployed on Edge: `zion-zis.service` on `https://auth.zionterranova.com`

### Layer 4: TypeScript SDK (`zion-wallet-sdk` v2.0.0)

- **`multichain/`** — `WalletClient`, swap, bridge, types
- **`evm/`** — `EvmWallet` (ethers v6), `SiweHelper`, `AmmClient`
- **`zis/`** — `ZisClient` (auth), `SessionManager`
- Build: passed, 97 files, 57.6 kB tarball
- **npm publish: pending** (requires 2FA OTP — run `npm publish --otp=...` manually)

### Layer 5: Web UI (`website-v2.9`)

- **ZionDex Hub** at `/ziondex` — `ZionDexDashboard` with 5 tabs:
  Swap, Liquidity, Portfolio, WARP Bridge, Atomic Swap
- **CrossChainSwapWidget** — chain/token selectors, real-time quote,
  route visualization, swap execution
- **Beta test tokens** — tZION, tUSDT, tWETH available in token dropdown
- **Banner** — "Beta Live (Test Tokens)" with instructions
- **API proxy** — `/api/swap/[...path]` → L2 `8454`, `/api/multichain/[...path]` → L2 `8454`
- **ZIONDex addresses** in `defi-contracts.ts`: Factory + Router
- Deployed on Edge: `zion-website.service` on `https://app.zionterranova.com`

---

## E2E Workflow (Verified 2026-09-01)

```
User (browser)
  → app.zionterranova.com/ziondex
  → CrossChainSwapWidget (select Base / tZION → tUSDT / amount)
  → POST /api/swap/quote/multi
  → Next.js proxy → http://127.0.0.1:8454/v1/swap/quote/multi
  → warpd (DexRouter) → 3 routes returned
  → Widget displays best route + expected output
```

**Test result:** 1 tZION → 19.938,006 tUSDT (3 routes: direct + via tWETH)

### ZIS Wallet Routes E2E

```
User (authenticated)
  → auth.zionterranova.com/api/wallet/quote?from=base:tZION:...&to=base:tUSDT:...&amount=...
  → ZIS parseAssetId() → Asset struct
  → POST http://127.0.0.1:8454/v1/swap/quote
  → warpd → quote returned
  → ZIS → { l2: quote }
```

**Test result:** ✅ Quote returned with route + expected_out

---

## Edge Deployment Status (2026-09-01)

| Service | Status | Port | Notes |
|---------|--------|------|-------|
| `zion-zis` | ✅ active | 8096 | Wallet routes + Prisma schema pushed |
| `zion-v31-multichain` (warpd) | ✅ active | 8453/8454 | JournalLedger wired, keyring guard OK |
| `zion-website` | ✅ active | 3000 | ZionDex Hub with beta test tokens |
| ZIONDexFactory (Base) | ✅ deployed | — | `0x9F57998C...` |
| ZIONDexRouter (Base) | ✅ deployed | — | `0x7A2Ef5dD...` |
| ZIONDexZISGate (Base) | ⏳ pending | — | Insufficient ETH for deploy gas |

---

## What's Done

- [x] Smart contracts: ZIONDexFactory, Pair, Router, ZISGate (compiled)
- [x] Factory + Router deployed on Base mainnet
- [x] Test tokens deployed (tZION, tUSDT, tWETH, tSOL)
- [x] AMM pools seeded with liquidity (in-memory DEX router)
- [x] Rust backend: unified adapter registry + atomic journal ledger
- [x] SwapExecutor wired to JournalLedger (atomic credit/debit + audit trail)
- [x] Keyring startup guard (refuses ephemeral keys in production)
- [x] Path amount validation across swap hops
- [x] ZIS wallet routes (9 endpoints) deployed on Edge
- [x] Prisma schema updated (4 new models) + db push on Edge
- [x] Bitcoin address linking (Bech32/Base58 validation)
- [x] zion-wallet-sdk v2.0.0 (multichain/evm/zis modules) built
- [x] Web UI: ZionDex Hub with swap widget + beta test tokens
- [x] E2E verified: web → API proxy → L2 quote → 3 routes returned
- [x] ZIS E2E verified: /api/wallet/quote → L2 → quote returned
- [x] L2 multichain (warpd) rebuilt + deployed on Edge
- [x] All changes committed + pushed to git

## What's Missing / Pending

### High Priority

- [ ] **npm publish** — `zion-wallet-sdk@2.0.0` needs `npm publish --otp=...` (2FA required)
- [ ] **ZIONDexZISGate deploy** — needs ETH for gas on deployer wallet
  (`0xdde17506...`, balance ~0.00005 ETH)
- [ ] **wZION/USDT liquidity** — real token pairs need liquidity deposited
  into ZIONDex pair contracts (currently only test tokens have pools)
- [ ] **Swap execution E2E** — `/api/swap/execute-v2` requires auth + custodial
  wallet balance; needs full user flow test with deposit → swap → withdraw

### Medium Priority

- [ ] **On-chain AMM execution** — SwapExecutor has `amm_swap()` path but
  needs EVM adapter configured with ZIONDexRouter ABI
- [ ] **Bridge pool for ZION↔wZION** — cross-chain swap from L1 native ZION
  to Base wZION via WARP bridge (currently only ZION/BTC bridge pool exists)
- [ ] **Liquidity UI** — `/dex/liquidity` page needs add/remove liquidity
  flow connected to ZIONDexRouter
- [ ] **Portfolio UI** — `/dex/portfolio` page needs swap history + LP positions

### Low Priority / Future

- [ ] **Deploy ZIONDex on Arbitrum/Optimism/BSC** — same contracts, different chains
- [ ] **ZIS gate enforcement** — whitelist verified ZIS users before swap
- [ ] **Protocol fee collection** — `feeTo` treasury address + feeBps config
- [ ] **LP token management** — mint/burn LP tokens, track LP positions
- [ ] **Price oracle** — on-chain price feed from AMM pool reserves
- [ ] **Slippage protection** — frontend min_amount_out enforcement

---

## Git Commits (this session)

| Commit | Description |
|--------|-------------|
| `94cbe1359` | feat(multichain): on-chain AMM integration + ZionDex design |
| `d6c909230` | Wire JournalLedger into SwapExecutor for atomic credit/debit audit trail |
| `8c9a67197` | docs: update ZIONDex README with deployed contract addresses on Base |
| `b85cf485f` | fix(zis): wallet routes use per-route preHandler + Asset struct for L2 proxy |
| `d57f6b979` | feat(web): add beta test tokens to ZionDex swap widget |

---

## File Index

| File | Purpose |
|------|---------|
| `V31/contracts/ZIONDex/` | Solidity contracts (Factory, Pair, Router, ZISGate) |
| `V31/L2/multichain/src/chain/unified_registry.rs` | Unified adapter registry |
| `V31/L2/multichain/src/multichain_wallet/journal.rs` | Atomic journal ledger |
| `V31/L2/multichain/src/swap/dex/swap_executor.rs` | SwapExecutor with JournalLedger |
| `V31/L2/multichain/src/service.rs` | MultichainService wiring |
| `APP&WEB/identity/src/routes/wallet.ts` | ZIS wallet routes (9 endpoints) |
| `APP&WEB/shared/prisma/schema.prisma` | 4 new Prisma models |
| `APP&WEB/zion-wallet-sdk/` | SDK v2.0.0 (multichain/evm/zis) |
| `APP&WEB/website-v2.9/src/components/dex/` | ZionDex web UI components |
| `APP&WEB/website-v2.9/src/lib/defi-contracts.ts` | Contract address registry |
