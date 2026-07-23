// ZION Configuration v3.0.0 — Mainnet
export const CONFIG = {
  // ── Active network mode (mainnet | testnet) ──────────────────────────────────────
  NETWORK_MODE: 'mainnet',

  // ── Network profiles ───────────────────────────────────────────────────────────
  NETWORKS: {
    mainnet: {
      name: 'ZION Mainnet',
      chainId: 'zion-mainnet-1',
      rpcNodes: [
        'http://62.171.141.136:8443/jsonrpc',
      ],
      poolHost: '62.171.141.136',
      poolPort: 8444,
      poolHosts: [{ host: '62.171.141.136', name: 'Edge' }],
      explorerUrl: 'https://explorer.zionterranova.com',
    },
    testnet: {
      name: 'ZION Testnet',
      chainId: 'zion-testnet-1',
      rpcNodes: [
        'http://127.0.0.1:8444/jsonrpc',
      ],
      poolHost: '127.0.0.1',
      poolPort: 8444,
      poolHosts: [{ host: '127.0.0.1', name: 'Local' }],
      explorerUrl: 'https://testnet.explorer.zionterranova.com',
    },
  },

  // ── Active network settings (derived from NETWORK_MODE) ──────────────────────────
  get activeNetwork() {
    return this.NETWORKS[this.NETWORK_MODE] || this.NETWORKS.mainnet;
  },

  // Backwards-compat aliases
  get RPC_NODES() { return this.activeNetwork.rpcNodes; },
  get POOL_HOST() { return this.activeNetwork.poolHost; },
  get POOL_PORT() { return this.activeNetwork.poolPort; },
  get POOL_HOSTS() { return this.activeNetwork.poolHosts; },
  get EXPLORER_URL() { return this.activeNetwork.explorerUrl; },

  POOL_URL: 'https://pool.zionterranova.com',
  API_URL: 'https://api.zionterranova.com',

  // ZionDex Router API (cross-chain DEX)
  ZIONDEX_ROUTER_URL: __DEV__ ? 'http://localhost:8454' : 'https://dex.zionterranova.com',

  // P2P network
  P2P_PORT: 8334,

  // ── CHv4 — NPU Mixing, aktivní od genesis bloku 0 ───────────────────────────────────
  CHV4_NPU_FORK_HEIGHT: 0,          // CHv4 (NPU Mixing INT8 MLP) vždy aktivní
  CHV3_MEMORY_HARD_FORK_HEIGHT: 0,  // 512 KB memory-hard scratchpad vždy aktivní
  ALGORITHM: 'cosmic_harmony',       // Pool-kanonické jméno CHv4 éry
  ALGORITHM_DISPLAY: 'Cosmic Harmony v4',

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
  VERSION: '3.0.0',
  BUILD_NUMBER: 7,
  CODENAME: 'TerraNova',

  // ── Hiran AI Inference + Hiranyagarbha Orchestrator ─────────────────────────
  AI: {
    HIRAN_INFERENCE_URL: 'http://localhost:8002',
    HIRANYAGARBHA_URL: 'http://localhost:8001',
    HIRAN_MODEL: 'hiran-v2.2',
    TIMEOUT: 30000,
  },

  // ── Neural Compute Layer (NCL) — routed through Hiranyagarbha /ncl/* ────────
  NCL: {
    ENABLED: true,
    API_BASE: 'http://localhost:8001/ncl',
    JOB_TIMEOUT: 60000,
  },

  // ── wZION Bridge (L1 ↔ EVM) ──────────────────────────────
  BRIDGE: {
    // Base Sepolia testnet (live 21.2.2026)
    TESTNET: {
      CHAIN_ID: 84532,
      RPC_URL: 'https://sepolia.base.org',
      WZION_ADDRESS: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
      BRIDGE_ADDRESS: '0xF4BF85443ad6c9b88f3a5314cC3Fb59C32Cedca1',
      BRIDGE_VALIDATOR_ADDRESS: '0x0000000000000000000000000000000000000000', // testnet single-sig
      EXPLORER: 'https://sepolia.basescan.org',
      NAME: 'Base Sepolia',
    },
    // Base Mainnet (5/5 multisig deployed 2026-06-22)
    MAINNET: {
      CHAIN_ID: 8453,
      RPC_URL: 'https://mainnet.base.org',
      WZION_ADDRESS: '0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6',
      BRIDGE_ADDRESS: '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467', // ZIONBridge v3
      BRIDGE_VALIDATOR_ADDRESS: '0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627', // BridgeValidator 5/5
      EXPLORER: 'https://basescan.org',
      NAME: 'Base Mainnet',
      THRESHOLD: 5,
      VALIDATOR_COUNT: 5,
    },
    // L1 vault address (keyless derivation, ~100M ZION locked)
    L1_VAULT_ADDRESS: 'zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0',
    // Scale factor: 1 ZION (6 dec) → 1 wZION wei / 1e12
    SCALE_FACTOR: 1e12,
    MIN_BRIDGE_AMOUNT: 100,   // 100 ZION minimum
    // Relay backend
    RELAY_API: 'https://api.zionterranova.com/api/wzion-bridge',
  },

  // ── In-App Purchases ──────────────────────────────────────────────────────
  IAP: {
    // Product IDs (must match App Store Connect + Google Play Console)
    PRODUCT_IDS: {
      PRO_LIFETIME: 'zion.pro.lifetime',
      PRO_YEARLY: 'zion.pro.yearly',
      PRO_MONTHLY: 'zion.pro.monthly',
      MINER_BOOST: 'zion.miner.boost',
      DONATE_5: 'zion.donate.5',
      DONATE_25: 'zion.donate.25',
    },
    // All product IDs as array (for fetchProducts)
    ALL_PRODUCT_IDS: [
      'zion.pro.lifetime',
      'zion.pro.yearly',
      'zion.pro.monthly',
      'zion.miner.boost',
      'zion.donate.5',
      'zion.donate.25',
    ],
    // Entitlements (feature gates)
    ENTITLEMENTS: {
      PRO: 'pro',           // Unlimited wallets, TX export, advanced stats, no ads
      MINER_BOOST: 'miner_boost', // GPU mining, auto-tuner, push notifications
    },
    // Update server for receipt validation
    VALIDATION_URL: 'https://updates.zionterranova.com/api/iap',
    // Subscription SKU groups (for getSubscriptions vs getProducts)
    SUBSCRIPTION_IDS: ['zion.pro.yearly', 'zion.pro.monthly'],
    ONE_TIME_IDS: ['zion.pro.lifetime', 'zion.miner.boost', 'zion.donate.5', 'zion.donate.25'],
  },

  // ── App version ───────────────────────────────────────────────────────────
  VERSION: '3.0.6',
  BUILD_NUMBER: '8',
  CODENAME: 'Trinity',
};

export default CONFIG;
