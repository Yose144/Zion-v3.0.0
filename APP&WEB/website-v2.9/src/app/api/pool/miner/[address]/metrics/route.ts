import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { SITE_PRIMARY_POOL_API_URL } from '@/lib/site';

async function fetchPoolApiJson<T = any>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${SITE_PRIMARY_POOL_API_URL}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as T;
  } catch {
    return null;
  }
}

/**
 * Prefer per-miner pool accounting stats when the backend exposes them.
 * Fall back to aggregate pool routing data when the deployed backend is older.
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

  const [poolStats, minerStatsPayload] = await Promise.all([
    rpc.getPoolStats().catch(() => null),
    fetchPoolApiJson<any>(`/api/v1/miner/${address}/stats`),
  ]);

  const minerStats = minerStatsPayload?.ok && minerStatsPayload?.stats ? minerStatsPayload.stats : null;

  const connected = !!poolStats || !!minerStats;
  const accepted = minerStats?.valid_shares ?? poolStats?.routing?.accepted ?? 0;
  const rejected = minerStats?.invalid_shares ?? poolStats?.routing?.rejected ?? 0;
  const hashrate = minerStats?.hashrate_1h ?? 0;
  const blocksFound = minerStats?.blocks_found ?? 0;
  const pendingBalanceAtomic = minerStats?.pending_balance ?? 0;
  const paidTotalAtomic = minerStats?.total_paid ?? 0;
  const connectionsActive = minerStats?.last_share_time ? 1 : 0;

  return NextResponse.json({
    ok: true,
    address,
    has_metrics: connected && (hashrate > 0 || accepted > 0 || rejected > 0 || blocksFound > 0 || pendingBalanceAtomic > 0 || paidTotalAtomic > 0),
    scrape_ts: Math.floor(Date.now() / 1000),
    source: minerStats ? 'pool-accounting' : 'pool-routing-fallback',
    metrics: {
      hashrate,
      shares_valid: accepted,
      shares_invalid: rejected,
      blocks_found: blocksFound,
      pending_balance_atomic: pendingBalanceAtomic,
      paid_total_atomic: paidTotalAtomic,
      connections_active: connectionsActive,
    },
    servers: [{
      server: 'primary',
      connected,
      metrics_available: connected,
      values: connected ? {
        hashrate,
        shares_valid: accepted,
        shares_invalid: rejected,
        blocks_found: blocksFound,
        pending_balance_atomic: pendingBalanceAtomic,
        paid_total_atomic: paidTotalAtomic,
        connections_active: connectionsActive,
      } : null,
    }],
  });
}
