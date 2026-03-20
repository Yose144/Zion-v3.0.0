import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

/**
 * V3 pool does not expose per-miner Prometheus metrics.
 * Return aggregate pool routing stats as the best available data.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!address || address.length < 10) {
    return NextResponse.json({ ok: false, error: 'Invalid address' }, { status: 400 });
  }

  const rpc = getZionRpc();

  let poolStats: any = null;
  try {
    poolStats = await rpc.getPoolStats();
  } catch { /* pool unreachable */ }

  const connected = !!poolStats;
  const accepted = poolStats?.routing?.accepted ?? 0;
  const rejected = poolStats?.routing?.rejected ?? 0;

  return NextResponse.json({
    ok: true,
    address,
    has_metrics: connected && (accepted > 0 || rejected > 0),
    scrape_ts: Math.floor(Date.now() / 1000),
    metrics: {
      hashrate: 0,
      shares_valid: accepted,
      shares_invalid: rejected,
      blocks_found: 0,
      pending_balance_atomic: 0,
      paid_total_atomic: 0,
      connections_active: 0,
    },
    servers: [{
      server: 'primary',
      connected,
      metrics_available: connected,
      values: connected ? {
        hashrate: 0,
        shares_valid: accepted,
        shares_invalid: rejected,
        blocks_found: 0,
        pending_balance_atomic: 0,
        paid_total_atomic: 0,
        connections_active: 0,
      } : null,
    }],
  });
}
