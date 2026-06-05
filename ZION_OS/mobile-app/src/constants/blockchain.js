/**
 * ZION TerraNova v3.0.0 — Blockchain Constants
 *
 * Mirror of Rust core: V3/L1/core/src/emission.rs + genesis.rs
 * These values are IMMUTABLE after MainNet genesis.
 *
 * 1 ZION = 1_000_000_000_000 flowers (12 decimal places)
 *
 * Synchronizováno s AGENTS.md (V3 mainnet, CHv4, revenue split 89/5/5/1)
 */

// ---------------------------------------------------------------------------
// Supply
// ---------------------------------------------------------------------------

/** Atomic units per 1 ZION (6 decimals) */
export const ATOMIC_UNITS_PER_ZION = 1_000_000_000_000; // 1 ZION = 1e12 flowers (12 des. míst) — WP3.0 spec

/** Total supply: 144,000,000,000 ZION */
export const TOTAL_SUPPLY = 144_000_000_000;

/** Genesis premine: 16,280,000,000 ZION (11.31%) */
export const GENESIS_PREMINE = 16_280_000_000;

/** Mining emission: 127,720,000,000 ZION (88.69%) */
export const MINING_EMISSION = TOTAL_SUPPLY - GENESIS_PREMINE;

// ---------------------------------------------------------------------------
// Emission schedule (constant — no halving)
// ---------------------------------------------------------------------------

/** Block time target: 60 seconds */
export const BLOCK_TIME_SECONDS = 60;

/** Blocks per year: 525,600 */
export const BLOCKS_PER_YEAR = 525_600;

/** Blocks per decade: 5,256,000 */
export const BLOCKS_PER_DECADE = 5_256_000;

/** Decades with active decay before tail emission */
export const MAX_DECAY_DECADES = 10;

/** Mining duration: 45 years */
export const MINING_YEARS = 100; // 10 dekád Decade Decay — WP3.0 spec

/** Total mineable blocks: 23,652,000 */
export const TOTAL_MINING_BLOCKS = MINING_YEARS * BLOCKS_PER_YEAR;

/** Base block reward (Decade 1): 5,400.067 ZION */
export const BLOCK_REWARD_ZION = 5400.067;
export const BLOCK_REWARD_ATOMIC = 5_400_067_000_000_000; // 5400.067 ZION × 1e12 flowers — WP3.0 Decade 1

/** Tail emission reward (~724.785 ZION) after decade 10 */
export const TAIL_REWARD_ZION = 724.784723787776;
export const TAIL_REWARD_ATOMIC = 724_784_723_787_776;

/** Daily emission (Decade 1): 5,400.067 × 1440 blocks = ~7,776,096.48 ZION/day */
export const DAILY_EMISSION = BLOCK_REWARD_ZION * 1440;

/** Annual emission (Decade 1): 5,400.067 × 525,600 = ~2,838,275,203 ZION/year */
export const ANNUAL_EMISSION = BLOCK_REWARD_ZION * BLOCKS_PER_YEAR;

// ---------------------------------------------------------------------------
// Reward distribution (per block) — v3.0.0: 89% / 5% / 5% / 1%
// ---------------------------------------------------------------------------

/** Miner share: 89% */
export const MINER_SHARE_PERCENT = 89;

/** Humanitarian fund (L5 Free World): 5% (bylo 10% v v2.9.5) */
export const HUMANITARIAN_PCT = 5;
export const TITHE_PERCENT = 5; // zpětná kompatibilita

/** ZION Issobella (L6): 5% */
export const ISSOBELLA_PCT = 5;

/** Pool fee: 1% */
export const POOL_FEE_PERCENT = 1;

/** Miner reward per block: 4,806.05963 ZION */
export const MINER_REWARD_ZION = BLOCK_REWARD_ZION * MINER_SHARE_PERCENT / 100;

