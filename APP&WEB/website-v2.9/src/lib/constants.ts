/**
 * ZION TerraNova — Shared Blockchain Constants
 *
 * Single source of truth for all ZION economic parameters.
 * Mirrors core/src/blockchain/reward.rs in Rust.
 *
 * ⚠️  NEVER use hardcoded numbers like 50, 1e9, 1e12 anywhere.
 *     Import from this file instead.
 *
 * v2.9.6: Decade Decay emission (-20%/10y), 5%+5% distribution,
 *         6-layer architecture (L5 Free World + L6 ZION Issobella)
 */

// ─── Unit Conversion ─────────────────────────────────────────────────────────

/**
 * 1 ZION = 1,000,000 flowers (6 decimal places) — v3.0.5 fork spec.
 *
 * Changed from 1e12 (12 decimals) to 1e6 (6 decimals) in the 3.0.5 decimal fork.
 * See `ZION_3.0.5_DECIMAL_FORK_PLAN.md` and `docs/CANONICAL_UNITS_AUDIT.md`.
 *
 * "Flowers" is the canonical sub-unit name used across L1 core (Rust),
 * RPC payloads (`balance_flowers`, `amount_flowers`, `fee_flowers`),
 * pool payouts, wallets and bridges.
 *
 * `ATOMIC_UNITS_PER_ZION` is preserved as a backward-compatible alias for
 * older website code; new code should use `FLOWERS_PER_ZION`.
 */
export const FLOWERS_PER_ZION = 1_000_000;

/** @deprecated Use `FLOWERS_PER_ZION` — kept for backward compatibility. */
export const ATOMIC_UNITS_PER_ZION = FLOWERS_PER_ZION;

/** Convert flowers (atomic units) to ZION. */
export function flowersToZion(flowers: number): number {
  return flowers / FLOWERS_PER_ZION;
}

/** Convert ZION to flowers (atomic units), rounded to the nearest integer. */
export function zionToFlowers(zion: number): number {
  return Math.round(zion * FLOWERS_PER_ZION);
}

/** @deprecated Use `flowersToZion` — kept for backward compatibility. */
export function atomicToZion(atomic: number): number {
  return flowersToZion(atomic);
}

/** @deprecated Use `zionToFlowers` — kept for backward compatibility. */
export function zionToAtomic(zion: number): number {
  return zionToFlowers(zion);
}

// ─── Emission Parameters (Decade Decay — Model A) ───────────────────────────

/** Base block reward (Decade 1): 5,400.067 ZION per block */
export const BLOCK_REWARD_ZION = 5_400.067;

/** Block reward in flowers: 5,400,067,000 (5400.067 ZION × 1e6) — v3.0.5 Decade 1 */
export const BLOCK_REWARD_ATOMIC = 5_400_067_000;

/** Decay factor per decade: ×0.8 (-20%) */
export const DECAY_FACTOR = 0.8;

/** Blocks per decade: 5,256,000 (10 years × 525,600 blocks/year) */
export const BLOCKS_PER_DECADE = 5_256_000;

/** Maximum decay decades before tail emission */
export const MAX_DECAY_DECADES = 10;

/** Tail emission: ~724.785 ZION/block (perpetual after decade 10) */
export const TAIL_REWARD_ZION = 724.785;

/** Total supply cap: 144 billion ZION */
export const TOTAL_SUPPLY_ZION = 144_000_000_000;

/** Genesis premine: 16.78 billion ZION (16,780,000,000,000,000 flowers / 1e6) */
export const GENESIS_PREMINE_ZION = 16_780_000_000;

/** Calculate block reward at a given height using Decade Decay */
export function blockRewardAtHeight(height: number): number {
  if (height <= 0) return 0;
  const decade = Math.floor((height - 1) / BLOCKS_PER_DECADE);
  if (decade >= MAX_DECAY_DECADES) return TAIL_REWARD_ZION;
  return BLOCK_REWARD_ZION * Math.pow(DECAY_FACTOR, decade);
}

// ─── Timing ──────────────────────────────────────────────────────────────────

/** Target block time: 60 seconds */
export const BLOCK_TIME_SECONDS = 60;

