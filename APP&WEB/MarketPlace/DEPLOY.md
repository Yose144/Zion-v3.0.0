# MarketPlace Deploy Guide

End-to-end deployment of `APP&WEB/MarketPlace` (NFT marketplace + eShop).

## Architecture

```
Browser (wagmi) ──┬──► Base L2 contracts (ZIONArtifact ERC-1155, ZIONMarketplace)
                  └──► Next.js API ──► Postgres (indexed read-model + eShop)
L1 ZION chain ──► l1-watcher daemon ──► relayerSettle() on marketplace
L2 events ──► l2-indexer (API tick or daemon) ──► Prisma DB
```

On-chain state is canonical for listings/payments; Postgres is the indexed
read-model + metadata store + eShop database.

## Deployed contracts — Base Sepolia (chainId 84532)

| Contract | Address |
|---|---|
| ZIONArtifact | `0x50868f965C52078e9Bd273873b98d53b035B8dBD` |
| ZIONMarketplace | `0x6e75E52D62a4D442200664B586D9E8730F1d86B3` |
| wZION (test faucet token) | `0x4F68fD4994C5097Db7c2C3764F80e376748edD3b` |

Deployer: `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` (edge `validator.key`).
Mainnet wZION: `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6`.

## Local setup

```bash
# Postgres (docker or system install)
docker run -d --name zion-marketplace-pg -p 5432:5432 \
  -e POSTGRES_USER=zion -e POSTGRES_PASSWORD=<pw> \
  -e POSTGRES_DB=zion_marketplace postgres:16-alpine

cp .env.example .env   # fill values
npx prisma db push
npm ci && npm run build
node .next/standalone/server.js   # or: npm run dev
```

## Contract deployment (forge)

```bash
cd contracts
forge build
export DEPLOYER_KEY=...        # injected env, never on disk
export BASE_RPC_URL=https://sepolia.base.org
forge script script/Deploy.s.sol --broadcast --rpc-url $BASE_RPC_URL
```

Post-deploy admin calls:
- `marketplace.setFeeRecipient(<treasury>)` — fees are locked in-contract without this!
- `nft.grantRole(MINTER_ROLE, <server-minter-wallet>)` — for `/api/mint`
- `marketplace.grantRole(RELAYER_ROLE, <l1-watcher-wallet>)` — for L1 settlements

## Indexer

- **API**: `POST /api/indexer/tick` (Bearer `INDEXER_SECRET` or `x-api-key` admin).
  Cursor stored in `ShopSetting.l2_indexer_block`. Cron-friendly.
- **Daemon**: `tsx scripts/l2-indexer.ts` — loops ticks; run under systemd.
- `INDEXER_LOG_CHUNK` — public Base RPC limits getLogs to ~200 blocks.

## E2E flows

**NFT**: `POST /api/mint` (ZIS auth) → approve → `createListing` (wallet) →
indexer syncs `ListingCreated` → item page buys via `chainListingId` →
`ListingPurchased` indexed → `Sale` row.

**L1 hybrid**: buyer sends L1 ZION to vault with memo
`MARKETBUY:<chainListingId>:<buyerL2>:<qty>` → l1-watcher → `relayerSettle`.

**eShop**: catalog prices/tokens recomputed server-side; order creates
invoice + QR + encrypted custodial wallet; Stripe webhook requires
`STRIPE_WEBHOOK_SECRET` in production.

## Production checklist

- [ ] `NODE_ENV=production` + `WALLET_SEED_KEY` (64-hex) — orders fail closed without it
- [ ] `ADMIN_API_KEY`, `SHOP_SEED_SECRET`, `INDEXER_SECRET` set (no defaults)
- [ ] `STRIPE_WEBHOOK_SECRET` set — unsigned webhooks rejected in prod
- [ ] `NEXT_PUBLIC_CHAIN_ID=8453` + mainnet addresses + real wZION
- [ ] `setFeeRecipient` called on-chain
- [ ] MINTER_ROLE granted to server minter wallet (not the deployer)
- [ ] systemd: `zion-marketplace.service` + `zion-l2-indexer.service` (scripts/l2-indexer.ts)
- [ ] nginx proxy → `127.0.0.1:3100` (set `PORT=3100`)

## Known TODOs before full production

- Admin login still returns raw `ADMIN_API_KEY` (move to signed session)
- ZIS session cookie auth has no CSRF token (SameSite=Lax mitigates)
- Reorg handling: indexer rolls forward; deep reorgs need manual cursor reset
