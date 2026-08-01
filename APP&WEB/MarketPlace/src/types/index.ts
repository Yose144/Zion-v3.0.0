// ── ZION Marketplace Type Definitions ──────────────────────────────

/** Artifact categories — maps to OASIS game systems + ecosystem */
export enum ArtifactCategory {
  Avatar = 'avatar',
  Ship = 'ship',
  ShipSkin = 'ship_skin',
  QuestItem = 'quest_item',
  Consumable = 'consumable',
  Territory = 'territory',
  GoldenEgg = 'golden_egg',
  Badge = 'badge',
  Music = 'music',
  Art = 'art',
}

/** Rarity tiers — affects drop rate, visual glow, and market value */
export enum Rarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
  Mythic = 'mythic',
  Unique = 'unique',
}

/** Listing status on the marketplace */
export enum ListingStatus {
  Active = 'active',
  Sold = 'sold',
  Cancelled = 'cancelled',
  Expired = 'expired',
}

/** Sale type */
export type SaleType = 'fixed' | 'auction';

/** Source — where the artifact originated */
export type ArtifactSource = 'oasis' | 'zion_l1' | 'community' | 'genesis';

/** Core artifact metadata — stored off-chain (PostgreSQL + IPFS) */
export interface Artifact {
  id: string;
  tokenId: bigint;          // ERC-1155 token ID on Base L2
  contractAddress: string;  // ERC-1155 contract
  category: ArtifactCategory;
  name: string;
  description: string;
  rarity: Rarity;
  source: ArtifactSource;
  imageUri: string;         // IPFS URI for thumbnail
  assetUri?: string;        // IPFS URI for 3D model / full asset
  metadataUri: string;      // IPFS URI for full metadata JSON

  // Game stats (OASIS-specific, optional)
  stats?: ArtifactStats;

  // Provenance
  creator: string;          // wallet address
  createdAt: Date;
  mintedAt?: Date;          // on-chain mint timestamp

  // Supply
  totalSupply: number;      // total minted
  circulatingSupply: number; // currently in circulation
}

/** Game stats for OASIS artifacts */
export interface ArtifactStats {
  level?: number;
  xp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  luck?: number;
  durability?: number;
  abilities?: string[];
}

/** A marketplace listing */
export interface Listing {
  id: string;
  artifactId: string;
  tokenId: bigint;
  contractAddress: string;
  seller: string;           // wallet address
  saleType: SaleType;
  price: bigint;            // in wZION wei (18 decimals)
  priceUsd?: number;
  quantity: number;
  status: ListingStatus;
  createdAt: Date;
  expiresAt?: Date;
  // Auction-specific
  highestBidder?: string;
  highestBid?: bigint;
  bidCount?: number;
}

/** A bid on an auction listing */
export interface Bid {
  id: string;
  listingId: string;
  bidder: string;
  amount: bigint;
  createdAt: Date;
}

/** A completed sale */
export interface Sale {
  id: string;
  listingId: string;
  artifactId: string;
  tokenId: bigint;
  buyer: string;
  seller: string;
  price: bigint;
  quantity: number;
  txHash: string;
  createdAt: Date;
}

/** A collection — groups related artifacts */
export interface Collection {
  id: string;
  name: string;
  description: string;
  bannerImage: string;
  logoImage: string;
  creator: string;
  artifactCount: number;
  floorPrice?: bigint;
  totalVolume?: bigint;
  createdAt: Date;
}

/** User profile */
export interface UserProfile {
  address: string;
  username?: string;
  avatar?: string;
  bio?: string;
  joinedAt: Date;
  itemsOwned: number;
  itemsCreated: number;
  totalSales: number;
  totalPurchases: number;
}

/** API response wrappers */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
