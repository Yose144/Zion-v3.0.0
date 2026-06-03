// Minimal chain registry for multi-chain payout addresses (watch-only for non-ZION)
// WZION = wrapped ZION ERC-20 on Base network (L2 bridge)

export const CHAIN_IDS = {
  ZION: 'ZION',
  WZION: 'WZION',        // wZION ERC-20 on Base
  BASE: 'BASE',          // Base network (ETH L2 by Coinbase)
  BASE_SEPOLIA: 'BASE_SEPOLIA', // testnet
  BTC: 'BTC',
  ETH: 'ETH',
  SOL: 'SOL',
  TRX: 'TRX',
  XLM: 'XLM',
  ETC: 'ETC',
  RVN: 'RVN',
  ERG: 'ERG',
  KAS: 'KAS',
  ALPH: 'ALPH',
  XMR: 'XMR',
};

export const CHAINS = [
  {
    id: CHAIN_IDS.ZION,
    symbol: 'ZION',
    name: 'ZION TerraNova',
    algo: 'CosmicHarmony',
    addressHint: 'zion1... (44 chars)',
    isL1: true,
  },
  {
    id: CHAIN_IDS.WZION,
    symbol: 'wZION',
    name: 'Wrapped ZION (Base)',
    algo: 'ERC-20',
    addressHint: '0x... (EVM address)',
    isEvm: true,
    evmChainId: 8453, // Base mainnet
  },
  {
    id: CHAIN_IDS.BASE_SEPOLIA,
    symbol: 'wZION',
    name: 'Wrapped ZION (Base Sepolia)',
    algo: 'ERC-20',
    addressHint: '0x... (EVM address)',
    isEvm: true,
    evmChainId: 84532,
    isTestnet: true,
  },
  {
    id: CHAIN_IDS.BTC,
    symbol: 'BTC',
    name: 'Bitcoin',
    algo: 'SHA-256',
    addressHint: 'bc1... or 1.../3... (Base58)',
  },
  {
    id: CHAIN_IDS.ETH,
    symbol: 'ETH',
    name: 'Ethereum',
    algo: 'PoS',
    addressHint: '0x... (40 hex bytes)',
  },
  {
    id: CHAIN_IDS.SOL,
    symbol: 'SOL',
    name: 'Solana',
    algo: 'PoH/PoS',
    addressHint: 'Base58 (32-44 chars)',
  },
  {
    id: CHAIN_IDS.TRX,
    symbol: 'TRX',
    name: 'Tron',
    algo: 'DPoS',
    addressHint: 'T... (Base58Check)',
  },
  {
    id: CHAIN_IDS.XLM,
    symbol: 'XLM',
    name: 'Stellar',
    algo: 'SCP',
    addressHint: 'G... (56 chars)',
  },
  {
    id: CHAIN_IDS.ETC,
    symbol: 'ETC',
    name: 'Ethereum Classic',
    algo: 'Etchash/Keccak256',
    addressHint: '0x... (40 hex bytes)',
  },
  {
    id: CHAIN_IDS.RVN,
    symbol: 'RVN',
    name: 'Ravencoin',
    algo: 'KawPow',
    addressHint: 'R... (Base58)',
  },
  {
    id: CHAIN_IDS.ERG,
    symbol: 'ERG',
    name: 'Ergo',
    algo: 'Autolykos2',
    addressHint: '9... (51 chars, Base58)',
  },
  {
    id: CHAIN_IDS.KAS,
    symbol: 'KAS',
    name: 'Kaspa',
    algo: 'kHeavyHash',
    addressHint: 'kaspa:... (bech32-like)',
  },
  {
    id: CHAIN_IDS.ALPH,
    symbol: 'ALPH',
    name: 'Alephium',
    algo: 'Blake3',
    addressHint: '1... or T... (Base58)',
  },
  {
    id: CHAIN_IDS.XMR,
    symbol: 'XMR',
    name: 'Monero',
    algo: 'RandomX',
    addressHint: '95 chars starting with 4 or 8 (Base58)',
  },
];

export const CHAIN_BY_ID = CHAINS.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});
