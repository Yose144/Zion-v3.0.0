# ZION MarketPlace

Trade OASIS artifacts & ZION ecosystem assets. Powered by Base L2 + wZION.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind |
| Web3 | Viem + wagmi v2 (Base L2) |
| NFT Standard | ERC-1155 (multi-token — one contract for all artifact types) |
| Payment | wZION (ERC-20 on Base L2) |
| Backend | Next.js API routes + PostgreSQL (Prisma ORM) |
| Storage | IPFS (decentralized asset metadata) |
| Smart Contracts | Solidity 0.8.24 + OpenZeppelin + Foundry |

## Architecture

```
OASIS Game (L1 Rust) ←→ Bridge ←→ Base L2 (ERC-1155 NFTs)
                                    ↕
                             MarketPlace (Next.js)
                                    ↕
                             wZION payment (Base L2)
                             PostgreSQL (metadata/listings)
```

## Artifact Categories

| Category | Description | Source |
|----------|------------|--------|
| Avatar | OASIS playable characters | OASIS L4 |
| Ship | Flight & exploration vehicles | OASIS L4 |
| Ship Skin | Cosmetic ship upgrades | OASIS L4 |
| Quest Item | Questline artifacts | OASIS L4 |
| Consumable | One-time use items | OASIS L4 |
| Territory | Ownable Oasis land | OASIS L4 |
| Golden Egg | Rare territory rewards | OASIS L4 |
| Badge | Achievement NFTs | ZION ecosystem |
| Music | Audio artifacts | Community |
| Art | Visual art NFTs | Community |

## Rarity Tiers

Common → Uncommon → Rare → Epic → Legendary → Mythic → Unique

## Fees

- **Marketplace fee:** 2.5% (to treasury)
- **Creator royalty:** 5% default (configurable, max 10%)
- **Gas:** Base L2 (low cost)

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Set up database
npx prisma generate
npx prisma db push

# Run dev server
npm run dev
# → http://localhost:3100
```

## Smart Contracts

```bash
# Install Foundry dependencies
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std

# Compile
forge build

# Deploy to Base
forge script contracts/scripts/Deploy.s.sol \
  --rpc-url $BASE_RPC_URL \
  --private-key $DEPLOYER_KEY \
  --broadcast
```

### Contracts

- **ZIONArtifact.sol** — ERC-1155 NFT contract for all artifact types
- **ZIONMarketplace.sol** — Marketplace with fixed-price + auction listings, wZION payment, royalties

## Directory Structure

```
MarketPlace/
├── src/
│   ├── app/              # Next.js pages (App Router)
│   │   ├── page.tsx      # Landing / featured
│   │   ├── explore/      # Browse with filters
│   │   ├── item/[id]/    # Artifact detail
│   │   ├── create/       # List new artifact
│   │   ├── profile/[address]/ # User profile
│   │   └── api/items/    # API routes
│   ├── components/       # React components
│   ├── lib/              # wagmi config, contracts, db, utils
│   ├── hooks/            # Custom hooks
│   └── types/            # TypeScript types
├── contracts/            # Solidity smart contracts
│   ├── ZIONArtifact.sol
│   ├── ZIONMarketplace.sol
│   └── scripts/Deploy.s.sol
├── prisma/schema.prisma  # Database schema
└── foundry.toml          # Solidity build config
```

## Ecosystem Integration

- **OASIS L4** — Game items minted through quests, Golden Eggs, territory ownership
- **ZION L1** — Native blockchain, bridge to Base L2
- **Base L2** — NFT settlement layer, wZION payment
- **Bridge** — Cross-chain asset transfer between L1 and L2
- **DAO** — Governance for marketplace parameters (fees, featured collections)

## License

MIT