/** Humanitarian per block: 270.00335 ZION */
export const HUMANITARIAN_REWARD_ZION = BLOCK_REWARD_ZION * HUMANITARIAN_PCT / 100;

/** Issobella per block: 270.00335 ZION */
export const ISSOBELLA_REWARD_ZION = BLOCK_REWARD_ZION * ISSOBELLA_PCT / 100;

/** Pool fee per block: 54.00067 ZION */
export const POOL_FEE_ZION = BLOCK_REWARD_ZION * POOL_FEE_PERCENT / 100;

/** Canonical fee-split addresses (mainnet) — matches V3/L1/core/src/genesis.rs */
export const FEE_SPLIT_ADDRESSES = {
  MINER: 'zion1w523a76830x2t5m7f3j023w265e8g5c400a4790',
  HUMANITARIAN: 'zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4',
  ISSOBELLA: 'zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702',
  POOL_FEE: 'zion196m4n8x764v7a0s406j40094a8z5j8m6z7nk342',
};

/** Frozen genesis block hash — all nodes must agree */
export const GENESIS_HASH = '003529805e9b47babb9ac0f26b27b1aad0a1cf3c483181857daf3269f7088923';

// ---------------------------------------------------------------------------
// Genesis premine allocation
// ---------------------------------------------------------------------------

export const PREMINE_ALLOCATION = [
  {
    category: 'ZION OASIS + Winners Golden Egg/Xp',
    amount: 8_250_000_000,
    percent: 50.7,
    slots: 5,
    lock: 'Immediate',
  },
  {
    category: 'DAO Treasury',
    amount: 4_000_000_000,
    percent: 24.6,
    slots: 3,
    lock: 'Immediate',
  },
  {
    category: 'Infrastructure & Dev',
    amount: 2_590_000_000,
    percent: 15.9,
    slots: 3,
    lock: 'Immediate',
  },
  {
    category: 'Humanitarian Fund',
    amount: 1_440_000_000,
    percent: 8.8,
    slots: 1,
    lock: 'Immediate',
  },
];

// ---------------------------------------------------------------------------
// Consensus & validation
// ---------------------------------------------------------------------------

/** Coinbase maturity: 100 blocks (~100 min) */
export const COINBASE_MATURITY = 100;

/** Max reorg depth: 10 blocks */
export const MAX_REORG_DEPTH = 10;

/** Soft finality: 60 blocks (~1 hour) */
export const SOFT_FINALITY = 60;

/** DAA: LWMA, 60-block window, ±25% per block */
export const DAA_WINDOW = 60;
export const DAA_MAX_CHANGE_PERCENT = 25;

/** Mining algorithm — CHv4 kanonické jméno (pool-compatible) */
export const ALGORITHM = 'cosmic_harmony';
export const ALGORITHM_DISPLAY = 'Cosmic Harmony v4';

// ── CHv4 Fork Heights (obě = 0, vždy aktivní od genesis) ──────────────────────────
export const CHV4_NPU_FORK_HEIGHT = 0;         // NPU Mixing INT8 MLP vždy aktivní
export const CHV3_MEMORY_HARD_FORK_HEIGHT = 0; // 512 KB scratchpad vždy aktivní

/** Transaction model */
export const TX_MODEL = 'UTXO';

/** Signature scheme */
export const SIGNATURE_SCHEME = 'Ed25519';

// ---------------------------------------------------------------------------
// Fee model — ALL FEES BURNED
// ---------------------------------------------------------------------------

/** Minimum fee per byte (atomic units) */
export const MIN_FEE_PER_BYTE = 1;

/** Fee policy: all transaction fees are destroyed (deflationary) */
export const FEE_POLICY = 'burn';

/**
 * Estimate fee for a transaction.
 * Simple heuristic: ~250 bytes per UTXO input + 34 bytes per output + 10 overhead.
 * @param {number} inputCount - Number of UTXO inputs
 * @param {number} outputCount - Number of outputs (usually 2: recipient + change)
 * @returns {number} Estimated fee in ZION
 */
