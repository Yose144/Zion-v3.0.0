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
 * The pool server tracks miners by worker name, not payout address.
 * Cross-reference the /miners list to find the worker matching this payout address.
 */
async function findMinerByPayoutAddress(address: string): Promise<any | null> {
  const list = await fetchPoolApiJson<any>('/miners?limit=500');
  if (!list?.ok || !Array.isArray(list?.miners)) return null;
  const lower = address.toLowerCase();
  return list.miners.find((m: any) =>
    typeof m.payout_address === 'string' && m.payout_address.toLowerCase() === lower,
  ) ?? null;
}

/**
 * Prefer per-miner pool accounting stats when the backend exposes them.
 * Fall back to cross-referenced miner from /miners list (by payout_address).
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

  const [poolStats, minerStatsPayload, listMiner] = await Promise.all([
    rpc.getPoolStats().catch(() => null),
    fetchPoolApiJson<any>(`/api/v1/miner/${address}/stats`),
    findMinerByPayoutAddress(address),
  ]);

  // Prefer direct stats; fall back to /miners list cross-ref
  let minerStats = minerStatsPayload?.ok && minerStatsPayload?.stats ? minerStatsPayload.stats : null;
  if (!minerStats && listMiner) {
    minerStats = listMiner;
  }

  const connected = !!poolStats || !!minerStats;
  const accepted = minerStats?.valid_shares ?? poolStats?.routing?.accepted ?? 0;
  const rejected = minerStats?.invalid_shares ?? poolStats?.routing?.rejected ?? 0;
  const hashrate = minerStats?.hashrate_1h ?? minerStats?.hashrate ?? 0;
  const hashrate24h = minerStats?.hashrate_24h ?? 0;
  const blocksFound = minerStats?.blocks_found ?? 0;
  const pendingBalanceAtomic = minerStats?.pending_balance ?? 0;
  const paidTotalAtomic = minerStats?.total_paid ?? 0;
  const lastShareTime = minerStats?.last_share_time ?? minerStats?.last_share ?? minerStats?.last_seen ?? 0;
  const connectionsActive = lastShareTime > 0 ? 1 : 0;
  const workerName = listMiner?.worker_name ?? minerStats?.worker_name ?? null;

  const hasMetrics = connected && (hashrate > 0 || accepted > 0 || rejected > 0 || blocksFound > 0 || pendingBalanceAtomic > 0 || paidTotalAtomic > 0);

  return NextResponse.json({
    ok: true,
    address,
    worker_name: workerName,
    has_metrics: hasMetrics,
    scrape_ts: Math.floor(Date.now() / 1000),
    source: minerStats ? (minerStatsPayload?.ok ? 'pool-accounting' : 'pool-miners-list') : 'pool-routing-fallback',
    metrics: {
      hashrate,
      hashrate_24h: hashrate24h,
      shares_valid: accepted,
      shares_invalid: rejected,
      blocks_found: blocksFound,
      pending_balance_atomic: pendingBalanceAtomic,
      paid_total_atomic: paidTotalAtomic,
      connections_active: connectionsActive,
      last_share_time: lastShareTime,
    },
    pool_context: poolStats ? {
      pool_hashrate: poolStats.hashrate?.pool ?? poolStats.pool_hashrate ?? 0,
      pool_hashrate_24h: poolStats.hashrate?.pool_24h ?? poolStats.pool_hashrate_24h ?? 0,
      active_miners: poolStats.miners?.active ?? 0,
      total_blocks_found: poolStats.blocks?.found ?? 0,
    } : null,
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