/** Blocks per day: 1,440 */
export const BLOCKS_PER_DAY = (24 * 60 * 60) / BLOCK_TIME_SECONDS; // 1440

/** Blocks per year: 525,600 */
export const BLOCKS_PER_YEAR = 525_600;

/** Mining horizon: 100+ years + perpetual tail emission */
export const MINING_HORIZON_LABEL = '100+ years + tail ∞';

/** Daily emission in ZION (Decade 1) */
export const DAILY_EMISSION_ZION = BLOCKS_PER_DAY * BLOCK_REWARD_ZION; // ~7,776,096.48

/** Yearly emission in ZION (Decade 1) */
export const YEARLY_EMISSION_ZION = BLOCKS_PER_YEAR * BLOCK_REWARD_ZION;

// ─── Reward Distribution ─────────────────────────────────────────────────────

/** Miner share: 89% of block reward */
export const MINER_SHARE_PCT = 89;

/** Humanitarian tithe: 5% of block reward */
export const HUMANITARIAN_TITHE_PCT = 5;

/** L5/L6 ZION Issobella fund: 5% of block reward */
export const ISSOBELLA_FUND_PCT = 5;

/** Pool operator fee: 1% of block reward */
export const POOL_FEE_PCT = 1;

// ─── Tithe Wallet Addresses (mainnet canonical, 2026-07-06 hard reset) ────

/** Humanitarian fund wallet (Children Future Fund) — mainnet canonical */
export const HUMANITARIAN_WALLET = 'zion136m4u7f8s5w3l0e00342s7a4r282275442vm2w3';

/** L5/L6 Issobella fund wallet — mainnet canonical */
export const ISSOBELLA_WALLET = 'zion173g835z228z6u303z59603y236r5e854l36g604';

/** Pool fee wallet — BURNED (no address; 1% is permanently removed at coinbase) */
export const POOL_FEE_WALLET = '';

/** Pool / miner payout wallet — mainnet canonical (receives 89% miner slice) */
export const POOL_WALLET = 'zion1k4g2d8s3y4m5v238k0l3v6y5n48894n357uv064';

/** Miner reward per block in ZION (Decade 1) */
export const MINER_REWARD_ZION = BLOCK_REWARD_ZION * MINER_SHARE_PCT / 100;

/** Humanitarian tithe per block in ZION (Decade 1) */
export const HUMANITARIAN_REWARD_ZION = BLOCK_REWARD_ZION * HUMANITARIAN_TITHE_PCT / 100;

/** L5/L6 Issobella fund per block in ZION (Decade 1) */
export const ISSOBELLA_FUND_ZION = BLOCK_REWARD_ZION * ISSOBELLA_FUND_PCT / 100;

/** Pool fee per block in ZION (Decade 1) */
export const POOL_FEE_ZION = BLOCK_REWARD_ZION * POOL_FEE_PCT / 100;

// ─── Consensus ───────────────────────────────────────────────────────────────

/** Max reorg depth: 10 blocks */
export const MAX_REORG_DEPTH = 10;

/** Soft finality: 60 blocks */
export const SOFT_FINALITY_DEPTH = 60;

/** Coinbase maturity: 100 blocks */
export const COINBASE_MATURITY = 100;

// ─── Explorer / UI labels (known on-chain addresses) ─────────────────────────

export type KnownAddressType = 'humanitarian' | 'issobella' | 'pool_fee' | 'other';

export const KNOWN_ADDRESS_LABELS: Record<
  string,
  {
    label: string;
    type: KnownAddressType;
  }
> = {
  [HUMANITARIAN_WALLET]: { label: 'Humanitarian Fund (Children Future Fund)', type: 'humanitarian' },
  [ISSOBELLA_WALLET]: { label: 'L5/L6 Issobella Space Fund', type: 'issobella' },
  [POOL_WALLET]: { label: 'Pool / Miner Payout Wallet', type: 'pool_fee' },
};

/** Pool payout / fee wallet used by explorer heuristics (`is_pool_block`). */
export const POOL_FEE_WALLET_HEURISTIC = POOL_WALLET;
