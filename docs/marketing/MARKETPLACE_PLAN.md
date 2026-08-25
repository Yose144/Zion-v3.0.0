# ZION MarketPlace — Plán a Roadmap

> **LIVE:** [https://market.zionterranova.com](https://market.zionterranova.com)
> **Stack:** Next.js 14 · Tailwind CSS · wagmi/viem · Base L2 · ERC-1155 · Foundry
> **Status:** UI/UX redesign hotový, hybrid L1/L2 platba implementovaná, smart kontrakty testované (6/6 pass)

---

## Co je ZION MarketPlace

Oficiální NFT marketplace pro OASIS game universe. Hráči obchodují s artefakty — avatary, loděmi, quest itemy, territory deeds a Golden Eggs. Každý artefact je ERC-1155 token na Base L2 a je použitelný v OASIS hře.

### Hybrid L1/L2 platba

Unikátní feature: kupující může platit buď:
- **wZION na L2** (Base) — okamžité settlement, standardní ERC-20 transfer
- **nativní ZION na L1** — pošle ZION na bridge vault s memo `MARKETBUY:listingId:buyerL2Addr:qty`, L1 watcher detekuje platbu, počká na finalitu (~60 bloků), zavolá `relayerSettle()` na L2 kontraktu, NFT se přenese na L2 adresu kupujícího. Prodávající dostane wZION přes bridge.

---

## Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                    market.zionterranova.com                  │
│                   (Next.js, port 3100, systemd)              │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   Home       │   Explore    │  Item Detail │   Create       │
│  (hero+stats)│ (filtry+grid)│ (buy/bid+L1) │  (mint+list)   │
├──────────────┴──────────────┴──────────────┴────────────────┤
│                    wagmi/viem (Base L2)                      │
├──────────────────────────────────────────────────────────────┤
│  ZIONArtifact (ERC-1155)  │  ZIONMarketplace (escrow+auction)│
│  wZION (ERC-20 platba)    │  RELAYER_ROLE (L1 watcher)       │
├───────────────────────────┴─────────────────────────────────┤
│              Base Mainnet (Chain ID 8453)                    │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              L1 Watcher Service (scripts/l1-watcher.ts)      │
│  Polls L1 RPC → scans for MARKETBUY memos → waits finality   │
│  → calls relayerSettle() on L2 → NFT transfers to buyer      │
│  (systemd: zion-marketplace-watcher.service)                 │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              ZION L1 (native PoW chain)                      │
│  Buyer sends ZION → bridge vault (zion1j53677...)            │
│  Memo: MARKETBUY:42:0xBuyerL2Address:1                       │
└──────────────────────────────────────────────────────────────┘
```

---

## Smart kontrakty

### ZIONArtifact.sol (ERC-1155)
- `mint(to, id, amount, category, rarity, data)` — MINTER_ROLE
- `mintBatch(...)` — batch mint
- `setURI(newURI)` — ADMIN_ROLE
- `grantGameRole(address)` — ADMIN_ROLE
- `exists(id)`, `totalSupply(id)`, `tokenCreator(id)`, `tokenCategory(id)`, `tokenRarity(id)`
- OpenZeppelin 5.7.0, AccessControl, ERC1155

### ZIONMarketplace.sol
- **Listings:** `createListing(nft, tokenId, qty, price, expiry)`, `createAuction(nft, tokenId, qty, startPrice, duration)`
- **Buying:** `buy(listingId, qty)` — wZION platba, 2.5% fee, 5% royalty
- **Auction:** `bid(listingId, amount)`, `settleAuction(listingId)`
- **L1 hybrid:** `relayerSettle(listingId, buyer, qty)` — RELAYER_ROLE, `relayerSettleAuction(listingId)`
- **Admin:** `grantRelayerRole(addr)`, `setRoyalty(nft, tokenId, recipient, bps)`, `cancelListing(listingId)`
- **Events:** ListingCreated, ListingPurchased, BidPlaced, AuctionSettled, L1Settled, RoyaltySet
- ReentrancyGuard, ERC1155Holder, AccessControl

### Testy (6/6 pass)
- `test_MintArtifact` — mint + balance check
- `test_CreateAndBuyListing` — create + buy + NFT transfer
- `test_AuctionFlow` — create auction + bid + settle
- `test_CancelListing` — create + cancel + NFT return
- `test_RelayerSettleL1Payment` — L1 platba: relayer settle, buyer dostane NFT bez wZION spending
- `test_RelayerSettle_Unauthorized` — non-relayer revert

---

## UI/UX Design

### Vizuální identita
- **Barvy:** oasis black `#05070a`, cyan `#22d3ee`, purple `#a855f7`, gold `#f59e0b`, emerald `#10b981`, rose `#f43f5e`
- **Fonty:** Inter (sans), JetBrains Mono (mono), Space Grotesk (display)
- **Pozadí:** animovaný grid + twinkling stars + radial gradient glows
- **Glass panels:** gradient border s hover lift + glow
- **Rarity badges:** 7 úrovní (common→unique), každá s vlastním glow
- **Animace:** fade-in-up, scale-in, float, gradient-x, twinkle, shimmer

### Stránky
| Stránka | Popis |
|---------|-------|
| `/` | Hero s animovaným gradient textem, stats, kategorie s ikonami, featured grid, "How it works" (3 kroky), CTA |
| `/explore` | Filtry sidebar (kolekce, rarity, listing type), search s ikonou, grid s staggered animací, empty state |
| `/item/[id]` | Breadcrumb, velký artifact placeholder, price card s L2/L1 toggle, properties grid, activity timeline |
| `/create` | Form: asset info, rarity picker, image URL + preview, traits editor, listing type (fixed/auction/none) |
| `/profile/[address]` | Avatar s glow, stats, tabs (owned/listed/activity), Basescan link |

---

## Adresy

| Kontrakt | Adresa | Síť |
|----------|--------|-----|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | Base Mainnet |
| ZION Bridge (L2) | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | Base Mainnet |
| Atomic Swap | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` | Base Mainnet |
| ZIONArtifact (ERC-1155) | _nasedeployovat_ | Base Mainnet |
| ZIONMarketplace | _nasedeployovat_ | Base Mainnet |
| L1 Bridge Vault | `zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7` | ZION L1 |

---

## Deployment

### Edge server (zionterranova.com)
- **Cesta:** `/opt/zion/APP&WEB/MarketPlace/`
- **Systemd:** `zion-marketplace.service` (port 3100)
- **Nginx:** `market.zionterranova.com.conf` → proxy `127.0.0.1:3100`
- **SSL:** Let's Encrypt (exp. 2026-10-30)
- **Watcher:** `zion-marketplace-watcher.service` (nainstalován, zatím nestartuje — potřebuje relayer key)

### Build
```bash
cd APP\&WEB/MarketPlace
npm install
npx prisma generate
npm run build
```

### Deploy
```bash
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.env' \
  -e "ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222" \
  ./ root@zionterranova.com:/opt/zion/APP\&WEB/MarketPlace/

ssh -i ~/.ssh/zion-edge-post-wipe-2026-07-29 -p 2222 root@zionterranova.com \
  "cd '/opt/zion/APP&WEB/MarketPlace' && npm run build && systemctl restart zion-marketplace.service"
```

---

## Roadmap

### Fáze 1 — Hotovo ✅
- [x] ZION visual theme (OASIS barvy, glass panels, glow efekty)
- [x] Všechny stránky (home, explore, item detail, create, profile)
- [x] Smart kontrakty (ZIONArtifact + ZIONMarketplace, 6/6 testů)
- [x] Hybrid L1/L2 platba (relayerSettle + L1 watcher service)
- [x] IPFS integrace (Pinata)
- [x] OASIS API integrace (avatars, quests, prize tiers)
- [x] Deployment na market.zionterranova.com s SSL
- [x] UI/UX redesign (fonty, animace, artifact placeholder, "How it works")

### Fáze 2 — Další krok
- [ ] **Deploy kontraktů na Base Mainnet** — `forge create ZIONArtifact` + `ZIONMarketplace`
- [ ] **Generovat relayer key** — dedikovaný private key pro L1 watcher
- [ ] **Grant RELAYER_ROLE** — `grantRelayerRole(relayerAddr)` na deploynutém kontraktu
- [ ] **Konfigurovat .env.watcher** na Edge serveru
- [ ] **Start watcher service** — `systemctl enable --now zion-marketplace-watcher.service`
- [ ] **Nahradit mock data** — připojit API routes na skutečná on-chain data + Prisma DB
- [ ] **PostgreSQL na serveru** — instalovat + `prisma migrate deploy`

### Fáze 3 — Vylepšení
- [ ] **Real on-chain interakce** — buy/bid/cancel přes wagmi `useWriteContract`
- [ ] **IPFS upload v create form** — drag & drop soubor + Pinata upload + metadata JSON
- [ ] **Activity feed** — indexovat ListingCreated/Purchased/BidPlaced eventy z kontraktu
- [ ] **User profiles z on-chain** — owned/listed z ERC-1155 balanceOf + marketplace listings
- [ ] **Notifikace** — toast při úspěšném buy/bid, pending L1 settlement status
- [ ] **Search** — full-text search přes item names + collections (Algolia nebo DB)
- [ ] **Lazy loading** — infinite scroll v explore grid

### Fáze 4 — Pokročilé
- [ ] **Bundle deals** — kupovat více artefaktů najednou
- [ ] **Offers** — nabídka na item i když není listed
- [ ] **Trait-based filtering** — filtrovat podle properties (Class=Avatar, Aura=Emerald)
- [ ] **Price history charts** — graf ceny v čase pro každý item
- [ ] **Rarity scoring** — automatický rarity score z traits
- [ ] **Collection pages** — samostatná stránka pro každou kolekci s stats
- [ ] **Mobile app** — React Native s walletconnect
- [ ] **Auction extension** — prodloužit aukci o 10 min při last-minute bid (anti-sniper)

---

## L1 Watcher — konfigurace

### .env.watcher
```env
L1_RPC_URL=127.0.0.1:9443
L1_BRIDGE_VAULT=zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7
L1_FINALITY_BLOCKS=60
L1_POLL_INTERVAL_S=15
L2_RPC_URL=https://mainnet.base.org
L2_MARKETPLACE_ADDR=<po deployu>
L2_RELAYER_PRIV_KEY=<generovat>
```

### Memo formát
```
MARKETBUY:<listingId>:<buyerL2Address>:<quantity>
```
Příklad: `MARKETBUY:42:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1:1`

---

## Soubory

```
APP&WEB/MarketPlace/
├── contracts/
│   ├── ZIONArtifact.sol          # ERC-1155 artifact NFT
│   ├── ZIONMarketplace.sol       # Marketplace + hybrid L1/L2
│   ├── scripts/Deploy.s.sol      # Deploy script
│   └── test/ZIONMarketplace.t.sol # 6 testů
├── scripts/
│   ├── l1-watcher.ts             # L1 watcher service
│   └── zion-marketplace-watcher.service # systemd unit
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout + fonty + footer
│   │   ├── page.tsx              # Home (hero, stats, kategorie, featured, how it works)
│   │   ├── globals.css           # Design system (glass, glow, animace)
│   │   ├── explore/page.tsx      # Marketplace explorer
│   │   ├── item/[id]/page.tsx    # Item detail + L1/L2 payment toggle
│   │   ├── create/page.tsx       # Mint + list form
│   │   └── profile/[address]/    # User profile
│   ├── components/
│   │   ├── Navbar.tsx            # Sticky nav s glow logo
│   │   ├── ConnectButton.tsx     # wagmi wallet picker
│   │   └── ItemCard.tsx          # Artifact card s rarity glow
│   └── lib/
│       ├── contracts.ts          # ABIs + adresy
│       ├── ipfs.ts               # Pinata IPFS client
│       └── oasis-api.ts          # OASIS game API client
├── tailwind.config.ts            # ZION theme + animace
└── foundry.toml                  # Solidity compiler config
```

---

## Git historie

1. `feat(marketplace): ZION Market — OASIS artifact marketplace on Base L2`
2. `feat(marketplace): IPFS Pinata + OASIS API integration`
3. `docs(agents): add MarketPlace to public web quartet`
4. `feat(marketplace): hybrid L1/L2 payment — relayerSettle + L1 watcher`
5. `feat(marketplace): UI/UX redesign — fonts, animations, OASIS visual identity`
