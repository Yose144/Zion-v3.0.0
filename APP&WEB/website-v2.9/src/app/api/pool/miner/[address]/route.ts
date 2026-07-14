import { NextResponse, NextRequest } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION } from '@/lib/constants';
import { SITE_PRIMARY_POOL_API_URL } from '@/lib/site';

const ACTIVE_THRESHOLD_SECONDS = 600;

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
 * The pool server tracks miners by worker name (e.g. "local-miner"), not by
 * payout address. When a miner is looked up by their ZION payout address, the
 * direct `/api/v1/miner/:address/stats` call will fail. We therefore also fetch
 * the full `/miners` list and cross-reference by `payout_address`.
 */
async function findMinerByPayoutAddress(address: string): Promise<any | null> {
  const list = await fetchPoolApiJson<any>('/miners?limit=500');
  if (!list?.ok || !Array.isArray(list?.miners)) return null;
  const lower = address.toLowerCase();
  return list.miners.find((m: any) =>
    typeof m.payout_address === 'string' && m.payout_address.toLowerCase() === lower,
  ) ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!address || address.length < 10) {
    return NextResponse.json({ ok: false, error: 'Invalid address' }, { status: 400 });
  }

  const rpc = getZionRpc();

  // Fetch pool stats, direct miner stats, miner list (for payout_address cross-ref), and chain info in parallel
  const [balance, poolStats, minerStatsPayload, payoutsPayload, info, minersListMiner] = await Promise.all([
    rpc.getAddressBalance(address).catch(() => null),
    rpc.getPoolStats().catch(() => null),
    fetchPoolApiJson<any>(`/api/v1/miner/${address}/stats`),
    fetchPoolApiJson<any>(`/api/v1/miner/${address}/payouts`),
    rpc.getInfo().catch(() => null),
    findMinerByPayoutAddress(address),
  ]);

  // Prefer direct miner stats; fall back to cross-referenced miner from /miners list
  let minerStats = minerStatsPayload?.ok && minerStatsPayload?.stats ? minerStatsPayload.stats : null;
  if (!minerStats && minersListMiner) {
    minerStats = minersListMiner;
  }

  const pendingPayouts = payoutsPayload?.ok && Array.isArray(payoutsPayload?.pending_payouts)
    ? payoutsPayload.pending_payouts
    : [];

  const validShares = minerStats?.valid_shares ?? 0;
  const invalidShares = minerStats?.invalid_shares ?? 0;
  const totalShares = validShares + invalidShares;
  const efficiency = totalShares > 0 ? ((validShares / totalShares) * 100).toFixed(2) : '0';
  const lastShareTime = minerStats?.last_share_time ?? minerStats?.last_share ?? minerStats?.last_seen ?? 0;
  const now = Math.floor(Date.now() / 1000);
  const active = lastShareTime > 0 && (now - lastShareTime) < ACTIVE_THRESHOLD_SECONDS;

  // Scan recent blocks for blocks mined by this address.
  // Use a wider window (500 blocks) since the miner may have found blocks earlier.
  let blocks: Array<{ height: number; hash: string; reward: number; timestamp: number; server: string }> = [];
  const tipHeight = Math.max(0, info?.height ?? 0);
  if (tipHeight > 0) {
    try {
      const headers = await rpc.getBlockHeaders(Math.max(0, tipHeight - 499), tipHeight);
      blocks = headers
        .filter((header) => header.miner_address === address)
        .slice()
        .reverse()
        .slice(0, 50)
        .map((header) => ({
          height: header.height,
          hash: header.hash,
          reward: header.reward,
          timestamp: header.timestamp,
          server: 'primary',
        }));
    } catch {
      blocks = [];
    }
  }

  // Robust fallback: scan on-chain account transactions from the pool wallet
  // so miner stats survive pool restarts / lost telemetry.
  const chainPayouts = await rpc.getChainPayoutsForAddress(address).catch(() => ({ totalPaidAtomic: 0, payouts: [] }));

  const poolTotalPaidAtomic = minerStats?.total_paid ?? 0;
  const totalPaidAtomic = chainPayouts.totalPaidAtomic || poolTotalPaidAtomic;

  const pendingPayoutRows = pendingPayouts.map((payout: any) => ({
    amount: payout.amount_atomic ?? Math.round((payout.amount ?? 0) * ATOMIC_UNITS_PER_ZION),
    tx_id: payout.tx_id,
    timestamp: payout.created_ts ?? payout.updated_ts ?? 0,
    status: payout.status ?? 'pending',
  }));

  const payouts = [...pendingPayoutRows, ...chainPayouts.payouts]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50);

  // Determine status: active, recently active (payouts in last 24h), or inactive
  const lastPayoutTs = payouts.length > 0 ? payouts[0].timestamp : 0;
  const recentlyActive = !active && lastPayoutTs > 0 && (now - lastPayoutTs) < 86400;
  const everActive = active || recentlyActive || totalShares > 0 || totalPaidAtomic > 0 || blocks.length > 0;

  return NextResponse.json({
    ok: true,
    address,
    active,
    recently_active: recentlyActive,
    ever_active: everActive,
    worker_name: minersListMiner?.worker_name ?? minerStats?.worker_name ?? null,
    algorithm: minersListMiner?.algorithm ?? minerStats?.algorithm ?? '',
    backend: minersListMiner?.backend ?? minerStats?.backend ?? '',
    stats: {
      hashrate_1h: minerStats?.hashrate_1h ?? minerStats?.hashrate ?? 0,
      hashrate_24h: minerStats?.hashrate_24h ?? 0,
      total_shares: totalShares,
      valid_shares: validShares,
      invalid_shares: invalidShares,
      efficiency,
      blocks_found: minerStats?.blocks_found ?? blocks.length,
      total_paid: totalPaidAtomic,
      pending_balance: minerStats?.pending_balance ?? 0,
      last_share_time: lastShareTime,
    },
    payouts,
    blocks,
    pool_stats: poolStats ? {
      pool_hashrate: poolStats.hashrate?.pool ?? poolStats.pool_hashrate ?? 0,
      pool_hashrate_1h: poolStats.hashrate?.pool_1h ?? poolStats.pool_hashrate_1h ?? 0,
      pool_hashrate_24h: poolStats.hashrate?.pool_24h ?? poolStats.pool_hashrate_24h ?? 0,
      active_miners: poolStats.miners?.active ?? 0,
      total_miners: poolStats.miners?.registered ?? 0,
      blocks_found: poolStats.blocks?.found ?? 0,
      total_paid_atomic: poolStats.payouts?.total_paid_atomic ?? 0,
    } : null,
    servers: [{
      id: 'primary',
      connected: !!poolStats,
    }],
  });
}
