# MarketPlace Deploy Guide

End-to-end deployment of `apps/MarketPlace` (NFT marketplace + eShop).

## Architecture

```
Browser (wagmi) ──┬──► Base L2 contracts (ZIONArtifact ERC-1155, ZIONMarketplace)
                  └──► Next.js API ──► Postgres (indexed read-model + eShop)
L1 ZION chain ──► l1-watcher daemon ──► relayerSettle() on marketplace
L2 events ──► l2-indexer (API tick or daemon) ──► Prisma DB
```

On-chain state is canonical for listings/payments; Postgres is the indexed
read-model + metadata store + eShop database.

## Deployed contracts — Base Mainnet (chainId 8453) — PRODUCTION

Deployed 2026-10-21, deploy block `52911841`. Deployer `0xdde17…89D186`.

| Contract | Address | Tx |
|---|---|---|
| ZIONArtifact (ERC-1155) | `0x70f1f4442a939468f66342e587f4bce09e8fd676` | `0x1f1c07d7…aa2a` |
| ZIONMarketplace | `0x59651e1Fb5cDe96Adee5A08d3F5CA99607afF754` | `0xdaa1ef4f…5088` |
| wZION (real) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | (pre-existing) |

On-chain config (verified):
- `marketplace.wzion()` → real wZION above
- `marketplace.feeRecipient()` → Treasury `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD`
- `nft.hasRole(MINTER_ROLE, 0xbF82f801F273d6030eCDC6b3274A3C084ba50183)` → backend `/api/mint` wallet

## Deployed contracts — Base Sepolia (chainId 84532) — staging

| Contract | Address |
|---|---|
| ZIONArtifact | `0x50868f965C52078e9Bd273873b98d53b035B8dBD` |
| ZIONMarketplace | `0x6e75E52D62a4D442200664B586D9E8730F1d86B3` |
| wZION (test faucet token) | `0x4F68fD4994C5097Db7c2C3764F80e376748edD3b` |

Deployer: `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` (edge `validator.key`).

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
- **EDGE2 production**: `zion-l2-indexer.timer` (15 s interval) fires a oneshot
  `zion-l2-indexer.service` that curl-POSTs the tick — no long-running daemon,
  no tsx on the server.
- **Daemon** (alternative): `tsx scripts/l2-indexer.ts` — loops ticks.
- `INDEXER_LOG_CHUNK=200` — public Base RPCs limit `eth_getLogs` ranges;
  `mainnet.base.org` also rate-limits heavily → EDGE2 uses
  `https://base-rpc.publicnode.com` (server-side `BASE_RPC_URL`).
- Cursor seeding for a fresh deployment: insert
  `ShopSetting(key='l2_indexer_block', value=<deploy block - 1>)` so the indexer
  does not rescan from genesis.

## E2E flows

**NFT**: `POST /api/mint` (ZIS auth) → approve → `createListing` (wallet) →
indexer syncs `ListingCreated` → item page buys via `chainListingId` →
`ListingPurchased` indexed → `Sale` row.

**L1 hybrid**: buyer sends L1 ZION to vault with memo
`MARKETBUY:<chainListingId>:<buyerL2>:<qty>` → l1-watcher → `relayerSettle`.

**eShop**: catalog prices/tokens recomputed server-side; order creates
invoice + QR + encrypted custodial wallet; Stripe webhook requires
`STRIPE_WEBHOOK_SECRET` in production.

## Production checklist (EDGE2 status 2026-10-21)

- [x] `NODE_ENV=production` + `WALLET_SEED_KEY` (64-hex) — orders fail closed without it
- [x] `ADMIN_API_KEY`, `SHOP_SEED_SECRET`, `INDEXER_SECRET` set (no defaults)
- [x] `NEXT_PUBLIC_CHAIN_ID=8453` + mainnet addresses + real wZION
  (systemd drop-in `/etc/systemd/system/zion-marketplace.service.d/zz-mainnet.conf`
  — `Environment=` beats `EnvironmentFile=`, chain config lives there)
- [x] `setFeeRecipient` called on-chain (Treasury multisig)
- [x] MINTER_ROLE granted to server minter wallet (not the deployer)
- [x] systemd: `zion-marketplace.service` + `zion-l2-indexer.timer`
- [x] nginx proxy → `127.0.0.1:3100` (edge ingress → zion-chain-tunnel → EDGE2)
- [x] RELAYER_ROLE granted to dedicated relayer wallet
  `0xee6997F76C3419B5249d3e19785c161D877393EA` (funded 0.00015 ETH,
  key in EDGE2 `.env` as `L2_RELAYER_PRIV_KEY`)
- [x] `zion-l1-watcher.service` on EDGE2 — `node scripts/l1-watcher.ts`
  (Node 22 type-strips TS; L1 RPC `127.0.0.1:9445`, finality 60 blocks)
- [ ] Valid `NEXT_PUBLIC_WC_PROJECT_ID` (Reown/WalletConnect) — dev placeholder 403s
- [ ] Paid/provider RPC preferred over public endpoints for the indexer

## Admin auth (2026-10-21 redesign)

`/api/admin/login` no longer returns the raw `ADMIN_API_KEY`. It verifies
`ADMIN_USERS` credentials (plaintext or `sha256:<hex>`) and issues an
HMAC-signed httpOnly cookie `zion_admin_session` (8 h TTL, secret =
`ADMIN_SESSION_SECRET ?? ADMIN_API_KEY`) + a non-httpOnly `zion_admin_ui`
marker for UI gating. `requireAdminAuth` accepts either the session cookie
(browser) or `x-api-key`/`Bearer` (server-to-server back-compat).
`/api/admin/session` probes validity, `/api/admin/logout` clears both
cookies. Login is rate-limited (5/min/IP).

## CSRF protection

`src/lib/csrf.ts#assertSameOrigin` — mutating requests carrying a session
cookie (`zion_session` or `zion_admin_session`) must present a matching
`Origin`/`Referer` host (same host or `*.zionterranova.com`), else 403.
Applied to `/api/mint`, `/api/ipfs/upload`, `/api/listings/register` and
inside `requireAdminAuth` for cookie-authed admin calls. API-key callers
(no cookies) are unaffected.

## Indexer reorg handling

`ShopSetting.l2_indexer_chain` stores the last 128 processed tip
`{block, hash}` points. Each tick compares the stored hash at the cursor
with the live chain; on mismatch it walks back to the common ancestor and
`rollbackTo()` undoes derived rows (deletes orphaned listings/sales/bids
via txHash, restores quantities/status, recomputes `activePrice`), deletes
orphaned `EventLog` rows, and resets the cursor — the next scan re-applies
canonical events. A reorg deeper than the tracked window triggers a rescan
from the oldest tracked block.

## Known TODOs before full production

- ~~Admin login returns raw `ADMIN_API_KEY`~~ — done (HMAC session)
- ~~ZIS mutace bez CSRF~~ — done (Origin/Referer same-origin check)
- ~~Indexer reorg handling~~ — done (hash chain + rollbackTo)
- `ADMIN_USERS` still env-stored (sha256 supported; argon2/bcrypt would need a dep)
- indexer public RPC is best-effort — paid provider recommended
