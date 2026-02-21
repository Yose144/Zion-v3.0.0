// ZION Configuration v2.9.5
export const CONFIG = {
  // Network settings — real server nodes
  RPC_NODES: [
    'http://77.42.31.72:8444',     // Helsinki (seed)
    'http://5.78.145.234:8444',    // USA
    'http://5.223.56.124:8444',    // Singapore
  ],
  POOL_API_NODES: [
    'http://77.42.31.72:8080',     // Helsinki pool API
    'http://5.78.145.234:8080',    // USA pool API
    'http://5.223.56.124:8080',    // Singapore pool API
  ],
  POOL_URL: 'https://pool.zionterranova.com',
  API_URL: 'https://api.zionterranova.com',
  EXPLORER_URL: 'https://explorer.zionterranova.com',
  
  // Pool stratum connection
  POOL_HOST: '77.42.31.72',
  POOL_PORT: 3333,
  
  // P2P network
  P2P_PORT: 8334,
  
  // Mining settings
  MINING: {
    MAX_DURATION_MINUTES: 30,
    MIN_BATTERY_PERCENT: 20,
    MAX_TEMPERATURE_C: 42,
    REQUIRE_WIFI: true,
    REQUIRE_CHARGING: true,
    AUTO_STOP_SCREEN_OFF: true,
  },
  
  // Wallet settings
  WALLET: {
    DERIVATION_PATH: "m/44'/9999'/0'/0/0",
    ADDRESS_PREFIX: 'zion1',
    ADDRESS_LENGTH: 44,
    MNEMONIC_STRENGTH: 256, // 24 words
  },
  
  // Consciousness levels
  CONSCIOUSNESS_LEVELS: {
    PHYSICAL: {
      name: 'Physical',
      multiplier: 1.0,
      requiredXP: 0,
      color: '#3b82f6',
    },
    MENTAL: {
      name: 'Mental',
      multiplier: 1.1,
      requiredXP: 5000,
      color: '#8b5cf6',
    },
    SPIRITUAL: {
      name: 'Spiritual',
      multiplier: 1.25,
      requiredXP: 15000,
      color: '#ec4899',
    },
    COSMIC: {
      name: 'Cosmic',
      multiplier: 2.0,
      requiredXP: 50000,
      color: '#f59e0b',
    },
    ON_THE_STAR: {
      name: 'On The Star',
      multiplier: 15.0,
      requiredXP: 200000,
      color: '#eab308',
    },
  },
  
  // Notifications
  NOTIFICATIONS: {
    NEW_BLOCK: true,
    PAYOUT: true,
    LEVEL_UP: true,
    MINING_WARNING: true,
  },
  
  // UI
  REFRESH_INTERVAL: 30000, // 30 seconds
  STATS_UPDATE_INTERVAL: 10000, // 10 seconds
  
  // Security
  BIOMETRIC_ENABLED: true,
  AUTO_LOCK_MINUTES: 5,
  
  // Version
  VERSION: '2.9.5',
  BUILD_NUMBER: 5,
  CODENAME: 'TerraNova',

  // ── wZION Bridge (L1 ↔ EVM) ──────────────────────────────
  BRIDGE: {
    // Base Sepolia testnet (live 21.2.2026)
    TESTNET: {
      CHAIN_ID: 84532,
      RPC_URL: 'https://sepolia.base.org',
      WZION_ADDRESS: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
      BRIDGE_ADDRESS: '0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721',
      EXPLORER: 'https://sepolia.basescan.org',
      NAME: 'Base Sepolia',
    },
    // Base Mainnet (deploy after audit)
    MAINNET: {
      CHAIN_ID: 8453,
      RPC_URL: 'https://mainnet.base.org',
      WZION_ADDRESS: '0x0000000000000000000000000000000000000000', // TBD after mainnet deploy
      BRIDGE_ADDRESS: '0x0000000000000000000000000000000000000000', // TBD after mainnet deploy
      EXPLORER: 'https://basescan.org',
      NAME: 'Base Mainnet',
    },
    // L1 vault address (lock ZION here for bridging)
    L1_VAULT_ADDRESS: 'zion1bridge000000000000000000000000000vault',
    // Scale factor: 1 ZION (6 dec) → 1 wZION wei / 1e12
    SCALE_FACTOR: 1e12,
    MIN_BRIDGE_AMOUNT: 100,   // 100 ZION minimum
    // Relay backend
    RELAY_API: 'https://api.zionterranova.com/api/wzion-bridge',
  },
};

export default CONFIG;
