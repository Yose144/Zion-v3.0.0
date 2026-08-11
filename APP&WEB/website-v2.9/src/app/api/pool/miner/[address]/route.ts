import { NextResponse, NextRequest } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { ATOMIC_UNITS_PER_ZION } from '@/lib/constants';

export const maxDuration = 30;

const ACTIVE_THRESHOLD_SECONDS = 600;

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
  const [poolStats, minerInfo, info] = await Promise.all([
    rpc.getPoolStats().catch(() => null),
    rpc.getMinerInfo(address).catch(() => null),
    rpc.getInfo().catch(() => null),
  ]);

  // Normalize minerInfo from getMinerInfo into the shape the rest of the route expects.
  let minerStats: any = null;
  if (minerInfo) {
    minerStats = {
      hashrate: minerInfo.hashrate ?? 0,
      hashrate_1h: minerInfo.hashrate_1h ?? 0,
      hashrate_24h: minerInfo.hashrate_24h ?? 0,
      valid_shares: minerInfo.accepted_shares ?? 0,
      invalid_shares: minerInfo.rejected_shares ?? 0,
      blocks_found: minerInfo.blocks_found ?? 0,
      pending_balance: minerInfo.balance?.pending ? Math.round(minerInfo.balance.pending * ATOMIC_UNITS_PER_ZION) : 0,
      last_share_time: minerInfo.last_seen ?? 0,
      worker_name: minerInfo.worker ?? address,
      algorithm: minerInfo.algorithm ?? '',
      backend: minerInfo.backend ?? '',
    };
  }

  // Fall back to cross-referenced miner from /miners list
  if (!minerStats && poolStats?.miners_list) {
    const lower = address.toLowerCase();
    const matched = poolStats.miners_list.find((m: any) =>
      (m.address || m.miner_id || '').toLowerCase() === lower,
    );
    if (matched) {
      minerStats = {
        hashrate: matched.hashrate_hps ?? 0,
        hashrate_1h: matched.hashrate_1h_hps ?? 0,
        hashrate_24h: matched.hashrate_24h_hps ?? 0,
        valid_shares: matched.valid_shares ?? 0,
        invalid_shares: matched.invalid_shares ?? 0,
        blocks_found: matched.blocks_found ?? 0,
        pending_balance: 0,
        last_share_time: matched.last_share_time ?? 0,
        worker_name: matched.worker || matched.worker_name || address,
        algorithm: matched.algorithm || '',
        backend: matched.backend || '',
      };
    }
  }

  const pendingPayouts = Array.isArray(minerInfo?.recent_payouts)
    ? minerInfo.recent_payouts.filter((p: any) => p.status === 'pending')
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

  const poolTotalPaidAtomic = minerInfo?.balance?.paid
    ? Math.round(minerInfo.balance.paid * ATOMIC_UNITS_PER_ZION)
    : (minerStats?.paid_total_atomic ?? 0);

  const totalPaidAtomic = chainPayouts.totalPaidAtomic || poolTotalPaidAtomic;

  const pendingPayoutRows = pendingPayouts.map((payout: any) => ({
    amount: Math.round((payout.amount ?? 0) * ATOMIC_UNITS_PER_ZION),
    tx_id: payout.tx_id,
    timestamp: payout.timestamp ?? 0,
    status: payout.status ?? 'pending',
  }));

  const payouts = [...pendingPayoutRows, ...(minerInfo?.recent_payouts || [])]
    .filter((p) => p.status !== 'pending')
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
    worker_name: minerStats?.worker_name ?? null,
    algorithm: minerStats?.algorithm ?? '',
    backend: minerStats?.backend ?? '',
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
