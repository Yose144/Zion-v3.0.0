import { NextResponse, NextRequest } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!address || address.length < 10) {
    return NextResponse.json({ ok: false, error: 'Invalid address' }, { status: 400 });
  }

  const rpc = getZionRpc();

  // Try to get on-chain balance for this address
  let balance: any = null;
  try {
    balance = await rpc.getAddressBalance(address);
  } catch { /* address not found */ }

  // Get pool share stats (aggregate, not per-miner — V3 pool doesn't expose per-miner data)
  let poolStats: any = null;
  try {
    poolStats = await rpc.getPoolStats();
  } catch { /* pool unreachable */ }

  const validShares = poolStats?.routing?.accepted ?? 0;
  const invalidShares = poolStats?.routing?.rejected ?? 0;
  const totalShares = validShares + invalidShares;
  const efficiency = totalShares > 0 ? ((validShares / totalShares) * 100).toFixed(2) : '0';

  return NextResponse.json({
    ok: true,
    address,
    active: false,
    stats: {
      hashrate_1h: 0,
      hashrate_24h: 0,
      total_shares: totalShares,
      valid_shares: validShares,
      invalid_shares: invalidShares,
      efficiency,
      blocks_found: 0,
      total_paid: 0,
      pending_balance: balance?.balance_zion ?? 0,
      last_share_time: 0,
    },
    payouts: [],
    blocks: [],
    servers: [{
      id: 'primary',
      connected: !!poolStats,
    }],
  });
}
