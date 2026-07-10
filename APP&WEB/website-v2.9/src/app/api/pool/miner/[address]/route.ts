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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!address || address.length < 10) {
    return NextResponse.json({ ok: false, error: 'Invalid address' }, { status: 400 });
  }

  const rpc = getZionRpc();

  const [balance, poolStats, minerStatsPayload, payoutsPayload, info] = await Promise.all([
    rpc.getAddressBalance(address).catch(() => null),
    rpc.getPoolStats().catch(() => null),
    fetchPoolApiJson<any>(`/api/v1/miner/${address}/stats`),
    fetchPoolApiJson<any>(`/api/v1/miner/${address}/payouts`),
    rpc.getInfo().catch(() => null),
  ]);

  const minerStats = minerStatsPayload?.ok && minerStatsPayload?.stats ? minerStatsPayload.stats : null;
  const pendingPayouts = payoutsPayload?.ok && Array.isArray(payoutsPayload?.pending_payouts)
    ? payoutsPayload.pending_payouts
    : [];

  const validShares = minerStats?.valid_shares ?? 0;
  const invalidShares = minerStats?.invalid_shares ?? 0;
  const totalShares = validShares + invalidShares;
  const efficiency = totalShares > 0 ? ((validShares / totalShares) * 100).toFixed(2) : '0';
  const lastShareTime = minerStats?.last_share_time ?? 0;
  const active = lastShareTime > 0 && Math.floor(Date.now() / 1000) - lastShareTime < 600;

  let blocks: Array<{ height: number; hash: string; reward: number; timestamp: number; server: string }> = [];
  const tipHeight = Math.max(0, info?.height ?? 0);
  if (tipHeight > 0) {
    try {
      const headers = await rpc.getBlockHeaders(Math.max(0, tipHeight - 199), tipHeight);
      blocks = headers
        .filter((header) => header.miner_address === address)
        .slice()
        .reverse()
        .slice(0, 20)
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

  return NextResponse.json({
    ok: true,
    address,
    active,
    stats: {
      hashrate_1h: minerStats?.hashrate_1h ?? 0,
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
    servers: [{
      id: 'primary',
      connected: !!poolStats,
    }],
  });
}
