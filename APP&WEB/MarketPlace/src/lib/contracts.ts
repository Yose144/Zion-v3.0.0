// ── ZION Marketplace Contract Addresses & ABIs ─────────────────────
// Base Mainnet (L2) — deployed contracts

export const CHAIN_ID = 8453; // Base Mainnet

// ── Existing ZION L2 contracts (from V3/L2/contracts/hardhat/deployed-base.json) ───
export const WZION_ADDRESS = '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6' as const;
export const ZION_BRIDGE_ADDRESS = '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467' as const;
export const ZION_STAKING_ADDRESS = '0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B' as const;
export const ZION_FARM_ADDRESS = '0x167B2753F5D8D9F8e62875cc9e379d7804308B08' as const;
export const ZION_GOVERNANCE_ADDRESS = '0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8' as const;
export const ZION_TREASURY_ADDRESS = '0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD' as const;
export const ZION_ATOMIC_SWAP_ADDRESS = '0x3DE9Ad42716854083ab837706E3961d10B0e63Eb' as const;

// ── Marketplace contracts (to be deployed) ─────────────────────────
export const ZION_ARTIFACT_NFT_ADDRESS = process.env.NEXT_PUBLIC_ARTIFACT_NFT_ADDRESS ?? '';
export const ZION_MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ?? '';

// ── ERC-1155 Artifact NFT ABI (key functions — matches ZIONArtifact.sol) ───
export const ARTIFACT_NFT_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'category', type: 'bytes32' },
      { name: 'rarity', type: 'bytes32' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'ids', type: 'uint256[]' },
      { name: 'amounts', type: 'uint256[]' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'mintBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'accounts', type: 'address[]' },
      { name: 'ids', type: 'uint256[]' },
    ],
    name: 'balanceOfBatch',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'uri',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'exists',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'tokenCreator',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'tokenCategory',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'tokenRarity',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'newuri', type: 'string' }],
    name: 'setURI',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'game', type: 'address' }],
    name: 'grantGameRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'ids', type: 'uint256[]' },
      { name: 'amounts', type: 'uint256[]' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'safeBatchTransferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ── Marketplace contract ABI (key functions — matches ZIONMarketplace.sol) ───
export const MARKETPLACE_ABI = [
  {
    inputs: [
      { name: 'nftAddress', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'quantity', type: 'uint256' },
      { name: 'pricePerItem', type: 'uint256' },
      { name: 'expiryTime', type: 'uint256' },
    ],
    name: 'createListing',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'nftAddress', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'quantity', type: 'uint256' },
      { name: 'startingPrice', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
    ],
    name: 'createAuction',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'listingId', type: 'uint256' }],
    name: 'cancelListing',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'listingId', type: 'uint256' },
      { name: 'quantity', type: 'uint256' },
    ],
    name: 'buy',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'listingId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'bid',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'listingId', type: 'uint256' }],
    name: 'settleAuction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'nftAddress', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'bps', type: 'uint256' },
    ],
    name: 'setRoyalty',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'listingId', type: 'uint256' }],
    name: 'getListing',
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'listingId', type: 'uint256' },
          { name: 'seller', type: 'address' },
          { name: 'nftAddress', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'quantity', type: 'uint256' },
          { name: 'pricePerItem', type: 'uint256' },
          { name: 'expiryTime', type: 'uint256' },
          { name: 'isAuction', type: 'bool' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'listingId', type: 'uint256' }],
    name: 'getAuction',
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'highestBid', type: 'uint256' },
          { name: 'highestBidder', type: 'address' },
          { name: 'bidCount', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalListings',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ── wZION ERC-20 ABI (for payment) ─────────────────────────────────
export const WZION_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
