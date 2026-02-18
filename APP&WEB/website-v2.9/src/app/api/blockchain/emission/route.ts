/**
 * ZION Explorer — Emission & Supply API
 * 
 * Returns emission data: total mined, fees collected, supply schedule.
 * ZION Economics: Decade Decay emission (-20%/decade), 5,400.067 → 724.785 ZION/block, 144B max supply.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import {
  ATOMIC_UNITS_PER_ZION,
  BLOCK_REWARD_ZION,
  TOTAL_SUPPLY_ZION,
  BLOCKS_PER_DAY,
  BLOCKS_PER_YEAR,
  DAILY_EMISSION_ZION,
  YEARLY_EMISSION_ZION,
  MINER_SHARE_PCT,
  HUMANITARIAN_TITHE_PCT,
  POOL_FEE_PCT,
  MINER_REWARD_ZION,
  HUMANITARIAN_REWARD_ZION,
  POOL_FEE_ZION,
} from '@/lib/constants';

export async function GET() {
  const rpc = getZionRpc();

  try {
    const info = await rpc.getInfo();
    const height = info.height;

    // Try real emission from RPC
    let emission = { total: 0, fees: 0 };
    try {
      const emissionData = await rpc.getCoinbaseTxSum(0, height);
      // getCoinbaseTxSum returns atomic units; convert to ZION
      emission.total = emissionData.emission_amount / ATOMIC_UNITS_PER_ZION;
      emission.fees = emissionData.fee_amount / ATOMIC_UNITS_PER_ZION;
    } catch {
      // Estimate from block height (fallback)
      emission.total = height * BLOCK_REWARD_ZION;
    }

    // Estimated time to mine all supply
    const remainingSupply = TOTAL_SUPPLY_ZION - emission.total;
    const estimatedDaysRemaining = remainingSupply / DAILY_EMISSION_ZION;
    const estimatedYearsRemaining = estimatedDaysRemaining / 365.25;

    return NextResponse.json({
      // Current emission
      total_emission: emission.total,
      total_fees: emission.fees,
      total_burned: emission.fees, // ZION burns ALL fees

      // Supply
      circulating_supply: emission.total,
      max_supply: TOTAL_SUPPLY_ZION,
      emission_pct: (emission.total / TOTAL_SUPPLY_ZION * 100),
      remaining_supply: remainingSupply,

      // Rate
      base_reward_per_block: BLOCK_REWARD_ZION,
      blocks_per_day: BLOCKS_PER_DAY,
      daily_emission: DAILY_EMISSION_ZION,
      yearly_emission: YEARLY_EMISSION_ZION,

      // Reward distribution (pool-level: 89% miner, 5% humanitarian, 5% Issobella fund, 1% pool)
      reward_distribution: {
        miner_pct: MINER_SHARE_PCT,
        humanitarian_pct: HUMANITARIAN_TITHE_PCT,
        pool_fee_pct: POOL_FEE_PCT,
        miner_per_block: MINER_REWARD_ZION,
        humanitarian_per_block: HUMANITARIAN_REWARD_ZION,
        pool_fee_per_block: POOL_FEE_ZION,
      },

      // Projection
      estimated_years_remaining: estimatedYearsRemaining,
      estimated_full_emission_date: new Date(
        Date.now() + estimatedDaysRemaining * 24 * 60 * 60 * 1000
      ).toISOString().split('T')[0],

      // Current chain state
      block_height: height,
      difficulty: info.difficulty,

      // Humanitarian tithe (pool-level distribution)
      humanitarian: {
        rate: HUMANITARIAN_TITHE_PCT / 100,
        per_block: HUMANITARIAN_REWARD_ZION,
        estimated_total: emission.total * HUMANITARIAN_TITHE_PCT / 100,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Failed to fetch emission data:', error);
    return NextResponse.json({ error: 'Failed to fetch emission data' }, { status: 503 });
  }
}