export function estimateFee(inputCount = 1, outputCount = 2) {
  const estimatedBytes = inputCount * 250 + outputCount * 34 + 10;
  const feeAtomic = estimatedBytes * MIN_FEE_PER_BYTE;
  return feeAtomic / ATOMIC_UNITS_PER_ZION;
}

// ---------------------------------------------------------------------------
// Network defaults (TestNet)
// ---------------------------------------------------------------------------

export const NETWORKS = {
  testnet: {
    chainId: 'zion-testnet-1',
    p2pPort: 8334,
    rpcPort: 8444,
    stratumPort: 8444,
    poolApiPort: 8080,
  },
  mainnet: {
    chainId: 'zion-mainnet-1',
    p2pPort: 8333,
    rpcPort: 8443,
    stratumPort: 8444,
    poolApiPort: 8080,
  },
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Convert atomic units to ZION (human-readable).
 * @param {number|string} atomic - Value in atomic units
 * @returns {number} Value in ZION
 */
export function atomicToZion(atomic) {
  return Number(atomic) / ATOMIC_UNITS_PER_ZION;
}

/**
 * Convert ZION to atomic units.
 * @param {number} zion - Value in ZION
 * @returns {number} Value in atomic units (integer)
 */
export function zionToAtomic(zion) {
  return Math.round(Number(zion) * ATOMIC_UNITS_PER_ZION);
}

/**
 * Format ZION amount for display.
 * @param {number} zion - Amount in ZION
 * @param {number} decimals - Decimal places (default 6)
 * @returns {string} Formatted string
 */
export function formatZion(zion, decimals = 6) {
  if (zion === null || zion === undefined) return '0';
  const n = Number(zion);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(decimals);
}

/**
 * Calculate block reward at given height.
 * Mirrors Rust: emission::block_subsidy()
 * Decade Decay: reward × (4/5) every 5,256,000 blocks.
 * After decade 10: perpetual tail emission.
 * @param {number} height
 * @returns {number} Reward in ZION (0 for genesis)
 */
export function blockRewardAt(height) {
  if (height === 0) return 0;
  const decade = Math.floor((height - 1) / BLOCKS_PER_DECADE);
  if (decade >= MAX_DECAY_DECADES) {
    return TAIL_REWARD_ZION;
  }
  let reward = BLOCK_REWARD_ZION;
  for (let i = 0; i < decade; i++) {
    reward = reward * 4 / 5;
  }
  return reward;
}

/**
 * Calculate current circulating supply from mining at given height.
 * @param {number} height - Current block height
 * @returns {number} Circulating supply in ZION (premine + mined)
 */
export function circulatingSupply(height) {
  if (height <= 0) return GENESIS_PREMINE;
  const blocks = Math.min(height, TOTAL_MINING_BLOCKS);
  let supply = GENESIS_PREMINE;
  let currentHeight = 1;
  while (currentHeight <= blocks) {
    const decade = Math.floor((currentHeight - 1) / BLOCKS_PER_DECADE);
    const endOfDecade = Math.min((decade + 1) * BLOCKS_PER_DECADE, blocks);
    const blocksInSpan = endOfDecade - currentHeight + 1;
    supply += blocksInSpan * blockRewardAt(currentHeight);
    currentHeight = endOfDecade + 1;
  }
  return supply;
}

/**
 * Estimate remaining mining time from current height.
 * @param {number} height - Current block height
 * @returns {{ blocks: number, days: number, years: number }}
 */
export function remainingMining(height) {
  const remaining = Math.max(0, TOTAL_MINING_BLOCKS - height);
  const days = (remaining * BLOCK_TIME_SECONDS) / 86400;
  const years = days / 365.25;
  return { blocks: remaining, days: Math.round(days), years: parseFloat(years.toFixed(1)) };
}
