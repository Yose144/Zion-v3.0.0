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
  BLOCK_REWARD_ZION,
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
  TOTAL_SUPPLY_ZION,
} from '@/lib/constants';
import { resolveSupplySnapshot } from '@/lib/supply';

export async function GET() {
  const rpc = getZionRpc();

  try {
    const info = await rpc.getInfo();
    const height = info.height;

    const supply = await resolveSupplySnapshot(rpc, height);

    return NextResponse.json({
      // Current emission
      total_emission: supply.minedSupply,
      total_fees: 0,
      total_burned: 0,

      // Supply
      circulating_supply: supply.circulatingSupply,
      max_supply: supply.maxSupply,
      emission_pct: supply.emissionPct,
      remaining_supply: supply.remainingSupply,

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
      estimated_years_remaining: supply.estimatedYearsRemaining,
      estimated_full_emission_date: supply.estimatedFullEmissionDate,
      mining_horizon_label: supply.miningHorizonLabel,

      // Current chain state
      block_height: height,
      difficulty: info.difficulty,

      // Humanitarian tithe (pool-level distribution)
      humanitarian: {
        rate: HUMANITARIAN_TITHE_PCT / 100,
        per_block: HUMANITARIAN_REWARD_ZION,
        estimated_total: supply.minedSupply * HUMANITARIAN_TITHE_PCT / 100,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Failed to fetch emission data:', error);
    return NextResponse.json({ error: 'Failed to fetch emission data' }, { status: 503 });
  }
}
