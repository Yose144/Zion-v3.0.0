import { NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

export async function GET() {
  const rpc = getZionRpc();

  let poolStats: any = null;
  try {
    poolStats = await rpc.getPoolStats();
  } catch { /* pool unreachable */ }

  const validShares = poolStats?.shares?.valid ?? poolStats?.routing?.accepted ?? 0;
  const invalidShares = poolStats?.shares?.invalid ?? poolStats?.routing?.rejected ?? 0;
  const routing = poolStats?.routing ?? null;

  return NextResponse.json({
    ok: !!poolStats,
    timestamp: Date.now(),
    aggregate: {
      hashrate: 0,
      hashrate_24h: 0,
      active_miners: poolStats?.miners?.active ?? 0,
      total_miners: poolStats?.miners?.total ?? 0,
      blocks_found: 0,
      valid_shares: validShares,
      invalid_shares: invalidShares,
      share_efficiency: validShares > 0 ? ((validShares / (validShares + invalidShares)) * 100).toFixed(2) : '0',
    },
    fee: {
      pool_fee: 5,
      humanitarian_tithe: 5,
      miner_share: 90,
      min_payout: 0.1,
    },
    routing,
    servers: [{
      id: 'primary',
      name: 'Zion2 Primary',
      flag: '🖥️',
      region: 'primary',
      stratum: 3333,
      online: !!poolStats,
      stats: poolStats,
    }],
    miners: [],
    recent_blocks: [],
  });
}
